package main

import (
	//"database/sql"

	"fmt"
	"log"
	"net/http"
	"time"

	"MyServer/packages/auch"
	//	"MyServer/packages/auch"
	"MyServer/packages/timeconverter"

	//"encoding/json"

	"github.com/gorilla/mux"
	_ "github.com/mattn/go-sqlite3"
)

func main() {
	d, _ := timeconverter.Parse("15d1h3m10s6us")
	fmt.Println(d.ToDuration()) // 15m0s

	db := InitDB("./data.db")
	defer db.Close()
	var MySekret = "$2y$10$zGLpz3p/N2W.3AKLSW6EDekcBNw/..Yg/dwAwNeFCJds7u5g/itS."
	aut := auch.NewAuth(db, []byte(MySekret))

	r := mux.NewRouter()

	r.HandleFunc("/api/register", RegisterHandler(db, aut)).Methods("POST")
	r.HandleFunc("/api/login", LoginHandler(db, aut)).Methods("POST")
	r.HandleFunc("/api/refresh", RefreshHandler(db, aut)).Methods("POST")
	r.HandleFunc("/api/logout", LogoutHandler(db)).Methods("POST")
	r.HandleFunc("/api/getUserData", GetUserDataHandler(db, aut)).Methods("GET")
	r.HandleFunc("/api/getUserNames", GetUsersHandler(db, aut)).Methods("GET")
	r.HandleFunc("/api/update_password", UpdateUserPasswordHandler(db, aut))
	r.HandleFunc("/api/protected", LoadProtected(aut)).Methods("GET")
	//http.Handle("/api/delete_user", DeleteUserHandler(db))
	r.HandleFunc("/api/delete_user", DeleteUserHandler(db, aut))

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
