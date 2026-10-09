// Package config reads the kart-data settings from the environment
// (DESIGN.md 3.1). Invalid settings stop the service before it listens.
package config

import (
	"errors"
	"fmt"
	"math"
	"net"
	"net/netip"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"kartsim/internal/shared/ticket"
)

// DefaultMySQLDSN is used when KART_MYSQL_DSN is unset.
const DefaultMySQLDSN = "kart:kart@tcp(127.0.0.1:3306)/kartsim?charset=utf8mb4&collation=utf8mb4_0900_as_ci"

// Registration modes (KART_REGISTRATION, ECONOMY.md 0).
const (
	RegistrationOpen   = "open"   // anyone may register; an invite is optional
	RegistrationInvite = "invite" // a single-use invite is required (the Java behavior)
	RegistrationClosed = "closed" // nobody may register
)

// Economy defaults (ECONOMY.md 2 and 2.3).
const (
	DefaultStartingLucci = 10_000
	// maxStartingLucci and maxRate keep a typo from minting absurd amounts.
	maxStartingLucci = 1_000_000_000
	maxRate          = 100
)

// Messenger defaults (DESIGN.md 9).
const (
	DefaultMessengerMaxConnections = 5000
	DefaultMessengerSendBuffer     = 256 << 10
	maxMessengerConnections        = 1_000_000
	minMessengerSendBuffer         = 64 << 10
	maxMessengerSendBuffer         = 64 << 20
)

// DefaultTrustedProxies are the peers whose X-Forwarded-For is believed
// when KART_TRUSTED_PROXIES is unset: a reverse proxy or dev server on the
// same machine.
var DefaultTrustedProxies = []netip.Prefix{netip.MustParsePrefix("127.0.0.0/8"), netip.MustParsePrefix("::1/128")}

var (
	nodeIDPattern   = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
	usernamePattern = regexp.MustCompile(`^[A-Za-z0-9_]{3,24}$`)
)

// Config is the complete data service configuration.
type Config struct {
	PublicHost      string // KART_DATA_ADDR
	PublicPort      int    // KART_DATA_PORT
	InternalListen  string // KART_INTERNAL_LISTEN
	MySQLDSN        string
	RedisAddr       string
	RedisPassword   string
	RedisDB         int
	RedisPrefix     string
	ClusterSecret   string
	DataNodeID      string
	LANHosts        string
	PublicOrigin    string // empty: derive backendOrigin from the request
	BootstrapInvite string

	// Accounts and economy (ECONOMY.md).
	Registration   string         // KART_REGISTRATION: open, invite or closed
	AllowGuests    bool           // KART_ALLOW_GUESTS: issue guest tickets without a login
	AdminUsernames []string       // KART_ADMIN_USERNAMES, lower-cased
	ExpRate        float64        // KART_EXP_RATE
	LucciRate      float64        // KART_LUCCI_RATE
	StartingLucci  int64          // KART_STARTING_LUCCI
	TrustedProxies []netip.Prefix // KART_TRUSTED_PROXIES; their X-Forwarded-For names the client

	// Friends and private chat (DESIGN.md 9).
	MessengerMaxConnections  int // KART_MESSENGER_MAX_CONNECTIONS: messenger sockets, hello'd or not
	MessengerSendBufferBytes int // KART_MESSENGER_SEND_BUFFER_BYTES: queued bytes per socket
}

// PublicListen is the host:port of the public HTTP listener.
func (c Config) PublicListen() string {
	return net.JoinHostPort(c.PublicHost, strconv.Itoa(c.PublicPort))
}

