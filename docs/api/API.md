# API Documentation

Полное описание внешнего API для фронтендера.

**Базовый URL:** `http://localhost:{PORT}/api`

---

## Оглавление

1. [Аутентификация и авторизация](#аутентификация-и-авторизация)
2. [Пользователи (Users)](#пользователи-users)
3. [Управление доступом (ACL Admin)](#управление-доступом-acl-admin)
4. [HTML Блоки и Страницы](#html-блоки-и-страницы)
5. [Функции](#функции)
6. [Файлы](#файлы)
7. [WebDAV](#webdav)
8. [Защищённые эндпоинты](#защищённые-эндпоинты)

---

## Аутентификация и авторизация

### Описание системы аутентификации

Система аутентификации основана на JWT токенах с двухуровневой структурой:
- **Access Token**: Краткосрочный JWT токен для доступа к защищённым ресурсам. Передаётся в заголовке `Authorization: Bearer {token}`. Время жизни зависит от конфигурации.
- **Refresh Token**: Долгосрочный JWT токен для получения нового access token без переаутентификации. Хранится в HttpOnly cookie с флагом SameSite=Lax.

### Механизм безопасности

- **Хеширование паролей**: Все пароли хешируются алгоритмом bcrypt перед сохранением в БД
- **Whitelist токенов**: При logout токен добавляется в чёрный список для предотвращения его повторного использования
- **Парные токены**: Access и refresh токены связаны через `pair_jti` для синхронизации при обновлении
- **Цифровая подпись**: JWT токены подписаны алгоритмом HS256 с использованием секретного ключа из конфигурации

### Статусы пользователя

Каждый пользователь имеет статус:
- `active`: Активный пользователь с полными правами
- `blocked`: Заблокированный пользователь (не может войти)
- `inactive`: Неактивный пользователь

### Требуемые права доступа

Все endpoints защищены ACL (Access Control List). При запросе проверяется наличие соответствующего permission у role пользователя.

### Возможные коды ошибок аутентификации

| Код | Ошибка | Описание |
|-----|--------|---------|
| 401 | Unauthorized | Токен отсутствует, истёк, невалиден или пользователь не авторизован |
| 403 | Forbidden | Пользователь авторизован, но не имеет требуемых прав доступа |
| 400 | Bad Request | Некорректный формат учётных данных или отсутствуют обязательные поля |
| 409 | Conflict | Пользователь с таким именем уже существует |
| 500 | Internal Server Error | Ошибка на сервере (хеширование, БД, создание токена)

---

## Пользователи (Users)

### POST `/users/register`
Регистрация нового пользователя.

**Требуемое право:** `users.register`

**Request:**
```json
{
  "username": "john_doe",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "message": "user created"
}
```

**Возможные ошибки:**
- `409 Conflict`: Пользователь с таким именем уже существует
- `400 Bad Request`: Некорректный формат данных

---

### POST `/users/login`
Аутентификация пользователя и получение токенов.

**Требуемое право:** `users.login`

**Request:**
```json
{
  "username": "john_doe",
  "password": "securePassword123"
}
```

**Response (200 OK):**
- **Headers:**
  - `Set-Cookie: refresh_token={token}; HttpOnly; SameSite=Lax`
- **Body:**
  ```json
  {
    "access_token": "eyJhbGc...",
    "expires_in": 3600,
    "user": {
      "id": 1,
      "username": "john_doe"
    }
  }
  ```

**Возможные ошибки:**
- `401 Unauthorized`: Неверные учётные данные
- `400 Bad Request`: Пользователь не найден

---

### POST `/users/refresh`
Обновление access token с использованием refresh token.

**Требуемое право:** Нет (публичный эндпоинт)

**Request:**
- Должен содержать cookie `refresh_token`

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGc...",
  "expires_in": 3600
}
```

**Возможные ошибки:**
- `401 Unauthorized`: Refresh token истёк или невалиден

---

### POST `/users/logout`
Выход пользователя (инвалидация токена на сервере).

**Требуемое право:** `users.logout`

**Request:**
- Headers: `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "status": "ok",
  "message": "logged out"
}
```

---

### GET `/users/getUserData`
Получение данных текущего пользователя.

**Требуемое право:** `users.read`

**Request:**
- Headers: `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com"
}
```

**Возможные ошибки:**
- `401 Unauthorized`: Не авторизован

---

### GET `/users/getUsersNames`
Получение списка всех пользователей (только ID и username).

**Требуемое право:** `users.list`

**Request:**
- Headers: `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "username": "john_doe"
  },
  {
    "id": 2,
    "username": "jane_smith"
  }
]
```

---

### POST `/users/update_password`
Обновление пароля пользователя.

**Требуемое право:** `users.update_password`

**Request:**
```json
{
  "username": "john_doe",
  "password": "newSecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

---

### DELETE `/users/delete_user`
Удаление пользователя.

**Требуемое право:** `users.delete`

**Request:**
```json
{
  "username": "john_doe"
}
```

**Response (200 OK):**
```json
{
  "status": "deleted"
}
```

**Возможные ошибки:**
- `404 Not Found`: Пользователь не найден

---

## Управление доступом (ACL Admin)

### Роли (Roles)

#### GET `/acl-admin/roles`
Получение списка всех ролей с пагинацией.

**Требуемое право:** `acl.roles.list.get`

**Query Parameters:**
- `limit`: Количество записей (default: 10)
- `offset`: Смещение (default: 0)

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "admin"
  },
  {
    "id": 2,
    "name": "user"
  }
]
```

---

#### POST `/acl-admin/roles`
Создание новой роли.

**Требуемое право:** `acl.roles.create`

**Request:**
```json
{
  "name": "editor"
}
```

**Валидация:**
- Только буквы, цифры, `_` и `-`
- Не может быть пустой

**Response (201 Created):**
```json
{
  "status": "ok"
}
```

**Возможные ошибки:**
- `409 Conflict`: Роль с таким именем уже существует
- `400 Bad Request`: Невалидные символы

---

#### PATCH `/acl-admin/roles/{roleId}`
Обновление роли.

**Требуемое право:** `acl.roles.update`

**URL Parameters:**
- `roleId`: ID роли (целое число)

**Request:**
```json
{
  "id": 1,
  "name": "super_admin"
}
```

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

**Возможные ошибки:**
- `409 Conflict`: Роль не существует или имя уже занято
- `400 Bad Request`: Невалидный ID

---

#### DELETE `/acl-admin/roles/{roleId}`
Удаление роли.

**Требуемое право:** `acl.roles.delete`

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

---

### Права доступа (Permissions)

#### GET `/acl-admin/perms`
Получение списка всех прав доступа с пагинацией.

**Требуемое право:** `acl.permissions.list.get`

**Query Parameters:**
- `limit`: Количество записей (default: 10)
- `offset`: Смещение (default: 0)

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "key": "users.register"
  },
  {
    "id": 2,
    "key": "users.login"
  }
]
```

---

#### POST `/acl-admin/perms`
Создание нового права доступа.

**Требуемое право:** `acl.permission.create`

**Request:**
```json
{
  "key": "files.delete"
}
```

**Валидация:**
- Только буквы, цифры, `_`, `-` и `.`
- Рекомендуется использовать формат: `module.action`
- Не может быть пустой

**Response (201 Created):**
```json
{
  "status": "ok"
}
```

**Возможные ошибки:**
- `409 Conflict`: Право с таким ключом уже существует
- `400 Bad Request`: Невалидные символы

---

#### PATCH `/acl-admin/perms/{permId}`
Обновление права доступа.

**Требуемое право:** `acl.permission.update`

**URL Parameters:**
- `permId`: ID права (целое число)

**Request:**
```json
{
  "id": 1,
  "key": "files.read.all"
}
```

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

**Возможные ошибки:**
- `409 Conflict`: Право не существует или ключ уже занят
- `400 Bad Request`: Невалидный ID

---

#### DELETE `/acl-admin/perms/{permId}`
Удаление права доступа.

**Требуемое право:** `acl.permission.delete`

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

---

### Отношения между Ролями и Правами

#### GET `/acl-admin/roles/{roleId}/perms`
Получение прав доступа роли с пагинацией.

**Требуемое право:** `acl.roles.permissions.list.get`

**Query Parameters:**
- `limit`: Количество записей
- `offset`: Смещение

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "key": "users.login"
  },
  {
    "id": 2,
    "key": "users.register"
  }
]
```

**Возможные ошибки:**
- `400 Bad Request`: Невалидный ID роли
- `404 Not Found`: Роль не найдена

---

#### POST `/acl-admin/roles/{roleId}/perms`
Назначение права доступа роли.

**Требуемое право:** `acl.permission.assign`

**Request:**
```json
{
  "permId": 5
}
```

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

**Возможные ошибки:**
- `409 Conflict`: Право уже назначено или не существует
- `400 Bad Request`: Невалидный ID

---

#### DELETE `/acl-admin/roles/{roleId}/perms/{permId}`
Отзыв права доступа у роли.

**Требуемое право:** `acl.permission.deassign`

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

**Возможные ошибки:**
- `409 Conflict`: Связь не существует
- `400 Bad Request`: Невалидные ID

---

### Отношения между Пользователями и Ролями

#### GET `/acl-admin/users/{userId}/roles`
Получение ролей пользователя с пагинацией.

**Требуемое право:** `acl.user.roles.list.get`

**URL Parameters:**
- `userId`: ID пользователя

**Query Parameters:**
- `limit`: Количество записей
- `offset`: Смещение

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "admin"
  },
  {
    "id": 3,
    "name": "moderator"
  }
]
```

