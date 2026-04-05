// Патчируем addEventListener заранее
window.__BE_listeners = window.__BE_listeners || [];
if (!window.__BE_add_patched) {
    window.__BE_add_patched = true;
    const origAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, handler, options) {
        if (this === document || this === window) {
            try { window.__BE_listeners.push({target: this, type, handler, options}); } catch(e) {}
        }
        return origAdd.call(this, type, handler, options);
    };

    window.__BE_remove_all = function() {
        try {
            (window.__BE_listeners || []).forEach(l => {
                try { l.target.removeEventListener(l.type, l.handler, l.options); } catch(e) {}
            });
        } finally {
            window.__BE_listeners = [];
        }
    };
}

// Создаем BlockEditorApp
window.BlockEditorApp = (function() {
    const api = {
        destroy() {
            console.log('Удаляем BlockEditorApp и все слушатели');
            window.__BE_remove_all();
            delete window.BlockEditorApp;
        }
    };
/* хранение кода */




window.tempStore.getByRecipient = async () => [{ path: "/pages/example" }];
newLoadedBlock();
window.tempStore.getByRecipient = async () => [{ path: "/pages/test" }];
newLoadedBlock();


document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;

    const editable = e.target.closest('[contenteditable="true"]');
    if (!editable) return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);

    const node = range.startContainer.nodeType === 3
        ? range.startContainer.parentElement
        : range.startContainer;

    // если внутри списка - не трогаем
    if (node.closest('li')) return;

    // ищем block, span не учитывается
    const block = node.closest('block');
    if (!block || !editable.contains(block)) return;

    e.preventDefault();

    const br = document.createElement('br');
    range.deleteContents();
    range.insertNode(br);

    range.setStartAfter(br);
    range.collapse(true);

    sel.removeAllRanges();
    sel.addRange(range);
});



document.querySelector('#center-panel').addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) {
        e.preventDefault();
    }
});

document.querySelector('#center-panel').addEventListener('click', (e) => {
    const table = e.target.closest('table');

    // удалить старые кнопки, если клик вне таблицы
    document.querySelectorAll('.table-controls-btn').forEach(btn => btn.remove());
    if (!table) return;

    // помечаем таблицу уникальным id
    if (!table.dataset._tcid) table.dataset._tcid = String(Math.random()).slice(2);

    table.style.position = table.style.position || 'relative';

    // кнопка справа — добавить столбец
    const btnRight = document.createElement('button');
    btnRight.textContent = '+';
    btnRight.title = 'Добавить столбец справа';
    btnRight.className = 'table-controls-btn';
    btnRight.style.position = 'absolute';
    btnRight.style.width = '16px';
    btnRight.style.height = '16px';
    btnRight.style.top = '10px';
    btnRight.style.right = '-17px';
    btnRight.style.transform = 'translateY(-50%)';
    btnRight.style.fontSize = '12px';
    btnRight.style.opacity = '0.8';
    btnRight.style.padding = '2px';
    table.appendChild(btnRight);

    // кнопка снизу — добавить строку
    const btnBottom = document.createElement('button');
    btnBottom.textContent = '+';
    btnBottom.title = 'Добавить строку снизу';
    btnBottom.className = 'table-controls-btn';
    btnBottom.style.position = 'absolute';
    btnBottom.style.right = '-7px';
    btnBottom.style.bottom = '-17px';
    btnBottom.style.transform = 'translateX(-50%)';
    btnBottom.style.width = '16px';
    btnBottom.style.height = '16px';
    btnBottom.style.fontSize = '12px';
    btnBottom.style.opacity = '0.8';
    btnBottom.style.padding = '2px';
    table.appendChild(btnBottom);

    // добавить столбец
    btnRight.addEventListener('click', ev => {
        ev.stopPropagation();
        Array.from(table.querySelectorAll('tr')).forEach(tr => {
            const td = document.createElement('td');
            td.innerHTML = '<br>';
            tr.appendChild(td);
        });
    });

    // добавить строку
    btnBottom.addEventListener('click', ev => {
        ev.stopPropagation();
        const firstRow = table.querySelector('tr');
        const cols = firstRow ? firstRow.children.length : 1;
        const tr = document.createElement('tr');
        for (let i = 0; i < cols; i++) {
            const td = document.createElement('td');
            td.innerHTML = '<br>';
            tr.appendChild(td);
        }
        const tbody = table.querySelector('tbody');
        if (tbody) tbody.appendChild(tr);
        else table.appendChild(tr);
    });

    // убрать кнопки при клике вне таблицы
    const onDocClick = ev => {
        if (!ev.target.closest('table') || ev.target.closest('.table-controls-btn') === null) {
            document.querySelectorAll('.table-controls-btn').forEach(btn => btn.remove());
            document.removeEventListener('click', onDocClick, true);
        }
    };
    document.addEventListener('click', onDocClick, true);
});


let selectedElBorder = null;
let isResizing = false;
let startX, startY, startWidth, startHeight;
const margin = 2; // зона границы

