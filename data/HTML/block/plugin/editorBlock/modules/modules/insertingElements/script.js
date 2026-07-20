/* ===
 * Основные переменные
=== */

// Шаблоны элементов для вставки
const elementsTemplates = [
    { element: 'div', html: "<div style='border:1px solid #000; display: inline-block;'>[ST]</div>" },
    { element: 'img', html: "[MENU]" },
    { element: 'a', html: "<a href='[LINK]'>[ST]</a>" },
    { element: 'table', html: '[MENU]' },
    { element: 'hr', html: "<hr style='height:2px;border:0;background:#000;'>" },
    { element: 'form', html: "<form style='border:1px solid #000;'>[ST]</form>" },
    { element: 'input', html: "<input placeholder='[ST]'>" },
    { element: 'textarea', html: "<textarea style='border:1px solid #000;'>[ST]</textarea>" },
    { element: 'select', html: "<select><option>[ST]</option><option>вариант 2</option></select>" },
    { element: 'code', html: "<code style='border:1px solid #000;'>[ST]</code>" },
    { element: 'figure', html: "<figure><img src='[LINK]'><figcaption>[ST]</figcaption></figure>" },
    { element: 'video', html: "<video src='[LINK]' controls style='max-width:100%;'></video>" },
    { element: 'audio', html: "<audio src='[LINK]' controls></audio>" },
    { element: 'iframe', html: "<iframe src='[LINK]' style='width:100%;height:160px;'></iframe>" },
    { element: 'button', html: "<button style='border:1px solid #000;'>[ST]</button>" },
    { element: 'details', html: "<details style='border:1px solid #000;width:160px;'><summary>Заголовок</summary><div>[ST]</div></details>" },
    { element: 'range', html: "<input type='range' min='0' max='100' value='50' style='width:160px;'>" },
    { element: 'progress', html: "<progress value='50' max='100' style='width:160px;'></progress>" },
    { element: 'file', html: "<input type='file'>" }
];

// Элементы, которые не должны быть вложены сами в себя
const unwrapElements = [
    'a',
    'form',
    'button',
    'textarea',
    'select',
    'code',
    'figure',
    'details',
    'label'
];



/* ===
 * Обработчики панели вставки
=== */

// Получаем контейнер с кнопками вставки элементов
const insertingElements = document.getElementById('insertingElements');

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ***
 * cleanSelectionForUnwrap - очищает выделение от элементов unwrapElements в визуальном редакторе
 * - находит, удаляет и разгруппировывает некорректные элементы
 * - возвращает очищенный фрагмент и точку вставки
