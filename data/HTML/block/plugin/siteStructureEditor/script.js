/* ===
 * Выбор и перемещение страницы
=== */

// Состояние перемещения страницы
const pageState = {
    selectedPage: null,
    selectedConnection: null,
    draggedPage: null,
    linkedPage: null,
    linkedPoint: null,
    linkedSide: null,
    targetPage: null,
    tempArrow: null,
    offsetX: 0,
    offsetY: 0
};

/* ***
 * getPageId - получение свободного id страницы
 * - проверяет существующие страницы
 * - возвращает первый свободный номер
*** */
function getPageId() {
    const pages = document.querySelectorAll('#siteMap pageBlock');
    let id = 1;

    while (Array.from(pages).some(page => page.dataset.id === String(id))) {
        id++;
    }

    return id;
}

/* ***
 * getPagePosition - получение положения страницы на карте
 * - принимает страницу
 * - возвращает координаты страницы
*** */
function getPagePosition(page) {
    const siteMap = document.getElementById('siteMap');
    const mapRect = siteMap.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();

    return {
        x: pageRect.left - mapRect.left + siteMap.scrollLeft,
        y: pageRect.top - mapRect.top + siteMap.scrollTop
    };
}

/* ***
 * setPagePosition - установка положения страницы
 * - принимает страницу и координаты
 * - сохраняет положение на карте
*** */
function setPagePosition(page, x, y) {
    page.style.left = x + 'px';
    page.style.top = y + 'px';

    page.dataset.position = x + ',' + y;
}

/* ***
 * updatePageOrder - обновление порядка страниц
 * - сортирует страницы по текущему номеру
 * - устанавливает номера от 1 по порядку
*** */
function updatePageOrder(parentId = null) {
    // Получение связей страниц
    const siteMap = document.getElementById('siteMap');
    const connections = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]'));
    const parentConnections = parentId ? connections.filter(connection => connection.dataset.from === parentId) : [];
    const connection = parentConnections.length ? parentConnections : null;
    const childIds = new Set(connections.map(connection => connection.dataset.to));

    // Получение соседних страниц
    const allPages = Array.from(siteMap.querySelectorAll(':scope > pageBlock'));
    const pages = connection
        ? connection.sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order))
            .map(connection => allPages.find(page => page.dataset.id === connection.dataset.to)).filter(Boolean)
        : allPages.filter(page => !childIds.has(page.dataset.id));

    // Сортировка страниц
    pages.sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order));

    // Обновление порядка
    pages.forEach((page, index) => {
        page.dataset.order = index + 1;

        const pageConnection = connections.find(connection =>
            connection.dataset.from === parentId && connection.dataset.to === page.dataset.id
        );

        if (pageConnection) {
            pageConnection.dataset.order = index;
        }
    });

    // Обновление выбранной страницы
    if (pageState.selectedPage) {
        updatePagePoints(pageState.selectedPage);
        loadPageProperties(pageState.selectedPage);
    }
}

/* ***
 * hasPageChild - проверка дочерней страницы
 * - проверяет наличие страницы среди всех потомков
*** */
function hasPageChild(parentId, childId) {
    const siteMap = document.getElementById('siteMap');
    const connections = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]'))
        .filter(connection => connection.dataset.from === parentId);

    for (const connection of connections) {
        if (connection.dataset.to === childId) return true;

        if (hasPageChild(connection.dataset.to, childId)) return true;
    }

    return false;
}

/* ***
 * movePageToParent - добавление связи между страницами
 * - удаляет старого родителя дочерней страницы
 * - добавляет страницу к новому родителю
*** */
function movePageToParent(parent, child, fromSide, toSide) {
    const siteMap = document.getElementById('siteMap');
    const parentId = parent.dataset.id;
    const childId = child.dataset.id;

    // Получение старой связи дочерней страницы
    const oldConnection = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]')).find(connection =>
        connection.dataset.to === childId
    );
    const oldParentId = oldConnection ? oldConnection.dataset.from : null;

    // Удаление старой связи страницы
    siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]').forEach(connection => {
        if (connection.dataset.to === childId) {
            connection.remove();
        }
    });

    // Получение связи родителя
    const children = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]'))
        .filter(connection => connection.dataset.from === parentId);
    const connection = document.createElement('pageConnection');

    connection.dataset.kind = 'parent';
    connection.dataset.from = parentId;
    connection.dataset.to = childId;
    connection.dataset.fromSide = fromSide;
    connection.dataset.toSide = toSide;
    connection.dataset.order = children.length;
    siteMap.appendChild(connection);

    // Обновление порядка страниц
    updatePageOrder(oldParentId);
    child.dataset.order = children.length + 1;
    updatePageOrder(parentId);
}

/* ***
 * updatePagePoints - обновление точек страницы
 * - удаляет старые точки
 * - добавляет точки выбранной странице
 * - добавляет номер страницы сверху слева
*** */
function updatePagePoints(page) {
    // Удаление старых точек
    document.querySelectorAll('pagePoint').forEach(point => point.remove());

    if (!page) return;

    // Создание точек
    ['top', 'right', 'bottom', 'left'].forEach(side => {
        const point = document.createElement('pagePoint');

        point.dataset.side = side;
        page.appendChild(point);
    });

    // Создание номера страницы
    const point = document.createElement('pagePoint');

    point.dataset.side = 'number';
    point.textContent = page.dataset.order;
    page.appendChild(point);
}

/* ***
 * createTempArrow - создание временной стрелки
 * - принимает начальную точку
 * - создает стрелку для новой связи
*** */
function createTempArrow(point) {
    // Получение карты и положения точки
    const siteMap = document.getElementById('siteMap');
    const mapRect = siteMap.getBoundingClientRect();
    const pointRect = point.getBoundingClientRect();

    const startX = pointRect.left + pointRect.width / 2 - mapRect.left + siteMap.scrollLeft;
    const startY = pointRect.top + pointRect.height / 2 - mapRect.top + siteMap.scrollTop;

    // Создание стрелки
    const arrow = document.createElement('pageConnection');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    marker.setAttribute('id', 'tempArrowHead');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    marker.setAttribute('markerWidth', '11');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '5');
    marker.setAttribute('orient', 'auto');

    markerPath.setAttribute('d', 'M 1 1 L 10 5 L 1 9');

    marker.appendChild(markerPath);
    svg.appendChild(marker);

    path.setAttribute('marker-end', 'url(#tempArrowHead)');

    arrow.classList.add('temporary');
    arrow.dataset.startX = startX;
    arrow.dataset.startY = startY;

    svg.appendChild(path);
    arrow.appendChild(svg);
    siteMap.appendChild(arrow);

    pageState.tempArrow = arrow;
}

