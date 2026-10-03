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
    draggedConnectionPoint: null,
    draggedConnection: null,
    connectionPoints: null,
    connectionPointAdded: false,
    offsetX: 0,
    offsetY: 0,

    treeRoot: false,
    connectionPointIndex: -1,
    startX: 0,
    startY: 0,
    isPageDragging: false
};

// Текущий режим карты
let mapView = 'cards';

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
    const allPages = Array.from(siteMap.querySelectorAll('pageBlock'));
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

    updatePageLevels();
}

/* ***
 * updatePageLevels - обновление уровня страниц
 * - удаляет старый класс первого уровня
 * - добавляет firstLevel страницам без родителя
*** */
function updatePageLevels() {
    // Получение страниц и связей
    const siteMap = document.getElementById('siteMap');
    const pages = Array.from(siteMap.querySelectorAll('pageBlock'));
    const connections = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]'));
    const childIds = new Set(connections.map(connection => connection.dataset.to));

    // Обновление первого уровня
    pages.forEach(page => {
        page.classList.toggle('firstLevel', !childIds.has(page.dataset.id));
    });
}

/* ***
 * updateTreeOrders - обновление структуры дерева
 * - обновляет порядок всех страниц по их положению
 * - обновляет порядок связей
 * - синхронизирует родителя связи с деревом
*** */
function updateTreeOrders() {
    const siteMap = document.getElementById('siteMap');
    const connections = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]'));
    const containers = [
        siteMap,
        ...siteMap.querySelectorAll('pageBlockChilds')
    ];

    containers.forEach(container => {
        const parents = Array.from(container.children).filter(element => {
            return element.matches('pageBlockParent');
        });

        // Получение родительской страницы контейнера
        const parentPage = container.matches('pageBlockChilds')
            ? container.parentElement.querySelector(':scope > pageBlock')
            : null;

        parents.forEach((parent, index) => {
            const page = parent.querySelector(':scope > pageBlock');
            const connection = connections.find(connection => {
                return connection.dataset.to === page.dataset.id;
            });

            // Обновление порядка страницы
            page.dataset.order = index + 1;

            // Обновление связи
            if (connection) {
                connection.dataset.order = index;

                if (parentPage) {
                    connection.dataset.from = parentPage.dataset.id;
                }
            }
        });
    });

    if (pageState.selectedPage) {
        loadPageProperties(pageState.selectedPage);
    }

    updatePageLevels();
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
 * - выбирает страницу
 * - начинает перемещение карточки или элемента дерева
*** */
function handlePageDown(event) {
    if (event.target.closest('connectionPoint')) return;
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

    if (mapView === 'tree') {
        const parent = page.parentElement;

        pageState.treeRoot = parent.parentElement.id === 'siteMap';
        pageState.startX = event.clientX;
        pageState.startY = event.clientY;
        pageState.isPageDragging = false;

        event.preventDefault();
        return;
    }

    if (mapView === 'tree') {
        event.preventDefault();
        return;
    }

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
    if (mapView === 'tree') {
        moveTreePage(event);
        return;
    }

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
 * getTreePage - получение страницы под курсором
 * - исключает перемещаемую ветку
 * - возвращает страницу только под курсором
*** */
function getTreePage(event) {
    const draggedParent = pageState.draggedPage.parentElement;
    const pages = Array.from(document.querySelectorAll('#siteMap pageBlock'));

    return pages.find(page => {
        if (draggedParent.contains(page)) {
            return false;
        }

        const rect = page.getBoundingClientRect();

        return event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;
    }) || null;
}

/* ***
 * setTreeParent - перенос страницы к новому родителю
 * - создаёт контейнер детей
 * - изменяет связь страницы
 * - переносит страницу
*** */
function setTreeParent(page, targetPage) {
    if (hasPageChild(page.dataset.id, targetPage.dataset.id)) {
        return;
    }

    const siteMap = document.getElementById('siteMap');
    const pageParent = page.parentElement;
    const targetParent = targetPage.parentElement;
    let childs = targetParent.querySelector(':scope > pageBlockChilds');

    // Создание контейнера детей
    if (!childs) {
        childs = document.createElement('pageBlockChilds');
        targetParent.appendChild(childs);
    }

    // Получение связи страницы
    let connection = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]')).find(connection => {
        return connection.dataset.to === page.dataset.id;
    });

    // Создание связи
    if (!connection) {
        connection = document.createElement('pageConnection');
        connection.dataset.kind = 'parent';
        connection.dataset.to = page.dataset.id;
        connection.dataset.fromSide = 'bottom';
        connection.dataset.toSide = 'top';
        siteMap.appendChild(connection);
    }

    // Изменение родителя
    connection.dataset.from = targetPage.dataset.id;

    // Перенос страницы
    childs.appendChild(pageParent);
}

