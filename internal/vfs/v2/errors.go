package v2

import (
	"MyServer/internal/common"
	"errors"
	"fmt"
)

// ErrorKind is a stable, provider-independent classification of a VFS error.
// Transports should map this value to their protocol-specific status without
// inspecting provider-specific causes.
type ErrorKind string

const (
	KindInvalidArgument    ErrorKind = "invalid_argument"
	KindNotFound           ErrorKind = "not_found"
	KindAlreadyExists      ErrorKind = "already_exists"
	KindPermissionDenied   ErrorKind = "permission_denied"
	KindConflict           ErrorKind = "conflict"
	KindFailedPrecondition ErrorKind = "failed_precondition"
	KindResourceExhausted  ErrorKind = "resource_exhausted"
	KindUnsupported        ErrorKind = "unsupported"
	KindUnavailable        ErrorKind = "unavailable"
	KindCanceled           ErrorKind = "canceled"
	KindDeadlineExceeded   ErrorKind = "deadline_exceeded"
	KindInternal           ErrorKind = "internal"
)

// Operation identifies the VFS operation that produced an error.
type Operation string

const (
	OpUnknown  Operation = ""
	OpStat     Operation = "stat"
	OpReadDir  Operation = "read_dir"
	OpOpenFile Operation = "open_file"
	OpRead     Operation = "read"
	OpWrite    Operation = "write"
	OpSeek     Operation = "seek"
	OpClose    Operation = "close"
	OpMkdir    Operation = "mkdir"
	OpMove     Operation = "move"
	OpDelete   Operation = "delete"
	OpControl  Operation = "control"
)

// Error is the common error representation exposed by VFS implementations.
//
// Kind and Message form the safe, provider-independent part of the error.
// Err keeps the original provider-specific cause for errors.Is/errors.As and
// diagnostics. Ref fields are optional operation context and are deliberately
// not included in Error(), so callers do not accidentally expose resource
// paths in public responses.
type Error struct {
	Kind ErrorKind
	Op   Operation

	Ref       *common.ResourceRef
	SourceRef *common.ResourceRef
	TargetRef *common.ResourceRef

	Message string
	Err     error
}

func (e *Error) Error() string {
	if e == nil {
		return "<nil>"
	}

	message := e.Message
	if message == "" {
		message = defaultErrorMessage(e.Kind)
	}
	if e.Op == OpUnknown {
		return message
	}
	return fmt.Sprintf("%s: %s", e.Op, message)
}

// Unwrap exposes the original provider-specific cause.
func (e *Error) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

// Is makes category sentinels usable with errors.Is.
func (e *Error) Is(target error) bool {
	if e == nil {
		return false
	}
	targetKind, ok := sentinelKind(target)
	return ok && e.Kind == targetKind
}

// NewError constructs a classified VFS error. Message must be safe to expose
// to a caller; cause remains available through errors.Is/errors.As.
func NewError(kind ErrorKind, op Operation, message string, cause error) *Error {
	if kind == "" {
		kind = KindInternal
	}
	return &Error{
		Kind:    kind,
		Op:      op,
		Message: message,
		Err:     cause,
	}
}

// WithRef returns a shallow copy of err carrying resource context.
func (e *Error) WithRef(ref common.ResourceRef) *Error {
	if e == nil {
		return nil
	}
	result := *e
	result.Ref = resourceRefPointer(ref)
	return &result
}

// WithMoveRefs returns a shallow copy of err carrying move source and target
// context.
func (e *Error) WithMoveRefs(source, target common.ResourceRef) *Error {
	if e == nil {
		return nil
	}
	result := *e
	result.SourceRef = resourceRefPointer(source)
	result.TargetRef = resourceRefPointer(target)
	return &result
}

// KindOf returns the first classified VFS error kind in err's error tree.
func KindOf(err error) (ErrorKind, bool) {
	if err == nil {
		return "", false
	}

	var vfsErr *Error
	if errors.As(err, &vfsErr) && vfsErr != nil && vfsErr.Kind != "" {
		return vfsErr.Kind, true
	}

	var sentinel errorKindSentinel
	if errors.As(err, &sentinel) {
		return sentinel.kind, true
	}
	return "", false
}

// IsKind reports whether err contains a VFS error of the requested kind.
func IsKind(err error, kind ErrorKind) bool {
	sentinel, ok := sentinelForKind(kind)
	return ok && errors.Is(err, sentinel)
}

