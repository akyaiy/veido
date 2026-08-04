package common

import (
	"fmt"
	"path"
	"strings"
)

type ResourceRefContract interface {
	URI() (CanonURI, error)
	Payload() ResourceRef
}

type ResourceRef struct {
	Provider string
	ConnectionName string
	ConnectionID string
	ScopeName string
	ScopeID string
	Path string
}

func (r ResourceRef) URI() (CanonURI, error) {
	rawUri := fmt.Sprintf("%s@%s[%s]://%s", r.Provider, r.ConnectionName, r.ScopeName, path.Clean("/" + r.Path))
	uri, err := CastURI(rawUri)
	if err != nil {
		return EmptyURI, err
	}
	return uri, nil
}

func (r ResourceRef) Payload() ResourceRef {
	return r
}

func ParseResourceRef(uri CanonURI) ResourceRefContract {
	if !IsCanonURI(uri) {
		return nil
	}

	s := string(uri)

	at := strings.IndexByte(s, '@')
	open := strings.IndexByte(s, '[')
	close := strings.IndexByte(s, ']')
	scheme := strings.Index(s, "://")

	return ResourceRef{
		Provider:       s[:at],
		ConnectionName: s[at+1 : open],
		ScopeName:      s[open+1 : close],
		Path:           s[scheme+3:],
	}
}

