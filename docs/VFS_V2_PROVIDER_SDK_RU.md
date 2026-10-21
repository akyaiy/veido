# Создание провайдеров VFS v2

Провайдер представляет данные как файлы, каталоги и команды. Это может быть
обычная файловая система, хранилище объектов или виртуальное представление
сущностей приложения. SDK помогает собрать провайдер из обработчиков, адаптировать
существующую ФС и проверить результат через настоящее ядро VFS.

Все варианты реализуют один `FSProvider`. Ядро по-прежнему выбирает scope и
connection, проверяет ACL и передаёт провайдеру путь, контекст запроса и `BoundVFS`.
HTTP и WebDAV работают поверх этого ядра.

## Выберите способ реализации

| Источник данных | Подход | Пример в проекте |
| --- | --- | --- |
| Объекты приложения, настройки, служебные JSON | `New`, `Directory`, `Collection`, `JSON`, `Document`, `Command` | `internal/vfs/v2/providers/system/scopes` |
| Обычная ФС с собственными правилами записи | `FromBackend` с необязательными интерфейсами записи; либо свой `FSProvider` | `internal/vfs/v2/providers/local/account_provider.go` |
| Готовый `io/fs.FS`, включая `embed.FS` | `FromFS`, только чтение | Шаблон генератора `filesystem` |
| Обычная ФС со служебным поддеревом | `Compose` и `Mount` | Скрытый `/%account%` у `local` |
| Нестандартный виртуальный файл | `File` и `FileSpec` | Потоки, особые метаданные, собственные флаги открытия |

Обычной ФС не нужно регистрировать маршрут на каждый файл. SDK не требует
переносить её данные в память или превращать бинарные файлы в JSON.

Публичные пакеты:

- `MyServer/pkg/vfs` — контракты, ошибки и контекст.
- `MyServer/pkg/vfs/providersdk` — ресурсы, файловые адаптеры, композиция и определения провайдеров.
- `MyServer/pkg/vfs/providertest` — тестовое окружение и проверка дерева.
- `MyServer/pkg/vfs/providerdev` — локальный HTTP/WebDAV сервер для разработки.

## Быстрый старт

Из корня репозитория создайте пакет:

```bash
go run ./cmd/vfsprovider new -dir ./myprovider -key example -kind virtual
go test ./myprovider
go run ./myprovider -addr 127.0.0.1:8091
```

Генератор создаёт `provider.go`, `provider_test.go` и `main.go`. Он отказывается
перезаписывать существующий каталог. Родительский каталог должен существовать.

Виртуальный пример содержит `info.json` и изменяемый `settings.json`. Обработчики
настроек синхронизированы, поскольку один экземпляр обслуживает несколько запросов.

После запуска доступны:

- `http://127.0.0.1:8091/` — входная страница инспектора.
- `/_provider` — описание провайдера, конфигурации, маршрутов и команд.
- `/api/v2/vfs` — HTTP API.
- `/dav/` — WebDAV с отменой незавершённых загрузок.

Корневой URI примера — `example@default[dev]:///`. Сервер использует временные
резолверы scope/connection и фиксированного actor `user:developer`, затем вызывает
обычный `VFSCore`. Сгенерированный запуск разрешает только loopback IP; это
окружение разработки, а не механизм аутентификации для production.

```bash
curl --get 'http://127.0.0.1:8091/api/v2/vfs/read' \
  --data-urlencode 'uri=example@default[dev]:///settings.json'

curl -X PUT 'http://127.0.0.1:8091/dav/settings.json' \
  -H 'Content-Type: application/json' --data '{"enabled":false}'
```

Для обычной ФС:

```bash
go run ./cmd/vfsprovider new -dir ./diskprovider -key disk -kind filesystem
go test ./diskprovider
go run ./diskprovider -config /path/to/connection.json
```

`connection.json` содержит, например, `{"root":"/srv/data"}`. Шаблон предоставляет
чтение через `os.DirFS`. Этот backend следует символическим ссылкам; если нужна
изоляция внутри корня, её должен обеспечивать выбранный файловый backend.

