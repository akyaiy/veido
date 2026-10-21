/* ===
 * Настройки и хранилище истории (LRU Cache)
=== */

// Лимиты хранения
const maxBlocksCount = 3;
const maxEditorsCount = 2; // markupEditor (view + md) и jsEditor
const maxStepsDepth = 50;

// Хранилище истории
const blockHistoryMap = new Map();

// Флаг для группировки непрерывного ввода текста
let isTyping = false;

// Флаг, что блок ещё загружается и пустое состояние не нужно сохранять в историю
let isHistoryInitializing = false;



/* ===
 * Вспомогательные функции работы с историей
=== */

/* ***
 * isPreviewMode - проверяет, находится ли редактор в режиме предпросмотра
*** */
function isPreviewMode() {
    const viewEditorContent = document.getElementById('viewEditorContent');
    return viewEditorContent ? viewEditorContent.classList.contains('preview') : false;
}

/* ***
 * updateHistoryUI - обновляет класс inactive у кнопок отмены и повтора
*** */
function updateHistoryUI() {
    const undoBtn = document.querySelector('.historyButton[data-action="undo"]');
    const redoBtn = document.querySelector('.historyButton[data-action="redo"]');

    if (!undoBtn && !redoBtn) {
        return;
    }

    const info = getActiveEditorInfo();
    const stack = (info.blockId && info.editorId && blockHistoryMap.has(info.blockId))
        ? blockHistoryMap.get(info.blockId).get(info.editorId)
        : null;

    let canUndo = false;
    let canRedo = false;

    if (stack && !isPreviewMode()) {
        const currentState = getEditorState(info.editorId);
        if (stack.past.length > 1) {
            canUndo = true;
        } else if (stack.past.length === 1) {
            canUndo = !isEqualState(info.editorId, currentState, stack.past[0]);
        }
        canRedo = stack.future.length > 0;
    }

    if (undoBtn) {
        undoBtn.classList.toggle('inactive', !canUndo);
    }
    if (redoBtn) {
        redoBtn.classList.toggle('inactive', !canRedo);
    }
}

/* ***
 * getActiveEditorInfo - определяет текущий активный блок и открытый редактор
 * - Объединяет 'viewEditor' и 'mdEditor' в единую историю 'markupEditor'
*** */
function getActiveEditorInfo() {
    const activeTab = document.querySelector('#blocksTabs .blockTab.active');
    const blockId = activeTab ? activeTab.getAttribute('data-block-id') : null;

    const activeEditor = document.querySelector('#viewBlock > div.active') || 
                         document.querySelector('#viewBlock > div:not([style*="display: none"])');
    let editorId = activeEditor ? activeEditor.id : null;

    // Объединяем визуальный и HTML редакторы в один стек истории
    if (editorId === 'viewEditor' || editorId === 'mdEditor') {
        editorId = 'markupEditor';
    }

    return { blockId, editorId, element: activeEditor };
}

/* ***
 * getEditorContent - извлекает текущее содержимое конкретного редактора
*** */
function getEditorContent(editorElement) {
    if (!editorElement) {
        return '';
    }

    if (window.editorBlock && typeof window.editorBlock.getEditorContentByElement === 'function') {
        return window.editorBlock.getEditorContentByElement(editorElement);
    }

    const contentDiv = editorElement.querySelector('[contenteditable]');
    if (!contentDiv) {
        return '';
    }
    
    if (editorElement.id === 'viewEditor') {
        return contentDiv.innerHTML;
    }

    return contentDiv.textContent;
}

/* ***
 * setEditorContent - записывает новое содержимое в конкретный редактор
*** */
function setEditorContent(editorElement, content) {
    if (!editorElement) {
        return;
    }

    if (window.editorBlock && typeof window.editorBlock.setEditorContentByElement === 'function') {
        window.editorBlock.setEditorContentByElement(editorElement, content);
        return;
    }

    const contentDiv = editorElement.querySelector('[contenteditable]');
    if (!contentDiv) {
        return;
    }

    if (editorElement.id === 'viewEditor') {
        contentDiv.innerHTML = content;
    } else {
        contentDiv.textContent = content;
    }
}

