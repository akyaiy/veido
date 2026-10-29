package scopes

import (
	"github.com/akyaiy/veido/internal/common"
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"github.com/akyaiy/veido/internal/vfs/v2/storage"
	sdk "github.com/akyaiy/veido/pkg/vfs/providersdk"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"
)

var scopeUserNameRe = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)
var scopeKeyRe = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)
var connectionNamePartRe = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

type Provider struct {
	connections storage.ConnectionStorageContract
	scopes      storage.ScopeStorageContract
	vfs.FSProvider
}

type DI struct {
	Connections storage.ConnectionStorageContract
	Scopes      storage.ScopeStorageContract
}

func Factory(ctx context.Context, di DI) vfs.ProviderFactory { return Definition(di).Factory() }

func Definition(di DI) sdk.Definition[struct{}] {
	return sdk.Definition[struct{}]{
		Key:     "scopes",
		Summary: "Scopes and provider connection management",
		Open: func(ctx context.Context, connection vfs.ProviderConnection, _ struct{}) (vfs.FSProvider, error) {
			if di.Scopes == nil || di.Connections == nil {
				return nil, vfs.ErrInvalidNewInstanceParams
			}
			provider := &Provider{connections: di.Connections, scopes: di.Scopes}
			fs, err := provider.buildFS()
			if err != nil {
				return nil, err
			}
			provider.FSProvider = fs
			return provider, nil
		},
	}
}

func (p *Provider) Routes() []sdk.RouteInfo {
	return p.FSProvider.(*sdk.Provider).Routes()
}

