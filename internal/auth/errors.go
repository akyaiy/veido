package auth

import (
	"errors"
	"fmt"
)

var ErrUserExists = errors.New("user already exists")

type UserExistsError struct {
	User User
}

func (e *UserExistsError) Error() string {
	return fmt.Sprintf("user with this credentials already exists %v", e.User)
}

func (e *UserExistsError) Unwrap() error {
	return ErrUserExists
}

var ErrInvalidCredentials = errors.New("invalid credentials")

type InvalidCredentialsError struct {
	Reason string
}

func (e *InvalidCredentialsError) Error() string {
	return fmt.Sprintf("invalid credentials: %s", e.Reason)
}

func (e *InvalidCredentialsError) Unwrap() error {
	return ErrInvalidCredentials
}

var ErrDBError = errors.New("database error")

type DBError struct {
	Err error
}

func (e *DBError) Error() string {
	return fmt.Sprintf("database error: %v", e.Err)
}

func (e *DBError) Unwrap() error {
	return ErrDBError
}

var ErrUserNotFound = errors.New("user not found")

type UserNotFoundError struct {
	UserID   *int64
	Username *string
}

func (e *UserNotFoundError) Error() string {
	if e.UserID != nil {
		return fmt.Sprintf("user with id %d not found", *e.UserID)
	}
	if e.Username != nil {
		return fmt.Sprintf("user with username %s not found", *e.Username)
	}
	return "user not found"
}

func (e *UserNotFoundError) Unwrap() error {
	return ErrUserNotFound
}

var ErrHashingFailed = errors.New("password hashing failed")

type HashingError struct {
	Err error
}

func (e *HashingError) Error() string {
	return fmt.Sprintf("password hashing failed: %v", e.Err)
}

func (e *HashingError) Unwrap() error {
	return ErrHashingFailed
}

var ErrTokenGeneration = errors.New("token generation failed")

type TokenGenerationError struct {
	Err error
}

func (e *TokenGenerationError) Error() string {
	return fmt.Sprintf("token generation failed: %v", e.Err)
}

func (e *TokenGenerationError) Unwrap() error {
	return ErrTokenGeneration
}

var ErrInvalidToken = errors.New("invalid token")

type InvalidTokenError struct {
	Err error
}

func (e *InvalidTokenError) Error() string {
	return fmt.Sprintf("invalid token: %v", e.Err)
}

func (e *InvalidTokenError) Unwrap() error {
	return ErrInvalidToken
}

var ErrPasswordMismatch = errors.New("password mismatch")

type PasswordMismatchError struct {
	Err error
}

func (e *PasswordMismatchError) Error() string {
	return fmt.Sprintf("password mismatch: %v", e.Err)
}

func (e *PasswordMismatchError) Unwrap() error {
	return ErrPasswordMismatch
}

var ErrInvalidSigningMethod = errors.New("invalid signing method")

type InvalidSigningMethodError struct {
	Method string
}

func (e *InvalidSigningMethodError) Error() string {
	return fmt.Sprintf("invalid signing method: %s", e.Method)
}

func (e *InvalidSigningMethodError) Unwrap() error {
	return ErrInvalidSigningMethod
}

var ErrNoTokenFound = errors.New("no token found")

type NoTokenError struct {
	Reason string
}

func (e *NoTokenError) Error() string {
	return fmt.Sprintf("no token found: %s", e.Reason)
}

func (e *NoTokenError) Unwrap() error {
	return ErrNoTokenFound
}