## Минимальное виртуальное дерево

```go
tree := sdk.New()
system := sdk.Directory(tree.Root(), "system")

sdk.JSON(system, "health.json",
    func(ctx context.Context, req sdk.Request, _ sdk.Unit) (Health, error) {
        return service.Health(ctx)
    },
)

provider, err := tree.Build()
```

Здесь `sdk` — импорт `MyServer/pkg/vfs/providersdk`, а `Health` — обычная структура
с JSON-тегами. Вызов объявляет `/system/health.json`; корень перечисляет `system`,
а каталог `system` перечисляет файл. Дополнительные `Stat`, `ReadDir`, `OpenFile`
и методы с отказом для неподдерживаемых изменений писать не требуется.

`Build()` проверяет имена, необходимые обработчики и пересечения маршрутов.
Конфликтующие объявления возвращают ошибку, а не зависят от порядка поиска.
После успешного `Build()` декларация заморожена. Статические дети перечисляются
в порядке объявления; элементы коллекции сортируются по имени.

`Hidden()` исключает ресурс из родительского списка, но оставляет прямой доступ.
Это настройка отображения, не ограничение доступа.

## Коллекции и загрузка сущности

Коллекция описывается списком, поиском элемента и преобразованием элемента в
метаданные каталога. Возвращаемый ресурс представляет один элемент коллекции.

```go
type Project struct {
    ID   string `json:"id"`
    Name string `json:"name"`
}

projects := sdk.Collection(tree.Root(), "projects", "projectID",
    sdk.CollectionSpec[sdk.Unit, Project]{
        List: func(ctx context.Context, req sdk.Request, _ sdk.Unit) ([]Project, error) {
            return service.ListProjects(ctx)
        },
        Lookup: func(ctx context.Context, req sdk.Request, _ sdk.Unit, id string) (Project, error) {
            return service.GetProject(ctx, id)
        },
        Node: func(p Project) *vfs.Node {
            n := sdk.DirNode(p.ID)
            n.Kind = "project"
            return n
        },
    },
)

sdk.JSON(projects, "info.json",
    func(ctx context.Context, req sdk.Request, p Project) (Project, error) {
        return p, nil
    },
)
```

Получаются `/projects/{projectID}` и `/projects/{projectID}/info.json`.
`Lookup` проверяет существование элемента перед операциями над самим элементом
и его потомками. Для отсутствующего объекта верните ошибку not-found, например
`os.ErrNotExist` или `vfs.ErrNotFound`. Совпадение шаблона пути не создаёт объект.

Загруженное значение переиспользуется **только внутри одной операции**. Например,
при перечислении нескольких JSON-файлов connection провайдер `scopes` загружает
сам connection один раз. Между `Stat`, `ReadDir`, `OpenFile` и запросами разных
actor значения не кешируются. Открытый файл может удерживать своё значение до
завершения операции записи; конкурентные изменения доменной сущности регулирует
сам сервис, например проверкой версии.

Вложенная коллекция получает тип родительской сущности вместо `sdk.Unit`:
`CollectionSpec[Project, Connection]`. Параметры пути доступны через
`req.Param("projectID")`; `req.Path` содержит запрошенный путь внутри провайдера.
Имена параметров не должны повторяться у предков.

## Документы и команды

```go
type Settings struct {
    Enabled bool `json:"enabled"`
}

sdk.Document(projects, "settings.json", sdk.DocumentSpec[Project, Settings]{
    Read: func(ctx context.Context, req sdk.Request, p Project) (Settings, error) {
        return service.ReadSettings(ctx, p)
    },
    Replace: func(ctx context.Context, req sdk.Request, p Project, value Settings) error {
        return service.ReplaceSettings(ctx, p, value)
    },
    Validate: validateSettings,
    MaxBytes: 64 << 10,
})
```

