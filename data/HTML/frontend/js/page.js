/***********************************************************************
 *  access-token хранится только в памяти (без localStorage)
 **********************************************************************/
let accessToken = null;   
let spritePath = '/_static/img/icons.svg';
let tokenWriting = null; // флаг блокировки refresh

const auth = {
    ready: false,   // знаем ли мы статус?
    loggedIn: false // авторизован?
};

class PageReady {
    static callbacks = [];
    static initialized = false;

    /**
     * Регистрация функции
     * @param {Function} fn
     */
    static add(fn) {
        if (typeof fn !== 'function') return;

        if (document.readyState === 'complete') {
            fn();
            return;
        }

        this.callbacks.push(fn);
        this.init();
    }

    static init() {
        if (this.initialized) return;
        this.initialized = true;

        window.addEventListener('load', () => {
            this.callbacks.forEach(fn => fn());
            this.callbacks = [];
        });
    }
}

// функция для эмита события состояния
function emitAuthEvent(isLoggedIn) {
    //console.log("event1:"+isLoggedIn)
  const event = new CustomEvent('authChange', {
    detail: { loggedIn: isLoggedIn }
  });
  document.dispatchEvent(event);
}


/***********************************************************************
 * TempStore — это временное хранилище данных в браузере на базе IndexedDB, с возможностями:
 *
 * - TTL (time-to-live) — данные автоматически считаются протухшими
 * - Привязка к получателю (recipient) — доступ только конкретному “пользователю”
 * - Destroy-on-read — данные удаляются после первого чтения. Управляется флагом destroyOnRead,
 *    который задаёт издатель при сохранении данных.
 * - Фоновая очистка протухших записей
 * - Автоматическая генерация ID
 ***********************************************************************/
class TempStore {
/***********************************************************************
 * Конструктор
 * Параметры:
 *
 * - dbName — имя IndexedDB базы
 * - storeName — имя object store (таблицы)
 * - cleanupIntervalMs — интервал автоочистки (по умолчанию 1 минута)
 ***********************************************************************/
    constructor({
        dbName = 'temp-store',
        storeName = 'records',
        cleanupIntervalMs = 60_000
    } = {}) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.cleanupIntervalMs = cleanupIntervalMs;

        this._dbPromise = null;
        this._cleanupTimer = null;
    }

  /* ---------- internal ---------- */
/***********************************************************************
 * Открытие IndexedDB
 * Что делает:
 * - Открывает IndexedDB один раз
 * - Кеширует Promise, чтобы не открывать базу повторно
 * - Создаёт objectStore при первом запуске
 ***********************************************************************/
    _openDB() {
    if (this._dbPromise) return this._dbPromise;

    this._dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, 1);

        req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
            // создаём индекс по recipient
            store.createIndex('recipient', 'recipient', { unique: false });
        }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    return this._dbPromise;
    }
/**************************************************************************
 * Безопасная обёртка транзакций
 * Назначение
 * Упрощает работу с IndexedDB:
 * - Открывает транзакцию
 * - Передаёт objectStore в callback
 * - Дожидается завершения транзакции
 * - Корректно обрабатывает ошибки
 **************************************************************************/
    async _withStore(mode, fn) {
        const db = await this._openDB();
        const tx = db.transaction(this.storeName, mode);
        const store = tx.objectStore(this.storeName);

        const result = await fn(store);

        await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
        });

        return result;
    }

  /* ---------- public API ---------- */
/***************************************************************************
 * Функция сохранения данных:
 * - recipient получатель данных
 * - ttlMs время жизни данных TTL
 * - destroyOnRead показывает, надо ли удалять данные после прочтения. 
 *    По умолчанию = false
 ***************************************************************************/
    async store(data, { recipient, ttlMs = 1000, destroyOnRead = false }) {
        // Что сохраняется
        const record = {
        id: crypto.randomUUID(),
        data,
        recipient,
        destroyOnRead,
        createdAt: Date.now(),
        // запись считается недействительной после этого времени
        expiresAt: Date.now() + ttlMs
        };
        // Совершение транзакции
        await this._withStore('readwrite', store => {
        store.put(record);
        });
        return record.id;
    }
   /* ---------- Функции получения данных ---------- */
