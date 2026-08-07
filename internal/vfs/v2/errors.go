package v2

import "fmt"

var (
	ErrInvalidNewInstanceParams = fmt.Errorf("parameters cannot be nil")
	ErrNotImplemented           = fmt.Errorf("not implemented")

	ErrScopeResolutionFailed    = fmt.Errorf("scope resolution failed")
	ErrNoDefaultScope           = fmt.Errorf("actor has no default scope")
)
