// Package config reads the game node settings from the environment
// (DESIGN.md 4.1).
package config

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"kartsim/internal/game/anticheat"
	"kartsim/internal/shared/netcfg"
	"kartsim/internal/shared/ticket"
)

// SameOrigin is the KART_PUBLIC_ORIGIN value for a node reached through the
// data service's origin (a reverse proxy routes /multiplayer/ws).
const SameOrigin = "same-origin"

// MaxPlayersLimit bounds KART_MAX_PLAYERS: the data service rejects a
// heartbeat that lists more online players than this, which would drop the
// node from the game-server list.
const MaxPlayersLimit = 10_000

var nodeIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// Config is the validated node configuration.
type Config struct {
	Addr            string
	Port            int
	NodeID          string
	NodeName        string
	PublicOrigin    string // "" when SameOrigin
	DataInternalURL string
	DataNodeID      string
	Secret          []byte
	MaxPlayers      int
	OutboxDir       string
	Network         *netcfg.Network

	// AllowGuests admits guest tickets (KART_ALLOW_GUESTS, default false:
	// hello with a guest ticket answers 401 LOGIN_REQUIRED).
	AllowGuests bool
	// ItemTestGrants lets an item race cube request name the item it grants
	// (KART_ITEM_TEST_GRANTS, default false): a development switch for test
	// bots and manual testing, never for a public deployment.
	ItemTestGrants bool
	// ItemChangersInfinite gives every item racer unlimited item changers
	// (KART_ITEM_CHANGERS=infinite; default inventory: the cards and
	// vouchers each account owns), a playtest switch.
	ItemChangersInfinite bool
	// AntiCheat is what the node does about racers failing the anti-cheat
	// checks (KART_ANTICHEAT=kick|log|off, default kick; ANTICHEAT.md).
	AntiCheat anticheat.Mode
	// Memory guards (DESIGN.md 4.5).
	MaxConnections  int           // WebSockets including those without hello
	MaxRooms        int           // rooms on this node
	SendBufferBytes int           // queued outbound bytes per connection
	MemoryLimitMB   int           // 0 = no limit
	HelloTimeout    time.Duration // close connections that do not say hello in time

	// WSCompression negotiates permessage-deflate on /multiplayer/ws
	// (KART_WS_COMPRESSION, default true).
	WSCompression bool

	// HeartbeatInterval is 5 s; tests shorten it.
	HeartbeatInterval time.Duration

	// WebRTC transport (POST /multiplayer/offer, internal/game/ws/rtc.go):
	// KART_WEBRTC (default true), KART_WEBRTC_UDP_PORT (0: a random port
	// per peer), KART_WEBRTC_PUBLIC_IPS (1:1 NAT addresses) and
	// KART_WEBRTC_LOOPBACK (default true: 127.0.0.1 candidates too).
	WebRTC          bool
	WebRTCUDPPort   int
	WebRTCPublicIPs []string
	WebRTCLoopback  bool
}

// ListenAddr is the host:port the HTTP server binds.
func (c Config) ListenAddr() string {
	return net.JoinHostPort(c.Addr, strconv.Itoa(c.Port))
}

