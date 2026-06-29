// === Общие ===

// Главный холст
const canvas = document.getElementById("svgCanvas");

// Получение слоев из SVG
function getContentLayer(svg) { return svg?.children[1]; }
function getOverlayLayer(svg) { return svg?.children[2]; }
function getBorderLayer(svg) { return svg?.children[0]; }



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
    
    // если Shift или Ctrl зажаты - переключаем выделение для элемента
    if (append) {
        toggleSelection(topEl)
        updateSelectionBox();
        return;
    }

    // если элемент уже в выбранных — не сбрасываем выделение
    if (Array.isArray(window.selectedElementsSvg) && window.selectedElementsSvg.includes(topEl)) {
        updateSelectionBox();
        return;
    }

    // Выделяем новый элемент
    window.selectedElementsSvg = [topEl];
    updateSelectionBox();
}

// Обновление рамки выделения
function updateSelectionBox(restoreHandlesFlags = false) {
    // если нет выделения - очищаем технический слой и выходим
    if (!window.selectedElementsSvg || (Array.isArray(window.selectedElementsSvg) && window.selectedElementsSvg.length === 0)) {
        window.lastActiveEdgeIndex = null; // Сброс при потере выделения
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

        if (activePathHandle && restoreHandlesFlags) {
            activePathHandle = techLayer.querySelector(
                `[data-path-index="${activePathHandle.dataset.pathIndex}"][data-path-handle="${activePathHandle.dataset.pathHandle}"]`
            );

            if (activePathHandle) {
                activePathHandle.dataset.active = "1";
                activePathHandle.setAttribute("fill", "#4285f4");
            }
        }

        // Если есть сохраненное измененное ребро — красим СТРОГО эти 2 узла
        if (window.lastActiveEdgeIndex !== null) {
            highlightEdgeNodes(svg, window.lastActiveEdgeIndex);
        }

        document.dispatchEvent(new CustomEvent("svgSelectionChanged", {
            detail: { selectedElements: elements.slice() }
        }));
        return;
    }

    // Если выделено несколько элементов, сбрасываем подсветку ребра
    window.lastActiveEdgeIndex = null;

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



// === Выделение path ===

// активный узел
let activePathHandle = null;

// Нормализация числа для записи в path
function formatSvgNumber(value) {
    if (!isFinite(value)) return "0";

    const rounded = Math.round(value * 1000) / 1000;

    return String(rounded)
        .replace(/\.0+$/, "")
        .replace(/(\.\d*?)0+$/, "$1");
}

// Разбор path в массив абсолющих сегментов
function parsePathData(d) {
    const tokens = (d || "").match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi) || [];
    const segments = [];

    let i = 0;
    let cmd = "";
    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;
    let prevCmd = "";
    let prevC2X = 0;
    let prevC2Y = 0;
    let prevQX = 0;
    let prevQY = 0;

    function isCommand(token) {
        return /^[a-zA-Z]$/.test(token);
    }

    function readNumber() {
        return parseFloat(tokens[i++]);
    }

    while (i < tokens.length) {
        let token = tokens[i++];

        if (isCommand(token)) {
            cmd = token;
        } else {
            i--;
        }

        if (!cmd) break;

        const upper = cmd.toUpperCase();
        const rel = cmd !== upper;

        // Перемещение пера
        if (upper === "M") {
            let first = true;

            while (i + 1 < tokens.length && !isCommand(tokens[i]) && !isCommand(tokens[i + 1])) {
                const nx = readNumber();
                const ny = readNumber();

                const px = rel ? x + nx : nx;
                const py = rel ? y + ny : ny;

                if (first) {
                    segments.push({ type: "M", x: px, y: py });

                    startX = px;
                    startY = py;
                    first = false;
                } else {
                    segments.push({ type: "L", x: px, y: py });
                }

                x = px;
                y = py;
                prevCmd = "L";
            }

            prevC2X = 0;
            prevC2Y = 0;
            prevQX = 0;
            prevQY = 0;
            continue;
        }

        // Линия
        if (upper === "L") {
            while (i + 1 < tokens.length && !isCommand(tokens[i]) && !isCommand(tokens[i + 1])) {
                const nx = readNumber();
                const ny = readNumber();

                x = rel ? x + nx : nx;
                y = rel ? y + ny : ny;

                segments.push({ type: "L", x, y });
                prevCmd = "L";
            }

            prevC2X = 0;
            prevC2Y = 0;
            prevQX = 0;
            prevQY = 0;
            continue;
        }

        // Горизонтальная линия
        if (upper === "H") {
            while (i < tokens.length && !isCommand(tokens[i])) {
                const nx = readNumber();

                x = rel ? x + nx : nx;

                segments.push({ type: "L", x, y });
                prevCmd = "L";
            }

            prevC2X = 0;
            prevC2Y = 0;
            prevQX = 0;
            prevQY = 0;
            continue;
        }

        // Вертикальная линия
        if (upper === "V") {
            while (i < tokens.length && !isCommand(tokens[i])) {
                const ny = readNumber();

                y = rel ? y + ny : ny;

                segments.push({ type: "L", x, y });
                prevCmd = "L";
            }

            prevC2X = 0;
            prevC2Y = 0;
            prevQX = 0;
            prevQY = 0;
            continue;
        }

        // Кубическая кривая Безье
        if (upper === "C") {
            while (i + 5 < tokens.length && !isCommand(tokens[i])) {
                const x1 = rel ? x + readNumber() : readNumber();
                const y1 = rel ? y + readNumber() : readNumber();
                const x2 = rel ? x + readNumber() : readNumber();
                const y2 = rel ? y + readNumber() : readNumber();
                const nx = rel ? x + readNumber() : readNumber();
                const ny = rel ? y + readNumber() : readNumber();

                segments.push({
                    type: "C",
                    x1,
                    y1,
                    x2,
                    y2,
                    x: nx,
                    y: ny
                });

                x = nx;
                y = ny;
                prevCmd = "C";
                prevC2X = x2;
                prevC2Y = y2;
                prevQX = 0;
                prevQY = 0;
            }

            continue;
        }

        // Сглаженная кубическая кривая Безье
        if (upper === "S") {
            while (i + 3 < tokens.length && !isCommand(tokens[i])) {
                const x2 = rel ? x + readNumber() : readNumber();
                const y2 = rel ? y + readNumber() : readNumber();
                const nx = rel ? x + readNumber() : readNumber();
                const ny = rel ? y + readNumber() : readNumber();

                const x1 = (prevCmd === "C" || prevCmd === "S") ? (2 * x - prevC2X) : x;
                const y1 = (prevCmd === "C" || prevCmd === "S") ? (2 * y - prevC2Y) : y;

                segments.push({
                    type: "C",
                    x1,
                    y1,
                    x2,
                    y2,
                    x: nx,
                    y: ny
                });

                x = nx;
                y = ny;
                prevCmd = "C";
                prevC2X = x2;
                prevC2Y = y2;
                prevQX = 0;
                prevQY = 0;
            }

            continue;
        }

        // Квадратичная кривая Безье
        if (upper === "Q") {
            while (i + 3 < tokens.length && !isCommand(tokens[i])) {
                const x1 = rel ? x + readNumber() : readNumber();
                const y1 = rel ? y + readNumber() : readNumber();
                const nx = rel ? x + readNumber() : readNumber();
                const ny = rel ? y + readNumber() : readNumber();

                segments.push({
                    type: "Q",
                    x1,
                    y1,
                    x: nx,
                    y: ny
                });

                x = nx;
                y = ny;
                prevCmd = "Q";
                prevQX = x1;
                prevQY = y1;
                prevC2X = 0;
                prevC2Y = 0;
            }

            continue;
        }

        // Сглаженная квадратичная кривая Безье
        if (upper === "T") {
            while (i + 1 < tokens.length && !isCommand(tokens[i])) {
                const nx = rel ? x + readNumber() : readNumber();
                const ny = rel ? y + readNumber() : readNumber();

                const x1 = (prevCmd === "Q" || prevCmd === "T") ? (2 * x - prevQX) : x;
                const y1 = (prevCmd === "Q" || prevCmd === "T") ? (2 * y - prevQY) : y;

                segments.push({
                    type: "Q",
                    x1,
                    y1,
                    x: nx,
                    y: ny
                });

                x = nx;
                y = ny;
                prevCmd = "Q";
                prevQX = x1;
                prevQY = y1;
                prevC2X = 0;
                prevC2Y = 0;
            }

            continue;
        }

        // Дуга
        if (upper === "A") {
            while (i + 6 < tokens.length && !isCommand(tokens[i])) {
                const rx = readNumber();
                const ry = readNumber();
                const angle = readNumber();
                const largeArcFlag = readNumber();
                const sweepFlag = readNumber();
                const nx = rel ? x + readNumber() : readNumber();
                const ny = rel ? y + readNumber() : readNumber();

                segments.push({
                    type: "A",
                    rx,
                    ry,
                    angle,
                    largeArcFlag,
                    sweepFlag,
                    x: nx,
                    y: ny
                });

                x = nx;
                y = ny;
                prevCmd = "A";
                prevC2X = 0;
                prevC2Y = 0;
                prevQX = 0;
                prevQY = 0;
            }

            continue;
        }

        // Замыкание контура
        if (upper === "Z") {
            segments.push({ type: "Z" });

            x = startX;
            y = startY;

            prevCmd = "Z";
            prevC2X = 0;
            prevC2Y = 0;
            prevQX = 0;
            prevQY = 0;
            continue;
        }

        break;
    }

    return segments;
}

