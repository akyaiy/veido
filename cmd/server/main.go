package main

import (
	"github.com/akyaiy/veido/internal/serverapp"
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	cfg, err := serverapp.LoadConfig()
	if err != nil {
		log.Fatal(err)
	}
	runtime, err := serverapp.Build(ctx, cfg)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("Starting server %s", cfg.HTTP.Addr)
	if err := runtime.Run(ctx); err != nil {
		log.Fatal(err)
	}
}
