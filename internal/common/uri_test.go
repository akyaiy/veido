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

func TestParseResourceRef(t *testing.T) {
	tests := []struct {
		name string
		uri  CanonURI
		want ResourceRef
	}{
		{
			name: "full resource reference",
			uri:  "filesystem@main[user]:///documents/test.txt",
			want: ResourceRef{
				Provider:       "filesystem",
				ConnectionName: "main",
				ScopeName:      "user",
				Path:           "/documents/test.txt",
			},
		},
		{
			name: "root path",
			uri:  "filesystem@main[user]:///",
			want: ResourceRef{
				Provider:       "filesystem",
				ConnectionName: "main",
				ScopeName:      "user",
				Path:           "/",
			},
		},
		{
			name: "empty scope",
			uri:  "filesystem@main[]:///documents/test.txt",
			want: ResourceRef{
				Provider:       "filesystem",
				ConnectionName: "main",
				ScopeName:      "",
				Path:           "/documents/test.txt",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotContract := ParseResourceRef(tt.uri)
			if gotContract == nil {
				t.Fatalf("ParseResourceRef(%q) returned nil", tt.uri)
			}

			got, ok := gotContract.(ResourceRef)
			if !ok {
				t.Fatalf(
					"ParseResourceRef(%q) returned %T, want ResourceRef",
					tt.uri,
					gotContract,
				)
			}

			if got != tt.want {
				t.Errorf("ParseResourceRef(%q) mismatch", tt.uri)
				t.Errorf("got:  %+v", got)
				t.Errorf("want: %+v", tt.want)
			}
		})
	}
}

func TestParseResourceRef_InvalidURI(t *testing.T) {
	got := ParseResourceRef("not a URI")

	if got != nil {
		t.Fatalf("ParseResourceRef(invalid URI) = %#v, want nil", got)
	}
}

func TestResourceRef_URI_RoundTrip(t *testing.T) {
	original := ResourceRef{
		Provider:       "filesystem",
		ConnectionName: "main",
		ScopeName:      "user",
		Path:           "/documents/test.txt",
	}

	uri, err := original.URI()
	if err != nil {
		t.Fatalf("ResourceRef.URI() returned error: %v", err)
	}

	parsedContract := ParseResourceRef(uri)
	if parsedContract == nil {
		t.Fatalf("ParseResourceRef(%q) returned nil", uri)
	}

	parsed, ok := parsedContract.(ResourceRef)
	if !ok {
		t.Fatalf(
			"ParseResourceRef(%q) returned %T, want ResourceRef",
			uri,
			parsedContract,
		)
	}

	if parsed != original {
		t.Fatalf("round trip mismatch:\ngot:  %+v\nwant: %+v", parsed, original)
	}
}