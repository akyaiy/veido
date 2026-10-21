package auth

import (
	"context"
	"strconv"

	"github.com/google/uuid"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}
type LoginResponse struct {
	UserID       int64  `json:"userId"`
	Username     string `json:"username"`
	AccessToken  string `json:"accessToken,omitempty"`
	RefreshToken string `json:"refreshToken,omitempty"`
	UserStatus   string `json:"userStatus"`
}
type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}
type RefreshResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

func (a *Auth) Login(req *LoginRequest) (*LoginResponse, error) {
	if req == nil || req.Username == "" || req.Password == "" {
		return nil, &InvalidCredentialsError{Reason: "username and password are required"}
	}
	user, err := a.AuthenticateUser(req.Username, req.Password)
	if err != nil {
		return nil, err
	}
	sessionID := uuid.NewString()
	refresh, refreshClaims, err := a.signToken(user.ID, sessionID, TokenUseRefresh, a.refreshTTL)
	if err != nil {
		return nil, err
	}
	access, _, err := a.signToken(user.ID, sessionID, TokenUseAccess, a.accessTTL)
	if err != nil {
		return nil, err
	}
	_, err = a.db.Exec(`INSERT INTO sessions(id, user_id, refresh_token_hash, expires_at, revoked) VALUES(?, ?, ?, ?, 0)`,
		sessionID, user.ID, tokenHash(refresh), refreshClaims.ExpiresAt.Time)
	if err != nil {
		return nil, &DBError{Err: err}
	}
	return &LoginResponse{UserID: user.ID, Username: user.Name, AccessToken: access, RefreshToken: refresh, UserStatus: user.Status}, nil
}

func (a *Auth) Refresh(req *RefreshRequest) (*RefreshResponse, error) {
	if req == nil || req.RefreshToken == "" {
		return nil, &InvalidCredentialsError{Reason: "refresh token is required"}
	}
	claims, err := a.parseToken(req.RefreshToken, TokenUseRefresh)
	if err != nil {
		return nil, err
	}
	userID, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil {
		return nil, &InvalidCredentialsError{Reason: "invalid token subject"}
	}
	newRefresh, refreshClaims, err := a.signToken(userID, claims.SessionID, TokenUseRefresh, a.refreshTTL)
	if err != nil {
		return nil, err
	}
	newAccess, _, err := a.signToken(userID, claims.SessionID, TokenUseAccess, a.accessTTL)
	if err != nil {
		return nil, err
	}
	tx, err := a.db.Begin()
	if err != nil {
		return nil, &DBError{Err: err}
	}
	defer tx.Rollback()
	result, err := tx.Exec(`UPDATE sessions SET refresh_token_hash = ?, expires_at = ?, last_used_at = ?
		WHERE id = ? AND user_id = ? AND refresh_token_hash = ? AND revoked = 0
		AND EXISTS (SELECT 1 FROM users WHERE users.id = sessions.user_id AND users.status = ?)`,
		tokenHash(newRefresh), refreshClaims.ExpiresAt.Time, a.clock().UTC(), claims.SessionID, userID, tokenHash(req.RefreshToken), StatusActive)
	if err != nil {
		return nil, &DBError{Err: err}
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return nil, &DBError{Err: err}
	}
	if rows != 1 {
		if _, err := tx.Exec("UPDATE sessions SET revoked = 1 WHERE id = ? AND user_id = ?", claims.SessionID, userID); err != nil {
			return nil, &DBError{Err: err}
		}
		if err := tx.Commit(); err != nil {
			return nil, &DBError{Err: err}
		}
		return nil, ErrRefreshTokenReuse
	}
	if err := tx.Commit(); err != nil {
		return nil, &DBError{Err: err}
	}
	return &RefreshResponse{AccessToken: newAccess, RefreshToken: newRefresh}, nil
}

func (a *Auth) Logout(ctx context.Context) error {
	principal, ok := PrincipalFromContext(ctx)
	if !ok {
		return &InvalidCredentialsError{Reason: "authenticated session is required"}
	}
	result, err := a.db.Exec("UPDATE sessions SET revoked = 1 WHERE id = ? AND user_id = ? AND revoked = 0", principal.SessionID, principal.UserID)
	if err != nil {
		return &DBError{Err: err}
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return &DBError{Err: err}
	}
	if rows != 1 {
		return &InvalidCredentialsError{Reason: "session is not active"}
	}
	return nil
}

func (a *Auth) RevokeAllTokens(userID int64) error {
	if _, err := a.db.Exec("UPDATE sessions SET revoked = 1 WHERE user_id = ? AND revoked = 0", userID); err != nil {
		return &DBError{Err: err}
	}
	return nil
}
