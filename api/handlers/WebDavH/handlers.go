package webdavh

import (
	"database/sql"
	"log"
	"net/http"

	"golang.org/x/net/webdav"
)

// func WebDAVHandler(db *sql.DB) http.Handler {
// 	fs := webdav.Dir("./storage") // твой storage

// 	return &webdav.Handler{
// 		FileSystem: fs,
// 		LockSystem: webdav.NewMemLS(),
// 	}
// }

func WebDAVHandler(db *sql.DB) http.Handler {
	fs := webdav.Dir("./storage")
	handler := &webdav.Handler{
		FileSystem: fs,
		LockSystem: webdav.NewMemLS(),
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[LOG] WebDAVHandler: Method=%s, Path=%s\n", r.Method, r.URL.Path)
		handler.ServeHTTP(w, r)
	})
}
