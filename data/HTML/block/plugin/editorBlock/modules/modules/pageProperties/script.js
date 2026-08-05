/* ===
 * Переменные модуля
 === */

// Получение контейнера для окон свойств страницы и шаблона окна
const pagePropContainer = document.getElementById('pageProperties');
const pagePropTemplate = document.getElementById('pagePropertiesWindow');

// Переменные для управления окнами свойств страницы
const windowsMap = new Map();
const windowsOrder = [];

// Базовый z-index для окон, чтобы они отображались поверх других элементов
const baseZIndex = 1100;



/* ===
 * Вспомогательные функции
 === */

/* ***
 * initWindowDrag - инициализация перетаскивания окна
 * - принимает элемент окна и элемент заголовка
 * - добавляет обработчики событий мыши для перемещения окна
 *** */
function initWindowDrag(windowElement, headerElement) {
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;

    headerElement.addEventListener('mousedown', function (event) {
        isDragging = true;
        offsetX = event.clientX - windowElement.offsetLeft;
        offsetY = event.clientY - windowElement.offsetTop;
        headerElement.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', function (event) {
        if (!isDragging) {
            return;
        }

        windowElement.style.left = (event.clientX - offsetX) + 'px';
        windowElement.style.top = (event.clientY - offsetY) + 'px';
    });

    document.addEventListener('mouseup', function () {
        isDragging = false;
    });
}



/* ===
 * Работа с порядком окон и z-index
 === */

/* ***
 * updateZIndices - пересчитывает zIndex для всех видимых окон
 * - присваивает значения начиная с baseZIndex, порядок windowsOrder (ниже -> выше)
 *** */
function updateZIndices() {
    for (let i = 0; i < windowsOrder.length; i++) {
        const id = windowsOrder[i];
        const el = windowsMap.get(id);
        if (!el) {
            continue;
        }
        el.style.zIndex = String(baseZIndex + i);
    }
}



/* ===
 * Управление окнами по blockId
 === */

/* ***
 * bringWindowToFront - делает окно активным по blockId
 * - перемещает blockId в конец windowsOrder и обновляет zIndex
 *** */
function bringWindowToFront(blockId) {
    const idx = windowsOrder.indexOf(blockId);
    if (idx !== -1) {
        windowsOrder.splice(idx, 1);
    }
    windowsOrder.push(blockId);
    updateZIndices();
}

/* ***
 * createWindowForBlock - создаёт DOM-окно для заданного blockId
 * - использует шаблон если он есть, иначе создаёт структуру вручную
 * - регистрирует обработчики: клик для поднятия и кнопка закрытия
 *** */
function createWindowForBlock(blockId) {
    let win = null;

    win = pagePropTemplate.cloneNode(true);
    // Удаляем id у корня и у всех вложенных элементов, чтобы избежать дубликатов id
    if (win.hasAttribute && win.hasAttribute('id')) {
        win.removeAttribute('id');
    }
    const innerWithId = win.querySelectorAll('[id]');
    innerWithId.forEach(el => el.removeAttribute('id'));
    win.style.display = '';

    win.dataset.blockId = String(blockId);

    // Поднять окно при клике
    win.addEventListener('mousedown', function () {
        bringWindowToFront(blockId);
    });

    // Перетаскивание по заголовку
    const headerEl = win.querySelector('.pagePropertiesHeader') || win.querySelector('.pagePropHeader') || win.querySelector('.window-header');
    if (headerEl) {
        initWindowDrag(win, headerEl);
    }

    // Кнопка сохранения — применяет имя, ширину и высоту для активного блока
    const saveBtn = win.querySelector('.pagePropertiesSaveBtn') || win.querySelector('.pagePropSaveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function () {
            savePageProperties(blockId);
        });
    }

    // Кнопка закрытия
    const closeBtnEl = win.querySelector('.pagePropertiesCloseBtn') || win.querySelector('.pagePropCloseBtn');
    if (closeBtnEl) {
        closeBtnEl.addEventListener('click', function (e) {
            closeBlockWindow(blockId, e);
        });
    }

    windowsMap.set(blockId, win);
    windowsOrder.push(blockId);

    if (pagePropContainer) {
        pagePropContainer.appendChild(win);
    } else {
        document.body.appendChild(win);
    }

    updateZIndices();

    // Синхронизируем поля окна (имя, ширина, высота) с текущими данными
    syncWindowInputs(win, blockId);

    return win;
}



/* ===
 * Вспомогательные операции с вкладками
 === */

/* ***
 * updateTabName - обновляет отображаемое имя вкладки для данного blockId
 * - находит элемент .blockTab[data-block-id="..."] .tabName и меняет textContent
 *** */
function updateTabName(blockId, name) {
    if (!blockId) return;
    const tab = document.querySelector(`.blockTab[data-block-id="${blockId}"]`);
    if (!tab) return;
    const nameEl = tab.querySelector('.tabName');
    if (nameEl) {
        nameEl.textContent = String(name);
    }
}



/* ===
 * Операции открытия, сохранения и скрытия
 === */

/* ***
 * savePageProperties - сохраняет свойства (имя, ширину и высоту) для заданного blockId
 * - применяет изменения только если блок активен
 *** */