/* ***
 * getOrCreateHistoryStack - извлекает стеки Undo/Redo с контролем лимитов
*** */
function getOrCreateHistoryStack(blockId, editorId) {
    if (!blockId || !editorId) {
        return null;
    }

    if (blockHistoryMap.has(blockId)) {
        const existingBlock = blockHistoryMap.get(blockId);
        blockHistoryMap.delete(blockId);
        blockHistoryMap.set(blockId, existingBlock);
    } else {
        if (blockHistoryMap.size >= maxBlocksCount) {
            const oldestBlockId = blockHistoryMap.keys().next().value;
            blockHistoryMap.delete(oldestBlockId);
        }
        blockHistoryMap.set(blockId, new Map());
    }

    const editorsMap = blockHistoryMap.get(blockId);

    if (editorsMap.has(editorId)) {
        const existingEditor = editorsMap.get(editorId);
        editorsMap.delete(editorId);
        editorsMap.set(editorId, existingEditor);
    } else {
        if (editorsMap.size >= maxEditorsCount) {
            const oldestEditorId = editorsMap.keys().next().value;
            editorsMap.delete(oldestEditorId);
        }
        editorsMap.set(editorId, {
            past: [],
            future: []
        });
    }

    return editorsMap.get(editorId);
}



/* ===
 * Управление сложными состояниями (View + MD объединены)
=== */

/* ***
 * getEditorState - делает снимок состояния активного редактора/редакторов
*** */
function getEditorState(editorId) {
    if (editorId === 'markupEditor') {
        return {
            view: getEditorContent(document.getElementById('viewEditor')),
            md: getEditorContent(document.getElementById('mdEditor'))
        };
    }
    if (editorId === 'jsEditor') {
        return getEditorContent(document.getElementById('jsEditor'));
    }
    return null;
}

/* ***
 * setEditorState - восстанавливает сохраненное состояние в редакторы
*** */
function setEditorState(editorId, state) {
    if (!state) {
        return;
    }
    
    if (editorId === 'markupEditor') {
        setEditorContent(document.getElementById('viewEditor'), state.view || '');
        setEditorContent(document.getElementById('mdEditor'), state.md || '');
    } else if (editorId === 'jsEditor') {
        setEditorContent(document.getElementById('jsEditor'), state || '');
    }
}

/* ***
 * isEqualState - проверяет равенство двух снимков состояний
*** */
function isEqualState(editorId, state1, state2) {
    if (!state1 || !state2) {
        return false;
    }
    
    if (editorId === 'markupEditor') {
        return state1.view === state2.view && state1.md === state2.md;
    }
    if (editorId === 'jsEditor') {
        return state1 === state2;
    }
    return false;
}

/* ***
 * isStateEmpty - проверяет, пустое ли состояние (нужно для фильтрации автозагрузки)
*** */
function isStateEmpty(editorId, state) {
    if (!state) {
        return true;
    }
    
    if (editorId === 'markupEditor') {
        const viewEmpty = !state.view || !state.view.trim() || state.view === '<br>';
        const mdEmpty = !state.md || !state.md.trim();
        return viewEmpty && mdEmpty;
    }
    if (editorId === 'jsEditor') {
        return !state || !state.trim();
    }
    return true;
}



/* ===
 * Основные операции истории (Undo, Redo, Save)
=== */

/* ***
 * saveHistoryState - записывает текущее состояние в историю Undo
*** */
function saveHistoryState() {
    if (!window.editorBlock.isBlockActive() || isPreviewMode()) {
        return;
    }

    const info = getActiveEditorInfo();
    if (!info.blockId || !info.editorId) {
        return;
    }

    const stack = getOrCreateHistoryStack(info.blockId, info.editorId);
    if (!stack) {
        return;
    }

    if (window.editorBlock && typeof window.editorBlock.syncEditors === 'function') {
        window.editorBlock.syncEditors();
    }

    const currentState = getEditorState(info.editorId);

    if (isHistoryInitializing && isStateEmpty(info.editorId, currentState) && stack.past.length === 0) {
        return;
    }

    // Если история пуста, сохраняем текущее состояние как стартовое
    if (stack.past.length === 0) {
        stack.past.push(currentState);
        updateHistoryUI();
        return;
    }

    const lastState = stack.past[stack.past.length - 1];

    // Не сохраняем дубликаты
    if (isEqualState(info.editorId, lastState, currentState)) {
        return;
    }

    stack.past.push(currentState);
    stack.future = [];
    isTyping = false; // Сбрасываем режим ввода при фиксации точки

    if (stack.past.length > maxStepsDepth) {
        stack.past.shift();
    }

    updateHistoryUI();
}

