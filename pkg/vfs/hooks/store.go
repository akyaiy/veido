package hooks

import (
	"context"
	"fmt"
	"sync"
)

type MemoryExecutionStore struct {
	mu      sync.Mutex
	records map[string]ExecutionRecord
	byKey   map[string]string
}

func NewMemoryExecutionStore() *MemoryExecutionStore {
	return &MemoryExecutionStore{records: map[string]ExecutionRecord{}, byKey: map[string]string{}}
}

func (s *MemoryExecutionStore) Begin(_ context.Context, proposed ExecutionRecord) (ExecutionRecord, BeginDisposition, error) {
	if s == nil || proposed.ID == "" {
		return ExecutionRecord{}, "", fmt.Errorf("invalid execution record")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if proposed.IdempotencyKey != "" {
		key := executionKey(proposed)
		if existingID, exists := s.byKey[key]; exists {
			existing := cloneRecord(s.records[existingID])
			if existing.InputHash != proposed.InputHash {
				return existing, BeginConflict, nil
			}
			if existing.Status == "running" {
				return existing, BeginInProgress, nil
			}
			return existing, BeginCached, nil
		}
		s.byKey[key] = proposed.ID
	}
	proposed.Status = "running"
	s.records[proposed.ID] = cloneRecord(proposed)
	return cloneRecord(proposed), BeginStarted, nil
}

func (s *MemoryExecutionStore) Complete(_ context.Context, id string, result Result) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	record, exists := s.records[id]
	if !exists || record.Status != "running" {
		return fmt.Errorf("execution %s is not running", id)
	}
	record.Status = "completed"
	record.Result = cloneResult(result)
	s.records[id] = record
	return nil
}

func (s *MemoryExecutionStore) Fail(_ context.Context, id string, runErr *RunError) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	record, exists := s.records[id]
	if !exists || record.Status != "running" {
		return fmt.Errorf("execution %s is not running", id)
	}
	record.Status = "failed"
	record.Error = cloneRunError(runErr)
	s.records[id] = record
	return nil
}

func executionKey(record ExecutionRecord) string {
	return record.ActorKey + "\x00" + record.HookKey + "\x00" + fmt.Sprint(record.Version) + "\x00" + record.IdempotencyKey
}

func cloneRecord(record ExecutionRecord) ExecutionRecord {
	record.Result = cloneResult(record.Result)
	record.Error = cloneRunError(record.Error)
	return record
}
func cloneResult(result Result) Result {
	result.Output = cloneRaw(result.Output)
	return result
}
func cloneRunError(runErr *RunError) *RunError {
	if runErr == nil {
		return nil
	}
	copy := *runErr
	return &copy
}