/**************************************************************************
 * Получение по id 
 * - id номер записи данных
 * - requester получатель
 **************************************************************************/
    async getById(id, requester) {
    return this._withStore('readwrite', async store => {
        const record = await this._getRecord(store, id);
        if (!record) return null;

        // TTL
        if (Date.now() > record.expiresAt) {
        store.delete(id);
        return null;
        }

        // recipient
        if (record.recipient !== requester) {
        return null;
        }

        const data = record.data;

        // destroy on read
        if (record.destroyOnRead) {
        store.delete(id);
        }

        return data;
    });
    }
/************************************************************************
 * Получение всех записей по recipient
 ************************************************************************/
    async getByRecipient(recipient) {
    return this._withStore('readwrite', async store => {
        const records = await this._getRecordsByRecipient(store, recipient);

        const result = [];

        for (const record of records) {
        // TTL
        if (Date.now() > record.expiresAt) {
            store.delete(record.id);
            continue;
        }

        // destroy on read
        if (record.destroyOnRead) {
            store.delete(record.id);
        }

        result.push(record.data);
        }

        return result.length > 0 ? result : null;
    });
    }

/************************************************************************
 * Получение всех id записей по recipient
 * - recipient получатель
 * 
 * Возвращает:
 * - массив id
 * - null, если записей нет
 ************************************************************************/
    async getIdsByRecipient(recipient) {
        return this._withStore('readwrite', async store => {
            const records = await this._getRecordsByRecipient(store, recipient);

            const ids = [];

            for (const record of records) {
                // TTL
                if (Date.now() > record.expiresAt) {
                    store.delete(record.id);
                    continue;
                }

                ids.push(record.id);
            }

            return ids.length > 0 ? ids : null;
        });
    }


/************************************************************************
 * Функция ручного удаления очисткой
 * - Получает запись,
 * - Проверяет получателя,
 * - Удаляет запись.
 * 
 * Возвращает
 * - true — удалено
 * - false — нет доступа или записи нет
 ************************************************************************/
    async destroy(id, requester) {
        return this._withStore('readwrite', async store => {
        const record = await this._getRecord(store, id);
        if (!record || record.recipient !== requester) return false;

        store.delete(id);
        return true;
        });
    }
/***************************************************************************
 * Автоочистка
 * Запускает периодическую фоновую очистку протухших записей.
 ***************************************************************************/
    startCleanup() {
        if (this._cleanupTimer) return;

        this._cleanupTimer = setInterval(() => {
        this.cleanup();
        }, this.cleanupIntervalMs);
    }

/***************************************************************************
 * Функция останавливает фоновую автоочистку протухших записей (по TTL)
 ***************************************************************************/
    stopCleanup() {
        clearInterval(this._cleanupTimer);
        this._cleanupTimer = null;
    }

/***************************************************************************
 * Функция фоновой очистки хранилища.
 * Проходит по всем записям в objectStore и удаляет те, у которых истёк TTL
 ***************************************************************************/
    async cleanup() {
        return this._withStore('readwrite', store => {
        return new Promise(resolve => {
            const req = store.openCursor();
            req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return resolve();

            if (Date.now() > cursor.value.expiresAt) {
                cursor.delete();
            }
            cursor.continue();
            };
        });
        });
    }

    /* ---------- helpers ---------- */
/***************************************************************************
 * Функция асинхронно получает запись по id и возвращает либо объект, 
 * либо null, не усложняя вызывающий код обработкой ошибок.
 ***************************************************************************/
    _getRecord(store, id) {
        return new Promise(resolve => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
        });
    }

