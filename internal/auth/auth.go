package auth

import (
	"MyServer/internal/utils"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

type Auth struct {
	db     *sql.DB
	secret []byte
}

type User struct {
	ID       int64  `json:"id,omitempty"`
	Name     string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
	Status   string `json:"status,omitempty"`
}

type userId int64

func (u *User) IsValid() bool {
	return u.Name != "" && u.Password != "" && u.ID > 0
}

// NewAuth создает новый экземпляр Auth с БД и secret
func NewAuth(db *sql.DB, secret []byte) *Auth {
	return &Auth{db: db, secret: secret}
}

// GetUserFromRequest получает пользователя из HTTP запроса
// Пытается аутентифицировать через JWT, при ошибке возвращает nil (не ошибку)
func (a *Auth) GetUserFromRequest(r *http.Request) (*User, error) {
	// Аутентифицируем через JWT из Authorization header
	claims, err := a.AuthenticateRequest(r)
	if err == nil {
		user, err := strconv.Atoi(claims.Subject)
		if err != nil {
			slog.Error("GetUserFromRequest: invalid subject in token", "subject", claims.Subject, "error", err)
			return nil, nil // Не возвращаем ошибку, просто не аутентифицируем
		}
		return a.GetUserByID(int64(user))
	}
	return nil, err
}

// CreateUser создает нового пользователя в БД
func (a *Auth) CreateUser(user *User) (userId, error) {
	hash, err := a.HashPassword(user.Password)
	if err != nil {
		slog.Error("CreateUser hashing error", "error", err)
		return 0, &HashingError{Err: err}
	}
	if user.Password == "" {
		hash = "" // Если пароль пустой, не хешируем его, чтобы не создавать валидный хеш от пустой строки
	} 
	if user.Name == "" {
		return 0, &InvalidCredentialsError{Reason: "username cannot be empty and must be alphanumeric"}
	} 

	res, err := a.db.Exec("INSERT INTO users(username, password_hash, status) VALUES(?,?,?)",
		user.Name, hash, user.Status)
	if err != nil {
		var sqliteErr sqlite3.Error
		if errors.As(err, &sqliteErr) {
			if sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique {
				user.Password = "" // Чувствительная информация не должна возвращаться
				return 0, &UserExistsError{User: *user}
			}
		}
		slog.Error("CreateUser db error", "error", err)
		return 0, &DBError{Err: err}
	}

	id, err := res.LastInsertId()
	if err != nil {
		slog.Error("CreateUser db error", "error", err)
		return 0, &DBError{Err: err}
	}
	return userId(id), nil
}

// GetUserByID получает пользователя по ID
func (a *Auth) GetUserByID(userID int64) (*User, error) {
	row := a.db.QueryRow(
		"SELECT id, username, status FROM users WHERE id = ?",
		userID,
	)

	var u User
	if err := row.Scan(&u.ID, &u.Name, &u.Status); err != nil {
		if err == sql.ErrNoRows {
			return nil, &UserNotFoundError{UserID: &userID}
		}
		slog.Error("GetUserByID db error", "error", err)
		return nil, &DBError{Err: err}
	}
	return &u, nil
}

// GetUserByUsername получает пользователя по username
func (a *Auth) GetUserByUsername(username string) (*User, error) {
	row := a.db.QueryRow(
		"SELECT id, username, password_hash, status FROM users WHERE username = ?",
		username,
	)

	var u User
	var hash string
	if err := row.Scan(&u.ID, &u.Name, &hash, &u.Status); err != nil {
		if err == sql.ErrNoRows {
			return nil, &UserNotFoundError{Username: &username}
		}
		slog.Error("GetUserByUsername db error", "error", err)
		return nil, &DBError{Err: err}
	}
	return &u, nil
}

// AuthenticateUser проверяет учетные данные и возвращает пользователя
func (a *Auth) AuthenticateUser(username, password string) (*User, error) {
	row := a.db.QueryRow(
		"SELECT id, username, password_hash, status FROM users WHERE username = ?",
		username,
	)

	var (
		id     int64
		name   string
		hash   string
		status string
	)

	if err := row.Scan(&id, &name, &hash, &status); err != nil {
		if err == sql.ErrNoRows {
			return nil, &InvalidCredentialsError{Reason: "invalid username"}
		}
		slog.Error("AuthenticateUser db error", "error", err)
		return nil, &DBError{Err: err}
	}

	if err := a.CheckPassword(hash, password); err != nil {
		return nil, &InvalidCredentialsError{Reason: "invalid password"}
	}

	return &User{
		ID:     id,
		Name:   name,
		Status: status,
	}, nil
}

// GetUsers получает список пользователей с пагинацией
func (a *Auth) GetUsers(limit, offset int) ([]User, error) {
	if limit <= 0 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := a.db.Query(
		"SELECT id, username, status FROM users LIMIT ? OFFSET ?",
		limit, offset,
	)
	if err != nil {
		slog.Error("GetUsers db error", "error", err)
		return nil, &DBError{Err: err}
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Name, &u.Status); err != nil {
			slog.Error("GetUsers scan error", "error", err)
			return nil, &DBError{Err: err}
		}
		users = append(users, u)
	}

	if err = rows.Err(); err != nil {
		slog.Error("GetUsers rows error", "error", err)
		return nil, &DBError{Err: err}
	}

	return users, nil
}

