/* === Константы и конфигурация === */

// Контейнер контекстного меню
const contextMenu = document.getElementById('contextMenu');

// Идентификаторы действий, относящихся к работе с таблицами
const tableActions = ['addLine', 'addColumn', 'deleteLine', 'deleteColumn'];

/* ***
 * getActiveEditorSelection - получение текущего выделения в активном редакторе
 * - проверяет наличие глобального объекта редактора и его метода получения выделения
 * - возвращает объект Selection или null
*** */
function getActiveEditorSelection() {
    if (window.editorBlock && typeof window.editorBlock.getEditorSelection === 'function') {
        return window.editorBlock.getEditorSelection();
    }
    return window.getSelection ? window.getSelection() : null;
}

/* ***
 * getActiveEditorDocument - получение документа активного редактора
 * - проверяет наличие глобального объекта редактора и его метода получения документа
 * - возвращает объект Document или null
*** */
function getActiveEditorDocument() {
    if (window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function') {
        return window.editorBlock.getEditorDocument();
    }
    return document;
}

/* === Действия контекстного меню (Хелперы) === */

/* ***
 * getContextMenuPosition - вычисление координат клика для позиционирования контекстного меню
 * - принимает объект события event
 * - учитывает прокрутку страницы и вложенность в iframe
 * - возвращает объект с координатами { pageX, pageY }
*** */
function getContextMenuPosition(event) {
    let clientX = event.clientX;
    let clientY = event.clientY;

    // Если событие пришло из iframe
    if (event.view && event.view !== window && event.view.frameElement) {
        const iframe = event.view.frameElement;
        const iframeRect = iframe.getBoundingClientRect();

        // Позиция внутри viewport родительского окна:
        // Координата внутри iframe + положение самого iframe на основном экране
        clientX += iframeRect.left;
        clientY += iframeRect.top;
    }

    // Прибавляем скролл главного (родительского) окна, так как #contextMenu 
    // спозиционирован абсолютно в документе верхнего уровня
    const pageX = clientX + (window.scrollX || window.pageXOffset || 0);
    const pageY = clientY + (window.scrollY || window.pageYOffset || 0);

    return { pageX, pageY };
}

/* ***
 * executeCopyAction - копирование outerHTML выбранного элемента в буфер обмена
 * - считывает HTML-код текущего выбранного элемента
 * - записывает полученную разметку в системный буфер обмена через clipboard API
 * - отдает Promise
*** */
async function executeCopyAction() {
    const selection = getActiveEditorSelection();
    const editorDoc = getActiveEditorDocument();
    if (selection && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const container = editorDoc.createElement('div');
        container.appendChild(range.cloneContents());

        const html = container.innerHTML;
        const text = selection.toString();

        if (navigator.clipboard?.write) {
            const clipboardItems = {};
            if (html) clipboardItems['text/html'] = new Blob([html], { type: 'text/html' });
            clipboardItems['text/plain'] = new Blob([text], { type: 'text/plain' });
            await navigator.clipboard.write([new ClipboardItem(clipboardItems)]);
        } else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text || html);
        }
        return true;
    }

    if (navigator.clipboard?.writeText && window.editorBlock.selectedElement) {
        await navigator.clipboard.writeText(window.editorBlock.selectedElement.outerHTML);
        return true;
    }

    return false;
}

/* ***
 * executeCutAction - вырезание элемента с копированием в буфер обмена
 * - копирует разметку выбранного узла или выделенный текст в буфер обмена
 * - при выделении текста удаляет его, при элементе удаляет элемент из DOM
 * - отдает Promise
*** */
async function executeCutAction() {
    const selection = getActiveEditorSelection();
    const editorDoc = getActiveEditorDocument();
    if (selection && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const container = editorDoc.createElement('div');
        container.appendChild(range.cloneContents());

        const html = container.innerHTML;
        const text = selection.toString();

        if (navigator.clipboard?.write) {
            const clipboardItems = {};
            if (html) clipboardItems['text/html'] = new Blob([html], { type: 'text/html' });
            clipboardItems['text/plain'] = new Blob([text], { type: 'text/plain' });
            await navigator.clipboard.write([new ClipboardItem(clipboardItems)]);
        } else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text || html);
        }

        range.deleteContents();
        selection.removeAllRanges();
        return true;
    }

    if (navigator.clipboard?.writeText && window.editorBlock.selectedElement) {
        await navigator.clipboard.writeText(window.editorBlock.selectedElement.outerHTML);
        window.editorBlock.selectedElement.remove();
        window.editorBlock.selectedElement = null;
        return true;
    }

    return false;
}

