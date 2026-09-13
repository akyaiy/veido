# Карта HTTP API для VFSv2

> Статус: согласованная базовая карта для проектирования HTTP-адаптера. Детали реализации описаны в `VFS_V2_HTTP_ADAPTER_ARCHITECTURE_RU.md`.

## Назначение

HTTP-адаптер дает браузеру и API-клиентам доступ к тем же операциям VFSv2, которые WebDAV-адаптер предоставляет WebDAV-клиентам.

Адаптер отвечает только за транспортную часть:

1. получает `Actor` из контекста аутентификации;
2. принимает и проверяет HTTP-параметры;
3. преобразует строку URI в `common.CanonURI`;
4. вызывает ровно одну операцию `VFSFrontend`;
5. преобразует результат или ошибку в HTTP-ответ.

HTTP-адаптер не проверяет ACL самостоятельно, не выбирает provider и connection и не интерпретирует provider-specific payload метода `Control`.

## Базовый маршрут

Предлагаемый новый маршрут:

```text
/api/v2/vfs/{operation}?uri={url-encoded canonical URI}
```

В текущей Wiki указан концептуальный маршрут `/api/acc2fs/{operation}`, а legacy-реализация использует `/api/files/acc2fs/*`. Новый VFSv2 API использует отдельный версионированный prefix и не меняет legacy API.

Канонический URI передается полностью URL-encoded, потому что сам URI может содержать собственные query-параметры.

## Карта операций MVP

| HTTP | Operation | Вход | Вызов VFSv2 | Успешный ответ |
| --- | --- | --- | --- | --- |
| `GET /stat` | Получить метаданные | `uri` | `Stat(actor, uri)` | `200` + `Node` |
| `GET /list` | Прочитать каталог | `uri` | `ReadDir(actor, uri)` | `200` + `{ "items": [...] }` |
| `GET /read` | Прочитать файл | `uri` | `OpenFile(actor, uri, O_RDONLY)` | `200` + поток байтов |
| `POST /file` | Создать новый файл | `uri`; тело — байты | `OpenFile(actor, uri, O_CREATE\|O_WRONLY\|O_EXCL)` | `201` |
| `PUT /file` | Полностью заменить существующий файл | `uri`; тело — байты | `OpenFile(actor, uri, O_WRONLY\|O_TRUNC)` | `204` |
| `POST /directory` | Создать каталог | `uri` | `Mkdir(actor, uri)` | `201` + `Node` |
| `POST /move` | Переместить или переименовать | source в `uri`; target в JSON | `Move(actor, source, target)` | `204` |
| `DELETE /resource` | Удалить ресурс | `uri` | `Delete(actor, uri)` | `204` |
| `POST /control` | Выполнить команду provider-а | `uri`, `command`; тело — opaque bytes | `Control(actor, uri, command, body)` | `200` + opaque bytes |

`PATCH /file` не входит в MVP: сначала нужно определить контракт частичной записи, offset, допустимость расширения файла и поведение при конфликте версий.

## Контракты запросов

### Stat

```http
GET /api/v2/vfs/stat?uri=local%40default%5Bmy-123%5D%3A%2F%2F%2Fdocs%2Fa.txt
```

### Read

```http
GET /api/v2/vfs/read?uri=local%40default%5Bmy-123%5D%3A%2F%2F%2Fdocs%2Fa.txt
```

Ответ является потоком байтов. `Content-Type` может быть `application/octet-stream`, пока VFSv2 не возвращает надежный MIME type.

`Range` не входит в MVP. Его можно добавить позднее после появления явного provider capability или надежного общего контракта seek.

### Create file

```http
POST /api/v2/vfs/file?uri=local%40default%5Bmy-123%5D%3A%2F%2F%2Fdocs%2Fa.txt
Content-Type: application/octet-stream

<raw bytes>
```

`O_EXCL` делает операцию create-only: существующий ресурс приводит к `409 Conflict`.

### Replace file

```http
PUT /api/v2/vfs/file?uri=local%40default%5Bmy-123%5D%3A%2F%2F%2Fdocs%2Fa.txt
Content-Type: application/octet-stream

<raw bytes>
```

