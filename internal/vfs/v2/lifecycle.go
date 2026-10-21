package v2

import (
	"MyServer/internal/common"
	"context"
	"log/slog"
)

type ResourceLifecycleSink interface {
	OnResourceCreated(ctx context.Context, actor Actor, ref common.ResourceRef) error
	OnResourceMoved(ctx context.Context, actor Actor, oldRef common.ResourceRef, newRef common.ResourceRef) error
	OnResourceDeleted(ctx context.Context, actor Actor, ref common.ResourceRef) error
}

type NoopResourceLifecycle struct{}

func NewNoopResourceLifecycle() ResourceLifecycleSink {
	return NoopResourceLifecycle{}
}

func (NoopResourceLifecycle) OnResourceCreated(ctx context.Context, actor Actor, ref common.ResourceRef) error {
	slog.Debug("OnResourceCreated", "ref", ref)
	return nil
}

func (NoopResourceLifecycle) OnResourceMoved(ctx context.Context, actor Actor, oldRef, newRef common.ResourceRef) error {
	slog.Debug("OnResourceMoved", "oldRef", oldRef, "newRef", newRef)
	return nil
}

func (NoopResourceLifecycle) OnResourceDeleted(ctx context.Context, actor Actor, ref common.ResourceRef) error {
	slog.Debug("OnResourceDeleted", "ref", ref)
	return nil
}
