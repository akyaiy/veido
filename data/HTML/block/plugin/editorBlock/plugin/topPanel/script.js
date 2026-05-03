/* меню действий */
const menuBtn = document.getElementById('tabs-menu-btn');
const tabsMenu = document.getElementById('tabs-menu');

menuBtn.addEventListener('click', () => {
    tabsMenu.style.display = tabsMenu.style.display === 'none' ? 'flex' : 'none';
});

document.addEventListener('click', (e) => {
    if (!tabsMenu.contains(e.target) && !menuBtn.contains(e.target)) {
        tabsMenu.style.display = 'none';
    }
});

/***********************************************************************
 * Кнопки "Сохранить" и "Сохранить как"
 **********************************************************************/
const tabSave = document.getElementById('tab-save');
const tabSaveHow = document.getElementById('tab-saveHow');

/***********************************************************************
 * tabSave onclick — сохранить в текущий путь
 **********************************************************************/
async function saveBlock(currentBlock = null, newPath = null) {
    // Использовать window.currentBlock если не передан параметр
    currentBlock = currentBlock || window.currentBlock;
    if (!currentBlock) return;

    // Получить путь из tempStore если не был передан
    let fromTempStore = false;

    if (!newPath) {
        const msgs = await window.tempStore.getByRecipient("saveBlock");

        const tempPath = msgs?.at(-1)?.data?.path;
        newPath = tempPath;

        if (tempPath) {
            fromTempStore = true;
        }
    }

    const block = document.getElementById(currentBlock);
    if (!block) return;

    const tab = document.querySelector(`.tab[data-block-id="${currentBlock}"]`);
    if (!tab) return;

    const path = newPath || tab.dataset.path;
    if (!path) {
        saveHowBlock(currentBlock);
        return;
    }

    const headersCheck = {};
    if (typeof accessToken !== 'undefined' && accessToken) {
        headersCheck.Authorization = `Bearer ${accessToken}`;
    }

    const checkRes = await fetch(`/api/HTML${path}`, { headers: headersCheck });
    const checkData = await checkRes.json();

    const exists =
        checkData.content !== "<h2>Запрашиваемая страница не найдена</h2>" ||
        checkData.js !== "" ||
        checkData.css !== "";

    if (fromTempStore && exists && !confirm(`Путь "${path}" уже существует. Перезаписать?`)) {
        return;
    }

    tab.dataset.path = path;

    // Сохранить текущий JS из редактора перед отправкой
    saveJsToScript(currentBlock);

    const payload = {
        content: htmlToMixed(block.querySelector('[id$="_view"]').innerHTML),
        js: (stripJsWrapper(block.querySelector('script[data-dynamic-text="' + currentBlock + '_view"]').textContent) || " "),
        css: ""
    };

    const headers = { 'Content-Type': 'application/json' };
    if (typeof accessToken !== 'undefined' && accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    const url = `/api/HTML${path}`;

    const patchRes = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload)
    });

    if (patchRes.status !== 406) {
        showMarkerModal('Контейнер сохранён!');
        return patchRes;
    }

    let message = "";
    try {
        const data = await patchRes.clone().json();
        message = data?.message;
    } catch (err) {
        message = await patchRes.text();
    }

    if (!message.includes("не существует")) {
        return patchRes;
    }

    await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            ...payload,
            css: payload.css
        })
    });
    showMarkerModal('Контейнер сохранён!');
}
window.saveBlock = saveBlock;

tabSave.onclick = async () => {
    await saveBlock(window.currentBlock);
};

tabSaveHow.onclick = async () => {
    const div = document.createElement("div");
    div.id = "fManager";
    document.body.appendChild(div);

    await window.tempStore.store(
        {
            path: "/",
            listTfootAct: "loadBlock",
            sender: "saveBlock",
            callbackFun: "saveBlock"
        },
        { recipient: 'fManager', ttlMs: 5000, destroyOnRead: true }
    );

    await loadBlock("plugin/fManager", "fManager");
};



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

    await window.tempStore.store({path: "/", listTfootAct: "loadBlock", sender: "newLoadedBlock", callbackFun: "newLoadedBlock"}, { recipient: 'fManager', ttlMs: 5000, destroyOnRead: true })
    await loadBlock("plugin/fManager", "fManager");
};



/***********************************************************************
 * Кнопка вкладки "Новая" и контейнер содержимого.
 **********************************************************************/
const tabNew = document.getElementById('tab-new');

/***********************************************************************
 * tabNew onclick — обработчик клика по вкладке "Новая":
 **********************************************************************/
