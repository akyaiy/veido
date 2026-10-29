package httpapi

import (
	"github.com/akyaiy/veido/internal/common"
	"github.com/akyaiy/veido/internal/vfs/v2"
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"testing"
)

func TestClassifyVFSKinds(t *testing.T) {
	tests := []struct {
		kind   v2.ErrorKind
		status int
	}{
		{v2.KindInvalidArgument, http.StatusBadRequest},
		{v2.KindNotFound, http.StatusNotFound},
		{v2.KindAlreadyExists, http.StatusConflict},
		{v2.KindPermissionDenied, http.StatusForbidden},
		{v2.KindConflict, http.StatusConflict},
		{v2.KindFailedPrecondition, http.StatusConflict},
		{v2.KindResourceExhausted, http.StatusTooManyRequests},
		{v2.KindUnsupported, http.StatusNotImplemented},
		{v2.KindUnavailable, http.StatusServiceUnavailable},
		{v2.KindCanceled, http.StatusRequestTimeout},
		{v2.KindDeadlineExceeded, http.StatusGatewayTimeout},
		{v2.KindInternal, http.StatusInternalServerError},
	}
	for _, test := range tests {
		t.Run(string(test.kind), func(t *testing.T) {
			err := fmt.Errorf("wrapped: %w", v2.NewError(test.kind, v2.OpStat, "safe message", errors.New("private cause")))
			got := classifyError(err)
			if got.status != test.status || got.code != string(test.kind) || got.message != "safe message" || got.operation != v2.OpStat {
				t.Fatalf("descriptor = %+v", got)
			}
		})
	}
}

func TestClassifyLegacyErrors(t *testing.T) {
	tests := []struct {
		err  error
		kind v2.ErrorKind
	}{
		{common.ErrNotURI, v2.KindInvalidArgument},
		{os.ErrInvalid, v2.KindInvalidArgument},
		{os.ErrNotExist, v2.KindNotFound},
		{v2.ErrConnectionNotFound, v2.KindNotFound},
		{os.ErrExist, v2.KindAlreadyExists},
		{os.ErrPermission, v2.KindPermissionDenied},
		{v2.ErrScopeResolutionFailed, v2.KindPermissionDenied},
		{v2.ErrConnectionInactive, v2.KindUnavailable},
		{v2.ErrNotImplemented, v2.KindUnsupported},
		{context.Canceled, v2.KindCanceled},
		{context.DeadlineExceeded, v2.KindDeadlineExceeded},
		{errors.New("database details"), v2.KindInternal},
	}
	for _, test := range tests {
		t.Run(test.err.Error(), func(t *testing.T) {
			got := classifyError(fmt.Errorf("wrapped: %w", test.err))
			if got.code != string(test.kind) {
				t.Fatalf("code = %q, want %q", got.code, test.kind)
			}
		})
	}
}

func TestUnknownErrorMessageIsNotExposed(t *testing.T) {
	got := classifyError(errors.New("password=secret"))
	if got.status != http.StatusInternalServerError || got.message != "internal VFS error" {
		t.Fatalf("descriptor = %+v", got)
	}
}

type publicConflict struct{}

func (publicConflict) Error() string      { return "private revision state" }
func (publicConflict) PublicCode() string { return "tree_revision_conflict" }
func (publicConflict) PublicDetails() map[string]any {
	return map[string]any{"current_revision": int64(9)}
}

func TestClassifyErrorUsesExplicitPublicDomainDetails(t *testing.T) {
	err := v2.NewError(v2.KindConflict, v2.OpControl, "revision conflict", publicConflict{})
	got := classifyError(err)
	if got.status != http.StatusConflict || got.code != "tree_revision_conflict" || got.details["current_revision"] != int64(9) {
		t.Fatalf("descriptor = %+v", got)
	}
}
