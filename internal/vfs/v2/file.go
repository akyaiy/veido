package v2

import (
	"errors"
	"io"
	"os"
)

type File interface {
	io.Reader
	io.Writer
	io.Seeker
	io.Closer
	Stat() (os.FileInfo, error)
}

// WriteFile stages writes until Commit (or Close for filesystem compatibility).
// Abort releases resources without publishing staged bytes. All finalization
// methods must be idempotent; a failed commit must not be retried by Close.
// Providers that write directly may continue returning an ordinary File.
type WriteFile interface {
	File
	Commit() error
	Abort() error
}

// FinishWrite is the transport-independent completion protocol for an upload.
// A source read error must abort a staged upload, even when all Write calls
// succeeded. Ordinary files are closed, but cannot promise rollback.
func FinishWrite(file File, transferErr error) error {
	if staged, ok := file.(WriteFile); ok {
		if transferErr != nil {
			return errors.Join(transferErr, staged.Abort())
		}
		return staged.Commit()
	}
	return errors.Join(transferErr, file.Close())
}
