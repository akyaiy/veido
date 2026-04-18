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