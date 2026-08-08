package storage

import "fmt"

var (
	ErrScopeNotCreated = fmt.Errorf("scope not created")
	ErrScopeNotFound   = fmt.Errorf("scope not found")
	ErrScopesNotListed = fmt.Errorf("scopes not listed")
	ErrScopeNotDeleted = fmt.Errorf("scope not deleted")
	ErrDefaultNotSet   = fmt.Errorf("default scope not set")

	ErrConnectionNotCreated = fmt.Errorf("provider connection not created")
	ErrConnectionNotFound   = fmt.Errorf("provider connection not found")
	ErrConnectionsNotListed = fmt.Errorf("provider connections not listed")
	ErrConnectionNotDeleted = fmt.Errorf("provider connection not deleted")
	ErrConnectionNotUpdated = fmt.Errorf("provider connection not updated")
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
