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
 * syncViewEditorSizeInputs - синхронизация полей размеров редактора
 * получает поля ширины и высоты
 * получает текущую область редактора
 * устанавливает текущие значения ширины и высоты в поля
*** */
const syncViewEditorSizeInputs = () => {
    const widthInput = document.getElementById('viewEditorWidthInput');
    const heightInput = document.getElementById('viewEditorHeightInput');
    const viewEditorContent = document.getElementById('viewEditorContent');

    if (!widthInput || !heightInput || !viewEditorContent) {
        return;
    }

    widthInput.value = parseViewEditorInputValue(viewEditorContent.style.width);
    heightInput.value = parseViewEditorInputValue(viewEditorContent.style.height);
};

/* ***
 * applyViewEditorSize - применение размеров к viewEditorContent
 * принимает ширину и высоту
 * изменяет размер контейнера viewEditorContent
 * сохраняет размеры в настройках текущего блока
*** */
window.applyViewEditorSize = (width, height) => {
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

    syncViewEditorSizeInputs();
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

        window.applyViewEditorSize(width, height);
        syncManualInputValues();
    });

    if (widthInput) {
        widthInput.addEventListener('input', () => {
            menuSelect.value = 'manual';
            const nextWidth = parseManualDimension(widthInput.value);
            const nextHeight = heightInput && heightInput.value !== '' ? parseManualDimension(heightInput.value) : undefined;
            window.applyViewEditorSize(typeof nextWidth !== 'undefined' ? nextWidth : undefined, typeof nextHeight !== 'undefined' ? nextHeight : undefined);
        });
    }

    if (heightInput) {
        heightInput.addEventListener('input', () => {
            menuSelect.value = 'manual';
            const nextWidth = widthInput && widthInput.value !== '' ? parseManualDimension(widthInput.value) : undefined;
            const nextHeight = parseManualDimension(heightInput.value);
            window.applyViewEditorSize(typeof nextWidth !== 'undefined' ? nextWidth : undefined, typeof nextHeight !== 'undefined' ? nextHeight : undefined);
        });
    }

    syncManualInputValues();
    menuSelect.dataset.bound = 'true';
}

document.addEventListener('editorBlock:loaded', async () => {
    initViewEditorMenu();
});