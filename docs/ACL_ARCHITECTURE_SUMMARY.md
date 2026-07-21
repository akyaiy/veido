# Архитектурное резюме ACL

## Назначение

ACL отвечает на простой вопрос перед защищенной операцией:

```text
может ли этот исполнитель выполнить это действие над этим ресурсом?
```

В VFS-архитектуре ACL становится общим слоем авторизации для файлов, директорий, функций, HTML-страниц, пользователей, общих ресурсов и внешних провайдеров. Он не управляет бизнес-логикой сам. Его задача - принять нормализованную идентичность ресурса, действие и субъект, а затем вернуть решение: разрешить или запретить.

Граница ответственности ACL:

- определяет права на чтение, изменение и выполнение;
- работает с распознанным `ResourceRef`, а не с красивым путем монтирования;
- поддерживает пользователей, группы, гостей и сервисные субъекты;
- не знает бизнес-команды как отдельные ключи прав.

## Когда используется

ACL проверяется каждый раз, когда исполнитель пытается:

- прочитать файл, каталог или виртуальное представление;
- изменить файл, настройки ресурса или состав директории;
- пройти через директорию или область ресурсов;
- запустить функцию или файл действия;
- выдать доступ другому субъекту;
- обратиться к ресурсу во внешнем провайдере.

## Как работает

Основной процесс проверки:

1. Система получает исполнителя из запроса или сервисного контекста.
2. VFS распознает URI или путь монтирования и получает канонический URI.
3. Провайдер или распознаватель превращает URI в стабильный `ResourceRef`.
4. ACL собирает ключи субъекта для исполнителя: пользователь, группы, `guest`, `all` или сервисный субъект.
5. ACL строит кандидаты целевого ресурса: сам ресурс, родители, корень.
6. Система ищет подходящие правила разрешения и запрета.
7. Более близкое правило важнее дальнего, а запрет побеждает разрешение на одном уровне.
8. Если явных правил нет, применяется правило владельца или запрет по умолчанию.

## Компоненты

- Субъект описывает того, кто выполняет действие: `user:*`, `group:*`, `guest`, `all`, `service:*`.
- Действие использует маленький набор прав, похожий на Unix: `r`, `w`, `x`.
- URI ресурса удобен для людей, API и логов.
- `ResourceRef` является стабильной идентичностью для БД, индексов и ACL.
- `resource_acl` хранит явные правила доступа.
- Распознаватель провайдера строит список ресурса и его родителей, а также может вернуть владельца.
- Правило владельца дает владельцу неявный доступ, если нет явного запрета.

## Пример

Пользователь `user:7` запускает функцию:

```text
Control(functions@system:///resize-image, "run", input)
```

Проверки идут раздельно:

```text
Can(user:7, x, functions@system:///resize-image)
Can(service:executor, r, functions@system:///resize-image/source.go)
```

Пользователь может иметь право выполнить функцию, но не иметь права читать ее исходник. Исполнительный сервис получает отдельное сервисное право на чтение файла исходного кода.

## Ограничения

- ACL не хранит права на путь монтирования как стабильную идентичность.
- `run-function`, `reset-password`, `grant` и похожие команды не становятся отдельными действиями ACL.
- Внутренний ACL не должен расширять права, которые запрещает внешний провайдер.
- Правило владельца не должно обходить явный запрет.
- Общий доступ реализуется записью ACL-правил, а не отдельной параллельной системой авторизации.

## Записи архитектурных решений

### ADR-001: Единый набор действий `r/w/x`

#### Контекст

Система должна авторизовать файлы, директории, функции, HTML, пользователей, общие ресурсы и внешние провайдеры.

#### Проблема

Если делать отдельный ключ права для каждой бизнес-команды, ACL быстро превращается в список частных случаев и перестает быть общим слоем VFS-авторизации.

#### Варианты

- продолжать наращивать строковые ключи прав;
- хранить отдельные действия для каждой команды провайдера;
- свести операции к `r`, `w`, `x` и проверять команды как исполняемые ресурсы.