/***************************************************************************
 * Функция асинхронно получить ВСЕ записи из IndexedDB, у которых поле recipient 
 * равно заданному значению и возвращает либо объект, 
 * либо null, не усложняя вызывающий код обработкой ошибок.
 ***************************************************************************/
    _getRecordsByRecipient(store, recipient) {
        return new Promise(resolve => {
            const index = store.index('recipient');
            const req = index.getAll(recipient); // получаем все записи с этим recipient
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }
}
tempStore = new TempStore();
tempStore.startCleanup();

/***********************************************************************
 *  user объект в котором хранятся данные пользователя
 **********************************************************************/
const user = {
  id: 0,
  name: ""
}

async function waitTokenWrite() {
    if (!tokenWriting) return; // никто не пишет — идём
    await tokenWriting;         // ждём, пока запись завершится
}


/***********************************************************************
 *  apiProtected — это удобная функция для защищённых API-запросов, 
 * которая: 
 *  
 *  - Подставляет стандартные и пользовательские настройки запроса.
 *  - Добавляет Authorization с токеном.
 *  - Автоматически сериализует JSON-тело.
 *  - Парсит ответ.
 *  - Обрабатывает устаревший токен (401) и повторяет запрос.
 *  - Выбрасывает ошибки для внешнего try...catch.
 ***********************************************************************/
async function apiProtected(path, options = {}) {

    await waitTokenWrite();
    //console.log("send"+path+"\n");

    if (tokenWriting) {
        await tokenWriting;
    }

    // Базовые настройки
    const defaultOptions = {
        //method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include"
    };
    // Объединяем настройки
    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: { ...defaultOptions.headers, ...(options.headers || {}) }
    };
    // Если есть тело и это объект — сериализуем
    if (finalOptions.body && typeof finalOptions.body === "object") {
        finalOptions.body = JSON.stringify(finalOptions.body);
    }
    // Вспомогательная функция отправки запроса
    const send = async () => {
        try {
            // Добавляем Authorization, если токен есть
            if (accessToken) {
                finalOptions.headers.Authorization = `Bearer ${accessToken}`;
            //console.log("AUTH:", finalOptions.headers.Authorization);
            }
            // Отправляем fetch запрос.
            const res = await fetch(path, finalOptions);
            const text = await res.text();
            let data;
                //console.log(accessToken);

            // Пытаемся распарсить ответ как JSON, если не получается 
            // — возвращаем текст.
            try {
                data = JSON.parse(text);
            } catch {
                data = text;
            }
            return { res, data };
        } catch (err) {
            return { res: null, data: err.toString() };
        }
    };
    // Первый запрос
    let { res, data } = await send();
    // Если 401 — обновляем токен и повторяем
    if (res && res.status === 401) {
        if (!tokenWriting) {
            tokenWriting = refreshAccess().finally(() => {
                tokenWriting = null;
            });
        }
        await tokenWriting;
        ({ res, data } = await send());
    }
    // Если всё равно ошибка — кидаем
    if (!res || !res.ok) {
        return null; /* throw { status: res ? res.status : 0, data }; */
    }
    //console.log(accessToken);
    return data; // возвращаем распарсенный JSON или текст
}

/***************************************************************************
 * refreshAccess() Обнавление токенов:
 * 
 * - Отправляет POST на /api/users/refresh, используя refresh-токен в cookie.
 * - Проверяет успешность ответа.
 * - Сохраняет новый access-токен.
 * - Декодирует токен, чтобы получить user_id.
 * - Обновляет глобальные данные о пользователе (id и name).
 ****************************************************************************/
async function refreshAccess (){
    //Отправка запроса на обновление токена
    const rr = await fetch("/api/v2/vfs/hooks/auth.refresh/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: {} })
    });
    // Проверка ответа
    if (!rr.ok) {
        emitAuthEvent(false); // Пользователь вышел из системы ❌
        //console.log("---")
        return null; /* throw "refresh failed"; */
    }
    // Получение нового токена
    const j = await rr.json();
    emitAuthEvent(true);  // Пользователь вошёл в систему ✅
    //console.log("+++")
    accessToken = j.output?.access_token;
    if (!accessToken) return null;
    // Декодирование payload JWT
    const payload = JSON.parse(
            atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    // Обновление данных пользователя
    user.id = payload.sub;
    //user.name = (await getUserDataByID(user.id)).name;
    //lngEdit();

    return accessToken;
}

