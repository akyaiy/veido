# Архитектурный план HTTP-адаптера VFSv2

> Статус: предлагаемый план реализации. Карта публичных маршрутов находится в `VFS_V2_HTTP_ENDPOINT_MAP_RU.md`.

## Предлагаемая архитектура

HTTP-адаптер должен быть тонким входным transport-слоем над единственным экземпляром `vfs.VFSFrontend`.

```text
HTTP request
     |
     v
server middleware
(request id, auth, timeout, recovery)
     |
     v
VFSv2 HTTP router
     |
     v
request decoder + actor resolver
     |
     v
endpoint handler
     |
     v
VFSFrontend
     |
     v
scope -> connection -> provider -> ACL -> lifecycle
     |
     v
response encoder / byte stream / error mapper
```

HTTP и WebDAV должны получать один и тот же `VFSFrontend`. Адаптеры не создают VFS core, provider pool, resolvers или authorizer самостоятельно.

## Границы компонентов

### Composition root

Composition root собирает VFSv2 один раз при запуске приложения:

```go
frontend, cleanup, err := appvfs.NewVFSv2(db, config)
```

Он отвечает за:

- `ScopeResolver`;
- `ConnectionResolver`;
- `ProviderPool` и provider factories;
- `Authorizer`;
- `ResourceLifecycleSink`;
- регистрацию system provider-ов;
- освобождение ресурсов при остановке.

Полученный `frontend` передается одновременно в HTTP- и WebDAV-адаптеры.

Сборку, которая сейчас находится внутри `cmd/vfsv2webdav/main.go`, следует вынести в переиспользуемый app-level пакет. Сам `internal/vfs/v2` при этом остается библиотекой и ничего не знает о сервере или конфигурации приложения.

### HTTP adapter

Предлагаемый пакет:

```text
internal/vfs/v2/adapters/httpapi
```

Имя `httpapi` не конфликтует визуально с `net/http`.

Основная структура:

```go
type Handler struct {
    frontend     vfs.VFSFrontend
    resolveActor ActorResolver
    limits       Limits
    logger       *slog.Logger
}

type ActorResolver func(*http.Request) (vfs.Actor, error)

type Limits struct {
    MaxFileWriteBytes int64
    MaxControlBytes   int64
}
```

`Handler` не зависит от SQL, auth service, JWT, sessions, provider registry или конкретного provider-а.

### Actor resolver

Auth middleware продолжает аутентифицировать HTTP-запрос. Интеграционный слой приложения преобразует его результат в `vfs.Actor`:

```text
authenticated user ID -> vfs.Actor{Kind: ActorUser, ID: "42"}
```

Рекомендуется передать это преобразование в адаптер как `ActorResolver`. Так пакет `httpapi` не будет импортировать legacy `internal/auth` и не станет зависеть от текущего строкового context key.

Для `/api/v2/vfs` отсутствие пользователя должно возвращать `401`. Гостевой actor можно добавить позднее как осознанную route policy, но не получать неявно из пустого контекста.

### Route registration

Адаптер регистрирует относительные маршруты, а приложение выбирает prefix:

```go
r.Route("/api/v2/vfs", func(r chi.Router) {
    httpapi.RegisterRoutes(r, handler)
})
```

```go
func RegisterRoutes(r chi.Router, h *Handler) {
    r.Get("/stat", h.stat)
    r.Get("/list", h.list)
    r.Get("/read", h.read)
    r.Post("/file", h.createFile)
    r.Put("/file", h.replaceFile)
    r.Post("/directory", h.createDirectory)
    r.Post("/move", h.move)
    r.Delete("/resource", h.delete)
    r.Post("/control", h.control)
}
```

Внутри `RegisterRoutes` не должно быть `StripPrefix`: handler читает operation из выбранного route, а адрес VFS — только из параметра `uri`.

## Предлагаемая структура файлов

```text
internal/vfs/v2/adapters/httpapi/
  handler.go          dependencies, constructor, route registration
  request.go          uri, command и JSON decoding
  response.go         Node DTO, list envelope, JSON helpers
  errors.go           ErrorKind -> HTTP status + stable code
  stream.go           read/write streaming и корректный Close
  handler_test.go     endpoint unit tests с fake frontend
  errors_test.go      полный error mapping table
  integration_test.go httptest + реальный VFSv2/local provider
```

Не нужно создавать отдельные `StatService`, `ReadService` и другие operation wrappers: эту роль уже выполняет `VFSFrontend`. Endpoint methods должны оставаться короткими.

