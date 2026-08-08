package common

import (
	"errors"
	"testing"
)

func TestIsCanonURI(t *testing.T) {
	tests := []struct {
		name string
		uri  CanonURI
		want bool
	}{
		{
			name: "valid URI",
			uri:  "filesystem@main[user]:///documents/test.txt",
			want: true,
		},
		{
			name: "valid root path",
			uri:  "filesystem@main[user]:///",
			want: true,
		},
		{
			name: "empty scope",
			uri:  "filesystem@main[]:///documents/test.txt",
			want: true,
		},
		{
			name: "empty URI",
			uri:  "",
			want: false,
		},
		{
			name: "empty canonical URI",
			uri:  EmptyURI,
			want: false,
		},
		{
			name: "missing provider",
			uri:  "@main[user]:///documents/test.txt",
			want: false,
		},
		{
			name: "missing connection",
			uri:  "filesystem@[user]:///documents/test.txt",
			want: false,
		},
		{
			name: "missing at sign",
			uri:  "filesystemmain[user]:///documents/test.txt",
			want: false,
		},
		{
			name: "missing opening bracket",
			uri:  "filesystem@mainuser]:///documents/test.txt",
			want: false,
		},
		{
			name: "missing closing bracket",
			uri:  "filesystem@main[user:///documents/test.txt",
			want: false,
		},
		{
			name: "missing scheme separator",
			uri:  "filesystem@main[user]/documents/test.txt",
			want: false,
		},
		{
			name: "characters between scope and separator",
			uri:  "filesystem@main[user]abc:///documents/test.txt",
			want: false,
		},
		{
			name: "non canonical repeated slash",
			uri:  "filesystem@main[user]:////documents/test.txt",
			want: false,
		},
		{
			name: "non canonical dot segment",
			uri:  "filesystem@main[user]:///documents/./test.txt",
			want: false,
		},
		{
			name: "non canonical parent segment",
			uri:  "filesystem@main[user]:///documents/dir/../test.txt",
			want: false,
		},
		{
			name: "relative path",
			uri:  "filesystem@main[user]://documents/test.txt",
			want: false,
		},
		{
			name: "wrong delimiter order",
			uri:  "filesystem[user]@main:///documents/test.txt",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsCanonURI(tt.uri)

			if got != tt.want {
				t.Fatalf("IsCanonURI(%q) = %v, want %v", tt.uri, got, tt.want)
			}
		})
	}
}

func TestCastURI(t *testing.T) {
	t.Run("valid URI", func(t *testing.T) {
		raw := "filesystem@main[user]:///documents/test.txt"

		got, err := CastURI(raw)
		if err != nil {
			t.Fatalf("CastURI(%q) returned error: %v", raw, err)
		}

		if got != CanonURI(raw) {
			t.Fatalf("CastURI(%q) = %q, want %q", raw, got, CanonURI(raw))
		}
	})

	t.Run("invalid URI", func(t *testing.T) {
		raw := "not a URI"

		got, err := CastURI(raw)

		if !errors.Is(err, ErrNotURI) {
			t.Fatalf("CastURI(%q) error = %v, want %v", raw, err, ErrNotURI)
		}

		if got != EmptyURI {
			t.Fatalf("CastURI(%q) = %q, want EmptyURI %q", raw, got, EmptyURI)
		}
	})
}