// async function refreshAccess() {
//     try {
//         const rr = await fetch("/api/users/refresh", {
//             method: "POST",
//             credentials: "include"
//         });

//         if (!rr.ok) throw "not authorized";

//         const j = await rr.json();
//         accessToken = j.access_token;

//         const payload = JSON.parse(
//             atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
//         );

//         user.id = payload.user_id;
//         user.name = (await getUserDataByID(user.id)).name;

//         auth.loggedIn = true;
//     } catch {
//         accessToken = null;
//         user.id = 0;
//         user.name = "";
//         auth.loggedIn = false;
//     } finally {
//         auth.ready = true;

//         document.dispatchEvent(new CustomEvent('auth:ready', {
//             detail: { loggedIn: auth.loggedIn }
//         }));
//     }
// }



/********************************************************************************
 * loadMenu функция загрузки блока меню страницы в формате Markdown            
 ********************************************************************************/
async function loadMenu() {
     await loadBlock("menu/top1", "header");
}

/********************************************************************************
 * loadPage функция загрузки блока страницы в формате Markdown                 
 ********************************************************************************/
 async function loadPage(path) {
     await loadBlock(path, "content");
 }

/*********************************************************************************
 * loadMdScript функция загрузки Markdown библиотеки                
 *********************************************************************************/
 function loadMdScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}



/**********************************************************************************
 * loadBlock — универсальная функция загрузки блоков (с поддержкой iframe)
 **********************************************************************************/
async function loadBlock(path, target, itemsHowText = false, mode = "") {
    // Убираем ведущие слэши, если есть
    path = String(path).replace(/^\/+/, '');

    // Поддержка передачи как элемента DOM, так и ID
    let container = typeof target === 'string' ? document.getElementById(target) : target;
    if (!container) return;

    // Определяем документ, которому принадлежит контейнер (основной или iframe)
    const doc = container.ownerDocument || document;
    const block_Name = container.id;

    path = path.replace(/\/$/, "");
    const blockName = path === "pages" ? "pages/home" : path;

    try {
        container.innerHTML = '';
        doc.querySelectorAll('style[data-dynamic], script[data-dynamic]').forEach(el => {
            const name = el.getAttribute('data-dynamic');
            if (name === block_Name || !doc.getElementById(name)) {
                el.remove();
            }
        });

        const bootstrap = JSON.parse(document.getElementById("html-page-bootstrap")?.textContent || "{}");
        const uri = blockName === `pages/${bootstrap.page_key}`
            ? bootstrap.bundle_root_uri
            : `local@publisher[abc3a4-site]:///${blockName}`;

        const results = await Promise.all(
            ["content.md", "style.css", "script.js"].map(file =>
                apiProtected(`/api/v2/vfs/read?uri=${encodeURIComponent(uri + "/" + file)}`, { method: "GET" })
            )
        );

        if (results.some(value => value === null)) {
            throw new Error(`Не удалось загрузить блок: ${blockName}`);
        }

        const response = {
            content: results[0],
            css: results[1],
            js: results[2]
        };

        if (!window.markdownit) {
            await loadMdScript('/_static/vendor/markdown-it.min.js');
        }
        const { content: mdContent, css, js } = response;
        
        // Вставка контента
        if (mdContent) {
            if (itemsHowText) {
                container.textContent = mdContent;
            } else {
                const md = window.markdownit({ html: true, linkify: true, typographer: true });
                container.innerHTML = md.render(mdContent);
                if (container.id?.match(/^loadedBlock_\d+_view$/)) {
                    const htmlDiv = doc.getElementById(container.id.replace('_view', '_html'));
                    if (htmlDiv) htmlDiv.innerHTML = mdContent;
                }
            }
        }

        // Вставка CSS в нужный документ
        if (css) {
            if (itemsHowText) {
                const cssDiv = doc.getElementById(block_Name.replace(/Html$/, 'Css'));
                if (cssDiv) cssDiv.textContent = css;
            } else {
                const style = doc.createElement('style');
                style.dataset.dynamic = block_Name;
                style.textContent = css;
                (doc.head || doc.body).appendChild(style);
            }
        }

        // Добавление JS блока через import()
        if (mode === 'importJs') {
            if (js) {
                const blob = new Blob([js], { type: 'text/javascript' });
                const moduleUrl = URL.createObjectURL(blob);
                try {
                    const mod = await import(moduleUrl);
                    return mod;
                } finally {
                    URL.revokeObjectURL(moduleUrl);
                }
            }
            return response;
        }
        
        // Добавление JS блока
        if (js) {
            if (itemsHowText) {
                const jsDiv = doc.getElementById(block_Name.replace(/Html$/, 'Js'));
                if (jsDiv) jsDiv.textContent = js;
            } else {
                const script = doc.createElement('script');
                script.dataset.dynamic = block_Name;
                script.textContent = `
                    (() => {
                        try {
                            ${js}
                            if (typeof pageInit === "function") pageInit();
                        } catch (e) {
                            console.error("Block script error:", e);
                        }
                    })();
                `;
                (doc.body || doc.head).appendChild(script);
            }
        }

        // Загрузка рекурсивных блоков внутри контейнера
        loadBlockAttribute(container);

    } catch (err) {
        console.error(err);
        container.innerHTML = "<h2>блок не найден</h2>";
    }
}

