/***********************************************************************
 * Универсальный обработчик вставки элементов из панели
 **********************************************************************/
document.getElementById('htmlElementsInserter').addEventListener('click', async e => {
    const el = e.target.closest('.add-el');
    if (!el) return;

    const dataEl = el.dataset.el;
    if (!dataEl) return;

    restoreSelection(); 

    await handleLoadedBlockView(dataEl, el.textContent || "текст");
    await handlePreHtml(dataEl, el.textContent || "текст");
    
    const blockId = getActiveBlockId();
    if (!blockId) return;
    
    const activeCenterTab = document.querySelector('#modeSwitcherContent .center-tab.active');
    const mode = activeCenterTab ? activeCenterTab.dataset.tab : 'view';
    
    if (mode === 'view') syncHtmlFromView(blockId);
    else if (mode === 'html') syncActiveBlock();
});
document.querySelectorAll('#htmlElementsInserter > div > div:first-child').forEach(tab => {
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
    const isDivWithST = tag === 'div' && hasST;
    if (!range.collapsed && isDivWithST) {
        targetNode = document.createElement(tag || 'div');
        const fragment = range.cloneContents();
        targetNode.appendChild(fragment);
    } else if (tag) {
        // closest по тегу
        targetNode = (tag === 'div') ? null : commonAncestor.closest(tag);
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
    let newEl = cloneNodeFromTemplate(templateNode, tag);
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
    if(!newEl.tagName.toLowerCase() === 'a') newEl = wrapIfMultiLine(range, newEl);
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
            } else if (selectionHasContent && newEl.tagName.toLowerCase() === 'a') {
                const frag = range.cloneContents();
                const out = document.createDocumentFragment();
                
                [...frag.childNodes].forEach(node => {
                    // Пропускаем пустые текстовые узлы (пробелы/переносы)
                    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) {
                        out.appendChild(node); // Сохраняем пробел как есть
                        return;
                    }

                    const a = newEl.cloneNode(true);
                    const st = findSTTextNode(a);

                    if (node.nodeType === Node.TEXT_NODE) {
                        // --- СЛУЧАЙ 1: Просто текст (внутри строки) ---
                        if (st) st.parentNode.replaceChild(node, st);
                        else a.appendChild(node);
                        out.appendChild(a);

                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        // --- СЛУЧАЙ 2: Тег (b, i, span и т.д.) ---
                        const content = document.createDocumentFragment();
                        while (node.firstChild) content.appendChild(node.firstChild);

                        if (st) st.parentNode.replaceChild(content, st);
                        else a.appendChild(content);

                        node.appendChild(a);
                        out.appendChild(node);
                    }
                });

                range.deleteContents();
                range.insertNode(out);
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

    // Перемещаем курсор только если элемент успешно добавлен в DOM
    if (newEl && newEl.parentNode) {
        try {
            sel.removeAllRanges();
            const afterRange = document.createRange();
            afterRange.setStartAfter(newEl);
            afterRange.collapse(true);
            sel.addRange(afterRange);
        } catch (e) {
            console.warn("Не удалось переместить курсор:", e);
        }
    }
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

/* вставка div, чтобы обернуть элементы */
function wrapIfMultiLine(range, node) {
    const fragment = range.cloneContents();
    const div = document.createElement('div');
    div.appendChild(fragment);

    // если есть блочные элементы или переносы → считаем многострочным
    const isMulti =
        div.querySelector('div, p, br, table, ul, ol, li') ||
        div.innerHTML.includes('\n');

    if (!isMulti) return node;

    const wrapper = document.createElement('div');
    wrapper.appendChild(node);
    return wrapper;
}

/* вставка таблицы */
const tableInsertBtn = document.querySelector('.table-insert-btn');
const tableSizeMenu = document.getElementById('table-size-menu');
const tableSizeGrid = document.getElementById('table-size-grid');
const tableSizeLabel = document.getElementById('table-size-label');

let tableHoverCols = 0;
let tableHoverRows = 0;

for (let r = 1; r <= 10; r++) {
    for (let c = 1; c <= 10; c++) {
        const cell = document.createElement('div');
        cell.dataset.rows = r;
        cell.dataset.cols = c;
        tableSizeGrid.appendChild(cell);
    }
}

function buildTableDataEl(rows, cols) {
    let html = '<table>';
    for (let r = 0; r < rows; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
            html += '<td><br></td>';
        }
        html += '</tr>';
    }
    html += '</table>';
    return html;
}

function hideTableMenu() {
    tableSizeMenu.style.display = 'none';
    tableHoverCols = 0;
    tableHoverRows = 0;
    tableSizeLabel.textContent = '0 × 0';
    Array.from(tableSizeGrid.children).forEach(cell => {
        cell.style.background = '#fff';
    });
}

function paintTableGrid(rows, cols) {
    Array.from(tableSizeGrid.children).forEach(cell => {
        const r = Number(cell.dataset.rows);
        const c = Number(cell.dataset.cols);
        cell.style.background = (r <= rows && c <= cols) ? '#bcdcff' : '#fff';
    });
    tableSizeLabel.textContent = `${cols} × ${rows}`;
}

if (tableInsertBtn) {
    tableInsertBtn.addEventListener('click', e => {
        e.stopPropagation();

        const rect = tableInsertBtn.getBoundingClientRect();
        tableSizeMenu.style.left = `${rect.left + window.scrollX}px`;
        tableSizeMenu.style.top = `${rect.bottom + window.scrollY + 4}px`;
        tableSizeMenu.style.display = 'block';
    });
}

tableSizeGrid.addEventListener('mouseover', e => {
    const cell = e.target.closest('[data-rows][data-cols]');
    if (!cell) return;

    tableHoverRows = Number(cell.dataset.rows);
    tableHoverCols = Number(cell.dataset.cols);
    paintTableGrid(tableHoverRows, tableHoverCols);
});

tableSizeGrid.addEventListener('click', async e => {
    const cell = e.target.closest('[data-rows][data-cols]');
    if (!cell) return;

    const rows = Number(cell.dataset.rows);
    const cols = Number(cell.dataset.cols);
    const dataEl = buildTableDataEl(rows, cols);

    hideTableMenu();
    restoreSelection();

    await handleLoadedBlockView(dataEl, 'таблица');
    await handlePreHtml(dataEl, 'таблица');

    const blockId = getActiveBlockId();
    if (!blockId) return;

    const activeCenterTab = document.querySelector('#modeSwitcherContent .center-tab.active');
    const mode = activeCenterTab ? activeCenterTab.dataset.tab : 'view';

    if (mode === 'view') syncHtmlFromView(blockId);
    else if (mode === 'html') syncActiveBlock();
});

document.addEventListener('click', e => {
    if (!tableSizeMenu.contains(e.target) && e.target !== tableInsertBtn) {
        hideTableMenu();
    }
});

/* вставка картинки */
const imgBtn = document.querySelector('.image-insert-btn');
const imgMenu = document.querySelector('.image-insert-dropdown');

imgBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    const rect = imgBtn.getBoundingClientRect();

    imgMenu.style.display = 'block';
    imgMenu.style.left = rect.left + window.scrollX + 'px';
    imgMenu.style.top = rect.bottom + window.scrollY + 'px';
});

document.addEventListener('click', () => {
    imgMenu.style.display = 'none';
});

document.querySelectorAll('.image-insert-item').forEach(item => {
    item.addEventListener('click', async (e) => {
        e.stopPropagation();

        const action = item.dataset.action;

        if (action === 'url') {
            const url = await showMarkerModal('Введите URL изображения', 'input');
            if (!url) return;
            insertImage(url);
        }

        if (action === 'file') {
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = 'image/*';

            inp.onchange = () => {
                const file = inp.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = () => {
                    insertImage(reader.result);
                };
                reader.readAsDataURL(file);
            };

            inp.click();
        }

        imgMenu.style.display = 'none';
    });
});

function insertImage(src) {
    restoreSelection();

    const img = document.createElement('img');
    img.src = src;

    const sel = document.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(img);

    range.setStartAfter(img);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
}