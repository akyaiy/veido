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
                td3.onclick = (e) => {
                    e.stopPropagation();
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
        td3.onclick = (e) => {
            e.stopPropagation();
            removeAttrRow(tr, nameTd);
        };
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



const toggleCssPanel = document.getElementById('toggle-css-panel');
/* скрытие и показ css меню */
toggleCssPanel.addEventListener('change', () => {
    syncCssPanelVisibility();
    if (!toggleCssPanel.checked || !currentSelectedEl) return;
    updateTagLabel(currentSelectedEl);
    updateCssPanel(currentSelectedEl);
    updatePropertiesPanel(currentSelectedEl);
});





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


// reposition
window.addEventListener('resize', () => {
    if (currentClassAutoTarget && classAutoBox.style.display !== 'none') {
        positionClassAutocomplete(currentClassAutoTarget);
    }
});

// hide outside
document.addEventListener('mousedown', e => {
    if (currentClassAutoTarget && !classAutoBox.contains(e.target) && e.target !== currentClassAutoTarget) {
        hideClassAutocomplete();
    }
});

function hideClassAutocomplete() {
    classAutoBox.style.display = 'none';
    currentClassAutoTarget = null;
}

function getActiveId(el) {
    if (!el) return '';
    if (activeIdByEl.has(el)) return activeIdByEl.get(el) || '';
    return el.id || '';
}

function setActiveId(el, val) {
    if (!el) return;
    activeIdByEl.set(el, val);
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