/* ***
 * moveTreePage - перемещение страницы в дереве
 * - меняет порядок страниц
 * - позволяет переходить между уровнями
 * - для первого уровня сразу позволяет перенос к детям
 * - для остальных уровней переносит к детям после 75% ширины
*** */
function moveTreePage(event) {
    const page = pageState.draggedPage;

    if (!page) return;

    const distanceX = Math.abs(event.clientX - pageState.startX);
    const distanceY = Math.abs(event.clientY - pageState.startY);

    // Начало перемещения только после движения мыши
    if (!pageState.isPageDragging) {
        if (distanceX < 5 && distanceY < 5) {
            return;
        }

        pageState.isPageDragging = true;
    }

    const parent = page.parentElement;
    const targetPage = getTreePage(event);

    if (!targetPage) return;

    const targetParent = targetPage.parentElement;
    const targetContainer = targetParent.parentElement;
    const targetRect = targetPage.getBoundingClientRect();

    // Перенос в начало детей страницы
    const targetChilds = targetParent.querySelector(':scope > pageBlockChilds');
    const childX = targetRect.left + targetRect.width * 0.75;
    const isTargetRoot = targetContainer.id === 'siteMap';
    const isChildArea = isTargetRoot || event.clientX > childX;

    if (targetChilds && isChildArea) {
        setTreeParent(page, targetPage);

        const pageParent = page.parentElement;
        const childs = Array.from(targetChilds.querySelectorAll(':scope > pageBlockParent'))
            .filter(child => child !== pageParent);

        // Если курсор правее всех существующих блоков - перенос в начало
        if (childs.length && childs.every(child => {
            return event.clientX > child.getBoundingClientRect().right;
        })) {
            targetChilds.insertBefore(pageParent, childs[0]);
        // Если курсор левее всех существующих блоков - перенос в конец
        } else if (childs.length && childs.every(child => {
            return event.clientX < child.getBoundingClientRect().left;
        })) {
            targetChilds.appendChild(pageParent);
        }

        return;
    }

    if (!targetChilds && isChildArea) {
        setTreeParent(page, targetPage);
        return;
    }

    // Первый уровень доступен только для страницы, которая уже была на первом уровне
    if (targetContainer.id === 'siteMap' && !pageState.treeRoot) {
        return;
    }

    if (!targetContainer.matches('pageBlockChilds, #siteMap')) {
        return;
    }

    // Перемещение перед или после страницы
    const middleY = targetRect.top + targetRect.height / 2;
    const distance = 5;

    if (event.clientY < middleY - distance) {
        targetContainer.insertBefore(parent, targetParent);
    } else if (event.clientY > middleY + distance) {
        targetContainer.insertBefore(parent, targetParent.nextSibling);
    }
}

/* ***
 * handlePageUp - завершение перемещения страницы
 * - переносит страницу на первый уровень вне других деревьев
 * - обновляет порядок дерева
 * - завершает перемещение
*** */
function handlePageUp(event) {
    if (!pageState.draggedPage) return;

    if (mapView === 'tree' && !pageState.isPageDragging) {
        pageState.draggedPage = null;
        pageState.treeRoot = false;
        pageState.isPageDragging = false;
        return;
    }

    if (mapView === 'tree') {
        // Новый первый уровень создаётся только после отпускания мыши
        if (isTreeOutside(event)) {
            const siteMap = document.getElementById('siteMap');
            const page = pageState.draggedPage;
            const parent = page.parentElement;

            const connection = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]')).find(connection => {
                return connection.dataset.to === page.dataset.id;
            });

            if (connection) {
                connection.remove();
            }

            siteMap.insertBefore(parent, siteMap.querySelector(':scope > pageConnection'));
        }

        // Удаление сохранённого места после завершения перемещения
        updateTreeOrders();
    }

    pageState.draggedPage = null;
    pageState.treeRoot = false;
    pageState.isPageDragging = false;
}

/* ***
 * isTreeOutside - проверка курсора вне деревьев
 * - проверяет области корневых деревьев
 * - возвращает true, если курсор вне всех деревьев
*** */
function isTreeOutside(event) {
    const siteMap = document.getElementById('siteMap');
    const draggedParent = pageState.draggedPage.parentElement;
    const trees = Array.from(siteMap.children).filter(element => {
        return element.matches('pageBlockParent') && element !== draggedParent;
    });

    return !trees.some(tree => {
        const rect = tree.getBoundingClientRect();

        return event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;
    });
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
    target: null,
    treeParent: null
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
        deletePage();
    } catch (error) {
        return;
    }
}

