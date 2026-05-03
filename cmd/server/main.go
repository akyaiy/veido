package main

import (
	"MyServer/internal/acl"
	"MyServer/internal/app"
	"MyServer/internal/auth"
	"MyServer/internal/config"
	"MyServer/internal/sqliteDB"
	"log/slog"

	_ "github.com/mattn/go-sqlite3"
)


func main() {
	config.LoadData("./data/config.yaml")
	if config.Data.Mode == "development" {
		acl.DEVMODE = true
		slog.Info("Running in development mode: ACL checks will be bypassed")
	}
	db := sqliteDB.InitDB(config.Data.DB)
	defer db.Close()
	aut := auth.NewAuth(db, []byte(config.Data.MySecret))
	acl.InitACL(db)
	app.ServerStart(db, aut)
}
