// === Синхронизация значений геометрии элементов ===

const inputX = document.getElementById("svgPropX");
const inputY = document.getElementById("svgPropY");
const inputW = document.getElementById("svgPropW");
const inputH = document.getElementById("svgPropH");
const inputR = document.getElementById("svgPropR");
const inputX1 = document.getElementById("svgPropX1");
const inputY1 = document.getElementById("svgPropY1");
const inputX2 = document.getElementById("svgPropX2");
const inputY2 = document.getElementById("svgPropY2");
const inputD = document.getElementById("svgPropD");

// Обновление SVG при изменении базовых инпутов
function onGeometryInputChange(e) {
    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return;
    
    const id = e.target.id;
    const val = e.target.value;

    selectedElementsSvg.forEach(el => {
        const tag = el.tagName.toLowerCase();

        if (["rect", "image", "foreignObject"].includes(tag)) {
            if (id === "svgPropX") el.setAttribute("x", val);
            if (id === "svgPropY") el.setAttribute("y", val);
            if (id === "svgPropW") el.setAttribute("width", val);
            if (id === "svgPropH") el.setAttribute("height", val);
        } else if (tag === "circle") {
            if (id === "svgPropX") el.setAttribute("cx", val);
            if (id === "svgPropY") el.setAttribute("cy", val);
            if (id === "svgPropR") el.setAttribute("r", val);
        } else if (tag === "line") {
            if (id === "svgPropX1") el.setAttribute("x1", val);
            if (id === "svgPropY1") el.setAttribute("y1", val);
            if (id === "svgPropX2") el.setAttribute("x2", val);
            if (id === "svgPropY2") el.setAttribute("y2", val);
        } else if (tag === "path") {
            if (id === "svgPropD") el.setAttribute("d", val);
        }
    });
}

// Привязываем события стандартным инпутам
[inputX, inputY, inputW, inputH, inputR, inputX1, inputY1, inputX2, inputY2, inputD].forEach(inp => {
    if (inp) inp.addEventListener("input", onGeometryInputChange);
});

// Синхронизация первых двух точек для polyline/polygon через стандартные инпуты
[inputX1, inputY1, inputX2, inputY2].forEach((inp, idx) => {
    if (!inp) return;
    inp.addEventListener("input", (e) => {
        selectedElementsSvg.forEach(el => {
            if (["polyline", "polygon"].includes(el.tagName.toLowerCase())) {
                let pts = (el.getAttribute("points") || "").trim().split(/[\s,]+/).filter(Boolean);
                pts[idx] = e.target.value;
                el.setAttribute("points", pts.join(" "));
            }
        });
    });
});

// Чтение данных из SVG в инпуты
function updateGeometryInputs() {
    // Сначала переключаем видимость блоков свойств
    if (typeof updatePropertiesVisibility === "function") {
        updatePropertiesVisibility();
    }

    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return;
    const firstEl = selectedElementsSvg[0];
    const tag = firstEl.tagName.toLowerCase();

    // Удаляем старые динамические инпуты дополнительных точек, если они есть
    document.querySelectorAll(".dynamic-point-field").forEach(el => el.remove());

    if (["rect", "image", "foreignObject"].includes(tag)) {
        if (inputX) inputX.value = firstEl.getAttribute("x") || 0;
        if (inputY) inputY.value = firstEl.getAttribute("y") || 0;
        if (inputW) inputW.value = firstEl.getAttribute("width") || 0;
        if (inputH) inputH.value = firstEl.getAttribute("height") || 0;
    } else if (tag === "circle") {
        if (inputX) inputX.value = firstEl.getAttribute("cx") || 0;
        if (inputY) inputY.value = firstEl.getAttribute("cy") || 0;
        if (inputR) inputR.value = firstEl.getAttribute("r") || 0;
    } else if (tag === "line") {
        if (inputX1) inputX1.value = firstEl.getAttribute("x1") || 0;
        if (inputY1) inputY1.value = firstEl.getAttribute("y1") || 0;
        if (inputX2) inputX2.value = firstEl.getAttribute("x2") || 0;
        if (inputY2) inputY2.value = firstEl.getAttribute("y2") || 0;
    } else if (["polyline", "polygon"].includes(tag)) {
        const pointsAttr = firstEl.getAttribute("points") || "";
        const points = pointsAttr.trim().split(/[\s,]+/).filter(Boolean);
        
        // Первые 2 точки пишем в стандартные X1, Y1, X2, Y2
        if (inputX1) inputX1.value = points[0] || 0;
        if (inputY1) inputY1.value = points[1] || 0;
        if (inputX2) inputX2.value = points[2] || 0;
        if (inputY2) inputY2.value = points[3] || 0;

        // Для 3-й и последующих точек создаем инпуты на лету перед кнопкой "+"
        const btnAdd = document.getElementById("svgLineAddPoint");
        if (btnAdd) {
            let pointNum = 2;
            for (let i = 4; i < points.length; i += 2) {
                pointNum++;
                const currentIdx = i;

                const div = document.createElement("div");
                div.className = "dynamic-point-field";
                div.innerHTML = `
                    <div>X${pointNum} <input type="number" value="${points[currentIdx] || 0}" data-idx="${currentIdx}"></div>
                    <div>Y${pointNum} <input type="number" value="${points[currentIdx + 1] || 0}" data-idx="${currentIdx + 1}"></div>
                `;

                div.querySelectorAll("input").forEach(dynamicInp => {
                    dynamicInp.addEventListener("input", (e) => {
                        const idx = parseInt(e.target.dataset.idx);
                        selectedElementsSvg.forEach(poly => {
                            if (["polyline", "polygon"].includes(poly.tagName.toLowerCase())) {
                                let pts = (poly.getAttribute("points") || "").trim().split(/[\s,]+/).filter(Boolean);
                                pts[idx] = e.target.value;
                                poly.setAttribute("points", pts.join(" "));
                            }
                        });
                    });
                });

                btnAdd.before(div);
            }
        }
    } else if (tag === "path") {
        if (inputD) inputD.value = firstEl.getAttribute("d") || "";
    }
}