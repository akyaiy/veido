package v2

import "fmt"

var (
	ErrInvalidNewInstanceParams = fmt.Errorf("parameters cannot be nil")
	ErrNotImplemented           = fmt.Errorf("not implemented")
	
	ErrScopeResolutionFailed = fmt.Errorf("scope resolution failed")
	ErrNoDefaultScope        = fmt.Errorf("actor has no default scope")
	ErrInvalidScope       = fmt.Errorf("invalid scope")
	
	ErrInvalidProvider    = fmt.Errorf("invalid provider")
	
	ErrConnectionNotFound = fmt.Errorf("provider connection not found")
	ErrConnectionInactive = fmt.Errorf("provider connection is inactive")
	ErrPermissionDenied = fmt.Errorf("permission denied")
)

// WrapError wraps error2 into error1, if error1 is nil, returns error2.
func WrapError(error1 error, error2 error) error {
	if error1 == nil {
		return error2
	} else if error2 == nil {
		return error1
	}
	return fmt.Errorf("%w: %w", error1, error2)
}