func TestCanonURIHelpers(t *testing.T) {
	tests := []struct {
		name           string
		uri            CanonURI
		wantProvider   string
		wantConnection string
		wantScope      string
		wantHasScope   bool
		wantPath       string
	}{
		{
			name:           "full resource reference",
			uri:            "filesystem@main[user]:///documents/test.txt",
			wantProvider:   "filesystem",
			wantConnection: "main",
			wantScope:      "user",
			wantHasScope:   true,
			wantPath:       "/documents/test.txt",
		},
		{
			name:           "empty scope",
			uri:            "filesystem@main[]:///documents/test.txt",
			wantProvider:   "filesystem",
			wantConnection: "main",
			wantScope:      "",
			wantHasScope:   false,
			wantPath:       "/documents/test.txt",
		},
		{
			name:           "invalid URI",
			uri:            "not a URI",
			wantProvider:   "",
			wantConnection: "",
			wantScope:      "",
			wantHasScope:   false,
			wantPath:       "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.uri.Provider(); got != tt.wantProvider {
				t.Fatalf("Provider() = %q, want %q", got, tt.wantProvider)
			}

			if got := tt.uri.HasProvider(); got != (tt.wantProvider != "") {
				t.Fatalf("HasProvider() = %v, want %v", got, tt.wantProvider != "")
			}

			if got := tt.uri.ConnectionKey(); got != tt.wantConnection {
				t.Fatalf("ConnectionKey() = %q, want %q", got, tt.wantConnection)
			}

			if got := tt.uri.HasConnection(); got != (tt.wantConnection != "") {
				t.Fatalf("HasConnection() = %v, want %v", got, tt.wantConnection != "")
			}

			if got := tt.uri.ScopeKey(); got != tt.wantScope {
				t.Fatalf("ScopeKey() = %q, want %q", got, tt.wantScope)
			}

			if got := tt.uri.HasScope(); got != tt.wantHasScope {
				t.Fatalf("HasScope() = %v, want %v", got, tt.wantHasScope)
			}

			if got := tt.uri.Path(); got != tt.wantPath {
				t.Fatalf("Path() = %q, want %q", got, tt.wantPath)
			}
		})
	}
}

func TestParseResourceAddress(t *testing.T) {
	tests := []struct {
		name string
		uri  CanonURI
		want ResourceAddress
	}{
		{
			name: "full resource reference",
			uri:  "filesystem@main[user]:///documents/test.txt",
			want: ResourceAddress{
				ProviderKey:   "filesystem",
				ConnectionKey: "main",
				ScopeKey:      "user",
				Path:          "/documents/test.txt",
			},
		},
		{
			name: "root path",
			uri:  "filesystem@main[user]:///",
			want: ResourceAddress{
				ProviderKey:   "filesystem",
				ConnectionKey: "main",
				ScopeKey:      "user",
				Path:          "/",
			},
		},
		{
			name: "empty scope",
			uri:  "filesystem@main[]:///documents/test.txt",
			want: ResourceAddress{
				ProviderKey:   "filesystem",
				ConnectionKey: "main",
				ScopeKey:      "",
				Path:          "/documents/test.txt",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotContract := ParseResourceAddress(tt.uri)
			if gotContract == nil {
				t.Fatalf("ParseResourceAddress(%q) returned nil", tt.uri)
			}

			got, ok := gotContract.(ResourceAddress)
			if !ok {
				t.Fatalf(
					"ParseResourceAddress(%q) returned %T, want ResourceAddress",
					tt.uri,
					gotContract,
				)
			}

			if got != tt.want {
				t.Errorf("ParseResourceAddress(%q) mismatch", tt.uri)
				t.Errorf("got:  %+v", got)
				t.Errorf("want: %+v", tt.want)
			}
		})
	}
}

func TestParseResourceAddress_InvalidURI(t *testing.T) {
	got := ParseResourceAddress("not a URI")

	if got != nil {
		t.Fatalf("ParseResourceAddress(invalid URI) = %#v, want nil", got)
	}
}

func TestResourceAddress_URI_RoundTrip(t *testing.T) {
	original := ResourceAddress{
		ProviderKey:   "filesystem",
		ConnectionKey: "main",
		ScopeKey:      "user",
		Path:          "/documents/test.txt",
	}

	uri, err := original.URI()
	if err != nil {
		t.Fatalf("ResourceAddress.URI() returned error: %v", err)
	}

	parsedContract := ParseResourceAddress(uri)
	if parsedContract == nil {
		t.Fatalf("ParseResourceAddress(%q) returned nil", uri)
	}

	parsed, ok := parsedContract.(ResourceAddress)
	if !ok {
		t.Fatalf(
			"ParseResourceAddress(%q) returned %T, want ResourceAddress",
			uri,
			parsedContract,
		)
	}

	if parsed != original {
		t.Fatalf("round trip mismatch:\ngot:  %+v\nwant: %+v", parsed, original)
	}
}
