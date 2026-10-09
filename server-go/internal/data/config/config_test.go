package config

import (
	"net/netip"
	"slices"
	"strings"
	"testing"
)

const secret = "0123456789abcdef0123456789abcdef"

func env(values map[string]string) func(string) string {
	return func(name string) string { return values[name] }
}

func TestDefaults(t *testing.T) {
	cfg, err := FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.PublicListen() != "127.0.0.1:8787" || cfg.InternalListen != "127.0.0.1:8790" ||
		cfg.MySQLDSN != DefaultMySQLDSN || cfg.RedisAddr != "127.0.0.1:6379" || cfg.RedisPrefix != "kart:" ||
		cfg.DataNodeID != "data-1" || cfg.PublicOrigin != "" || cfg.RedisDB != 0 {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
	// ECONOMY.md 0: open registration, no guests, 1.0 rates, 10,000 starting lucci.
	if cfg.Registration != RegistrationOpen || cfg.AllowGuests || len(cfg.AdminUsernames) != 0 ||
		cfg.ExpRate != 1 || cfg.LucciRate != 1 || cfg.StartingLucci != 10_000 ||
		!slices.Equal(cfg.TrustedProxies, DefaultTrustedProxies) {
		t.Fatalf("unexpected economy defaults: %+v", cfg)
	}
}

func TestEconomySettings(t *testing.T) {
	cfg, err := FromEnv(env(map[string]string{
		"KART_CLUSTER_SECRET":  secret,
		"KART_REGISTRATION":    "Invite",
		"KART_ALLOW_GUESTS":    "true",
		"KART_ADMIN_USERNAMES": " Winde , ops_2,,",
		"KART_EXP_RATE":        "1.5",
		"KART_LUCCI_RATE":      "0",
		"KART_STARTING_LUCCI":  "0",
		"KART_TRUSTED_PROXIES": "10.0.0.0/8, 192.168.1.10, ::ffff:172.16.0.1, fd00::/8",
	}))
	if err != nil {
		t.Fatal(err)
	}
	want := []netip.Prefix{netip.MustParsePrefix("10.0.0.0/8"), netip.MustParsePrefix("192.168.1.10/32"),
		netip.MustParsePrefix("172.16.0.1/32"), netip.MustParsePrefix("fd00::/8")}
	if cfg.Registration != RegistrationInvite || !cfg.AllowGuests ||
		!slices.Equal(cfg.AdminUsernames, []string{"winde", "ops_2"}) || cfg.ExpRate != 1.5 || cfg.LucciRate != 0 ||
		cfg.StartingLucci != 0 || !slices.Equal(cfg.TrustedProxies, want) {
		t.Fatalf("unexpected config: %+v", cfg)
	}
	cfg, err = FromEnv(env(map[string]string{"KART_CLUSTER_SECRET": secret, "KART_TRUSTED_PROXIES": "none",
		"KART_REGISTRATION": "closed", "KART_ALLOW_GUESTS": "0"}))
	if err != nil || len(cfg.TrustedProxies) != 0 || cfg.TrustedProxies == nil || cfg.Registration != RegistrationClosed ||
		cfg.AllowGuests {
		t.Fatalf("got %+v, %v", cfg, err)
	}
}

func TestLegacyNamesAndOverrides(t *testing.T) {
	cfg, err := FromEnv(env(map[string]string{
		"KART_CLUSTER_SECRET":  secret,
		"SERVER_ADDRESS":       "0.0.0.0",
		"KART_SERVER_PORT":     "18787",
		"KART_LANHOSTS":        "192.168.1.8",
		"KART_REDIS_DB":        "3",
		"KART_REDIS_PREFIX":    "kt-a:",
		"KART_PUBLIC_ORIGIN":   "https://kart.example.com/",
		"KART_DATA_NODE_ID":    "data-east",
		"KART_INTERNAL_LISTEN": "10.0.0.2:9000",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.PublicListen() != "0.0.0.0:18787" || cfg.LANHosts != "192.168.1.8" || cfg.RedisDB != 3 ||
		cfg.RedisPrefix != "kt-a:" || cfg.PublicOrigin != "https://kart.example.com" ||
		cfg.DataNodeID != "data-east" || cfg.InternalListen != "10.0.0.2:9000" {
		t.Fatalf("unexpected config: %+v", cfg)
	}
	// The new names win over the legacy ones.
	cfg, err = FromEnv(env(map[string]string{
		"KART_CLUSTER_SECRET": secret, "KART_DATA_PORT": "9001", "KART_SERVER_PORT": "9002",
		"KART_DATA_ADDR": "127.0.0.2", "SERVER_ADDRESS": "0.0.0.0",
	}))
	if err != nil || cfg.PublicListen() != "127.0.0.2:9001" {
		t.Fatalf("got %+v, %v", cfg, err)
	}
}

func TestRejectsInvalidSettings(t *testing.T) {
	cases := map[string]map[string]string{
		"missing secret":   {},
		"short secret":     {"KART_CLUSTER_SECRET": "short"},
		"bad port":         {"KART_CLUSTER_SECRET": secret, "KART_DATA_PORT": "70000"},
		"bad node id":      {"KART_CLUSTER_SECRET": secret, "KART_DATA_NODE_ID": "data 1"},
		"bad origin":       {"KART_CLUSTER_SECRET": secret, "KART_PUBLIC_ORIGIN": "kart.example.com"},
		"origin with path": {"KART_CLUSTER_SECRET": secret, "KART_PUBLIC_ORIGIN": "https://a.example/app"},
		"bad redis db":     {"KART_CLUSTER_SECRET": secret, "KART_REDIS_DB": "-1"},
		"bad internal":     {"KART_CLUSTER_SECRET": secret, "KART_INTERNAL_LISTEN": "8790"},
		"bad registration": {"KART_CLUSTER_SECRET": secret, "KART_REGISTRATION": "public"},
		"bad guests":       {"KART_CLUSTER_SECRET": secret, "KART_ALLOW_GUESTS": "maybe"},
		"bad admin":        {"KART_CLUSTER_SECRET": secret, "KART_ADMIN_USERNAMES": "ok_name,bad-name"},
		"negative rate":    {"KART_CLUSTER_SECRET": secret, "KART_EXP_RATE": "-1"},
		"NaN rate":         {"KART_CLUSTER_SECRET": secret, "KART_LUCCI_RATE": "NaN"},
		"huge rate":        {"KART_CLUSTER_SECRET": secret, "KART_LUCCI_RATE": "1000"},
		"bad lucci":        {"KART_CLUSTER_SECRET": secret, "KART_STARTING_LUCCI": "-5"},
		"fraction lucci":   {"KART_CLUSTER_SECRET": secret, "KART_STARTING_LUCCI": "1.5"},
		"bad proxy":        {"KART_CLUSTER_SECRET": secret, "KART_TRUSTED_PROXIES": "10.0.0.0/8,proxy.local"},
	}
	for name, values := range cases {
		if _, err := FromEnv(env(values)); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
	_, err := FromEnv(env(map[string]string{}))
	if err == nil || !strings.Contains(err.Error(), "KART_CLUSTER_SECRET") {
		t.Fatalf("secret error not reported: %v", err)
	}
}
