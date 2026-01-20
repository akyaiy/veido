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

        if (tab.dataset.tab === 'properties') {
            propertiesPanel.style.display = '';
            cssPanel.style.display = 'none';
            jsPanel.style.display = 'none';
        } else if (tab.dataset.tab === 'css') {
            propertiesPanel.style.display = 'none';
            cssPanel.style.display = 'flex';
            jsPanel.style.display = 'none';
        } else if (tab.dataset.tab === 'js') {
            propertiesPanel.style.display = 'none';
            cssPanel.style.display = 'none';
            jsPanel.style.display = 'flex';
        }
    });
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
 * handle mousedown — начало изменения размера блока:
 * - Активирует режим перетаскивания.
 * - Запоминает начальную позицию курсора.
 * - Сохраняет исходные размеры блока.
 * - Назначает обработчики движения и отпускания мыши.
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
    };
};

/***********************************************************************
 * move — обработчик движения мыши при изменении размеров блока:
 * - Принимает объект события мыши.
 * - Проверяет, активен ли режим изменения размера.
 * - Вычисляет смещение курсора от начальной позиции.
 * - Рассчитывает новую ширину и высоту блока.
 * - Применяет обновлённые размеры к элементу.
 **********************************************************************/
function move(e) {
    if (!active) return;

    let deltaX = (e.clientX - sx);
    let deltaY = (e.clientY - sy);

    let w = sw + deltaX;
    let h = sh + deltaY;

    loadedBlock.style.width = w + 'px';
    loadedBlock.style.height = h + 'px';
}




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

    const path = (await tempStore.getByRecipient("editorBlock"))?.[0]?.path;
    let tabs = document.getElementById('blocks-tabs');
    let container = document.getElementById('loadedBlockMain');
    if (!container) {
        container = document.createElement('div');
        container.id = 'loadedBlockMain';
        mainEl.appendChild(container);
    }

    let existingTab;
    tabs.querySelectorAll('.tab').forEach(t => {
        if (t.dataset.path === path) existingTab = t;
    });
    
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

    const scriptsDiv = document.createElement('div');
    scriptsDiv.id = blockId + '_scripts';

    block.appendChild(viewDiv);
    block.appendChild(htmlDiv);
    block.appendChild(scriptsDiv);
    container.appendChild(block);

    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.dataset.path = path;
    tabEl.dataset.blockId = blockId;
    tabEl.textContent = path.split('/').filter(Boolean).pop() || path;
    tabEl.onclick = () => switchTo(blockId, tabEl);
    tabs.appendChild(tabEl);

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    closeBtn.style.marginLeft = '6px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = e => closeBlock(e, block, tabEl);

    tabEl.appendChild(closeBtn);

    switchTo(blockId, tabEl);

    await loadBlock(path, viewDiv.id, ["js", "html"]);
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
centerEditor.addEventListener('paste', scheduleSync);
centerEditor.addEventListener('keydown', e => (e.key === 'Enter' || (e.ctrlKey && (e.key === 'z' || e.key === 'y'))) && queueMicrotask(syncActiveBlock));

/***********************************************************************
 * CenterEditor keydown — Вставка переноса строки при Enter:
 * - Получает объект события клавиатуры.
 * - Предотвращает стандартное действие Enter.
 * - Вставляет текстовый узел с новой строкой.
 * - Перемещает курсор после вставки.
 **********************************************************************/
centerEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();

        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);

        const textNode = document.createTextNode('\n');

        range.deleteContents();
        range.insertNode(textNode);

        range.setStartAfter(textNode);
        range.collapse(true);

        sel.removeAllRanges();
        sel.addRange(range);
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
    const canRender = logSync(blockId, 'html');

    const htmlElPre = document.getElementById('center-tab-pre-html');
    const htmlEl = document.getElementById(blockId + '_html');
    const viewEl = document.getElementById(blockId + '_view');
    if (!htmlElPre || !htmlEl || !viewEl) return;

    if (canRender) {
        let content = htmlElPre.textContent;

        htmlEl.innerHTML = content;
        viewEl.innerHTML = md.render(content);
    }

    activeBlockId = blockId;
    activeSyncSource = 'html';
}

