/**
 * Получение активного блока
 * - Сначала проверяет активную вкладку
 * - Если вкладки нет, ищет видимый блок в контейнере
 * - Возвращает id блока или null
 */
window.getActiveBlockId = getActiveBlockId;
function getActiveBlockId() {
    /* Активная вкладка */
    const activeTab = document.querySelector('#blocks-tabs .tab.active');
    if (activeTab && activeTab.dataset.blockId) return activeTab.dataset.blockId;

    /* Контейнер с блоками */
    const container = document.getElementById('loadedBlockMain');
    if (!container) return null;

    /* Поиск видимого блока */
    for (const child of container.children) {
        if (getComputedStyle(child).display !== 'none') return child.id;
    }

    return null;
}



/**
 * Обновление выделения элемента (outline)
 * - Сбрасывает старое выделение
 * - Игнорирует фокус внутри панели свойств
 * - Выделяет элемент и переключает панели
 */
window.updateOutline = updateOutline;
function updateOutline(element) {
    /* Основные контейнеры */
    const specPanel = document.getElementById('propertiesPanel');
    const defaultPanel = document.getElementById('htmlTagsInserter');
    const root = document.getElementById('loadedBlockMain');
    const activeTab = document.querySelector('#panelsSwitcher .tab.active');

    /* Очистка старого outline */
    if (root) {
        const outlinedElements = root.querySelectorAll('[style*="outline"]');
        outlinedElements.forEach(el => {
            el.style.outline = '';
        });
    }

    /* Игнор фокуса внутри панели свойств */
    if (document.activeElement && document.activeElement.closest('#propertiesPanel')) {
        return lastHighlightedElement;
    }

    /* Если есть элемент и он внутри editable */
    if (element && element.closest('[contenteditable="true"]')) {
        const tag = element.tagName.toLowerCase();

        /* Выделение элемента */
        element.style.outline = '1px solid #2196F3';
        lastHighlightedElement = element;
        window.selectedEl = element;

        /* Переключение панелей */
        if (specPanel) specPanel.style.display = 'block';
        if (defaultPanel) defaultPanel.style.display = 'none';

        /* Фильтрация полей панели */
        if (specPanel) {
            const fields = specPanel.querySelectorAll('[data-target]');

            /* Показываем только панели-свойства, что подходят под выбранный тег */
            fields.forEach(field => {
                const targetAttr = field.getAttribute('data-target') || '';
                const targets = targetAttr.toLowerCase().split(/\s+/).map(t => t.trim());

                if (targets.includes(tag) || targets.includes('all')) {
                    field.style.setProperty('display', 'block', 'important');
                } else {
                    field.style.setProperty('display', 'none', 'important');
                }
            });
        }

    } else {
        /* Сброс выбранного элемента */
        lastHighlightedElement = null;
        window.selectedEl = null;

        /* Переключение видимости панелей в зависимости от активной вкладки */
        if (specPanel) specPanel.style.display = 'none';
        if (defaultPanel) {
            if (activeTab && activeTab.dataset.tab === 'properties') {
                defaultPanel.style.display = 'block';
            } else {
                defaultPanel.style.display = 'none';
            }
        }
    }

    return element;
}



/**
 * Показ блока в режиме просмотра
 * - Скрывает редактор
 * - Показывает только выбранный блок
 * - Обновляет панели и контролы
 */
window.showView = showView;
function showView(blockId) {
    /* Основные контейнеры */
    const root = document.getElementById('loadedBlockMain');
    const editor = document.getElementById('editorContent');
    const blocksPanel = document.getElementById('loadedBlocks');
    const leftPanel = document.getElementById('leftPanel');

    /* Контролы */
    const propertiesTab = document.querySelector('#panelsSwitcher .tab[data-tab="properties"]');
    const handle = document.querySelector('.resizeHandle');

    /* Скрытие редактора */
    if (editor) editor.style.display = 'none';

    /* Обновление контролов */
    updateCenterControls('view');

    /* Если нет контейнера — выход */
    if (!root) return;

    /* Отображение только активного блока */
    Array.from(root.children).forEach(child => {
        if (child !== handle) {
            if (child.id === blockId) {
                child.style.display = '';
            } else {
                child.style.display = 'none';
            }
        }
    });

    /* Отображение панелей */
    if (blocksPanel) blocksPanel.style.display = '';
    if (leftPanel) leftPanel.style.display = 'flex';

    /* Переключение на properties */
    if (propertiesTab) {
        propertiesTab.style.display = '';
        propertiesTab.click();
    }

    /* Обновление JS панели */
    ensureJsPanelSelection(blockId);
}

