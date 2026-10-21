// === Общие ===

// Главный холст
const canvas = document.getElementById("svgCanvas");

// активный узел
let activePathHandle = null;

// Получение слоев из SVG
function getContentLayer(svg) { return svg?.children[1]; }
function getOverlayLayer(svg) { return svg?.children[2]; }
function getBorderLayer(svg) { return svg?.children[0]; }



// === Событиями кликов ===

// Массив активных ручек
let savedControls = [];

// Клик по канве
function handleCanvasPointerDown(e) {
    if (window.modeSvgEditor !== "selection" && window.modeSvgEditor !== "nodeEdit") return;
    const svg = canvas.querySelector("svg");
    const firstG = getContentLayer(svg);
    const techLayer = getOverlayLayer(svg);

    // если клик по path handle обрабатываем выделение и начинаем перемещение
    if (e.target.dataset && e.target.dataset.pathHandle) {
        e.preventDefault();
        e.stopPropagation();

        const clickedIndex = parseInt(e.target.dataset.pathIndex, 10);
        if (isNaN(clickedIndex)) return;

        const currentHandleType = e.target.dataset.pathHandle;
        const isControl = currentHandleType.startsWith("control");

        if (e.shiftKey) {
            // если до этого кликнули по ребру — переносим его узлы в shift-выделение
            if (window.lastActiveEdgeIndex != null) {
                const edgeIdx = window.lastActiveEdgeIndex;
                
                // добавляем стартовый узел ребра, если его там нет
                if (!window.activePathHandles.some(h => h.index === edgeIdx - 1 && h.handle === "node")) {
                    window.activePathHandles.push({ index: edgeIdx - 1, handle: "node" });
                }
                // добавляем конечный узел ребра, если его там нет
                if (!window.activePathHandles.some(h => h.index === edgeIdx && h.handle === "node")) {
                    window.activePathHandles.push({ index: edgeIdx, handle: "node" });
                }
                
                window.lastActiveEdgeIndex = null;
            }

            // Ищем, есть ли уже узел с таким индексом и типом ручки в активных
            const foundIdx = window.activePathHandles.findIndex(
                h => h.index === clickedIndex && h.handle === currentHandleType
            );

            if (foundIdx > -1) {
                // Если нашли — удаляем из выделения
                window.activePathHandles.splice(foundIdx, 1);
            } else {
                // Если не нашли — добавляем объект в массив
                window.activePathHandles.push({ index: clickedIndex, handle: currentHandleType });
            }
            updateSelectionBox(true);
        } else {
            // Обычный клик без shift
            if (isControl) {
                // Считываем абсолютно все усы со страницы до очистки и пишем в массив
                savedControls = Array.from((getOverlayLayer(svg) || canvas).querySelectorAll('[data-path-handle^="control"]')).map(el => ({
                    index: parseInt(el.dataset.pathIndex, 10),
                    handle: el.dataset.pathHandle
                }));

                // при нажатии на control полностью очищаем массив и пишем туда только один кликнутый control
                window.activePathHandles = [{ index: clickedIndex, handle: currentHandleType }];
                window.lastActiveEdgeIndex = null;

                // сразу же возвращаем остальные усы обратно на канву
                restoreSavedControls(clickedIndex, currentHandleType);

                updateSelectionBox(true);
            } else {
                // обычный клик по узлу сбрасывает все сразу
                window.activePathHandles = [{ index: clickedIndex, handle: currentHandleType }];
                window.lastActiveEdgeIndex = null;
                updateSelectionBox(false);
            }
        }

        // получаем обновленный элемент из дом для функции перемещения
        const freshHandle = techLayer.querySelector(
            `[data-path-index="${clickedIndex}"][data-path-handle="${e.target.dataset.pathHandle}"]`
        );

        if (freshHandle) {
            startPathHandleMove(e, freshHandle);
        }
        return;
    }

    // перемещение канвы мышкой
    if (startCanvasPanning(e, svg)) {
        return;
    }

    if (e.button !== 0) return;

    // если клик по квадрату изменения размера начинаем изменение размера
    if (e.target.dataset && e.target.dataset.resizeHandle) {
        startElementResize(e, e.target.dataset.resizeHandle);
        return;
    }

    // сохраняем данные
    const target = e.target;
    const isShiftOrCtrl = e.shiftKey || e.ctrlKey;
    const originalEvent = e;

    // ожидание для того чтобы другие обработчики на элементах могли сработать первыми
    setTimeout(() => {
        // если клик по элементу внутри первого слоя выделяем его
        if (firstG.contains(target)) {
            selectElement(target, isShiftOrCtrl);
            return;
        }

        // если клик по пустой зоне запускаем лассо
        selectElements(originalEvent);
    }, 0);
}

// Выделение элемента при нажатии (pointerdown)
canvas.addEventListener("pointerdown", (e) => {
    const target = e.target;
    const svg = canvas.querySelector("svg");
    if (!svg) return;

    const firstG = getContentLayer(svg);

    // если клик пришелся на сам path внутри основного слоя
    if (firstG && firstG.contains(target) && target.tagName.toLowerCase() === "path") {
        // если элемент еще не выделен — выделяем его сразу
        if (!window.selectedElementsSvg?.includes(target)) {
            selectElement(target, e.shiftKey);
        }

        // сразу же запускаем логику перетаскивания ребра, не дожидаясь второго клика
        onEdgePointerDown(e);
        return;
    }

    // Начало перетаскивания канвы или ручек
    handleCanvasPointerDown(e);

    // Функция клика по канве для остальных случаев
    onEdgePointerDown(e);
});

// Восстанавливает сохраненные усы на канве
function restoreSavedControls(activeIndex, activeHandle) {
    if (!savedControls || savedControls.length === 0) return;

    savedControls.forEach(saved => {
        const isCurrentChanged = (saved.index === activeIndex && saved.handle === activeHandle);
        if (isCurrentChanged) return;

        const exists = window.activePathHandles.some(
            h => h.index === saved.index && h.handle === saved.handle
        );
        if (!exists) {
            window.activePathHandles.push({ index: saved.index, handle: saved.handle, restored: true });
        }
    });
}

// Держим усы видимыми все время перетаскивания
function handleControlPointerMove(e) {
    if (!savedControls || savedControls.length === 0) return;

    // находим текущую активную (не восстановленную) ручку — именно ее сейчас тянут
    const activeHandle = window.activePathHandles.find(h => !h.restored);
    if (activeHandle) {
        restoreSavedControls(activeHandle.index, activeHandle.handle);
    }
}

// Функция клика после поднимания мышки на контрольной точке
function handleControlPointerUp(e) {
    if (window.activePathHandles && window.activePathHandles.length > 0) {
        // берем активную (не восстановленную) ручку, которую тянули
        const activeHandle = window.activePathHandles.find(h => !h.restored)
            || window.activePathHandles[window.activePathHandles.length - 1];

        if (activeHandle.handle.startsWith("control")) {
            // оставляем выделенным только сам активный ус
            window.activePathHandles = [
                { index: activeHandle.index, handle: activeHandle.handle }
            ];

            // возвращаем все остальные усы обратно на канву, но без выделения
            restoreSavedControls(activeHandle.index, activeHandle.handle);
        }
    }

    // Очищаем бэкап усов за собой
    savedControls = [];

    // Обновляем визуальное выделение с правильным флагом
    updateSelectionBox(false);
}

// вешаем обработчики на движение и поднятие мыши, чтобы усы не пропадали ни на одном из этапов
canvas.addEventListener("pointermove", handleControlPointerMove);
canvas.addEventListener("pointerup", handleControlPointerUp);



// === Передвежение по холсту ===

// Состояние трансформации канвы
svgCanvasTransform = { tx: 0, ty: 0, scale: 1 };

// Сброс трансформации при открытии блока
document.addEventListener("openSvgBlock", () => {
    svgCanvasTransform.tx = 0;
    svgCanvasTransform.ty = 0;
    svgCanvasTransform.scale = 1;
});

