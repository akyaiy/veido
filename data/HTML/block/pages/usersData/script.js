const menuContainer = document.getElementById("menuContainer");
const panel = document.getElementById("regPanel");
const overlay = document.getElementById("overlay");
const menuToggle = document.getElementById("menuToggle");



// Массив для конфигурации меню
let menuConfig = [
    { path: "profile", title: "Профиль" },
    { path: "data", title: "Ресурсы", isAdmin: true },
    {
        path: "users",
        title: "Пользователи",
        isAdmin: true,
        children: [
            { path: "create", title: "Создание", isAdmin: true },
            { path: "users", title: "Редактирование", isAdmin: true }
        ]
    }
];

// Сборка меню из конфигурации menuConfig
function buildMenu() {

    // кнопка открытия/закрытия меню
    menuToggle.onclick = toggleMenu;

    // очистка контейнера перед пересборкой
    panel.innerHTML = "";
    panel.appendChild(menuToggle);

    menuConfig.forEach(item => {

        // проверка доступа для админских пунктов
        if (item.isAdmin && !window.isAdmin) return;

        // обычный пункт меню
        if (item.path && !item.children) {

            const wrapper = document.createElement("div");
            wrapper.className = "menu-item";

            const a = document.createElement("a");

            a.href = `/usersData/?sPage=${item.path}`;
            a.dataset.link = "true";
            a.dataset.target = "regDiv";
            a.textContent = item.title;

            wrapper.appendChild(a);
            panel.appendChild(wrapper);
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
                    ? `${parentPath}/${child.path}`
                    : child.path;

                const row = document.createElement("div");
                row.className = "menu-row menu-item";

                // визуальный отступ для вложенности
                row.style.paddingLeft = `${depth * 12}px`;

                const a = document.createElement("a");
                a.href = `/usersData/?sPage=${fullPath}`;
                a.dataset.link = "true";
                a.dataset.target = "regDiv";
                a.textContent = child.title;

                row.appendChild(document.createTextNode("- "));
                row.appendChild(a);

                groupWrapper.appendChild(row);

                // обработка вложенных уровней
                if (child.children) {
                    render(child.children, fullPath, depth + 1);
                }
            });
        }

        render(item.children || [], item.path || "", 1);

        panel.appendChild(groupWrapper);
    });
}


// Открытие/закрытие меню
function toggleMenu() {
    const isActive = menuContainer.classList.toggle("active");
    
    // Меняем стрелку
    menuToggle.textContent = isActive ? "<" : ">";
    
    if (isActive) {
        overlay.style.display = "block";
    } else {
        overlay.style.display = "none";
    }
}

// Закрытие меню при клике на оверлей
function closeMenu() {
    menuContainer.classList.remove("active");
    overlay.style.display = "none";
    menuToggle.textContent = ">";
}

// Обработка клика по ссылкам внутри панели
function handlePanelClick(e) {
    // ищем ссылку с data-link
    const link = e.target.closest("a[data-link='true']");
    if (!link || (!panel.contains(link) && !document.getElementById("regDiv")?.contains(link))) return;

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
    if (window.innerWidth <= 768 && menuContainer.classList.contains("active")) {
        const a = e.target.closest("a");
        if (a && panel.contains(a)) {
            closeMenu();
        }
    }
}


// Обработка текущего URL при загрузке страницы или навигации
function handleCurrentUrl() {
    const { url, action, data } = urlStrBr(window.location.href);

    // Если есть параметр sPage, загружаем соответствующий блок
    if (action === "sPage") {
        const targetId =
            data?.startsWith("users/") && document.getElementById("usersPageBlock")
                ? "usersPageBlock"
                : "regDiv";
        loadBlock(`pages/${url}/${data}`, targetId);
    }
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


// Проверка прав пользователя (админ или нет)
async function checkAdminAccess() {
    try {
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
    } catch (e) {
        window.isAdmin = false;
        console.error(e);
    }
}



// Инициализация при загрузке страницы
async function init() {
    // Проверка прав пользователя
    await checkAdminAccess();
    // Сборка меню
    await buildMenu();
    // Обработка текущего URL
    await handleCurrentUrl();
}
init();

// Обработка кнопок "назад/вперёд" в браузере
window.addEventListener("popstate", handleCurrentUrl);

// Обработчики событий
menuToggle.onclick = toggleMenu;
overlay.onclick = closeMenu;
menuContainer.onclick = handlePanelClick;
document.getElementById("regDiv")?.addEventListener("click", handlePanelClick);
