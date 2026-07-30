/* ===
 * Модуль структуры дерева
=== */

// Карта связей между элементами из iframe и узлами дерева в панели
const elementToTreeNodeMap = new Map();

// Обратная карта связей между узлами дерева и элементами из iframe
const treeNodeToElementMap = new Map();

// Элемент дерева, выбранный в данный момент
let currentSelectedTreeNode = null;

// Наблюдатель за изменениями структуры DOM в iframe
let iframeDOMObserver = null;

// Перетаскиваемый в данный момент элемент страницы
let draggedElement = null;



/* ===
 * Инициализация и построение дерева
=== */

/* ***
 * initTreeElements - инициализация дерева элементов из iframe
 * - принимает элемент iframe
 * - находит контейнер дерева и очищает его перед построением
 * - рекурсивно строит структуру и запускает слежение за изменениями в iframe
*** */
function initTreeElements(iframeElement) {
    // Контейнер дерева элементов
    const treeContainer = document.getElementById('treeElementsBody');
    
    if (!treeContainer || !iframeElement) {
        return;
    }

    // Безопасное получение окна iframe
    const iframeWindow = iframeElement.contentWindow;

    if (!iframeWindow) {
        return;
    }

    // Документ внутри iframe
    const iframeDoc = iframeElement.contentDocument || iframeWindow.document;

    if (!iframeDoc) {
        return;
    }

    // Корневой элемент тега body в iframe
    const bodyElement = iframeDoc.body;

    // Отключение предыдущего наблюдателя для предотвращения утечек памяти
    if (iframeDOMObserver) {
        iframeDOMObserver.disconnect();
        iframeDOMObserver = null;
    }

    // Очистка карт связей и содержимого контейнера
    elementToTreeNodeMap.clear();
    treeNodeToElementMap.clear();
    treeContainer.innerHTML = '';
    
    if (bodyElement) {
        // Дочерние элементы тега body
        const bodyChildren = Array.from(bodyElement.children);

        // Построение элементов первого уровня для тега body
        for (const child of bodyChildren) {
            buildTreeNode(child, treeContainer);
        }

        // Отслеживание изменений структуры верстки внутри body
        iframeDOMObserver = new MutationObserver(() => {
            // Игнорирование изменений во время процесса перетаскивания
            if (draggedElement) {
                return;
            }

            initTreeElements(iframeElement);
        });

        iframeDOMObserver.observe(bodyElement, {
            childList: true,
            subtree: true
        });
    }

    // Разрешение события перетаскивания на всем контейнере дерева
    treeContainer.addEventListener('dragover', (event) => {
        event.preventDefault();
    });
}

// Экспорт функции в глобальный объект редактора
window.editorBlock.initTreeElements = initTreeElements;



/* ***
 * buildTreeNode - рекурсивное создание узлов дерева
 * - принимает HTML элемент и контейнер для вставки
 * - создает плашку элемента, стрелочку свертывания и контейнер дочерних узлов
*** */
function buildTreeNode(element, container) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return;
    }

    // Название тега в нижнем регистре
    const tagName = element.tagName.toLowerCase();

    // Пропуск служебных тегов
    if (
        tagName === 'script' ||
        tagName === 'style' ||
        tagName === 'link' ||
        tagName === 'meta'
    ) {
        return;
    }

    // Строка элемента в интерфейсе дерева
    const nodeItem = document.createElement('div');
    nodeItem.className = 'treeElementsItem';
    
    // Текст названия тега
    const labelSpan = document.createElement('span');
    labelSpan.textContent = tagName;
    nodeItem.appendChild(labelSpan);

    nodeItem.draggable = true;
    
    // Сохранение двусторонней связи между элементом страницы и узлом дерева
    elementToTreeNodeMap.set(element, nodeItem);
    treeNodeToElementMap.set(nodeItem, element);

    // Назначение обработчиков событий для созданного узла
    attachTreeNodeEvents(nodeItem, element);

    container.appendChild(nodeItem);

    // Список дочерних тегов без служебных элементов
    const children = Array.from(element.children).filter((child) => {
        const tag = child.tagName.toLowerCase();

        return (
            tag !== 'script' &&
            tag !== 'style' &&
            tag !== 'link' &&
            tag !== 'meta'
        );
    });

    // Создание контейнера вложенности и стрелочки при наличии дочерних элементов
    if (children.length > 0) {
        // Контейнер дочерних элементов
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'treeElementsChildren';

        // Элемент стрелочки
        const toggleArrow = document.createElement('span');
        toggleArrow.className = 'treeToggleArrow';
        toggleArrow.innerHTML = '&#9660;';

        // Восстановление сохраненного состояния сворачивания при пересборке
        if (element.__treeCollapsed) {
            childrenContainer.classList.add('collapsed');
            toggleArrow.classList.add('collapsed');
        }

        // Переключение скрыть/открыть по клику на стрелочку
        toggleArrow.addEventListener('click', (event) => {
            event.stopPropagation();
            const isCollapsed = childrenContainer.classList.toggle('collapsed');
            toggleArrow.classList.toggle('collapsed');

            // Запоминаем состояние свёрнутости в самом элементе
            element.__treeCollapsed = isCollapsed;
        });

        nodeItem.appendChild(toggleArrow);

        for (const child of children) {
            buildTreeNode(child, childrenContainer);
        }

        container.appendChild(childrenContainer);
    }
}