// Сборка строки path из массива сегментов
function serializePathData(segments) {
    const result = [];

    for (const seg of segments) {
        if (seg.type === "M") {
            result.push(`M ${formatSvgNumber(seg.x)} ${formatSvgNumber(seg.y)}`);
        } else if (seg.type === "L") {
            result.push(`L ${formatSvgNumber(seg.x)} ${formatSvgNumber(seg.y)}`);
        } else if (seg.type === "Q") {
            result.push(`Q ${formatSvgNumber(seg.x1)} ${formatSvgNumber(seg.y1)} ${formatSvgNumber(seg.x)} ${formatSvgNumber(seg.y)}`);
        } else if (seg.type === "C") {
            result.push(`C ${formatSvgNumber(seg.x1)} ${formatSvgNumber(seg.y1)} ${formatSvgNumber(seg.x2)} ${formatSvgNumber(seg.y2)} ${formatSvgNumber(seg.x)} ${formatSvgNumber(seg.y)}`);
        } else if (seg.type === "A") {
            result.push(`A ${formatSvgNumber(seg.rx)} ${formatSvgNumber(seg.ry)} ${formatSvgNumber(seg.angle)} ${formatSvgNumber(seg.largeArcFlag)} ${formatSvgNumber(seg.sweepFlag)} ${formatSvgNumber(seg.x)} ${formatSvgNumber(seg.y)}`);
        } else if (seg.type === "Z") {
            result.push("Z");
        }
    }

    return result.join(" ");
}

