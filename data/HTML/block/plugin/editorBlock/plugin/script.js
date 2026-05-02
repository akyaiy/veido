document.querySelector('#center-panel').addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) {
        e.preventDefault();
    }
});


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




/**
 * Вспомогательная функция для управления outline
 */
function updateOutline(element) {
    const specRoot = document.getElementById('properties-panel-spec');
    const normalPanel = document.getElementById('properties-panel');
    const root = document.getElementById('loadedBlockMain');

    // 1. Очистка старой обводки у всех элементов в рабочей области
    if (root) {
        const allWithOutline = root.querySelectorAll('[style*="outline"]');
        allWithOutline.forEach(el => {
            el.style.outline = '';
        });
    }

    // 2. Если фокус или клик внутри самой панели свойств — игнорируем, чтобы не сбросить выбор
    if (document.activeElement && document.activeElement.closest('#properties-panel-spec')) {
        return lastHighlightedElement;
    }

    // 3. Если элемент найден и он находится внутри редактируемого контейнера
    if (element && element.closest('[contenteditable="true"]')) {
        const tagName = element.tagName.toLowerCase();
        
        // Визуально выделяем элемент
        element.style.outline = '1px solid #2196F3';
        lastHighlightedElement = element;
        selectedEl = element;

        // Показываем спец-панель и скрываем стандартную
        if (specRoot) specRoot.style.display = 'block';
        if (normalPanel) normalPanel.style.display = 'none';

        if (specRoot) {
            const allFields = specRoot.querySelectorAll('[data-target]');
            
            allFields.forEach(field => {
                const targetAttr = field.getAttribute('data-target') || '';
                const targets = targetAttr.toLowerCase().split(/\s+/).map(t => t.trim());

                // Проверяем: подходит ли поле под текущий тег
                if (targets.includes(tagName) || targets.includes('all')) {
                    // Используем !important через setProperty, чтобы перебить любые другие стили
                    field.style.setProperty('display', 'block', 'important');
                } else {
                    field.style.setProperty('display', 'none', 'important');
                }
            });
        }

    } else {
        // Если кликнули в пустое место (не по редактируемому тегу)
        lastHighlightedElement = null;
        selectedEl = null;
        
        // Показать обычную панель только если вкладка properties активна
        const cssActive = document.querySelector('#css-js-tabs .tab.active');
        if (specRoot) specRoot.style.display = 'none';
        if (normalPanel) normalPanel.style.display = (cssActive && cssActive.dataset.tab === 'properties') ? 'block' : 'none';
    }

    return element;
}