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
    return viewEditorContent ? viewEditorContent.querySelector('#viewEditorIframe') : null;
}

/* ***
 * copyViewEditorPreviewStyles - копирование текущих стилей элементов
 * - получает исходный и скопированный элементы
 * - переносит вычисленные стили
 * - переносит текущие значения полей
 * - рекурсивно обрабатывает дочерние элементы
*** */
function copyViewEditorPreviewStyles(sourceElement, previewElement) {
    if (!sourceElement || !previewElement || sourceElement.nodeType !== 1 || previewElement.nodeType !== 1) {
        return;
    }

    const sourceWindow = sourceElement.ownerDocument?.defaultView;
    const computedStyle = sourceWindow?.getComputedStyle(sourceElement);

    if (computedStyle) {
        for (const property of computedStyle) {
            previewElement.style.setProperty(property, computedStyle.getPropertyValue(property), computedStyle.getPropertyPriority(property));
        }
    }

    if ('value' in sourceElement && 'value' in previewElement) {
        previewElement.value = sourceElement.value;
    }

    if ('checked' in sourceElement && 'checked' in previewElement) {
        previewElement.checked = sourceElement.checked;
    }

    if (sourceElement.tagName === 'TEXTAREA') {
        previewElement.textContent = sourceElement.value;
    }

    const sourceChildren = Array.from(sourceElement.children);
    const previewChildren = Array.from(previewElement.children);

    sourceChildren.forEach((sourceChild, index) => {
        copyViewEditorPreviewStyles(sourceChild, previewChildren[index]);
    });
}

/* ***
 * createViewEditorPreviewLayer - создание слоя скрытой области редактора
 * - удаляет старый preview
 * - создаёт контейнер содержимого
 * - создаёт белый полупрозрачный слой
 * - размещает preview под основным iframe
*** */
function createViewEditorPreviewLayer(iframeElement) {
    const viewEditorContent = iframeElement?.closest('#viewEditorContent');

    if (!viewEditorContent) {
        return null;
    }

    const oldPreview = viewEditorContent.querySelector('#viewEditorPreview');

    if (oldPreview) {
        oldPreview.remove();
    }

    const previewLayer = document.createElement('div');
    previewLayer.id = 'viewEditorPreview';

    const previewContent = document.createElement('div');
    previewContent.className = 'viewEditorPreviewContent';

    const previewOverlay = document.createElement('div');
    previewOverlay.className = 'viewEditorPreviewOverlay';

    const previewShade = document.createElement('div');
    previewShade.className = 'viewEditorPreviewShade';

    previewLayer.appendChild(previewOverlay);
    previewLayer.appendChild(previewContent);
    previewLayer.appendChild(previewShade);
    viewEditorContent.insertBefore(previewLayer, iframeElement);

    return previewLayer;
}

/* ***
 * buildViewEditorPreviewContent - создание копии содержимого iframe
 * - копирует body вместе со всем содержимым
 * - переносит текущие вычисленные стили
 * - сохраняет текущую ширину layout
 * - отключает события мыши
*** */
function buildViewEditorPreviewContent(iframeElement) {
    const iframeDoc = iframeElement?.contentDocument || iframeElement?.contentWindow?.document;

    if (!iframeDoc?.body) {
        return null;
    }

    const sourceBody = iframeDoc.body;
    const previewBody = sourceBody.cloneNode(true);

    copyViewEditorPreviewStyles(sourceBody, previewBody);

    previewBody.removeAttribute('contenteditable');
    previewBody.style.pointerEvents = 'none';
    previewBody.style.userSelect = 'none';
    previewBody.style.transform = 'none';
    previewBody.style.zoom = '1';

    return previewBody;
}