`Validate` имеет сигнатуру `func(context.Context, Settings) error`. SDK декодирует
ровно одно JSON-значение, по умолчанию отвергает неизвестные поля, затем вызывает
валидатор и `Replace`. Если нужны дополнительные поля, установите
`AllowUnknownFields: true`. Проверку обязательных полей и доменных ограничений
выполняет `Validate`: обычные правила Go JSON-декодера допускают пропущенные поля.

`JSON` — документ без `Replace`, доступный только для чтения. Для другого формата
используйте `Bytes` или `BytesDocument`; они работают с `[]byte` и используют ту же
процедуру записи. Лимит записи по умолчанию — 1 MiB. Для больших файлов используйте
потоки, а не буфер документа.

Команда объявляется на конкретном ресурсе:

```go
sdk.Command(projects, "reindex", sdk.CommandSpec[Project, ReindexInput, ReindexResult]{
    Handle: func(ctx context.Context, req sdk.Request, p Project, in ReindexInput) (ReindexResult, error) {
        return service.Reindex(ctx, p, in)
    },
    Validate: validateReindex,
})
```

Вызов идёт через `Control(uri, "reindex", payload)` и требует `x` на ресурсе.
Пустое тело команды трактуется как `{}`. Команда не появляется как файл записи
и не подменяет проверку `x` проверкой `w`. Неизвестная команда возвращает
`vfs.ErrUnsupported`. Лимит входа задаётся `MaxBytes` и по умолчанию равен 1 MiB.

Если команда изменяет другие VFS-ресурсы, обращайтесь к ним через `BoundVFS`.
Произвольные доменные изменения внутри `Control` не генерируют автоматически
события создания, перемещения или удаления файлов.

## Создание, удаление и перемещение

У коллекции поле `Create` обрабатывает `Mkdir` в её каталоге:
`func(context.Context, Request, Parent, string) (*vfs.Node, error)`.

На ресурсе доступны обработчики:

```go
projects.Delete(func(ctx context.Context, req sdk.Request, p Project) error {
    return service.DeleteProject(ctx, p)
})

projects.Move(func(ctx context.Context, req sdk.Request, p Project, targetParent, newName string) error {
    return service.MoveProject(ctx, p, targetParent, newName)
})
```

`Directory(...).Mkdir(...)` позволяет создавать сущности без `Collection`.
Отсутствующие обработчики изменений возвращают отказ. Возможность выполнить
операцию в провайдере не означает, что ACL разрешает её текущему actor.

## Обычные файловые системы

Готовый `FSProvider` можно регистрировать напрямую. `local` сохраняет именно
такой backend: метаданные, разрешение путей, CAS, создание файлов, append,
перемещение и удаление остаются обычными файловыми операциями.

Для нового backend SDK предлагает меньший интерфейс:

```go
type Backend interface {
    Stat(context.Context, string) (*vfs.Node, error)
    ReadDir(context.Context, string) ([]*vfs.Node, error)
    OpenRead(context.Context, string) (io.ReadCloser, error)
}

provider := sdk.FromBackend(backend)
```

Необязательные интерфейсы добавляют изменения:

| Интерфейс | Метод |
| --- | --- |
| `WriteBackend` | `OpenWrite(ctx, path, flags) (vfs.File, error)` |
| `MkdirBackend` | `Mkdir(ctx, parent, name) (*vfs.Node, error)` |
| `MoveBackend` | `Move(ctx, source, targetParent, newName) error` |
| `DeleteBackend` | `Delete(ctx, path) error` |
| `ControlBackend` | `Control(ctx, path, command, input) ([]byte, error)` |

Если backend реализует `io.Closer`, адаптер передаёт ему освобождение ресурсов.
`OpenWrite` получает исходные флаги открытия. Backend определяет поведение
`O_EXCL`, `O_APPEND`, `O_TRUNC`, поддержку seek, атомарность изменений и ограничения
внешней системы. Он также отвечает за отмену своих запросов через `ctx`.