func (p *Provider) buildFS() (*sdk.Provider, error) {
	tree := sdk.New()
	root := tree.Root()
	scopes := sdk.Collection(root, "scopes", "scopeKey", sdk.CollectionSpec[sdk.Unit, *vfs.Scope]{
		List: func(ctx context.Context, req sdk.Request, _ sdk.Unit) ([]*vfs.Scope, error) {
			actor, err := sdk.Actor(ctx)
			if err != nil {
				return nil, err
			}
			return p.scopes.List(ctx, common.SubjectKey(actor.String()))
		},
		Lookup: func(ctx context.Context, req sdk.Request, _ sdk.Unit, key string) (*vfs.Scope, error) {
			scope, err := p.scopes.Get(ctx, key)
			if errors.Is(err, storage.ErrScopeNotFound) {
				return nil, fmt.Errorf("%w: %w", vfs.ErrNotFound, err)
			}
			return scope, err
		},
		Node: wrapScopeToNode,
		Create: func(ctx context.Context, req sdk.Request, _ sdk.Unit, name string) (*vfs.Node, error) {
			return p.createUserScope(ctx, name)
		},
	})
	scopes.Delete(func(ctx context.Context, req sdk.Request, scope *vfs.Scope) error {
		if scope.Kind == "system" {
			return os.ErrPermission
		}
		return p.scopes.Delete(ctx, scope.Key)
	})
	connections := sdk.Collection(scopes, "connections", "connectionName", sdk.CollectionSpec[*vfs.Scope, *vfs.ProviderConnection]{
		List: func(ctx context.Context, req sdk.Request, scope *vfs.Scope) ([]*vfs.ProviderConnection, error) {
			return p.connections.List(ctx, scope.Key, "")
		},
		Lookup: func(ctx context.Context, req sdk.Request, scope *vfs.Scope, name string) (*vfs.ProviderConnection, error) {
			provider, key, err := splitConnectionName(name)
			if err != nil {
				return nil, err
			}
			connection, err := p.connections.Get(ctx, scope.Key, provider, key)
			if errors.Is(err, storage.ErrConnectionNotFound) {
				return nil, fmt.Errorf("%w: %w", vfs.ErrNotFound, err)
			}
			return connection, err
		},
		Node: wrapConnectionToNode,
		Create: func(ctx context.Context, req sdk.Request, scope *vfs.Scope, name string) (*vfs.Node, error) {
			return p.createConnection(ctx, scope.Key, name)
		},
	})
	sdk.JSON(scopes, "info.json", func(ctx context.Context, req sdk.Request, scope *vfs.Scope) (scopeInfoPayload, error) {
		providers, err := p.connections.ListProviders(ctx, scope.Key)
		if err != nil {
			return scopeInfoPayload{}, err
		}
		keys := make([]string, 0, len(providers))
		for _, provider := range providers {
			if provider != nil {
				keys = append(keys, provider.ProviderKey)
			}
		}
		return scopeInfoPayload{ScopeKey: scope.Key, Kind: scope.Kind, OwnerSubjectKey: string(scope.OwnerSubjectKey), UpdatedAt: scope.UpdatedAt, Providers: keys}, nil
	})
	connections.Delete(func(ctx context.Context, req sdk.Request, c *vfs.ProviderConnection) error {
		return p.connections.Delete(ctx, c.ScopeKey, c.ProviderKey, c.ConnectionKey)
	})
	connections.Move(func(ctx context.Context, req sdk.Request, c *vfs.ProviderConnection, target, name string) error {
		if target != "/scopes/"+c.ScopeKey+"/connections" {
			return os.ErrPermission
		}
		display, err := validateConnectionDisplayName(name)
		if err != nil {
			return err
		}
		return p.connections.SetDisplayName(ctx, c.ScopeKey, c.ProviderKey, c.ConnectionKey, display)
	})
	sdk.JSON(connections, "info.json", func(ctx context.Context, req sdk.Request, c *vfs.ProviderConnection) (connectionInfoPayload, error) {
		return newConnectionInfoPayload(c), nil
	})
	sdk.Document(connections, "profile.json", sdk.DocumentSpec[*vfs.ProviderConnection, connectionProfilePayload]{
		Read: func(ctx context.Context, req sdk.Request, c *vfs.ProviderConnection) (connectionProfilePayload, error) {
			return connectionProfilePayload{DisplayName: c.DisplayName}, nil
		},
		Replace: func(ctx context.Context, req sdk.Request, c *vfs.ProviderConnection, value connectionProfilePayload) error {
			name, err := validateConnectionDisplayName(value.DisplayName)
			if err != nil {
				return err
			}
			return p.connections.SetDisplayName(ctx, c.ScopeKey, c.ProviderKey, c.ConnectionKey, name)
		},
	})
	sdk.Document(connections, "config.json", sdk.DocumentSpec[*vfs.ProviderConnection, json.RawMessage]{
		Read: func(ctx context.Context, req sdk.Request, c *vfs.ProviderConnection) (json.RawMessage, error) {
			if json.Valid(c.Config) {
				return json.RawMessage(c.Config), nil
			}
			return mustJSONString(c.Config), nil
		},
		Replace: func(ctx context.Context, req sdk.Request, c *vfs.ProviderConnection, value json.RawMessage) error {
			return p.connections.UpdateConfig(ctx, c.ScopeKey, c.ProviderKey, c.ConnectionKey, value)
		},
	})
	sdk.Document(connections, "status.json", sdk.DocumentSpec[*vfs.ProviderConnection, connectionStatusUpdatePayload]{
		Read: func(ctx context.Context, req sdk.Request, c *vfs.ProviderConnection) (connectionStatusUpdatePayload, error) {
			status, ready := c.Status, c.Ready
			return connectionStatusUpdatePayload{Status: &status, Ready: &ready}, nil
		},
		Replace: func(ctx context.Context, req sdk.Request, c *vfs.ProviderConnection, value connectionStatusUpdatePayload) error {
			// Storage keeps status and ready as separately managed fields.
			if value.Status != nil {
				status := strings.TrimSpace(*value.Status)
				if status == "" {
					return vfs.ErrConnectionInactive
				}
				if err := p.connections.SetStatus(ctx, c.ScopeKey, c.ProviderKey, c.ConnectionKey, status); err != nil {
					return err
				}
			}
			if value.Ready != nil {
				return p.connections.SetReady(ctx, c.ScopeKey, c.ProviderKey, c.ConnectionKey, *value.Ready)
			}
			return nil
		},
	})
	me := sdk.Directory(root, "me")
	sdk.Document(me, "default_scope.json", sdk.DocumentSpec[sdk.Unit, scopeInfoPayload]{
		Read: func(ctx context.Context, req sdk.Request, _ sdk.Unit) (scopeInfoPayload, error) {
			info, err := p.handleGetDefaultScope(ctx)
			if err != nil {
				return scopeInfoPayload{}, err
			}
			return *info, nil
		},
		Replace: func(ctx context.Context, req sdk.Request, _ sdk.Unit, value scopeInfoPayload) error {
			return p.setDefaultScope(ctx, value.ScopeKey)
		},
	})
	return tree.Build()
}

func connectionName(providerKey string, connectionKey string) string {
	return providerKey + "@" + connectionKey
}

