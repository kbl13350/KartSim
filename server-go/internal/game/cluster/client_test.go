package cluster

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"kartsim/internal/shared/apierr"
)

// A refusal keeps its body's other members (ACCOUNT_BANNED's until and
// reason) as Fields; bodies without a code become HTTP_<status>.
func TestCallKeepsRefusalFields(t *testing.T) {
	body := `{"error":"ACCOUNT_BANNED","until":1800000000000,"reason":"外挂"}`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/banned":
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(body))
		case "/plain":
			w.WriteHeader(http.StatusConflict)
			_, _ = w.Write([]byte(`{"error":"NICKNAME_TAKEN"}`))
		default:
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte(`<html>`))
		}
	}))
	defer server.Close()
	client := NewDataClient(server.URL, []byte("key"))
	ctx := context.Background()

	var rejected *apierr.Error
	if err := client.Call(ctx, "/banned", struct{}{}, nil); !errors.As(err, &rejected) ||
		rejected.Code != "ACCOUNT_BANNED" || rejected.Status != http.StatusForbidden || len(rejected.Fields) != 2 {
		t.Fatalf("banned: %#v", err)
	}
	if until, _ := rejected.Fields["until"].(json.RawMessage); string(until) != "1800000000000" {
		t.Fatalf("until %s", until)
	}
	if reason, _ := rejected.Fields["reason"].(json.RawMessage); string(reason) != `"外挂"` {
		t.Fatalf("reason %s", reason)
	}
	if err := client.Call(ctx, "/plain", struct{}{}, nil); !errors.As(err, &rejected) ||
		rejected.Code != "NICKNAME_TAKEN" || rejected.Fields != nil {
		t.Fatalf("plain: %#v", err)
	}
	if err := client.Call(ctx, "/other", struct{}{}, nil); !errors.As(err, &rejected) || rejected.Code != "HTTP_502" {
		t.Fatalf("no code: %#v", err)
	}
}
