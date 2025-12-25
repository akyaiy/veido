package main

import (
	"MyServer/internal/acl"
	"MyServer/internal/app"
	"MyServer/internal/auth"
	"MyServer/internal/config"
	"MyServer/internal/sqliteDB"

	_ "github.com/mattn/go-sqlite3"
)

// // GenerateMockData создает n папок и n файлов в указанном базовом каталоге
// func GenerateMockData(baseDir string, count int) error {
// 	// 1. Создаем базовый каталог, если его нет
// 	if err := os.MkdirAll(baseDir, 0755); err != nil {
// 		return fmt.Errorf("ошибка создания базы: %v", err)
// 	}

// 	for i := 1; i <= count; i++ {
// 		// Генерируем имя папки, например: data/files/users/dir_001
// 		dirName := filepath.Join(baseDir, fmt.Sprintf("dir_%03d", i))
// 		if err := os.MkdirAll(dirName, 0755); err != nil {
// 			return fmt.Errorf("ошибка создания папки %s: %v", dirName, err)
// 		}

// 		// Генерируем имя файла внутри этой папки, например: .../dir_001/file_001.txt
// 		fileName := filepath.Join(dirName, fmt.Sprintf("file_%03d.txt", i))

// 		// Создаем файл и записываем в него немного данных
// 		content := []byte(fmt.Sprintf("Это содержимое файла номер %d", i))
// 		if err := os.WriteFile(fileName, content, 0644); err != nil {
// 			return fmt.Errorf("ошибка создания файла %s: %v", fileName, err)
// 		}
// 	}

// 	return nil
// }

func main() {

	// // Путь к папке (соответствует вашему проекту 2025 года)
	// targetPath := "./data/files/users/admin"

	// fmt.Println("Генерация файлов...")
	// err := GenerateMockData(targetPath, 100)
	// if err != nil {
	// 	fmt.Printf("Произошла ошибка: %v\n", err)
	// 	return
	// }
	// fmt.Printf("Успешно создано 100 папок и 100 файлов в %s\n", targetPath)

	config.LoadData("./data/config.yaml")
	db := sqliteDB.InitDB(config.Data.DB)
	defer db.Close()
	aut := auth.NewAuth(db, []byte(config.Data.MySekret))
	acl.InitACL(db)
	app.ServerStart(db, aut)
}
