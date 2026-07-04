package webdav

import (
	"MyServer/internal/vfs"
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"time"

	"golang.org/x/net/webdav"
)

type WebDAVLockSystem struct {
	localLockSystem vfs.InternalLockSystem
}

func NewWebDAVLockSystem(localLockSystem vfs.InternalLockSystem) webdav.LockSystem {
	return &WebDAVLockSystem{localLockSystem: localLockSystem}
}

// Confirm implements [webdav.LockSystem].
func (w *WebDAVLockSystem) Confirm(now time.Time, name0 string, name1 string, conditions ...webdav.Condition) (release func(), err error) {
	ctx := context.Background()

	if name0 != "" {
		name0 = filepath.Clean("/" + name0)
	}
	if name1 != "" {
		name1 = filepath.Clean("/" + name1)
	}
	
	if len(conditions) == 0 {
		if name0 != "" {
			locked, err := w.localLockSystem.IsLocked(ctx, name0)
			if err != nil {
				return nil, err
			}
			if locked {
				return nil, webdav.ErrLocked
			}
		}

		if name1 != "" {
			locked, err := w.localLockSystem.IsLocked(ctx, name1)
			if err != nil {
				return nil, err
			}
			if locked {
				return nil, webdav.ErrLocked
			}
		}

		return func() {}, nil
	}
	
	for _, cond := range conditions {
		if cond.Token != "" {
			if name0 != "" {
				// FIXME: theres no configurable TTL for lock 
				err = w.localLockSystem.ExtendLock(ctx, name0, cond.Token, 15*time.Minute)
				if err == nil {
					return func() { _ = w.localLockSystem.ReleaseLock(context.Background(), cond.Token) }, nil
				}
			}

			// only for move and copy operations WebDAV sends two paths in conditions
			if name1 != "" {
				// FIXME: theres no configurable TTL for lock 
				err = w.localLockSystem.ExtendLock(ctx, name1, cond.Token, 15*time.Minute)
				if err == nil {
					return func() { _ = w.localLockSystem.ReleaseLock(context.Background(), cond.Token) }, nil
				}
			}
		}
	}

	return nil, webdav.ErrLocked
}

// Create implements [webdav.LockSystem].
func (w *WebDAVLockSystem) Create(now time.Time, details webdav.LockDetails) (token string, err error) {
	if details.Root == "" {
		return "", webdav.ErrNoSuchLock
	}
	token, err = w.localLockSystem.AcquireLock(context.Background(), vfs.LockParam{
		Path:       details.Root,
		Owner:      fmt.Sprintf("%v", details.OwnerXML),
		ClientType: "webdav",
		Exclusive:  false, // WebDAV supports only exclusive locks
		TTL:        details.Duration,
	})
	if errors.Is(err, vfs.ErrAlreadyLocked) {
		return "", webdav.ErrLocked
	}
	if err != nil {
		return "", err
	}

	return token, nil
}

// Refresh implements [webdav.LockSystem].
// FIXME: may be webdav handler need all [webdav.LockDetails] fields to be filled in response
func (w *WebDAVLockSystem) Refresh(now time.Time, token string, duration time.Duration) (webdav.LockDetails, error) {
	err := w.localLockSystem.ExtendLock(context.Background(), "", token, duration)
	if err != nil {
		return webdav.LockDetails{}, webdav.ErrLocked
	}

	return webdav.LockDetails{
		Duration: duration,
	}, nil
}

// Unlock implements [webdav.LockSystem].
func (w *WebDAVLockSystem) Unlock(now time.Time, token string) error {
	err := w.localLockSystem.ReleaseLock(context.Background(), token)
	if err != nil {
		return webdav.ErrForbidden
	}
	return nil
}
