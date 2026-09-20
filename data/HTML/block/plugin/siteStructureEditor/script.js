/* ===
 * Выбор и перемещение страницы
=== */

// Состояние перемещения страницы
const pageState = {
    selectedPage: null,
    draggedPage: null,
    linkedPage: null,
    linkedPoint: null,
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
 * updatePagePoints - обновление точек страницы
 * - удаляет старые точки
 * - добавляет точки выбранной странице
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
    const arrow = document.createElement('pageArrow');
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

    if (!point || event.button !== 0) return;

    // Сохранение исходной страницы и точки
    pageState.linkedPage = point.closest('pageBlock');
    pageState.linkedPoint = point;

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
        console.log('targetPage', targetPage);
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
    if (targetPage && targetPage !== pageState.linkedPage) {
        const childId = targetPage.dataset.id;
        const children = pageState.linkedPage.dataset.children.split(',').filter(Boolean);

        if (!children.includes(childId)) {
            children.push(childId);
            pageState.linkedPage.dataset.children = children.join(',');
        }
    }

    // Удаление временной стрелки
    pageState.tempArrow.remove();
    pageState.tempArrow = null;

    // Обновление стрелок и точек
    updatePageArrows(pageState.linkedPage);
    selectPage(pageState.linkedPage);

    pageState.linkedPage = null;
    pageState.linkedPoint = null;
    pageState.targetPage = null;
}

/* ***
 * selectPage - выбор страницы
 * - принимает элемент страницы
 * - снимает выделение с предыдущей страницы
 * - выделяет выбранную страницу
*** */
function selectPage(page) {
    if (pageState.selectedPage) {
        pageState.selectedPage.classList.remove('selected');
    }

    pageState.selectedPage = page;

    if (pageState.selectedPage) {
        pageState.selectedPage.classList.add('selected');
    }

    updatePagePoints(page);
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

    const pageX = event.clientX - mapRect.left + siteMap.scrollLeft - pageState.offsetX;
    const pageY = event.clientY - mapRect.top + siteMap.scrollTop - pageState.offsetY;

    pageState.draggedPage.style.left = pageX + 'px';
    pageState.draggedPage.style.top = pageY + 'px';

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
        action.style.display = action.dataset.target === target ? '' : 'none';
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
        pageState.selectedPage.remove();
        pageState.selectedPage = null;
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

        // Получение карты сайта
        const siteMap = document.getElementById('siteMap');
        const mapRect = siteMap.getBoundingClientRect();

        // Вычисление положения страницы
        const pageX = menuState.x - mapRect.left + siteMap.scrollLeft;
        const pageY = menuState.y - mapRect.top + siteMap.scrollTop;

        // Установка положения страницы
        page.style.left = pageX + 'px';
        page.style.top = pageY + 'px';

        // Добавление страницы
        siteMap.appendChild(page);
        selectPage(page);
    } catch (error) {
        return;
    }
}

/* ***
 * deletePage - удаление страницы
 * - удаляет выбранную страницу
 * - очищает выбранный элемент
*** */
function deletePage() {
    if (!pageState.selectedPage) return;

    pageState.selectedPage.remove();
    pageState.selectedPage = null;
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
    const pageX = Math.round((menuState.x - mapRect.left + siteMap.scrollLeft) / 10) * 10;
    const pageY = Math.round((menuState.y - mapRect.top + siteMap.scrollTop) / 10) * 10;

    // Создание страницы
    const page = document.createElement('pageBlock');

    page.dataset.id = getPageId();
    page.dataset.name = 'Новая страница';
    page.dataset.path = '/newPage';
    page.dataset.children = '';
    page.dataset.position = pageX + ',' + pageY;
    page.textContent = page.dataset.name;
    page.style.left = pageX + 'px';
    page.style.top = pageY + 'px';

    // Добавление страницы
    siteMap.appendChild(page);
    selectPage(page);
}

