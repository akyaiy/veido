package common

type ResourceRefContract interface {
	String() string
}

type ResourceRef struct {
	Provider string
	ConnectionID string
	ScopeID string
	Kind string
	ID string
	Path string
}

func (r ResourceRef) String() string {
	panic("not implemented!")
}

func ParseResourceRef(uri CanonURI) ResourceRefContract {
	panic("not implemented!")
}