**Возможные ошибки:**
- `400 Bad Request`: Невалидный ID пользователя
- `404 Not Found`: Пользователь не найден

---

#### POST `/acl-admin/users/{userId}/roles`
Назначение роли пользователю.

**Требуемое право:** `acl.user.roles.assign`

**Request:**
```json
{
  "roleId": 2
}
```

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

**Возможные ошибки:**
- `409 Conflict`: Роль уже назначена или пользователь/роль не существует
- `400 Bad Request`: Невалидный ID

---

#### DELETE `/acl-admin/users/{userId}/roles/{roleId}`
Отзыв роли у пользователя.

**Требуемое право:** `acl.user.roles.deassign`

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

**Возможные ошибки:**
- `409 Conflict`: Связь не существует
- `400 Bad Request`: Невалидные ID

---

### Прямые права пользователя

#### GET `/acl-admin/users/{userId}/perms`
Получение всех прав доступа пользователя (через роли и напрямую) с возможностью проверки конкретного права.

**Требуемое право:** `acl.user.permissions.list.get`

**URL Parameters:**
- `userId`: ID пользователя

**Query Parameters:**
- `permission`: (опционально) ID права для проверки наличия
- `limit`: Количество записей (при получении списка)
- `offset`: Смещение (при получении списка)

**Response (200 OK) - При запросе списка:**
```json
[
  {
    "id": 1,
    "key": "users.login",
    "name": "users.login"
  },
  {
    "id": 5,
    "key": "files.write",
    "name": "files.write"
  }
]
```

