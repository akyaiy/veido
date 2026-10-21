package main

import (
	"MyServer/internal/common"
	"MyServer/internal/database/schema"
	"MyServer/internal/sqliteDB"
	vfs "MyServer/internal/vfs/v2"
	hookapi "MyServer/internal/vfs/v2/adapters/hookapi"
	httpapi "MyServer/internal/vfs/v2/adapters/httpapi"
	sitehttp "MyServer/internal/vfs/v2/adapters/sitehttp"
	htmlprovider "MyServer/internal/vfs/v2/providers/html"
	"MyServer/internal/vfs/v2/providers/html/templatepackage"
	localprovider "MyServer/internal/vfs/v2/providers/local"
	systemscopes "MyServer/internal/vfs/v2/providers/system/scopes"
	"MyServer/internal/vfs/v2/storage"
	"MyServer/pkg/vfs/hooks"
	sdk "MyServer/pkg/vfs/providersdk"
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	_ "github.com/mattn/go-sqlite3"
)

const (
	demoScope          = "html-demo"
	demoActorID        = "html-demo"
	htmlConnectionKey  = "site"
	fixtureProvider    = "demo-content"
	fixtureConnection  = "content"
	demoContentSubject = "vfsv2-html-demo-content"
	demoContentSecret  = "vfsv2-html-demo-content-secret"
)

var demoActor = vfs.Actor{Kind: vfs.ActorUser, ID: demoActorID}

//go:embed content
var demoContent embed.FS

type allowAllAuthorizer struct{}

type demoHandler struct {
	http.Handler
	hookRuntime hooks.Runtime
}

func (allowAllAuthorizer) Can(context.Context, vfs.Actor, common.Action, common.ResourceRef) (bool, error) {
	return true, nil
}

