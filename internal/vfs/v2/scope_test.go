package v2

import (
	"MyServer/internal/common"
	"context"
	"database/sql"
	"errors"
	"os"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func newScopeResolverTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Fatalf("db.Close() error = %v", err)
		}
	})

	fixture, err := os.ReadFile("testdata/scope_resolver.sql")
	if err != nil {
		t.Fatalf("os.ReadFile(testdata/scope_resolver.sql) error = %v", err)
	}

	if _, err := db.Exec(string(fixture)); err != nil {
		t.Fatalf("db.Exec(fixture) error = %v", err)
	}

	return db
}

func newTestScopeResolver(t *testing.T) *ScopeResolver {
	t.Helper()

	return &ScopeResolver{db: newScopeResolverTestDB(t)}
}

func TestNewScopeResolver_NilDB(t *testing.T) {
	got, err := NewScopeResolver(nil)
	if !errors.Is(err, ErrInvalidNewInstanceParams) {
		t.Fatalf("NewScopeResolver(nil) error = %v, want %v", err, ErrInvalidNewInstanceParams)
	}
	if got != nil {
		t.Fatalf("NewScopeResolver(nil) = %#v, want nil", got)
	}
}

func TestScopeResolver_DefaultScopeForActor(t *testing.T) {
	resolver := newTestScopeResolver(t)

	got, err := resolver.DefaultScopeForActor(context.Background(), Actor{
		Kind: ActorUser,
		ID:   "42",
	})
	if err != nil {
		t.Fatalf("DefaultScopeForActor() error = %v", err)
	}

	want := Scope{
		Key:             "alice-home",
		Kind:            "user",
		OwnerSubjectKey: common.SubjectKey("user:42"),
	}
	if *got != want {
		t.Fatalf("DefaultScopeForActor() = %+v, want %+v", got, want)
	}
}

func TestScopeResolver_DefaultScopeForActor_NotFound(t *testing.T) {
	resolver := newTestScopeResolver(t)

	_, err := resolver.DefaultScopeForActor(context.Background(), Actor{
		Kind: ActorUser,
		ID:   "404",
	})
	if !errors.Is(err, ErrScopeResolutionFailed) {
		t.Fatalf("DefaultScopeForActor() error = %v, want %v", err, ErrScopeResolutionFailed)
	}
}

func TestScopeResolver_DefaultScopeForActor_InvalidActor(t *testing.T) {
	resolver := newTestScopeResolver(t)

	_, err := resolver.DefaultScopeForActor(context.Background(), Actor{
		Kind: ActorGuest,
		ID:   "guest",
	})
	if !errors.Is(err, ErrScopeResolutionFailed) {
		t.Fatalf("DefaultScopeForActor() error = %v, want %v", err, ErrScopeResolutionFailed)
	}
}

func TestScopeResolver_ResolveExplicitScope(t *testing.T) {
	resolver := newTestScopeResolver(t)

	got, err := resolver.ResolveExplicitScope(context.Background(), Actor{
		Kind: ActorUser,
		ID:   "42",
	}, "shared-docs")
	if err != nil {
		t.Fatalf("ResolveExplicitScope() error = %v", err)
	}

	want := Scope{
		Key:             "shared-docs",
		Kind:            "shared",
		OwnerSubjectKey: common.SubjectKey("user:42"),
	}
	if *got != want {
		t.Fatalf("ResolveExplicitScope() = %+v, want %+v", got, want)
	}
}

func TestScopeResolver_ResolveScope(t *testing.T) {
	resolver := newTestScopeResolver(t)

	tests := []struct {
		name string
		uri  common.CanonURI
		want Scope
	}{
		{
			name: "uses default scope when uri scope is empty",
			uri:  "filesystem@main[]:///documents/test.txt",
			want: Scope{
				Key:             "alice-home",
				Kind:            "user",
				OwnerSubjectKey: common.SubjectKey("user:42"),
			},
		},
		{
			name: "uses explicit scope from uri",
			uri:  "filesystem@main[shared-docs]:///documents/test.txt",
			want: Scope{
				Key:             "shared-docs",
				Kind:            "shared",
				OwnerSubjectKey: common.SubjectKey("user:42"),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := resolver.ResolveScope(context.Background(), Actor{
				Kind: ActorUser,
				ID:   "42",
			}, tt.uri.ScopeKey())
			if err != nil {
				t.Fatalf("ResolveScope() error = %v", err)
			}
			if *got != tt.want {
				t.Fatalf("ResolveScope() = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestScopeResolver_ResolveScope_UnknownScopeKey(t *testing.T) {
	resolver := newTestScopeResolver(t)

	_, err := resolver.ResolveScope(context.Background(), Actor{
		Kind: ActorUser,
		ID:   "42",
	}, "missing-scope")
	if !errors.Is(err, ErrScopeResolutionFailed) {
		t.Fatalf("ResolveScope() error = %v, want %v", err, ErrScopeResolutionFailed)
	}
}
