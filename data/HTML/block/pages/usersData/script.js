// Главный контейнеры
const menuContainer = document.getElementById("menuContainer");
const regDiv = document.getElementById("regDiv");
const messageBlockContainer = document.getElementById("messageBlockContainer");

// Элементы панели
const panel = document.getElementById("regPanel");
const regPanelContent = document.getElementById("regPanelContent");
const overlay = document.getElementById("overlay");
const menuToggle = document.getElementById("menuToggle");

// Сообщение об авторизации
const authMessage = document.getElementById('authMessage');
const authMessageLogin = document.getElementById('authMessageLogin');

// Точка переключения для мобильного меню
const mobileBreakpoint = 768;

// Статус пользователя
let checkUserStatus = false;

// Статусы пользователей
window.userStatuses = ["active", "non-active", "no data"];



// === Создание меню ===

// Данные древа страниц
let treeConfig = [
    { name: "profile", title: "Мой профиль", isAdmin: false, target: "regDiv", default: true },
    { name: "data", title: "Мои ресурсы", isAdmin: true, target: "regDiv" },
    {
        name: "users",
        title: "Пользователи",
        isAdmin: true,
        target: "regDiv",
        children: [
            { name: "create", title: "Создание", isAdmin: true, target: "regDiv" },
            { name: "users", title: "Редактирование", isAdmin: true, target: "regDiv" }
        ]
    }
];
const defaulTargetId = "regDiv";

// Сборка меню из конфигурации treeConfig
function buildMenu() {

    // кнопка открытия/закрытия меню
    menuToggle.onclick = toggleMenu;

    treeConfig.forEach(item => {

        // проверка доступа для админских пунктов
        if (item.isAdmin && !window.isAdmin) return;

        // обычный пункт меню
        if (item.name && !item.children) {

            const wrapper = document.createElement("div");
            wrapper.className = "menu-item";

            const a = document.createElement("a");

            a.href = `/usersData/?sPage=${item.name}`;
            a.dataset.link = "true";
            a.dataset.target = item.target;
            a.textContent = item.title;

            wrapper.appendChild(a);
            regPanelContent.appendChild(wrapper);
            return;
        }

        // группа меню
        const groupWrapper = document.createElement("div");
        groupWrapper.className = "menu-item";

        const title = document.createElement("div");
        title.className = "tree-title";
        title.textContent = item.title;

        groupWrapper.appendChild(title);

        // рекурсивная отрисовка вложенных элементов
        function render(children, parentPath = "", depth = 0) {

            children.forEach(child => {

                // проверка доступа на уровне элемента
                if (child.isAdmin && !window.isAdmin) return;

                // формирование полного пути (учёт вложенности)
                const fullPath = parentPath
                    ? `${parentPath}/${child.name}`
                    : child.name;

                const row = document.createElement("div");
                row.className = "menu-row menu-item";

                // визуальный отступ для вложенности
                row.style.paddingLeft = `${depth * 12}px`;

                // добавляем "тире" для обозначения вложенности
                const dash = document.createElement("span");
                dash.textContent = "-";
                dash.style.marginRight = "4px";

                // ссылка на элемент
                const a = document.createElement("a");
                a.href = `/usersData/?sPage=${fullPath}`;
                a.dataset.link = "true";
                a.dataset.target = child.target;
                a.textContent = child.title;

                row.appendChild(dash);
                row.appendChild(a);

                groupWrapper.appendChild(row);

                // обработка вложенных уровней
                if (child.children) {
                    render(child.children, fullPath, depth + 1);
                }
            });
        }

        render(item.children, item.name, 1);

        regPanelContent.appendChild(groupWrapper);
    });
}

// Открытие/закрытие меню
function toggleMenu() {
    const isActive = menuContainer.classList.toggle("active");
    
    // Меняем стрелку и отображение
    menuToggle.textContent = isActive ? "x" : ">";
    overlay.style.display = isActive ? "block" : "none";
}

// Закрытие меню при клике на оверлей
function closeMenu() {
    menuContainer.classList.remove("active");
    overlay.style.display = "none";
    menuToggle.textContent = ">";
}

