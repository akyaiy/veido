package main

import (
	"MyServer/internal/auth"
	"MyServer/internal/common"
	"MyServer/internal/config"
	"MyServer/internal/sqliteDB"
	vfs "MyServer/internal/vfs/v2"
	webdavadapter "MyServer/internal/vfs/v2/adapters/webdav"
	"MyServer/internal/vfs/v2/providers"
	"MyServer/internal/vfs/v2/providers/local"
	systemscopes "MyServer/internal/vfs/v2/providers/system/scopes"
	"MyServer/internal/vfs/v2/storage"
	"bytes"
	"context"
	"database/sql"
	"errors"
	"flag"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"runtime/debug"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
	gowebdav "golang.org/x/net/webdav"
)

type allowAllAuthorizer struct{}

func (allowAllAuthorizer) Can(ctx context.Context, actor vfs.Actor, action common.Action, ref common.ResourceRef) (bool, error) {
	return true, nil
}

var webdavLog = slog.New(slog.NewTextHandler(os.Stderr, nil))

func main() {
	addr := flag.String("addr", ":8081", "WebDAV listen address")
	prefix := flag.String("prefix", "/webdav", "WebDAV URL prefix")
	configPath := flag.String("config", "./data/config.yaml", "path to server config")
	dbPath := flag.String("db", "./data/db/vfs_test.sqlite3", "SQLite database path")
	actorID := flag.String("actor-id", "1", "actor user id")
	baseURI := flag.String("base-uri", "", "optional base vfsv2 canonical URI exposed over WebDAV; empty enables scope browser mode")
	scopesURI := flag.String("scopes-uri", "scopes@scopes[system]:///", "vfsv2 canonical URI for the scopes provider used by scope browser mode")
	seedDebug := flag.Bool("seed-debug", true, "seed and register debug provider connection")
	seedScopes := flag.Bool("seed-scopes", true, "seed and register system scopes provider connection")
	flag.Parse()

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))

	config.LoadData(*configPath)
	db := sqliteDB.InitDB(*dbPath)
	defer db.Close()

	authService := auth.NewAuth(db, []byte(config.Data.MySecret))
	adminUser, err := ensureAdminUser(authService)
	if err != nil {
		log.Fatalf("seed admin user: %v", err)
	}
	authActorID := fmt.Sprintf("%d", adminUser.ID)
	if *actorID == "" {
		*actorID = authActorID
	}

	if *seedDebug {
		if err := seedDebugVFS(db, authActorID); err != nil {
			log.Fatalf("seed debug vfs: %v", err)
		}
	}
	if *seedScopes {
		if err := seedScopesVFS(db, authActorID); err != nil {
			log.Fatalf("seed scopes vfs: %v", err)
		}
	}

	frontend, err := newVFS(db)
	if err != nil {
		log.Fatalf("init vfs v2: %v", err)
	}

	actor := vfs.Actor{Kind: vfs.ActorUser, ID: *actorID}
	var fs gowebdav.FileSystem
	if *baseURI == "" {
		uri, err := common.CastURI(*scopesURI)
		if err != nil {
			log.Fatalf("invalid scopes-uri: %v", err)
		}
		fs, err = webdavadapter.NewWebDAVRootAdapter(frontend, actor, uri)
		if err != nil {
			log.Fatalf("init webdav root adapter: %v", err)
		}
	} else {
		uri, err := common.CastURI(*baseURI)
		if err != nil {
			log.Fatalf("invalid base-uri: %v", err)
		}
		fs, err = webdavadapter.NewWebDAVAdapter(frontend, actor, uri)
		if err != nil {
			log.Fatalf("init webdav adapter: %v", err)
		}
	}

	handler := &gowebdav.Handler{
		Prefix:     *prefix,
		FileSystem: fs,
		LockSystem: gowebdav.NewMemLS(),
		Logger: func(r *http.Request, err error) {
			if err != nil {
				webdavLog.Error("webdav request", "method", r.Method, "path", r.URL.Path, "err", err)
				return
			}
			webdavLog.Info("webdav request", "method", r.Method, "path", r.URL.Path)
		},
	}

	mux := http.NewServeMux()
	mux.Handle(*prefix+"/", handler)
	mux.Handle(*prefix, handler)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "WebDAV endpoint is mounted at "+*prefix, http.StatusNotFound)
	})

	slog.Info("vfsv2 webdav listening", "addr", *addr, "prefix", *prefix, "base_uri", *baseURI, "scopes_uri", *scopesURI, "fallback_actor", "user:"+*actorID, "admin_actor", "user:"+authActorID)
	server := &http.Server{
		Addr:     *addr,
		Handler:  webdavProtocolLogger(webdavBasicAuth(authService, webdavStatusHint(mux))),
		ErrorLog: slog.NewLogLogger(webdavLog.Handler(), slog.LevelError),
	}
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