/* ***
 * pastePage - вставка страницы
 * - получает и проверяет страницу из буфера обмена
 * - устанавливает новый id и положение
 * - в режиме дерева добавляет страницу к выбранному родителю
 * - создаёт контейнер детей, если его ещё нет
 * - создаёт связь с родительской страницей
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
        if (mapView === 'tree') {
            const parent = document.createElement('pageBlockParent');
            const container = getTreeContainer(menuState.treeParent);

            page.style.removeProperty('left');
            page.style.removeProperty('top');

            parent.appendChild(page);

            // Добавление страницы к выбранному родителю
            if (container) {
                const parentPage = menuState.treeParent.querySelector(':scope > pageBlock');
                const connection = document.createElement('pageConnection');

                container.appendChild(parent);

                // Создание связи с родительской страницей
                connection.dataset.kind = 'parent';
                connection.dataset.from = parentPage.dataset.id;
                connection.dataset.to = page.dataset.id;
                connection.dataset.fromSide = 'bottom';
                connection.dataset.toSide = 'top';
                connection.dataset.order = container.querySelectorAll(':scope > pageBlockParent').length - 1;

                siteMap.appendChild(connection);
            } else {
                siteMap.insertBefore(parent, siteMap.querySelector(':scope > pageConnection'));
            }

            updateTreeOrders();
        } else {
            siteMap.insertBefore(page, siteMap.querySelector(':scope > pageConnection'));
            updatePageOrder();
            updatePageArrows();
        }

        selectPage(page);
    } catch (error) {
        return;
    }
}

/***
 * deletePage - удаление выбранного элемента
 * - удаляет выбранную страницу и ее связь
 * - переносит дочерние страницы на уровень удаляемой страницы
 * - обновляет или удаляет связи дочерних страниц
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
    const page = pageState.selectedPage;
    const pageId = page.dataset.id;

    // Получение родительской связи страницы
    const parentConnection = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]')).find(connection => {
        return connection.dataset.to === pageId;
    });
    const parentId = parentConnection ? parentConnection.dataset.from : null;

    // Удаление связи удаляемой страницы
    if (parentConnection) {
        parentConnection.remove();
    }

    // Удаление страницы
    if (mapView === 'tree') {
        const parent = page.parentElement;
        const childs = parent.querySelector(':scope > pageBlockChilds');
        const container = parent.parentElement;

        // Перенос дочерних страниц на уровень удаляемой страницы
        if (childs) {
            Array.from(childs.children).forEach(child => {
                const childPage = child.querySelector(':scope > pageBlock');
                const childConnection = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]')).find(connection => {
                    return connection.dataset.to === childPage.dataset.id;
                });

                // Обновление связи дочерней страницы
                if (childConnection) {
                    if (parentId) {
                        childConnection.dataset.from = parentId;
                        delete childConnection.dataset.points;
                    } else {
                        childConnection.remove();
                    }
                }

                container.insertBefore(child, parent);
            });
        }

        parent.remove();

        // Обновление порядка дерева
        updateTreeOrders();
    } else {
        // Удаление дочерних связей
        siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]').forEach(connection => {
            if (connection.dataset.from === pageId) {
                connection.remove();
            }
        });

        page.remove();

        // Обновление порядка и стрелок
        updatePageOrder(parentId);
        updatePageArrows();
    }

    pageState.selectedPage = null;
}

/* ***
 * createPage - создание страницы
 * - создает страницу в месте открытия меню
 * - в режиме дерева добавляет страницу к выбранному родителю
 * - создаёт контейнер детей, если его ещё нет
 * - создаёт связь с родительской страницей
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
    if (mapView === 'tree') {
        const parent = document.createElement('pageBlockParent');
        const container = getTreeContainer(menuState.treeParent);

        page.style.removeProperty('left');
        page.style.removeProperty('top');

        parent.appendChild(page);

        // Добавление страницы к выбранному родителю
        if (container) {
            const parentPage = menuState.treeParent.querySelector(':scope > pageBlock');
            const connection = document.createElement('pageConnection');

            container.appendChild(parent);

            // Создание связи с родительской страницей
            connection.dataset.kind = 'parent';
            connection.dataset.from = parentPage.dataset.id;
            connection.dataset.to = page.dataset.id;
            connection.dataset.fromSide = 'bottom';
            connection.dataset.toSide = 'top';
            connection.dataset.order = container.querySelectorAll(':scope > pageBlockParent').length - 1;

            siteMap.appendChild(connection);
        } else {
            siteMap.insertBefore(parent, siteMap.querySelector(':scope > pageConnection'));
        }

        updateTreeOrders();
    } else {
        siteMap.insertBefore(page, siteMap.querySelector(':scope > pageConnection'));
        updatePageOrder();
    }

    selectPage(page);
}

/* ***
 * handleContextMenu - обработка правой кнопки мыши
 * - определяет страницу, связь или пустую область
 * - сохраняет выбранного родителя дерева
 * - открывает контекстное меню
*** */
function handleContextMenu(event) {
    // Получение элемента под курсором
    const page = event.target.closest('pageBlock');
    const connection = event.target.closest('pageConnection');

    event.preventDefault();

    // Выбор элемента
    if (page) {
        selectPage(page);
    } else if (connection) {
        selectConnection(connection);
    }

    // Очистка выбранного родителя
    menuState.treeParent = null;

    // Получение выбранного родителя дерева
    if (mapView === 'tree') {
        menuState.treeParent = event.target.closest('pageBlockParent');
    }

    // Открытие контекстного меню
    openContextMenu(event.clientX, event.clientY, page || connection ? 'page' : 'empty');
}

/* ***
 * getTreeContainer - получение контейнера детей страницы
 * - принимает родительский pageBlockParent
 * - получает существующий pageBlockChilds
 * - создаёт pageBlockChilds, если его ещё нет
 * - возвращает контейнер детей
*** */
function getTreeContainer(parent) {
    if (!parent) {
        return null;
    }

    // Получение контейнера детей
    let container = parent.querySelector(':scope > pageBlockChilds');

    // Создание контейнера детей
    if (!container) {
        container = document.createElement('pageBlockChilds');
        parent.appendChild(container);
    }

    return container;
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

        // Получение сохраненных точек стрелки
        const savedPoints = arrow.dataset.points ? JSON.parse(arrow.dataset.points) : null;

        // Изменение начальной и конечной точек стрелки
        if (savedPoints && savedPoints.length >= 2) {
            points = savedPoints;
            points[0] = [startX, startY];
            points[points.length - 1] = [endX, endY];

            if (points.length > 2) {
                if (fromSide === 'top' || fromSide === 'bottom') {
                    points[1][0] = startX;
                } else {
                    points[1][1] = startY;
                }

                if (toSide === 'top' || toSide === 'bottom') {
                    points[points.length - 2][0] = endX;
                } else {
                    points[points.length - 2][1] = endY;
                }
            }

            arrow.dataset.points = JSON.stringify(points);
        }

        // Сохранение точек стрелки
        if (!savedPoints) {
            arrow.dataset.points = JSON.stringify(points);
        }

        // Создание точек изгиба выбранной связи
        if (arrow === pageState.selectedConnection) {
            for (let i = 0; i < points.length - 1; i++) {
                const connectionPoint = document.createElement('connectionPoint');
                connectionPoint.dataset.index = i;
                const pointX = (points[i][0] + points[i + 1][0]) / 2;
                const pointY = (points[i][1] + points[i + 1][1]) / 2;

                connectionPoint.style.left = pointX + 'px';
                connectionPoint.style.top = pointY + 'px';

                arrow.appendChild(connectionPoint);
            }
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

        pageText.innerHTML = '';

        const title = document.createElement('pageTitle');
        const caption = document.createElement('pageCaption');

        title.textContent = page.dataset.title;
        caption.textContent = page.dataset.caption;

        pageText.appendChild(title);
        pageText.appendChild(caption);

        setPagePosition(page, Number(x), Number(y));
    });

    // Обновление текущего вида
    if (mapView === 'tree') {
        loadTreeView();
    } else {
        updatePageArrows();
    }

    // Обновление уровней страниц
    updatePageLevels();
}