/* ***
 * updateViewEditorPreview - обновление положения и размера preview
 * - получает полный размер содержимого iframe
 * - получает текущую прокрутку
 * - сохраняет ширину основного viewport
 * - смещает preview вслед за прокруткой
 * - показывает скрытые области вокруг iframe
*** */
function updateViewEditorPreview(iframeElement) {
    const viewEditorContent = iframeElement?.closest('#viewEditorContent');
    const previewLayer = viewEditorContent?.querySelector('#viewEditorPreview');

    if (!iframeElement || !viewEditorContent || !previewLayer) {
        return null;
    }

    const iframeDoc = iframeElement.contentDocument || iframeElement.contentWindow?.document;
    const htmlElement = iframeDoc?.documentElement;
    const bodyElement = iframeDoc?.body;
    const scrollElement = iframeDoc?.scrollingElement || htmlElement || bodyElement;

    if (!htmlElement || !bodyElement || !scrollElement) {
        return null;
    }

    const previewContent = previewLayer.querySelector('.viewEditorPreviewContent');
    const previewOverlay = previewLayer.querySelector('.viewEditorPreviewOverlay');
    const previewShade = previewLayer.querySelector('.viewEditorPreviewShade');

    if (!previewContent || !previewOverlay || !previewShade) {
        return null;
    }

    const frameWidth = htmlElement.clientWidth || iframeElement.clientWidth || iframeElement.offsetWidth || 0;
    const frameHeight = htmlElement.clientHeight || iframeElement.clientHeight || iframeElement.offsetHeight || 0;

    const contentWidth = Math.max(htmlElement.scrollWidth, bodyElement.scrollWidth, frameWidth);
    const contentHeight = Math.max(htmlElement.scrollHeight, bodyElement.scrollHeight, frameHeight);

    const scrollLeft = scrollElement.scrollLeft || 0;
    const scrollTop = scrollElement.scrollTop || 0;

    const hasHorizontalScroll = htmlElement.scrollWidth > htmlElement.clientWidth;
    const hasVerticalScroll = htmlElement.scrollHeight > htmlElement.clientHeight;
    const shouldShowPreview = hasHorizontalScroll || hasVerticalScroll;

    previewLayer.style.display = shouldShowPreview ? 'block' : 'none';
    previewLayer.style.left = `${-scrollLeft}px`;
    previewLayer.style.top = `${-scrollTop}px`;
    previewLayer.style.width = `${frameWidth}px`;
    previewLayer.style.height = `${frameHeight}px`;

    previewContent.style.left = '0';
    previewContent.style.top = '0';
    previewContent.style.width = `${contentWidth}px`;
    previewContent.style.height = `${contentHeight}px`;
    previewContent.style.transform = 'none';

    const previewBody = previewContent.firstElementChild;

    if (previewBody) {
        previewBody.style.width = `${frameWidth}px`;
        previewBody.style.minWidth = `${frameWidth}px`;
        previewBody.style.height = `${frameHeight}px`;
        previewBody.style.minHeight = `${frameHeight}px`;
        previewBody.style.transform = 'none';
    }

    previewOverlay.style.left = '0';
    previewOverlay.style.top = '0';
    previewOverlay.style.width = `${contentWidth}px`;
    previewOverlay.style.height = `${contentHeight}px`;

    previewShade.style.left = '0';
    previewShade.style.top = '0';
    previewShade.style.width = `${contentWidth}px`;
    previewShade.style.height = `${contentHeight}px`;

    return null;
}

/* ***
 * syncViewEditorPreviewContent - синхронизация содержимого preview
 * - заново копирует текущее содержимое iframe
 * - переносит текст, пробелы, элементы и стили
 * - обновляет размеры и положение
*** */
function syncViewEditorPreviewContent(iframeElement) {
    const viewEditorContent = iframeElement?.closest('#viewEditorContent');
    const previewLayer = viewEditorContent?.querySelector('#viewEditorPreview');
    const previewContent = previewLayer?.querySelector('.viewEditorPreviewContent');

    if (!previewContent) {
        return null;
    }

    const previewBody = buildViewEditorPreviewContent(iframeElement);

    if (!previewBody) {
        return null;
    }

    previewContent.replaceChildren(previewBody);
    updateViewEditorPreview(iframeElement);

    return null;
}

