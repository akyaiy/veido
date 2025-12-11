package HTML

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"database/sql"

	"github.com/go-chi/chi/v5"
)

// var str = func(r *http.Request) string {
// 	newstr := strings.TrimPrefix(r.URL.Path, "/")
// 	return "html.view." + newstr
// }

func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	r.Get("/*", acl.RequirePermission(db, aut, "html.view.*", LoadHTML))
}

//func(r *http.Request) string {newstr := strings.TrimPrefix(r.URL.Path, "/") return "html.view." + newstr}
//r.Get("/*", acl.RequirePermission(db, aut, "html.view"+chi.URLParam(r, "*"), LoadHTML))
// RegisterRoutes регистрирует все маршруты /api/files/*