`FromFS(fsys)` адаптирует стандартный `io/fs.FS` только для чтения. VFS-корень `/`
преобразуется в `.`, некорректные пути отклоняются. Файлы читаются потоком без
загрузки целиком в память. Seek доступен, если исходный поток реализует `io.Seeker`;
иначе возвращается `vfs.ErrUnsupported`.

Для собственных потоков есть `ReadFile(ctx, node, reader)` и
`WriteFile(ctx, node, writer, commit, abort)`. Обычный `*os.File` также удовлетворяет
контракту `vfs.File`; SDK не требует оборачивать его в виртуальный документ.

## Поддеревья и служебные файлы

```go
provider, err := sdk.Compose(filesystem,
    sdk.Mount{
        Path:     "/%account%",
        Provider: accountTree,
        Hidden:   true,
    },
)
```

По умолчанию `accountTree` видит свой корень как `/`: запрос
`/%account%/info.json` передаётся ему как `/info.json`. `SelfURI` внутри компонента
учитывает префикс и возвращает правильный URI внешнего дерева. Полная identity
ресурса в контексте ядра остаётся исходной.

Для старого компонента, уже работающего с префиксом `/%account%`, укажите
`PreservePath: true`. Именно так подключено служебное дерево `local`.

Правила композиции:

- Поддеревья не должны пересекаться; их родительские каталоги предоставляет base.
- Mount перекрывает одноимённый путь base. Not-found внутри mount не вызывает fallback.
- Скрытый mount перекрывает путь так же, но не попадает в родительский список.
- Корень mount и содержащие его каталоги защищены от удаления/перемещения.
- Перемещение между base и mount либо разными mount возвращает unsupported.
- Композиция владеет `Close` своих компонентов; после завершения использования
  освобождайте её целиком. Пул провайдеров делает это при инвалидации.

Это сборка частей **одного** провайдера connection. Подключать экземпляр другого
connection в обход его VFS-проверок нельзя; для таких обращений используется
`BoundVFS`.

## Завершение записи

`vfs.WriteFile` расширяет `File` методами `Commit()` и `Abort()`.

```go
file, err := frontend.OpenFile(ctx, actor, uri, flags)
if err != nil { return err }
_, transferErr := io.Copy(file, source)
return vfs.FinishWrite(file, transferErr)
```

Для staged-файла `FinishWrite` подтверждает успешную передачу или отменяет её при
ошибке источника. Для обычного файла вызывает `Close`; откат прямых изменений
такой файл обещать не может. `Close` у staged-файла оставлен совместимым с файловыми
клиентами и означает `Commit`, поэтому при ошибке чтения источника одного `defer
file.Close()` недостаточно.

SDK-документы и `BufferedFile`:

- накапливают ограниченный объём данных;
- не вызывают сохранение после ошибки записи, превышения лимита или отмены контекста;
- вызывают callback сохранения не более одного раза;
- сохраняют ошибку неудачного подтверждения при повторном `Close`;
- не выполняют автоматических повторов доменной операции.

`WriteFile` для потокового backend не буферизует данные: `commit` и `abort` должны
финализировать и освободить writer. Атомарность публикации обеспечивает backend,
например временным объектом и последующим переключением ссылки.

`Document` предоставляет полную замену через `O_WRONLY|O_TRUNC`. WebDAV-вариант
`O_RDWR|O_CREATE|O_TRUNC` поддерживается как последовательная загрузка. Такой
дескриптор предназначен для записи, не для произвольного read/write доступа.
Append и произвольный seek возвращают unsupported. Для полноценной файловой
семантики используйте свой `OpenWrite`/`FileSpec`.

HTTP-адаптер использует `FinishWrite`. При самостоятельной сборке WebDAV оберните
`golang.org/x/net/webdav.Handler` в
`MyServer/pkg/vfs/adapters/webdav.TransactionalWrites`: библиотечный handler
вызывает `Close` даже после ошибки чтения тела. Готовый `providerdev` и
`cmd/vfsv2webdav` уже подключают обёртку.