// Масштабирование канвы колесом мыши с Ctrl
function onCanvasWheelScale(e) {
    if (!e.ctrlKey) return;
    const svg = canvas.querySelector("svg");
    if (!svg) return;

    e.preventDefault();

    // Если трансформация канвы не была изменена
    if (svgCanvasTransform.tx === 0 && svgCanvasTransform.ty === 0 && svgCanvasTransform.scale === 1) {
        // Пытаемся считать текущую трансформацию из атрибута transform первого слоя 
        const layer = getContentLayer(svg) || getBorderLayer(svg);
        const match = layer?.getAttribute("transform")?.match(/translate\(([^,\s]+)[,\s]+([^)]+)\)/);
        if (match) {
            svgCanvasTransform.tx = parseFloat(match[1]);
            svgCanvasTransform.ty = parseFloat(match[2]);
        }
    }

    // Выбираем новый масштаб
    const delta = Math.sign(e.deltaY) * -0.1;
    const nextScale = Math.min(10, Math.max(0.1, svgCanvasTransform.scale * (1 + delta)));
    const point = getSvgPoint(e, svg);
    const prevScale = svgCanvasTransform.scale;
    const tx = svgCanvasTransform.tx;
    const ty = svgCanvasTransform.ty;
    const cx = point.x;
    const cy = point.y;

    // Выбираем новую трансформацию
    svgCanvasTransform.scale = nextScale;
    svgCanvasTransform.tx = cx - ((cx - tx) / prevScale) * nextScale;
    svgCanvasTransform.ty = cy - ((cy - ty) / prevScale) * nextScale;

    applySvgEditorCanvasTransform(svg);
    updateSelectionBox();
    
    // Принудительно обновляем позицию элемента под новым масштабом
    if (dragging && dragging.lastEvent) onPointerMoveEl(dragging.lastEvent);
    // Принудительно обновляем позицию узла path при зуме холста
    if (typeof pathResizing !== "undefined" && pathResizing && pathResizing.lastEvent) onPathHandleMove(pathResizing.lastEvent);
}

// Запрет контекстного меню при Ctrl + правая кнопка мыши для перемещения канвы
canvas.addEventListener("wheel", onCanvasWheelScale, { passive: false });
canvas.addEventListener("contextmenu", (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
    }
});

// Начало перемещения канвы по Ctrl + правая кнопка мыши
function startCanvasPanning(e, svg) {
    if (!e.ctrlKey || e.button !== 2 || !svg) return false;

    // Если трансформация канвы не была изменена
    if (svgCanvasTransform.tx === 0 && svgCanvasTransform.ty === 0 && svgCanvasTransform.scale === 1) {
        // Пытаемся считать текущую трансформацию из атрибута transform первого слоя
        const layer = getContentLayer(svg) || getBorderLayer(svg);
        const transformAttr = layer?.getAttribute("transform") || "";
        const tMatch = transformAttr.match(/translate\(([^,\s]+)[,\s]+([^)]+)\)/);
        const sMatch = transformAttr.match(/scale\(([^)]+)\)/);
        
        svgCanvasTransform.tx = tMatch ? parseFloat(tMatch[1]) : 0;
        svgCanvasTransform.ty = tMatch ? parseFloat(tMatch[2]) : 0;
        svgCanvasTransform.scale = sMatch ? parseFloat(sMatch[1]) : 1;
    }

    // Сохраняем состояние перемещения канвы
    canvasPanning = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTx: svgCanvasTransform.tx,
        startTy: svgCanvasTransform.ty,
        scale: svgCanvasTransform.scale
    };

    try {
        canvas.setPointerCapture(e.pointerId);
    } catch (err) {}

    return true;
}

// Обновление позиции канвы при перемещении мыши
function updateCanvasPanning(e) {
    if (!canvasPanning || e.pointerId !== canvasPanning.pointerId) return;
    e.preventDefault();

    // Вычисляем смещение
    const dx = e.clientX - canvasPanning.startX;
    const dy = e.clientY - canvasPanning.startY;

    // Обновляем трансформацию канвы
    svgCanvasTransform.tx = canvasPanning.startTx + dx;
    svgCanvasTransform.ty = canvasPanning.startTy + dy;

    const svg = canvas.querySelector("svg");
    if (svg) applySvgEditorCanvasTransform(svg);
    updateSelectionBox(true);
    
    // Принудительно обновляем позицию элемента при панорамировании холста
    if (dragging && dragging.lastEvent) onPointerMoveEl(dragging.lastEvent);
    // Принудительно обновляем позицию узла path при панорамировании холста
    if (typeof pathResizing !== "undefined" && pathResizing && pathResizing.lastEvent) onPathHandleMove(pathResizing.lastEvent);
}

// Завершение перемещения канвы
function stopCanvasPanning(e) {
    if (!canvasPanning || e.pointerId !== canvasPanning.pointerId) return;

    try {
        canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}

    canvasPanning = null;
}

// Применение текущей трансформации к канве
function applySvgEditorCanvasTransform(svg) {
    if (!svg) return;

    // Формируем строку трансформации для обоих слоев
    const transform = `translate(${svgCanvasTransform.tx} ${svgCanvasTransform.ty}) scale(${svgCanvasTransform.scale})`;
    const borderLayer = getBorderLayer(svg);
    const contentLayer = getContentLayer(svg);

    // Применяем трансформацию к обоим слоям
    if (borderLayer) borderLayer.setAttribute("transform", transform);
    if (contentLayer) contentLayer.setAttribute("transform", transform);
}

// Перемещение канвы с помощью колесика мыши
function onCanvasWheelMove(e) {
    const svg = canvas.querySelector("svg");
    if (!svg) return;

    e.preventDefault();

    // Если трансформация канвы еще не была подхвачена, считываем ее из атрибутов слоя
    if (svgCanvasTransform.tx === 0 && svgCanvasTransform.ty === 0) {
        const layer = getContentLayer(svg) || getBorderLayer(svg);
        const transformAttr = layer?.getAttribute("transform") || "";
        const tMatch = transformAttr.match(/translate\(([^,\s]+)[,\s]+([^)]+)\)/);
        const sMatch = transformAttr.match(/scale\(([^)]+)\)/);
        
        svgCanvasTransform.tx = tMatch ? parseFloat(tMatch[1]) : 0;
        svgCanvasTransform.ty = tMatch ? parseFloat(tMatch[2]) : 0;
        svgCanvasTransform.scale = sMatch ? parseFloat(sMatch[1]) : 1;
    }

    // Если shift зажат - вертикальная прокрутка, иначе если ctrl не зажат - горизонтальная
    if (e.shiftKey) {
        svgCanvasTransform.tx -= e.deltaY;
    } else if (!e.ctrlKey) {
        svgCanvasTransform.ty -= e.deltaY;
    }

    applySvgEditorCanvasTransform(svg);
    updateSelectionBox(true);
    
    // Принудительно обновляем позицию элемента при прокрутке холста колесиком
    if (dragging && dragging.lastEvent) onPointerMoveEl(dragging.lastEvent);
    // Принудительно обновляем позицию узла path при прокрутке холста колесиком
    if (typeof pathResizing !== "undefined" && pathResizing && pathResizing.lastEvent) onPathHandleMove(pathResizing.lastEvent);
}

// Добавляем обработчик колесика мыши для прокрутки канвы
canvas.addEventListener("wheel", onCanvasWheelMove);



// === Синхронизация между холстом и svg блоками ===

// Запись первого g и атрибутов svg в активный svg блок
function saveCanvasToActiveBlock() {
    const svg = canvas.querySelector("svg");
    const firstG = getContentLayer(svg);
    const storage = document.getElementById("svgStorage");
    const activeTab = document.querySelector("#tabs .svgTab.active");
    if (!svg || !firstG || !storage || !activeTab) return;

    const svgBlock = storage.querySelector(".svgBlock[data-num=\"" + activeTab.dataset.num + "\"]");
    const storageSvg = svgBlock?.querySelector("svg");
    if (!storageSvg) return;

    // НАДЕЖНЫЙ МЕТОД: Берем оригинальные размеры из самого storageSvg, а не из канвы
    const origW = storageSvg.getAttribute("width");
    const origH = storageSvg.getAttribute("height");

    // Принудительно удерживаем корректные размеры в хранилище
    storageSvg.setAttribute("width", origW);
    storageSvg.setAttribute("height", origH);
    storageSvg.setAttribute("viewBox", `0 0 ${origW} ${origH}`);

    // Очищаем старое содержимое в хранилище перед записью
    storageSvg.innerHTML = "";

    // Копируем только чистые фигуры из первого g (без текстовых узлов и без самого <g>)
    const elementsToSave = Array.from(firstG.cloneNode(true).children);
    storageSvg.append(...elementsToSave);
}

// Отслеживание изменения холста
const canvasObserver = new MutationObserver(() => {
    saveCanvasToActiveBlock()
})

function observeCanvasSvg() {
    const svg = canvas.querySelector("svg")
    if (!svg) return

    canvasObserver.disconnect()
    canvasObserver.observe(svg, {
        childList: true,
        attributes: true,
        subtree: true,
        characterData: true
    })
}

// Запускаем наблюдение за холстом
observeCanvasSvg()

// Добавляем обработчики для перемещения канвы
canvas.addEventListener("pointermove", updateCanvasPanning);
canvas.addEventListener("pointerup", stopCanvasPanning);
canvas.addEventListener("pointercancel", stopCanvasPanning);
canvas.addEventListener("lostpointercapture", stopCanvasPanning);



// === Выделение ===

// Флаг режима изменения размера
let resizing = false;