// Обработчик загрузки страниц
document.addEventListener('siteStructureEditor:loaded', loadPage);



/* ===
 * Редактирование связей
=== */

/***
 * handleConnectionPointDown - начало перемещения ребра связи
 * - получает выбранную точку ребра
 * - сохраняет точки и индекс ребра
 ***/
function handleConnectionPointDown(event) {
    const point = event.target.closest('connectionPoint');

    if (!point || event.button !== 0) return;

    const connection = point.closest('pageConnection');

    if (!connection) return;

    const points = JSON.parse(connection.dataset.points || '[]');
    const index = Number(point.dataset.index);

    if (points.length < 2 || index < 0 || index >= points.length - 1) return;

    pageState.draggedConnection = connection;
    pageState.connectionPoints = points;
    pageState.connectionPointIndex = index;
    pageState.connectionPointAdded = false;

    event.preventDefault();
    event.stopPropagation();
}

/***
 * handleConnectionPointMove - перемещение ребра связи
 * - перемещает горизонтальное ребро по Y
 * - перемещает вертикальное ребро по X
 * - добавляет дополнительные ребра при перемещении крайних
 * - удаляет дополнительные ребра при возврате к исходному положению
 ***/
function handleConnectionPointMove(event) {
    if (!pageState.draggedConnection) return;

    const siteMap = document.getElementById('siteMap');
    const mapRect = siteMap.getBoundingClientRect();
    const points = pageState.connectionPoints;
    let index = pageState.connectionPointIndex;

    const gridSize = parseInt(document.querySelector('#gridSizeValue').value) || 1;
    const mouseX = event.clientX - mapRect.left + siteMap.scrollLeft;
    const mouseY = event.clientY - mapRect.top + siteMap.scrollTop;

    const point = pageState.connectionPoints[pageState.connectionPointIndex];

    const x = point[0] + Math.round((mouseX - point[0]) / gridSize) * gridSize;
    const y = point[1] + Math.round((mouseY - point[1]) / gridSize) * gridSize;
    const distance = 10;

    // Добавление ребер в начале связи
    if (index === 0) {
        const start = points[0];
        const end = points[1];

        if (start[1] === end[1]) {
            points.splice(1, 0, [start[0], start[1]], [start[0], end[1]]);
        } else {
            points.splice(1, 0, [start[0], start[1]], [end[0], start[1]]);
        }

        index = 2;
        pageState.connectionPointIndex = index;
        pageState.connectionPointAdded = true;
    }

    // Добавление ребер в конце связи
    if (index === points.length - 2) {
        const start = points[index];
        const end = points[index + 1];

        if (start[1] === end[1]) {
            points.splice(index + 1, 0, [end[0], start[1]], [end[0], end[1]]);
        } else {
            points.splice(index + 1, 0, [start[0], end[1]], [end[0], end[1]]);
        }

        pageState.connectionPointAdded = true;
    }

    const start = points[index];
    const end = points[index + 1];

    // Перемещение горизонтального ребра
    if (start[1] === end[1]) {
        start[1] = y;
        end[1] = y;
    // Перемещение вертикального ребра
    } else if (start[0] === end[0]) {
        start[0] = x;
        end[0] = x;
    }

    // Удаление дополнительных ребер в начале связи
    if (!pageState.connectionPointAdded && index === 2 && points.length > 4) {
        const first = points[0];
        const current = points[2];

        if (Math.abs(first[0] - current[0]) <= distance && Math.abs(first[1] - current[1]) > distance ||
            Math.abs(first[1] - current[1]) <= distance && Math.abs(first[0] - current[0]) > distance) {
            points.splice(1, 2);
            index = 0;
            pageState.connectionPointIndex = index;
        }
    }

    // Удаление дополнительных ребер в конце связи
    if (!pageState.connectionPointAdded && index === points.length - 4 && points.length > 4) {
        const last = points[points.length - 1];
        const current = points[points.length - 3];

        if (Math.abs(last[0] - current[0]) <= distance && Math.abs(last[1] - current[1]) > distance ||
            Math.abs(last[1] - current[1]) <= distance && Math.abs(last[0] - current[0]) > distance) {
            points.splice(points.length - 3, 2);
            pageState.connectionPointIndex = points.length - 2;
        }
    }

    pageState.draggedConnection.dataset.points = JSON.stringify(points);

    updatePageArrows();
}

/***
 * handleConnectionPointUp - завершение перемещения ребра связи
 * - удаляет лишние ребра, если они почти совпадают
 * - очищает состояние редактирования
 ***/
