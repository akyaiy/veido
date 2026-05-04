package auth

import (
	"strconv"
	"time"

	"MyServer/internal/config"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	PairJTI string `json:"pair_jti,omitempty"`
	jwt.RegisteredClaims
}

func (a* Auth) createToken(userId int64, pairJTI string, expiresAt time.Duration) (*jwt.Token, error) {
	var claims *Claims
	if pairJTI == "" {
		claims = &Claims{
			RegisteredClaims: jwt.RegisteredClaims{
				Subject:   strconv.FormatInt(userId, 10),
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiresAt)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
				ID:        uuid.NewString(),
			},
		}
	}
	claims = &Claims{
		PairJTI: pairJTI,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(userId, 10),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiresAt)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        uuid.NewString(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token, nil
}

func (a *Auth) CreateToken(userId int64, pairJTI string, expiresAt time.Duration) (string, string, error) {
	token, err := a.createToken(userId, pairJTI, expiresAt)
	if err != nil {
		return "", "", err
	}
	secret := []byte(config.Data.MySecret)
	signedToken, err := token.SignedString(secret)
	if err != nil {
		return "", "", err
	}
	return signedToken, token.Claims.(*Claims).ID, nil
}

func (a *Auth) AuthenticateToken(tokenStr string) (*Claims, error) {
	secret := []byte(config.Data.MySecret)
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, &InvalidCredentialsError{Reason: "unexpected signing method"}
		}
		return secret, nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	return nil, &InvalidCredentialsError{Reason: "invalid token"}
}

func (a *Auth) StoreToken(userId int64, jwtId string) error {
	_, err := a.db.Exec("INSERT INTO whitelist (sub, jti) VALUES (?, ?)", userId, jwtId)
	if err != nil {
		return &DBError{Err: err}
	}
	return nil
}

func (a *Auth) IsTokenWhitelisted(userId int64, jwtId string) (bool, error) {
	var count int
	err := a.db.QueryRow("SELECT COUNT(*) FROM whitelist WHERE sub = ? AND jti = ?", userId, jwtId).Scan(&count)
	if err != nil {
		return false, &DBError{Err: err}
	}
	return count > 0, nil
}

func (a *Auth) RemoveToken(userId int64, jwtId string) error {
	_, err := a.db.Exec("DELETE FROM whitelist WHERE sub = ? AND jti = ?", userId, jwtId)
	if err != nil {
		return &DBError{Err: err}
	}
	return nil
}

func (a *Auth) RevokeAllTokens(userId int64) error {
	_, err := a.db.Exec("DELETE FROM whitelist WHERE sub = ?", userId)
	if err != nil {
		return &DBError{Err: err}
	}
	return nil
}