// === Общие ===

// Главный холст
const canvas = document.getElementById("svgCanvas");

// Выбранный элемент
window.selectedElementsSvg = [];

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
function onCanvasWheel(e) {
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
}

// Запрет контекстного меню при Ctrl + правая кнопка мыши для перемещения канвы
canvas.addEventListener("wheel", onCanvasWheel, { passive: false });
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
    updateSelectionBox();
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

// состояние лассо
let lassoActive = false
let lassoStart = null
let lassoRect = null
let lassoMoved = false

// состояние изменения размера выделения
let elementResizing = null
const selectionHandleSize = 8

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

// запуск лассо
function selectElements(e) {
    if (window.modeSvgEditor !== "selection") return;
    const svg = canvas.querySelector("svg")
    const firstG = getContentLayer(svg)
    const techLayer = getOverlayLayer(svg)

    // если клик по квадрату изменения размера - лассо не запускается
    if (e.target.dataset && e.target.dataset.resizeHandle) return

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

    // если не было реального перемещения и Shift нажат — оставляем старое выделение
    if (!lassoMoved && e.shiftKey) {
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

// Выделение элемента
function selectElement(el, append = false) {
    // если Shift или Ctrl зажаты - переключаем выделение для элемента
    if (append) {
        toggleSelection(el)
        updateSelectionBox();
        return;
    }

    // если элемент уже в выбранных — не сбрасываем выделение
    if (Array.isArray(window.selectedElementsSvg) && window.selectedElementsSvg.includes(el)) {
        updateSelectionBox();
        return;
    }

    // Выделяем новый элемент
    window.selectedElementsSvg = [el];
    updateSelectionBox();
}

// Обновление рамки выделения
function updateSelectionBox() {
    // если нет выделения - очищаем технический слой и выходим
    if (!window.selectedElementsSvg || (Array.isArray(window.selectedElementsSvg) && window.selectedElementsSvg.length === 0)) {
        const svg = canvas.querySelector("svg");
        if (svg) {
            const techLayer = getOverlayLayer(svg);
            if (techLayer) techLayer.innerHTML = "";
        }
        return;
    }

    const svg = canvas.querySelector("svg");
    const techLayer = getOverlayLayer(svg);

    techLayer.innerHTML = "";

    const elements = Array.isArray(window.selectedElementsSvg) ? window.selectedElementsSvg : [window.selectedElementsSvg];
    const selectionBox = getSelectionBBox(elements);

    for (const el of elements) {
        const bbox = getTransformedBBox(el);

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");

        // если объект очень тонкий (например линия), делаем рамку минимум в 1px
        const width = Math.max(1, bbox.width);
        const height = Math.max(1, bbox.height);

        // Изменение координат и размеров рамки
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
}

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

// Начало изменения размера выделения
function startElementResize(e, handle) {
    if (window.modeSvgEditor !== "selection") return;
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
    if (window.modeSvgEditor !== "selection") return;
    const svg = canvas.querySelector("svg");
    const firstG = getContentLayer(svg);
    const techLayer = getOverlayLayer(svg);

    // перемещение канвы по Ctrl + правая кнопка мыши
    if (startCanvasPanning(e, svg)) {
        return;
    }

    if (e.button !== 0) return;

    // если клик по квадрату изменения размера - растягиваем выделение
    if (e.target.dataset && e.target.dataset.resizeHandle) {
        startElementResize(e, e.target.dataset.resizeHandle);
        return;
    }

    // если клик по элементу - одиночное выделение
    if (firstG.contains(e.target)) {
        selectElement(e.target, e.shiftKey || e.ctrlKey);
        return;
    }

    // иначе запускаем лассо (передаём event)
    selectElements(e);
}

// Выделение элемента при нажатии (pointerdown)
canvas.addEventListener("pointerdown", (e) => {
    handleCanvasPointerDown(e);
});



// === Взаимодействие c элементами ===

// Текущее перетаскиваемое состояние
let dragging = null;
let canvasPanning = null;

// Нажатие на элемент
function onPointerDownEl(e) {
    if (e.button !== 0) return;
    if (window.modeSvgEditor !== "selection") return;
    const svg = canvas.querySelector("svg");
    if (!svg) return;

    const firstG = getContentLayer(svg);
    // двигать можно только элементы из первого слоя
    if (!firstG || !firstG.contains(e.target)) return;
    if (elementResizing || (e.target.dataset && e.target.dataset.resizeHandle)) return;
    if (resizing || isResizeHandle(e, svg)) return;

    const el = e.target;
    const groupInverse = firstG?.getCTM()?.inverse() || null;

    e.preventDefault();

    try {
        el.setPointerCapture(e.pointerId);
    } catch (err) {}

    // Получаем текущие данные элемента
    const rect = el.getBoundingClientRect();
    const transform = el.getAttribute("transform") || "";
    const startPoint = groupInverse ? getSvgPoint(e, svg).matrixTransform(groupInverse) : getSvgPoint(e, svg);

    // Проверяем, входит ли элемент в текущее выделение
    const selected = Array.isArray(window.selectedElementsSvg) && window.selectedElementsSvg.includes(el);
    const selectedItems = selected ? window.selectedElementsSvg.map((sel) => {
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
        groupInverse,
        isSVG: el instanceof SVGElement,
        transform,
        elLeft: rect.left,
        elTop: rect.top,
        selected,
        selectedItems
    };
}

// Перемещение элемента
function onPointerMoveEl(e) {
    if (window.modeSvgEditor !== "selection") return;
    if (!dragging || e.pointerId !== dragging.pointerId) return;

    e.preventDefault();

    let dx = e.clientX - dragging.startX;
    let dy = e.clientY - dragging.startY;

    // Перемещение SVG элемента через transform
    if (dragging.isSVG) {
        const svg = canvas.querySelector("svg");
        if (!svg) return;

        const point = dragging.groupInverse ? getSvgPoint(e, svg).matrixTransform(dragging.groupInverse) : getSvgPoint(e, svg);
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



// === Взаимодействие c холстом ===

// Флаг режима изменения размера
let resizing = false;

// Размер активной зоны (px)
const edgeSize = 4;
const cornerSize = 6;

// Нажатие на холст
function onPointerDown(e) {
    if (window.modeSvgEditor !== "selection") return;
    const svg = canvas.querySelector("svg");
    if (!svg) return;
    if (elementResizing || (e.target.dataset && e.target.dataset.resizeHandle)) return;

    const rect = svg.getBoundingClientRect();

    // стороны
    let onLeft = e.clientX >= rect.left - edgeSize && e.clientX <= rect.left + edgeSize;
    let onRight = e.clientX >= rect.right - edgeSize && e.clientX <= rect.right + edgeSize;
    let onTop = e.clientY >= rect.top - edgeSize && e.clientY <= rect.top + edgeSize;
    let onBottom = e.clientY >= rect.bottom - edgeSize && e.clientY <= rect.bottom + edgeSize;

    // углы
    const onTL = Math.abs(e.clientX - rect.left) < cornerSize && Math.abs(e.clientY - rect.top) < cornerSize;
    const onTR = Math.abs(e.clientX - rect.right) < cornerSize && Math.abs(e.clientY - rect.top) < cornerSize;
    const onBL = Math.abs(e.clientX - rect.left) < cornerSize && Math.abs(e.clientY - rect.bottom) < cornerSize;
    const onBR = Math.abs(e.clientX - rect.right) < cornerSize && Math.abs(e.clientY - rect.bottom) < cornerSize;

    // угловой режим делает боковые флаги активными
    if (onTL) {
        onLeft = true;
        onTop = true;
    }
    if (onTR) {
        onRight = true;
        onTop = true;
    }
    if (onBL) {
        onLeft = true;
        onBottom = true;
    }
    if (onBR) {
        onRight = true;
        onBottom = true;
    }

    // ничего не попали
    if (!onLeft && !onRight && !onTop && !onBottom && !onTL && !onTR && !onBL && !onBR) return;

    // Сбрасываем выделение при начале изменения размера
    window.selectedElementsSvg = [];
    const techLayer = getOverlayLayer(svg);
    if (techLayer) techLayer.innerHTML = "";

    resizing = {
        startRect: svg.getBoundingClientRect(),
        svg,
        startX: e.clientX,
        startY: e.clientY,
        mouseStartX: e.clientX,
        mouseStartY: e.clientY,
        startW: svg.width.baseVal.value,
        startH: svg.height.baseVal.value,
        onLeft,
        onRight,
        onTop,
        onBottom,
        onTL,
        onTR,
        onBL,
        onBR
    };

    e.preventDefault();
}

// Перемещение курсора
function onPointerMove(e) {
    if (window.modeSvgEditor !== "selection") return;
    const svg = canvas.querySelector("svg");
    if (!svg) return;
    if (elementResizing) return;

    const rect = svg.getBoundingClientRect();

    // стороны
    const onLeft = Math.abs(e.clientX - rect.left) < edgeSize;
    const onRight = Math.abs(e.clientX - rect.right) < edgeSize;
    const onTop = Math.abs(e.clientY - rect.top) < edgeSize;
    const onBottom = Math.abs(e.clientY - rect.bottom) < edgeSize;

    // углы
    const onTL = Math.abs(e.clientX - rect.left) < cornerSize && Math.abs(e.clientY - rect.top) < cornerSize;
    const onTR = Math.abs(e.clientX - rect.right) < cornerSize && Math.abs(e.clientY - rect.top) < cornerSize;
    const onBL = Math.abs(e.clientX - rect.left) < cornerSize && Math.abs(e.clientY - rect.bottom) < cornerSize;
    const onBR = Math.abs(e.clientX - rect.right) < cornerSize && Math.abs(e.clientY - rect.bottom) < cornerSize;

    // курсор (углы имеют приоритет)
    if (onTL || onBR) {
        svg.style.cursor = "nwse-resize";
    } else if (onTR || onBL) {
        svg.style.cursor = "nesw-resize";
    } else if (onLeft || onRight) {
        svg.style.cursor = "ew-resize";
    } else if (onTop || onBottom) {
        svg.style.cursor = "ns-resize";
    } else {
        svg.style.cursor = "default";
    }

    if (!resizing) return;

    // Вычисляем новые размеры
    let k = 2;
    const dx = e.clientX - resizing.mouseStartX;
    const dy = e.clientY - resizing.mouseStartY;

    let newW = resizing.startW;
    let newH = resizing.startH;

    if (resizing.onRight) newW = resizing.startW + dx * k;
    if (resizing.onBottom) newH = resizing.startH + dy * k;

    if (resizing.onLeft) newW = resizing.startW - dx * k;
    if (resizing.onTop) newH = resizing.startH - dy * k;

    resizing.svg.setAttribute("width", Math.max(20, newW));
    resizing.svg.setAttribute("height", Math.max(20, newH));
}

// Отпускание
function onPointerUp() {
    resizing = false;
}

// Привязка событий к rect внутри третьей группы
// document.addEventListener("openSvgBlock", () => {
//     const borderPath = canvas.querySelector("svg")?.querySelector("#borderPath");
//     if (!borderPath) return;

//     borderPath.addEventListener("pointerdown", onPointerDown);
//     borderPath.addEventListener("pointermove", onPointerMove);
//     borderPath.addEventListener("pointerup", onPointerUp);
//     borderPath.addEventListener("pointercancel", onPointerUp);
// });