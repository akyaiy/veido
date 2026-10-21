package app

import (
	"MyServer/internal/auth"
	authhooks "MyServer/internal/auth/vfshooks"
	vfs "MyServer/internal/vfs/v2"
	hookapi "MyServer/internal/vfs/v2/adapters/hookapi"
	httpapi "MyServer/internal/vfs/v2/adapters/httpapi"
	systemscopes "MyServer/internal/vfs/v2/providers/system/scopes"
	usersprovider "MyServer/internal/vfs/v2/providers/users"
	"MyServer/internal/vfs/v2/storage"
	"MyServer/pkg/vfs/hooks"
	sdk "MyServer/pkg/vfs/providersdk"
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
)

const usersConnectionKey = "account"

type v2Runtime struct {
	vfs   *httpapi.Handler
	hooks *hookapi.Handler
}

func newV2Runtime(db *sql.DB, authService *auth.Auth) (*v2Runtime, error) {
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
	connectionStore, err := storage.NewConnectionStorage(db)
	if err != nil {
		return nil, err
	}
	catalog := sdk.NewCatalog()
	if err := sdk.RegisterDefinition(catalog, systemscopes.Definition(systemscopes.DI{Scopes: scopeStore, Connections: connectionStore})); err != nil {
		return nil, err
	}
	if err := sdk.RegisterDefinition(catalog, usersprovider.Definition(userStore)); err != nil {
		return nil, err
	}
	pool, err := vfs.NewProviderPool(catalog)
	if err != nil {
		return nil, err
	}
	authorizer, err := vfs.NewSystemAndOwnerScopeAuthorizer(scopeResolver)
	if err != nil {
		return nil, err
	}
	frontend, err := vfs.NewVFS(scopeResolver, vfs.NewConnectionResolver(db), pool, authorizer, vfs.NewNoopResourceLifecycle())
	if err != nil {
		return nil, err
	}
	hookRegistry := hooks.NewRegistry(hooks.DefaultEngines())
	if err := authhooks.Register(hookRegistry, authService, frontend); err != nil {
		return nil, err
	}
	if err := hookRegistry.Freeze(context.Background()); err != nil {
		return nil, err
	}
	hookRuntime, err := hooks.NewRuntime(hookRegistry, frontend, hooks.NewMemoryExecutionStore())
	if err != nil {
		return nil, err
	}
	resolveActor := func(r *http.Request) (vfs.Actor, error) {
		actor, ok := vfs.ActorFromContext(r.Context())
		if !ok || actor.ID == "" {
			return vfs.Actor{}, errors.New("trusted actor is missing")
		}
		return actor, nil
	}
	vfsHandler, err := httpapi.NewHandler(frontend, resolveActor, httpapi.DefaultLimits(), slog.Default())
	if err != nil {
		return nil, err
	}
	hookHandler, err := hookapi.NewHandlerWithBridge(hookRuntime, resolveActor, 0, slog.Default(), authhooks.HTTPBridge{RefreshTTL: authService.RefreshTTL()})
	if err != nil {
		return nil, err
	}
	return &v2Runtime{vfs: vfsHandler, hooks: hookHandler}, nil
}

func (r *v2Runtime) Register(router chi.Router) {
	httpapi.RegisterRoutes(router, r.vfs)
	hookapi.RegisterRoutes(router, r.hooks)
}
