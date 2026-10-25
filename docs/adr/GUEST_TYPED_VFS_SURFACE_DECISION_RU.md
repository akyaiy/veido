# ADR-013: Guest surface через typed VFS façades

> Статус решения: принято.
> Статус реализации: не реализовано.
> Дата решения: 25 октября 2026 года.
> Связанные документы: [ADR-003](ACL_LIFECYCLE_ARCHITECTURE_RU.md),
> [ADR-008](VFS_V2_SERVER_HOOKS_DECISION_RU.md),
> [ADR-009](PREPROD_SERVER_RUNTIME_DECISION_RU.md),
> [ADR-011](AUTH_SESSION_JWT_LIFECYCLE_DECISION_RU.md),
> [ADR-012](USERS_PROVIDER_AUTH_HOOKS_DECISION_RU.md).

## 1. Контекст

Отсутствие access JWT не означает отсутствие исполнителя: Auth устанавливает
trusted `guest` actor. Гость должен иметь только минимальную поверхность
системы: прочитать доступный ему сайт, зарегистрироваться, войти и восстановить
сессию по refresh credential. Generic VFS HTTP transport (`/api/v2/vfs/*`),
редакторские, административные и прочие функции не должны существовать для
гостя.

Все эти возможности всё равно являются VFS-операциями. В частности, login и
registration выполняются Auth Provider через VFS Core; нельзя заменять их
прямым вызовом Auth domain service или создавать обход Auth/ACL/VFS Core.

Недопустимы два противоположных решения:

- выдать гостю generic VFS API и надеяться на фильтрацию URI/command в HTTP
  handler;
- завести отдельный обязательный functional authorizer, дублирующий ACL.

Первое позволяет клиенту собирать произвольные VFS-вызовы, второе нарушает
разделение, при котором универсальное решение принимает ACL.

## 2. Решение

Для гостя публикуются только typed HTTP façades. Каждый façade имеет фиксированный
контракт, строит ровно определённую VFS-операцию и не принимает от клиента
`provider`, `scope`, произвольный URI, VFS method или command.

```text
guest HTTP request
  -> typed Auth/Site façade
  -> fixed canonical operation URI + typed input
  -> VFS Core
  -> ACL.Can(guest, x/r, URI)
  -> provider-владелец
```

Generic VFS transport остаётся отдельной surface:

```text
/api/v2/vfs/*
```

Он существует только для authenticated `user` actor. Для guest actor этот
namespace не достигает VFS HTTP adapter и отвечает `404 Not Found`.

Все API-вызовы, включая Auth, используют prefix `/api/v2`. Начальная guest
surface имеет вид:

| HTTP endpoint | Fixed VFS target | Назначение |
| --- | --- | --- |
| `POST /api/v2/auth/register` | Auth registration operation URI | Создать identity и начальный session state |
| `POST /api/v2/auth/login` | Auth login operation URI | Проверить credential и выпустить session/JWT |
| `POST /api/v2/auth/refresh` | Auth refresh operation URI | Ротировать session по HttpOnly refresh cookie |
| `GET /api/v2/site/tree` | Site-bound read of actor-filtered tree | Вернуть guest-visible TreeView для построения route → page key |
| `GET /api/v2/site/pages/{page-key}` | Site-bound `get-page` operation | Вернуть guest-visible PageView по page key |
| `GET /api/v2/site/blocks/{block-key}` | Site-bound `get-block` operation | Вернуть guest-visible BlockView |
| browser site routes | Site-bound `get-page` + template entrypoint | Разрешить путь, затем отдать shell с bootstrap PageView |
| `GET /_static/*` | Site-bound `get-static` operation | Отдать только manifest-listed static asset |

`refresh` не является guest privilege: этот endpoint можно вызвать без access
JWT, но Auth Provider обязан потребовать валидный refresh credential. Его
отсутствие или невалидность не восстанавливает user actor.

### 2.1. Public Site API

Browser не должен получать `bundle_root_uri`, HTML-provider metadata URI или
physical URI и затем читать их через `/api/v2/vfs/read`. Вместо этого Public
Site API сохраняет доменную навигационную модель HTML Provider:

```text
GET /api/v2/site/tree
  -> actor-filtered tree.json
  -> frontend строит route path -> page_key
  -> GET /api/v2/site/pages/{page_key}
  -> PageView и разрешённые ссылки на BlockView
  -> GET /api/v2/site/blocks/{block_key}
```

`TreeView` содержит только эффективно видимые actor-у nodes; невидимый parent
скрывает всё своё поддерево. `PageView` и `BlockView` возвращаются только для
соответствующего видимого ключа и содержат лишь данные, необходимые browser-у
для отображения. Конкретная форма DTO принадлежит HTML/Site contract; DTO не
содержит VFS URI, provider key, scope key или произвольный VFS command.

