//go:build tools

// Package tools pins dependencies shared by the data and game services.
package tools

import (
	_ "github.com/alicebob/miniredis/v2"
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/gorilla/websocket"
	_ "github.com/redis/go-redis/v9"
	_ "modernc.org/sqlite"
)