*** */
function cleanSelectionForUnwrap(sel, range) {
    const selector = unwrapElements.join(',');
    const doc = range.startContainer && range.startContainer.ownerDocument ? range.startContainer.ownerDocument : document;
    const fragment = range.cloneContents();

    // Создаем временный контейнер для очистки содержимого внутри выделения
    const temp = doc.createElement('div');
    temp.appendChild(fragment);

    // Очищаем все unwrapElements внутри выделения
    temp.querySelectorAll(selector).forEach(el => {
        const parent = el.parentNode;
        while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
        }
        el.remove();
    });

    // Проверяем, находится ли само выделение внутри какого-то unwrap-элемента
    let ancestor = range.commonAncestorContainer;
    if (ancestor.nodeType !== 1) {
        ancestor = ancestor.parentNode;
    }

    const unwrapAncestor = ancestor.closest(selector);
    const viewContent = document.getElementById('viewEditorContent');
    const mediaSelector = 'img, input, textarea, select, hr, iframe, video, audio';

    // По умолчанию точка вставки - это исходный range (ничего разбирать не нужно)
    let insertionRange = range.cloneRange();

    // Если выделение внутри запрещенного элемента - разбиваем родителя
    if (unwrapAncestor && (viewContent && viewContent.contains(unwrapAncestor) || doc.body.contains(unwrapAncestor))) {
        const parent = unwrapAncestor.parentNode;

        const extractLeftRight = (leftBoundaryMarker, rightBoundaryMarker) => {
            // Извлекаем левую часть (до начала выделения)
            const leftRange = doc.createRange();
            leftRange.setStartBefore(unwrapAncestor);
            leftRange.setEndBefore(leftBoundaryMarker);
            const leftFragment = leftRange.extractContents();
            if (leftFragment.textContent.trim() !== '' || leftFragment.querySelector(mediaSelector)) {
                parent.insertBefore(leftFragment, unwrapAncestor);
            }

            // Извлекаем правую часть (после конца выделения)
            const rightRange = doc.createRange();
            rightRange.setStartAfter(rightBoundaryMarker);
            rightRange.setEndAfter(unwrapAncestor);
            const rightFragment = rightRange.extractContents();
            if (rightFragment.textContent.trim() !== '' || rightFragment.querySelector(mediaSelector)) {
                parent.insertBefore(rightFragment, unwrapAncestor.nextSibling);
            }
        };

        if (range.collapsed) {
            // Курсор без выделения. Используем один маркер во избежание сайд-эффектов сдвига границ
            const marker = doc.createElement('span');
            const markerRange = range.cloneRange();
            markerRange.collapse(true);
            markerRange.insertNode(marker);

            extractLeftRight(marker, marker);

            const insertionIndex = Array.prototype.indexOf.call(parent.childNodes, unwrapAncestor);
            marker.remove();
            unwrapAncestor.remove();

            insertionRange = doc.createRange();
            insertionRange.setStart(parent, insertionIndex);
            insertionRange.collapse(true);
        } else {
            // Настоящее выделение. Запоминаем границы ДО манипуляций и вставляем сначала правый маркер, затем левый
            const startContainer = range.startContainer;
            const startOffset = range.startOffset;
            const endContainer = range.endContainer;
            const endOffset = range.endOffset;

            const endMarker = doc.createElement('span');
            const endMarkerRange = doc.createRange();
            endMarkerRange.setStart(endContainer, endOffset);
            endMarkerRange.collapse(true);
            endMarkerRange.insertNode(endMarker);

            const startMarker = doc.createElement('span');
            const startMarkerRange = doc.createRange();
            startMarkerRange.setStart(startContainer, startOffset);
            startMarkerRange.collapse(true);
            startMarkerRange.insertNode(startMarker);

            extractLeftRight(startMarker, endMarker);

            const insertionIndex = Array.prototype.indexOf.call(parent.childNodes, unwrapAncestor);
            startMarker.remove();
            endMarker.remove();
            unwrapAncestor.remove();

            insertionRange = doc.createRange();
            insertionRange.setStart(parent, insertionIndex);
            insertionRange.collapse(true);
        }
    }

    // Возвращаем очищенное содержимое и точку, куда его нужно вставлять
    const docFrag = doc.createDocumentFragment();
    while (temp.firstChild) {
        docFrag.appendChild(temp.firstChild);
    }
    return { fragment: docFrag, insertionRange };
}

