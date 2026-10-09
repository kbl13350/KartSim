package netcfg

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHostsAndOrigins(t *testing.T) {
	network := New(" 192.168.1.8 , bad host ")
	for _, host := range []string{"127.0.0.1", "localhost", "192.168.1.8", "LOCALHOST"} {
		if !network.AllowsHost(host) {
			t.Errorf("%s should be trusted", host)
		}
	}
	if network.AllowsHost("192.168.1.9") || network.AllowsHost("bad host") {
		t.Error("untrusted host accepted")
	}
	if !network.AllowsOrigin("https://192.168.1.8:8780") || !network.AllowsOrigin("http://localhost") {
		t.Error("trusted origin rejected")
	}
	if network.AllowsOrigin("ftp://localhost:1") || network.AllowsOrigin("http://evil.example:80") {
		t.Error("untrusted origin accepted")
	}
	if !New("*").AllowsOrigin("https://10.0.0.23:9") {
		t.Error("wildcard should trust any host")
	}
}

func TestCORS(t *testing.T) {
	handler := LoopbackOnly().CORS(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	}))
	request := httptest.NewRequest(http.MethodOptions, "http://127.0.0.1:8787/api/profile/x", nil)
	request.Header.Set("Origin", "http://127.0.0.1:8780")
	request.Header.Set("Access-Control-Request-Method", "PUT")
	request.Header.Set("Access-Control-Request-Headers", "content-type,x-profile-key")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK ||
		response.Header().Get("Access-Control-Allow-Origin") != "http://127.0.0.1:8780" ||
		response.Header().Get("Access-Control-Allow-Headers") != "Content-Type,X-Profile-Key" {
		t.Fatalf("preflight: %d %v", response.Code, response.Header())
	}
	request = httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8787/x", nil)
	request.Header.Set("Origin", "http://evil.example")
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("untrusted origin: %d", response.Code)
	}
	request = httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8787/x", nil)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusTeapot {
		t.Fatalf("no origin: %d", response.Code)
	}
}
