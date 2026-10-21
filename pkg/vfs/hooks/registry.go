package hooks

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"sync"
	"time"

	"MyServer/pkg/vfs"
)

var hookKeyPattern = regexp.MustCompile(`^[a-z][a-z0-9._-]{0,95}$`)

type compiledDefinition struct {
	definition Definition
	program    Program
}

type Registry struct {
	mu          sync.RWMutex
	engines     map[string]Engine
	definitions map[string]map[int]Definition
	compiled    map[string]map[int]compiledDefinition
	active      map[string]int
	bindings    map[string]Binding
	frozen      bool
}

func NewRegistry(engines map[string]Engine) *Registry {
	copyEngines := make(map[string]Engine, len(engines))
	for key, engine := range engines {
		copyEngines[key] = engine
	}
	return &Registry{engines: copyEngines, definitions: map[string]map[int]Definition{}, compiled: map[string]map[int]compiledDefinition{}, active: map[string]int{}, bindings: map[string]Binding{}}
}

func (r *Registry) Register(definition Definition) error {
	if r == nil {
		return ErrInvalidDefinition
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.frozen {
		return ErrRegistryFrozen
	}
	if err := validateDefinition(definition); err != nil {
		return err
	}
	versions := r.definitions[definition.Key]
	if versions == nil {
		versions = map[int]Definition{}
		r.definitions[definition.Key] = versions
	}
	if _, exists := versions[definition.Version]; exists {
		return fmt.Errorf("%w: %s version %d", ErrDuplicateDefinition, definition.Key, definition.Version)
	}
	versions[definition.Version] = definition
	return nil
}

func (r *Registry) RegisterBinding(binding Binding) error {
	return r.setBinding(binding, false)
}

// SetBinding installs or replaces trusted connection configuration while hook
// definitions remain frozen. It is intended for provider-module lifecycle.
func (r *Registry) SetBinding(binding Binding) error {
	return r.setBinding(binding, true)
}

func (r *Registry) setBinding(binding Binding, replace bool) error {
	if r == nil {
		return ErrInvalidDefinition
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if !hookKeyPattern.MatchString(binding.Key) || !hookKeyPattern.MatchString(binding.HookKey) || binding.Version < 0 || binding.ResourceURI == "" || !json.Valid(defaultJSON(binding.Config)) {
		return fmt.Errorf("%w: invalid binding", ErrInvalidDefinition)
	}
	if _, err := vfs.ParseURI(string(binding.ResourceURI)); err != nil {
		return fmt.Errorf("%w: invalid binding resource URI", ErrInvalidDefinition)
	}
	binding.Config = cloneRaw(defaultJSON(binding.Config))
	if existing, exists := r.bindings[binding.Key]; exists {
		if sameBinding(existing, binding) {
			return nil
		}
		if !replace || existing.ResourceURI != binding.ResourceURI || existing.HookKey != binding.HookKey {
			return fmt.Errorf("%w: binding %s", ErrDuplicateDefinition, binding.Key)
		}
	}
	for key, existing := range r.bindings {
		if key == binding.Key {
			continue
		}
		if existing.ResourceURI == binding.ResourceURI && existing.HookKey == binding.HookKey {
			return fmt.Errorf("%w: resource hook %s %s", ErrDuplicateDefinition, binding.ResourceURI, binding.HookKey)
		}
	}
	if r.frozen {
		if err := r.validateBindingTargetLocked(binding); err != nil {
			return err
		}
	}
	r.bindings[binding.Key] = binding
	return nil
}

func (r *Registry) Freeze(ctx context.Context) error {
	if r == nil {
		return ErrInvalidDefinition
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.frozen {
		return nil
	}
	compiled := make(map[string]map[int]compiledDefinition, len(r.definitions))
	active := make(map[string]int, len(r.definitions))
	for key, versions := range r.definitions {
		activeVersion := 0
		compiled[key] = map[int]compiledDefinition{}
		ordered := make([]int, 0, len(versions))
		for version := range versions {
			ordered = append(ordered, version)
		}
		sort.Ints(ordered)
		for _, version := range ordered {
			definition := withDefaultLimits(versions[version])
			engine, exists := r.engines[definition.Engine]
			if !exists || engine == nil {
				return fmt.Errorf("%w: %s", ErrEngineNotFound, definition.Engine)
			}
			program, err := engine.Compile(ctx, definition)
			if err != nil {
				return fmt.Errorf("compile hook %s version %d: %w", key, version, err)
			}
			if program == nil {
				return fmt.Errorf("%w: engine returned nil program", ErrInvalidDefinition)
			}
			compiled[key][version] = compiledDefinition{definition: definition, program: program}
			if definition.Enabled && definition.Active {
				if activeVersion != 0 {
					return fmt.Errorf("%w: multiple active versions for %s", ErrInvalidDefinition, key)
				}
				activeVersion = version
			}
		}
		if activeVersion == 0 {
			return fmt.Errorf("%w: no active version for %s", ErrInvalidDefinition, key)
		}
		active[key] = activeVersion
	}
	r.compiled = compiled
	r.active = active
	for _, binding := range r.bindings {
		if err := r.validateBindingTargetLocked(binding); err != nil {
			return err
		}
	}
	r.frozen = true
	return nil
}

func (r *Registry) resolve(key string, version int) (compiledDefinition, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if !r.frozen {
		return compiledDefinition{}, ErrRegistryNotFrozen
	}
	if version == 0 {
		version = r.active[key]
	}
	definition, exists := r.compiled[key][version]
	if !exists || !definition.definition.Enabled {
		return compiledDefinition{}, ErrHookNotFound
	}
	return definition, nil
}

func (r *Registry) binding(key string) (Binding, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if !r.frozen {
		return Binding{}, ErrRegistryNotFrozen
	}
	binding, exists := r.bindings[key]
	if !exists || !binding.Enabled {
		return Binding{}, ErrBindingNotFound
	}
	binding.Config = cloneRaw(binding.Config)
	return binding, nil
}

func (r *Registry) bindingFor(resourceURI vfs.URI, hookKey string) (Binding, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if !r.frozen {
		return Binding{}, ErrRegistryNotFrozen
	}
	for _, binding := range r.bindings {
		if binding.Enabled && binding.ResourceURI == resourceURI && binding.HookKey == hookKey {
			binding.Config = cloneRaw(binding.Config)
			return binding, nil
		}
	}
	return Binding{}, ErrBindingNotFound
}

func (r *Registry) validateBindingTargetLocked(binding Binding) error {
	if !binding.Enabled {
		return nil
	}
	version := binding.Version
	if version == 0 {
		version = r.active[binding.HookKey]
	}
	definition, exists := r.compiled[binding.HookKey][version]
	if !exists || !definition.definition.Enabled {
		return fmt.Errorf("%w: binding %s target", ErrHookNotFound, binding.Key)
	}
	return nil
}

func sameBinding(left, right Binding) bool {
	return left.Key == right.Key && left.HookKey == right.HookKey && left.Version == right.Version && left.ResourceURI == right.ResourceURI && left.Enabled == right.Enabled && bytes.Equal(left.Config, right.Config)
}

func validateDefinition(def Definition) error {
	if !hookKeyPattern.MatchString(def.Key) || def.Version <= 0 || !hookKeyPattern.MatchString(def.Engine) || def.Script == nil || def.InputSchema == nil || def.OutputSchema == nil || def.ValidateInput == nil || def.ValidateOutput == nil {
		return ErrInvalidDefinition
	}
	if def.Limits.Timeout < 0 || def.Limits.MaxSteps < 0 || def.Limits.MaxInputBytes < 0 || def.Limits.MaxOutputBytes < 0 {
		return ErrInvalidDefinition
	}
	return nil
}

func withDefaultLimits(def Definition) Definition {
	if def.Limits.Timeout == 0 {
		def.Limits.Timeout = 10 * time.Second
	}
	if def.Limits.MaxSteps == 0 {
		def.Limits.MaxSteps = 32
	}
	if def.Limits.MaxInputBytes == 0 {
		def.Limits.MaxInputBytes = 256 << 10
	}
	if def.Limits.MaxOutputBytes == 0 {
		def.Limits.MaxOutputBytes = 256 << 10
	}
	return def
}

func defaultJSON(value json.RawMessage) json.RawMessage {
	if len(value) == 0 {
		return json.RawMessage(`{}`)
	}
	return value
}
func cloneRaw(value json.RawMessage) json.RawMessage { return append(json.RawMessage(nil), value...) }
