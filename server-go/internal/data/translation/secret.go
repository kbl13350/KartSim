package translation

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
)

func keyCipher(secret []byte) (cipher.AEAD, error) {
	if len(secret) == 0 {
		return nil, errors.New("missing server secret")
	}
	key := sha256.Sum256(append([]byte("kartsim/chat-translation/v1/"), secret...))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
func Seal(secret []byte, key string) (string, error) {
	c, err := keyCipher(secret)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, c.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(c.Seal(nonce, nonce, []byte(key), nil)), nil
}
func Open(secret []byte, encoded string) (string, error) {
	c, err := keyCipher(secret)
	if err != nil {
		return "", err
	}
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(raw) < c.NonceSize() {
		return "", ErrUnavailable
	}
	plain, err := c.Open(nil, raw[:c.NonceSize()], raw[c.NonceSize():], nil)
	return string(plain), err
}