type responseLogWriter struct {
	http.ResponseWriter
	status int
	bytes  int
	body   strings.Builder
}

func (w *responseLogWriter) WriteHeader(status int) {
	if w.status == 0 {
		w.status = status
		w.ResponseWriter.WriteHeader(status)
	}
}

func (w *responseLogWriter) Write(p []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	if w.body.Len() < 4096 {
		remaining := 4096 - w.body.Len()
		if len(p) < remaining {
			remaining = len(p)
		}
		w.body.Write(p[:remaining])
	}
	n, err := w.ResponseWriter.Write(p)
	w.bytes += n
	return n, err
}

func webdavProtocolLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		lw := &responseLogWriter{ResponseWriter: w}

		defer func() {
			if recovered := recover(); recovered != nil {
				webdavLog.Error("webdav protocol panic",
					"method", r.Method,
					"path", r.URL.Path,
					"remote", r.RemoteAddr,
					"panic", recovered,
					"stack", string(debug.Stack()),
				)
				http.Error(lw, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			}

			status := lw.status
			if status == 0 {
				status = http.StatusOK
			}

			attrs := []any{
				"method", r.Method,
				"path", r.URL.Path,
				"query", r.URL.RawQuery,
				"remote", r.RemoteAddr,
				"status", status,
				"bytes", lw.bytes,
				"duration", time.Since(start),
				"depth", r.Header.Get("Depth"),
				"destination", r.Header.Get("Destination"),
				"overwrite", r.Header.Get("Overwrite"),
				"timeout", r.Header.Get("Timeout"),
				"lock_token", r.Header.Get("Lock-Token"),
				"if", r.Header.Get("If"),
				"content_type", r.Header.Get("Content-Type"),
			}

			if status >= 400 {
				attrs = append(attrs,
					"response_body", lw.body.String(),
					"response_content_type", lw.Header().Get("Content-Type"),
				)
				webdavLog.Error("webdav protocol response", attrs...)
				return
			}

			webdavLog.Info("webdav protocol response", attrs...)
		}()

		next.ServeHTTP(lw, r)
	})
}

type bufferedResponseWriter struct {
	header http.Header
	body   bytes.Buffer
	status int
}

func newBufferedResponseWriter() *bufferedResponseWriter {
	return &bufferedResponseWriter{header: make(http.Header)}
}

func (w *bufferedResponseWriter) Header() http.Header {
	return w.header
}

func (w *bufferedResponseWriter) WriteHeader(status int) {
	if w.status == 0 {
		w.status = status
	}
}

func (w *bufferedResponseWriter) Write(p []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.body.Write(p)
}

func (w *bufferedResponseWriter) flushTo(dst http.ResponseWriter) {
	for key, values := range w.header {
		for _, value := range values {
			dst.Header().Add(key, value)
		}
	}
	status := w.status
	if status == 0 {
		status = http.StatusOK
	}
	dst.WriteHeader(status)
	_, _ = dst.Write(w.body.Bytes())
}

func webdavStatusHint(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "MKCOL" && r.Method != "PUT" {
			next.ServeHTTP(w, r)
			return
		}

		buffered := newBufferedResponseWriter()
		statusHint := &webdavadapter.ProtocolStatusHint{}
		ctx := webdavadapter.ContextWithProtocolStatusHint(r.Context(), statusHint)
		next.ServeHTTP(buffered, r.WithContext(ctx))
		if buffered.status == http.StatusMethodNotAllowed && statusHint.Status() != 0 {
			buffered.status = statusHint.Status()
			buffered.body.Reset()
			buffered.body.WriteString(http.StatusText(statusHint.Status()))
			buffered.header.Del("Content-Length")
			buffered.header.Set("Content-Type", "text/plain; charset=utf-8")
		}
		buffered.flushTo(w)
	})
}