/**
 * Показ блока в режиме редактирования HTML:
 * - Принимает идентификатор блока.
 * - Показывает HTML-редактор и скрывает JS-редактор.
 * - Обновляет состояние кнопок управления.
 * - Скрывает визуальный режим и отображает только активный блок.
 * - Загружает HTML блока в редактор.
 */
window.showHtml = showHtml;
function showHtml(blockId) {
    /* Основные контейнеры */
    const centerContent = document.getElementById('editorContent');
    const centerPreHtml = document.getElementById('center-tab-pre-html');
    const centerPreJs = document.getElementById('center-tab-pre-js');
    const root = document.getElementById('loadedBlockMain');
    const loadedBlocks = document.getElementById('loadedBlocks');
    const leftPanel = document.getElementById('leftPanel');

    /* Контролы */
    const propertiesTab = document.querySelector('#panelsSwitcher .tab[data-tab="properties"]');
    const jsTab = document.querySelector('#panelsSwitcher .tab[data-tab="js"]');
    const handle = document.querySelector('.resizeHandle');

    /* HTML контейнер блока */
    const htmlContainer = document.getElementById(blockId + '_html');

    /* Переключение режима */
    if (centerContent) centerContent.style.display = '';
    if (centerPreHtml) centerPreHtml.style.display = '';
    if (centerPreJs) centerPreJs.style.display = 'none';

    /* Обновление контролов */
    updateCenterControls('html');

    /* Отображение только активного блока */
    if (root) {
        Array.from(root.children).forEach(child => {
            if (child !== handle) {
                if (child.id === blockId) {
                    child.style.display = '';
                } else {
                    child.style.display = 'none';
                }
            }
        });
    }

    /* Скрытие визуального списка блоков */
    if (loadedBlocks) loadedBlocks.style.display = 'none';

    /* Загрузка HTML в редактор */
    if (centerPreHtml && htmlContainer) {
        centerPreHtml.textContent = htmlContainer.innerHTML;
    }

    /* Левая панель */
    if (leftPanel) leftPanel.style.display = 'none';

    /* Панели переключения */
    if (propertiesTab) propertiesTab.style.display = 'none';
    if (jsTab) jsTab.click();
}

/**
 * Показ блока в режиме редактирования JS:
 * - Переключает интерфейс в JS режим
 * - Загружает JS код блока в редактор
 * - Очищает визуальное представление
 * - Скрывает лишние панели
 */
window.showJs = showJs;
function showJs(blockId, highlightSearch = null) {
    /* Основные контейнеры */
    const centerContent = document.getElementById('editorContent');
    const centerPreHtml = document.getElementById('center-tab-pre-html');
    const centerPreJs = document.getElementById('center-tab-pre-js');
    const root = document.getElementById('loadedBlockMain');
    const loadedBlocks = document.getElementById('loadedBlocks');
    const leftPanel = document.getElementById('leftPanel');

    /* Контролы */
    const propertiesTab = document.querySelector('#panelsSwitcher .tab[data-tab="properties"]');
    const jsTab = document.querySelector('#panelsSwitcher .tab[data-tab="js"]');
    const handle = document.querySelector('.resizeHandle');

    /* Переключение режима */
    if (centerContent) centerContent.style.display = '';
    if (centerPreHtml) centerPreHtml.style.display = 'none';
    if (centerPreJs) centerPreJs.style.display = '';

    /* Обновление контролов */
    updateCenterControls('js');

    /* Получение JS кода блока */
    const scriptEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    let code = scriptEl ? scriptEl.textContent : '';

    code = stripJsWrapper(code);
    code = ensureHandlerFunctions(code);

    /* Установка кода в редактор */
    centerPreJs.textContent = code;
    centerJsBlockId = blockId;

    /* Подсветка (опционально) */
    if (highlightSearch) {
        setTimeout(() => {
            highlightInJsEditor(highlightSearch, code);
        }, 0);
    }

    /* Скрытие всех блоков */
    if (root) {
        Array.from(root.children).forEach(child => {
            if (child !== handle) {
                child.style.display = 'none';
            }
        });
    }

    /* Панели */
    if (loadedBlocks) loadedBlocks.style.display = 'none';
    if (leftPanel) leftPanel.style.display = 'none';

    /* Переключение tab состояния */
    if (propertiesTab) propertiesTab.style.display = 'none';
    if (jsTab) jsTab.click();
}

