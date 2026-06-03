// === Общие ===

// Главный холст
const canvas = document.getElementById("svgCanvas");



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
        elTop: rect.top
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
        const x = dragging.offsetX + dx;
        const y = dragging.offsetY + dy;

        dragging.el.setAttribute("transform", `translate(${x} ${y})`);
        dragging.el.dataset.x = x;
        dragging.el.dataset.y = y;
        return;
    }

    // Перемещение HTML элемента через left/top
    const left = dragging.elLeft + dx;
    const top = dragging.elTop + dy;

    dragging.el.style.position = "absolute";
    dragging.el.style.left = left + "px";
    dragging.el.style.top = top + "px";
    dragging.el.dataset.x = left;
    dragging.el.dataset.y = top;
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
    const onLeft = e.clientX >= rect.left - edgeSize && e.clientX <= rect.left + edgeSize;
    const onRight = e.clientX >= rect.right - edgeSize && e.clientX <= rect.right + edgeSize;
    const onTop = e.clientY >= rect.top - edgeSize && e.clientY <= rect.top + edgeSize;
    const onBottom = e.clientY >= rect.bottom - edgeSize && e.clientY <= rect.bottom + edgeSize;

    // углы
    const onTL = Math.abs(e.clientX - rect.left) < cornerSize && Math.abs(e.clientY - rect.top) < cornerSize;
    const onTR = Math.abs(e.clientX - rect.right) < cornerSize && Math.abs(e.clientY - rect.top) < cornerSize;
    const onBL = Math.abs(e.clientX - rect.left) < cornerSize && Math.abs(e.clientY - rect.bottom) < cornerSize;
    const onBR = Math.abs(e.clientX - rect.right) < cornerSize && Math.abs(e.clientY - rect.bottom) < cornerSize;

    // ничего не попали
    if (!onLeft && !onRight && !onTop && !onBottom && !onTL && !onTR && !onBL && !onBR) return;

    resizing = {
        startRect: svg.getBoundingClientRect(),
        svg,
        startX: e.clientX,
        startY: e.clientY,
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
    const dx = e.clientX - (resizing.startRect.right);
    const dy = e.clientY - (resizing.startRect.bottom);

    let newW = resizing.startW;
    let newH = resizing.startH;

    if (resizing.onRight) newW = resizing.startW + dx;
    if (resizing.onBottom) newH = resizing.startH + dy;

    if (resizing.onLeft) newW = resizing.startW - dx;
    if (resizing.onTop) newH = resizing.startH - dy;

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