/* ***
 * initViewEditorPreview - инициализация preview скрытой области
 * - создаёт слой под iframe
 * - синхронизирует содержимое
 * - отслеживает прокрутку
 * - отслеживает изменение DOM
 * - отслеживает ввод текста
 * - отслеживает изменение размеров
*** */
function initViewEditorPreview(iframeElement) {
    const iframeDoc = iframeElement?.contentDocument || iframeElement?.contentWindow?.document;

    if (!iframeElement || !iframeDoc?.documentElement || !iframeDoc.body) {
        return null;
    }

    createViewEditorPreviewLayer(iframeElement);
    syncViewEditorPreviewContent(iframeElement);

    const htmlElement = iframeDoc.documentElement;
    const bodyElement = iframeDoc.body;
    const scrollElement = iframeDoc.scrollingElement || htmlElement || bodyElement;

    if (iframeElement._viewEditorPreviewObserver) {
        iframeElement._viewEditorPreviewObserver.disconnect();
    }

    if (iframeElement._viewEditorPreviewResizeObserver) {
        iframeElement._viewEditorPreviewResizeObserver.disconnect();
    }

    if (iframeElement._viewEditorPreviewScrollElement && iframeElement._viewEditorPreviewScrollHandler) {
        iframeElement._viewEditorPreviewScrollElement.removeEventListener('scroll', iframeElement._viewEditorPreviewScrollHandler);
    }

    if (iframeElement._viewEditorPreviewScrollHandler) {
        iframeDoc.removeEventListener('scroll', iframeElement._viewEditorPreviewScrollHandler, true);
    }

    iframeElement._viewEditorPreviewScrollHandler = () => {
        updateViewEditorPreview(iframeElement);
    };

    iframeElement._viewEditorPreviewScrollElement = scrollElement;

    scrollElement.addEventListener('scroll', iframeElement._viewEditorPreviewScrollHandler, {
        passive: true
    });

    iframeDoc.addEventListener('scroll', iframeElement._viewEditorPreviewScrollHandler, {
        passive: true,
        capture: true
    });

    const changedElements = new Set();

    /* Сохраняем изменённые элементы */
    iframeElement._viewEditorPreviewObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            const element = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;

            if (element) {
                changedElements.add(element);
            }
        });
    });

    /* Обновляем только изменённые элементы */
    iframeElement._viewEditorPreviewSyncInterval = setInterval(() => {
        if (!changedElements.size) {
            return;
        }

        const previewBody = viewEditorContent.querySelector('.viewEditorPreviewContent > *');

        if (!previewBody) {
            return;
        }

        changedElements.forEach(sourceElement => {
            /* Обновляем весь body при изменении его структуры */
            if (sourceElement === bodyElement) {
                const newBody = bodyElement.cloneNode(true);

                copyViewEditorPreviewStyles(bodyElement, newBody);
                newBody.removeAttribute('contenteditable');
                newBody.style.pointerEvents = 'none';
                newBody.style.userSelect = 'none';
                newBody.style.transform = 'none';
                newBody.style.zoom = '1';

                previewBody.replaceWith(newBody);
                return;
            }

            /* Находим такой же элемент в preview */
            const path = [];
            let currentElement = sourceElement;

            while (currentElement && currentElement !== bodyElement) {
                path.unshift(Array.from(currentElement.parentElement.children).indexOf(currentElement));
                currentElement = currentElement.parentElement;
            }

            let previewElement = previewBody;

            path.forEach(index => {
                previewElement = previewElement?.children[index];
            });

            if (!previewElement) {
                return;
            }

            /* Заменяем только изменённый элемент */
            const newElement = sourceElement.cloneNode(true);

            copyViewEditorPreviewStyles(sourceElement, newElement);
            previewElement.replaceWith(newElement);
        });

        changedElements.clear();
        updateViewEditorPreview(iframeElement);
    }, 500);

    iframeElement._viewEditorPreviewObserver.observe(bodyElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
    });

    if (typeof ResizeObserver !== 'undefined') {
        iframeElement._viewEditorPreviewResizeObserver = new ResizeObserver(() => {
            updateViewEditorPreview(iframeElement);
        });

        iframeElement._viewEditorPreviewResizeObserver.observe(iframeElement);
        iframeElement._viewEditorPreviewResizeObserver.observe(htmlElement);
        iframeElement._viewEditorPreviewResizeObserver.observe(bodyElement);
    }

    updateViewEditorPreview(iframeElement);

    return null;
}
window.editorBlock.initViewEditorPreview = initViewEditorPreview;

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
    let lastWidth = 0;
    let lastHeight = 0;

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
        const deltaX = (event.clientX - startX) / zoom * resizeFactorX;
        const deltaY = (event.clientY - startY) / zoom * resizeFactorY;

        let nextWidth = Math.max(minSize, Math.round(startWidth + deltaX));
        let nextHeight = Math.max(minSize, Math.round(startHeight + deltaY));

        try {
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

            resizeHandle.style.left = `${Math.max(0, nextWidth - resizeHandle.offsetWidth)}px`;
            resizeHandle.style.top = `${Math.max(0, nextHeight - resizeHandle.offsetHeight)}px`;

            const iframeElement = getPreviewEditorIframe();

            if (iframeElement) {
                updateViewEditorPreview(iframeElement);
            }
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
            } catch (e) {
            }

            syncViewEditorPreviewContent(iframeEl);
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
            } catch (e) {
            }
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

