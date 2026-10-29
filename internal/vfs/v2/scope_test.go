package v2

import (
	"github.com/akyaiy/veido/internal/common"
	"context"
	"database/sql"
	"errors"
	"os"
	"testing"
	"time"

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

func mustParseScopeTime(t *testing.T, value string) *time.Time {
	t.Helper()

	parsed, err := time.Parse("2006-01-02 15:04:05", value)
	if err != nil {
		t.Fatalf("time.Parse(%q) error = %v", value, err)
	}

	return &parsed
}

func assertScopeEqual(t *testing.T, got *Scope, want Scope) {
	t.Helper()

	if got == nil {
		t.Fatalf("scope = nil, want %+v", want)
	}
	if got.Key != want.Key ||
		got.Kind != want.Kind ||
		got.OwnerSubjectKey != want.OwnerSubjectKey {
		t.Fatalf("scope = %+v, want %+v", got, want)
	}
	if got.UpdatedAt == nil || want.UpdatedAt == nil {
		if got.UpdatedAt != want.UpdatedAt {
			t.Fatalf("scope UpdatedAt = %v, want %v", got.UpdatedAt, want.UpdatedAt)
		}
		return
	}
	if !got.UpdatedAt.Equal(*want.UpdatedAt) {
		t.Fatalf("scope UpdatedAt = %v, want %v", got.UpdatedAt, want.UpdatedAt)
	}
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

func TestScopeResolver_ResolveDefaultScope(t *testing.T) {
	resolver := newTestScopeResolver(t)

	got, err := resolver.ResolveDefaultScope(context.Background(), Actor{
		Kind: ActorUser,
		ID:   "42",
	})
	if err != nil {
		t.Fatalf("ResolveDefaultScope() error = %v", err)
	}

	want := Scope{
		Key:             "alice-home",
		Kind:            "user",
		OwnerSubjectKey: common.SubjectKey("user:42"),
		UpdatedAt:       mustParseScopeTime(t, "2026-01-02 03:04:05"),
	}
	assertScopeEqual(t, got, want)
}

func TestScopeResolver_ResolveDefaultScope_NotFound(t *testing.T) {
	resolver := newTestScopeResolver(t)

	_, err := resolver.ResolveDefaultScope(context.Background(), Actor{
		Kind: ActorUser,
		ID:   "404",
	})
	if !errors.Is(err, ErrScopeResolutionFailed) {
		t.Fatalf("ResolveDefaultScope() error = %v, want %v", err, ErrScopeResolutionFailed)
	}
}

func TestScopeResolver_ResolveDefaultScope_InvalidActor(t *testing.T) {
	resolver := newTestScopeResolver(t)

	_, err := resolver.ResolveDefaultScope(context.Background(), Actor{
		Kind: ActorGuest,
		ID:   "guest",
	})
	if !errors.Is(err, ErrScopeResolutionFailed) {
		t.Fatalf("ResolveDefaultScope() error = %v, want %v", err, ErrScopeResolutionFailed)
	}
}

func TestScopeResolver_ResolveExplicitScope(t *testing.T) {
	resolver := newTestScopeResolver(t)

	got, err := resolver.ResolveExplicitScope(context.Background(), "shared-docs")
	if err != nil {
		t.Fatalf("ResolveExplicitScope() error = %v", err)
	}

	want := Scope{
		Key:             "shared-docs",
		Kind:            "shared",
		OwnerSubjectKey: common.SubjectKey("user:42"),
		UpdatedAt:       mustParseScopeTime(t, "2026-01-03 04:05:06"),
	}
	assertScopeEqual(t, got, want)
}

func TestScopeResolver_ResolveExplicitSystemScopeIgnoresOwner(t *testing.T) {
	resolver := newTestScopeResolver(t)

	got, err := resolver.ResolveExplicitScope(context.Background(), "system")
	if err != nil {
		t.Fatalf("ResolveExplicitScope(system) error = %v", err)
	}

	want := Scope{
		Key:             "system",
		Kind:            "system",
		OwnerSubjectKey: common.SubjectKey("user:1"),
		UpdatedAt:       mustParseScopeTime(t, "2026-01-04 05:06:07"),
	}
	assertScopeEqual(t, got, want)
}

func TestScopeResolver_ResolveExplicitScopeIgnoresOwner(t *testing.T) {
	resolver := newTestScopeResolver(t)

	got, err := resolver.ResolveExplicitScope(context.Background(), "bob-home")
	if err != nil {
		t.Fatalf("ResolveExplicitScope(bob-home) error = %v", err)
	}

	want := Scope{
		Key:             "bob-home",
		Kind:            "user",
		OwnerSubjectKey: common.SubjectKey("user:7"),
		UpdatedAt:       mustParseScopeTime(t, "2026-01-05 06:07:08"),
	}
	assertScopeEqual(t, got, want)
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
				UpdatedAt:       mustParseScopeTime(t, "2026-01-02 03:04:05"),
			},
		},
		{
			name: "uses explicit scope from uri",
			uri:  "filesystem@main[shared-docs]:///documents/test.txt",
			want: Scope{
				Key:             "shared-docs",
				Kind:            "shared",
				OwnerSubjectKey: common.SubjectKey("user:42"),
				UpdatedAt:       mustParseScopeTime(t, "2026-01-03 04:05:06"),
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
			assertScopeEqual(t, got, tt.want)
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