/***********************************************************************
 * syncHtmlFromView — Синхронизирует HTML-блок с визуальным представлением:
 * - Принимает идентификатор блока.
 * - Проверяет, нужно ли обновлять блок через logSync.
 * - Преобразует содержимое визуального блока в смешанный HTML и обновляет HTML-блок.
 * - Обновляет активный блок и источник синхронизации.
 **********************************************************************/
function syncHtmlFromView(blockId) {
    const canRender = logSync(blockId, 'view');

    const viewEl = document.getElementById(blockId + '_view');
    const htmlEl = document.getElementById(blockId + '_html');
    if (!viewEl || !htmlEl) return;

    if (canRender) {
        let mdText = htmlToMixed(viewEl.innerHTML);
        htmlEl.innerHTML = mdText;
    }

    activeBlockId = blockId;
    activeSyncSource = 'view';
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
            return node.attributes && node.attributes.length
                ? node.outerHTML
                : children;
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
    const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
    const wrapper = doc.body.firstElementChild;
    if (!wrapper) return '\n';

    const out = [...wrapper.childNodes]
        .map(nodeToMd)
        .join('')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return out ? out + '\n' : '\n';
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
    if (cssPanel) cssPanel.style.display = '';
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
function applyJs(blockId) {
    const content = centerPreJs.textContent || '';

    let scriptEl = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
    if (!scriptEl) {
        const wrap = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain');
        scriptEl = document.createElement('script');
        scriptEl.setAttribute('data-dynamic', blockId + '_view');
        wrap.appendChild(scriptEl);
    }

    scriptEl.type = '';

    if (!content.trim()) {
        scriptEl.textContent = '';
        return;
    }

    const wrapped = `
(() => {
    try {
${content}
        if (typeof pageInit === "function") pageInit();
    } catch (e) {
        console.error("Block script error:", e);
    }
})();
`;
    scriptEl.textContent = wrapped;

    try {
        eval(scriptEl.textContent);
    } catch (e) {
        console.error(e);
    }
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
function showJs(blockId) {
    centerContent.style.display = '';
    centerPreHtml.style.display = 'none';
    centerPreJs.style.display = '';
    updateCenterControls('js');

    const scriptEl = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
    let code = scriptEl ? scriptEl.textContent : '';

    code = code
        .replace(/^\s*\(\(\)\s*=>\s*{\s*try\s*{\s*/s, '')
        .replace(/\s*if\s*\(\s*typeof pageInit[\s\S]*?\)\s*pageInit\(\);\s*/s, '')
        .replace(/\s*}\s*catch[\s\S]*?}\s*\}\)\s*\(\s*\)\s*;?\s*$/s, '');

    centerPreJs.textContent = code;

    const container = document.getElementById('loadedBlockMain');
    if (container) Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.small-handle')) ch.style.display = 'none';
    });
    document.getElementById('loadedBlock').style.display = 'none';
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
    applyJs(blockId);
};




/***********************************************************************
 * elements-ul click — добавление HTML-элемента:
 * - Обрабатывает клик по элементу списка тегов.
 * - Определяет выбранный HTML-тег.
 * - Добавляет тег в визуальный редактор и HTML-код.
 **********************************************************************/
document.getElementById('elements-ul').addEventListener('click', e => {
    const el = e.target.closest('.add-el');
    if (!el) return;

    const tag = el.dataset.el;
    if (!tag) return;

    handleLoadedBlockView(tag);
    handlePreHtml(tag, el.textContent.includes('</>'));
});

/***********************************************************************
 * handleLoadedBlockView — вставка элемента в view:
 * - Принимает имя HTML-тега.
 * - Определяет позицию курсора в визуальном редакторе.
 * - Создаёт и вставляет новый HTML-элемент в активный блок.
 **********************************************************************/
function handleLoadedBlockView(tag) {
    const sel = document.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    let node = range.commonAncestorContainer;
    while (node && node.nodeType !== 1) node = node.parentNode;
    if (!node) return;

    const view = node.closest('[id^="loadedBlock_"][id$="_view"]');
    if (!view) return;

    const voidTags = ['img','input','br','hr','meta','link','source'];
    const newEl = document.createElement(tag);
    if (!voidTags.includes(tag)) newEl.textContent = tag;

    range.insertNode(newEl);
    range.setStartAfter(newEl);
    range.collapse(true);

    sel.removeAllRanges();
    sel.addRange(range);
}

