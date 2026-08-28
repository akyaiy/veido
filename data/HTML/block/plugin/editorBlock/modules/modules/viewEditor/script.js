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
    let resizeFactorX = 2;
    let resizeFactorY = 2;

    /* ***
     * getCurrentZoom - получение текущего масштаба элемента
     * принимает DOM-элемент
     * получает масштаб из CSS zoom
     * возвращает текущий масштаб
    *** */
    const getCurrentZoom = (el) => {
        const zoom = parseFloat(window.getComputedStyle(el).zoom);

        if (!isNaN(zoom) && zoom > 0) {
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
            window.editorBlock.saveViewEditorSettings();
        }

        const zoom = getCurrentZoom(viewEditorContent);
        const deltaX = (event.clientX - startX) / zoom * resizeFactorX * 2;
        const deltaY = (event.clientY - startY) / zoom * resizeFactorY;

        let nextWidth = Math.max(minSize, Math.round(startWidth + deltaX));
        let nextHeight = Math.max(minSize, Math.round(startHeight + deltaY));

        try {
            const zoom = getCurrentZoom(viewEditorContent) || 1;
            const parentEl = viewEditorContent.parentElement || document.documentElement;
            const parentRect = parentEl.getBoundingClientRect();
            const maxAllowedW = Math.max(minSize, Math.floor(parentRect.width / zoom));
            const maxAllowedH = Math.max(minSize, Math.floor(parentRect.height / zoom));

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

        if (typeof window.editorBlock.applyViewEditorSize === 'function') {
            window.editorBlock.applyViewEditorSize(nextWidth + 'px', nextHeight + 'px');
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
        viewEditorContent.dataset.isResizing = 'false';
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
        const contentRect = viewEditorContent.getBoundingClientRect();
        const handleRect = resizeHandle.getBoundingClientRect();
        const zoom = getCurrentZoom(viewEditorContent);

        const widthInput = document.getElementById('viewEditorWidthInput');
        const heightInput = document.getElementById('viewEditorHeightInput');
        const iframeElement = document.getElementById('viewEditorIframe');

        const currentMinWidth = getMinSize(widthInput, viewEditorContent.dataset.viewEditorWidth || viewEditorContent.style.width);
        const currentMinHeight = getMinSize(heightInput, viewEditorContent.dataset.viewEditorHeight || viewEditorContent.style.height);

        const iframeWidth = iframeElement ? iframeElement.offsetWidth : viewEditorContent.offsetWidth;
        const iframeHeight = iframeElement ? iframeElement.offsetHeight : viewEditorContent.offsetHeight;

        resizeFactorX = iframeWidth > currentMinWidth && currentMinWidth > 0 ? 1 : 2;
        resizeFactorY = iframeHeight > currentMinHeight && currentMinHeight > 0 ? 1 : 2;

        isResizing = true;
        viewEditorContent.dataset.isResizing = 'true';
        startX = handleRect.right;
        startY = handleRect.bottom;
        startWidth = (handleRect.right - contentRect.left) / zoom;
        startHeight = (handleRect.bottom - contentRect.top) / zoom;
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



/* ===
 * Режим адаптивной верстки
=== */

/* ***
 * getMinSize - получение минимального размера элемента
 * - принимает элемент поля ввода
 * - принимает запасное значение размера
 * - парсит числовое значение размера
 * - возвращает минимальный размер в пикселях
*** */
function getMinSize(inputElement, fallbackValue) {
    if (inputElement && inputElement.value !== '') {
        const parsedInput = Number.parseInt(inputElement.value, 10);

        if (Number.isFinite(parsedInput)) {
            return parsedInput;
        }
    }

    if (fallbackValue) {
        const parsedFallback = Number.parseInt(String(fallbackValue).replace('px', ''), 10);

        if (Number.isFinite(parsedFallback)) {
            return parsedFallback;
        }
    }

    return 0;
}



/* ===
 * Логика управления оверлеями затемнения
=== */

/* ***
 * ensureOverlays - создание и получение контейнера оверлеев
 * - принимает контейнер редактора
 * - проверяет наличие элементов оверлея
 * - создает структуру оверлеев при отсутствии
 * - возвращает объект с элементами оверлеев
*** */
function ensureOverlays(containerElement) {
    if (!containerElement) {
        return null;
    }

    let overlayContainer = containerElement.querySelector('.viewEditorOverlays');

    if (!overlayContainer) {
        overlayContainer = document.createElement('div');
        overlayContainer.className = 'viewEditorOverlays';

        const rightOverlay = document.createElement('div');
        rightOverlay.className = 'overlayRight';

        const bottomOverlay = document.createElement('div');
        bottomOverlay.className = 'overlayBottom';

        const cornerOverlay = document.createElement('div');
        cornerOverlay.className = 'overlayCorner';

        overlayContainer.appendChild(rightOverlay);
        overlayContainer.appendChild(bottomOverlay);
        overlayContainer.appendChild(cornerOverlay);

        const computedPosition = getComputedStyle(containerElement).position;

        if (computedPosition === 'static') {
            containerElement.style.position = 'relative';
        }

        containerElement.appendChild(overlayContainer);
    }

    const rightElement = overlayContainer.querySelector('.overlayRight');
    const bottomElement = overlayContainer.querySelector('.overlayBottom');
    const cornerElement = overlayContainer.querySelector('.overlayCorner');

    const overlaysData = {
        container: overlayContainer,
        right: rightElement,
        bottom: bottomElement,
        corner: cornerElement
    };

    return overlaysData;
}

/* ***
 * updateOverlays - обновление размеров и видимости оверлеев
 * - получает элементы редактора и фрейма
 * - вычисляет превышение минимальных размеров
 * - позиционирует темные области по ширине и высоте
 * - возвращает null
*** */
function updateOverlays() {
    const viewEditorContent = document.getElementById('viewEditorContent');
    const iframeElement = document.getElementById('viewEditorIframe');
    const resizeHandle = document.getElementById('viewEditorResizeHandle');

    if (!viewEditorContent || !iframeElement) {
        return null;
    }

    const widthInput = document.getElementById('viewEditorWidthInput');
    const heightInput = document.getElementById('viewEditorHeightInput');

    const minWidth = getMinSize(widthInput, viewEditorContent.dataset.viewEditorWidth || viewEditorContent.style.width);
    const minHeight = getMinSize(heightInput, viewEditorContent.dataset.viewEditorHeight || viewEditorContent.style.height);

    if (resizeHandle) {
        const handleWidth = resizeHandle.offsetWidth || 14;
        const handleHeight = resizeHandle.offsetHeight || 14;

        resizeHandle.style.left = `${Math.max(0, minWidth - handleWidth)}px`;
        resizeHandle.style.top = `${Math.max(0, minHeight - handleHeight)}px`;
        resizeHandle.style.right = 'auto';
        resizeHandle.style.bottom = 'auto';
    }

    const overlays = ensureOverlays(viewEditorContent);

    if (!overlays) {
        return null;
    }

    const iframeWidth = iframeElement.offsetWidth;
    const iframeHeight = iframeElement.offsetHeight;

    const exceedWidth = iframeWidth - minWidth;
    const exceedHeight = iframeHeight - minHeight;

    if (exceedWidth > 0 && minWidth > 0) {
        const rightHeight = exceedHeight > 0 ? minHeight : iframeHeight;

        Object.assign(overlays.right.style, {
            left: `${minWidth}px`,
            top: '0px',
            width: `${exceedWidth}px`,
            height: `${rightHeight}px`,
            opacity: '1'
        });
    } else {
        overlays.right.style.opacity = '0';
    }

    if (exceedHeight > 0 && minHeight > 0) {
        const bottomWidth = exceedWidth > 0 ? minWidth : iframeWidth;

        Object.assign(overlays.bottom.style, {
            left: '0px',
            top: `${minHeight}px`,
            width: `${bottomWidth}px`,
            height: `${exceedHeight}px`,
            opacity: '1'
        });
    } else {
        overlays.bottom.style.opacity = '0';
    }

    if (exceedWidth > 0 && exceedHeight > 0 && minWidth > 0 && minHeight > 0) {
        Object.assign(overlays.corner.style, {
            left: `${minWidth}px`,
            top: `${minHeight}px`,
            width: `${exceedWidth}px`,
            height: `${exceedHeight}px`,
            opacity: '1'
        });
    } else {
        overlays.corner.style.opacity = '0';
    }

    return null;
}

/* ***
 * updateContentSize - обновление размеров контейнера редактора
 * - получает HTML элемент фрейма
 * - рассчитывает ширину и высоту содержимого
 * - подстраивает размеры контейнера редактора
 * - вызывает обновление затемняющих оверлеев
 * - возвращает null
*** */
function updateContentSize() {
    const viewEditorContent = document.getElementById('viewEditorContent');
    const iframeElement = document.getElementById('viewEditorIframe');

    if (!viewEditorContent || !iframeElement) {
        return null;
    }

    const htmlElement = iframeElement.contentDocument?.documentElement;

    if (!htmlElement) {
        return null;
    }

    const contentWidth = htmlElement.scrollWidth;
    const contentHeight = htmlElement.scrollHeight;

    const widthInput = document.getElementById('viewEditorWidthInput');
    const minWidth = getMinSize(widthInput, viewEditorContent.dataset.viewEditorWidth || viewEditorContent.style.width);

    viewEditorContent.style.height = `${contentHeight}px`;

    if (contentWidth > minWidth && minWidth > 0) {
        viewEditorContent.style.width = `${contentWidth}px`;
    } else if (minWidth > 0) {
        viewEditorContent.style.width = `${minWidth}px`;
    }

    updateOverlays();

    return null;
}

/* ***
 * handleWindowResize - обработка изменения размера окна
 * - вызывает обновление позиций оверлеев
 * - возвращает null
*** */
function handleWindowResize() {
    updateOverlays();
    return null;
}

/* ***
 * handleIframeResize - обработка изменения размера фрейма
 * - вызывает обновление позиций оверлеев
 * - возвращает null
*** */
function handleIframeResize() {
    updateOverlays();
    return null;
}

/* ***
 * observeContentSize - отслеживание изменений размеров содержимого
 * - находит фрейм редактора
 * - подключает ResizeObserver к содержимому
 * - подписывается на события изменения размеров
 * - возвращает null
*** */
function observeContentSize() {
    const iframeElement = document.getElementById('viewEditorIframe');

    if (!iframeElement) {
        setTimeout(observeContentSize, 1000);
        return null;
    }

    const htmlElement = iframeElement.contentDocument?.documentElement;

    if (!htmlElement) {
        iframeElement.addEventListener('load', observeContentSize, {
            once: true
        });

        return null;
    }

    const resizeObserver = new ResizeObserver(updateContentSize);
    resizeObserver.observe(htmlElement);

    updateContentSize();

    if (iframeElement.contentWindow) {
        iframeElement.contentWindow.addEventListener('resize', handleIframeResize, {
            passive: true
        });
    }

    addEventListener('resize', handleWindowResize, {
        passive: true
    });

    return null;
}

observeContentSize();