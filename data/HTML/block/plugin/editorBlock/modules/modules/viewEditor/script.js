/* ==
 * Изменение размера редактора мышью (Resize)
=== */

/* ***
 * getPreviewEditorIframe - получение iframe визуального редактора
 * - ищет контейнер viewEditorContent
 * - возвращает вложенный iframe или null
*** */
function getPreviewEditorIframe() {
    const viewEditorContent = document.getElementById('viewEditorContent');
    return viewEditorContent ? viewEditorContent.querySelector('iframe') : null;
}

/* ***
 * initPreviewResize - инициализация изменения размера viewEditor
 * получает контейнер viewEditorContent и элемент изменения размера
 * проверяет наличие элементов и повторную инициализацию
 * изменяет размер контейнера мышью
 * переключает селектор в режим "Вручную" при изменении размера мышью
 * учитывает текущий масштаб элемента
 * ограничивает минимальный и максимальный размер
 * временно отключает события iframe для корректной работы над ним
 * сохраняет размер текущего блока
*** */
function initPreviewResize() {
    const viewEditorContent = document.getElementById('viewEditorContent');
    const resizeHandle = document.getElementById('viewEditorResizeHandle');

    if (!viewEditorContent || !resizeHandle || viewEditorContent.dataset.resizeInitialized === 'true') {
        return;
    }

    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    const minSize = 20;
    let lastWidth = 0;
    let lastHeight = 0;

    /* ***
     * getCurrentScale - получение текущего масштаба элемента
     * принимает DOM-элемент
     * получает масштаб из CSS transform или zoom
     * возвращает текущий масштаб
    *** */
    const getCurrentScale = (el) => {
        const transform = window.getComputedStyle(el).transform;

        if (transform && transform !== 'none') {
            const matrix = transform.match(/matrix\((.+)\)/);

            if (matrix) {
                const values = matrix[1].split(', ');
                return parseFloat(values[0]);
            }
        }

        const zoom = parseFloat(window.getComputedStyle(el).zoom);

        if (!isNaN(zoom) && zoom !== 1) {
            return zoom;
        }

        return 1;
    };

    /* ***
     * onMouseMove - изменение размера viewEditorContent
     * принимает событие движения мыши
     * проверяет активность изменения размера
     * переводит селектор меню в положение "manual"
     * рассчитывает новую ширину и высоту с учетом масштаба
     * ограничивает размеры границами родительского элемента
     * изменяет размеры viewEditorContent
    *** */
    const onMouseMove = (event) => {
        if (!isResizing) {
            return;
        }

        const menuSelect = document.getElementById('viewEditorMenuSelect');
        if (menuSelect && menuSelect.value !== 'manual') {
            menuSelect.value = 'manual';
        }

        const scale = getCurrentScale(viewEditorContent);
        const deltaX = (event.clientX - startX) / scale * 2;
        const deltaY = (event.clientY - startY) / scale * 2;

        let nextWidth = Math.max(minSize, Math.round(startWidth + deltaX));
        let nextHeight = Math.max(minSize, Math.round(startHeight + deltaY));

        try {
            const scale = getCurrentScale(viewEditorContent) || 1;
            const parentEl = viewEditorContent.parentElement || document.documentElement;
            const parentRect = parentEl.getBoundingClientRect();
            const maxAllowedW = Math.max(minSize, Math.floor(parentRect.width / scale));
            const maxAllowedH = Math.max(minSize, Math.floor(parentRect.height / scale));

            if (nextWidth > maxAllowedW) {
                nextWidth = maxAllowedW;
            }

            if (nextHeight > maxAllowedH) {
                nextHeight = maxAllowedH;
            }
        } catch (e) {
        }

        lastWidth = nextWidth;
        lastHeight = nextHeight;

        if (typeof window.applyViewEditorSize === 'function') {
            window.applyViewEditorSize(nextWidth + 'px', nextHeight + 'px');
        }
    };

    /* ***
     * onMouseUp - завершение изменения размера
     * завершает изменение размера
     * удаляет обработчики мыши
     * восстанавливает pointer-events для iframe
     * сохраняет последний размер в настройках блока
    *** */
    const onMouseUp = () => {
        isResizing = false;
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        const iframeEl = getPreviewEditorIframe();
        if (iframeEl) {
            try {
                iframeEl.style.pointerEvents = 'auto';
            } catch (e) {}
        }

        try {
            const currentBlockId = window.editorBlock?.currentBlockId || null;
            const settingsEl = currentBlockId ? document.getElementById(currentBlockId + 'Settings') : null;

            if (settingsEl && lastWidth && lastHeight) {
                settingsEl.dataset.viewEditorWidth = lastWidth + 'px';
                settingsEl.dataset.viewEditorHeight = lastHeight + 'px';
            }
        } catch (e) {
        }
    };

    /* ***
     * resizeHandle mousedown - запуск изменения размера
     * принимает событие нажатия мыши
     * отключает pointer-events у iframe, чтобы перехватывать движение над ним
     * сохраняет начальную позицию мыши и размеры
     * запускает обработчики изменения размера
    *** */
    resizeHandle.addEventListener('mousedown', (event) => {
        const rect = viewEditorContent.getBoundingClientRect();
        const scale = getCurrentScale(viewEditorContent);

        isResizing = true;
        startX = event.clientX;
        startY = event.clientY;
        startWidth = rect.width / scale;
        startHeight = rect.height / scale;
        lastWidth = startWidth;
        lastHeight = startHeight;

        const iframeEl = getPreviewEditorIframe();
        if (iframeEl) {
            try {
                iframeEl.style.pointerEvents = 'none';
            } catch (e) {}
        }

        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        event.preventDefault();
    });

    viewEditorContent.dataset.resizeInitialized = 'true';

    if (window.editorBlock) {
        window.editorBlock.initPreviewResize = initPreviewResize;
    }
}

document.addEventListener('editorBlock:loaded', async () => {
    initPreviewResize();
});