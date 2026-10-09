package ws

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/ice/v4"
	"github.com/pion/webrtc/v4"

	"kartsim/internal/shared/apierr"
)

// WebRTC transport (POST /multiplayer/offer). The browser offers two
// negotiated data channels and the node answers with all its ICE
// candidates at once (no trickle):
//
//   - "control" (id 0, ordered and reliable) carries the JSON commands and
//     events of the WebSocket text frames;
//   - "motion" (id 1, unordered, no retransmits) carries the binary motion
//     frames, so a lost or late frame never holds back the newer ones (a
//     WebSocket delivers them in order over TCP).
//
// Both run through the same connection code as a WebSocket: rate limits,
// hello, the lobby and the outbound queue. A browser that cannot reach the
// node over UDP falls back to the WebSocket.

// RTCOptions configure the WebRTC transport (KART_WEBRTC_*).
type RTCOptions struct {
	// UDPPort, when set, carries every peer's traffic on this one UDP port
	// (an ICE UDP mux), which is what a firewall or a container publishes.
	// Zero uses a random port per peer.
	UDPPort int
	// PublicIPs replace the host candidates' addresses (1:1 NAT: a cloud VM
	// or a container whose public address is not on an interface).
	PublicIPs []string
	// IncludeLoopback offers 127.0.0.1 candidates too (a browser on the same
	// machine as the node, local development).
	IncludeLoopback bool
}

const (
	// maxOfferBytes bounds the signaling request; maxSDPBytes the SDP in it
	// (the browser's answer check uses the same 32 KiB).
	maxOfferBytes = 64 << 10
	maxSDPBytes   = 32 << 10
	// gatherTimeout bounds waiting for the node's own ICE candidates.
	gatherTimeout = 5 * time.Second
	// openTimeout closes a peer whose control channel never opened.
	openTimeout = 20 * time.Second
	// disconnectedGrace lets ICE recover a briefly lost path.
	disconnectedGrace = 10 * time.Second
	// rtcInbox is how many received messages may wait for the reader.
	rtcInbox = 512
	// motionBuffered drops motion frames while this much is still unsent:
	// a newer frame supersedes them anyway.
	motionBuffered = 64 << 10
)

var errRTCSendBuffer = errors.New("WebRTC send buffer overflow")

// EnableWebRTC starts serving OfferHandler with these options; until then
// (and after a failure) the node offers only the WebSocket.
func (s *Server) EnableWebRTC(opts RTCOptions) error {
	var engine webrtc.SettingEngine
	engine.SetNetworkTypes([]webrtc.NetworkType{webrtc.NetworkTypeUDP4, webrtc.NetworkTypeUDP6})
	engine.SetIncludeLoopbackCandidate(opts.IncludeLoopback)
	// Browsers hide their host addresses behind mDNS names.
	engine.SetICEMulticastDNSMode(ice.MulticastDNSModeQueryOnly)
	engine.SetICETimeouts(5*time.Second, 15*time.Second, 2*time.Second)
	if len(opts.PublicIPs) > 0 {
		for _, ip := range opts.PublicIPs {
			if net.ParseIP(ip) == nil {
				return fmt.Errorf("KART_WEBRTC_PUBLIC_IPS: %q is not an IP address", ip)
			}
		}
		if err := engine.SetICEAddressRewriteRules(webrtc.ICEAddressRewriteRule{
			External: opts.PublicIPs, AsCandidateType: webrtc.ICECandidateTypeHost,
		}); err != nil {
			return err
		}
	}
	var mux io.Closer
	if opts.UDPPort > 0 {
		muxOpts := []ice.UDPMuxFromPortOption{}
		if opts.IncludeLoopback {
			muxOpts = append(muxOpts, ice.UDPMuxFromPortWithLoopback())
		}
		udp, err := ice.NewMultiUDPMuxFromPort(opts.UDPPort, muxOpts...)
		if err != nil {
			return fmt.Errorf("WebRTC UDP port %d: %w", opts.UDPPort, err)
		}
		engine.SetICEUDPMux(udp)
		mux = udp
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rtc = webrtc.NewAPI(webrtc.WithSettingEngine(engine))
	s.rtcMux = mux
	return nil
}

// WebRTCEnabled reports whether OfferHandler answers offers.
func (s *Server) WebRTCEnabled() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.rtc != nil
}

// OfferHandler answers a browser's WebRTC offer and runs the connection on
// its data channels. Without EnableWebRTC it answers 501 USE_WEBSOCKET,
// which the browser takes as "use the WebSocket".
func (s *Server) OfferHandler() http.Handler {
	return http.HandlerFunc(s.serveOffer)
}