document.addEventListener('mousemove', e => {
    if (!selectedElBorder || isResizing) return;

    const rect = selectedElBorder.getBoundingClientRect();

    // правая граница
    if (e.clientX >= rect.right - margin && e.clientX <= rect.right + margin) {
        document.body.style.cursor = 'e-resize';
    }
    // нижняя граница
    else if (e.clientY >= rect.bottom - margin && e.clientY <= rect.bottom + margin) {
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

document.addEventListener('dblclick', e => {
    const el = findEditableElement(e.target); // вызываем только на клике
    if (!el) {
        selectedElBorder = null;
        return;
    }

    selectedElBorder = el;
});
document.addEventListener('click', e => {
    updateOutline(null);
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
const tabs = document.querySelectorAll('#css-js-tabs .tab');
const propertiesPanel = document.getElementById('properties-panel');
const cssPanel = document.getElementById('css-panel');
const jsPanel = document.getElementById('js-panel');

/***********************************************************************
 * Элементы вкладок view / html / js центрального редактора.
 **********************************************************************/
const centerTabs = document.querySelectorAll('#center-tabs .center-tab');
const centerContent = document.getElementById('center-tab-content');
const centerPreHtml = document.getElementById('center-tab-pre-html');
const centerPreJs = document.getElementById('center-tab-pre-js');
/* const btnLoadFromView = document.getElementById('btn-load-from-view');
const btnApplyToView = document.getElementById('btn-apply-to-view'); */
const btnApplyJs = document.getElementById('btn-apply-js');

// Сохранение текста JavaScript в блок памяти происходит немедленно при редактировании пользователем JS-редактора (без выполнения).
if (centerPreJs) {
    centerPreJs.addEventListener('input', () => {
        const blockId = getActiveBlockId();
        if (!blockId) return;
        saveJsToScript(blockId);
    });
}

/***********************************************************************
 * switchTabPanel — переключение видимости панелей (properties, css, js):
 * - Принимает имя вкладки: 'properties', 'css' или 'js'.
 * - Показывает соответствующую панель.
 * - Скрывает остальные панели.
 **********************************************************************/
function switchTabPanel(tabName) {
    if (tabName === 'properties') {
        propertiesPanel.style.display = '';
        /* cssPanel.style.display = 'none'; */
        jsPanel.style.display = 'none';
    } else if (tabName === 'css') {
        propertiesPanel.style.display = 'none';
        /* cssPanel.style.display = 'flex'; */
        jsPanel.style.display = 'none';
    } else if (tabName === 'js') {
        propertiesPanel.style.display = 'none';
        /* cssPanel.style.display = 'none'; */
        jsPanel.style.display = 'flex';
        const blockId = getActiveBlockId();
        if (blockId) ensureJsPanelSelection(blockId);
    }

    // если вкладка не properties, прячем панель спец‑свойств
    if (tabName !== 'properties' && specRoot) {
        specRoot.style.display = 'none';
    }
}

/***********************************************************************
 * tabs tab click — переключение вкладок CSS и JS:
 * - Снимает активное состояние со всех вкладок.
 * - Активирует выбранную вкладку.
 * - Отображает соответствующую панель (CSS или JS).
 * - Скрывает неактивную панель.
 **********************************************************************/
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        switchTabPanel(tab.dataset.tab);
    });
});



/***********************************************************************
 * Специальные свойства (рефакторинг: универсальная обработка).
 **********************************************************************/
let selectedEl = null;
const specRoot = document.getElementById('properties-panel-spec');
const normalPanel = document.getElementById('properties-panel');

// по умолчанию скрыть панель специальных свойств
specRoot.style.display = 'none';

// --- конфигурация: какие теги считаем "специальными" ---
const EDITABLE_TAGS = new Set([
    // Базовые и структурные
    'block', 'div', 'a', 'table', 'hr', 'img', 'code',
    // Формы
    'form', 'textarea', 'input', 'select', 'option',
    // Медиа
    'figure', 'figcaption', 'video', 'audio', 'iframe',
    // Интерактив
    'button', 'details', 'summary', 'progress', 'meter'
]);

// --- Утилиты -----------------------------------------------------------------

// Переменная вне функции для хранения текущего подсвеченного элемента
let lastHighlightedElement = null;

// Список тегов, которые не могут содержать другие элементы или текст
const ATOMIC_TAGS = new Set(['img', 'hr', 'input', 'progress', 'meter', 'video', 'audio', 'iframe', 'select']);

function findEditableElement(startNode) {
    // --- НОВАЯ ПРОВЕРКА ДЛЯ ATOMIC TAGS ---
    if (startNode && startNode.nodeType === 1) {
        const startTag = startNode.tagName.toLowerCase();
        if (ATOMIC_TAGS.has(startTag) && EDITABLE_TAGS.has(startTag)) {
            if (!startNode.closest('[contenteditable="true"]')) return updateOutline(null);
            return updateOutline(startNode);
        }
    }

    // 1. Инициализация таргета
    let target = startNode;
    const sel = window.getSelection();
    
    // Если кликнули по тексту, берем текстовую ноду, 
    // если по пустому месту в блоке — оставляем startNode
    if (sel && sel.rangeCount > 0 && target.nodeType !== 1) {
        target = sel.anchorNode;
    }

    if (!target) return updateOutline(null);

    // 2. Поиск контейнера view
    const view = (target.nodeType === 1 ? target : target.parentElement)?.closest?.('[id^="loadedBlock_"][id$="_view"]');
    if (!view) return updateOutline(null);

    // 3. Определяем начальный элемент для обхода
    let el = target.nodeType === Node.TEXT_NODE ? target.parentElement : target;

    // Ссылка имеет приоритет
    if (el.tagName.toLowerCase() === 'a' && EDITABLE_TAGS.has('a')) {
        if (!el.closest('[contenteditable="true"]')) return updateOutline(null);
        return updateOutline(el);
    }

    // 4. Поиск вверх по дереву
    let foundUp = null;
    let upNode = el;
    while (upNode && upNode !== view) {
        if (upNode.nodeType === 1) {
            const tag = upNode.tagName.toLowerCase();
            if (EDITABLE_TAGS.has(tag)) {
                foundUp = upNode;
                break; // Мы нашли ближайший редактируемый элемент — это и есть наша цель
            }
        }
        upNode = upNode.parentElement;
    }

    if (foundUp && !foundUp.closest('[contenteditable="true"]')) {
        return updateOutline(null);
    }

    return updateOutline(foundUp);
}

// Рекурсивный поиск (без изменений)
function searchDownRecursive(element) {
    if (!element || element.nodeType !== 1) return null;
    for (let child of element.children) {
        const tag = child.tagName.toLowerCase();
        if (EDITABLE_TAGS.has(tag)) return child;
        const deep = searchDownRecursive(child);
        if (deep) return deep;
    }
    return null;
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
                const targets = targetAttr.toLowerCase().split(',').map(t => t.trim());

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

// Преобразовать rgb(...) в hex
function rgbToHex(rgb) {
    if (!rgb) return '';
    if (rgb[0] === '#') return rgb;
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return '';
    return '#' + [m[1], m[2], m[3]].map(x => parseInt(x, 10).toString(16).padStart(2, '0')).join('');
}

// Получить округлённое числовое значение CSS (без единицы)
function getComputedNum(v) {
    if (!v && v !== 0) return '';
    const n = parseFloat(v);
    return isNaN(n) ? '' : Math.round(n);
}

function dashedToCamel(s) {
    return s.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

function isNumericString(s) {
    return /^-?\d+(\.\d+)?$/.test(String(s).trim());
}

// --- Универсальная конфигурация маппинга свойств ---------------------------------
const PROP_MAP = {
    // общие стили
    'width-value':     { type: 'style', cssName: 'width', numeric: true },
    'height-value':    { type: 'style', cssName: 'height', numeric: true },
    'background-color':{ type: 'style', cssName: 'backgroundColor', color: true },
    'color':           { type: 'style', cssName: 'color', color: true },
    'font-size':       { type: 'style', cssName: 'fontSize', numeric: true },
    'text-align':      { type: 'style', cssName: 'textAlign' },
    'padding-top':     { type: 'style', cssName: 'paddingTop', numeric: true },
    'padding-right':   { type: 'style', cssName: 'paddingRight', numeric: true },
    'padding-bottom':  { type: 'style', cssName: 'paddingBottom', numeric: true },
    'padding-left':    { type: 'style', cssName: 'paddingLeft', numeric: true },
    'margin-top':      { type: 'style', cssName: 'marginTop', numeric: true },
    'margin-right':    { type: 'style', cssName: 'marginRight', numeric: true },
    'margin-bottom':   { type: 'style', cssName: 'marginBottom', numeric: true },
    'margin-left':     { type: 'style', cssName: 'marginLeft', numeric: true },
    'opacity':         { type: 'style', cssName: 'opacity' },
    'border-width':    { type: 'style', cssName: 'borderWidth', numeric: true },
    'border-style':    { type: 'style', cssName: 'borderStyle' },
    'border-color':    { type: 'style', cssName: 'borderColor', color: true },
    'border-radius':   { type: 'style', cssName: 'borderRadius', numeric: true },
    'img-src':         { type: 'attr', attrName: 'src', tag: 'img' },
    'img-alt':         { type: 'attr', attrName: 'alt', tag: 'img' },
    'link-href':       { type: 'attr', attrName: 'href', tag: 'a' },
    'link-target':     { type: 'attr', attrName: 'target', tag: 'a' },
    'input-placeholder':{ type: 'attr', attrName: 'placeholder', tag: 'input' },
    'input-type':      { type: 'attr', attrName: 'type', tag: 'input' },
    'input-required':  { type: 'attr', attrName: 'required', tag: 'input', booleanAttr: true },
    'table-rows':      { type: 'special', special: 'table-dim' },
    'table-cols':      { type: 'special', special: 'table-dim' },
    'form-method':     { type: 'attr', attrName: 'method', tag: 'form' },
    'form-action':     { type: 'attr', attrName: 'action', tag: 'form' },
    'cursor':          { type: 'style', cssName: 'cursor' },
    'z-index':         { type: 'style', cssName: 'zIndex' },
    'id':               { type: 'attr', attrName: 'id' },
    'video-poster':    { type: 'attr', attrName: 'poster', tag: 'video' },
    'iframe-src':      { type: 'attr', attrName: 'src', tag: 'iframe' },
    'button-type':     { type: 'attr', attrName: 'type', tag: 'button' },
    'details-open':    { type: 'attr', attrName: 'open', tag: 'details', booleanAttr: true },
    'range-min':       { type: 'attr', attrName: 'min', tag: 'input' },
    'range-max':       { type: 'attr', attrName: 'max', tag: 'input' },
    'range-value':     { type: 'attr', attrName: 'value', tag: 'input' },
    'progress-value':  { type: 'attr', attrName: 'value', tag: 'progress' },
    'file-accept':     { type: 'attr', attrName: 'accept', tag: 'input' },
    'file-multiple':   { type: 'attr', attrName: 'multiple', tag: 'input', booleanAttr: true },
    'display':         { type: 'style', cssName: 'display' },
    'resize':          { type: 'style', cssName: 'resize' }
};

// --- Управление видимостью панели ----------------------------------------------
function showSpecForTarget(targetOrEl) {
    // показать панель специальных свойств только если вкладка properties активна
    const activeTab = document.querySelector('#css-js-tabs .tab.active');
    if (!activeTab || activeTab.dataset.tab !== 'properties') {
        if (specRoot && specRoot.style.display !== 'none') {
            specRoot.style.display = 'none';
        }
        if (normalPanel) normalPanel.style.display = 'none';
        return;
    }

    if (normalPanel) normalPanel.style.display = 'none';
    if (typeof jsPanel !== 'undefined' && jsPanel) jsPanel.style.display = 'none';
    specRoot.style.display = '';

    // вычисляем тег и, при необходимости, квалификатор (например input:range или input:file)
    let tag = null, qual = null;
    if (typeof targetOrEl === 'string') {
        const parts = targetOrEl.split(':');
        tag = parts[0];
        qual = parts[1] || null;
    } else if (targetOrEl && targetOrEl.tagName) {
        tag = targetOrEl.tagName.toLowerCase();
        if (tag === 'input') qual = (targetOrEl.getAttribute('type') || '').toLowerCase();
    }

    Array.from(specRoot.querySelectorAll('[data-target]')).forEach(node => {
        const t = node.getAttribute('data-target');
        if (!t) { node.style.display = ''; return; }
        const allowed = t.split(/\s+/);
        let show = false;
        for (const token of allowed) {
            if (token === 'all') { show = true; break; }
            if (tag && token === tag) { show = true; break; }
            if (token.includes(':')) {
                const [aTag, aQual] = token.split(':');
                if (tag === aTag && qual === aQual) { show = true; break; }
            }
        }
        node.style.display = show ? '' : 'none';
    });
}

// --- Чтение значений контролов из элемента (универсально) ----------------------
function populateSpecialProps(el) {
    if (!el) return;
    const cs = window.getComputedStyle(el);

    const controls = Array.from(specRoot.querySelectorAll('[data-prop]'));
    controls.forEach(ctrl => {
        const prop = ctrl.getAttribute('data-prop');
        const map = PROP_MAP[prop] || null;

        // вспомог: установить значение в контрол
        const setCtrl = (value) => {
            if (ctrl.type === 'checkbox') ctrl.checked = Boolean(value);
            else if (ctrl.type === 'color') ctrl.value = value || '#000000';
            else ctrl.value = value == null ? '' : String(value);
        };

        if (map) {
            if (map.type === 'style') {
                const cssName = map.cssName || dashedToCamel(prop);
                // сначала смотреть inline style, затем computed
                let val = el.style[cssName];
                if (!val) {
                    val = cs[cssName] || '';
                }
                // для размеров убрать px
                if (map.numeric) {
                    setCtrl(getComputedNum(val));
                } else if (map.color) {
                    setCtrl(rgbToHex(val) || '');
                } else {
                    setCtrl(val || '');
                }
                return;
            }

            if (map.type === 'attr') {
                // только если тег совпадает (если указано)
                if (map.tag && el.tagName.toLowerCase() !== map.tag) {
                    setCtrl('');
                } else {
                    if (map.booleanAttr) {
                        setCtrl(el.hasAttribute(map.attrName));
                    } else if (map.attrName === 'value') {
                        // для текущих значений value используем свойство, а не только атрибут
                        setCtrl(el.value != null ? el.value : (el.getAttribute('value') || ''));
                    } else {
                        setCtrl(el.getAttribute(map.attrName) || '');
                    }
                }
                return;
            }

            if (map.type === 'special' && map.special === 'table-dim') {
                if (el.tagName === 'TABLE') {
                    const rows = el.querySelectorAll('tr').length || 0;
                    const cols = el.querySelector('tr') ? el.querySelector('tr').children.length : 0;
                    if (prop === 'table-rows') setCtrl(rows);
                    if (prop === 'table-cols') setCtrl(cols);
                } else {
                    setCtrl('');
                }
                return;
            }
        }

        // fallback: пробуем читать как инлайн-стиль или computed по имени свойства
        const cssNameFallback = dashedToCamel(prop);
        let fallbackVal = el.style[cssNameFallback] || cs[cssNameFallback] || '';
        // попытка распознать цвет
        if (ctrl.type === 'color') fallbackVal = rgbToHex(fallbackVal) || '';
        // если значение like '10px' - вынести число
        if (isNumericString(getComputedNum(fallbackVal))) setCtrl(getComputedNum(fallbackVal));
        else setCtrl(fallbackVal);
    });
}

// --- Применение значения из контрола к элементу (универсально) ----------------
function applyPropToElement(el, prop, rawValue) {
    if (!el) return;
    const val = rawValue == null ? '' : rawValue;
    const map = PROP_MAP[prop] || null;

    const markDirty = () => {
        const view = el.closest('[id^="loadedBlock_"][id$="_view"]');
        if (view) view.dataset.dirty = 'true';
    };

    if (map) {
        if (map.type === 'style') {
            const cssName = map.cssName || dashedToCamel(prop);
            if (val === '' || val === null) {
                if (el.tagName.toLowerCase() === 'table' && cssName.startsWith('border')) {
                    Array.from(el.querySelectorAll('td, th')).forEach(cell => cell.style[cssName] = '');
                } else {
                    el.style[cssName] = '';
                }
            } else if (map.color) {
                if (el.tagName.toLowerCase() === 'table' && cssName.startsWith('border')) {
                    Array.from(el.querySelectorAll('td, th')).forEach(cell => cell.style[cssName] = val || '');
                } else {
                    el.style[cssName] = val || '';
                }
            } else if (map.numeric && isNumericString(String(val))) {
                if (el.tagName.toLowerCase() === 'table' && cssName.startsWith('border')) {
                    Array.from(el.querySelectorAll('td, th')).forEach(cell => cell.style[cssName] = String(Number(val)) + 'px');
                } else {
                    el.style[cssName] = String(Number(val)) + 'px';
                }
            } else {
                if (el.tagName.toLowerCase() === 'table' && cssName.startsWith('border')) {
                    Array.from(el.querySelectorAll('td, th')).forEach(cell => cell.style[cssName] = String(val));
                } else {
                    el.style[cssName] = String(val);
                }
            }
            markDirty();
            return;
        }

        if (map.type === 'attr') {
            if (map.tag && el.tagName.toLowerCase() !== map.tag) return;
            if (map.attrName === 'id') {
                // Ищем поле ввода id в панели свойств (обычно через data-prop)
                const inputEl = document.querySelector('[data-prop="id"]');
                const result = syncElementId(val, el, inputEl ? [inputEl] : []);
                if (result.valid) markDirty();
                return;
            }
            if (map.booleanAttr) {
                if (val) el.setAttribute(map.attrName, '');
                else el.removeAttribute(map.attrName);
            } else if (map.attrName === 'value') {
                // для value — менять свойство value, чтобы отразить текущее состояние
                try { el.value = val; } catch (e) { el.setAttribute(map.attrName, String(val)); }
            } else {
                if (val === '') el.removeAttribute(map.attrName);
                else el.setAttribute(map.attrName, String(val));
            }
            markDirty();
            return;
        }

        if (map.type === 'special' && map.special === 'table-dim') {
            if (el.tagName === 'TABLE') {
                const rows = parseInt(specRoot.querySelector('[data-prop="table-rows"]').value || '0', 10) || 0;
                const cols = parseInt(specRoot.querySelector('[data-prop="table-cols"]').value || '0', 10) || 0;
                rebuildTable(el, Math.max(1, rows), Math.max(1, cols));
                markDirty();
            }
            return;
        }
    }

    // fallback: пытаться записать как стиль
    const cssNameFallback = dashedToCamel(prop);
    if (val === '' || val === null) {
        el.style[cssNameFallback] = '';
    } else if (isNumericString(String(val))) {
        el.style[cssNameFallback] = String(Number(val)) + 'px';
    } else {
        el.style[cssNameFallback] = String(val);
    }
    markDirty();
}

// Перестроить таблицу (создать tbody с rows x cols)
function rebuildTable(table, rows, cols) {
    const oldRows = Array.from(table.querySelectorAll('tr'));
    const tbody = document.createElement('tbody');

    for (let r = 0; r < rows; r++) {
        const tr = document.createElement('tr');
        const oldCells = oldRows[r] ? Array.from(oldRows[r].children) : [];

        for (let c = 0; c < cols; c++) {
            let td;
            if (oldCells[c]) {
                td = oldCells[c];
            } else {
                td = document.createElement('td');
                td.innerHTML = '<br>';
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }

    while (table.firstChild) table.removeChild(table.firstChild);
    table.appendChild(tbody);
}

// Сброс выбора: скрыть specRoot, восстановить normalPanel
function clearSelection() {
    selectedEl = null;
    const cssActiveTab = document.querySelector('#css-js-tabs .tab.active');
    if (specRoot.style.display !== 'none' && normalPanel) {
        normalPanel.style.display = (cssActiveTab && cssActiveTab.dataset.tab === 'properties') ? '' : 'none';
    }
    specRoot.style.display = 'none';
    // очистить значения контролов
    specRoot.querySelectorAll('[data-prop]').forEach(inp => {
        if (inp.type === 'checkbox') inp.checked = false;
        else if (inp.type === 'color') inp.value = '#000000';
        else inp.value = '';
    });
}

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

// --- Внешние интерфейсы: выбор элемента и отображение панели ------------------
// функция, которая вызывается извне при выборе элемента (оставлена простая)
function selectElementForEditing(el) {
    selectedEl = el;
    if (!el) { clearSelection(); return; }
    // показать подходящие контролы (передаём сам элемент — функция учтёт тип input)
    showSpecForTarget(el);
    // заполнить контролы значениями элемента
    populateSpecialProps(el);
}

// экспорт/назначение - если модульная среда не используется, оставить глобально
window.BlockEditorSpec = {
    select: selectElementForEditing,
    clear: clearSelection,
    findEditableElement: findEditableElement
};




// --- Взаимодействие с loadedBlock_*_view ------------------------------------

// Левый клик - выбрать элемент (только специальные элементы), не открываем панель
document.addEventListener('dblclick', e => {
    const el = findEditableElement(e.target);
    if (!el) return; // игнорируем клики по тексту и обычным контейнерам
    selectedEl = el;
    populateSpecialProps(selectedEl);
}, true);

// левый клик - открыть properties-panel-spec (скрыть обычную), показать только нужные контролы
document.addEventListener('dblclick', e => {
    const inSpec = !!e.target.closest('#properties-panel-spec');
    if (inSpec) return;
    const editableContainer = e.target.closest('[contenteditable="true"]');
    if (!editableContainer) return;

    const el = findEditableElement(e.target);
    const selection = window.getSelection();
    const hasTextSelection = selection && !selection.isCollapsed;

    if (el && !hasTextSelection) {
        selectedEl = el;
        const tag = el.tagName.toLowerCase();
        let target = 'all';

        // Расширяем поддержку новых тегов
        if (tag === 'img') target = 'img';
        else if (tag === 'a') target = 'a';
        else if (tag === 'input') target = 'input';
        else if (tag === 'table') target = 'table';
        else if (tag === 'block') target = 'block';
        else if (tag === 'video') target = 'video';
        else if (tag === 'audio') target = 'audio';
        else if (tag === 'iframe') target = 'iframe';
        else if (tag === 'details') target = 'details';
        else if (tag === 'textarea') target = 'textarea';
        else if (tag === 'button') target = 'button';
        else if (tag === 'select') target = 'select';
        else if (tag === 'form') target = 'form';
        else if (tag === 'code') target = 'code';
        else if (tag === 'hr') target = 'hr';
        // можно добавить другие, если появятся

        showSpecForTarget(el);
        populateSpecialProps(selectedEl);
        return;
    }

    // clearSelection(); // убрано, чтобы selectedEl сохранялся
});

/* блок свойства */
const menu = document.getElementById('ed-properties');
let clipboard = null;
let tableContext = null; // { table: Element, cell: Element|null }

document.addEventListener('contextmenu', e => {
    e.preventDefault();
    const editableArea = e.target.closest('[contenteditable="true"]');
    if (!editableArea) {
        menu.style.display = 'none';
        tableContext = null;
        return;
    }

    const el = findEditableElement(e.target);
    const selection = window.getSelection();
    const hasTextSelection = selection && !selection.isCollapsed;

    // Контекст таблицы - если кликнут по таблице/ячейке
    const clickedTable = e.target.closest('table');
    const clickedCell = e.target.closest('td,th');
    tableContext = clickedTable ? { table: clickedTable, cell: clickedCell } : null;

    // Скрыть или показать paste (paste отдельно)
    const pasteItem = menu.querySelector('[act="paste"]');
    if (pasteItem) pasteItem.style.display = clipboard ? '' : 'none';

    // Остальные общие пункты меню (для элементов)
    const elementItems = menu.querySelectorAll('.elementProp');
    elementItems.forEach(item => {
        item.style.display = (el && !hasTextSelection) ? '' : 'none';
    });

    // Пункты, специфичные для таблицы
    const tableItems = menu.querySelectorAll('.elementTableProp');
    tableItems.forEach(item => {
        item.style.display = (tableContext && !hasTextSelection) ? '' : 'none';
    });

    // если все пункты (включая paste) скрыты — не показывать меню
    const anyVisible = Array.from(menu.children).some(i => i.style.display !== 'none');
    if (!anyVisible) {
        menu.style.display = 'none';
        tableContext = null;
        return;
    }

    menu.style.display = 'block';
    menu.style.top = e.pageY + 2 + 'px';
    menu.style.left = e.pageX + 2 + 'px';

    if (el && !hasTextSelection) selectedEl = el;
    else clearSelection();
});

document.addEventListener('click', () => { menu.style.display = 'none'; tableContext = null; });
document.addEventListener('input', () => { menu.style.display = 'none'; tableContext = null; });
document.addEventListener('paste', () => { menu.style.display = 'none'; tableContext = null; });

// Обработка нажатий по пунктам меню
menu.addEventListener('click', e => {
    const act = e.target.getAttribute('act');

    switch(act) {
        case 'copy':
            if (!selectedEl) break;
            clipboard = selectedEl.cloneNode(true);
            break;
        case 'cut':
            if (!selectedEl) break;
            clipboard = selectedEl.cloneNode(true);
            selectedEl.remove();
            selectedEl = null;
            break;
        case 'paste':
            if (clipboard) {
                const sel = window.getSelection();
                if (!sel.rangeCount) break;
                const range = sel.getRangeAt(0);
                const clone = clipboard.cloneNode(true);
                range.deleteContents();
                range.insertNode(clone);
                range.setStartAfter(clone);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            break;
        case 'delete':
            if (!selectedEl) break;
            selectedEl.remove();
            selectedEl = null;
            break;

        // таблица - удалить строку
        case 'deleteLine':
            if (!tableContext || !tableContext.table) break;
            {
                const cell = tableContext.cell;
                // если есть конкретная ячейка - удаляем её строку
                if (cell) {
                    const tr = cell.closest('tr');
                    if (tr) tr.remove();
                } else {
                    // иначе удалить последнюю строку
                    const rows = tableContext.table.querySelectorAll('tr');
                    if (rows.length) rows[rows.length - 1].remove();
                }
            }
            break;

        // таблица - удалить столбец
        case 'deleteColumn':
            if (!tableContext || !tableContext.table) break;
            {
                const cell = tableContext.cell;
                let colIndex = null;
                if (cell) {
                    // standard cellIndex works in simple tables
                    colIndex = cell.cellIndex;
                } else {
                    // если нет ячейки - взять последний индекс первой строки
                    const firstRow = tableContext.table.querySelector('tr');
                    if (firstRow && firstRow.children.length) colIndex = firstRow.children.length - 1;
                }
                if (colIndex != null) {
                    Array.from(tableContext.table.querySelectorAll('tr')).forEach(tr => {
                        const cells = tr.children;
                        if (cells[colIndex]) cells[colIndex].remove();
                    });
                }
            }
            break;
    }

    menu.style.display = 'none';
    tableContext = null;
});






/***********************************************************************
 * Элементы интерфейса управления загруженным блоком.
 **********************************************************************/
const handle = document.querySelector('.small-handle');
const loadedBlock = document.getElementById('loadedBlock');

/***********************************************************************
 * Переменные состояния перетаскивания и изменения размера блока.
 **********************************************************************/
let active = false;
let sx, sy, sw, sh;

/***********************************************************************
 * Обновление позиции handle при скролле или изменении размера блока
 **********************************************************************/
function updateHandlePosition() {
    handle.style.display = '';
    handle.style.top = loadedBlock.scrollTop + loadedBlock.clientHeight - handle.offsetHeight - 8 + 'px';
    handle.style.left = loadedBlock.scrollLeft + loadedBlock.clientWidth - handle.offsetWidth - 8 + 'px';
}

/***********************************************************************
 * handle mousedown — начало изменения размера блока
 **********************************************************************/
handle.onmousedown = e => {
    e.preventDefault();
    active = true;
    sx = e.clientX;
    sy = e.clientY;
    sw = loadedBlock.offsetWidth;
    sh = loadedBlock.offsetHeight;

    document.onmousemove = move;
    document.onmouseup = () => {
        active = false;
        document.onmousemove = null;
        updateHandlePosition(); // после отпускания мыши корректируем позицию
    };
};

/***********************************************************************
 * move — обработчик изменения размеров блока
 **********************************************************************/
function move(e) {
    if (!active) return;

    let deltaX = e.clientX - sx;
    let deltaY = e.clientY - sy;

    loadedBlock.style.width = sw + deltaX + 'px';
    loadedBlock.style.height = sh + deltaY + 'px';

    updateHandlePosition(); // handle двигается вместе с прокруткой видимой области
}

/***********************************************************************
 * Обновление позиции при скролле блока
 **********************************************************************/
loadedBlock.addEventListener('click', updateHandlePosition);
loadedBlock.addEventListener('scroll', () => {
    handle.style.display = 'none';
});



/* меню действий */
const menuBtn = document.getElementById('tabs-menu-btn');
const tabsMenu = document.getElementById('tabs-menu');

menuBtn.addEventListener('click', () => {
    tabsMenu.style.display = tabsMenu.style.display === 'none' ? 'flex' : 'none';
});

document.addEventListener('click', (e) => {
    if (!tabsMenu.contains(e.target) && !menuBtn.contains(e.target)) {
        tabsMenu.style.display = 'none';
    }
});

/***********************************************************************
 * Кнопка вкладки "Открыть" и контейнер содержимого.
 **********************************************************************/
const tabOpen = document.getElementById('tab-open');
const content = document.getElementById('content');

/***********************************************************************
 * tabOpen onclick — обработчик клика по вкладке "Открыть":
 * - Создаёт контейнер файлового менеджера.
 * - Добавляет его в основную область контента.
 * - Устанавливает режим нижней панели для загрузки блока.
 * - Инициирует загрузку файлового менеджера.
 **********************************************************************/
tabOpen.onclick = async() => {
    let fm = document.createElement('div');
    fm.id = 'fManager';
    content.appendChild(fm);

    await tempStore.store({path: "/data/HTML/block", listTfootAct: "loadBlock", sender: "editorBlock", callbackFun: "newLoadedBlock"}, { recipient: 'fManager', ttlMs: 5000, destroyOnRead: true })
    loadBlock('plugin/fManager', 'fManager');
};

/***********************************************************************
 * Кнопка вкладки "Новая" и контейнер содержимого.
 **********************************************************************/
const tabNew = document.getElementById('tab-new');

/***********************************************************************
 * tabNew onclick — обработчик клика по вкладке "Новая":
 **********************************************************************/
tabNew.onclick = async() => {
    window.tempStore.getByRecipient = async () => [{ path: "" }];
    newLoadedBlock("");
};

/***********************************************************************
 * newLoadedBlock — загрузка и регистрация нового блока:
 * - Принимает путь к блоку.
 * - Проверяет, открыт ли блок с указанным путём, и активирует его при наличии.
 * - Создаёт новый блок с view / html / scripts контейнерами.
 * - Добавляет вкладку блока с возможностью переключения и закрытия.
 * - Загружает содержимое блока и активирует его отображение.
 **********************************************************************/
async function newLoadedBlock() {
    const viewTab = document.querySelector('#center-tabs .center-tab[data-tab="view"]');
    viewTab.click();

    const path = (await tempStore.getByRecipient("editorBlock"))?.[0]?.path || "";
    let tabs = document.getElementById('blocks-tabs');
    let container = document.getElementById('loadedBlockMain');
    if (!container) {
        container = document.createElement('div');
        container.id = 'loadedBlockMain';
        mainEl.appendChild(container);
    }

    let existingTab;
    if (path) {
        tabs.querySelectorAll('.tab').forEach(t => {
            if (t.dataset.path === path) existingTab = t;
        });
    }
    
function switchTo(blockId, tabEl) {
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');

    Array.from(container.children).forEach(ch => {
        if (ch !== handle) ch.style.display = ch.id === blockId ? '' : 'none';
    });

    // 🔑 ВАЖНО: применяем текущий режим центра
    const activeCenterTab = document.querySelector('#center-tabs .center-tab.active');
    if (!activeCenterTab) return;

    const mode = activeCenterTab.dataset.tab;
    if (mode === 'view') showView(blockId);
    if (mode === 'html') showHtml(blockId);
    if (mode === 'js') showJs(blockId);
}

    if (existingTab) {
        switchTo(existingTab.dataset.blockId, existingTab);
        return;
    }

    let num = 1;
    while (document.getElementById('loadedBlock_' + num)) num++;
    const blockId = 'loadedBlock_' + num;

    const block = document.createElement('div');
    block.id = blockId;

    const viewDiv = document.createElement('div');
    viewDiv.id = blockId + '_view';
    viewDiv.className = 'loadedBlock_view';
    viewDiv.contentEditable = 'true';
    viewDiv.addEventListener('input', () => { viewDiv.dataset.dirty = "true"; syncHtmlFromView(blockId); });

    const htmlDiv = document.createElement('div');
    htmlDiv.id = blockId + '_html';
    htmlDiv.style.display = 'none';

    const cssDiv = document.createElement('div');
    cssDiv.id = blockId + '_css';
    cssDiv.style.display = 'none';

    const scriptsDiv = document.createElement('div');
    scriptsDiv.id = blockId + '_scripts';

    const scriptText = document.createElement('script');
    scriptText.setAttribute('data-dynamic-text', blockId + '_view');
    scriptText.type = 'text/plain';
    scriptsDiv.appendChild(scriptText);

    const jsDiv = document.createElement('div');
    jsDiv.id = blockId + '_js';
    jsDiv.style.display = 'none';

    block.appendChild(viewDiv);
    block.appendChild(htmlDiv);
    block.appendChild(cssDiv);
    block.appendChild(scriptsDiv);
    block.appendChild(jsDiv);
    container.appendChild(block);

    // Наблюдатель: если загрузчик вставит <script> в scriptsDiv позже,
    try {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(m => {
                m.addedNodes.forEach(n => {
                    if (!n || n.nodeType !== 1) return;
                    if (n.tagName !== 'SCRIPT') return;
                    const s = n;
                    // пропускаем служебные скрипты
                    if (s.getAttribute('data-dynamic-text') === blockId + '_view' || s.getAttribute('data-dynamic') === blockId + '_view') return;
                    try {
                        let txt = s.textContent || '';
                        if (!txt && s.src) txt = `// external: ${s.src}`;
                        scriptText.textContent = (scriptText.textContent || '') + '\n' + txt;
                    } catch (e) {}
                    try { s.parentNode && s.parentNode.removeChild(s); } catch (e) {}
                });
            });
        });
        observer.observe(scriptsDiv, { childList: true });
        scriptsDiv._beObserver = observer;
    } catch (e) {}

    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.dataset.path = path || blockId;
    tabEl.dataset.blockId = blockId;
    tabEl.textContent = path ? (path.split('/').filter(Boolean).pop() || path) : "*new";
    tabEl.onclick = () => switchTo(blockId, tabEl);
    tabs.appendChild(tabEl);

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    closeBtn.style.marginLeft = '6px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = e => closeBlock(e, block, tabEl);

    tabEl.appendChild(closeBtn);

    switchTo(blockId, tabEl);

    if (path) await loadBlock(path, viewDiv.id, ["js", "html"]);
    const loadedScript = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
    if (loadedScript) {
        scriptText.textContent = loadedScript.textContent || '';
    }
    if (path) extractContentParts(blockId);
    showJs(blockId);
    showView(blockId);
}
window.newLoadedBlock = newLoadedBlock;

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
    const tab = document.querySelector('#blocks-tabs .tab.active');
    if (!tab) return;

    const blockId = tab.dataset.blockId;
    const htmlEl = document.getElementById(blockId + '_html');
    if (!htmlEl) return;

    htmlEl.textContent = centerEditor.textContent;
    syncViewFromHtml(blockId);
}

/***********************************************************************
 * Асинхронная синхронизация активного блока при input, paste и keydown (Enter / Ctrl+Z / Ctrl+Y).
 **********************************************************************/
const scheduleSync = () => queueMicrotask(syncActiveBlock);
centerEditor.addEventListener('input', scheduleSync);
centerEditor.addEventListener('paste', () => {
    setTimeout(syncActiveBlock, 0);
});
centerEditor.addEventListener('keydown', e =>
    (e.key === 'Enter' || (e.ctrlKey && (e.key === 'z' || e.key === 'y'))) &&
    queueMicrotask(syncActiveBlock)
);

/***********************************************************************
 * CenterEditor keydown — Вставка переноса строки при Enter:
 **********************************************************************/
centerEditor.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;

    // работаем только если включён contenteditable
    if (!centerEditor.isContentEditable) return;

    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    if (!e.shiftKey) {
        e.preventDefault();

        // обычный enter - вставка \n
        const textNode = document.createTextNode('\n');
        range.deleteContents();
        range.insertNode(textNode);

        // перенос курсора после \n
        range.setStartAfter(textNode);
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

/**
* extractContentParts — Перемещает встроенные теги <style> и <script> из представления в блочные контейнеры
* — Сохраняет CSS в <style data-dynamic="blockId_view"> и JS в <script data-dynamic-text="blockId_view"> (только текст)
* — Удаляет исходные встроенные теги из представления, чтобы избежать автоматического выполнения
*/
function extractContentParts(blockId) {
    const viewEl = document.getElementById(blockId + '_view');
    if (!viewEl) return;

    const scriptsDiv = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain');
    const cssDiv = document.getElementById(blockId + '_css');
    const htmlDiv = document.getElementById(blockId + '_html');

   // собирать стили
    viewEl.querySelectorAll('style').forEach(st => {
        try {
            let styleEl = document.querySelector('style[data-dynamic="' + blockId + '_view"]');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.setAttribute('data-dynamic', blockId + '_view');
                (scriptsDiv || document.head).appendChild(styleEl);
            }
            styleEl.textContent = (styleEl.textContent || '') + '\n' + (st.textContent || '');
        } catch (e) {}
        st.parentNode && st.parentNode.removeChild(st);
    });

    // готовим контейнер для скриптов 
    let textEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    if (!textEl && scriptsDiv) {
        textEl = document.createElement('script');
        textEl.setAttribute('data-dynamic-text', blockId + '_view');
        textEl.type = 'text/plain';
        scriptsDiv.appendChild(textEl);
    }

    // также нормализуем любые скрипты, которые были помещены в scriptsDiv загрузчиком: преобразуем их в хранилище текста
    if (scriptsDiv) {
        scriptsDiv.querySelectorAll('script').forEach(s => {
            if (s.getAttribute('data-dynamic-text') === blockId + '_view' || s.getAttribute('data-dynamic') === blockId + '_view') return;
            try {
                textEl.textContent = (textEl.textContent || '') + '\n' + (s.textContent || '');
            } catch (e) {}
            s.parentNode && s.parentNode.removeChild(s);
        });
    }

    // собирать скрипты из представления
    viewEl.querySelectorAll('script').forEach(sc => {
        // пропускаем служебные скрипты
        if (sc.getAttribute('data-dynamic-text') === blockId + '_view' || sc.getAttribute('data-dynamic') === blockId + '_view') return;
        try {
            textEl.textContent = (textEl.textContent || '') + '\n' + (sc.textContent || '');
        } catch (e) {}
        sc.parentNode && sc.parentNode.removeChild(sc);
    });

    // обновляем HTML-контейнер, удаляя встроенные стили и скрипты из представления
    if (htmlDiv) htmlDiv.innerHTML = viewEl.innerHTML;

    // обновляем центральные редакторы
    const centerPre = document.getElementById('center-tab-pre-html');
    if (centerPre) centerPre.textContent = htmlToMixed(viewEl.innerHTML);
    const centerJs = document.getElementById('center-tab-pre-js');
    if (centerJs && textEl) centerJs.textContent = textEl.textContent || '';
}




/***********************************************************************
 * closeBlock — закрытие блока и очистка интерфейса:
 * - Принимает событие клика, элемент блока и вкладку.
 * - Удаляет блок и связанную с ним вкладку.
 * - Сбрасывает содержимое редакторов HTML и JS.
 * - Очищает панели CSS, атрибутов, свойств и событий.
 **********************************************************************/
function closeBlock(e, block, tabEl) {
    e.stopPropagation();
    try {
        const scriptsDiv = block ? block.querySelector('#' + block.id + '_scripts') : null;
        if (scriptsDiv && scriptsDiv._beObserver) {
            try { scriptsDiv._beObserver.disconnect(); } catch (e) {}
            scriptsDiv._beObserver = null;
        }
    } catch (e) {}

    const container = document.getElementById('loadedBlockMain');
    if (container && block) container.removeChild(block);
    if (tabEl.parentNode) tabEl.parentNode.removeChild(tabEl);

    centerPreHtml.textContent = '';
    centerPreJs.textContent = '';
    centerContent.style.display = 'none';
    document.getElementById('loadedBlock').style.display = '';

    const tagLabel = document.getElementById('tag-label');
    if (tagLabel) tagLabel.textContent = 'TAG';

    const attrId = document.getElementById('attr-id');
    const attrClass = document.getElementById('attr-class');
    if (attrId) attrId.value = '';
    if (attrClass) attrClass.value = '';

    const attrTable = document.getElementById('attributes-table');
    if (attrTable) {
        attrTable.innerHTML = '<tr><td contenteditable="true" data-placeholder="name"></td><td contenteditable="true" data-placeholder="value"></td></tr>';
    }

    const propTable = document.getElementById('properties-table');
    if (propTable) {
        propTable.innerHTML = '<tr><td contenteditable="true" data-placeholder="property"></td><td contenteditable="true" data-placeholder="value"></td></tr>';
    }

    const jsTable = document.getElementById('editor-js-panel');
    if (jsTable) {
        jsTable.querySelectorAll('td[contenteditable="true"]').forEach(td => td.textContent = '');
    }

    const cssPanel = document.getElementById('css-panel');
    const jsPanel = document.getElementById('js-panel');
    /* if (cssPanel) cssPanel.style.display = ''; */
    if (jsPanel) jsPanel.style.display = 'none';
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

/***********************************************************************
 * applyJs — применение JavaScript-кода к блоку:
 * - Принимает идентификатор блока.
 * - Получает код из JS-редактора и привязывает его к блоку.
 * - Создаёт или обновляет динамический script-элемент блока.
 * - Оборачивает код в защитную IIFE с обработкой ошибок.
 * - Выполняет обновлённый скрипт для активного блока.
 **********************************************************************/
function runJs(blockId) {
    const textEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    if (!textEl) return;
    const content = textEl.textContent || '';
    if (!content.trim()) return;

    const prev = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

    const exec = document.createElement('script');
    exec.setAttribute('data-dynamic', blockId + '_view');
    exec.type = '';
    exec.textContent = `(function(){try{${content}\nif(typeof pageInit==='function')pageInit();}catch(e){console.error('Block script error:',e);}})();`;
    const wrap = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain') || document.body;
    wrap.appendChild(exec);
    showMarkerModal('JS-код блока успешно применён!');
}
function saveJsToScript(blockId) {
    const content = centerPreJs.textContent || '';
    let textEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    if (!textEl) {
        const wrap = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain');
        textEl = document.createElement('script');
        textEl.setAttribute('data-dynamic-text', blockId + '_view');
        textEl.type = 'text/plain';
        wrap.appendChild(textEl);
    }
    textEl.textContent = content;
}

/***********************************************************************
 * updateCenterControls — управление кнопками центральной панели:
 * - Принимает текущий режим отображения (view / html / js).
 * - Показывает или скрывает кнопку применения JS.
 **********************************************************************/
function updateCenterControls(mode) {
    /* btnLoadFromView.style.display = mode === 'html' ? '' : 'none';
    btnApplyToView.style.display = mode === 'html' ? '' : 'none'; */
    btnApplyJs.style.display = mode === 'js' ? '' : 'none';

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
 * centerPreHtml input — помечает HTML-редактор как изменённый пользователем.
 **********************************************************************/
centerPreHtml.addEventListener('input', () => {
    centerPreHtml.dataset.userEdited = '1';
});

centerPreHtml.addEventListener('paste', e => {
    e.preventDefault();

    const text = e.clipboardData.getData('text/plain');

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);

    range.deleteContents();

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    range.setStartAfter(textNode);
    range.collapse(true);

    sel.removeAllRanges();
    sel.addRange(range);
});

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
    centerContent.style.display = '';
    centerPreHtml.style.display = 'none';
    centerPreJs.style.display = '';
    updateCenterControls('js');

    const scriptEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    let code = scriptEl ? scriptEl.textContent : '';

    code = stripJsWrapper(code);

    code = ensureHandlerFunctions(code);

    centerPreJs.textContent = code;

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
 * centerTabs tab click — переключение режимов просмотра блока:
 * - Обрабатывает клик по вкладкам view / html / js.
 * - Делает выбранную вкладку активной.
 * - Определяет текущий активный блок.
 * - Переключает отображение блока в соответствующий режим.
 **********************************************************************/
centerTabs.forEach(tab => {
    tab.onclick = () => {
        centerTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const blockId = getActiveBlockId();
        if (!blockId) return;
        if (tab.dataset.tab === 'view') showView(blockId);
        if (tab.dataset.tab === 'html') showHtml(blockId);
        if (tab.dataset.tab === 'js') showJs(blockId);
    };
});

/* btnLoadFromView.onclick = () => {
    const blockId = getActiveBlockId();
    if (!blockId) return;
    const view = document.getElementById(blockId + '_view');
    const htmlDiv = document.getElementById(blockId + '_html');
    if (!view || !htmlDiv) return;
    htmlDiv.innerHTML = view.innerHTML;
    centerPreHtml.textContent = htmlDiv.innerHTML;
};

btnApplyToView.onclick = () => {
    const blockId = getActiveBlockId();
    if (!blockId) return;
    const view = document.getElementById(blockId + '_view');
    const htmlDiv = document.getElementById(blockId + '_html');
    if (!view || !htmlDiv) return;

    const md = window.markdownit({ html: true, linkify: true, typographer: true });
    const rendered = centerPreHtml.textContent;

    htmlDiv.innerHTML = rendered;
    view.innerHTML = rendered;
}; */

/***********************************************************************
 * btnApplyJs onclick — применение JS-кода:
 * - Определяет активный блок.
 * - Применяет JS-код из редактора к выбранному блоку.
 **********************************************************************/
btnApplyJs.onclick = () => {
    const blockId = getActiveBlockId();
    if (!blockId) return;
    runJs(blockId);
};
[centerPreJs, centerPreHtml].forEach(el => {
    el.addEventListener('keydown', (e) => {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);

        if (e.key === 'Tab') {
            e.preventDefault();
            const tabNode = document.createTextNode('\t');
            range.deleteContents();
            range.insertNode(tabNode);
            range.setStartAfter(tabNode);
            range.setEndAfter(tabNode);
            sel.removeAllRanges();
            sel.addRange(range);
        }

        if (e.key === 'Enter') {
            e.preventDefault();

            // 1. Получаем ВЕСЬ текст от начала блока до курсора через Range
            const preRange = document.createRange();
            preRange.selectNodeContents(el);
            preRange.setEnd(range.startContainer, range.startOffset);
            const textBefore = preRange.toString();

            // 2. Находим отступ последней строки (табы и пробелы)
            const lines = textBefore.split('\n');
            const currentLine = lines[lines.length - 1];
            const indent = currentLine.match(/^[ \t]*/)[0];

            // 3. Проверяем, есть ли текст ПОСЛЕ курсора
            const afterRange = document.createRange();
            afterRange.selectNodeContents(el);
            afterRange.setStart(range.startContainer, range.startOffset);
            const textAfter = afterRange.toString();

            // Если после курсора ничего нет, нужен "добивочный" \n
            const isAtEnd = textAfter.length === 0;
            const insertText = '\n' + indent + (isAtEnd ? '\n' : '');

            const newNode = document.createTextNode(insertText);
            range.deleteContents();
            range.insertNode(newNode);

            // 4. Устанавливаем курсор строго после \n и indent
            // Смещение = 1 (для \n) + длина отступа
            const newOffset = 1 + indent.length;
            range.setStart(newNode, newOffset);
            range.setEnd(newNode, newOffset);

            sel.removeAllRanges();
            sel.addRange(range);
        }
    });
});







/***********************************************************************
 * Универсальный обработчик вставки элементов из панели
 **********************************************************************/
document.getElementById('elements-ul').addEventListener('click', async e => {
    const el = e.target.closest('.add-el');
    if (!el) return;

    const dataEl = el.dataset.el;
    if (!dataEl) return;

    // wait for both insertion routines to complete so marker prompts finish before
    // any subsequent sync operations are triggered
    await handleLoadedBlockView(dataEl, el.textContent || "текст");
    await handlePreHtml(dataEl, el.textContent || "текст");
    
    const blockId = getActiveBlockId();
    if (!blockId) return;
    
    const activeCenterTab = document.querySelector('#center-tabs .center-tab.active');
    const mode = activeCenterTab ? activeCenterTab.dataset.tab : 'view';
    
    if (mode === 'view') syncHtmlFromView(blockId);
    else if (mode === 'html') syncActiveBlock();
});
document.querySelectorAll('#elements-ul > div > div:first-child').forEach(tab => {
    tab.style.cursor = 'pointer';
    tab.addEventListener('click', () => {
        const content = tab.nextElementSibling;
        if (!content) return;
        content.style.display = content.style.display === 'block' ? 'none' : 'block';
    });
});

/***********************************************************************
 * Вспомогательные функции: парсинг шаблона и маркеров
 **********************************************************************/
function parseDataEl(dataEl) {
    // Возвращает объект: { templateHtml, nodeTemplate (Element|null), tagName, hasST, markers: [] }
    const tpl = document.createElement('template');
    tpl.innerHTML = dataEl.trim();
    const node = tpl.content.firstElementChild;
    const templateHtml = dataEl.trim();
    const tagName = node ? node.tagName.toLowerCase() : (function(){
        const m = dataEl.trim().match(/^<\s*([a-z0-9-]+)/i);
        return m ? m[1].toLowerCase() : null;
    })();

    // Найти маркеры вида [ST], [LINK], [URL], [COUNT], [ATTR:name] и т.д.
    const markers = [];
    const re = /\[([A-Z0-9:_-]+)\]/g;
    let mm;
    while ((mm = re.exec(templateHtml)) !== null) {
        if (!markers.includes(mm[1])) markers.push(mm[1]);
    }

    return {
        templateHtml,
        nodeTemplate: node ? node.cloneNode(true) : null,
        tagName,
        hasST: templateHtml.indexOf('[ST]') !== -1,
        markers
    };
}

function replaceSTInAttributes(el, stValue) {
    // Заменяет [ST] в атрибутах на stValue
    for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        const val = attr.value;
        const newVal = val.replace(/\[ST\]/g, stValue);
        if (newVal !== val) el.setAttribute(attr.name, newVal);
    }
}

function cloneNodeFromTemplate(nodeTemplate, tagName) {
    if (nodeTemplate) return nodeTemplate.cloneNode(true);
    return document.createElement(tagName || 'div');
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/***********************************************************************
 * Helpers: маркеры, замена в узле, поиск места [ST]
 **********************************************************************/
async function askForMarkerValue(marker) {
    const lower = marker.toLowerCase();
    if (lower === 'link' || lower === 'url' || lower === 'image' || lower === 'src') return await showMarkerModal('Введите ссылку (URL)', 'input');
    if (lower === 'count' || lower === 'number') return await showMarkerModal('Введите число', 'input');
    return await showMarkerModal(`Введите значение для ${marker}`, 'input');
}

function replaceMarkersInAttributes(el, markerValues) {
    // Заменяет маркеры в атрибутах, например href="[LINK]" -> href="...".
    for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        const val = attr.value;
        const newVal = val.replace(/\[([A-Z0-9:_-]+)\]/g, (m, name) => {
            return (markerValues[name] !== undefined) ? markerValues[name] : m;
        });
        if (newVal !== val) el.setAttribute(attr.name, newVal);
    }
}

function replaceMarkersInTextNodes(root, markerValues) {
    // Рекурсивно заменяет маркеры в текстовых узлах
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    const toReplace = [];
    while (walker.nextNode()) {
        const txt = walker.currentNode;
        if (/\[([A-Z0-9:_-]+)\]/.test(txt.nodeValue)) toReplace.push(txt);
    }
    toReplace.forEach(txtNode => {
        const newValue = txtNode.nodeValue.replace(/\[([A-Z0-9:_-]+)\]/g, (m, name) => {
            return (markerValues[name] !== undefined) ? markerValues[name] : m;
        });
        const parent = txtNode.parentNode;
        // Если маркер [ST] — оставим маркер-узел (обработается отдельно)
        parent.replaceChild(document.createTextNode(newValue), txtNode);
    });
}

function findSTTextNode(root) {
    // Ищет текстовую ноду или элемент, содержащий точную подпоследовательность "[ST]"
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    while (walker.nextNode()) {
        if (walker.currentNode.nodeValue.indexOf('[ST]') !== -1) return walker.currentNode;
    }
    // если текстовый узел не найден, попробуем найти элемент с текстом '[ST]' как единственный текст
    const nodes = root.querySelectorAll('*');
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.childNodes.length === 1 && n.childNodes[0].nodeType === Node.TEXT_NODE && n.textContent.trim() === '[ST]') return n.childNodes[0];
    }
    return null;
}

