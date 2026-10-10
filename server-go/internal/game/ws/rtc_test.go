package ws

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pion/webrtc/v4"

	"kartsim/internal/game/lobby"
	"kartsim/internal/shared/netcfg"
)

// startRTC runs a node answering WebRTC offers (and WebSockets) on loopback.
func startRTC(t *testing.T, enable bool) (*Server, string) {
	t.Helper()
	l := lobby.New(lobby.Options{NodeID: "game-rtc", Presence: nopPresence{}, Tickets: anyTickets{},
		AllowGuests: true})
	s := NewServer(l, netcfg.LoopbackOnly(), Options{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	if enable {
		if err := s.EnableWebRTC(RTCOptions{IncludeLoopback: true}); err != nil {
			t.Fatal(err)
		}
	}
	mux := http.NewServeMux()
	mux.Handle("GET /multiplayer/ws", s)
	mux.Handle("POST /multiplayer/offer", s.OfferHandler())
	server := httptest.NewServer(mux)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = s.Shutdown(ctx)
		server.Close()
	})
	return s, server.URL + "/multiplayer/offer"
}

// rtcClient is a browser-like peer: the negotiated control and motion channels.
type rtcClient struct {
	pc       *webrtc.PeerConnection
	control  *webrtc.DataChannel
	motion   *webrtc.DataChannel
	texts    chan map[string]any
	binaries chan []byte
	closed   chan struct{}
}

func dialRTC(t *testing.T, offerURL string) *rtcClient {
	t.Helper()
	var engine webrtc.SettingEngine
	engine.SetIncludeLoopbackCandidate(true)
	engine.SetNetworkTypes([]webrtc.NetworkType{webrtc.NetworkTypeUDP4})
	pc, err := webrtc.NewAPI(webrtc.WithSettingEngine(engine)).NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = pc.Close() })
	yes, no := true, false
	controlID, motionID, retransmits := uint16(0), uint16(1), uint16(0)
	control, err := pc.CreateDataChannel("control", &webrtc.DataChannelInit{Negotiated: &yes, ID: &controlID, Ordered: &yes})
	if err != nil {
		t.Fatal(err)
	}
	motion, err := pc.CreateDataChannel("motion", &webrtc.DataChannelInit{Negotiated: &yes, ID: &motionID,
		Ordered: &no, MaxRetransmits: &retransmits})
	if err != nil {
		t.Fatal(err)
	}
	c := &rtcClient{pc: pc, control: control, motion: motion, texts: make(chan map[string]any, 64),
		binaries: make(chan []byte, 64), closed: make(chan struct{})}
	opened := make(chan struct{})
	control.OnOpen(func() { close(opened) })
	control.OnClose(func() { close(c.closed) })
	control.OnMessage(func(message webrtc.DataChannelMessage) {
		var m map[string]any
		_ = json.Unmarshal(message.Data, &m)
		c.texts <- m
	})
	motion.OnMessage(func(message webrtc.DataChannelMessage) { c.binaries <- message.Data })

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		t.Fatal(err)
	}
	gathered := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		t.Fatal(err)
	}
	<-gathered
	body, _ := json.Marshal(map[string]string{"type": "offer", "sdp": pc.LocalDescription().SDP})
	response, err := http.Post(offerURL, "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var answer struct{ Type, SDP string }
	if response.StatusCode != http.StatusOK || json.NewDecoder(response.Body).Decode(&answer) != nil ||
		answer.Type != "answer" {
		t.Fatalf("offer: HTTP %d %+v", response.StatusCode, answer)
	}
	if err := pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: answer.SDP}); err != nil {
		t.Fatal(err)
	}
	select {
	case <-opened:
	case <-time.After(10 * time.Second):
		t.Fatal("control channel did not open")
	}
	return c
}

func (c *rtcClient) request(t *testing.T, payload string) map[string]any {
	t.Helper()
	if err := c.control.SendText(payload); err != nil {
		t.Fatal(err)
	}
	var sent map[string]any
	_ = json.Unmarshal([]byte(payload), &sent)
	deadline := time.After(5 * time.Second)
	for {
		select {
		case m := <-c.texts:
			if m["requestId"] == sent["requestId"] {
				return m
			}
		case <-deadline:
			t.Fatalf("no reply to %s", payload)
		}
	}
}

const rtcHello = `{"type":"hello","requestId":"h","protocolVersion":40,"ruleset":"launcher-room-v1",` +
	`"resourceVersion":"p3553","name":"Rtc","ticket":"any"}`

// A browser's WebRTC offer gets an answer; commands run over the control
// channel and motion frames over the unordered motion channel.
func TestWebRTCCarriesTheLobbyProtocol(t *testing.T) {
	s, offerURL := startRTC(t, true)
	client := dialRTC(t, offerURL)
	if welcome := client.request(t, rtcHello); welcome["type"] != "welcome" {
		t.Fatalf("hello: %v", welcome)
	}
	if clock := client.request(t, `{"type":"clock","clientTick":5,"requestId":"c"}`); clock["type"] != "clock" {
		t.Fatalf("clock: %v", clock)
	}
	if s.Connections() != 1 {
		t.Fatalf("connections %d", s.Connections())
	}
	// The node's motion frames use the motion channel.
	s.mu.Lock()
	var server *conn
	for c := range s.conns {
		server = c
	}
	s.mu.Unlock()
	frame := bytes.Repeat([]byte{7}, 136)
	server.Binary(frame)
	select {
	case got := <-client.binaries:
		if !bytes.Equal(got, frame) {
			t.Fatalf("motion frame %v", got)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("no motion frame")
	}
	// Closing the peer releases the player.
	_ = client.pc.Close()
	deadline := time.Now().Add(20 * time.Second)
	for s.Connections() != 0 {
		if time.Now().After(deadline) {
			t.Fatal("the closed peer still holds a connection")
		}
		time.Sleep(50 * time.Millisecond)
	}
}

// Without WebRTC the node answers 501 USE_WEBSOCKET, which browsers take
// as "connect over the WebSocket".
func TestOfferWithoutWebRTCAsksForTheWebSocket(t *testing.T) {
	_, offerURL := startRTC(t, false)
	response, err := http.Post(offerURL, "application/json", bytes.NewReader([]byte(`{"type":"offer","sdp":"v=0"}`)))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	if response.StatusCode != http.StatusNotImplemented || !bytes.Contains(body, []byte("USE_WEBSOCKET")) {
		t.Fatalf("HTTP %d %s", response.StatusCode, body)
	}
}

// Malformed offers are refused before any peer is created.
func TestMalformedOffersAreRefused(t *testing.T) {
	s, offerURL := startRTC(t, true)
	for _, body := range []string{`{}`, `{"type":"answer","sdp":"x"}`, `{"type":"offer","sdp":"v=0"}`, `[`} {
		response, err := http.Post(offerURL, "application/json", bytes.NewReader([]byte(body)))
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != http.StatusBadRequest {
			t.Fatalf("%s: HTTP %d", body, response.StatusCode)
		}
	}
	if s.Connections() != 0 {
		t.Fatalf("connections %d", s.Connections())
	}
}

// A WebRTC peer is shut down with the node.
func TestShutdownClosesWebRTCPeers(t *testing.T) {
	s, offerURL := startRTC(t, true)
	client := dialRTC(t, offerURL)
	client.request(t, rtcHello)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := s.Shutdown(ctx); err != nil {
		t.Fatal(err)
	}
	select {
	case <-client.closed:
	case <-time.After(20 * time.Second):
		t.Fatal("the client's control channel stayed open")
	}
}
