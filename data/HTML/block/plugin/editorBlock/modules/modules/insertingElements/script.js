/* ===
 * Основные переменные
=== */

// Получаем контейнер с контентом HTML-редактора
const mdEditorContent = document.getElementById('mdEditorContent');

// Шаблоны элементов для вставки
const elementsTemplates = [
    { element: 'div', html: "<div style='border:1px solid #000; display: inline-block;'>[ST]</div>" },
    { element: 'img', html: "<img src='[LINK]'>" },
    { element: 'a', html: "<a href='[LINK]'>[ST]</a>" },
    { element: 'table', html: '[TABLE]' },
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
 * insertClickHandler - обработчик клика по кнопке вставки элемента
 * - принимает событие клика
 * - вставляет выбранный элемент в активный view-блок или HTML-редактор
*** */
const insertClickHandler = async event => {
    // Проверяем, что клик был по кнопке вставки элемента
    const button = event.target.closest('.insertElement');
    if (!button) {
        return;
    }

    // Находим шаблон элемента по атрибуту data-element кнопки
    const elementTemplate = elementsTemplates.find(item => item.element === button.dataset.element);
    if (!elementTemplate) {
        return;
    }

    // Получаем HTML-шаблон элемента и восстанавливаем выделение
    const dataEl = elementTemplate.html;
    restoreSelection();

    // Проверяем, какой редактор активен: визуальный или HTML
    const activeEditor = document.querySelector('#viewBlock > .active');

    // Если активен HTML-редактор, вставляем элемент туда
    if (activeEditor && activeEditor.id === 'mdEditor') {
        await insertInHtmlEditor(dataEl, button.textContent || 'текст');
        window.editorBlock.syncEditors();
        return;
    }

    // Если активен визуальный редактор, вставляем элемент туда
    await handleLoadedBlockView(dataEl, button.textContent || 'текст');
    window.editorBlock.syncEditors();
};

if (insertingElements) {
    insertingElements.addEventListener('click', insertClickHandler);
}



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
        return prompt('Введите ссылку (URL)');
    } else if (lower === 'count' || lower === 'number') {
        return prompt('Введите число');
    }

    return prompt(`Введите значение для ${marker}`);
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
    const fragment = range.cloneContents();
    const wrapper = document.createElement('div');
    wrapper.appendChild(fragment);

    const isMulti = wrapper.querySelector('div, p, br, table, ul, ol, li') || wrapper.innerHTML.includes('\n');
    if (!isMulti) {
        return node;
    }

    const container = document.createElement('div');
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
    // Получаем текущее выделение
    const sel = document.getSelection();
    if (!sel || !sel.rangeCount) {
        return;
    }

    // Находим общий предок выделения
    const range = sel.getRangeAt(0);
    let ancestor = range.commonAncestorContainer;
    if (ancestor.nodeType !== 1) {
        ancestor = ancestor.parentNode;
    }

    // Проверяем, что предок находится внутри активного view-блока
    const view = ancestor.closest('#viewEditorСontent');
    if (!view) {
        return;
    }

    // Парсим шаблон элемента и создаём новый элемент
    const parsed = parseDataEl(dataEl);
    const newEl = cloneNode(parsed.nodeTemplate, parsed.tagName);
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

    // Заменяем маркеры в новом элементе
    replaceMarkers(newEl, markerValues);
    if (parsed.hasST && !selectionHasContent) {
        replaceMarkers(newEl, { ST: placeholderText });
    }

    // Вставляем содержимое выделения в место маркера [ST], если оно есть
    if (parsed.hasST && newEl.tagName.toLowerCase() !== 'input' && newEl.tagName.toLowerCase() !== 'textarea') {
        const stNode = findSTTextNode(newEl);
        if (selectionHasContent) {
            const fragment = range.cloneContents();
            if (stNode) {
                stNode.parentNode.replaceChild(fragment, stNode);
            } else {
                newEl.appendChild(fragment);
            }
        } else if (stNode) {
            stNode.parentNode.replaceChild(document.createTextNode(placeholderText), stNode);
        }
    }

    // Вставляем новый элемент в позицию курсора, оборачивая его при необходимости
    const finalNode = parsed.hasST ? newEl : wrapIfMultiLine(range, newEl);
    range.deleteContents();
    range.insertNode(finalNode);

    // Перемещаем курсор после вставленного элемента
    try {
        sel.removeAllRanges();
        const afterRange = document.createRange();
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
                return wrapper.innerHTML;
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