function extractSelectionFragment(range) {
    return range.cloneContents();
}

/***********************************************************************
 * performUnwrap — Глубокое удаление тегов с сохранением контента
 * Универсальная версия: действует по tagName / детекции табличного шаблона
 **********************************************************************/
function performUnwrap(node, templateInfo) {
    const parent = node.parentNode;
    if (!parent) return;

    // Если шаблон похож на таблицу (в шаблоне есть td/th) - извлечь из ячеек
    const tplHasCells = (templateInfo.nodeTemplate && (templateInfo.nodeTemplate.querySelector('td') || templateInfo.nodeTemplate.querySelector('th')));
    if (tplHasCells) {
        const cells = node.querySelectorAll('td, th');
        cells.forEach(cell => {
            while (cell.firstChild) parent.insertBefore(cell.firstChild, node);
        });
        parent.removeChild(node);
        return;
    }

    // Общий unwrap
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    parent.removeChild(node);
}

/***********************************************************************
 * handleLoadedBlockView — Универсальная логика Toggle (Unwrap) и вставки
 **********************************************************************/
async function handleLoadedBlockView(dataEl, placeholderText="текст") {
    const sel = document.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    let commonAncestor = range.commonAncestorContainer;
    if (commonAncestor.nodeType !== 1) commonAncestor = commonAncestor.parentNode;

    const view = commonAncestor.closest('[id^="loadedBlock_"][id$="_view"]');
    if (!view) return;

    const parsed = parseDataEl(dataEl);
    const templateHtml = parsed.templateHtml;
    const templateNode = parsed.nodeTemplate;
    const tag = parsed.tagName;
    const hasST = parsed.hasST;
    const selectionHasContent = sel.toString().length > 0;

    // --- 1. Toggle / Unwrap: найдем существующий похожий узел ---
    let targetNode = null;
    if (tag) {
        // closest по тегу
        targetNode = (tag === 'span') ? null : commonAncestor.closest(tag);
    }

    // Если не нашли и шаблон - input-like (нет внутренних текстовых нод), попробуем найти input рядом
    if (!targetNode && tag === 'input') {
        if (range.startContainer.nodeType === 1 && range.startContainer.tagName && range.startContainer.tagName.toLowerCase() === 'input') {
            targetNode = range.startContainer;
        } else if (range.startContainer.childNodes[range.startOffset]?.tagName?.toLowerCase() === 'input') {
            targetNode = range.startContainer.childNodes[range.startOffset];
        }
    }

    // Если в выделении уже есть элементы такого типа - unwrap их (generic)
    if (!targetNode && !range.collapsed) {
        const fragment = range.cloneContents();
        if (fragment.querySelector && tag && fragment.querySelector(tag)) {
            const walker = document.createTreeWalker(view, NodeFilter.SHOW_ELEMENT);
            while (walker.nextNode()) {
                const el = walker.currentNode;
                if (el.tagName.toLowerCase() === tag) {
                    const nodeRange = document.createRange();
                    nodeRange.selectNode(el);
                    if (range.compareBoundaryPoints(Range.END_TO_START, nodeRange) === -1 &&
                        range.compareBoundaryPoints(Range.START_TO_END, nodeRange) === 1) {
                        performUnwrap(el, parsed);
                    }
                }
            }
            view.normalize();
            return;
        }
    }

    if (targetNode && view.contains(targetNode)) {
        performUnwrap(targetNode, parsed);
        view.normalize();
        return;
    }

    // --- 2. Вставка/оборачивание ---
    const newEl = cloneNodeFromTemplate(templateNode, tag);
    // Собираем значения маркеров: спросим у пользователя только те маркеры, которые есть
    const markerValues = {};
    for (const m of parsed.markers) {
        if (m === 'ST') continue; // ST обрабатываем отдельно
        const val = await askForMarkerValue(m);
        if (val !== null) markerValues[m] = val;
        else return
    }

    // Заменим маркеры в атрибутах
    replaceMarkersInAttributes(newEl, markerValues);
    // Заменим [ST] в атрибутах, если нет выделения
    if (hasST && !selectionHasContent) {
        replaceSTInAttributes(newEl, placeholderText);
    }
    // Заменим простые маркеры в текстовых узлах (кроме [ST])
    replaceMarkersInTextNodes(newEl, markerValues);

    // Если шаблон содержит [ST] - оборачиваем/подставляем выбранный текст в место маркера
    // Внутри handleLoadedBlockView, вместо стандартной вставки [ST]
    if (hasST) {
        const stNode = findSTTextNode(newEl);
        placeholderText = placeholderText.trim();

        if (newEl.tagName.toLowerCase() === 'input' || newEl.tagName.toLowerCase() === 'textarea') {
            // для input/textarea подставляем placeholder или текст
            if (selectionHasContent) {
                newEl.value = sel.toString();
            } else {
                newEl.placeholder = placeholderText;
                if (newEl.tagName.toLowerCase() === 'textarea') newEl.textContent = placeholderText;
            }
            range.deleteContents();
            range.insertNode(newEl);
        } else {
            // для обычных элементов с текстом
            if (selectionHasContent) {
                const frag = extractSelectionFragment(range);
                if (stNode) stNode.parentNode.replaceChild(frag, stNode);
                else newEl.appendChild(frag);
                range.deleteContents();
            } else {
                if (stNode) stNode.parentNode.replaceChild(document.createTextNode(placeholderText), stNode);
            }
            range.insertNode(newEl);
        }
    } else {
        if (selectionHasContent) range.deleteContents();
        range.insertNode(newEl);
    }

    // Применить inline-стили, если в шаблоне их не было, сохранить совместимость:
    // (в большинстве случаев новые стили уже в data-el как inline)
    // Переместим курсор после вставленного узла
    sel.removeAllRanges();
    const afterRange = document.createRange();
    afterRange.setStartAfter(newEl);
    afterRange.collapse(true);
    sel.addRange(afterRange);
}

