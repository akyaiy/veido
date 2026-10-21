# ADR-011: Auth session и JWT lifecycle для pre-prod

> Статус решения: принято.  
> Статус реализации: реализовано.  
> Дата решения: 21 октября 2026 года.  
> Связанные документы: [ADR-009](PREPROD_SERVER_RUNTIME_DECISION_RU.md),
> [ADR-010](SQLITE_MIGRATIONS_DECISION_RU.md),
> [Auth session schema](../AUTH_SESSION_SCHEMA_PLAN_RU.md).

## Контекст

Прежний Auth подписывал JWT секретом из глобального `config.Data`, не различал
назначение access и refresh credentials и использовал `whitelist` как неполную
модель token pair. Refresh состоял из независимых delete/insert операций,
logout доверял токену из request body, а Basic Auth и JWT по-разному учитывали
состояние пользователя.

## Решение

Auth создаётся с явной неизменяемой конфигурацией: signing secret, issuer,
audience и оба TTL. Token methods не читают глобальную конфигурацию.

Оба JWT содержат `sub`, `sid`, `token_use`, `iss`, `aud`, `iat`, `nbf`, `exp` и
уникальный `jti`. `token_use` обязателен и проверяется отдельным entry point:
refresh credential не является Bearer access credential, access credential не
принимается rotation endpoint. Поддерживается только HS256.

`sid` является одновременно идентификатором серверной session и refresh token
family. В `sessions.refresh_token_hash` хранится SHA-256 подписанного refresh
credential; plaintext в БД не записывается. Энтропия credential обеспечивается
подписанным JWT с уникальным `jti`, поэтому password hash для этой проверки не
требуется.

Rotation выполняет атомарный compare-and-swap:

```text
(sid, user_id, hash(current), revoked=false, active user)
    -> hash(next), next expiry, last_used_at
```

Только один конкурентный запрос может заменить текущий hash. Валидный старый
refresh с тем же `sid`, не совпавший с текущим hash, считается reuse и отзывает
всю session family. В гонке это может также отозвать credential победившего
запроса; это намеренный fail-closed результат, не создающий две действующие
ветви.

Access verification после проверки подписи подтверждает состояние `sessions`
и активный статус пользователя. Поэтому logout, блокировка и смена пароля
немедленно отзывают уже выданные access credentials. Login и HTTP Basic
используют одну проверку имени, bcrypt password и `status=active`.

Logout получает `user_id` и `sid` только из principal, установленного Auth
middleware после проверки access JWT. Request body не выбирает отзываемую
session. Self password change отдельно проверяет старый пароль; admin reset не
проверяет его, но оба варианта атомарно отзывают все sessions пользователя.

## Переход legacy данных

`whitelist` и `refresh_tokens` сохраняются без удаления или преобразования.
Надёжно восстановить из `whitelist.jti` session expiry и hash исходного refresh
невозможно, поэтому небезопасная dual-read совместимость не вводится. После
обновления прежние refresh pairs требуют повторного login. Удаление legacy
таблиц допускается только отдельной последующей versioned migration после
проверки данных.

## Границы

Auth зависит только от своей schema и нейтральной SQL-инфраструктуры. Он не
импортирует provider modules, не читает VFS/provider stores и не выдаёт ACL
решений. HTTP middleware преобразует проверенную session в trusted principal;
дальнейшее преобразование user ID в VFS actor остаётся обязанностью composition
layer.

## Ограничения

- Session audit metadata (`user_agent`, `ip_address`) пока не заполняется.
- Нет UI/API для просмотра и выборочного отзыва других sessions пользователя.
- Legacy users не нормализуются массовой миграцией; новые и изменяемые имена
  приводятся к lowercase, а неоднозначные старые регистрозависимые дубликаты
  требуют отдельной проверки данных.
- Cookie policy и CSRF-защита относятся к окончательному pre-prod HTTP adapter и
  не определяются доменным Auth lifecycle.
