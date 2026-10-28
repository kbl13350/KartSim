package translation

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestTranslateCoalescesAndCachesByLanguageAndKey(t *testing.T) {
	var calls atomic.Int32
	entered := make(chan struct{}, 1)
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("missing provider auth")
		}
		var body struct {
			Model    string
			Messages []struct{ Role, Content string }
			Thinking struct{ Type string }
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || body.Model != DefaultModel || body.Thinking.Type != "disabled" || len(body.Messages) != 2 || body.Messages[1].Role != "user" || body.Messages[1].Content != "Hello" {
			t.Error("bad payload")
		}
		select {
		case entered <- struct{}{}:
		default:
		}
		<-release
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"你好"},"finish_reason":"stop"}]}`))
	}))
	defer server.Close()
	client := New()
	client.Endpoint = server.URL
	cfg := Config{"test-key", DefaultModel}
	var wg sync.WaitGroup
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			text, err := client.Translate(context.Background(), cfg, "Hello", "zh-CN")
			if err != nil || text != "你好" {
				t.Errorf("%q %v", text, err)
			}
		}()
	}
	<-entered
	close(release)
	wg.Wait()
	if calls.Load() != 1 {
		t.Fatalf("concurrent calls %d", calls.Load())
	}
	_, _ = client.Translate(context.Background(), cfg, "Hello", "zh-CN")
	if calls.Load() != 1 {
		t.Fatal("cache miss")
	}
	_, _ = client.Translate(context.Background(), cfg, "Hello", "ko")
	if calls.Load() != 2 {
		t.Fatal("target not in cache key")
	}
}
func TestProviderErrorsAndMalformedResultsAreSafe(t *testing.T) {
	for _, body := range []string{`{"choices":[]}`, `{"choices":[{"message":{"content":""},"finish_reason":"stop"}]}`, `{"choices":[{"message":{"content":"partial"},"finish_reason":"length"}]}`, strings.Repeat("x", 40000)} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(body)) }))
		client := New()
		client.Endpoint = server.URL
		if _, err := client.Translate(context.Background(), Config{"secret", DefaultModel}, "hello", "en"); err != ErrUnavailable {
			t.Errorf("unexpected %v", err)
		}
		server.Close()
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Error(w, "secret-provider-error", 401) }))
	defer server.Close()
	client := New()
	client.Endpoint = server.URL
	_, err := client.Translate(context.Background(), Config{"secret", DefaultModel}, "hi", "en")
	if err != ErrUnavailable || strings.Contains(err.Error(), "secret") {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err = client.Translate(ctx, Config{"secret", DefaultModel}, "hi", "en"); err != ErrUnavailable {
		t.Fatal(err)
	}
}
func TestInputAndEncryptedSettings(t *testing.T) {
	for _, target := range []string{"zh-CN", "en", "ko"} {
		if !Valid("你好🙂", target) {
			t.Fatal(target)
		}
	}
	if Valid(strings.Repeat("赛", 121), "en") || Valid(" ", "en") || Valid("hi", "xx") {
		t.Fatal("invalid input accepted")
	}
	secret := []byte("server-secret")
	cipher, err := Seal(secret, "test-provider-key")
	if err != nil || strings.Contains(cipher, "test-provider-key") {
		t.Fatal(cipher, err)
	}
	plain, err := Open(secret, cipher)
	if plain != "test-provider-key" || err != nil {
		t.Fatal(plain, err)
	}
	if _, err = Open([]byte("wrong-secret"), cipher); err == nil {
		t.Fatal("wrong key accepted")
	}
	if _, err = Seal(nil, "test"); err == nil {
		t.Fatal("missing secret accepted")
	}
	client := New()
	client.HTTP.Timeout = 20 * time.Millisecond
	if _, err = client.Translate(context.Background(), Config{"", DefaultModel}, "hi", "en"); err != ErrUnavailable {
		t.Fatal(err)
	}
}
