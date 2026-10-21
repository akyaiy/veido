# ADR-012: Users Provider и Auth hooks через VFS

> Статус решения: принято.  
> Статус реализации: реализовано.  
> Дата решения: 21 октября 2026 года.  
> Связанные документы: [ADR-008](VFS_V2_SERVER_HOOKS_DECISION_RU.md),
> [ADR-009](PREPROD_SERVER_RUNTIME_DECISION_RU.md),
> [ADR-011](AUTH_SESSION_JWT_LIFECYCLE_DECISION_RU.md).

## Решение

У каждого HTTP-запроса есть trusted actor. При отсутствии access JWT middleware
создаёт и сохраняет в HttpOnly `guest_session` отдельный actor `guest:<uuid>`.
При JWT actor имеет вид `user:<id>`.

Для этого среза существует один общий VFS scope `system`. Он создаётся
миграцией, доступен и guest, и user, а все URI этого среза указывают его явно.
`auth.register` — единственный bootstrap hook: после создания identity он через
VFS создаёт один персональный scope и назначает его default scope пользователя.
Никакие profile, connections, HTML site или другие стартовые ресурсы при этом
не создаются.

Временный `SystemAndOwnerScopeAuthorizer` разрешает trusted guest/user ресурсы
scope `system`, а user — также его personal scope. Это не заменяет будущий ACL;
проверка предметных прав остаётся у владельца ресурса.

## Users Provider

Provider `users` владеет только таблицей `user_profiles`. Его connection
`users/account` создаётся миграцией в `system` scope. Provider не импортирует
Auth и не читает Auth-таблицы.

```text
users@account[system]:///actor.json
users@account[system]:///me/profile.json
users@account[system]:///users/{user-id}/profile.json
users@account[system]:///session
users@account[system]:///registration
users@account[system]:///credentials/self
```

Guest может прочитать только `actor.json`. User читает и меняет только свой
профиль. Остальные три ресурса служат только каноническими targets для Auth
hooks: provider не получает `*auth.Auth` и не реализует credential-команды.

## Auth hooks

| Hook | Resource | Actor |
| --- | --- | --- |
| `auth.register` | `users@account[system]:///registration` | guest; создаёт personal scope |
| `auth.login`, `auth.refresh`, `auth.logout` | `users@account[system]:///session` | согласно операции |
| `auth.change-password`, `auth.revoke-sessions` | `users@account[system]:///credentials/self` | user |

Они вызываются только через `POST /api/v2/vfs/hooks/{hook-key}/run`. Legacy
`/api/auth/*` в pre-prod router не регистрируется.

Refresh token не попадает в JSON. Тонкий HTTP bridge передаёт его из HttpOnly
cookie в приватном context только Auth hook и применяет обновление cookie до
записи HTTP-ответа. VFS Core и Users Provider о cookie не знают.

## Последствия

- frontend использует VFS URI с явным `[system]` scope;
- guest и user обращаются к одной и той же системной области;
- регистрация создаёт только personal default scope пользователя;
- нет guest workspace, connections, profile provisioning или переноса состояния;
- будущий ACL сможет заменить временную pre-ACL policy без изменения Users
  Provider или Auth hooks.
