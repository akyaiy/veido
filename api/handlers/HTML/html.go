package HTML

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	r.Get("/*", acl.RequirePermission(db, aut, "html.view.*", http.HandlerFunc(LoadHTML)))
	r.Post("/*", acl.RequirePermission(db, aut, "html.create", http.HandlerFunc(CreateContainer)))
	r.Patch("/*", acl.RequirePermission(db, aut, "html.update.*", http.HandlerFunc(UpdateContainer)))
	r.Delete("/*", acl.RequirePermission(db, aut, "html.delete.*", http.HandlerFunc(DeleteContainer)))
}
