# Целевая Auth session schema

## Текущее состояние

В существующих базах могут одновременно находиться три механизма:

| Таблица | Фактическое использование | Решение сейчас |
| --- | --- | --- |
| `whitelist` | Runtime хранит JTI refresh token pair и проверяет его при refresh/logout | Сохранить без изменения данных |
| `sessions` | Полная модель session с hash, expiry, revoke и metadata, но текущим runtime не используется | Целевая таблица следующей Auth-итерации |
| `refresh_tokens` | Старый plaintext token store; рабочий код закомментирован | Считать legacy, сохранить до проверенной миграции |

Migration group Auth создаёт отсутствующие таблицы и foreign keys, но не
копирует, не удаляет и не очищает существующие строки. Периодическая очистка
`refresh_tokens` удалена из database open: lifecycle Auth-данных не является
ответственностью инфраструктуры подключения.

## Целевая модель следующей итерации

Единственным durable session store должна стать `sessions`:

- `id` — случайный session identifier, отдельный от JWT JTI;
- `user_id` — FK на `users` с `ON DELETE CASCADE`;
- хранится только hash refresh credential, не plaintext token;
- `expires_at`, `revoked`, `last_used_at` управляют rotation/revoke;
- `user_agent` и `ip_address` являются audit metadata, а не факторами доступа;
- access JWT остаётся короткоживущим и ссылается на session id.

Переход должен сначала научить Auth читать старую `whitelist` и писать/читать
`sessions` с наблюдаемой dual-read фазой. Только после проверки количества и
сроков жизни записей можно отдельной versioned migration удалить `whitelist` и
`refresh_tokens`. Автоматически считать строки между этими таблицами
эквивалентными нельзя: `whitelist.jti` не содержит hash refresh token, expiry и
session metadata.