tabNew.onclick = async() => {
    await window.tempStore.store(
        { data: { path: "" } },
        { recipient: "newLoadedBlock", ttlMs: 5000, destroyOnRead: true }
    );

    await newLoadedBlock();
};




/* отмена и повтор действий для блоков */
const historyPanel = document.querySelector('.history-actions');
const centerPanel = document.getElementById('centerPanel');
const undoBtn = historyPanel?.querySelector('[data-act="undo"]');
const redoBtn = historyPanel?.querySelector('[data-act="redo"]');

let historyData = {}; 
let currentEditor = null;
let isInternalChange = false;
let editorObserver = null;

/* Функции отмены действий */
function doUndo() {
    if (!currentEditor || isInternalChange) return;
    const id = currentEditor.id;
    const data = historyData[id];
    
    if (!data || data.index <= 0) return;

    const currentHTML = getPureHTML(currentEditor.innerHTML);
    const lastSavedHTML = getPureHTML(data.stack[data.index]);

    if (currentHTML !== lastSavedHTML) {
        saveState(currentEditor);
    }

    if (data.index > 0) {
        isInternalChange = true;
        data.index--;
        currentEditor.innerHTML = data.stack[data.index];
        setTimeout(() => { isInternalChange = false; }, 50);
    }
}

/* Функции повтора действий */
function doRedo() {
    if (!currentEditor) return;
    const data = historyData[currentEditor.id];
    if (!data || data.index >= data.stack.length - 1) return;

    isInternalChange = true;
    data.index++;
    currentEditor.innerHTML = data.stack[data.index];
    setTimeout(() => isInternalChange = false, 10);
}

/* Присвоение обработчиков событий */
undoBtn?.addEventListener('click', doUndo);
redoBtn?.addEventListener('click', doRedo);


function logStatus(id, action) {
    const data = historyData[id];
    if (!data) return;
    console.log(`[%c${action.toUpperCase()}%c] Шаг: ${data.index + 1}/${data.stack.length} | ID: ${id}`, 
        'color: #00ff00; font-weight: bold', '');
}

function saveState(editor) {
    if (!editor || isInternalChange) return;

    const id = editor.id;
    if (!id) return;
    if (!historyData[id]) historyData[id] = { stack: [], index: -1 };
    
    const data = historyData[id];
    
    // ВАЖНО: Сохраняем в стек только чистый HTML
    const currentState = getPureHTML(editor.innerHTML);

    // Если после чистки контент совпадает с верхушкой стека — ничего не делаем
    if (data.stack[data.index] === currentState) return;

    data.stack = data.stack.slice(0, data.index + 1);
    data.stack.push(currentState);
    data.index++;
    
    if (data.stack.length > 50) {
        data.stack.shift();
        data.index--;
    }
    /* logStatus(id, "Save"); */
}

// Фильтрация изменений: игнорируем только текст и outline
function setupEditorObserver(editor) {
    if (editorObserver) editorObserver.disconnect();
    
    editorObserver = new MutationObserver((mutations) => {
        if (isInternalChange) return;
        
        let shouldSave = false;
        for (const m of mutations) {
            // Если изменился атрибут style, проверяем, не outline ли это
            if (m.type === 'attributes' && m.attributeName === 'style') {
                // Если в стилях изменился только outline — игнорируем
                const oldStyle = m.oldValue || "";
                const newStyle = editor.getAttribute('style') || "";
                if (oldStyle.replace(/outline:[^;]+;?/, '') !== newStyle.replace(/outline:[^;]+;?/, '')) {
                    shouldSave = true;
                    break;
                }
            } 
            // Если добавились/удалились теги (<b>, <i>, <div> и т.д.)
            else if (m.type === 'childList') {
                shouldSave = true;
                break;
            }
        }
        
        if (shouldSave) {
            saveState(editor);
        }
    });

    editorObserver.observe(editor, {
        childList: true, subtree: true, attributes: true, attributeOldValue: true, characterData: false 
    });
}

function showHistoryPanel(editor) {
    const id = editor.id || "";
    const isValid = (id.startsWith('loadedBlock_') && id.endsWith('_view')) || 
                    ['center-tab-pre-html', 'center-tab-pre-js'].includes(id);

    if (!isValid || !historyPanel || !centerPanel) return;
    
    if (currentEditor !== editor) {
        currentEditor = editor;
        setupEditorObserver(editor);
    }

    /* if (historyPanel.parentNode !== centerPanel) centerPanel.appendChild(historyPanel);
    historyPanel.style.display = 'flex'; */

    if (!historyData[id]) {
        historyData[id] = { stack: [editor.innerHTML], index: 0 };
    }
}