function loadBlockAttribute(scope = document) {
    // В случае передаваемого scope ищем и в нем самом, и среди его детей
    const doc = scope.ownerDocument || scope;
    const elements = scope.querySelectorAll ? scope.querySelectorAll('[data-block-src]') : [];

    elements.forEach((el, index) => {
        const path = el.getAttribute('data-block-src');
        if (!el.id) el.id = `block_${Date.now()}_${index}`;
        // Передаем элемент напрямую в loadBlock
        loadBlock(path, el);
    });
}


/*****************************************************************************
 * Глобальный вызов функций блоков
 * - Позволяет вызывать функции внутри динамических блоков
 * - Поддерживает передачу аргументов
 * - Возвращает результат выполнения функции блока
 *****************************************************************************/
window.callBlock = function(block, fn, ...args) {
    return window.__blocks?.[block]?.[fn]?.(...args);
};

/*****************************************************************************
 * SPA-навигация
 *****************************************************************************/
function navigateTo(url, target) {
    const clean = url.replace(/^\//, "");
    history.pushState({ target: target }, "", "/" + clean);
    loadBlock("pages/" + clean, target);
}

/*****************************************************************************
 * Поддержка кнопки "назад/вперед"
 *****************************************************************************/
window.addEventListener("popstate", (event) => {
    loadBlock("pages" + window.location.pathname, event.state.target);
});

/*****************************************************************************
 * Перехватчик ссылок
 *****************************************************************************/
window.addEventListener("click", (event) => {
    const a = event.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href");
    // игнорируем внешние ссылки и mailto:
    if (!href || href.startsWith("http") || href.startsWith("mailto:")) return;
    const target = a.dataset.target || "content"; // default = content
    event.preventDefault();
    navigateTo(href, target);
});


/*****************************************************************************
 * Переключение видимости пароля
 *****************************************************************************/
class PasswordToggle {
    //static spritePath = '/_static/img/icons.svg';

    static init(root = document) {
        root.querySelectorAll('input[type="password"]:not([data-pass-init])')
            .forEach(input => this._setup(input));
    }

    static _setup(input) {
        input.dataset.passInit = '1';

        const wrap = document.createElement('span');
        wrap.className = 'pass-wrap';

        input.after(wrap);
        wrap.appendChild(input);

        const toggle = document.createElement('span');
        toggle.className = 'pass-toggle';
        wrap.appendChild(toggle);

        this._render(toggle, false);

        toggle.addEventListener('click', () => {
            const hidden = input.type === 'password';
            input.type = hidden ? 'text' : 'password';
            this._render(toggle, hidden);
        });
    }

    static _render(toggle, hidden) {
        const iconId = hidden ? '18x7' : '18x8';

        toggle.innerHTML = `
            <svg class="svg-icon" width="20" height="20">
                <use href="${spritePath}#${iconId}"></use>
            </svg>
        `;//                <use href="${this.spritePath}#${iconId}"></use>

    }
}

const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
        m.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;

            if (node.matches?.('input[type="password"]')) {
                PasswordToggle.init(node.parentNode);
            } else {
                PasswordToggle.init(node);
            }
        });
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