/***********************************************************************
 * handlePreHtml — Вставка HTML кода в текстовый редактор (pre)
 * Использует те же шаблоны, но вставляет текстовый snippet
 **********************************************************************/
async function handlePreHtml(dataEl, placeholderText = "текст") {
    const pre = document.getElementById('center-tab-pre-html');
    if (!pre || pre.contentEditable !== "true") return;

    const sel = document.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    let commonAncestor = range.commonAncestorContainer;
    if (commonAncestor.nodeType !== 1) commonAncestor = commonAncestor.parentNode;
    if (!pre.contains(commonAncestor)) return;

    const parsed = parseDataEl(dataEl);
    const templateHtml = parsed.templateHtml;
    const selectionHasContent = sel.toString().length > 0;

    // Спросим значения для маркеров (кроме ST)
    const markerValues = {};
    for (const m of parsed.markers) {
        if (m === 'ST') continue;
        const v = await askForMarkerValue(m);
        if (v !== null) markerValues[m] = escapeHtml(v);
        else return
    }

    // Подготовим snippet: заменим все маркеры (включая [ST] на содержимое выделения или placeholder)
    let snippet = templateHtml.replace(/\[([A-Z0-9:_-]+)\]/g, (m, name) => {
        if (name === 'ST') {
            if (selectionHasContent) {
                // вставим выбранный HTML (чтобы не экранировать)
                const div = document.createElement('div');
                div.appendChild(range.cloneContents());
                return div.innerHTML;
            }
            return escapeHtml(placeholderText); // без выделения - placeholder
        }
        return (markerValues[name] !== undefined) ? markerValues[name] : m;
    });

    if (selectionHasContent) range.deleteContents();
    const textNode = document.createTextNode(snippet);
    range.insertNode(textNode);

    sel.removeAllRanges();
    const afterRange = document.createRange();
    afterRange.setStartAfter(textNode);
    afterRange.collapse(true);
    sel.addRange(afterRange);
}













/***********************************************************************
 * Ссылка на текущий выбранный элемент в view.
 **********************************************************************/
let currentSelectedEl = null;

/***********************************************************************
 * document click — выбор элемента в режиме view:
 * - Обрабатывает клик по элементу внутри блока просмотра.
 * - Определяет выбранный HTML-элемент для редактирования.
 * - Обновляет связанные панели (CSS, свойства, JS).
 **********************************************************************/
let lastSelectedEl = null;

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

    const el = clicked.closest('[id^="loadedBlock_"][id$="_view"], [id^="loadedBlock_"][id$="_view"] *') || view;
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
 * attr-id input — Синхронизирует ввод ID с текущим элементом:
 * - Принимает событие ввода.
 * - Обновляет ID выбранного элемента или удаляет его, если пусто.
 **********************************************************************/
/* document.getElementById('attr-id')?.addEventListener('input', e => {
    if (!currentSelectedEl) return;
    const v = e.target.value.trim();
    v ? currentSelectedEl.id = v : currentSelectedEl.removeAttribute('id');
});
 */
/***********************************************************************
 * attr-class input — Синхронизирует ввод класса с текущим элементом:
 * - Принимает событие ввода.
 * - Обновляет class выбранного элемента.
 **********************************************************************/
/* document.getElementById('attr-class')?.addEventListener('input', e => {
    if (!currentSelectedEl) return;
    currentSelectedEl.className = e.target.value;
}); */


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
        td3.onclick = () => removeAttrRow(tr, td1);
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
 * attributes-table input — Обновление атрибутов элемента:
 * - Получает событие ввода.
 * - Отслеживает редактирование ячеек name и value.
 * - При изменении name удаляет старый атрибут и ставит новый.
 * - При изменении value обновляет текущий атрибут.
 * - Добавляет кнопку удаления при появлении значения.
 * - Гарантирует наличие пустой строки в конце таблицы.
 **********************************************************************/
const attrsTableElement = document.getElementById('attributes-table');

attrsTableElement?.addEventListener('input', e => {
    const td = e.target.closest('td');
    if (!td) return;

    const tr = td.parentNode;
    const nameTd = tr.children[0];
    const valTd = tr.children[1];

    const prev = nameTd.dataset.prev || '';
    const nameNow = nameTd.textContent.trim();
    const valNow = valTd.textContent;

    if (td === nameTd) {
        if (prev && prev !== nameNow && currentSelectedEl) {
            currentSelectedEl.removeAttribute(prev);
        }
        if (nameNow && currentSelectedEl) {
            if (nameNow === 'id') {
                const result = syncElementId(valNow, currentSelectedEl, [valTd]);
                if (!result.valid) return;
            } else {
                currentSelectedEl.setAttribute(nameNow, valNow);
            }
        }
        nameTd.dataset.prev = nameNow;
    } else {
        if (nameNow && currentSelectedEl) {
            if (nameNow === 'id') {
                const result = syncElementId(valNow, currentSelectedEl, [valTd]);
                if (!result.valid) return;
            } else {
                currentSelectedEl.setAttribute(nameNow, valNow);
            }
        }
    }

    // update class autocomplete if we are editing value of class attribute
    if (td === valTd && nameNow === 'class') {
        updateClassAutocomplete(td);
    }

    if ((nameNow || valNow) && tr.children.length === 2) {
        const td3 = document.createElement('td');
        td3.textContent = '×';
        td3.style.cursor = 'pointer';
        td3.onclick = () => removeAttrRow(tr, nameTd);
        tr.appendChild(td3);
    }

    if (tr === tr.parentNode.lastElementChild && nameNow) {
        ensureEmptyAttrRow();
    }
});

// show autocomplete when focusing value cell of class attribute
attrsTableElement?.addEventListener('focusin', e => {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.parentNode;
    const nameTd = tr.children[0];
    if (td === tr.children[1] && nameTd && nameTd.textContent.trim() === 'class') {
        prepareClassAutocomplete(td);
    }
});

/***********************************************************************
 * attributes-table blur — Обработка потери фокуса ячейки таблицы:
 * - Получает событие потери фокуса.
 * - Определяет ячейку и строку таблицы, к которой относится событие.
 * - Удаляет атрибут у элемента, если имя стало пустым.
 * - Удаляет строку таблицы, если она пустая и не последняя.
 **********************************************************************/
document.getElementById('attributes-table')?.addEventListener('blur', e => {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.parentNode;
    const nameTd = tr.children[0];
    const prev = nameTd.dataset.prev || '';
    const nameNow = nameTd.textContent.trim();
    if (!nameNow && prev && currentSelectedEl) currentSelectedEl.removeAttribute(prev);
    if (!nameNow && tr !== tr.parentNode.lastElementChild) {
        tr.remove();
        ensureEmptyAttrRow();
    }
}, true);


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
        const decls = existingMap.get(sel) || '';
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
        td3.onclick = () => {
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
 * properties-table input — следит за вводом в таблице CSS-свойств:
 * - Получает объект события ввода в таблице.
 * - Берёт имя и значение свойства из этой строки таблицы.
 * - Если свойство новое, добавляет крестик для удаления.
 * - Обновляет стиль выбранного блока на странице.
 * - Всегда оставляет пустую строку для добавления следующего свойства.
 **********************************************************************/
document.getElementById('properties-table')?.addEventListener('input', e => {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.parentNode;
    if (!tr) return;
    if (tr.children.length === 2) {
        const prop = tr.children[0].textContent.trim();
        const val = tr.children[1].textContent.trim();
        if (prop && val) {
            if (!tr.children[2]) {
                const td3 = document.createElement('td');
                td3.textContent = '×';
                td3.style.cursor = 'pointer';
                td3.onclick = () => {
                    tr.remove();
                    rebuildStyleForActive();
                };
                tr.appendChild(td3);
            }
            ensureAddRowExists();
        }
    }
    rebuildStyleForActive();
});

/***********************************************************************
 * properties-table blur — обработка потери фокуса в таблице CSS-свойств:
 * - Получает событие потери фокуса.
 * - Проверяет имя и значение свойства в строке таблицы.
 * - Удаляет пустые строки, кроме последней.
 * - Восстанавливает плейсхолдеры для имени и значения свойства.
 **********************************************************************/
document.getElementById('properties-table')?.addEventListener('blur', e => {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.parentNode;
    if (!tr) return;
    if (tr.children.length === 3) {
        const prop = tr.children[0].textContent.trim();
        const val = tr.children[1].textContent.trim();
        if (!prop && !val) {
            tr.remove();
            rebuildStyleForActive();
        }
    } else if (tr.children.length === 2) {
        const prop = tr.children[0].textContent.trim();
        const val = tr.children[1].textContent.trim();
        if (!prop && !val && tr !== tr.parentNode.lastElementChild) {
            tr.remove();
        } else {
            tr.children[0].dataset.placeholder = tr.children[0].dataset.placeholder || 'property';
            tr.children[1].dataset.placeholder = tr.children[1].dataset.placeholder || 'value';
        }
    }
}, true);

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
    const table = document.getElementById('properties-table');
    if (!table) return;
    const rows = Array.from(table.children);
    const newMap = new Map();
    let currentSelector = null;
    rows.forEach(r => {
        if (r.children.length === 1 || (r.children.length === 1 && r.children[0].colSpan === 3)) {
            currentSelector = r.children[0].textContent.trim();
            if (currentSelector && !newMap.has(currentSelector)) newMap.set(currentSelector, []);
        } else if (r.children.length >= 2 && currentSelector) {
            const p = r.children[0].textContent.trim();
            const v = r.children[1].textContent.trim();
            if (p && v) newMap.get(currentSelector).push(p + ': ' + v + ';');
        }
    });
    const activeEl = currentSelectedEl;
    const blockId = getBlockIdFromEl(activeEl) || getActiveBlockId() || 'loadedBlock_1';
    let styleEl = document.querySelector('style[data-dynamic="' + blockId + '_view"]');
    let existingCss = '';
    if (styleEl) existingCss = styleEl.textContent;
    const existingRules = parseCssToRules(existingCss);
    const existingOrder = existingRules.map(r => r.selector);
    const existingMap = new Map();
    existingRules.forEach(r => {
        if (!existingMap.has(r.selector)) existingMap.set(r.selector, r.decls);
    });
    const processed = new Set();
    const out = [];
    existingOrder.forEach(sel => {
        if (newMap.has(sel)) {
            const decls = newMap.get(sel).join(' ');
            out.push(sel + ' { ' + decls + ' }');
            processed.add(sel);
        } else {
            const decls = existingMap.get(sel);
            if (decls && decls.trim()) out.push(sel + ' { ' + decls + ' }');
        }
    });
    Array.from(newMap.keys()).forEach(sel => {
        if (!processed.has(sel) && sel) {
            const decls = newMap.get(sel).join(' ');
            if (decls) out.push(sel + ' { ' + decls + ' }');
        }
    });
    const cssText = out.join('\n');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.setAttribute('data-dynamic', blockId + '_view');
        const wrap = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain') || document.head;
        wrap.appendChild(styleEl);
    }
    styleEl.textContent = cssText;
}




/***********************************************************************
 * jsTable — таблица редактора JS-кода блока.
 **********************************************************************/
const jsTable = document.getElementById('editor-js-panel');
jsTable.innerHTML = '';

/***********************************************************************
 * Список групп событий для элементов интерфейса.
 **********************************************************************/
const events = [
    [
        'onclick',
        'ondblclick',
        'oncontextmenu'
    ],
    [
        'oninput',
        'onchange',
        'onfocus',
        'onblur',
        'onkeydown',
        'onkeyup',
        'onkeypress'
    ],
    [
        'onmouseover',
        'onmouseout',
        'onmouseenter',
        'onmouseleave',
        'ontouchstart',
        'ontouchmove',
        'ontouchend',
        'onpointerdown',
        'onpointerup',
        'onpointermove'
    ]
];

/***********************************************************************
 * Инициализация интерфейса событий:
 * Создаем панель: слева список всех событий (select), справа кнопка (button)
 **********************************************************************/
const controlsDiv = document.createElement('div');
controlsDiv.className = 'js-panel-controls';
controlsDiv.style.display = 'flex';
controlsDiv.style.gap = '10px';
controlsDiv.style.marginBottom = '15px';

const eventSelect = document.createElement('select');
eventSelect.style.flexGrow = '1';
eventSelect.style.width = '80px';

// Заполняем выпадающий список всеми возможными событиями
events.forEach((group) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = "Group"; // Можно стилизовать или убрать optgroup, если не нужно
    group.forEach(ev => {
        const option = document.createElement('option');
        option.value = ev;
        option.textContent = ev;
        optgroup.appendChild(option);
    });
    eventSelect.appendChild(optgroup);
});

const addBtn = document.createElement('button');
addBtn.textContent = 'Добавить';
addBtn.type = 'button';
addBtn.style.cursor = 'pointer';

controlsDiv.appendChild(eventSelect);
controlsDiv.appendChild(addBtn);

// Вставляем элементы управления перед таблицей
// Предполагается, что jsTable уже существует в DOM
jsTable.parentNode.insertBefore(controlsDiv, jsTable);

// Функция для создания одной строки таблицы
function createEventRow(eventName, handlerName = '', rawStr = null, scriptTxt = '') {
    const tr = document.createElement('tr');
    const tdEvent = document.createElement('td');
    const tdName = document.createElement('td');

    tdEvent.textContent = eventName;
    tdEvent.contentEditable = 'false';

    // клик по событию — перейти в JS с подсветкой обработчика или строки
    tdEvent.style.cursor = 'pointer';
    tdEvent.onclick = () => {
        const jsTab = document.querySelector('#center-tabs .center-tab[data-tab="js"]');
        if (jsTab) jsTab.click();
        const blockId = getActiveBlockId();
        if (!blockId) return;
        // выбираем, что подсвечивать
        let search;
        const name = tdName.textContent.trim();
        if (name) search = 'function ' + name + '(';
        else if (rawStr) search = rawStr;
        if (search) showJs(blockId, search);
    };

    tdName.contentEditable = 'true';
    tdName.dataset.placeholder = 'name';
    tdName.textContent = handlerName;

    // гарантируем, что в ячейку попадёт только текст без HTML
    tdName.addEventListener('input', () => {
        const txt = tdName.textContent;
        if (tdName.innerHTML !== txt) {
            tdName.textContent = txt;
        }
        updateJsNameAutocomplete(tdName);
    });
    tdName.addEventListener('focus', () => {
        prepareJsNameAutocomplete(tdName);
    });

    tr.appendChild(tdEvent);
    tr.appendChild(tdName);
    return tr;
}

// Autocomplete support for handler names in JS panel -------------------
const jsAutoBox = document.createElement('div');
jsAutoBox.id = 'js-autocomplete';
jsAutoBox.style.position = 'absolute';
jsAutoBox.style.background = '#fff';
jsAutoBox.style.border = '1px solid #ccc';
jsAutoBox.style.zIndex = 10000;
jsAutoBox.style.display = 'none';
jsAutoBox.style.maxHeight = '200px';
jsAutoBox.style.overflowY = 'auto';
jsAutoBox.style.overflowX = 'hidden';
jsAutoBox.style.maxWidth = '300px';
jsAutoBox.style.wordBreak = 'break-word';
jsAutoBox.style.fontSize = '12px'; // smaller text to fit viewport
// ensure box doesn't affect layout (absolute already) and hide any overflow

document.body.appendChild(jsAutoBox);

// Autocomplete support for class names when editing class attribute --------
const classAutoBox = document.createElement('div');
classAutoBox.id = 'class-autocomplete';
classAutoBox.style.position = 'absolute';
classAutoBox.style.background = '#fff';
classAutoBox.style.border = '1px solid #ccc';
classAutoBox.style.zIndex = 10000;
classAutoBox.style.display = 'none';
classAutoBox.style.maxHeight = '200px';
classAutoBox.style.overflowY = 'auto';
classAutoBox.style.overflowX = 'hidden';
classAutoBox.style.maxWidth = '300px';
classAutoBox.style.wordBreak = 'break-word';
classAutoBox.style.fontSize = '12px';

document.body.appendChild(classAutoBox);

