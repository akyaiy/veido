package app

import (
	"bytes"
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"path"
	"strings"

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
	//	r.Use(middleware.Timeout(15 * time.Second))
	r.Use(middleware.Timeout(config.GetSTimeoutTime()))

	// -----------------------------
	//         STATIC FILES
	// -----------------------------
	// /static/* → ./data/HTML/frontend/*
	fs := http.StripPrefix(
		"/static/",
		//		http.FileServer(http.Dir("./data/HTML/frontend")),
		http.FileServer(http.Dir(config.Data.StaticDir)),
	)

	r.Handle("/static/*", fs)

	// -----------------------------
	//              API
	// -----------------------------
	r.Route("/api", func(api chi.Router) {
		api.Route("/users", func(u chi.Router) { users.RegisterRoutes(u, db, aut) })
		api.Get("/protected", HTML.LoadProtected(aut))
	})

	// -----------------------------
	//       FRONTEND (SPA)
	// -----------------------------
	// Фронтенд работает как SPA: любые не-API запросы → index.html
	r.Get("/*", LoadTemplatePage)

	// -----------------------------
	//       START SERVER
	// -----------------------------
	srv := &http.Server{
		Addr:    ":8080",
		Handler: r, //config.GetSTimeoutTime()
		// WriteTimeout: 15 * time.Second,
		// ReadTimeout:  15 * time.Second,
		WriteTimeout: config.GetSTimeoutTime(),
		ReadTimeout:  config.GetSTimeoutTime(),
	}

	log.Println("Server started at http://localhost:8080")
	log.Fatal(srv.ListenAndServe())
}

func LoadTemplatePage(w http.ResponseWriter, r *http.Request) {

	// читаем тело (если нужно)
	body, err := io.ReadAll(r.Body)
	if err == nil {
		r.Body = io.NopCloser(bytes.NewBuffer(body))
	}

	filePath := "./data/HTML/frontend" + r.URL.Path

	// SPA: если директория, .html или нет расширения → index.html
	if strings.HasSuffix(r.URL.Path, "/") ||
		strings.HasSuffix(r.URL.Path, ".html") ||
		path.Ext(r.URL.Path) == "" {

		fmt.Printf("Клиент запросил страницу: '%s'\n", r.URL.Path)
		filePath = "./data/HTML/frontend/index.html"
		fmt.Printf("Отдаём: '%s'\n", filePath)
	}

	http.ServeFile(w, r, filePath)
}
