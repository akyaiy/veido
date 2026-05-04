package auth

import (
	"MyServer/internal/config"
	"log/slog"
	"strconv"
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
	RefreshToken string
}

type RefreshResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

func (a *Auth) Login(req *LoginRequest) (*LoginResponse, error) {
	if req.Username == "" || req.Password == "" {
		return nil, &InvalidCredentialsError{Reason: "username and password are required"}
	}

	user, err := a.AuthenticateUser(req.Username, req.Password)
	if err != nil {
		slog.Warn("Login failed: invalid credentials", "username", req.Username)
		return nil, &InvalidCredentialsError{Reason: "invalid username or password"}
	}

	refreshToken, id, err := a.CreateToken(user.ID, "", config.GetRTokenTime())
	if err != nil {
		slog.Error("Login: failed to create refresh token", "user_id", user.ID, "error", err)
		return nil, err
	}

	accessToken, _, err := a.CreateToken(user.ID, id, config.GetATokenTime())
	if err != nil {
		slog.Error("Login: failed to create access token", "user_id", user.ID, "error", err)
		return nil, err
	}

	if err := a.StoreToken(user.ID, id); err != nil {
		slog.Error("Login: failed to store refresh token", "user_id", user.ID, "error", err)
		return nil, err
	}

	return &LoginResponse{
		UserID:       user.ID,
		Username:     user.Name,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		UserStatus:   user.Status,
	}, nil

	
}

func (a *Auth) checkToken(tokenStr string) (*Claims, int64, error) {
	claims, err := a.AuthenticateToken(tokenStr)
	if err != nil {
		return nil, 0, &InvalidCredentialsError{Reason: "invalid access token"}
	}
	userID, err := strconv.Atoi(claims.Subject)
	if err != nil {
		slog.Error("invalid user ID in token claims", "subject", claims.Subject, "error", err)
		return nil, 0, &InvalidCredentialsError{Reason: "invalid token claims"}
	}

	isWhiteListened, err := a.IsTokenWhitelisted(int64(userID), claims.ID)
	if err != nil {
		slog.Error("failed to check token whitelist", "user_id", userID, "jwt_id", claims.ID, "error", err)
		return nil, 0, err
	}
	if !isWhiteListened {
		slog.Warn("token is not whitelisted", "user_id", userID, "jwt_id", claims.ID)
		return nil, 0, &InvalidCredentialsError{Reason: "token is not valid"}
	}
	return claims, int64(userID), nil
}


func (a *Auth) Logout(accessToken string) error {
	if accessToken == "" {
		return &InvalidCredentialsError{Reason: "access token is required"}
	}

	claims, err := a.AuthenticateToken(accessToken)
	if err != nil {
		slog.Warn("Logout: invalid access token", "error", err)
		return &InvalidCredentialsError{Reason: "invalid access token"}
	}
	userID, err := strconv.Atoi(claims.Subject)
	if err != nil {
		slog.Error("Logout: invalid user ID in token claims", "subject", claims.Subject, "error", err)
		return &InvalidCredentialsError{Reason: "invalid token claims"}
	}

	isWhiteListened, err := a.IsTokenWhitelisted(int64(userID), claims.PairJTI)
	if err != nil {
		slog.Error("Logout: failed to check token whitelist", "user_id", userID, "jwt_id", claims.ID, "error", err)
		return err
	}
	if !isWhiteListened {
		slog.Warn("Logout: token is not whitelisted", "user_id", userID, "jwt_id", claims.ID)
		return &InvalidCredentialsError{Reason: "token is not valid"}
	}

	if err := a.RemoveToken(int64(userID), claims.PairJTI); err != nil {
		slog.Error("Logout: failed to delete access token", "user_id", userID, "error", err)
		return err
	}
	return nil
}

func (a *Auth) Refresh(req *RefreshRequest) (*RefreshResponse, error) {
	if req.RefreshToken == "" {
		return nil, &InvalidCredentialsError{Reason: "refresh token is required"}
	}

	claims, userID, err := a.checkToken(req.RefreshToken)
	if err != nil {
		slog.Warn("Logout: invalid access token", "error", err)
		return nil, &InvalidCredentialsError{Reason: "invalid access token"}
	}

	refreshTokenString, newId, err := a.CreateToken(userID, "", config.GetRTokenTime())
	if err != nil {
		slog.Error("Refresh: failed to create new refresh token", "user_id", userID, "error", err)
		return nil, err
	}

	accessTokenString, _, err := a.CreateToken(userID, newId, config.GetATokenTime())
	if err != nil {
		slog.Error("Refresh: failed to create new access token", "user_id", userID, "error", err)
		return nil, err
	}

	if err := a.RemoveToken(userID, claims.ID); err != nil {
		slog.Error("Refresh: failed to delete old refresh token", "user_id", userID, "error", err)
	}

	if err := a.StoreToken(userID, newId); err != nil {
		slog.Error("Refresh: failed to store new refresh token", "user_id", userID, "error", err)
		return nil, err
	}

	return &RefreshResponse{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
	}, nil
}
