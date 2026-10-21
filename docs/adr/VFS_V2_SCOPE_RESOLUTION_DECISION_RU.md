# ADR-005: Разделение scope resolution и авторизации

> Статус: принятое целевое архитектурное решение, не описание готовой реализации.  
> Дата решения: 20 сентября 2026 года.  
> Связанные документы: [Shared Provider](VFS_V2_SHARED_PROVIDER_DECISION_RU.md), [концепция ACLv2](../ACL_V2_CONCEPT_RU.md), [текущая реализация VFSv2](../VFS_V2_IMPLEMENTATION_RU.md).

## 1. Контекст

Канонический URI явно содержит scope:

```text
local@default[alice]:///projects/demo
```

Текущий `ScopeResolver` при разрешении явного scope одновременно проверяет его
владельца. Несистемный scope возвращается только своему владельцу. Поэтому Bob,
открывающий ссылку

```text
shared@me[bob]:///incoming/alice/demo
```

не может повторно войти через VFS Core в исходный URI Alice: разрешение адреса
завершается отказом до вызова `Authorizer`.

Это смешивает две разные обязанности:

- scope resolution отвечает, какой scope обозначен ключом из URI;
- ACL отвечает, может ли actor войти в scope и выполнить операцию над ресурсом.

Проверка владельца внутри resolver также не позволяет выразить доступ к чужому
scope обычными ACL-правилами и вынуждает проекции искать специальный обход.

## 2. Решение

Разрешение явного scope отделяется от выбора default scope и от авторизации.

### 2.1. Явный scope

Явный scope является частью адреса. Его lookup выполняется по `scope_key` без
фильтра по actor и без принятия решения о доступе:

```go
ResolveExplicitScope(ctx context.Context, scopeKey string) (*Scope, error)
```

Результат lookup не предоставляет actor никаких прав и сам по себе не должен
раскрываться через пользовательские list API.

### 2.2. Default scope

Выбор default scope остаётся actor-dependent preference lookup:

```go
ResolveDefaultScope(ctx context.Context, actor Actor) (*Scope, error)
```

Default scope выбирает адрес для URI без явного scope, но также не заменяет
проверку доступа к выбранному scope.

Совместимый фасад может временно объединять оба пути, однако реализация и тесты
должны сохранять эту границу.

### 2.3. Авторизация входа

После lookup VFS Core проверяет `x` на каноническом ресурсе scope:

```text
scopes@scopes[system]:///scopes/<scope-key>
```

Право `x` означает только возможность использовать scope как пространство имён.
Оно не даёт `r` или `w` на connections, корни провайдеров, каталоги и файлы
внутри scope и не разрешает перечисление соседних ресурсов.

Целевая последовательность VFS Core:

```text
канонический URI
    -> выбор default scope или lookup явного scope
    -> ACL: x на ресурсе scope
    -> разрешение connection
    -> ACL: traverse по предкам и действие над целью
    -> вызов исходного provider
```

Ошибка lookup, ACL или инфраструктуры приводит к отказу. Ни resolver, ни
provider не могут трактовать ошибку как разрешение.

## 3. Применение к Shared Provider

Shared Provider хранит канонический target URI и вызывает его только через
actor-bound `BoundVFS`. Он не получает специального права обходить scope gate и
не меняет actor.

Для доступа Bob к поддереву Alice будущая операция sharing настраивает обычные
ACL-права:

```text
x на scopes@scopes[system]:///scopes/alice
x на необходимые каталоги-предки target URI
r/x recursive на target URI для viewer
r/w/x recursive на target URI для editor
```

Точный набор правил профиля определяется контрактом ACL Provider. Важный
инвариант этого ADR: вход в scope и доступ к целевому ресурсу являются разными
проверками. Разрешение входа в `alice` не открывает Bob соседние ресурсы:

```text
local@default[alice]:///projects/demo      разрешён правилами target
local@default[alice]:///projects/private   не разрешён
```

Таблица `vfs_shared_links` остаётся только индексом представления и не влияет на
scope resolution или итоговое ACL-решение.

## 4. Границы решения

Запрещены следующие способы решения проблемы:

- обход scope-проверки для запросов, пришедших из Shared Provider;
- выполнение операции от имени владельца target URI или системного actor;
- прямой вызов исходного provider в обход VFS Core;
- разрешение чужого scope на основании одной строки `vfs_shared_links`;
- перенос проверки владельца из resolver в Shared Provider;
- выдача `r` или `w` на весь scope только ради доступа к одному поддереву.

Scope остаётся частью канонического URI, а не новой глобальной идентичностью.
Решение не вводит `resource_id` и не требует provider-local ID.

## 5. Переход от текущей реализации

Контракты explicit/default lookup уже разделены, owner-фильтр explicit lookup
удалён, а VFS Core проверяет `x` на synthetic scope resource. Текущий
`OwnerScopeGateAuthorizer` покрывает только эту проверку и делегирует остальные
resource actions; demo-композиции всё ещё могут передавать разрешающий
authorizer. Это не является безопасной production policy.

Дальнейший переход выполняется так:

1. Сохранить тесты lookup чужого scope без утверждения, что доступ разрешён.
2. В интеграционных тестах Shared использовать явный тестовый authorizer,
   разрешающий только scope и target конкретного сценария.
3. В основной pre-prod сборке реализовать fail-closed owner-only policy из
   [ADR-009](PREPROD_SERVER_RUNTIME_DECISION_RU.md), проверяющую как scope gate,
   так и каждое resource action; не включать туда allow-all delegate.
4. Не включать cross-scope доступ и Shared Provider в основную сборку до
   подключения реального ACL evaluator.
5. После подключения ACL заменить временную owner-only policy и добавить
   начальные системные и пользовательские правила `x` на
   `/scopes/<scope-key>`.

Разработка Shared Provider, его хранилища, дерева и маршрутизации может идти до
завершения этого перехода. Ограничивается только реальное открытие cross-scope
содержимого в production.

## 6. Последствия

Положительные последствия:

- ScopeResolver становится компонентом адресации, а не вторым ACL;
- Shared использует тот же путь VFS Core, что прямое обращение по URI;
- доступ к чужому поддереву выражается универсальными правами;
- добавление других cross-scope проекций не требует новых обходов;
- знание URI и существование scope не превращаются в право доступа.

Цена решения:

- вход в scope становится обязательной самостоятельной ACL-проверкой;
- нужны начальные правила `x` для владельцев и системных actor;
- до замены allow-all authorizer production cross-scope sharing остаётся
  выключенным;
- листинг видимых scope должен проектироваться по ACL или отдельному индексу, а
  не через unrestricted lookup.

## 7. Критерии готовности

Решение считается внедрённым, когда выполняются сценарии:

1. Resolver находит существующий явный scope независимо от владельца.
2. Lookup чужого scope сам по себе не позволяет выполнить VFS-операцию.
3. Actor без `x` на scope получает отказ до вызова target provider.
4. Actor с `x` на scope, но без права на target, также получает отказ.
5. Bob открывает активную shared-ссылку на разрешённое поддерево Alice через
   `BoundVFS` и VFS Core.
6. Bob не может прочитать соседний URI в том же scope Alice.
7. Shared Provider не содержит специальных scope bypass или смены actor.
8. Ошибка authorizer приводит к fail-closed поведению в HTTP и WebDAV.
