package files

import (
	"io"
	"os"
	"path/filepath"
	"strings"
)

var BaseDir string

func SafePath(p string) (string, error) {
	// "/" или "" считаем корнем
	if p == "" || p == "/" {
		return BaseDir, nil
	}

	// убираем ведущий "/"
	p = strings.TrimPrefix(p, "/")

	clean := filepath.Clean(p)
	full := filepath.Join(BaseDir, clean)

	rel, err := filepath.Rel(BaseDir, full)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(rel, "..") {
		return "", os.ErrPermission
	}

	return full, nil
}

func ListDir(p string) ([]os.FileInfo, error) {
	full, err := SafePath(p)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(full)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return f.Readdir(-1)
}

func DownloadFile(p string) (string, error) {
	full, err := SafePath(p)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(full)
	if err != nil || info.IsDir() {
		return "", os.ErrInvalid
	}
	return full, nil
}

func UploadFile(p string, content io.Reader) error {
	full, err := SafePath(p)
	if err != nil {
		return err
	}
	out, err := os.Create(full)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, content)
	return err
}

func DeletePath(p string) error {
	full, err := SafePath(p)
	if err != nil {
		return err
	}
	return os.RemoveAll(full)
}

func MkdirPath(p string) error {
	full, err := SafePath(p)
	if err != nil {
		return err
	}
	return os.Mkdir(full, 0755)
}