/***********************************************************************
 * handlePreHtml — вставка HTML-кода в редактор:
 * - Принимает имя тега и флаг закрывающего тега.
 * - Формирует HTML-фрагмент.
 * - Вставляет код в позицию курсора в HTML-редакторе.
 **********************************************************************/
function handlePreHtml(tag, wantsClosing) {
    const pre = document.getElementById('center-tab-pre-html');
    if (!pre || pre.contentEditable !== "true") return;

    const snippet = wantsClosing ? `<${tag}></${tag}>` : `<${tag}>`;
    const sel = document.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    let node = range.commonAncestorContainer;
    while (node && node.nodeType !== 1) node = node.parentNode;
    if (!node || !pre.contains(node)) return;

    const textNode = document.createTextNode(snippet);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
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
document.addEventListener('click', e => {
    const clicked = e.target;

    const view = clicked.closest('[id^="loadedBlock_"][id$="_view"]');
    if (!view) return;

    if (!view.contains(clicked)) return;

    const el = clicked.closest('[id^="loadedBlock_"][id$="_view"], [id^="loadedBlock_"][id$="_view"] *') || view;

    updateCssPanel(el);
    updatePropertiesPanel(el);
    updateTagLabel(el);
    updateJsPanel(el);
    updatePropertiesPanel(el);
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
    const idInput = document.getElementById('attr-id');
    const classInput = document.getElementById('attr-class');
    const attrsTable = document.getElementById('attributes-table');
    if (idInput) idInput.value = el.id || '';
    if (classInput) classInput.value = el.className || '';
    if (!attrsTable) return;
    attrsTable.innerHTML = '';
    const names = el.getAttributeNames().filter(n => n !== 'id' && n !== 'class');
    names.forEach(name => createAttrRow(name, el.getAttribute(name) || ''));
    ensureEmptyAttrRow();
}

/***********************************************************************
 * attr-id input — Синхронизирует ввод ID с текущим элементом:
 * - Принимает событие ввода.
 * - Обновляет ID выбранного элемента или удаляет его, если пусто.
 **********************************************************************/
document.getElementById('attr-id')?.addEventListener('input', e => {
    if (!currentSelectedEl) return;
    const v = e.target.value.trim();
    v ? currentSelectedEl.id = v : currentSelectedEl.removeAttribute('id');
});

/***********************************************************************
 * attr-class input — Синхронизирует ввод класса с текущим элементом:
 * - Принимает событие ввода.
 * - Обновляет class выбранного элемента.
 **********************************************************************/
document.getElementById('attr-class')?.addEventListener('input', e => {
    if (!currentSelectedEl) return;
    currentSelectedEl.className = e.target.value;
});


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
document.getElementById('attributes-table')?.addEventListener('input', e => {
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
            currentSelectedEl.setAttribute(nameNow, valNow);
        }
        nameTd.dataset.prev = nameNow;
    } else {
        if (nameNow && currentSelectedEl) {
            currentSelectedEl.setAttribute(nameNow, valNow);
        }
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
 * events group - Заполняет таблицу JS-событий:
 * - Создаёт строки для каждого события с редактируемым именем.
 * - Разделяет группы событий горизонтальной линией.
 **********************************************************************/
events.forEach((group, gi) => {
    group.forEach(ev => {
        const tr = document.createElement('tr');
        const tdEvent = document.createElement('td');
        const tdName = document.createElement('td');

        tdEvent.textContent = ev;
        tdEvent.contentEditable = 'false';

        tdName.contentEditable = 'true';
        tdName.dataset.placeholder = 'name';

        tr.appendChild(tdEvent);
        tr.appendChild(tdName);
        jsTable.appendChild(tr);
    });

    if (gi < events.length - 1) {
        const trHr = document.createElement('tr');
        const tdHr = document.createElement('td');
        tdHr.colSpan = 2;
        tdHr.innerHTML = '<hr>';
        trHr.appendChild(tdHr);
        jsTable.appendChild(trHr);
    }
});

/***********************************************************************
 * updateJsPanel — обновляет панель JS-событий для выбранного элемента:
 * - Получает выбранный DOM-элемент (блок на странице).
 * - Очищает все строки таблицы и сбрасывает клики.
 * - Ищет все addEventListener и присваивания onX в скрипте.
 * - Фильтрует события, которые применимы к текущему элементу.
 * - Создаёт карту событий - селекторов.
 * - Заполняет имена обработчиков в таблице и делает кликабельными события.
 * - Присваивает обработчики для input и blur, передавая map, blockId и элемент.
 **********************************************************************/
function updateJsPanel(el) {
    const table = document.getElementById('editor-js-panel');
    const rows = Array.from(table.querySelectorAll('tr'));

    rows.forEach(tr => {
        const tdName = tr.children[1];
        if (tdName) tdName.textContent = '';
        tr.onclick = null;
        const tdEvent = tr.children[0];
        if (tdEvent) tdEvent.onclick = null;
    });

    const blockId = getBlockIdFromEl(el) || getActiveBlockId() || 'loadedBlock_1';
    const script = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
    if (!script) return;

    const txt = script.textContent;
    const entries = [];

    const addListenerRe = /([^\n;]+?)\.addEventListener\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z0-9_$]+|function\b)/g;
    let m;
    while ((m = addListenerRe.exec(txt)) !== null) {
        const selector = resolveSelectorFromExpr(m[1].trim(), txt);
        entries.push({
            selector,
            event: 'on' + m[2].toLowerCase(),
            handler: m[3].startsWith('function') ? null : m[3],
            raw: m[0]
        });
    }

    const onAssignRe = /([^\n;]+?)\.on([a-zA-Z]+)\s*=\s*([A-Za-z0-9_$]+|function\b)/g;
    while ((m = onAssignRe.exec(txt)) !== null) {
        const selector = resolveSelectorFromExpr(m[1].trim(), txt);
        entries.push({
            selector,
            event: 'on' + m[2].toLowerCase(),
            handler: m[3].startsWith('function') ? null : m[3],
            raw: m[0]
        });
    }

    const matched = entries.filter(en => {
        if (!en.selector) return false;
        try {
            return el.matches(en.selector);
        } catch {
            const s = en.selector.replace(/::[a-zA-Z0-9\-\(\)]+/g, '').trim();
            try { return s && el.matches(s); } catch { return false; }
        }
    });

    if (!matched.length) {
        table.removeEventListener('blur', onJsTableBlur, true);
        table.removeEventListener('input', onJsTableInput);
        return;
    }

    const eventToSelector = new Map();
    matched.forEach(en => eventToSelector.set(en.event, en.selector));

    rows.forEach(tr => {
        const tdEvent = tr.children[0];
        const tdName = tr.children[1];
        if (!tdEvent || !tdName) return;

        const evName = tdEvent.textContent.trim();
        const found = matched.find(m => m.event === evName);
        if (!found) return;

        tdName.textContent = found.handler || '';

        tdEvent.onclick = () => {
            const jsTab = document.querySelector('#center-tabs .center-tab[data-tab="js"]');
            if (jsTab) jsTab.click();
            if (found.handler) highlightInJsEditor('function ' + found.handler + '(', txt);
            else highlightInJsEditor(found.raw, txt);
        };
    });

    table.removeEventListener('blur', onJsTableBlur, true);
    table.addEventListener('blur', e => onJsTableBlur(e, eventToSelector, blockId, el), true);
    table.removeEventListener('input', onJsTableInput);
    table.addEventListener('input', e => onJsTableInput(e, eventToSelector, blockId, el));
}

/***********************************************************************
 * onJsTableInput — обновляет имя обработчика JS-события при редактировании:
 * - Получает объект события, карту событий-селекторов, ID блока и элемент DOM.
 * - Проверяет, что редактируется именно имя обработчика.
 * - Берёт текст события и нового обработчика.
 * - Находит селектор для события через карту.
 * - Вызывает updateScriptAssignment для сохранения изменений в скрипте.
 **********************************************************************/
function onJsTableInput(e, eventToSelectorMap, blockId, el) {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.parentNode;
    if (!tr) return;
    const tdEvent = tr.children[0];
    const tdName = tr.children[1];
    if (!tdEvent || !tdName) return;
    if (td !== tdName) return;
    const ev = tdEvent.textContent.trim();
    const handler = tdName.textContent.trim();
    const selector = eventToSelectorMap.get(ev);
    if (!selector) return;
    updateScriptAssignment(blockId, selector, ev, handler, el);
}

/***********************************************************************
 * onJsTableBlur — сохраняет изменения имени обработчика JS-события при потере фокуса:
 * - Получает объект события, карту событий-селекторов, ID блока и элемент DOM.
 * - Проверяет, что редактируется именно имя обработчика.
 * - Берёт текст события и нового обработчика.
 * - Находит селектор для события через карту.
 * - Вызывает updateScriptAssignment для сохранения изменений в скрипте.
 **********************************************************************/
function onJsTableBlur(e, eventToSelectorMap, blockId, el) {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.parentNode;
    if (!tr) return;
    const tdEvent = tr.children[0];
    const tdName = tr.children[1];
    if (!tdEvent || !tdName) return;
    if (td !== tdName) return;
    const ev = tdEvent.textContent.trim();
    const handler = tdName.textContent.trim();
    const selector = eventToSelectorMap.get(ev);
    if (!selector) return;
    updateScriptAssignment(blockId, selector, ev, handler, el);
}

/***********************************************************************
 * updateScriptAssignment — обновляет присвоение обработчика JS-события в скрипте:
 * - Получает ID блока, селектор элемента, полное имя события, имя обработчика и DOM-элемент.
 * - Находит скрипт блока и его текст.
 * - Определяет возможные варианты левой части присвоения (lhs) для селектора.
 * - Удаляет старые присвоения для данного события.
 * - Если указано имя обработчика, создаёт новое присвоение и вставляет его в скрипт.
 * - Обновляет содержимое блока pre-js в интерфейсе, если он открыт для текущего блока.
 **********************************************************************/
function updateScriptAssignment(blockId, selector, eventFull, handlerName, el) {
    const scriptEl = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
    if (!scriptEl) return;
    let s = scriptEl.textContent;
    const ev = eventFull.replace(/^on/, '');

    const lhsCandidates = buildLhsCandidates(selector, s);

    lhsCandidates.forEach(lhs => {
        const re = new RegExp('(^|\\n)\\s*' + escapeRegExp(lhs) + '\\.on' + ev + '\\s*=\\s*[^;\\n]*;?', 'g');
        s = s.replace(re, '');
    });

    if (handlerName) {
        const preferredLhs = lhsCandidates[0] || (selector.startsWith('#') ? "document.getElementById('" + selector.slice(1) + "')" : "document.querySelector('" + selector.replace(/'/g, "\\'") + "')");
        const line = preferredLhs + '.on' + ev + ' = ' + handlerName + ';';
        const insertBeforeIdx = findInsertIndexBeforeClosingIIFE(s);
        if (insertBeforeIdx !== -1) s = s.slice(0, insertBeforeIdx) + '\n' + line + '\n' + s.slice(insertBeforeIdx);
        else s = s.trimEnd() + '\n' + line + '\n';
    }

    scriptEl.textContent = s;
    const blockPre = document.getElementById('center-tab-pre-js');
    const activeBlock = getActiveBlockId();
    if (blockPre && (getBlockIdFromEl(el) || activeBlock) === blockId) blockPre.textContent = scriptEl.textContent;
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
 * - Ищет последнюю строку с `})();`.
 * - Если не найдено, ищет последний закрывающийся фигурный скобку `}`.
 * - Возвращает индекс для вставки новой строки кода.
 **********************************************************************/
function findInsertIndexBeforeClosingIIFE(text) {
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
            }, 800);

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





function updatePropertiesPanel(el) {
    updateSimpleFormats(el);
    updateSelectProperties(el);
}



function updateSimpleFormats(el) {
    if (!el) return;
    const simple = document.getElementById('properties-simpleFormats');
    if (!simple) return;
    const btns = Array.from(simple.querySelectorAll('[simpleformats-button]'));

    btns.forEach(b => {
        const key = b.getAttribute('simpleformats-button');
        updateButtonActive(b, el, key);
        b.onclick = () => handleSimpleFormatClick(b, el, key);
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
        sel.onchange = createSelectChangeHandler(el, prop);
    });
}



// --- новая функция для присвоения active ---
function updateButtonActive(button, el, key) {
    button.classList.remove('active');

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
    }
}

// --- вычисляет текущее значение свойства ---
function getSelectValue(el, prop) {
    switch (prop) {
        case 'font-size': return getComputedProp(el, 'fontSize');
        case 'font-family': return getComputedProp(el, 'fontFamily');
        case 'text-align': return getComputedProp(el, 'textAlign');
        case 'line-height': return getComputedProp(el, 'lineHeight');
        case 'border-width': return getComputedProp(el, 'borderWidth');
        case 'padding': return getComputedProp(el, 'padding');
        case 'list': return getComputedProp(el, 'listStyleType');
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
    { key: 'border-color', type: 'color', target: 'inline', style: { prop: 'border', wrap: v => `1px solid ${v}` } },
    { key: 'delete', type: 'action', target: 'any', action: 'remove-all' }
];

// Конфигурация селектов (key, css, target)
const FORMAT_SELECTS = [
    { key: 'font-size', css: 'fontSize', target: 'inline' },
    { key: 'font-family', css: 'fontFamily', target: 'inline' },
    { key: 'text-align', css: 'textAlign', target: 'block' },
    { key: 'line-height', css: 'lineHeight', target: 'block' },
    { key: 'border-width', css: 'borderWidth', target: 'block' },
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

/* Основная: применять/удалять inline-стиль к выделению (span) */
function applyInlineStyleToSelection(styleProp, styleValue) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const root = getRangeRootElement(range);
    const textNodes = getTextNodesInRange(range);
    if (!textNodes.length) return;
    const selectedNodes = [];
    for (const tn of textNodes) {
        try {
            const selNode = splitTextNodeByRange(tn, range);
            if (selNode && range.intersectsNode(selNode)) selectedNodes.push(selNode);
        } catch (e) {
            console.warn('splitTextNodeByRange failed', e);
        }
    }
    if (!selectedNodes.length) return;
    const selectedSet = new Set(selectedNodes);
    for (const sNode of selectedNodes) {
        const parent = sNode.parentNode;
        if (parent && parent.nodeType === 1 && parent.tagName === 'SPAN') {
            const allText = getTextNodesUnder(parent);
            let allInside = true;
            for (const t of allText) { if (!selectedSet.has(t)) { allInside = false; break; } }
            if (allInside) {
                const isTextDecoration = styleProp === 'textDecoration';
                const current = parent.style.textDecoration || '';
                const parts = current.split(/\s+/).filter(Boolean);
                            
                if (isTextDecoration) {
                    if (!styleValue) {
                        parent.style.textDecoration = '';
                        cleanupSpanIfEmpty(parent);
                    } else {
                        if (parts.includes(styleValue)) {
                            const newParts = parts.filter(v => v !== styleValue);
                            parent.style.textDecoration = newParts.join(' ');
                            cleanupSpanIfEmpty(parent);
                        } else {
                            parts.push(styleValue);
                            parent.style.textDecoration = parts.join(' ');
                        }
                    }
                } else {
                    if (!styleValue) {
                        parent.style[styleProp] = '';
                        cleanupSpanIfEmpty(parent);
                    } else {
                        parent.style[styleProp] = styleValue;
                    }
                }
                continue;
            }
        }
        if (!styleValue) {
            const wrapper = ensureWrapperSpanForTextNode(sNode);
            wrapper.style[styleProp] = '';
            cleanupSpanIfEmpty(wrapper);
        } else {
            if (parent && parent.nodeType === 1 && parent.tagName === 'SPAN' && parent.style[styleProp] === styleValue) continue;
            const wrapper = ensureWrapperSpanForTextNode(sNode);
            wrapper.style[styleProp] = styleValue;
        }
    }
    mergeAdjacentSpans(root);
    const spans = root.querySelectorAll('span');
    spans.forEach(s => cleanupSpanIfEmpty(s));
    try {
        const newRange = document.createRange();
        const first = selectedNodes[0];
        const last = selectedNodes[selectedNodes.length - 1];
        newRange.setStartBefore(first);
        newRange.setEndAfter(last);
        sel.removeAllRanges();
        sel.addRange(newRange);
    } catch (e) {}
}

/* Основная: применять/удалять блочный стиль к ближайшим блочным контейнерам */
function applyBlockStyleToSelection(cssProp, cssValue) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const blocks = getBlockContainersForRange(range);
    if (!blocks.length) return;
    for (const b of blocks) {
        if (!cssValue) {
            b.style[cssProp] = '';
            if (!b.getAttribute('style') || b.getAttribute('style').trim() === '') b.removeAttribute('style');
        } else {
            b.style[cssProp] = cssValue;
        }
    }
}

/* Удаление формата: удаляет style у span и у других тегов внутри выделения */
function removeFormattingInSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const root = getRangeRootElement(range);
    // извлечь содержимое, пройти и удалить style у всех элементов, затем вставить обратно
    const frag = range.extractContents();
    const walker = document.createTreeWalker(frag, NodeFilter.SHOW_ELEMENT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const el of nodes) {
        if (el.nodeType === 1) {
            el.removeAttribute('style');
            if (el.tagName === 'SPAN' && (!el.getAttribute('style') || el.getAttribute('style').trim() === '')) {
                // unwrap empty spans
                while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
                el.remove();
            }
        }
    }
    range.insertNode(frag);
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
    const blocks = getBlockContainersForRange(range);
    if (!blocks.length) return;
    if (listType === 'none') {
        blocks.forEach(block => {
            const li = block.closest('li');
            if (li) {
                const parentList = li.parentElement;
                const parent = parentList.parentElement;
                while (li.firstChild) parentList.parentElement.insertBefore(li.firstChild, parentList);
                li.remove();
                if (!parentList.querySelector('li')) parentList.remove();
            }
        });
        return;
    }
    let i = 0;
    while (i < blocks.length) {
        const block = blocks[i];
        const parentList = block.closest('ul, ol');
        if (parentList) {
            if (listType === 'decimal') {
                if (parentList.tagName !== 'OL') {
                    const ol = document.createElement('ol'); ol.innerHTML = parentList.innerHTML; parentList.parentNode.replaceChild(ol, parentList);
                }
            } else {
                if (parentList.tagName !== 'UL') {
                    const ul = document.createElement('ul'); ul.innerHTML = parentList.innerHTML; parentList.parentNode.replaceChild(ul, parentList);
                }
                parentList.style.listStyleType = listType;
            }
            i++;
            continue;
        }
        const group = [block];
        let j = i + 1;
        while (j < blocks.length) { group.push(blocks[j]); j++; }
        const listEl = listType === 'decimal' ? document.createElement('ol') : document.createElement('ul');
        if (listType !== 'decimal') listEl.style.listStyleType = listType;
        const first = group[0];
        first.parentNode.insertBefore(listEl, first);
        for (const b of group) {
            const li = document.createElement('li');
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
    
    if (typeof applyInlineStyleToSelection === 'function') {
        applyInlineStyleToSelection(cssProp, hexValue);
    }
    if (typeof updateSimpleFormats === 'function') {
        updateSimpleFormats(activeContext.el);
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
function openColorPicker(cfg, el, currentHex) {
    activeContext = { prop: cfg.style.prop, el };
    
    // Парсинг стартового цвета
    if (currentHex && /^#[0-9A-F]{6}$/i.test(currentHex)) {
        Object.assign(colorState, hexToHsl(currentHex));
    } else {
        colorState.h = 0; colorState.s = 100; colorState.l = 50;
    }

    picker.style.display = 'block';
    drawHueBar();
    syncFromState();

    // Positioning
    if (el) {
        const r = el.getBoundingClientRect();
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
    if(['text-color','bg-color','border-color'].includes(type)){
        // Тут надо получить реальный цвет выделения, пока #000000
        openColorPicker({ style:{ prop: type } }, btn, '#000000'); 
    }
});