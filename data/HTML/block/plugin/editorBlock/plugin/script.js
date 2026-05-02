/***********************************************************************
 * document keydown — Вставка переноса строки при Enter:
 **********************************************************************/
document.addEventListener('keydown', (e) => {
    const centerEditor = document.getElementById('center-tab-pre-html');
    if (e.key !== 'Enter') return;

    // работаем только если включён contenteditable
    if (!centerEditor.isContentEditable) return;

    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    if (!e.shiftKey) {
        e.preventDefault();

        let currentEl = range.startContainer;
        if (currentEl.nodeType === Node.TEXT_NODE) {
            currentEl = currentEl.parentElement;
        }

        const isAtEnd = (() => {
            if (range.endContainer.nodeType === Node.TEXT_NODE) {
                const isEnd = range.endOffset === range.endContainer.textContent.length;

                if (!isEnd) return false;

                const parent = range.endContainer.parentElement;
                const next = range.endContainer.nextSibling;

                // если сразу после текста уже <br>
                if (next && next.nodeName === 'BR') {
                    return false;
                }

                return true;
            } else {
                const nodes = range.endContainer.childNodes;
                const atEnd = range.endOffset === nodes.length;

                if (!atEnd) return false;

                const prev = nodes[nodes.length - 1];

                // если последний уже <br>
                if (prev && prev.nodeName === 'BR') {
                    return false;
                }

                return true;
            }
        })();

        const isInline = currentEl && getComputedStyle(currentEl).display === 'inline';

        const br = document.createElement('br');
        range.deleteContents();
        range.insertNode(br);

        if (!isInline && isAtEnd) {
            const br2 = document.createElement('br');
            br.after(br2);
        }

        range.setStartAfter(br);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    } else {
        let container = range.commonAncestorContainer;
        if (container.nodeType === Node.TEXT_NODE) {
            container = container.parentElement;
        }

        if (container !== centerEditor) {
            e.preventDefault();

            // вставка узла вне текущего тега
            const exitNode = document.createTextNode('\u00A0');
            container.after(exitNode);

            // перенос курсора
            const newRange = document.createRange();
            newRange.setStart(exitNode, 0);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
        }
    }
});



document.querySelector('#center-panel').addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) {
        e.preventDefault();
    }
});

/***********************************************************************
 * jsTable — таблица редактора JS-кода блока.
 **********************************************************************/
const jsTable = document.getElementById('editor-js-panel');

// Храним введенный id без data-атрибутов на элементе
const activeIdByEl = new WeakMap();


let selectedElBorder = null;
let lastSelectedEl = null;
let isResizing = false;
let startX, startY, startWidth, startHeight;
const margin = 2; // зона границы

document.addEventListener('mousemove', e => {
    if (!selectedElBorder) return;

    const rect = selectedElBorder.getBoundingClientRect();

    if (isResizing) {
        // изменение размеров
        if (isResizing === 'width') {
            selectedElBorder.style.width = startWidth + (e.clientX - startX) + 'px';
        } else if (isResizing === 'height') {
            selectedElBorder.style.height = startHeight + (e.clientY - startY) + 'px';
        }

        // обновляем рамку на текущие размеры
        updateOutline(selectedElBorder);
        return;
    }

    // курсор на границах
    if (e.clientX >= rect.right - margin && e.clientX <= rect.right + margin) {
        document.body.style.cursor = 'e-resize';
    } else if (e.clientY >= rect.bottom - margin && e.clientY <= rect.bottom + margin) {
        document.body.style.cursor = 's-resize';
    } else {
        document.body.style.cursor = '';
    }
});

document.addEventListener('mousedown', e => {
    if (!selectedElBorder) return;

    const rect = selectedElBorder.getBoundingClientRect();
    // правая граница
    if (e.clientX >= rect.right - margin && e.clientX <= rect.right + margin) {
        isResizing = 'width';
        startX = e.clientX;
        startWidth = rect.width;
        e.preventDefault();
    }
    // нижняя граница
    else if (e.clientY >= rect.bottom - margin && e.clientY <= rect.bottom + margin) {
        isResizing = 'height';
        startY = e.clientY;
        startHeight = rect.height;
        e.preventDefault();
    }
});

document.addEventListener('mousemove', e => {
    if (!isResizing) return;

    if (isResizing === 'width') {
        selectedElBorder.style.width = startWidth + (e.clientX - startX) + 'px';
    } else if (isResizing === 'height') {
        selectedElBorder.style.height = startHeight + (e.clientY - startY) + 'px';
    }
});

document.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.style.cursor = '';
});




