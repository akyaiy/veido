package webdavh

import (
	"MyServer/internal/auth"
	"MyServer/internal/dav"
	"MyServer/internal/vfs"
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

// func WebDAVHandler(db *sql.DB) http.Handler {
// 	fs := webdav.Dir("./storage")
// 	handler := &webdav.Handler{
// 		FileSystem: fs,
// 		LockSystem: webdav.NewMemLS(),
// 	}

//		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
//			log.Printf("[LOG] WebDAVHandler: Method=%s, Path=%s\n", r.Method, r.URL.Path)
//			handler.ServeHTTP(w, r)
//		})
//	}
func WebDAVHandler(db *sql.DB, aut *auth.Auth) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {

		user, err := aut.GetUserFromRequest(req)
		if err != nil {
			user = &auth.User{ID: 0, Username: "Guest"}
		}

		vfsRoot := vfs.BuildVFS(db, user)

		handler := &webdav.Handler{
			Prefix:     "/dav",
			FileSystem: &dav.VFSWebDAV{Root: vfsRoot},
			LockSystem: webdav.NewMemLS(),
			Logger: func(r *http.Request, err error) {
				if err != nil {
					log.Printf("WebDAV Error: %s %s: %v",
						r.Method, r.URL.Path, err)
				}
			},
		}

		handler.ServeHTTP(w, req)
	})
}