/*****************************************************************************
 * Получение данных пользователя. Пример использования:
 * btn.onclick = async function () {
 *      const user = await getUserDataByID(3);
 *      alert(user.name);
 *  };
 *****************************************************************************/
async function getUserDataByID(id) {
    const data = await apiProtected(
        `/api/users/getUserData?userid=${encodeURIComponent(id)}&by=id`
    );
    return {
        id: data.ID,
        name: data.Username
    }
}

/******************************************************************************
 * Функция userLogin:
 *
 * - пытается залогиниться через API,
 * - возвращает accessToken при успехе,
 * - бросает понятные ошибки (INVALID_CREDENTIALS, LOGIN_FAILED) при неудаче.
 ******************************************************************************/
// async function userLogin(username, password) {
//     try {
//         const r = await apiProtected(`/api/users/login`, {
//             method: "POST",
//             body: { username, password }
//         });

//         if (!r?.access_token) {
//             throw new Error("Token not received");
//         }

//         // Парсим токен
//         const payload = JSON.parse(
//             atob(r.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
//         );

//         // Сохраняем токен и данные пользователя
//         accessToken = r.access_token;
//         user.id = payload.user_id;
//         user.name = username;

//         // ✅ Здесь нужно сигналить UI, что пользователь залогинен
//         AuthStore.setLoggedIn(true);

//         return { accessToken };

//     } catch (err) {
//         console.error("Login error:", err);
//         if (err?.status === 401) throw new Error("INVALID_CREDENTIALS");
//         throw new Error("LOGIN_FAILED");
//     }
// }

async function userLogin(username, password) {
    try {
        // Запрос логина
        const r = await apiProtected(`/api/v2/vfs/hooks/auth.login/run`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                input: { username, password }
            })
        });
        // Проверка access token
        if (!r?.output?.access_token) {
            throw new Error("Token not received");
        }
        const payload = JSON.parse(
            atob(r.output.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
        // Успешный результат
        accessToken = r.output.access_token;
        emitAuthEvent(true);  // Пользователь вошёл в систему ✅
        //console.log("+++");
        user.name = username;
        user.id = payload.sub; // sub вместо user_id в JWT payload
        return {
            accessToken: r.output.access_token
        };
    // Обработка ошибок (catch)    
    } catch (err) {
        // err — объект { status, data } из apiProtected
        if (err?.status === 401) {
            throw new Error("INVALID_CREDENTIALS");
        }
        // Неверный логин / пароль
        console.error("Login error:", err);
        throw new Error("LOGIN_FAILED");
    }
}

/******************************************************************************
 * userLogout — это функция выхода пользователя из системы.
 ******************************************************************************/

// async function userLogout() {
//     // Очищаем accessToken
//     accessToken = null;

//     // Очищаем данные пользователя
//     user.id = 0;
//     user.name = "";

//     // ✅ Здесь сигналим UI, что пользователь вышел
//     AuthStore.setLoggedIn(false);

//     // Отправляем запрос на сервер
//     await fetch("/api/users/logout", { method: "POST", credentials: "include" });
// }

