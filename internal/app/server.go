package app

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"MyServer/api/handlers/HTML"
	"MyServer/api/handlers/aclHandler"
	"MyServer/api/handlers/files"
	"MyServer/api/handlers/functions"
	"MyServer/api/handlers/users"

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
		api.Get("/HTML/*", HTML.LoadHTMLBlock(aut))
		api.Route("/functions", func(u chi.Router) { functions.RegisterRoutes(u, db, aut) })
		api.Route("/files", func(u chi.Router) { files.RegisterRoutes(u, db, aut) })
		api.Route("/acl-admin", func(a chi.Router) { aclHandler.RegisterRoutes(a, db, aut) })
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

	log.Println("Server started at http://localhost:8080")
	log.Fatal(srv.ListenAndServe())
}