/* выделеине в view при клике по нему */
document.getElementById('loadedBlock').addEventListener('click', e => {
    const all = document.querySelectorAll('[id^="loadedBlock_"]');
    let active = null;
    for (const el of all) {
        if (!/^loadedBlock_\d+$/.test(el.id)) continue;
        if (getComputedStyle(el).display !== 'none') { active = el; break; }
    }
    if (!active) return;

    const view = document.getElementById(active.id + '_view');
    const sel = window.getSelection();
    if (!view || (sel.rangeCount && view.contains(sel.anchorNode))) return;

    const range = document.createRange();
    range.selectNodeContents(view);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
});




/***********************************************************************
 * Элементы интерфейса вкладок CSS / JS.
 **********************************************************************/
const propertiesPanel = document.getElementById('properties-panel');
const cssPanel = document.getElementById('css-panel');
const jsPanel = document.getElementById('js-panel');
const toggleCssPanel = document.getElementById('toggle-css-panel');

/***********************************************************************
 * Элементы вкладок view / html / js центрального редактора.
 **********************************************************************/
const centerContent = document.getElementById('center-tab-content');
const centerPreHtml = document.getElementById('center-tab-pre-html');
const centerPreJs = document.getElementById('center-tab-pre-js');
/* const btnLoadFromView = document.getElementById('btn-load-from-view');
const btnApplyToView = document.getElementById('btn-apply-to-view'); */

function syncCssPanelVisibility() {
    const cssPanel = document.getElementById('css-panel');
    const toggle = document.getElementById('toggle-css-panel');

    if (!cssPanel || !toggle) {
        return;
    }

    cssPanel.style.display = toggle.checked ? 'flex' : 'none';
}

syncCssPanelVisibility();





// --- Слушатели для панели (делегированно) ------------------------------------

// ввод/изменение в любом контроле применяет свойство немедленно
// но для color-контролов мы управляем через собственный picker
specRoot.addEventListener('input', e => {
    if (!lastHighlightedElement) return;
    const ctrl = e.target.closest('[data-prop]');
    if (!ctrl) return;
    if (ctrl.type === 'color') return; // игнорируем, цвет устанавливается через picker
    const prop = ctrl.getAttribute('data-prop');
    const val = ctrl.type === 'checkbox' ? ctrl.checked : ctrl.value;
    applyPropToElement(lastHighlightedElement, prop, val);
});
specRoot.addEventListener('change', e => {
    if (!lastHighlightedElement) return;
    const ctrl = e.target.closest('[data-prop]');
    if (!ctrl) return;
    if (ctrl.type === 'color') return; // игнорируем color
    const prop = ctrl.getAttribute('data-prop');
    const val = ctrl.type === 'checkbox' ? ctrl.checked : ctrl.value;
    applyPropToElement(lastHighlightedElement, prop, val);
});







/***********************************************************************
 * centerEditor — HTML/Markdown-редактор центра.
 **********************************************************************/
const centerEditor = document.getElementById('center-tab-pre-html');

/***********************************************************************
 * syncActiveBlock — синхронизация активного блока:
 * - Копирует содержимое HTML-редактора в HTML-блок.
 * - Обновляет визуальное представление блока через syncViewFromHtml.
 **********************************************************************/
function syncActiveBlock() {
    const centerEditor = document.getElementById('center-tab-pre-html');
    const tab = document.querySelector('#blocks-tabs .tab.active');
    if (!tab) return;

    const blockId = tab.dataset.blockId;
    const htmlEl = document.getElementById(blockId + '_html');
    if (!htmlEl) return;

    htmlEl.textContent = centerEditor.textContent;
    syncViewFromHtml(blockId);
}

/***********************************************************************
 * Создает объект MarkdownIt с HTML, автоссылками и типографикой
 **********************************************************************/
const md = window.markdownit({ html: true, linkify: true, typographer: true });

/***********************************************************************
 * Хранит идентификатор текущего активного блока
 **********************************************************************/
let activeBlockId = null;
/***********************************************************************
 * Хранит источник последней синхронизации (например, HTML или редактор)
 **********************************************************************/
let activeSyncSource = null;
/***********************************************************************
 * Хранит blockId, которому принадлежит текущее содержимое centerPreJs
 **********************************************************************/
let centerJsBlockId = null;

/***********************************************************************
 * logSync — Проверяет совпадение активного блока с переданным:
 * - Принимает идентификатор следующего блока и источник.
 * - Сравнивает с активным блоком.
 * - Возвращает true, если блоки совпадают.
 **********************************************************************/
function logSync(nextBlockId, nextSource) {
    const sameId = activeBlockId === nextBlockId;
    return sameId;
}

