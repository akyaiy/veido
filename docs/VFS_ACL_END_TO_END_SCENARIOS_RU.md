# VFS + ACL: общий сквозной сценарий

## Назначение

Этот документ показывает, как VFS и ACL вместе проводят одну операцию от входного запроса до результата.

VFS отвечает за адресацию, маршрутизацию и вызов провайдера. ACL отвечает за решение, можно ли исполнителю войти в нужную область ресурсов и выполнить действие над целевым ресурсом. Провайдер отвечает за конкретную работу с локальным хранилищем, системным сервисом, общей надстройкой или внешним API.

Короткая формула:

```text
исполнитель -> URI/путь монтирования -> область ресурсов -> подключение провайдера -> ResourceRef -> ACL -> операция FSProvider
```

## Когда используется

Этот сценарий нужен как опорная карта для разработки:

- `ResourceResolver` или `VFSRouter`;
- URI, который начинается с провайдера;
- точки монтирования, привязанные к области ресурсов;
- ACL-проверок для файловых методов;
- `Control` и файлов действия;
- общего доступа;
- провайдеров пользователей, функций, локального хранилища и внешних систем.

## Как работает

Типовая операция проходит такой путь:

1. Исполнитель делает запрос к URI или пути монтирования.
2. Система определяет исполнителя из контекста.
3. Путь монтирования, если он передан, распознается внутри текущей области ресурсов.
4. URI разбирается на провайдер, подключение, область ресурсов, путь и параметры запроса.
5. Распознаватель определяет итоговую область ресурсов.
6. ACL проверяет, может ли исполнитель войти в эту область ресурсов.
7. Распознаватель находит подключение провайдера внутри области ресурсов.
8. Провайдер распознает путь и получает стабильную идентичность ресурса, если это возможно.
9. ACL проверяет право `r`, `w` или `x` на целевой `ResourceRef`.
10. Провайдер выполняет операцию и возвращает результат.

## Компоненты

- Исполнитель - пользователь, группа, гость или сервис, который выполняет операцию.
- Область ресурсов - пространство ресурсов пользователя, проекта, организации, системы или сервиса.
- Подключение провайдера - конкретное подключение провайдера внутри области ресурсов.
- Точка монтирования - удобный псевдоним внутри области ресурсов, а не стабильная идентичность.
- URI ресурса - канонический адрес ресурса.
- `ResourceRef` - нормализованная идентичность для ACL и долговечных ссылок.
- ACL - слой авторизации для входа в область ресурсов и доступа к целевому ресурсу.
- `FSProvider` - исполнитель файловой операции в конкретной модели данных.

## Пример

Администратор читает файл пользователя `17`:

```text
local@default[user:17]:///docs/a.txt
```

Система не считает этот путь домашней папкой администратора. Она читает исполнителя как `user:42`, распознает `[user:17]` как область ресурсов пользователя `17`, находит `local@default` внутри этой области, строит `ResourceRef` файла и только потом проверяет:

```text
Can(user:42, x, scope@system:///scopes/{user17-default-scope})
Can(user:42, r, local resource metadata:105)
```

Если обе проверки прошли, провайдер читает файл.

## Ограничения

- исполнителя и область ресурсов нельзя смешивать: исполнитель выполняет операцию, область ресурсов задает адресуемое пространство;
- `/` для WebDAV и файлового просмотра показывает доступные области ресурсов, а не глобальный корень локальной файловой системы;
- Путь монтирования всегда сначала превращается в канонический URI.
- ACL применяется после распознавания ресурса, а не к исходной строке пользовательского пути.
- Провайдер не должен сам угадывать пользователя или подключение, он получает уже готовую конфигурацию.

## Словарь технических имен

- `VFS` - виртуальная файловая система.
- `ACL` - список правил доступа.
- `URI` - адрес ресурса.
- `scope` - настоящий ключ в URI и таблицах для области ресурсов, например `[scope:1]` и `scope_id`.
- `provider` - провайдер; в URI и именах таблиц это техническое имя.
- `ResourceRef` - нормализованная ссылка на ресурс для ACL и долговечных ссылок.
- `FSProvider`, `ResourceResolver`, `VFSRouter` - имена интерфейсов и компонентов в коде.

## Детали реализации

### Назначение документа

Этот документ описывает, как VFS, области ресурсов, подключения провайдера, точки монтирования, ACL, `Control`, функции и общий доступ работают вместе в одной модели.