func main() {
	addr := flag.String("addr", ":8082", "HTTP listen address")
	dbPath := flag.String("db", "./data/db/vfsv2_html_demo.sqlite3", "SQLite database path")
	contentPath := flag.String("content-store", "./data/cas/vfsv2_html_demo", "Writable demo content-addressed storage path")
	templateSource := flag.String("template-source", "./data/HTML/frontend", "Reviewed default-spa source directory")
	flag.Parse()

	db, err := sqliteDB.InitDB(*dbPath)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer db.Close()
	if err := schema.Migrate(context.Background(), db, localprovider.MigrationGroup(), htmlprovider.MigrationGroup()); err != nil {
		log.Fatalf("migrate database: %v", err)
	}
	if err := seedConnections(db); err != nil {
		log.Fatalf("seed VFS connections: %v", err)
	}
	hookRegistry := hooks.NewRegistry(hooks.DefaultEngines())
	frontend, err := newDemoVFS(db, *contentPath, hookRegistry)
	if err != nil {
		log.Fatalf("create demo VFS: %v", err)
	}
	if err := seedDemoContent(context.Background(), frontend); err != nil {
		log.Fatalf("seed writable demo content: %v", err)
	}
	if err := seedHTMLPage(context.Background(), frontend); err != nil {
		log.Fatalf("seed HTML page: %v", err)
	}
	if err := seedApplicationTemplate(context.Background(), frontend, *templateSource); err != nil {
		log.Fatalf("seed application template: %v", err)
	}
	hookRuntime, err := newDemoHookRuntime(frontend, hookRegistry)
	if err != nil {
		log.Fatalf("create demo hook runtime: %v", err)
	}

	handler, err := newDemoHandler(frontend, hookRuntime)
	if err != nil {
		log.Fatalf("create demo HTTP handler: %v", err)
	}

	slog.Info("HTML Provider demo listening", "addr", *addr, "ui", "http://"+*addr+"/", "scope", demoScope, "site_uri", htmlURI("/"), "page_uri", htmlURI("/pages/home/info.json"), "actor", demoActor.String())
	server := &http.Server{Addr: *addr, Handler: handler}
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func newDemoHandler(frontend vfs.VFSFrontend, hookRuntime hooks.Runtime) (http.Handler, error) {
	if hookRuntime == nil {
		return nil, errors.New("demo hook runtime is required")
	}
	resolveActor := func(*http.Request) (vfs.Actor, error) {
		return demoActor, nil
	}
	apiHandler, err := httpapi.NewHandler(frontend, resolveActor, httpapi.DefaultLimits(), slog.Default())
	if err != nil {
		return nil, err
	}
	hookHandler, err := hookapi.NewHandler(hookRuntime, resolveActor, 0, slog.Default())
	if err != nil {
		return nil, err
	}
	siteHandler, err := sitehttp.NewHandler(hookRuntime, resolveActor, sitehttp.Config{
		SiteURI: mustURI(htmlURI("/")), Entrypoint: "index.html",
	}, slog.Default())
	if err != nil {
		return nil, err
	}

	router := chi.NewRouter()
	router.Route("/api/v2/vfs", func(r chi.Router) {
		httpapi.RegisterRoutes(r, apiHandler)
		hookapi.RegisterRoutes(r, hookHandler)
	})
	sitehttp.RegisterRoutes(router, siteHandler)
	return &demoHandler{Handler: router, hookRuntime: hookRuntime}, nil
}

func newDemoHookRuntime(frontend vfs.VFSFrontend, registry *hooks.Registry) (hooks.Runtime, error) {
	if err := registry.Freeze(context.Background()); err != nil {
		return nil, err
	}
	return hooks.NewRuntime(registry, frontend, hooks.NewMemoryExecutionStore())
}

func newDemoVFS(db *sql.DB, contentPath string, hookRegistry *hooks.Registry) (vfs.VFSFrontend, error) {
	store, err := htmlprovider.NewSQLiteStore(db)
	if err != nil {
		return nil, err
	}
	scopeResolver, err := vfs.NewScopeResolver(db)
	if err != nil {
		return nil, err
	}
	scopeStorage, err := storage.NewScopeManager(db)
	if err != nil {
		return nil, err
	}
	connectionStorage, err := storage.NewConnectionStorage(db)
	if err != nil {
		return nil, err
	}

	catalog := sdk.NewCatalog()
	if err := sdk.RegisterModule(catalog, hookRegistry, htmlprovider.Module(store)); err != nil {
		return nil, err
	}
	if err := sdk.RegisterDefinition(catalog, systemscopes.Definition(systemscopes.DI{Connections: connectionStorage, Scopes: scopeStorage})); err != nil {
		return nil, err
	}
	accountStore, err := localprovider.NewSQLiteAccountStore(db, nil)
	if err != nil {
		return nil, err
	}
	account, err := accountStore.Authenticate(context.Background(), demoContentSubject, demoContentSecret)
	if err != nil {
		return nil, fmt.Errorf("authenticate writable demo content: %w", err)
	}
	catalog.Register(fixtureProvider, func(_ context.Context, connection vfs.ProviderConnection) (vfs.FSProvider, error) {
		return localprovider.NewAccountProvider(connection, accountStore, account, db, localprovider.NewLocalStorageDriver(contentPath)), nil
	})
	pool, err := vfs.NewProviderPool(catalog)
	if err != nil {
		return nil, err
	}
	authorizer, err := vfs.NewOwnerScopeGateAuthorizer(scopeResolver, allowAllAuthorizer{})
	if err != nil {
		return nil, err
	}
	return vfs.NewVFS(scopeResolver, vfs.NewConnectionResolver(db), pool, authorizer, vfs.NewNoopResourceLifecycle())
}

func seedConnections(db *sql.DB) error {
	statements := []struct {
		query string
		args  []any
	}{
		{`INSERT INTO vfs_scopes(scope_key, kind, owner_subject_key) VALUES (?, 'user', ?) ON CONFLICT(scope_key) DO NOTHING`, []any{demoScope, demoActor.String()}},
		{`INSERT INTO vfs_scopes(scope_key, kind, owner_subject_key) VALUES ('system', 'system', ?) ON CONFLICT(scope_key) DO NOTHING`, []any{demoActor.String()}},
		{`INSERT INTO vfs_provider_connections(scope_key, provider, connection_key, display_name, config_json, status, ready) VALUES (?, 'html', ?, 'Demo HTML site', '{}', 'active', 1) ON CONFLICT(scope_key, connection_key) DO NOTHING`, []any{demoScope, htmlConnectionKey}},
		{`INSERT INTO vfs_provider_connections(scope_key, provider, connection_key, display_name, config_json, status, ready)
		  VALUES (?, ?, ?, 'Writable demo content', '{}', 'active', 1)
		  ON CONFLICT(scope_key, connection_key) DO UPDATE SET
		    provider = excluded.provider,
		    display_name = excluded.display_name,
		    status = excluded.status,
		    ready = excluded.ready`, []any{demoScope, fixtureProvider, fixtureConnection}},
		{`INSERT INTO vfs_provider_connections(scope_key, provider, connection_key, display_name, config_json, status, ready) VALUES ('system', 'scopes', 'scopes', 'Scopes', '{}', 'active', 1) ON CONFLICT(scope_key, connection_key) DO NOTHING`, nil},
		{`INSERT INTO vfs_principal_default_scopes(principal_type, principal_id, scope_key) VALUES ('user', ?, ?) ON CONFLICT(principal_type, principal_id) DO UPDATE SET scope_key = excluded.scope_key`, []any{demoActorID, demoScope}},
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement.query, statement.args...); err != nil {
			return err
		}
	}
	store, err := localprovider.NewSQLiteAccountStore(db, nil)
	if err != nil {
		return err
	}
	if _, err := store.Authenticate(context.Background(), demoContentSubject, demoContentSecret); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrPermission) {
		return err
	}
	var connection vfs.ProviderConnection
	if err := db.QueryRow(`SELECT id, scope_key, provider, connection_key, display_name, config_json, config_version, status, ready
		FROM vfs_provider_connections WHERE scope_key = ? AND provider = ? AND connection_key = ?`, demoScope, fixtureProvider, fixtureConnection).Scan(
		&connection.ID, &connection.ScopeKey, &connection.ProviderKey, &connection.ConnectionKey, &connection.DisplayName,
		&connection.Config, &connection.ConfigVersion, &connection.Status, &connection.Ready,
	); err != nil {
		return err
	}
	_, err = store.CreateFromBootstrapCredentials(context.Background(), localprovider.BootstrapCredentialRequest{
		Connection: connection,
		Actor:      demoActor,
		SubjectKey: demoContentSubject,
		Secret:     demoContentSecret,
	})
	return err
}