func splitConnectionName(name string) (string, string, error) {
	providerKey, connectionKey, ok := strings.Cut(name, "@")
	if !ok || providerKey == "" || connectionKey == "" {
		return "", "", fmt.Errorf("%w: invalid connection name %q", vfs.ErrInvalidProvider, name)
	}
	if !connectionNamePartRe.MatchString(providerKey) || !connectionNamePartRe.MatchString(connectionKey) {
		return "", "", fmt.Errorf("%w: connection name may contain only letters, digits, '-' and '_'", vfs.ErrInvalidProvider)
	}
	return providerKey, connectionKey, nil
}

func (p *Provider) createConnection(ctx context.Context, scopeKey string, name string) (*vfs.Node, error) {
	providerKey, displayName, err := splitConnectionCreateName(name)
	if err != nil {
		return nil, err
	}
	if _, err := p.scopes.Get(ctx, scopeKey); err != nil {
		return nil, err
	}
	connectionKey, err := p.connectionKeyForDisplayName(ctx, scopeKey, providerKey, displayName)
	if err != nil {
		return nil, err
	}

	connection := vfs.ProviderConnection{
		ScopeKey:      scopeKey,
		ProviderKey:   providerKey,
		ConnectionKey: connectionKey,
		DisplayName:   displayName,
		Config:        []byte("{}"),
		Status:        "active",
		Ready:         false,
	}
	if err := p.connections.Create(ctx, connection); err != nil {
		return nil, err
	}
	created, err := p.connections.Get(ctx, scopeKey, providerKey, connectionKey)
	if err != nil {
		return nil, err
	}
	return wrapConnectionToNode(created), nil
}

func splitConnectionCreateName(name string) (string, string, error) {
	providerKey, displayName, ok := strings.Cut(name, "@")
	if !ok || providerKey == "" || displayName == "" {
		return "", "", fmt.Errorf("%w: invalid connection name %q", vfs.ErrInvalidProvider, name)
	}
	if !connectionNamePartRe.MatchString(providerKey) {
		return "", "", fmt.Errorf("%w: provider key may contain only letters, digits, '-' and '_'", vfs.ErrInvalidProvider)
	}
	displayName, err := validateConnectionDisplayName(displayName)
	if err != nil {
		return "", "", err
	}
	return providerKey, displayName, nil
}

func validateConnectionDisplayName(displayName string) (string, error) {
	displayName = strings.TrimSpace(displayName)
	if displayName == "" || displayName == "." || displayName == ".." {
		return "", fmt.Errorf("%w: invalid connection display name", vfs.ErrConnectionNotFound)
	}
	if strings.ContainsAny(displayName, "/\x00@") {
		return "", fmt.Errorf("%w: connection display name cannot contain '/', NUL or '@'", vfs.ErrConnectionNotFound)
	}
	return displayName, nil
}

func (p *Provider) connectionKeyForDisplayName(ctx context.Context, scopeKey string, providerKey string, displayName string) (string, error) {
	existing, err := p.connections.List(ctx, scopeKey, "")
	if err != nil {
		return "", err
	}
	used := make(map[string]struct{}, len(existing))
	for _, connection := range existing {
		if connection != nil {
			used[connection.ConnectionKey] = struct{}{}
		}
	}

	base := connectionKeyFromDisplayName(providerKey, displayName)
	key := base
	for i := 0; i < 16; i++ {
		if i > 0 {
			key = fmt.Sprintf("%s-%d", base, i+1)
		}
		if _, ok := used[key]; !ok {
			return key, nil
		}
	}
	return "", fmt.Errorf("%w: cannot allocate connection key", vfs.ErrConnectionNotFound)
}

func connectionKeyFromDisplayName(providerKey string, displayName string) string {
	if connectionNamePartRe.MatchString(displayName) {
		return displayName
	}
	sum := sha256.Sum256([]byte(providerKey + "\x00" + displayName))
	return "conn-" + hex.EncodeToString(sum[:])[:12]
}

func (p *Provider) createUserScope(ctx context.Context, name string) (*vfs.Node, error) {
	rctx, ok := vfs.RequestContextFromContext(ctx)
	if !ok {
		return nil, vfs.ErrRequestContextNotFound
	}
	if rctx.ActorKey.Kind != vfs.ActorUser || rctx.ActorKey.ID == "" {
		return nil, os.ErrPermission
	}

	owner := common.SubjectKey(rctx.ActorKey.String())
	scopeKey, err := userScopeKey(owner, name)
	if err != nil {
		return nil, err
	}
	if err := p.scopes.Create(ctx, owner, scopeKey); err != nil {
		return nil, err
	}

	scope, err := p.scopes.Get(ctx, scopeKey)
	if err != nil {
		return nil, err
	}
	return wrapScopeToNode(scope), nil
}