function parseFunctionNames(code) {
    const names = new Set();
    let m;
    const funcRe = /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    while ((m = funcRe.exec(code)) !== null) names.add(m[1]);
    const varRe = /(?:var|let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:function\b|\()/g;
    while ((m = varRe.exec(code)) !== null) names.add(m[1]);
    return Array.from(names).sort();
}

// --- class name autocomplete helpers --------------------------------------
function gatherClasses(blockId) {
    const view = document.getElementById(blockId + '_view');
    if (!view) return [];
    const set = new Set();
    view.querySelectorAll('[class]').forEach(el => {
        el.classList.forEach(c => set.add(c));
    });
    return Array.from(set).sort();
}

let currentClassAutoTarget = null;
function prepareClassAutocomplete(td) {
    currentClassAutoTarget = td;
    const blockId = getActiveBlockId();
    const list = blockId ? gatherClasses(blockId) : [];
    td.dataset.classNames = JSON.stringify(list);
    showClassAutocomplete(td, '');
}

function updateClassAutocomplete(td) {
    if (currentClassAutoTarget !== td) return;
    const prefix = td.value ? td.value.trim() : td.textContent.trim();
    showClassAutocomplete(td, prefix);
}

function showClassAutocomplete(td, prefix) {
    const list = JSON.parse(td.dataset.classNames || '[]');
    const filtered = prefix ? list.filter(n => n.startsWith(prefix)) : list;
    if (!filtered.length) {
        hideClassAutocomplete();
        return;
    }
    classAutoBox.innerHTML = '';
    filtered.forEach(name => {
        const div = document.createElement('div');
        div.textContent = name;
        div.style.padding = '2px 4px';
        div.style.cursor = 'pointer';
        div.addEventListener('mousedown', e => {
            e.preventDefault();
            if (currentClassAutoTarget) {
                if (currentClassAutoTarget.value !== undefined) currentClassAutoTarget.value = name;
                else currentClassAutoTarget.textContent = name;
                currentClassAutoTarget.focus();
            }
            hideClassAutocomplete();
        });
        classAutoBox.appendChild(div);
    });
    positionClassAutocomplete(td);
    classAutoBox.style.display = '';
}

function positionClassAutocomplete(td) {
    const rect = td.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    const top = rect.bottom + window.scrollY;
    const boxWidth = classAutoBox.offsetWidth || 0;
    const avail = window.innerWidth - 10;
    if (left + boxWidth > avail) {
        left = Math.max(10, avail - boxWidth);
    }
    classAutoBox.style.top = top + 'px';
    classAutoBox.style.left = left + 'px';
    if (top + classAutoBox.offsetHeight > window.innerHeight + window.scrollY) {
        classAutoBox.style.top = (rect.top + window.scrollY - classAutoBox.offsetHeight - 2) + 'px';
    }
}

function hideClassAutocomplete() {
    classAutoBox.style.display = 'none';
    currentClassAutoTarget = null;
}

let currentAutocompleteTarget = null;

function prepareJsNameAutocomplete(td) {
    currentAutocompleteTarget = td;
    const code = centerPreJs ? centerPreJs.textContent || '' : '';
    td.dataset.jsNames = JSON.stringify(parseFunctionNames(code));
    showJsAutocomplete(td, '');
}

function updateJsNameAutocomplete(td) {
    if (currentAutocompleteTarget !== td) return;
    const prefix = td.value ? td.value.trim() : td.textContent.trim();
    showJsAutocomplete(td, prefix);
}

function showJsAutocomplete(td, prefix) {
    const list = JSON.parse(td.dataset.jsNames || '[]');
    const filtered = prefix ? list.filter(n => n.startsWith(prefix)) : list;
    if (!filtered.length) {
        hideJsAutocomplete();
        return;
    }
    jsAutoBox.innerHTML = '';
    filtered.forEach(name => {
        const div = document.createElement('div');
        div.textContent = name;
        div.style.padding = '2px 4px';
        div.style.cursor = 'pointer';
        div.addEventListener('mousedown', e => {
            e.preventDefault();
            if (currentAutocompleteTarget) {
                currentAutocompleteTarget.textContent = name;
                currentAutocompleteTarget.focus();
            }
            hideJsAutocomplete();
        });
        jsAutoBox.appendChild(div);
    });
    positionJsAutocomplete(td);
    jsAutoBox.style.display = '';
}

function positionJsAutocomplete(td) {
    const rect = td.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    const top = rect.bottom + window.scrollY;
    const boxWidth = jsAutoBox.offsetWidth || 0;
    const avail = window.innerWidth - 10; // 10px margin
    if (left + boxWidth > avail) {
        left = Math.max(10, avail - boxWidth);
    }
    jsAutoBox.style.top = top + 'px';
    jsAutoBox.style.left = left + 'px';
    if (top + jsAutoBox.offsetHeight > window.innerHeight + window.scrollY) {
        jsAutoBox.style.top = (rect.top + window.scrollY - jsAutoBox.offsetHeight - 2) + 'px';
    }
}

// reposition when page moves
window.addEventListener('scroll', () => {
    if (currentAutocompleteTarget && jsAutoBox.style.display !== 'none') {
        positionJsAutocomplete(currentAutocompleteTarget);
    }
});
window.addEventListener('resize', () => {
    if (currentAutocompleteTarget && jsAutoBox.style.display !== 'none') {
        positionJsAutocomplete(currentAutocompleteTarget);
    }
    if (currentClassAutoTarget && classAutoBox.style.display !== 'none') {
        positionClassAutocomplete(currentClassAutoTarget);
    }
});

// hide when clicking outside
document.addEventListener('mousedown', e => {
    if (currentAutocompleteTarget && !jsAutoBox.contains(e.target) && e.target !== currentAutocompleteTarget) {
        hideJsAutocomplete();
    }
    if (currentClassAutoTarget && !classAutoBox.contains(e.target) && e.target !== currentClassAutoTarget) {
        hideClassAutocomplete();
    }
});

function hideJsAutocomplete() {
    jsAutoBox.style.display = 'none';
    currentAutocompleteTarget = null;
}

function hideClassAutocomplete() {
    classAutoBox.style.display = 'none';
    currentClassAutoTarget = null;
}


// Логика кнопки "Добавить"
addBtn.addEventListener('click', () => {
    const selectedEv = eventSelect.value;
    
    // Проверяем, есть ли уже такое событие в таблице, чтобы не дублировать
    const existingRows = Array.from(jsTable.querySelectorAll('tr'));
    const exists = existingRows.some(tr => tr.children[0] && tr.children[0].textContent === selectedEv);

    if (!exists) {
        const tr = createEventRow(selectedEv);
        jsTable.appendChild(tr);
        // Сразу фокусируемся на поле ввода имени, чтобы пользователю было удобно печатать
        tr.children[1].focus();
    }
});

// Храним введенный id без data-атрибутов на элементе
const activeIdByEl = new WeakMap();

function getActiveId(el) {
    if (!el) return '';
    if (activeIdByEl.has(el)) return activeIdByEl.get(el) || '';
    return el.id || '';
}

function setActiveId(el, val) {
    if (!el) return;
    activeIdByEl.set(el, val);
}


/***********************************************************************
 * updateJsPanel — обновляет панель JS-событий для выбранного элемента:
 * - Очищает таблицу, оставляя только верхнюю панель управления.
 * - Отрисовывает ТОЛЬКО те события, которые уже назначены элементу.
 * - Поддерживает как id так и class селекторы
 **********************************************************************/
function updateJsPanel(el, updateJsPanelNameTrigger=true) {
    // Инициализируем тип селектора при первом выборе элемента
    if (!el.dataset.selectorType) {
        el.dataset.selectorType = 'id';
    }
    
    // Полностью очищаем таблицу перед обновлением
    jsTable.innerHTML = '';
    if (updateJsPanelNameTrigger) updateJsPanelName(el);

    const blockId = getBlockIdFromEl(el) || getActiveBlockId() || 'loadedBlock_1';
    const script = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    if (!script) return;

    const txt = script.textContent;
    const entries = [];
    const selectorType = el.dataset.selectorType || 'id';

// Поиск addEventListener
    const addListenerRe = /([^\n;]+?)\.addEventListener\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z0-9_$]+|function\b)/g;
    let m;
    while ((m = addListenerRe.exec(txt)) !== null) {
        const rawExpr = m[1].trim();
        let selector = resolveSelectorFromExpr(rawExpr, txt);
        
        // --- ИСПРАВЛЕНИЕ: Вытаскиваем селектор, если это цепочка с querySelectorAll ---
        if (!selector || selector === rawExpr || rawExpr.includes('querySelectorAll')) {
            const qsaMatch = rawExpr.match(/querySelectorAll\(\s*['"]([^'"]+)['"]\s*\)/);
            if (qsaMatch) selector = qsaMatch[1]; // Забираем '.xdfgb'
        }

        entries.push({
            selector,
            event: 'on' + m[2].toLowerCase(),
            handler: m[3].startsWith('function') ? null : m[3],
            raw: m[0]
        });
    }

    // Поиск прямого присваивания (onX = ...)
    const onAssignRe = /([^\n;]+?)\.on([a-zA-Z]+)\s*=\s*([A-Za-z0-9_$]+|function\b)/g;
    while ((m = onAssignRe.exec(txt)) !== null) {
        const rawExpr = m[1].trim();
        let selector = resolveSelectorFromExpr(rawExpr, txt);

        // --- ИСПРАВЛЕНИЕ: То же самое для прямого присваивания ---
        if (!selector || selector === rawExpr || rawExpr.includes('querySelectorAll')) {
            const qsaMatch = rawExpr.match(/querySelectorAll\(\s*['"]([^'"]+)['"]\s*\)/);
            if (qsaMatch) selector = qsaMatch[1]; // Забираем '.xdfgb'
        }

        entries.push({
            selector,
            event: 'on' + m[2].toLowerCase(),
            handler: m[3].startsWith('function') ? null : m[3],
            raw: m[0]
        });
    }

    // Фильтруем те, что относятся именно к выделенному DOM-элементу
    const activeValue = (selectorType === 'id' ? getActiveId(el) : el.dataset.activeClass) || '';

    const matched = entries.filter(en => {
        if (!en.selector || !activeValue) return false;
        
        // Формируем паттерн для поиска конкретного селектора (#id или .class)
        const pattern = selectorType === 'id' ? '#' + activeValue : '.' + activeValue;
        
        // Экранируем для регулярки
        const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Ищем вхождение именно этого класса/id (с границами слова для классов)
        const re = new RegExp('(^|[^a-zA-Z0-9_-])' + esc + '($|[^a-zA-Z0-9_-])', 'i');
        return re.test(en.selector);
    });

    const eventToSelector = new Map();

    // Отрисовываем строки ТОЛЬКО для найденных событий
    if (matched.length) {
        matched.forEach(en => {
            eventToSelector.set(en.event, en.selector);
            const tr = createEventRow(en.event, en.handler || '', en.raw, txt);
            jsTable.appendChild(tr);
        });
    }

    // Всегда обновляем слушатели blur/input, так как пользователь может добавить новое событие кнопкой
    if (jsTable.currentBlurHandler) jsTable.removeEventListener('blur', jsTable.currentBlurHandler, true);
    jsTable.currentBlurHandler = e => onJsTableBlur(e, eventToSelector, blockId, el);
    jsTable.addEventListener('blur', jsTable.currentBlurHandler, true);
    
    if (jsTable.currentInputHandler) jsTable.removeEventListener('input', jsTable.currentInputHandler);
    jsTable.currentInputHandler = e => onJsTableInput(e, eventToSelector, blockId, el);
    jsTable.addEventListener('input', jsTable.currentInputHandler);
}
function updateJsPanelName(el) {
    const typeSelect = document.getElementById('selector-type');
    const nameInputId = document.getElementById('selector-name-id');
    const nameInputClass = document.getElementById('selector-name-class');
    const classSelect = document.getElementById('selector-class');

    // 1. Синхронизируем тип
    const selectorType = el?.dataset?.selectorType || typeSelect.value || 'id';
    typeSelect.value = selectorType;

    // 2. Управляем видимостью полей
    if (selectorType === 'id') {
        nameInputId.style.display = 'block';
        nameInputClass.style.display = 'none';
        classSelect.style.display = 'none';
        
        // Если элемент нажат — берем сохраненный ID или его текущий ID
        if (el) nameInputId.value = getActiveId(el) || '';
    } else {
        nameInputId.style.display = 'none';
        nameInputClass.style.display = 'block';
        
        const classes = el?.className?.split(/\s+/).filter(c => c) || [];
        
        // Показываем селект классов ТОЛЬКО если у нажатого элемента их > 1
        if (el && classes.length > 1) {
            classSelect.style.display = 'block';
            classSelect.innerHTML = '';
            classes.forEach(cls => classSelect.add(new Option(cls, cls)));
            
            // Если в dataset нет активного класса, берем первый
            if (!el.dataset.activeClass || !classes.includes(el.dataset.activeClass)) {
                el.dataset.activeClass = classes[0];
            }
            classSelect.value = el.dataset.activeClass;
            nameInputClass.value = el.dataset.activeClass;
        } else {
            classSelect.style.display = 'none';
            if (el) {
                const singleClass = classes[0] || '';
                nameInputClass.value = singleClass;
                el.dataset.activeClass = singleClass;
            }
        }
    }

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---

    typeSelect.onchange = () => {
        if (el) el.dataset.selectorType = typeSelect.value;
        updateJsPanelName(el);
        updateJsPanel(el);
    };

    // Для ID
    nameInputId.oninput = () => {
        const val = nameInputId.value.trim();
        setActiveId(el, val);
        updateJsPanel(el, false);
    };

    // Для Class
    nameInputClass.oninput = () => {
        const val = nameInputClass.value.trim();
        if (el) el.dataset.activeClass = val;
        
        // Если пользователь начал менять текст вручную — скрываем селект (логика из п.3)
        classSelect.style.display = 'none';
        
        updateJsPanel(el, false);
    };

    // Переключение через селект
    classSelect.onchange = () => {
        const val = classSelect.value;
        nameInputClass.value = val;
        if (el) el.dataset.activeClass = val;
        updateJsPanel(el, false);
    };
}

/***********************************************************************
 * onJsTableInput — обновляет имя обработчика JS-события при редактировании:
 * - Получает объект события, карту событий-селекторов, ID блока и элемент DOM.
 * - Проверяет, что редактируется именно имя обработчика.
 * - Берёт текст события и нового обработчика.
 * - Находит селектор для события через карту или строит его.
 * - Вызывает updateScriptAssignment для сохранения изменений в скрипте.
 **********************************************************************/
function onJsTableInput(e, eventToSelectorMap, blockId, el) {
    const td = e.target.closest('td');
    if (!td || td.cellIndex !== 1) return; // Редактируем только колонку с именем (индекс 1)

    const tr = td.parentNode;
    const ev = tr.children[0].textContent.trim();
    const handler = td.textContent.trim();

    // Валидация: разрешаем пустую строку (для удаления) или корректное имя функции
    if (handler !== "" && !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(handler)) return;

    // Определяем селектор: либо из карты, либо текущий активный (ID или выбранный класс)
    let selector = eventToSelectorMap.get(ev);
    if (!selector) {
        selector = (el.dataset.selectorType === 'id'
            ? '#' + (getActiveId(el) || '')
            : '.' + (el.dataset.activeClass || ''));
    }

    updateScriptAssignment(blockId, selector, ev, handler, el);
}

/***********************************************************************
 * onJsTableBlur — сохраняет изменения имени обработчика JS-события при потере фокуса:
 * - Получает объект события, карту событий-селекторов, ID блока и элемент DOM.
 * - Проверяет, что редактируется именно имя обработчика.
 * - Берёт текст события и нового обработчика.
 * - Находит селектор для события через карту или строит его.
 * - Вызывает updateScriptAssignment для сохранения изменений в скрипте.
 **********************************************************************/
function onJsTableBlur(e, eventToSelectorMap, blockId, el) {
    const td = e.target.closest('td');
    if (!td || td.cellIndex !== 1) return;

    const handler = td.textContent.trim();

    // Запускаем обновление (на случай если input не сработал)
    onJsTableInput(e, eventToSelectorMap, blockId, el);

    // Если значение было стерто, перерисовываем панель, чтобы пустая строка исчезла из таблицы
    if (handler === "") {
        updateJsPanel(el);
    }
}

function findFreeElNumber() {
    const els = document.querySelectorAll('[id^="el_"]');
    const nums = Array.from(els).map(el => parseInt(el.id.slice(3))).filter(n => !isNaN(n));
    let max = 0;
    nums.forEach(n => { if (n > max) max = n; });
    return max + 1;
}

/***********************************************************************
 * updateScriptAssignment — обновляет присвоение обработчика JS-события в скрипте:
 * - Получает ID блока, селектор элемента, полное имя события, имя обработчика и DOM-элемент.
 * - Находит скрипт блока и его текст.
 * - Для id селектора: document.getElementById('id').event = handler;
 * - Для class селектора: document.querySelectorAll('.class').forEach(el => el.event = handler);
 * - Удаляет старые присвоения для данного события.
 * - Если указано имя обработчика, создаёт новое присвоение и вставляет его в скрипт.
 * - Обновляет содержимое блока pre-js в интерфейсе, если он открыт для текущего блока.
 **********************************************************************/
function updateScriptAssignment(blockId, selector, eventFull, handlerName, el) {
    const scriptEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    if (!scriptEl) return;
    let s = scriptEl.textContent;
    
    const ev = eventFull.replace(/^on/, '');
    const selectorType = el.dataset.selectorType || 'id';
    const activeVal = selectorType === 'id' ? getActiveId(el) : el.dataset.activeClass;
    if (!activeVal) return;

    let regex;
    let newLine = '';

    if (selectorType === 'id') {
        // Ищем конструкцию document.getElementById('...').onсобытие = ...;
        const escapedId = activeVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(`document\\.getElementById\\(['"]${escapedId}['"]\\)\\.on${ev}\\s*=\\s*[^;\\n]+;?`, 'g');
        newLine = `document.getElementById('${activeVal}').on${ev} = ${handlerName};`;
    } else {
        // Ищем конструкцию document.querySelectorAll('....').forEach(...)
        const escapedClass = activeVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(`document\\.querySelectorAll\\(['"]\\.${escapedClass}['"]\\)\\.forEach\\(el\\s*=>\\s*el\\.on${ev}\\s*=\\s*[^)]+\\);?`, 'g');
        newLine = `document.querySelectorAll('.${activeVal}').forEach(el => el.on${ev} = ${handlerName});`;
    }

    const exists = regex.test(s);

    if (handlerName === "") {
        // УДАЛЕНИЕ: если имя пустое, просто вырезаем найденную регулярку
        s = s.replace(regex, '').replace(/\n\s*\n/g, '\n'); 
    } else {
        if (exists) {
            // ЗАМЕНА: если нашли старое, меняем на новое
            s = s.replace(regex, newLine);
        } else {
            // ДОБАВЛЕНИЕ: если не нашли, вставляем в конец IIFE
            const insertIdx = findInsertIndexBeforeClosingIIFE(s);
            const formattedLine = "\n" + newLine;
            if (insertIdx !== -1) s = s.slice(0, insertIdx) + formattedLine + s.slice(insertIdx);
            else s = s.trimEnd() + formattedLine + "\n";
        }
    }

    // Сохранение и обновление интерфейса
    scriptEl.textContent = s;
    const blockPre = document.getElementById('center-tab-pre-js');
    if (blockPre && (getActiveBlockId() === blockId)) {
        let cleanedCode = stripJsWrapper(s);
        blockPre.textContent = cleanedCode;
    }
}

/***********************************************************************
 * buildLhsCandidates — строит возможные варианты левой части присвоения для селектора:
 * - Получает селектор элемента и текст скрипта блока.
 * - Ищет переменные, которым присвоен этот элемент в коде.
 * - Добавляет прямые обращения к элементу.
 * - Возвращает массив всех найденных вариантов для использования при обновлении обработчиков.
 **********************************************************************/
