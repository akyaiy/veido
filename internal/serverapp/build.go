package serverapp

import (
	aclv2 "MyServer/internal/acl/v2"
	"MyServer/internal/auth"
	authhooks "MyServer/internal/auth/vfshooks"
	"MyServer/internal/database/schema"
	"MyServer/internal/sqliteDB"
	vfs "MyServer/internal/vfs/v2"
	authapi "MyServer/internal/vfs/v2/adapters/authapi"
	hookapi "MyServer/internal/vfs/v2/adapters/hookapi"
	httpapi "MyServer/internal/vfs/v2/adapters/httpapi"
	sitehttp "MyServer/internal/vfs/v2/adapters/sitehttp"
	aclprovider "MyServer/internal/vfs/v2/providers/acl"
	htmlprovider "MyServer/internal/vfs/v2/providers/html"
	localprovider "MyServer/internal/vfs/v2/providers/local"
	systemscopes "MyServer/internal/vfs/v2/providers/system/scopes"
	usersprovider "MyServer/internal/vfs/v2/providers/users"
	"MyServer/internal/vfs/v2/storage"
	publicvfs "MyServer/pkg/vfs"
	"MyServer/pkg/vfs/hooks"
	sdk "MyServer/pkg/vfs/providersdk"
	"context"
	"fmt"
	"log/slog"
)

const usersConnectionKey = "account"

func Build(ctx context.Context, cfg Config) (_ *Runtime, err error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	if err := cfg.EnsureDirectories(); err != nil {
		return nil, fmt.Errorf("create CAS directory: %w", err)
	}
	db, err := sqliteDB.Open(ctx, cfg.DBPath, sqliteDB.Options{})
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			_ = db.Close()
		}
	}()
	if err = schema.Migrate(ctx, db, localprovider.MigrationGroup(), htmlprovider.MigrationGroup(), usersprovider.MigrationGroup(), aclprovider.MigrationGroup()); err != nil {
		return nil, fmt.Errorf("migrate database: %w", err)
	}
	authService, err := auth.NewAuth(db, auth.Config{Secret: []byte(cfg.JWT.Secret), Issuer: cfg.JWT.Issuer, Audience: cfg.JWT.Audience, AccessTTL: cfg.JWT.AccessTTL, RefreshTTL: cfg.JWT.RefreshTTL})
	if err != nil {
		return nil, err
	}
	scopeResolver, err := vfs.NewScopeResolver(db)
	if err != nil {
		return nil, err
	}
	userStore, err := usersprovider.NewSQLiteStore(db)
	if err != nil {
		return nil, err
	}
	scopeStore, err := storage.NewScopeManager(db)
	if err != nil {
		return nil, err
	}
	connections, err := storage.NewConnectionStorage(db)
	if err != nil {
		return nil, err
	}
	localStore, err := localprovider.NewSQLiteAccountStore(db, nil)
	if err != nil {
		return nil, err
	}
	htmlStore, err := htmlprovider.NewSQLiteStore(db)
	if err != nil {
		return nil, err
	}
	catalog := sdk.NewCatalog()
	registry := hooks.NewRegistry(hooks.DefaultEngines())
	if err = sdk.RegisterDefinition(catalog, systemscopes.Definition(systemscopes.DI{Scopes: scopeStore, Connections: connections})); err != nil {
		return nil, err
	}
	if err = sdk.RegisterDefinition(catalog, usersprovider.Definition(userStore)); err != nil {
		return nil, err
	}
	if err = sdk.RegisterDefinition(catalog, localprovider.Definition(localStore)); err != nil {
		return nil, err
	}
	if err = sdk.RegisterModule(catalog, registry, htmlprovider.Module(htmlStore)); err != nil {
		return nil, err
	}
	pool, err := vfs.NewProviderPool(catalog)
	if err != nil {
		return nil, err
	}
	siteURI, err := parseSiteURI(cfg.Site.URI)
	if err != nil {
		return nil, err
	}
	aclStore, err := aclv2.NewStore(db)
	if err != nil {
		return nil, err
	}
	authorizer, err := aclv2.NewAuthorizer(aclStore, authService)
	if err != nil {
		return nil, err
	}
	lifecycle, err := aclv2.NewLifecycle(aclStore)
	if err != nil {
		return nil, err
	}
	if err = sdk.RegisterDefinition(catalog, aclprovider.Definition(aclStore, authorizer)); err != nil {
		return nil, err
	}
	frontend, err := vfs.NewVFS(scopeResolver, vfs.NewConnectionResolver(db), pool, authorizer, lifecycle)
	if err != nil {
		return nil, err
	}
	metadataProbe := vfs.NewLifecycleMetadataProbe(scopeResolver, vfs.NewConnectionResolver(db), pool)
	if err = lifecycle.Reconcile(ctx, metadataProbe.Exists); err != nil {
		return nil, fmt.Errorf("reconcile ACL lifecycle: %w", err)
	}
	if err = authhooks.Register(registry, authService, frontend); err != nil {
		return nil, err
	}
	if err = registry.Freeze(ctx); err != nil {
		return nil, err
	}
	hookRuntime, err := hooks.NewRuntime(registry, frontend, hooks.NewMemoryExecutionStore())
	if err != nil {
		return nil, err
	}
	resolveActor := actorResolver
	vfsHandler, err := httpapi.NewHandler(frontend, resolveActor, httpapi.DefaultLimits(), slog.Default())
	if err != nil {
		return nil, err
	}
	hookHandler, err := hookapi.NewHandlerWithBridge(hookRuntime, resolveActor, 0, slog.Default(), authhooks.HTTPBridge{RefreshTTL: cfg.Refresh.TTL, Secure: cfg.Refresh.Secure, CookieName: cfg.Refresh.Name, SameSite: cookieSameSite(cfg.Refresh.SameSite)})
	if err != nil {
		return nil, err
	}
	authHandler, err := authapi.NewHandler(hookRuntime, resolveActor, authhooks.HTTPBridge{RefreshTTL: cfg.Refresh.TTL, Secure: cfg.Refresh.Secure, CookieName: cfg.Refresh.Name, SameSite: cookieSameSite(cfg.Refresh.SameSite), CookiePath: "/api/v2/auth"})
	if err != nil {
		return nil, err
	}
	siteHandler, err := sitehttp.NewHandler(hookRuntime, resolveActor, sitehttp.Config{SiteURI: siteURI, Entrypoint: cfg.Site.Entrypoint, TemplateKey: cfg.Site.TemplateKey, Frontend: frontend}, slog.Default())
	if err != nil {
		return nil, err
	}
	publicSite, err := sitehttp.NewPublicHandler(frontend, resolveActor, siteURI)
	if err != nil {
		return nil, err
	}
	router := newRouter(cfg, authService, vfsHandler, hookHandler, authHandler, siteHandler, publicSite)
	var poolCloser interface{ Close() error }
	if closer, ok := pool.(interface{ Close() error }); ok {
		poolCloser = closer
	}
	return newRuntime(cfg, router, db, poolCloser), nil
}

func parseSiteURI(raw string) (publicvfs.URI, error) {
	uri, err := publicvfs.ParseURI(raw)
	if err != nil {
		return "", fmt.Errorf("SITE_URI must be a canonical VFS URI: %w", err)
	}
	return uri, nil
}