Основная идея:

```text
исполнитель -> URI/путь монтирования -> область ресурсов -> подключение провайдера -> ResourceRef -> ACL -> FSProvider операция
```

VFS отвечает за адресацию и операции.

ACL отвечает за авторизацию.

Провайдер отвечает за конкретную реализацию ресурса: локальное хранилище, пользователи, функции, общие ресурсы, внешний API и т.д.

### 2. Базовые сущности

#### Исполнитель

`исполнитель` - тот, кто выполняет операцию.

Примеры:

```text
user:42
group:admin
guest
service:executor
service:html-renderer
service:indexer
```

Исполнитель приходит из контекста запроса, сессии, токена, сервисный контекст или внутренний контекст выполнения.

#### Область ресурсов

`scope` - ключ области ресурсов внутри URI.

Область ресурсов не равна пользователю. Пользователь может иметь несколько областей ресурсов. Область ресурсов может принадлежать пользователю, системе, проекту, организации, команде или сервису.

Примеры:

```text
scope:1 = основная личная область ресурсов пользователя 42
scope:2 = основная личная область ресурсов пользователя 17
scope:3 = архивная область ресурсов пользователя 42
scope:10 = проектная область ресурсов проекта acme
scope:0 = системная область ресурсов
```

Рекомендуемая таблица:

```text
scopes
  id
  kind                 // personal, system, org, project, team, service
  slug                 // main, archive, acme, backend
  display_name
  owner_subject_key    // optional правило владельца: user:42, org:3, system
  created_at
  updated_at
```

Область ресурсов сама является ресурсом ACL:

```text
scope@system:///scopes/1
scope@system:///scopes/2
scope@system:///scopes/project-acme
```

Права на область ресурсов:

```text
r = видеть область ресурсов и выводить ее в списке
w = менять настройки области ресурсов, точки монтирования, подключения провайдера
x = войти в область ресурсов и использовать ее как итоговую цель
```

#### Область ресурсов по умолчанию для субъекта

Если URI указывает не конкретную область ресурсов `[scope:88]`, а субъекта `[user:17]`, нужно понять, какую область ресурсов этого пользователя брать по умолчанию.

Для этого нужна таблица:

```text
principal_default_scopes
  principal_type   // user, org, service, system
  principal_id
  scope_id
```

Минимальный старт лучше делать без `purpose`. Если позже появятся разные дефолты для `local`, `functions`, `admin`, можно добавить:

```text
purpose // default, local, functions, admin
```

Пример:

```text
principal_type  principal_id  scope_id
user            42            1
user            17            2
system          ""            0
```

#### Провайдер подключение

`provider_connection` - конкретное подключение провайдера внутри области ресурсов.

```text
provider_connections
  id
  scope_id
  provider_type      // local, gdrive, s3, functions, users, shared
  connection_key     // ключ подключения: default, work, system, me, assets
  config_json
  status
  created_at
  updated_at
```

Уникальность:

```text
UNIQUE(scope_id, provider_type, connection_key)
```

Примеры:

```text
scope_id  provider_type  connection_key  config_json
1         local          default          {"root_node_id":"105"}
2         local          default          {"root_node_id":"220"}
1         gdrive         work             {"credentials_ref":"..."}
0         functions      system           {"root":"functions"}
0         users          system           {}
1         shared         me               {}
```

#### Точка монтирования

Путь монтирования - человекочитаемый псевдоним внутри области ресурсов.

```text
mount_points
  id
  scope_id
  mount_path
  target_uri
  flags
```

Пример для область ресурсов пользователя 42:

```text
/home               -> local@default:///
/shared             -> shared@me:///
/cloud/google/work  -> gdrive@work:///
```

Путь монтирования не является стабильной ACL идентичность. Сначала он распознается в канонический URI, затем в распознанным `ResourceRef`.

### 3. Формат URI

Канонический формат:

```text
<провайдер>[@<подключение>][\[<область>\]]:///<путь>[?<параметры>]
```

В этой схеме `[...]` означает необязательную часть, а `\[` и `\]` означают настоящие квадратные скобки внутри URI. Часть `[?<параметры>]` тоже необязательная; `?` внутри нее является настоящим символом URI, например `?export=pdf`.

Примеры:

```text
local@default:///docs/a.txt
local@default[user:17]:///docs/a.txt
local@default[scope:88]:///archive/a.txt
users@system:///"admin - 1"/userdata.json
functions@system:///resize-image
functions@system:///resize-image/source.go
gdrive@work:///My Drive/report.docx
shared@me:///project/file.md
```

Смысл:

```text
provider   = тип провайдера
connection = имя подключения внутри области ресурсов
scope      = необязательный явный селектор области ресурсов или субъекта
path       = путь внутри подключения провайдера
parameters = фильтр/версия/формат, но не операция
```

Если область ресурсов не указана:

```text
scope = область ресурсов исполнителя по умолчанию
```

Если указан `[user:17]`:

```text
scope = область ресурсов пользователя 17 по умолчанию
```

Если указана область ресурсов `[scope:88]`:

```text
scope = область ресурсов 88 напрямую
```

### 4. Общий путь распознавания

Для любой VFS-операции:

```text
1. Получить исполнитель из контекста
2. Принять URI или путь монтирования
3. Если пришел путь монтирования, распознать его внутри текущей области в канонический URI
4. Разобрать ResourceURI
5. Распознать итоговую область ресурсов
6. Найти запись области ресурсов
7. Проверить ACL на вход в область:
   Can(исполнитель, x, scope@system:///scopes/{scope_id})
8. Найти `provider_connections` по:
   scope_id + provider_type + connection_key
9. Создать или взять из кеша экземпляр FSProvider
10. Распознать путь внутри провайдера в стабильную идентичность, если провайдер это умеет
11. Построить ResourceRef
12. Проверить ACL на конкретный целевой ресурс
13. Выполнить метод FSProvider
```

Псевдоструктура:

```go
type ResourceURI struct {
    Провайдер   string
    Connection string
    Area      *AreaSelector
    Path       string
    Query      url.Values
}

type ResourceRef struct {
    Provider     string
    ConnectionKey string
    AreaID      int64
    IdentityKind string // id, путь
    ResourceID   string // metadata:105, file-id:abc123, func:resize-image
    Path         string
}
```

### 5. Чтение local-файла обычным пользователем

Запрос:

```text
OpenFile(local@default:///docs/a.txt, O_RDONLY)
```

Исполнитель:

```text
user:42
```

Резолв:

```text
1. Область ресурсов не указана -> область ресурсов `user:42` по умолчанию -> scope:1
2. Проверить вход:
   Can(user:42, x, scope@system:///scopes/1)
3. Найти подключение провайдера:
   scope_id=1, provider_type=local, connection_key=default
4. config_json дает root_node_id=105
5. local провайдер распознает /docs/a.txt -> metadata:300
6. Построить ResourceRef:
   provider=local
   connection_id=conn:local-scope-1-default
   scope_id=1
   identity_kind=id
   resource_id=metadata:300
   path=/docs/a.txt
7. ACL:
   Can(user:42, r, metadata:300)
8. Провайдер OpenFile
```

Важно:

```text
Пользователь не видит глобальный корень.
local@default:/// означает провайдер local внутри итоговой области ресурсов.
```

### 6. Админ читает файл другого пользователя

Запрос:

```text
OpenFile(local@default[user:17]:///docs/a.txt, O_RDONLY)
```

Исполнитель:

```text
user:42
```

Резолв:

```text
1. [user:17] -> область ресурсов user:17 по умолчанию -> scope:2
2. Проверить вход:
   Can(user:42, x, scope@system:///scopes/2)
3. Найти local@default внутри области ресурсов:2
4. Распознать /docs/a.txt в metadata id внутри корня scope:2
5. Проверить:
   Can(user:42, r, распознанный local resource)
6. Выполнить OpenFile
```

Так админский доступ явно виден в URI. Нет скрытого "переключения пользователя" внутри `FSManager`.

### 7. Пользовательское пространство имен точек монтирования

Обычный пользователь видит не глобальный корень, а пространство имен точек монтирования своей области ресурсов:

```text
/
  home/
  shared/
  cloud/
  functions/
```

Например:

```text
/home/docs/a.txt
```

в область ресурсов пользователя 42 распознается:

```text
/home -> local@default:///
цель -> local@default:///docs/a.txt
```

А у пользователя 17 тот же путь монтирования может означать другой цель, потому что `/home` живет в другом scope.

### 8. Три способа обратиться к VFS

В системе есть три слоя адресации.

#### Canonical URI

Это основной внутренний адрес:

