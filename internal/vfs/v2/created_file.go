package v2

// createdFile publishes the lifecycle event only after the provider has
// successfully committed the new file. Notification errors are not retried:
// storage has already committed and retrying could duplicate external effects.
type createdFile struct {
	WriteFile
	onCreated func() error
	done      bool
	result    error
}

func (f *createdFile) Commit() error {
	if f.done {
		return f.result
	}
	f.done = true
	f.result = f.WriteFile.Commit()
	if f.result == nil {
		f.result = f.onCreated()
	}
	return f.result
}
func (f *createdFile) Close() error { return f.Commit() }
func (f *createdFile) Abort() error {
	if f.done {
		return nil
	}
	f.done = true
	return f.WriteFile.Abort()
}