// Размер активной зоны (px)
const edgeSize = 4;
const cornerSize = 6;

// состояние лассо
let lassoActive = false
let lassoStart = null
let lassoRect = null
let lassoMoved = false

// состояние изменения размера выделения
let elementResizing = null
const selectionHandleSize = 8

// состояние редактирования path
let pathResizing = null
const pathNodeHandleSize = 8
const pathControlHandleSize = 6

// проверка на область изменения размера
function isResizeHandle(e, svg) {
    const rect = svg.getBoundingClientRect()

    // стороны
    const onLeft = e.clientX >= rect.left - edgeSize && e.clientX <= rect.left + edgeSize
    const onRight = e.clientX >= rect.right - edgeSize && e.clientX <= rect.right + edgeSize
    const onTop = e.clientY >= rect.top - edgeSize && e.clientY <= rect.top + edgeSize
    const onBottom = e.clientY >= rect.bottom - edgeSize && e.clientY <= rect.bottom + edgeSize

    // углы
    const onTL = Math.abs(e.clientX - rect.left) < cornerSize && Math.abs(e.clientY - rect.top) < cornerSize
    const onTR = Math.abs(e.clientX - rect.right) < cornerSize && Math.abs(e.clientY - rect.top) < cornerSize
    const onBL = Math.abs(e.clientX - rect.left) < cornerSize && Math.abs(e.clientY - rect.bottom) < cornerSize
    const onBR = Math.abs(e.clientX - rect.right) < cornerSize && Math.abs(e.clientY - rect.bottom) < cornerSize

    return onLeft || onRight || onTop || onBottom || onTL || onTR || onBL || onBR
}

// проверка на path
function isPathElement(el) {
    if (window.modeSvgEditor !== "nodeEdit") return false
    return !!el && el.tagName && el.tagName.toLowerCase() === "path"
}

// запуск лассо
function selectElements(e) {
    if (window.modeSvgEditor !== "selection" && window.modeSvgEditor !== "nodeEdit") return;
    const svg = canvas.querySelector("svg")
    const firstG = getContentLayer(svg)
    const techLayer = getOverlayLayer(svg)

    // если клик по квадрату изменения размера - лассо не запускается
    if (e.target.dataset && (e.target.dataset.resizeHandle || e.target.dataset.pathHandle)) return

    // если клик по элементу - лассо не запускается
    if (firstG.contains(e.target)) return

    // если клик по зоне изменения размера - лассо не запускается
    if (isResizeHandle(e, svg)) return

    // включаем режим лассо
    lassoActive = true

    // запоминаем стартовую точку
    lassoStart = { x: e.clientX, y: e.clientY }
    lassoMoved = false

    // очищаем текущее выделение, если Shift или Ctrl не зажаты
    if (!e.shiftKey && !e.ctrlKey) {
        window.selectedElementsSvg = []
        techLayer.innerHTML = ""
    }

    // создаем прямоугольник визуального выделения
    lassoRect = document.createElementNS("http://www.w3.org/2000/svg", "rect")

    // стиль серого выделения
    lassoRect.setAttribute("fill", "rgba(120,120,120,0.2)")
    lassoRect.setAttribute("stroke", "#999")
    lassoRect.setAttribute("stroke-dasharray", "4")

    // добавляем в слой
    techLayer.appendChild(lassoRect)

    canvas.addEventListener("pointermove", onLassoMove)
    canvas.addEventListener("pointerup", onLassoUp)
}

// движение мыши при активном лассо
function onLassoMove(e) {
    // если лассо не активно - ничего не делаем
    if (!lassoActive || !lassoRect) return

    lassoMoved = true
    const svg = canvas.querySelector("svg")
    const svgRect = svg.getBoundingClientRect()

    // вычисляем координаты прямоугольника
    const x = Math.min(lassoStart.x, e.clientX)
    const y = Math.min(lassoStart.y, e.clientY)
    const w = Math.abs(e.clientX - lassoStart.x)
    const h = Math.abs(e.clientY - lassoStart.y)

    // обновляем позицию рамки
    lassoRect.setAttribute("x", x - svgRect.left)
    lassoRect.setAttribute("y", y - svgRect.top)
    lassoRect.setAttribute("width", w)
    lassoRect.setAttribute("height", h)
}

// завершение лассо
function onLassoUp(e) {
    // если лассо не активно - выходим
    if (!lassoActive) return

    // убираем обработчики движения
    canvas.removeEventListener("pointermove", onLassoMove)
    canvas.removeEventListener("pointerup", onLassoUp)

    const svg = canvas.querySelector("svg")
    const firstG = getContentLayer(svg)
    const techLayer = getOverlayLayer(svg)

    // вычисляем границы выделения
    const x1 = Math.min(lassoStart.x, e.clientX)
    const y1 = Math.min(lassoStart.y, e.clientY)
    const x2 = Math.max(lassoStart.x, e.clientX)
    const y2 = Math.max(lassoStart.y, e.clientY)

    const elements = firstG.children

    // если не было реального перемещения - не выбираем элементы (выбирать будет selectElement)
    if (!lassoMoved) {
        if (lassoRect && lassoRect.parentNode) {
            lassoRect.parentNode.removeChild(lassoRect)
        }
        lassoActive = false
        lassoStart = null
        lassoRect = null
        return
    }

    // добавляем новые элементы в существующий массив
    if (!window.selectedElementsSvg) {
        window.selectedElementsSvg = []
    }

    for (const el of elements) {
        const bbox = el.getBoundingClientRect()

        // если элемент хотя бы немного пересекается с рамкой
        const intersects = !(bbox.right < x1 || bbox.left > x2 || bbox.bottom < y1 || bbox.top > y2)
        if (!intersects) continue

        if (e.shiftKey) {
            toggleSelection(el)
        } else if (!window.selectedElementsSvg.includes(el)) {
            window.selectedElementsSvg.push(el)
        }
    }

    // очищаем визуальный слой
    techLayer.innerHTML = ""

    // обновляем рамку если есть что выделено
    if (window.selectedElementsSvg.length) {
        updateSelectionBox()
    }

    // сброс состояния лассо
    lassoActive = false
    lassoStart = null
    lassoRect = null
}

// Переключение выделения элемента
function toggleSelection(el) {
    if (!Array.isArray(window.selectedElementsSvg)) {
        window.selectedElementsSvg = []
    }

    // если элемент уже выделен - убираем его из выделения, иначе добавляем
    const index = window.selectedElementsSvg.indexOf(el)
    if (index >= 0) {
        window.selectedElementsSvg.splice(index, 1)
    } else {
        window.selectedElementsSvg.push(el)
    }
}

// Получение максимально верхнего прямого ребенка firstG
function getTopLevelElement(el) {
    const svg = canvas.querySelector("svg");
    if (!svg) return el;
    
    const firstG = getContentLayer(svg);
    if (!firstG) return el;
    
    // если это уже прямой ребенок firstG - возвращаем его
    if (el.parentNode === firstG) return el;
    
    // проходим вверх по родителям пока не найдем прямого ребенка firstG
    let current = el;
    while (current && current.parentNode !== firstG) {
        current = current.parentNode;
    }
    
    return current || el;
}

// Выделение элемента
function selectElement(el, append = false) {
    // находим максимально верхний прямой ребенок firstG
    const topEl = getTopLevelElement(el);
    
    // Гарантируем, что массив активных ручек существует
    if (!Array.isArray(window.activePathHandles)) {
        window.activePathHandles = [];
    }
    
    // если Shift или Ctrl зажаты - переключаем выделение для элемента
    if (append) {
        toggleSelection(topEl);
        updateSelectionBox();
        return;
    }

    // если элемент уже в выбранных — не сбрасываем выделение
    if (Array.isArray(window.selectedElementsSvg) && window.selectedElementsSvg.includes(topEl)) {
        updateSelectionBox();
        return;
    }

    // Выделяем новый элемент и полностью очищаем выбранные ранее узлы пути
    window.selectedElementsSvg = [topEl];
    window.activePathHandles = []; 
    
    updateSelectionBox();
}