// Получение начальной точки сегмента
function getPathSegmentStartPoint(segments, index) {
    let x = 0;
    let y = 0;

    for (let i = 0; i < index; i++) {
        const seg = segments[i];

        if (seg.type === "M" || seg.type === "L" || seg.type === "Q" || seg.type === "C" || seg.type === "A") {
            x = seg.x;
            y = seg.y;
        } else if (seg.type === "Z") {
            break;
        }
    }

    return { x, y };
}

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

    // Начальная точка текущего контура
    let subpathStart = null;

    // Предыдущая узловая точка
    let prevPoint = null;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];

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
        }

        // Если предыдущая точка отсутствует, используем начало контура
        if (!prevPoint && subpathStart) {
            prevPoint = subpathStart;
        }

        // Квадратичная кривая Безье
        if (seg.type === "Q") {
            const c1 = toScreen(seg.x1, seg.y1);
            const end = toScreen(seg.x, seg.y);

            addPathGuideLine(prevPoint.x, prevPoint.y, c1.x, c1.y, techLayer);
            addPathControlHandle(c1.x, c1.y, i, "control1", techLayer, c);

            prevPoint = end;
        }

        // Кубическая кривая Безье
        if (seg.type === "C") {
            const c1 = toScreen(seg.x1, seg.y1);
            const c2 = toScreen(seg.x2, seg.y2);
            const end = toScreen(seg.x, seg.y);

            addPathGuideLine(prevPoint.x, prevPoint.y, c1.x, c1.y, techLayer);
            addPathControlHandle(c1.x, c1.y, i, "control1", techLayer, c);

            addPathGuideLine(end.x, end.y, c2.x, c2.y, techLayer);
            addPathControlHandle(c2.x, c2.y, i, "control2", techLayer, c);

            prevPoint = end;
        }

        // Замыкание контура
        if (seg.type === "Z") {
            prevPoint = subpathStart || prevPoint;
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

// Начало изменения точки path
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

    if (activePathHandle) {
        activePathHandle.setAttribute("fill", "#ffffff");
       activePathHandle.removeAttribute('data-active');
    }

    activePathHandle = handle;
    activePathHandle.dataset.active = "1";
    activePathHandle.setAttribute("fill", "#4285f4");

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

    // Вычисляем инверсию матрицы динамически, чтобы узел не "улетал" при прокрутке колесиком мыши
    const group = getContentLayer(svg);
    const currentInverse = group?.getCTM()?.inverse() || null;
    const localPoint = currentInverse ? point.matrixTransform(currentInverse) : point;

    const dx = localPoint.x - pathResizing.startPoint.x;
    const dy = localPoint.y - pathResizing.startPoint.y;

    const segments = pathResizing.startSegments.map((seg) => ({ ...seg }));
    const seg = segments[pathResizing.segmentIndex];

    if (!seg) return;

    // Определяем стартовые координаты ручки (до сдвига)
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

    // Теоретические новые координаты за мышкой
    let targetX = startX + dx;
    let targetY = startY + dy;

    // Прилипание
    let snapX = targetX;
    let snapY = targetY;
    let bestDist = Infinity;
    const snapDistance = 1;
    let isMutated = false; 

    // Прилипание
    if (pathResizing.handle === "control1" || pathResizing.handle === "control2") {
        let ownX = null, ownY = null;
        
        if (pathResizing.handle === "control1") {
            // control1 привязан к концу предыдущего сегмента (или к M, если он первый)
            const prevSeg = pathResizing.segmentIndex > 0 ? segments[pathResizing.segmentIndex - 1] : segments[0];
            if (prevSeg) { ownX = prevSeg.x; ownY = prevSeg.y; }
        } else if (pathResizing.handle === "control2") {
            // control2 привязан к конечному узлу текущего сегмента
            ownX = seg.x; ownY = seg.y;
        }

        /* if (ownX !== null && ownY !== null) {
            const distToOwnNode = Math.sqrt((targetX - ownX) ** 2 + (targetY - ownY) ** 2);
            if (distToOwnNode <= snapDistance) {
                bestDist = distToOwnNode;
                snapX = ownX;
                snapY = ownY;

                if (seg.type === "C") {
                    // Из Кубической (C) делаем Квадратичную (Q)
                    seg.type = "Q";
                    if (pathResizing.handle === "control1") {
                        // Если убрали первый ус, то второй (x2, y2) становится единственным усом (x1, y1)
                        seg.x1 = seg.x2;
                        seg.y1 = seg.y2;
                    }
                    // Если убрали второй ус, x1 и y1 остаются на месте
                    delete seg.x2;
                    delete seg.y2;
                    isMutated = true;
                } else if (seg.type === "Q" && pathResizing.handle === "control1") {
                    // Из Квадратичной (Q) делаем Линию (L)
                    seg.type = "L";
                    delete seg.x1;
                    delete seg.y1;
                    isMutated = true;
                }
            }
        } */
    }

    // Если со своим узлом не слиплись, проверяем прилипание к остальным точкам на сцене
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

    // Применяем новые координаты, только если сегмент не изменил тип
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
    updateSelectionBox();

    activePathHandle = canvas.querySelector(`[data-path-index="${pathResizing.segmentIndex}"][data-path-handle="${pathResizing.handle}"]`);
    if (activePathHandle) {
        activePathHandle.dataset.active = "1";
        activePathHandle.setAttribute("fill", "#4285f4");
    }
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

    updateSelectionBox();

    activePathHandle = canvas.querySelector(`[data-path-index="${pathResizing.segmentIndex}"][data-path-handle="${pathResizing.handle}"]`);

    if (activePathHandle) {
        activePathHandle.dataset.active = "1";
        activePathHandle.setAttribute("fill", "#4285f4");
    }

    pathResizing = null;
}

