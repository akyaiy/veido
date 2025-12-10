package acl

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"

	"MyServer/internal/auth"
)

// Wrapper: check ACL before executing handler
func RequirePermission(db *sql.DB, aut *auth.Auth, perm string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := aut.GetUserFromRequest(r)
		var uid int64
		if err != nil || user == nil {
			uid = 0 // guest
			fmt.Printf("guest id:%v\n", uid)
		} else {
			uid = user.ID
			fmt.Printf("user id:%v\n", uid)
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