function buildLhsCandidates(selector, scriptText) {
    const out = [];
    const id = selector.startsWith('#') ? selector.slice(1) : null;
    const escapedSel = escapeRegExp(id || selector);
    const varAssignRe = new RegExp('\\b(var|let|const)\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*document\\.(getElementById|querySelector(All)?)\\(\\s*[\'"]' + escapedSel + '[\'"]\\s*\\)', 'g');
    let mm;
    while ((mm = varAssignRe.exec(scriptText)) !== null) out.push(mm[2]);
    if (id) out.push("document.getElementById('" + id + "')");
    out.push("document.querySelector('" + selector.replace(/'/g, "\\'") + "')");
    return out;
}

/***********************************************************************
 * findInsertIndexBeforeClosingIIFE — находит место для вставки новой строки перед закрывающейся самовызывающейся функцией:
 * - Получает текст скрипта блока.
 * - Ищет ' } catch (e) {' и вставляет перед ним.
 * - Если не найдено, ищет `})();`.
 * - Если не найдено, ищет последний закрывающийся фигурный скобку `}`.
 * - Возвращает индекс для вставки новой строки кода.
 **********************************************************************/
function findInsertIndexBeforeClosingIIFE(text) {
    const catchPattern = '} catch (e) {';
    const catchIdx = text.lastIndexOf(catchPattern);
    if (catchIdx !== -1) return catchIdx;
    
    const iife = '})();';
    const idx = text.lastIndexOf(iife);
    if (idx !== -1) return idx;
    
    const lastClose = text.lastIndexOf('}');
    if (lastClose !== -1) return lastClose + 1;
    return -1;
}

/***********************************************************************
 * escapeRegExp — экранирует специальные символы для использования в RegExp:
 * - Получает строку и возвращает её с экранированными символами.
 **********************************************************************/
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

/***********************************************************************
 * resolveSelectorFromExpr — определяет CSS-селектор из JS-выражения:
 * - Получает строку выражения и полный текст скрипта.
 * - Проверяет прямые обращения.
 * - Если выражение — имя переменной, ищет его присвоение через var/let/const.
 * - Возвращает CSS-селектор для использования в таблице событий.
 **********************************************************************/
function resolveSelectorFromExpr(expr, scriptText) {
    expr = expr.trim();

    const idRe = /^document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)$/;
    const qsRe = /^document\.querySelector(All)?\(\s*['"]([^'"]+)['"]\s*\)$/;

    let m = idRe.exec(expr);
    if (m) return '#' + m[1];

    m = qsRe.exec(expr);
    if (m) return m[2];

    const varNameMatch = expr.match(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
    if (!varNameMatch) return null;

    const varName = varNameMatch[0];

    const varAssignRe = new RegExp(
        '\\b(var|let|const)\\s+' + varName +
        '\\s*=\\s*document\\.(getElementById|querySelector(All)?)\\(\\s*[\'"]([^\'"]+)[\'"]\\s*\\)',
        'g'
    );

    let mm;
    while ((mm = varAssignRe.exec(scriptText)) !== null) {
        if (mm[2] === 'getElementById') return '#' + mm[4];
        return mm[4];
    }

    return null;
}



function updateSimpleFormats(el) {
    if (!el) return;
    const simple = document.getElementById('properties-simpleFormats');
    if (!simple) return;
    const btns = Array.from(simple.querySelectorAll('[simpleformats-button]'));

    btns.forEach(b => {
        const key = b.getAttribute('simpleformats-button');
        updateButtonActive(b, el, key);
        b.onclick = () => { 
            handleSimpleFormatClick(b, el, key);
            const blockId = getActiveBlockId();
            if (blockId) {
                syncHtmlFromView(blockId);
            }
        };
    });
}

function updateSelectProperties(el) {
    if (!el) return;
    const list = document.getElementById('properties-list');
    if (!list) return;
    const selects = Array.from(list.querySelectorAll('[property-item]'));

    selects.forEach(sel => {
        const prop = sel.getAttribute('property-item');

        // отдельная функция для вычисления текущего значения
        const value = getSelectValue(el, prop);

        const found = Array.from(sel.options).some(o => o.value === value);
        if (!found) {
            if (!Array.from(sel.options).some(o => o.value === '-')) {
                const dash = document.createElement('option');
                dash.value = '-';
                dash.textContent = '-';
                sel.insertBefore(dash, sel.firstChild);
            }
            sel.value = '-';
        } else sel.value = value;

        // отдельная функция для обработчика onchange
        sel.onchange = (e) => {
            const handler = createSelectChangeHandler(el, prop);
            if (handler) handler(e);
            const blockId = getActiveBlockId();
            if (blockId) {
                syncHtmlFromView(blockId);
            }
        };
    });
}



// --- новая функция для присвоения active ---
function updateButtonActive(button, el, key) {
    button.classList.remove('active');

    const textAlign = getComputedProp(el, 'textAlign') || 'left';

    switch (key) {
        case 'bold':
            if (getComputedProp(el, 'fontWeight') === 'bold') button.classList.add('active');
            break;
        case 'italic':
            if (getComputedProp(el, 'fontStyle') === 'italic') button.classList.add('active');
            break;
        case 'underline':
            if (getComputedProp(el, 'textDecoration').includes('underline')) button.classList.add('active');
            break;
        case 'strike':
            if (getComputedProp(el, 'textDecoration').includes('line-through')) button.classList.add('active');
            break;
        case 'sup':
            if (getComputedProp(el, 'verticalAlign') === 'super') button.classList.add('active');
            break;
        case 'sub':
            if (getComputedProp(el, 'verticalAlign') === 'sub') button.classList.add('active');
            break;
        case 'text-align-left':
            if (textAlign === 'left' || textAlign === 'start') button.classList.add('active');
            break;
        case 'text-align-center':
            if (textAlign === 'center') button.classList.add('active');
            break;
        case 'text-align-right':
            if (textAlign === 'right' || textAlign === 'end') button.classList.add('active');
            break;
        case 'text-align-justify':
            if (textAlign === 'justify') button.classList.add('active');
            break;
        case 'list-disc':
            if (getSelectValue(el, 'list') === 'disc') button.classList.add('active');
            break;
        case 'list-circle':
            if (getSelectValue(el, 'list') === 'circle') button.classList.add('active');
            break;
        case 'list-square':
            if (getSelectValue(el, 'list') === 'square') button.classList.add('active');
            break;
        case 'list-decimal':
            if (getSelectValue(el, 'list') === 'decimal') button.classList.add('active');
            break;
    }
}

// --- вычисляет текущее значение свойства ---
function getSelectValue(el, prop) {
    switch (prop) {
        case 'font-size': return getComputedProp(el, 'fontSize');
        case 'font-family': return getComputedProp(el, 'fontFamily');
        case 'text-align': return getComputedProp(el, 'textAlign');
        case 'line-height': return getComputedProp(el, 'lineHeight');
        case 'padding': return getComputedProp(el, 'padding');
        case 'list': {
            const li = el.closest && el.closest('li');
            if (!li) return 'none';
            const parent = li.parentElement;
            if (!parent) return 'none';
            if (parent.tagName === 'OL') return 'decimal';
            if (parent.tagName === 'UL') {
                const cs = window.getComputedStyle(parent);
                return cs.listStyleType || 'disc';
            }
            return 'none';
        }
        default: return '';
    }
}

// --- вспомогательная функция: возвращает текущее значение свойства ---
function getComputedProp(el, prop) {
    if (!el && !window.getSelection) return '';

    // --- нормализация fontWeight ---
    function normalizeFontWeight(v) {
        if (!v && v !== 0) return '';
        const s = String(v).trim();
        const n = parseInt(s, 10);
        if (!isNaN(n)) return n >= 700 ? 'bold' : (n >= 400 ? 'normal' : s);
        return s === 'bolder' || s === 'bold' ? 'bold' : s;
    }

    // --- нормализация textDecoration в упорядоченную строку ---
    function normalizeTextDecorationStr(s) {
        if (!s) return '';
        const parts = String(s).split(/\s+/).map(p => p.trim()).filter(Boolean);
        const set = new Set();
        for (const p of parts) {
            if (/underline/i.test(p)) set.add('underline');
            if (/line-?through|strike|strikethrough/i.test(p)) set.add('line-through');
        }
        return Array.from(set).sort().join(' ');
    }

    // --- вычислить свойство для конкретного элемента-родителя текстового узла ---
    function computeForElement(target, propName) {
        if (!target) return '';
        const cs = window.getComputedStyle(target);

        switch (propName) {
            case 'fontWeight':
                if (target.style && target.style.fontWeight) return normalizeFontWeight(target.style.fontWeight);
                if (target.closest && target.closest('strong,b')) return 'bold';
                return normalizeFontWeight(cs.fontWeight || '');
            case 'fontStyle':
                if (target.style && target.style.fontStyle) return target.style.fontStyle;
                if (target.closest && target.closest('em,i')) return 'italic';
                return cs.fontStyle || '';
            case 'textDecoration':
                let td = (target.style && target.style.textDecoration) || cs.textDecorationLine || cs.textDecoration || '';
                if (target.closest && target.closest('u')) td = td ? td + ' underline' : 'underline';
                if (target.closest && target.closest('s, strike, del')) td = td ? td + ' line-through' : 'line-through';
                return normalizeTextDecorationStr(td);
            case 'verticalAlign':
                if (target.style && target.style.verticalAlign) return target.style.verticalAlign;
                if (target.closest && target.closest('sup')) return 'super';
                if (target.closest && target.closest('sub')) return 'sub';
                return cs.verticalAlign || '';
            case 'lineHeight': return (target.style && target.style.lineHeight) || cs.lineHeight || '';
            case 'fontSize': return (target.style && target.style.fontSize) || cs.fontSize || '';
            case 'fontFamily': return (target.style && target.style.fontFamily) || cs.fontFamily || '';
            case 'textAlign': return (target.style && target.style.textAlign) || cs.textAlign || '';
            case 'borderWidth': return (target.style && target.style.borderWidth) || cs.borderWidth || '';
            case 'padding': return (target.style && target.style.padding) || cs.padding || '';
            case 'borderColor': return (target.style && target.style.borderColor) || cs.borderColor || '';
            case 'backgroundColor': return (target.style && target.style.backgroundColor) || cs.backgroundColor || '';
            case 'color': return (target.style && target.style.color) || cs.color || '';
            case 'listStyleType': return (target.style && target.style.listStyleType) || cs.listStyleType || 'none';
            default: return '';
        }
    }

    // --- собрать текстовые узлы, которые реально входят в Range (если есть) ---
    function textNodesInRange(range) {
        const nodes = [];
        const root = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement || document.body;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
                if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                try {
                    if (range.intersectsNode(node)) return NodeFilter.FILTER_ACCEPT;
                } catch (e) {
                }
                return NodeFilter.FILTER_REJECT;
            }
        }, false);

        while (walker.nextNode()) nodes.push(walker.currentNode);
        return nodes;
    }

    // --- собрать текстовые узлы внутри элемента целиком (fallback) ---
    function textNodesInElement(root) {
        const nodes = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
                if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        }, false);
        while (walker.nextNode()) nodes.push(walker.currentNode);
        return nodes;
    }

    // --- определим набор текстовых узлов для проверки ---
    let nodes = [];

    // Если есть активное выделение и оно не пустое, используем его (обычно это то, что нужно при кликах на панели)
    const sel = window.getSelection && window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        nodes = textNodesInRange(range);
    }

    // иначе если передан элемент — берём все текстовые узлы внутри него
    if (!nodes.length && el) {
        if (el.nodeType === Node.TEXT_NODE) {
            if (el.nodeValue && el.nodeValue.trim()) nodes = [el];
        } else if (el.nodeType === Node.ELEMENT_NODE || el.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            nodes = textNodesInElement(el);
        }
    }

    // Если всё ещё пусто — fallback: вычислить для самого элемента
    if (!nodes.length) {
        return computeForElement(el, prop);
    }

    const values = [];
    for (const tn of nodes) {
        const parent = tn.parentElement || tn.parentNode;
        values.push(computeForElement(parent, prop));
    }

    const uniq = Array.from(new Set(values.map(v => (v === null || v === undefined) ? '' : String(v).trim())));
    if (uniq.length === 1) return uniq[0];

    return '';
}





// Конфигурация кнопок форматов (key, type, target, style)
const FORMAT_BUTTONS = [
    { key: 'bold', type: 'toggle', target: 'inline', style: { prop: 'fontWeight', value: 'bold' } },
    { key: 'italic', type: 'toggle', target: 'inline', style: { prop: 'fontStyle', value: 'italic' } },
    { key: 'underline', type: 'toggle', target: 'inline', style: { prop: 'textDecoration', value: 'underline' } },
    { key: 'strike', type: 'toggle', target: 'inline', style: { prop: 'textDecoration', value: 'line-through' } },
    { key: 'sup', type: 'toggle', target: 'inline', style: { prop: 'verticalAlign', value: 'super' } },
    { key: 'sub', type: 'toggle', target: 'inline', style: { prop: 'verticalAlign', value: 'sub' } },
    { key: 'text-color', type: 'color', target: 'inline', style: { prop: 'color' } },
    { key: 'bg-color', type: 'color', target: 'inline', style: { prop: 'backgroundColor' } },
    { key: 'delete', type: 'action', target: 'any', action: 'remove-all' }
];

// Конфигурация селектов (key, css, target)
const FORMAT_SELECTS = [
    { key: 'font-size', css: 'fontSize', target: 'inline' },
    { key: 'font-family', css: 'fontFamily', target: 'inline' },
    { key: 'text-align', css: 'textAlign', target: 'block' },
    { key: 'line-height', css: 'lineHeight', target: 'block' },
    { key: 'padding', css: 'padding', target: 'block' },
    { key: 'list', css: 'listStyleType', target: 'block' }
];

/* Utility: вернуть текущий Range, если выделение внутри el или на документе */
function getCurrentRange() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return range; // возвращаем коллапсный range для применения к элементу
    return range;
}

/* Utility: возвращает корневой element для range */
function getRangeRootElement(range) {
    return range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
}

/* Utility: вернуть текстовые узлы, пересекающиеся с range */
function getTextNodesInRange(range) {
    const root = getRangeRootElement(range);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            try { return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
            catch (e) { return NodeFilter.FILTER_ACCEPT; }
        }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
}

/* Utility: вернуть все текстовые узлы под элементом */
function getTextNodesUnder(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    const res = [];
    while (walker.nextNode()) res.push(walker.currentNode);
    return res;
}

/* Utility: делит текстовый узел так, чтобы выбранная часть стала отдельным узлом */
function splitTextNodeByRange(textNode, range) {
    const isStart = textNode === range.startContainer;
    const isEnd = textNode === range.endContainer;
    const start = isStart ? range.startOffset : 0;
    const end = isEnd ? range.endOffset : textNode.length;
    if (start === 0 && end === textNode.length) return textNode;
    let node = textNode;
    if (end < node.length) node.splitText(end);
    if (start > 0) return node.splitText(start);
    return node;
}

/* Utility: обернуть текстовый узел в span, если нужно */
function ensureWrapperSpanForTextNode(textNode) {
    if (!textNode) return null;
    const parent = textNode.parentNode;
    if (!parent) return null;

    if (parent.tagName === 'SPAN' && parent.getAttribute('data-format') === 'true') {
        if (parent.childNodes.length === 1) return parent;

        const parentParent = parent.parentNode;
        if (!parentParent) return null;

        const before = parent.cloneNode(false);
        const middle = parent.cloneNode(false);
        const after = parent.cloneNode(false);

        let isAfterTarget = false;
        Array.from(parent.childNodes).forEach(child => {
            if (child === textNode) {
                middle.appendChild(child);
                isAfterTarget = true;
            } else if (!isAfterTarget) before.appendChild(child);
            else after.appendChild(child);
        });

        if (before.hasChildNodes()) parentParent.insertBefore(before, parent);
        parentParent.insertBefore(middle, parent);
        if (after.hasChildNodes()) parentParent.insertBefore(after, parent);

        parentParent.removeChild(parent);
        return middle;
    }

    const span = document.createElement('span');
    span.setAttribute('data-format', 'true');
    parent.insertBefore(span, textNode);
    span.appendChild(textNode);
    return span;
}


/* Utility: разворачивает span если у него нет стилей */
function cleanupSpanIfEmpty(span) {
    if (!span || span.nodeType !== 1 || span.tagName !== 'SPAN') return;
    const style = span.getAttribute('style');
    if (!style || style.trim() === '') {
        const parent = span.parentNode;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        span.remove();
    }
}

/* Utility: сливает соседние span с одинаковым style */
function mergeAdjacentSpans(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    const toVisit = [];
    while (walker.nextNode()) toVisit.push(walker.currentNode);
    for (const el of toVisit) {
        if (el.tagName === 'SPAN') {
            let next = el.nextSibling;
            if (next && next.nodeType === 1 && next.tagName === 'SPAN' &&
                el.getAttribute('style') === next.getAttribute('style')) {
                while (next.firstChild) el.appendChild(next.firstChild);
                next.remove();
            }
        }
    }
}

/* Utility: находит блочные контейнеры (div, p, section...) для выделения */
function getBlockContainersForRange(range) {
    const root = getRangeRootElement(range);
    const textNodes = getTextNodesInRange(range);
    const containers = new Set();
    for (const tn of textNodes) {
        let el = tn.parentElement;
        while (el && el !== root && el !== document.body) {
            const cs = window.getComputedStyle(el);
            if (cs && cs.display && cs.display !== 'inline' && cs.display !== 'inline-block') {
                containers.add(el);
                break;
            }
            el = el.parentElement;
        }
        if (!el && tn.parentElement) containers.add(tn.parentElement);
    }
    return Array.from(containers);
}

function applyInlineStyleToSelection(styleProp, styleValue) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const root = getRangeRootElement(range);
    
    // 1. изолируем текстовые узлы в выделении
    const textNodes = isolateTextNodes(range);
    if (!textNodes.length) return;

    // 2. режем родительские span перед первым и после последнего текста
    splitParentsAtNode(textNodes[0], true);  
    splitParentsAtNode(textNodes[textNodes.length - 1], false);

    // 3. применяем стиль к изолированным текстовым узлам
    for (const tn of textNodes) {
        if (!tn.textContent.trim() && tn.parentNode.tagName !== 'SPAN') continue;

        let parent = tn.parentNode;
        if (!parent || parent.tagName !== 'SPAN') {
            parent = ensureWrapperSpanForTextNode(tn);
        }

        const isTextDecoration = styleProp === 'textDecoration';
        const currentTd = parent.style.textDecoration || '';
        const parts = currentTd.split(/\s+/).filter(Boolean);
                    
        if (isTextDecoration) {
            if (!styleValue) {
                parent.style.textDecoration = '';
            } else {
                if (parts.includes(styleValue)) {
                    parent.style.textDecoration = parts.filter(v => v !== styleValue).join(' ');
                } else {
                    parts.push(styleValue);
                    parent.style.textDecoration = parts.join(' ');
                }
            }
        } else {
            parent.style[styleProp] = styleValue || '';
        }

        cleanupSpanIfEmpty(parent);
    }

    // 4. склеиваем соседние span с одинаковыми стилями
    mergeAdjacentSpans(root);
    const spans = root.querySelectorAll('span');
    spans.forEach(s => cleanupSpanIfEmpty(s));

    // 5. восстанавливаем выделение
    try {
        const newRange = document.createRange();
        newRange.setStartBefore(textNodes[0]);
        newRange.setEndAfter(textNodes[textNodes.length - 1]);
        sel.removeAllRanges();
        sel.addRange(newRange);
    } catch (e) {}
}

// --- вспомогательные функции ---

// изолирует текстовые узлы в выделении
function isolateTextNodes(range) {
    let startNode = range.startContainer;
    let startOffset = range.startOffset;
    let endNode = range.endContainer;
    let endOffset = range.endOffset;

    if (endNode.nodeType === Node.TEXT_NODE && endOffset < endNode.length) {
        endNode.splitText(endOffset);
    }

    if (startNode.nodeType === Node.TEXT_NODE && startOffset > 0) {
        const newNode = startNode.splitText(startOffset);
        if (startNode === endNode) {
            endNode = newNode;
        }
        startNode = newNode;
    }

    const newRange = document.createRange();
    if (startNode.nodeType === Node.TEXT_NODE) newRange.setStart(startNode, 0);
    else newRange.setStart(startNode, startOffset);
    
    if (endNode.nodeType === Node.TEXT_NODE) newRange.setEnd(endNode, endNode.length);
    else newRange.setEnd(endNode, endOffset);

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(newRange);

    return getTextNodesInRange(newRange);
}

// рекурсивно режет родительские span до contenteditable
function splitParentsAtNode(textNode, isBefore) {
    let current = textNode;
    
    while (current.parentNode && current.parentNode.tagName === 'SPAN') {
        const parent = current.parentNode;
        const clone = parent.cloneNode(false);
        
        if (isBefore) {
            let sibling = parent.firstChild;
            while (sibling !== current) {
                let next = sibling.nextSibling;
                clone.appendChild(sibling);
                sibling = next;
            }
            if (clone.childNodes.length > 0) {
                parent.parentNode.insertBefore(clone, parent);
            }
        } else {
            let sibling = current.nextSibling;
            while (sibling) {
                let next = sibling.nextSibling;
                clone.appendChild(sibling);
                sibling = next;
            }
            if (clone.childNodes.length > 0) {
                parent.parentNode.insertBefore(clone, parent.nextSibling);
            }
        }
        current = parent;
    }
}