`page-key` и `block-key` — provider-owned domain keys, а не клиентские VFS URI.
Façade канонизирует ключ, строит фиксированный target в site binding и выполняет
VFS-вызов с исходным actor. Угадывание скрытого ключа приводит к `404`.

Browser route `GET /{path...}` не может безусловно отдавать один и тот же
`index.html`: до выдачи shell Site adapter разрешает path по тому же
actor-filtered tree. Если route не сопоставлен с видимым `page-key`, ответ —
`404`; если сопоставлен, adapter возвращает template shell. Browser затем
получает tree и PageView по описанному контракту. Bootstrap может включить уже
разрешённый `page-key` и revision дерева как оптимизацию, но не заменяет
actor-filtered проверку.

Каждый Site hook внутри читает page/block metadata и необходимые physical bundle
файлы только через actor-bound VFS. Он не передаёт browser-у право повторить эти
чтения с произвольным URI.

## 3. Function как VFS resource

ACL принимает решение по действию и каноническому URI. Поэтому независимо
авторизуемые Auth-функции должны адресоваться разными каноническими operation
resources, а не различаться только строкой команды у одного общего URI.

Целевая форма URI определяется Auth Provider; например:

```text
auth@system:///operations/register
auth@system:///operations/login
auth@system:///operations/refresh
auth@system:///operations/logout
auth@system:///operations/change-password
auth@system:///operations/revoke-sessions
```

Typed façade вызывает `Control`/`Exec` только целевого operation resource.
ACL может выдать `guest` действие `x` для login и register, не открывая logout,
смену пароля, отзыв сессий или произвольный `Control` над Auth Provider.

Auth Provider остаётся владельцем доменной семантики: проверяет credential,
refresh cookie из доверенного transport context, session lifecycle и свои
инварианты. ACL `allow` не отменяет отказ Auth Provider.

## 4. Отсутствие как семантика deny

Для guest actor запрещённая функция или невидимый ресурс не существуют.

- guest request к `/api/v2/vfs/*` возвращает `404` до generic VFS adapter;
- deny ACL при вызове typed façade маппится в `not_found`/HTTP `404`;
- Site adapter возвращает `404`, если page/block/asset не входит в guest
  projection либо ACL не разрешает нужное чтение;
- прямое угадывание URI, page key, block key или operation URI не раскрывает
  существование сущности.

Некорректный payload остаётся `400`, а предъявленный, но невалидный access JWT
остаётся `401`: это ошибки протокола и аутентификации, не сигнал о существовании
целевого ресурса.

## 5. Границы компонентов

| Компонент | Ответственность | Не делает |
| --- | --- | --- |
| Auth middleware | Устанавливает trusted `guest` или `user` actor | Не разрешает VFS-функции |
| Typed façade | Декодирует свой input и вызывает один фиксированный VFS target | Не принимает произвольный URI/command и не решает ACL |
| VFS Core | Разрешает URI, применяет ACL, вызывает provider | Не знает HTTP route или Auth cookie |
| ACL | Решает `r/w/x` для actor и canonical URI | Не знает frontend route или provider-local ID |
| Auth/HTML Provider | Выполняет доменную операцию и provider-local validation | Не меняет actor и не выдаёт ACL grant |
| Generic VFS adapter | Даёт user actor универсальный VFS HTTP transport | Не публикуется в guest surface |

## 6. Расширение и отзыв функциональности

Новая guest-возможность добавляется только как отдельный typed façade и отдельный
канонический operation resource либо как строго ограниченный Site façade. Затем
ACL выдаёт необходимое минимальное `x`/`r` право guest subject. Нельзя открывать
generic VFS endpoint ради одной новой функции.

Чтобы отозвать возможность, достаточно снять ACL grant; façade вернёт `404`.
Если возможность должна исчезнуть из опубликованного API целиком, façade также
удаляется из router composition. Ни один provider не получает feature flag,
прямой ACL management service или HTTP-specific список guest exceptions.

## 7. Последствия и миграция

Текущий контракт ADR-012, где Auth hooks доступны только как
`POST /api/v2/vfs/hooks/{hook-key}/run`, должен быть заменён typed маршрутами
`/api/v2/auth/*`. Внутренняя реализация может временно переиспользовать Hook
Runtime, но browser/client не получает hook key и не вызывает generic hook
transport.

Текущий pre-ACL `SystemAndOwnerScopeAuthorizer` не удовлетворяет этому решению:
он не различает operation resources и открывает configured public scope слишком
широко. Реализация ADR требует настоящего ACL evaluator и корректного mapping
ACL deny в `not_found` для guest surface.

Текущая Site HTTP реализация также не удовлетворяет решению: она отдаёт
entrypoint для каждого browser path, а frontend запрашивает `tree.json`,
page/block metadata и physical bundle через generic `/api/v2/vfs/read`. Нужно
реализовать route resolution через actor-filtered tree в browser route, Public
Site API для TreeView/PageView/BlockView и перевести browser runtime на эти
typed DTO до закрытия guest generic VFS transport.