/* ***
 * updateContentSize - обновление размеров контейнера редактора
 * - получает HTML элемент фрейма
 * - рассчитывает ширину и высоту содержимого
 * - подстраивает размеры контейнера редактора
 * - вызывает обновление preview
 * - возвращает null
*** */
function updateContentSize() {
    const viewEditorContent = document.getElementById('viewEditorContent');
    const iframeElement = document.getElementById('viewEditorIframe');

    if (!viewEditorContent || !iframeElement) {
        return null;
    }

    const iframeDoc = iframeElement.contentDocument;
    const htmlElement = iframeDoc?.documentElement;
    const bodyElement = iframeDoc?.body;

    if (!htmlElement) {
        return null;
    }

    const contentWidth = Math.max(htmlElement.scrollWidth, bodyElement?.scrollWidth || 0);
    const contentHeight = Math.max(htmlElement.scrollHeight, bodyElement?.scrollHeight || 0);

    const widthInput = document.getElementById('viewEditorWidthInput');
    const minWidth = getMinSize(widthInput, viewEditorContent.dataset.viewEditorWidth || viewEditorContent.style.width);

    const heightInput = document.getElementById('viewEditorHeightInput');
    const minHeight = getMinSize(heightInput, viewEditorContent.dataset.viewEditorHeight || viewEditorContent.style.height);

    viewEditorContent.style.height = `${contentHeight}px`;

    if (contentWidth > minWidth && minWidth > 0) {
        viewEditorContent.style.width = `${contentWidth}px`;
    } else if (minWidth > 0) {
        viewEditorContent.style.width = `${minWidth}px`;
    }

    const resizeHandle = document.getElementById('viewEditorResizeHandle');

    if (resizeHandle) {
        const handleWidth = resizeHandle.offsetWidth || 14;
        const handleHeight = resizeHandle.offsetHeight || 14;

        resizeHandle.style.left = `${Math.max(0, minWidth - handleWidth)}px`;
        resizeHandle.style.top = `${Math.max(0, minHeight - handleHeight)}px`;
        resizeHandle.style.right = 'auto';
        resizeHandle.style.bottom = 'auto';
    }

    updateViewEditorPreview(iframeElement);

    return null;
}

/* ***
 * observeContentSize - проверка размеров содержимого после загрузки iframe
 * - находит фрейм редактора
 * - вызывает updateContentSize после готовности документа
 * - инициализирует preview скрытого содержимого
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

    updateContentSize();
    initViewEditorPreview(iframeElement);

    return null;
}

observeContentSize();