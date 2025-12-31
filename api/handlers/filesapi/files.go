package filesapi

import (
	//"MyServer/internal/acl"
	//"MyServer/internal/auth"
	//"database/sql"
	//"net/http"

	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"database/sql"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes регистрирует все маршруты /api/files/*
// -------------------- REGISTER --------------------
// func RegisterRoutes(r chi.Router) {
// 	r.HandleFunc("/*", FilesHandler)
// }

// func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
// 	r.With(
// 		acl.RequirePermissionMW(db, aut, FilesPermission),
// 	).HandleFunc("/*", FilesHandler)
// 	//r.With("/*", acl.RequirePermission(db, aut, FilesPermission, http.HandleFunc(FilesHandler)))
// 	//r.Get("/roles", acl.RequirePermission(db, aut, "acl.roles", http.HandlerFunc(h.GetRoles)))

// }

// func RegisterRoutes(
// 	r chi.Router,
// 	db *sql.DB,
// 	aut *auth.Auth,
// ) {
// 	r.With(
// 		acl.RequirePermissionMW(db, aut, FilesPermission),
// 	).HandleFunc("/", FilesHandler)

// 	r.With(
// 		acl.RequirePermissionMW(db, aut, FilesPermission),
// 	).HandleFunc("/*", FilesHandler)
// }

func RegisterRoutes(
	r chi.Router,
	db *sql.DB,
	aut *auth.Auth,
) {
	mw := acl.RequirePermissionMW(db, aut, acl.FilesPermissionFromRequestREST)

	r.With(mw).HandleFunc("/", FilesHandler)
	r.With(mw).HandleFunc("/*", FilesHandler)
}
