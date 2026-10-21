package hooks

import (
	"context"
	"encoding/json"
	"fmt"
)

const NativeEngineKey = "native"

type NativeHandler func(context.Context, Execution) (json.RawMessage, error)

type NativeEngine struct{}

func (NativeEngine) Compile(_ context.Context, definition Definition) (Program, error) {
	handler, ok := definition.Script.(NativeHandler)
	if !ok || handler == nil {
		return nil, fmt.Errorf("%w: native script must be NativeHandler", ErrInvalidDefinition)
	}
	return nativeProgram{handler: handler}, nil
}

type nativeProgram struct{ handler NativeHandler }

func (p nativeProgram) Execute(ctx context.Context, execution Execution) (json.RawMessage, error) {
	return p.handler(ctx, execution)
}

func DefaultEngines() map[string]Engine { return map[string]Engine{NativeEngineKey: NativeEngine{}} }
