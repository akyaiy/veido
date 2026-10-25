# Public API для frontend

Guest-клиент использует только typed API. Не передавайте и не храните VFS URI,
`scope`, `provider`, `bundle_root_uri` или VFS command.

## Auth

Все запросы — JSON и отправляются с `credentials: "include"`.

| Endpoint | Body | Успешный ответ |
| --- | --- | --- |
| `POST /api/v2/auth/register` | `{"username":"…","password":"…"}` | `{"user_id":1,"username":"…","access_token":"…","user_status":"…","scope_key":"…"}` |
| `POST /api/v2/auth/login` | `{"username":"…","password":"…"}` | такой же объект, кроме необязательного `scope_key` |
| `POST /api/v2/auth/refresh` | `{}` | `{"access_token":"…"}` |
| `POST /api/v2/auth/logout` | `{}` | `{"ok":true}` |
| `POST /api/v2/auth/change-password` | `{"old_password":"…","new_password":"…"}` | `{"ok":true}` |
| `POST /api/v2/auth/revoke-sessions` | `{}` | `{"ok":true}` |

`access_token` держите только в памяти и передавайте как
`Authorization: Bearer <token>`. Refresh credential устанавливается сервером в
HttpOnly cookie: JavaScript его не читает. Если refresh возвращает ошибку,
считайте сессию завершённой.

`logout`, `change-password` и `revoke-sessions` требуют access JWT. Поле
`scope_key`, если оно пришло после регистрации, не является frontend-контрактом
для доступа к ресурсам и использовать его не нужно.

## Site API

```text
GET /api/v2/site/tree
GET /api/v2/site/pages/{page-key}
GET /api/v2/site/blocks/{block-key}
```

`tree` возвращает доступное текущему actor-у дерево:

```json
{
  "tree_revision": 12,
  "pages": [{
    "page_key": "home",
    "slug": "home",
    "title": "Главная",
    "children": []
  }]
}
```

Стройте route → `page_key` только по этому дереву. Затем загрузите страницу:

```js
const tree = await fetch("/api/v2/site/tree", { credentials: "include" }).then(r => r.json());
const page = await fetch(`/api/v2/site/pages/${encodeURIComponent(pageKey)}`, {
  credentials: "include"
}).then(r => r.json());

const markdown = page.files["content.md"];
const css = page.files["style.css"] || "";
const js = page.files["script.js"] || "";
```

Ответ page/block имеет одинаковую форму:

```json
{
  "key": "home",
  "files": {
    "content.md": "# Заголовок",
    "style.css": ".page {}",
    "script.js": ""
  }
}
```

Для content-block `style.css` и `script.js` могут отсутствовать. Невидимая,
несуществующая или недоступная страница/блок всегда возвращает `404`.

## Что не использовать

- Не вызывайте `/api/v2/vfs/*` из guest UI: сервер вернёт `404`.
- Не запрашивайте `tree.json`, `info.json`, `meta.json` или physical bundle
  files через generic VFS.
- Не используйте ключ страницы или блока как URI: это только ключ для typed
  Site API.