// Обновление рамки выделения
function updateSelectionBox(restoreHandlesFlags = false) {
    // если нет выделения - очищаем технический слой и выходим
    if (!window.selectedElementsSvg || (Array.isArray(window.selectedElementsSvg) && window.selectedElementsSvg.length === 0)) {
        window.lastActiveEdgeIndex = null; 
        window.activePathHandles = []; // Очищаем массив ручек при потере выделения контура
        const svg = canvas.querySelector("svg");
        if (svg) {
            const techLayer = getOverlayLayer(svg);
            if (techLayer) techLayer.innerHTML = "";
        }

        document.dispatchEvent(new CustomEvent("svgSelectionChanged", {
            detail: { selectedElements: [] }
        }));
        return;
    }

    const svg = canvas.querySelector("svg");
    const techLayer = getOverlayLayer(svg);

    techLayer.innerHTML = "";

    const elements = Array.isArray(window.selectedElementsSvg) ? window.selectedElementsSvg : [window.selectedElementsSvg];

    // если выделен один path - показываем узлы и контрольные точки
    if (elements.length === 1 && isPathElement(elements[0])) {
        addPathSelectionHandles(elements[0], techLayer);

        // Активные узлы
        if (Array.isArray(window.activePathHandles)) {
            window.activePathHandles.forEach(h => {
                if (!h) return;
                const foundHandle = techLayer.querySelector(
                    `[data-path-index="${h.index}"][data-path-handle="${h.handle}"]`
                );

                if (foundHandle) {
                    if (h.restored) {
                        foundHandle.dataset.active = "0";
                        return; 
                    }

                    foundHandle.dataset.active = "1";
                    foundHandle.setAttribute("fill", "#4285f4");
                }
            });
        }

        // Если есть сохраненное измененное ребро, красим 2 узла
        if (window.lastActiveEdgeIndex !== null) {
            highlightEdgeNodes(svg, window.lastActiveEdgeIndex);
        }

        document.dispatchEvent(new CustomEvent("svgSelectionChanged", {
            detail: { selectedElements: elements.slice() }
        }));
        return;
    }

    // Если выделено несколько элементов, сбрасываем подсветку ребер и массив ручек
    window.lastActiveEdgeIndex = null;
    window.activePathHandles = [];

    const selectionBox = getSelectionBBox(elements);

    for (const el of elements) {
        const bbox = getTransformedBBox(el);
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");

        const width = Math.max(1, bbox.width);
        const height = Math.max(1, bbox.height);

        rect.setAttribute("x", bbox.x);
        rect.setAttribute("y", bbox.y);
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);

        rect.setAttribute("fill", "none");
        rect.setAttribute("stroke", "#4285f4");
        rect.setAttribute("stroke-width", "1");
        rect.setAttribute("pointer-events", "none");

        techLayer.appendChild(rect);
    }

    if (selectionBox) {
        addSelectionHandles(selectionBox, techLayer);
    }

    document.dispatchEvent(new CustomEvent("svgSelectionChanged", {
        detail: { selectedElements: Array.isArray(window.selectedElementsSvg) ? window.selectedElementsSvg.slice() : [window.selectedElementsSvg] }
    }));
}

// Обновление выделения при изменении элементов из rightPanel
document.addEventListener("svgElementsChanged", () => {
    updateSelectionBox(true);
});

// Получение общей рамки выделения
function getSelectionBBox(elements, groupInverse) {
    // Инициализируем координаты рамки бесконечностями для корректного сравнения
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;

    // Проходим по всем элементам и вычисляем общую рамку, учитывая трансформации
    for (const el of elements) {
        const bbox = getTransformedBBox(el, groupInverse);

        x1 = Math.min(x1, bbox.x);
        y1 = Math.min(y1, bbox.y);
        x2 = Math.max(x2, bbox.x + bbox.width);
        y2 = Math.max(y2, bbox.y + bbox.height);
    }

    if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return null;

    return {
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1
    };
}

// Добавление квадратов изменения размера
function addSelectionHandles(bbox, techLayer) {
    const x = bbox.x;
    const y = bbox.y;
    const w = bbox.width;
    const h = bbox.height;
    const s = selectionHandleSize;

    // 8 точек: по углам и по центру каждой стороны
    const handles = [
        { name: "tl", x, y, cursor: "nwse-resize" },
        { name: "tm", x: x + w / 2, y, cursor: "ns-resize" },
        { name: "tr", x: x + w, y, cursor: "nesw-resize" },
        { name: "mr", x: x + w, y: y + h / 2, cursor: "ew-resize" },
        { name: "br", x: x + w, y: y + h, cursor: "nwse-resize" },
        { name: "bm", x: x + w / 2, y: y + h, cursor: "ns-resize" },
        { name: "bl", x, y: y + h, cursor: "nesw-resize" },
        { name: "ml", x, y: y + h / 2, cursor: "ew-resize" }
    ];

    // Создаем и добавляем квадраты для каждой точки
    for (const item of handles) {
        const handle = document.createElementNS("http://www.w3.org/2000/svg", "rect");

        handle.setAttribute("x", item.x - s / 2);
        handle.setAttribute("y", item.y - s / 2);
        handle.setAttribute("width", s);
        handle.setAttribute("height", s);
        handle.setAttribute("fill", "#ffffff");
        handle.setAttribute("stroke", "#4285f4");
        handle.setAttribute("stroke-width", "1");
        handle.setAttribute("pointer-events", "all");
        handle.dataset.resizeHandle = item.name;
        handle.style.cursor = item.cursor;

        techLayer.appendChild(handle);
    }
}

// Получение координат и размеров элемента с учетом трансформаций
function getTransformedBBox(el, groupInverse) {
    const svg = canvas.querySelector("svg");
    const bbox = el.getBBox();
    const ctm = el.getCTM();
    if (!ctm) return bbox;

    // Преобразуем углы рамки элемента с помощью матрицы трансформации
    const p1 = svg.createSVGPoint();
    p1.x = bbox.x; p1.y = bbox.y;
    const p2 = svg.createSVGPoint();
    p2.x = bbox.x + bbox.width; p2.y = bbox.y + bbox.height;

    // Применяем матрицу трансформации к углам
    let t1 = p1.matrixTransform(ctm);
    let t2 = p2.matrixTransform(ctm);

    if (groupInverse) {
        t1 = t1.matrixTransform(groupInverse);
        t2 = t2.matrixTransform(groupInverse);
    }

    return {
        x: Math.min(t1.x, t2.x),
        y: Math.min(t1.y, t2.y),
        width: Math.abs(t2.x - t1.x),
        height: Math.abs(t2.y - t1.y)
    };
}

// Получение точки мыши в координатах svg
function getSvgPoint(e, svg) {
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;

    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: e.clientX, y: e.clientY };

    return point.matrixTransform(matrix.inverse());
}



// === Отрисовка узлов path ===

// Добавление узлов и контрольных точек path
function addPathSelectionHandles(pathEl, techLayer) {
    const svg = canvas.querySelector("svg");
    if (!svg) return;

    // Получаем данные path
    const d = pathEl.getAttribute("d") || "";
    const segments = parsePathData(d);

    // Размеры узлов и контрольных точек
    const s = pathNodeHandleSize;
    const c = pathControlHandleSize;

    // Матрица трансформации path с учётом всех родительских transform
    const ctm = pathEl.getCTM();

    // Преобразование координат path в координаты SVG
    function toScreen(x, y) {
        if (!ctm) return { x, y };

        const p = svg.createSVGPoint();
        p.x = x;
        p.y = y;

        return p.matrixTransform(ctm);
    }

    // собираем отдельно активные типы ручек по их индексам для точной проверки
    const activeNodes = new Set();
    const activeControl1 = new Set();
    const activeControl2 = new Set();

    if (window.activePathHandles) {
        for (const h of window.activePathHandles) {
            if (h.handle === "node") activeNodes.add(h.index);
            if (h.handle === "control1") activeControl1.add(h.index);
            if (h.handle === "control2") activeControl2.add(h.index);
        }
    }

    // если выбрано ребро подсвечиваем его узлы
    if (window.lastActiveEdgeIndex !== null) {
        activeNodes.add(window.lastActiveEdgeIndex);
        activeNodes.add(window.lastActiveEdgeIndex - 1);
    }

    // Начальная точка текущего контура
    let subpathStart = null;

    // Предыдущая узловая точка
    let prevPoint = null;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        let currentEnd = null;

        // Начало нового контура
        if (seg.type === "M") {
            const p = toScreen(seg.x, seg.y);

            subpathStart = p;
            prevPoint = p;

            addPathNodeHandle(p.x, p.y, i, "node", techLayer, s);
            continue;
        }

        // Конечная точка линии, кривой или дуги
        if (["L", "Q", "C", "A"].includes(seg.type)) {
            const p = toScreen(seg.x, seg.y);
            addPathNodeHandle(p.x, p.y, i, "node", techLayer, s);
            currentEnd = p;
        }

        // Если предыдущая точка отсутствует, используем начало контура
        if (!prevPoint && subpathStart) {
            prevPoint = subpathStart;
        }

        // Квадратичная кривая Безье
        if (seg.type === "Q") {
            // рисуем ус если активен предыдущий узел, текущий узел или сам контроллер уса
            if (activeNodes.has(i - 1) || activeNodes.has(i) || activeControl1.has(i)) {
                const c1 = toScreen(seg.x1, seg.y1);
                addPathGuideLine(prevPoint.x, prevPoint.y, c1.x, c1.y, techLayer);
                addPathControlHandle(c1.x, c1.y, i, "control1", techLayer, c);
            }
        }

        // Кубическая кривая Безье
        if (seg.type === "C") {
            // первый ус: рисуем если выделен предыдущий синий узел или сам этот первый ус
            if (activeNodes.has(i - 1) || activeControl1.has(i)) {
                const c1 = toScreen(seg.x1, seg.y1);
                addPathGuideLine(prevPoint.x, prevPoint.y, c1.x, c1.y, techLayer);
                addPathControlHandle(c1.x, c1.y, i, "control1", techLayer, c);
            }

            // второй ус: рисуем если выделен текущий синий узел или сам этот второй ус
            if (activeNodes.has(i) || activeControl2.has(i)) {
                const c2 = toScreen(seg.x2, seg.y2);
                addPathGuideLine(currentEnd.x, currentEnd.y, c2.x, c2.y, techLayer);
                addPathControlHandle(c2.x, c2.y, i, "control2", techLayer, c);
            }
        }

        // Замыкание контура
        if (seg.type === "Z") {
            prevPoint = subpathStart || prevPoint;
        } else if (currentEnd) {
            // обновляем предыдущую точку для следующего шага цикла
            prevPoint = currentEnd;
        }
    }
}

