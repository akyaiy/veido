package common

import (
	"path"
	"strings"
)

type CanonURI string

const EmptyURI CanonURI = "://"

func IsCanonURI(uri CanonURI) bool {
	s := string(uri)

	if s == "" {
		return false
	}

	at := strings.IndexByte(s, '@')
	open := strings.IndexByte(s, '[')
	close := strings.IndexByte(s, ']')
	scheme := strings.Index(s, "://")

	if at == -1 || open == -1 || close == -1 || scheme == -1 {
		return false
	}

	// provider@connection[scope]://path
	if at == 0 ||                // provider empty
		open <= at+1 ||          // connection empty
		close <= open ||         // malformed scope
		scheme != close+1 {      // "]://" must be adjacent
		return false
	}

	rawPath := s[scheme+3:]
	
	if rawPath == "" || rawPath[0] != '/' {
		return false
	}
	
	if path.Clean(rawPath) != rawPath {
		return false
	}

	p := path.Clean(s[scheme+3:])
	if p != s[scheme+3:] {
		return false
	}

	return true
}

func CastURI(raw string) (CanonURI, error) {
	uri := CanonURI(raw)
	if !IsCanonURI(uri) {
		return EmptyURI, ErrNotURI
	}
	return uri, nil
}

// HasScope reports whether uri has an explicitly specified non-empty scope.
func (uri CanonURI) HasScope() bool {
	return uri.ScopeName() != ""
}

// ScopeName returns the canonical URI scope name, or an empty string when the
// URI is invalid or the scope segment is empty.
func (uri CanonURI) ScopeName() string {
	ref := uri.resourceRef()
	if ref == nil {
		return ""
	}

	return ref.ScopeName
}

func (uri CanonURI) ScopeId() string {
	ref := uri.resourceRef()
	if ref == nil {
		return ""
	}

	return ref.ScopeID
}

// HasProvider reports whether uri has a valid provider segment.
func (uri CanonURI) HasProvider() bool {
	return uri.Provider() != ""
}

// Provider returns the canonical URI provider, or an empty string for invalid
// URIs.
func (uri CanonURI) Provider() string {
	ref := uri.resourceRef()
	if ref == nil {
		return ""
	}

	return ref.Provider
}

// HasConnection reports whether uri has a valid connection name segment.
func (uri CanonURI) HasConnection() bool {
	return uri.ConnectionName() != ""
}

// ConnectionName returns the canonical URI connection name, or an empty string
// for invalid URIs.
func (uri CanonURI) ConnectionName() string {
	ref := uri.resourceRef()
	if ref == nil {
		return ""
	}

	return ref.ConnectionName
}

// Path returns the canonical URI path, or an empty string for invalid URIs.
func (uri CanonURI) Path() string {
	ref := uri.resourceRef()
	if ref == nil {
		return ""
	}

	return ref.Path
}

func (uri CanonURI) resourceRef() *ResourceRef {
	refContract := ParseResourceRef(uri)
	if refContract == nil {
		return nil
	}

	ref := refContract.Payload()
	return &ref
}