// Обработка клика по ссылкам внутри панели
function handlePanelClick(e) {
    // Если пользователь не авторизован, перенаправляем на страницу входа
    if (checkUserStatus === false) {
        loadBlock("pages/login", "content");
        return;
    }

    // ищем ссылку с data-link
    const link = e.target.closest("a[data-link='true']");
    if (!link || (!panel.contains(link) && !regDiv.contains(link))) return;

    // отменяем стандартный переход
    e.preventDefault();
    e.stopPropagation();

    // парсим URL
    const { url, action, data } = urlStrBr(link.href);
    const targetId = link.dataset.target;

    // работаем только с sPage
    if (action !== "sPage") return;

    // обновляем URL без перезагрузки
    history.pushState(null, "", `/${url}/?${action}=${data}`);

    // загружаем блок
    loadBlock(`pages/${url}/${data}`, targetId);

    // закрытие на мобильных
    if (window.innerWidth <= mobileBreakpoint && menuContainer.classList.contains("active")) {
        const a = e.target.closest("a");
        if (a && panel.contains(a)) {
            closeMenu();
        }
    }
}



// === Обработка URL ===

// Проверка доступности страницы по treeConfig
function hasPageAccess(pagePath, items = treeConfig, parentPath = "") {
    return items.some(item => {
        // проверка прав доступа для админских страниц
        if (item.isAdmin && !window.isAdmin) return false;

        // формируем полный путь для текущего элемента
        const fullPath = parentPath
            ? `${parentPath}/${item.name}`
            : item.name;

        // точное совпадение пути
        if (fullPath === pagePath) return true;

        // если есть дети, проверяем их рекурсивно
        if (item.children) {
            return hasPageAccess(pagePath, item.children, fullPath);
        }

        return false;
    });
}

// Обработка текущего URL при загрузке страницы или навигации
function handleCurrentUrl() {
    const { url, action, data } = urlStrBr(window.location.href);
    const defaultPage = treeConfig.find(item => item.default)?.name;

    // Если страница недоступна - загружаем дефолтную
    if (action !== "sPage" || !data || !hasPageAccess(data)) {
        history.replaceState(null, "", `/${url}/?sPage=${defaultPage}`);
        loadBlock(`pages/${url}/${defaultPage}`, defaulTargetId);
        return;
    }

    // Если есть параметр sPage, загружаем соответствующий блок
    loadBlock(`pages/${url}/${data}`, defaulTargetId);
}

// Парсинг URL в структуру { url, action, data }
function urlStrBr(url){
    // Создаём объект URL
    const parsedUrl = new URL(url);

    // Получаем путь без начального и конечного "/"
    const firstPart = parsedUrl.pathname.replace(/^\/|\/$/g, "");

    // Получаем список параметров запроса
    const keys = Array.from(parsedUrl.searchParams.keys());
    // Берём последний параметр
    const secondPart = keys.pop();

    // Получаем значение последнего параметра
    const thirdPart = secondPart ? parsedUrl.searchParams.get(secondPart) : null;

    // Возвращаем структуру
    return {
        url: firstPart,
        action: secondPart,
        data: thirdPart
    };
}



// === Проверка пользователя ===

// Проверка пользователя и его ролей
async function checkUser() {
    try {
        // Проверяем авторизацию пользователя
        const me = await apiProtected('/api/auth/me', { method: 'GET' });

        // Если пользователь не авторизован
        if (!me || !me.data) {
            window.isAdmin = false;
            authMessage.style.display = 'block';
            return false;
        }

        // Запрашиваем список ролей текущего пользователя
        const res = await apiProtected('/api/acl-admin/me/roles?limit=100', { method: 'GET' });
        const roles = res || [];

        // Проверяем наличие админской роли
        const hasAdmin = roles.some(r => r.name && r.name.toLowerCase().includes('admin'));
        window.isAdmin = hasAdmin;

        // Если прав нет, удаляем ссылки на админские страницы
        if (!hasAdmin) {
            panel.querySelectorAll('[is-admin="true"]').forEach(el => el.remove());
        }

        return true;
    } catch (e) {
        window.isAdmin = false;
        console.error(e);
        return false;
    }
}



// === Сообщения ===

function initMessageBlock() {
    if (!messageBlockContainer) {
        return;
    }

    loadBlock("pages/usersData/elements/message", "messageBlockContainer");
}

// === Сообщение об авторизации ===

// Переадресация на страницу входа
function loginRedirect(event) {
    event.preventDefault();
    loadBlock("pages/login", "content");
}



// Инициализация при загрузке страницы
async function init() {
    initMessageBlock();
    checkUserStatus = await checkUser();
    await buildMenu();
    if (checkUserStatus) {
        await handleCurrentUrl();
    }
}
init();

// Обработка кнопок "назад/вперёд" в браузере
window.addEventListener("popstate", handleCurrentUrl);

// Отоброжение меню
menuToggle.onclick = toggleMenu;
overlay.onclick = closeMenu;

// Клик по ссылкам внутри панели и блока
menuContainer.onclick = handlePanelClick;
regDiv.addEventListener("click", handlePanelClick);

// Сообщение об авторизации
authMessageLogin.addEventListener("click", loginRedirect);