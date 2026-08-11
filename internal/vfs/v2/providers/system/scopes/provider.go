package scopes

import (
	"MyServer/internal/common"
	vfs "MyServer/internal/vfs/v2"
	"MyServer/internal/vfs/v2/storage"
	"MyServer/internal/vfs/v2/virtfs"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	fs          *virtfs.FS
}

type DI struct {
	Connections storage.ConnectionStorageContract
	Scopes      storage.ScopeStorageContract
}

func Factory(ctx context.Context, di DI) vfs.ProviderFactory {
	return func(ctx context.Context, connection vfs.ProviderConnection) (vfs.FSProvider, error) {
		provider := &Provider{
			connections: di.Connections,
			scopes:      di.Scopes,
		}
		provider.fs = provider.buildFS()
		return provider, nil
	}
}

func (p *Provider) buildFS() *virtfs.FS {
	return virtfs.New().
		Route("/", virtfs.Handler{
			Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
				return virtfs.DirNode("/"), nil
			},
			ReadDir: func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
				return []*vfs.Node{
					virtfs.DirNode("scopes"),
					virtfs.DirNode("me"),
				}, nil
			},
		}).
		Route("/scopes", virtfs.Handler{
			Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
				return virtfs.DirNode("scopes"), nil
			},
			ReadDir: func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
				return p.handleListScopes(ctx)
			},
			Mkdir: func(ctx context.Context, req virtfs.Request, name string) (*vfs.Node, error) {
				return p.createUserScope(ctx, name)
			},
		}).
		Route("/me", virtfs.Handler{
			Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
				return virtfs.DirNode("me"), nil
			},
			ReadDir: func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
				return []*vfs.Node{
					virtfs.FileNode("default_scope.json", 0),
				}, nil
			},
		}).
		WritableGeneratedFile("/me/default_scope.json", func(ctx context.Context, req virtfs.Request) ([]byte, error) {
			return p.defScopeInfoJSON(ctx)
		}, func(ctx context.Context, req virtfs.Request, data []byte) error {
			return p.setDefaultScopeJSON(ctx, data)
		}).
		Route("/scopes/{scopeKey}", virtfs.Handler{
			Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
				scope, err := p.scopes.Get(ctx, req.Match.Param("scopeKey"))
				if err != nil {
					return nil, err
				}
				return wrapScopeToNode(scope), nil
			},
			ReadDir: func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
				data, err := p.scopeInfoJSON(ctx, req.Match.Param("scopeKey"))
				if err != nil {
					return nil, err
				}
				return []*vfs.Node{
					virtfs.DirNode("connections"),
					virtfs.FileNode("info.json", int64(len(data))),
				}, nil
			},
			Delete: func(ctx context.Context, req virtfs.Request) error {
				return p.deleteScope(ctx, req.Match.Param("scopeKey"))
			},
		}).
		GeneratedFile("/scopes/{scopeKey}/info.json", func(ctx context.Context, req virtfs.Request) ([]byte, error) {
			return p.scopeInfoJSON(ctx, req.Match.Param("scopeKey"))
		}).
		Route("/scopes/{scopeKey}/connections", virtfs.Handler{
			Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
				if _, err := p.scopes.Get(ctx, req.Match.Param("scopeKey")); err != nil {
					return nil, err
				}
				return virtfs.DirNode("connections"), nil
			},
			ReadDir: func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
				return p.handleConnectionsDir(ctx, req.Match.Param("scopeKey"))
			},
			Mkdir: func(ctx context.Context, req virtfs.Request, name string) (*vfs.Node, error) {
				return p.createConnection(ctx, req.Match.Param("scopeKey"), name)
			},
		}).
		Route("/scopes/{scopeKey}/connections/{connectionName}", virtfs.Handler{
			Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
				providerKey, connectionKey, err := splitConnectionName(req.Match.Param("connectionName"))
				if err != nil {
					return nil, err
				}
				connection, err := p.connections.Get(ctx, req.Match.Param("scopeKey"), providerKey, connectionKey)
				if err != nil {
					return nil, err
				}
				return wrapConnectionToNode(connection), nil
			},
			ReadDir: func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
				providerKey, connectionKey, err := splitConnectionName(req.Match.Param("connectionName"))
				if err != nil {
					return nil, err
				}
				data, err := p.connectionInfoJSON(ctx, req.Match.Param("scopeKey"), providerKey, connectionKey)
				if err != nil {
					return nil, err
				}
				config, err := p.connectionConfigJSON(ctx, req.Match.Param("scopeKey"), providerKey, connectionKey)
				if err != nil {
					return nil, err
				}
				status, err := p.connectionStatusJSON(ctx, req.Match.Param("scopeKey"), providerKey, connectionKey)
				if err != nil {
					return nil, err
				}
				return []*vfs.Node{
					virtfs.FileNode("info.json", int64(len(data))),
					virtfs.FileNode("config.json", int64(len(config))),
					virtfs.FileNode("status.json", int64(len(status))),
				}, nil
			},
			Delete: func(ctx context.Context, req virtfs.Request) error {
				providerKey, connectionKey, err := splitConnectionName(req.Match.Param("connectionName"))
				if err != nil {
					return err
				}
				return p.connections.Delete(ctx, req.Match.Param("scopeKey"), providerKey, connectionKey)
			},
		}).
		GeneratedFile("/scopes/{scopeKey}/connections/{connectionName}/info.json", func(ctx context.Context, req virtfs.Request) ([]byte, error) {
			providerKey, connectionKey, err := splitConnectionName(req.Match.Param("connectionName"))
			if err != nil {
				return nil, err
			}
			return p.connectionInfoJSON(ctx, req.Match.Param("scopeKey"), providerKey, connectionKey)
		}).
		WritableGeneratedFile("/scopes/{scopeKey}/connections/{connectionName}/config.json", func(ctx context.Context, req virtfs.Request) ([]byte, error) {
			providerKey, connectionKey, err := splitConnectionName(req.Match.Param("connectionName"))
			if err != nil {
				return nil, err
			}
			return p.connectionConfigJSON(ctx, req.Match.Param("scopeKey"), providerKey, connectionKey)
		}, func(ctx context.Context, req virtfs.Request, data []byte) error {
			providerKey, connectionKey, err := splitConnectionName(req.Match.Param("connectionName"))
			if err != nil {
				return err
			}
			return p.setConnectionConfigJSON(ctx, req.Match.Param("scopeKey"), providerKey, connectionKey, data)
		}).
		WritableGeneratedFile("/scopes/{scopeKey}/connections/{connectionName}/status.json", func(ctx context.Context, req virtfs.Request) ([]byte, error) {
			providerKey, connectionKey, err := splitConnectionName(req.Match.Param("connectionName"))
			if err != nil {
				return nil, err
			}
			return p.connectionStatusJSON(ctx, req.Match.Param("scopeKey"), providerKey, connectionKey)
		}, func(ctx context.Context, req virtfs.Request, data []byte) error {
			providerKey, connectionKey, err := splitConnectionName(req.Match.Param("connectionName"))
			if err != nil {
				return err
			}
			return p.setConnectionStatusJSON(ctx, req.Match.Param("scopeKey"), providerKey, connectionKey, data)
		})
}

