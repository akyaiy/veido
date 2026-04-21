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

            const viewTab = document.querySelector('#center-tabs .center-tab[data-tab="view"]');
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
                    if (ch !== document.querySelector('.small-handle')) {
                        ch.style.display = ch.id === blockId ? '' : 'none';
                    }
                });

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
            target.closest('#properties-panel-spec') ||
            target.closest('#rgb-picker') ||
            target.closest('.color-swatch')
        )
    );
}