func seedDemoContent(ctx context.Context, frontend vfs.VFSFrontend) error {
	for _, path := range []string{"/content", "/content/home", "/content/demo"} {
		uri := mustURI(fixtureURI(path))
		if _, err := frontend.Stat(ctx, demoActor, uri); err == nil {
			continue
		} else if !errors.Is(err, os.ErrNotExist) && !errors.Is(err, vfs.ErrNotFound) {
			return err
		}
		if _, err := frontend.Mkdir(ctx, demoActor, uri); err != nil {
			return err
		}
	}
	for _, bundle := range []string{"home", "demo"} {
		for _, name := range htmlprovider.BundleFileNames {
			uri := mustURI(fixtureURI("/content/" + bundle + "/" + name))
			exists := false
			if _, err := frontend.Stat(ctx, demoActor, uri); err == nil {
				exists = true
				if bundle == "home" {
					continue
				}
			} else if !errors.Is(err, os.ErrNotExist) && !errors.Is(err, vfs.ErrNotFound) {
				return err
			}
			data, err := fs.ReadFile(demoContent, "content/"+bundle+"/"+name)
			if err != nil {
				return err
			}
			flags := os.O_CREATE | os.O_WRONLY | os.O_EXCL
			if exists {
				flags = os.O_WRONLY | os.O_TRUNC
			}
			file, err := frontend.OpenFile(ctx, demoActor, uri, flags)
			if err != nil {
				return err
			}
			_, copyErr := io.Copy(file, strings.NewReader(string(data)))
			if err := vfs.FinishWrite(file, copyErr); err != nil {
				return err
			}
		}
	}
	return nil
}

