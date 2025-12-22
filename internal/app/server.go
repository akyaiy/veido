package app

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"MyServer/api/handlers/HTML"
	webdavh "MyServer/api/handlers/WebDavH"
	"MyServer/api/handlers/aclH"
	"MyServer/api/handlers/files"
	"MyServer/api/handlers/functions"
	"MyServer/api/handlers/users"

	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"MyServer/internal/config"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func ServerStart(db *sql.DB, aut *auth.Auth) {
	r := chi.NewRouter()
	// --- MIDDLEWARE ---
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(config.GetSTimeoutTime()))
	// -----------------------------
	//         STATIC FILES
	// -----------------------------
	fs := http.StripPrefix("/static/", http.FileServer(http.Dir(config.Data.StaticDir)))
	r.Handle("/static/*", fs)
	// -----------------------------
	//              API
	// -----------------------------
	r.Route("/api", func(api chi.Router) {
		api.Route("/users", func(u chi.Router) { users.RegisterRoutes(u, db, aut) })
		api.Get("/protected", HTML.LoadProtected(aut))
		api.Route("/HTML", func(u chi.Router) { HTML.RegisterRoutes(u, db, aut) })
		api.Route("/functions", func(u chi.Router) { functions.RegisterRoutes(u, db, aut) })
		api.Route("/files", func(u chi.Router) { files.RegisterRoutes(u, db, aut) })
		api.Route("/acl-admin", func(a chi.Router) { aclH.RegisterRoutes(a, db, aut) })
		//api.Route("/dav", func(a chi.Router) { webdavh.RegisterRoutes(a, db, aut) })
	})
	// -----------------------------
	//       FRONTEND (SPA)
	// -----------------------------
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

	// WebDAV: отдельный handler для /api/dav/
	webdavHandler := acl.RequirePermission(db, aut, "dav.*", webdavh.WebDAVHandler(db))
	http.Handle("/api/dav/", http.StripPrefix("/api/dav", webdavHandler))

	log.Printf("Server started at http://localhost:%s", config.Data.Port)
	log.Fatal(srv.ListenAndServe())
}

// package app

// import (
// 	"database/sql"
// 	"log"
// 	"net/http"
// 	"time"

// 	"MyServer/api/handlers/HTML"
// 	webdavh "MyServer/api/handlers/WebDavH"
// 	"MyServer/api/handlers/aclH"
// 	"MyServer/api/handlers/files"
// 	"MyServer/api/handlers/functions"
// 	"MyServer/api/handlers/users"

// 	"MyServer/internal/acl"
// 	"MyServer/internal/auth"
// 	"MyServer/internal/config"

// 	"github.com/go-chi/chi/v5"
// 	"github.com/go-chi/chi/v5/middleware"
// )

// func ServerStart(db *sql.DB, aut *auth.Auth) {
// 	// --- CHI роутер для всех API кроме /api/dav ---
// 	r := chi.NewRouter()
// 	r.Use(middleware.Logger)
// 	r.Use(middleware.Recoverer)
// 	r.Use(middleware.Timeout(config.GetSTimeoutTime()))

// 	// STATIC FILES
// 	fs := http.StripPrefix("/static/", http.FileServer(http.Dir(config.Data.StaticDir)))
// 	r.Handle("/static/*", fs)

// 	// API ROUTES
// 	r.Route("/api", func(api chi.Router) {
// 		api.Route("/users", func(u chi.Router) { users.RegisterRoutes(u, db, aut) })
// 		api.Get("/protected", HTML.LoadProtected(aut))
// 		api.Route("/HTML", func(u chi.Router) { HTML.RegisterRoutes(u, db, aut) })
// 		api.Route("/functions", func(u chi.Router) { functions.RegisterRoutes(u, db, aut) })
// 		api.Route("/files", func(u chi.Router) { files.RegisterRoutes(u, db, aut) })
// 		api.Route("/acl-admin", func(a chi.Router) { aclH.RegisterRoutes(a, db, aut) })
// 	})

// 	// FRONTEND (SPA)
// 	r.Get("/*", HTML.LoadTemplatePage)

// 	// --- WEBDAV handler ---
// 	webdavHandler := acl.RequirePermission(db, aut, "dav.*", webdavh.WebDAVHandler(db))

// 	http.Handle("/api/dav/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
// 		// убираем префикс и вызываем оригинальный handler
// 		http.StripPrefix("/api/dav", webdavHandler).ServeHTTP(w, r)
// 	}))
// 	// --- COMBINED ServeMux ---
// 	mux := http.NewServeMux()
// 	mux.Handle("/api/dav/", webdavHandler) // WebDAV
// 	mux.Handle("/", r)                     // всё остальное через chi

// 	// --- HTTP server ---
// 	srv := &http.Server{
// 		Addr:    config.Data.Port,
// 		Handler: mux,
// 		WriteTimeout: func() time.Duration {
// 			d, err := config.GetTimeField("STimeoutTime")
// 			if err != nil {
// 				log.Println("Ошибка:", err)
// 			}
// 			return d
// 		}(),
// 		ReadTimeout: func() time.Duration {
// 			d, err := config.GetTimeField("STimeoutTime")
// 			if err != nil {
// 				log.Println("Ошибка:", err)
// 			}
// 			return d
// 		}(),
// 	}

// 	log.Printf("Server started at http://localhost:%s", config.Data.Port)
// 	log.Fatal(srv.ListenAndServe())
// }
