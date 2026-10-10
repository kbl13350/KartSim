package config

import (
	"strings"
	"testing"
	"time"
)

const secret = "0123456789abcdef0123456789abcdef"

func env(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

func TestDefaults(t *testing.T) {
	cfg, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ListenAddr() != "127.0.0.1:8788" || cfg.NodeID != "game-8788" || cfg.NodeName != "game-8788" ||
		cfg.PublicOrigin != "http://127.0.0.1:8788" || cfg.DataInternalURL != "http://127.0.0.1:8790" ||
		cfg.DataNodeID != "data-1" || cfg.MaxPlayers != 400 || cfg.OutboxDir != "./data/outbox-game-8788" ||
		string(cfg.Secret) != secret || cfg.HeartbeatInterval.Seconds() != 5 {
		t.Fatalf("defaults %+v", cfg)
	}
	if cfg.Network.AllowsHost("example.com") || !cfg.Network.AllowsHost("localhost") {
		t.Fatal("network defaults")
	}
}

func TestOverridesAndLegacyNames(t *testing.T) {
	cfg, err := FromEnv(env(map[string]string{
		"KART_CLUSTER_SECRET":    secret,
		"SERVER_ADDRESS":         "0.0.0.0",
		"KART_GAME_PORT":         "18760",
		"KART_NODE_ID":           "game_A-1",
		"KART_NODE_NAME":         "华东一区",
		"KART_PUBLIC_ORIGIN":     "same-origin",
		"KART_DATA_INTERNAL_URL": "http://10.0.0.2:8790/",
		"KART_MAX_PLAYERS":       "50",
		"KART_OUTBOX_DIR":        "/var/lib/kart/outbox",
		"KART_LANHOSTS":          "kart.lan",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ListenAddr() != "0.0.0.0:18760" || cfg.NodeID != "game_A-1" || cfg.NodeName != "华东一区" ||
		cfg.PublicOrigin != "" || cfg.DataInternalURL != "http://10.0.0.2:8790" || cfg.MaxPlayers != 50 ||
		cfg.OutboxDir != "/var/lib/kart/outbox" || !cfg.Network.AllowsHost("kart.lan") {
		t.Fatalf("overrides %+v", cfg)
	}
	cfg, err = FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret,
		"KART_GAME_ADDR": "::1", "KART_PUBLIC_ORIGIN": "https://kart.example.com:9443/"}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ListenAddr() != "[::1]:8788" || cfg.PublicOrigin != "https://kart.example.com:9443" {
		t.Fatalf("ipv6/origin %+v", cfg)
	}
}

func TestInvalidSettings(t *testing.T) {
	for name, values := range map[string]map[string]string{
		"KART_CLUSTER_SECRET":    {"KART_CLUSTER_SECRET": strings.Repeat("x", 31)},
		"KART_NODE_ID":           {"KART_CLUSTER_SECRET": secret, "KART_NODE_ID": "game 1"},
		"KART_NODE_NAME":         {"KART_CLUSTER_SECRET": secret, "KART_NODE_NAME": strings.Repeat("名", 33)},
		"KART_GAME_PORT":         {"KART_CLUSTER_SECRET": secret, "KART_GAME_PORT": "70000"},
		"KART_PUBLIC_ORIGIN":     {"KART_CLUSTER_SECRET": secret, "KART_PUBLIC_ORIGIN": "ws://x/path"},
		"KART_DATA_INTERNAL_URL": {"KART_CLUSTER_SECRET": secret, "KART_DATA_INTERNAL_URL": "redis://x"},
		"KART_DATA_NODE_ID":      {"KART_CLUSTER_SECRET": secret, "KART_DATA_NODE_ID": "data/1"},
		"KART_MAX_PLAYERS":       {"KART_CLUSTER_SECRET": secret, "KART_MAX_PLAYERS": "0"},
	} {
		_, err := FromEnv(env(values))
		if err == nil || !strings.Contains(err.Error(), name) {
			t.Errorf("%s: %v", name, err)
		}
	}
	// The data service refuses heartbeats listing more players than this.
	if _, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret,
		"KART_MAX_PLAYERS": "10001"})); err == nil || !strings.Contains(err.Error(), "KART_MAX_PLAYERS") {
		t.Errorf("KART_MAX_PLAYERS above the heartbeat limit: %v", err)
	}
}