function handleConnectionPointUp() {
    if (!pageState.draggedConnection) return;

    const connection = pageState.draggedConnection;
    const points = pageState.connectionPoints;
    const distance = 10;

    // Удаление совпадающих ребер
    for (let i = 0; i < points.length - 3; i++) {
        const firstStart = points[i];
        const firstEnd = points[i + 1];
        const secondStart = points[i + 2];
        const secondEnd = points[i + 3];

        const firstVertical = firstStart[0] === firstEnd[0];
        const secondVertical = secondStart[0] === secondEnd[0];
        const firstHorizontal = firstStart[1] === firstEnd[1];
        const secondHorizontal = secondStart[1] === secondEnd[1];

        if (firstVertical && secondVertical && Math.abs(firstStart[0] - secondStart[0]) <= distance) {
            points.splice(i + 1, 2);
            break;
        }

        if (firstHorizontal && secondHorizontal && Math.abs(firstStart[1] - secondStart[1]) <= distance) {
            points.splice(i + 1, 2);
            break;
        }
    }

    connection.dataset.points = JSON.stringify(points);

    pageState.draggedConnection = null;
    pageState.connectionPoints = null;
    pageState.connectionPointIndex = -1;
    pageState.connectionPointAdded = false;

    updatePageArrows();
}

// Редактирование связей
document.addEventListener('mousedown', handleConnectionPointDown);
document.addEventListener('mousemove', handleConnectionPointMove);
document.addEventListener('mouseup', handleConnectionPointUp);



/* ===
 * Файловое меню
=== */

/* ***
 * updateEditorState - обновление состояния редактора
 * - проверяет наличие открытой вкладки
 * - блокирует карту, если вкладок нет
*** */
function updateEditorState() {
    // Получение карты и выбранной вкладки
    const siteMap = document.getElementById('siteMap');
    const file = document.querySelector('#fileList .fileItem.selected');

    // Блокировка карты
    siteMap.classList.toggle('disabled', !file);
}

// Обновление состояния редактора
updateEditorState();

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

    if (fileMenu.contains(event.target) && !event.target.closest('#fileMenuList > div')) return;

    document.getElementById('fileMenuList').style.display = 'none';
}

// Обработчики файлового меню
document.getElementById('fileMenuIcon').addEventListener('click', toggleFileMenu);
document.addEventListener('click', handleFileMenuClose);

/* ***
 * saveFile - сохранение структуры сайта
 * - получает страницы и связи
 * - сохраняет структуру в XML
*** */
function saveFile() {
    // Получение карты сайта
    const siteMap = document.getElementById('siteMap');

    // Создание XML
    const xmlDocument = document.implementation.createDocument('', 'siteMap');
    const xmlSiteMap = xmlDocument.documentElement;

    // Сохранение страниц
    siteMap.querySelectorAll('pageBlock').forEach(page => {
        xmlSiteMap.appendChild(createPageXml(xmlDocument, page));
    });

    // Сохранение связей
    siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]').forEach(connection => {
        const xmlConnection = xmlDocument.createElement('pageConnection');

        Object.entries(connection.dataset).forEach(([name, value]) => {
            xmlConnection.setAttribute(name, value);
        });

        xmlSiteMap.appendChild(xmlConnection);
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
 * - возвращает XML элемент
*** */
function createPageXml(xmlDocument, page) {
    // Создание страницы
    const xmlPage = xmlDocument.createElement('pageBlock');

    // Сохранение данных страницы
    Object.entries(page.dataset).forEach(([name, value]) => {
        xmlPage.setAttribute(name, value);
    });

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

    reader.addEventListener('load', event => handleFileLoad(event, file.name));
    reader.readAsText(file);
}

/* ***
 * createPageFromXml - создание страницы из XML
 * - создает страницу на карте
*** */
function createPageFromXml(xmlPage) {
    // Получение карты
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
    siteMap.appendChild(page);
}

/* ***
 * handleFileLoad - загрузка структуры из XML
 * - создает новую вкладку
 * - создает страницы
 * - восстанавливает связи
*** */
function handleFileLoad(event, fileName) {
    try {
        // Получение XML
        const parser = new DOMParser();
        const xmlDocument = parser.parseFromString(event.target.result, 'application/xml');
        const xmlSiteMap = xmlDocument.documentElement;

        // Проверка XML
        if (xmlDocument.querySelector('parsererror')) return;

        // Открытие страницы
        openPage(fileName, '');

        const siteMap = document.getElementById('siteMap');

        // Создание страниц
        Array.from(xmlSiteMap.children).forEach(xmlPage => {
            if (xmlPage.tagName.toLowerCase() === 'pageblock') {
                createPageFromXml(xmlPage);
            }
        });

        // Создание связей
        Array.from(xmlSiteMap.children).forEach(xmlConnection => {
            if (xmlConnection.tagName.toLowerCase() === 'pageconnection') {
                const connection = document.createElement('pageConnection');

                Array.from(xmlConnection.attributes).forEach(attribute => {
                    connection.dataset[attribute.name] = attribute.value;
                });

                siteMap.appendChild(connection);
            }
        });

        // Загрузка страниц
        loadPage();
        saveOpenedFile();
    } catch (error) {
        return;
    }
}

// Обработчики файлового меню
document.getElementById('saveFile').addEventListener('click', saveFile);
document.getElementById('openFile').addEventListener('click', openFile);

/* ***
 * saveOpenedFile - сохранение открытой страницы
 * - сохраняет текущее содержимое карты
*** */
function saveOpenedFile() {
    const file = document.querySelector('#fileList .fileItem.selected');

    if (!file) return;

    const openedFile = document.querySelector('#openedFiles > [data-file-id="' + file.dataset.fileId + '"]');

    if (openedFile) {
        openedFile.innerHTML = document.getElementById('siteMap').innerHTML;
    }
}