/* ===
 * Назначение событий элементов дерева
=== */

/* ***
 * attachTreeNodeEvents - назначение обработчиков событий узлу
 * - принимает элемент дерева и HTML элемент
 * - навешивает события выбора и перетаскивания
 * - рассчитывает положение курсора относительно ширины элемента для изменения вложенности
*** */
function attachTreeNodeEvents(nodeItem, element) {
    // Прозрачный холст для отключения стандартного фантома мыши
    const emptyDragImage = document.createElement('canvas');
    emptyDragImage.width = 0;
    emptyDragImage.height = 0;

    // Выбор элемента при клике мышью
    nodeItem.addEventListener('click', (event) => {
        event.stopPropagation();
        selectElementInIframe(element);
    });

    // Открытие контекстного меню для элемента из iframe
    nodeItem.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();

        selectElementInIframe(element);

        if (window.editorBlock) {
            window.editorBlock.selectedElement = element;
        }

        if (window.editorBlock && typeof window.editorBlock.handleContextMenu === 'function') {
            window.editorBlock.handleContextMenu(event);
        }
    });

    // Начало перетаскивания элемента
    nodeItem.addEventListener('dragstart', (event) => {
        event.stopPropagation();
        draggedElement = element;
        nodeItem.classList.add('dragging');
        nodeItem.classList.add('active');

        if (event.dataTransfer) {
            event.dataTransfer.setDragImage(emptyDragImage, 0, 0);
        }
    });

    // Завершение перетаскивания и сброс состояния
    nodeItem.addEventListener('dragend', () => {
        nodeItem.classList.remove('dragging');
        nodeItem.classList.remove('active');
        draggedElement = null;
    });

    // Перемещение при наведении на плашку элемента
    nodeItem.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!draggedElement || draggedElement === element) {
            return;
        }

        // Защита от вставки родительского элемента внутрь собственного потомка
        if (draggedElement.contains(element)) {
            return;
        }

        // Размеры и позиция узла дерева
        const nodeRect = nodeItem.getBoundingClientRect();

        // Проверка смещения курсора вправо (более 50% ширины) для вставки внутрь в качестве дочернего
        if (event.clientX > nodeRect.left + (nodeRect.width * 0.5)) {
            if (element.lastElementChild !== draggedElement) {
                // Добавление элемента в конец списка детей родителя в iframe
                element.appendChild(draggedElement);

                // Поиск или создание контейнера дочерних элементов в UI
                let childrenContainer = (
                    nodeItem.nextElementSibling &&
                    nodeItem.nextElementSibling.classList.contains('treeElementsChildren')
                ) ? nodeItem.nextElementSibling : null;

                if (!childrenContainer) {
                    childrenContainer = document.createElement('div');
                    childrenContainer.className = 'treeElementsChildren';

                    if (nodeItem.parentNode) {
                        nodeItem.parentNode.insertBefore(childrenContainer, nodeItem.nextSibling);
                    }
                }

                // Добавление стрелочки при появлении первого дочернего элемента
                if (!nodeItem.querySelector('.treeToggleArrow')) {
                    const toggleArrow = document.createElement('span');
                    toggleArrow.className = 'treeToggleArrow';
                    toggleArrow.innerHTML = '&#9660;';

                    toggleArrow.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        const isCollapsed = childrenContainer.classList.toggle('collapsed');
                        toggleArrow.classList.toggle('collapsed');

                        // Запоминаем состояние свёрнутости в самом элементе
                        element.__treeCollapsed = isCollapsed;
                    });

                    nodeItem.appendChild(toggleArrow);
                }

                // Раскрытие списка, если узел был свёрнут при вставке
                if (childrenContainer.classList.contains('collapsed')) {
                    childrenContainer.classList.remove('collapsed');
                    element.__treeCollapsed = false;
                    const arrow = nodeItem.querySelector('.treeToggleArrow');
                    if (arrow) {
                        arrow.classList.remove('collapsed');
                    }
                }

                // Перетаскиваемый узел в UI дерева
                const draggedNode = elementToTreeNodeMap.get(draggedElement);

                if (draggedNode && childrenContainer) {
                    // Дочерний контейнер перетаскиваемого узла
                    const draggedChildren = (
                        draggedNode.nextElementSibling &&
                        draggedNode.nextElementSibling.classList.contains('treeElementsChildren')
                    ) ? draggedNode.nextElementSibling : null;

                    childrenContainer.appendChild(draggedNode);

                    if (draggedChildren) {
                        childrenContainer.appendChild(draggedChildren);
                    }
                }
            }

            return;
        }

        // Текущий проверяемый HTML элемент
        let currentElement = element;

        // Текущий проверяемый узел дерева
        let currentNode = nodeItem;

        // Проверка смещения курсора влево (за левый край элемента) для выхода на уровень родителя
        if (event.clientX < nodeRect.left) {
            if (
                currentElement &&
                currentElement.parentNode &&
                currentElement.parentNode.tagName.toLowerCase() !== 'body'
            ) {
                // Родительский HTML элемент
                const parentEl = currentElement.parentNode;

                // Родительский узел в дереве
                const parentNode = elementToTreeNodeMap.get(parentEl);

                if (parentNode) {
                    currentElement = parentEl;
                    currentNode = parentNode;
                }
            }
        }

        if (!currentElement || !currentElement.parentNode) {
            return;
        }

        // Повторная проверка защиты после изменения целевого элемента
        if (draggedElement.contains(currentElement)) {
            return;
        }

        // Целевой узел дерева для перестановки
        const targetNode = elementToTreeNodeMap.get(currentElement);

        if (!targetNode) {
            return;
        }

        // Перетаскиваемый узел в UI дерева
        const draggedNode = elementToTreeNodeMap.get(draggedElement);

        if (!draggedNode) {
            return;
        }

        // Дополнительная проверка защиты UI узлов от закольцовывания
        if (draggedNode.contains(targetNode) || targetNode.contains(draggedNode)) {
            return;
        }

        // Размеры и позиция целевого узла
        const targetRect = targetNode.getBoundingClientRect();

        // Флаг вставки ниже середины элемента
        const insertAfter = event.clientY > (targetRect.top + targetRect.height / 2);

        // Элемент перед которым выполняется вставка
        const refElement = insertAfter ? currentElement.nextSibling : currentElement;

        // Пропуск выполнения если элемент уже находится на этой позиции
        if (draggedElement === refElement || draggedElement.nextSibling === refElement) {
            return;
        }

        // Строгое перемещение в пределах общего родителя без захвата вложенности чужих детей
        currentElement.parentNode.insertBefore(draggedElement, refElement);

        // Перемещение перетаскиваемого узла дерева
        if (draggedNode !== targetNode) {
            // Родительский контейнер целевого узла
            const parentContainer = targetNode.parentNode;
            
            // Дочерний контейнер перетаскиваемого узла
            const draggedChildren = (
                draggedNode.nextElementSibling &&
                draggedNode.nextElementSibling.classList.contains('treeElementsChildren')
            ) ? draggedNode.nextElementSibling : null;

            // Дочерний контейнер целевого узла
            const targetChildren = (
                targetNode.nextElementSibling &&
                targetNode.nextElementSibling.classList.contains('treeElementsChildren')
            ) ? targetNode.nextElementSibling : null;

            // Ссылка на узел для вставки
            let uiRefNode = targetNode;

            if (insertAfter) {
                uiRefNode = targetChildren ? targetChildren.nextSibling : targetNode.nextSibling;
            }

            // Проверка защиты UI родителя от вставки узла в самого себя
            if (draggedNode !== uiRefNode && !draggedNode.contains(parentContainer)) {
                parentContainer.insertBefore(draggedNode, uiRefNode);

                if (draggedChildren && !draggedChildren.contains(parentContainer)) {
                    parentContainer.insertBefore(draggedChildren, draggedNode.nextSibling);
                }
            }
        }
    });

    // Завершение сброса и сохранение истории
    nodeItem.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (window.editorBlock && typeof window.editorBlock.syncEditors === 'function') {
            window.editorBlock.syncEditors();
        }

        if (window.editorBlock && typeof window.editorBlock.saveHistoryState === 'function') {
            window.editorBlock.saveHistoryState();
        }
    });
}

