// Command kart-game runs one game node: in-memory rooms over WebSocket,
// admitted by tickets from the data service and reporting settlements back
// to it (see DESIGN.md section 4).
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"runtime/debug"
	"syscall"

	"kartsim/internal/game/app"
	"kartsim/internal/game/config"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stderr, nil))
	slog.SetDefault(log)

	cfg, err := config.FromEnv(os.Getenv)
	if err != nil {
		log.Error("配置无效", "error", err)
		os.Exit(2)
	}
	cfg.AntiCheatEnv = config.AntiCheatSettings(os.Environ())
	if cfg.MemoryLimitMB > 0 {
		// Same as GOMEMLIMIT; the node also refuses new players near the limit.
		debug.SetMemoryLimit(int64(cfg.MemoryLimitMB) << 20)
	}
	node, err := app.New(cfg, log, app.Options{})
	if err != nil {
		log.Error("启动失败", "error", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := node.Run(ctx); err != nil {
		log.Error("game node stopped with error", "error", err)
		os.Exit(1)
	}
}