/***********************************************************************
 * syncViewFromHtml — Синхронизирует содержимое HTML-блока с редактором:
 * - Принимает идентификатор блока.
 * - Проверяет, нужно ли обновлять блок через logSync.
 * - Копирует текст из редактора в скрытый HTML и обновляет визуальный блок через Markdown.
 * - Обновляет активный блок и источник синхронизации.
 **********************************************************************/
function syncViewFromHtml(blockId) {
    activeBlockId = blockId;
    activeSyncSource = 'html';

    const canRender = logSync(blockId, 'html');

    const htmlElPre = document.getElementById('center-tab-pre-html');
    const htmlEl = document.getElementById(blockId + '_html');
    const viewEl = document.getElementById(blockId + '_view');
    if (!htmlElPre || !htmlEl || !viewEl) return;

    if (canRender) {
        let content = htmlElPre.textContent.trim();
        if (!content) content = '<div><br></div>';

        const markdownBlocks = [
            /^\s*#/,               // заголовки
            /^\s*\*\*\*.*\*\*\*/, // жирный курсив
            /^\s*\*\*.*\*\*/,     // жирный
            /^\s*\*.*\*/,         // курсив
            /^\s*-/ ,             // маркированный список
            /^\s*\d+\./,          // нумерованный список
            /^\s*>/,              // блок цитаты
            /^\s*```/,            // блок кода
            /^\s*<s>/,            // зачеркнутый
        ];

        const lines = content.split('\n');
        let prevIsMd = false;

        for (let i = 0; i < lines.length; i++) {
            const isMd = markdownBlocks.some(re => re.test(lines[i]));
            if (isMd && !prevIsMd) {
                // добавляем перенос только если предыдущий не Markdown
                lines[i] = '\n' + lines[i];
            }
            prevIsMd = isMd;
        }

        content = lines.join('\n');

        htmlEl.innerHTML = content;
        viewEl.innerHTML = md.render(content);
    }
}

/***********************************************************************
 * syncHtmlFromView — Синхронизирует HTML-блок с визуальным представлением:
 * - Принимает идентификатор блока.
 * - Проверяет, нужно ли обновлять блок через logSync.
 * - Преобразует содержимое визуального блока в смешанный HTML и обновляет HTML-блок.
 * - Обновляет активный блок и источник синхронизации.
 **********************************************************************/
function syncHtmlFromView(blockId) {
    activeBlockId = blockId;
    activeSyncSource = 'view';

    const canRender = logSync(blockId, 'view');

    const viewEl = document.getElementById(blockId + '_view');
    const htmlEl = document.getElementById(blockId + '_html');
    if (!viewEl || !htmlEl) return;

    if (canRender) {
        let mdText = htmlToMixed(viewEl.innerHTML);
        htmlEl.innerHTML = mdText;
        // also reflect changes immediately in the central HTML editor
        const centerPre = document.getElementById('center-tab-pre-html');
        if (centerPre) {
            centerPre.textContent = mdText;
            centerPre.dataset.userEdited = '0';
        }
    }
}

/***********************************************************************
 * nodeToMd — Преобразует HTML-узел в Markdown:
 * - Принимает HTML-узел.
 * - Конвертирует текстовые узлы в текст.
 * - Конвертирует элементы (заголовки, параграфы, списки, ссылки, изображения, код) в Markdown.
 * - Рекурсивно обрабатывает дочерние узлы.
 **********************************************************************/
function nodeToMd(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    const children = [...node.childNodes].map(nodeToMd).join('');

    switch (tag) {
        case 'h1': return '# ' + children.trim() + '\n\n';
        case 'h2': return '## ' + children.trim() + '\n\n';
        case 'h3': return '### ' + children.trim() + '\n\n';
        case 'h4': return '#### ' + children.trim() + '\n\n';
        case 'strong':
        case 'b': return '**' + children + '**';
        case 'em':
        case 'i': return '*' + children + '*';
        case 'p': return children.trim() + '\n\n';
        case 'br': return '  \n';
        case 'ul':
            return '\n' + [...node.children]
                .map(li => '- ' + [...li.childNodes].map(nodeToMd).join('').trim())
                .join('\n') + '\n\n';
        case 'ol':
            return '\n' + [...node.children]
                .map((li, i) =>
                    (i + 1) + '. ' +
                    [...li.childNodes].map(nodeToMd).join('').trim()
                ).join('\n') + '\n\n';
        case 'a':
            return '[' + (children || node.getAttribute('href') || '') + '](' +
                   (node.getAttribute('href') || '') + ')';
        case 'img':
            return '![' + (node.getAttribute('alt') || '') + '](' +
                   (node.getAttribute('src') || '') + ')';
        case 'pre': {
            const code = node.querySelector('code');
            const txt = code ? code.textContent : node.textContent;
            return '\n```\n' + txt.replace(/^\n+|\n+$/g, '') + '\n```\n\n';
        }
        default:
            // сохранить тег целиком, если он не преобразуется в Markdown
            try {
                return node.outerHTML;
            } catch (e) {
                // если по какой-то причине outerHTML недоступен — вернуть дочерний контент
                return children;
            }
    }
}

/***********************************************************************
 * htmlToMixed — Конвертирует HTML в Markdown:
 * - Принимает HTML строку.
 * - Парсит и обрабатывает дочерние узлы через nodeToMd.
 * - Убирает лишние пустые строки.
 * - Возвращает Markdown с переносом строки.
 **********************************************************************/
function htmlToMixed(html) {
    let out = html;
    const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
    const wrapper = doc.body.firstElementChild;
    if (!wrapper) return '\n';

    out = [...wrapper.childNodes]
        .map(nodeToMd)
        .join('')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    out = out ? out + '\n' : '\n'
    return out;
}











/***********************************************************************
 * getActiveBlockId — определение активного блока:
 * - Проверяет активную вкладку и возвращает связанный с ней blockId.
 * - Если вкладка не найдена, ищет видимый блок в контейнере loadedBlockMain.
 * - Возвращает идентификатор активного блока или null при его отсутствии.
 **********************************************************************/
function getActiveBlockId() {
    const tab = document.querySelector('#blocks-tabs .tab.active');
    if (tab && tab.dataset.blockId) return tab.dataset.blockId;

    const container = document.getElementById('loadedBlockMain');
    if (!container) return null;

    for (const ch of container.children) {
        if (getComputedStyle(ch).display !== 'none') return ch.id;
    }
    return null;
}

function saveJsToScript(blockId) {
    const centerPreJs = document.getElementById('center-tab-pre-js');
    // Если centerPreJs содержит код другого блока, не переписывать его
    // Берем содержимое только если это текущий активный блок в редакторе
    let content = '';
    if (centerJsBlockId === blockId) {
        content = centerPreJs.textContent || '';
    }
    
    let textEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    if (!textEl) {
        const wrap = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain');
        textEl = document.createElement('script');
        textEl.setAttribute('data-dynamic-text', blockId + '_view');
        textEl.type = 'text/plain';
        wrap.appendChild(textEl);
    }
    
    // Только обновляем, если был получен контент из centerPreJs (это текущий блок)
    if (centerJsBlockId === blockId) {
        textEl.textContent = content;
    }
}

/***********************************************************************
 * updateCenterControls — управление кнопками центральной панели:
 * - Принимает текущий режим отображения (view / html / js).
 * - Показывает или скрывает кнопку применения JS.
 **********************************************************************/
function updateCenterControls(mode) {
    /* btnLoadFromView.style.display = mode === 'html' ? '' : 'none';
    btnApplyToView.style.display = mode === 'html' ? '' : 'none'; */
    const btnApplyJs = document.getElementById('btn-apply-js');
    if (btnApplyJs) btnApplyJs.style.display = mode === 'js' ? '' : 'none';

    const panel = document.getElementById('center-tab-controls');

    const buttons = panel.querySelectorAll('button');
    const visible = Array.from(buttons).some(btn => btn.style.display !== 'none');

    panel.style.display = visible ? 'flex' : 'none';
}

/***********************************************************************
 * showView — показ блока в режиме визуального просмотра:
 * - Принимает идентификатор блока, который нужно отобразить.
 * - Скрывает область редактирования HTML и JS.
 * - Обновляет состояние кнопок управления в центре.
 * - Отображает только активный блок, скрывая остальные.
 **********************************************************************/
function showView(blockId) {
    centerContent.style.display = 'none';
    updateCenterControls('view');
    const container = document.getElementById('loadedBlockMain');
    if (!container) return;
    Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.small-handle')) ch.style.display = ch.id === blockId ? '' : 'none';
    });
    document.getElementById('loadedBlock').style.display = '';
    document.getElementById('left-panel').style.display = 'flex';
    document.querySelector('#css-js-tabs .tab[data-tab="properties"]').style.display = '';
    document.querySelector('#css-js-tabs .tab[data-tab="properties"]').click();
    ensureJsPanelSelection(blockId);
}

/***********************************************************************
 * showHtml — показ блока в режиме редактирования HTML:
 * - Принимает идентификатор блока.
 * - Показывает HTML-редактор и скрывает JS-редактор.
 * - Обновляет состояние кнопок управления.
 * - Скрывает визуальный режим и отображает только активный блок.
 * - Загружает HTML блока в редактор, если пользователь ещё не редактировал код.
 **********************************************************************/
function showHtml(blockId) {
    const centerPreHtml = document.getElementById('center-tab-pre-html');
    const centerPreJs = document.getElementById('center-tab-pre-js');
    centerContent.style.display = '';
    centerPreHtml.style.display = '';
    centerPreJs.style.display = 'none';
    updateCenterControls('html');

    const container = document.getElementById('loadedBlockMain');
    if (container) Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.small-handle')) ch.style.display = ch.id === blockId ? '' : 'none';
    });
    document.getElementById('loadedBlock').style.display = 'none';

    const htmlContainer = document.getElementById(blockId + '_html');
    centerPreHtml.textContent = htmlContainer.innerHTML;
    document.getElementById('left-panel').style.display = 'none';
    document.querySelector('#css-js-tabs .tab[data-tab="properties"]').style.display = 'none';
    document.querySelector('#css-js-tabs .tab[data-tab="js"]').click();
}

/***********************************************************************
 * showJs — отображение и подготовка JS-кода блока:
 * - Переключает интерфейс в режим редактирования JS.
 * - Извлекает JS-код блока и очищает его от служебной обёртки.
 * - Показывает JS-редактор и скрывает визуальное представление блока.
 **********************************************************************/
function ensureHandlerFunctions(code) {
    const handlerNames = new Set();
    let m;

    // find .onX = handler;
    const onAssignRe = /\.on[a-zA-Z]+\s*=\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
    while ((m = onAssignRe.exec(code)) !== null) {
        handlerNames.add(m[1]);
    }

    // find addEventListener(..., handler)
    const addListenerRe = /\.addEventListener\(\s*['"][^'"]+['"]\s*,\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
    while ((m = addListenerRe.exec(code)) !== null) {
        handlerNames.add(m[1]);
    }

    // собрать уже определенные функции и переменные, присвоенные функциям/стрелочным функциям
    const defined = new Set();
    const funcDefRe = /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    while ((m = funcDefRe.exec(code)) !== null) {
        defined.add(m[1]);
    }
    const varFuncRe = /(?:var|let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:function\b|\()/g;
    while ((m = varFuncRe.exec(code)) !== null) {
        defined.add(m[1]);
    }

    handlerNames.forEach(name => {
        if (!defined.has(name)) {
            code += `\nfunction ${name}() {\n    // автоматически сгенерированный функция\n}\n`;
        }
    });

    return code;
}

