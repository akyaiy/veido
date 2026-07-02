/* блок свойства */
const menu = document.getElementById('ed-properties');
let clipboard = null;
let tableContext = null; // { table: Element, cell: Element|null }

document.addEventListener('contextmenu', e => {
    const el = findEditableElement(e.target);
    if (!el) return;

    // если есть выделение, показываем обычное контекстное меню
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
        return;
    }
    e.preventDefault(); // блокируем системное меню

    menu.style.display = 'block';
    menu.style.top = e.pageY + 5 + 'px';
    menu.style.left = e.pageX + 5 + 'px';

    const editableArea = e.target.closest('[contenteditable="true"]');
    if (!editableArea) {
        menu.style.display = 'none';
        tableContext = null;
        return;
    }

    const hasTextSelection = selection && !selection.isCollapsed;

    const clickedTable = e.target.closest('table');
    const clickedCell = e.target.closest('td,th');
    tableContext = clickedTable ? { table: clickedTable, cell: clickedCell } : null;

    // Paste
    const pasteItem = menu.querySelector('[act="paste"]');
    if (pasteItem) pasteItem.style.display = navigator.clipboard?.readText ? '' : 'none';

    // Элементы
    const elementItems = menu.querySelectorAll('.elementProp');
    elementItems.forEach(item => {
        item.style.display = (el && !hasTextSelection) ? '' : 'none';
    });

    // Таблица
    const tableItems = menu.querySelectorAll('.elementTableProp');
    tableItems.forEach(item => {
        item.style.display = (tableContext && !hasTextSelection) ? '' : 'none';
    });

    // Если все скрыто
    const anyVisible = Array.from(menu.children).some(i => i.style.display !== 'none');
    if (!anyVisible) {
        menu.style.display = 'none';
        tableContext = null;
        return;
    }

    if (el && !hasTextSelection) {
        selectedEl = el;
        selectElementForPanels(el);
        showSpecForTarget(el);
        populateSpecialProps(el);
        syncCssPanelVisibility();
    } else {
        clearSelection();
    }
});

document.addEventListener('click', e => {
    const el = findEditableElement(e.target);
    if (!el) return;

    const selection = window.getSelection();
    const hasTextSelection = selection && !selection.isCollapsed;

    if (el && !hasTextSelection) {
        selectedEl = el;
        selectElementForPanels(el);
        showSpecForTarget(el);
        populateSpecialProps(el);
        syncCssPanelVisibility();
    } else {
        clearSelection();
    }
});