/* ***
 * openPage - открытие страницы
 * - создает вкладку и контейнер
 * - загружает содержимое страницы
*** */
function openPage(name, content = '') {
    const fileList = document.getElementById('fileList');
    const openedFiles = document.getElementById('openedFiles');
    const siteMap = document.getElementById('siteMap');
    const fileId = getFileId();

    saveOpenedFile();

    fileList.querySelectorAll('.fileItem').forEach(file => file.classList.remove('selected'));

    const file = document.createElement('div');
    const fileName = document.createElement('div');
    const fileClose = document.createElement('div');
    const icon = document.createElement('svg');
    const openedFile = document.createElement('div');

    file.className = 'fileItem selected';
    file.dataset.fileId = fileId;
    fileName.className = 'fileName';
    fileName.textContent = name;
    fileClose.className = 'fileClose';
    fileClose.innerHTML = '<svg class="svgIcon" use="4x5" style="color: rgb(0, 0, 0);"><use href="./static/img/icons.svg#4x5"></use></svg>';

    fileClose.appendChild(icon);
    file.appendChild(fileName);
    file.appendChild(fileClose);
    fileList.appendChild(file);

    openedFile.dataset.fileId = fileId;
    openedFile.innerHTML = content;
    openedFiles.appendChild(openedFile);

    siteMap.innerHTML = content;
    pageState.selectedPage = null;
    pageState.selectedConnection = null;

    updatePageArrows();
    
    // Обновление состояния редактора
    updateEditorState();
}

/* ***
 * getFileId - получение свободного id файла
 * - проверяет существующие открытые файлы
 * - возвращает первый свободный номер
*** */
function getFileId() {
    const files = document.querySelectorAll('#fileList .fileItem');
    let id = 1;

    while (Array.from(files).some(file => file.dataset.fileId === String(id))) {
        id++;
    }

    return id;
}

/* ***
 * selectFile - переключение открытой страницы
 * - сохраняет текущую страницу
 * - загружает выбранную страницу
*** */
function selectFile(file) {
    if (file.classList.contains('selected')) return;

    saveOpenedFile();

    const openedFile = document.querySelector('#openedFiles > [data-file-id="' + file.dataset.fileId + '"]');

    document.querySelectorAll('#fileList .fileItem').forEach(item => item.classList.remove('selected'));
    file.classList.add('selected');

    document.getElementById('siteMap').innerHTML = openedFile ? openedFile.innerHTML : '';

    pageState.selectedPage = null;
    pageState.selectedConnection = null;

    updatePageArrows();
}

/* ***
 * closeFile - закрытие открытой страницы
 * - удаляет вкладку и контейнер
 * - переключает на соседнюю страницу
*** */
function closeFile(file) {
    const isSelected = file.classList.contains('selected');
    const fileId = file.dataset.fileId;
    const nextFile = file.nextElementSibling || file.previousElementSibling;
    const openedFile = document.querySelector('#openedFiles > [data-file-id="' + fileId + '"]');

    if (isSelected) {
        saveOpenedFile();
    }

    file.remove();

    if (openedFile) {
        openedFile.remove();
    }

    if (isSelected) {
        if (nextFile) {
            selectFile(nextFile);
        } else {
            document.getElementById('siteMap').innerHTML = '';
            pageState.selectedPage = null;
            pageState.selectedConnection = null;
        }
    }

    // Обновление состояния редактора
    updateEditorState();
}

/* ***
 * handleFileListClick - обработка вкладок
 * - закрывает или переключает страницу
*** */
function handleFileListClick(event) {
    const file = event.target.closest('.fileItem');

    if (!file) return;

    if (event.target.closest('.fileClose')) {
        closeFile(file);
        return;
    }

    selectFile(file);
}

/* ***
 * newFile - создание новой страницы
 * - открывает пустую страницу
*** */
function newFile() {
    openPage('Новый', '');
}

document.getElementById('fileList').addEventListener('click', handleFileListClick);
document.getElementById('newFile').addEventListener('click', newFile);



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
    const allPages = Array.from(siteMap.querySelectorAll('pageBlock'));
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
        const allPages = Array.from(siteMap.querySelectorAll('pageBlock'));
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



/* ===
 * История изменений
=== */

// Состояние истории
const historyState = {
    items: [],
    index: -1,
    content: new Map(),
    keys: new Set(),
    observer: null,
    timer: null,
    isApplying: false,
    maxItems: 100
};

/* ***
 * getHistoryKey - получение ключа элемента
 * - принимает элемент карты
 * - возвращает уникальный ключ
*** */
function getHistoryKey(element) {
    if (element.matches('pageBlock')) {
        return 'page:' + element.dataset.id;
    }

    if (element.matches('pageConnection')) {
        return 'connection:' + element.dataset.from + ':' + element.dataset.to;
    }

    return null;
}

/* ***
 * getHistoryElement - получение элемента изменения
 * - принимает измененный узел
 * - возвращает страницу или связь
*** */
function getHistoryElement(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
        node = node.parentElement;
    }

    if (!node) {
        return null;
    }

    return node.closest('pageBlock, pageConnection');
}

/* ***
 * getHistoryContent - получение состояния элемента
 * - удаляет служебные элементы
 * - возвращает HTML элемента
*** */
function getHistoryContent(element) {
    if (!element) {
        return null;
    }

    const clone = element.cloneNode(true);

    clone.classList.remove('selected');
    clone.querySelectorAll('pagePoint, connectionPoint, svg').forEach(item => {
        item.remove();
    });

    return clone.outerHTML;
}

/* ***
 * saveHistoryState - сохранение текущего состояния
 * - сохраняет страницы и связи
*** */
function saveHistoryState() {
    historyState.content.clear();

    document.querySelectorAll('#siteMap > pageBlock, #siteMap > pageConnection').forEach(element => {
        const key = getHistoryKey(element);

        if (key) {
            historyState.content.set(key, getHistoryContent(element));
        }
    });
}

