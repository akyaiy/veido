package v2

import (
	"time"
)

type Node struct {
	Name      string
	Kind      string
	IsDir     bool
	Size      int64
	UpdatedAt time.Time
}
