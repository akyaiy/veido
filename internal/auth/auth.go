package auth

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	//"encoding/json"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// Claims описывает payload для JWT access token
type Claims struct {
	UserID int64 `json:"user_id"`
	jwt.RegisteredClaims
}

type Auth struct {
	db     *sql.DB
	secret []byte
}

func NewAuth(db *sql.DB, secret []byte) *Auth {
	return &Auth{db: db, secret: secret}
}

// HashPassword hashes a plaintext password.
func (a *Auth) HashPassword(pass string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	return string(b), err
}

// CheckPassword compares stored hash with provided password.
func (a *Auth) CheckPassword(hash, pass string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pass))
}

// CreateAccessToken issues JWT access token (short-lived).
func (a *Auth) CreateAccessToken(userID int64) (string, error) {
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(a.secret)
}

// GenerateRefreshToken creates a secure random string.
func (a *Auth) GenerateRefreshToken(userID int64) (string, error) {
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(a.secret)
}

// StoreRefreshToken persists refresh token with TTL.
func (a *Auth) StoreRefreshToken(token string, userID int64, ttl time.Duration) error {
	expires := time.Now().Add(ttl).Unix()
	_, err := a.db.Exec("INSERT INTO refresh_tokens(token, user_id, expires_at) VALUES(?,?,?)", token, userID, expires)
	return err
}

// DeleteRefreshToken removes a specific refresh token.
func (a *Auth) DeleteRefreshToken(token string) error {
	_, err := a.db.Exec("DELETE FROM refresh_tokens WHERE token = ?", token)
	return err
}

// VerifyRefreshToken validates token exists and not expired, returns userID.
func (a *Auth) VerifyRefreshToken(token string) (int64, error) {
	row := a.db.QueryRow("SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?", token)
	var userID int64
	var expiresUnix int64
	if err := row.Scan(&userID, &expiresUnix); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, errors.New("not found")
		}
		return 0, err
	}
	// expiresUnix — это Unix timestamp
	if time.Now().Unix() > expiresUnix {
		return 0, errors.New("expired")
	}
	return userID, nil
}

// AuthenticateRequest reads Authorization header and validates access token.
// Returns userID and ok flag.
func (a *Auth) AuthenticateRequest(r *http.Request) (int64, bool) {
	header := r.Header.Get("Authorization")
	if header == "" {
		return 0, false
	}
	//const prefix = "Bearer "
	if !strings.HasPrefix(header, "Bearer ") {
		return 0, false
	}
	tokenString := strings.TrimPrefix(header, "Bearer ")
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// Validate alg
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return a.secret, nil
	})
	if err != nil || !token.Valid {
		return 0, false
	}

	return claims.UserID, true
}

// ---------------------------
// Проверка refresh токена
// ---------------------------
func (a *Auth) ParseRefreshToken(tokenString string) (int64, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return a.secret, nil
	})

	if err != nil || !token.Valid {
		return 0, errors.New("invalid token")
	}

	return claims.UserID, nil
}

// Helpers for string-int64 conversions
func stringFromInt64(i int64) string {
	return fmt.Sprintf("%d", i)
}

func int64FromString(s string) (int64, error) {
	return strconv.ParseInt(s, 10, 64)
}
