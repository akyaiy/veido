package acl

import (
	"database/sql"
	"log"
	"net/http"
	"strings"

	"MyServer/internal/auth"
)

// Wrapper: check ACL before executing handler
func RequirePermission(db *sql.DB, aut *auth.Auth, permOrFunc interface{}, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var perm string

		// Определяем тип perm: string или функция
		switch v := permOrFunc.(type) {
		case string:
			perm = v
			// Если строка оканчивается на .*, добавляем динамическую часть пути
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

		user, err := aut.GetUserFromRequest(r)
		var uid int64
		if err != nil || user == nil {
			uid = 0 // guest
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
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
			} else {
				http.Error(w, "Forbidden", http.StatusForbidden)
			}
			return
		}

		next.ServeHTTP(w, r)
	}
}