/* ***
 * executePasteAction - вставка содержимого из буфера обмена в текущее выделение
 * - читает данные из буфера обмена и определяет наиболее приоритетный тип контента
 * - преобразует изображения в элементы img, а любой текст и HTML принудительно парсит как HTML-фрагмент
 * - очищает выделение, внедряет полученные узлы в DOM и перемещает каретку в конец вставки
 * - отдает Promise
*** */
async function executePasteAction() {
    if (!navigator.clipboard?.read) {
        return false;
    }

    const clipboardItems = await navigator.clipboard.read();
    if (!clipboardItems.length) {
        return false;
    }
    
    await window.editorBlock.restoreSelection();
    const activeSelection = getActiveEditorSelection();
    if (!activeSelection || !activeSelection.rangeCount) {
        return;
    }
    
    const selectionRange = activeSelection.getRangeAt(0);
    const clipboardItem = clipboardItems[0];

    let targetType = null;
    if (clipboardItem.types.includes('text/html')) {
        targetType = 'text/html';
    } else if (clipboardItem.types.includes('text/plain')) {
        targetType = 'text/plain';
    } else {
        targetType = clipboardItem.types.find(type => type.startsWith('image/'));
    }

    if (!targetType) {
        return false;
    }

    const dataBlob = await clipboardItem.getType(targetType);
    let nodesFragment = null;

    const editorDoc = getActiveEditorDocument();

    if (targetType.startsWith('image/')) {
        const imageUrl = URL.createObjectURL(dataBlob);
        nodesFragment = editorDoc.createElement('img');
        nodesFragment.src = imageUrl;
    } else if (targetType === 'text/html' || targetType === 'text/plain') {
        const contentText = await dataBlob.text();
        nodesFragment = editorDoc.createRange().createContextualFragment(contentText);
    }

    if (nodesFragment) {
        selectionRange.deleteContents();

        const lastChild = nodesFragment.nodeType === Node.DOCUMENT_FRAGMENT_NODE
            ? nodesFragment.lastChild
            : nodesFragment;

        selectionRange.insertNode(nodesFragment);

        if (lastChild) {
            selectionRange.setStartAfter(lastChild);
            selectionRange.collapse(true);
        }
    }

    activeSelection.removeAllRanges();
    activeSelection.addRange(selectionRange);
    return true;
}

/* ***
 * executeDeleteAction - полное удаление выбранного элемента из DOM
 * - вырезает текущий выделенный HTML-элемент со страницы
 * - очищает глобальную ссылку в объекте редактора во избежание утечек памяти
 * - отдает null
*** */
function executeDeleteAction() {
    const selection = getActiveEditorSelection();
    if (selection && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        selection.removeAllRanges();
        return true;
    }

    if (window.editorBlock.selectedElement) {
        window.editorBlock.selectedElement.remove();
        window.editorBlock.selectedElement = null;
        return true;
    }

    return false;
}

/* ***
 * executeDeleteLineAction - удаление строки таблицы
 * - принимает элемент таблицы currentTable и текущую ячейку currentCell
 * - находит строку tr, в которой находится фокус пользователя, и полностью её удаляет
 * - если фокуса на ячейке нет, то срезает самую последнюю строку в целевой таблице
 * - отдает null
*** */
function executeDeleteLineAction(currentTable, currentCell) {
    if (!currentTable) {
        return;
    }

    if (currentCell) {
        const targetRow = currentCell.closest('tr');
        if (targetRow) {
            targetRow.remove();
        }
    } else {
        const allRows = currentTable.querySelectorAll('tr');
        if (allRows.length) {
            allRows[allRows.length - 1].remove();
        }
    }
}

