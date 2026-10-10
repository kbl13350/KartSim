// Package server wires the data service together: MySQL (schema and
// bootstrap invite), Redis, the public and internal HTTP listeners, and the
// background maintenance loops. Run blocks until its context ends and then
// shuts down gracefully.
package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"kartsim/internal/data/api"
	"kartsim/internal/data/cache"
	"kartsim/internal/data/config"
	"kartsim/internal/data/economy"
	"kartsim/internal/data/messenger"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/netcfg"
	"kartsim/internal/shared/rewards"
)

const (
	mysqlStartupWait = 30 * time.Second
	redisStartupWait = 15 * time.Second
	shutdownTimeout  = 10 * time.Second
	sessionSweep     = time.Hour
	// economyRetention is how long rewarded time-attack runs (replay
	// answers) and daily reward counters are kept.
	economyRetention = 30 * 24 * time.Hour
	// messageRetention is how long private messages are kept (DESIGN.md 9).
	messageRetention = 30 * 24 * time.Hour
	// questRetention keeps the past fortnight of daily and weekly quest rows.
	questRetention = 14 * 24 * time.Hour
	// sweepBatch bounds the rows one sweep deletes per table.
	sweepBatch = 10_000
)

// Run starts the data service and blocks until ctx is canceled or a
// listener fails.
func Run(ctx context.Context, cfg config.Config, logger *slog.Logger) error {
	data, err := economy.Default()
	if err != nil {
		return fmt.Errorf("economy data: %w", err)
	}
	db, err := store.Open(cfg.MySQLDSN)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := store.WaitReady(ctx, db, mysqlStartupWait, logger); err != nil {
		return err
	}
	if err := store.Migrate(ctx, db, logger); err != nil {
		return fmt.Errorf("schema migration: %w", err)
	}
	st := store.New(db)

	// The cache and the cluster endpoints report Redis failures themselves
	// (once per outage); go-redis's own pool messages go to debug level.
	redis.SetLogger(redisLogger{logger})
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
		// One dial attempt per command: while Redis is down, requests should
		// fall back (or answer 503) quickly instead of retrying dials.
		DialerRetries:         1,
		DialTimeout:           time.Second,
		ReadTimeout:           time.Second,
		WriteTimeout:          time.Second,
		PoolTimeout:           2 * time.Second,
		MaxRetries:            1,
		ContextTimeoutEnabled: true,
	})
	defer rdb.Close()
	waitRedis(ctx, rdb, logger)

	// One cache instance: it remembers keys whose writes missed Redis, and
	// its Run loop repairs exactly those. What a previous process left in
	// Redis is not trusted: it may have died with repairs still pending. The
	// first repair flushes it now; if Redis is down, the Run loop does it
	// once Redis is back, and the cache is bypassed until then.
	caches := cache.New(rdb, cfg.RedisPrefix, logger)
	caches.DistrustExisting()
	caches.Repair(ctx)
	rates := rewards.Rates{Exp: cfg.ExpRate, Lucci: cfg.LucciRate}
	service := api.New(api.Options{
		Store:          st,
		Cache:          caches,
		Cluster:        cache.NewCluster(rdb, cfg.RedisPrefix),
		Network:        netcfg.New(cfg.LANHosts),
		Secret:         []byte(cfg.ClusterSecret),
		DataNodeID:     cfg.DataNodeID,
		PublicOrigin:   cfg.PublicOrigin,
		Logger:         logger,
		Economy:        data,
		Registration:   cfg.Registration,
		AllowGuests:    cfg.AllowGuests,
		AdminUsernames: cfg.AdminUsernames,
		Rates:          &rates,
		StartingLucci:  &cfg.StartingLucci,
		TrustedProxies: cfg.TrustedProxies,
		Limiter:        cache.NewLimiter(rdb, cfg.RedisPrefix),
		Messenger: messenger.Options{MaxConnections: cfg.MessengerMaxConnections,
			SendBufferLimit: cfg.MessengerSendBufferBytes},
	})
	logger.Info("account economy", "registration", cfg.Registration, "guests", cfg.AllowGuests,
		"admins", len(cfg.AdminUsernames), "expRate", cfg.ExpRate, "lucciRate", cfg.LucciRate,
		"startingLucci", cfg.StartingLucci, "catalog", data.Catalog.Version[:12], "offers", data.Catalog.OfferCount())
	if err := service.Bootstrap(ctx, cfg.BootstrapInvite); err != nil {
		return fmt.Errorf("bootstrap invite: %w", err)
	}
	return serve(ctx, cfg, logger, service, st, caches)
}

