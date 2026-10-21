package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"reflect"
	"time"

	"MyServer/internal/timeconverter"

	"gopkg.in/yaml.v3"
)

// Генерация случайного секрета (32 байта)
func generateSecret() string {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		log.Fatalf("Cannot generate secret: %v", err)
	}
	return hex.EncodeToString(b)
}

type Config struct {
	Mode 	  string `yaml:"mode"`
	Port         string `yaml:"port"`
	FunctionDir  string `yaml:"functiondir"`
	StaticDir    string `yaml:"staticdir"`
	HTTPBlockDir string `yaml:"httpblockdir"`
	TemplateFile string `yaml:"templatefile"`
	LogServFile  string `yaml:"logservfile"`
	LogUserFile  string `yaml:"loguserfile"`
	LogErrFile   string `yaml:"logerrfile"`
	DB           string `yaml:"db"`
	ATokenTime   string `yaml:"atokentime"`
	RTokenTime   string `yaml:"rtokentime"`
	STimeoutTime string `yaml:"stimeouttime"`
	MySecret     string `yaml:"mysecret"`
	CASdir       string `yaml:"casdir"`
}

var Data *Config

// Дефолтные данные, если файла нет
var defaultConfig = Config{
	Mode:         "release",
	Port:         ":8080",
	FunctionDir:  "./data/functions",
	StaticDir:    "./data/HTML/frontend",
	HTTPBlockDir: "./data/HTML/block",
	TemplateFile: "/index.html",
	LogServFile:  "./data/log/server.log",
	LogUserFile:  "./data/log/user.log",
	LogErrFile:   "./data/log/error.log",
	DB:           "./data/db/data.db",
	ATokenTime:   "15m",
	RTokenTime:   "24h",
	STimeoutTime: "15s",
	MySecret:     generateSecret(),
	CASdir:       "./data/CAS",
}

func LoadData(path string) {
	_, err := os.Stat(path)
	// Если файла нет — создаём его
	if os.IsNotExist(err) {
		log.Printf("Config file not found. Creating default: %s", path)
		bytes, err := yaml.Marshal(defaultConfig)
		if err != nil {
			log.Fatalf("Cannot marshal default config: %v", err)
		}
		if err := os.WriteFile(path, bytes, 0644); err != nil {
			log.Fatalf("Cannot write default config: %v", err)
		}
	}
	// Читаем файл (уже существующий или созданный)
	fdata, err := os.ReadFile(path)
	if err != nil {
		log.Fatalf("Cannot read config: %v", err)
	}
	Data = &Config{} // инициализация структуры
	if err := yaml.Unmarshal(fdata, Data); err != nil {
		log.Fatalf("Cannot parse config: %v", err)
	}
}

// GetTimeFild принемает строку с именем поля из структуры конфига
// допустимые значения:	ATokenTime,	RTokenTime,	STimeoutTime.
// Возвращает время в формате Duration
func GetTimeField(s string) (time.Duration, error) {
	v := reflect.ValueOf(Data)
	// Если Data — указатель → разыменовываем
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	field := v.FieldByName(s)
	if !field.IsValid() {
		return 0, fmt.Errorf("несуществующее поле: %s", s)
	}
	if field.Kind() != reflect.String {
		return 0, fmt.Errorf("поле %s не является строкой", s)
	}
	value := field.String()
	d, err := timeconverter.Parse(value)
	if err != nil {
		return 0, fmt.Errorf("ошибка парсинга значения поля %s: %w", s, err)
	}
	return d.ToDuration(), nil
}

func GetSTimeoutTime() time.Duration {
	d, _ := timeconverter.Parse(Data.STimeoutTime)
	return d.ToDuration()
}

func GetRTokenTime() time.Duration {
	d, _ := timeconverter.Parse(Data.RTokenTime)
	return d.ToDuration()
}

func GetATokenTime() time.Duration {
	d, _ := timeconverter.Parse(Data.ATokenTime)
	return d.ToDuration()
}