**Response (200 OK) - При проверке конкретного права (?permission=1):**
```json
{
  "id": 1,
  "key": "users.login",
  "hasPermission": true
}
```

**Возможные ошибки:**
- `400 Bad Request`: Невалидный ID пользователя или права
- `404 Not Found`: Пользователь не найден

---

### Проверка собственных прав (Self)

#### GET `/acl-admin/me/roles`
Получение ролей текущего авторизованного пользователя.

**Требуемое право:** `acl.self.roles.get`

**Query Parameters:**
- `limit`: Количество записей (default: 10)
- `offset`: Смещение (default: 0)

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "admin"
  }
]
```

**Возможные ошибки:**
- `401 Unauthorized`: Не авторизован
- `404 Not Found`: Пользователь не найден (в базе)

---

#### GET `/acl-admin/me/perms`
Получение всех прав доступа текущего авторизованного пользователя или проверка конкретного права.

**Требуемое право:** `acl.self.permissions.check`

**Query Parameters:**
- `permission`: (опционально) ID права для проверки наличия
- `limit`: Количество записей (при получении списка)
- `offset`: Смещение (при получении списка)

**Response (200 OK) - При запросе списка:**
```json
[
  {
    "id": 1,
    "key": "users.login",
    "name": "users.login"
  },
  {
    "id": 2,
    "key": "users.register",
    "name": "users.register"
  }
]
```

**Response (200 OK) - При проверке конкретного права (?permission=1):**
```json
{
  "id": 1,
  "key": "users.login",
  "hasPermission": true
}
```

**Возможные ошибки:**
- `401 Unauthorized`: Не авторизован
- `400 Bad Request`: Невалидный ID права
- `404 Not Found`: Пользователь не найден

---

## HTML Блоки и Страницы

### GET `/HTML/*`
Загрузка HTML блока или страницы.

**Требуемое право:** `html.view.*`

**URL Примеры:**
- `/api/HTML/home` - главная страница
- `/api/HTML/about` - о проекте
- `/api/HTML/block/menu/top1` - блок меню

**Response (200 OK):**
```json
{
  "content": "# Заголовок\nСодержание в Markdown",
  "js": "console.log('page loaded');",
  "css": "body { color: #333; }",
  "tipe": "page"
}
```

**Структура каталога:**
```
data/HTML/
├── pages/
│   ├── home/
│   │   ├── content.md
│   │   ├── script.js
│   │   └── style.css
│   ├── about/
│   │   ├── content.md
│   │   ├── script.js
│   │   └── style.css
│   └── ...
├── block/
│   ├── menu/
│   │   ├── top1/
│   │   │   ├── content.md
│   │   │   ├── script.js
│   │   │   └── style.css
│   │   └── ...
│   └── ...
└── plugin/
    └── ...
```

---

### POST `/HTML/*`
Создание HTML контейнера (страницы или блока).

**Требуемое право:** `html.create`

**Request:**
```json
{
  "name": "new_page",
  "content": "# New Page",
  "js": "console.log('initialized');",
  "css": "body { padding: 20px; }"
}
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "path": "data/HTML/pages/new_page"
}
```

---

### PATCH `/HTML/*`
Обновление HTML контейнера.

**Требуемое право:** `html.update.*`

**Request:**
```json
{
  "content": "# Updated Content",
  "js": "// updated script",
  "css": "/* updated styles */"
}
```

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

---

### DELETE `/HTML/*`
Удаление HTML контейнера.

**Требуемое право:** `html.delete.*`

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

---

## Функции

### GET `/functions/source/*`
Получение исходного кода функции.

**Требуемое право:** `functions.read`

**URL Примеры:**
- `/api/functions/source/test` или `/api/functions/source/test.go`
- `/api/functions/source/MyTest/test0`

**Response (200 OK):**
```
Content-Type: text/plain; charset=utf-8

package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}
```

---

### POST `/functions/compile`
Компиляция Go кода в бинарник.

**Требуемое право:** `functions.compile`

**Request:**
```json
{
  "functionName": "myFunction",
  "goCode": "package main\n\nimport \"fmt\"\n\nfunc main() {\n    fmt.Println(\"Hello\")\n}"
}
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "binary": "data/functions/myFunction",
  "message": "compiled successfully"
}
```

**Возможные ошибки:**
- `400 Bad Request`: Ошибка компиляции Go кода

---

### POST `/functions/save`
Сохранение исходного кода функции.

**Требуемое право:** `functions.save`

**Request:**
```json
{
  "functionName": "myFunction",
  "code": "package main\n\nimport \"fmt\"\n\nfunc main() {\n    fmt.Println(\"Hello\")\n}"
}
```

**Response (200 OK):**
```
saved: data/functions/myFunction.go
```

---

### POST `/functions/run/*`
Запуск скомпилированной функции.

**Требуемое право:** `functions.run`

**Request:**
```json
{
  "input": "some input data"
}
```

**Response (200 OK):**
```json
{
  "output": "function output",
  "exitCode": 0
}
```

**Примеры URL:**
- `/api/functions/run/test`
- `/api/functions/run/MyTest/test0`

---

### GET `/functions/list`
Получение списка всех доступных функций.

**Требуемое право:** `functions.list`

**Response (200 OK):**
```json
{
  "functions": [
    {
      "name": "test",
      "path": "data/functions/test.go",
      "compiled": true
    },
    {
      "name": "MyTest/test0",
      "path": "data/functions/MyTest/test0.go",
      "compiled": false
    }
  ]
}
```

---

## Файлы

### GET `/files/*`
Получение файла или списка файлов в каталоге.

**Требуемое право:** `files.*` (проверяется через ACL middleware)

**Response для файла (200 OK):**
- Бинарные данные файла

**Response для каталога (200 OK):**
```json
[
  {
    "name": "document.pdf",
    "isDir": false,
    "size": 102400,
    "modTime": "2025-04-12T15:30:00Z"
  },
  {
    "name": "folder",
    "isDir": true,
    "size": 0,
    "modTime": "2025-04-10T10:00:00Z"
  }
]
```

---

### PUT `/files/*`
Загрузка нового файла.

**Требуемое право:** `files.write`

**Request:**
- Body: бинарные данные файла

**Response (201 Created):**
```json
{
  "status": "ok",
  "path": "/path/to/file"
}
```

---

### PATCH `/files/*`
Обновление существующего файла.

**Требуемое право:** `files.write`

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

---

### DELETE `/files/*`
Удаление файла или каталога.

**Требуемое право:** `files.delete`

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

---

## WebDAV

Полная поддержка WebDAV протокола для работы с файлами как с сетевым диском.

**Базовый URL:** `/dav`

### Поддерживаемые методы

- **GET** - Загрузка файла
- **PUT** - Загрузка/обновление файла
- **DELETE** - Удаление файла
- **PROPFIND** - Получение свойств файла/каталога
- **PROPPATCH** - Установка свойств
- **MKCOL** - Создание каталога
- **COPY** - Копирование файла/каталога
- **MOVE** - Перемещение файла/каталога
- **LOCK** - Блокировка файла
- **UNLOCK** - Разблокировка файла

**Требуемое право:** `files.*` (проверяется через ACL middleware)

### Примеры использования

**Подключение к WebDAV (Windows):**
```
Компьютер > Добавить сетевое размещение
http://localhost:{PORT}/dav
```

**Подключение к WebDAV (macOS/Linux):**
```bash
sudo mount -t webdav http://localhost:{PORT}/dav /mnt/webdav
```

**cURL запросы:**
```bash
# Получить список файлов
curl -X PROPFIND http://localhost:{PORT}/dav/

# Загрузить файл
curl -X PUT --data-binary @file.txt http://localhost:{PORT}/dav/file.txt

# Скачать файл
curl http://localhost:{PORT}/dav/file.txt

# Удалить файл
curl -X DELETE http://localhost:{PORT}/dav/file.txt
```

---

## Защищённые эндпоинты

### GET `/protected`
Проверка аутентификации и получение информации о пользователе.

**Требуемое право:** Нет

**Request:**
- Headers: `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "message": "Hello from protected endpoint",
  "user_id": 1
}
```

**Response (401 Unauthorized):**
```
unauthorized
```

---

## Кодировка и формат данных

### Request Content-Type
- Все JSON запросы: `Content-Type: application/json`
- Загрузка файлов: `Content-Type: application/octet-stream` или `multipart/form-data`

### Response Content-Type
- Все JSON ответы: `Content-Type: application/json`
- HTML/текстовые блоки: `Content-Type: text/plain; charset=utf-8`
- Файлы: соответствующий MIME type

---

## Коды статуса HTTP

| Код | Описание |
|-----|---------|
| 200 | OK - Успешный запрос |
| 201 | Created - Ресурс создан |
| 400 | Bad Request - Ошибка в запросе |
| 401 | Unauthorized - Не авторизован |
| 404 | Not Found - Ресурс не найден |
| 409 | Conflict - Конфликт (дублирование и т.д.) |
| 500 | Internal Server Error - Ошибка на сервере |

---

## Обработка ошибок

Все ошибки возвращаются в JSON формате:

```json
{
  "status": "error",
  "message": "Описание ошибки"
}
```

Или простым текстом (для некоторых endpoints):
```
error message
```

---

## Пример полного цикла аутентификации

### 1. Регистрация
```bash
curl -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john_doe","password":"password123"}'
```

### 2. Вход
```bash
curl -X POST http://localhost:8080/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john_doe","password":"password123"}' \
  -c cookies.txt
```

### 3. Использование Access Token
```bash
curl -X GET http://localhost:8080/api/users/getUserData \
  -H "Authorization: Bearer {access_token}"
```

### 4. Обновление токена
```bash
curl -X POST http://localhost:8080/api/users/refresh \
  -b cookies.txt
```

### 5. Выход
```bash
curl -X POST http://localhost:8080/api/users/logout \
  -H "Authorization: Bearer {access_token}"
```

---

## Примечания по системе ACL

### Иерархия управления доступом

**Уровень 1: Роли (Roles)**
- Группировка пользователей
- Назначение набора прав через роли
- Пример: `admin`, `editor`, `viewer`

**Уровень 2: Права (Permissions)**
- Атомарные разрешения на действия
- Формат: `module.action` (например: `files.write`, `users.delete`)
- Назначаются ролям

**Уровень 3: Отношения**
- Пользователь ↔ Роль (один ко многим)
- Роль ↔ Право (один ко многим)
- Система рассчитывает права пользователя как объединение всех его ролей

### Проверка прав

1. **Прямая проверка** (`/me/perms?permission=N`):
   - Возвращает `hasPermission: true/false` для конкретного права

2. **Получение всех прав** (`/me/perms`):
   - Возвращает полный список доступных прав пользователю

3. **Администраторские проверки** (`/users/{userId}/perms`):
   - Проверка прав другого пользователя
   - Требует право `acl.user.permissions.list.get`

---

## Примечания для фронтендера

1. **CORS**: При необходимости настроить CORS в конфиге сервера
2. **Credentials**: При использовании fetch API для работы с cookies добавьте `credentials: 'include'`
3. **Refresh Token**: Автоматически отправляется в cookies, обновляйте token перед истечением
4. **ACL**: Все endpoints защищены, проверяйте ответы на 401/403 статусы
5. **Пагинация**: Используйте `limit` и `offset` query параметры для больших списков
6. **WebDAV**: Для синхронизации файлов предпочтительно использовать WebDAV вместо REST
7. **Проверка прав**: Используйте `/acl-admin/me/perms?permission={permId}` для быстрой проверки перед действием
8. **Управление ACL**: Требует специальные права, обычно доступно только администраторам

---

*Последнее обновление: 2026-04-26*