/* ***
 * insertClickHandler - обработчик клика по кнопке вставки элемента
 * - принимает событие клика и опциональный пользовательский шаблон
 * - если клик был по кнопке-меню, открывает соответствующее меню
 * - если клик был по кнопке вставки, вставляет соответствующий элемент
*** */
async function insertClickHandler(event, customTemplate=null) {
    // Восстанавливаем выделение
    window.editorBlock.restoreSelection();

    // Проверяем, что клик был по кнопке-меню (только если не передан customTemplate)
    const menuButton = event.target.closest('.insertElementMenu');
    if (menuButton && !customTemplate) {
        // Получаем имя меню из атрибута data-menu
        const menuId = menuButton.dataset.menu;
        const menuElement = document.getElementById(menuId);
        
        if (menuElement) {
            showElementMenu(menuElement, menuButton);
        }
        return;
    }

    let dataEl = '';
    let textContent = 'текст';

    // Если передан готовый шаблон, используем его
    if (customTemplate) {
        dataEl = customTemplate;
    } else {
        // Проверяем, что клик был по обычной кнопке вставки элемента
        const button = event.target.closest('.insertElement');
        if (!button) {
            return;
        }

        // Находим шаблон элемента по атрибуту data-element кнопки
        const elementTemplate = elementsTemplates.find(item => item.element === button.dataset.element);
        if (!elementTemplate) {
            return;
        }

        // Получаем HTML-шаблон элемента
        dataEl = elementTemplate.html;
        textContent = button.textContent || 'текст';
    }

    // Проверяем, какой редактор активен: визуальный или HTML
    const activeEditor = document.querySelector('#viewBlock > .active');

    // Парсим вставляемый элемент, чтобы узнать его тег
    const parsed = parseDataEl(dataEl);

    // Если активен HTML-редактор, сохраняем состояние до вставки
    if (activeEditor && activeEditor.id === 'mdEditor') {
        window.editorBlock.saveHistoryState();
        await insertInHtmlEditor(dataEl, textContent);

        window.editorBlock.syncEditors();
        window.editorBlock.saveHistoryState();
        return;
    }

    // Если активен визуальный редактор, и мы вставляем unwrap-элемент, очищаем выделение от вложенности
    if (unwrapElements.includes(parsed.tagName)) {
        const sel = window.editorBlock && typeof window.editorBlock.getEditorSelection === 'function'
            ? window.editorBlock.getEditorSelection()
            : document.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const { fragment: cleanedFragment, insertionRange } = cleanSelectionForUnwrap(sel, range);

            const firstNode = cleanedFragment.firstChild;
            const lastNode = cleanedFragment.lastChild;

            insertionRange.deleteContents();
            insertionRange.insertNode(cleanedFragment);

            const newRange = (window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
                ? window.editorBlock.getEditorDocument()
                : document).createRange();
            if (firstNode && lastNode) {
                newRange.setStartBefore(firstNode);
                newRange.setEndAfter(lastNode);
            } else {
                newRange.setStart(insertionRange.startContainer, insertionRange.startOffset);
                newRange.collapse(true);
            }

            sel.removeAllRanges();
            sel.addRange(newRange);
        }
    }

    // Сохраняем текущее состояние перед вставкой элемента
    window.editorBlock.saveHistoryState();

    // Вставляем элемент в визуальный редактор (с уже обновленным и валидным выделением)
    await handleLoadedBlockView(dataEl, textContent);

    window.editorBlock.syncEditors();
    window.editorBlock.saveHistoryState();

    // Восстанавливаем выделение
    window.editorBlock.restoreSelection();
}

// Добавляем обработчик клика на контейнер с кнопками вставки элементов
insertingElements.addEventListener('click', insertClickHandler);



/* ===
 * Парсинг элементов и маркеров
=== */

/* ***
 * parseDataEl - парсит HTML-шаблон элемента и извлекает маркеры
 * - принимает HTML-шаблон элемента
 * - возвращает объект с информацией о шаблоне и маркерах
*** */
function parseDataEl(dataEl) {
    const tpl = document.createElement('template');
    tpl.innerHTML = dataEl.trim();
    const node = tpl.content.firstElementChild;
    const html = dataEl.trim();
    const tagName = node ? node.tagName.toLowerCase() : (function () {
        const match = html.match(/^<\s*([a-z0-9-]+)/i);
        return match ? match[1].toLowerCase() : null;
    })();

    const markers = [];
    const re = /\[([A-Z0-9:_-]+)\]/g;
    let match = null;
    while ((match = re.exec(html)) !== null) {
        if (!markers.includes(match[1])) {
            markers.push(match[1]);
        }
    }

    return {
        templateHtml: html,
        nodeTemplate: node ? node.cloneNode(true) : null,
        tagName,
        hasST: html.indexOf('[ST]') !== -1,
        markers
    };
}