/* ***
 * updateTempArrow - обновление временной стрелки
 * - принимает положение курсора
 * - перемещает конец стрелки
*** */
function updateTempArrow(clientX, clientY) {
    if (!pageState.tempArrow) return;

    // Получение карты и координат
    const siteMap = document.getElementById('siteMap');
    const mapRect = siteMap.getBoundingClientRect();

    const startX = Number(pageState.tempArrow.dataset.startX);
    const startY = Number(pageState.tempArrow.dataset.startY);
    const endX = clientX - mapRect.left + siteMap.scrollLeft;
    const endY = clientY - mapRect.top + siteMap.scrollTop;

    // Обновление стрелки
    const path = pageState.tempArrow.querySelector('svg > path');

    path.setAttribute('d', 'M ' + startX + ' ' + startY + ' L ' + endX + ' ' + endY);
}

/* ***
 * handlePointDown - начало создания связи
 * - получает выбранную точку
 * - начинает создание стрелки
 * - скрывает точки исходной страницы
*** */
function handlePointDown(event) {
    const point = event.target.closest('pagePoint');

    if (!point || point.dataset.side === 'number' || event.button !== 0) return;

    // Сохранение исходной страницы и точки
    pageState.linkedPage = point.closest('pageBlock');
    pageState.linkedPoint = point;
    pageState.linkedSide = point.dataset.side;

    createTempArrow(point);

    // Удаление точек исходной страницы
    document.querySelectorAll('pagePoint').forEach(point => point.remove());

    pageState.draggedPage = null;

    event.preventDefault();
    event.stopPropagation();
}

/* ***
 * handleLinkMove - перемещение создаваемой связи
 * - обновляет временную стрелку
 * - показывает точки страницы под курсором
 * - выбирает точку возле курсора
*** */
function handleLinkMove(event) {
    if (!pageState.tempArrow) return;

    updateTempArrow(event.clientX, event.clientY);

    // Поиск страницы под курсором
    const pages = document.querySelectorAll('#siteMap pageBlock');
    let targetPage = null;

    pages.forEach(page => {
        if (page === pageState.linkedPage) return;

        const rect = page.getBoundingClientRect();

        if (
            event.clientX >= rect.left - 20 &&
            event.clientX <= rect.right + 20 &&
            event.clientY >= rect.top - 20 &&
            event.clientY <= rect.bottom + 20
        ) {
            targetPage = page;
        }
    });

    // Обновление точек страницы
    if (targetPage !== pageState.targetPage) {
        pageState.targetPage = targetPage;
        updatePagePoints(targetPage);
    }

    // Поиск точки возле курсора
    pageState.linkedPoint = null;

    if (!targetPage) return;

    targetPage.querySelectorAll('pagePoint').forEach(point => {
        const rect = point.getBoundingClientRect();
        const pointX = rect.left + rect.width / 2;
        const pointY = rect.top + rect.height / 2;
        const distance = Math.hypot(event.clientX - pointX, event.clientY - pointY);

        if (distance <= 25) {
            pageState.linkedPoint = point;
        }
    });
}

/* ***
 * handleLinkUp - завершение создания связи
 * - получает страницу с отображаемыми точками
 * - добавляет дочернюю страницу
 * - удаляет временную стрелку
*** */
function handleLinkUp() {
    if (!pageState.tempArrow) return;

    // Получение страницы с отображаемыми точками
    const targetPage = pageState.targetPage;

    // Добавление связи
    if (targetPage && targetPage !== pageState.linkedPage && pageState.linkedPoint) {
        if (hasPageChild(targetPage.dataset.id, pageState.linkedPage.dataset.id)) {
            const connection = Array.from(document.querySelectorAll('#siteMap > pageConnection[data-kind="parent"]')).find(connection =>
                connection.dataset.to === pageState.linkedPage.dataset.id
            );

            if (connection) connection.remove();
        }

        movePageToParent(
            pageState.linkedPage,
            targetPage,
            pageState.linkedSide,
            pageState.linkedPoint.dataset.side
        );
    }

    // Удаление временной стрелки
    pageState.tempArrow.remove();
    pageState.tempArrow = null;

    // Обновление стрелок и точек
    updatePageArrows();
    selectPage(pageState.linkedPage);

    pageState.linkedPage = null;
    pageState.linkedPoint = null;
    pageState.linkedSide = null;
    pageState.targetPage = null;
}

/**
 * selectPage - выбор страницы
 * - принимает элемент страницы
 * - снимает выделение с предыдущей страницы и связи
 * - выделяет выбранную страницу
 * - загружает свойства страницы
 */
function selectPage(page) {
    if (pageState.selectedPage) {
        pageState.selectedPage.classList.remove('selected');
    }

    if (pageState.selectedConnection) {
        pageState.selectedConnection.classList.remove('selected');
        pageState.selectedConnection = null;
        updatePageArrows();
    }

    pageState.selectedPage = page;

    if (pageState.selectedPage) {
        pageState.selectedPage.classList.add('selected');
        loadPageProperties(pageState.selectedPage);
    }

    updatePagePoints(page);
}

/** 
 * selectConnection - выбор связи
 * - принимает элемент связи
 * - снимает выделение с предыдущей связи и страницы
 * - выделяет выбранную связь
 */
function selectConnection(connection) {
    if (pageState.selectedConnection) {
        pageState.selectedConnection.classList.remove('selected');
    }

    if (pageState.selectedPage) {
        pageState.selectedPage.classList.remove('selected');
        pageState.selectedPage = null;
        updatePagePoints(null);
    }

    pageState.selectedConnection = connection;

    if (pageState.selectedConnection) {
        pageState.selectedConnection.classList.add('selected');
        updatePageArrows();
    }
}