const getPureHTML = (html) => {
    return html
        .replace(/&nbsp;/g, ' ') 
        // 1. Убираем только outline, не трогая остальные стили
        .replace(/outline:[^;]+;?/g, '')
        // 2. Убираем пробел перед закрывающей кавычкой стиля: "width: 10px; " -> "width: 10px;"
        .replace(/;\s+"/g, ';"')
        // 3. Убираем лишние пробелы ТОЛЬКО внутри тегов (между атрибутами)
        // Ищет пробелы, за которыми следует символ, но всё это внутри <>
        .replace(/(<[^>]+)\s{2,}([^>]*>)/g, '$1 $2')
        // 4. Убираем пробелы перед закрытием тега: <div > -> <div>
        .replace(/\s+>/g, '>')
        .trim();
};

// Логика записи текста: только по спецсимволам
document.addEventListener('input', (e) => {
    if (e.target !== currentEditor || isInternalChange) return;

    const data = historyData[currentEditor.id];
    if (data && data.index < data.stack.length - 1) {
        data.stack = data.stack.slice(0, data.index + 1);
    }

    const triggers = [' ', '.', ',', '!', '?', ';', ':', '(', ')', '"', "'", '/', '\\'];
    const isTrigger = e.data && triggers.includes(e.data);
    const isSpecialKey = e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak';

    if (isTrigger || isSpecialKey) {
        saveState(currentEditor);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && currentEditor && !isInternalChange) {
        saveState(currentEditor);
    }

    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? doRedo() : doUndo();
    }
    if (isMod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        doRedo();
    }
});

document.addEventListener('mousedown', (e) => {
    const target = e.target.closest('[contenteditable="true"]');
    if (target) showHistoryPanel(target);
}, true);

document.addEventListener('focusin', (e) => {
    if (e.target.contentEditable === "true") showHistoryPanel(e.target);
}, true);

let lastCursorOffset = 0; 
let lastContentLen = 0;

document.addEventListener('selectionchange', () => {
    if (!currentEditor || isInternalChange) return;

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        // Проверяем, что работаем внутри активного редактора
        if (currentEditor.contains(container)) {
            const id = currentEditor.id;
            const data = historyData[id];
            if (!data || !data.stack) return;

            const currentHTML = getPureHTML(currentEditor.innerHTML);
            const lastSavedHTML = data.stack[data.index] || "";
            
            // Считаем длину чистого текста (без тегов) и берем позицию курсора
            const currentLen = currentHTML.replace(/<[^>]*>/g, '').length;
            const currentOffset = range.startOffset;

            // 1. Если текущий контент реально отличается от последней записи в истории
            if (currentHTML !== lastSavedHTML) {
                
                // 2. Проверяем на "нормальный набор": 
                // Длина строки выросла на 1 И курсор сместился ровно на 1 вперед
                const isNormalTyping = (currentLen === lastContentLen + 1) && (currentOffset === lastCursorOffset + 1);
                
                // Если это прыжок курсора, вставка или удаление — сохраняем "хвост"
                if (!isNormalTyping) {
                    saveState(currentEditor);
                }
            }

            // Обновляем метки для следующей проверки
            lastContentLen = currentLen;
            lastCursorOffset = currentOffset;
        }
    }
});




document.getElementById('previewPage').addEventListener('click', () => {
    // 1. Поиск активного блока и вьюхи
    const blocks = Array.from(document.querySelectorAll('[id^="loadedBlock_"]'))
        .filter(b => /^loadedBlock_\d+$/.test(b.id));
    
    let activeBlock = null;
    for (const block of blocks) {
        if (getComputedStyle(block).display !== 'none') {
            activeBlock = block;
            break;
        }
    }

    if (!activeBlock) return;

    const view = activeBlock.querySelector('[id$="_view"]');
    const editorApp = document.getElementById('blockEditor');
    const content = document.getElementById('content');

    if (!view || !editorApp || !content) return;

    // --- ПЕРЕХОД В ПРЕВЬЮ ---

    // Скрываем редактор, но НЕ удаляем его из DOM
    editorApp.style.display = 'none';
    content.classList.remove('editor');

    // Создаем временный контейнер для превью, чтобы не смешивать с editorApp
    const previewContainer = document.createElement('div');
    previewContainer.id = 'preview-render-area';
    
    // Переносим содержимое из view в контейнер превью
    while (view.firstChild) {
        previewContainer.appendChild(view.firstChild);
    }
    
    content.appendChild(previewContainer);

    // --- КНОПКА ВЫХОДА ---

    const backBtn = document.createElement('button');
    backBtn.innerHTML = '← Выйти из превью';
    Object.assign(backBtn.style, {
        position: 'fixed',
        top: '15px',
        right: '15px',
        zIndex: '10000',
        padding: '10px 15px',
        backgroundColor: 'rgb(255, 68, 68)',
        color: '#fff',
        fontWeight: 'bold',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
    });

    document.body.appendChild(backBtn);

    // --- ЛОГИКА ВОЗВРАТА ---

    backBtn.addEventListener('click', () => {
        // 1. Возвращаем элементы из превью-контейнера обратно в оригинальный view
        while (previewContainer.firstChild) {
            view.appendChild(previewContainer.firstChild);
        }

        // 2. Удаляем временный контейнер превью
        previewContainer.remove();

        // 3. Показываем редактор обратно
        editorApp.style.display = '';
        content.classList.add('editor');

        // 4. Удаляем кнопку
        backBtn.remove();
    });
});



