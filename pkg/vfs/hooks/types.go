// Package hooks implements transport-neutral, actor-bound orchestration over
// the public VFS frontend. It does not own provider resources or bypass ACL.
package hooks

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/akyaiy/veido/pkg/vfs"
)

var (
	ErrInvalidDefinition   = errors.New("invalid hook definition")
	ErrDuplicateDefinition = errors.New("duplicate hook definition")
	ErrRegistryFrozen      = errors.New("hook registry is frozen")
	ErrRegistryNotFrozen   = errors.New("hook registry is not frozen")
	ErrHookNotFound        = errors.New("hook not found")
	ErrEngineNotFound      = errors.New("hook engine not found")
	ErrIdempotencyConflict = errors.New("hook idempotency conflict")
	ErrExecutionInProgress = errors.New("hook execution is already running")
	ErrStepLimit           = errors.New("hook VFS step limit exceeded")
)

type Limits struct {
	Timeout        time.Duration
	MaxSteps       int
	MaxInputBytes  int
	MaxOutputBytes int
}

type Definition struct {
	Key            string
	Version        int
	Engine         string
	Script         any
	InputSchema    any
	OutputSchema   any
	ValidateInput  func(json.RawMessage) error
	ValidateOutput func(json.RawMessage) error
	Limits         Limits
	Enabled        bool
	Active         bool
}

type RunOptions struct {
	Version        int
	IdempotencyKey string
	Timeout        time.Duration
}

type Result struct {
	Hook        string          `json:"hook"`
	Version     int             `json:"version"`
	ExecutionID string          `json:"execution_id"`
	Status      string          `json:"status"`
	Output      json.RawMessage `json:"output"`
}

type RunError struct {
	Code        string `json:"code"`
	Message     string `json:"message"`
	ExecutionID string `json:"execution_id,omitempty"`
	FailedStep  string `json:"failed_step,omitempty"`
	Cause       string `json:"cause,omitempty"`
	Retryable   bool   `json:"retryable"`
	err         error
}

func (e *RunError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func (e *RunError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.err
}

type StepError struct {
	Step string
	Err  error
}

func (e *StepError) Error() string {
	if e == nil {
		return ""
	}
	return fmt.Sprintf("hook step %s: %v", e.Step, e.Err)
}
func (e *StepError) Unwrap() error { return e.Err }

func FailStep(name string, err error) error {
	if err == nil {
		return nil
	}
	return &StepError{Step: name, Err: err}
}

// VFS is actor-bound: none of its methods accepts an actor. Each call is
// forwarded to VFS Core, which performs scope and ACL checks independently.
type VFS interface {
	Stat(context.Context, vfs.URI) (*vfs.Node, error)
	ReadDir(context.Context, vfs.URI) ([]*vfs.Node, error)
	OpenFile(context.Context, vfs.URI, int) (vfs.File, error)
	Mkdir(context.Context, vfs.URI) (*vfs.Node, error)
	Move(context.Context, vfs.URI, vfs.URI) error
	Delete(context.Context, vfs.URI) error
	Control(context.Context, vfs.URI, string, []byte) ([]byte, error)
}

type Execution struct {
	ID    string
	Actor vfs.Actor
	VFS   VFS
	Input json.RawMessage
}

type Program interface {
	Execute(context.Context, Execution) (json.RawMessage, error)
}

type Engine interface {
	Compile(context.Context, Definition) (Program, error)
}

type Runtime interface {
	Run(context.Context, vfs.Actor, string, json.RawMessage, RunOptions) (Result, error)
}

type ExecutionRecord struct {
	ID             string
	ActorKey       string
	HookKey        string
	Version        int
	IdempotencyKey string
	InputHash      string
	Status         string
	Result         Result
	Error          *RunError
}

type BeginDisposition string

const (
	BeginStarted    BeginDisposition = "started"
	BeginCached     BeginDisposition = "cached"
	BeginConflict   BeginDisposition = "conflict"
	BeginInProgress BeginDisposition = "in_progress"
)

type ExecutionStore interface {
	Begin(context.Context, ExecutionRecord) (ExecutionRecord, BeginDisposition, error)
	Complete(context.Context, string, Result) error
	Fail(context.Context, string, *RunError) error
}