/* ***
 * askForMarkerValue - запрашивает значение для маркера
 * - принимает имя маркера
 * - показывает модальное окно ввода
 * - возвращает текст или null
*** */
async function askForMarkerValue(marker) {
    const lower = marker.toLowerCase();

    if (lower === 'link' || lower === 'url' || lower === 'image' || lower === 'src') {
        return await window.editorBlock.prompt('Введите ссылку (URL)');
    } else if (lower === 'count' || lower === 'number') {
        return await window.editorBlock.prompt('Введите число');
    }

    return await window.editorBlock.prompt(`Введите значение для ${marker}`);
}

/* ***
 * replaceMarkers - заменяет маркеры в узле
 * - принимает DOM-элемент и карту значений
 * - заменяет маркеры в атрибутах и текстовых узлах
*** */
function replaceMarkers(el, values) {
    for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        const newValue = attr.value.replace(/\[([A-Z0-9:_-]+)\]/g, (match, name) => {
            return values[name] !== undefined ? values[name] : match;
        });
        if (newValue !== attr.value) {
            el.setAttribute(attr.name, newValue);
        }
    }

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    while (walker.nextNode()) {
        if (/\[([A-Z0-9:_-]+)\]/.test(walker.currentNode.nodeValue)) {
            nodes.push(walker.currentNode);
        }
    }
    nodes.forEach(node => {
        node.nodeValue = node.nodeValue.replace(/\[([A-Z0-9:_-]+)\]/g, (match, name) => {
            return values[name] !== undefined ? values[name] : match;
        });
    });
}

/* ***
 * findSTTextNode - ищет текстовый узел с маркером [ST]
 * - принимает корневой узел
 * - возвращает найденный текстовый узел или null
*** */
function findSTTextNode(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    while (walker.nextNode()) {
        if (walker.currentNode.nodeValue.indexOf('[ST]') !== -1) {
            return walker.currentNode;
        }
    }
    return null;
}

/* ***
 * cloneNode - создаёт клон шаблонного узла
 * - принимает узел-шаблон и имя тега
 * - возвращает новый элемент
*** */
function cloneNode(template, tagName) {
    if (template) {
        return template.cloneNode(true);
    }
    return document.createElement(tagName || 'div');
}

/* ***
 * wrapIfMultiLine - оборачивает узел при многострочном выделении
 * - принимает range и элемент
 * - возвращает либо исходный элемент, либо обёрнутый контейнер
*** */
function wrapIfMultiLine(range, node) {
    const doc = range.startContainer && range.startContainer.ownerDocument ? range.startContainer.ownerDocument : document;
    const fragment = range.cloneContents();
    const wrapper = doc.createElement('div');
    wrapper.appendChild(fragment);

    const isMulti = wrapper.querySelector('div, p, br, table, ul, ol, li') || wrapper.innerHTML.includes('\n');
    if (!isMulti) {
        return node;
    }

    const container = doc.createElement('div');
    container.appendChild(node);
    return container;
}



/* ===
 * Вставка в визуальный редактор
=== */

