package HTML

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"database/sql"

	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	r.Get("/*", acl.RequirePermission(db, aut, "html.view.*", LoadHTML))
}
