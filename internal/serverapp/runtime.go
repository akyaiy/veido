package serverapp

import (
	"context"
	"database/sql"
	"errors"
	"net"
	"net/http"
)

type Runtime struct {
	cfg    Config
	server *http.Server
	db     *sql.DB
	pool   interface{ Close() error }
}

func newRuntime(cfg Config, handler http.Handler, db *sql.DB, pool interface{ Close() error }) *Runtime {
	return &Runtime{cfg: cfg, db: db, pool: pool, server: &http.Server{Addr: cfg.HTTP.Addr, Handler: handler, ReadTimeout: cfg.HTTP.ReadTimeout, WriteTimeout: cfg.HTTP.WriteTimeout, IdleTimeout: cfg.HTTP.IdleTimeout}}
}
func (r *Runtime) Run(ctx context.Context) error {
	listener, err := net.Listen("tcp", r.server.Addr)
	if err != nil {
		_ = r.Close()
		return err
	}
	return r.Serve(ctx, listener)
}
func (r *Runtime) Serve(ctx context.Context, listener net.Listener) error {
	done := make(chan error, 1)
	go func() {
		err := r.server.Serve(listener)
		if errors.Is(err, http.ErrServerClosed) {
			err = nil
		}
		done <- err
	}()
	select {
	case err := <-done:
		_ = r.Close()
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), r.cfg.HTTP.ShutdownTimeout)
		defer cancel()
		err := r.server.Shutdown(shutdownCtx)
		closeErr := r.Close()
		return errors.Join(err, closeErr)
	}
}
func (r *Runtime) Close() error {
	var err error
	if r.pool != nil {
		err = errors.Join(err, r.pool.Close())
		r.pool = nil
	}
	if r.db != nil {
		err = errors.Join(err, r.db.Close())
		r.db = nil
	}
	return err
}
