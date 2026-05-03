package users

import (
	"net/http"
	"time"
)

// setRefreshCookie sets HttpOnly cookie for refresh token.
// SameSite=None is used so cookie is sent with cross-site requests (fetch with credentials).
// For production over HTTPS set Secure: true.
func setRefreshCookie(w http.ResponseWriter, token string, ttl time.Duration) {
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    token,
		Path:     "/api/auth/session/refresh",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode, // ensures sent with fetch and after reload
		MaxAge:   int(ttl.Seconds()),
		Secure:   false, // set to true in prod when using HTTPS
	})
}