package scopes

import (
	vfs "MyServer/internal/vfs/v2"
	"MyServer/internal/vfs/v2/storage"
	"MyServer/internal/vfs/v2/virtfs"
	"context"
	"encoding/json"
	"os"
	"time"
)

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
					virtfs.DirNode("principals"),
				}, nil
			},
		}).
		Dir("/scopes", func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
			return p.handleListScopes(ctx)
		}).
		Dir("/principals", func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
			return []*vfs.Node{}, nil
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
					virtfs.DirNode("providers"),
					virtfs.FileNode("info.json", int64(len(data))),
				}, nil
			},
		}).
		GeneratedFile("/scopes/{scopeKey}/info.json", func(ctx context.Context, req virtfs.Request) ([]byte, error) {
			return p.scopeInfoJSON(ctx, req.Match.Param("scopeKey"))
		}).
		
		Route("/scopes/{scopeKey}/providers", virtfs.Handler{
			Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
				if _, err := p.scopes.Get(ctx, req.Match.Param("scopeKey")); err != nil {
					return nil, err
				}
				return virtfs.DirNode("providers"), nil
			},
			ReadDir: func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
				return p.handleProvidersDir(ctx, req.Match.Param("scopeKey"))
			},
		}).
		
		Route("/scopes/{scopeKey}/providers/{providerKey}", virtfs.Handler{
			Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
				return p.providerNode(ctx, req.Match.Param("scopeKey"), req.Match.Param("providerKey"))
			},
			ReadDir: func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
				nodes, err := p.handleProviderDir(ctx, req.Match.Param("scopeKey"), req.Match.Param("providerKey"))
				if err != nil {
					return nil, err
				}
				data, err := p.providerInfoJSON(ctx, req.Match.Param("scopeKey"), req.Match.Param("providerKey"))
				if err != nil {
					return nil, err
				}
				return append(nodes, virtfs.FileNode("info.json", int64(len(data)))), nil
			},
		}).
		GeneratedFile("/scopes/{scopeKey}/providers/{providerKey}/info.json", func(ctx context.Context, req virtfs.Request) ([]byte, error) {
			return p.providerInfoJSON(ctx, req.Match.Param("scopeKey"), req.Match.Param("providerKey"))
		}).
		
		Route("/scopes/{scopeKey}/providers/{providerKey}/{connectionKey}", virtfs.Handler{
			Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
				connection, err := p.connections.Get(ctx, req.Match.Param("scopeKey"), req.Match.Param("providerKey"), req.Match.Param("connectionKey"))
				if err != nil {
					return nil, err
				}
				return wrapConnectionToNode(connection), nil
			},
			ReadDir: func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
				data, err := p.connectionInfoJSON(ctx, req.Match.Param("scopeKey"), req.Match.Param("providerKey"), req.Match.Param("connectionKey"))
				if err != nil {
					return nil, err
				}
				return []*vfs.Node{virtfs.FileNode("info.json", int64(len(data)))}, nil
			},
		}).
		GeneratedFile("/scopes/{scopeKey}/providers/{providerKey}/{connectionKey}/info.json", func(ctx context.Context, req virtfs.Request) ([]byte, error) {
			return p.connectionInfoJSON(ctx, req.Match.Param("scopeKey"), req.Match.Param("providerKey"), req.Match.Param("connectionKey"))
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

func (p *Provider) providerNode(ctx context.Context, scopeKey string, providerKey string) (*vfs.Node, error) {
	providers, err := p.connections.ListProviders(ctx, scopeKey)
	if err != nil {
		return nil, err
	}
	for _, provider := range providers {
		if provider != nil && provider.ProviderKey == providerKey {
			return wrapProviderToNode(provider), nil
		}
	}
	return nil, os.ErrNotExist
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

func (p *Provider) providerInfoJSON(ctx context.Context, scopeKey string, providerKey string) ([]byte, error) {
	connections, err := p.connections.List(ctx, scopeKey, providerKey)
	if err != nil {
		return nil, err
	}
	if len(connections) == 0 {
		return nil, os.ErrNotExist
	}

	payloadConnections := make([]connectionInfoPayload, 0, len(connections))
	for _, connection := range connections {
		if connection == nil {
			continue
		}
		payloadConnections = append(payloadConnections, newConnectionInfoPayload(connection))
	}

	return json.MarshalIndent(providerInfoPayload{
		ScopeKey:    scopeKey,
		ProviderKey: providerKey,
		Connections: payloadConnections,
	}, "", "  ")
}

func (p *Provider) connectionInfoJSON(ctx context.Context, scopeKey string, providerKey string, connectionKey string) ([]byte, error) {
	connection, err := p.connections.Get(ctx, scopeKey, providerKey, connectionKey)
	if err != nil {
		return nil, err
	}

	return json.MarshalIndent(newConnectionInfoPayload(connection), "", "  ")
}

type scopeInfoPayload struct {
	ScopeKey        string     `json:"scope_key"`
	Kind            string     `json:"kind"`
	OwnerSubjectKey string     `json:"owner_subject_key"`
	UpdatedAt       *time.Time `json:"updated_at,omitempty"`
	Providers       []string   `json:"providers"`
}

type providerInfoPayload struct {
	ScopeKey    string                  `json:"scope_key"`
	ProviderKey string                  `json:"provider_key"`
	Connections []connectionInfoPayload `json:"connections"`
}

type connectionInfoPayload struct {
	ScopeKey      string          `json:"scope_key"`
	ProviderKey   string          `json:"provider_key"`
	ConnectionKey string          `json:"connection_key"`
	Config        json.RawMessage `json:"config"`
	Status        string          `json:"status"`
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
	}
}

func mustJSONString(value []byte) json.RawMessage {
	quoted, err := json.Marshal(string(value))
	if err != nil {
		return json.RawMessage(`""`)
	}
	return json.RawMessage(quoted)
}
