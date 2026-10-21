package httpapi

import (
	"MyServer/internal/common"
	"MyServer/internal/vfs/v2"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5/middleware"
)

type transportProblem struct {
	status  int
	code    string
	message string
	cause   error
}

func (e *transportProblem) Error() string { return e.message }
func (e *transportProblem) Unwrap() error { return e.cause }

func requestProblem(status int, code, message string, cause error) error {
	return &transportProblem{status: status, code: code, message: message, cause: cause}
}

type errorDescriptor struct {
	status    int
	code      string
	message   string
	operation v2.Operation
	details   map[string]any
}

func classifyError(err error) errorDescriptor {
	var problem *transportProblem
	if errors.As(err, &problem) {
		return errorDescriptor{status: problem.status, code: problem.code, message: problem.message}
	}

	kind, ok := v2.KindOf(err)
	if !ok {
		kind = legacyErrorKind(err)
	}
	descriptor := descriptorForKind(kind)

	var vfsErr *v2.Error
	if errors.As(err, &vfsErr) && vfsErr != nil {
		descriptor.operation = vfsErr.Op
		if vfsErr.Message != "" {
			descriptor.message = vfsErr.Message
		}
	}
	if code, details, found := v2.PublicDetailsOf(err); found {
		descriptor.code = code
		descriptor.details = details
	}
	return descriptor
}

func legacyErrorKind(err error) v2.ErrorKind {
	switch {
	case errors.Is(err, context.Canceled):
		return v2.KindCanceled
	case errors.Is(err, context.DeadlineExceeded):
		return v2.KindDeadlineExceeded
	case errors.Is(err, common.ErrNotURI), errors.Is(err, os.ErrInvalid), errors.Is(err, v2.ErrInvalidScope), errors.Is(err, v2.ErrInvalidProvider):
		return v2.KindInvalidArgument
	case errors.Is(err, os.ErrNotExist), errors.Is(err, v2.ErrConnectionNotFound), errors.Is(err, v2.ErrNoDefaultScope):
		return v2.KindNotFound
	case errors.Is(err, os.ErrExist):
		return v2.KindAlreadyExists
	case errors.Is(err, os.ErrPermission), errors.Is(err, v2.ErrScopeResolutionFailed):
		return v2.KindPermissionDenied
	case errors.Is(err, v2.ErrConnectionInactive):
		return v2.KindUnavailable
	default:
		return v2.KindInternal
	}
}

func descriptorForKind(kind v2.ErrorKind) errorDescriptor {
	switch kind {
	case v2.KindInvalidArgument:
		return errorDescriptor{status: http.StatusBadRequest, code: string(kind), message: "invalid argument", operation: v2.OpUnknown}
	case v2.KindNotFound:
		return errorDescriptor{status: http.StatusNotFound, code: string(kind), message: "resource not found", operation: v2.OpUnknown}
	case v2.KindAlreadyExists:
		return errorDescriptor{status: http.StatusConflict, code: string(kind), message: "resource already exists", operation: v2.OpUnknown}
	case v2.KindPermissionDenied:
		return errorDescriptor{status: http.StatusForbidden, code: string(kind), message: "permission denied", operation: v2.OpUnknown}
	case v2.KindConflict:
		return errorDescriptor{status: http.StatusConflict, code: string(kind), message: "resource conflict", operation: v2.OpUnknown}
	case v2.KindFailedPrecondition:
		return errorDescriptor{status: http.StatusConflict, code: string(kind), message: "failed precondition", operation: v2.OpUnknown}
	case v2.KindResourceExhausted:
		return errorDescriptor{status: http.StatusTooManyRequests, code: string(kind), message: "resource exhausted", operation: v2.OpUnknown}
	case v2.KindUnsupported:
		return errorDescriptor{status: http.StatusNotImplemented, code: string(kind), message: "unsupported operation", operation: v2.OpUnknown}
	case v2.KindUnavailable:
		return errorDescriptor{status: http.StatusServiceUnavailable, code: string(kind), message: "service unavailable", operation: v2.OpUnknown}
	case v2.KindCanceled:
		return errorDescriptor{status: http.StatusRequestTimeout, code: string(kind), message: "operation canceled", operation: v2.OpUnknown}
	case v2.KindDeadlineExceeded:
		return errorDescriptor{status: http.StatusGatewayTimeout, code: string(kind), message: "deadline exceeded", operation: v2.OpUnknown}
	default:
		return errorDescriptor{status: http.StatusInternalServerError, code: string(v2.KindInternal), message: "internal VFS error", operation: v2.OpUnknown}
	}
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	descriptor := classifyError(err)
	requestID := middleware.GetReqID(r.Context())
	if descriptor.status >= http.StatusInternalServerError {
		h.logger.ErrorContext(r.Context(), "VFS HTTP request failed", slog.String("request_id", requestID), slog.String("error_code", descriptor.code), slog.Any("error", err))
	}
	_ = writeJSON(w, descriptor.status, problemResponse{Error: problemBody{
		Code:      descriptor.code,
		Message:   descriptor.message,
		Operation: descriptor.operation,
		RequestID: requestID,
		Details:   descriptor.details,
	}})
}
