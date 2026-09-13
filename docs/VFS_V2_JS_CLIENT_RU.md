# JavaScript-клиент VFSv2

Dependency-free библиотека для работы с VFSv2 HTTP API из браузера.

Файл библиотеки:

```text
data/HTML/frontend/js/vfsv2.js
```

## Подключение

Библиотека не подключается к приложению автоматически. Добавьте её на нужную страницу:

```html
<script src="/js/vfsv2.js"></script>
```

После загрузки доступен глобальный объект `VFSv2`.

## Авторизация

JWT:

```js
VFSv2.configure({
    headers: () => ({
        Authorization: `Bearer ${accessToken}`
    })
});
```

Basic Auth:

```js
VFSv2.configure({
    headers: {
        Authorization: `Basic ${btoa("admin:admin")}`
    }
});
```

Callback `headers` вызывается перед каждым запросом, поэтому подходит для обновляемого access token.

## Основные операции

```js
const uri = "local@default[alice]:///docs/hello.txt";

// Создать новый файл. Ошибка, если файл уже существует.
await VFSv2.create(uri, "Первое содержимое");

// Полностью заменить содержимое существующего файла.
await VFSv2.write(uri, "Новое содержимое");

const text = await VFSv2.read(uri);
const stat = await VFSv2.stat(uri);
const entries = await VFSv2.readdir("local@default[alice]:///docs");

await VFSv2.mkdir("local@default[alice]:///images");
await VFSv2.move(uri, "local@default[alice]:///docs/new-name.txt");
await VFSv2.remove("local@default[alice]:///docs/new-name.txt");
```

## JSON и бинарные данные

```js
await VFSv2.writeJSON(uri, { enabled: true });
const data = await VFSv2.readJSON(uri);

const bytes = await VFSv2.readBytes(uri); // Uint8Array
const blob = await VFSv2.readBlob(uri);   // Blob
```

`create` и `write` также принимают строки, plain object, `Uint8Array`, `Blob` и `File`.

## Control

```js
const result = await VFSv2.control(
    uri,
    "export",
    { format: "pdf" },
    { responseType: "bytes" }
);
```

Доступные `responseType`: `bytes`, `text`, `json`, `blob`, `response`.

## Отдельный клиент

Если нужны собственный адрес или настройки:

```js
const client = VFSv2.client({
    baseURL: "/api/v2/vfs",
    credentials: "include"
});

const text = await client.read(uri);
```

## Обработка ошибок

```js
try {
    await VFSv2.read(uri);
} catch (error) {
    if (error instanceof VFSv2.Error) {
        console.log(error.status);    // HTTP status
        console.log(error.code);      // not_found, permission_denied и т. д.
        console.log(error.operation); // операция VFS
        console.log(error.requestId); // ID запроса для поиска в логах
    }
}
```

Проверка существования скрывает только ошибку `not_found`:

```js
if (await VFSv2.exists(uri)) {
    console.log("Файл существует");
}
```