func TestMemoryGuardSettings(t *testing.T) {
	cfg, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.MaxConnections != 450 || cfg.MaxRooms != 200 || cfg.SendBufferBytes != 1<<20 ||
		cfg.MemoryLimitMB != 0 || cfg.HelloTimeout != 15*time.Second {
		t.Fatalf("defaults %+v", cfg)
	}
	cfg, err = FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret, "KART_MAX_PLAYERS": "50"}))
	if err != nil || cfg.MaxConnections != 100 {
		t.Fatalf("connections follow players: %d %v", cfg.MaxConnections, err)
	}
	cfg, err = FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret,
		"KART_MAX_CONNECTIONS": "500", "KART_MAX_ROOMS": "20", "KART_SEND_BUFFER_BYTES": "262144",
		"KART_MEMORY_LIMIT_MB": "512", "KART_HELLO_TIMEOUT": "30s"}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.MaxConnections != 500 || cfg.MaxRooms != 20 || cfg.SendBufferBytes != 262144 ||
		cfg.MemoryLimitMB != 512 || cfg.HelloTimeout != 30*time.Second {
		t.Fatalf("overrides %+v", cfg)
	}
	for name, value := range map[string]string{
		"KART_MAX_CONNECTIONS":   "399", // below KART_MAX_PLAYERS
		"KART_MAX_ROOMS":         "0",
		"KART_SEND_BUFFER_BYTES": "1024",
		"KART_MEMORY_LIMIT_MB":   "16",
		"KART_HELLO_TIMEOUT":     "15",
	} {
		_, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret, name: value}))
		if err == nil || !strings.Contains(err.Error(), name) {
			t.Errorf("%s=%s: %v", name, value, err)
		}
	}
}

func TestAllowGuestsSetting(t *testing.T) {
	cfg, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret}))
	if err != nil || cfg.AllowGuests {
		t.Fatalf("default: guests %v (%v)", cfg.AllowGuests, err)
	}
	for value, want := range map[string]bool{"true": true, "1": true, "YES": true, "on": true,
		"false": false, "0": false, "No": false, "off": false} {
		cfg, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret, "KART_ALLOW_GUESTS": value}))
		if err != nil || cfg.AllowGuests != want {
			t.Errorf("KART_ALLOW_GUESTS=%s: %v %v", value, cfg.AllowGuests, err)
		}
	}
	_, err = FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret, "KART_ALLOW_GUESTS": "maybe"}))
	if err == nil || !strings.Contains(err.Error(), "KART_ALLOW_GUESTS") {
		t.Errorf("KART_ALLOW_GUESTS=maybe: %v", err)
	}
}

func TestItemTestGrantsSetting(t *testing.T) {
	cfg, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret}))
	if err != nil || cfg.ItemTestGrants {
		t.Fatalf("default: item test grants %v (%v)", cfg.ItemTestGrants, err)
	}
	for value, want := range map[string]bool{"true": true, "1": true, "false": false, "off": false} {
		cfg, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret, "KART_ITEM_TEST_GRANTS": value}))
		if err != nil || cfg.ItemTestGrants != want {
			t.Errorf("KART_ITEM_TEST_GRANTS=%s: %v %v", value, cfg.ItemTestGrants, err)
		}
	}
	_, err = FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret, "KART_ITEM_TEST_GRANTS": "sometimes"}))
	if err == nil || !strings.Contains(err.Error(), "KART_ITEM_TEST_GRANTS") {
		t.Errorf("KART_ITEM_TEST_GRANTS=sometimes: %v", err)
	}
}

