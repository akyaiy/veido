# Целевая Auth session schema

## Реализованное состояние

В существующих базах могут одновременно находиться три механизма:

| Таблица | Фактическое использование | Решение сейчас |
| --- | --- | --- |
| `whitelist` | Legacy JTI store; runtime больше его не читает и не пишет | Сохранить без изменения данных до отдельной migration |
| `sessions` | Единственный runtime store: hash refresh, expiry, rotation и revoke | Использовать для новых login/session |
| `refresh_tokens` | Старый plaintext token store; рабочий код закомментирован | Считать legacy, сохранить до проверенной миграции |

Migration group Auth создаёт отсутствующие таблицы и foreign keys, но не
копирует, не удаляет и не очищает существующие строки. Периодическая очистка
`refresh_tokens` удалена из database open: lifecycle Auth-данных не является
ответственностью инфраструктуры подключения.

## Действующая модель

Единственным durable session store должна стать `sessions`:

- `id` — случайный session identifier, отдельный от JWT JTI;
- `user_id` — FK на `users` с `ON DELETE CASCADE`;
- хранится только hash refresh credential, не plaintext token;
- `expires_at`, `revoked`, `last_used_at` управляют rotation/revoke;
- `user_agent` и `ip_address` являются audit metadata, а не факторами доступа;
- access JWT остаётся короткоживущим и ссылается на session id.

Auth пишет и читает только `sessions`. Dual-read отклонён: `whitelist.jti` не
содержит hash refresh token, expiry и session metadata, поэтому безопасно
восстановить session из него нельзя. Существующие legacy refresh pairs после
обновления требуют повторного login. Только после проверки количества и сроков
жизни legacy строк можно отдельной versioned migration удалить `whitelist` и
`refresh_tokens`.

Rotation заменяет hash условным `UPDATE` по текущему `(sid, user_id, hash)`.
Несовпадение hash валидного подписанного refresh считается reuse и отзывает всю
session. Подробнее: [ADR-011](adr/AUTH_SESSION_JWT_LIFECYCLE_DECISION_RU.md).
