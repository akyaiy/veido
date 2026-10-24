/* ===
 * Состояние и элементы интерфейса панели управления
=== */

// Выпадающий список типа селектора (id или class)
const selectorTypeSelect = document.getElementById('selectorType');

// Поле ввода основного имени селектора
const selectorNameInput = document.getElementById('selectorName');

// Выпадающий список второстепенных классов элемента
const selectorClassSelect = document.getElementById('selectorClass');

// Таблица отображения и редактирования привязанных событий
const eventsTable = document.getElementById('eventsPanel')

// Список событий
const eventTypes = [
    {
        label: '#{Mouse and pointer}',
        events: [
            'click',
            'dblclick',
            'mousedown',
            'mouseup',
            'mouseenter',
            'mouseleave',
            'mouseover',
            'mouseout',
            'mousemove',
            'contextmenu',
            'pointerdown',
            'pointerup',
            'pointermove',
            'pointerenter',
            'pointerleave',
            'pointerover',
            'pointerout',
            'pointercancel',
            'wheel'
        ]
    },
    {
        label: '#{Keyboard and input}',
        events: [
            'keydown',
            'keyup',
            'keypress',
            'input',
            'beforeinput',
            'change'
        ]
    },
    {
        label: '#{Form and interaction}',
        events: [
            'submit',
            'reset',
            'focus',
            'blur',
            'focusin',
            'focusout',
            'invalid',
            'copy',
            'cut',
            'paste'
        ]
    },
    {
        label: '#{Drag and touch}',
        events: [
            'dragstart',
            'drag',
            'dragenter',
            'dragover',
            'dragleave',
            'drop',
            'dragend',
            'touchstart',
            'touchmove',
            'touchend',
            'touchcancel'
        ]
    },
    {
        label: '#{Document, window, and media}',
        events: [
            'load',
            'DOMContentLoaded',
            'scroll',
            'resize',
            'beforeunload',
            'unload',
            'visibilitychange',
            'animationstart',
            'animationend',
            'animationiteration',
            'transitionstart',
            'transitionend',
            'transitioncancel',
            'play',
            'pause',
            'ended',
            'volumechange',
            'timeupdate',
            'seeking',
            'seeked',
            'loadeddata',
            'loadedmetadata',
            'canplay',
            'waiting',
            'hashchange',
            'popstate',
            'online',
            'offline'
        ]
    }
];

/* ***
 * getActiveBlockScript - получение элемента скрипта активной вкладки
 * - Входные параметры отсутствуют
 * - Находит активную вкладку редактора и извлекает связанный с ней текстовый тег скрипта
 * - Возвращает найденный HTMLScriptElement или null
*** */
function getActiveBlockScript() {
    const activeTab = document.querySelector('.blockTab.active');

    if (!activeTab) {
        return null;
    }

    const blockId = activeTab.getAttribute('data-block-id');

    if (!blockId) {
        return null;
    }

    const scriptContainer = document.getElementById(blockId + 'Js');

    if (!scriptContainer) {
        return null;
    }

    const scriptElement = scriptContainer.querySelector('script');
    if (scriptElement) {
        return scriptElement;
    }

    // Если в JS-контейнере хранится чистый текст без тега <script>, работаем с ним как с виртуальным скриптом
    const fallbackScript = {
        closest: selector => scriptContainer.closest(selector)
    };

    Object.defineProperty(fallbackScript, 'textContent', {
        get() {
            return scriptContainer.textContent || '';
        },
        set(value) {
            scriptContainer.textContent = value || '';
        }
    });

    return fallbackScript;
}

function getActiveBlockHtml() {
    const activeTab = document.querySelector('.blockTab.active');

    if (!activeTab) {
        return null;
    }

    const blockId = activeTab.getAttribute('data-block-id');

    if (!blockId) {
        return null;
    }

    return document.getElementById(blockId + 'Html') || null;
}