/***********************************************************************
 * newLoadedBlock — загрузка и регистрация нового блока:
 * - Принимает путь к блоку.
 * - Проверяет, открыт ли блок с указанным путём, и активирует его при наличии.
 * - Создаёт новый блок с view / html / scripts контейнерами.
 * - Добавляет вкладку блока с возможностью переключения и закрытия.
 * - Загружает содержимое блока и активирует его отображение.
 **********************************************************************/
async function newLoadedBlock() {
    const viewTab = document.querySelector('#modeSwitcherContent .center-tab[data-tab="view"]');
    viewTab.click();

    const data = await window.tempStore.getByRecipient("newLoadedBlock");
    const path = data?.[data.length - 1]?.data?.path || "";
    let tabs = document.getElementById('blocks-tabs');
    let container = document.getElementById('loadedBlockMain');
    if (!container) {
        container = document.createElement('div');
        container.id = 'loadedBlockMain';
        mainEl.appendChild(container);
    }

    let existingTab;
    if (path) {
        tabs.querySelectorAll('.tab').forEach(t => {
            if (t.dataset.path === path) existingTab = t;
        });
    }
    
function switchTo(blockId, tabEl) {
    window.currentBlock = tabEl.dataset.blockId;
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');

    Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.resizeHandle')) ch.style.display = ch.id === blockId ? '' : 'none';
    });

    // 🔑 ВАЖНО: применяем текущий режим центра
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
    block.dataset.path = path;

    const viewDiv = document.createElement('div');
    viewDiv.id = blockId + '_view';
    viewDiv.className = 'loadedBlock_view';
    viewDiv.contentEditable = 'true';
    viewDiv.addEventListener('input', () => { viewDiv.dataset.dirty = "true"; syncHtmlFromView(blockId); });

    const htmlDiv = document.createElement('div');
    htmlDiv.id = blockId + '_html';
    htmlDiv.style.display = 'none';

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

    // Наблюдатель: если загрузчик вставит <script> в scriptsDiv позже,
    try {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(m => {
                m.addedNodes.forEach(n => {
                    if (!n || n.nodeType !== 1) return;
                    if (n.tagName !== 'SCRIPT') return;
                    const s = n;
                    // пропускаем служебные скрипты
                    if (s.getAttribute('data-dynamic-text') === blockId + '_view' || s.getAttribute('data-dynamic') === blockId + '_view') return;
                    try {
                        let txt = s.textContent || '';
                        if (!txt && s.src) txt = `// external: ${s.src}`;
                        scriptText.textContent = (scriptText.textContent || '') + '\n' + txt;
                    } catch (e) {}
                    try { s.parentNode && s.parentNode.removeChild(s); } catch (e) {}
                });
            });
        });
        observer.observe(scriptsDiv, { childList: true });
        scriptsDiv._beObserver = observer;
    } catch (e) {}

    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.dataset.path = path || blockId;
    tabEl.dataset.blockId = blockId;
    tabEl.textContent = path ? (path.split('/').filter(Boolean).pop() || path) : "*new";
    tabEl.onclick = () => switchTo(blockId, tabEl);
    tabs.appendChild(tabEl);

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    closeBtn.style.marginLeft = '6px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = e => closeBlock(e, block, tabEl);

    tabEl.appendChild(closeBtn);

    switchTo(blockId, tabEl);

    if (path) await loadBlock(path, viewDiv.id, ["js", "html"]);
    const loadedScript = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
    if (loadedScript) {
        scriptText.textContent = loadedScript.textContent || '';
    }
    if (path) extractContentParts(blockId);
    showJs(blockId);
    showView(blockId);
    syncHtmlFromView(blockId);
}
window.newLoadedBlock = newLoadedBlock;