func serve(ctx context.Context, cfg config.Config, logger *slog.Logger, service *api.API, st *store.Store, caches *cache.Cache) error {
	errorLog := slog.NewLogLogger(logger.Handler(), slog.LevelWarn)
	servers := []*http.Server{
		{Addr: cfg.PublicListen(), Handler: service.PublicHandler()},
		{Addr: cfg.InternalListen, Handler: service.InternalHandler()},
	}
	listeners := make([]net.Listener, 0, len(servers))
	for _, server := range servers {
		server.ReadHeaderTimeout = 10 * time.Second
		server.ReadTimeout = 2 * time.Minute
		server.WriteTimeout = 2 * time.Minute
		server.IdleTimeout = 2 * time.Minute
		server.ErrorLog = errorLog
		listener, err := net.Listen("tcp", server.Addr)
		if err != nil {
			for _, open := range listeners {
				open.Close()
			}
			return fmt.Errorf("listen %s: %w", server.Addr, err)
		}
		listeners = append(listeners, listener)
	}

	runCtx, stop := context.WithCancel(ctx)
	defer stop()
	var background sync.WaitGroup
	background.Go(func() { caches.Run(runCtx) })
	background.Go(func() { sweep(runCtx, st, logger) })
	background.Go(func() { service.RunMessenger(runCtx) })

	failed := make(chan error, len(servers))
	for i, server := range servers {
		go func() {
			if err := server.Serve(listeners[i]); err != nil && !errors.Is(err, http.ErrServerClosed) {
				failed <- fmt.Errorf("serve %s: %w", server.Addr, err)
			}
		}()
	}
	logger.Info("kart-data started", "public", listeners[0].Addr().String(),
		"internal", listeners[1].Addr().String(), "dataNode", cfg.DataNodeID)

	var result error
	select {
	case <-ctx.Done():
		logger.Info("kart-data shutting down")
	case result = <-failed:
		logger.Error("listener failed", "error", result)
	}
	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer cancel()
	// Upgraded sockets are not tracked by http.Server.Shutdown.
	if err := service.ShutdownMessenger(shutdownCtx); err != nil {
		logger.Warn("messenger shutdown incomplete", "error", err)
	}
	if err := service.ShutdownMyRoom(shutdownCtx); err != nil {
		logger.Warn("my room shutdown incomplete", "error", err)
	}
	for _, server := range servers {
		if err := server.Shutdown(shutdownCtx); err != nil {
			logger.Warn("shutdown incomplete", "addr", server.Addr, "error", err)
		}
	}
	stop()
	background.Wait()
	return result
}

// waitRedis pings Redis for a while. The service starts without it: caches
// fall back to MySQL and the cluster endpoints answer 503 until it is back.
func waitRedis(ctx context.Context, rdb *redis.Client, logger *slog.Logger) {
	deadline := time.Now().Add(redisStartupWait)
	for attempt := 1; ; attempt++ {
		pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
		err := rdb.Ping(pingCtx).Err()
		cancel()
		if err == nil {
			return
		}
		if time.Now().After(deadline) || ctx.Err() != nil {
			logger.Warn("Redis unavailable; starting with MySQL-only caches, game-server endpoints answer 503", "error", err)
			return
		}
		logger.Warn("waiting for Redis", "attempt", attempt, "error", err)
		select {
		case <-ctx.Done():
		case <-time.After(time.Second):
		}
	}
}

// sweep runs the hourly cleanup.
func sweep(ctx context.Context, st *store.Store, logger *slog.Logger) {
	ticker := time.NewTicker(sessionSweep)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		sweepOnce(ctx, st, logger, time.Now())
	}
}

// sweepOnce deletes expired sessions, which can no longer authenticate,
// and time-attack runs and daily reward counters older than
// economyRetention, which no request needs any more; all would otherwise
// accumulate. It also refuses friend requests nobody answered in time,
// drops request results past their outbox time and deletes private
// messages (and conversations) older than messageRetention, old 奖励箱
// entries and past quest periods.
func sweepOnce(ctx context.Context, st *store.Store, logger *slog.Logger, now time.Time) {
	sweepCtx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()
	removed, err := st.DeleteExpiredSessions(sweepCtx, now.UnixMilli())
	if err != nil && !errors.Is(err, context.Canceled) {
		logger.Warn("expired session cleanup failed", "error", err)
	} else if removed > 0 {
		logger.Info("expired sessions removed", "count", removed)
	}
	cutoff := now.Add(-economyRetention)
	runs, days, err := st.PruneEconomyHistory(sweepCtx, cutoff.UnixMilli(), rewards.BeijingDay(cutoff), sweepBatch)
	if err != nil && !errors.Is(err, context.Canceled) {
		logger.Warn("economy history cleanup failed", "error", err)
	} else if runs > 0 || days > 0 {
		logger.Info("old economy history removed", "timeAttackRuns", runs, "dailyRewards", days)
	}
	pruned, err := st.PruneMessenger(sweepCtx, now.UnixMilli(), now.Add(-messageRetention).UnixMilli(), sweepBatch)
	if err != nil && !errors.Is(err, context.Canceled) {
		logger.Warn("messenger cleanup failed", "error", err)
	} else if pruned != (store.MessengerPrune{}) {
		logger.Info("messenger cleanup", "refusedRequests", pruned.Refused, "expiredResults", pruned.Results,
			"messages", pruned.Messages, "conversations", pruned.Conversations)
	}
	// 奖励箱 entries taken or expired a retention ago, and quest progress of
	// past daily and weekly periods (MENUS.md).
	boxes, err := st.PruneRewardBox(sweepCtx, cutoff.UnixMilli(), sweepBatch)
	if err != nil && !errors.Is(err, context.Canceled) {
		logger.Warn("reward box cleanup failed", "error", err)
	} else if boxes > 0 {
		logger.Info("old reward box entries removed", "count", boxes)
	}
	quests, err := st.PruneQuestProgress(sweepCtx, rewards.BeijingDay(now.Add(-questRetention)), sweepBatch)
	if err != nil && !errors.Is(err, context.Canceled) {
		logger.Warn("quest progress cleanup failed", "error", err)
	} else if quests > 0 {
		logger.Info("old quest progress removed", "count", quests)
	}
}

// redisLogger sends go-redis internal log lines to slog at debug level.
type redisLogger struct{ logger *slog.Logger }

func (l redisLogger) Printf(ctx context.Context, format string, v ...any) {
	l.logger.DebugContext(ctx, fmt.Sprintf(format, v...), "component", "go-redis")
}
