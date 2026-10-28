package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"kartsim/internal/data/translation"
)

func TestTranslationRequiresLogin(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.get("/api/admin/translation", nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.post("/api/chat/translate", map[string]string{"text": "hi", "target": "en"}, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.put("/api/admin/translation", map[string]any{}, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.post("/api/admin/translation/test", map[string]any{}, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
}
func TestTranslationSettingsAndAuthenticatedChat(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	h.cleanup("DELETE FROM app_settings WHERE name = 'chatTranslation'")
	t.Cleanup(func() { h.cleanup("DELETE FROM app_settings WHERE name = 'chatTranslation'") })
	var status translationSettingsJSON
	h.adminGet("/api/admin/translation", &status)
	if status.Enabled || status.KeyConfigured || status.Model != translation.DefaultModel {
		t.Fatal(status)
	}
	_, token := h.register("trans_"+h.u, "翻译"+h.u)
	user := bearerHeader(token)
	h.get("/api/admin/translation", user).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	h.put("/api/admin/translation", map[string]any{}, user).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	h.post("/api/admin/translation/test", map[string]any{}, user).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	h.post("/api/chat/translate", map[string]string{"text": "hi", "target": "xx"}, user).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.post("/api/chat/translate", map[string]string{"text": strings.Repeat("中", 121), "target": "en"}, user).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	input := map[string]any{"enabled": true, "model": translation.DefaultModel}
	h.put("/api/admin/translation", input, h.adminHeader).expect(t, http.StatusBadRequest, "TRANSLATION_KEY_REQUIRED")
	input["apiKey"] = "test-secret-provider-key"
	saved := h.put("/api/admin/translation", input, h.adminHeader).expect(t, http.StatusOK, "")
	saved.json(t, &status)
	if !status.KeyConfigured || !status.Enabled || strings.Contains(string(saved.body), "secret") {
		t.Fatal("key exposed or not configured")
	}
	stored, err := h.api.store.TranslationSettings(context.Background())
	if err != nil || strings.Contains(stored.EncryptedKey, "test-secret-provider-key") {
		t.Fatal("plaintext storage", err)
	}
	if key, err := translation.Open([]byte(testSecret), stored.EncryptedKey); err != nil || key != "test-secret-provider-key" {
		t.Fatal("bad encrypted key", err)
	}
	input["apiKey"] = ""
	h.put("/api/admin/translation", input, h.adminHeader).expect(t, http.StatusOK, "")
	after, _ := h.api.store.TranslationSettings(context.Background())
	if after.EncryptedKey != stored.EncryptedKey {
		t.Fatal("blank key replaced secret")
	}
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-secret-provider-key" {
			t.Error("provider auth")
		}
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"你好"},"finish_reason":"stop"}]}`))
	}))
	defer provider.Close()
	h.api.translator.Endpoint = provider.URL
	var output struct {
		Enabled      bool
		Text, Target string
	}
	h.post("/api/chat/translate", map[string]string{"text": "hello", "target": "zh-CN"}, user).expect(t, http.StatusOK, "").json(t, &output)
	if !output.Enabled || output.Text != "你好" || output.Target != "zh-CN" {
		t.Fatal(output)
	}
	h.post("/api/admin/translation/test", map[string]any{}, h.adminHeader).expect(t, http.StatusOK, "")
	input["clearKey"] = true
	h.put("/api/admin/translation", input, h.adminHeader).expect(t, http.StatusOK, "").json(t, &status)
	if status.Enabled || status.KeyConfigured {
		t.Fatal("key not cleared")
	}
	output.Enabled = true
	h.post("/api/chat/translate", map[string]string{"text": "hello", "target": "zh-CN"}, user).expect(t, http.StatusOK, "").json(t, &output)
	if output.Enabled {
		t.Fatal("disabled translation still served cache")
	}
}