/* ***
 * executeDeleteColumnAction - удаление столбца таблицы
 * - принимает элемент таблицы currentTable и текущую ячейку currentCell
 * - вычисляет индекс удаляемой колонки по текущей активной ячейке
 * - проходит циклом по всем строкам tr таблицы и удаляет ячейки с этим индексом
 * - отдает null
*** */
function executeDeleteColumnAction(currentTable, currentCell) {
    if (!currentTable) {
        return;
    }

    let targetColumnIndex = null;

    if (currentCell) {
        targetColumnIndex = currentCell.cellIndex;
    } else {
        const firstTableRow = currentTable.querySelector('tr');
        if (firstTableRow && firstTableRow.children.length) {
            targetColumnIndex = firstTableRow.children.length - 1;
        }
    }

    if (targetColumnIndex != null) {
        Array.from(currentTable.querySelectorAll('tr')).forEach(rowElement => {
            const totalCells = rowElement.children;
            if (totalCells[targetColumnIndex]) {
                totalCells[targetColumnIndex].remove();
            }
        });
    }
}

/* ***
 * executeAddLineAction - добавление новой строки в таблицу
 * - принимает элемент таблицы currentTable и текущую ячейку currentCell
 * - дублирует текущую или последнюю строку tr со всей структурой ячеек
 * - полностью очищает текст во всех новых ячейках, оставляя в них пустые теги br
 * - отдает null
*** */
function executeAddLineAction(currentTable, currentCell) {
    if (!currentTable) {
        return;
    }

    const currentRow = currentCell ? currentCell.closest('tr') : null;

    if (currentRow) {
        const clonedRow = currentRow.cloneNode(true);
        Array.from(clonedRow.children).forEach(cellNode => {
            cellNode.innerHTML = '<br>';
        });
        currentRow.after(clonedRow);
    } else {
        const tableRows = currentTable.querySelectorAll('tr');
        if (tableRows.length) {
            const lastClonedRow = tableRows[tableRows.length - 1].cloneNode(true);
            Array.from(lastClonedRow.children).forEach(cellNode => {
                cellNode.innerHTML = '<br>';
            });
            tableRows[tableRows.length - 1].after(lastClonedRow);
        }
    }
}

/* ***
 * executeAddColumnAction - добавление нового столбца в таблицу
 * - принимает элемент таблицы currentTable и текущую ячейку currentCell
 * - находит нужный индекс ячейки и создает пустую копию тега td/th для каждой строки
 * - вставляет новые пустые колонки строго справа от текущего выбранного столбца
 * - отдает null
*** */
function executeAddColumnAction(currentTable, currentCell) {
    if (!currentTable) {
        return;
    }

    let targetColumnIndex = null;

    if (currentCell) {
        targetColumnIndex = currentCell.cellIndex;
    } else {
        const firstTableRow = currentTable.querySelector('tr');
        if (firstTableRow && firstTableRow.children.length) {
            targetColumnIndex = firstTableRow.children.length - 1;
        }
    }

    if (targetColumnIndex != null) {
        Array.from(currentTable.querySelectorAll('tr')).forEach(rowElement => {
            const totalCells = rowElement.children;
            const referencedCell = totalCells[targetColumnIndex];
            if (!referencedCell) {
                return;
            }

            const clonedCell = referencedCell.cloneNode(true);
            clonedCell.innerHTML = '<br>';
            referencedCell.after(clonedCell);
        });
    }
}

/* ***
 * getNewLoadedBlockSource - получение источника для открытия нового блока
 * - если есть текстовое выделение, делает из него HTML-фрагмент
 * - если текстового выделения нет, возвращает выбранный DOM-элемент
 * - возвращает либо HTML-строку, либо Element, либо null
*** */
function getNewLoadedBlockSource() {
    const selection = getActiveEditorSelection();
    const editorDoc = getActiveEditorDocument();
    const hasActiveTextSelection = selection && !selection.isCollapsed;
    if (hasActiveTextSelection) {
        const range = selection.getRangeAt(0);
        const container = editorDoc.createElement('div');
        container.appendChild(range.cloneContents());
        return container.innerHTML;
    }

    if (window.editorBlock && window.editorBlock.selectedElement) {
        return window.editorBlock.selectedElement;
    }

    return null;
}



