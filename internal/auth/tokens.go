package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	TokenUseAccess  = "access"
	TokenUseRefresh = "refresh"
)

type Claims struct {
	SessionID string `json:"sid"`
	TokenUse  string `json:"token_use"`
	jwt.RegisteredClaims
}

func (a *Auth) signToken(userID int64, sessionID, tokenUse string, ttl time.Duration) (string, *Claims, error) {
	now := a.clock().UTC()
	claims := &Claims{SessionID: sessionID, TokenUse: tokenUse, RegisteredClaims: jwt.RegisteredClaims{
		Issuer: a.issuer, Subject: strconv.FormatInt(userID, 10), Audience: jwt.ClaimStrings{a.audience},
		ExpiresAt: jwt.NewNumericDate(now.Add(ttl)), NotBefore: jwt.NewNumericDate(now),
		IssuedAt: jwt.NewNumericDate(now), ID: uuid.NewString(),
	}}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(a.secret)
	if err != nil {
		return "", nil, &TokenGenerationError{Err: err}
	}
	return signed, claims, nil
}

func (a *Auth) parseToken(raw, expectedUse string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, &InvalidSigningMethodError{Method: token.Method.Alg()}
		}
		return a.secret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithIssuer(a.issuer),
		jwt.WithAudience(a.audience), jwt.WithExpirationRequired(), jwt.WithIssuedAt(), jwt.WithTimeFunc(a.clock))
	if err != nil || !token.Valid {
		return nil, errors.Join(&InvalidCredentialsError{Reason: "invalid token"}, err)
	}
	if claims.TokenUse != expectedUse || claims.SessionID == "" || claims.Subject == "" || claims.ID == "" ||
		claims.IssuedAt == nil || claims.NotBefore == nil || claims.ExpiresAt == nil {
		return nil, &InvalidCredentialsError{Reason: "invalid token claims"}
	}
	return claims, nil
}

func (a *Auth) VerifyAccessToken(raw string) (*Claims, error) {
	claims, err := a.parseToken(raw, TokenUseAccess)
	if err != nil {
		return nil, err
	}
	userID, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil {
		return nil, &InvalidCredentialsError{Reason: "invalid token subject"}
	}
	var revoked bool
	var expiresAt time.Time
	var status string
	err = a.db.QueryRow(`SELECT s.revoked, s.expires_at, u.status FROM sessions s
		JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.user_id = ?`, claims.SessionID, userID).
		Scan(&revoked, &expiresAt, &status)
	if err != nil || revoked || !expiresAt.After(a.clock()) || status != StatusActive {
		return nil, &InvalidCredentialsError{Reason: "session is not active"}
	}
	return claims, nil
}

func (a *Auth) AuthenticateToken(raw string) (*Claims, error) { return a.VerifyAccessToken(raw) }

func tokenHash(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
