
/***********************************************************************
 * Элементы вкладок view / html / js центрального редактора.
 **********************************************************************/
const centerContent = document.getElementById('editorContent');
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



/***********************************************************************
 * document keydown — Вставка переноса строки при Enter:
 **********************************************************************/
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;

    // работаем только если включён contenteditable
    if (!centerEditor.isContentEditable) return;

    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    if (!e.shiftKey) {
        e.preventDefault();

        let currentEl = range.startContainer;
        if (currentEl.nodeType === Node.TEXT_NODE) {
            currentEl = currentEl.parentElement;
        }

        const isAtEnd = (() => {
            if (range.endContainer.nodeType === Node.TEXT_NODE) {
                const isEnd = range.endOffset === range.endContainer.textContent.length;

                if (!isEnd) return false;

                const parent = range.endContainer.parentElement;
                const next = range.endContainer.nextSibling;

                // если сразу после текста уже <br>
                if (next && next.nodeName === 'BR') {
                    return false;
                }

                return true;
            } else {
                const nodes = range.endContainer.childNodes;
                const atEnd = range.endOffset === nodes.length;

                if (!atEnd) return false;

                const prev = nodes[nodes.length - 1];

                // если последний уже <br>
                if (prev && prev.nodeName === 'BR') {
                    return false;
                }

                return true;
            }
        })();

        const isInline = currentEl && getComputedStyle(currentEl).display === 'inline';

        const br = document.createElement('br');
        range.deleteContents();
        range.insertNode(br);

        if (!isInline && isAtEnd) {
            const br2 = document.createElement('br');
            br.after(br2);
        }

        range.setStartAfter(br);
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
 * Хранит blockId, которому принадлежит текущее содержимое centerPreJs
 **********************************************************************/
let centerJsBlockId = null;

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
window.syncHtmlFromView = syncHtmlFromView;
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

window.saveJsToScript = saveJsToScript;
function saveJsToScript(blockId) {
    const centerPreJs = document.getElementById('center-tab-pre-js');
    // Если centerPreJs содержит код другого блока, не переписывать его
    // Берем содержимое только если это текущий активный блок в редакторе
    let content = '';
    if (centerJsBlockId === blockId) {
        content = centerPreJs.textContent || '';
    }
    
    let textEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    if (!textEl) {
        const wrap = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain');
        textEl = document.createElement('script');
        textEl.setAttribute('data-dynamic-text', blockId + '_view');
        textEl.type = 'text/plain';
        wrap.appendChild(textEl);
    }
    
    // Только обновляем, если был получен контент из centerPreJs (это текущий блок)
    if (centerJsBlockId === blockId) {
        textEl.textContent = content;
    }
}