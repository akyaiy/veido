package auth

import (
	"MyServer/internal/config"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
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

type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
}

/*******************************************************************************
 * GetUserFromRequest — это функция аутентификации пользователя по HTTP-запросу.
 *******************************************************************************/
func (a *Auth) GetUserFromRequest(r *http.Request) (*User, error) {
	// 1️⃣ JWT (основной способ)
	userID, ok := a.AuthenticateRequest(r)
	if ok && userID != 0 {
		return a.loadUserByID(userID)
	}

	// 2️⃣ Basic Auth — ТОЛЬКО для WebDAV
	if strings.HasPrefix(r.URL.Path, "/dav") {
		login, pass, ok := r.BasicAuth()
		if ok {
			u, err := a.AuthenticateUser(login, pass)
			if err == nil {
				return u, nil
			}
		}
	}

	// 3️⃣ Fallback → Guest (НЕ ошибка)
	return &User{
		ID:       0,
		Username: "Guest",
	}, nil
}

func (a *Auth) AuthenticateUser(login, password string) (*User, error) {
	row := a.db.QueryRow(
		"SELECT id, username, password_hash FROM users WHERE username = ?",
		login,
	)

	var (
		id       int64
		username string
		hash     string
	)

	if err := row.Scan(&id, &username, &hash); err != nil {
		return nil, errors.New("invalid credentials")
	}

	// Здесь проверяем ошибку
	err := a.CheckPassword(hash, password)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	return &User{
		ID:       id,
		Username: username,
	}, nil
}

func (a *Auth) loadUserByID(userID int64) (*User, error) {
	row := a.db.QueryRow(
		"SELECT id, username FROM users WHERE id = ?",
		userID,
	)

	var u User
	if err := row.Scan(&u.ID, &u.Username); err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return &u, nil
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
			//			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(config.GetATokenTime())),
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
			//			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(config.GetRTokenTime())),
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

// VerifyRefreshToken verifies the JWT refresh token signature and expiration.
func (a *Auth) VerifyRefreshToken(tokenString string) (int64, error) {
	// Разбираем и валидируем токен
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		// Проверяем, что используется корректный алгоритм
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return a.secret, nil
	})
	if err != nil {
		return 0, err
	}

	// 2. Check if token is in revoked list (deleted tokens)
	row := a.db.QueryRow("SELECT 1 FROM refresh_tokens WHERE token = ? LIMIT 1", token)
	var exists int
	err = row.Scan(&exists)
	if err == nil {
		// token found = token revoked
		return 0, errors.New("token revoked")
	}

	// Проверяем claims
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return 0, errors.New("invalid token")
	}

	// Проверка срока годности токена (опционально, jwt сам проверяет RegisteredClaims.ExpiresAt.Validate)
	if claims.ExpiresAt != nil && time.Now().After(claims.ExpiresAt.Time) {
		return 0, errors.New("expired")
	}

	return claims.UserID, nil
}

/****************************************************************************
 * AuthenticateRequest аутентифицирует HTTP-запрос по JWT-токену.
 * Возвращает:
 *
 * - int64 — UserID, извлечённый из токена
 * - bool — успешна ли аутентификация
 * - (0, false) - если что-то пошло не так.
******************************************************************************/
func (a *Auth) AuthenticateRequest(r *http.Request) (int64, bool) {
	// Чтение заголовка Authorization.
	// Ожидаемый формат: Authorization: Bearer <JWT>
	header := r.Header.Get("Authorization")
	if header == "" {
		return 0, false
	}
	// Проверка префикса Bearer
	if !strings.HasPrefix(header, "Bearer ") {
		return 0, false
	}
	// Извлечение JWT-токена
	tokenString := strings.TrimPrefix(header, "Bearer ")
	// Создание структуры claims
	// Claims — это структура, в которую будут распарсены данные из JWT.
	claims := &Claims{}
	// Парсинг и проверка JWT
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// Проверка алгоритма подписи
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			// Разрешаются только HMAC-алгоритмы (HS256, HS384, HS512)
			return nil, errors.New("unexpected signing method")
		}
		// Передача секретного ключа
		return a.secret, nil
	})
	// Проверка результата
	if err != nil || !token.Valid {
		return 0, false
	}
	//Успешная аутентификация
	//fmt.Print("auth ok!\n")
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
	fmt.Printf("user id: %v\n", claims.UserID)
	return claims.UserID, nil
}