#### Решение

Использовать `r`, `w`, `x` как базовый набор действий. Команды провайдера проверять через `x` на целевую возможность или файл действия.

#### Последствия

ACL остается маленьким и одинаковым для разных провайдеров. Бизнес-смысл команды живет в слое провайдера или сервиса, а не в пространстве имен прав.

### ADR-002: `ResourceRef` как идентичность ACL

#### Контекст

Пути могут переименовываться, псевдонимы точек монтирования могут отличаться между областями ресурсов, а внешние провайдеры часто имеют собственные стабильные ID.

#### Проблема

ACL-правила на сырые URI или пути монтирования ломаются при переименовании, перемещении и смене псевдонима.

#### Варианты

- хранить права на исходную строку URI;
- хранить права на путь монтирования;
- хранить права на нормализованный `ResourceRef`.

#### Решение

Хранить ACL по распознанной идентичности ресурса: провайдер, подключение, область ресурсов и стабильный ID или нормализованный путь.

#### Последствия

Правила ACL становятся пригодными для индексов, долгоживущих ссылок, переименования, перемещения и разных моделей провайдеров.

## Словарь технических имен

- `ACL` - список правил доступа.
- `VFS` - виртуальная файловая система.
- `URI` - адрес ресурса.
- `scope` - настоящий ключ в URI и таблицах для области ресурсов, например `[scope:1]` и `scope_id`.
- `ResourceRef` - нормализованная ссылка на ресурс для ACL и долговечных ссылок.
- `subject_key` - ключ субъекта в таблице прав.
- `allow` и `deny` - значения в БД для правил «разрешить» и «запретить».
- `r`, `w`, `x` - короткие обозначения прав на чтение, изменение и выполнение.

## Детали реализации

### Основная идея

ACL должен быть общим слоем авторизации для всей VFS-архитектуры.

Система представляется как набор ресурсов, адресуемых через URI, который начинается с провайдера:

```text
local@default:///docs/a.txt
users@system:///"admin - 1"/userdata.json
functions@system:///resize-image
functions@system:///resize-image/source.go
html@system:///home
gdrive@work:///My Drive/report.docx
acl@system:///rules
```

ACL не должен знать бизнес-команды вроде `run-function`, `reset-password`,
`assign-group` или `delete-user` как отдельные действия. Вместо этого все
операции сводятся к маленькому похожий на Unix набору:

```text
r = читать
w = писать
x = выполнить / traverse / invoke возможность
```

Базовый вопрос авторизации:

```text
Can(subject, action, resource)
```

Например:

```text
Can(user:7, r, local@default:///docs/a.txt)
Can(group:client, x, functions@system:///resize-image)
Can(service:executor, r, functions@system:///resize-image/source.go)
Can(user:42, w, acl@system:///rules)
```

### 2. Субъекты

Субъект - это тот, кто выполняет действие.

Рекомендуемый формат:

```text
subject_key
```

Примеры:

```text
user:7
group:admin
group:editor
guest
all
service:executor
service:html-renderer
service:indexer
service:thumbnailer
service:backup
service:gc
```

`user:*` - реальные пользователи.

`group:*` - роли RBAC.

`guest` - неавторизованный caller.

`all` - все caller'ы, включая авторизованных и гостей.

`service:*` - внутренние сервисные principals. Их лучше не смешивать с
обычными пользователями в доменной модели. Они нужны, когда серверный модуль
делает операцию не напрямую от имени пользователя, а как внутренний исполнитель.

Пример:

```text
user:7 может запустить функцию
service:executor может прочитать исходник функции
```

Это разные права на разные ресурсы.

### 3. Ресурсы

Внешне ресурс адресуется URI:

```text
<провайдер>[@<подключение>][\[<область>\]]:///<путь>[?<параметры>]
```

В этой схеме `[...]` означает необязательную часть, а `\[` и `\]` означают настоящие квадратные скобки внутри URI. Часть `[?<параметры>]` тоже необязательная; `?` внутри нее является настоящим символом URI, например `?export=pdf`.

