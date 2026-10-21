/* ==
 * Меню и поля ввода размеров редактора
=== */

/* ***
 * parseViewEditorInputValue - преобразование значения размера
 * принимает значение ширины или высоты
 * проверяет и преобразует значение в число
 * округляет значение
 * возвращает строковое значение числа или пустую строку
*** */
const parseViewEditorInputValue = (value) => {
    if (value === null || typeof value === 'undefined') {
        return '';
    }

    const normalized = String(value).trim();

    if (!normalized) {
        return '';
    }

    const numeric = Number.parseFloat(normalized);
    return Number.isFinite(numeric) ? String(Math.round(numeric)) : '';
};

/* ***
 * parseViewEditorZoomValue - преобразование значения масштаба
 * принимает значение масштаба
 * проверяет и ограничивает допустимый диапазон
 * возвращает значение от 0.1 до 10 или 1
*** */
const parseViewEditorZoomValue = (value) => {
    if (value === null || typeof value === 'undefined') {
        return 1;
    }

    const normalized = String(value).trim();

    if (!normalized) {
        return 1;
    }

    const numeric = Number.parseFloat(normalized);
    return Number.isFinite(numeric) && numeric > 0 ? Math.min(10, Math.max(0.1, numeric)) : 1;
};

/* ***
 * getViewEditorContentScale - получение текущего масштаба редактора
 * получает элемент области просмотра
 * определяет масштаб из zoom
 * возвращает значение масштаба
*** */
const getViewEditorContentScale = () => {
    const viewEditorContent = document.getElementById('viewEditorContent');

    if (!viewEditorContent) {
        return 1;
    }

    const zoom = parseFloat(window.getComputedStyle(viewEditorContent).zoom);
    return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
};

/* ***
 * applyViewEditorZoom - применение масштаба области просмотра
 * принимает значение масштаба
 * изменяет масштаб
 * обновляет значение поля масштаба
*** */
window.editorBlock.applyViewEditorZoom = (value) => {
    const viewEditorContent = document.getElementById('viewEditorContent');
    const zoomInput = document.getElementById('viewEditorZoomInput');

    if (!viewEditorContent) {
        return;
    }

    const zoom = parseViewEditorZoomValue(value);
    viewEditorContent.style.zoom = zoom;

    if (zoomInput) {
        zoomInput.value = Number(zoom.toFixed(2)).toString();
    }
};

/* ***
 * syncViewEditorSizeInputs - синхронизация полей размеров редактора
 * получает поля ширины и высоты
 * получает текущую область редактора
 * устанавливает текущие значения ширины и высоты в поля
*** */
window.editorBlock.syncViewEditorSizeInputs = (mode) => {
    const widthInput = document.getElementById('viewEditorWidthInput');
    const heightInput = document.getElementById('viewEditorHeightInput');
    const zoomInput = document.getElementById('viewEditorZoomInput');
    const viewEditorMenuSelect = document.getElementById('viewEditorMenuSelect');
    const viewEditorContent = document.getElementById('viewEditorContent');

    if (!viewEditorContent) {
        return;
    }

    if (widthInput) {
        widthInput.value = parseViewEditorInputValue(viewEditorContent.style.width);
    }

    if (heightInput) {
        heightInput.value = parseViewEditorInputValue(viewEditorContent.style.height);
    }

    if (zoomInput) {
        zoomInput.value = Number(getViewEditorContentScale().toFixed(2)).toString();
    }
};

/* ***
 * applyViewEditorSize - применение размеров к viewEditorContent
 * принимает ширину и высоту
 * изменяет размер контейнера viewEditorContent
 * сохраняет размеры в настройках текущего блока
*** */
window.editorBlock.applyViewEditorSize = (width, height) => {
    const viewEditorContent = document.getElementById('viewEditorContent');

    if (viewEditorContent) {
        if (typeof width !== 'undefined') {
            viewEditorContent.style.width = width;
        }
        if (typeof height !== 'undefined') {
            viewEditorContent.style.height = height;
        }
    }

    const blockId = window.editorBlock?.currentBlockId || null;
    const settingsEl = blockId ? document.getElementById(blockId + 'Settings') : null;

    if (settingsEl) {
        if (typeof width !== 'undefined') {
            settingsEl.dataset.viewEditorWidth = width;
        }
        if (typeof height !== 'undefined') {
            settingsEl.dataset.viewEditorHeight = height;
        }
    }

    window.editorBlock.syncViewEditorSizeInputs();
};