// линия между узлом и контрольной точкой
function addPathGuideLine(x1, y1, x2, y2, techLayer) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", "#4285f4");
    line.setAttribute("stroke-width", "1");
    line.setAttribute("stroke-dasharray", "3 3");
    line.setAttribute("pointer-events", "none");

    techLayer.appendChild(line);
}

// квадрат узла path
function addPathNodeHandle(x, y, index, part, techLayer, size = pathNodeHandleSize) {
    const handle = document.createElementNS("http://www.w3.org/2000/svg", "rect");

    handle.setAttribute("x", x - size / 2);
    handle.setAttribute("y", y - size / 2);
    handle.setAttribute("width", size);
    handle.setAttribute("height", size);
    handle.setAttribute("fill", "#ffffff");
    handle.setAttribute("stroke", "#4285f4");
    handle.setAttribute("stroke-width", "1");
    handle.setAttribute("pointer-events", "all");
    handle.dataset.pathHandle = part;
    handle.dataset.pathIndex = index;
    handle.style.cursor = "move";

    techLayer.appendChild(handle);
}

// квадрат контрольной точки path
function addPathControlHandle(x, y, index, part, techLayer, size = pathControlHandleSize) {
    const handle = document.createElementNS("http://www.w3.org/2000/svg", "rect");

    handle.setAttribute("x", x - size / 2);
    handle.setAttribute("y", y - size / 2);
    handle.setAttribute("width", size);
    handle.setAttribute("height", size);
    handle.setAttribute("fill", "#ffffff");
    handle.setAttribute("stroke", "#ff9800");
    handle.setAttribute("stroke-width", "1");
    handle.setAttribute("pointer-events", "all");
    handle.dataset.pathHandle = part;
    handle.dataset.pathIndex = index;
    handle.style.cursor = "move";

    techLayer.appendChild(handle);
}



// === Изменение узлов path ===

// начало изменения точки path
function startPathHandleMove(e, handle) {
    if (window.modeSvgEditor !== "nodeEdit") return;

    const svg = canvas.querySelector("svg");
    if (!svg) return;

    const selected = Array.isArray(window.selectedElementsSvg) ? window.selectedElementsSvg[0] : window.selectedElementsSvg;
    if (!selected || !isPathElement(selected)) return;

    const group = getContentLayer(svg);
    const groupInverse = group?.getCTM()?.inverse() || null;
    const segments = parsePathData(selected.getAttribute("d") || "");
    const point = getSvgPoint(e, svg);
    const localPoint = groupInverse ? point.matrixTransform(groupInverse) : point;
    const index = parseInt(handle.dataset.pathIndex, 10);
    const part = handle.dataset.pathHandle;

    if (isNaN(index) || !segments[index]) return;

    // глобальная переменная активной ручки обновляется для обратной совместимости
    activePathHandle = handle;

    pathResizing = {
        pointerId: e.pointerId,
        handle: part,
        segmentIndex: index,
        startPoint: localPoint,
        startSegments: segments.map((seg) => ({ ...seg })),
        pathEl: selected,
        groupInverse,
        lastEvent: e 
    };

    e.preventDefault();
    e.stopImmediatePropagation();

    try {
        canvas.setPointerCapture(e.pointerId);
    } catch (err) {}

    canvas.addEventListener("pointermove", onPathHandleMove);
    canvas.addEventListener("pointerup", onPathHandleUp);
    canvas.addEventListener("pointercancel", onPathHandleUp);
    canvas.addEventListener("lostpointercapture", onPathHandleUp);
}

// изменение точки path
function onPathHandleMove(e) {
    if (!pathResizing || e.pointerId !== pathResizing.pointerId) return;

    const svg = canvas.querySelector("svg");
    if (!svg) return;

    e.preventDefault();
    pathResizing.lastEvent = e; 

    const point = getSvgPoint(e, svg);

    // вычисляем инверсию матрицы динамически чтобы узел не улетал при прокрутке колесиком мыши
    const group = getContentLayer(svg);
    const currentInverse = group?.getCTM()?.inverse() || null;
    const localPoint = currentInverse ? point.matrixTransform(currentInverse) : point;

    const dx = localPoint.x - pathResizing.startPoint.x;
    const dy = localPoint.y - pathResizing.startPoint.y;

    const segments = pathResizing.startSegments.map((seg) => ({ ...seg }));
    const seg = segments[pathResizing.segmentIndex];

    if (!seg) return;

    // определяем стартовые координаты ручки
    let startX = 0, startY = 0;
    if (pathResizing.handle === "node") {
        startX = pathResizing.startSegments[pathResizing.segmentIndex].x;
        startY = pathResizing.startSegments[pathResizing.segmentIndex].y;
    } else if (pathResizing.handle === "control1") {
        startX = pathResizing.startSegments[pathResizing.segmentIndex].x1;
        startY = pathResizing.startSegments[pathResizing.segmentIndex].y1;
    } else if (pathResizing.handle === "control2") {
        startX = pathResizing.startSegments[pathResizing.segmentIndex].x2;
        startY = pathResizing.startSegments[pathResizing.segmentIndex].y2;
    }

    // теоретические новые координаты за мышкой
    let targetX = startX + dx;
    let targetY = startY + dy;

    // прилипание
    let snapX = targetX;
    let snapY = targetY;
    let bestDist = Infinity;
    const snapDistance = 1;
    let isMutated = false; 

    // прилипание
    if (pathResizing.handle === "control1" || pathResizing.handle === "control2") {
        let ownX = null, ownY = null;
        
        if (pathResizing.handle === "control1") {
            const prevSeg = pathResizing.segmentIndex > 0 ? segments[pathResizing.segmentIndex - 1] : segments[0];
            if (prevSeg) { ownX = prevSeg.x; ownY = prevSeg.y; }
        } else if (pathResizing.handle === "control2") {
            ownX = seg.x; ownY = seg.y;
        }
    }

    // если со своим узлом не слиплись проверяем прилипание к остальным точкам на сцене
    if (bestDist === Infinity) {
        if (group) {
            const paths = group.querySelectorAll("path");
            for (const p of paths) {
                const pSegs = parsePathData(p.getAttribute("d") || "");
                
                for (let i = 0; i < pSegs.length; i++) {
                    const s = pSegs[i];
                    
                    const checkSnap = (px, py, isNode, isCtrl1, isCtrl2) => {
                        if (typeof px !== "number" || typeof py !== "number") return;
                        
                        if (p === pathResizing.pathEl && i === pathResizing.segmentIndex) {
                            if (pathResizing.handle === "node" && isNode) return;
                            if (pathResizing.handle === "control1" && isCtrl1) return;
                            if (pathResizing.handle === "control2" && isCtrl2) return;
                        }

                        const dist = Math.sqrt((targetX - px) ** 2 + (targetY - py) ** 2);
                        if (dist < bestDist && dist <= snapDistance) {
                            bestDist = dist;
                            snapX = px;
                            snapY = py;
                        }
                    };

                    checkSnap(s.x, s.y, true, false, false);
                    checkSnap(s.x1, s.y1, false, true, false);
                    checkSnap(s.x2, s.y2, false, false, true);
                }
            }
        }
    }

    // применяем новые координаты только если сегмент не изменил тип
    if (!isMutated) {
        if (pathResizing.handle === "node") {
            seg.x = snapX;
            seg.y = snapY;
        } else if (pathResizing.handle === "control1" && (seg.type === "Q" || seg.type === "C")) {
            seg.x1 = snapX;
            seg.y1 = snapY;
        } else if (pathResizing.handle === "control2" && seg.type === "C") {
            seg.x2 = snapX;
            seg.y2 = snapY;
        }
    }

    pathResizing.pathEl.setAttribute("d", serializePathData(segments));
    
    // вызываем с true чтобы сохранить подсветку всех выделенных узлов при перерисовке
    updateSelectionBox(true);
}

