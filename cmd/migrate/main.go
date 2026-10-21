package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"MyServer/internal/database/migrate"
	"MyServer/internal/database/schema"
	"MyServer/internal/serverapp"
	"MyServer/internal/sqliteDB"
	htmlprovider "MyServer/internal/vfs/v2/providers/html"
	localprovider "MyServer/internal/vfs/v2/providers/local"
	usersprovider "MyServer/internal/vfs/v2/providers/users"
)

func main() {
	if err := run(context.Background(), os.Args[1:]); err != nil {
		log.Printf("database migration failed: %v", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("migrate", flag.ContinueOnError)
	dbPath := flags.String("db", "", "SQLite database path (defaults to DB_PATH from server configuration)")
	busyTimeout := flags.Duration("busy-timeout", sqliteDB.DefaultBusyTimeout, "SQLite busy timeout")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if *busyTimeout <= 0 || *busyTimeout > 5*time.Minute {
		return fmt.Errorf("busy-timeout must be between 0 and 5m")
	}
	if *dbPath == "" {
		cfg, err := serverapp.LoadConfig()
		if err != nil {
			return fmt.Errorf("load server configuration: %w", err)
		}
		*dbPath = cfg.DBPath
	}
	db, err := sqliteDB.Open(ctx, *dbPath, sqliteDB.Options{BusyTimeout: *busyTimeout})
	if err != nil {
		return err
	}
	defer db.Close()
	if err := schema.Migrate(ctx, db, localprovider.MigrationGroup(), htmlprovider.MigrationGroup(), usersprovider.MigrationGroup()); err != nil {
		return err
	}
	applied, err := migrate.AppliedMigrations(ctx, db)
	if err != nil {
		return err
	}
	log.Printf("database is ready: %s (%d applied migrations)", *dbPath, len(applied))
	return nil
}
