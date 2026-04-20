const specRoot = document.getElementById('properties-panel-spec');
const normalPanel = document.getElementById('properties-panel');

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
    'img-alt':         { type: 'attr', attrName: 'alt', tag: 'img' },
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
    'button-type':     { type: 'attr', attrName: 'type', tag: 'button' },
    'details-open':    { type: 'attr', attrName: 'open', tag: 'details', booleanAttr: true },
    'range-min':       { type: 'attr', attrName: 'min', tag: 'input' },
    'range-max':       { type: 'attr', attrName: 'max', tag: 'input' },
    'range-value':     { type: 'attr', attrName: 'value', tag: 'input' },
    'progress-value':  { type: 'attr', attrName: 'value', tag: 'progress' },
    'file-accept':     { type: 'attr', attrName: 'accept', tag: 'input' },
    'file-multiple':   { type: 'attr', attrName: 'multiple', tag: 'input', booleanAttr: true },
    'display':         { type: 'style', cssName: 'display' },
    'resize':          { type: 'style', cssName: 'resize' },
    'link':            { type: 'attr', attrName: 'universal-link' },
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
                /* если ссылка */
                let attrName = map.attrName;
                if (prop === 'link') {
                    const tagName = el.tagName.toLowerCase();
                    if (['img', 'iframe', 'video', 'audio'].includes(tagName)) attrName = 'src';
                    else if (tagName === 'a' || tagName === 'figure') attrName = 'href';
                    else attrName = 'href';
                }
                // только если тег совпадает (если указано)
                if (map.tag && el.tagName.toLowerCase() !== map.tag) {
                    setCtrl('');
                } else {
                    if (map.booleanAttr) {
                        setCtrl(el.hasAttribute(attrName));
                    } else if (attrName === 'value') {
                        setCtrl(el.value != null ? el.value : (el.getAttribute('value') || ''));
                    } else {
                        setCtrl(el.getAttribute(attrName) || '');
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

            /* если ссылка */
            let attrName = map.attrName;
            if (prop === 'link') {
                const tagName = el.tagName.toLowerCase();
                attrName = (tagName === 'img' || tagName === 'iframe' || tagName === 'video' || tagName === 'audio') ? 'src' : 'href';
            }

            if (map.attrName === 'id') {
                // Ищем поле ввода id в панели свойств (обычно через data-prop)
                const inputEl = document.querySelector('[data-prop="id"]');
                const result = syncElementId(val, el, inputEl ? [inputEl] : []);
                if (result.valid) markDirty();
                return;
            }
            
            if (map.booleanAttr) {
                if (val) el.setAttribute(attrName, '');
                else el.removeAttribute(attrName);
            } else if (attrName === 'value') {
                try { el.value = val; } catch (e) { el.setAttribute(attrName, String(val)); }
            } else {
                if (val === '') el.removeAttribute(attrName);
                else el.setAttribute(attrName, String(val));
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