// Высчитоваем нужный сегмент
function distToSegmentSquared(p, v, w) {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    // Если начало и конец отрезка совпадают, возвращаем расстояние до точки
    if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2; 
    
    // Находим проекцию точки на прямую, заданную отрезком, и ограничиваем ее концами отрезка
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t)); 
    
    // Координаты ближайшей точки на отрезке
    const closestX = v.x + t * (w.x - v.x);
    const closestY = v.y + t * (w.y - v.y);
    
    // Возвращаем квадрат расстояния до этой точки
    return (p.x - closestX) ** 2 + (p.y - closestY) ** 2;
}

// таймер
let lastPathDblClickTime = 0;
let lastPathDblClickTarget = null;

// создание узла по двойному клику на path
function onPathDoubleClick(e) {
    if (window.modeSvgEditor !== "nodeEdit") return;

    const now = performance.now();

    // защита от ложных dblclick / дублей событий
    if (now - lastPathDblClickTime > 500) {
        lastPathDblClickTime = now;
        lastPathDblClickTarget = e.target;
    }

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

    for (let i = 1; i < segments.length; i++) {
        const a = segments[i - 1];
        const b = segments[i];

        if (typeof a.x !== "number" || typeof a.y !== "number") continue;
        if (typeof b.x !== "number" || typeof b.y !== "number") continue;

        const dist = distToSegmentSquared(localPoint, a, b);

        if (dist < bestDist) {
            bestDist = dist;
            bestIndex = i;
        }
    }

    if (bestIndex < 0) return;

    segments.splice(bestIndex, 0, {
        type: "L",
        x: localPoint.x,
        y: localPoint.y
    });

    pathEl.setAttribute("d", serializePathData(segments));
    updateSelectionBox();

    e.preventDefault();
    e.stopPropagation();
}

