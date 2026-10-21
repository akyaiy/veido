package hooks

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"sync"
	"time"
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
	frozen      bool
}

func NewRegistry(engines map[string]Engine) *Registry {
	copyEngines := make(map[string]Engine, len(engines))
	for key, engine := range engines {
		copyEngines[key] = engine
	}
	return &Registry{engines: copyEngines, definitions: map[string]map[int]Definition{}, compiled: map[string]map[int]compiledDefinition{}, active: map[string]int{}}
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
