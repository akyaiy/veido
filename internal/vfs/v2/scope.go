package v2

import (
	"MyServer/internal/common"
	"context"
)

type Scope struct {
	ID              string
    Kind            string
    Name            string
    OwnerSubjectKey common.SubjectKey
}

type ScopeResolverContract interface {
	ResolveScope(ctx context.Context, actor Actor, uri common.CanonURI) (Scope, error)
}

type ScopeResolver struct {
	// there will be database file
}

func (sr *ScopeResolver) ResolveScope(ctx context.Context, actor Actor, uri common.CanonURI) (Scope, error) {
	panic("not implemented!")
}