// UpdateUser обновляет данные пользователя
func (a *Auth) UpdateUser(userID int64, user *User) error {
	if userID <= 0 {
		return &InvalidCredentialsError{Reason: "invalid user id"}
	}

	if user.Name != "" && !utils.IsASCIIAlphaNumeric(user.Name) {
		return &InvalidCredentialsError{Reason: "username must be alphanumeric"}
	}

	// Формируем UPDATE запрос в зависимости от переданных полей
	var query string
	var args []interface{}

	if user.Name != "" && user.Status != "" {
		query = "UPDATE users SET username = ?, status = ? WHERE id = ?"
		args = []interface{}{user.Name, user.Status, userID}
	} else if user.Name != "" {
		query = "UPDATE users SET username = ? WHERE id = ?"
		args = []interface{}{user.Name, userID}
	} else if user.Status != "" {
		query = "UPDATE users SET status = ? WHERE id = ?"
		args = []interface{}{user.Status, userID}
	} else {
		return &InvalidCredentialsError{Reason: "no fields to update"}
	}

	res, err := a.db.Exec(query, args...)
	if err != nil {
		var sqliteErr sqlite3.Error
		if errors.As(err, &sqliteErr) {
			if sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique {
				return &UserExistsError{User: User{Name: user.Name}}
			}
		}
		slog.Error("UpdateUser db error", "error", err)
		return &DBError{Err: err}
	}

	rows, err := res.RowsAffected()
	if err != nil {
		slog.Error("UpdateUser RowsAffected error", "error", err)
		return &DBError{Err: err}
	}

	if rows == 0 {
		return &UserNotFoundError{UserID: &userID}
	}

	return nil
}

// UpdatePassword обновляет пароль пользователя
func (a *Auth) UpdatePassword(userID int64, newPassword string) error { // TODO: нужно сделать проверку настоящего пароля
	if userID <= 0 {
		return &InvalidCredentialsError{Reason: "invalid user id"}
	}

	if newPassword == "" {
		return &InvalidCredentialsError{Reason: "password cannot be empty"}
	}

	hash, err := a.HashPassword(newPassword)
	if err != nil {
		return &HashingError{Err: err}
	}

	res, err := a.db.Exec(
		"UPDATE users SET password_hash = ? WHERE id = ?",
		hash, userID,
	)
	if err != nil {
		slog.Error("UpdatePassword db error", "error", err)
		return &DBError{Err: err}
	}

	rows, err := res.RowsAffected()
	if err != nil {
		slog.Error("UpdatePassword RowsAffected error", "error", err)
		return &DBError{Err: err}
	}

	if rows == 0 {
		return &UserNotFoundError{UserID: &userID}
	}

	return nil
}

// DeleteUser удаляет пользователя
func (a *Auth) DeleteUser(userID int64) error {
	if userID <= 0 {
		return &InvalidCredentialsError{Reason: "invalid user id"}
	}

	res, err := a.db.Exec("DELETE FROM users WHERE id = ?", userID)
	if err != nil {
		slog.Error("DeleteUser db error", "error", err)
		return &DBError{Err: err}
	}

	rows, err := res.RowsAffected()
	if err != nil {
		slog.Error("DeleteUser RowsAffected error", "error", err)
		return &DBError{Err: err}
	}

	if rows == 0 {
		return &UserNotFoundError{UserID: &userID}
	}

	return nil
}

// HashPassword хеширует пароль
func (a *Auth) HashPassword(pass string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	if err != nil {
		return "", &HashingError{Err: err}
	}
	return string(b), nil
}