/* ***
 * handleContextMenu - обработка правой кнопки мыши
 * - определяет страницу или пустую область
 * - выбирает страницу
 * - открывает контекстное меню
*** */
function handleContextMenu(event) {
    // Получение страницы под курсором
    const page = event.target.closest('pageBlock');

    event.preventDefault();

    if (page) selectPage(page);

    // Открытие контекстного меню
    openContextMenu(event.clientX, event.clientY, page ? 'page' : 'empty');
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

/* ***
 * updatePageArrows - обновление стрелок страниц
 * - принимает страницу или null
 * - выбирает ближайшие стороны страниц
 * - строит стрелки со скругленными поворотами
*** */
function updatePageArrows(page = null) {
    // Получение карты и страниц
    const siteMap = document.getElementById('siteMap');
    const pages = siteMap.querySelectorAll('pageBlock');

    // Получение связей для обновления
    const connections = [];

    pages.forEach(parent => {
        const children = parent.dataset.children.split(',').filter(Boolean);

        children.forEach(id => {
            const child = Array.from(pages).find(item => item.dataset.id === id);

            if (!child || page && parent !== page && child !== page) return;

            connections.push({ parent, child });
        });
    });

    // Удаление обновляемых стрелок
    siteMap.querySelectorAll('pageArrow').forEach(arrow => {
        if (!page || connections.some(connection => arrow.dataset.parent === connection.parent.dataset.id && arrow.dataset.child === connection.child.dataset.id)) {
            arrow.remove();
        }
    });

    // Создание стрелок
    connections.forEach(connection => {
        const parent = connection.parent;
        const child = connection.child;

        // Получение центров страниц
        const parentX = parent.offsetLeft + parent.offsetWidth / 2;
        const parentY = parent.offsetTop + parent.offsetHeight / 2;
        const childX = child.offsetLeft + child.offsetWidth / 2;
        const childY = child.offsetTop + child.offsetHeight / 2;

        // Определение ближайших сторон
        const distanceX = childX - parentX;
        const distanceY = childY - parentY;

        let startX;
        let startY;
        let endX;
        let endY;
        let points;

        // Страница снизу
        if (distanceY > 0) {
            // Проверка возможности выхода вниз
            const parentBottom = parent.offsetTop + parent.offsetHeight;
            const spaceY = child.offsetTop - parentBottom;

            if (spaceY >= 10) {
                // Выход снизу
                startX = parentX;
                startY = parentBottom;
                endX = childX;
                endY = child.offsetTop;

                const middleY = (startY + endY) / 2;

                points = [
                    [startX, startY],
                    [startX, middleY],
                    [endX, middleY],
                    [endX, endY]
                ];
            } else {
                // Выход сбоку родителя
                const isRight = childX > parentX;

                startX = isRight ? parent.offsetLeft + parent.offsetWidth : parent.offsetLeft;
                startY = parentY;
                endX = isRight ? child.offsetLeft : child.offsetLeft + child.offsetWidth;
                endY = childY;

                const middleX = (startX + endX) / 2;

                points = [
                    [startX, startY],
                    [middleX, startY],
                    [middleX, endY],
                    [endX, endY]
                ];
            }
        } else if (Math.abs(distanceY) > Math.abs(distanceX)) {
            startX = parentX;
            startY = parent.offsetTop;
            endX = childX;
            endY = child.offsetTop + child.offsetHeight;

            const middleY = (startY + endY) / 2;

            points = [
                [startX, startY],
                [startX, middleY],
                [endX, middleY],
                [endX, endY]
            ];
        // Страница сбоку
        } else {
            startX = distanceX > 0 ? parent.offsetLeft + parent.offsetWidth : parent.offsetLeft;
            startY = parentY;
            endX = distanceX > 0 ? child.offsetLeft : child.offsetLeft + child.offsetWidth;
            endY = childY;

            const middleX = (startX + endX) / 2;

            points = [
                [startX, startY],
                [middleX, startY],
                [middleX, endY],
                [endX, endY]
            ];
        }

        // Создание стрелки
        const arrow = document.createElement('pageArrow');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        marker.setAttribute('id', 'pageArrowHead');
        marker.setAttribute('markerUnits', 'userSpaceOnUse');
        marker.setAttribute('markerWidth', '11');
        marker.setAttribute('markerHeight', '10');
        marker.setAttribute('refX', '10');
        marker.setAttribute('refY', '5');
        marker.setAttribute('orient', 'auto');

        markerPath.setAttribute('d', 'M 1 1 L 10 5 L 1 9');

        marker.appendChild(markerPath);
        svg.appendChild(marker);

        path.setAttribute('marker-end', 'url(#pageArrowHead)');

        arrow.dataset.parent = parent.dataset.id;
        arrow.dataset.child = child.dataset.id;

        // Создание скругленного пути
        const radius = 10;
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
        siteMap.insertBefore(arrow, parent);
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
        page.textContent = page.dataset.name;
        page.style.left = x + 'px';
        page.style.top = y + 'px';
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
 * - получает данные страниц
 * - сохраняет структуру в JSON
*** */
function saveFile() {
    // Получение страниц
    const pages = document.querySelectorAll('#siteMap pageBlock');

    // Создание данных
    const data = Array.from(pages).map(page => ({
        id: page.dataset.id,
        name: page.dataset.name,
        path: page.dataset.path,
        children: page.dataset.children,
        position: page.style.left.replace('px', '') + ',' + page.style.top.replace('px', '')
    }));

    // Создание файла
    const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'siteStructureEditor.json';
    link.click();

    URL.revokeObjectURL(url);
}

/* ***
 * openFile - открытие структуры сайта
 * - открывает JSON через выбор файла
 * - удаляет текущую структуру
 * - создает страницы и стрелки заново
*** */
function openFile() {
    // Создание выбора файла
    const input = document.createElement('input');

    input.type = 'file';
    input.accept = '.json';

    input.addEventListener('change', handleFileOpen);
    input.click();
}

/* ***
 * handleFileOpen - обработка открытия файла
 * - читает выбранный JSON
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
 * handleFileLoad - загрузка структуры из JSON
 * - удаляет текущую структуру
 * - создает страницы из данных
*** */
function handleFileLoad(event) {
    try {
        // Получение данных
        const data = JSON.parse(event.target.result);
        const siteMap = document.getElementById('siteMap');

        // Очистка карты
        siteMap.innerHTML = '';
        pageState.selectedPage = null;

        // Создание страниц
        data.forEach(item => {
            const page = document.createElement('pageBlock');
            const [x, y] = item.position.split(',');

            page.dataset.id = item.id;
            page.dataset.name = item.name;
            page.dataset.path = item.path;
            page.dataset.children = item.children;
            page.dataset.position = item.position;
            page.textContent = item.name;
            page.style.left = x + 'px';
            page.style.top = y + 'px';

            siteMap.appendChild(page);
        });

        // Создание стрелок
        updatePageArrows();
    } catch (error) {
        return;
    }
}

// Обработчики файлового меню
document.getElementById('saveFile').addEventListener('click', saveFile);
document.getElementById('openFile').addEventListener('click', openFile);



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