/* ***
 * handlePageDown - обработка нажатия на страницу
 * - принимает объект события
 * - выбирает страницу
 * - сохраняет положение курсора относительно страницы
 * - начинает перемещение страницы
*** */
function handlePageDown(event) {
    if (event.target.closest('pagePoint')) return;

    const connection = event.target.closest('pageConnection');

    if (connection && event.button === 0) {
        selectConnection(connection);
        event.preventDefault();
        return;
    }

    const page = event.target.closest('pageBlock');

    if (!page || event.button !== 0) {
        return;
    }

    const pageRect = page.getBoundingClientRect();

    selectPage(page);

    pageState.draggedPage = page;
    pageState.offsetX = event.clientX - pageRect.left;
    pageState.offsetY = event.clientY - pageRect.top;

    event.preventDefault();
}

/* ***
 * handlePageMove - обработка перемещения страницы
 * - принимает объект события
 * - вычисляет положение страницы относительно карты
 * - перемещает выбранную страницу
*** */
function handlePageMove(event) {
    if (!pageState.draggedPage) {
        return;
    }

    const siteMap = document.getElementById('siteMap');
    const mapRect = siteMap.getBoundingClientRect();

    const pageX = getGridPosition(event.clientX - mapRect.left + siteMap.scrollLeft - pageState.offsetX);
    const pageY = getGridPosition(event.clientY - mapRect.top + siteMap.scrollTop - pageState.offsetY);

    setPagePosition(pageState.draggedPage, pageX, pageY);

    updatePageArrows(pageState.draggedPage);
}

/* ***
 * handlePageUp - обработка отпускания кнопки мыши
 * - завершает перемещение страницы
*** */
function handlePageUp() {
    pageState.draggedPage = null;
}

// Обработчики выбора и перемещения страницы
document.getElementById('siteMap').addEventListener('mousedown', handlePageDown);
document.addEventListener('mousemove', handlePageMove);
document.addEventListener('mouseup', handlePageUp);

// Обработчики создания связи
document.getElementById('siteMap').addEventListener('mousedown', handlePointDown);
document.addEventListener('mousemove', handleLinkMove);
document.addEventListener('mouseup', handleLinkUp);



/* ===
 * Контекстное меню
=== */

// Состояние контекстного меню
const menuState = {
    x: 0,
    y: 0,
    target: null
};

// Действия контекстного меню
const menuActions = {
    create: createPage,
    paste: pastePage,
    copy: copyPage,
    cut: cutPage,
    delete: deletePage
};

/* ***
 * parsePage - проверка страницы
 * - принимает HTML из буфера обмена
 * - возвращает pageBlock или null
*** */
function parsePage(text) {
    // Создание временного контейнера
    const template = document.createElement('template');

    template.innerHTML = text.trim();

    // Получение элементов
    const elements = template.content.children;

    // Проверка структуры
    if (elements.length !== 1 || elements[0].tagName.toLowerCase() !== 'pageblock') return null;

    return elements[0];
}

/* ***
 * updateContextMenu - обновление контекстного меню
 * - принимает тип выбранной области
 * - показывает доступные действия
 * - проверяет возможность вставки
*** */
async function updateContextMenu(target) {
    // Получение пунктов меню
    const actions = document.querySelectorAll('#contextMenu [data-action]');

    // Отображение доступных действий
    actions.forEach(action => {
        action.style.display = action.dataset.target === target && (target !== 'page' || action.dataset.action === 'delete') ? '' : 'none';
    });

    if (target !== 'empty') return;

    // Получение действия вставки
    const pasteAction = document.querySelector('#contextMenu [data-action="paste"]');

    try {
        // Получение и проверка страницы из буфера обмена
        const page = parsePage(await navigator.clipboard.readText());

        pasteAction.style.display = page ? '' : 'none';
    } catch (error) {
        pasteAction.style.display = 'none';
    }
}

/* ***
 * openContextMenu - открытие контекстного меню
 * - принимает координаты курсора и выбранную область
 * - сохраняет положение открытия
 * - показывает контекстное меню
*** */
async function openContextMenu(clientX, clientY, target) {
    // Получение контекстного меню
    const contextMenu = document.getElementById('contextMenu');

    // Сохранение состояния меню
    menuState.x = clientX;
    menuState.y = clientY;
    menuState.target = target;

    // Обновление контекстного меню
    await updateContextMenu(target);

    // Установка положения меню
    contextMenu.style.left = clientX + 'px';
    contextMenu.style.top = clientY + 'px';
    contextMenu.style.display = 'block';
}

/* ***
 * closeContextMenu - закрытие контекстного меню
 * - скрывает контекстное меню
*** */
function closeContextMenu() {
    // Получение контекстного меню
    const contextMenu = document.getElementById('contextMenu');

    contextMenu.style.display = 'none';
}

/* ***
 * copyPage - копирование страницы
 * - записывает тег выбранной страницы в системный буфер обмена
*** */
async function copyPage() {
    if (!pageState.selectedPage) return;

    // Запись страницы в буфер обмена
    await navigator.clipboard.writeText(pageState.selectedPage.outerHTML);
}

/* ***
 * cutPage - вырезание страницы
 * - копирует тег страницы в системный буфер обмена
 * - удаляет страницу после копирования
*** */
async function cutPage() {
    if (!pageState.selectedPage) return;

    try {
        // Копирование страницы
        await copyPage();

        // Удаление страницы
        deletePage();
    } catch (error) {
        return;
    }
}