/* ***
 * initViewEditorMenu - инициализация меню выбора размера viewEditor
 * получает меню выбора размера и контейнер viewEditorContent
 * проверяет наличие элементов и повторную инициализацию
 * применяет выбранные ширину и высоту через общую функцию applyViewEditorSize
 * сохраняет размеры в настройках текущего блока
 * обрабатывает изменение выбранного размера
*** */
function initViewEditorMenu() {
    const menuSelect = document.getElementById('viewEditorMenuSelect');
    const viewEditorContent = document.getElementById('viewEditorContent');
    const widthInput = document.getElementById('viewEditorWidthInput');
    const heightInput = document.getElementById('viewEditorHeightInput');
    const zoomInput = document.getElementById('viewEditorZoomInput');

    if (!menuSelect || !viewEditorContent || menuSelect.dataset.bound === 'true') {
        return;
    }

    const parseDimension = (value) => {
        if (!value || value === 'auto') {
            return 'auto';
        }

        const normalized = String(value).trim();

        if (!normalized) {
            return 'auto';
        }

        if (normalized.includes('%')) {
            return normalized;
        }

        const numeric = Number.parseFloat(normalized);
        return Number.isFinite(numeric) ? `${numeric}px` : normalized;
    };

    const parseManualDimension = (value) => {
        if (value === null || typeof value === 'undefined') {
            return undefined;
        }

        const normalized = String(value).trim();

        if (!normalized) {
            return undefined;
        }

        const numeric = Number.parseFloat(normalized);
        if (!Number.isFinite(numeric)) {
            return undefined;
        }

        return `${Math.max(0, Math.round(numeric))}px`;
    };

    const syncManualInputValues = () => {
        if (widthInput) {
            widthInput.value = parseViewEditorInputValue(viewEditorContent.style.width);
        }

        if (heightInput) {
            heightInput.value = parseViewEditorInputValue(viewEditorContent.style.height);
        }

        if (zoomInput) {
            zoomInput.value = Number(getViewEditorContentScale().toFixed(2)).toString();
        }
    };

    menuSelect.addEventListener('change', () => {
        const value = menuSelect.value;

        if (!value || value === 'custom' || value === 'manual') {
            if (value === 'manual') {
                syncManualInputValues();
            }
            return;
        }

        const [rawWidth, rawHeight] = value.split('x');
        const width = parseDimension(rawWidth);
        const height = parseDimension(rawHeight);

        window.editorBlock.applyViewEditorSize(width, height);
        syncManualInputValues();
    });

    if (widthInput) {
        widthInput.addEventListener('input', () => {
            menuSelect.value = 'manual';
            const nextWidth = parseManualDimension(widthInput.value);
            const nextHeight = heightInput && heightInput.value !== '' ? parseManualDimension(heightInput.value) : undefined;
            window.editorBlock.applyViewEditorSize(typeof nextWidth !== 'undefined' ? nextWidth : undefined, typeof nextHeight !== 'undefined' ? nextHeight : undefined);
        });
    }

    if (heightInput) {
        heightInput.addEventListener('input', () => {
            menuSelect.value = 'manual';
            const nextWidth = widthInput && widthInput.value !== '' ? parseManualDimension(widthInput.value) : undefined;
            const nextHeight = parseManualDimension(heightInput.value);
            window.editorBlock.applyViewEditorSize(typeof nextWidth !== 'undefined' ? nextWidth : undefined, typeof nextHeight !== 'undefined' ? nextHeight : undefined);
        });
    }

    if (zoomInput) {
        zoomInput.addEventListener('input', () => {
            if (zoomInput.value === '') {
                return;
            }

            menuSelect.value = 'manual';
            window.editorBlock.applyViewEditorZoom (zoomInput.value);
            syncManualInputValues();
        });
    }

    syncManualInputValues();
    menuSelect.dataset.bound = 'true';
}

document.addEventListener('editorBlock:loaded', async () => {
    initViewEditorMenu();
});



/* ===
 * Сохранение настроек области просмотра
=== */

/* ***
 * saveViewEditorSettings - сохранение настроек области просмотра
 * - получает текущий активный блок
 * - сохраняет выбранный режим и масштаб
*** */
function saveViewEditorSettings() {
    const blockId = window.editorBlock?.currentBlockId || null;
    const settingsEl = blockId ? document.getElementById(blockId + 'Settings') : null;
    const menuSelect = document.getElementById('viewEditorMenuSelect');
    const zoomInput = document.getElementById('viewEditorZoomInput');

    if (settingsEl && menuSelect) {
        settingsEl.dataset.viewEditorScreen = menuSelect.value;
    }

    if (settingsEl && zoomInput) {
        settingsEl.dataset.viewEditorZoom = zoomInput.value;
    }
}
window.editorBlock.saveViewEditorSettings = saveViewEditorSettings;

// Обработчики изменения настроек области просмотра
document.getElementById('viewEditorMenuSelect')?.addEventListener('change', saveViewEditorSettings);
document.getElementById('viewEditorZoomInput')?.addEventListener('change', saveViewEditorSettings);



/* ===
 * Поворот области просмотра
=== */

// Кнопка изменения ориентации области просмотра
const viewEditorRotate = document.getElementById('viewEditorRotate');

/* ***
 * rotateViewEditorSize - изменение ориентации области просмотра
 * меняет местами ширину и высоту
*** */
function rotateViewEditorSize() {
    const widthInput = document.getElementById('viewEditorWidthInput');
    const heightInput = document.getElementById('viewEditorHeightInput');

    if (!widthInput || !heightInput) {
        return;
    }

    const width = widthInput.value;
    const height = heightInput.value;

    window.editorBlock.applyViewEditorSize(`${height}px`, `${width}px`);
}

// Обработчик изменения ориентации области просмотра
viewEditorRotate?.addEventListener('click', rotateViewEditorSize);