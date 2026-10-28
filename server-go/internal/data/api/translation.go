package api

import (
	"net/http"
	"strings"
	"time"

	"kartsim/internal/data/store"
	"kartsim/internal/data/translation"
	"kartsim/internal/shared/apierr"
)

type translationSettingsJSON struct {
	Enabled       bool   `json:"enabled"`
	Model         string `json:"model"`
	KeyConfigured bool   `json:"keyConfigured"`
}

func translationStatus(s store.TranslationSettings) translationSettingsJSON {
	return translationSettingsJSON{s.Enabled, s.Model, s.EncryptedKey != ""}
}
func (a *API) adminTranslation(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	settings, err := a.store.TranslationSettings(r.Context())
	if err != nil {
		return err
	}
	w.Header().Set("Cache-Control", "no-store")
	return writeJSON(w, http.StatusOK, translationStatus(settings))
}
func (a *API) adminSaveTranslation(w http.ResponseWriter, r *http.Request) error {
	admin, err := a.requireAdmin(r)
	if err != nil {
		return err
	}
	var input struct {
		Enabled  bool   `json:"enabled"`
		Model    string `json:"model"`
		APIKey   string `json:"apiKey"`
		ClearKey bool   `json:"clearKey"`
	}
	if err = decodeJSON(w, r, &input); err != nil {
		return err
	}
	input.APIKey = strings.TrimSpace(input.APIKey)
	if !translation.ValidModel(input.Model) || len(input.APIKey) > 512 || strings.ContainsAny(input.APIKey, "\r\n\t ") || (input.ClearKey && input.APIKey != "") {
		return errInvalidRequest
	}
	a.translationMu.Lock()
	defer a.translationMu.Unlock()
	settings, err := a.store.TranslationSettings(r.Context())
	if err != nil {
		return err
	}
	settings.Enabled, settings.Model = input.Enabled, input.Model
	if input.ClearKey {
		settings.EncryptedKey = ""
		settings.Enabled = false
	}
	if input.APIKey != "" {
		settings.EncryptedKey, err = translation.Seal(a.secret, input.APIKey)
		if err != nil {
			return errServiceUnavailable
		}
	}
	if settings.Enabled && settings.EncryptedKey == "" {
		return apierr.New(http.StatusBadRequest, "TRANSLATION_KEY_REQUIRED")
	}
	if err = a.store.SaveTranslationSettings(r.Context(), settings, admin.Username, a.nowMillis()); err != nil {
		return err
	}
	// No key, provider payload or chat text is logged.
	a.log.Info("admin chat translation settings", "admin", admin.Username, "enabled", settings.Enabled, "model", settings.Model)
	w.Header().Set("Cache-Control", "no-store")
	return writeJSON(w, http.StatusOK, translationStatus(settings))
}
func (a *API) translateChat(w http.ResponseWriter, r *http.Request) error {
	account, err := a.requireAccount(r.Context(), bearer(r))
	if err != nil {
		return err
	}
	var input struct {
		Text   string `json:"text"`
		Target string `json:"target"`
	}
	if err = decodeJSON(w, r, &input); err != nil {
		return err
	}
	if !translation.Valid(input.Text, input.Target) {
		return errInvalidRequest
	}
	if err = a.hit(r.Context(), "chat-translation:"+account.ID, 120, time.Minute, true); err != nil {
		return err
	}
	settings, err := a.store.TranslationSettings(r.Context())
	if err != nil {
		return err
	}
	w.Header().Set("Cache-Control", "no-store")
	if !settings.Enabled || settings.EncryptedKey == "" {
		return writeJSON(w, http.StatusOK, map[string]any{"enabled": false})
	}
	if err = a.hit(r.Context(), "chat-translation:global", 600, time.Minute, true); err != nil {
		return err
	}
	key, err := translation.Open(a.secret, settings.EncryptedKey)
	if err != nil {
		return apierr.New(http.StatusServiceUnavailable, "TRANSLATION_UNAVAILABLE")
	}
	result, err := a.translator.Translate(r.Context(), translation.Config{APIKey: key, Model: settings.Model}, input.Text, input.Target)
	if err != nil {
		return apierr.New(http.StatusServiceUnavailable, "TRANSLATION_UNAVAILABLE")
	}
	return writeJSON(w, http.StatusOK, map[string]any{"enabled": true, "text": result, "target": input.Target})
}
func (a *API) adminTestTranslation(w http.ResponseWriter, r *http.Request) error {
	admin, err := a.requireAdmin(r)
	if err != nil {
		return err
	}
	if err = a.hit(r.Context(), "chat-translation-test:"+admin.ID, 6, time.Minute, true); err != nil {
		return err
	}
	settings, err := a.store.TranslationSettings(r.Context())
	if err != nil {
		return err
	}
	if settings.EncryptedKey == "" {
		return apierr.New(http.StatusBadRequest, "TRANSLATION_KEY_REQUIRED")
	}
	key, err := translation.Open(a.secret, settings.EncryptedKey)
	if err != nil {
		return apierr.New(http.StatusServiceUnavailable, "TRANSLATION_UNAVAILABLE")
	}
	result, err := a.translator.Translate(r.Context(), translation.Config{APIKey: key, Model: settings.Model}, "Hello, ready to race?", "zh-CN")
	if err != nil {
		return apierr.New(http.StatusServiceUnavailable, "TRANSLATION_UNAVAILABLE")
	}
	w.Header().Set("Cache-Control", "no-store")
	return writeJSON(w, http.StatusOK, map[string]string{"text": result})
}