/* ***
 * pastePage - вставка страницы
 * - получает и проверяет тег из системного буфера обмена
 * - вставляет страницу в месте открытия меню
*** */
async function pastePage() {
    try {
        // Получение и проверка страницы из буфера обмена
        const page = parsePage(await navigator.clipboard.readText());

        if (!page) return;

        // Установка нового id
        page.dataset.id = getPageId();
        
        // Установка порядка страницы
        page.dataset.order = Array.from(document.querySelectorAll('#siteMap pageBlock')).filter(page => {
            return !Array.from(document.querySelectorAll('#siteMap > pageConnection[data-kind="parent"]')).some(connection =>
                connection.dataset.to === page.dataset.id
            );
        }).length + 1;

        // Удаление старых служебных элементов
        page.querySelectorAll('pagePoint').forEach(point => point.remove());

        // Получение карты сайта
        const siteMap = document.getElementById('siteMap');
        const mapRect = siteMap.getBoundingClientRect();

        // Вычисление положения страницы
        const pageX = getGridPosition(menuState.x - mapRect.left + siteMap.scrollLeft);
        const pageY = getGridPosition(menuState.y - mapRect.top + siteMap.scrollTop);

        // Установка положения страницы
        page.style.left = pageX + 'px';
        page.style.top = pageY + 'px';
        page.dataset.position = pageX + ',' + pageY;

        // Добавление страницы
        siteMap.insertBefore(page, siteMap.querySelector(':scope > pageConnection'));
        updatePageOrder();
        selectPage(page);
        updatePageArrows();
    } catch (error) {
        return;
    }
}

/***
 * deletePage - удаление выбранного элемента
 * - удаляет выбранную страницу и ее связи
 * - удаляет выбранную связь
 * - очищает выбранный элемент
 ***/
function deletePage() {
    // Удаление выбранной связи
    if (pageState.selectedConnection) {
        const connection = pageState.selectedConnection;
        const parentId = connection.dataset.from;

        connection.remove();
        pageState.selectedConnection = null;

        updatePageOrder(parentId);
        updatePageArrows();
        return;
    }

    if (!pageState.selectedPage) return;

    // Получение страницы и связей
    const siteMap = document.getElementById('siteMap');
    const pageId = pageState.selectedPage.dataset.id;

    // Получение родительской связи страницы
    const parentConnection = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]')).find(connection =>
        connection.dataset.to === pageId
    );
    const parentId = parentConnection ? parentConnection.dataset.from : null;

    // Удаление страницы из дочерних связей
    siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]').forEach(connection => {
        if (connection.dataset.from === pageId || connection.dataset.to === pageId) {
            connection.remove();
        }
    });

    // Удаление страницы
    pageState.selectedPage.remove();
    pageState.selectedPage = null;

    // Обновление порядка и стрелок страниц
    updatePageOrder(parentId);

    // Обновление стрелок страниц
    updatePageArrows();
}

/* ***
 * createPage - создание страницы
 * - создает страницу в месте открытия меню
 * - добавляет страницу на карту
*** */
function createPage() {
    // Получение карты сайта
    const siteMap = document.getElementById('siteMap');
    const mapRect = siteMap.getBoundingClientRect();

    // Вычисление положения страницы
    const pageX = getGridPosition(menuState.x - mapRect.left + siteMap.scrollLeft);
    const pageY = getGridPosition(menuState.y - mapRect.top + siteMap.scrollTop);

    // Создание страницы
    const page = document.createElement('pageBlock');
    const pageText = document.createElement('pageText');

    page.dataset.id = getPageId();
    page.dataset.name = 'newPage';
    page.dataset.title = 'Новая страница';
    page.dataset.caption = '';
    page.dataset.description = '';
    page.dataset.types = '';
    page.dataset.theme = '';
    page.dataset.status = '';
    page.dataset.access = '';
    page.dataset.order = Array.from(document.querySelectorAll('#siteMap pageBlock')).filter(page => {
        return !Array.from(document.querySelectorAll('#siteMap > pageConnection[data-kind="parent"]')).some(connection =>
            connection.dataset.to === page.dataset.id
        );
    }).length + 1;
    page.dataset.redirect = '';
    page.dataset.position = pageX + ',' + pageY;
    page.dataset.view = 'collapsed';
    pageText.textContent = page.dataset.title;
    page.style.left = pageX + 'px';
    page.style.top = pageY + 'px';

    page.appendChild(pageText);

    // Добавление страницы
    siteMap.insertBefore(page, siteMap.querySelector(':scope > pageConnection'));
    updatePageOrder();
    selectPage(page);
}

/***
 * handleContextMenu - обработка правой кнопки мыши
 * - определяет страницу, связь или пустую область
 * - открывает контекстное меню
 ***/
function handleContextMenu(event) {
    // Получение элемента под курсором
    const page = event.target.closest('pageBlock');
    const connection = event.target.closest('pageConnection');

    event.preventDefault();

    if (page && page !== pageState.selectedPage) return;
    if (connection && connection !== pageState.selectedConnection) return;

    // Открытие контекстного меню
    openContextMenu(event.clientX, event.clientY, page || connection ? 'page' : 'empty');
}

/* ***
 * handleMenuAction - обработка действия контекстного меню
 * - определяет выбранное действие
 * - выполняет действие
*** */
async function handleMenuAction(event) {
    // Получение выбранного действия
    const action = event.target.closest('[data-action]');

    if (!action || !menuActions[action.dataset.action]) return;

    // Выполнение действия
    await menuActions[action.dataset.action]();

    closeContextMenu();
}

/* ***
 * handleMenuClose - обработка нажатия вне меню
 * - закрывает контекстное меню
*** */
function handleMenuClose(event) {
    // Получение контекстного меню
    const contextMenu = document.getElementById('contextMenu');

    if (contextMenu.contains(event.target)) return;

    closeContextMenu();
}

// Обработчики контекстного меню
document.getElementById('siteMap').addEventListener('contextmenu', handleContextMenu);
document.getElementById('contextMenu').addEventListener('click', handleMenuAction);
document.addEventListener('mousedown', handleMenuClose);



/* ===
 * Взаимодействие с страницами
=== */

/***
 * updatePageArrows - обновление стрелок страниц
 * - принимает страницу или null
 * - получает связи из pageConnections
 * - строит стрелки со скругленными поворотами
 ***/