## Общий request pipeline

Каждый endpoint выполняет одинаковый каркас:

1. получить actor через `ActorResolver`;
2. получить единственный query parameter `uri`;
3. проверить, что `uri` не пуст и корректно преобразуется в `common.CanonURI`;
4. разобрать только operation-specific параметры;
5. вызвать соответствующий метод `VFSFrontend`;
6. закрыть открытый `vfs.File`, если он есть;
7. сериализовать успешный результат либо передать ошибку единому mapper-у;
8. записать структурированный лог без payload.

URI parser должен быть одним helper-ом для всех endpoint-ов. Нельзя позволять каждому handler-у по-разному трактовать пустой, поврежденный или повторяющийся `uri`.

## Работа с файлами

### Read

```text
OpenFile(O_RDONLY)
  -> file.Stat()
  -> set safe response headers
  -> io.Copy(response, file)
  -> file.Close()
```

Для MVP используется `application/octet-stream`. `Content-Disposition` следует формировать безопасным стандартным способом и не подставлять имя файла сырой строкой.

Если ошибка чтения произошла после отправки заголовков или части тела, JSON-ошибку уже возвращать нельзя. Адаптер завершает поток и пишет ошибку в лог с request ID.

### Create

```text
OpenFile(O_CREATE | O_WRONLY | O_EXCL)
  -> copy limited request body
  -> Close (commit)
  -> 201 Created
```

### Replace

```text
OpenFile(O_WRONLY | O_TRUNC)
  -> copy limited request body
  -> Close (commit)
  -> 204 No Content
```

Успех нельзя отправлять до успешного `Close`, потому что provider может фиксировать запись именно при закрытии.

Если `io.Copy` завершился ошибкой, файл все равно нужно закрыть. При этом исходная ошибка копирования имеет приоритет для ответа, а ошибка `Close` сохраняется в логе. Если копирование успешно, ошибка `Close` становится ошибкой запроса.

### Ограничение тела

До копирования adapter применяет `http.MaxBytesReader`. Превышение лимита возвращает:

```text
413 Payload Too Large
payload_too_large
```

Для file write и `Control` нужны независимые лимиты. У `Control` маленький JSON payload и большой binary payload имеют разные риски, поэтому значения задаются конфигурацией, а не зашиваются в handler.

## JSON и DTO

Не следует сериализовать внутренние структуры напрямую. Transport DTO фиксирует публичные имена полей независимо от будущих изменений Go-моделей:

```go
type nodeResponse struct {
    Name      string    `json:"name"`
    Kind      string    `json:"kind"`
    IsDir     bool      `json:"is_dir"`
    Size      int64     `json:"size"`
    UpdatedAt time.Time `json:"updated_at"`
}

type listResponse struct {
    Items []nodeResponse `json:"items"`
}
```

JSON decoder для `/move` должен:

- ограничивать размер body;
- запрещать неизвестные поля;
- принимать ровно один JSON object;
- требовать непустой `target_uri`;
- отклонять дополнительные JSON values после объекта.

## Error mapper

Все endpoint-ы используют одну функцию:

```go
func writeVFSProblem(w http.ResponseWriter, err error, requestID string)
```

Mapper сначала использует `vfs.KindOf`, а не сравнение текста. Он возвращает статус и стабильный machine-readable code из карты эндпойнтов. На время миграции provider-ов после этого допускается единый compatibility fallback через `errors.Is` для legacy `os.Err*` и старых VFS sentinel errors.

Внутреннюю причину для `500` клиенту возвращать нельзя. Клиент получает общее сообщение и request ID, а полная цепочка ошибки попадает в серверный лог.

Рекомендуемый порядок проверки:

1. ошибки декодирования HTTP-запроса;
2. классифицированный `vfs.ErrorKind` через `vfs.KindOf`;
3. временный legacy fallback через `errors.Is`;
4. fallback `500 internal`.

Для надежного mapper-а VFSv2 придется постепенно добавить недостающие именованные ошибки. Сейчас часть provider-ов возвращает системные ошибки, а часть категорий можно определить только косвенно.

## Middleware и observability

Общие server middleware остаются снаружи адаптера:

- request ID;
- real IP;
- panic recovery;
- authentication;
- общий request timeout.

Adapter-specific middleware или wrapper отвечает за:

- operation;
- actor key;
- canonical URI без payload;
- HTTP status;
- число переданных байтов;
- duration;
- стабильный error code.