/***********************************************************************
 * closeBlock — закрытие блока и очистка интерфейса:
 * - Принимает событие клика, элемент блока и вкладку.
 * - Удаляет блок и связанную с ним вкладку.
 * - Сбрасывает содержимое редакторов HTML и JS.
 * - Очищает панели CSS, атрибутов, свойств и событий.
 **********************************************************************/
function closeBlock(e, block, tabEl) {
    e.stopPropagation();
    try {
        const scriptsDiv = block ? block.querySelector('#' + block.id + '_scripts') : null;
        if (scriptsDiv && scriptsDiv._beObserver) {
            try { scriptsDiv._beObserver.disconnect(); } catch (e) {}
            scriptsDiv._beObserver = null;
        }
    } catch (e) {}

    const container = document.getElementById('loadedBlockMain');
    if (container && block) container.removeChild(block);
    if (tabEl.parentNode) tabEl.parentNode.removeChild(tabEl);

    centerPreHtml.textContent = '';
    centerPreJs.textContent = '';
    centerContent.style.display = 'none';
    document.getElementById('loadedBlocks').style.display = '';

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

    const jsTable = document.getElementById('editor-jsPanel');
    if (jsTable) {
        jsTable.querySelectorAll('td[contenteditable="true"]').forEach(td => td.textContent = '');
    }

    const cssPanel = document.getElementById('css-panel');
    const jsPanel = document.getElementById('jsPanel');
    /* if (cssPanel) cssPanel.style.display = ''; */
    if (jsPanel) jsPanel.style.display = 'none';
}


/**
* extractContentParts — Перемещает встроенные теги <style> и <script> из представления в блочные контейнеры
* — Сохраняет CSS в <style data-dynamic="blockId_view"> и JS в <script data-dynamic-text="blockId_view"> (только текст)
* — Удаляет исходные встроенные теги из представления, чтобы избежать автоматического выполнения
*/
function extractContentParts(blockId) {
    const viewEl = document.getElementById(blockId + '_view');
    if (!viewEl) return;

    const scriptsDiv = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain');
    const cssDiv = document.getElementById(blockId + '_css');
    const htmlDiv = document.getElementById(blockId + '_html');

   // собирать стили
    viewEl.querySelectorAll('style').forEach(st => {
        try {
            let styleEl = document.querySelector('style[data-dynamic="' + blockId + '_view"]');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.setAttribute('data-dynamic', blockId + '_view');
                (scriptsDiv || document.head).appendChild(styleEl);
            }
            styleEl.textContent = (styleEl.textContent || '') + '\n' + (st.textContent || '');
        } catch (e) {}
        st.parentNode && st.parentNode.removeChild(st);
    });

    // готовим контейнер для скриптов 
    let textEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    if (!textEl && scriptsDiv) {
        textEl = document.createElement('script');
        textEl.setAttribute('data-dynamic-text', blockId + '_view');
        textEl.type = 'text/plain';
        scriptsDiv.appendChild(textEl);
    }

    // также нормализуем любые скрипты, которые были помещены в scriptsDiv загрузчиком: преобразуем их в хранилище текста
    if (scriptsDiv) {
        scriptsDiv.querySelectorAll('script').forEach(s => {
            if (s.getAttribute('data-dynamic-text') === blockId + '_view' || s.getAttribute('data-dynamic') === blockId + '_view') return;
            try {
                textEl.textContent = (textEl.textContent || '') + '\n' + (s.textContent || '');
            } catch (e) {}
            s.parentNode && s.parentNode.removeChild(s);
        });
    }

    // собирать скрипты из представления
    viewEl.querySelectorAll('script').forEach(sc => {
        // пропускаем служебные скрипты
        if (sc.getAttribute('data-dynamic-text') === blockId + '_view' || sc.getAttribute('data-dynamic') === blockId + '_view') return;
        try {
            textEl.textContent = (textEl.textContent || '') + '\n' + (sc.textContent || '');
        } catch (e) {}
        sc.parentNode && sc.parentNode.removeChild(sc);
    });

    // обновляем HTML-контейнер, удаляя встроенные стили и скрипты из представления
    if (htmlDiv) htmlDiv.innerHTML = viewEl.innerHTML;

    // обновляем центральные редакторы
    const centerPre = document.getElementById('center-tab-pre-html');
    if (centerPre) centerPre.textContent = htmlToMixed(viewEl.innerHTML);
    const centerJs = document.getElementById('center-tab-pre-js');
    if (centerJs && textEl) centerJs.textContent = textEl.textContent || '';
}