const menuContainer = document.getElementById("menuContainer");
const panel = document.getElementById("regPanel");
const overlay = document.getElementById("overlay");
const menuToggle = document.getElementById("menuToggle");



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

        // Если прав нет, удаляем ссылки на админские страницы
        if (!hasAdmin) {
            panel.querySelectorAll('a[is-admin="true"]').forEach(el => el.remove());
        }
    } catch (e) {
        console.error(e);
    }
}


// Инициализация при загрузке страницы
handleCurrentUrl();
// Проверка прав пользователя
checkAdminAccess();

// Обработка кнопок "назад/вперёд" в браузере
window.addEventListener("popstate", handleCurrentUrl);

// Обработчики событий
menuToggle.onclick = toggleMenu;
overlay.onclick = closeMenu;
menuContainer.onclick = handlePanelClick;
document.getElementById("regDiv")?.addEventListener("click", handlePanelClick);