Примеры:

```text
local:///docs/a.txt
local@default:///docs/a.txt
local@default[scope:1]:///docs/a.txt
gdrive@work[scope:1]:///doc123?export=pdf
```

Но в БД ACL лучше хранить не сырой URI, а нормализованную распознанную идентичность.

Причина:

```text
URI удобен для людей, API и логов.
Распознанный `ResourceRef` удобен для БД, индексов, стабильных ссылок и ACL.
```

Для `local`/внутреннего VFS лучше использовать стабильный `metadata.id`, а не
путь. Для Google Drive лучше использовать внешний file ID. Для S3 object key
может быть стабильной идентичностью. Для провайдеров-проекций можно использовать
доменные id или нормализованный путь.

### 4. ResourceRef

Рекомендуемая структура в коде:

```go
type ResourceRef struct {
    Provider     string // local, users, functions, html, acl, gdrive, s3
    ConnectionID string // system, default, conn:8842

    AreaType string // user, system, org, project, service
    AreaID   string // 42, acme, empty for system

    IdentityKind string // id or путь
    ResourceID   string // metadata:105, file-id:abc123, func:12
    Path         string // /docs/a.txt, /resize-image/source.go
}
```

Правило:

```text
Если провайдер умеет стабильный ID, ACL использует id.
Если стабильный ID нет или он не нужен, ACL использует нормализованный путь.
```

Примеры распознанной идентичности:

```text
local@default:///docs/a.txt
  provider=local
  connection_id=conn:local-user-42-default
  scope=user:42
  identity_kind=id
  resource_id=metadata:105
  path=/docs/a.txt

gdrive@work:///My Drive/report.docx
  provider=gdrive
  connection_id=conn:8842
  scope=user:42
  identity_kind=id
  resource_id=file-id:abc123
  path=/My Drive/report.docx

s3@assets:///images/logo.png
  provider=s3
  connection_id=conn:9001
  scope=user:42
  identity_kind=path
  resource_id=
  path=/images/logo.png

functions@system:///resize-image
  provider=functions
  connection_id=system
  scope=system
  identity_kind=path
  resource_id=
  path=/resize-image
```

### 5. Таблица ACL

Базовая таблица:

```sql
CREATE TABLE resource_acl (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    subject_key TEXT NOT NULL,
    action TEXT NOT NULL, -- r, w, x
    effect TEXT NOT NULL DEFAULT 'allow', -- allow или deny
    recursive BOOLEAN NOT NULL DEFAULT 0,

    resource_provider TEXT NOT NULL,
    resource_connection_id TEXT NOT NULL,
    resource_scope_type TEXT NOT NULL DEFAULT '',
    resource_scope_id TEXT NOT NULL DEFAULT '',

    resource_identity_kind TEXT NOT NULL DEFAULT 'path', -- id или path
    resource_id TEXT NOT NULL DEFAULT '',
    resource_path TEXT NOT NULL DEFAULT '/',

    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        subject_key,
        action,
        resource_provider,
        resource_connection_id,
        resource_scope_type,
        resource_scope_id,
        resource_identity_kind,
        resource_id,
        resource_path
    )
);
```

Индексы:

```sql
CREATE INDEX idx_resource_acl_subject
ON resource_acl(subject_key);

CREATE INDEX idx_resource_acl_lookup
ON resource_acl(
    resource_provider,
    resource_connection_id,
    resource_scope_type,
    resource_scope_id,
    resource_identity_kind,
    resource_id,
    resource_path,
    action,
    subject_key
);

CREATE INDEX idx_resource_acl_resource
ON resource_acl(
    resource_provider,
    resource_connection_id,
    resource_scope_type,
    resource_scope_id,
    resource_identity_kind,
    resource_id,
    resource_path
);
```

В SQLite лучше использовать пустую строку вместо `NULL` в полях уникальности,
потому что `NULL` усложняет `UNIQUE`.