func (p *Provider) Stat(ctx context.Context, rawPath string) (*vfs.Node, error) {
	return p.fs.Stat(ctx, rawPath)
}

func (p *Provider) ReadDir(ctx context.Context, rawPath string) ([]*vfs.Node, error) {
	return p.fs.ReadDir(ctx, rawPath)
}

func (p *Provider) OpenFile(ctx context.Context, rawPath string, flags int) (vfs.File, error) {
	return p.fs.OpenFile(ctx, rawPath, flags)
}

func (p *Provider) Mkdir(ctx context.Context, parentPath string, name string) (*vfs.Node, error) {
	return p.fs.Mkdir(ctx, parentPath, name)
}

func (p *Provider) Move(ctx context.Context, sourcePath string, targetParentPath string, newName string) error {
	return p.fs.Move(ctx, sourcePath, targetParentPath, newName)
}

func (p *Provider) Delete(ctx context.Context, path string) error {
	return p.fs.Delete(ctx, path)
}

func (p *Provider) Control(ctx context.Context, path string, command string, input []byte) ([]byte, error) {
	return p.fs.Control(ctx, path, command, input)
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
	providerKey, connectionKey, err := splitConnectionName(name)
	if err != nil {
		return nil, err
	}
	if _, err := p.scopes.Get(ctx, scopeKey); err != nil {
		return nil, err
	}

	connection := vfs.ProviderConnection{
		ScopeKey:      scopeKey,
		ProviderKey:   providerKey,
		ConnectionKey: connectionKey,
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

func (p *Provider) scopeInfoJSON(ctx context.Context, scopeKey string) ([]byte, error) {
	scope, err := p.scopes.Get(ctx, scopeKey)
	if err != nil {
		return nil, err
	}
	providers, err := p.connections.ListProviders(ctx, scopeKey)
	if err != nil {
		return nil, err
	}

	providerKeys := make([]string, 0, len(providers))
	for _, provider := range providers {
		if provider != nil {
			providerKeys = append(providerKeys, provider.ProviderKey)
		}
	}

	return json.MarshalIndent(scopeInfoPayload{
		ScopeKey:        scope.Key,
		Kind:            scope.Kind,
		OwnerSubjectKey: string(scope.OwnerSubjectKey),
		UpdatedAt:       scope.UpdatedAt,
		Providers:       providerKeys,
	}, "", "  ")
}

func (p *Provider) connectionInfoJSON(ctx context.Context, scopeKey string, providerKey string, connectionKey string) ([]byte, error) {
	connection, err := p.connections.Get(ctx, scopeKey, providerKey, connectionKey)
	if err != nil {
		return nil, err
	}

	return json.MarshalIndent(newConnectionInfoPayload(connection), "", "  ")
}

func (p *Provider) connectionConfigJSON(ctx context.Context, scopeKey string, providerKey string, connectionKey string) ([]byte, error) {
	connection, err := p.connections.Get(ctx, scopeKey, providerKey, connectionKey)
	if err != nil {
		return nil, err
	}
	config := json.RawMessage(connection.Config)
	if !json.Valid(config) {
		config = mustJSONString(connection.Config)
	}
	return json.MarshalIndent(config, "", "  ")
}

func (p *Provider) setConnectionConfigJSON(ctx context.Context, scopeKey string, providerKey string, connectionKey string, data []byte) error {
	if len(strings.TrimSpace(string(data))) == 0 {
		data = []byte("{}")
	}
	if !json.Valid(data) {
		return fmt.Errorf("%w: invalid connection config json", os.ErrInvalid)
	}
	return p.connections.UpdateConfig(ctx, scopeKey, providerKey, connectionKey, data)
}

func (p *Provider) connectionStatusJSON(ctx context.Context, scopeKey string, providerKey string, connectionKey string) ([]byte, error) {
	connection, err := p.connections.Get(ctx, scopeKey, providerKey, connectionKey)
	if err != nil {
		return nil, err
	}
	return json.MarshalIndent(connectionStatusPayload{
		Status: connection.Status,
		Ready:  connection.Ready,
	}, "", "  ")
}

func (p *Provider) setConnectionStatusJSON(ctx context.Context, scopeKey string, providerKey string, connectionKey string, data []byte) error {
	var payload connectionStatusUpdatePayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return fmt.Errorf("%w: invalid connection status json: %v", os.ErrInvalid, err)
	}
	if payload.Status != nil {
		status := strings.TrimSpace(*payload.Status)
		if status == "" {
			return fmt.Errorf("%w: empty connection status", vfs.ErrConnectionInactive)
		}
		if err := p.connections.SetStatus(ctx, scopeKey, providerKey, connectionKey, status); err != nil {
			return err
		}
	}
	if payload.Ready != nil {
		if err := p.connections.SetReady(ctx, scopeKey, providerKey, connectionKey, *payload.Ready); err != nil {
			return err
		}
	}
	return nil
}

func (p *Provider) defScopeInfoJSON(ctx context.Context) ([]byte, error) {
	defaultScope, err := p.handleGetDefaultScope(ctx)
	if err != nil {
		return nil, err
	}
	return json.MarshalIndent(defaultScope, "", "  ")
}

func (p *Provider) setDefaultScopeJSON(ctx context.Context, data []byte) error {
	var payload defaultScopeUpdatePayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return fmt.Errorf("%w: invalid default scope json: %v", os.ErrInvalid, err)
	}

	scopeKey := strings.TrimSpace(payload.ScopeKey)
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
	return p.scopes.SetDefault(ctx, principal, scopeKey)
}