// завершение изменения точки path
function onPathHandleUp(e) {
    if (!pathResizing || e.pointerId !== pathResizing.pointerId) return;

    try {
        canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}

    canvas.removeEventListener("pointermove", onPathHandleMove);
    canvas.removeEventListener("pointerup", onPathHandleUp);
    canvas.removeEventListener("pointercancel", onPathHandleUp);
    canvas.removeEventListener("lostpointercapture", onPathHandleUp);

    // вызываем с true чтобы не сбросились цвета узлов
    updateSelectionBox(true);

    pathResizing = null;
}



// === Создание узла path ===

// Получение точки на кубической кривой Безье (C / c)
function getCubicBezierPoint(t, p0, p1, p2, p3) {
    const mt = 1 - t;
    return {
        x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
        y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
    };
}

// Получение точки на квадратичной кривой Безье (Q / q)
function getQuadraticBezierPoint(t, p0, p1, p2) {
    const mt = 1 - t;
    return {
        x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
        y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
    };
}

// Ищет расстояние до микро-сегмента и возвращает локальный t проекции
function getClosestTOnSegment(p, v, w) {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 === 0) return { dist: (p.x - v.x) ** 2 + (p.y - v.y) ** 2, t: 0 };
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const closestX = v.x + t * (w.x - v.x);
    const closestY = v.y + t * (w.y - v.y);
    return {
        dist: (p.x - closestX) ** 2 + (p.y - closestY) ** 2,
        t: t
    };
}

// Высчитоваем нужный сегмент (для обычных линий L)
function distToSegmentSquared(p, v, w) {
    return getClosestTOnSegment(p, v, w).dist;
}

// таймер
let lastPathDblClickTime = 0;
let lastPathDblClickTarget = null;
let pathDoubleClickReady = false;
let pathDoubleClickEvent = null;

// создание узла по двойному клику на path
function onPathDoubleClick(e) {
    if (window.modeSvgEditor !== "nodeEdit") return;

    const now = performance.now();

    // защита от ложных двойных нажатий / дублей событий
    if (now - lastPathDblClickTime <= 500 && lastPathDblClickTarget === e.target) {
        pathDoubleClickReady = true;
        pathDoubleClickEvent = e;
        return;
    }

    lastPathDblClickTime = now;
    lastPathDblClickTarget = e.target;
}

// создание узла после отпускания второй кнопки
function onPathDoubleClickUp() {
    if (!pathDoubleClickReady) return;

    const now = performance.now();

    // защита, если после первого клика прошло слишком много времени
    if (now - lastPathDblClickTime > 500) {
        pathDoubleClickReady = false;
        pathDoubleClickEvent = null;
        return;
    }

    pathDoubleClickReady = false;

    const e = pathDoubleClickEvent;
    pathDoubleClickEvent = null;

    const svg = canvas.querySelector("svg");
    if (!svg) return;

    const group = getContentLayer(svg);
    if (!group) return;

    const pathEl = e.target;

    // только элементы внутри content layer
    if (!group.contains(pathEl)) return;
    if (!isPathElement(pathEl)) return;

    // защита от повторного срабатывания на другом target
    if (lastPathDblClickTarget !== pathEl) return;

    const groupInverse = group.getCTM()?.inverse() || null;

    const point = getSvgPoint(e, svg);
    const localPoint = groupInverse
        ? point.matrixTransform(groupInverse)
        : point;

    const segments = parsePathData(pathEl.getAttribute("d") || "");

    let bestIndex = -1;
    let bestDist = Infinity;
    let bestT = 0;
    const steps = 20; 

    for (let i = 1; i < segments.length; i++) {
        const a = segments[i - 1];
        const b = segments[i];

        if (typeof a.x !== "number" || typeof a.y !== "number") continue;
        if (typeof b.x !== "number" || typeof b.y !== "number") continue;

        let dist = Infinity;
        let matchedT = 0;

        // Если сегмент — кубическая кривая (C / c)
        if (b.type === "C" || b.type === "c") {
            let prevPt = { x: a.x, y: a.y };
            for (let j = 1; j <= steps; j++) {
                const tPrev = (j - 1) / steps;
                const tCurr = j / steps;
                const p1 = { x: b.x1, y: b.y1 };
                const p2 = { x: b.x2, y: b.y2 };
                const currPt = getCubicBezierPoint(tCurr, a, p1, p2, b);
                
                const res = getClosestTOnSegment(localPoint, prevPt, currPt);
                if (res.dist < dist) {
                    dist = res.dist;
                    matchedT = tPrev + res.t * (tCurr - tPrev); // Вычисляем сквозной t кривой
                }
                prevPt = currPt;
            }
        // Если сегмент — квадратичная кривая (Q / q)
        } else if (b.type === "Q" || b.type === "q") {
            let prevPt = { x: a.x, y: a.y };
            for (let j = 1; j <= steps; j++) {
                const tPrev = (j - 1) / steps;
                const tCurr = j / steps;
                const p1 = { x: b.x1, y: b.y1 };
                const currPt = getQuadraticBezierPoint(tCurr, a, p1, b);
                
                const res = getClosestTOnSegment(localPoint, prevPt, currPt);
                if (res.dist < dist) {
                    dist = res.dist;
                    matchedT = tPrev + res.t * (tCurr - tPrev);
                }
                prevPt = currPt;
            }
        // Обычная прямая линия
        } else {
            dist = distToSegmentSquared(localPoint, a, b);
        }

        if (dist < bestDist) {
            bestDist = dist;
            bestIndex = i;
            bestT = matchedT;
        }
    }

    if (bestIndex < 0) return;

    const b = segments[bestIndex];

    // Умное разделение сегмента в зависимости от его типа
    if (b.type === "C" || b.type === "c") {
        const a = segments[bestIndex - 1];
        const mt = 1 - bestT;
        const p1 = { x: b.x1, y: b.y1 };
        const p2 = { x: b.x2, y: b.y2 };

        // Алгоритм де Кастельжо для кубического Безье
        const ax = mt * a.x + bestT * p1.x;
        const ay = mt * a.y + bestT * p1.y;
        const bx = mt * p1.x + bestT * p2.x;
        const by = mt * p1.y + bestT * p2.y;
        const cx = mt * p2.x + bestT * b.x;
        const cy = mt * p2.y + bestT * b.y;

        const dx = mt * ax + bestT * bx;
        const dy = mt * ay + bestT * by;
        const ex = mt * bx + bestT * cx;
        const ey = mt * by + bestT * cy;

        const fx = mt * dx + bestT * ex;
        const fy = mt * dy + bestT * ey;

        // Заменяем одну старую кривую на две новые, идеально повторяющие форму
        segments.splice(bestIndex, 1, 
            { type: b.type, x1: ax, y1: ay, x2: dx, y2: dy, x: fx, y: fy },
            { type: b.type, x1: ex, y1: ey, x2: cx, y2: cy, x: b.x, y: b.y }
        );

    } else if (b.type === "Q" || b.type === "q") {
        const a = segments[bestIndex - 1];
        const mt = 1 - bestT;
        const p1 = { x: b.x1, y: b.y1 };

        // Алгоритм де Кастельжо для квадратичного Безье
        const ax = mt * a.x + bestT * p1.x;
        const ay = mt * a.y + bestT * p1.y;
        const bx = mt * p1.x + bestT * b.x;
        const by = mt * p1.y + bestT * b.y;

        const fx = mt * ax + bestT * bx;
        const fy = mt * ay + bestT * by;

        segments.splice(bestIndex, 1, 
            { type: b.type, x1: ax, y1: ay, x: fx, y: fy },
            { type: b.type, x1: bx, y1: by, x: b.x, y: b.y }
        );

    } else {
        // Если это прямая линия (L), просто вставляем точку как раньше
        segments.splice(bestIndex, 0, {
            type: "L",
            x: localPoint.x,
            y: localPoint.y
        });
    }

    pathEl.setAttribute("d", serializePathData(segments));
    updateSelectionBox();

    e.preventDefault();
    e.stopPropagation();
}

// обработчик
canvas.addEventListener("pointerdown", onPathDoubleClick);
canvas.addEventListener("pointerup", onPathDoubleClickUp);



// === искривление ребра ===

let edgeDragState = null;

// точная конвертация координат экрана в локальные координаты элемента
function getLocalPoint(e, svg, element) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(element.getScreenCTM().inverse());
}

