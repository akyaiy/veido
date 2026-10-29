// Package hooksdk provides typed registration helpers for trusted server hooks.
package hooksdk

import (
	"github.com/akyaiy/veido/pkg/vfs/hooks"
	sdk "github.com/akyaiy/veido/pkg/vfs/providersdk"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
)

type NativeOptions struct {
	Limits  hooks.Limits
	Enabled bool
	Active  bool
}

type Handler[In, Out any] func(context.Context, hooks.Execution, In) (Out, error)

// Native constructs a versioned trusted definition with strict typed JSON
// input/output validation. Unknown input fields are rejected before execution.
func Native[In, Out any](key string, version int, options NativeOptions, handler Handler[In, Out]) hooks.Definition {
	validateInput := func(data json.RawMessage) error {
		_, err := decodeStrict[In](data)
		return err
	}
	validateOutput := func(data json.RawMessage) error {
		_, err := decodeStrict[Out](data)
		return err
	}
	var script hooks.NativeHandler
	if handler != nil {
		script = func(ctx context.Context, execution hooks.Execution) (json.RawMessage, error) {
			input, err := decodeStrict[In](execution.Input)
			if err != nil {
				return nil, err
			}
			output, err := handler(ctx, execution, input)
			if err != nil {
				return nil, err
			}
			return json.Marshal(output)
		}
	}
	return hooks.Definition{
		Key: key, Version: version, Engine: hooks.NativeEngineKey, Script: script,
		InputSchema: sdk.Schema[In](), OutputSchema: sdk.Schema[Out](),
		ValidateInput: validateInput, ValidateOutput: validateOutput,
		Limits: options.Limits, Enabled: options.Enabled, Active: options.Active,
	}
}

func decodeStrict[T any](data []byte) (T, error) {
	var value T
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&value); err != nil {
		return value, fmt.Errorf("invalid hook JSON: %w", err)
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return value, fmt.Errorf("hook JSON must contain one value")
	}
	return value, nil
}
