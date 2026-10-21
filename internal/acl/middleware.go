package acl

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"

	"MyServer/internal/auth"
	"MyServer/internal/config"
)

func RequirePermission(db *sql.DB, permOrFunc interface{}, next http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if config.Data.Mode == "development" {
			log.Println("RequirePermission: development mode, skipping permission check")
			next.ServeHTTP(w, r)
			return
		}

		perm, err := permissionFromRequest(permOrFunc, r)
		if err != nil {
			log.Println("RequirePermission:", err)
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
 
		var uid int64
		if v, ok := r.Context().Value(auth.CONTEXT_USER_ID_KEY).(int); ok {
			uid = int64(v)
		}
 
		ok, err := CanUserAccess(db, uid, perm)
		if err != nil {
			log.Println("ACL error:", err)
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
 
		if !ok {
			if uid == 0 {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
 
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
 
		next.ServeHTTP(w, r)
	}
}
 
func permissionFromRequest(permOrFunc interface{}, r *http.Request) (string, error) {
	switch v := permOrFunc.(type) {
	case string:
		return v, nil

	case func(*http.Request) string:
		return v(r), nil

	default:
		return "", fmt.Errorf("invalid permission type %T", permOrFunc)
	}
}

func RequirePermissionMW(db *sql.DB, _ *auth.Auth, permOrFunc interface{}) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return RequirePermission(db, permOrFunc, next)
	}
}