// Глобальная обработка наведения на область контейнера дочерних элементов
document.addEventListener('dragover', (event) => {
    // Контейнер всего дерева элементов
    const treeContainer = document.getElementById('treeElementsBody');

    if (!treeContainer || !treeContainer.contains(event.target) || !draggedElement) {
        return;
    }

    // Проверка попадания на контейнер детей вне плашки элемента
    const targetElement = event.target;

    // Флаг нахождения курсора строго на плашке элемента
    const isItem = targetElement.classList.contains('treeElementsItem');

    // Контейнер дочерних элементов под курсором
    const childrenContainer = targetElement.closest('.treeElementsChildren');

    if (childrenContainer && !isItem) {
        event.preventDefault();
        event.stopPropagation();

        // Плашка родительского элемента перед контейнером детей
        const parentNodeItem = childrenContainer.previousElementSibling;

        if (!parentNodeItem) {
            return;
        }

        // Родительский HTML элемент
        const parentElement = treeNodeToElementMap.get(parentNodeItem);

        if (!parentElement || !parentElement.parentNode) {
            return;
        }

        // Защита от перемещения родителя в самого себя
        if (draggedElement === parentElement || draggedElement.contains(parentElement)) {
            return;
        }

        // Соседний HTML элемент после родителя
        const refElement = parentElement.nextSibling;

        if (draggedElement === refElement || draggedElement.nextSibling === refElement) {
            return;
        }

        // Перемещение элемента в iframe строго после родительского тега
        parentElement.parentNode.insertBefore(draggedElement, refElement);

        // Перетаскиваемый узел в UI дерева
        const draggedNode = elementToTreeNodeMap.get(draggedElement);

        if (!draggedNode) {
            return;
        }

        // Дочерний контейнер перетаскиваемого узла
        const draggedChildren = (
            draggedNode.nextElementSibling &&
            draggedNode.nextElementSibling.classList.contains('treeElementsChildren')
        ) ? draggedNode.nextElementSibling : null;

        // Позиция вставки в UI строго после контейнера дочерних элементов
        const uiRefNode = childrenContainer.nextSibling;

        if (draggedNode !== uiRefNode && !draggedNode.contains(childrenContainer.parentNode)) {
            childrenContainer.parentNode.insertBefore(draggedNode, uiRefNode);

            if (draggedChildren) {
                childrenContainer.parentNode.insertBefore(draggedChildren, draggedNode.nextSibling);
            }
        }
    }
});



/* ***
 * selectElementInIframe - эмуляция выбора элемента в iframe
 * - принимает HTML элемент
 * - симулирует клик по элементу и отправляет событие изменения выбора
*** */
function selectElementInIframe(element) {
    if (!element) {
        return;
    }

    element.click();

    // Пользовательское событие выбора элемента
    const selectionEvent = new CustomEvent('editorBlock:elementSelected', { detail: element });

    document.dispatchEvent(selectionEvent);
}

/* ***
 * syncTreeSelection - синхронизация выделения узла в дереве и автопрокрутка
 * - принимает HTML элемент
 * - снимает предыдущее выделение и активирует новый узел
*** */
function syncTreeSelection(element) {
    if (currentSelectedTreeNode) {
        currentSelectedTreeNode.classList.remove('active');
        currentSelectedTreeNode = null;
    }

    if (!element) {
        return;
    }

    // Узел дерева соответствующий переданному элементу
    const treeNode = elementToTreeNodeMap.get(element);
    
    if (treeNode) {
        treeNode.classList.add('active');
        currentSelectedTreeNode = treeNode;
        treeNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Отслеживание глобального события выбора элемента
document.addEventListener('editorBlock:elementSelected', (event) => {
    syncTreeSelection(event.detail);
});