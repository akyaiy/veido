package local

const (
	ProviderKey = "local"

	accountDir = "%account%"

	ModeBootstrap = "bootstrap"
	ModeAccount   = "account"
)

type Config struct {
	Mode        string `json:"mode"`
	SubjectKey  string `json:"subject_key,omitempty"`
	Secret      string `json:"secret,omitempty" secret:"true"`
	StoragePath string `json:"storage_path,omitempty"`
}