function updatePageArrows(page = null) {
    // Получение карты и связей
    const siteMap = document.getElementById('siteMap');
    const pageConnections = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]'));
    const connections = [];

    // Получение связей страниц
    pageConnections.forEach(connection => {
        if (page && connection.dataset.from !== page.dataset.id && connection.dataset.to !== page.dataset.id) return;

        const svg = connection.querySelector(':scope > svg');

        connection.querySelectorAll(':scope > connectionPoint').forEach(point => point.remove());

        if (svg) svg.remove();

        const parent = Array.from(siteMap.querySelectorAll(':scope > pageBlock')).find(page => page.dataset.id === connection.dataset.from);
        const child = Array.from(siteMap.querySelectorAll(':scope > pageBlock')).find(page => page.dataset.id === connection.dataset.to);

        if (parent && child) {
            connections.push({ connection, parent, child });
        }
    });

    // Создание стрелок
    connections.forEach(connection => {
        const arrow = connection.connection;
        const parent = connection.parent;
        const child = connection.child;

        // Получение положения страниц
        const parentPosition = getPagePosition(parent);
        const childPosition = getPagePosition(child);

        // Получение центров страниц
        const parentX = parentPosition.x + parent.offsetWidth / 2;
        const parentY = parentPosition.y + parent.offsetHeight / 2;
        const childX = childPosition.x + child.offsetWidth / 2;
        const childY = childPosition.y + child.offsetHeight / 2;

        // Определение ближайших сторон
        const distanceX = childX - parentX;
        const distanceY = childY - parentY;

        let startX;
        let startY;
        let endX;
        let endY;
        let points;

        const sides = ['top', 'right', 'bottom', 'left'];
        const fromSide = connection.connection.dataset.fromSide;
        const toSide = connection.connection.dataset.toSide;

        if (sides.includes(fromSide) && sides.includes(toSide)) {
            startX = fromSide === 'left' ? parentPosition.x : fromSide === 'right' ? parentPosition.x + parent.offsetWidth : parentX;
            startY = fromSide === 'top' ? parentPosition.y : fromSide === 'bottom' ? parentPosition.y + parent.offsetHeight : parentY;
            endX = toSide === 'left' ? childPosition.x : toSide === 'right' ? childPosition.x + child.offsetWidth : childX;
            endY = toSide === 'top' ? childPosition.y : toSide === 'bottom' ? childPosition.y + child.offsetHeight : childY;

            const fromVertical = fromSide === 'top' || fromSide === 'bottom';
            const toVertical = toSide === 'top' || toSide === 'bottom';

            if (fromVertical === toVertical) {
                if (fromVertical) {
                    const middleY = (startY + endY) / 2;

                    points = [[startX, startY], [startX, middleY], [endX, middleY], [endX, endY]];
                } else {
                    const middleX = (startX + endX) / 2;

                    points = [[startX, startY], [middleX, startY], [middleX, endY], [endX, endY]];
                }
            } else {
                const pointX = fromVertical ? startX : endX;
                const pointY = fromVertical ? endY : startY;

                points = [[startX, startY], [pointX, pointY], [endX, endY]];
            }
        // Страница снизу
        } else if (distanceY > 0) {
            // Проверка возможности выхода вниз
            const parentBottom = parentPosition.y + parent.offsetHeight;
            const spaceY = childPosition.y - parentBottom;

            if (spaceY >= 10) {
                // Выход снизу
                startX = parentX;
                startY = parentBottom;
                endX = childX;
                endY = childPosition.y;

                const middleY = (startY + endY) / 2;

                points = [[startX, startY], [startX, middleY], [endX, middleY], [endX, endY]];
            } else {
                // Выход сбоку родителя
                const isRight = childX > parentX;

                startX = isRight ? parentPosition.x + parent.offsetWidth : parentPosition.x;
                startY = parentY;
                endX = isRight ? childPosition.x : childPosition.x + child.offsetWidth;
                endY = childY;

                const middleX = (startX + endX) / 2;

                points = [[startX, startY], [middleX, startY], [middleX, endY], [endX, endY]];
            }
        } else if (Math.abs(distanceY) > Math.abs(distanceX)) {
            startX = parentX;
            startY = parentPosition.y;
            endX = childX;
            endY = childPosition.y + child.offsetHeight;

            const middleY = (startY + endY) / 2;

            points = [[startX, startY], [startX, middleY], [endX, middleY], [endX, endY]];
        // Страница сбоку
        } else {
            startX = distanceX > 0 ? parentPosition.x + parent.offsetWidth : parentPosition.x;
            startY = parentY;
            endX = distanceX > 0 ? childPosition.x : childPosition.x + child.offsetWidth;
            endY = childY;

            const middleX = (startX + endX) / 2;

            points = [[startX, startY], [middleX, startY], [middleX, endY], [endX, endY]];
        }

        // Создание точек изгиба выбранной связи
        if (arrow === pageState.selectedConnection) {
            points.slice(1, -1).forEach(point => {
                const connectionPoint = document.createElement('connectionPoint');

                connectionPoint.style.left = point[0] + 'px';
                connectionPoint.style.top = point[1] + 'px';

                arrow.appendChild(connectionPoint);
            });
        }

        // Создание стрелки
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        marker.setAttribute('id', 'pageArrowHead-' + connection.connection.dataset.from + '-' + connection.connection.dataset.to);
        marker.setAttribute('markerUnits', 'userSpaceOnUse');
        marker.setAttribute('markerWidth', '11');
        marker.setAttribute('markerHeight', '10');
        marker.setAttribute('refX', '10');
        marker.setAttribute('refY', '5');
        marker.setAttribute('orient', 'auto');

        markerPath.setAttribute('d', 'M 1 1 L 10 5 L 1 9');

        marker.appendChild(markerPath);
        svg.appendChild(marker);

        path.setAttribute('marker-end', 'url(#' + marker.id + ')');

        // Создание скругленного пути
        const radius = 2;
        let pathData = 'M ' + points[0][0] + ' ' + points[0][1];

        for (let i = 1; i < points.length - 1; i++) {
            const previous = points[i - 1];
            const current = points[i];
            const next = points[i + 1];

            const previousX = current[0] - previous[0];
            const previousY = current[1] - previous[1];
            const nextX = next[0] - current[0];
            const nextY = next[1] - current[1];

            const previousLength = Math.hypot(previousX, previousY);
            const nextLength = Math.hypot(nextX, nextY);

            if (!previousLength || !nextLength) {
                pathData += ' L ' + current[0] + ' ' + current[1];
                continue;
            }

            const cornerRadius = Math.min(radius, previousLength / 2, nextLength / 2);

            const beforeX = current[0] - previousX / previousLength * cornerRadius;
            const beforeY = current[1] - previousY / previousLength * cornerRadius;
            const afterX = current[0] + nextX / nextLength * cornerRadius;
            const afterY = current[1] + nextY / nextLength * cornerRadius;

            pathData += ' L ' + beforeX + ' ' + beforeY;
            pathData += ' Q ' + current[0] + ' ' + current[1] + ' ' + afterX + ' ' + afterY;
        }

        // Завершение пути
        pathData += ' L ' + points[points.length - 1][0] + ' ' + points[points.length - 1][1];

        // Установка пути
        path.setAttribute('d', pathData);

        // Добавление стрелки
        svg.appendChild(path);
        arrow.appendChild(svg);
    });
}

