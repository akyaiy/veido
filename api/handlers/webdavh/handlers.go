package webdavh

import (
	"log"
	"net/http"
	wd "golang.org/x/net/webdav"
)

func WebDAVHandler(adapter wd.FileSystem, lockSystem wd.LockSystem) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		webdavHandler := &wd.Handler{
			Prefix:     "/webdav",
			FileSystem: adapter,
			LockSystem: lockSystem,
			Logger: func(r *http.Request, err error) {
				if err != nil {
					log.Printf("WebDAV [%s] %s -> Error: %v", r.Method, r.URL.Path, err)
				} else {
					//log.Printf("WebDAV [%s] %s", r.Method, r.URL.Path)
				}
			},
		}
		webdavHandler.ServeHTTP(w, req)
	})
}
