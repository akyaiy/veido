package common

import (
	"fmt"
	"path"
)

type ResourceRefContract interface {
	URI() (CanonURI, error)
	Payload() ResourceAddress
}

type ResourceAddress struct {
	ProviderKey   string
	ConnectionKey string
	ScopeKey      string
	Path          string
}

type ResourceRef struct {
	ProviderKey   string
	ConnectionKey string
	ScopeKey      string
	Path          string
}

func (a ResourceAddress) URI() (CanonURI, error) {
	rawUri := fmt.Sprintf("%s@%s[%s]://%s", a.ProviderKey, a.ConnectionKey, a.ScopeKey, path.Clean("/"+a.Path))
	uri, err := CastURI(rawUri)
	if err != nil {
		return EmptyURI, err
	}
	return uri, nil
}

func (a ResourceAddress) Payload() ResourceAddress {
	return a
}

func ParseResourceAddress(uri CanonURI) ResourceRefContract {
	matches := canonURIRe.FindStringSubmatch(string(uri))
	if matches == nil {
		return nil
	}

	resourcePath := matches[4]
	if path.Clean(resourcePath) != resourcePath {
		return nil
	}

	return ResourceAddress{
		ProviderKey:   matches[1],
		ConnectionKey: matches[2],
		ScopeKey:      matches[3],
		Path:          resourcePath,
	}
}

func ParseResourceRef(uri CanonURI) ResourceRefContract {
	return ParseResourceAddress(uri)
}
