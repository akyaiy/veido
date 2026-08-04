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