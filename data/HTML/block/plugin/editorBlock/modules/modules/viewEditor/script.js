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

    // Поиск существующего контейнера оверлеев
    let overlayContainer = containerElement.querySelector('.__view-editor-overlays');

    if (!overlayContainer) {
        // Создание родительского контейнера оверлеев
        overlayContainer = document.createElement('div');
        overlayContainer.className = '__view-editor-overlays';

        // Применение базовых стилей к контейнеру
        Object.assign(overlayContainer.style, {
            position: 'absolute',
            inset: '0px',
            pointerEvents: 'none',
            zIndex: '9999'
        });

        // Создание элементов правого, нижнего и углового затемнения
        const rightOverlay = document.createElement('div');
        rightOverlay.className = '__overlay-right';

        const bottomOverlay = document.createElement('div');
        bottomOverlay.className = '__overlay-bottom';

        const cornerOverlay = document.createElement('div');
        cornerOverlay.className = '__overlay-corner';

        // Список всех слоев затемнения
        const overlayElements = [
            rightOverlay,
            bottomOverlay,
            cornerOverlay
        ];

        // Применение общих стилей для всех слоев
        for (const overlayElement of overlayElements) {
            Object.assign(overlayElement.style, {
                position: 'absolute',
                background: 'rgba(0, 0, 0, 0.45)',
                transition: 'opacity 160ms ease',
                opacity: '0',
                pointerEvents: 'none'
            });

            overlayContainer.appendChild(overlayElement);
        }

        // Проверка и установка относительно позиционирования контейнера
        const computedPosition = window.getComputedStyle(containerElement).position;

        if (computedPosition === 'static') {
            containerElement.style.position = 'relative';
        }

        containerElement.appendChild(overlayContainer);
    }

    // Элемент правого оверлея
    const rightElement = overlayContainer.querySelector('.__overlay-right');

    // Элемент нижнего оверлея
    const bottomElement = overlayContainer.querySelector('.__overlay-bottom');

    // Элемент углового оверлея
    const cornerElement = overlayContainer.querySelector('.__overlay-corner');

    // Объект структуры оверлеев
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
    // Контейнер отображения редактора
    const viewEditorContent = document.getElementById('viewEditorContent');

    // Элемент фрейма
    const iframeElement = document.getElementById('viewEditorIframe');

    if (!viewEditorContent || !iframeElement) {
        return null;
    }

    // Поля ввода минимальных параметров
    const widthInput = document.getElementById('viewEditorWidthInput');
    const heightInput = document.getElementById('viewEditorHeightInput');

    // Границы минимальной ширины и высоты
    const minWidth = getMinSize(widthInput, viewEditorContent.dataset.viewEditorWidth || viewEditorContent.style.width);
    const minHeight = getMinSize(heightInput, viewEditorContent.dataset.viewEditorHeight || viewEditorContent.style.height);

    // Получение слоев затемнения
    const overlays = ensureOverlays(viewEditorContent);

    if (!overlays) {
        return null;
    }

    // Текущие габариты фрейма
    const iframeWidth = iframeElement.offsetWidth;
    const iframeHeight = iframeElement.offsetHeight;

    // Расчет выходящих за границы областей
    const exceedWidth = iframeWidth - minWidth;
    const exceedHeight = iframeHeight - minHeight;

    // Обновление затемнения по ширине справа
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

    // Обновление затемнения по высоте снизу
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

    // Обновление углового затемнения при двух превышениях
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
    // Контейнер редактора
    const viewEditorContent = document.getElementById('viewEditorContent');

    // Элемент фрейма
    const iframeElement = document.getElementById('viewEditorIframe');

    if (!viewEditorContent || !iframeElement) {
        return null;
    }

    // Корневой элемент документа во фрейме
    const htmlElement = iframeElement.contentDocument?.documentElement;

    if (!htmlElement) {
        return null;
    }

    // Полные размеры внутреннего документа
    const contentWidth = htmlElement.scrollWidth;
    const contentHeight = htmlElement.scrollHeight;

    // Поле ввода ширины
    const widthInput = document.getElementById('viewEditorWidthInput');

    // Минимально заданная ширина
    const minWidth = getMinSize(widthInput, viewEditorContent.dataset.viewEditorWidth || viewEditorContent.style.width);

    // Применение полной высоты содержимого
    viewEditorContent.style.height = `${contentHeight}px`;

    // Применение ширины с учетом превышения минимальной границы
    if (contentWidth > minWidth && minWidth > 0) {
        viewEditorContent.style.width = `${contentWidth}px`;
    } else if (minWidth > 0) {
        viewEditorContent.style.width = `${minWidth}px`;
    }

    // Обновление позиционирования затемнений
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
    // Элемент фрейма
    const iframeElement = document.getElementById('viewEditorIframe');

    if (!iframeElement) {
        setTimeout(observeContentSize, 1000);
        return null;
    }

    // Корневой элемент документа во фрейме
    const htmlElement = iframeElement.contentDocument?.documentElement;

    if (!htmlElement) {
        // Подписка на загрузку фрейма
        iframeElement.addEventListener('load', observeContentSize, {
            once: true
        });

        return null;
    }

    // Наблюдатель за изменением размеров документа
    const resizeObserver = new ResizeObserver(updateContentSize);
    resizeObserver.observe(htmlElement);

    // Первичный расчет размеров
    updateContentSize();

    // Подписка на изменение размеров окна фрейма
    if (iframeElement.contentWindow) {
        iframeElement.contentWindow.addEventListener('resize', handleIframeResize, {
            passive: true
        });
    }

    // Подписка на изменение размеров основного окна
    window.addEventListener('resize', handleWindowResize, {
        passive: true
    });

    return null;
}

// Запуск наблюдателя за размерами редактора
observeContentSize();