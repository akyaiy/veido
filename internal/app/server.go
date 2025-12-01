package app

import (
	"database/sql"
	"log"
	"net/http"

	"MyServer/api/handlers/HTML"
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
	})

	// -----------------------------
	//       FRONTEND (SPA)
	// -----------------------------
	// Фронтенд работает как SPA: любые не-API запросы → index.html
	r.Get("/*", HTML.LoadTemplatePage)

	// -----------------------------
	//       START SERVER
	// -----------------------------
	srv := &http.Server{
		Addr:         config.Data.Port,
		Handler:      r,
		WriteTimeout: config.GetSTimeoutTime(),
		ReadTimeout:  config.GetSTimeoutTime(),
	}

	log.Println("Server started at http://localhost:8080")
	log.Fatal(srv.ListenAndServe())
}
