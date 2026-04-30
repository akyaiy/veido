
/***********************************************************************
 * Элементы вкладок view / html / js центрального редактора.
 **********************************************************************/
const centerContent = document.getElementById('center-tab-content');
const centerPreHtml = document.getElementById('center-tab-pre-html');
const centerPreJs = document.getElementById('center-tab-pre-js');

/***********************************************************************
 * centerEditor — HTML/Markdown-редактор центра.
 **********************************************************************/
const centerEditor = document.getElementById('center-tab-pre-html');


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
 * Асинхронная синхронизация активного блока при input, paste и keydown (Enter / Ctrl+Z / Ctrl+Y).
 **********************************************************************/
const scheduleSync = () => queueMicrotask(syncActiveBlock);
centerEditor.addEventListener('input', scheduleSync);
centerEditor.addEventListener('paste', () => {
    setTimeout(syncActiveBlock, 0);
});
centerEditor.addEventListener('keydown', e =>
    (e.key === 'Enter') &&
    queueMicrotask(syncActiveBlock)
);


// Сохранение текста JavaScript в блок памяти происходит немедленно при редактировании пользователем JS-редактора (без выполнения).
if (centerPreJs) {
    centerPreJs.addEventListener('input', () => {
        const blockId = getActiveBlockId();
        if (!blockId) return;
        saveJsToScript(blockId);
    });
}


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