package main

import (
	"MyServer/internal/app"
	"MyServer/internal/auth"
	"MyServer/internal/config"
	"MyServer/internal/sqliteDB"

	_ "github.com/mattn/go-sqlite3"
)

func main() {
	config.LoadData("./data/config.yaml")
	db := sqliteDB.InitDB(config.Data.DB)
	defer db.Close()
	aut := auth.NewAuth(db, []byte(config.Data.MySekret))
	app.ServerStart(db, aut)
}
