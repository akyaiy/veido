package shared

import (
	"MyServer/internal/common"
	"time"
)

type AccessMode string

const (
	AccessViewer AccessMode = "viewer"
	AccessEditor AccessMode = "editor"
)

type LinkStatus string

const (
	StatusPending  LinkStatus = "pending"
	StatusActive   LinkStatus = "active"
	StatusRevoking LinkStatus = "revoking"
	StatusBroken   LinkStatus = "broken"
)

// Link is the Shared Provider's representation of a virtual link. TargetURI is
// the resource identity; provider-local identifiers deliberately do not appear
// here.
type Link struct {
	RecipientUserID int64
	RecipientName   string
	GrantedByUserID int64
	GrantedByName   string
	TargetURI       common.CanonURI
	Alias           string
	AccessMode      AccessMode
	Status          LinkStatus
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
