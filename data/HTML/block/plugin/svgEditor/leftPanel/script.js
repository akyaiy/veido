// === Общие элементы ===

// элемент канваса 
const svgCanvas = document.getElementById("svgCanvas");
const svgCanvasSvg = svgCanvas.querySelector("svg");

// глобальный тип элемента для режима добавления
let currentAddElement = null;

// функция активации кнопки
function activeButton(btn) {
    const buttons = document.querySelectorAll("#elements .buttonSvg");
    buttons.forEach(button => button.classList.remove("active"));
    btn.classList.add("active");
}

// устанавливаем режим выделения по умолчанию
document.addEventListener("svgEditorBlocksLoaded", () => {
    document.getElementById("selectionMode").click();
    if (svgCanvas) {
        svgCanvas.addEventListener("pointerdown", startAddModeDraw);
    }
});


// === Режим редактирования ===

// кнопка режима выделения
const selectionMode = document.getElementById("selectionMode");

// переключение режима
function setSelectionMode(btn) {
    modeSvgEditor = "selection";
    currentAddElement = null;
    activeButton(btn);
}

// обработчик режима выделения
selectionMode.addEventListener("click", () => setSelectionMode(selectionMode));



// === Режим добавления ===

// кнопки режима добавления
const addModeTab = [
    { id: "addRect", type: "rect", element: '<rect/>' },
    { id: "addCircle", type: "circle", element: '<circle/>' },
    { id: "addLine", type: "line", element: '<line/>' },
    { id: "addPath", type: "path", element: '<path/>' }
];

// переменные для режима добавления
let addModeActive = false;
let addModeType = null;
let addModeStart = null;
let addModePreview = null;

// переменные для режима привязки к мышке
let isStickyMode = false;
let pressStartTime = 0;
let lastClickPoint = null;
let pathBaseD = "";

// функция получения координат клика относительно svg или группы внутри svg
function getSvgPoint(e, svg, group = null) {
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;

    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: e.clientX, y: e.clientY };

    const svgPoint = point.matrixTransform(matrix.inverse());
    if (!group) return svgPoint;

    const groupCTM = group.getCTM();
    if (!groupCTM) return svgPoint;

    return svgPoint.matrixTransform(groupCTM.inverse());
}

// функция получения или создания группы для рисования
function getDrawGroup(svg) {
    let group = svg.children[1];
    if (!group || group.nodeName.toLowerCase() !== "g") {
        group = document.createElementNS(svg.namespaceURI || "http://www.w3.org/2000/svg", "g");
        svg.insertBefore(group, svg.children[1] || svg.firstChild);
    }
    return group;
}

// функция начала рисования в режиме добавления
function startAddModeDraw(e) {
    if (window.modeSvgEditor !== "add" || !currentAddElement) return;
    if (!svgCanvasSvg) return;

    const point = getSvgPoint(e, svgCanvasSvg, getDrawGroup(svgCanvasSvg));
    if (!point) return;

    // запоминаем время нажатия для проверки на быстрый клик
    pressStartTime = Date.now();

    // если уже в режиме привязки к мышки и нажали еще раз
    if (isStickyMode && lastClickPoint) {
        const distX = point.x - lastClickPoint.x;
        const distY = point.y - lastClickPoint.y;

        // функция клика: если в одном месте нажато еще раз то останавливаем привязку
        if (Math.abs(distX) < 5 && Math.abs(distY) < 5) {
            isStickyMode = false;
            finishAddModeDraw(e);
            return;
        }

        lastClickPoint = point;

        // если режим rect или ломаная линия то делаем несокол отрезков по клику
        if (currentAddElement === "line") {
            addModeStart = point;
            const group = getDrawGroup(svgCanvasSvg);
            const el = document.createElementNS("http://www.w3.org/2000/svg", currentAddElement);

            // делаем белый контур черный фон
            el.setAttribute("stroke", "#000");
            el.setAttribute("stroke-width", "1");

            el.setAttribute("x1", point.x);
            el.setAttribute("y1", point.y);
            el.setAttribute("x2", point.x);
            el.setAttribute("y2", point.y);

            group.appendChild(el);
            addModePreview = el;
            e.preventDefault();
            return;
        } else if (currentAddElement === "path") {
            pathBaseD += ` L ${point.x} ${point.y}`;
            addModeStart = point;
            e.preventDefault();
            return;
        } else {
            isStickyMode = false;
            finishAddModeDraw(e);
            return;
        }
    }

    // запоминаем точку клика для режима привязки к мышке
    lastClickPoint = point;
    const group = getDrawGroup(svgCanvasSvg);
    const el = document.createElementNS("http://www.w3.org/2000/svg", currentAddElement);

    // устанавливаем начальные атрибуты в зависимости от типа элемента
    switch (currentAddElement) {
        case "rect":
            el.setAttribute("fill", "#ffffff");
            el.setAttribute("stroke", "#000000");
            el.setAttribute("stroke-width", "1");

            el.setAttribute("x", point.x);
            el.setAttribute("y", point.y);
            el.setAttribute("width", 1);
            el.setAttribute("height", 1);
            break;
            
        case "circle":
            el.setAttribute("fill", "#ffffff");
            el.setAttribute("stroke", "#000000");
            el.setAttribute("stroke-width", "1");

            el.setAttribute("cx", point.x);
            el.setAttribute("cy", point.y);
            el.setAttribute("r", 1);
            break;

        case "line":
            el.setAttribute("stroke", "#000");
            el.setAttribute("stroke-width", "1");

            el.setAttribute("x1", point.x);
            el.setAttribute("y1", point.y);
            el.setAttribute("x2", point.x);
            el.setAttribute("y2", point.y);
            break;

        case "path":
            el.setAttribute("fill", "#ffffff");
            el.setAttribute("stroke", "#000000");
            el.setAttribute("stroke-width", "1");

            pathBaseD = `M ${point.x} ${point.y}`;
            el.setAttribute("d", `${pathBaseD} L ${point.x} ${point.y}`);
            break;
    }

    // добавляем элемент в группу и активируем режим добавления
    group.appendChild(el);
    addModeActive = true;
    addModeType = currentAddElement;
    addModeStart = point;
    addModePreview = el;

    try {
        e.target.setPointerCapture(e.pointerId);
    } catch (err) {}

    if (svgCanvas) {
        svgCanvas.addEventListener("pointermove", onAddModeMove);
        svgCanvas.addEventListener("pointerup", onAddModeUp);
        svgCanvas.addEventListener("pointercancel", onAddModeUp);
        svgCanvas.addEventListener("lostpointercapture", onAddModeUp);
    }

    e.preventDefault();
}