// --- Управление видимостью панели ----------------------------------------------
function showSpecForTarget(targetOrEl) {
    // показать панель специальных свойств только если вкладка properties активна
    const activeTab = document.querySelector('#panelsSwitcher .tab.active');
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

// Получить округлённое числовое значение CSS (без единицы)
function getComputedNum(v) {
    if (!v && v !== 0) return '';
    const n = parseFloat(v);
    return isNaN(n) ? '' : Math.round(n);
}

// Преобразовать rgb(...) в hex
function rgbToHex(rgb) {
    if (!rgb) return '';
    if (rgb[0] === '#') return rgb;
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return '';
    return '#' + [m[1], m[2], m[3]].map(x => parseInt(x, 10).toString(16).padStart(2, '0')).join('');
}

// Click — только для рамки, без добавления нового элемента
document.addEventListener('click', e => {
    if (shouldKeepSpecPanelVisible(e.target)) {
        return;
    }
    if (selectedEl === findEditableElement(e.target)) {
        // тот же элемент — сохраняем рамку
        updateOutline(selectedEl);
    } else {
        // другой элемент или пустое место — сброс
        selectedEl = null;
        updateOutline(null);
        menu.style.display = 'none';
    }
});

document.addEventListener('click', () => { menu.style.display = 'none'; tableContext = null; });
document.addEventListener('input', () => { menu.style.display = 'none'; tableContext = null; });
document.addEventListener('paste', () => { menu.style.display = 'none'; tableContext = null; });

// Обработка нажатий по пунктам меню
menu.addEventListener('click', async e => {
    const act = e.target.getAttribute('act');

    switch(act) {
        case 'copy':
            if (!selectedEl || !navigator.clipboard?.writeText) break;
            await navigator.clipboard.writeText(selectedEl.outerHTML);
            break;
        case 'cut':
            if (!selectedEl || !navigator.clipboard?.writeText) break;
            await navigator.clipboard.writeText(selectedEl.outerHTML);
            selectedEl.remove();
            selectedEl = null;
            break;
        case 'paste':
            if (navigator.clipboard?.read) {
                try {
                    const items = await navigator.clipboard.read();
                    if (!items.length) break;
                    const sel = window.getSelection();
                    if (!sel.rangeCount) break;
                    const range = sel.getRangeAt(0);

                    for (const item of items) {
                        for (const type of item.types) {
                            const blob = await item.getType(type);
                            let node;
                            if (type.startsWith('image/')) {
                                const url = URL.createObjectURL(blob);
                                node = document.createElement('img');
                                node.src = url;
                            } else if (type === 'text/plain') {
                                const text = await blob.text();
                                node = document.createTextNode(text);
                            } else if (type === 'text/html') {
                                const html = await blob.text();
                                const frag = document.createRange().createContextualFragment(html);
                                node = frag;
                            }
                            if (node) {
                                range.deleteContents();
                                range.insertNode(node);
                                range.setStartAfter(node);
                                range.collapse(true);
                            }
                        }
                    }

                    sel.removeAllRanges();
                    sel.addRange(range);
                } catch (err) {
                    console.error('Clipboard paste failed', err);
                }
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

        // таблица - добавить строку
        case 'addLine':
            if (!tableContext || !tableContext.table) break;
            {
                const cell = tableContext.cell;
                const tr = cell ? cell.closest('tr') : null;

                if (tr) {
                    const newTr = tr.cloneNode(true);
                    Array.from(newTr.children).forEach(td => td.innerHTML = '<br>');
                    tr.after(newTr);
                } else {
                    const rows = tableContext.table.querySelectorAll('tr');
                    if (rows.length) {
                        const newTr = rows[rows.length - 1].cloneNode(true);
                        Array.from(newTr.children).forEach(td => td.innerHTML = '<br>');
                        rows[rows.length - 1].after(newTr);
                    }
                }
            }
            break;

        // таблица - добавить столбец
        case 'addColumn':
            if (!tableContext || !tableContext.table) break;
            {
                const cell = tableContext.cell;
                let colIndex = null;

                if (cell) {
                    colIndex = cell.cellIndex;
                } else {
                    const firstRow = tableContext.table.querySelector('tr');
                    if (firstRow && firstRow.children.length) colIndex = firstRow.children.length - 1;
                }

                if (colIndex != null) {
                    Array.from(tableContext.table.querySelectorAll('tr')).forEach(tr => {
                        const cells = tr.children;
                        const refCell = cells[colIndex];
                        if (!refCell) return;

                        const newCell = refCell.cloneNode(true);
                        newCell.innerHTML = '<br>';
                        refCell.after(newCell);
                    });
                }
            }
            break;

        // Открытие блока в новой страниц
        case 'newLoadedBlock': {
            const selectedElCont = selectedEl

            const viewTab = document.querySelector('#modeSwitcherContent .center-tab[data-tab="view"]');
            viewTab.click();

            let tabs = document.getElementById('blocks-tabs');
            let container = document.getElementById('loadedBlockMain');

            if (!container) {
                container = document.createElement('div');
                container.id = 'loadedBlockMain';
                mainEl.appendChild(container);
            }

            let existingTab;

            if (selectedEl) {
                tabs.querySelectorAll('.tab').forEach(t => {
                    if (t.dataset.selectedEl === selectedEl) existingTab = t;
                });
            }

            function switchTo(blockId, tabEl) {
                tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                if (tabEl) tabEl.classList.add('active');

                Array.from(container.children).forEach(ch => {
                    if (ch !== document.querySelector('.resizeHandle')) {
                        ch.style.display = ch.id === blockId ? '' : 'none';
                    }
                });

                const activeCenterTab = document.querySelector('#modeSwitcherContent .center-tab.active');
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
            viewDiv.addEventListener('input', () => {
                viewDiv.dataset.dirty = "true";
                syncHtmlFromView(blockId);
            });
            viewDiv.replaceChildren(selectedElCont.cloneNode(true));

            const htmlDiv = document.createElement('div');
            htmlDiv.id = blockId + '_html';
            htmlDiv.style.display = 'none';
            htmlDiv.innerHTML = selectedElCont.outerHTML;

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

            const tabEl = document.createElement('div');
            tabEl.className = 'tab';

            // вместо path
            tabEl.dataset.selectedEl = selectedEl;

            tabEl.dataset.blockId = blockId;
            tabEl.textContent = selectedEl?.tagName?.toLowerCase() || "*new";

            tabEl.onclick = () => switchTo(blockId, tabEl);

            const closeBtn = document.createElement('span');
            closeBtn.textContent = '×';
            closeBtn.style.marginLeft = '6px';
            closeBtn.style.cursor = 'pointer';
            closeBtn.onclick = e => closeBlock(e, block, tabEl);

            tabEl.appendChild(closeBtn);
            tabs.appendChild(tabEl);

            switchTo(blockId, tabEl);

            const observer = new MutationObserver(mutations => {
                mutations.forEach(m => {
                    m.addedNodes.forEach(n => {
                        if (!n || n.nodeType !== 1) return;
                        if (n.tagName !== 'SCRIPT') return;

                        const s = n;
                        if (s.getAttribute('data-dynamic-text') === blockId + '_view') return;

                        let txt = s.textContent || '';
                        scriptText.textContent = (scriptText.textContent || '') + '\n' + txt;

                        try { s.remove(); } catch (e) {}
                    });
                });
            });

            observer.observe(scriptsDiv, { childList: true });

            showJs(blockId);
            showView(blockId);

            break;
        }
    }

    menu.style.display = 'none';
    tableContext = null;
});

function shouldKeepSpecPanelVisible(target) {
    return Boolean(
        target &&
        target.closest &&
        (
            target.closest('#propertiesPanel') ||
            target.closest('#rgb-picker') ||
            target.closest('.color-swatch')
        )
    );
}


/***********************************************************************
 * Специальные свойства (рефакторинг: универсальная обработка).
 **********************************************************************/
const specRoot = document.getElementById('propertiesPanel');
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
window.lastHighlightedElement = null;

// Список тегов, которые не могут содержать другие элементы или текст
const ATOMIC_TAGS = new Set(['img', 'hr', 'input', 'progress', 'meter', 'video', 'audio', 'iframe', 'select']);

function findEditableElement(startNode) {
    // --- ПРОВЕРКА ДЛЯ ATOMIC TAGS (оставлена без изменений) ---
    if (startNode && startNode.nodeType === 1) {
        const startTag = startNode.tagName.toLowerCase();
        if (ATOMIC_TAGS.has(startTag) && EDITABLE_TAGS.has(startTag)) {
            if (!startNode.closest('[contenteditable="true"]')) return updateOutline(null);
            return updateOutline(startNode);
        }
    }

    if (!startNode) return updateOutline(null);

    // 1. Инициализация таргета (сразу берем родителя, если это текст)
    let target = startNode;
    let el = target.nodeType === Node.TEXT_NODE ? target.parentElement : target;

    // 2. Поиск контейнера view
    const view = el.closest('[id^="loadedBlock_"][id$="_view"]');
    if (!view) return updateOutline(null);

    // 3. --- ГИБРИДНАЯ ПРОВЕРКА ССЫЛКИ (интегрирована из contextmenu) ---
    let closestLink = el.closest('a');

    if (!closestLink) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && sel.anchorNode) {
            const nodeInside = sel.anchorNode;
            const parentInside = nodeInside.nodeType === Node.TEXT_NODE ? nodeInside.parentElement : nodeInside;
            closestLink = parentInside.closest('a');
        }
    }

    // Если ссылка найдена (любым способом) - проверяем, что она в нашем view и редактируема
    if (closestLink && view.contains(closestLink) && EDITABLE_TAGS.has('a')) {
        if (!closestLink.closest('[contenteditable="true"]')) return updateOutline(null);
        return updateOutline(closestLink);
    }

    // 4. Поиск вверх по дереву (оставлен без изменений)
    let foundUp = null;
    let upNode = el;
    while (upNode && upNode !== view) {
        if (upNode.nodeType === 1) {
            const tag = upNode.tagName.toLowerCase();
            if (EDITABLE_TAGS.has(tag)) {
                foundUp = upNode;
                break; // Мы нашли ближайший редактируемый элемент
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


// Сброс выбора: скрыть specRoot, восстановить normalPanel
function clearSelection() {
    selectedEl = null;
    const cssActiveTab = document.querySelector('#panelsSwitcher .tab.active');
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