func userScopeKey(actorKey common.SubjectKey, name string) (string, error) {
	if !scopeUserNameRe.MatchString(name) {
		return "", fmt.Errorf("%w: scope name may contain only letters, digits, '-' and '_'", vfs.ErrInvalidScope)
	}

	sum := sha256.Sum256([]byte(actorKey))
	return hex.EncodeToString(sum[:])[:6] + "-" + name, nil
}

func (p *Provider) deleteScope(ctx context.Context, scopeKey string) error {
	scope, err := p.scopes.Get(ctx, scopeKey)
	if err != nil {
		return err
	}
	if scope.Kind == "system" {
		return os.ErrPermission
	}
	return p.scopes.Delete(ctx, scopeKey)
}

func (p *Provider) setDefaultScope(ctx context.Context, rawKey string) error {
	scopeKey := strings.TrimSpace(rawKey)
	if scopeKey == "" {
		return fmt.Errorf("%w: empty scope_key", vfs.ErrInvalidScope)
	}
	if !scopeKeyRe.MatchString(scopeKey) {
		return fmt.Errorf("%w: scope_key may contain only letters, digits, '-' and '_'", vfs.ErrInvalidScope)
	}
	if err := p.validateScopeViaInfoJSON(ctx, scopeKey); err != nil {
		return err
	}

	rctx, ok := vfs.RequestContextFromContext(ctx)
	if !ok {
		return vfs.ErrRequestContextNotFound
	}
	principal := common.SubjectKey(rctx.ActorKey.String())
	scope, err := p.scopes.Get(ctx, scopeKey)
	if err != nil {
		return err
	}
	if scope.OwnerSubjectKey != principal {
		return os.ErrPermission
	}
	return p.scopes.SetDefault(ctx, principal, scopeKey)
}

func (p *Provider) validateScopeViaInfoJSON(ctx context.Context, scopeKey string) error {
	uri, err := sdk.SelfURI(ctx, "/scopes/"+scopeKey+"/info.json")
	if err != nil {
		return err
	}
	info, err := sdk.ReadJSON[scopeInfoPayload](ctx, uri, sdk.DefaultMaxDocumentBytes)
	if err != nil {
		if errors.Is(err, storage.ErrScopeNotFound) {
			return fmt.Errorf("%w: scope %q does not exist", vfs.ErrInvalidScope, scopeKey)
		}
		return err
	}
	if info.ScopeKey != scopeKey {
		return fmt.Errorf("%w: scope info key mismatch", vfs.ErrInvalidScope)
	}
	return nil
}

type scopeInfoPayload struct {
	ScopeKey        string     `json:"scope_key"`
	Kind            string     `json:"kind"`
	OwnerSubjectKey string     `json:"owner_subject_key"`
	UpdatedAt       *time.Time `json:"updated_at,omitempty"`
	Providers       []string   `json:"providers,omitempty"`
}

type defaultScopeUpdatePayload struct {
	ScopeKey string `json:"scope_key"`
}

type connectionStatusPayload struct {
	Status string `json:"status"`
	Ready  bool   `json:"ready"`
}

type connectionProfilePayload struct {
	DisplayName string `json:"display_name"`
}

type connectionStatusUpdatePayload struct {
	Status *string `json:"status"`
	Ready  *bool   `json:"ready"`
}

type connectionInfoPayload struct {
	ID            int64           `json:"id"`
	ScopeKey      string          `json:"scope_key"`
	ProviderKey   string          `json:"provider_key"`
	ConnectionKey string          `json:"connection_key"`
	DisplayName   string          `json:"display_name"`
	Config        json.RawMessage `json:"config"`
	Status        string          `json:"status"`
	Ready         bool            `json:"ready"`
}

func newConnectionInfoPayload(connection *vfs.ProviderConnection) connectionInfoPayload {
	config := json.RawMessage(connection.Config)
	if !json.Valid(config) {
		config = mustJSONString(connection.Config)
	}

	return connectionInfoPayload{
		ID:            connection.ID,
		ScopeKey:      connection.ScopeKey,
		ProviderKey:   connection.ProviderKey,
		ConnectionKey: connection.ConnectionKey,
		DisplayName:   connection.DisplayName,
		Config:        config,
		Status:        connection.Status,
		Ready:         connection.Ready,
	}
}

func mustJSONString(value []byte) json.RawMessage {
	quoted, err := json.Marshal(string(value))
	if err != nil {
		return json.RawMessage(`""`)
	}
	return json.RawMessage(quoted)
}