// обработчик
canvas.addEventListener("dblclick", onPathDoubleClick);



// === искривление ребра ===

let edgeDragState = null;
// Глобальный флаг: хранит индекс ребра ТОЛЬКО если идет или только что закончилось искривление
window.lastActiveEdgeIndex = null; 

// Вспомогательная функция: точная конвертация координат экрана в локальные координаты элемента
function getLocalPoint(e, svg, element) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(element.getScreenCTM().inverse());
}

// Вспомогательная функция: выделение строго двух узлов, образующих текущее ребро
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
        window.lastActiveEdgeIndex = null; // убираем выделение, если режим не тот
        return;
    }

    const svg = canvas.querySelector("svg");
    if (!svg) return;

    const pathEl = e.target;
    
    // Если кликнули не по path (например, по холсту), полностью убираем подсветку 2 точек
    if (!isPathElement(pathEl)) {
        window.lastActiveEdgeIndex = null;
        updateSelectionBox();
        return;
    }

    // Переводим клик строго в локальные координаты самого path
    const localPoint = getLocalPoint(e, svg, pathEl);
    const segments = parsePathData(pathEl.getAttribute("d") || "");
    
    let index = -1;
    let bestDist = Infinity;
    let t = 0.5;

    // Поиск ближайшего ребра
    for (let i = 1; i < segments.length; i++) {
        const a = segments[i - 1];
        const b = segments[i];

        if (!a || !b) continue;
        if (typeof a.x !== "number" || typeof a.y !== "number") continue;
        if (typeof b.x !== "number" || typeof b.y !== "number") continue;

        for (let k = 0; k <= 20; k++) {
            const sampleT = k / 20;
            let sx, sy;

            if (b.type === "Q") {
                const mt = 1 - sampleT;
                sx = mt * mt * a.x + 2 * mt * sampleT * b.x1 + sampleT * sampleT * b.x;
                sy = mt * mt * a.y + 2 * mt * sampleT * b.y1 + sampleT * sampleT * b.y;
            } else if (b.type === "C") {
                const mt = 1 - sampleT;
                sx = mt * mt * mt * a.x + 3 * mt * mt * sampleT * b.x1 + 3 * mt * sampleT * sampleT * b.x2 + sampleT * sampleT * sampleT * b.x;
                sy = mt * mt * mt * a.y + 3 * mt * mt * sampleT * b.y1 + 3 * mt * sampleT * sampleT * b.y2 + sampleT * sampleT * sampleT * b.y;
            } else {
                sx = a.x + (b.x - a.x) * sampleT;
                sy = a.y + (b.y - a.y) * sampleT;
            }

            const dist = (localPoint.x - sx) ** 2 + (localPoint.y - sy) ** 2;

            if (dist < bestDist) {
                bestDist = dist;
                index = i;
                t = sampleT;
            }
        }
    }

    // Если клик мимо ребра — сбрасываем подсветку точек
    if (index < 1 || bestDist > 1600) {
        window.lastActiveEdgeIndex = null;
        updateSelectionBox();
        return;
    }

    // Фиксируем ребро
    window.lastActiveEdgeIndex = index;

    edgeDragState = {
        pointerId: e.pointerId,
        pathEl,
        svg,
        index,
        startPoint: localPoint,
        startSegments: segments.map(s => ({ ...s })),
        t
    };

    e.preventDefault();
    e.stopPropagation();

    canvas.setPointerCapture(e.pointerId);

    // Обновляем слой и красим строго 2 узла ребра
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

    const w1 = 2 * (1 - edgeDragState.t);
    const w2 = 2 * edgeDragState.t;

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