// Экспорт в глобальный объект
window.editorBlock.saveHistoryState = saveHistoryState;

/* ***
 * undoHistory - отмена действия (Undo)
*** */
function undoHistory() {
    if (!window.editorBlock.isBlockActive() || isPreviewMode()) {
        return;
    }

    const info = getActiveEditorInfo();
    if (!info.blockId || !info.editorId) {
        return;
    }

    if (window.editorBlock && typeof window.editorBlock.syncEditors === 'function') {
        window.editorBlock.syncEditors();
    }

    const stack = getOrCreateHistoryStack(info.blockId, info.editorId);
    if (!stack || stack.past.length === 0) {
        return;
    }

    const currentState = getEditorState(info.editorId);

    // Защита от отката дальше стартового состояния
    if (stack.past.length === 1 && isEqualState(info.editorId, currentState, stack.past[0])) {
        return;
    }

    const lastPast = stack.past[stack.past.length - 1];

    if (!isEqualState(info.editorId, currentState, lastPast)) {
        stack.future.push(currentState);
        if (stack.future.length > maxStepsDepth) {
            stack.future.shift();
        }
    } else {
        const stateToUndo = stack.past.pop();
        stack.future.push(stateToUndo);
        if (stack.future.length > maxStepsDepth) {
            stack.future.shift();
        }
    }

    if (stack.past.length > 0) {
        const previousState = stack.past[stack.past.length - 1];
        setEditorState(info.editorId, previousState);
    } else {
        setEditorState(info.editorId, info.editorId === 'markupEditor' ? { view: '', md: '' } : '');
    }

    isTyping = false; // Сбрасываем флаг ввода

    if (window.editorBlock && typeof window.editorBlock.syncEditors === 'function') {
        window.editorBlock.syncEditors();
    }

    updateHistoryUI();
}

/* ***
 * redoHistory - повторение действия (Redo)
*** */
function redoHistory() {
    if (!window.editorBlock.isBlockActive() || isPreviewMode()) {
        return;
    }

    const info = getActiveEditorInfo();
    if (!info.blockId || !info.editorId) {
        return;
    }

    if (window.editorBlock && typeof window.editorBlock.syncEditors === 'function') {
        window.editorBlock.syncEditors();
    }

    const stack = getOrCreateHistoryStack(info.blockId, info.editorId);
    if (!stack || stack.future.length === 0) {
        return;
    }

    const stateToRedo = stack.future.pop();
    const currentState = getEditorState(info.editorId);

    stack.past.push(currentState);
    if (stack.past.length > maxStepsDepth) {
        stack.past.shift();
    }

    setEditorState(info.editorId, stateToRedo);
    isTyping = false; // Сбрасываем флаг ввода

    if (window.editorBlock && typeof window.editorBlock.syncEditors === 'function') {
        window.editorBlock.syncEditors();
    }

    updateHistoryUI();
}



/* ===
 * Обработчики событий
=== */

// Клики по кнопкам истории в интерфейсе
document.addEventListener('click', event => {
    const btn = event.target.closest('.historyButton');
    if (!btn || btn.classList.contains('inactive')) {
        return;
    }

    const action = btn.getAttribute('data-action');
    if (action === 'undo') {
        undoHistory();
    } else if (action === 'redo') {
        redoHistory();
    }
});

