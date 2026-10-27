package v2

// createdFile commits lifecycle intent only after the provider has published a
// new file. A provider commit failure is ambiguous to lifecycle and therefore
// enters recovery rather than silently dropping the prepared operation.
type createdFile struct {
	WriteFile
	onCommit  func() error
	onAbort   func(error) error
	onRecover func(error) error
	done      bool
	result    error
}

func (f *createdFile) Commit() error {
	if f.done {
		return f.result
	}
	f.done = true
	f.result = f.WriteFile.Commit()
	if f.result != nil {
		f.result = f.onRecover(f.result)
		return f.result
	}
	if f.result = f.onCommit(); f.result != nil {
		f.result = f.onRecover(f.result)
	}
	return f.result
}
func (f *createdFile) Close() error { return f.Commit() }
func (f *createdFile) Abort() error {
	if f.done {
		return nil
	}
	f.done = true
	err := f.WriteFile.Abort()
	return f.onAbort(err)
}
