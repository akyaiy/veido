package common

import "fmt"

var (
	ErrNotURI = fmt.Errorf("given string doesn't match canon uri format")
)