package v2

import (
	"MyServer/internal/common"
	"context"
)

type ResourceLifecycleSink interface {
    OnResourceCreated(ctx context.Context, actor Actor, ref common.ResourceRef) error
    OnResourceMoved(ctx context.Context, actor Actor, oldRef common.ResourceRef, newRef common.ResourceRef, isDir bool) error
    OnResourceDeleted(ctx context.Context, actor Actor, ref common.ResourceRef, isDir bool) error
}

type NoopResourceLifecycle struct{}

func NewNoopResourceLifecycle() ResourceLifecycleSink {
	return NoopResourceLifecycle{}
}

func (NoopResourceLifecycle) OnResourceCreated(ctx context.Context, actor Actor, ref common.ResourceRef) error {
    return nil
}

func (NoopResourceLifecycle) OnResourceMoved(ctx context.Context, actor Actor, oldRef, newRef common.ResourceRef, isDir bool) error {
    return nil
}

func (NoopResourceLifecycle) OnResourceDeleted(ctx context.Context, actor Actor, ref common.ResourceRef, isDir bool) error {
    return nil
}