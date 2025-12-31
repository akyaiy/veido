package acl

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"

	"MyServer/internal/auth"
)

func RequirePermission(db *sql.DB, aut *auth.Auth, permOrFunc interface{}, next http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		// Разрешаем все стандартные и WebDAV методы
		switch r.Method {
		case "OPTIONS", "GET", "HEAD", "POST", "PUT", "DELETE",
			"PROPFIND", "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK":
			// разрешаем продолжить
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		var perm string
		switch v := permOrFunc.(type) {
		case string:
			perm = v
			if strings.HasSuffix(perm, ".*") {
				base := strings.TrimSuffix(perm, ".*")
				path := strings.TrimPrefix(r.URL.Path, "/api/HTML/")
				path = strings.ReplaceAll(path, "/", ".")
				perm = base + "." + path
			}
		case func(*http.Request) string:
			perm = v(r)
		default:
			log.Println("RequirePermission: invalid perm type")
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
		fmt.Printf("permission: %v\n", perm)
		_, err := db.Exec(`INSERT OR IGNORE INTO permissions(key) VALUES(?)`, perm)
		if err != nil {
			log.Println("RequirePermission: cannot insert permission:", err)
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}

		user, err := aut.GetUserFromRequest(r)
		var uid int64
		if err != nil || user == nil {
			uid = 0
		} else {
			uid = user.ID
		}

		ok, err := CanUserAccess(db, uid, perm)
		if err != nil {
			log.Println("ACL error:", err)
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}

		if !ok {
			if uid == 0 {
				// Для WebDAV — говорим клиенту, что нужен BasicAuth
				if strings.HasPrefix(r.URL.Path, "/dav") {
					w.Header().Set("WWW-Authenticate", `Basic realm="WebDAV"`)
				}
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
			} else {
				http.Error(w, "Forbidden", http.StatusForbidden)
			}
			return
		}

		next.ServeHTTP(w, r)
	}
}

// acl/middleware.go
func RequirePermissionMW(
	db *sql.DB,
	aut *auth.Auth,
	permOrFunc interface{},
) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return RequirePermission(db, aut, permOrFunc, next)
	}
}