Нельзя логировать file body, `Control` body, auth headers и provider connection config.

Для streaming endpoint-а общий короткий server timeout может быть недостаточен. Значение timeout нужно проверить отдельно; HTTP-адаптер не должен сам создавать detached context после отмены запроса.

## Тестовая архитектура

### Unit tests handler-а

Табличные тесты с fake `VFSFrontend` проверяют:

- точный метод VFS и flags для каждого endpoint-а;
- actor из resolver-а;
- URI parsing;
- DTO и status codes;
- обязательность `uri`, `command`, `target_uri`;
- body limits;
- приоритет ошибок `Write` и `Close`;
- отсутствие второго VFS-вызова для определения результата;
- запрет JSON error после начала streaming response.

### Error contract tests

Отдельная таблица должна покрывать каждую публичную пару `HTTP status + error.code`, включая wrapped errors.

### Integration tests

`httptest.Server` с реальным VFSv2 и local provider проверяет сценарии:

1. create -> stat -> read;
2. replace -> read;
3. mkdir -> list;
4. move -> stat old/new URI;
5. delete -> stat;
6. create существующего файла;
7. доступ запрещен;
8. неактивное или отсутствующее connection;
9. cross-provider move;
10. commit failure на `Close`.

WebDAV regression tests остаются отдельными, но несколько protocol parity scenarios должны выполнить одну последовательность через HTTP и WebDAV и сравнить итоговое состояние VFS.

## Этапы реализации

### Этап 0. Исправить предпосылки VFSv2

1. Перенести `OnResourceCreated` для `OpenFile(O_CREATE)` после подтвержденного создания provider-ом либо изменить lifecycle-контракт так, чтобы не возникало ложного события при `O_EXCL`.
2. Зафиксировать именованные ошибки как минимум для invalid URI, not found, exists, permission denied, inactive connection и unsupported operation.
3. Добавить тесты на flags и commit-on-close.

### Этап 1. Общая сборка VFSv2

1. Вынести создание core/resolvers/provider pool из `cmd/vfsv2webdav` в app-level composition package.
2. Подключить к одной сборке существующий WebDAV.
3. Проверить корректное закрытие provider pool при shutdown.

### Этап 2. HTTP skeleton

1. Создать пакет `httpapi` и constructor с явными зависимостями.
2. Реализовать route registration, actor resolver и общий URI decoder.
3. Реализовать response DTO и error mapper.
4. Подключить `/api/v2/vfs` в основной router.

### Этап 3. Read-only API

1. `GET /stat`.
2. `GET /list`.
3. `GET /read` без Range.
4. Unit и integration tests read-only сценариев.

### Этап 4. Mutating API

1. `POST /file`.
2. `PUT /file`.
3. `POST /directory`.
4. `POST /move`.
5. `DELETE /resource`.
6. Лимиты тела и тесты ошибок `Close`.

### Этап 5. Control и hardening

1. `POST /control` с opaque request/response.
2. Независимый лимит control body.
3. Структурированные логи и метрики.
4. Проверка timeout-ов на больших потоках.
5. Protocol parity tests с WebDAV.

### Этап 6. Документация и выпуск

1. Зафиксировать request/response examples и error contract.
2. Обновить страницу `dev/vfs-v2/api` в Wiki.js.
3. Оставить legacy `/api/files/acc2fs` без изменений на период миграции.
4. Добавить deprecation plan только после появления совместимого клиента.

## Архитектурные решения

### Один VFS runtime на процесс

HTTP и WebDAV являются двумя transport adapter-ами одного application core. Они не должны иметь раздельные provider pool или разные authorizer/lifecycle implementations.

### Handler зависит только от `VFSFrontend`

Это удерживает provider routing, ACL и lifecycle внутри VFSv2 и позволяет тестировать HTTP без базы данных.

### Actor resolver инъецируется

Адаптер не знает формат JWT и legacy auth context. Изменение auth-системы не требует переписывать endpoint-ы.

### Transport DTO отделены от VFS-моделей

Публичный JSON остается стабильным, даже если внутренний `Node` получит новые поля или изменит структуру.

### Streaming без промежуточного буфера

Файлы не загружаются полностью в RAM. Запись commit-ится через `Close`, чтение напрямую копируется в response.

### Один error contract

Все операции возвращают одинаковую форму ошибки и стабильные codes. Endpoint-ы не содержат собственные switch по текстам ошибок.