/* Основная: применять/удалять блочный стиль к ближайшим блочным контейнерам */
function applyBlockStyleToSelection(cssProp, cssValue) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    // --- Вспомогательная функция: разворачивает div с заданным cssProp ---
    function unwrapDivWithProp(node) {
        if (!node) return;
        const divs = node.querySelectorAll(`div[style*="${cssProp}"]`);
        divs.forEach(d => {
            while (d.firstChild) d.parentNode.insertBefore(d.firstChild, d);
            d.remove();
        });
        if (node.nodeType === 1 && node.tagName === 'DIV') {
            const style = node.style[cssProp];
            if (style) {
                while (node.firstChild) node.parentNode.insertBefore(node.firstChild, node);
                node.remove();
            }
        }
    }

    // --- извлекаем содержимое временно ---
    const frag = range.extractContents();

    // --- разворачиваем старые div с тем же cssProp внутри фрагмента ---
    const tempContainer = document.createElement('div');
    tempContainer.appendChild(frag);
    unwrapDivWithProp(tempContainer);

    // --- создаём новый div и применяем стиль ---
    const div = document.createElement('div');
    if (cssValue) div.style[cssProp] = cssValue;

    // --- помещаем содержимое внутрь нового div ---
    while (tempContainer.firstChild) div.appendChild(tempContainer.firstChild);

    // --- вставляем div обратно в документ ---
    range.insertNode(div);

    // --- восстанавливаем выделение на новый div ---
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(div);
    sel.addRange(newRange);
}


/* Удаление формата: удаляет style у span и у других тегов внутри выделения */
function removeFormattingInSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    // извлечь содержимое выделения
    const frag = range.extractContents();

    // рекурсивная очистка фрагмента
    (function clean(node) {
        // проходим детей сначала (depth-first)
        const children = Array.from(node.childNodes);
        for (const ch of children) {
            if (ch.nodeType === Node.ELEMENT_NODE) clean(ch);
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const tag = node.tagName;

        // 1) Развернуть <a> — удалить сам тег, оставить содержимое
        if (tag === 'A') {
            const parent = node.parentNode;
            while (node.firstChild) parent.insertBefore(node.firstChild, node);
            parent.removeChild(node);
            return;
        }

        // 2) Поменять <ul>/<ol> на последовательность li->content + <br>
        if (tag === 'UL' || tag === 'OL') {
            const wrapper = document.createDocumentFragment();
            const lis = Array.from(node.children).filter(n => n.tagName === 'LI');
            for (const li of lis) {
                // перенести содержимое li
                while (li.firstChild) wrapper.appendChild(li.firstChild);
                // добавить br для разделения пунктов
                wrapper.appendChild(document.createElement('br'));
            }
            // если нет li — просто разворачиваем(удаляем) сам список
            if (!lis.length) {
                while (node.firstChild) wrapper.appendChild(node.firstChild);
            }
            node.parentNode.replaceChild(wrapper, node);
            return;
        }

        // 3) Удалить стилевые и служебные атрибуты, влияющие на отображение
        // удаляем: style, class, align
        node.removeAttribute('style');
        node.removeAttribute('class');
        node.removeAttribute('align');

        // дополнительно: удалить inline-атрибуты, которые используются для размеров/границ
        // (если не нужны, можно расширить список)
        node.removeAttribute('width');
        node.removeAttribute('height');
        node.removeAttribute('cellpadding');
        node.removeAttribute('cellspacing');
        node.removeAttribute('border');
        node.removeAttribute('bgcolor');

        // 4) Если это <span> и после очистки он пустой от атрибутов — разворачиваем
        if (tag === 'SPAN') {
            if (!node.attributes.length) {
                const parent = node.parentNode;
                while (node.firstChild) parent.insertBefore(node.firstChild, node);
                parent.removeChild(node);
            }
        }
    })(frag);

    // дополнительная чистка: сливаем подряд идущие <br> (оставляем максимум один)
    (function collapseBrs(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        for (const n of nodes) {
            if (n.nodeType === 1) {
                let child = n.firstChild;
                while (child) {
                    if (child.nodeType === 1 && child.tagName === 'BR') {
                        let next = child.nextSibling;
                        // удалить повторяющиеся BR подряд
                        while (next && next.nodeType === 1 && next.tagName === 'BR') {
                            const toRemove = next;
                            next = next.nextSibling;
                            toRemove.parentNode.removeChild(toRemove);
                        }
                        child = next;
                    } else child = child.nextSibling;
                }
            }
        }
    })(frag);

    // вставить очищённый фрагмент обратно и восстановить выделение на вставленное содержимое
    range.insertNode(frag);

    // опционально: поместить курсор в конец вставленного содержимого
    sel.removeAllRanges();
    const newRange = document.createRange();
    // пытаемся выбрать вставленный узел(ы) — выбираем следующий узел после range.startContainer
    try {
        // если вставлен фрагмент — не всегда есть простой way; попробуем выбрать после startContainer
        const after = range.startContainer.nodeType === 3 ? range.startContainer : range.startContainer;
        newRange.setStartAfter(after);
        newRange.collapse(true);
        sel.addRange(newRange);
    } catch (e) {
        // безопасный fallback — ничего не делать
    }
}

/* Toggle: простые форматы (bold/italic/underline/strike/sup/sub) */
function toggleInlineFormatting(key) {
    const map = {
        bold: { prop: 'fontWeight', value: 'bold' },
        italic: { prop: 'fontStyle', value: 'italic' },
        underline: { prop: 'textDecoration', value: 'underline' },
        strike: { prop: 'textDecoration', value: 'line-through' },
        sup: { prop: 'verticalAlign', value: 'super' },
        sub: { prop: 'verticalAlign', value: 'sub' }
    };
    if (!map[key]) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const nodes = getTextNodesInRange(range);
    if (!nodes.length) return;
    const { prop, value } = map[key];
    let allHave = true;
    for (const tn of nodes) {
        const p = tn.parentNode;
        if (!(p && p.nodeType === 1 && p.tagName === 'SPAN' && p.style[prop] === value)) { allHave = false; break; }
    }
    applyInlineStyleToSelection(prop, allHave ? '' : value);
}

/* Обработчик кнопок: использует конфиг FORMAT_BUTTONS */
function handleSimpleFormatClick(button, el, key) {
    if (document.activeElement !== el) { /* el.focus(); */ }

    if (key.startsWith('text-align-')) {
        const value = key.slice('text-align-'.length);
        const current = getSelectValue(el, 'text-align');
        applyBlockStyleToSelection('textAlign', current === value ? '' : value);
        if (typeof updateSimpleFormats === 'function') updateSimpleFormats(el);
        return;
    }
    if (key.startsWith('list-')) {
        const listType = key.slice('list-'.length);
        const current = getSelectValue(el, 'list');
        if (current === listType) toggleListForSelection('none');
        else toggleListForSelection(listType);
        if (typeof updateSimpleFormats === 'function') updateSimpleFormats(el);
        return;
    }

    const cfg = FORMAT_BUTTONS.find(x => x.key === key);
    if (!cfg) return;
    if (cfg.type === 'toggle' && cfg.target === 'inline') {
        toggleInlineFormatting(key);
        if (typeof updateSimpleFormats === 'function') updateSimpleFormats(el);
        return;
    }
    if (cfg.type === 'color' && cfg.target === 'inline' && cfg.style) {
        /* applyInlineStyleToSelection(cfg.style.prop, val === '' ? '' : val);
        if (typeof updateSimpleFormats === 'function') updateSimpleFormats(el); */
        return;
    }
    if (cfg.type === 'action' && cfg.action === 'remove-all') {
        removeFormattingInSelection();
        if (typeof updateSimpleFormats === 'function') updateSimpleFormats(el);
        return;
    }
}

/* Обработчик select: возвращает onchange-функцию (использует FORMAT_SELECTS) */
function createSelectChangeHandler(el, prop) {
    return e => {
        const v = e.target.value;
        const cfg = FORMAT_SELECTS.find(s => s.key === prop);
        const target = cfg ? cfg.target : 'inline';
        const css = cfg ? cfg.css : prop;
        if (v === '' || v === '-' || v === 'none') {
            if (target === 'block') {
                if (prop === 'list') toggleListForSelection('none');
                else applyBlockStyleToSelection(css, '');
            } else {
                applyInlineStyleToSelection(css === 'fontSize' ? 'fontSize' : css, '');
            }
            if (typeof updateSelectProperties === 'function') updateSelectProperties(el);
            return;
        }
        if (target === 'block') {
            if (prop === 'list') {
                if (v === 'decimal') toggleListForSelection('decimal');
                else toggleListForSelection(v);
            } else {
                applyBlockStyleToSelection(css, v);
                if (prop === 'border-width') applyBlockStyleToSelection('borderStyle', 'solid');
            }
        } else {
            applyInlineStyleToSelection(css === 'fontSize' ? 'fontSize' : css, v);
        }
        if (typeof updateSelectProperties === 'function') updateSelectProperties(el);
    };
}

/* Переключатель списков: использует блочные контейнеры */
function toggleListForSelection(listType) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    // получаем блочные контейнеры для выделения
    let blocks = getBlockContainersForRange(range);

    // если блочных контейнеров нет — оборачиваем выделение в div и используем его
    if (!blocks.length) {
        // Вырезаем содержимое range во фрагмент
        const frag = range.extractContents();
        const wrapper = document.createElement('div');
        // вставляем содержимое внутрь wrapper
        wrapper.appendChild(frag);
        // вставляем wrapper на место range
        range.insertNode(wrapper);

        // обновляем selection — теперь wrapper покрывает вставленное содержимое
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(wrapper);
        sel.addRange(newRange);

        blocks = [wrapper];
    }

    // helper: удалить list (unwrap li -> содержимое, убрать пустой список)
    if (listType === 'none') {
        blocks.forEach(block => {
            const li = block.closest('li');
            if (li) {
                const parentList = li.parentElement;        // ul/ol
                const grandParent = parentList.parentElement; // куда вернуть содержимое li
                // вставляем содержимое li перед списком
                while (li.firstChild) grandParent.insertBefore(li.firstChild, parentList);
                li.remove();
                // если список пуст - удаляем
                if (!parentList.querySelector('li')) parentList.remove();
            } else {
                // если блок сам внутри списка (например wrapper внутри ul/ol), попробуем распаковать его
                const parentList = block.closest('ul,ol');
                if (parentList) {
                    // для каждого li внутри parentList: если li содержит наш block, разворачиваем
                    const lis = Array.from(parentList.querySelectorAll('li'));
                    lis.forEach(liItem => {
                        if (liItem.contains(block)) {
                            while (liItem.firstChild) parentList.parentNode.insertBefore(liItem.firstChild, parentList);
                            liItem.remove();
                        }
                    });
                    if (!parentList.querySelector('li')) parentList.remove();
                }
            }
        });
        return;
    }

    // otherwise — создать/изменить список
    let i = 0;
    while (i < blocks.length) {
        const block = blocks[i];
        const parentList = block.closest('ul, ol');

        // если уже в списке — изменить тип/стиль списка
        if (parentList) {
            if (listType === 'decimal') {
                if (parentList.tagName !== 'OL') {
                    const ol = document.createElement('ol');
                    if (parentList.parentNode) {
                        while (parentList.firstChild) {
                            ol.appendChild(parentList.firstChild);
                        }
                        parentList.parentNode.replaceChild(ol, parentList);
                    }
                }
            } else {
                if (parentList.tagName !== 'UL') {
                    const ul = document.createElement('ul');
                    if (parentList.parentNode) {
                        while (parentList.firstChild) {
                            ul.appendChild(parentList.firstChild);
                        } 
                        parentList.parentNode.replaceChild(ul, parentList);
                    }
                }
                parentList.style.listStyleType = listType;
            }
            i++;
            continue;
        }

        // группируем последовательные блоки (если есть) в одну группу
        const group = [block];
        let j = i + 1;
        while (j < blocks.length) { group.push(blocks[j]); j++; }

        // создаём список нужного типа
        const listEl = listType === 'decimal' ? document.createElement('ol') : document.createElement('ul');
        if (listType !== 'decimal') listEl.style.listStyleType = listType;

        const first = group[0];
        first.parentNode.insertBefore(listEl, first);

        // переносим содержимое каждого блока в <li>
        for (const b of group) {
            const li = document.createElement('li');
            // переносим все дочерние узлы блока в li
            while (b.firstChild) li.appendChild(b.firstChild);
            listEl.appendChild(li);
            b.remove();
        }

        i = j;
    }
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




/* Окно выбора цвета */
const colorState = { h: 0, s: 100, l: 50 }; 
let activeContext = null;

const picker = document.getElementById('rgb-picker');
const hueCanvas = document.getElementById('cp-hue');
const lightCanvas = document.getElementById('cp-light');
const hueThumb = document.getElementById('hue-thumb');
const lightThumb = document.getElementById('light-thumb');
const hexInput = document.getElementById('cp-hex');
const closeBtn = document.getElementById('cp-close');

const ctxHue = hueCanvas.getContext('2d');
const ctxLight = lightCanvas.getContext('2d');
let isDragging = null;

// --- CONVERTERS ---
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(H) {
    let r = 0, g = 0, b = 0;
    if (H.length === 4) {
        r = "0x" + H[1] + H[1]; g = "0x" + H[2] + H[2]; b = "0x" + H[3] + H[3];
    } else if (H.length === 7) {
        r = "0x" + H[1] + H[2]; g = "0x" + H[3] + H[4]; b = "0x" + H[5] + H[6];
    }
    r /= 255; g /= 255; b /= 255;
    let cmin = Math.min(r,g,b), cmax = Math.max(r,g,b), delta = cmax - cmin;
    let h = 0, s = 0, l = 0;

    if (delta === 0) h = 0;
    else if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;

    h = Math.round(h * 60);
    if (h < 0) h += 360;
    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);
    return { h, s, l };
}

// --- DRAWING ---
function drawHueBar() {
    const w = hueCanvas.width, h = hueCanvas.height;
    const grad = ctxHue.createLinearGradient(0, 0, w, 0);
    // Спектр: Красный -> Желтый -> Зеленый -> Голубой -> Синий -> Магента -> Красный
    grad.addColorStop(0, '#ff0000');
    grad.addColorStop(0.17, '#ffff00');
    grad.addColorStop(0.33, '#00ff00');
    grad.addColorStop(0.50, '#00ffff');
    grad.addColorStop(0.67, '#0000ff');
    grad.addColorStop(0.83, '#ff00ff');
    grad.addColorStop(1, '#ff0000');
    ctxHue.fillStyle = grad;
    ctxHue.fillRect(0, 0, w, h);
}

function drawLightBar() {
    const w = lightCanvas.width, h = lightCanvas.height;
    const grad = ctxLight.createLinearGradient(0, 0, w, 0);
    const currentColor = `hsl(${colorState.h}, 100%, 50%)`;
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.5, currentColor);
    grad.addColorStop(1, '#ffffff');
    ctxLight.fillStyle = grad;
    ctxLight.fillRect(0, 0, w, h);
}

function updateThumbs() {
    hueThumb.style.left = (colorState.h / 360) * hueCanvas.width + 'px';
    lightThumb.style.left = (colorState.l / 100) * lightCanvas.width + 'px';
}

// --- CORE LOGIC ---
function applyToSelection(hexValue) {
    if (!activeContext) return;
    
    let cssProp = activeContext.prop;
    if(cssProp === 'text-color') cssProp = 'color';
    if(cssProp === 'bg-color') cssProp = 'background-color';

    // если activeContext.ctrl привязан к полю из панели (data-prop),
    // применяем значение не к выделению, а к элементу через applyPropToElement
    if (activeContext.ctrl && activeContext.ctrl.getAttribute('data-prop')) {
        const prop = activeContext.ctrl.getAttribute('data-prop');
        const targetEl = lastHighlightedElement || activeContext.el;
        if (targetEl) {
            applyPropToElement(targetEl, prop, hexValue);
        }
    } else {
        // обычное поведение для панели форматирования (toolbar)
        if (typeof applyInlineStyleToSelection === 'function') {
            applyInlineStyleToSelection(cssProp, hexValue);
        }
        if (typeof updateSimpleFormats === 'function') {
            updateSimpleFormats(activeContext.el);
        }
    }

    // если цвет выбирался через контрол, обновим его значение тоже
    if (activeContext.ctrl && activeContext.ctrl.type === 'color') {
        activeContext.ctrl.value = hexValue;
        // обновить визуальный swatch если есть
        if (activeContext.ctrl._swatch) {
            activeContext.ctrl._swatch.style.backgroundColor = hexValue;
        }
        // сгенерируем событие, чтобы остальная логика панели сработала
        activeContext.ctrl.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function syncFromState(apply = false) {
    const hex = hslToHex(colorState.h, colorState.s, colorState.l);
    hexInput.value = hex;
    drawLightBar();
    updateThumbs();
    if (apply) applyToSelection(hex);
}

// --- EVENTS ---
function handleDrag(e, type) {
    const canvas = type === 'hue' ? hueCanvas : lightCanvas;
    const rect = canvas.getBoundingClientRect();
    let x = Math.max(0, Math.min(e.clientX - rect.left, canvas.width));
    const ratio = x / canvas.width;

    if (type === 'hue') {
        colorState.h = Math.round(ratio * 360);
        colorState.s = 100; // Сброс насыщенности при смене тона
    } else {
        colorState.l = Math.round(ratio * 100);
    }
    syncFromState();
}

function initDrag(e, type) {
    isDragging = type;
    handleDrag(e, type);
    const move = ev => handleDrag(ev, type);
    const stop = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); isDragging = null; };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', stop);
}

hueCanvas.addEventListener('mousedown', e => initDrag(e, 'hue'));
lightCanvas.addEventListener('mousedown', e => initDrag(e, 'light'));

// INPUT HANDLER
hexInput.addEventListener('input', (e) => {
    let val = e.target.value;
    // Разрешаем ввод без решетки, добавляем её сами для проверки
    if(!val.startsWith('#') && val.length === 6) val = '#' + val;

    if (/^#[0-9A-F]{6}$/i.test(val)) {
        const hsl = hexToHsl(val);
        colorState.h = hsl.h;
        colorState.s = hsl.s;
        colorState.l = hsl.l;
        
        drawLightBar();
        updateThumbs();
        applyToSelection(val); // <--- ПРИМЕНЯЕМ СРАЗУ
    }
});

// --- возможность открывать свой picker при клике на цветные контролы в панели ---
// клик по input или по добавленному swatch запускает picker
specRoot.addEventListener('click', e => {
    let ctrl = e.target.closest('input[type="color"][data-prop]');
    // если клик был по swatch, перенаправляем на связанный input
    if (!ctrl) {
        const sw = e.target.closest('.color-swatch');
        if (sw && sw._input) ctrl = sw._input;
    }
    // если клик был по тексту в label, ищем вложенный input
    if (!ctrl) {
        const lbl = e.target.closest('label');
        if (lbl) {
            const inp = lbl.querySelector('input[type="color"][data-prop]');
            if (inp) ctrl = inp;
        }
    }
    if (!ctrl) return;
    e.preventDefault();
    const prop = ctrl.getAttribute('data-prop');
    const currentHex = ctrl.value || '';
    const targetEl = lastHighlightedElement || null;
    if (!targetEl) return;
    openColorPicker({ style:{ prop }, ctrl }, targetEl, currentHex, ctrl);
});
// блокируем также события mousedown на реальный input, чтобы не показывать native picker
specRoot.addEventListener('mousedown', e => {
    if (e.target.closest('input[type="color"][data-prop]')) {
        e.preventDefault();
    }
});