func (s *Server) serveOffer(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin != "" && !s.originAllowed(r) {
		apierr.WriteError(w, apierr.New(http.StatusForbidden, "ORIGIN_NOT_ALLOWED"))
		return
	}
	var request struct {
		Type string `json:"type"`
		SDP  string `json:"sdp"`
	}
	body := http.MaxBytesReader(w, r.Body, maxOfferBytes)
	if err := json.NewDecoder(body).Decode(&request); err != nil || request.Type != "offer" ||
		request.SDP == "" || len(request.SDP) > maxSDPBytes {
		apierr.WriteError(w, apierr.New(http.StatusBadRequest, "INVALID_OFFER"))
		return
	}

	busy := s.opts.Busy != nil && s.opts.Busy()
	s.mu.Lock()
	api := s.rtc
	var rejected *apierr.Error
	switch {
	case api == nil:
		rejected = apierr.New(http.StatusNotImplemented, "USE_WEBSOCKET")
	case s.closing:
		rejected = apierr.New(http.StatusServiceUnavailable, "SERVER_SHUTTING_DOWN")
	case s.opts.MaxConnections > 0 && len(s.conns)+s.upgrading >= s.opts.MaxConnections:
		rejected = apierr.New(http.StatusServiceUnavailable, "SERVER_FULL")
	case busy:
		rejected = apierr.New(http.StatusServiceUnavailable, "SERVER_BUSY")
	}
	if rejected != nil {
		s.mu.Unlock()
		apierr.WriteError(w, rejected)
		return
	}
	s.upgrading++
	s.mu.Unlock()
	registered := false
	defer func() {
		if !registered {
			s.mu.Lock()
			s.upgrading--
			s.mu.Unlock()
		}
	}()

	peer, err := newRTCPeer(api, s.opts)
	if err != nil {
		s.log.Warn("WebRTC peer not created", "error", err)
		apierr.WriteError(w, apierr.New(http.StatusInternalServerError, "INTERNAL_ERROR"))
		return
	}
	answer, err := peer.answer(request.SDP)
	if err != nil {
		_ = peer.pc.Close()
		s.log.Debug("WebRTC offer refused", "error", err)
		apierr.WriteError(w, apierr.New(http.StatusBadRequest, "INVALID_OFFER"))
		return
	}

	c := newConn(peer, s.opts, s.log)
	s.mu.Lock()
	s.upgrading--
	registered = true
	if s.closing {
		s.mu.Unlock()
		_ = peer.pc.Close()
		apierr.WriteError(w, apierr.New(http.StatusServiceUnavailable, "SERVER_SHUTTING_DOWN"))
		return
	}
	s.conns[c] = struct{}{}
	s.wg.Add(1)
	s.mu.Unlock()
	go s.runRTC(c, peer)

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(map[string]string{"type": "answer", "sdp": answer})
}

// originAllowed is the WebSocket upgrader's origin policy.
func (s *Server) originAllowed(r *http.Request) bool {
	return s.upgrader.CheckOrigin == nil || s.upgrader.CheckOrigin(r)
}

// runRTC is the connection's reader: it runs the received messages in order
// on one goroutine (like a WebSocket's read loop) until the peer goes away,
// then releases the player.
func (s *Server) runRTC(c *conn, peer *rtcPeer) {
	defer s.wg.Done()
	if s.opts.HelloTimeout > 0 {
		timer := time.AfterFunc(s.opts.HelloTimeout+openTimeout, func() {
			if !s.lobby.Admitted(c.client) {
				c.closeWith(websocket.ClosePolicyViolation, "hello timeout")
			}
		})
		defer timer.Stop()
	}
	go c.writeLoop()
	idle := time.NewTicker(time.Second)
	defer idle.Stop()
	opened := time.Now()
	last := time.Now()
loop:
	for {
		select {
		case <-c.done:
			break loop
		case <-peer.ended:
			break loop
		case message := <-peer.inbox:
			last = time.Now()
			if len(message.data) > int(s.opts.ReadLimit) {
				c.closeWith(websocket.CloseMessageTooBig, "message too big")
				break loop
			}
			if !s.receive(c, message.kind, message.data) {
				break loop
			}
		case now := <-idle.C:
			switch {
			case peer.overflowed():
				s.closeFlooder(c)
				break loop
			case !peer.isOpen() && now.Sub(opened) > openTimeout:
				break loop
			case peer.isOpen() && now.Sub(last) > s.opts.ReadTimeout:
				break loop
			}
		}
	}
	c.terminate()
	s.lobby.Disconnect(c.client)
	s.mu.Lock()
	delete(s.conns, c)
	s.mu.Unlock()
}

// rtcMessage is one received data channel message.
type rtcMessage struct {
	kind int
	data []byte
}

// rtcPeer is a connection's PeerConnection and data channels (its link).
type rtcPeer struct {
	pc      *webrtc.PeerConnection
	control *webrtc.DataChannel
	motion  *webrtc.DataChannel
	limit   uint64

	inbox chan rtcMessage
	ended chan struct{}

	mu       sync.Mutex
	open     bool
	flooded  bool
	stopped  bool
	lostAt   time.Time
	lostWait *time.Timer
}

