package config

import (
	"log"
	"os"

	"gopkg.in/yaml.v3"
)

/*
********************************************

	srv := &http.Server{
		Handler:      r,
		Addr:         ":8080",
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

**********************************************
*/
type Config struct {
	Port         int    `yaml:"port"`
	FunctionDir  string `yaml:"functiondir"`
	StaticDir    string `yaml:"staticdir"`
	TemplateFile string `yaml:"templatefile"`
	LogServFile  string `yaml:"logservfile"`
	LogUserFile  string `yaml:"loguserfile"`
	LogErrFile   string `yaml:"logerrfile"`
	PathDB       string `yaml:"pathdb"`
	ATokenTime   string `yaml:"atokentime"`
	RTokenTime   string `yaml:"rtokentime"`
	WriteTimeout string `yaml:"WriteTimeout"`
	ReadTimeout  string `yaml:"ReadTimeout"`
}

var Data *Config

func LoadData(path string) {
	fdata, err := os.ReadFile(path)
	if err != nil {
		log.Fatalf("Cannot read config: %v", err)
	}
	if err := yaml.Unmarshal(fdata, &Data); err != nil {
		log.Fatalf("Cannot parse config: %v", err)
	}
}