// FromEnv reads the configuration through getenv (os.Getenv in production).
func FromEnv(getenv func(string) string) (Config, error) {
	first := func(names ...string) string {
		for _, name := range names {
			if value := strings.TrimSpace(getenv(name)); value != "" {
				return value
			}
		}
		return ""
	}
	orDefault := func(value, fallback string) string {
		if value == "" {
			return fallback
		}
		return value
	}

	cfg := Config{
		PublicHost:     orDefault(first("KART_DATA_ADDR", "SERVER_ADDRESS"), "127.0.0.1"),
		InternalListen: orDefault(first("KART_INTERNAL_LISTEN"), "127.0.0.1:8790"),
		MySQLDSN:       orDefault(first("KART_MYSQL_DSN"), DefaultMySQLDSN),
		RedisAddr:      orDefault(first("KART_REDIS_ADDR"), "127.0.0.1:6379"),
		RedisPassword:  getenv("KART_REDIS_PASSWORD"),
		// The prefix is used verbatim; an explicitly empty value keeps the default.
		RedisPrefix:   orDefault(getenv("KART_REDIS_PREFIX"), "kart:"),
		ClusterSecret: getenv("KART_CLUSTER_SECRET"),
		DataNodeID:    orDefault(first("KART_DATA_NODE_ID"), "data-1"),
		LANHosts:      first("KART_LAN_HOSTS", "KART_LANHOSTS"),
		// Like Java, a blank bootstrap invite means "generate one"; a set value is used as is.
		BootstrapInvite: getenv("KART_BOOTSTRAP_INVITE"),
	}

	var problems []error
	port, err := parsePort(orDefault(first("KART_DATA_PORT", "KART_SERVER_PORT"), "8787"))
	if err != nil {
		problems = append(problems, fmt.Errorf("KART_DATA_PORT: %w", err))
	}
	cfg.PublicPort = port

	if _, _, err := net.SplitHostPort(cfg.InternalListen); err != nil {
		problems = append(problems, fmt.Errorf("KART_INTERNAL_LISTEN: %w", err))
	}
	if db := first("KART_REDIS_DB"); db != "" {
		cfg.RedisDB, err = strconv.Atoi(db)
		if err != nil || cfg.RedisDB < 0 {
			problems = append(problems, errors.New("KART_REDIS_DB must be a non-negative integer"))
		}
	}
	if len(cfg.ClusterSecret) < ticket.MinSecretLength {
		problems = append(problems, fmt.Errorf("KART_CLUSTER_SECRET is required and must be at least %d characters", ticket.MinSecretLength))
	}
	if !nodeIDPattern.MatchString(cfg.DataNodeID) {
		problems = append(problems, errors.New("KART_DATA_NODE_ID must match [A-Za-z0-9_-]{1,64}"))
	}
	if origin := first("KART_PUBLIC_ORIGIN"); origin != "" {
		normalized, err := normalizeOrigin(origin)
		if err != nil {
			problems = append(problems, fmt.Errorf("KART_PUBLIC_ORIGIN: %w", err))
		}
		cfg.PublicOrigin = normalized
	}
	problems = append(problems, readEconomy(&cfg, first)...)
	problems = append(problems, readMessenger(&cfg, first)...)
	return cfg, errors.Join(problems...)
}

// readMessenger reads the messenger socket limits.
func readMessenger(cfg *Config, first func(...string) string) []error {
	var problems []error
	read := func(name string, target *int, fallback, minimum, maximum int) {
		*target = fallback
		value := first(name)
		if value == "" {
			return
		}
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < minimum || parsed > maximum {
			problems = append(problems, fmt.Errorf("%s must be an integer from %d to %d", name, minimum, maximum))
			return
		}
		*target = parsed
	}
	read("KART_MESSENGER_MAX_CONNECTIONS", &cfg.MessengerMaxConnections, DefaultMessengerMaxConnections, 1,
		maxMessengerConnections)
	read("KART_MESSENGER_SEND_BUFFER_BYTES", &cfg.MessengerSendBufferBytes, DefaultMessengerSendBuffer,
		minMessengerSendBuffer, maxMessengerSendBuffer)
	return problems
}

