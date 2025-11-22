package main

import (
	//"database/sql"

	"log"
	"net/http"
	"time"

	//"encoding/json"

	"github.com/gorilla/mux"
	_ "github.com/mattn/go-sqlite3"
)

func main() {
	db := InitDB("./data.db")
	defer db.Close()

	auth := NewAuth(db, []byte("replace-with-secure-secret"))

	r := mux.NewRouter()

	r.HandleFunc("/api/register", RegisterHandler(db)).Methods("POST")
	r.HandleFunc("/api/login", LoginHandler(db, auth)).Methods("POST")
	r.HandleFunc("/api/refresh", RefreshHandler(db, auth)).Methods("POST")
	r.HandleFunc("/api/logout", LogoutHandler(db)).Methods("POST")
	r.HandleFunc("/api/getUserData", GetUserDataHandler(db)).Methods("GET")
	r.HandleFunc("/api/getUserNames", GetUsersHandler(db)).Methods("GET")
	r.HandleFunc("/api/update_password", UpdateUserPasswordHandler(db, auth))
	r.HandleFunc("/api/protected", LoadProtected(auth)).Methods("GET")
	//http.Handle("/api/delete_user", DeleteUserHandler(db))
	r.HandleFunc("/api/delete_user", DeleteUserHandler(db))

	r.PathPrefix("/").Handler(http.FileServer(http.Dir("./frontend")))

	srv := &http.Server{
		Handler:      r,
		Addr:         ":8080",
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	log.Println("Server started at http://localhost:8080")
	log.Fatal(srv.ListenAndServe())
}
