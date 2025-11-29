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
	"time"

	"MyServer/api/handlers/HTML"
	"MyServer/api/handlers/users"
	"MyServer/internal/auth"
)

func ServerStart(db *sql.DB, aut *auth.Auth) {

	// Загрузка статических файлов
	fs := http.FileServer(http.Dir("./data/HTML/frontend"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	// Загрузка файла шаблона страницы для всех не-API маршрутов
	http.HandleFunc("/", LoadTemplatePage)

	http.HandleFunc("/api/users/", users.User(db, aut)) //.Methods("POST")

	// http.HandleFunc("/api/users/register", users.RegisterHandler(db, aut))                  //.Methods("POST")
	// http.HandleFunc("/api/users/login", users.LoginHandler(db, aut))                        //.Methods("POST")
	// http.HandleFunc("/api/users/refresh", users.RefreshHandler(db, aut))                    //.Methods("POST")
	// http.HandleFunc("/api/users/logout", users.LogoutHandler(db, aut))                      //.Methods("POST")
	// http.HandleFunc("/api/users/getUserData", users.GetUserDataHandler(db, aut))            //.Methods("GET")
	// http.HandleFunc("/api/users/getUserNames", users.GetUsersHandler(db, aut))              //.Methods("GET")
	// http.HandleFunc("/api/users/update_password", users.UpdateUserPasswordHandler(db, aut)) //.Methods("GET")
	// http.HandleFunc("/api/users/delete_user", users.DeleteUserHandler(db, aut))             //.Methods("GET")

	http.HandleFunc("/api/protected", HTML.LoadProtected(aut)) //.Methods("GET")

	srv := &http.Server{
		//Handler:      r,
		Addr:         ":8080",
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	log.Println("Server started at http://localhost:8080")
	log.Fatal(srv.ListenAndServe())
}

func LoadTemplatePage(w http.ResponseWriter, r *http.Request) {

	// Читаем тело запроса
	body, err := io.ReadAll(r.Body)
	if err != nil {
		fmt.Println("Ошибка чтения тела запроса:", err)
	} else {
	}

	// ВОССТАНОВЛЯЕМ тело, чтобы ServeFile и другие части кода
	// могли прочитать его снова (если потребуется)
	r.Body = io.NopCloser(bytes.NewBuffer(body))

	filePath := "./data/HTML/frontend" + r.URL.Path

	// Если путь — директория или .html или без расширения, отдаём index.html
	if strings.HasSuffix(r.URL.Path, "/") ||
		strings.HasSuffix(r.URL.Path, ".html") ||
		path.Ext(r.URL.Path) == "" {

		fmt.Printf("Клиент запросил страницу по адресу:'%s'\n", r.URL.Path)
		filePath = "./data/HTML/frontend/index.html"
		fmt.Printf("Отдаём файл шаблона по адресу:'%s'\n", filePath)
	}

	http.ServeFile(w, r, filePath)
}