// readEconomy reads the account and economy settings.
func readEconomy(cfg *Config, first func(...string) string) []error {
	var problems []error
	cfg.Registration = strings.ToLower(first("KART_REGISTRATION"))
	switch cfg.Registration {
	case "":
		cfg.Registration = RegistrationOpen
	case RegistrationOpen, RegistrationInvite, RegistrationClosed:
	default:
		problems = append(problems, fmt.Errorf("KART_REGISTRATION must be open, invite or closed, not %q", cfg.Registration))
	}

	if value := first("KART_ALLOW_GUESTS"); value != "" {
		allowed, err := parseBool(value)
		if err != nil {
			problems = append(problems, fmt.Errorf("KART_ALLOW_GUESTS: %w", err))
		}
		cfg.AllowGuests = allowed
	}

	for _, name := range strings.Split(first("KART_ADMIN_USERNAMES"), ",") {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if !usernamePattern.MatchString(name) {
			problems = append(problems, fmt.Errorf("KART_ADMIN_USERNAMES: %q is not a valid username", name))
			continue
		}
		// Usernames are ASCII and compare case-insensitively.
		cfg.AdminUsernames = append(cfg.AdminUsernames, strings.ToLower(name))
	}

	var err error
	if cfg.ExpRate, err = parseRate(first("KART_EXP_RATE")); err != nil {
		problems = append(problems, fmt.Errorf("KART_EXP_RATE: %w", err))
	}
	if cfg.LucciRate, err = parseRate(first("KART_LUCCI_RATE")); err != nil {
		problems = append(problems, fmt.Errorf("KART_LUCCI_RATE: %w", err))
	}

	cfg.StartingLucci = DefaultStartingLucci
	if value := first("KART_STARTING_LUCCI"); value != "" {
		cfg.StartingLucci, err = strconv.ParseInt(value, 10, 64)
		if err != nil || cfg.StartingLucci < 0 || cfg.StartingLucci > maxStartingLucci {
			problems = append(problems, fmt.Errorf("KART_STARTING_LUCCI must be an integer from 0 to %d", maxStartingLucci))
		}
	}

	cfg.TrustedProxies, err = parseProxies(first("KART_TRUSTED_PROXIES"))
	if err != nil {
		problems = append(problems, fmt.Errorf("KART_TRUSTED_PROXIES: %w", err))
	}
	return problems
}

func parseBool(value string) (bool, error) {
	switch strings.ToLower(value) {
	case "1", "true", "yes", "on":
		return true, nil
	case "0", "false", "no", "off":
		return false, nil
	}
	return false, fmt.Errorf("%q is not a boolean (true/false)", value)
}

// parseRate reads a reward multiplier; empty means 1.
func parseRate(value string) (float64, error) {
	if value == "" {
		return 1, nil
	}
	rate, err := strconv.ParseFloat(value, 64)
	if err != nil || math.IsNaN(rate) || math.IsInf(rate, 0) || rate < 0 || rate > maxRate {
		return 1, fmt.Errorf("%q must be a number from 0 to %d", value, maxRate)
	}
	return rate, nil
}

// parseProxies reads a comma-separated list of IPs and CIDR prefixes.
// Unset means loopback; "none" trusts no proxy (RemoteAddr is the client).
func parseProxies(value string) ([]netip.Prefix, error) {
	if value == "" {
		return DefaultTrustedProxies, nil
	}
	if strings.EqualFold(value, "none") {
		return []netip.Prefix{}, nil
	}
	var prefixes []netip.Prefix
	for _, entry := range strings.Split(value, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if prefix, err := netip.ParsePrefix(entry); err == nil {
			prefixes = append(prefixes, prefix.Masked())
			continue
		}
		addr, err := netip.ParseAddr(entry)
		if err != nil {
			return nil, fmt.Errorf("%q is neither an IP address nor a CIDR prefix", entry)
		}
		addr = addr.Unmap()
		prefixes = append(prefixes, netip.PrefixFrom(addr, addr.BitLen()))
	}
	return prefixes, nil
}

func parsePort(value string) (int, error) {
	port, err := strconv.Atoi(value)
	if err != nil || port < 1 || port > 65535 {
		return 0, fmt.Errorf("invalid port %q", value)
	}
	return port, nil
}

// normalizeOrigin accepts http(s)://host[:port] with an optional trailing slash.
func normalizeOrigin(value string) (string, error) {
	parsed, err := url.Parse(value)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" ||
		parsed.User != nil || (parsed.Path != "" && parsed.Path != "/") ||
		parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("%q is not an http(s) origin", value)
	}
	return parsed.Scheme + "://" + parsed.Host, nil
}