/* ***
 * loadPage - загрузка страниц
 * - получает все страницы карты
 * - загружает название, положение и стрелки страниц
*** */
function loadPage() {
    // Получение карты и страниц
    const siteMap = document.getElementById('siteMap');
    const pages = siteMap.querySelectorAll('pageBlock');

    // Загрузка страниц
    pages.forEach(page => {
        // Получение координат
        const [x, y] = page.dataset.position.split(',');

        // Загрузка данных страницы
        let pageText = page.querySelector(':scope > pageText');

        if (!pageText) {
            pageText = document.createElement('pageText');
            page.prepend(pageText);
        }

        pageText.textContent = page.dataset.title;
        setPagePosition(page, Number(x), Number(y));
    });

    // Создание стрелок
    updatePageArrows();
}

// Обработчик загрузки страниц
document.addEventListener('siteStructureEditor:loaded', loadPage);



/* ===
 * Файловое меню
=== */

/* ***
 * toggleFileMenu - переключение файлового меню
 * - показывает или скрывает список действий
*** */
function toggleFileMenu() {
    const fileMenuList = document.getElementById('fileMenuList');

    fileMenuList.style.display = fileMenuList.style.display === 'block' ? 'none' : 'block';
}

/* ***
 * handleFileMenuClose - закрытие файлового меню
 * - закрывает меню при нажатии вне него
*** */
function handleFileMenuClose(event) {
    const fileMenu = document.getElementById('fileMenu');

    if (fileMenu.contains(event.target)) return;

    document.getElementById('fileMenuList').style.display = 'none';
}

// Обработчики файлового меню
document.getElementById('fileMenuIcon').addEventListener('click', toggleFileMenu);
document.addEventListener('mousedown', handleFileMenuClose);

/* ***
 * saveFile - сохранение структуры сайта
 * - получает структуру страниц и связей
 * - сохраняет структуру в XML
*** */
function saveFile() {
    // Получение карты сайта и связей
    const siteMap = document.getElementById('siteMap');

    // Создание XML
    const xmlDocument = document.implementation.createDocument('', 'siteMap');
    const xmlSiteMap = xmlDocument.documentElement;

    // Получение дочерних страниц
    const childIds = new Set();

    siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]').forEach(connection => {
        childIds.add(connection.dataset.to);
    });

    // Создание корневых страниц
    siteMap.querySelectorAll(':scope > pageBlock').forEach(page => {
        if (!childIds.has(page.dataset.id)) {
            xmlSiteMap.appendChild(createPageXml(xmlDocument, page));
        }
    });

    // Создание файла
    const serializer = new XMLSerializer();
    const xml = serializer.serializeToString(xmlDocument);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'siteStructureEditor.xml';
    link.click();

    URL.revokeObjectURL(url);
}

/* ***
 * createPageXml - создание XML страницы
 * - сохраняет данные страницы
 * - получает дочерние страницы из pageConnections
 * - возвращает XML элемент
*** */
function createPageXml(xmlDocument, page) {
    // Получение карты и связей
    const siteMap = document.getElementById('siteMap');

    // Создание страницы
    const xmlPage = xmlDocument.createElement('pageBlock');

    // Сохранение данных страницы
    Object.entries(page.dataset).forEach(([name, value]) => {
        xmlPage.setAttribute(name, value);
    });

    // Получение связи страницы
    const connections = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]'))
        .filter(connection => connection.dataset.from === page.dataset.id)
        .sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order));

    if (connections.length) {
        // Создание дочерних страниц
        connections.forEach(connection => {
            const child = Array.from(siteMap.querySelectorAll(':scope > pageBlock')).find(
                page => page.dataset.id === connection.dataset.to
            );

            if (child) {
                xmlPage.appendChild(createPageXml(xmlDocument, child));
            }
        });
    }

    return xmlPage;
}

/* ***
 * openFile - открытие структуры сайта
 * - открывает XML через выбор файла
 * - удаляет текущую структуру
 * - создает страницы и связи заново
*** */
function openFile() {
    // Создание выбора файла
    const input = document.createElement('input');

    input.type = 'file';
    input.accept = '.xml';

    input.addEventListener('change', handleFileOpen);
    input.click();
}

/* ***
 * handleFileOpen - обработка открытия файла
 * - читает выбранный XML
 * - создает страницы
*** */
function handleFileOpen(event) {
    const file = event.target.files[0];

    if (!file) return;

    // Чтение файла
    const reader = new FileReader();

    reader.addEventListener('load', handleFileLoad);
    reader.readAsText(file);
}

/* ***
 * createPageFromXml - создание страницы из XML
 * - создает страницу на одном уровне
 * - создает связи с дочерними страницами
*** */
function createPageFromXml(xmlPage, parentId = null) {
    // Получение карты и связей
    const siteMap = document.getElementById('siteMap');

    // Создание страницы
    const page = document.createElement('pageBlock');
    const pageText = document.createElement('pageText');

    // Загрузка данных
    Array.from(xmlPage.attributes).forEach(attribute => {
        page.dataset[attribute.name] = attribute.value;
    });

    // Получение координат
    const [x, y] = page.dataset.position.split(',');

    pageText.textContent = page.dataset.title;
    page.style.left = x + 'px';
    page.style.top = y + 'px';

    page.appendChild(pageText);
    siteMap.insertBefore(page, siteMap.querySelector(':scope > pageConnection'));

    // Добавление связи с родителем
    if (parentId) {
        const children = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]'))
            .filter(connection => connection.dataset.from === parentId);
        const connection = document.createElement('pageConnection');

        connection.dataset.kind = 'parent';
        connection.dataset.from = parentId;
        connection.dataset.to = page.dataset.id;
        connection.dataset.order = children.length;
        siteMap.appendChild(connection);
    }

    // Создание дочерних страниц
    Array.from(xmlPage.children).forEach(child => {
        if (child.tagName.toLowerCase() === 'pageblock') {
            createPageFromXml(child, page.dataset.id);
        }
    });
}

