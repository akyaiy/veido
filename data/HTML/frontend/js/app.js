/***********************************************************************
 *  ГЛОБАЛЬНОЕ СОСТОЯНИЕ
 **********************************************************************/
let accessToken = null;   // access-token хранится только в памяти (без localStorage)
/***********************************************************************
 *  sendRequest УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ ОТПРАВКИ HTTP-ЗАПРОСОВ
 *
 *  sendRequest(url, options)
 *  - автоматически добавляет Content-Type и credentials
 *  - автоматически превращает body в JSON
 *  - проверяет response.ok
 *  - пробрасывает текст ошибки
 *  - возвращает JSON-ответ
 **********************************************************************/
async function sendRequest(url, options = {}) {
    // Базовые параметры
    const defaultOptions = {
        headers: { "Content-Type": "application/json" },
        credentials: "include"
    };

    // Объединяем настройки
    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: { ...defaultOptions.headers, ...(options.headers || {}) }
    };

    // Если тело — объект, превращаем в JSON
    if (finalOptions.body && typeof finalOptions.body === "object") {
        finalOptions.body = JSON.stringify(finalOptions.body);
    }

    let response;
    try {
        response = await fetch(url, finalOptions);
    } catch (err) {
        // Сетевые ошибки (сервер не доступен, нет интернета, CORS и т.д.)
        return {
            ok: false,
            status: 0,
            data: err.toString()
        };
    }

    // Читаем тело ответа только один раз
    let text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    return {
        ok: response.ok,
        status: response.status,
        data
    };
}



/********************************************************************
 * loadMenu функция загрузки блока меню страницы в формате Markdown *
 ********************************************************************/
async function loadMenu() {
     await loadBlock("menu/top1", "header");
}
/********************************************************************
 * loadPage функция загрузки блока страницы в формате Markdown      *
 ********************************************************************/
 async function loadPage(path) {
     await loadBlock(path, "content");
 }

/********************************************************************
 * loadMdScript функция загрузки Markdown библиотеки                *
 ********************************************************************/
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

/********************************************************************
 * loadBlock функция загрузки блока в формате Markdown              *
 ********************************************************************/
async function loadBlock(path, block_Name) {
    const container = document.getElementById(block_Name);
    path = path.replace(/\/$/, "");
    //console.log(path);
    if (!container) {
        console.error(`loadBlock ERROR: element #${block_Name} not found`);
        return;
    }
    const blockName = path === "pages" ? "pages/home" : path;
    console.log(blockName);
    try {
        container.innerHTML = '';
        document.querySelectorAll('style[data-dynamic], script[data-dynamic]').forEach(el => el.remove());
        const response = await sendRequest(`/api/HTML/${blockName}`);
        if (!response.ok) {
            throw new Error(`Failed to load block: ${response.status}`);
        }

        // Динамически подгружаем markdown-it, если он ещё не загружен
        if (!window.markdownit) {
            await loadMdScript('/js/markdown-it.min.js');
        }

        const { content: mdContent, css, js } = response.data;
       // Преобразуем markdown в HTML
        if (mdContent) {
            const md = window.markdownit({ html: true, linkify: true, typographer: true });
            container.innerHTML = md.render(mdContent);
        }
        if (css) {
            const style = document.createElement('style');
            style.dataset.dynamic = "true";
            style.textContent = css;
            document.head.appendChild(style);
        }
        if (js) {
            const script = document.createElement('script');
            script.dataset.dynamic = "true";
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
    } catch (err) {
        console.error(err);
        container.innerHTML = "<h2>блок не найден</h2>";
    }
}

// SPA-навигация
function navigateTo(url) {
    const clean = url.replace(/^\//, "");
    history.pushState({}, "", "/" + clean);
    loadBlock("pages/" + clean, "content");
}

// Поддержка кнопки "назад/вперед"
window.addEventListener("popstate", () => {loadBlock(location.pathname);});
// Обработка истории браузера
window.addEventListener("popstate", () => loadBlock(window.location.pathname));
// Инициализация после загрузки DOM
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
// Перехватчик ссылок
window.addEventListener("click", (event) => {
    const a = event.target.closest("a");
    if (!a) return;

    const href = a.getAttribute("href");

    // игнорируем внешние ссылки и mailto:
    if (!href || href.startsWith("http") || href.startsWith("mailto:")) return;

    event.preventDefault();
    navigateTo(href);
});

