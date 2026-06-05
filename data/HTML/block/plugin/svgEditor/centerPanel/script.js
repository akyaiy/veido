// === Общие ===

// Главный холст
const canvas = document.getElementById("svgCanvas");

// Выбранный элемент
let selectedElements = [];



// === Выделение ===

// состояние лассо
let lassoActive = false
let lassoStart = null
let lassoRect = null

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
    const svg = canvas.querySelector("svg")
    const firstG = svg.children[0]
    const techLayer = svg.children[1]

    // если клик по элементу - лассо не запускается
    if (firstG.contains(e.target)) return

    // если клик по зоне изменения размера - лассо не запускается
    if (isResizeHandle(e, svg)) return

    // включаем режим лассо
    lassoActive = true

    // запоминаем стартовую точку
    lassoStart = { x: e.clientX, y: e.clientY }

    // очищаем текущее выделение
    selectedElements = []

    // очищаем технический слой
    techLayer.innerHTML = ""

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
    const firstG = svg.children[0]
    const techLayer = svg.children[1]

    // вычисляем границы выделения
    const x1 = Math.min(lassoStart.x, e.clientX)
    const y1 = Math.min(lassoStart.y, e.clientY)
    const x2 = Math.max(lassoStart.x, e.clientX)
    const y2 = Math.max(lassoStart.y, e.clientY)

    const elements = firstG.children

    // добавляем новые элементы в существующий массив
    if (!selectedElements) {
        selectedElements = []
    }

    for (const el of elements) {
        const bbox = el.getBoundingClientRect()

        // если элемент хотя бы немного пересекается с рамкой - добавляем
        const intersects = !(bbox.right < x1 || bbox.left > x2 || bbox.bottom < y1 || bbox.top > y2)
        if (intersects) {
            selectedElements.push(el)
        }
    }

    // очищаем визуальный слой
    techLayer.innerHTML = ""

    // обновляем рамку если есть что выделено
    if (selectedElements.length) {
        updateSelectionBox()
    }

    // сброс состояния лассо
    lassoActive = false
    lassoStart = null
    lassoRect = null
}

// Выделение элемента
function selectElement(el) {
    // если элемент уже в выбранных — не сбрасываем выделение
    if (Array.isArray(selectedElements) && selectedElements.includes(el)) {
        updateSelectionBox();
        return;
    }

    // Выделяем новый элемент
    selectedElements = [el];
    updateSelectionBox();
}

// Обновление рамки выделения
function updateSelectionBox() {
    if (!selectedElements || (Array.isArray(selectedElements) && selectedElements.length === 0)) return;

    const svg = canvas.querySelector("svg");
    const techLayer = svg.children[1];

    techLayer.innerHTML = "";

    const elements = Array.isArray(selectedElements) ? selectedElements : [selectedElements];

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

        techLayer.appendChild(rect);
    }
}

// Получение координат и размеров элемента с учетом трансформаций
function getTransformedBBox(el) {
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
    const t1 = p1.matrixTransform(ctm);
    const t2 = p2.matrixTransform(ctm);

    return {
        x: Math.min(t1.x, t2.x),
        y: Math.min(t1.y, t2.y),
        width: Math.abs(t2.x - t1.x),
        height: Math.abs(t2.y - t1.y)
    };
}

// Выделение элемента при нажатии (pointerdown)
canvas.addEventListener("pointerdown", (e) => {
    const svg = canvas.querySelector("svg");
    const firstG = svg.children[0];
    const techLayer = svg.children[1];

    // если клик по элементу - одиночное выделение
    if (firstG.contains(e.target)) {
        selectElement(e.target);
        return;
    }

    // иначе запускаем лассо (передаём event)
    selectElements(e);
});



// === Взаимодействие c элементами ===

// Текущее перетаскиваемое состояние
let dragging = null;

// Нажатие на элемент
function onPointerDownEl(e) {
    const svg = canvas.querySelector("svg");

    if (!svg.contains(e.target) || e.target === svg) {
        return;
    }
    if (resizing) return;

    const el = e.target;

    e.preventDefault();

    try {
        el.setPointerCapture(e.pointerId);
    } catch (err) {}

    // Получаем текущий translate для SVG элемента
    const match = (el.getAttribute("transform") || "").match(/translate\(([-0-9.]+)[, ]+([-0-9.]+)\)/);
    const rect = el.getBoundingClientRect();

    const selected = Array.isArray(selectedElements) && selectedElements.includes(el);
    const selectedItems = selected ? selectedElements.map((sel) => {
        const selMatch = (sel.getAttribute("transform") || "").match(/translate\(([-0-9.]+)[, ]+([-0-9.]+)\)/);
        const selRect = sel.getBoundingClientRect();
        return {
            el: sel,
            isSVG: sel instanceof SVGElement,
            offsetX: selMatch ? parseFloat(selMatch[1]) : 0,
            offsetY: selMatch ? parseFloat(selMatch[2]) : 0,
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
        isSVG: el instanceof SVGElement,
        offsetX: match ? parseFloat(match[1]) : 0,
        offsetY: match ? parseFloat(match[2]) : 0,
        elLeft: rect.left,
        elTop: rect.top,
        selected,
        selectedItems
    };
}

// Перемещение элемента
function onPointerMoveEl(e) {
    if (!dragging || e.pointerId !== dragging.pointerId) return;

    e.preventDefault();

    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;

    // Перемещение SVG элемента через transform
    if (dragging.isSVG) {
        if (dragging.selected && dragging.selectedItems.length) {
            for (const item of dragging.selectedItems) {
                const x = item.offsetX + dx;
                const y = item.offsetY + dy;
                item.el.setAttribute("transform", `translate(${x} ${y})`);
                item.el.dataset.x = x;
                item.el.dataset.y = y;
            }
        } else {
            const x = dragging.offsetX + dx;
            const y = dragging.offsetY + dy;
            dragging.el.setAttribute("transform", `translate(${x} ${y})`);
            dragging.el.dataset.x = x;
            dragging.el.dataset.y = y;
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

// Взаимодействие с элементами
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
    const svg = canvas.querySelector("svg");
    if (!svg) return;

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
    const svg = canvas.querySelector("svg");
    if (!svg) return;

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

// Подключение
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);