/* ***
 * handleFileLoad - загрузка структуры из XML
 * - удаляет текущую структуру
 * - размещает все страницы на одном уровне
 * - восстанавливает связи
*** */
function handleFileLoad(event) {
    try {
        // Получение XML
        const parser = new DOMParser();
        const xmlDocument = parser.parseFromString(event.target.result, 'application/xml');
        const xmlSiteMap = xmlDocument.documentElement;
        const siteMap = document.getElementById('siteMap');

        // Проверка XML
        if (xmlDocument.querySelector('parsererror')) return;

        // Очистка карты и связей
        siteMap.innerHTML = '';
        pageState.selectedPage = null;

        // Создание страниц
        Array.from(xmlSiteMap.children).forEach(xmlPage => {
            if (xmlPage.tagName.toLowerCase() === 'pageblock') {
                createPageFromXml(xmlPage);
            }
        });

        // Загрузка страниц
        loadPage();
    } catch (error) {
        return;
    }
}

// Обработчики файлового меню
document.getElementById('saveFile').addEventListener('click', saveFile);
document.getElementById('openFile').addEventListener('click', openFile);



/* ===
 * Свойства страницы
=== */

/* ***
 * handleSelectClick - обработка нажатия на выпадающий список
 * - принимает объект события
 * - закрывает другие списки
 * - открывает или закрывает выбранный список
*** */
function handleSelectClick(event) {
    // Получение заголовка списка
    const value = event.target.closest('.multipleSelectValue');

    if (!value) {
        return;
    }

    // Получение выбранного списка
    const multipleSelect = value.closest('.multipleSelect');

    // Закрытие других списков
    document.querySelectorAll('.multipleSelect.open').forEach(select => {
        if (select !== multipleSelect) {
            select.classList.remove('open');
        }
    });

    multipleSelect.classList.toggle('open');
}

/* ***
 * handleSelectClose - обработка нажатия вне выпадающего списка
 * - принимает объект события
 * - закрывает открытые списки при нажатии снаружи
*** */
function handleSelectClose(event) {
    if (event.target.closest('.multipleSelect')) {
        return;
    }

    // Закрытие открытых списков
    document.querySelectorAll('.multipleSelect.open').forEach(multipleSelect => {
        multipleSelect.classList.remove('open');
    });
}

// Обработчики выпадающих списков
document.getElementById('pageProperties').addEventListener('click', handleSelectClick);
document.addEventListener('mousedown', handleSelectClose);

/* ***
 * loadPageProperties - загрузка свойств страницы
 * - принимает выбранную страницу
 * - записывает свойства страницы в поля
*** */
function loadPageProperties(page) {
    if (!page) {
        return;
    }

    // Загрузка порядка
    const orderField = document.querySelector('#pageProperties [data-property="order"] select');
    const siteMap = document.getElementById('siteMap');
    const connections = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]'));
    const connection = connections.find(connection =>
        connection.dataset.to === page.dataset.id
    );
    const allPages = Array.from(siteMap.querySelectorAll(':scope > pageBlock'));
    const pages = connection
        ? connections.filter(item => item.dataset.from === connection.dataset.from)
            .sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order))
            .map(item => allPages.find(page => page.dataset.id === item.dataset.to)).filter(Boolean)
        : allPages.filter(page => !connections.some(item => item.dataset.to === page.dataset.id));

    orderField.innerHTML = '';

    pages.forEach((page, index) => {
        const option = document.createElement('option');

        option.value = index + 1;
        option.textContent = index + 1;
        orderField.appendChild(option);
    });

    // Загрузка обычных свойств
    document.querySelectorAll('#pageProperties [data-property]').forEach(property => {
        const name = property.dataset.property;

        if (name === 'types' || name === 'access' || name === 'position') {
            return;
        }

        const field = property.querySelector('input, textarea, select');

        if (field) {
            field.value = page.dataset[name] || '';
        }
    });

    // Загрузка позиции
    const position = page.dataset.position.split(',');
    const positionX = document.querySelector('#pageProperties [data-position="x"]');
    const positionY = document.querySelector('#pageProperties [data-position="y"]');

    positionX.value = position[0] || '';
    positionY.value = position[1] || '';

    // Загрузка типов
    const types = page.dataset.types.split(',').filter(Boolean);
    const typesProperty = document.querySelector('#pageProperties [data-property="types"]');

    typesProperty.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = types.includes(checkbox.value);
    });

    // Отображение выбранных типов
    const typesValue = typesProperty.querySelector('.multipleSelectValue');

    typesValue.textContent = types.length ? types.join(', ') : 'Выберите типы';

    // Загрузка доступа
    const access = page.dataset.access.split(',').filter(Boolean);
    const accessProperty = document.querySelector('#pageProperties [data-property="access"]');

    accessProperty.querySelectorAll('.accessItem').forEach(item => {
        // Получение имени и уровня доступа
        const name = item.dataset.access;
        const select = item.querySelector('select');
        const accessItem = access.find(value => value.startsWith(name + ':'));

        if (accessItem) {
            select.value = accessItem.split(':')[1];
        }
    });
}