type errorKindSentinel struct {
	kind    ErrorKind
	message string
}

func (e errorKindSentinel) Error() string {
	return e.message
}

func (e errorKindSentinel) Is(target error) bool {
	targetKind, ok := sentinelKind(target)
	return ok && e.kind == targetKind
}

func sentinelKind(err error) (ErrorKind, bool) {
	switch value := err.(type) {
	case errorKindSentinel:
		return value.kind, true
	case *errorKindSentinel:
		if value != nil {
			return value.kind, true
		}
	}
	return "", false
}

func sentinelForKind(kind ErrorKind) (error, bool) {
	switch kind {
	case KindInvalidArgument:
		return ErrInvalidArgument, true
	case KindNotFound:
		return ErrNotFound, true
	case KindAlreadyExists:
		return ErrAlreadyExists, true
	case KindPermissionDenied:
		return ErrPermissionDenied, true
	case KindConflict:
		return ErrConflict, true
	case KindFailedPrecondition:
		return ErrFailedPrecondition, true
	case KindResourceExhausted:
		return ErrResourceExhausted, true
	case KindUnsupported:
		return ErrUnsupported, true
	case KindUnavailable:
		return ErrUnavailable, true
	case KindCanceled:
		return ErrCanceled, true
	case KindDeadlineExceeded:
		return ErrDeadlineExceeded, true
	case KindInternal:
		return ErrInternal, true
	default:
		return nil, false
	}
}

func defaultErrorMessage(kind ErrorKind) string {
	if sentinel, ok := sentinelForKind(kind); ok {
		return sentinel.Error()
	}
	if kind == "" {
		return "vfs error"
	}
	return string(kind)
}

func resourceRefPointer(ref common.ResourceRef) *common.ResourceRef {
	copy := ref
	return &copy
}

var (
	// Stable error categories for errors.Is.
	ErrInvalidArgument    error = errorKindSentinel{kind: KindInvalidArgument, message: "invalid argument"}
	ErrNotFound           error = errorKindSentinel{kind: KindNotFound, message: "resource not found"}
	ErrAlreadyExists      error = errorKindSentinel{kind: KindAlreadyExists, message: "resource already exists"}
	ErrPermissionDenied   error = errorKindSentinel{kind: KindPermissionDenied, message: "permission denied"}
	ErrConflict           error = errorKindSentinel{kind: KindConflict, message: "resource conflict"}
	ErrFailedPrecondition error = errorKindSentinel{kind: KindFailedPrecondition, message: "failed precondition"}
	ErrResourceExhausted  error = errorKindSentinel{kind: KindResourceExhausted, message: "resource exhausted"}
	ErrUnsupported        error = errorKindSentinel{kind: KindUnsupported, message: "unsupported operation"}
	ErrUnavailable        error = errorKindSentinel{kind: KindUnavailable, message: "service unavailable"}
	ErrCanceled           error = errorKindSentinel{kind: KindCanceled, message: "operation canceled"}
	ErrDeadlineExceeded   error = errorKindSentinel{kind: KindDeadlineExceeded, message: "deadline exceeded"}
	ErrInternal           error = errorKindSentinel{kind: KindInternal, message: "internal vfs error"}

	// Existing domain errors are kept for compatibility while providers and
	// adapters migrate to the common Error contract.
	ErrInvalidNewInstanceParams       = errors.New("parameters cannot be nil")
	ErrNotImplemented           error = errorKindSentinel{kind: KindUnsupported, message: "not implemented"}

	ErrScopeResolutionFailed = errors.New("scope resolution failed")
	ErrNoDefaultScope        = errors.New("actor has no default scope")
	ErrInvalidScope          = errors.New("invalid scope")

	ErrInvalidProvider = errors.New("invalid provider")

	ErrConnectionNotFound = errors.New("provider connection not found")
	ErrConnectionInactive = errors.New("provider connection is inactive")

	ErrRequestContextNotFound = errors.New("request context not found")
)

// WrapError wraps error2 into error1, if error1 is nil, returns error2.
// Deprecated: new code should return *Error and keep the underlying cause in
// Error.Err.
func WrapError(error1 error, error2 error) error {
	if error1 == nil {
		return error2
	} else if error2 == nil {
		return error1
	}
	return fmt.Errorf("%w: %w", error1, error2)
}
