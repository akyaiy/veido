package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"time"

	//"encoding/json"

	"github.com/dgrijalva/jwt-go"
	"golang.org/x/crypto/bcrypt"
)

type Auth struct {
	db     *sql.DB
	secret []byte
}

func NewAuth(db *sql.DB, secret []byte) *Auth {
	return &Auth{db: db, secret: secret}
}

func (a *Auth) HashPassword(pass string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	return string(b), err
}

func (a *Auth) CheckPassword(hash, pass string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pass))
}

func (a *Auth) CreateAccessToken(userID int64) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(15 * time.Minute).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(a.secret)
}

func (a *Auth) GenerateRefreshToken() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

func (a *Auth) StoreRefreshToken(token string, userID int64, ttl time.Duration) error {
	expires := time.Now().Add(ttl).Unix()
	_, err := a.db.Exec("INSERT INTO refresh_tokens(token, user_id, expires_at) VALUES(?,?,?)", token, userID, expires)
	return err
}

func (a *Auth) DeleteRefreshToken(token string) error {
	_, err := a.db.Exec("DELETE FROM refresh_tokens WHERE token = ?", token)
	return err
}

func (a *Auth) VerifyRefreshToken(token string) (int64, error) {
	row := a.db.QueryRow("SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?", token)
	var userID int64
	var expires int64
	if err := row.Scan(&userID, &expires); err != nil {
		return 0, errors.New("invalid")
	}
	if time.Now().Unix() > expires {
		return 0, errors.New("expired")
	}
	return userID, nil
}

func (a *Auth) AuthenticateRequest(r *http.Request) (int64, bool) {
	header := r.Header.Get("Authorization")
	if header == "" {
		return 0, false
	}
	var tok string
	fmt.Sscanf(header, "Bearer %s", &tok)
	if tok == "" {
		return 0, false
	}

	t, err := jwt.Parse(tok, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return a.secret, nil
	})
	if err != nil || !t.Valid {
		return 0, false
	}

	claims, ok := t.Claims.(jwt.MapClaims)
	if !ok {
		return 0, false
	}

	sub := claims["sub"]
	switch v := sub.(type) {
	case float64:
		return int64(v), true
	case int64:
		return v, true
	default:
		return 0, false
	}
}