Событие создания нового staged-файла вызывается после успешного commit. Ошибка
или отмена загрузки его не создаёт. Для прямой записи событие следует за успешным
`OpenFile`. Проверка существования перед открытием не заменяет гарантий backend
при конкурентном создании; используйте его атомарную реализацию `O_EXCL`, когда
нужно создать строго новый файл. Ошибка lifecycle после commit не откатывает уже
сохранённые данные и не приводит к повторному уведомлению при `Close`.

## Метаданные и стоимость чтения

По умолчанию JSON/Bytes-файл вычисляет содержимое для `Stat`, чтобы сообщить точный
размер. Если метаданные уже известны, задайте `resource.Metadata(...)`: листинг
сможет получить размер без генерации содержимого. Метаданные должны соответствовать
представлению, а не обозначать неизвестный размер как пустой файл.

Для данных, меняющихся между запросами, `Stat` и последующий `OpenFile` могут видеть
разные версии. Метаданные открытого handle должны описывать именно его snapshot.
Для custom `File` это обязанность его `Open`-обработчика. `ReadFile` сохраняет
переданный `Node` вместе с открытым потоком.

Для больших листингов backend возвращает уже известные метаданные без чтения
каждого файла. Базовый контракт `ReadDir` пока возвращает полный список; SDK не
добавляет скрытую пагинацию или глобальное кеширование.

## Конфигурация и регистрация

`Definition[Config]` объединяет ключ, описание, defaults, валидацию и фабрику:

```go
definition := sdk.Definition[Config]{
    Key:      "example",
    Summary:  "Projects and settings",
    Defaults: defaultConfig,
    Validate: validateConfig,
    Open: func(ctx context.Context, connection vfs.ProviderConnection, cfg Config) (vfs.FSProvider, error) {
        return buildProvider(service, cfg)
    },
}

catalog := sdk.NewCatalog()
if err := sdk.RegisterDefinition(catalog, definition); err != nil { return err }
```

`catalog` реализует обычный `ProviderRegistry`. `Providers()` возвращает описания
SDK-провайдеров; `Check(ctx, key, config)` вызывает необязательный `Definition.Check`.
Check проверяет подключение только по явному вызову и не меняет `ready` connection.
Повторная SDK-регистрация ключа возвращает ошибку. Старые фабрики можно подключать
через `catalog.Register(key, factory)`.

Defaults применяются перед декодированием, неизвестные поля по умолчанию запрещены.
`Validate` вызывается до `Open`. `Definition.Info()` и `Provider.Routes()` предоставляют
JSON-схемы обычных Go-типов для документации и форм. Схемы информационные: это не
отдельный JSON Schema validator. Для custom marshalers и рекурсивных частей схема
остаётся открытой. Теги `description:"..."`, `secret:"true"`, `required:"true"`
добавляют подсказки; фактическую обязательность полей проверяет `Validate`.
`secret` помечает поле как `writeOnly`, но не шифрует хранилище конфигурации.
Каталог и инспектор не возвращают значения connection config.

Зависимости передаются в фабрику явно. Экземпляр кешируется пулом на connection и
`ConfigVersion`, поэтому хранить в нём actor, контекст первого запроса или
actor-зависимые результаты нельзя. Долгоживущие клиенты должны иметь собственный
lifecycle. Если провайдер владеет клиентами, реализуйте `Close()` и передайте его
через свои обёртки. Пул закрывает заменяемый экземпляр; не запускайте из handler
бесконтрольные фоновые операции, использующие старый экземпляр.

## Контекст, доступ и ошибки

`sdk.Actor(ctx)` получает actor из контекста ядра, `sdk.Bound(ctx)` — `BoundVFS`.
Отсутствующий контекст возвращает ошибку, а не создаёт привилегированный вызов.

```go
uri, err := sdk.SelfURI(ctx, "/projects/one/info.json")
if err != nil { return err }
info, err := sdk.ReadJSON[Project](ctx, uri, 64<<10)
```