### 6. Значение r/w/x

Для обычного файла:

```text
r = прочитать содержимое
w = изменить содержимое или метаданные файла
x = выполнить файл, если провайдер поддерживает семантику выполнения
```

Для директории:

```text
r = увидеть список children, ReadDir
w = изменить состав директории: create, delete, rename, move children
x = пройти через директорию, resolve путь к вложенному ресурсу
```

Для провайдер-проекция:

```text
r = прочитать представление ресурса
w = изменить представление ресурса через провайдер или сервисную валидацию
x = вызвать возможность, command или ресурс действия
```

Пример `users`:

```text
users@system:///"admin - 1"/userdata.json
  r = прочитать JSON пользователя
  w = обновить пользователя через auth/user service

users@system:///"admin - 1"/password.action
  x = выполнить сброс/смену пароля
```

Пример `functions`:

```text
functions@system:///resize-image
  r = прочитать описание функции
  w = изменить настройки функции
  x = запустить функцию

functions@system:///resize-image/source.go
  r = прочитать исходник
  w = изменить исходник
```

### 7. Маппинг VFS-методов в ACL

Рекомендуемый маппинг:

```text
Stat(uri)
  requires x on parent directories
  requires r on target

ReadDir(uri)
  requires x on directory
  requires r on directory

OpenFile(uri, O_RDONLY)
  requires x on parent directories
  requires r on file

OpenFile(uri, O_WRONLY/O_RDWR/O_CREATE)
  requires x on parent directories
  requires w on file, if file exists
  requires w on parent directory, if creating

Mkdir(parent/name)
  requires x on parent directory
  requires w on parent directory

Delete(uri)
  requires x on parent directory
  requires w on parent directory

Move(oldURI, newURI)
  requires w on old parent directory
  requires w on new parent directory

Control(uri, command, input)
  requires x on target or x on command/action resource
```

Обычные операции создания, чтения, изменения и удаления не нужно складывать в `Control`. `Control` нужен для
специфичных для провайдера команд и вызова возможностей.

### 8. Control и файлы действия

`Control` мапится на `x`.

Пример:

```text
Control(functions@system:///resize-image, "run", input)
  -> Can(исполнитель, x, functions@system:///resize-image)
```

Если команду нужно показать клиентам, которые работают через файловую модель, можно использовать action
files:

```text
functions@system:///resize-image/run.action
users@system:///"admin - 1"/password.action
gdrive@work:///.sync.action
```

Тогда проверка:

```text
Can(исполнитель, x, functions@system:///resize-image/run.action)
Can(исполнитель, x, users@system:///"admin - 1"/password.action)
Can(исполнитель, x, gdrive@work:///.sync.action)
```

Так `run`, `sync`, `reset-password`, `grant`, `revoke` не становятся отдельными
ACL actions. Они становятся исполняемыми ресурсами.

### 9. Функции: логический ресурс и исходник

Функцию нужно разделять на два ресурса:

```text
functions@system:///resize-image
functions@system:///resize-image/source.go
```

Первый - логическая функция как возможность.

Второй - файл исходного кода или представление исходника.

Пример ACL:

```text
group:client x functions@system:///resize-image allow
service:executor r functions@system:///resize-image/source.go allow
user:7 w functions@system:///resize-image/source.go allow
```

Пайплайн запуска:

```text
1. user:7 вызывает Control(functions@system:///resize-image, "run", input)
2. ACL проверяет Can(user:7, x, functions@system:///resize-image)
3. Сервис функций находит исходник resource
4. Исполнитель функций проверяет Can(service:executor, r, source.go)
5. Исполнитель функций читает исходник и запускает функцию
```

Пользователь может иметь `x` на функцию и при этом не иметь `r` на исходник.
Это главная причина, почему нужен сервисный слой поверх VFS.

### 10. HTML

HTML-страницы тоже лучше разделять на публичный логический ресурс и внутренние
файлы/блоки:

```text
html@system:///home
html@system:///home/content.md
html@system:///home/script.js
html@system:///home/style.css
```

Пример ACL:

```text
guest r html@system:///home allow
service:html-renderer r html@system:///home/content.md allow
service:html-renderer r html@system:///home/script.js allow
service:html-renderer r html@system:///home/style.css allow
group:editor w html@system:///home recursive allow
```

Гость может видеть страницу, но не обязан иметь прямой файловый доступ к ее
исходным блокам.

### 11. Local/VFS

Для `local` лучше использовать стабильный ID, а не путь.

Плохо для долгоживущих ACL:

```text
local@default:///docs/a.txt
```

Потому что rename/move меняют путь.

Лучше:

```text
provider=local
connection_id=conn:local-user-42-default
scope=user:42
identity_kind=id
resource_id=metadata:105
```

При этом путь все равно можно хранить как вспомогательное поле для UI, логов и
debug:

```text
resource_path=/docs/a.txt
```

Рекурсивность для local считается через `metadata.parent_id`:

```text
metadata:220
metadata:105
metadata:10
metadata:1
```

Если правило стоит на `metadata:105` с `recursive=true`, оно применяется ко
всему поддереву.

### 12. Remote провайдеры

Для внешние провайдеры идентичность зависит от их модели.

Google Drive:

```text
identity_kind=id
resource_id=file-id:abc123
path=/My Drive/report.docx
```

S3:

```text
identity_kind=path
resource_path=/images/logo.png
```

GitHub:

```text
identity_kind=path
resource_path=/repo/main/internal/vfs/vfs.go
```

Если провайдер умеет стабильный внешний ID, лучше использовать его для ACL. Если нет,
используется нормализованный путь/object key.

Внешний провайдер может иметь собственные права. Тогда доступ разрешается только
если прошли обе проверки:

```text
внутренний ACL разрешил доступ
AND
внешний провайдер разрешил доступ
```

Внутренний ACL не должен расширять полномочия внешней системы.

### 13. Пути монтирования

Путь монтирования - это псевдоним, а не идентичность ACL.

Пример:

```text
/cloud/google/work/report.docx
  -> gdrive@work:///My Drive/report.docx
  -> распознанный ResourceRef
```

ACL должен проверяться после распознавания путь монтирования в канонический URI и затем в
распознанный ResourceRef.

Не нужно хранить права на путь монтирования как на стабильную идентичность, потому что
точка монтирования может быть переименована, перенесена или иметь разный смысл в разных
пространствах имен.

### 14. Область ресурсов и исполнитель

Нужно разделять:

```text
actor = кто выполняет операцию
scope = чье пространство/подключение провайдера адресуется
target = конкретный ресурс
```

Пример:

```text
local@default:///docs/a.txt
```

Для `user:42`:

```text
actor=user:42
scope=user:42
target=local default connection user:42
```

Для admin-запроса:

```text
local@default[user:17]:///docs/a.txt
```

```text
actor=user:42
scope=user:17
target=local default connection user:17
```

Авторизация спрашивает:

```text
Can user:42 perform r/w/x on resolved target in user:17 scope?
```

### 15. Алгоритм проверки

Основная функция:

```go
Can(ctx context.Context, actor Subject, action Action, resource ResourceRef) (bool, error)
```

Шаги:

```text
1. Собрать ключи субъекта:
   user:7
   group:admin
   group:editor
   all

   Для гостя:
   guest
   all

   Для сервиса:
   service:executor
   all-services, если такой общий subject понадобится

2. Построить кандидаты ресурса.

   Для провайдера с ID:
   target id
   parent id
   parent parent id
   root id

   Для провайдера с путями:
   /a/b/c.txt
   /a/b
   /a
   /

3. Найти правила:
   subject_key IN (...)
   action = requested action
   resource candidate IN (...)

4. Применить:
   exact rule works always
   parent rule works only if recursive=true
   deny wins over allow
   closer resource wins before farther resource

5. Если явных правил нет:
   правило владельца может дать неявные права
   иначе запретить
```

