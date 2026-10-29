package hooks

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync/atomic"

	"github.com/akyaiy/veido/pkg/vfs"
	"github.com/google/uuid"
)

type HookRuntime struct {
	registry *Registry
	frontend vfs.Frontend
	store    ExecutionStore
}

func NewRuntime(registry *Registry, frontend vfs.Frontend, store ExecutionStore) (*HookRuntime, error) {
	if registry == nil || frontend == nil || store == nil {
		return nil, fmt.Errorf("%w: runtime dependencies", ErrInvalidDefinition)
	}
	registry.mu.RLock()
	frozen := registry.frozen
	registry.mu.RUnlock()
	if !frozen {
		return nil, ErrRegistryNotFrozen
	}
	return &HookRuntime{registry: registry, frontend: frontend, store: store}, nil
}

func (r *HookRuntime) Run(ctx context.Context, actor vfs.Actor, key string, input json.RawMessage, options RunOptions) (Result, error) {
	return r.run(ctx, actor, key, input, options)
}

func (r *HookRuntime) run(ctx context.Context, actor vfs.Actor, key string, input json.RawMessage, options RunOptions) (Result, error) {
	if ctx == nil || !validActor(actor) {
		return Result{}, newRunError("invalid_invocation", "invalid hook invocation", "invalid_argument", false, "", ErrInvalidDefinition)
	}
	compiled, err := r.registry.resolve(key, options.Version)
	if err != nil {
		return Result{}, newRunError("hook_not_found", "hook definition not found", "not_found", false, "", err)
	}
	definition := compiled.definition
	input = defaultJSON(input)
	if len(input) > definition.Limits.MaxInputBytes {
		return Result{}, newRunError("input_too_large", "hook input exceeds limit", "resource_exhausted", false, "", nil)
	}
	if !json.Valid(input) {
		return Result{}, newRunError("invalid_input", "hook input is not valid JSON", "invalid_argument", false, "", nil)
	}
	normalizedInput, err := normalizeJSON(input)
	if err != nil || definition.ValidateInput(normalizedInput) != nil {
		return Result{}, newRunError("invalid_input", "hook input does not match schema", "invalid_argument", false, "", err)
	}
	executionID := uuid.NewString()
	record := ExecutionRecord{
		ID: executionID, ActorKey: actor.String(), HookKey: key, Version: definition.Version,
		IdempotencyKey: strings.TrimSpace(options.IdempotencyKey), InputHash: hashBytes(normalizedInput),
	}
	stored, disposition, err := r.store.Begin(ctx, record)
	if err != nil {
		return Result{}, newRunError("execution_store_failed", "cannot start hook execution", "internal", true, executionID, err)
	}
	switch disposition {
	case BeginCached:
		if stored.Error != nil {
			return Result{}, stored.Error
		}
		return cloneResult(stored.Result), nil
	case BeginConflict:
		return Result{}, newRunError("idempotency_conflict", "idempotency key was used with different input", "conflict", false, stored.ID, ErrIdempotencyConflict)
	case BeginInProgress:
		return Result{}, newRunError("execution_in_progress", "hook execution is already running", "conflict", true, stored.ID, ErrExecutionInProgress)
	case BeginStarted:
		executionID = stored.ID
	default:
		return Result{}, newRunError("execution_store_failed", "invalid execution-store response", "internal", false, executionID, nil)
	}

	timeout := definition.Limits.Timeout
	if options.Timeout > 0 && options.Timeout < timeout {
		timeout = options.Timeout
	}
	execCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	bound := &actorVFS{frontend: r.frontend, actor: actor, maxSteps: int64(definition.Limits.MaxSteps)}
	output, execErr := compiled.program.Execute(execCtx, Execution{ID: executionID, Actor: actor, VFS: bound, Input: cloneRaw(normalizedInput)})
	if execErr == nil && execCtx.Err() != nil {
		execErr = execCtx.Err()
	}
	if execErr == nil && len(output) > definition.Limits.MaxOutputBytes {
		execErr = fmt.Errorf("hook output exceeds limit")
	}
	if execErr == nil && (!json.Valid(output) || definition.ValidateOutput(output) != nil) {
		execErr = fmt.Errorf("hook output does not match schema")
	}
	if execErr != nil {
		runErr := executionFailure(executionID, execErr)
		if storeErr := r.store.Fail(context.WithoutCancel(ctx), executionID, runErr); storeErr != nil {
			return Result{}, newRunError("execution_store_failed", "cannot persist failed hook execution", "internal", true, executionID, storeErr)
		}
		return Result{}, runErr
	}
	result := Result{Hook: key, Version: definition.Version, ExecutionID: executionID, Status: "completed", Output: cloneRaw(output)}
	if err := r.store.Complete(context.WithoutCancel(ctx), executionID, result); err != nil {
		return Result{}, newRunError("execution_store_failed", "cannot persist hook result", "internal", true, executionID, err)
	}
	return result, nil
}