/* ***
 * updatePageProperty - изменение свойства страницы
 * - принимает измененное поле
 * - определяет свойство
 * - сохраняет значение в выбранную страницу
*** */
function updatePageProperty(field) {
    if (!pageState.selectedPage) {
        return;
    }

    // Получение свойства
    const property = field.closest('[data-property]');

    if (!property) {
        return;
    }

    const name = property.dataset.property;

    // Изменение типов
    if (name === 'types') {
        const types = [];

        property.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            types.push(checkbox.value);
        });

        pageState.selectedPage.dataset.types = types.join(',');

        // Обновление названия списка
        const value = property.querySelector('.multipleSelectValue');

        value.textContent = types.length ? types.join(', ') : 'Выберите типы';

        return;
    }

    // Изменение доступа
    if (name === 'access') {
        const access = [];

        property.querySelectorAll('.accessItem').forEach(item => {
            const accessName = item.dataset.access;
            const accessValue = item.querySelector('select').value;

            access.push(accessName + ':' + accessValue);
        });

        pageState.selectedPage.dataset.access = access.join(',');

        return;
    }

    // Изменение позиции
    if (name === 'position') {
        const positionX = property.querySelector('[data-position="x"]').value;
        const positionY = property.querySelector('[data-position="y"]').value;

        setPagePosition(
            pageState.selectedPage,
            Number(positionX),
            Number(positionY)
        );

        updatePageArrows(pageState.selectedPage);

        return;
    }

    // Изменение порядка
    if (name === 'order') {
        // Получение связи и списка страниц
        const siteMap = document.getElementById('siteMap');
        const connections = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]'));
        const connection = connections.find(connection =>
            connection.dataset.to === pageState.selectedPage.dataset.id
        );
        const parentId = connection ? connection.dataset.from : null;
        const childIds = new Set(connections.map(connection => connection.dataset.to));
        const allPages = Array.from(siteMap.querySelectorAll(':scope > pageBlock'));
        const pages = connection
            ? connections.filter(item => item.dataset.from === connection.dataset.from)
                .sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order))
                .map(item => allPages.find(page => page.dataset.id === item.dataset.to)).filter(Boolean)
            : allPages.filter(page => !childIds.has(page.dataset.id));

        const oldOrder = Number(pageState.selectedPage.dataset.order);
        const newOrder = Math.max(1, Math.min(Number(field.value), pages.length));

        pages.forEach(page => {
            if (page === pageState.selectedPage) return;

            const order = Number(page.dataset.order);

            if (newOrder < oldOrder && order >= newOrder && order < oldOrder) {
                page.dataset.order = order + 1;
            } else if (newOrder > oldOrder && order > oldOrder && order <= newOrder) {
                page.dataset.order = order - 1;
            }
        });

        pageState.selectedPage.dataset.order = newOrder;

        pages.forEach(page => {
            const pageConnection = connections.find(connection =>
                connection.dataset.from === parentId &&
                connection.dataset.to === page.dataset.id
            );

            if (pageConnection) {
                pageConnection.dataset.order = Number(page.dataset.order) - 1;
            }
        });

        updatePagePoints(pageState.selectedPage);
        loadPageProperties(pageState.selectedPage);

        return;
    }

    // Изменение обычного свойства
    pageState.selectedPage.dataset[name] = field.value;

    // Обновление названия страницы
    if (name === 'title') {
        const pageText = pageState.selectedPage.querySelector(':scope > pageText');

        if (pageText) {
            pageText.textContent = field.value;
        }
    }
}

/* ***
 * handlePropertyChange - обработка изменения свойства
 * - принимает объект события
 * - изменяет свойство выбранной страницы
*** */
function handlePropertyChange(event) {
    const field = event.target.closest('input, textarea, select');

    if (!field) {
        return;
    }

    updatePageProperty(field);
}

// Обработчик изменения свойств страницы
document.getElementById('pageProperties').addEventListener('input', handlePropertyChange);
document.getElementById('pageProperties').addEventListener('change', handlePropertyChange);



/* ===
 * Настройки сетки
=== */

// Поле размера сетки
const gridSizeValue = document.getElementById('gridSizeValue');

// Ползунок размера сетки
const gridSize = document.getElementById('gridSize');

/* ***
 * updateGridSize - обновление размера сетки
 * - принимает размер сетки
 * - изменяет размер и отображение фоновой сетки
*** */
function updateGridSize(size) {
    const siteMap = document.getElementById('siteMap');

    siteMap.style.backgroundSize = size + 'px ' + size + 'px';
    siteMap.style.backgroundImage = Number(size) === 1 ? 'none' : 'radial-gradient(circle at 0 0, #ccc 1px, transparent 1px)';
}

/* ***
 * getGridPosition - получение позиции по сетке
 * - принимает координату
 * - округляет координату по текущему размеру сетки
 * - возвращает координату сетки
*** */
function getGridPosition(position) {
    const size = Number(gridSize.value);

    return Math.round(position / size) * size;
}

// Синхронизация поля с ползунком
gridSizeValue.addEventListener('input', () => {
    gridSize.value = gridSizeValue.value;
    updateGridSize(gridSizeValue.value);
});

// Синхронизация ползунка с полем
gridSize.addEventListener('input', () => {
    gridSizeValue.value = gridSize.value;
    updateGridSize(gridSize.value);
});



/* ===
 * Загрузка и инициализация редактора
=== */

/* ***
 * initSvgIcons - инициализация SVG-иконок
 * - ищет все SVG с атрибутом use
 * - создает элемент <use> с указанным id
 * - применяет цвет и фон, если указаны
*** */
function initSvgIcons() {
    // Поиск всех SVG с атрибутом use
    document.querySelectorAll('svg[use]').forEach(svg => {
        // Получение значений атрибутов
        const id = svg.getAttribute('use');
        const color = svg.getAttribute('use-color');
        const background = svg.getAttribute('use-background');

        // Создание SVG <use> элемента
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', './static/img/icons.svg#' + id);

        // Применение цвета
        if (color) {
            svg.style.color = color;
        } else {
            svg.style.color = '#000000';
        }

        // Применение фона
        if (background) {
            svg.style.background = background;
        } else {
            svg.style.background = '';
        }

        // Вставка иконки в SVG
        svg.appendChild(use);
    });
}

// Обработчик загрузки редактора
document.addEventListener('siteStructureEditor:loaded', initSvgIcons);

// Событие загрузки редактора
document.dispatchEvent(new CustomEvent('siteStructureEditor:loaded'));