async function userLogout() {
    emitAuthEvent(false); // Пользователь вышел из системы ❌

    const data = await fetch("/api/auth/session/refresh", { method: "POST", credentials: "include" });
    const response = await data.json();
    const accessToken = response.data;
    await fetch("/api/auth/session/logout", { method: "POST", body: JSON.stringify({ accessToken })});

    location.reload();
};

/******************************************************************************
 * userRegister функция которая:
 *
 * - регистрирует нового пользователя,
 * - возвращает ответ сервера при успехе,
 * - преобразует HTTP-ошибки в бизнес-ошибки, понятные UI.
 ******************************************************************************/
async function userRegister(username, password) {
    try {
        // Запрос регистрации
        const data = await apiProtected("/api/auth/register", {
            method: "POST",
            body: {
                username,
                password
            }
        });
        // Успешный результат
        return data;
    // Перехват ошибок
    } catch (err) {
        // Сюда прилетают ошибки, брошенные apiProtected:
        // Логирование
        console.error("Register error:", err);
        // Маппинг HTTP → бизнес-ошибки
        // Некорректные данные
        if (err?.status === 400) {
            throw new Error("BAD_REQUEST");
        }
        // Пользователь уже существует
        if (err?.status === 409) {
            throw new Error("USER_EXISTS");
        }
        // Любая другая ошибка
        throw new Error("REGISTER_FAILED");
    }
}

/***************************************************************************
 * Класса UIComponents это статический UI-helper, который:
 *
 * - не хранит состояние приложения
 * - не зависит от фреймворков
 * - создаёт всплывающие UI-элементы поверх страницы
 * 
 * Содержит методы:
 * 
 * - UIComponents.showAlert(...)
 * - UIComponents.confirm(...)
 * - UIComponents.showPopupList(...)
 * - UIComponents.showFileProperties(...)
 ***************************************************************************/
class UIComponents {
    /* ============== 1. АЛЕРТ С ОВЕРЛЕЕМ ============== */
    /*  Показывает модальное окно с кнопкой OK.  
        с затемняющим фоном, который перекрывает страницу*/
    static showAlert(message) {//, title = 'Сообщение'
        const overlay = document.createElement('div');
        overlay.className = 'ui-overlay';

        const alertBox = document.createElement('div');
        alertBox.className = 'window-popup';//ui-alert

        alertBox.innerHTML = 
            //<h3>${title}</h3>
            `<p>${message}</p>
            <button>OK</button>
        `;

        alertBox.querySelector('button').onclick = () => {
            overlay.remove();
        };

        overlay.appendChild(alertBox);
        document.body.appendChild(overlay);
    }

