package app

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"path"
	"strings"
	"time"

	"MyServer/api/handlers/HTML"
	"MyServer/api/handlers/users"
	"MyServer/internal/auth"
	//"github.com/gorilla/mux"
	// "SPAServer/api"
	// "SPAServer/api/users"
	// "SPAServer/internal/config"
)

func ServerStart(db *sql.DB, aut *auth.Auth) {
	// r := mux.NewRouter()

	// r.HandleFunc("/api/users/register", users.RegisterHandler(db, aut)).Methods("POST")
	// r.HandleFunc("/api/users/login", users.LoginHandler(db, aut)).Methods("POST")
	// r.HandleFunc("/api/users/refresh", users.RefreshHandler(db, aut)).Methods("POST")
	// r.HandleFunc("/api/users/refresh/logout", users.LogoutHandler(db)).Methods("POST")
	// r.HandleFunc("/api/users/getUserData", users.GetUserDataHandler(db, aut)).Methods("GET")
	// r.HandleFunc("/api/users/getUserNames", users.GetUsersHandler(db, aut)).Methods("GET")
	// r.HandleFunc("/api/users/update_password", users.UpdateUserPasswordHandler(db, aut)).Methods("GET")
	// r.HandleFunc("/api/users/delete_user", users.DeleteUserHandler(db, aut)).Methods("GET")

	// r.HandleFunc("/api/protected", HTML.LoadProtected(aut)).Methods("GET")

	// r.PathPrefix("/").Handler(http.FileServer(http.Dir("./data/HTML/frontend")))
	/***********************************************************************************************************/
	//	r := mux.NewRouter()
	// Загрузка статических файлов
	//	fs := http.FileServer(http.Dir(config.Data.StaticDir))
	// Загрузка статических файлов
	fs := http.FileServer(http.Dir("./data/HTML/frontend"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	// Загрузка файла шаблона страницы для всех не-API маршрутов
	http.HandleFunc("/", LoadTemplatePage)
	//http.HandleFunc("/", "index.html")

	http.HandleFunc("/api/users/register", users.RegisterHandler(db, aut))                  //.Methods("POST")
	http.HandleFunc("/api/users/login", users.LoginHandler(db, aut))                        //.Methods("POST")
	http.HandleFunc("/api/users/refresh", users.RefreshHandler(db, aut))                    //.Methods("POST")
	http.HandleFunc("/api/users/refresh/logout", users.LogoutHandler(db))                   //.Methods("POST")
	http.HandleFunc("/api/users/getUserData", users.GetUserDataHandler(db, aut))            //.Methods("GET")
	http.HandleFunc("/api/users/getUserNames", users.GetUsersHandler(db, aut))              //.Methods("GET")
	http.HandleFunc("/api/users/update_password", users.UpdateUserPasswordHandler(db, aut)) //.Methods("GET")
	http.HandleFunc("/api/users/delete_user", users.DeleteUserHandler(db, aut))             //.Methods("GET")

	http.HandleFunc("/api/protected", HTML.LoadProtected(aut)) //.Methods("GET")

	//r.PathPrefix("/").Handler(http.FileServer(http.Dir("./data/HTML/frontend")))

	//http.HandleFunce("/api/delete_user", DeleteUserHandler(db))

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
	//fmt.Printf("Клиент запросил файл по адресу:'%s'\n", string(config.Data.StaticDir+r.URL.Path))

	// if strings.HasSuffix(r.URL.Path, "/") || strings.HasSuffix(r.URL.Path, ".html") || path.Ext(r.URL.Path) == "" {
	// 	http.ServeFile(w, r, string(config.Data.StaticDir+"/"+config.Data.TemplateFile))
	// 	fmt.Printf("Отдаём файл шаблона по адресу:'%s'\n", string(config.Data.StaticDir+"/"+config.Data.TemplateFile))
	// 	return
	// }
	http.ServeFile(w, r, string("./data/HTML/frontend"+r.URL.Path))
	if strings.HasSuffix(r.URL.Path, "/") || strings.HasSuffix(r.URL.Path, ".html") || path.Ext(r.URL.Path) == "" {
		http.ServeFile(w, r, string("./data/HTML/frontend"+"/"+"index.html"))
		fmt.Printf("Отдаём файл шаблона по адресу:'%s'\n", string("./data/HTML/frontend"+"/"+"index.html"))
		return
	}
	http.ServeFile(w, r, string("./data/HTML/frontend"+r.URL.Path))
}