/* === Обработчики событий === */

/* ***
 * handleContextMenu - обработка вызова контекстного меню приложения
 * - принимает объект события event
 * - рассчитывает координаты клика и выводит кастомный блок меню возле курсора
 * - проверяет, нажат ли клик внутри таблицы, и скрывает или показывает специфичные кнопки
 * - отдает null
*** */
function handleContextMenu(event) {
    const windowSelection = getActiveEditorSelection();
    const hasActiveTextSelection = windowSelection && !windowSelection.isCollapsed;
    const selectedElement = window.editorBlock ? window.editorBlock.selectedElement : null;
    const selectionAnchorElement = hasActiveTextSelection ? (windowSelection.anchorNode?.nodeType === Node.TEXT_NODE ? windowSelection.anchorNode.parentElement : windowSelection.anchorNode) : null;
    const targetElement = event.target && event.target.nodeType === Node.TEXT_NODE ? event.target.parentElement : event.target;
    const activeSelectionElement = selectedElement || selectionAnchorElement || (targetElement && targetElement.closest ? targetElement.closest('[contenteditable="true"]') : null);

    if (!window.editorBlock || !activeSelectionElement) {
        return;
    }

    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    const { pageX, pageY } = getContextMenuPosition(event);

    contextMenu.style.display = 'block';
    contextMenu.style.top = pageY + 5 + 'px';
    contextMenu.style.left = pageX + 5 + 'px';

    const targetEditableArea = targetElement && targetElement.closest ? targetElement.closest('[contenteditable="true"]') : null;
    if (!targetEditableArea && !selectedElement && !hasActiveTextSelection) {
        contextMenu.style.display = 'none';
        return;
    }

    const currentClickedTable = activeSelectionElement.closest('table');

    const allMenuItems = contextMenu.querySelectorAll('.elementProp');
    allMenuItems.forEach(itemButton => {
        const itemAction = itemButton.getAttribute('data-action');
        
        if (itemAction === 'paste') {
            itemButton.style.display = navigator.clipboard?.readText ? '' : 'none';
            return;
        }

        const isTableSpecificAction = tableActions.includes(itemAction);
        if (isTableSpecificAction) {
            itemButton.style.display = (currentClickedTable && !hasActiveTextSelection) ? '' : 'none';
            return;
        }

        if (itemAction === 'newLoadedBlock') {
            itemButton.style.display = (selectedElement || hasActiveTextSelection) ? '' : 'none';
            return;
        }

        itemButton.style.display = activeSelectionElement ? '' : 'none';
    });

    const hasAnyVisibleItem = Array.from(contextMenu.children).some(childItem => {
        return childItem.style.display !== 'none';
    });

    if (!hasAnyVisibleItem) {
        contextMenu.style.display = 'none';
    }
}
window.editorBlock.handleContextMenu = handleContextMenu;

/* ***
 * handleMenuHide - базовое сокрытие контекстного меню при интеракциях
 * - убирает видимость кастомного контекстного окна при кликах или вводе текста
 * - отдает null
*** */
function handleMenuHide() {
    contextMenu.style.display = 'none';
}
window.editorBlock.handleMenuHide = handleMenuHide;

