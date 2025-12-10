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
//let accessToken = ""; // access только в памяти

async function apiProtected(path, options = {}) {
    const send = async () =>
        fetch(path, {
            ...options,
            headers: {
                ...(options.headers || {}),
                Authorization: "Bearer " + accessToken,
                "Content-Type": "application/json"
            }
        });

    let r = await send();

    if ((r.status === 401)) {
        // обновляем access
        const rr = await fetch("/api/users/refresh", {
            method: "POST",
            credentials: "include"
        });

        if (!rr.ok) throw "refresh failed";

        const j = await rr.json();
        accessToken = j.access_token;

        r = await send();
    }

    if (!r.ok) throw await r.text();
    return r.json();
}


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
if (!container) {
    //console.warn(`loadBlock: контейнер #${block_Name} не найден — игнорируем`);
    return;
}
    path = path.replace(/\/$/, "");
    //console.log(path);
    if (!container) {
        console.error(`loadBlock ERROR: element #${block_Name} not found`);
        return;
    }
    const blockName = path === "pages" ? "pages/home" : path;
    //console.log(blockName);
    try {
        container.innerHTML = '';
        document.querySelectorAll('style[data-dynamic], script[data-dynamic]').forEach(el => {
            const name = el.getAttribute('data-dynamic');
            if (name === block_Name || !document.getElementById(name)) {
                el.remove();
            }
        });
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
            style.dataset.dynamic = block_Name;
            style.textContent = css;
            document.head.appendChild(style);
        }
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
    } catch (err) {
        console.error(err);
        container.innerHTML = "<h2>блок не найден</h2>";
    }
}

// SPA-навигация
function navigateTo(url, target) {
    const clean = url.replace(/^\//, "");
    history.pushState({}, "", "/" + clean);
    loadBlock("pages/" + clean, target);
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
    const target = a.dataset.target || "content"; // default = content
    event.preventDefault();
    navigateTo(href, target);
});

//popup
  function popup(message, afterClose){
    // Создаём overlay
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    // Создаём popup
    const popup = document.createElement('div');
    popup.className = 'popup';
    // Добавляем текст
    const text = document.createElement('div');
    text.textContent = message;
    // Добавляем кнопку закрытия
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Закрыть';
    closeBtn.addEventListener('click', () => {
      overlay.remove();
          if (typeof afterClose === 'function') {
      afterClose();   // ← ВАША ФУНКЦИЯ ПОСЛЕ ЗАКРЫТИЯ
    }
    });
  }
//popupMenu
  function popupMenu(message, afterClose){
    // Создаём popupMenu
    const popupMenu = document.createElement('div');
    popup.className = 'popup_Menu';
    // Добавляем текст
    const text = document.createElement('div');
    text.textContent = message;
    // Добавляем кнопку закрытия
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Закрыть';
    closeBtn.addEventListener('click', () => {
      overlay.remove();
          if (typeof afterClose === 'function') {
      afterClose();   // ← ВАША ФУНКЦИЯ ПОСЛЕ ЗАКРЫТИЯ
    }
    });

    popup.appendChild(text);
    popup.appendChild(closeBtn);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
  };

  /* ------------------- Переключение видимости пароля ------------------- */

document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("toggle-pass")) return;
//console.log("toggle");
    const input = e.target.previousElementSibling;
    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        e.target.textContent = "🙈";
    } else {
        input.type = "password";
        e.target.textContent = "👁";
    }
});
