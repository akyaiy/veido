// Package serverapp owns the pre-production server composition root.
package serverapp

import (
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv  string
	HTTP    HTTPConfig
	DBPath  string
	CASPath string
	JWT     JWTConfig
	Refresh CookieConfig
	Site    SiteConfig
}

type HTTPConfig struct {
	Addr                                                    string
	ReadTimeout, WriteTimeout, IdleTimeout, ShutdownTimeout time.Duration
}

type JWTConfig struct {
	Secret, Issuer, Audience string
	AccessTTL, RefreshTTL    time.Duration
}
type CookieConfig struct {
	Name     string
	TTL      time.Duration
	Secure   bool
	SameSite string
}
type SiteConfig struct {
	URI         string
	Entrypoint  string
	TemplateKey string
}

func LoadConfig() (Config, error) {
	file := strings.TrimSpace(os.Getenv("APP_ENV_FILE"))
	if file == "" {
		file = ".env"
	}
	if err := loadEnv(file); err != nil {
		return Config{}, err
	}
	cfg := Config{
		AppEnv: env("APP_ENV", "development"), DBPath: strings.TrimSpace(os.Getenv("DB_PATH")), CASPath: strings.TrimSpace(os.Getenv("CAS_PATH")),
		JWT:     JWTConfig{Secret: os.Getenv("JWT_SECRET"), Issuer: env("JWT_ISSUER", "jwtproject2"), Audience: env("JWT_AUDIENCE", "jwtproject2")},
		Refresh: CookieConfig{Name: env("REFRESH_COOKIE_NAME", "refresh_token"), SameSite: env("COOKIE_SAME_SITE", "lax")},
		Site:    SiteConfig{URI: strings.TrimSpace(os.Getenv("SITE_URI")), Entrypoint: env("SITE_ENTRYPOINT", "index.html"), TemplateKey: env("SITE_TEMPLATE_KEY", "default-spa")},
	}
	var err error
	if cfg.HTTP.Addr, err = address("HTTP_ADDR", ":8080"); err != nil {
		return Config{}, err
	}
	if cfg.HTTP.ReadTimeout, err = duration("HTTP_READ_TIMEOUT", "15s"); err != nil {
		return Config{}, err
	}
	if cfg.HTTP.WriteTimeout, err = duration("HTTP_WRITE_TIMEOUT", "30s"); err != nil {
		return Config{}, err
	}
	if cfg.HTTP.IdleTimeout, err = duration("HTTP_IDLE_TIMEOUT", "60s"); err != nil {
		return Config{}, err
	}
	if cfg.HTTP.ShutdownTimeout, err = duration("HTTP_SHUTDOWN_TIMEOUT", "10s"); err != nil {
		return Config{}, err
	}
	if cfg.JWT.AccessTTL, err = duration("JWT_ACCESS_TTL", "15m"); err != nil {
		return Config{}, err
	}
	if cfg.JWT.RefreshTTL, err = duration("JWT_REFRESH_TTL", "720h"); err != nil {
		return Config{}, err
	}
	if cfg.Refresh.TTL, err = duration("JWT_REFRESH_TTL", "720h"); err != nil {
		return Config{}, err
	}
	if cfg.Refresh.Secure, err = boolean("COOKIE_SECURE", false); err != nil {
		return Config{}, err
	}
	if cfg.Refresh.SameSite, err = sameSite(cfg.Refresh.SameSite); err != nil {
		return Config{}, err
	}
	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func loadEnv(file string) error {
	if strings.TrimSpace(file) == "" {
		return nil
	}
	if _, err := os.Stat(file); errors.Is(err, os.ErrNotExist) {
		return nil
	} else if err != nil {
		return fmt.Errorf("read env file: %w", err)
	}
	if err := godotenv.Load(file); err != nil {
		return fmt.Errorf("load env file: %w", err)
	}
	return nil
}
func (c Config) Validate() error {
	if c.AppEnv != "development" && c.AppEnv != "production" && c.AppEnv != "test" {
		return fmt.Errorf("APP_ENV has unknown value %q", c.AppEnv)
	}
	if strings.TrimSpace(c.DBPath) == "" {
		return errors.New("DB_PATH is required")
	}
	if strings.TrimSpace(c.CASPath) == "" {
		return errors.New("CAS_PATH is required")
	}
	if len(c.JWT.Secret) < 32 {
		return errors.New("JWT_SECRET must contain at least 32 bytes")
	}
	if c.JWT.AccessTTL <= 0 || c.JWT.RefreshTTL <= 0 || c.Refresh.TTL <= 0 {
		return errors.New("token and refresh cookie TTLs must be positive")
	}
	if _, _, err := net.SplitHostPort(c.HTTP.Addr); err != nil {
		return fmt.Errorf("HTTP_ADDR: %w", err)
	}
	if c.HTTP.ReadTimeout <= 0 || c.HTTP.WriteTimeout <= 0 || c.HTTP.IdleTimeout <= 0 || c.HTTP.ShutdownTimeout <= 0 {
		return errors.New("HTTP timeouts must be positive")
	}
	if c.Refresh.SameSite == "" {
		return errors.New("COOKIE_SAME_SITE is invalid")
	}
	if c.Refresh.Name == "" {
		return errors.New("cookie names are required")
	}
	siteURI, err := parseSiteURI(c.Site.URI)
	if err != nil {
		return err
	}
	if siteURI.Provider() != "html" || siteURI.ScopeKey() == "" || siteURI.ScopeKey() == "system" || siteURI.Path() != "/" || strings.TrimSpace(c.Site.Entrypoint) == "" {
		return errors.New("SITE_URI must name the root of a non-system HTML site scope and SITE_ENTRYPOINT is required")
	}
	return nil
}
func env(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return strings.TrimSpace(value)
	}
	return fallback
}
func duration(key, fallback string) (time.Duration, error) {
	value := env(key, fallback)
	d, err := time.ParseDuration(value)
	if err != nil || d <= 0 {
		return 0, fmt.Errorf("%s must be a positive duration", key)
	}
	return d, nil
}
func boolean(key string, fallback bool) (bool, error) {
	value := env(key, fmt.Sprint(fallback))
	switch value {
	case "true":
		return true, nil
	case "false":
		return false, nil
	default:
		return false, fmt.Errorf("%s must be true or false", key)
	}
}
func sameSite(value string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "lax", "strict", "none":
		return strings.ToLower(strings.TrimSpace(value)), nil
	default:
		return "", errors.New("COOKIE_SAME_SITE must be lax, strict or none")
	}
}
func address(key, fallback string) (string, error) {
	value := env(key, fallback)
	if _, _, err := net.SplitHostPort(value); err != nil {
		return "", fmt.Errorf("%s: %w", key, err)
	}
	return value, nil
}
func (c Config) EnsureDirectories() error { return os.MkdirAll(filepath.Clean(c.CASPath), 0o750) }
