package auth

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

const CONTEXT_USER_ID_KEY = "user_id"

const (
	StatusActive          = "active"
	StatusInactive        = "unactive"
	StatusBlocked         = "blocked"
	minimumPasswordLength = 8
	maximumPasswordLength = 72
)

var usernamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{2,63}$`)

type Config struct {
	Secret     []byte
	Issuer     string
	Audience   string
	AccessTTL  time.Duration
	RefreshTTL time.Duration
	Clock      func() time.Time
}

type Auth struct {
	db         *sql.DB
	secret     []byte
	issuer     string
	audience   string
	accessTTL  time.Duration
	refreshTTL time.Duration
	clock      func() time.Time
}

type User struct {
	ID       int64  `json:"id,omitempty"`
	Name     string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
	Status   string `json:"status,omitempty"`
}

type userId int64
type Principal struct {
	UserID    int64
	SessionID string
}
type principalContextKey struct{}

func NewAuth(db *sql.DB, cfg Config) (*Auth, error) {
	if db == nil {
		return nil, errors.New("auth: database is required")
	}
	if len(cfg.Secret) < 32 {
		return nil, errors.New("auth: JWT secret must contain at least 32 bytes")
	}
	if strings.TrimSpace(cfg.Issuer) == "" || strings.TrimSpace(cfg.Audience) == "" {
		return nil, errors.New("auth: JWT issuer and audience are required")
	}
	if cfg.AccessTTL <= 0 || cfg.RefreshTTL <= 0 {
		return nil, errors.New("auth: access and refresh TTL must be positive")
	}
	clock := cfg.Clock
	if clock == nil {
		clock = time.Now
	}
	return &Auth{db: db, secret: append([]byte(nil), cfg.Secret...), issuer: strings.TrimSpace(cfg.Issuer),
		audience: strings.TrimSpace(cfg.Audience), accessTTL: cfg.AccessTTL, refreshTTL: cfg.RefreshTTL, clock: clock}, nil
}

func (a *Auth) RefreshTTL() time.Duration { return a.refreshTTL }

func ContextWithPrincipal(ctx context.Context, principal Principal) context.Context {
	ctx = context.WithValue(ctx, principalContextKey{}, principal)
	return context.WithValue(ctx, CONTEXT_USER_ID_KEY, int(principal.UserID))
}

func PrincipalFromContext(ctx context.Context) (Principal, bool) {
	principal, ok := ctx.Value(principalContextKey{}).(Principal)
	return principal, ok && principal.UserID > 0 && principal.SessionID != ""
}

func (u *User) IsValid() bool { return u.Name != "" && u.Password != "" && u.ID > 0 }

func normalizeUsername(username string) (string, error) {
	username = strings.ToLower(strings.TrimSpace(username))
	if !usernamePattern.MatchString(username) {
		return "", &InvalidCredentialsError{Reason: "username must be 3-64 lowercase letters, digits, '.', '_' or '-'"}
	}
	return username, nil
}

func normalizeStatus(status string) (string, error) {
	status = strings.ToLower(strings.TrimSpace(status))
	switch status {
	case StatusActive, StatusInactive, StatusBlocked:
		return status, nil
	}
	return "", &InvalidCredentialsError{Reason: "invalid user status"}
}

func validatePassword(password string) error {
	if len(password) < minimumPasswordLength || len(password) > maximumPasswordLength {
		return &InvalidCredentialsError{Reason: "password must contain 8-72 bytes"}
	}
	return nil
}

func (a *Auth) GetUserFromRequest(r *http.Request) (*User, error) {
	claims, err := a.AuthenticateRequest(r)
	if err != nil {
		return nil, err
	}
	userID, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil {
		return nil, &InvalidCredentialsError{Reason: "invalid token subject"}
	}
	return a.GetUserByID(userID)
}

func (a *Auth) AuthenticateBasicRequest(r *http.Request) (*User, error) {
	username, password, ok := r.BasicAuth()
	if !ok {
		return nil, &NoTokenError{Reason: "Basic auth credentials are missing"}
	}
	return a.AuthenticateUser(username, password)
}

func (a *Auth) CreateUser(user *User) (userId, error) {
	username, err := normalizeUsername(user.Name)
	if err != nil {
		return 0, err
	}
	if err := validatePassword(user.Password); err != nil {
		return 0, err
	}
	status, err := normalizeStatus(user.Status)
	if err != nil {
		return 0, err
	}
	hash, err := a.HashPassword(user.Password)
	if err != nil {
		return 0, err
	}
	res, err := a.db.Exec("INSERT INTO users(username, password_hash, status) VALUES(?,?,?)", username, hash, status)
	if err != nil {
		var sqliteErr sqlite3.Error
		if errors.As(err, &sqliteErr) && sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique {
			return 0, &UserExistsError{User: User{Name: username, Status: status}}
		}
		return 0, &DBError{Err: err}
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, &DBError{Err: err}
	}
	return userId(id), nil
}

// DeleteNewUser compensates a failed registration workflow before a session or
// any user-owned resources have been made available. It is deliberately not a
// general user-management API.
func (a *Auth) DeleteNewUser(userID int64) error {
	if userID <= 0 {
		return &InvalidCredentialsError{Reason: "invalid user"}
	}
	result, err := a.db.Exec(`DELETE FROM users WHERE id = ?`, userID)
	if err != nil {
		return &DBError{Err: err}
	}
	count, err := result.RowsAffected()
	if err != nil {
		return &DBError{Err: err}
	}
	if count != 1 {
		return &UserNotFoundError{UserID: &userID}
	}
	return nil
}

func (a *Auth) GetUserByID(userID int64) (*User, error) {
	var user User
	err := a.db.QueryRow("SELECT id, username, status FROM users WHERE id = ?", userID).Scan(&user.ID, &user.Name, &user.Status)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &UserNotFoundError{UserID: &userID}
	}
	if err != nil {
		return nil, &DBError{Err: err}
	}
	return &user, nil
}

func (a *Auth) GetUserByUsername(username string) (*User, error) {
	normalized, err := normalizeUsername(username)
	if err != nil {
		return nil, err
	}
	var user User
	err = a.db.QueryRow("SELECT id, username, status FROM users WHERE username = ?", normalized).Scan(&user.ID, &user.Name, &user.Status)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &UserNotFoundError{Username: &normalized}
	}
	if err != nil {
		return nil, &DBError{Err: err}
	}
	return &user, nil
}

func (a *Auth) AuthenticateUser(username, password string) (*User, error) {
	normalized, err := normalizeUsername(username)
	if err != nil {
		return nil, &InvalidCredentialsError{Reason: "invalid username or password"}
	}
	var user User
	var hash string
	err = a.db.QueryRow("SELECT id, username, password_hash, status FROM users WHERE username = ?", normalized).Scan(&user.ID, &user.Name, &hash, &user.Status)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &InvalidCredentialsError{Reason: "invalid username or password"}
	}
	if err != nil {
		return nil, &DBError{Err: err}
	}
	if a.CheckPassword(hash, password) != nil {
		return nil, &InvalidCredentialsError{Reason: "invalid username or password"}
	}
	if user.Status != StatusActive {
		return nil, &InvalidCredentialsError{Reason: "user is not allowed to sign in"}
	}
	return &user, nil
}

func (a *Auth) GetUsers(limit, offset int) ([]User, error) {
	if limit <= 0 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := a.db.Query("SELECT id, username, status FROM users LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return nil, &DBError{Err: err}
	}
	defer rows.Close()
	var users []User
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Name, &user.Status); err != nil {
			return nil, &DBError{Err: err}
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return nil, &DBError{Err: err}
	}
	return users, nil
}

func (a *Auth) UpdateUser(userID int64, user *User) error {
	if userID <= 0 {
		return &InvalidCredentialsError{Reason: "invalid user id"}
	}
	var username, status string
	var err error
	if user.Name != "" {
		username, err = normalizeUsername(user.Name)
		if err != nil {
			return err
		}
	}
	if user.Status != "" {
		status, err = normalizeStatus(user.Status)
		if err != nil {
			return err
		}
	}
	if username == "" && status == "" {
		return &InvalidCredentialsError{Reason: "no fields to update"}
	}
	tx, err := a.db.Begin()
	if err != nil {
		return &DBError{Err: err}
	}
	defer tx.Rollback()
	res, err := tx.Exec("UPDATE users SET username = COALESCE(NULLIF(?, ''), username), status = COALESCE(NULLIF(?, ''), status) WHERE id = ?", username, status, userID)
	if err != nil {
		var sqliteErr sqlite3.Error
		if errors.As(err, &sqliteErr) && sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique {
			return &UserExistsError{User: User{Name: username}}
		}
		return &DBError{Err: err}
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return &DBError{Err: err}
	}
	if rows == 0 {
		return &UserNotFoundError{UserID: &userID}
	}
	if status != "" && status != StatusActive {
		if _, err := tx.Exec("UPDATE sessions SET revoked = 1 WHERE user_id = ? AND revoked = 0", userID); err != nil {
			return &DBError{Err: err}
		}
	}
	if err := tx.Commit(); err != nil {
		return &DBError{Err: err}
	}
	return nil
}

func (a *Auth) UpdatePassword(userID int64, newPassword string) error {
	return a.updatePassword(userID, "", newPassword, false)
}
func (a *Auth) ChangePassword(userID int64, oldPassword, newPassword string) error {
	return a.updatePassword(userID, oldPassword, newPassword, true)
}

func (a *Auth) updatePassword(userID int64, oldPassword, newPassword string, verifyOld bool) error {
	if userID <= 0 {
		return &InvalidCredentialsError{Reason: "invalid user id"}
	}
	if err := validatePassword(newPassword); err != nil {
		return err
	}
	newHash, err := a.HashPassword(newPassword)
	if err != nil {
		return err
	}
	tx, err := a.db.Begin()
	if err != nil {
		return &DBError{Err: err}
	}
	defer tx.Rollback()
	if verifyOld {
		var oldHash string
		err := tx.QueryRow("SELECT password_hash FROM users WHERE id = ?", userID).Scan(&oldHash)
		if errors.Is(err, sql.ErrNoRows) {
			return &UserNotFoundError{UserID: &userID}
		}
		if err != nil {
			return &DBError{Err: err}
		}
		if a.CheckPassword(oldHash, oldPassword) != nil {
			return &InvalidCredentialsError{Reason: "old password is incorrect"}
		}
	}
	res, err := tx.Exec("UPDATE users SET password_hash = ? WHERE id = ?", newHash, userID)
	if err != nil {
		return &DBError{Err: err}
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return &DBError{Err: err}
	}
	if rows == 0 {
		return &UserNotFoundError{UserID: &userID}
	}
	if _, err := tx.Exec("UPDATE sessions SET revoked = 1 WHERE user_id = ? AND revoked = 0", userID); err != nil {
		return &DBError{Err: err}
	}
	if err := tx.Commit(); err != nil {
		return &DBError{Err: err}
	}
	return nil
}

func (a *Auth) DeleteUser(userID int64) error {
	if userID <= 0 {
		return &InvalidCredentialsError{Reason: "invalid user id"}
	}
	res, err := a.db.Exec("DELETE FROM users WHERE id = ?", userID)
	if err != nil {
		return &DBError{Err: err}
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return &DBError{Err: err}
	}
	if rows == 0 {
		return &UserNotFoundError{UserID: &userID}
	}
	return nil
}

func (a *Auth) HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", &HashingError{Err: err}
	}
	return string(hash), nil
}
func (a *Auth) CheckPassword(hash, password string) error {
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return &PasswordMismatchError{Err: err}
	}
	return nil
}

func (a *Auth) AuthenticateRequest(r *http.Request) (*Claims, error) {
	header := r.Header.Get("Authorization")
	if header == "" {
		return nil, &NoTokenError{Reason: "Authorization header is missing"}
	}
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return nil, &InvalidCredentialsError{Reason: "Authorization header must start with Bearer"}
	}
	return a.VerifyAccessToken(strings.TrimSpace(strings.TrimPrefix(header, prefix)))
}
