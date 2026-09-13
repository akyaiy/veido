// Package vfs exposes the VFS v2 provider contract to packages outside internal.
// Providers use this package and providersdk; applications retain ownership of
// authentication, authorization, connections and the VFS core.
package vfs

import (
	"MyServer/internal/common"
	core "MyServer/internal/vfs/v2"
)

type FSProvider = core.FSProvider
type File = core.File
type WriteFile = core.WriteFile
type Node = core.Node
type ProviderConnection = core.ProviderConnection
type ProviderFactory = core.ProviderFactory
type ProviderRegistry = core.ProviderRegistry
type ProviderPool = core.ProviderPool
type Actor = core.Actor
type ActorKind = core.ActorKind
type Scope = core.Scope
type RequestContext = core.RequestContext
type BoundVFS = core.BoundVFS
type Frontend = core.VFSFrontend
type Authorizer = core.Authorizer
type ResourceLifecycleSink = core.ResourceLifecycleSink
type URI = common.CanonURI
type ResourceRef = common.ResourceRef
type ResourceAddress = common.ResourceAddress
type SubjectKey = common.SubjectKey
type Action = common.Action
type Error = core.Error
type ErrorKind = core.ErrorKind
type Operation = core.Operation

const (
	ActorUser              = core.ActorUser
	ActorGuest             = core.ActorGuest
	ActorService           = core.ActorService
	ActionRead             = common.ActionRead
	ActionWrite            = common.ActionWrite
	ActionExec             = common.ActionExec
	KindInvalidArgument    = core.KindInvalidArgument
	KindNotFound           = core.KindNotFound
	KindAlreadyExists      = core.KindAlreadyExists
	KindPermissionDenied   = core.KindPermissionDenied
	KindConflict           = core.KindConflict
	KindFailedPrecondition = core.KindFailedPrecondition
	KindResourceExhausted  = core.KindResourceExhausted
	KindUnsupported        = core.KindUnsupported
	KindUnavailable        = core.KindUnavailable
	KindInternal           = core.KindInternal
	OpStat                 = core.OpStat
	OpReadDir              = core.OpReadDir
	OpOpenFile             = core.OpOpenFile
	OpRead                 = core.OpRead
	OpWrite                = core.OpWrite
	OpClose                = core.OpClose
	OpMkdir                = core.OpMkdir
	OpMove                 = core.OpMove
	OpDelete               = core.OpDelete
	OpControl              = core.OpControl
)

var (
	ParseURI                  = common.CastURI
	NewError                  = core.NewError
	KindOf                    = core.KindOf
	FinishWrite               = core.FinishWrite
	RequestContextFromContext = core.RequestContextFromContext
	ContextWithRequestContext = core.ContextWithRequestContext
	BoundVFSFromContext       = core.BoundVFSFromContext
	ContextWithBoundVFS       = core.ContextWithBoundVFS
	ContextWithActor          = core.ContextWithActor
	ActorFromContext          = core.ActorFromContext
	NewProviderRegistry       = core.NewProviderRegistry
	ErrInvalidArgument        = core.ErrInvalidArgument
	ErrNotFound               = core.ErrNotFound
	ErrAlreadyExists          = core.ErrAlreadyExists
	ErrPermissionDenied       = core.ErrPermissionDenied
	ErrConflict               = core.ErrConflict
	ErrFailedPrecondition     = core.ErrFailedPrecondition
	ErrResourceExhausted      = core.ErrResourceExhausted
	ErrUnsupported            = core.ErrUnsupported
	ErrUnavailable            = core.ErrUnavailable
	ErrInternal               = core.ErrInternal
	ErrRequestContextNotFound = core.ErrRequestContextNotFound
)