/* ***
 * handleMenuClick - маршрутизация кликов по пунктам действий контекстного меню
 * - принимает объект события event
 * - считывает команду data-action с кнопки и перенаправляет управление на нужный хелпер
 * - ловит ошибки исполнения команд и в любом случае закрывает окно меню в конце
 * - отдает null
*** */
async function handleMenuClick(event) {
    const executedAction = event.target.getAttribute('data-action');
    if (!executedAction || !window.editorBlock) {
        return;
    }

    if (typeof window.editorBlock.restoreSelection === 'function') {
        window.editorBlock.restoreSelection();
    }

    const activeSelection = getActiveEditorSelection();
    const hasActiveTextSelection = activeSelection && !activeSelection.isCollapsed;
    const selectedElement = window.editorBlock ? window.editorBlock.selectedElement : null;
    const selectionAnchorElement = hasActiveTextSelection ? (activeSelection.anchorNode?.nodeType === Node.TEXT_NODE ? activeSelection.anchorNode.parentElement : activeSelection.anchorNode) : null;
    const activeSelectionElement = selectedElement || selectionAnchorElement;

    if (!activeSelectionElement) {
        return;
    }

    const currentTable = activeSelectionElement.closest('table');
    const currentCell = activeSelectionElement.closest('td,th');

    try {
        switch (executedAction) {
            case 'copy':
                await executeCopyAction();
                break;

            case 'cut':
                await executeCutAction();
                break;

            case 'paste':
                await executePasteAction();
                break;

            case 'delete':
                executeDeleteAction();
                break;

            case 'deleteLine':
                executeDeleteLineAction(currentTable, currentCell);
                break;

            case 'deleteColumn':
                executeDeleteColumnAction(currentTable, currentCell);
                break;

            case 'addLine':
                executeAddLineAction(currentTable, currentCell);
                break;

            case 'addColumn':
                executeAddColumnAction(currentTable, currentCell);
                break;

            case 'newLoadedBlock':
                window.editorBlock.openBlock(null, getNewLoadedBlockSource());
                break;
        }
    } catch (errorLog) {
        console.error('Ошибка выполнения действия контекстного меню:', errorLog);
    }

    contextMenu.style.display = 'none';
}

/* ***
 * handleEditorKeyboardShortcuts - обработка горячих клавиш редактора
 * - принимает событие клавиатуры event
 * - проверяет, находится ли фокус в элементе с contenteditable="true"
 * - перехватывает нажатия Ctrl+C, Ctrl+V, Ctrl+X, Escape и Delete только для таких элементов
 * - отдает null
 *** */
function handleEditorKeyboardShortcuts(event) {
    if (!event) {
        return;
    }

    // Проверяем, находится ли фокус внутри элемента с contenteditable="true"
    const activeEl = document.activeElement;
    const isEditable = activeEl && activeEl.getAttribute('contenteditable') === 'true';

    if (!isEditable) {
        return;
    }

    const isModifiedShortcut = (event.ctrlKey || event.metaKey) && !event.altKey;
    const code = event.code;

    if (isModifiedShortcut) {
        if (code === 'KeyC') {
            event.preventDefault();
            executeCopyAction();
            return;
        }
        if (code === 'KeyV') {
            event.preventDefault();
            executePasteAction();
            return;
        }
        if (code === 'KeyX') {
            event.preventDefault();
            executeCutAction();
            return;
        }
    }

    if (event.key === 'Escape') {
        const hadVisibleMenu = contextMenu && contextMenu.style.display !== 'none';
        if (hadVisibleMenu) {
            contextMenu.style.display = 'none';
            event.preventDefault();
        }
        return;
    }

    if (event.key === 'Delete') {
        const handled = executeDeleteAction();
        if (handled) {
            event.preventDefault();
        }
    }
}

/* ***
 * attachContextMenuShortcutHandlers - добавление обработчика горячих клавиш контекстного меню
 * - принимает документ редактора
 * - добавляет обработчик keydown только один раз
*** */
function attachContextMenuShortcutHandlers(targetDocument) {
    if (!targetDocument || targetDocument.contextMenuShortcutsBound) {
        return;
    }

    targetDocument.addEventListener('keydown', handleEditorKeyboardShortcuts);
    targetDocument.contextMenuShortcutsBound = true;
}

// Инициализация обработчиков горячих клавиш контекстного меню для текущего документа
attachContextMenuShortcutHandlers(document);
window.editorBlock.attachContextMenuShortcutHandlers = attachContextMenuShortcutHandlers;

// Регистрация глобальных слушателей событий
contextMenu.addEventListener('click', handleMenuClick);
document.addEventListener('mousedown', event => {
    if (!contextMenu.contains(event.target)) {
        handleMenuHide();
    }
});