func newRTCPeer(api *webrtc.API, opts Options) (*rtcPeer, error) {
	pc, err := api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		return nil, err
	}
	yes, no := true, false
	controlID, motionID, retransmits := uint16(0), uint16(1), uint16(0)
	control, err := pc.CreateDataChannel("control", &webrtc.DataChannelInit{
		Negotiated: &yes, ID: &controlID, Ordered: &yes})
	if err != nil {
		_ = pc.Close()
		return nil, err
	}
	motion, err := pc.CreateDataChannel("motion", &webrtc.DataChannelInit{
		Negotiated: &yes, ID: &motionID, Ordered: &no, MaxRetransmits: &retransmits})
	if err != nil {
		_ = pc.Close()
		return nil, err
	}
	p := &rtcPeer{pc: pc, control: control, motion: motion, limit: uint64(opts.SendBufferLimit),
		inbox: make(chan rtcMessage, rtcInbox), ended: make(chan struct{})}
	control.OnOpen(func() {
		p.mu.Lock()
		p.open = true
		p.mu.Unlock()
	})
	control.OnClose(p.end)
	control.OnMessage(func(message webrtc.DataChannelMessage) {
		if !message.IsString {
			p.end() // the control channel carries JSON text only
			return
		}
		p.deliver(rtcMessage{kind: websocket.TextMessage, data: message.Data}, true)
	})
	motion.OnMessage(func(message webrtc.DataChannelMessage) {
		if message.IsString {
			return
		}
		p.deliver(rtcMessage{kind: websocket.BinaryMessage, data: message.Data}, false)
	})
	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		switch state {
		case webrtc.PeerConnectionStateFailed, webrtc.PeerConnectionStateClosed:
			p.end()
		case webrtc.PeerConnectionStateDisconnected:
			p.mu.Lock()
			if p.lostWait == nil && !p.stopped {
				p.lostWait = time.AfterFunc(disconnectedGrace, func() {
					if p.pc.ConnectionState() == webrtc.PeerConnectionStateDisconnected {
						p.end()
					}
				})
			}
			p.mu.Unlock()
		case webrtc.PeerConnectionStateConnected:
			p.mu.Lock()
			if p.lostWait != nil {
				p.lostWait.Stop()
				p.lostWait = nil
			}
			p.mu.Unlock()
		}
	})
	return p, nil
}

// answer applies the browser's offer and returns the node's answer with
// every candidate gathered.
func (p *rtcPeer) answer(offer string) (string, error) {
	if !strings.Contains(offer, "m=application") {
		return "", errors.New("offer without data channels")
	}
	if err := p.pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: offer}); err != nil {
		return "", err
	}
	answer, err := p.pc.CreateAnswer(nil)
	if err != nil {
		return "", err
	}
	gathered := webrtc.GatheringCompletePromise(p.pc)
	if err := p.pc.SetLocalDescription(answer); err != nil {
		return "", err
	}
	select {
	case <-gathered:
	case <-time.After(gatherTimeout):
	}
	local := p.pc.LocalDescription()
	if local == nil {
		return "", errors.New("no local description")
	}
	return local.SDP, nil
}

// deliver hands a message to the reader without blocking the SCTP stack:
// a full inbox drops motion frames and, for commands, marks the client as
// flooding.
func (p *rtcPeer) deliver(message rtcMessage, command bool) {
	select {
	case p.inbox <- message:
	default:
		if command {
			p.mu.Lock()
			p.flooded = true
			p.mu.Unlock()
		}
	}
}

func (p *rtcPeer) end() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.stopped {
		return
	}
	p.stopped = true
	if p.lostWait != nil {
		p.lostWait.Stop()
	}
	close(p.ended)
}

func (p *rtcPeer) isOpen() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.open
}

func (p *rtcPeer) overflowed() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.flooded
}

// write sends a command or event on the control channel and a motion frame
// on the motion channel (dropped while the channel is not open or still
// busy with older frames).
func (p *rtcPeer) write(f frame) error {
	if f.kind == websocket.BinaryMessage {
		if p.motion.ReadyState() != webrtc.DataChannelStateOpen || p.motion.BufferedAmount() > motionBuffered {
			return nil
		}
		if err := p.motion.Send(f.data); err != nil && p.motion.ReadyState() == webrtc.DataChannelStateOpen {
			return err
		}
		return nil
	}
	if p.control.BufferedAmount() > p.limit {
		return errRTCSendBuffer
	}
	return p.control.SendText(string(f.data))
}

// ping is not needed: ICE keepalives (SetICETimeouts) watch the path.
func (p *rtcPeer) ping() error { return nil }

// sendClose has nothing to send: a data channel has no close reason.
func (p *rtcPeer) sendClose(int, string) {}

func (p *rtcPeer) close() error {
	p.end()
	// Closing waits for the SCTP shutdown; the caller may hold no lock.
	go func() { _ = p.pc.Close() }()
	return nil
}
