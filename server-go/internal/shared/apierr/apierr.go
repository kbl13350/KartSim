// Package apierr carries the stable error codes the browser and the game
// nodes understand. HTTP handlers answer {"error": code}; the WebSocket
// protocol answers {"type":"error","code":code}.
package apierr

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
)

// Error is a rejected request with an HTTP status and a stable code.
type Error struct {
	Status int
	Code   string
}

func (e *Error) Error() string { return e.Code }

// New returns a rejection with the given status and code.
func New(status int, code string) *Error { return &Error{Status: status, Code: code} }

// As extracts an *Error from err, if any.
func As(err error) (*Error, bool) {
	var target *Error
	if errors.As(err, &target) {
		return target, true
	}
	return nil, false
}

// WriteJSON writes value as a JSON response with the given status.
func WriteJSON(w http.ResponseWriter, status int, value any) {
	body, err := json.Marshal(value)
	if err != nil {
		slog.Error("encode JSON response", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"INTERNAL_ERROR"}`))
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

// WriteError answers {"error": code}. Errors other than *Error become a
// logged 500 INTERNAL_ERROR so internal details never reach the client.
func WriteError(w http.ResponseWriter, err error) {
	if rejected, ok := As(err); ok {
		WriteJSON(w, rejected.Status, map[string]string{"error": rejected.Code})
		return
	}
	slog.Error("request failed", "error", err)
	WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "INTERNAL_ERROR"})
}