func (p *Provider) validateScopeViaInfoJSON(ctx context.Context, scopeKey string) error {
	bfs, ok := vfs.BoundVFSFromContext(ctx)
	if !ok {
		return vfs.ErrRequestContextNotFound
	}

	uri, err := bfs.SelfURI("/scopes/" + scopeKey + "/info.json")
	if err != nil {
		return err
	}
	file, err := bfs.OpenFile(ctx, uri, os.O_RDONLY)
	if err != nil {
		if errors.Is(err, storage.ErrScopeNotFound) {
			return fmt.Errorf("%w: scope %q does not exist", vfs.ErrInvalidScope, scopeKey)
		}
		return err
	}
	data, readErr := io.ReadAll(file)
	closeErr := file.Close()
	if readErr != nil {
		return readErr
	}
	if closeErr != nil {
		return closeErr
	}

	var info scopeInfoPayload
	if err := json.Unmarshal(data, &info); err != nil {
		return fmt.Errorf("%w: invalid scope info json for %q: %v", os.ErrInvalid, scopeKey, err)
	}
	if info.ScopeKey != scopeKey {
		return fmt.Errorf("%w: scope info key mismatch: got %q, want %q", vfs.ErrInvalidScope, info.ScopeKey, scopeKey)
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

type connectionStatusUpdatePayload struct {
	Status *string `json:"status"`
	Ready  *bool   `json:"ready"`
}

type connectionInfoPayload struct {
	ScopeKey      string          `json:"scope_key"`
	ProviderKey   string          `json:"provider_key"`
	ConnectionKey string          `json:"connection_key"`
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
		ScopeKey:      connection.ScopeKey,
		ProviderKey:   connection.ProviderKey,
		ConnectionKey: connection.ConnectionKey,
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
