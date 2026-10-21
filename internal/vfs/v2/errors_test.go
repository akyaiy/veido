package v2

import (
	"MyServer/internal/common"
	"errors"
	"fmt"
	"testing"
)

func TestErrorSupportsIsAndAs(t *testing.T) {
	cause := errors.New("provider object is missing")
	ref := common.ResourceRef{
		ProviderKey:   "local",
		ConnectionKey: "primary",
		ScopeKey:      "alice",
		Path:          "/docs/report.txt",
	}

	err := NewError(KindNotFound, OpStat, "resource not found", cause).WithRef(ref)

	if !errors.Is(err, ErrNotFound) {
		t.Fatal("errors.Is(err, ErrNotFound) = false")
	}
	if !errors.Is(err, cause) {
		t.Fatal("errors.Is(err, cause) = false")
	}
	if errors.Is(err, ErrPermissionDenied) {
		t.Fatal("errors.Is(err, ErrPermissionDenied) = true")
	}

	var got *Error
	if !errors.As(err, &got) {
		t.Fatal("errors.As(err, *Error) = false")
	}
	if got.Kind != KindNotFound || got.Op != OpStat {
		t.Fatalf("classified error = (%q, %q), want (%q, %q)", got.Kind, got.Op, KindNotFound, OpStat)
	}
	if got.Ref == nil || *got.Ref != ref {
		t.Fatalf("error ref = %#v, want %#v", got.Ref, ref)
	}
	if got.Error() != "stat: resource not found" {
		t.Fatalf("Error() = %q, want safe public message", got.Error())
	}
}

func TestErrorDoesNotExposeCauseOrRef(t *testing.T) {
	err := NewError(KindInternal, OpOpenFile, "", errors.New("secret database detail")).WithRef(common.ResourceRef{
		Path: "/private/file.txt",
	})

	if got := err.Error(); got != "open_file: internal vfs error" {
		t.Fatalf("Error() = %q", got)
	}
}

func TestKindOfThroughWrapping(t *testing.T) {
	err := fmt.Errorf("request failed: %w", NewError(KindConflict, OpMove, "target changed", nil))

	kind, ok := KindOf(err)
	if !ok || kind != KindConflict {
		t.Fatalf("KindOf() = (%q, %v), want (%q, true)", kind, ok, KindConflict)
	}
	if !IsKind(err, KindConflict) {
		t.Fatal("IsKind(err, KindConflict) = false")
	}
	if IsKind(err, ErrorKind("custom")) {
		t.Fatal("IsKind(err, custom) = true")
	}
}

func TestUnsupportedCompatibility(t *testing.T) {
	if !errors.Is(ErrNotImplemented, ErrUnsupported) {
		t.Fatal("ErrNotImplemented does not match ErrUnsupported")
	}

	err := NewError(KindUnsupported, OpControl, "command is not supported", ErrNotImplemented)
	if !errors.Is(err, ErrNotImplemented) {
		t.Fatal("classified unsupported error does not match ErrNotImplemented")
	}
	if !errors.Is(err, ErrUnsupported) {
		t.Fatal("classified unsupported error does not match ErrUnsupported")
	}
}

func TestWithMoveRefsDoesNotMutateOriginal(t *testing.T) {
	base := NewError(KindConflict, OpMove, "target exists", nil)
	source := common.ResourceRef{Path: "/old"}
	target := common.ResourceRef{Path: "/new"}

	annotated := base.WithMoveRefs(source, target)
	if base.SourceRef != nil || base.TargetRef != nil {
		t.Fatal("WithMoveRefs mutated the original error")
	}
	if annotated.SourceRef == nil || *annotated.SourceRef != source {
		t.Fatalf("source ref = %#v, want %#v", annotated.SourceRef, source)
	}
	if annotated.TargetRef == nil || *annotated.TargetRef != target {
		t.Fatalf("target ref = %#v, want %#v", annotated.TargetRef, target)
	}
}