// --- визуальные swatch-элементы для цветовых контролов -----------------------
function initColorSwatches() {
    const inputs = specRoot.querySelectorAll('input[type="color"][data-prop]');
    inputs.forEach(inp => {
        // создать видимый квадратик
        const sw = document.createElement('span');
        sw.className = 'color-swatch';
        sw.dataset.prop = inp.dataset.prop;
        sw.style.display = 'inline-block';
        sw.style.width = '1em';
        sw.style.height = '1em';
        sw.style.marginLeft = '0.4em';
        sw.style.verticalAlign = 'middle';
        sw.style.border = '1px solid #666';
        sw.style.backgroundColor = inp.value || '#000000';
        // скрыть сам input, но оставить для хранения значения
        inp.style.position = 'absolute';
        inp.style.opacity = '0';
        inp.style.width = '0';
        inp.style.height = '0';
        inp.style.pointerEvents = 'none';
        inp.parentNode.insertBefore(sw, inp.nextSibling);
        // связываем друг с другом
        sw._input = inp;
        inp._swatch = sw;
        // если значение input изменится программно, обновим swatch
        const observer = new MutationObserver(() => {
            sw.style.backgroundColor = inp.value || '#000000';
        });
        observer.observe(inp, { attributes: true, attributeFilter: ['value'] });
    });
}
// вызвать инициализацию сразу
if (specRoot) initColorSwatches();

closeBtn.addEventListener('click', () => picker.style.display = 'none');
document.addEventListener('mousedown', e => {
    if (picker.style.display === 'block' &&
        !picker.contains(e.target) &&
        !e.target.closest('[simpleformats-button]')) {
        picker.style.display = 'none';

        restoreSelection(); 
        const hex = hslToHex(colorState.h, colorState.s, colorState.l);
        
        if (typeof applyToSelection === 'function') {
            applyToSelection(hex);
        }
    }
});


// --- OPEN ---
// openColorPicker — открывает собственное окно выбора цвета
// cfg: объект конфигурации, минимум { style:{ prop: 'css-property' } }
// el: элемент, с которым связаны изменения (обычно выделенный элемент или null)
// currentHex: стартовый цвет (строка '#rrggbb')
// positionEl (опционально): элемент для позиционирования окна picker, по умолчанию используется el
function openColorPicker(cfg, el, currentHex, positionEl) {
    // activeContext хранит назначение: css-свойство, целевой элемент и возможно контрол
    activeContext = { prop: cfg.style.prop, el, ctrl: cfg.ctrl || null };
    
    // Парсинг стартового цвета
    if (currentHex && /^#[0-9A-F]{6}$/i.test(currentHex)) {
        Object.assign(colorState, hexToHsl(currentHex));
    } else {
        colorState.h = 0; colorState.s = 100; colorState.l = 50;
    }

    picker.style.display = 'block';
    drawHueBar();
    syncFromState();

    // Positioning — элемент, по которому вычисляем координаты
    const posEl = positionEl || el;
    if (posEl) {
        const r = posEl.getBoundingClientRect();
        let top = r.bottom + window.scrollY + 6;
        let left = r.left + window.scrollX;
        if (left + 300 > window.innerWidth) left = window.innerWidth - 310;
        if (left < 10) left = 10;
        if (r.bottom + 160 > window.innerHeight) top = r.top + window.scrollY - 170;
        picker.style.top = top + 'px';
        picker.style.left = left + 'px';
    }
}

document.addEventListener('mousedown', e => {
    const btn = e.target.closest('[simpleformats-button]');
    if(!btn) return;
    const type = btn.getAttribute('simpleformats-button');
    if(['text-color','bg-color'].includes(type)){
        openColorPicker({ style:{ prop: type } }, btn, null);
    }
});


document.getElementById('content').classList.add('editor');

document.getElementById('previewPage').addEventListener('click', () => {
    // 1. Поиск активного блока и вьюхи
    const blocks = Array.from(document.querySelectorAll('[id^="loadedBlock_"]'))
        .filter(b => /^loadedBlock_\d+$/.test(b.id));
    
    let activeBlock = null;
    for (const block of blocks) {
        if (getComputedStyle(block).display !== 'none') {
            activeBlock = block;
            break;
        }
    }

    if (!activeBlock) return;

    const view = activeBlock.querySelector('[id$="_view"]');
    const editorApp = document.getElementById('block-editor-app');
    const content = document.getElementById('content');

    if (!view || !editorApp || !content) return;

    // --- ПЕРЕХОД В ПРЕВЬЮ ---

    // Скрываем редактор, но НЕ удаляем его из DOM
    editorApp.style.display = 'none';
    content.classList.remove('editor');

    // Создаем временный контейнер для превью, чтобы не смешивать с editorApp
    const previewContainer = document.createElement('div');
    previewContainer.id = 'preview-render-area';
    
    // Переносим содержимое из view в контейнер превью
    while (view.firstChild) {
        previewContainer.appendChild(view.firstChild);
    }
    
    content.appendChild(previewContainer);

    // --- КНОПКА ВЫХОДА ---

    const backBtn = document.createElement('button');
    backBtn.innerHTML = '← Выйти из превью';
    Object.assign(backBtn.style, {
        position: 'fixed',
        top: '15px',
        right: '15px',
        zIndex: '10000',
        padding: '10px 15px',
        backgroundColor: 'rgb(255, 68, 68)',
        color: '#fff',
        fontWeight: 'bold',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
    });

    document.body.appendChild(backBtn);

    // --- ЛОГИКА ВОЗВРАТА ---

    backBtn.addEventListener('click', () => {
        // 1. Возвращаем элементы из превью-контейнера обратно в оригинальный view
        while (previewContainer.firstChild) {
            view.appendChild(previewContainer.firstChild);
        }

        // 2. Удаляем временный контейнер превью
        previewContainer.remove();

        // 3. Показываем редактор обратно
        editorApp.style.display = '';
        content.classList.add('editor');

        // 4. Удаляем кнопку
        backBtn.remove();
    });
});




/* хранение кода */
    return api;
})();

// Наблюдаем за блоком и удаляем BlockEditorApp при его удалении
const editor = document.getElementById('block-editor-app');
if (editor && editor.parentNode) {
    const observer = new MutationObserver(mutations => {
        mutations.forEach(m => {
            m.removedNodes.forEach(node => {
                if (node === editor) {
                    console.log('block-editor-app удалён, вызываем destroy');
                    window.BlockEditorApp.destroy();
                    observer.disconnect();
                }
            });
        });
    });
    console.log('Наблюдаем за родителем block-editor-app');
    observer.observe(editor.parentNode, { childList: true });
}



// --- функция показа модального окна и ожидания ввода ---
function showMarkerModal(marker, type = 'message') {
    return new Promise(resolve => {
        const template = document.querySelector('.marker-modal-backdrop');
        if (!template) { console.error('Шаблон .marker-modal-backdrop не найден'); resolve(null); return; }

        const clone = template.cloneNode(true);
        document.body.appendChild(clone);

        const modal = clone.querySelector('.marker-modal');
        const nameEl = clone.querySelector('.marker-name');
        const textEl = clone.querySelector('.marker-text');
        const input = clone.querySelector('.marker-input');
        const okBtn = clone.querySelector('.marker-ok');
        const cancelBtn = clone.querySelector('.marker-cancel');

        okBtn.onclick = cancelBtn.onclick = input.onkeydown = null;
        clone.classList.remove('toast');
        modal.classList.remove('message');
        textEl.style.display = input.style.display = 'none';
        cancelBtn.style.display = '';

        if (type === 'input') {
            clone.style.display = 'flex';
            nameEl.textContent = 'Введите значение:';
            input.style.display = '';
            input.value = '';
            input.placeholder = marker || '';
            setTimeout(() => input.focus(), 0);

            okBtn.onclick = () => closeModal(input.value);
            cancelBtn.onclick = () => closeModal(null);
            input.onkeydown = e => { if (e.key==='Enter') closeModal(input.value); if (e.key==='Escape') closeModal(null); };
        } else {
            clone.classList.add('toast');
            clone.style.display = 'block';
            modal.classList.add('message');
            nameEl.textContent = 'Сообщение:';
            textEl.style.display = 'block';
            textEl.innerHTML = '<hr>' + marker || '';
            cancelBtn.style.display = 'none';

            okBtn.onclick = () => closeModal(true);
            const t = setTimeout(() => closeModal(true), 3000);

            function closeModal(value) {
                clearTimeout(t);
                if (clone.parentNode) document.body.removeChild(clone);
                resolve(value);
            }
            return;
        }

        function closeModal(value) {
            if (clone.parentNode) document.body.removeChild(clone);
            resolve(value);
        }
    });
}


/* работа с id элементов: синхронизация и проверка уникальности */
function syncElementId(newId, el, highlightElements) {
    if (!el) return { valid: false };

    const id = String(newId || '').trim();
    const oldId = el.id || '';

    const clearBg = () => {
        (highlightElements || []).forEach(n => {
            if (n) n.style.backgroundColor = '';
        });
    };

    const setErrorBg = () => {
        (highlightElements || []).forEach(n => {
            if (!n) return;
        
            // Ставим красный фон
            n.style.backgroundColor = '#fdd';
        
            // Добавляем разовый слушатель: как только пользователь уйдет из поля, цвет сбросится
            n.addEventListener('focusout', () => {
                n.style.backgroundColor = '';
            }, { once: true }); 
        });
    };

    // пустой id - просто удалить
    if (!id) {
        clearBg();
        if (oldId) el.removeAttribute('id');
        return { valid: true, reason: 'empty' };
    }

    // ИСПРАВЛЕНИЕ: проверка уникальности по всему document, игнорируя <style> и <script>
    let isDuplicate = false;
    try {
        // Ищем все элементы с таким ID (CSS.escape защищает от ошибок парсинга)
        const existingElements = document.querySelectorAll('[id="' + CSS.escape(id) + '"]');
        // Проверяем, есть ли среди них "настоящие" элементы (не скрипты и не стили)
        isDuplicate = Array.from(existingElements).some(
            node => node !== el && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE'
        );
    } catch(e) {
        // Запасной вариант на случай непредвиденных ошибок селектора
        const fallback = document.getElementById(id);
        isDuplicate = fallback && fallback !== el && fallback.tagName !== 'SCRIPT' && fallback.tagName !== 'STYLE';
    }

    if (isDuplicate) {
        setErrorBg();
        return { valid: false, reason: 'duplicate' };
    }

    clearBg();

    if (oldId === id) return { valid: true, reason: 'same' };

    const view = el.closest('[id^="loadedBlock_"][id$="_view"]');
    const viewId = view ? view.id : null;

    // обновить id элемента
    el.id = id;

    if (!oldId) return { valid: true, reason: 'updated' };
    if (!view) return { valid: true };

    const escOld = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // ИСПРАВЛЕНИЕ: Замена в скриптах ТОЛЬКО внутри кавычек ("oldId", 'oldId', `#oldId`)
    // Группа $1 - это кавычка, группа $2 - возможный символ решетки '#'
    const reScripts = new RegExp('([\'"`])(#?)' + escOld + '\\1', 'g');

    const dynamicScript = document.querySelector('script[data-dynamic-text="' + viewId + '"]');
    const scripts = [];
    if (dynamicScript) scripts.push(dynamicScript);

    view.querySelectorAll('script').forEach(s => {
        if (!scripts.includes(s)) scripts.push(s);
    });

    scripts.forEach(s => {
        try {
            // Подменяем, сохраняя оригинальные кавычки и решетку (если она была)
            s.textContent = s.textContent.replace(reScripts, '$1$2' + id + '$1');
        } catch (e) {}
    });

    // ИСПРАВЛЕНИЕ: Обновление атрибутов (строгие совпадения)
    // Группа $1 - начало строки или пробел, $2 - решетка, $3 - пробел или конец строки
    const reAttr = new RegExp('(^|\\s)(#?)' + escOld + '(\\s|$)', 'g');

    view.querySelectorAll('*').forEach(node => {
        // Пропускаем скрипты и стили внутри view, чтобы не повредить их логику
        if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
        if (!node.attributes) return;

        Array.from(node.attributes).forEach(attr => {
            if (!attr.value) return;
            // Проверяем, есть ли точное совпадение слова oldId или #oldId
            if (attr.value.match(reAttr)) {
                // Заменяем, сохраняя пробелы или решетку
                node.setAttribute(
                    attr.name,
                    attr.value.replace(reAttr, '$1$2' + id + '$3')
                );
            }
        });
    });

    return { valid: true, reason: 'updated' };
}




/* отмена и повтор действий для блоков */
const historyPanel = document.querySelector('.history-actions');
const centerPanel = document.getElementById('center-panel');
const undoBtn = historyPanel?.querySelector('[data-act="undo"]');
const redoBtn = historyPanel?.querySelector('[data-act="redo"]');

let historyData = {}; 
let currentEditor = null;
let isInternalChange = false;
let editorObserver = null;

function logStatus(id, action) {
    const data = historyData[id];
    if (!data) return;
    console.log(`[%c${action.toUpperCase()}%c] Шаг: ${data.index + 1}/${data.stack.length} | ID: ${id}`, 
        'color: #00ff00; font-weight: bold', '');
}

function saveState(editor) {
    if (!editor || isInternalChange) return;

    const id = editor.id;
    if (!id) return;
    if (!historyData[id]) historyData[id] = { stack: [], index: -1 };
    
    const data = historyData[id];
    
    // ВАЖНО: Сохраняем в стек только чистый HTML
    const currentState = getPureHTML(editor.innerHTML);

    // Если после чистки контент совпадает с верхушкой стека — ничего не делаем
    if (data.stack[data.index] === currentState) return;

    data.stack = data.stack.slice(0, data.index + 1);
    data.stack.push(currentState);
    data.index++;
    
    if (data.stack.length > 50) {
        data.stack.shift();
        data.index--;
    }
    /* logStatus(id, "Save"); */
}

// Фильтрация изменений: игнорируем только текст и outline
function setupEditorObserver(editor) {
    if (editorObserver) editorObserver.disconnect();
    
    editorObserver = new MutationObserver((mutations) => {
        if (isInternalChange) return;
        
        let shouldSave = false;
        for (const m of mutations) {
            // Если изменился атрибут style, проверяем, не outline ли это
            if (m.type === 'attributes' && m.attributeName === 'style') {
                // Если в стилях изменился только outline — игнорируем
                const oldStyle = m.oldValue || "";
                const newStyle = editor.getAttribute('style') || "";
                if (oldStyle.replace(/outline:[^;]+;?/, '') !== newStyle.replace(/outline:[^;]+;?/, '')) {
                    shouldSave = true;
                    break;
                }
            } 
            // Если добавились/удалились теги (<b>, <i>, <div> и т.д.)
            else if (m.type === 'childList') {
                shouldSave = true;
                break;
            }
        }
        
        if (shouldSave) {
            saveState(editor);
        }
    });

    editorObserver.observe(editor, {
        childList: true, subtree: true, attributes: true, attributeOldValue: true, characterData: false 
    });
}

function showHistoryPanel(editor) {
    const id = editor.id || "";
    const isValid = (id.startsWith('loadedBlock_') && id.endsWith('_view')) || 
                    ['center-tab-pre-html', 'center-tab-pre-js'].includes(id);

    if (!isValid || !historyPanel || !centerPanel) return;
    
    if (currentEditor !== editor) {
        currentEditor = editor;
        setupEditorObserver(editor);
    }

    /* if (historyPanel.parentNode !== centerPanel) centerPanel.appendChild(historyPanel);
    historyPanel.style.display = 'flex'; */

    if (!historyData[id]) {
        historyData[id] = { stack: [editor.innerHTML], index: 0 };
    }
}

undoBtn?.addEventListener('click', () => {
    if (!currentEditor || isInternalChange) return;
    const id = currentEditor.id;
    const data = historyData[id];
    
    if (!data || data.index <= 0) return;

    const currentHTML = getPureHTML(currentEditor.innerHTML);
    const lastSavedHTML = getPureHTML(data.stack[data.index]);

    if (currentHTML !== lastSavedHTML) {
        saveState(currentEditor);
    }

    // Теперь делаем шаг назад
    if (data.index > 0) {
        isInternalChange = true;
        data.index--;
        currentEditor.innerHTML = data.stack[data.index];
        /* logStatus(id, "Undo"); */
        
        // Увеличиваем таймаут, чтобы MutationObserver успел "пропустить" это изменение
        setTimeout(() => { isInternalChange = false; }, 50);
    }
});
const getPureHTML = (html) => {
    return html
        .replace(/&nbsp;/g, ' ') 
        // 1. Убираем только outline, не трогая остальные стили
        .replace(/outline:[^;]+;?/g, '')
        // 2. Убираем пробел перед закрывающей кавычкой стиля: "width: 10px; " -> "width: 10px;"
        .replace(/;\s+"/g, ';"')
        // 3. Убираем лишние пробелы ТОЛЬКО внутри тегов (между атрибутами)
        // Ищет пробелы, за которыми следует символ, но всё это внутри <>
        .replace(/(<[^>]+)\s{2,}([^>]*>)/g, '$1 $2')
        // 4. Убираем пробелы перед закрытием тега: <div > -> <div>
        .replace(/\s+>/g, '>')
        .trim();
};

redoBtn?.addEventListener('click', () => {
    if (!currentEditor) return;
    const data = historyData[currentEditor.id];
    if (!data || data.index >= data.stack.length - 1) return;

    isInternalChange = true;
    data.index++;
    currentEditor.innerHTML = data.stack[data.index];
    /* logStatus(currentEditor.id, "Redo"); */
    setTimeout(() => isInternalChange = false, 10);
});

// Логика записи текста: только по спецсимволам
document.addEventListener('input', (e) => {
    if (e.target !== currentEditor || isInternalChange) return;

    const data = historyData[currentEditor.id];
    if (data && data.index < data.stack.length - 1) {
        data.stack = data.stack.slice(0, data.index + 1);
    }

    const triggers = [' ', '.', ',', '!', '?', ';', ':', '(', ')', '"', "'", '/', '\\'];
    const isTrigger = e.data && triggers.includes(e.data);
    const isSpecialKey = e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak';

    if (isTrigger || isSpecialKey) {
        saveState(currentEditor);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && currentEditor && !isInternalChange) {
        saveState(currentEditor);
    }

    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redoBtn?.click() : undoBtn?.click();
    }
    if (isMod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redoBtn?.click();
    }
});

document.addEventListener('mousedown', (e) => {
    const target = e.target.closest('[contenteditable="true"]');
    if (target) showHistoryPanel(target);
}, true);

document.addEventListener('focusin', (e) => {
    if (e.target.contentEditable === "true") showHistoryPanel(e.target);
}, true);

let lastCursorOffset = 0; 
let lastContentLen = 0;

document.addEventListener('selectionchange', () => {
    if (!currentEditor || isInternalChange) return;

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        // Проверяем, что работаем внутри активного редактора
        if (currentEditor.contains(container)) {
            const id = currentEditor.id;
            const data = historyData[id];
            if (!data || !data.stack) return;

            const currentHTML = getPureHTML(currentEditor.innerHTML);
            const lastSavedHTML = data.stack[data.index] || "";
            
            // Считаем длину чистого текста (без тегов) и берем позицию курсора
            const currentLen = currentHTML.replace(/<[^>]*>/g, '').length;
            const currentOffset = range.startOffset;

            // 1. Если текущий контент реально отличается от последней записи в истории
            if (currentHTML !== lastSavedHTML) {
                
                // 2. Проверяем на "нормальный набор": 
                // Длина строки выросла на 1 И курсор сместился ровно на 1 вперед
                const isNormalTyping = (currentLen === lastContentLen + 1) && (currentOffset === lastCursorOffset + 1);
                
                // Если это прыжок курсора, вставка или удаление — сохраняем "хвост"
                if (!isNormalTyping) {
                    saveState(currentEditor);
                }
            }

            // Обновляем метки для следующей проверки
            lastContentLen = currentLen;
            lastCursorOffset = currentOffset;
        }
    }
});



/* авто создание иконок */
document.querySelectorAll('svg[use]').forEach(svg => {
    const id = svg.getAttribute('use');
    const color = svg.getAttribute('use-color');
    const background = svg.getAttribute('use-background');

    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', './static/img/icons.svg#' + id);

    if (color) svg.style.color = color;
    else svg.style.color = "#000000";
    if (background) svg.style.background = background;
    else svg.style.background = "";

    svg.appendChild(use);
});