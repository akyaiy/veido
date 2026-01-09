package filesapi

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"database/sql"

	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	mw := acl.RequirePermissionMW(db, aut, acl.FilesPermissionFromRequestREST) //работа HTML REST через ACL
	//r.With(mw).HandleFunc("/*", FilesHandler)                                  //работа HTML REST через ACL
	r.With(mw).HandleFunc("/*", NewFilesHandler(db, aut))
	//r.With().HandleFunc("/*", NewFilesHandler(db, aut))
}
