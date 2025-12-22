/***********************************************************************
 *  access-token хранится только в памяти (без localStorage)
 **********************************************************************/
let accessToken = null;   

/***********************************************************************
 *  user объект в котором хранятся данные пользователя
 **********************************************************************/
const user = {
  id: 0,
  name: ""
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
            }
            // Отправляем fetch запрос.
            const res = await fetch(path, finalOptions);
            const text = await res.text();
            let data;
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
        await refreshAccess();       // обновляем accessToken
        ({ res, data } = await send()); // повторный запрос
    }
    // Если всё равно ошибка — кидаем
    if (!res || !res.ok) {
        throw { status: res ? res.status : 0, data };
    }
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
    const rr = await fetch("/api/users/refresh", {
        method: "POST",
        credentials: "include"
    });
    // Проверка ответа
    if (!rr.ok) throw "refresh failed";
    // Получение нового токена
    const j = await rr.json();
    accessToken = j.access_token;
    // Декодирование payload JWT
    const payload = JSON.parse(
            atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    // Обновление данных пользователя
    user.id = payload.user_id;
    user.name = (await getUserDataByID(user.id)).name;
}

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
 * loadBlock — это универсальная функция для динамического контента:
 *
 * - Находит контейнер по id.
 * - Очищает старый контент и связанные скрипты/стили.
 * - Запрашивает блок через apiProtected.
 * - Преобразует Markdown в HTML.
 * - Добавляет CSS и JS динамически.
 * - Вызывает pageInit() блока, если есть.
 * - Обрабатывает ошибки.
 **********************************************************************************/
async function loadBlock(path, block_Name) {
    // Получаем контейнер блока
    const container = document.getElementById(block_Name);
    if (!container) {
        return;
    }
    // Обработка пути
    path = path.replace(/\/$/, "");
    if (!container) {
        console.error(`loadBlock ERROR: element #${block_Name} not found`);
        return;
    }
    const blockName = path === "pages" ? "pages/home" : path;
    try {
        // Очистка контейнера и старых динамических стилей/скриптов
        container.innerHTML = '';
        document.querySelectorAll('style[data-dynamic], script[data-dynamic]').forEach(el => {
            const name = el.getAttribute('data-dynamic');
            if (name === block_Name || !document.getElementById(name)) {
                el.remove();
            }
        });
        // Получение блока с сервера
        const response = await apiProtected(`/api/HTML/${blockName}`, {method: "GET"});
        // Динамически подгружаем markdown-it, если он ещё не загружен
        if (!window.markdownit) {
            await loadMdScript('/js/markdown-it.min.js');
        }
        const { content: mdContent, css, js } = response;
       // Преобразуем markdown в HTML
        if (mdContent) {
            const md = window.markdownit({ html: true, linkify: true, typographer: true });
            container.innerHTML = md.render(mdContent);
            container?.id?.match(/^loadedBlock_\d+_view$/) && (document.getElementById(container.id.replace('_view', '_html')).innerHTML = mdContent);
        }
        // Добавление CSS блока
        if (css) {
            const style = document.createElement('style');
            style.dataset.dynamic = block_Name;
            style.textContent = css;
            document.head.appendChild(style);
        }
        // Добавление JS блока
        if (js) {
            const script = document.createElement('script');
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
            document.body.appendChild(script);
        }
    // Обработка ошибок
    } catch (err) {
        console.error(err);
        container.innerHTML = "<h2>блок не найден</h2>";
    }
}

/*****************************************************************************
 * SPA-навигация
 *****************************************************************************/
function navigateTo(url, target) {
    const clean = url.replace(/^\//, "");
    history.pushState({}, "", "/" + clean);
    loadBlock("pages/" + clean, target);
}

/*****************************************************************************
 * Поддержка кнопки "назад/вперед"
 *****************************************************************************/
window.addEventListener("popstate", () => {loadBlock(location.pathname);});

/*****************************************************************************
 * Обработка истории браузера
 *****************************************************************************/
window.addEventListener("popstate", () => loadBlock(window.location.pathname));

/*****************************************************************************
 * Инициализация после загрузки DOM
 *****************************************************************************/
window.onload = async function ()  {
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
document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("toggle-pass")) return;
console.log("toggle");
    const input = e.target.previousElementSibling;
    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        e.target.textContent = "*";//🔓
    } else {
        input.type = "password";
        e.target.textContent = "A";//🔒
    }
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
async function userLogin(username, password) {
    try {
        // Запрос логина
        const r = await apiProtected(`/api/users/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        });
        // Проверка access token
        if (!r?.access_token) {
            throw new Error("Token not received");
        }
        const payload = JSON.parse(
            atob(r.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
        // Успешный результат
        user.name = username;
        user.id = payload.user_id;
        return {
            accessToken: r.access_token
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
async function userLogout() {
    accessToken = "";
    await fetch("/api/users/logout", { method: "POST", credentials: "include" });
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
        const data = await apiProtected("/api/users/register", {
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