// Выделение строго двух узлов, образующих текущее ребро
function highlightEdgeNodes(svg, index) {
    if (index === null || index === undefined || index < 1) return;
    
    const techLayer = getOverlayLayer(svg);
    if (!techLayer) return;
    
    const n1 = techLayer.querySelector(`[data-path-index="${index - 1}"][data-path-handle="node"]`);
    const n2 = techLayer.querySelector(`[data-path-index="${index}"][data-path-handle="node"]`);
    
    if (n1) {
        n1.setAttribute("fill", "#4285f4");
        n1.dataset.active = "1";
    }
    if (n2) {
        n2.setAttribute("fill", "#4285f4");
        n2.dataset.active = "1";
    }
}

// начало перетягивания ребра
function onEdgePointerDown(e) {
    if (window.modeSvgEditor !== "nodeEdit") {
        window.lastActiveEdgeIndex = null; 
        return;
    }

    const svg = canvas.querySelector("svg");
    if (!svg) return;

    const pathEl = e.target;
    
    // клик мимо path — сброс ребра
    if (!isPathElement(pathEl)) {
        if (!e.shiftKey) window.lastActiveEdgeIndex = null;
        updateSelectionBox();
        return;
    }

    // в локальные координаты path
    const localPoint = getLocalPoint(e, svg, pathEl);
    const segments = parsePathData(pathEl.getAttribute("d") || "");
    
    let index = -1;
    let bestDist = Infinity;
    let t = 0.5;

    // первая точка для ребер Z
    const firstM = segments.find(s => s.type.toUpperCase() === "M") || { x: 0, y: 0 };

    // временные переменные для хранения найденных координат конца ребра
    let finalBx = 0;
    let finalBy = 0;

    // поиск ближайшего ребра
    for (let i = 1; i < segments.length; i++) {
        const a = segments[i - 1];
        const b = segments[i];

        if (!a || !b) continue;
        
        if (typeof a.x !== "number" || typeof a.y !== "number") continue;

        // координаты конца ребра (с учетом Z)
        let bx, by;
        const isZ = b.type.toUpperCase() === "Z";

        if (isZ) {
            bx = typeof b._backupX === "number" ? b._backupX : firstM.x;
            by = typeof b._backupY === "number" ? b._backupY : firstM.y;
        } else {
            if (typeof b.x !== "number" || typeof b.y !== "number") continue;
            bx = b.x;
            by = b.y;
        }

        for (let k = 0; k <= 20; k++) {
            const sampleT = k / 20;
            let sx, sy;

            if (b.type.toUpperCase() === "Q") {
                const mt = 1 - sampleT;
                sx = mt * mt * a.x + 2 * mt * sampleT * b.x1 + sampleT * sampleT * bx;
                sy = mt * mt * a.y + 2 * mt * sampleT * b.y1 + sampleT * sampleT * by;
            } else if (b.type.toUpperCase() === "C") {
                const mt = 1 - sampleT;
                sx = mt * mt * mt * a.x + 3 * mt * mt * sampleT * b.x1 + 3 * mt * sampleT * sampleT * b.x2 + sampleT * sampleT * sampleT * bx;
                sy = mt * mt * mt * a.y + 3 * mt * mt * sampleT * b.y1 + 3 * mt * sampleT * sampleT * b.y2 + sampleT * sampleT * sampleT * by;
            } else {
                sx = a.x + (bx - a.x) * sampleT;
                sy = a.y + (by - a.y) * sampleT;
            }

            const dist = (localPoint.x - sx) ** 2 + (localPoint.y - sy) ** 2;

            if (dist < bestDist) {
                bestDist = dist;
                index = i;
                t = sampleT;
                finalBx = bx; 
                finalBy = by;
            }
        }
    }

    // мимо ребра — сброс подсветки
    if (index < 1 || bestDist > 1600) {
        if (!e.shiftKey) window.lastActiveEdgeIndex = null;
        updateSelectionBox();
        return;
    }

    // фиксируем ребро
    window.lastActiveEdgeIndex = index;

    if (e.shiftKey) {
        // если shift зажат — подмешиваем узлы текущего ребра к уже выделенным ручкам
        if (!window.activePathHandles.some(h => h.index === index - 1 && h.handle === "node")) {
            window.activePathHandles.push({ index: index - 1, handle: "node" });
        }
        if (!window.activePathHandles.some(h => h.index === index && h.handle === "node")) {
            window.activePathHandles.push({ index: index, handle: "node" });
        }
    } else {
        // без shift — сброс старых ручек
        window.activePathHandles = [];
    }

    // подготавливаем сегменты для drag-состояния, заменяя пустые x/y у Z на начальные
    const dragSegments = segments.map((s, idx) => {
        const copy = { ...s };
        if (idx === index && copy.type.toUpperCase() === "Z") {
            copy.x = finalBx;
            copy.y = finalBy;
        }
        return copy;
    });

    edgeDragState = {
        pointerId: e.pointerId,
        pathEl,
        svg,
        index,
        startPoint: localPoint,
        startSegments: dragSegments,
        t
    };

    e.preventDefault();
    e.stopPropagation();

    canvas.setPointerCapture(e.pointerId);

    // красим строго 2 узла ребра
    updateSelectionBox();

    canvas.addEventListener("pointermove", onEdgePointerMove);
    canvas.addEventListener("pointerup", onEdgePointerUp);
    canvas.addEventListener("pointercancel", onEdgePointerUp);
}

// движение ребра
function onEdgePointerMove(e) {
    if (!edgeDragState || e.pointerId !== edgeDragState.pointerId) return;

    e.preventDefault();

    const localPoint = getLocalPoint(e, edgeDragState.svg, edgeDragState.pathEl);
    const segments = edgeDragState.startSegments.map(s => ({ ...s }));
    const i = edgeDragState.index;

    const a = segments[i - 1];
    const b = segments[i];

    if (!a || !b) return;

    const dx = localPoint.x - edgeDragState.startPoint.x;
    const dy = localPoint.y - edgeDragState.startPoint.y;

    let cx1, cy1, cx2, cy2;

    if (b.type === "C") {
        cx1 = b.x1; cy1 = b.y1; cx2 = b.x2; cy2 = b.y2;
    } else if (b.type === "Q") {
        cx1 = a.x + (2 / 3) * (b.x1 - a.x);
        cy1 = a.y + (2 / 3) * (b.y1 - a.y);
        cx2 = b.x + (2 / 3) * (b.x1 - b.x);
        cy2 = b.y + (2 / 3) * (b.y1 - b.y);
    } else {
        cx1 = a.x + (b.x - a.x) / 3;
        cy1 = a.y + (b.y - a.y) / 3;
        cx2 = a.x + (b.x - a.x) * 2 / 3;
        cy2 = a.y + (b.y - a.y) * 2 / 3;
    }

    // Распределяем сдвиг dx/dy пропорционально влиянию каждой точки
    const t = edgeDragState.t;
    const mt = 1 - t;

    // Базисные полиномы Бернштейна для контрольных точек
    const p1 = 3 * mt * mt * t;
    const p2 = 3 * mt * t * t;

    // Сумма квадратов для нормализации проекции вектора
    const sumSq = p1 * p1 + p2 * p2;

    // Если клик близко к краю, защищаем от деления на ноль
    const denominator = sumSq > 0.0001 ? sumSq : 0.0001;

    // Распределяем сдвигdx/dy пропорционально влиянию каждой точки
    const w1 = p1 / denominator;
    const w2 = p2 / denominator;

    segments[i] = {
        type: "C",
        x1: cx1 + dx * w1,
        y1: cy1 + dy * w1,
        x2: cx2 + dx * w2,
        y2: cy2 + dy * w2,
        x: b.x,
        y: b.y
    };

    edgeDragState.pathEl.setAttribute("d", serializePathData(segments));
    updateSelectionBox();
}

// завершение изменения ребра
function onEdgePointerUp(e) {
    if (!edgeDragState || e.pointerId !== edgeDragState.pointerId) return;

    try {
        canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}

    canvas.removeEventListener("pointermove", onEdgePointerMove);
    canvas.removeEventListener("pointerup", onEdgePointerUp);
    canvas.removeEventListener("pointercancel", onEdgePointerUp);

    edgeDragState = null;
    updateSelectionBox();
}

// canvas.addEventListener("pointerdown", onEdgePointerDown);

// Находим вашу существующую startPathHandleMove и добавляем в самое начало сброс ребра:
const originalStartPathHandleMove = startPathHandleMove;
startPathHandleMove = function(e, handle) {
    window.lastActiveEdgeIndex = null;
    originalStartPathHandleMove(e, handle);
};



// === Изменение размера выделения ===