/* ***
 * addHistoryAction - добавление изменения
 * - принимает массив изменений
 * - не сохраняет пустые изменения
 * - сохраняет максимум 100 действий
*** */
function addHistoryAction(changes) {
    if (historyState.isApplying || changes.length === 0) {
        return;
    }

    historyState.items.splice(historyState.index + 1);
    historyState.items.push({
        changes: changes
    });

    if (historyState.items.length > historyState.maxItems) {
        historyState.items.shift();
    }

    historyState.index = historyState.items.length - 1;
}
/* ***
 * applyHistoryElement - применение состояния элемента
 * - создает, изменяет или удаляет элемент
*** */
function applyHistoryElement(key, value) {
    const siteMap = document.getElementById('siteMap');
    const parts = key.split(':');
    let element = null;

    if (parts[0] === 'page') {
        element = siteMap.querySelector(':scope > pageBlock[data-id="' + parts[1] + '"]');
    }

    if (parts[0] === 'connection') {
        element = siteMap.querySelector(
            ':scope > pageConnection[data-from="' + parts[1] + '"][data-to="' + parts[2] + '"]'
        );
    }

    if (!value) {
        if (element) {
            element.remove();
        }

        return;
    }

    const template = document.createElement('template');

    template.innerHTML = value;

    const newElement = template.content.firstElementChild;

    if (element) {
        element.replaceWith(newElement);
    } else {
        siteMap.appendChild(newElement);
    }
}

/* ***
 * applyHistory - применение истории
 * - применяет все изменения одного действия
 * - восстанавливает старое или новое состояние
*** */
function applyHistory(item, isBack) {
    historyState.isApplying = true;
    historyState.observer.disconnect();

    item.changes.forEach(change => {
        applyHistoryElement(
            change.key,
            isBack ? change.oldValue : change.newValue
        );
    });

    pageState.selectedPage = null;
    pageState.selectedConnection = null;

    updatePageArrows();
    saveOpenedFile();
    saveHistoryState();

    historyState.observer.observe(document.getElementById('siteMap'), {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
    });

    historyState.isApplying = false;
}

/* ***
 * handleHistoryChange - обработка изменений карты
 * - получает измененные страницы и связи
 * - объединяет их в одно действие истории
 * - сохраняет только реальные изменения
*** */
function handleHistoryChange(mutations) {
    if (historyState.isApplying) {
        return;
    }

    mutations.forEach(mutation => {
        const element = getHistoryElement(mutation.target);

        if (element) {
            const key = getHistoryKey(element);

            if (key) {
                historyState.keys.add(key);
            }
        }

        mutation.addedNodes.forEach(node => {
            const element = getHistoryElement(node);

            if (element) {
                const key = getHistoryKey(element);

                if (key) {
                    historyState.keys.add(key);
                }
            }
        });

        mutation.removedNodes.forEach(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) {
                return;
            }

            const key = getHistoryKey(node);

            if (key) {
                historyState.keys.add(key);
            }
        });
    });

    clearTimeout(historyState.timer);

    historyState.timer = setTimeout(() => {
        const changes = [];

        historyState.keys.forEach(key => {
            const parts = key.split(':');
            let element = null;

            if (parts[0] === 'page') {
                element = document.querySelector(
                    '#siteMap > pageBlock[data-id="' + parts[1] + '"]'
                );
            }

            if (parts[0] === 'connection') {
                element = document.querySelector(
                    '#siteMap > pageConnection[data-from="' + parts[1] + '"][data-to="' + parts[2] + '"]'
                );
            }

            const oldValue = historyState.content.get(key) || null;
            const newValue = getHistoryContent(element);

            if (oldValue === newValue) {
                return;
            }

            changes.push({
                key: key,
                oldValue: oldValue,
                newValue: newValue
            });

            if (newValue) {
                historyState.content.set(key, newValue);
            } else {
                historyState.content.delete(key);
            }
        });

        historyState.keys.clear();

        addHistoryAction(changes);
    }, 100);
}

/* ***
 * handleHistoryBack - отмена изменения
 * - восстанавливает предыдущее состояние
*** */
function handleHistoryBack() {
    if (historyState.index < 0) {
        return;
    }

    applyHistory(historyState.items[historyState.index], true);
    historyState.index--;
}

/* ***
 * handleHistoryForward - повтор изменения
 * - восстанавливает следующее состояние
*** */
function handleHistoryForward() {
    if (historyState.index >= historyState.items.length - 1) {
        return;
    }

    historyState.index++;
    applyHistory(historyState.items[historyState.index], false);
}

/* ***
 * initHistory - инициализация истории
 * - сохраняет начальное состояние
 * - запускает наблюдение за картой
*** */
function initHistory() {
    saveHistoryState();

    historyState.observer = new MutationObserver(handleHistoryChange);

    historyState.observer.observe(document.getElementById('siteMap'), {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
    });
}

// Обработчики истории
document.getElementById('historyBack').addEventListener('click', handleHistoryBack);
document.getElementById('historyForward').addEventListener('click', handleHistoryForward);

initHistory();



/* ===
 * Перемещение вкладок
=== */

// Состояние перемещения вкладки
const fileDragState = {
    file: null
};

/* ***
 * handleFileDragStart - начало перемещения вкладки
 * - получает выбранную вкладку
 * - сохраняет перемещаемую вкладку
*** */
function handleFileDragStart(event) {
    const file = event.target.closest('.fileItem');

    if (!file || event.target.closest('.fileClose')) {
        return;
    }

    fileDragState.file = file;
    file.setAttribute('draggable', 'true');
}