/* ***
 * handleHistoryKeyboardShortcuts - обработка горячих клавиш истории изменений
 * - перехватывает комбинации Ctrl+Z / Ctrl+Y для отмены и возврата действий
 * - отдает null
*** */
function handleHistoryKeyboardShortcuts(event) {
    if (!event || event.altKey || !event.ctrlKey) {
        return;
    }

    const key = event.key ? event.key.toLowerCase() : '';

    if (key === 'z') {
        event.preventDefault();
        undoHistory();
        return;
    }

    if (key === 'y') {
        event.preventDefault();
        redoHistory();
    }
}

/* ***
 * attachHistoryShortcutHandlers - добавление обработчика горячих клавиш истории
 * - принимает документ редактора
 * - добавляет обработчик keydown только один раз
*** */
function attachHistoryShortcutHandlers(targetDocument) {
    if (!targetDocument || targetDocument.historyShortcutsBound) {
        return;
    }

    targetDocument.addEventListener('keydown', handleHistoryKeyboardShortcuts);
    targetDocument.historyShortcutsBound = true;
}

// Инициализация обработчиков горячих клавиш истории для текущего документа
attachHistoryShortcutHandlers(document);
window.editorBlock.attachHistoryShortcutHandlers = attachHistoryShortcutHandlers;

function handleEditorInput(event) {
    if (!window.editorBlock.isBlockActive() || isPreviewMode()) {
        return;
    }

    const target = event.target && typeof event.target.closest === 'function'
        ? event.target.closest('[contenteditable]')
        : null;
    if (!target) {
        return;
    }

    if (!isTyping) {
        saveHistoryState();
        isTyping = true;
    }

    updateHistoryUI();
}

function setHistoryInitializing(value) {
    isHistoryInitializing = value;
}

/* ***
 * attachIframeHistoryEvents - подписка iframe на события ввода/клавиатуры
 * - принимает элемент iframe
 * - навешивает обработчики истории в документ iframe
*** */
function attachIframeHistoryEvents(iframe) {
    if (!iframe || !iframe.contentDocument) {
        return;
    }

    const iframeDoc = iframe.contentDocument;
    iframeDoc.addEventListener('input', handleEditorInput);
    iframeDoc.addEventListener('keydown', handleEditorKeydown);
}

function handleEditorKeydown(event) {
    if (!window.editorBlock.isBlockActive() || isPreviewMode()) {
        return;
    }

    const target = event.target && typeof event.target.closest === 'function'
        ? event.target.closest('[contenteditable]')
        : null;
    if (!target) {
        return;
    }

    // Служебные клавиши, которые не должны инициировать запись
    const ignoredKeys = [
        'Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
        'Escape', 'Tab'
    ];

    if (ignoredKeys.includes(event.key)) {
        return;
    }

    // Горячие клавиши (Undo/Redo с клавиатуры) — пропускаем их мимо детектора ввода
    if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
        return;
    }

    // Кнопки-разделители и удаления (сохраняем состояние ДО применения символа)
    const saveKeys = [
        'Enter', 
        ' ', 'Spacebar', 
        'Backspace', 
        'Delete', 
        ';', ',', '.', '{', '}', '[', ']',
        '!', '?', ':', '(', ')', '-', '_', '=', '+', '/', '\\', '"', "'", '~', '@', '#', '$', '%', '^', '&', '*'
    ];

    if (saveKeys.includes(event.key)) {
        saveHistoryState();
        isTyping = false; // Сбрасываем непрерывный ввод
    } else {
        // Если пользователь начал писать обычный текст и это первый символ слова
        if (!isTyping) {
            saveHistoryState(); // Делаем бэкап предыдущего текста
            isTyping = true;    // Входим в режим непрерывного ввода
        }
    }

    updateHistoryUI();
}

window.editorBlock.attachIframeHistoryEvents = attachIframeHistoryEvents;
window.editorBlock.setHistoryInitializing = setHistoryInitializing;
window.editorBlock.updateHistoryUI = updateHistoryUI;

// Отслеживание клавиатурного ввода
document.addEventListener('keydown', handleEditorKeydown);
document.addEventListener('input', handleEditorInput);

// Сброс режима ввода и обновление UI при переключении табов
document.addEventListener('click', event => {
    const tab = event.target.closest('.blockTab, .editorsTab');
    if (tab) {
        isTyping = false;
        setTimeout(updateHistoryUI, 0);
    }
});