const panel = document.getElementById("regPanel");

// Обработчик клика по ссылкам внутри панели
panel.addEventListener("click", (e) => {
    // Ищем ближайшую ссылку
    const link = e.target.closest("a[data-link='true']");
    if (!link || !panel.contains(link)) return;

    // Отменяем стандартный переход
    e.preventDefault();

    // Разбираем URL ссылки
    const { url, action, data } = urlStrBr(link.href);
    // Целевой контейнер для загрузки
    const targetId = link.dataset.target;

    // Работаем только с параметром sPage
    if (action !== "sPage") return;

    // Обновляем URL без перезагрузки страницы
    history.pushState(null, "", `/${url}/?${action}=${data}`);

    // Загружаем нужный блок
    loadBlock(`pages/${url}/${data}`, targetId);
});


// Обработка текущего URL при загрузке страницы или навигации
function handleCurrentUrl() {
    const { url, action, data } = urlStrBr(window.location.href);

    // Если есть параметр sPage, загружаем соответствующий блок
    if (action === "sPage") {
        loadBlock(`pages/${url}/${data}`, "regDiv");
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
            panel.querySelectorAll('a[href*="sPage=users"]').forEach(el => el.remove());
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