func seedHTMLPage(ctx context.Context, frontend vfs.VFSFrontend) error {
	initialize, err := controlJSON[htmlprovider.SiteDocument](ctx, frontend, htmlURI("/"), "initialize", htmlprovider.InitializeInput{VisibleTo: []string{demoActor.String()}, Name: "Demo site", BaseURL: "https://example.test"})
	if err != nil {
		return err
	}
	_, err = controlJSON[htmlprovider.PublisherRootDocument](ctx, frontend, htmlURI("/publishers"), "register-root", htmlprovider.RegisterRootInput{VisibleTo: []string{demoActor.String()}, RootURI: fixtureURI("/content"), Purpose: "content"})
	if err != nil {
		return err
	}
	treeRevision := initialize.TreeRevision
	pages := []htmlprovider.CreatePageInput{
		{VisibleTo: []string{demoActor.String()}, Position: htmlprovider.PositionInput{Last: true}, PageKey: "home", Slug: "home", Title: "Главная", Description: "Страница, созданная демонстрационной сборкой через VFS Control", Status: "draft", BundleRootURI: fixtureURI("/content/home"), Types: []string{"page"}, SearchTags: []string{"demo", "home"}},
		{VisibleTo: []string{demoActor.String()}, Position: htmlprovider.PositionInput{Last: true}, PageKey: "demo", Slug: "demo", Title: "Интерактивная демонстрация", Description: "Живая проверка hooks, маршрутизации и physical page bundle", Status: "ready", BundleRootURI: fixtureURI("/content/demo"), Types: []string{"page", "demo"}, SearchTags: []string{"hooks", "vfs", "runtime"}},
	}
	for _, page := range pages {
		if _, err := frontend.Stat(ctx, demoActor, mustURI(htmlURI("/pages/"+page.PageKey))); err == nil {
			continue
		} else if !errors.Is(err, vfs.ErrNotFound) && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		page.ExpectedTreeRevision = treeRevision
		created, err := controlJSON[htmlprovider.MutationDocument](ctx, frontend, htmlURI("/pages"), "create", page)
		if err != nil {
			return err
		}
		treeRevision = created.TreeRevision
	}
	return nil
}

func seedApplicationTemplate(ctx context.Context, frontend vfs.VFSFrontend, sourceDir string) error {
	const version = "7"
	manifestURI := mustURI(htmlURI("/templates/default-spa/" + version + "/manifest.json"))
	if _, err := frontend.Stat(ctx, demoActor, manifestURI); err == nil {
		return nil
	} else if !errors.Is(err, vfs.ErrNotFound) && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	input, err := templatepackage.BuildDirectory(sourceDir, templatepackage.DefaultSPA(version))
	if err != nil {
		return err
	}
	_, err = controlJSON[htmlprovider.InstalledTemplateDocument](ctx, frontend, htmlURI("/templates"), "install", input)
	if vfs.IsKind(err, vfs.KindAlreadyExists) {
		return nil
	}
	return err
}

func controlJSON[T any](ctx context.Context, frontend vfs.VFSFrontend, uri, command string, input any) (T, error) {
	var out T
	payload, err := json.Marshal(input)
	if err != nil {
		return out, err
	}
	data, err := frontend.Control(ctx, demoActor, mustURI(uri), command, payload)
	if err != nil {
		return out, err
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return out, err
	}
	return out, nil
}

func htmlURI(resourcePath string) string {
	return fmt.Sprintf("html@%s[%s]:///%s", htmlConnectionKey, demoScope, strings.TrimPrefix(resourcePath, "/"))
}

func fixtureURI(resourcePath string) string {
	return fmt.Sprintf("%s@%s[%s]:///%s", fixtureProvider, fixtureConnection, demoScope, strings.TrimPrefix(resourcePath, "/"))
}

func mustURI(raw string) common.CanonURI {
	uri, err := common.CastURI(raw)
	if err != nil {
		panic(err)
	}
	return uri
}