func validActor(actor vfs.Actor) bool {
	switch actor.Kind {
	case vfs.ActorGuest:
		return actor.ID == "" || (strings.TrimSpace(actor.ID) == actor.ID && !strings.ContainsAny(actor.ID, "\x00\r\n\t "))
	case vfs.ActorUser, vfs.ActorService:
		return actor.ID != "" && strings.TrimSpace(actor.ID) == actor.ID && !strings.ContainsAny(actor.ID, "\x00\r\n\t ")
	default:
		return false
	}
}

type actorVFS struct {
	frontend vfs.Frontend
	actor    vfs.Actor
	steps    atomic.Int64
	maxSteps int64
}

func (b *actorVFS) step() error {
	if b.steps.Add(1) > b.maxSteps {
		return ErrStepLimit
	}
	return nil
}
func (b *actorVFS) Stat(ctx context.Context, uri vfs.URI) (*vfs.Node, error) {
	if err := b.step(); err != nil {
		return nil, err
	}
	return b.frontend.Stat(ctx, b.actor, uri)
}
func (b *actorVFS) ReadDir(ctx context.Context, uri vfs.URI) ([]*vfs.Node, error) {
	if err := b.step(); err != nil {
		return nil, err
	}
	return b.frontend.ReadDir(ctx, b.actor, uri)
}
func (b *actorVFS) OpenFile(ctx context.Context, uri vfs.URI, flags int) (vfs.File, error) {
	if err := b.step(); err != nil {
		return nil, err
	}
	return b.frontend.OpenFile(ctx, b.actor, uri, flags)
}
func (b *actorVFS) Mkdir(ctx context.Context, uri vfs.URI) (*vfs.Node, error) {
	if err := b.step(); err != nil {
		return nil, err
	}
	return b.frontend.Mkdir(ctx, b.actor, uri)
}
func (b *actorVFS) Move(ctx context.Context, source, target vfs.URI) error {
	if err := b.step(); err != nil {
		return err
	}
	return b.frontend.Move(ctx, b.actor, source, target)
}
func (b *actorVFS) Delete(ctx context.Context, uri vfs.URI) error {
	if err := b.step(); err != nil {
		return err
	}
	return b.frontend.Delete(ctx, b.actor, uri)
}
func (b *actorVFS) Control(ctx context.Context, uri vfs.URI, command string, input []byte) ([]byte, error) {
	if err := b.step(); err != nil {
		return nil, err
	}
	return b.frontend.Control(ctx, b.actor, uri, command, input)
}

func normalizeJSON(input json.RawMessage) (json.RawMessage, error) {
	var value any
	if err := json.Unmarshal(input, &value); err != nil {
		return nil, err
	}
	return json.Marshal(value)
}
func hashBytes(input []byte) string {
	digest := sha256.Sum256(input)
	return hex.EncodeToString(digest[:])
}
func executionFailure(id string, err error) *RunError {
	step := ""
	var stepErr *StepError
	if errors.As(err, &stepErr) {
		step = stepErr.Step
	}
	cause := "internal"
	message := "hook execution failed"
	retryable := false
	if kind, ok := vfs.KindOf(err); ok {
		cause = string(kind)
		retryable = kind == vfs.KindUnavailable
	}
	// Only VFS Error.Message is an explicitly safe transport message. Keep it
	// so a hook's typed/domain classification is useful to clients; never use
	// err.Error(), which may contain provider or infrastructure details.
	var public *vfs.Error
	if errors.As(err, &public) && public != nil && public.Message != "" {
		message = public.Message
	}
	if errors.Is(err, context.Canceled) {
		cause = "canceled"
		retryable = true
	}
	if errors.Is(err, context.DeadlineExceeded) {
		cause = "deadline_exceeded"
		retryable = true
	}
	if errors.Is(err, ErrStepLimit) {
		cause = "resource_exhausted"
	}
	return &RunError{Code: "hook_step_failed", Message: message, ExecutionID: id, FailedStep: step, Cause: cause, Retryable: retryable, err: err}
}
func newRunError(code, message, cause string, retryable bool, executionID string, err error) *RunError {
	return &RunError{Code: code, Message: message, Cause: cause, Retryable: retryable, ExecutionID: executionID, err: err}
}

var _ Runtime = (*HookRuntime)(nil)
var _ VFS = (*actorVFS)(nil)