/* ***
 * handleFileDragOver - перемещение вкладки
 * - получает вкладку под курсором
 * - меняет порядок вкладок
*** */
function handleFileDragOver(event) {
    if (!fileDragState.file) {
        return;
    }

    const file = event.target.closest('.fileItem');

    if (!file || file === fileDragState.file) {
        return;
    }

    event.preventDefault();

    const rect = file.getBoundingClientRect();
    const middle = rect.left + rect.width / 2;

    if (event.clientX < middle) {
        file.parentElement.insertBefore(fileDragState.file, file);
    } else {
        file.parentElement.insertBefore(fileDragState.file, file.nextElementSibling);
    }
}

/* ***
 * handleFileDragEnd - завершение перемещения вкладки
 * - отключает перемещение
 * - очищает состояние
*** */
function handleFileDragEnd() {
    if (!fileDragState.file) {
        return;
    }

    fileDragState.file.removeAttribute('draggable');
    fileDragState.file = null;
}

// Обработчики перемещения вкладок
document.getElementById('fileList').addEventListener('mousedown', handleFileDragStart);
document.getElementById('fileList').addEventListener('dragover', handleFileDragOver);
document.getElementById('fileList').addEventListener('dragend', handleFileDragEnd);



/* ===
 * Вид карты
=== */

// Элементы доступные только в режиме карточек
const cardViewElements = [
    document.getElementById('gridSettings'),
    document.querySelector('#pageProperties [data-property="position"]'),
    document.querySelector('#pageProperties [data-property="view"]')
];

/* ***
 * updateMapView - обновление вида карты
 * - получает выбранный режим
 * - скрывает элементы недоступные в режиме дерева
 * - загружает выбранный вид карты
*** */
function updateMapView() {
    const viewType = document.getElementById('viewType');

    mapView = viewType.value;

    cardViewElements.forEach(element => {
        element.style.display = mapView === 'cards' ? '' : 'none';
    });

    if (mapView === 'cards') {
        loadCardsView();
    } else {
        loadTreeView();
    }
}

// Обработчик изменения вида
document.getElementById('viewType').addEventListener('change', updateMapView);
updateMapView();

/* ***
 * loadCardsView - отображение структуры карточками
 * - удаляет структуру дерева
 * - включает режим карточек
 * - обновляет стрелки
*** */
function loadCardsView() {
    const siteMap = document.getElementById('siteMap');

    // Восстановление положения страниц
    siteMap.querySelectorAll('pageBlock').forEach(page => {
        const [x, y] = page.dataset.position.split(',');

        page.style.left = x + 'px';
        page.style.top = y + 'px';
    });

    // Удаление структуры дерева
    deleteTreeView();

    // Переключение режима
    siteMap.classList.remove('treeView');
    siteMap.classList.add('cardsView');

    // Обновление стрелок
    updatePageArrows();
}

/* ***
 * loadTreeView - отображение структуры деревом
 * - включает режим дерева
 * - создаёт иерархию страниц
*** */
function loadTreeView() {
    const siteMap = document.getElementById('siteMap');

    // Переключение режима
    siteMap.classList.remove('cardsView');
    siteMap.classList.add('treeView');

    // Удаление положения страниц
    siteMap.querySelectorAll('pageBlock').forEach(page => {
        page.style.removeProperty('left');
        page.style.removeProperty('top');
    });

    // Создание структуры дерева
    createTreeView();
}

/* ***
 * createTreeView - создание иерархии дерева
 * - получает страницы и связи
 * - определяет корневые страницы
 * - создаёт pageBlockParent для каждой страницы
 * - помещает дочерние страницы в pageBlockChilds
*** */
function createTreeView() {
    // Получение карты, страниц и связей
    const siteMap = document.getElementById('siteMap');
    const pages = Array.from(siteMap.querySelectorAll(':scope > pageBlock'));
    const connections = Array.from(siteMap.querySelectorAll(':scope > pageConnection[data-kind="parent"]'));
    const childIds = new Set(connections.map(connection => connection.dataset.to));

    // Создание родительского блока страницы
    function createParent(page) {
        const parent = document.createElement('pageBlockParent');
        const childs = document.createElement('pageBlockChilds');

        // Добавление текущей страницы
        parent.appendChild(page);

        // Получение и добавление дочерних страниц
        connections
            .filter(connection => connection.dataset.from === page.dataset.id)
            .sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order))
            .forEach(connection => {
                const child = pages.find(page => page.dataset.id === connection.dataset.to);

                if (child) {
                    childs.appendChild(createParent(child));
                }
            });

        // Добавление контейнера детей
        if (childs.children.length) {
            parent.appendChild(childs);
        }

        return parent;
    }

    // Создание дерева от корневых страниц
    pages
        .filter(page => !childIds.has(page.dataset.id))
        .sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order))
        .forEach(page => {
            siteMap.appendChild(createParent(page));
        });
}

/* ***
 * deleteTreeView - удаление иерархии дерева
 * - получает все страницы из дерева
 * - удаляет pageBlockParent и pageBlockChilds
 * - возвращает страницы напрямую в карту
*** */
function deleteTreeView() {
    // Получение карты и корневых блоков дерева
    const siteMap = document.getElementById('siteMap');
    const parents = Array.from(siteMap.querySelectorAll(':scope > pageBlockParent'));
    const pages = [];

    // Получение всех страниц дерева
    parents.forEach(parent => {
        parent.querySelectorAll('pageBlock').forEach(page => {
            pages.push(page);
        });

        parent.remove();
    });

    // Возвращение страниц в карту
    pages.forEach(page => {
        siteMap.insertBefore(page, siteMap.querySelector(':scope > pageConnection'));
    });
}