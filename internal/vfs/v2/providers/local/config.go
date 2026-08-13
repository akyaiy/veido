package local

import (
	"encoding/json"
	"fmt"
	"strings"
)

const (
	ProviderKey = "local"

	accountDir = "%account%"

	ModeBootstrap = "bootstrap"
	ModeAccount   = "account"
)

type Config struct {
	Mode        string `json:"mode"`
	SubjectKey  string `json:"subject_key,omitempty"`
	Secret      string `json:"secret,omitempty"`
	StoragePath string `json:"storage_path,omitempty"`
}

func parseConfig(data []byte) (Config, error) {
	if len(strings.TrimSpace(string(data))) == 0 {
		data = []byte(`{"mode":"bootstrap"}`)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return Config{}, fmt.Errorf("invalid local config: %w", err)
	}

	cfg.Mode = strings.TrimSpace(cfg.Mode)
	cfg.SubjectKey = strings.TrimSpace(cfg.SubjectKey)
	cfg.Secret = strings.TrimSpace(cfg.Secret)
	cfg.StoragePath = strings.TrimSpace(cfg.StoragePath)
	if cfg.Mode == "" {
		cfg.Mode = ModeBootstrap
	}
	return cfg, nil
}
