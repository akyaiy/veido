package v2

import (
	"MyServer/internal/common"
	"time"
)

type Node struct {
    Name      string
    Kind      string
    IsDir     bool
    Size      int64
    UpdatedAt time.Time
    Ref       common.ResourceRef
}