// FromEnv reads and validates the configuration through getenv.
func FromEnv(getenv func(string) string) (Config, error) {
	env := func(name, fallback string) string {
		if value := strings.TrimSpace(getenv(name)); value != "" {
			return value
		}
		return fallback
	}
	var cfg Config
	var problems []error

	cfg.Addr = env("KART_GAME_ADDR", env("SERVER_ADDRESS", "127.0.0.1"))
	port, err := strconv.Atoi(env("KART_GAME_PORT", "8788"))
	if err != nil || port < 1 || port > 65535 {
		problems = append(problems, errors.New("KART_GAME_PORT 必须是 1–65535 的端口号"))
	}
	cfg.Port = port

	cfg.NodeID = env("KART_NODE_ID", "game-"+strconv.Itoa(port))
	if !nodeIDPattern.MatchString(cfg.NodeID) {
		problems = append(problems, errors.New("KART_NODE_ID 只允许 [A-Za-z0-9_-]，长度 1–64"))
	}
	cfg.NodeName = env("KART_NODE_NAME", cfg.NodeID)
	if utf8.RuneCountInString(cfg.NodeName) > 32 || hasControl(cfg.NodeName) {
		problems = append(problems, errors.New("KART_NODE_NAME 最多 32 个字符且不能含控制字符"))
	}

	origin := env("KART_PUBLIC_ORIGIN", "http://127.0.0.1:"+strconv.Itoa(port))
	if origin == SameOrigin {
		cfg.PublicOrigin = ""
	} else if normalized, err := normalizeOrigin(origin); err != nil {
		problems = append(problems, fmt.Errorf("KART_PUBLIC_ORIGIN: %w", err))
	} else {
		cfg.PublicOrigin = normalized
	}

	dataURL := strings.TrimRight(env("KART_DATA_INTERNAL_URL", "http://127.0.0.1:8790"), "/")
	if parsed, err := url.Parse(dataURL); err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") ||
		parsed.Host == "" {
		problems = append(problems, errors.New("KART_DATA_INTERNAL_URL 必须是 http(s) URL"))
	}
	cfg.DataInternalURL = dataURL

	cfg.DataNodeID = env("KART_DATA_NODE_ID", "data-1")
	if !nodeIDPattern.MatchString(cfg.DataNodeID) {
		problems = append(problems, errors.New("KART_DATA_NODE_ID 只允许 [A-Za-z0-9_-]，长度 1–64"))
	}

	secret := getenv("KART_CLUSTER_SECRET")
	if len(secret) < ticket.MinSecretLength {
		problems = append(problems, fmt.Errorf("KART_CLUSTER_SECRET 必填且至少 %d 个字符", ticket.MinSecretLength))
	}
	cfg.Secret = []byte(secret)

	maxPlayers, err := strconv.Atoi(env("KART_MAX_PLAYERS", "400"))
	if err != nil || maxPlayers < 1 || maxPlayers > MaxPlayersLimit {
		problems = append(problems, fmt.Errorf("KART_MAX_PLAYERS 必须是 1–%d 的整数", MaxPlayersLimit))
	}
	cfg.MaxPlayers = maxPlayers

	// Memory guards (DESIGN.md 4.5).
	atLeast := func(name, fallback string, minimum int) int {
		value, err := strconv.Atoi(env(name, fallback))
		if err != nil || value < minimum {
			problems = append(problems, fmt.Errorf("%s 必须是不小于 %d 的整数", name, minimum))
		}
		return value
	}
	cfg.MaxConnections = atLeast("KART_MAX_CONNECTIONS", strconv.Itoa(max(maxPlayers, 0)+50), 1)
	if maxPlayers >= 1 && cfg.MaxConnections < maxPlayers {
		problems = append(problems, errors.New("KART_MAX_CONNECTIONS 不能小于 KART_MAX_PLAYERS"))
	}
	cfg.MaxRooms = atLeast("KART_MAX_ROOMS", "200", 1)
	cfg.SendBufferBytes = atLeast("KART_SEND_BUFFER_BYTES", "1048576", 64<<10)
	cfg.MemoryLimitMB = atLeast("KART_MEMORY_LIMIT_MB", "0", 0)
	if cfg.MemoryLimitMB > 0 && cfg.MemoryLimitMB < 64 {
		problems = append(problems, errors.New("KART_MEMORY_LIMIT_MB 为 0（不限）或至少 64"))
	}
	helloTimeout, err := time.ParseDuration(env("KART_HELLO_TIMEOUT", "15s"))
	if err != nil || helloTimeout < time.Second || helloTimeout > 5*time.Minute {
		problems = append(problems, errors.New("KART_HELLO_TIMEOUT 必须是 1s–5m 的时长，例如 15s"))
	}
	cfg.HelloTimeout = helloTimeout

	wsCompression, ok := parseBool(env("KART_WS_COMPRESSION", "true"))
	if !ok {
		problems = append(problems, errors.New("KART_WS_COMPRESSION 必须是 true 或 false"))
	}
	cfg.WSCompression = wsCompression

	cfg.OutboxDir = env("KART_OUTBOX_DIR", "./data/outbox-"+cfg.NodeID)

	allowGuests, ok := parseBool(env("KART_ALLOW_GUESTS", "false"))
	if !ok {
		problems = append(problems, errors.New("KART_ALLOW_GUESTS 必须是 true 或 false"))
	}
	cfg.AllowGuests = allowGuests

	itemTestGrants, ok := parseBool(env("KART_ITEM_TEST_GRANTS", "false"))
	if !ok {
		problems = append(problems, errors.New("KART_ITEM_TEST_GRANTS 必须是 true 或 false"))
	}
	cfg.ItemTestGrants = itemTestGrants

	switch changers := env("KART_ITEM_CHANGERS", "inventory"); changers {
	case "inventory":
	case "infinite":
		cfg.ItemChangersInfinite = true
	default:
		problems = append(problems, errors.New("KART_ITEM_CHANGERS 必须是 inventory 或 infinite"))
	}
	if mode, err := anticheat.ParseMode(env("KART_ANTICHEAT", "kick")); err != nil {
		problems = append(problems, err)
	} else {
		cfg.AntiCheat = mode
	}

	webRTC, ok := parseBool(env("KART_WEBRTC", "true"))
	if !ok {
		problems = append(problems, errors.New("KART_WEBRTC 必须是 true 或 false"))
	}
	cfg.WebRTC = webRTC
	udpPort, err := strconv.Atoi(env("KART_WEBRTC_UDP_PORT", "0"))
	if err != nil || udpPort < 0 || udpPort > 65535 {
		problems = append(problems, errors.New("KART_WEBRTC_UDP_PORT 必须是 0（随机端口）或 1–65535 的端口号"))
	}
	cfg.WebRTCUDPPort = udpPort
	for _, raw := range strings.Split(getenv("KART_WEBRTC_PUBLIC_IPS"), ",") {
		ip := strings.TrimSpace(raw)
		if ip == "" {
			continue
		}
		if net.ParseIP(ip) == nil {
			problems = append(problems, fmt.Errorf("KART_WEBRTC_PUBLIC_IPS：%q 不是 IP 地址", ip))
			continue
		}
		cfg.WebRTCPublicIPs = append(cfg.WebRTCPublicIPs, ip)
	}
	loopback, ok := parseBool(env("KART_WEBRTC_LOOPBACK", "true"))
	if !ok {
		problems = append(problems, errors.New("KART_WEBRTC_LOOPBACK 必须是 true 或 false"))
	}
	cfg.WebRTCLoopback = loopback

	lanHosts := getenv("KART_LAN_HOSTS")
	if lanHosts == "" {
		lanHosts = getenv("KART_LANHOSTS")
	}
	cfg.Network = netcfg.New(lanHosts)
	cfg.HeartbeatInterval = 5 * time.Second

	if len(problems) > 0 {
		return Config{}, errors.Join(problems...)
	}
	return cfg, nil
}

// normalizeOrigin accepts an http(s) origin without path, query or user info
// and returns it without a trailing slash.
func normalizeOrigin(origin string) (string, error) {
	parsed, err := url.Parse(origin)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" ||
		parsed.User != nil || (parsed.Path != "" && parsed.Path != "/") ||
		parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("必须是 http(s)://主机[:端口] 或 same-origin")
	}
	return parsed.Scheme + "://" + parsed.Host, nil
}

// parseBool accepts true/false, 1/0, yes/no and on/off in any case.
func parseBool(value string) (bool, bool) {
	switch strings.ToLower(value) {
	case "true", "1", "yes", "on":
		return true, true
	case "false", "0", "no", "off":
		return false, true
	}
	return false, false
}

func hasControl(value string) bool {
	for _, r := range value {
		if r < 0x20 || (r >= 0x7F && r <= 0x9F) {
			return true
		}
	}
	return false
}