// Начало изменения размера выделения
function startElementResize(e, handle) {
    if (window.modeSvgEditor !== "selection" && window.modeSvgEditor !== "nodeEdit") return;
    const svg = canvas.querySelector("svg");
    if (!svg) return;

    const group = getContentLayer(svg);
    const groupInverse = group?.getCTM()?.inverse() || null;
    const elements = Array.isArray(window.selectedElementsSvg) ? window.selectedElementsSvg : [window.selectedElementsSvg];
    const selectionBox = getSelectionBBox(elements, groupInverse);
    if (!selectionBox) return;

    const point = getSvgPoint(e, svg);
    const startPoint = groupInverse ? point.matrixTransform(groupInverse) : point;

    // Сохраняем состояние изменения размера
    elementResizing = {
        pointerId: e.pointerId,
        handle,
        startPoint,
        startBox: selectionBox,
        groupInverse,
        items: elements.map((el) => ({
            el,
            transform: el.getAttribute("transform") || ""
        }))
    };

    e.preventDefault();
    e.stopImmediatePropagation();

    try {
        canvas.setPointerCapture(e.pointerId);
    } catch (err) {}

    canvas.addEventListener("pointermove", onElementResizeMove);
    canvas.addEventListener("pointerup", onElementResizeUp);
    canvas.addEventListener("pointercancel", onElementResizeUp);
    canvas.addEventListener("lostpointercapture", onElementResizeUp);
}

// Получение новой рамки при изменении размера
function getResizedBox(startBox, handle, dx, dy) {
    let x = startBox.x;
    let y = startBox.y;
    let width = startBox.width;
    let height = startBox.height;

    // Изменяем координаты и размеры в зависимости от активного квадрата
    if (handle.includes("l")) {
        x = startBox.x + dx;
        width = startBox.width - dx;
    }
    if (handle.includes("r")) {
        width = startBox.width + dx;
    }
    if (handle.includes("t")) {
        y = startBox.y + dy;
        height = startBox.height - dy;
    }
    if (handle.includes("b")) {
        height = startBox.height + dy;
    }

    return { x, y, width, height };
}

// Изменение размера выделения
function onElementResizeMove(e) {
    if (!elementResizing || e.pointerId !== elementResizing.pointerId) return;

    const svg = canvas.querySelector("svg");
    if (!svg) return;

    e.preventDefault();

    const groupInverse = elementResizing.groupInverse;
    const point = getSvgPoint(e, svg);
    const localPoint = groupInverse ? point.matrixTransform(groupInverse) : point;
    const dx = localPoint.x - elementResizing.startPoint.x;
    const dy = localPoint.y - elementResizing.startPoint.y;
    const box = getResizedBox(elementResizing.startBox, elementResizing.handle, dx, dy);

    // Вычисляем масштаб и трансформацию для каждого элемента внутри рамки
    const sx = elementResizing.startBox.width ? box.width / elementResizing.startBox.width : 1;
    const sy = elementResizing.startBox.height ? box.height / elementResizing.startBox.height : 1;
    const tx = box.x - elementResizing.startBox.x * sx;
    const ty = box.y - elementResizing.startBox.y * sy;
    const matrix = `matrix(${sx} 0 0 ${sy} ${tx} ${ty})`;

    // Применяем трансформацию к каждому элементу внутри рамки
    for (const item of elementResizing.items) {
        item.el.setAttribute("transform", `${matrix} ${item.transform}`.trim());
    }

    updateSelectionBox();
}

// Завершение изменения размера выделения
function onElementResizeUp(e) {
    if (!elementResizing || e.pointerId !== elementResizing.pointerId) return;

    try {
        canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}

    canvas.removeEventListener("pointermove", onElementResizeMove);
    canvas.removeEventListener("pointerup", onElementResizeUp);
    canvas.removeEventListener("pointercancel", onElementResizeUp);
    canvas.removeEventListener("lostpointercapture", onElementResizeUp);

    elementResizing = null;
    updateSelectionBox();
}



// === Взаимодействие c элементами ===

// Текущее перетаскиваемое состояние
let dragging = null;
let canvasPanning = null;

// Нажатие на элемент
function onPointerDownEl(e) {
    if (e.button !== 0) return;
    if (window.modeSvgEditor !== "selection" && window.modeSvgEditor !== "nodeEdit") return;
    const svg = canvas.querySelector("svg");
    if (!svg) return;

    // Если кликнули мимо контента, выходим
    const firstG = getContentLayer(svg);
    if (!firstG || !firstG.contains(e.target)) return;
    if (elementResizing || (e.target.dataset && e.target.dataset.resizeHandle)) return;
    if (resizing || isResizeHandle(e, svg)) return;

    // сохраняем элемент, который будем перетаскивать
    const el = getTopLevelElement(e.target);
    const groupInverse = firstG?.getCTM()?.inverse() || null;

    try {
        el.setPointerCapture(e.pointerId);
    } catch (err) {}

    // сохраняем начальные координаты и трансформацию элемента
    const rect = el.getBoundingClientRect();
    const transform = el.getAttribute("transform") || "";
    const startPoint = groupInverse ? getSvgPoint(e, svg).matrixTransform(groupInverse) : getSvgPoint(e, svg);

    // Если элемент уже выбран, перемещаем все выбранные элементы, иначе только текущий
    const isAlreadySelected = Array.isArray(window.selectedElementsSvg) && window.selectedElementsSvg.includes(el);
    const elementsToMove = isAlreadySelected ? window.selectedElementsSvg : [el];

    // Сохраняем информацию о каждом выбранном элементе для перемещения
    const selectedItems = elementsToMove.map((sel) => {
        const selRect = sel.getBoundingClientRect();
        return {
            el: sel,
            isSVG: sel instanceof SVGElement,
            transform: sel.getAttribute("transform") || "",
            left: parseFloat(sel.style.left) || selRect.left,
            top: parseFloat(sel.style.top) || selRect.top
        };
    });

    dragging = {
        el,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startPoint,
        isSVG: el instanceof SVGElement,
        transform,
        elLeft: rect.left,
        elTop: rect.top,
        selected: selectedItems.length > 0,
        selectedItems,
        lastEvent: e
    };
}

// Перемещение элемента
function onPointerMoveEl(e) {
    if (window.modeSvgEditor !== "selection" && window.modeSvgEditor !== "nodeEdit") return;
    // если не перетаскиваем, выходим
    if (!dragging || e.pointerId !== dragging.pointerId) return;

    e.preventDefault();
    dragging.lastEvent = e;

    let dx = e.clientX - dragging.startX;
    let dy = e.clientY - dragging.startY;

    // Если перетаскиваем SVG-элемент, используем локальные координаты SVG
    if (dragging.isSVG) {
        const svg = canvas.querySelector("svg");
        if (!svg) return;

        const firstG = getContentLayer(svg);
        const currentInverse = firstG?.getCTM()?.inverse() || null;
        
        const point = currentInverse ? getSvgPoint(e, svg).matrixTransform(currentInverse) : getSvgPoint(e, svg);
        dx = point.x - dragging.startPoint.x;
        dy = point.y - dragging.startPoint.y;

        if (dragging.selected && dragging.selectedItems.length) {
            for (const item of dragging.selectedItems) {
                item.el.setAttribute("transform", `translate(${dx} ${dy}) ${item.transform}`.trim());
                item.el.dataset.x = dx;
                item.el.dataset.y = dy;
            }
        } else {
            dragging.el.setAttribute("transform", `translate(${dx} ${dy}) ${dragging.transform}`.trim());
            dragging.el.dataset.x = dx;
            dragging.el.dataset.y = dy;
        }

        if (dragging.selected) {
            updateSelectionBox();
        }
        return;
    }

    // Для обычных HTML-элементов
    if (dragging.selected && dragging.selectedItems.length) {
        for (const item of dragging.selectedItems) {
            const left = item.left + dx;
            const top = item.top + dy;
            item.el.style.position = "absolute";
            item.el.style.left = left + "px";
            item.el.style.top = top + "px";
            item.el.dataset.x = left;
            item.el.dataset.y = top;
        }
    } else {
        const left = dragging.elLeft + dx;
        const top = dragging.elTop + dy;
        dragging.el.style.position = "absolute";
        dragging.el.style.left = left + "px";
        dragging.el.style.top = top + "px";
        dragging.el.dataset.x = left;
        dragging.el.dataset.y = top;
    }

    if (dragging.selected) {
        updateSelectionBox();
    }
}

// Отпускание элемента
function onPointerUpEl(e) {
    if (!dragging || e.pointerId !== dragging.pointerId) return;

    try {
        dragging.el.releasePointerCapture(e.pointerId);
    } catch (err) {}

    dragging = null;
}

// Добавляем обработчики для элементов на канве
canvas.addEventListener("pointerdown", onPointerDownEl);
canvas.addEventListener("pointermove", onPointerMoveEl);
canvas.addEventListener("pointerup", onPointerUpEl);
canvas.addEventListener("pointercancel", onPointerUpEl);
canvas.addEventListener("lostpointercapture", onPointerUpEl);