package main

import (
	//"database/sql"

	"fmt"
	"log"
	"net/http"
	"time"

	"MyServer/api/handlers/HTML"
	"MyServer/api/handlers/users"
	"MyServer/internal/auth"
	"MyServer/internal/sqliteDB"
	"MyServer/internal/timeconverter"

	//"encoding/json"

	"github.com/gorilla/mux"
	_ "github.com/mattn/go-sqlite3"
)

func main() {
	d, _ := timeconverter.Parse("15d1h3m10s6us")
	fmt.Println(d.ToDuration()) // 15m0s

	db := sqliteDB.InitDB("./data/db/data.db")
	defer db.Close()
	var MySekret = "$2y$10$zGLpz3p/N2W.3AKLSW6EDekcBNw/..Yg/dwAwNeFCJds7u5g/itS."
	aut := auth.NewAuth(db, []byte(MySekret))

	r := mux.NewRouter()

	r.HandleFunc("/api/users/register", users.RegisterHandler(db, aut)).Methods("POST")
	r.HandleFunc("/api/users/login", users.LoginHandler(db, aut)).Methods("POST")
	r.HandleFunc("/api/users/refresh", users.RefreshHandler(db, aut)).Methods("POST")
	r.HandleFunc("/api/users/refresh/logout", users.LogoutHandler(db)).Methods("POST")
	r.HandleFunc("/api/users/getUserData", users.GetUserDataHandler(db, aut)).Methods("GET")
	r.HandleFunc("/api/users/getUserNames", users.GetUsersHandler(db, aut)).Methods("GET")
	r.HandleFunc("/api/users/update_password", users.UpdateUserPasswordHandler(db, aut))
	r.HandleFunc("/api/protected", HTML.LoadProtected(aut)).Methods("GET")
	r.HandleFunc("/api/users/delete_user", users.DeleteUserHandler(db, aut))

	r.PathPrefix("/").Handler(http.FileServer(http.Dir("./data/HTML/frontend")))

	//http.Handle("/api/delete_user", DeleteUserHandler(db))

	srv := &http.Server{
		Handler:      r,
		Addr:         ":8080",
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	log.Println("Server started at http://localhost:8080")
	log.Fatal(srv.ListenAndServe())
}
