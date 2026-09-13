package webdav

import (
	"context"
	"io"
	"net/http"
)

type uploadContextKey struct{}
type uploadState struct {
	complete bool
	err      error
	expected int64
	read     int64
}
type uploadBody struct {
	io.ReadCloser
	state *uploadState
}

func (b *uploadBody) Read(p []byte) (int, error) {
	n, err := b.ReadCloser.Read(p)
	b.state.read += int64(n)
	if err == io.EOF {
		if b.state.expected >= 0 && b.state.read != b.state.expected {
			b.state.err = io.ErrUnexpectedEOF
		} else {
			b.state.complete = true
		}
	} else if err != nil {
		b.state.err = err
	}
	return n, err
}

// TransactionalWrites must wrap the x/net/webdav handler. That handler calls
// Close even after a source read error; this records the transfer result so
// davFile can abort staged uploads instead of committing partial bytes.
func TransactionalWrites(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PUT" {
			next.ServeHTTP(w, r)
			return
		}
		state := &uploadState{expected: r.ContentLength}
		r = r.WithContext(context.WithValue(r.Context(), uploadContextKey{}, state))
		body := r.Body
		if body == nil {
			body = http.NoBody
		}
		r.Body = &uploadBody{ReadCloser: body, state: state}
		next.ServeHTTP(w, r)
	})
}