/***********************************************************************
 * highlightInJsEditor — подсвечивает фрагмент кода в панели JS:
 * - Получает строку для поиска и полный текст скрипта.
 * - Находит индекс строки в тексте.
 * - Создаёт диапазон на соответствующем текстовом узле.
 * - Вставляет временный span для подсветки.
 * - Скроллит подсветку в центр видимой области.
 * - Через 800 мс убирает span, оставляя текст без изменений.
 * - Фокусируется на панели кода.
 **********************************************************************/
function highlightInJsEditor(search, fullText) {
    const pre = document.getElementById('center-tab-pre-js');
    if (!pre) return;

    const idx = fullText.indexOf(search);
    if (idx === -1) return;

    let pos = 0;
    let node;
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);

    while ((node = walker.nextNode())) {
        const next = pos + node.length;
        if (idx >= pos && idx < next) {
            const range = document.createRange();
            range.setStart(node, idx - pos);
            range.setEnd(node, Math.min(node.length, idx - pos + search.length));

            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            const span = document.createElement('span');
            range.surroundContents(span);

            span.scrollIntoView({ behavior: 'smooth', block: 'center' });

            setTimeout(() => {
                const parent = span.parentNode;
                while (span.firstChild) parent.insertBefore(span.firstChild, span);
                parent.removeChild(span);
            }, 100);

            pre.focus();
            return;
        }
        pos = next;
    }
}

/**
 * Обеспечение наличия обработчиков событий в JS коде
 * - Ищет используемые имена обработчиков в коде
 * - Проверяет, существуют ли соответствующие функции
 * - Добавляет пустые функции, если их нет
 */