function savePageProperties(blockId) {
    if (!blockId) return;
    const win = windowsMap.get(blockId);
    if (!win) return;

    const activeId = window.editorBlock && window.editorBlock.currentBlockId;
    if (!activeId || String(activeId) !== String(blockId)) {
        return;
    }

    const nameInput = win.querySelector('.pagePropertiesNameInput') || win.querySelector('.pagePropNameInput');
    if (nameInput) {
        const val = String(nameInput.value || '');
        updateTabName(blockId, val);
    }

    const widthInput = win.querySelector('.pagePropertiesWidthInput') || win.querySelector('.pagePropWidthInput');
    const heightInput = win.querySelector('.pagePropertiesHeightInput') || win.querySelector('.pagePropHeightInput');
    if (!widthInput || !heightInput) return;

    const settingsEl = document.getElementById(blockId + 'Settings');
    if (!settingsEl) return;

    const width = String(widthInput.value || '');
    const height = String(heightInput.value || '');

    settingsEl.dataset.viewEditorWidth = width;
    settingsEl.dataset.viewEditorHeight = height;

    const viewEditorContent = document.getElementById('viewEditorContent');
    if (viewEditorContent) {
        viewEditorContent.style.width = width;
        viewEditorContent.style.height = height;
    }
}

/* ***
 * closeBlockWindow - удаляет окно для заданного blockId
 * - удаляет из DOM, windowsMap и windowsOrder
 *** */
function closeBlockWindow(blockId, event) {
    if (!blockId) return;
    const win = windowsMap.get(blockId);
    if (win) {
        if (win.parentNode) {
            win.parentNode.removeChild(win);
        }
        windowsMap.delete(blockId);
    }

    const idx = windowsOrder.indexOf(blockId);
    if (idx !== -1) {
        windowsOrder.splice(idx, 1);
    }

    updateZIndices();

    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
}

/* ***
 * hideAllWindows - скрывает все открытые окна свойств страниц
 * - перебирает windowsMap и прячет все созданные DOM-элементы окон
 * - очищает массив порядка окон windowsOrder
 *** */
function hideAllWindows() {
    windowsMap.forEach(win => {
        if (win && win.style) {
            win.style.display = 'none';
        }
    });
    windowsOrder.length = 0;
}

/* ***
 * showBlockWindow - логика открытия окна для заданного blockId
 * - показывает существующее окно или создаёт новое
 * - синхронизирует поля и поднимает окно
 *** */
function showBlockWindow(blockId) {
    if (!blockId) return;
    if (windowsMap.has(blockId)) {
        const existing = windowsMap.get(blockId);
        if (existing) {
            existing.style.display = '';
            if (windowsOrder.indexOf(blockId) === -1) {
                windowsOrder.push(blockId);
            }
            // Обновляем поля окна
            syncWindowInputs(existing, blockId);
            bringWindowToFront(blockId);
        }
        return;
    }

    createWindowForBlock(blockId);
}



/* ===
 * Вспомогательные операции для синхронизации полей окна
 === */

/* ***
 * getTabName - возвращает текущее имя вкладки для blockId
 *** */
function getTabName(blockId) {
    if (!blockId) return '';
    const tab = document.querySelector(`.blockTab[data-block-id="${blockId}"]`);
    if (!tab) return '';
    const nameEl = tab.querySelector('.tabName');
    return nameEl ? String(nameEl.textContent || '') : '';
}

/* ***
 * syncWindowInputs - устанавливает значения и состояние полей ввода внутри окна
 * - отключает input имени если окно не для активного блока
 *** */
function syncWindowInputs(win, blockId) {
    if (!win) return;
    const input = win.querySelector('.pagePropertiesNameInput') || win.querySelector('.pagePropNameInput');
    if (!input) return;

    const currentActive = window.editorBlock && window.editorBlock.currentBlockId;
    const isActive = currentActive && String(currentActive) === String(blockId);

    input.value = getTabName(blockId) || '';
    input.disabled = !isActive;

    const settingsEl = document.getElementById(blockId + 'Settings');
    const widthInput = win.querySelector('.pagePropertiesWidthInput') || win.querySelector('.pagePropWidthInput');
    const heightInput = win.querySelector('.pagePropertiesHeightInput') || win.querySelector('.pagePropHeightInput');

    if (settingsEl) {
        if (widthInput) {
            widthInput.value = settingsEl.dataset.viewEditorWidth || '';
        }
        if (heightInput) {
            heightInput.value = settingsEl.dataset.viewEditorHeight || '';
        }
    }
}

/* ***
 * syncBlockWindow - синхронизирует окно свойств конкретного блока по его blockId
 * - находит соответствующее окно в windowsMap
 * - перерисовывает/обновляет значения полей ввода в найденном окне
 *** */
function syncBlockWindow(blockId) {
    if (!blockId) return;
    const win = windowsMap.get(blockId);
    if (!win) return;
    syncWindowInputs(win, blockId);
}



/* ===
 * Публичный API
 === */

/* ***
 * openPageProperties - отображает окно свойств страницы для текущего блока
 * - использует window.editorBlock.currentBlockId для определения окна
 * - если окно существует — показывает и поднимает его, иначе создаёт новое
 *** */
function openPageProperties() {
    const currentBlockId = window.editorBlock.currentBlockId;
    showBlockWindow(currentBlockId);
}

// Экспорт методов открытия, синхронизации и скрытия в глобальном объекте редактора
window.editorBlock = window.editorBlock || {};
window.editorBlock.openPageProperties = openPageProperties;
window.editorBlock.syncPagePropertiesWindowForBlock = syncBlockWindow;
window.editorBlock.hideAllPagePropertiesWindows = hideAllWindows;