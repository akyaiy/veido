package common

type CanonURI string

var EmptyURI CanonURI = "://"

func IsCanonURI(uri CanonURI) bool {
	panic("not implemented!")
}

func CastURI(raw string) (CanonURI, error) {
	uri := CanonURI(raw)
	if !IsCanonURI(uri) {
		return EmptyURI, ErrNotURI
	}
	return uri, nil
}