HTTP request body напрямую копируется в `vfs.File`. Адаптер завершает запись через `vfs.FinishWrite`: staged-файл получает `Commit` после успешной передачи или `Abort` после ошибки; обычный файл закрывается. Подробнее: [SDK провайдеров](VFS_V2_PROVIDER_SDK_RU.md#завершение-записи).

`PUT` в этой карте является replace-only и не содержит `O_CREATE`. Это дает детерминированный результат без предварительного `Stat`: отсутствующий файл возвращает `404`, существующий после успешного `Close` — `204`.

### Move

```http
POST /api/v2/vfs/move?uri=local%40default%5Bmy-123%5D%3A%2F%2F%2Fdocs%2Fa.txt
Content-Type: application/json

{
  "target_uri": "local@default[my-123]:///archive/a.txt"
}
```

Текущий VFSv2 поддерживает `Move` только внутри одного provider instance, то есть при совпадении provider, connection и scope. Cross-provider move возвращает `not_implemented`.

### Control

```http
POST /api/v2/vfs/control?uri=gdrive%40work%5Bmy-123%5D%3A%2F%2F%2Fdoc123&command=export
Content-Type: application/json

{"format":"pdf"}
```

Тело запроса и тело ответа являются непрозрачными байтами. Адаптер может перенести `Content-Type`, но не должен валидировать provider-specific схему.

## Форматы ответов

### Node

Формат отражает текущую модель `vfs.Node`:

```json
{
  "name": "a.txt",
  "kind": "file",
  "is_dir": false,
  "size": 42,
  "updated_at": "2026-08-14T12:30:00Z"
}
```

### Список каталога

```json
{
  "items": [
    {
      "name": "a.txt",
      "kind": "file",
      "is_dir": false,
      "size": 42,
      "updated_at": "2026-08-14T12:30:00Z"
    }
  ]
}
```

Оболочка `items` оставляет место для будущих полей пагинации, но сама пагинация пока не поддерживается контрактом `ReadDir`.

### Ошибка

```json
{
  "error": {
    "code": "not_found",
    "message": "resource does not exist"
  }
}
```

`message` предназначен для диагностики и не должен использоваться клиентом как стабильный идентификатор. Клиент принимает решения по `code` и HTTP status.

## Карта ошибок

| Ошибка или категория | HTTP status | Стабильный code |
| --- | --- | --- |
| Некорректный `uri`, JSON или обязательный параметр | `400 Bad Request` | `invalid_argument` |
| Actor отсутствует или не аутентифицирован | `401 Unauthorized` | `unauthenticated` |
| `ErrPermissionDenied`, недоступный scope | `403 Forbidden` | `permission_denied` |
| `KindNotFound` | `404 Not Found` | `not_found` |
| `KindAlreadyExists` | `409 Conflict` | `already_exists` |
| `KindConflict`, `KindFailedPrecondition` | `409 Conflict` | `conflict`, `failed_precondition` |
| `KindResourceExhausted` | `429 Too Many Requests` | `resource_exhausted` |
| Cross-provider move, `KindUnsupported` | `501 Not Implemented` | `unsupported` |
| `KindUnavailable` | `503 Service Unavailable` | `unavailable` |
| `KindCanceled` | `408 Request Timeout` | `canceled` |
| `KindDeadlineExceeded` | `504 Gateway Timeout` | `deadline_exceeded` |
| Неожиданная ошибка VFS/provider-а | `500 Internal Server Error` | `internal` |
| Превышен HTTP body limit | `413 Payload Too Large` | `payload_too_large` |

Cross-provider move возвращает `501`, потому что операция отсутствует в текущем VFSv2 независимо от состояния конкретных source и target.

## Авторизация и безопасность

- `Actor` всегда берется из серверного auth-контекста.
- Actor ID нельзя принимать из query, path, заголовка клиента или JSON body.
- Scope из канонического URI не является доказательством доступа; проверку выполняет VFSv2.
- HTTP-адаптер должен ограничивать размер тела записи и `Control` на уровне конфигурации сервера.
- В логах рекомендуется хранить operation, actor key, нормализованный URI, status и duration, но не тело файла и не control payload.
- Ответ `500` не должен раскрывать внутренние SQL-ошибки, конфигурацию connection или stack trace.

## Что намеренно не входит в MVP

- частичная запись через `PATCH`;
- рекурсивное удаление как отдельная HTTP-опция;
- copy между provider instances;
- batch-запросы;
- пагинация `ReadDir`;
- ETag и условные запросы;
- multipart upload;
- публичная передача actor-а;
- provider-specific HTTP-эндпойнты в VFS-адаптере.

## Выявленные ограничения текущего VFSv2

- Запись local provider-а фиксируется при `File.Close`, а не при `Write`. Поэтому успешный `io.Copy` еще не означает успешный HTTP-запрос.
- Read-side `Seek` поддерживается local provider-ом, но наличие метода в интерфейсе не гарантирует поддержку диапазонов каждым provider-ом. Универсальный `Range` нельзя обещать без capability или отдельной ошибки provider-а.
- Write-side `Seek` local provider-а не поддерживает произвольную позицию. Частичную запись через общий seek-контракт сейчас строить нельзя.
- Для staged-файла `OnResourceCreated` теперь вызывается после успешного commit нового файла, для прямой записи — после успешного `OpenFile`. Проверка существования перед открытием не заменяет атомарную реализацию `O_EXCL` в backend при конкурентных запросах.

## Принятые решения

| Решение | Выбранный вариант |
| --- | --- |
| Базовый prefix | `/api/v2/vfs` |
| Адрес ресурса | URL-encoded `uri` query |
| Создание/замена | `POST` create-only, `PUT` replace-only |
| Чтение каталога | отдельный `/list` |
| Move target | JSON `{target_uri}` |
| Cross-provider move | `501 Not Implemented` |
| Range read в MVP | нет |
| Формат success для write/delete | пустой `204 No Content` |

Эти решения образуют базовый контракт MVP. Изменения в них должны явно отражаться одновременно в карте, архитектурном плане и contract tests.