function ensureHandlerFunctions(code) {
    const handlerNames = new Set();
    let match;

    /* Поиск обработчиков через onX = handler */
    const onAssignRe = /\.on[a-zA-Z]+\s*=\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
    while ((match = onAssignRe.exec(code)) !== null) {
        handlerNames.add(match[1]);
    }

    /* Поиск обработчиков через addEventListener */
    const addListenerRe = /\.addEventListener\(\s*['"][^'"]+['"]\s*,\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
    while ((match = addListenerRe.exec(code)) !== null) {
        handlerNames.add(match[1]);
    }

    /* Список уже существующих функций в коде */
    const defined = new Set();

    /* Поиск объявленных функций function name() {} */
    const funcDefRe = /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    while ((match = funcDefRe.exec(code)) !== null) {
        defined.add(match[1]);
    }

    /* Поиск функций, объявленных через переменные fn = function() {} или const fn = () => {} */
    const varFuncRe = /(?:var|let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:function\b|\()/g;
    while ((match = varFuncRe.exec(code)) !== null) {
        defined.add(match[1]);
    }

    /* Добавление недостающих обработчиков */
    handlerNames.forEach(name => {
        if (!defined.has(name)) {
            code += `
function ${name}() {
    // автоматически созданный обработчик
}
`;
        }
    });

    return code;
}

/**
 * Управление кнопками центральной панели
 * - управляет видимостью кнопок в зависимости от режима
 * - скрывает или показывает кнопку применения JS
 * - скрывает панель, если нет доступных кнопок
 */
function updateCenterControls(mode) {
    /* Центральная панель контролов */
    const panel = document.getElementById('controllerContent');

    /* Кнопка применения JS */
    const btnApplyJs = document.getElementById('jsApplyButton');

    /* Управление видимостью кнопки применения JS */
    if (btnApplyJs) {
        if (mode === 'js') {
            btnApplyJs.style.display = '';
        } else {
            btnApplyJs.style.display = 'none';
        }
    }

    if (!panel) return;

    /* Проверка видимости кнопок */
    const buttons = panel.querySelectorAll('button');
    const visible = Array.from(buttons).some(btn =>
        btn.style.display !== 'none'
    );

    /* Управление видимостью панели в зависимости от видимости кнопок */
    panel.style.display = visible ? 'flex' : 'none';
}



/* Текущий выбранный элемент */
window.selectedEl = null;

/* Память о последнем выбранном элементе */
window.lastSelectedEl = null;

/* Управление выбранным элементом и обновлением панелей */
window.selectElementForPanels = selectElementForPanels;
function selectElementForPanels(el, resetPrevious = true) {
    if (!el) return;

    /* Сброс предыдущего выбора при необходимости */
    if (resetPrevious && window.lastSelectedEl && window.lastSelectedEl !== el) {
        delete window.lastSelectedEl.dataset.selectorType;
    }

    /* Обновление состояния выбора */
    window.lastSelectedEl = el;
    window.selectedEl = el;

    /* Обновление всех связанных панелей */
    updateCssPanel(el);
    updateTagLabel(el);
    updateJsPanel(el);
    updateJsPanelName(el);
    updatePropertiesPanel(el);
}



/* Позиция курсора */
let savedRange = null;

/* Последний активный редактируемый элемент */
let lastEditableElement = null;

/**
 * Сохранение текущего выделения курсора
 * - проверяет наличие выделения внутри редактируемого элемента
 * - сохраняет выделение и ссылку на редактируемый элемент
 */
function saveSelection(editableElement) {
    if (!editableElement) return;

    const sel = window.getSelection();

    /* Проверка наличия активного выделения */
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);

    /* Проверка: выделение должно находиться внутри редактируемого элемента */
    if (!editableElement.contains(range.commonAncestorContainer)) return;

    /* Сохранение текущего выделения */
    savedRange = range.cloneRange();

    /* Сохранение активного редактируемого элемента */
    lastEditableElement = editableElement;
}

/**
 * Восстановление сохранённого выделения курсора
 * - проверяет наличие сохранённого диапазона
 * - восстанавливает выделение в документе
 * - возвращает фокус в редактируемый элемент
 */
window.restoreSelection = restoreSelection;
function restoreSelection() {
    if (!savedRange) return;

    const sel = window.getSelection();

    /* Очистка текущего выделения */
    sel.removeAllRanges();

    /* Восстановление сохранённого выделения */
    sel.addRange(savedRange);

    /* Возврат фокуса в редактируемый элемент */
    if (lastEditableElement) lastEditableElement.focus();
}

/**
 * Попытка сохранить позицию курсора
 * - проверяет наличие активного выделения
 * - определяет текущий DOM-узел курсора
 * - игнорирует взаимодействие с rgb-пикером
 * - находит ближайший редактируемый элемент
 * - сохраняет выделение, если оно внутри editable
 */
function trySaveSelection() {
    const sel = window.getSelection();

    /* Нет активного выделения */
    if (!sel || sel.rangeCount === 0) return;

    let node = sel.anchorNode;

    /* Игнорирование элементов внутри rgb-пикера */
    if (node && node.nodeType === Node.ELEMENT_NODE && node.closest('#rgb-picker')) return;

    /* Если это текстовый узел — переходим к родительскому элементу */
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    /* Поиск ближайшего редактируемого элемента */
    const editableElement = node ? node.closest('[contenteditable="true"]') : null;

    /* Сохранение позиции курсора */
    if (editableElement) saveSelection(editableElement);
}

/* Слушатели для сохранения позиции курсора */
document.addEventListener('mouseup', trySaveSelection);
document.addEventListener('keyup', trySaveSelection);



/**
 * Конвертация HTML в Markdown-подобный формат
 * - принимает HTML строку
 * - парсит её через DOMParser
 * - обрабатывает узлы через nodeToMd
 * - возвращает нормализованный Markdown текст
 */
window.htmlToMixed = htmlToMixed;
function htmlToMixed(html) {
    let out = html;

    /* Парсинг HTML в DOM-структуру */
    const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
    const wrapper = doc.body.firstElementChild;

    /* Если структура не распарсилась */
    if (!wrapper) return '\n';

    /* Конвертация узлов в markdown */
    out = [...wrapper.childNodes]
        .map(nodeToMd)
        .join('')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    /* Гарантия завершающего переноса строки */
    out = out ? out + '\n' : '\n';

    return out;
}

/**
 * Преобразование HTML-узла в Markdown
 * - принимает DOM-узел
 * - конвертирует текстовые узлы в текст
 * - преобразует основные HTML-теги в Markdown-разметку
 * - рекурсивно обрабатывает вложенные элементы
 */
function nodeToMd(node) {
    /* Текстовый узел */
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;

    /* Не HTML-элемент */
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();

    /* Рекурсивная обработка дочерних узлов */
    const children = [...node.childNodes]
        .map(nodeToMd)
        .join('');

    /* Конвертация тегов в Markdown */
    switch (tag) {
        case 'h1': return '# ' + children.trim() + '\n\n';
        case 'h2': return '## ' + children.trim() + '\n\n';
        case 'h3': return '### ' + children.trim() + '\n\n';
        case 'h4': return '#### ' + children.trim() + '\n\n';
        case 'strong': case 'b': return '**' + children + '**';
        case 'em': case 'i': return '*' + children + '*';
        case 'p': return children.trim() + '\n\n';
        case 'br': return '  \n';

        case 'ul':
            return '\n' + [...node.children]
                .map(li =>
                    '- ' + [...li.childNodes]
                        .map(nodeToMd)
                        .join('')
                        .trim()
                )
                .join('\n') + '\n\n';
        case 'ol':
            return '\n' + [...node.children]
                .map((li, i) =>
                    (i + 1) + '. ' +
                    [...li.childNodes]
                        .map(nodeToMd)
                        .join('')
                        .trim()
                )
                .join('\n') + '\n\n';
                
        case 'a':
            return '[' +
                (children || node.getAttribute('href') || '') +
                '](' + (node.getAttribute('href') || '') + ')';
        case 'img':
            return '![' +
                (node.getAttribute('alt') || '') +
                '](' + (node.getAttribute('src') || '') + ')';

        case 'pre': {
            const code = node.querySelector('code');
            const txt = code ? code.textContent : node.textContent;
            return '\n```\n' + txt.replace(/^\n+|\n+$/g, '') + '\n```\n\n';
        }

        default:
            /* Сохраняем HTML как есть */
            try {
                return node.outerHTML;
            } catch (e) {
                return children;
            }
    }
}



/**
 * Удаление служебной JS-обёртки блока
 * - убирает arrow IIFE обёртку, try/catch, pageInit
 */
window.stripJsWrapper = stripJsWrapper;
function stripJsWrapper(code) {
    /* Удаление служебной обёртки */
    let out = code
        /* начало обёртки (() => { try { */
        .replace(/^\s*\(\(\)\s*=>\s*{\s*try\s*{\s*/s, '')
        /* вызов pageInit (если присутствует) */
        .replace(/\s*if\s*\(\s*typeof pageInit[\s\S]*?\)\s*pageInit\(\);\s*/s, '')
        /* конец обёртки } catch ... })() */
        .replace(/\s*}\s*catch[\s\S]*?}\s*\}\)\s*\(\s*\)\s*;?\s*$/s, '');

    /* поддерживает удаление старого IIFE варианта (function() { try { ... } catch ... }) */
    out = out
        .replace(/^\s*\(function\(\)\s*{\s*try\s*{\s*/s, '')
        .replace(
            /\s*}\s*catch\s*\(e\)\s*{\s*console\.error\(\"Block script error:\",\s*e\);\s*}\s*}\)\(\);?\s*$/s,
            ''
        );

    return out;
}


/* Блокировка переходов по ссылкам внутри центральной панели */
document.querySelector('#centerPanel').addEventListener('click', (e) => {
    const link = e.target.closest('a');
    /* Если клик был по ссылке — отключаем стандартный переход */
    if (link) {
        e.preventDefault();
    }
});

/* Применение базового класса редактора к контейнеру контента */
document.getElementById('content').classList.add('editor');



/* Автоматическая подстановка SVG-иконок по атрибуту use */
document.addEventListener('initEditorBlocks:ready', () => {
    document.querySelectorAll('svg[use]').forEach(svg => {
        /* Получение значений атрибутов */
        const id = svg.getAttribute('use');
        const color = svg.getAttribute('use-color');
        const background = svg.getAttribute('use-background');

        /* Создание SVG <use> элемента */
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', './static/img/icons.svg#' + id);

        /* Применение цвета */
        if (color) svg.style.color = color;
        else svg.style.color = "#000000";

        /* Применение фона */
        if (background) svg.style.background = background;
        else svg.style.background = "";

        /* Вставка иконки в SVG */
        svg.appendChild(use);
    });
});