`ReadJSON` ограничивает объём чтения и закрывает handle. `WriteJSON` заменяет JSON
через bound-фронтенд и правильно завершает запись. Эти helpers повторно проходят
проверки ядра, включая обращения к ресурсам того же провайдера. Загрузка сущности
из собственного доменного хранилища внутри текущего handler остаётся обычным
вызовом сервиса.

Возвращайте стандартные файловые ошибки или категории `vfs.ErrNotFound`,
`ErrInvalidArgument`, `ErrPermissionDenied`, `ErrConflict`, `ErrUnsupported` и др.
`vfs.NewError` позволяет добавить операцию, безопасное сообщение и исходную причину.
Используйте `errors.Is`/`errors.As`, а не сравнение строк.

Лимит записи SDK возвращает `ErrResourceExhausted`, который текущий HTTP-адаптер
отображает в 429. Собственный лимит HTTP-тела адаптера отображается в 413.

## Проверка провайдера

```go
h, err := providertest.New(ctx, definition.Factory(), providertest.Options{
    Connection: vfs.ProviderConnection{ProviderKey: definition.Key, Config: configJSON},
})
if err != nil { t.Fatal(err) }
t.Cleanup(func() { _ = h.Close() })

providertest.CheckTree(t, ctx, h, providertest.CheckOptions{
    Expected: []string{"/projects/one/info.json"},
})
```

Harness использует реальное ядро и пул, но временные scope/connection. Передайте
`Authorizer` для проверок отказов и `Lifecycle` для проверки событий. `CheckTree`
обходит ограниченную стабильную fixture, сверяет `ReadDir`, `Stat`, открытые
файлы и размеры. Скрытые пути можно перечислить в `Expected`. Данные fixture не
должны меняться во время проверки. `MaxNodes` и `MaxFileBytes` ограничивают обход.

Доменные операции проверяйте отдельно: создание с `O_EXCL`, поддерживаемые флаги,
append/seek, rename, неуспешный commit, отмена загрузки, ACL и конкурентные запросы.
Тесты SDK проверяют также ошибки тела через настоящие HTTP/WebDAV handlers и
изоляцию загруженных сущностей между actor.

`tree.Observe(func(Trace))` сообщает операцию, путь, выбранный шаблон, длительность
и ошибку диспетчеризации. Observer должен быть безопасен для конкурентных вызовов.
Завершение сохранения происходит позднее, на commit; его доменную диагностику
пишет обработчик сохранения или транспорт.

```bash
go test ./pkg/vfs/... ./cmd/vfsprovider ./internal/vfs/v2/... ./internal/vfs/v2test
go test -race ./pkg/vfs/... ./internal/vfs/v2/... ./internal/vfs/v2test
```

## Использование из другого Go-модуля

Публичные импорты не требуют доступа к `internal`. Пока модуль проекта называется
`MyServer` и не опубликован под внешним адресом, локальное подключение выглядит так:

```go
module example.org/myprovider

go 1.24.3

require MyServer v0.0.0
replace MyServer => /absolute/path/to/JWTproject2
```

Тест генератора действительно собирает оба шаблона как отдельные модули с такими
публичными импортами. Отдельный RPC-протокол провайдеров и SDK для других языков
не входят в этот Go SDK.

## Переход с существующей реализации

Переводить все провайдеры одновременно не требуется. Сохраняйте обычный backend,
выделяйте служебные ветки через `Compose`, а виртуальные представления переводите
на `JSON`/`Document` и коллекции. Старый `virtfs` остаётся доступен для низкоуровневых
маршрутов, включая нестандартные шаблоны.

В `scopes` маршруты теперь объявлены через SDK, а бизнес-операции остались в
провайдере и storage. Дочерние ресурсы отсутствующего scope возвращают not-found
вместо фиктивного пустого каталога. В `local` обычная ФС продолжает выполнять свои
операции; SDK подключает скрытый `/%account%` и поддерживает отмену staged-записи.