/* ***
 * handleLoadedBlockView - вставляет элемент в активный view-блок
 * - принимает HTML-шаблон элемента и текст-заполнитель
 * - вставляет элемент в текущую позицию курсора
*** */
async function handleLoadedBlockView(dataEl, placeholderText = 'текст') {
    const editorDoc = window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
        ? window.editorBlock.getEditorDocument()
        : document;
    const editorWindow = (editorDoc && editorDoc.defaultView) ? editorDoc.defaultView : window;

    let sel = window.editorBlock && typeof window.editorBlock.getEditorSelection === 'function'
        ? window.editorBlock.getEditorSelection()
        : (editorWindow.getSelection ? editorWindow.getSelection() : null);

    if ((!sel || !sel.rangeCount) && editorDoc && editorDoc.body) {
        const fallbackRange = editorDoc.createRange();
        fallbackRange.selectNodeContents(editorDoc.body);
        fallbackRange.collapse(false);
        if (editorWindow.getSelection) {
            sel = editorWindow.getSelection();
            sel.removeAllRanges();
            sel.addRange(fallbackRange);
        }
    }

    if (!sel || !sel.rangeCount) {
        return;
    }

    const range = sel.getRangeAt(0);
    let ancestor = range.commonAncestorContainer;
    if (ancestor.nodeType !== 1) {
        ancestor = ancestor.parentNode;
    }

    const view = ancestor.closest ? ancestor.closest('#viewEditorContent') : null;
    if (!view && editorDoc && editorDoc.body.contains(ancestor)) {
        // Вставка идет внутри iframe-body, считаем, что viewEditorContent активен
        // и позволяем вставку в тело самого iframe.
    } else if (!view) {
        return;
    }
    
    // Парсим шаблон элемента и создаём новый элемент
    const parsed = parseDataEl(dataEl);
    const newEl = parsed.nodeTemplate
        ? (editorDoc.importNode ? editorDoc.importNode(parsed.nodeTemplate, true) : cloneNode(parsed.nodeTemplate, parsed.tagName))
        : cloneNode(parsed.nodeTemplate, parsed.tagName);
    const selectionHasContent = sel.toString().length > 0;
    const markerValues = {};

    // Запрашиваем значения для всех маркеров, кроме [ST]
    for (const marker of parsed.markers) {
        if (marker === 'ST') {
            continue;
        }
        const value = await askForMarkerValue(marker);
        if (value === null) {
            return;
        }
        markerValues[marker] = value;
    }
    replaceMarkers(newEl, markerValues);

    // Единый путь обработки [ST] без повторной или дублирующей замены
    const tagName = newEl.tagName ? newEl.tagName.toLowerCase() : '';
    if (parsed.hasST) {
        if (tagName === 'input' || tagName === 'textarea') {
            replaceMarkers(newEl, { ST: placeholderText });
        } else {
            const stNode = findSTTextNode(newEl);
            if (selectionHasContent) {
                const fragment = range.cloneContents();
                if (stNode) {
                    stNode.parentNode.replaceChild(fragment, stNode);
                } else {
                    newEl.appendChild(fragment);
                }
            } else if (stNode) {
                stNode.nodeValue = placeholderText;
            }
        }
    }

    // Если вставляем unwrap-элемент, очищаем внутренности выделения от других unwrap-элементов в визуальном редакторе
    const finalNode = parsed.hasST ? newEl : wrapIfMultiLine(range, newEl);
    range.deleteContents();
    range.insertNode(finalNode);

    // Перемещаем курсор после вставленного элемента
    try {
        sel.removeAllRanges();
        const afterRange = editorDoc.createRange();
        afterRange.setStartAfter(finalNode);
        afterRange.collapse(true);
        sel.addRange(afterRange);
    } catch (error) {
        console.warn('Не удалось переместить курсор:', error);
    }
}



/* ===
 * Вставка в html редактор
=== */

