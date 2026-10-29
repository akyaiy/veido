package HTML

import (
	"github.com/akyaiy/veido/internal/acl"
	"github.com/akyaiy/veido/internal/auth"
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, db *sql.DB, _ *auth.Auth) {
	r.Get("/*", acl.RequirePermission(db, "html.view.*", http.HandlerFunc(LoadHTML)))
	r.Post("/*", acl.RequirePermission(db, "html.create", http.HandlerFunc(CreateContainer)))
	r.Patch("/*", acl.RequirePermission(db, "html.update.*", http.HandlerFunc(UpdateContainer)))
	r.Delete("/*", acl.RequirePermission(db, "html.delete.*", http.HandlerFunc(DeleteContainer)))
}
