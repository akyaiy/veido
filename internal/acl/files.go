package acl

import (
	"net/http"
	"strings"
)

/************************************************************************
 * filesActionFromMethod вычисления действия по HTTP-методу
 ************************************************************************/
func filesActionFromMethod(method string) string {
	switch method {
	case "GET", "HEAD", "PROPFIND":
		return "read"
	case "PUT", "POST":
		return "write"
	case "DELETE":
		return "delete"
	case "MKCOL":
		return "mkdir"
	case "MOVE", "COPY":
		return "move"
	case "LOCK", "UNLOCK":
		return "lock"
	default:
		return "unknown"
	}
}

/***************************************************************************
 * Эта функция формирует строку permission для WebDav
 *
 * Результат — строка вида:
 * files.<action>[.<path>]
 ***************************************************************************/
func FilesPermissionFromRequestWebDav(r *http.Request) string {
	// превращает HTTP-запрос к файловой системе в строку permission
	return filesPermissionFromRequest(r)
}

/***************************************************************************
 * Эта функция формирует строку permission для REST
 *
 * Результат — строка вида:
 * files.<action>[.<path>]
 ***************************************************************************/
func FilesPermissionFromRequestREST(r *http.Request) string {
	// превращает HTTP-запрос к файловой системе в строку permission
	return filesPermissionFromRequest(r)
}

/*************************************************************************
 * filesPathFromRequest извлекает путь каталога из HTTP-запроса и
 * возвращает его в формате:
 * dir.subdir.subsubdir
 *************************************************************************/
func filesPathFromRequest(r *http.Request) string {
	// Получение пути из HTTP-запроса
	path := r.URL.Path
	// Определение типа запроса (REST или WebDAV)
	switch {
	case strings.HasPrefix(path, "/dav/"):
		path = strings.TrimPrefix(path, "/dav/")
	case strings.HasPrefix(path, "/api/files/"):
		path = strings.TrimPrefix(path, "/api/files/")
	default:
		return ""
	}
	// Удаление слэшей по краям
	path = strings.Trim(path, "/")
	// Проверка на корневой каталог
	if path == "" {
		return ""
	}
	// Разбиение пути на сегменты
	parts := strings.Split(path, "/")
	// Проверка: файл или каталог
	if strings.Contains(parts[len(parts)-1], ".") {
		parts = parts[:len(parts)-1]
	}
	// Формирование итоговой строки
	return strings.Join(parts, ".")
}

/****************************************************************
 * filesPermissionFromRequest превращает HTTP-запрос к файловой системе
 * (REST или WebDAV) в строку permission (права доступа) вида:
 * files.<action>[.<path>]
 ****************************************************************/
func filesPermissionFromRequest(r *http.Request) string {
	// Определение действия по HTTP-методу
	action := filesActionFromMethod(r.Method)
	// Bзвлекает путь каталога из HTTP-запроса
	path := filesPathFromRequest(r)
	// Обработка корневого каталога
	if path == "" {
		return "files." + action
	}
	// Формирование строки permission
	return "files." + action + "." + path
}