function escapeRegexText(text) {
    return text.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function getSelectorVariableNames(scriptText, selector, selectorType) {
    if (!scriptText || !selector) {
        return [];
    }

    const cleanSelector = selector.replace(/[.#]/g, '');
    const escapedSelector = escapeRegexText(cleanSelector);
    const patterns = [];

    if (selectorType === 'id') {
        patterns.push(`document\\.getElementById\\(['"]${escapedSelector}['"]\\)`);
        patterns.push(`document\\.querySelector\\(['"]#${escapedSelector}['"]\\)`);
    } else if (selectorType === 'class') {
        patterns.push(`document\\.querySelectorAll\\(['"]\\.${escapedSelector}['"]\\)`);
        patterns.push(`document\\.getElementsByClassName\\(['"]${escapedSelector}['"]\\)`);
        patterns.push(`document\\.querySelector\\(['"]\\.${escapedSelector}['"]\\)`);
    } else {
        patterns.push(`document\\.getElementsByTagName\\(['"]${escapedSelector}['"]\\)`);
        patterns.push(`document\\.querySelector\\(['"]${escapedSelector}['"]\\)`);
        patterns.push(`document\\.querySelectorAll\\(['"]${escapedSelector}['"]\\)`);
    }

    const regex = new RegExp(`(?:var|let|const)\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*(?:${patterns.join('|')})`, 'g');
    const names = [];
    let match = null;

    while ((match = regex.exec(scriptText)) !== null) {
        names.push(match[1]);
    }

    return names;
}

function parseHtmlAttributeEvents(htmlText, selector) {
    if (!htmlText || !selector) {
        return [];
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const entries = [];
    const nodes = selector.startsWith('#')
        ? Array.from(doc.querySelectorAll(selector))
        : selector.startsWith('.')
            ? Array.from(doc.querySelectorAll(selector))
            : Array.from(doc.getElementsByTagName(selector));

    for (const node of nodes) {
        for (const attr of Array.from(node.attributes)) {
            if (!attr.name.startsWith('on')) {
                continue;
            }

            const handler = attr.value.trim();

            if (!handler) {
                continue;
            }

            entries.push({
                event: attr.name.toLowerCase(),
                handler,
                source: 'html'
            });
        }
    }

    return entries;
}

/* ***
 * syncSelectorPanel - синхронизация полей ввода панели с текущим элементом
 * - Вызывается без передачи аргументов
 * - Считывает свойства активного элемента из глобального объекта и заполняет текстовые и выпадающие поля панели
 * - Возвращает пустое значение null
*** */
function syncSelectorPanel() {
    selectorNameInput.value = '';
    selectorClassSelect.innerHTML = '';
    selectorClassSelect.style.display = 'none';

    if (!window.editorBlock || !window.editorBlock.selectedElement) {
        return null;
    }

    const currentType = selectorTypeSelect.value;

    if (currentType === 'id') {
        if (window.editorBlock.selectedElement.id) {
            selectorNameInput.value = window.editorBlock.selectedElement.id;
        }

        selectorClassSelect.style.display = 'none';
        return null;
    }

    const classes = Array.from(window.editorBlock.selectedElement.classList);

    if (classes.length === 0) {
        return null;
    }

    selectorNameInput.value = classes[0];

    if (classes.length > 0) {
        selectorClassSelect.innerHTML = '';
        selectorClassSelect.style.display = 'inline-block';

        for (let i = 0; i < classes.length; i++) {
            const option = document.createElement('option');
            option.value = classes[i];
            option.textContent = classes[i];
            if (i === 0) {
                option.selected = true;
            }
            selectorClassSelect.appendChild(option);
        }
    }

    return null;
}

function applySelectorToSelectedElement(previousValue) {
    if (!window.editorBlock || !window.editorBlock.selectedElement) {
        return null;
    }

    const element = window.editorBlock.selectedElement;
    const value = selectorNameInput.value.trim();
    const currentType = selectorTypeSelect.value;

    if (currentType === 'id') {
        if (value) {
            element.id = value;
        } else {
            element.removeAttribute('id');
        }
    } else {
        const oldClass = previousValue || selectorClassSelect.value || Array.from(element.classList)[0] || '';

        if (oldClass && element.classList.contains(oldClass)) {
            element.classList.remove(oldClass);
        }

        if (value) {
            element.classList.add(value);
        }
    }

    syncSelectorPanel();
    renderEventsTable();

    if (window.editorBlock && typeof window.editorBlock.syncEditors === 'function') {
        window.editorBlock.syncEditors();
    }
    if (window.editorBlock && typeof window.editorBlock.saveHistoryState === 'function') {
        window.editorBlock.saveHistoryState();
    }

    return null;
}

/* ***
 * parseScriptEvents - извлечение списка событий из текста скрипта
 * - Принимает строку кода scriptText и строку искомого селектора selector
 * - Находит все зарегистрированные привязки событий в тексте для указанного селектора
 * - Возвращает массив объектов с полями event и handler
*** */
function parseScriptEvents(scriptText, selector, htmlText = '') {
    if ((!scriptText || scriptText.trim() === '') && (!htmlText || htmlText.trim() === '') || !selector) {
        return [];
    }

    const entries = [];
    const cleanSelector = selector.replace(/[.#]/g, '');
    const escapedSelector = escapeRegexText(cleanSelector);
    const selectorType = selector.startsWith('#') ? 'id' : selector.startsWith('.') ? 'class' : 'tag';
    const variableNames = getSelectorVariableNames(scriptText, selector, selectorType);
    const variablePattern = variableNames.length ? variableNames.map(name => escapeRegexText(name)).join('|') : '(?!)';
    let match = null;

    if (selectorType === 'id') {
        const idPropRegex = new RegExp(`(?:document\\.getElementById\\(['"]${escapedSelector}['"]\\)|document\\.querySelector\\(['"]#${escapedSelector}['"]\\)|${escapedSelector})\\.on([a-zA-Z]+)\\s*=\\s*([A-Za-z_$][A-Za-z0-9_$]*)`, 'g');
        const idListenerRegex = new RegExp(`(?:document\\.getElementById\\(['"]${escapedSelector}['"]\\)|document\\.querySelector\\(['"]#${escapedSelector}['"]\\)|${escapedSelector})\\.addEventListener\\(\\s*['"]([a-zA-Z]+)['"]\\s*,\\s*([A-Za-z_$][A-Za-z0-9_$]*)`, 'g');

        while ((match = idPropRegex.exec(scriptText)) !== null) {
            entries.push({ event: 'on' + match[1].toLowerCase(), handler: match[2], source: 'script' });
        }

        while ((match = idListenerRegex.exec(scriptText)) !== null) {
            entries.push({ event: 'on' + match[1].toLowerCase(), handler: match[2], source: 'script' });
        }
    } else if (selectorType === 'class') {
        const classForEachPropRegex = new RegExp(`(?:document\\.querySelectorAll\\(['"]\\.${escapedSelector}['"]\\)|document\\.getElementsByClassName\\(['"]${escapedSelector}['"]\\))\\.forEach\\([^)]*\\.on([a-zA-Z]+)\\s*=\\s*([A-Za-z_$][A-Za-z0-9_$]*)`, 'g');
        const classIndexPropRegex = new RegExp(`(?:document\\.querySelectorAll\\(['"]\\.${escapedSelector}['"]\\)|document\\.getElementsByClassName\\(['"]${escapedSelector}['"]\\))\\[[^\\]]+\\]\\.on([a-zA-Z]+)\\s*=\\s*([A-Za-z_$][A-Za-z0-9_$]*)`, 'g');
        const classListenerRegex = new RegExp(`(?:document\\.querySelectorAll\\(['"]\\.${escapedSelector}['"]\\)|document\\.getElementsByClassName\\(['"]${escapedSelector}['"]\\))\\.forEach\\([^)]*\\.addEventListener\\(\\s*['"]([a-zA-Z]+)['"]\\s*,\\s*([A-Za-z_$][A-Za-z0-9_$]*)`, 'g');

        while ((match = classForEachPropRegex.exec(scriptText)) !== null) {
            entries.push({ event: 'on' + match[1].toLowerCase(), handler: match[2], source: 'script' });
        }

        while ((match = classIndexPropRegex.exec(scriptText)) !== null) {
            entries.push({ event: 'on' + match[1].toLowerCase(), handler: match[2], source: 'script' });
        }

        while ((match = classListenerRegex.exec(scriptText)) !== null) {
            entries.push({ event: 'on' + match[1].toLowerCase(), handler: match[2], source: 'script' });
        }
    } else {
        const tagPropRegex = new RegExp(`(?:document\\.getElementsByTagName\\(['"]${escapedSelector}['"]\\)|document\\.querySelectorAll\\(['"]${escapedSelector}['"]\\))\\.(?:forEach\\([^)]*\\.on([a-zA-Z]+)\\s*=\\s*([A-Za-z_$][A-Za-z0-9_$]*)|\[[^\]]+\]\\.on([a-zA-Z]+)\\s*=\\s*([A-Za-z_$][A-Za-z0-9_$]*)))`, 'g');
        const tagListenerRegex = new RegExp(`(?:document\\.getElementsByTagName\\(['"]${escapedSelector}['"]\\)|document\\.querySelectorAll\\(['"]${escapedSelector}['"]\\))\\.forEach\\([^)]*\\.addEventListener\\(\\s*['"]([a-zA-Z]+)['"]\\s*,\\s*([A-Za-z_$][A-Za-z0-9_$]*)`, 'g');

        while ((match = tagPropRegex.exec(scriptText)) !== null) {
            const eventName = match[1] || match[3];
            const handlerName = match[2] || match[4];

            if (eventName && handlerName) {
                entries.push({ event: 'on' + eventName.toLowerCase(), handler: handlerName, source: 'script' });
            }
        }

        while ((match = tagListenerRegex.exec(scriptText)) !== null) {
            entries.push({ event: 'on' + match[1].toLowerCase(), handler: match[2], source: 'script' });
        }
    }

    const variableOnRegex = new RegExp(`(?:${variablePattern})\\.on([a-zA-Z]+)\\s*=\\s*([A-Za-z_$][A-Za-z0-9_$]*)`, 'g');
    const variableListenerRegex = new RegExp(`(?:${variablePattern})\\.addEventListener\\(\\s*['"]([a-zA-Z]+)['"]\\s*,\\s*([A-Za-z_$][A-Za-z0-9_$]*)`, 'g');
    const delegationRegex = new RegExp(`addEventListener\\(\\s*['"]([a-zA-Z]+)['"]\\s*,\\s*function\\([^)]*\\)\\s*\\{[\\s\\S]*?matches\\(['"]${escapedSelector}['"]\\)[\\s\\S]*?([A-Za-z_$][A-Za-z0-9_$]*)\\(`, 'g');

    while ((match = variableOnRegex.exec(scriptText)) !== null) {
        entries.push({ event: 'on' + match[1].toLowerCase(), handler: match[2], source: 'script' });
    }

    while ((match = variableListenerRegex.exec(scriptText)) !== null) {
        entries.push({ event: 'on' + match[1].toLowerCase(), handler: match[2], source: 'script' });
    }

    while ((match = delegationRegex.exec(scriptText)) !== null) {
        entries.push({ event: 'on' + match[1].toLowerCase(), handler: match[2], source: 'script' });
    }

    if (htmlText) {
        const htmlEvents = parseHtmlAttributeEvents(htmlText, selector);

        for (const item of htmlEvents) {
            entries.push(item);
        }
    }

    const unique = [];
    const seen = new Set();

    for (const item of entries) {
        const key = item.event + '|' + item.handler + '|' + (item.source || 'script');

        if (!seen.has(key)) {
            seen.add(key);
            unique.push(item);
        }
    }

    return unique;
}

/* ***
 * updateScriptBinding - обновление или удаление строки привязки в коде скрипта
 * - Принимает старое событие oldEvent, новое событие newEvent, имя обработчика handler и флаг удаления isDelete
 * - Изменяет текст скрипта активного блока, добавляя, изменяя или вырезая выражения привязки
 * - Возвращает пустое значение null
*** */
function updateScriptBinding(oldEvent, newEvent, handler, isDelete, sourceType = 'script') {
    const scriptEl = getActiveBlockScript();
    const htmlEl = getActiveBlockHtml();

    if (!scriptEl && sourceType !== 'html') {
        return null;
    }

    const currentType = selectorTypeSelect.value;
    const nameVal = selectorNameInput.value.trim();

    if (!nameVal) {
        return null;
    }

    const escapedNameVal = nameVal.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const cleanOld = oldEvent ? oldEvent.replace(/^on/, '') : '';
    const cleanNew = newEvent ? newEvent.replace(/^on/, '') : '';
    const isHtmlSource = sourceType === 'html';

    if (isHtmlSource && htmlEl) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlEl.innerHTML, 'text/html');
        const nodes = currentType === 'id'
            ? Array.from(doc.querySelectorAll('#' + nameVal))
            : currentType === 'tag'
                ? Array.from(doc.getElementsByTagName(nameVal))
                : Array.from(doc.querySelectorAll('.' + nameVal));

        for (const node of nodes) {
            if (isDelete) {
                node.removeAttribute('onclick');
            } else {
                node.setAttribute('onclick', handler);
            }
        }

        htmlEl.innerHTML = doc.body.innerHTML;
        return null;
    }

    let scriptText = scriptEl ? scriptEl.textContent : '';
    let targetRegex = null;

    if (currentType === 'id') {
        targetRegex = new RegExp(`(?:document\\.getElementById\\(['"]${escapedNameVal}['"]\\)|document\\.querySelector\\(['"]#${escapedNameVal}['"]\\)|${escapedNameVal})\\.on${cleanOld}\\s*=\\s*[^;\\n]+;?`, 'g');
    } else if (currentType === 'class') {
        targetRegex = new RegExp(`(?:document\\.querySelectorAll\\(['"]\\.${escapedNameVal}['"]\\)|document\\.getElementsByClassName\\(['"]${escapedNameVal}['"]\\))\\.(?:forEach\\([^)]*\\.on${cleanOld}\\s*=\\s*[^)]+\\);?|\[[^\]]+\]\\.on${cleanOld}\\s*=\\s*[^;\\n]+;?)`, 'g');
    } else {
        targetRegex = new RegExp(`(?:document\\.getElementsByTagName\\(['"]${escapedNameVal}['"]\\)|document\\.querySelectorAll\\(['"]${escapedNameVal}['"]\\))\\.(?:forEach\\([^)]*\\.on${cleanOld}\\s*=\\s*[^)]+\\);?|\[[^\]]+\]\\.on${cleanOld}\\s*=\\s*[^;\\n]+;?)`, 'g');
    }

    if (isDelete) {
        scriptText = scriptText.replace(targetRegex, '').replace(/\n\s*\n/g, '\n');
    } else {
        let newLine = '';

        if (currentType === 'id') {
            newLine = `document.getElementById('${nameVal}').on${cleanNew} = ${handler};`;
        } else if (currentType === 'class') {
            newLine = `document.querySelectorAll('.${nameVal}').forEach(el => el.on${cleanNew} = ${handler});`;
        } else {
            newLine = `document.getElementsByTagName('${nameVal}').forEach(el => el.on${cleanNew} = ${handler});`;
        }

        if (oldEvent && targetRegex.test(scriptText)) {
            scriptText = scriptText.replace(targetRegex, newLine);
        } else {
            scriptText = scriptText.trimEnd() + '\n' + newLine + '\n';
        }
    }

    scriptEl.textContent = scriptText;

    const jsEditorContent = document.getElementById('jsEditorContent');
    if (jsEditorContent && scriptEl.closest && scriptEl.closest('div[id$="Js"]')) {
        jsEditorContent.innerHTML = scriptText;
    }

    return null;
}

/* ***
 * ensureTrailingEmptyRow - добавление пустой строки в конец таблицы событий
 * - Входные данные отсутствуют
 * - Проверяет последнюю строку таблицы и добавляет новую пустую строку, если текущие заполнены
 * - Возвращает пустое значение null
*** */
function ensureTrailingEmptyRow() {
    const rows = eventsTable.querySelectorAll('tr');

    if (rows.length === 0) {
        eventsTable.appendChild(createEventRow('', ''));
        return null;
    }

    const lastRow = rows[rows.length - 1];
    const inputEvent = lastRow.cells[0].querySelector('input');
    const inputFunc = lastRow.cells[1].querySelector('input');

    if (inputEvent.value.trim() !== '' || inputFunc.value.trim() !== '') {
        eventsTable.appendChild(createEventRow('', ''));
    }

    return null;
}

/* ***
 * createEventRow - генерация новой строки таблицы событий с полями ввода
 * - Принимает строку названия события eventName и имя обработчика handlerName
 * - Создает структуру HTML элементов строки и навешивает обработчики изменений и автодополнения
 * - Возвращает сгенерированный элемент строки HTMLTableRowElement
*** */
function createEventRow(eventName, handlerName, sourceType = 'script') {
    const tr = document.createElement('tr');
    const tdEvent = document.createElement('td');
    const tdFunc = document.createElement('td');
    const inputEvent = document.createElement('input');
    const inputFunc = document.createElement('input');

    inputEvent.placeholder = 'event';
    inputEvent.value = eventName || '';
    tdEvent.appendChild(inputEvent);

    inputFunc.placeholder = 'function';
    inputFunc.value = handlerName || '';
    tdFunc.appendChild(inputFunc);

    tr.appendChild(tdEvent);
    tr.appendChild(tdFunc);
    tr.dataset.sourceType = sourceType;

    inputEvent.dataset.oldValue = eventName || '';
    inputFunc.dataset.oldValue = handlerName || '';

    inputEvent.addEventListener('change', () => {
        handleRowFieldChange(tr);
    });

    inputEvent.addEventListener('focus', () => {
        prepareEventAutocomplete(inputEvent);
    });

    inputEvent.addEventListener('input', () => {
        updateEventAutocomplete(inputEvent);
    });

    inputFunc.addEventListener('change', () => {
        handleRowFieldChange(tr);
    });

    inputFunc.addEventListener('focus', () => {
        prepareFunctionAutocomplete(inputFunc);
    });

    inputFunc.addEventListener('input', () => {
        updateFunctionAutocomplete(inputFunc);
    });

    return tr;
}

/* ***
 * renderEventsTable - полное обновление содержимого таблицы событий
 * - Аргументы при вызове отсутствуют
 * - Считывает текущие привязки из скрипта и отрисовывает соответствующие строки таблицы
 * - Возвращает пустое значение null
*** */
function renderEventsTable() {
    eventsTable.innerHTML = '';
    const scriptEl = getActiveBlockScript();

    if (!scriptEl) {
        ensureTrailingEmptyRow();
        return null;
    }

    const currentType = selectorTypeSelect.value;
    const nameVal = selectorNameInput.value.trim();

    if (!nameVal) {
        ensureTrailingEmptyRow();
        return null;
    }

    const selector = currentType === 'id' ? '#' + nameVal : '.' + nameVal;
    const htmlText = getActiveBlockHtml() ? getActiveBlockHtml().innerHTML : '';
    const activeEvents = parseScriptEvents(scriptEl.textContent, selector, htmlText);

    for (const item of activeEvents) {
        eventsTable.appendChild(createEventRow(item.event, item.handler, item.source || 'script'));
    }

    ensureTrailingEmptyRow();
    return null;
}

/* ***
 * parseFunctionNames - извлечение имен доступных функций из текста скрипта
 * - Принимает строковый код скрипта code
 * - Сканирует текст регулярными выражениями для поиска определений функций и стрелочных присвоений
 * - Возвращает отсортированный массив уникальных строк с именами функций
*** */
function parseFunctionNames(code) {
    if (!code) {
        return [];
    }

    const names = new Set();
    const functionRegex = /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    let match = null;

    while ((match = functionRegex.exec(code)) !== null) {
        names.add(match[1]);
    }

    const variableRegex = /(?:var|let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:function\b|\()/g;

    while ((match = variableRegex.exec(code)) !== null) {
        names.add(match[1]);
    }

    return Array.from(names).sort();
}

function parseEventNames() {
    const names = new Set();

    for (const group of eventTypes) {
        if (Array.isArray(group.events)) {
            for (const eventName of group.events) {
                if (typeof eventName === 'string' && eventName.trim()) {
                    names.add(eventName.trim());
                }
            }
        }
    }

    return Array.from(names).sort();
}

// Текущее целевое поле ввода для отображения автодополнения
let activeAutocompleteTarget = null;

/* ***
 * prepareFunctionAutocomplete - подготовка списка вариантов автодополнения функций
 * - Принимает целевой элемент ввода input
 * - Парсит функции активного блока скрипта и сохраняет список в элемент ввода
 * - Возвращает пустое значение null
*** */
function prepareFunctionAutocomplete(input) {
    activeAutocompleteTarget = input;
    const scriptEl = getActiveBlockScript();
    const code = scriptEl ? scriptEl.textContent : '';
    input.dataset.suggestions = JSON.stringify(parseFunctionNames(code));
    showAutocomplete(input, '');

    return null;
}

/* ***
 * updateFunctionAutocomplete - фильтрация вариантов автодополнения при изменении ввода
 * - Принимает текущий изменяемый элемент ввода input
 * - Извлекает текущую строку ввода и обновляет список подсказок
 * - Возвращает пустое значение null
*** */
function updateFunctionAutocomplete(input) {
    if (activeAutocompleteTarget !== input) {
        return null;
    }

    const prefix = input.value.trim();
    showAutocomplete(input, prefix);

    return null;
}

function prepareEventAutocomplete(input) {
    activeAutocompleteTarget = input;
    input.dataset.suggestions = JSON.stringify(parseEventNames());
    showAutocomplete(input, '');

    return null;
}

function updateEventAutocomplete(input) {
    if (activeAutocompleteTarget !== input) {
        return null;
    }

    const prefix = input.value.trim();
    showAutocomplete(input, prefix);

    return null;
}

/* ***
 * showAutocomplete - визуальное отображение панели автодополнения
 * - Принимает элемент ввода input и строку фильтрации prefix
 * - Создает список кликабельных строк подсказок и позиционирует контейнер под полем
 * - Возвращает пустое значение null
*** */
function showAutocomplete(input, prefix) {
    const namesList = JSON.parse(input.dataset.suggestions || '[]');
    const filteredList = prefix ? namesList.filter(name => name.startsWith(prefix)) : namesList;

    if (filteredList.length === 0) {
        hideFunctionAutocomplete();
        return null;
    }

    jsAutocompleteBox.innerHTML = '';

    for (const name of filteredList) {
        const rowDiv = document.createElement('div');
        rowDiv.textContent = name;
        rowDiv.style.padding = '2px 4px';
        rowDiv.style.cursor = 'pointer';

        rowDiv.addEventListener('mousedown', (event) => {
            event.preventDefault();

            if (activeAutocompleteTarget) {
                activeAutocompleteTarget.value = name;
                activeAutocompleteTarget.focus();
                const tr = activeAutocompleteTarget.closest('tr');

                if (tr) {
                    handleRowFieldChange(tr);
                }
            }

            hideFunctionAutocomplete();
        });

        jsAutocompleteBox.appendChild(rowDiv);
    }

    positionAutocompleteBox(input);
    jsAutocompleteBox.style.display = 'block';
    return null;
}

/* ***
 * positionAutocompleteBox - расчет и установка координат панели автодополнения
 * - Принимает активный элемент ввода input
 * - Вычисляет границы поля ввода относительно окна браузера и перемещает блок подсказок
 * - Возвращает пустое значение null
*** */
function positionAutocompleteBox(input) {
    const bounds = input.getBoundingClientRect();
    let calculatedLeft = bounds.left + window.scrollX;
    const calculatedTop = bounds.bottom + window.scrollY;
    const elementWidth = jsAutocompleteBox.offsetWidth || 0;
    const standardMargin = window.innerWidth - 10;

    if (calculatedLeft + elementWidth > standardMargin) {
        calculatedLeft = Math.max(10, standardMargin - elementWidth);
    }

    jsAutocompleteBox.style.top = calculatedTop + 'px';
    jsAutocompleteBox.style.left = calculatedLeft + 'px';

    if (calculatedTop + jsAutocompleteBox.offsetHeight > window.innerHeight + window.scrollY) {
        jsAutocompleteBox.style.top = (bounds.top + window.scrollY - jsAutocompleteBox.offsetHeight - 2) + 'px';
    }

    return null;
}

/* ***
 * hideFunctionAutocomplete - скрытие панели автодополнения с экрана
 * - Параметры отсутствуют
 * - Отключает отображение контейнера подсказок и обнуляет активную ссылку на поле ввода
 * - Возвращает пустое значение null
*** */
function hideFunctionAutocomplete() {
    jsAutocompleteBox.style.display = 'none';
    activeAutocompleteTarget = null;
    return null;
}

/* ***
 * handleElementSelected - обработчик события выделения нового элемента редактора
 * - Принимает объект кастомного события event
 * - Сохраняет активный элемент в глобальный объект, обновляет селекторы и перерисовывает таблицу событий
 * - Возвращает пустое значение null
*** */
function handleElementSelected(event) {
    if (!window.editorBlock) {
        window.editorBlock = {};
    }

    window.editorBlock.selectedElement = event.detail;
    syncSelectorPanel();
    renderEventsTable();

    if (window.editorBlock && typeof window.editorBlock.syncEditors === 'function') {
        window.editorBlock.syncEditors();
    }
    if (window.editorBlock && typeof window.editorBlock.saveHistoryState === 'function') {
        window.editorBlock.saveHistoryState();
    }

    return null;
}

/* ***
 * handleSelectorTypeChange - обработчик изменения типа селектора в списке
 * - Параметры при вызове отсутствуют
 * - Повторно синхронизирует форму под выбранный тип и обновляет таблицу привязок событий
 * - Возвращает пустое значение null
*** */
function handleSelectorTypeChange() {
    syncSelectorPanel();
    renderEventsTable();

    return null;
}

/* ***
 * handleRowFieldChange - обработчик изменения значений полей внутри строки таблицы
 * - Принимает целевой элемент строки таблицы tr
 * - Обновляет привязки в коде скрипта или удаляет строку из структуры при очистке полей ввода
 * - Возвращает пустое значение null
*** */
function handleRowFieldChange(tr) {
    const inputEvent = tr.cells[0].querySelector('input');
    const inputFunc = tr.cells[1].querySelector('input');
    const oldEvent = inputEvent.dataset.oldValue;
    const newEvent = inputEvent.value.trim();
    const handler = inputFunc.value.trim();

    const sourceType = tr.dataset.sourceType || 'script';
    const isEmptyEvent = newEvent === '';
    const isEmptyHandler = handler === '';

    if (isEmptyEvent && isEmptyHandler) {
        if (oldEvent) {
            updateScriptBinding(oldEvent, null, null, true, sourceType);
        }

        if (tr && tr.parentNode) {
            tr.parentNode.removeChild(tr);
        }

        ensureTrailingEmptyRow();
        return null;
    }

    if (isEmptyEvent || isEmptyHandler) {
        if (oldEvent) {
            updateScriptBinding(oldEvent, null, null, true, sourceType);
        }

        ensureTrailingEmptyRow();
        return null;
    }

    updateScriptBinding(oldEvent, newEvent, handler, false, sourceType);
    inputEvent.dataset.oldValue = newEvent;
    inputFunc.dataset.oldValue = handler;
    ensureTrailingEmptyRow();

    return null;
}



/* ===
 * Инициализация интерфейса и базовые подписки на события
=== */

// Добавление слушателей изменений на элементы панели селекторов
selectorTypeSelect.addEventListener('change', handleSelectorTypeChange);
selectorNameInput.addEventListener('input', () => {
    applySelectorToSelectedElement();
});
selectorNameInput.addEventListener('change', () => {
    applySelectorToSelectedElement();
});
selectorClassSelect.addEventListener('change', () => {
    const previousValue = selectorNameInput.value.trim();
    selectorNameInput.value = selectorClassSelect.value;
    applySelectorToSelectedElement(previousValue);
});

// Добавление глобального слушателя события выделения элемента
document.addEventListener('editorBlock:elementSelected', handleElementSelected);

// Добавление слушателя клика по документу для закрытия автодополнения вне формы
document.addEventListener('mousedown', (event) => {
    if (activeAutocompleteTarget && !jsAutocompleteBox.contains(event.target) && event.target !== activeAutocompleteTarget) {
        hideFunctionAutocomplete();
    }
});

// Добавление слушателей изменения размеров экрана и прокрутки для автодополнения
window.addEventListener('scroll', () => {
    if (activeAutocompleteTarget && jsAutocompleteBox.style.display !== 'none') {
        positionAutocompleteBox(activeAutocompleteTarget);
    }
});

window.addEventListener('resize', () => {
    if (activeAutocompleteTarget && jsAutocompleteBox.style.display !== 'none') {
        positionAutocompleteBox(activeAutocompleteTarget);
    }
});