    /*==================== 2. confirm ===================== */
    /*                Аналог window.confirm                 */
    static confirm(message, title = 'Подтверждение') {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'ui-overlay';

            const box = document.createElement('div');
            box.className = 'ui-alert';

            box.innerHTML = `
                <h3>${title}</h3>
                <p>${message}</p>
                <div style="display:flex;justify-content:center;gap:12px;margin-top:16px">
                    <button data-yes>Да</button>
                    <button data-no>Нет</button>
                </div>
            `;

            const close = (result) => {
                overlay.remove();
                resolve(result);
            };

            box.querySelector('[data-yes]').onclick = () => close(true);
            box.querySelector('[data-no]').onclick = () => close(false);

            overlay.appendChild(box);
            document.body.appendChild(overlay);
        });
    }


    /* ========== 3. ПОПАП СПИСОК ========== */
    static showPopupList(items = {}, x = 0, y = 0) {
        // Удаляем предыдущий popup
        if (UIComponents.currentPopup) {
            UIComponents.currentPopup.remove();
            UIComponents.currentPopup = null;
        }

        const popup = document.createElement('div');
        popup.className = 'ui-popup-list';
        popup.style.left = x + 'px';
        popup.style.top = y + 'px';

        for (const [name, fn] of Object.entries(items)) {
            const el = document.createElement('div');
            el.textContent = name;
            el.onclick = () => {
                fn();                 // вызываем конкретную функцию
                popup.remove();
                UIComponents.currentPopup = null;
            };
            popup.appendChild(el);
        }

        document.body.appendChild(popup);
        UIComponents.currentPopup = popup;

        const removePopup = () => {
            if (UIComponents.currentPopup) {
                UIComponents.currentPopup.remove();
                UIComponents.currentPopup = null;
            }
            document.removeEventListener('click', removePopup);
        };
        setTimeout(() => document.addEventListener('click', removePopup), 0);
    }

    /* ========== 4. ОКНО "СВОЙСТВА ФАЙЛА" ========== */
    static showFileProperties(general = {}, details = {}) {
        const overlay = document.createElement('div');
        overlay.className = 'ui-overlay';

        const win = document.createElement('div');
        win.className = 'ui-window';
        win.style.position = 'absolute';

        const rows = obj =>
            Object.entries(obj)
                .map(([k, v]) => `<div class="row"><span>${k}</span><span>${v}</span></div>`)
                .join('');

        win.innerHTML = `
            <div class="header">
                <span>Свойства</span>
                <button>&times;</button>
            </div>

            <div class="tabs">
                <div class="tab active" data-tab="general">Общие</div>
                <div class="tab" data-tab="details">Подробно</div>
            </div>

            <div class="tab-content active" id="general">${rows(general)}</div>
            <div class="tab-content" id="details">${rows(details)}</div>
        `;

        win.querySelector('button').onclick = () => overlay.remove();

        /* tabs */
        win.querySelectorAll('.tab').forEach(tab => {
            tab.onclick = () => {
                win.querySelectorAll('.tab, .tab-content')
                    .forEach(e => e.classList.remove('active'));

                tab.classList.add('active');
                win.querySelector('#' + tab.dataset.tab).classList.add('active');
            };
        });

        /* drag */
        const header = win.querySelector('.header');
        header.onmousedown = (e) => {
            const r = win.getBoundingClientRect();
            const dx = e.clientX - r.left;
            const dy = e.clientY - r.top;

            document.onmousemove = e =>
                Object.assign(win.style, {
                    left: e.clientX - dx + 'px',
                    top: e.clientY - dy + 'px'
                });

            document.onmouseup = () => document.onmousemove = null;
        };

        overlay.appendChild(win);
        document.body.appendChild(overlay);

        win.style.left = 'calc(50% - 180px)';
        win.style.top = '20%';
    }
}

function setCookie(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) +
        '; expires=' + expires + '; path=/';
}

function getCookie(name) {
    return document.cookie
        .split('; ')
        .find(row => row.startsWith(name + '='))
        ?.split('=')[1];
}

document.addEventListener('DOMContentLoaded', () => {
    PasswordToggle.init();

});

// Подписка UI на изменения статуса авторизации
document.addEventListener("auth:changed", () => {
    // Эта функция будет вызываться при каждом изменении статуса (login/logout/refresh)
    lngEdit();
});/*****************************************************************************
 * Инициализация после загрузки DOM
 *****************************************************************************/
window.onload = async function ()  {
    PasswordToggle.init();
    let url = window.location.href;
   // Убираем слеш в конце, если он есть
    if (url.endsWith("/")) {
        url = url.slice(0, -1);
        // Меняем URL в адресной строке без перезагрузки страницы
        window.history.replaceState(null, "", url);
    }
    //console.assert("читаем меню")
    await loadMenu();
    await loadPage("pages"+window.location.pathname);
};
// проверка токена при загрузке
async function initAuth() {
    try {
        const token = await refreshAccess();
        if (!token) return null; /* throw "refresh failed"; */

        const j = { access_token: token };
        accessToken = j.access_token;
        emitAuthEvent(true); // событие выбрасывается
        //console.log("--- refresh ок ---");
    } catch (err) {
        emitAuthEvent(false); // событие выбрасывается
        //console.log("--- refresh failed ---");
    }
}

initAuth();
