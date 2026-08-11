package pathmap

import (
	"errors"
	"os"
	"reflect"
	"testing"
)

func TestMap_HandleLiteral(t *testing.T) {
	got, err := Map[string]("/").
		Handle("/", func(Match) (string, error) {
			return "root", nil
		}).
		Handle("/scopes", func(Match) (string, error) {
			return "scopes", nil
		}).
		End()
	if err != nil {
		t.Fatalf("End() error = %v", err)
	}
	if got != "root" {
		t.Fatalf("End() = %q, want %q", got, "root")
	}
}

func TestMap_HandleParams(t *testing.T) {
	got, err := Map[string]("/scopes/alice-home").
		Handle("/scopes/{scopeName}", func(match Match) (string, error) {
			return match.Param("scopeName"), nil
		}).
		End()
	if err != nil {
		t.Fatalf("End() error = %v", err)
	}
	if got != "alice-home" {
		t.Fatalf("Param(scopeName) = %q, want %q", got, "alice-home")
	}
}

func TestMap_HandleWildcard(t *testing.T) {
	got, err := Map[string]("/other/a/b/c").
		Handle("/other/*", func(match Match) (string, error) {
			return match.Wildcard(), nil
		}).
		End()
	if err != nil {
		t.Fatalf("End() error = %v", err)
	}
	if got != "a/b/c" {
		t.Fatalf("Wildcard() = %q, want %q", got, "a/b/c")
	}
}

func TestMap_EndNotExist(t *testing.T) {
	_, err := Map[string]("/missing").
		Handle("/", func(Match) (string, error) {
			return "root", nil
		}).
		End()
	if !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("End() error = %v, want %v", err, os.ErrNotExist)
	}
}

func TestMap_ElseErr(t *testing.T) {
	wantErr := errors.New("fallback")
	_, err := Map[string]("/missing").
		ElseErr(wantErr)
	if !errors.Is(err, wantErr) {
		t.Fatalf("ElseErr() error = %v, want %v", err, wantErr)
	}
}

func TestMatchPath_ParamWithSuffix(t *testing.T) {
	match, ok := MatchPath(
		"/scopes/{scopeName}/connections/{providerKey}/{connectionKey}.json",
		"/scopes/alice/connections/debug/default.json",
	)
	if !ok {
		t.Fatal("MatchPath() did not match")
	}

	want := map[string]string{
		"scopeName":     "alice",
		"providerKey":   "debug",
		"connectionKey": "default",
	}
	if got := match.Params(); !reflect.DeepEqual(got, want) {
		t.Fatalf("Params() = %+v, want %+v", got, want)
	}
}

func TestMatchPath_DoesNotMatchExtraPath(t *testing.T) {
	if _, ok := MatchPath("/scopes/{scopeName}", "/scopes/alice/extra"); ok {
		t.Fatal("MatchPath() matched path with extra segment")
	}
}