/* ***
 * insertInHtmlEditor - вставляет HTML-шаблон в html-редактор
 * - принимает HTML-шаблон элемента и текст-заполнитель
 * - вставляет HTML-код в текущую позицию курсора
*** */
async function insertInHtmlEditor(dataEl, placeholderText = 'текст') {
    // Получение текущего выделения
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return;
    }

    const range = selection.getRangeAt(0);
    const parsed = parseDataEl(dataEl);
    const selectionHasContent = selection.toString().length > 0;
    const markerValues = {};

    // Запрос значений для всех маркеров, кроме [ST]
    for (const marker of parsed.markers) {
        if (marker === 'ST') {
            continue;
        }

        const value = await askForMarkerValue(marker);
        if (value === null) {
            return;
        }

        markerValues[marker] = escapeHtml(value);
    }

    // Замена всех маркеров в HTML-шаблоне
    let snippet = parsed.templateHtml.replace(/\[([A-Z0-9:_-]+)\]/g, (match, name) => {
        if (name === 'ST') {
            if (selectionHasContent) {
                const fragment = range.cloneContents();
                const wrapper = document.createElement('div');
                wrapper.appendChild(fragment);
                let selectionHtml = wrapper.innerHTML;

                // Если вставляем unwrap-элемент, очищаем внутренности выделения от других unwrap-элементов в HTML-редакторе
                if (unwrapElements.includes(parsed.tagName)) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = selectionHtml;
                    const selector = unwrapElements.join(',');
                    
                    // Удаляем вложенные unwrap-теги, оставляя их содержимое
                    tempDiv.querySelectorAll(selector).forEach(el => {
                        const parent = el.parentNode;
                        while (el.firstChild) {
                            parent.insertBefore(el.firstChild, el);
                        }
                        el.remove();
                    });

                    // Удаляем сам unwrap-тег, если выделение было целиком обернуто в него
                    Array.from(tempDiv.children).forEach(child => {
                        if (child.matches(selector)) {
                            const parent = child.parentNode;
                            while (child.firstChild) {
                                parent.insertBefore(child.firstChild, child);
                            }
                            child.remove();
                        }
                    });
                    selectionHtml = tempDiv.innerHTML;
                }

                return selectionHtml;
            }

            return escapeHtml(placeholderText);
        }

        return markerValues[name] !== undefined ? markerValues[name] : match;
    });

    // Удаление выделенного содержимого
    if (selectionHasContent) {
        range.deleteContents();
    }

    // Вставка HTML-шаблона в редактор
    const textNode = document.createTextNode(snippet);
    range.insertNode(textNode);

    // Перемещение курсора после вставленного шаблона
    selection.removeAllRanges();
    const afterRange = document.createRange();
    afterRange.setStartAfter(textNode);
    afterRange.collapse(true);
    selection.addRange(afterRange);
}



/* ===
 * Логика открытия и закрытия меню вставки элементов
=== */

/* ***
 * showElementMenu - позиционирует и показывает меню под кнопкой
 * - принимает элемент меню и кнопку, у которой оно должно открыться
*** */
function showElementMenu(menu, button) {
    // Скрываем все открытые меню перед показом нового
    document.querySelectorAll('.elementMenu').forEach(el => el.style.display = 'none');

    // Получаем координаты кнопки на экране
    const rect = button.getBoundingClientRect();

    // Показываем меню и позиционируем его прямо под нажатой кнопкой
    menu.style.display = 'block';
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
}

// Закрываем открытые меню при клике в любое другое место документа
function hideElementMenu(event) {
    if (!event.target.closest('.elementMenu') && !event.target.closest('.insertElementMenu')) {
        document.querySelectorAll('.elementMenu').forEach(el => el.style.display = 'none');
    }
}

// Закрываем открытые меню при клике в любое другое место документа
document.addEventListener('click', hideElementMenu);



/* ===
 * Меню вставки таблицы
=== */

// Элементы меню вставки таблицы
const tableSizeGrid = document.getElementById('tableSizeGrid');
const tableSizeLabel = document.getElementById('tableSizeLabel'); // Элемент для вывода размера таблицы в меню

/* ***
 * createTableSizeGrid - создание сетки выбора размера таблицы
 * - создаёт квадраты выбора размера таблицы
*** */
function createTableSizeGrid() {
    for (let row = 1; row <= 10; row++) {
        for (let col = 1; col <= 10; col++) {
            const cell = document.createElement('div');

            cell.dataset.row = row;
            cell.dataset.col = col;

            tableSizeGrid.appendChild(cell);
        }
    }
}

/* ***
 * updateTableSizeGrid - обновление подсветки размера таблицы
 * - принимает количество строк и колонок
 * - подсвечивает выбранную область
*** */
function updateTableSizeGrid(rows, cols) {
    tableSizeGrid.querySelectorAll('div').forEach(cell => {
        cell.classList.toggle(
            'active',
            Number(cell.dataset.row) <= rows &&
            Number(cell.dataset.col) <= cols
        );
    });

    if (tableSizeLabel) {
        tableSizeLabel.textContent = `${cols} × ${rows}`;
    }
}