// функция обновления превью элемента при рисовании
function updateAddModePreview(e) {
    if (!addModeActive || !addModePreview || !addModeType) return;
    if (!svgCanvasSvg) return;

    const point = getSvgPoint(e, svgCanvasSvg, getDrawGroup(svgCanvasSvg));
    const dx = point.x - addModeStart.x;
    const dy = point.y - addModeStart.y;

    // обновляем превью в зависимости от типа элемента
    switch (addModeType) {
        case "rect": {
            const x = Math.min(addModeStart.x, point.x);
            const y = Math.min(addModeStart.y, point.y);
            const width = Math.max(1, Math.abs(dx));
            const height = Math.max(1, Math.abs(dy));
            addModePreview.setAttribute("x", x);
            addModePreview.setAttribute("y", y);
            addModePreview.setAttribute("width", width);
            addModePreview.setAttribute("height", height);
            break;
        }
        case "circle": {
            const radius = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            addModePreview.setAttribute("r", radius);
            break;
        }
        case "line": {
            addModePreview.setAttribute("x2", point.x);
            addModePreview.setAttribute("y2", point.y);
            break;
        }
        case "path": {
            addModePreview.setAttribute("d", pathBaseD + ` L ${point.x} ${point.y}`);
            break;
        }
    }
}

// функция завершения рисования в режиме добавления
function finishAddModeDraw(e) {
    if (!addModeActive) return;

    // если элемент слишком маленький то удаляем его
    if (addModePreview) {
        if (addModeType === "rect") {
            const width = parseFloat(addModePreview.getAttribute("width"));
            const height = parseFloat(addModePreview.getAttribute("height"));
            if (width < 1 || height < 1) addModePreview.remove();
        }
        if (addModeType === "circle") {
            const radius = parseFloat(addModePreview.getAttribute("r"));
            if (radius < 1) addModePreview.remove();
        }
    }

    // сбрасываем все переменные режима добавления
    addModeActive = false;
    addModeStart = null;
    addModeType = null;
    addModePreview = null;
    isStickyMode = false;
    lastClickPoint = null;
    pathBaseD = "";

    if (svgCanvas) {
        svgCanvas.removeEventListener("pointermove", onAddModeMove);
        svgCanvas.removeEventListener("pointerup", onAddModeUp);
        svgCanvas.removeEventListener("pointercancel", onAddModeUp);
        svgCanvas.removeEventListener("lostpointercapture", onAddModeUp);
    }

    try {
        e.target.releasePointerCapture(e.pointerId);
    } catch (err) {}
}

// обработчик движения мыши при рисовании в режиме добавления
function onAddModeMove(e) {
    if (!addModeActive) return;
    updateAddModePreview(e);
}

// обработчик отпускания кнопки мыши при рисовании в режиме добавления
function onAddModeUp(e) {
    if (!addModeActive) return;

    const duration = Date.now() - pressStartTime;

    // если быстро нажато то оно было приявязанно к мышки
    if (duration < 200 && !isStickyMode) {
        isStickyMode = true;
        return;
    }

    // при отжатие остаонвалвовалось только если это обычное зажатие и перетаскивание
    if (!isStickyMode) {
        finishAddModeDraw(e);
    }
}

// переключение режима на добавление
function setAddMode(btn, item) {
    modeSvgEditor = "add";
    currentAddElement = item.type;
    activeButton(btn);
}

// подключение обработчиков режима добавления
for (const item of addModeTab) {
    const btn = document.getElementById(item.id);
    if (!btn) continue;
    btn.addEventListener("click", () => setAddMode(btn, item));
}