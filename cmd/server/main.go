package main

import (
	//"database/sql"

	//	"net/http"
	//	"time"

	"MyServer/internal/app"
	"MyServer/internal/auth"
	"MyServer/internal/config"
	"MyServer/internal/sqliteDB"

	//"encoding/json"

	//	"github.com/gorilla/mux"
	_ "github.com/mattn/go-sqlite3"
)

func main() {
	config.LoadData("./data/config.yaml")
	//d, _ := timeconverter.Parse("15d1h3m10s6us")
	//fmt.Println(d.ToDuration()) // 15m0s

	db := sqliteDB.InitDB(config.Data.DB)
	//	db := sqliteDB.InitDB("./data/db/data.db")
	defer db.Close()

	//var MySekret = "$2y$10$zGLpz3p/N2W.3AKLSW6EDekcBNw/..Yg/dwAwNeFCJds7u5g/itS."

	aut := auth.NewAuth(db, []byte(config.Data.MySekret))
	//	aut := auth.NewAuth(db, []byte(MySekret))

	app.ServerStart(db, aut)

}