/* ***
 * tableSizeHoverHandler - обработчик наведения на размер таблицы
 * - обновляет выбранный размер таблицы
*** */
function tableSizeHoverHandler(event) {
    const cell = event.target;

    if (!cell.dataset.row) {
        return;
    }

    updateTableSizeGrid(
        Number(cell.dataset.row),
        Number(cell.dataset.col)
    );
}

// Инициализация сетки выбора размера таблицы
createTableSizeGrid();
tableSizeGrid.addEventListener('mouseover', tableSizeHoverHandler);

/* ***
 * tableSizeGridClickHandler - обработчик клика по сетке выбора размера таблицы
 * - генерирует HTML-код таблицы на основе выбранных строк и колонок
 * - передает сгенерированный шаблон в общую функцию вставки insertClickHandler
*** */
async function tableSizeGridClickHandler(event) {
    const cell = event.target;

    // Проверяем, что кликнули именно по квадратику сетки
    if (!cell.dataset.row) {
        return;
    }

    // Останавливаем всплытие во избежание двойного вызова обработчика
    event.stopPropagation();

    const rows = Number(cell.dataset.row);
    const cols = Number(cell.dataset.col);

    // Генерируем HTML-код таблицы
    let tableHtml = '<table style="width: 100%; border-collapse: collapse; border: 1px solid #000;"><tbody>';
    for (let r = 0; r < rows; r++) {
        tableHtml += '<tr>';
        for (let c = 0; c < cols; c++) {
            tableHtml += '<td style="border: 1px solid #000;"><br></td>';
        }
        tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table>';

    // Вызываем общую функцию вставки, передавая готовый шаблон таблицы в customTemplate
    await insertClickHandler(event, tableHtml);

    // Скрываем меню после успешной вставки
    document.querySelectorAll('.elementMenu').forEach(el => el.style.display = 'none');
}

// Назначаем обработчик клика на сетку выбора размера таблицы
tableSizeGrid.addEventListener('click', tableSizeGridClickHandler);



/* ===
 * Меню вставки изображения
=== */

// Элементы меню вставки изображения
const imageInsertUrl = document.getElementById('imageInsertUrl');
const imageInsertFile = document.getElementById('imageInsertFile');

/* ***
 * imageInsertUrlHandler - вставка изображения по ссылке
 * - запрашивает URL изображения
 * - передает готовый HTML-код изображения в общую функцию вставки
*** */
async function imageInsertUrlHandler(event) {
    event.stopPropagation();

    const url = await window.editorBlock.prompt('Введите ссылку на изображение');
    if (!url) {
        return;
    }

    const imgHtml = `<img src="${url}" style="max-width:100%;">`;

    // Вызываем общую функцию вставки, передавая готовый шаблон картинки в customTemplate
    await insertClickHandler(event, imgHtml);

    // Скрываем меню после успешной вставки
    document.querySelectorAll('.elementMenu').forEach(el => el.style.display = 'none');
}

/* ***
 * imageInsertFileHandler - вставка изображения с компьютера
 * - открывает выбор файла и считывает его в формате Base64
 * - передает готовый HTML-код изображения в общую функцию вставки
*** */
function imageInsertFileHandler(event) {
    event.stopPropagation();

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            const imgHtml = `<img src="${reader.result}" style="max-width:100%;">`;

            // Вызываем общую функцию вставки, передавая готовый шаблон картинки в customTemplate
            await insertClickHandler(event, imgHtml);

            // Скрываем меню после успешной вставки
            document.querySelectorAll('.elementMenu').forEach(el => el.style.display = 'none');
        };

        reader.readAsDataURL(file);
    });

    input.click();
}

// Назначаем обработчики клика на кнопки меню изображения
imageInsertUrl.addEventListener('click', imageInsertUrlHandler);
imageInsertFile.addEventListener('click', imageInsertFileHandler);