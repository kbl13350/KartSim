package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
)

// Only ciphertext is persisted. API responses deliberately use a separate type.
type TranslationSettings struct {
	Enabled      bool   `json:"enabled"`
	Model        string `json:"model"`
	EncryptedKey string `json:"encryptedKey"`
}

func (s *Store) TranslationSettings(ctx context.Context) (TranslationSettings, error) {
	settings := TranslationSettings{Model: "deepseek-flash"}
	var raw string
	err := s.db.QueryRowContext(ctx, "SELECT json FROM app_settings WHERE name = ?", "chatTranslation").Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return settings, nil
	}
	if err != nil {
		return settings, err
	}
	err = json.Unmarshal([]byte(raw), &settings)
	return settings, err
}
func (s *Store) SaveTranslationSettings(ctx context.Context, settings TranslationSettings, admin string, now int64) error {
	raw, err := json.Marshal(settings)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO app_settings(name, json, updated_at, updated_by)
 VALUES(?, ?, ?, ?) AS incoming
 ON DUPLICATE KEY UPDATE json = incoming.json, updated_at = incoming.updated_at, updated_by = incoming.updated_by`, "chatTranslation", string(raw), now, admin)
	return err
}
