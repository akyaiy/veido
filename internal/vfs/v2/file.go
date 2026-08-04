package v2

import "io"

type File interface {
    io.Reader
    io.Writer
    io.Seeker
    io.Closer
    Stat() (Node, error)
}