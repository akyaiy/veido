package main

import (
	"MyServer/internal/acl"
	"MyServer/internal/app"
	"MyServer/internal/auth"
	"MyServer/internal/config"
	"MyServer/internal/database/schema"
	"MyServer/internal/sqliteDB"
	htmlprovider "MyServer/internal/vfs/v2/providers/html"
	localprovider "MyServer/internal/vfs/v2/providers/local"
	"context"
	"log"
	"log/slog"

	_ "github.com/mattn/go-sqlite3"
)

func main() {
	config.LoadData("./data/config.yaml")
	if config.Data.Mode == "development" {
		acl.DEVMODE = true
		slog.Info("Running in development mode: ACL checks will be bypassed")
	}
	db, err := sqliteDB.InitDB(config.Data.DB)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer db.Close()
	if err := schema.Migrate(context.Background(), db, localprovider.MigrationGroup(), htmlprovider.MigrationGroup()); err != nil {
		log.Fatalf("migrate database: %v", err)
	}
	aut := auth.NewAuth(db, []byte(config.Data.MySecret))
	acl.InitACL(db)
	app.ServerStart(db, aut)
}