func webdavBasicAuth(authService *auth.Auth, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		username, _, basicPresent := r.BasicAuth()
		webdavLog.Info("webdav auth",
			"method", r.Method,
			"path", r.URL.Path,
			"auth_present", r.Header.Get("Authorization") != "",
			"basic_present", basicPresent,
			"basic_username", username,
			"expect", r.Header.Get("Expect"),
			"content_length", r.ContentLength,
		)
		user, err := authService.AuthenticateBasicRequest(r)
		if err != nil || user == nil || user.ID == 0 {
			w.Header().Set("WWW-Authenticate", `Basic realm="WebDAV"`)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		actor := vfs.Actor{
			Kind: vfs.ActorUser,
			ID:   fmt.Sprintf("%d", user.ID),
		}
		ctx := webdavadapter.ContextWithActor(r.Context(), actor)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func ensureAdminUser(authService *auth.Auth) (*auth.User, error) {
	user, err := authService.GetUserByUsername("admin")
	if err == nil {
		if _, authErr := authService.AuthenticateUser("admin", "admin"); authErr != nil {
			if updateErr := authService.UpdatePassword(user.ID, "admin"); updateErr != nil {
				return nil, updateErr
			}
			user, err = authService.GetUserByUsername("admin")
			if err != nil {
				return nil, err
			}
		}
		return user, nil
	}
	if !errors.Is(err, auth.ErrUserNotFound) {
		return nil, err
	}

	_, err = authService.CreateUser(&auth.User{
		Name:     "admin",
		Password: "admin",
		Status:   "active",
	})
	if err != nil && !errors.Is(err, auth.ErrUserExists) {
		return nil, err
	}
	return authService.GetUserByUsername("admin")
}

func newVFS(db *sql.DB) (vfs.VFSFrontend, error) {
	scopeResolver, err := vfs.NewScopeResolver(db)
	if err != nil {
		return nil, err
	}

	if err := local.InitDB(db); err != nil {
		return nil, err
	}

	registry := vfs.NewProviderRegistry()
	registry.Register("debug", providers.FactoryDebug)
	accountStore, err := local.NewSQLiteAccountStore(db, nil)
	if err != nil {
		return nil, err
	}
	registry.Register("local", local.Factory(accountStore))
	scopeStorage, err := storage.NewScopeManager(db)
	if err != nil {
		return nil, err
	}
	connectionStorage, err := storage.NewConnectionStorage(db)
	if err != nil {
		return nil, err
	}
	registry.Register("scopes", systemscopes.Factory(context.Background(), systemscopes.DI{
		Connections: connectionStorage,
		Scopes:      scopeStorage,
	}))

	pool, err := vfs.NewProviderPool(registry)
	if err != nil {
		return nil, err
	}

	return vfs.NewVFS(
		scopeResolver,
		vfs.NewConnectionResolver(db),
		pool,
		allowAllAuthorizer{},
		vfs.NewNoopResourceLifecycle(),
	)
}

func seedDebugVFS(db *sql.DB, actorID string) error {
	const scopeKey = "debug"

	_, err := db.Exec(`
		INSERT INTO vfs_scopes (scope_key, kind, owner_subject_key)
		VALUES (?, 'user', ?)
		ON CONFLICT(scope_key) DO NOTHING
	`, scopeKey, "user:"+actorID)
	if err != nil {
		return err
	}

	_, err = db.Exec(`
		INSERT INTO vfs_provider_connections (scope_key, provider, connection_key, display_name, config_json, status, ready)
		VALUES (?, 'debug', 'default', 'default', '{}', 'active', 1)
		ON CONFLICT(scope_key, connection_key) DO NOTHING
	`, scopeKey)
	if err != nil {
		return err
	}

	_, err = db.Exec(`
		INSERT INTO vfs_principal_default_scopes (principal_type, principal_id, scope_key)
		VALUES ('user', ?, ?)
		ON CONFLICT(principal_type, principal_id) DO NOTHING
	`, actorID, scopeKey)
	return err
}

func seedScopesVFS(db *sql.DB, actorID string) error {
	const scopeKey = "system"

	_, err := db.Exec(`
		INSERT INTO vfs_scopes (scope_key, kind, owner_subject_key)
		VALUES (?, 'system', ?)
		ON CONFLICT(scope_key) DO NOTHING
	`, scopeKey, "user:"+actorID)
	if err != nil {
		return err
	}

	_, err = db.Exec(`
		INSERT INTO vfs_provider_connections (scope_key, provider, connection_key, display_name, config_json, status, ready)
		VALUES (?, 'scopes', 'scopes', 'scopes', '{}', 'active', 1)
		ON CONFLICT(scope_key, connection_key) DO NOTHING
	`, scopeKey)
	if err != nil {
		return err
	}

	_, err = db.Exec(`
		INSERT INTO vfs_principal_default_scopes (principal_type, principal_id, scope_key)
		VALUES ('user', ?, ?)
		ON CONFLICT(principal_type, principal_id) DO NOTHING
	`, actorID, scopeKey)
	return err
}