```text
local@default[scope:1]:///projects/demo
gdrive@work[scope:1]:///My Drive/report.docx
functions@system:///resize-image
shared@me:///demo/readme.md
```

Его должны предпочитать:

```text
браузерный клиент
внутренних сервисов
ACL распознаватель
audit/logging
long-lived API references
```

#### Sugar путь для WebDAV и файлового просмотра

Если клиент не использует канонический URI, можно дать обычное дерево:

```text
/{scope-name-id}/{mount}/...
```

Не нужно делать `/области/1/...`. Псевдоним области ресурсов должен быть уникальным в списке, который видит конкретный исполнитель. Поскольку области ресурсов могут быть общими, псевдоним лучше делать человекочитаемым, но устойчивым к конфликтам:

```text
/my-343123/home/projects/demo
/archive-771204/home/old/a.txt
/project-acme-9981/gdrive/report.docx
/shared-from-alex-5502/home/demo/readme.md
```

Резолв:

```text
/my-343123/home/projects/demo
  -> /my-343123 = scope:1
  -> /home = local@default:///
  -> local@default[scope:1]:///projects/demo
  -> ResourceRef
  -> ACL
  -> операция провайдера
```

#### `/` как список доступных области ресурсов

Открытие `/` показывает не глобальный корень, а области ресурсов, доступные исполнитель:

```text
/
  my-343123/
  archive-771204/
  project-acme-9981/
  shared-from-alex-5502/
```

Чтобы scope был видим в `/`, исполнитель должен иметь доступ к самому scope:

```text
Can(исполнитель, r, scope@system:///scopes/{scope_id})
or
Can(исполнитель, x, scope@system:///scopes/{scope_id})
```

Для WebDAV обычно лучше показывать только области ресурсов с `x`, чтобы видимые папки были открываемыми.

Общее правило:

```text
/                                 -> список доступных областей ресурсов
/{scope-name-id}/                 -> список точек монтирования внутри этой области ресурсов
/{scope-name-id}/{mount}/...      -> упрощенный путь
провайдер@conn[scope]:///...       -> канонический URI
ResourceRef                       -> стабильная ACL-идентичность
```

Внутри система все равно работает через канонический URI:

```text
упрощенный путь -> канонический URI -> ResourceRef -> ACL -> провайдер
```

### 9. Работа Control

`Control` нужен для специфичные для провайдера команд:

```text
Control(uri, command, input)
```

Обычный обычные операции создания, чтения, изменения и удаления не должен уходить в `Control`.

Правило:

```text
ReadDir/OpenFile/Stat/Mkdir/Move/Delete = обычные VFS-операции
Control = возможность / команда / поведение провайдера
```

ACL-маппинг:

```text
Control(...) -> x
```

Пример:

```text
Control(gdrive@work[scope:1]:///doc123, "export", {"format":"pdf"})
```

Цепочка:

```text
1. Распознать gdrive@work[scope:1]:///doc123
2. Проверить вход в область ресурсов: Can(исполнитель, x, scope)
3. Построить ResourceRef: provider=gdrive, resource_id=file-id:doc123
4. Проверить право на команду:
   Can(исполнитель, x, ресурс gdrive)
5. GDrive провайдер выполняет export
```

Если команда должна быть видна клиентам, которые работают через файловую модель, можно дать файл действия:

```text
gdrive@work:///.sync.action
functions@system:///resize-image/run.action
users@system:///"admin - 1"/password.action
```

Тогда:

```text
OpenFile(action, O_WRONLY) или Control(action, "invoke", input)
  -> Can(исполнитель, x, ресурс действия)
```

### 10. Вызов функции

Функция разделяется на два ресурса:

```text
functions@system:///resize-image
functions@system:///resize-image/source.go
```

Первый ресурс - возможность.

Второй ресурс - исходник.

Пример ACL:

```text
user:7 x functions@system:///resize-image allow
service:executor r functions@system:///resize-image/source.go allow
user:7 r functions@system:///resize-image/source.go deny
```

Пользователь может запускать функцию, но не читать исходник.

Запрос:

```text
Control(functions@system:///resize-image, "run", {"input":"..."})
```

Цепочка:

```text
1. actor=user:7
2. Распознать functions@system -> системная область ресурсов
3. Проверить вход в область ресурсов:
   Can(user:7, x, scope@system:///scopes/system)
4. Распознать возможность функции:
   ResourceRef(functions, /resize-image)
5. Check invocation:
   Can(user:7, x, functions@system:///resize-image)
6. Сервис функций принимает задачу
7. Сервис функций выбирает исходник resource:
   functions@system:///resize-image/source.go
8. Исполнитель функций работает как сервисный субъект:
   actor=service:executor
9. Исполнитель функций проверяет:
   Can(service:executor, r, functions@system:///resize-image/source.go)
10. Исполнитель функций читает source.go через VFS/OpenFile
11. Исполнитель функций запускает код
12. Результат возвращается пользователю
```

Главная идея:

```text
user:7 имеет x на возможность.
service:executor имеет r на исходник.
Это разные субъекты и разные ресурсы.
```

### 11. Изменение функции

Редактирование исходника:

```text
OpenFile(functions@system:///resize-image/source.go, O_WRONLY)
```

ACL:

```text
Can(исполнитель, w, functions@system:///resize-image/source.go)
```

Изменение настроек функции:

```text
OpenFile(functions@system:///resize-image/config.json, O_WRONLY)
```

или:

```text
Control(functions@system:///resize-image, "configure", input)
```

В первом случае это `w` на файл.

Во втором случае это `x` на возможность или команду настройки, если команда специфичные для провайдера.

### 12. Sharing как ACL-операция

Sharing не должен быть отдельным VFS action вроде `share`.

Sharing - это запись ACL-прав на ресурс.

Пример: user:42 хочет поделиться папкой:

```text
local@default:///projects/demo
```

Распознаватель строит ResourceRef:

```text
provider=local
connection_id=conn:local-scope-1-default
scope_id=1
identity_kind=id
resource_id=metadata:500
path=/projects/demo
```

Чтобы выдать доступ user:17, user:42 должен иметь право менять ACL этого ресурса.

Практический вариант:

```text
owner ресурса может менять ACL ресурса
group:admin w acl@system:/// recursive allow
```

Команда общий доступ может быть представлена как:

```text
Control(acl@system:///resources/local/metadata:500, "grant", input)
```

или через файл действия:

```text
acl@system:///resources/local/metadata:500/grant.action
```

ACL на саму операцию:

```text
Can(user:42, w, acl@system:///resources/local/metadata:500)
```

Создаваемые правила:

```text
user:17 r local metadata:500 recursive allow
user:17 x local metadata:500 recursive allow
user:17 w local metadata:500 recursive deny
```

После этого user:17 может видеть ресурс через `shared@me`.

### 13. Как работает shared@me

`shared@me` - провайдер-проекция и провайдер-надстройка.

Он не хранит файлы как провайдер хранилища. Он строит виртуальное дерево из ACL-прав и/или индекса общих ресурсов.

Пример:

```text
ReadDir(shared@me:///)
```

Цепочка:

```text
1. actor=user:17
2. scope не указан -> область ресурсов user:17 по умолчанию
3. Распознать подключение `shared@me` внутри области ресурсов `user:17`
4. Shared провайдер находит ресурсы, доступные user:17
5. Для каждого ресурса проверяется ACL:
   Can(user:17, r, цель)
6. Возвращается виртуальное дерево:
   /demo
   /docs-from-alex
```

Открытие файла:

```text
OpenFile(shared@me:///demo/readme.md, O_RDONLY)
```

Цепочка:

```text
1. Провайдер `shared` распознает /demo/readme.md в исходный ResourceRef
2. Проверяет:
   Can(user:17, r, исходный ResourceRef)
3. Делегирует OpenFile в исходный провайдер
4. Возвращает содержимое
```

Важно:

```text
общий путь - это виртуальный псевдоним.
ACL-идентичность - исходный распознанный ResourceRef.
```

### 14. Users провайдер

Провайдер пользователей - провайдер-проекция над сервисом пользователей и БД.

Пример дерева:

```text
users@system:///
  "admin - 1"/
    userdata.json
    groups.json
    password.action
  "user1 - 2"/
    userdata.json
```

Чтение:

```text
OpenFile(users@system:///"admin - 1"/userdata.json, O_RDONLY)
```

ACL:

```text
Can(исполнитель, r, users@system:///"admin - 1"/userdata.json)
```

Запись:

```text
OpenFile(users@system:///"admin - 1"/userdata.json, O_WRONLY)
```

ACL:

```text
Can(исполнитель, w, users@system:///"admin - 1"/userdata.json)
```

Провайдер поведение:

```text
1. Прочитать JSON из писать buffer
2. Распарсить
3. Провалидировать
4. Применить через user service
5. Если данные невалидны - вернуть ошибку записи
```

Смена/сброс пароля:

```text
Control(users@system:///"admin - 1", "reset-password", input)
```

или:

```text
users@system:///"admin - 1"/password.action
```

ACL:

```text
Can(исполнитель, x, users@system:///"admin - 1"/password.action)
```

### 15. Remote провайдер

Remote провайдер адаптирует внешнюю систему:

```text
gdrive@work:///My Drive/report.docx
s3@assets:///images/logo.png
github@client-acme:///repo/main/a.go
```

Цепочка:

```text
1. Распознать область ресурсов
2. Распознать подключение провайдера
3. Провайдер получает учетные данные и настройки
4. Провайдер распознает путь в внешнюю идентичность, если возможно
5. Построить ResourceRef
6. Проверить внутренний ACL
7. Проверить права внешнего провайдера
8. Выполнить операция
```

Правило:

```text
внутренний ACL не может дать больше прав, чем разрешает внешний провайдер
```

Доступ разрешен только если:

```text
внутренний ACL разрешил доступ
AND
внешний провайдер разрешил доступ
```

### 16. Где проходит граница ответственности

#### ResourceResolver / VFSRouter

Отвечает за:

```text
разбор URI
распознавание пути монтирования
распознавание области ресурсов
поиск provider_connection
поиск или создание экземпляра провайдера
построение ResourceRef
```

#### ACL

Отвечает за:

```text
Can(subject, r/w/x, ResourceRef)
запретить/разрешить
recursive rules
правило владельца
права на вход в область ресурсов и управление ей
```

#### Провайдер

Отвечает за:

```text
ResolvePathToID / стабильный идентичность
ReadDir
OpenFile
Stat
Mkdir
Move
Delete
Control
специфичная для провайдера валидация
интеграция с внешним API
```

#### Service principal

Используется, когда система действует не как пользователь, а как внутренний исполнитель.

Примеры:

```text
service:executor читает source.go
service:html-renderer читает HTML blocks
service:indexer читает документы для индекса
service:thumbnailer читает видео и пишет thumbnail
```

### 17. Итоговый полный сценарий

Пример: user:17 открывает файл, которым поделился user:42.

```text
OpenFile(shared@me:///demo/readme.md, O_RDONLY)
```

Полный путь:

```text
1. actor = user:17
2. URI = shared@me:///demo/readme.md
3. область ресурсов не указана -> область ресурсов user:17 по умолчанию -> scope:2
4. Can(user:17, x, scope@system:///scopes/2)
5. provider_connection(scope:2, shared, me)
6. SharedFSProvider распознает /demo/readme.md
7. Исходная цель:
   local@default[scope:1]:///projects/demo/readme.md
8. Распознать исходную цель в ResourceRef:
   local / conn:local-scope-1-default / metadata:501
9. ACL:
   Can(user:17, r, metadata:501)
10. Если доступ разрешен, SharedFSProvider передает OpenFile в LocalFSProvider
11. LocalFSProvider читает байты
12. Response goes back to user:17
```

Пример: user:7 запускает функцию.

```text
Control(functions@system:///resize-image, "run", input)
```

Полный путь:

```text
1. actor = user:7
2. Распознать functions@system -> системная область ресурсов
3. Can(user:7, x, scope@system:///scopes/system)
4. Распознать возможность функции ResourceRef
5. Can(user:7, x, functions@system:///resize-image)
6. Сервис функций создает задачу выполнения
7. Исполнитель функций работает как actor = service:executor
8. Распознать исходник:
   functions@system:///resize-image/source.go
9. Can(service:executor, r, source.go)
10. Исполнитель функций читает исходник через VFS
11. Исполнитель функций запускает функцию
12. Результат возвращается user:7
```

### 18. Короткая формула

```text
Область ресурсов = область ресурсов.
provider_connection = подключение провайдера внутри области ресурсов.
Точка монтирования = псевдоним внутри области ресурсов.
URI = человекочитаемый адрес.
ResourceRef = стабильная идентичность для ACL.
ACL = единственный источник прав.
Control = специфичная для провайдера возможность, проверяется через x.
Sharing = изменение ACL, а не отдельная файловая магия.
Запуск функции = x на возможность + сервисный субъект читает исходник.
```
