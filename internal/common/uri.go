package common

import (
	"path"
	"regexp"
)

type CanonURI string

const EmptyURI CanonURI = "://"

var canonURIRe = regexp.MustCompile(
	`^([^@\[\]:/]+)@([^@\[\]:/]+)(?:\[([^\[\]]*)\])?://(/.*)$`,
)

func IsCanonURI(uri CanonURI) bool {
	matches := canonURIRe.FindStringSubmatch(string(uri))
	if matches == nil {
		return false
	}

	rawPath := matches[4]
	return path.Clean(rawPath) == rawPath
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
	return uri.ScopeKey() != ""
}

// ScopeKey returns the canonical URI scope key, or an empty string when the
// URI is invalid or the scope segment is empty.
func (uri CanonURI) ScopeKey() string {
	address := uri.resourceAddress()
	if address == nil {
		return ""
	}

	return address.ScopeKey
}

// HasProvider reports whether uri has a valid provider segment.
func (uri CanonURI) HasProvider() bool {
	return uri.Provider() != ""
}

// Provider returns the canonical URI provider, or an empty string for invalid
// URIs.
func (uri CanonURI) Provider() string {
	address := uri.resourceAddress()
	if address == nil {
		return ""
	}

	return address.ProviderKey
}

// HasConnection reports whether uri has a valid connection key segment.
func (uri CanonURI) HasConnection() bool {
	return uri.ConnectionKey() != ""
}

// ConnectionKey returns the canonical URI connection key, or an empty string
// for invalid URIs.
func (uri CanonURI) ConnectionKey() string {
	address := uri.resourceAddress()
	if address == nil {
		return ""
	}

	return address.ConnectionKey
}

// Path returns the canonical URI path, or an empty string for invalid URIs.
func (uri CanonURI) Path() string {
	address := uri.resourceAddress()
	if address == nil {
		return ""
	}

	return address.Path
}

func (uri CanonURI) resourceAddress() *ResourceAddress {
	addressContract := ParseResourceAddress(uri)
	if addressContract == nil {
		return nil
	}

	address := addressContract.Payload()
	return &address
}