function stripJsWrapper(code) {
    // Arrow IIFE with try/catch + optional pageInit
    let out = code
        .replace(/^\s*\(\(\)\s*=>\s*{\s*try\s*{\s*/s, '')
        .replace(/\s*if\s*\(\s*typeof pageInit[\s\S]*?\)\s*pageInit\(\);\s*/s, '')
        .replace(/\s*}\s*catch[\s\S]*?}\s*\}\)\s*\(\s*\)\s*;?\s*$/s, '');

    // Legacy function IIFE wrapper (fallback)
    out = out
        .replace(/^\s*\(function\(\)\s*{\s*try\s*{\s*/s, '')
        .replace(/\s*}\s*catch\s*\(e\)\s*{\s*console\.error\(\"Block script error:\",\s*e\);\s*}\s*}\)\(\);?\s*$/s, '');

    return out;
}

function showJs(blockId, highlightSearch=null) {
    const centerPreHtml = document.getElementById('center-tab-pre-html');
    const centerPreJs = document.getElementById('center-tab-pre-js');
    centerContent.style.display = '';
    centerPreHtml.style.display = 'none';
    centerPreJs.style.display = '';
    updateCenterControls('js');

    const scriptEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    let code = scriptEl ? scriptEl.textContent : '';

    code = stripJsWrapper(code);

    code = ensureHandlerFunctions(code);

    centerPreJs.textContent = code;
    centerJsBlockId = blockId; // отслеживаем, какому блоку принадлежит centerPreJs

    if (highlightSearch) {
        setTimeout(() => {
            highlightInJsEditor(highlightSearch, code);
        }, 0);
    }

    const container = document.getElementById('loadedBlockMain');
    if (container) Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.small-handle')) ch.style.display = 'none';
    });
    document.getElementById('loadedBlock').style.display = 'none';
    document.getElementById('left-panel').style.display = 'none';
    document.querySelector('#css-js-tabs .tab[data-tab="properties"]').style.display = 'none';
    document.querySelector('#css-js-tabs .tab[data-tab="js"]').click();
}




/***********************************************************************
 * Ссылка на текущий выбранный элемент в view.
 **********************************************************************/
window.currentSelectedEl = null;

/***********************************************************************
 * document click — выбор элемента в режиме view:
 * - Обрабатывает клик по элементу внутри блока просмотра.
 * - Определяет выбранный HTML-элемент для редактирования.
 * - Обновляет связанные панели (CSS, свойства, JS).
 **********************************************************************/

function getDefaultJsPanelElement(view) {
    if (!view) return null;
    const all = view.querySelectorAll('*');
    for (const el of all) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style') continue;
        return el;
    }
    return view;
}

function selectElementForPanels(el, resetPrevious = true) {
    if (!el) return;
    if (resetPrevious && lastSelectedEl && lastSelectedEl !== el) {
        delete lastSelectedEl.dataset.selectorType;
    }

    lastSelectedEl = el;
    selectedElBorder = el;

    updateCssPanel(el);
    updateTagLabel(el);
    updateJsPanel(el);
    updateJsPanelName(el);
    updatePropertiesPanel(el);
}

function ensureJsPanelSelection(blockId) {
    const view = document.getElementById(blockId + '_view');
    if (!view) return;

    if (lastSelectedEl && view.contains(lastSelectedEl)) {
        selectElementForPanels(lastSelectedEl, false);
        return;
    }

    const el = getDefaultJsPanelElement(view);
    if (el) selectElementForPanels(el);
}

document.addEventListener('click', e => {
    const clicked = e.target;

    const view = clicked.closest('[id^="loadedBlock_"][id$="_view"]');

    if (!view) {
        if (lastSelectedEl) {
            delete lastSelectedEl.dataset.selectorType;
            lastSelectedEl = null;
        }
        return;
    }

    const el =
        (lastHighlightedElement && view.contains(lastHighlightedElement) && lastHighlightedElement) ||
        view;
    selectElementForPanels(el);
});

/***********************************************************************
 * updateTagLabel — обновление метки тега:
 * - Получает имя тега выбранного элемента.
 * - Отображает его в панели информации.
 **********************************************************************/
function updateTagLabel(el) {
    const label = document.getElementById('tag-label');
    if (!label) return;
    let name = el.tagName.toLowerCase();
    label.textContent = name;
}




/***********************************************************************
 * updateCssPanel — Обновляет панель атрибутов CSS для выбранного элемента:
 * - Принимает HTML элемент.
 * - Заполняет поля ввода ID и класса текущего элемента.
 * - Очищает и заполняет таблицу остальных атрибутов.
 * - Добавляет пустую строку для нового атрибута.
 **********************************************************************/
function updateCssPanel(el) {
    currentSelectedEl = el;
    const attrsTable = document.getElementById('attributes-table');
    if (!attrsTable) return;
    attrsTable.innerHTML = '';
    // include id and class as ordinary attributes first
    if (el.id) createAttrRow('id', el.id);
    if (el.className) createAttrRow('class', el.className);
    const names = el.getAttributeNames().filter(n => n !== 'id' && n !== 'class');
    names.forEach(name => createAttrRow(name, el.getAttribute(name) || ''));
    ensureEmptyAttrRow();
}


/***********************************************************************
 * createAttrRow — Создает строку таблицы атрибутов элемента:
 * - Принимает имя и значение атрибута.
 * - Создает редактируемые ячейки name и value.
 * - Добавляет кнопку удаления, если атрибут задан.
 * - Вставляет строку в таблицу атрибутов.
 **********************************************************************/
function createAttrRow(name, value) {
    const attrsTable = document.getElementById('attributes-table');
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');

    td1.contentEditable = 'true';
    td1.dataset.placeholder = 'name';
    td2.contentEditable = 'true';
    td2.dataset.placeholder = 'value';

    td1.textContent = name || '';
    td2.textContent = value || '';
    td1.dataset.prev = name || '';

    tr.append(td1, td2);

    if (name || value) {
        const td3 = document.createElement('td');
        td3.textContent = '×';
        td3.style.cursor = 'pointer';
        td3.onclick = (e) => {
            e.stopPropagation();
            removeAttrRow(tr, td1);
        };
        tr.appendChild(td3);
    }

    attrsTable.appendChild(tr);
}

/***********************************************************************
 * removeAttrRow — Удаляет строку атрибута из таблицы:
 * - Удаляет атрибут с элемента, если он был задан.
 * - Удаляет строку из таблицы.
 * - Обеспечивает наличие пустой строки для нового атрибута.
 **********************************************************************/
function removeAttrRow(tr, td1) {
    const prev = td1.dataset.prev || '';
    if (prev && currentSelectedEl) {
        currentSelectedEl.removeAttribute(prev);
    }
    tr.remove();
    ensureEmptyAttrRow();
}

/***********************************************************************
 * ensureEmptyAttrRow — Гарантирует наличие пустой строки в таблице атрибутов:
 * - Проверяет последнюю строку таблицы.
 * - Если строки нет или она не пуста, создаёт новую пустую строку.
 **********************************************************************/
function ensureEmptyAttrRow() {
    const t = document.getElementById('attributes-table');
    if (!t) return;

    const last = t.lastElementChild;
    if (
        !last ||
        last.children[0].textContent.trim() ||
        last.children[1].textContent.trim()
    ) {
        createAttrRow('', '');
    }
}


/***********************************************************************
 * getBlockIdFromEl — Определяет id блока по элементу:
 * - Принимает DOM-элемент.
 * - Поднимается по DOM вверх от переданного элемента.
 * - Ищет первый элемент с id, оканчивающимся на "_view".
 * - Возвращает id без суффикса "_view" или null, если такого элемента нет.
 **********************************************************************/
function getBlockIdFromEl(el) {
    let node = el;
    while (node) {
        if (node.id && node.id.endsWith('_view')) return node.id.replace(/_view$/, '');
        node = node.parentElement;
    }
    return null;
}

/***********************************************************************
 * updatePropertiesPanel — Обновляет панель CSS-свойств элемента:
 * - Принимает DOM-элемент.
 * - Определяет id блока и связанные динамические стили.
 * - Парсит CSS правила и сопоставляет их с элементом.
 * - Формирует список селекторов по приоритету (id, классы, тег, matched rules).
 * - Заполняет таблицу свойствами и добавляет строки для новых свойств.
 **********************************************************************/
function updatePropertiesPanel(el) {
    const table = document.getElementById('properties-table');
    if (!table) return;
    table.innerHTML = '';
    const blockId = getBlockIdFromEl(el) || getActiveBlockId() || 'loadedBlock_1';
    let styleEl = document.querySelector('style[data-dynamic="' + blockId + '_view"]');
    const css = styleEl ? styleEl.textContent : '';
    const rules = parseCssToRules(css);
    const existingMap = new Map();
    const existingOrder = [];
    rules.forEach(r => {
        if (!existingMap.has(r.selector)) {
            existingMap.set(r.selector, r.decls);
            existingOrder.push(r.selector);
        }
    });
    const matchedSet = new Set();
    rules.forEach(r => {
        try {
            if (el.matches(r.selector)) matchedSet.add(r.selector);
        } catch (e) {
            const selStripped = r.selector.replace(/::[a-zA-Z0-9\-\(\)]+/g, '').trim();
            try { if (selStripped && el.matches(selStripped)) matchedSet.add(r.selector); } catch (e2) {}
        }
    });
    const candidates = [];
    const id = el.id ? '#' + el.id : null;
    const classes = Array.from(el.classList || []);
    const tag = el.tagName.toLowerCase();
    if (id) candidates.push(id);
    classes.forEach(c => candidates.push('.' + c));
    candidates.push(tag);
    const order = [];
    existingOrder.forEach(s => { if (matchedSet.has(s) && !order.includes(s)) order.push(s); });
    candidates.forEach(s => { if (!order.includes(s)) order.push(s); });
    if (order.length === 0) order.push(buildSelector(el));
    order.forEach(sel => {
        const trSel = document.createElement('tr');
        const tdSel = document.createElement('td');
        tdSel.colSpan = 3;
        tdSel.textContent = sel;
        trSel.appendChild(tdSel);
        table.appendChild(trSel);
        const decls = existingMap.get(sel) || (sel === tag ? (el.getAttribute('style') || '') : '');
        decls.split(';').map(v => v.trim()).filter(Boolean).forEach(line => {
            const i = line.indexOf(':');
            const p = i !== -1 ? line.slice(0, i).trim() : '';
            const v = i !== -1 ? line.slice(i + 1).trim() : '';
            createPropRow(p, v, true);
        });
        createAddPropRow();
    });

    updateSimpleFormats(el);
    updateSelectProperties(el);
}

/***********************************************************************
 * parseCssToRules — Преобразует CSS строку в массив правил:
 * - Принимает CSS строку.
 * - Разбивает её на селекторы и декларации.
 * - Для каждого селектора формирует объект {selector, decls}.
 * - Возвращает массив таких объектов.
 **********************************************************************/
function parseCssToRules(css) {
    const out = [];
    const re = /([^{]+)\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        const selectorText = m[1].trim();
        const decls = m[2].trim();
        const selectors = selectorText.split(',').map(s => s.trim()).filter(Boolean);
        selectors.forEach(sel => out.push({ selector: sel, decls }));
    }
    return out;
}

/***********************************************************************
 * buildSelector — Создает CSS-селектор для элемента по id, классам или тегу.
 * - Принимает DOM-элемент.
 * - Возвращает селектор как строку.
 **********************************************************************/
function buildSelector(el) {
    if (el.id) return '#' + el.id;
    if (el.className) return '.' + el.className.split(' ').filter(Boolean).join('.');
    return el.tagName.toLowerCase();
}

/***********************************************************************
 * createPropRow — Создает строку свойства CSS в таблице:
 * - Принимает имя свойства, значение и флаг удаляемости.
 * - Создает редактируемые ячейки для имени и значения.
 * - Добавляет кнопку удаления, если нужно.
 * - Вставляет строку в таблицу properties-table.
 **********************************************************************/
function createPropRow(prop, val, deletable) {
    const table = document.getElementById('properties-table');
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');
    td1.contentEditable = 'true';
    td1.dataset.placeholder = td1.dataset.placeholder || 'property';
    td2.contentEditable = 'true';
    td2.dataset.placeholder = td2.dataset.placeholder || 'value';
    td1.textContent = prop || '';
    td2.textContent = val || '';
    tr.append(td1, td2);
    if (deletable) {
        const td3 = document.createElement('td');
        td3.textContent = '×';
        td3.style.cursor = 'pointer';
        td3.onclick = (e) => {
            e.stopPropagation();
            tr.remove();
            rebuildStyleForActive();
        };
        tr.appendChild(td3);
    }
    table.appendChild(tr);
}

/***********************************************************************
 * createAddPropRow — Добавляет пустую строку для нового свойства CSS:
 * - Проверяет, что последняя строка таблицы пустая.
 * - Создает редактируемые ячейки для имени и значения.
 * - Вставляет строку в таблицу properties-table.
 **********************************************************************/
function createAddPropRow() {
    const table = document.getElementById('properties-table');
    const last = table.lastElementChild;
    if (last && last.children.length === 2 && !last.children[0].textContent.trim() && !last.children[1].textContent.trim()) return;
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');
    td1.contentEditable = 'true';
    td1.dataset.placeholder = 'property';
    td2.contentEditable = 'true';
    td2.dataset.placeholder = 'value';
    td1.textContent = '';
    td2.textContent = '';
    tr.append(td1, td2);
    table.appendChild(tr);
}

/***********************************************************************
 * ensureAddRowExists — гарантирует наличие пустой строки для нового свойства:
 * - Проверяет последнюю строку таблицы свойств.
 * - Если строки нет или она некорректная, создаёт новую пустую строку.
 * - Иначе восстанавливает плейсхолдеры для имени и значения свойства.
 **********************************************************************/
function ensureAddRowExists() {
    const table = document.getElementById('properties-table');
    const last = table.lastElementChild;
    if (!last || last.children.length !== 2) createAddPropRow();
    else {
        last.children[0].dataset.placeholder = last.children[0].dataset.placeholder || 'property';
        last.children[1].dataset.placeholder = last.children[1].dataset.placeholder || 'value';
    }
}

/***********************************************************************
 * rebuildStyleForActive — обновляет CSS для активного элемента блока:
 * - Считывает все строки таблицы свойств и формирует карту селекторов и их стилей.
 * - Сохраняет порядок существующих правил и добавляет новые.
 * - Генерирует итоговый CSS текст.
 * - Создаёт или обновляет динамический `<style>` для текущего блока.
 **********************************************************************/
function rebuildStyleForActive() {
    if (!currentSelectedEl) return;

    const table = document.getElementById('properties-table');
    if (!table) return;

    // очистка старых inline-стилей
    currentSelectedEl.style.cssText = '';

    const rows = Array.from(table.querySelectorAll('tr'));

    rows.forEach(tr => {
        if (tr.children.length >= 2) {
            const prop = tr.children[0].textContent.trim();
            const val = tr.children[1].textContent.trim();

            if (prop && val) {
                const cssProp = prop.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
                currentSelectedEl.style[cssProp] = val;
            }
        }
    });

    const view = currentSelectedEl.closest('[id^="loadedBlock_"][id$="_view"]');
    if (view) view.dataset.dirty = 'true';
}











let savedRange = null;
let lastEditableElement = null; 

function saveSelection(editableEl) {
    if (!editableEl) return;

    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    const range = sel.getRangeAt(0);

    if (!editableEl.contains(range.commonAncestorContainer)) return;
    
    savedRange = range.cloneRange();
    lastEditableElement = editableEl; 
}

function restoreSelection() {
    if (!savedRange) return;
    
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    
    if (lastEditableElement) {
        lastEditableElement.focus();
    }
}

function trySaveSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    let node = sel.anchorNode;
    
    if (node && node.nodeType === Node.ELEMENT_NODE && node.closest('#rgb-picker')) {
        return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
    }

    const editableEl = node ? node.closest('[contenteditable="true"]') : null;

    if (editableEl) {
        saveSelection(editableEl);
    }
}

// Слушатели для сохранения позиции курсора
document.addEventListener('mouseup', trySaveSelection);
document.addEventListener('keyup', trySaveSelection);

document.getElementById('content').classList.add('editor');





