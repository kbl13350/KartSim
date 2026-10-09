// Command kart-data is the single KartSim data service: accounts and their
// economy (levels, wallets, inventory, shop, rewards and the admin console
// at /multiplayer/admin), profiles, history, the game-server list and entry
// tickets for browsers, plus the internal API game nodes use. It is the only
// process that talks to MySQL and Redis. Configuration comes from the
// environment (see DESIGN.md 3.1 and ECONOMY.md).
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"kartsim/internal/data/config"
	"kartsim/internal/data/server"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.FromEnv(os.Getenv)
	if err != nil {
		logger.Error("invalid configuration; refusing to start", "error", err)
		os.Exit(2)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := server.Run(ctx, cfg, logger); err != nil {
		logger.Error("kart-data stopped", "error", err)
		stop()
		os.Exit(1)
	}
	logger.Info("kart-data stopped")
}