### 16. Owner default

Для local/VFS и доменных ресурсов полезно иметь владельца.

Владелец может получать неявный полный доступ:

```text
owner -> r/w/x
```

Но это не обязательно хранить как ACL-записи на каждый новый ресурс.

Лучше хранить владельца в metadata/domain table:

```text
metadata.owner_subject_key = user:7
functions.owner_subject_key = user:7
html_pages.owner_subject_key = user:7
```

А `Can` после явных ACL проверяет правило владельца.

Возможная политика:

```text
явный запрет сильнее правила владельца
правило владельца сильнее запрета по умолчанию
```

### 17. Share

Share - это не отдельное ACL action.

Выдача доступа - это запись в ACL провайдер:

```text
acl@system:///rules
acl@system:///resources/...
```

Чтобы пользователь мог выдать доступ, он должен иметь право изменять ACL
соответствующего ресурса:

```text
Can(user:7, w, acl@system:///resources/local/metadata:105)
```

Практический вариант для первого этапа:

```text
owner ресурса может менять ACL ресурса
group:admin w acl@system:/// recursive allow
```

А сам share создает правила:

```text
user:8 r local metadata:105 recursive allow
user:8 w local metadata:105 recursive deny
```

### 18. Провайдер parent resolution

Для рекурсивного ACL каждый провайдер должен уметь строить ancestors/кандидаты.

Примеры:

```text
local:
  metadata.parent_id

gdrive:
  внешние ID родителей, если доступны

s3:
  путь prefixes

functions:
  /resize-image/source.go
  /resize-image
  /

users:
  /"admin - 1"/userdata.json
  /"admin - 1"
  /
```

Это лучше оформить как возможность провайдера или распознавателя:

```go
type ACLResourceResolver interface {
    ACLCandidates(ctx context.Context, ref ResourceRef) ([]ResourceRef, error)
    Owner(ctx context.Context, ref ResourceRef) (string, error)
}
```

### 19. Путь распознавания

Общий путь обработки:

```text
1. Получить исполнитель из контекста
2. Разобрать URI или путь монтирования
3. Распознать итоговую область ресурсов
4. Найти подключение провайдера
5. Распознать путь в стабильную идентичность провайдера, если провайдер это умеет
6. Построить ResourceRef
7. Проверить Can(исполнитель, r/w/x, ResourceRef)
8. Вызвать метод провайдера
```

Так ACL не зависит от красивого пути монтирования и не парсит URI внутри SQL.

### 20. Совместимость со старым RBAC

Старые строковые ключи прав можно мигрировать постепенно.

Примеры:

```text
auth.admin.users.читать
  -> group/admin r users@system:/// recursive allow

auth.admin.users.update
  -> group/admin w users@system:/// recursive allow

acl.groups.create
  -> group/admin w acl@system:///groups recursive allow

functions.compile
  -> group/developer x functions@system:///compile.action allow

html.представления.*
  -> all r html@system:/// recursive allow
```

Со временем `ключи прав.key` можно оставить как фасад совместимости, но
источником истины должен стать `resource_acl`.

### 21. Итог

Финальная ACL-модель:

```text
subject_key + r/w/x + resolved resource identity + effect + recursive
```

Где:

```text
subject_key = user, group, guest, all, service
resource identity = provider + connection + scope + id/path
effect = allow или deny
recursive = применять к потомкам
```

Главное разделение:

```text
URI для людей, клиентов и навигации.
Распознанный `ResourceRef` для ACL, БД и стабильных ссылок.
Путь монтирования только псевдоним.
Control и *.action проверяются через x.
Обычные изменения проверяются через w.
Обычное чтение проверяется через r.
```

Эта модель совместима с VFS с URI, начинающимся с провайдера, провайдер-проекцияов, mount
пространства имен, сервисные субъекты, функциями, HTML, внешние провайдеры и обычным
локальное хранилище.