// CheckPassword сравнивает хеш с паролем
func (a *Auth) CheckPassword(hash, pass string) error {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(pass))
	if err != nil {
		return &PasswordMismatchError{Err: err}
	}
	return nil
}

// // StoreRefreshToken сохраняет refresh token в БД с TTL
// func (a *Auth) StoreRefreshToken(token string, userID int64, ttl time.Duration) error {
// 	expires := time.Now().Add(ttl).Unix()
// 	_, err := a.db.Exec(
// 		"INSERT INTO refresh_tokens(token, user_id, expires_at) VALUES(?,?,?)",
// 		token, userID, expires,
// 	)
// 	if err != nil {
// 		slog.Error("StoreRefreshToken db error", "error", err)
// 		return &DBError{Err: err}
// 	}
// 	return nil
// }

// // DeleteRefreshToken удаляет refresh token (revoke)
// func (a *Auth) RevokeTokenPair(userId int64) error {
// 	_, err := a.db.Exec("INSERT INTO refresh_tokens(user_id, token, expires_at) VALUES (?,?,?)", userId, "", 0)
// 	if err != nil {
// 		slog.Error("DeleteRefreshToken db error", "error", err)
// 		return &DBError{Err: err}
// 	}
// 	return nil
// }

// // VerifyRefreshToken проверяет JWT refresh token и возвращает userID
// func (a *Auth) VerifyRefreshToken(tokenString string) (int64, error) {
// 	// Парсим и валидируем токен
// 	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
// 		// Проверяем, что используется корректный алгоритм
// 		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
// 			return nil, &InvalidSigningMethodError{Method: fmt.Sprintf("%v", t.Header["alg"])}
// 		}
// 		return a.secret, nil
// 	})
// 	if err != nil {
// 		return 0, &InvalidCredentialsError{Reason: "invalid token"}
// 	}

// 	// Проверяем claims
// 	claims, ok := token.Claims.(*Claims)
// 	if !ok || !token.Valid {
// 		return 0, &InvalidCredentialsError{Reason: "invalid token"}
// 	}

// 	row := a.db.QueryRow("SELECT 1 FROM refresh_tokens WHERE token = ? LIMIT 1", tokenString)
// 	var exists int
// 	err = row.Scan(&exists)
// 	if errors.Is(err, sql.ErrNoRows) {
// 		return claims.UserID, nil
// 	}
// 	if err == nil {
// 		return 0, &InvalidCredentialsError{Reason: "token was revoked"}
// 	}


// 	// Если другая ошибка БД
// 	slog.Error("VerifyRefreshToken db error", "error", err)
// 	return 0, &DBError{Err: err}
// }

// AuthenticateRequest аутентифицирует HTTP-запрос по JWT-токену
// Возвращает userID и флаг успеха
func (a *Auth) AuthenticateRequest(r *http.Request) (*Claims, error) {
	// Читаем заголовок Authorization
	// Ожидаемый формат: Authorization: Bearer <JWT>
	header := r.Header.Get("Authorization")
	if header == "" {
		return nil, &NoTokenError{Reason: "Authorization header is missing"}
	}

	// Проверяем префикс Bearer
	if !strings.HasPrefix(header, "Bearer ") {
		return nil, &InvalidCredentialsError{Reason: "Authorization header must start with Bearer"}
	}

	// Извлекаем JWT-токен
	tokenString := strings.TrimPrefix(header, "Bearer ")

	// Парсим и проверяем JWT
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// Проверяем алгоритм подписи
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, &InvalidSigningMethodError{Method: fmt.Sprintf("%v", token.Header["alg"])}
		}
		// Передаем секретный ключ
		return a.secret, nil
	})

	// Проверяем результат
	if err != nil || !token.Valid {
		return nil, errors.Join(&InvalidCredentialsError{Reason: "invalid token"}, err)
	}

	return claims, nil
}

// // ParseToken парсит token и возвращает userID
// func (a *Auth) ParseToken(tokenString string) (int64, error) {
// 	claims := &Claims{}

// 	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
// 		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
// 			return nil, &InvalidSigningMethodError{Method: fmt.Sprintf("%v", token.Header["alg"])}
// 		}
// 		return a.secret, nil
// 	})

// 	if err != nil || !token.Valid {
// 		return 0, &InvalidCredentialsError{Reason: "invalid token"}
// 	}

// 	return claims.UserID, nil
// }