func TestItemChangersSetting(t *testing.T) {
	cfg, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret}))
	if err != nil || cfg.ItemChangersInfinite {
		t.Fatalf("default: infinite changers %v (%v)", cfg.ItemChangersInfinite, err)
	}
	for value, want := range map[string]bool{"inventory": false, "infinite": true} {
		cfg, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret, "KART_ITEM_CHANGERS": value}))
		if err != nil || cfg.ItemChangersInfinite != want {
			t.Errorf("KART_ITEM_CHANGERS=%s: %v %v", value, cfg.ItemChangersInfinite, err)
		}
	}
	_, err = FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret, "KART_ITEM_CHANGERS": "true"}))
	if err == nil || !strings.Contains(err.Error(), "KART_ITEM_CHANGERS") {
		t.Errorf("KART_ITEM_CHANGERS=true: %v", err)
	}
}

func TestAntiCheatSettings(t *testing.T) {
	cfg, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret}))
	if err != nil || cfg.AntiCheatPlugin != "" {
		t.Fatalf("default plugin %q (%v)", cfg.AntiCheatPlugin, err)
	}
	cfg, err = FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret, "KART_ANTICHEAT_PLUGIN": "off"}))
	if err != nil || cfg.AntiCheatPlugin != "off" {
		t.Fatalf("plugin %q (%v)", cfg.AntiCheatPlugin, err)
	}
	settings := AntiCheatSettings([]string{"KART_ANTICHEAT=log", "KART_ANTICHEAT_EXTRA=kick",
		"KART_ANTICHEAT_PLUGIN=/x.wasm", "KART_GAME_PORT=1", "PATH=/bin", "KART_ANTICHEAT_EMPTY="})
	want := map[string]string{"KART_ANTICHEAT": "log", "KART_ANTICHEAT_EXTRA": "kick", "KART_ANTICHEAT_EMPTY": ""}
	if len(settings) != len(want) {
		t.Fatalf("settings %v", settings)
	}
	for name, value := range want {
		if settings[name] != value {
			t.Fatalf("settings %v", settings)
		}
	}
}

func TestWebSocketCompression(t *testing.T) {
	cfg, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret}))
	if err != nil || !cfg.WSCompression {
		t.Fatalf("default: %v, %v", cfg.WSCompression, err)
	}
	cfg, err = FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret, "KART_WS_COMPRESSION": "false"}))
	if err != nil || cfg.WSCompression {
		t.Fatalf("false: %v, %v", cfg.WSCompression, err)
	}
	_, err = FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret, "KART_WS_COMPRESSION": "gzip"}))
	if err == nil || !strings.Contains(err.Error(), "KART_WS_COMPRESSION") {
		t.Fatalf("gzip: %v", err)
	}
}

func TestWebRTCSettings(t *testing.T) {
	cfg, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret}))
	if err != nil {
		t.Fatal(err)
	}
	if !cfg.WebRTC || cfg.WebRTCUDPPort != 0 || len(cfg.WebRTCPublicIPs) != 0 || !cfg.WebRTCLoopback {
		t.Fatalf("WebRTC defaults %+v", cfg)
	}
	cfg, err = FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret, "KART_WEBRTC": "off",
		"KART_WEBRTC_UDP_PORT": "8790", "KART_WEBRTC_PUBLIC_IPS": " 203.0.113.7, 2001:db8::1 ",
		"KART_WEBRTC_LOOPBACK": "false"}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.WebRTC || cfg.WebRTCUDPPort != 8790 || strings.Join(cfg.WebRTCPublicIPs, ",") != "203.0.113.7,2001:db8::1" ||
		cfg.WebRTCLoopback {
		t.Fatalf("WebRTC overrides %+v", cfg)
	}
	for name, value := range map[string]string{"KART_WEBRTC": "maybe", "KART_WEBRTC_UDP_PORT": "70000",
		"KART_WEBRTC_PUBLIC_IPS": "game.example.com", "KART_WEBRTC_LOOPBACK": "2"} {
		if _, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret, name: value})); err == nil ||
			!strings.Contains(err.Error(), name) {
			t.Fatalf("%s=%s: %v", name, value, err)
		}
	}
}
