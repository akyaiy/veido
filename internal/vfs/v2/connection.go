package v2

import "context"

type ProviderConnection struct {
    ID       string
    ScopeID  string
    Provider string
    Name     string
    Config   []byte
    Status   string
}

type ConnectionResolverContract interface {
    ResolveConnection(ctx context.Context, scope Scope, provider string, name string) (ProviderConnection, error)
}

type ConnectionResolver struct {
	// there will be database file
}

func (cr *ConnectionResolver) ResolveConnection(ctx context.Context, scope Scope, provider string, name string) (ProviderConnection, error) {
	panic("not implemented!")
}