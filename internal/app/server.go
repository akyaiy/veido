package app

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"MyServer/api/handlers/HTML"
	"MyServer/api/handlers/aclH"
	"MyServer/api/handlers/filesapi"
	"MyServer/api/handlers/functions"
	"MyServer/api/handlers/users"
	"MyServer/api/handlers/webdavh"

	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"MyServer/internal/config"
	"MyServer/internal/files"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func ServerStart(db *sql.DB, aut *auth.Auth) {

	files.BaseDir = "."
	// 1. Регистрация кастомных WebDAV методов в chi
	// Это позволяет роутеру распознавать эти методы в запросах
	chi.RegisterMethod("PROPFIND")
	chi.RegisterMethod("PROPPATCH")
	chi.RegisterMethod("MKCOL")
	chi.RegisterMethod("COPY")
	chi.RegisterMethod("MOVE")
	chi.RegisterMethod("LOCK")
	chi.RegisterMethod("UNLOCK")

	r := chi.NewRouter()
	// --- MIDDLEWARE ---
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(config.GetSTimeoutTime()))
	// -----------------------------
	//              API
	// -----------------------------
	// 2. Настройка WebDAV обработчика
	r.Route("/dav", func(r chi.Router) {
		r.Handle("/*", acl.RequirePermission(
			db, aut, acl.FilesPermissionFromRequestWebDav, webdavh.WebDAVHandler(db, aut)))
	})

	r.Route("/api", func(api chi.Router) {
		api.Route("/auth", func(u chi.Router) { users.RegisterRoutes(u, db, aut) })
		api.Get("/protected", HTML.LoadProtected(aut))
		api.Route("/HTML", func(u chi.Router) { HTML.RegisterRoutes(u, db, aut) })
		api.Route("/functions", func(u chi.Router) { functions.RegisterRoutes(u, db, aut) })
		api.Route("/files", func(u chi.Router) { filesapi.RegisterRoutes(u, db, aut) })
		api.Route("/acl-admin", func(u chi.Router) { aclH.RegisterRoutes(u, db, aut) })
	})
	// Отдаём статику
	fs := http.StripPrefix("/static/", http.FileServer(http.Dir(config.Data.StaticDir)))
	r.Handle("/static/*", fs)
	// Фронтенд работает как SPA: любые не-API запросы → index.html
	r.Get("/*", HTML.LoadTemplatePage)
	srv := &http.Server{
		Addr:    config.Data.Port,
		Handler: r,
		WriteTimeout: func() time.Duration {
			d, err := config.GetTimeField("STimeoutTime")
			if err != nil {
				log.Println("Ошибка:", err)
			}
			return d
		}(),
		ReadTimeout: func() time.Duration {
			d, err := config.GetTimeField("STimeoutTime")
			if err != nil {
				log.Println("Ошибка:", err)
			}
			return d
		}(),
	}

	log.Printf("Server started at http://localhost%s", config.Data.Port)
	log.Fatal(srv.ListenAndServe())
}