canvas.addEventListener("pointerdown", onEdgePointerDown);


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

function handleCanvasPointerDown(e) {
    if (window.modeSvgEditor !== "selection" && window.modeSvgEditor !== "nodeEdit") return;
    const svg = canvas.querySelector("svg");
    const firstG = getContentLayer(svg);
    const techLayer = getOverlayLayer(svg);

    // Если клик по path handle - начинаем редактирование path
    if (e.target.dataset && e.target.dataset.pathHandle) {
        startPathHandleMove(e, e.target);
        return;
    }

    // Перемещение канвы мышкой
    if (startCanvasPanning(e, svg)) {
        return;
    }

    if (e.button !== 0) return;

    // Если клик по квадрату изменения размера - начинаем изменение размера
    if (e.target.dataset && e.target.dataset.resizeHandle) {
        startElementResize(e, e.target.dataset.resizeHandle);
        return;
    }

    // Сохроняем данные
    const target = e.target;
    const isShiftOrCtrl = e.shiftKey || e.ctrlKey;
    const originalEvent = e;

    // Ожидание, для того чтобы другие обработчики на элементах могли сработать первыми 
    setTimeout(() => {
        // Если клик по элементу внутри первого слоя - выделяем его
        if (firstG.contains(target)) {
            selectElement(target, isShiftOrCtrl);
            return;
        }

        // Если клик по зоне изменения размера - не запускаем лассо
        selectElements(originalEvent);
    }, 0);
}

// Выделение элемента при нажатии (pointerdown)
canvas.addEventListener("pointerdown", (e) => {
    const target = e.target;
    const svg = canvas.querySelector("svg");
    if (!svg) return;

    const firstG = getContentLayer(svg);
    const techLayer = getOverlayLayer(svg);

    // Клик по элементу
    if (firstG && firstG.contains(target) && !window.selectedElementsSvg?.includes(target)) {
        selectElement(target, e.shiftKey);
        return;
    }

    // Начало перетаскивания канвы
    handleCanvasPointerDown(e);
});



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

    const firstG = getContentLayer(svg);
    // двигать можно только элементы из первого слоя
    if (!firstG || !firstG.contains(e.target)) return;
    if (elementResizing || (e.target.dataset && e.target.dataset.resizeHandle)) return;
    if (resizing || isResizeHandle(e, svg)) return;

    const el = getTopLevelElement(e.target);
    const groupInverse = firstG?.getCTM()?.inverse() || null;

    e.preventDefault();

    try {
        el.setPointerCapture(e.pointerId);
    } catch (err) {}

    // Получаем текущие данные элемента
    const rect = el.getBoundingClientRect();
    const transform = el.getAttribute("transform") || "";
    const startPoint = groupInverse ? getSvgPoint(e, svg).matrixTransform(groupInverse) : getSvgPoint(e, svg);

    // Всегда используем все выделенные элементы для движения
    const selectedItems = Array.isArray(window.selectedElementsSvg) && window.selectedElementsSvg.length > 0 ?
        window.selectedElementsSvg.map((sel) => {
            const selRect = sel.getBoundingClientRect();
            return {
                el: sel,
                isSVG: sel instanceof SVGElement,
                transform: sel.getAttribute("transform") || "",
                left: parseFloat(sel.style.left) || selRect.left,
                top: parseFloat(sel.style.top) || selRect.top
            };
        }) : [];

    // Сохраняем начальные данные перетаскивания
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
        lastEvent: e // Запоминаем событие инициализации
    };
}

// Перемещение элемента
function onPointerMoveEl(e) {
    if (window.modeSvgEditor !== "selection") return;
    if (!dragging || e.pointerId !== dragging.pointerId) return;

    e.preventDefault();
    dragging.lastEvent = e; // Обновляем последнее событие мыши на каждом шаге

    let dx = e.clientX - dragging.startX;
    let dy = e.clientY - dragging.startY;

    // Перемещение SVG элемента через transform
    if (dragging.isSVG) {
        const svg = canvas.querySelector("svg");
        if (!svg) return;

        // Рассчитываем актуальную обратную матрицу "на лету" с учетом нового масштаба холста
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

    // Перемещение HTML элемента через left/top
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