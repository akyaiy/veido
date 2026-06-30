// === Общие ===

// Общая карта: какие группы и поля размеров относятся к какому элементу
const elementVisibilityMap = {
    "-": { groups: ["svgGroupPosition"], fields: ["svgPropX", "svgPropY"] },
    "g": { groups: ["svgGroupPosition"], fields: ["svgPropX", "svgPropY"] },
    "rect": { groups: ["svgGroupPosition", "svgGroupSize"], fields: ["svgPropX", "svgPropY", "svgPropW", "svgPropH"] },
    "circle": { groups: ["svgGroupPosition", "svgGroupSize"], fields: ["svgPropX", "svgPropY", "svgPropR"] },
    "line": { groups: ["svgGroupPosition", "svgGroupSize"], fields: ["svgPropX", "svgPropY", "svgPropW", "svgPropH"] },
    "path": { groups: ["svgGroupPosition"], fields: ["svgPropX", "svgPropY"] }
};

// Заменили нестабильные CSS-селекторы на текстовые ключи
const elementVisibilityMapSpec = {
    "single-node": { groups: ["svgGroupPosition"], fields: ["svgPropX", "svgPropY"] },
    "multi-nodes": { groups: ["svgGroupPathType"], fields: ["svgPathType"] }
};

// Группы
const svgGroupPosition = document.getElementById("svgGroupPosition");
const svgGroupSize = document.getElementById("svgGroupSize");
const svgGroupPathType = document.getElementById("svgGroupPathType");

// Инпуты
const inputX = document.getElementById("svgPropX");
const inputY = document.getElementById("svgPropY");
const inputW = document.getElementById("svgPropW");
const inputH = document.getElementById("svgPropH");
const inputR = document.getElementById("svgPropR");
const inputPathType = document.getElementById("svgPathType");

// Кнопки
const btnAddNode = document.getElementById("svgAddNode");



// === Геометрия и трансформации ===

// Расчет общего bounding box для группы выделенных элементов
function getSelectionBBox() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    selectedElementsSvg.forEach(el => {
        try {
            // Он возвращает локальные координаты элемента до применения трансформаций
            const bbox = el.getBBox();
            
            // Получаем полную консолидированную матрицу трансформаций элемента
            const m = el.transform?.baseVal.numberOfItems > 0 
                ? el.transform.baseVal.consolidate().matrix 
                : el.ownerSVGElement.createSVGMatrix();
            
            // Берём 4 угла локального bounding box'а
            const corners = [
                { x: bbox.x, y: bbox.y },
                { x: bbox.x + bbox.width, y: bbox.y },
                { x: bbox.x, y: bbox.y + bbox.height },
                { x: bbox.x + bbox.width, y: bbox.y + bbox.height }
            ];
            
            // Пересчитываем каждый угол через матрицу в координаты холста (0,0)
            corners.forEach(p => {
                const tx = p.x * m.a + p.y * m.c + m.e;
                const ty = p.x * m.b + p.y * m.d + m.f;
                
                if (tx < minX) minX = tx;
                if (ty < minY) minY = ty;
                if (tx > maxX) maxX = tx;
                if (ty > maxY) maxY = ty;
            });
        } catch (e) {
            // Защита на случай, если какой-то элемент ещё не отрендерен в DOM
        }
    });

    // Если ничего не выделено, возвращаем нули, иначе — точный общий габаритный контейнер
    return minX === Infinity 
        ? { x: 0, y: 0, width: 0, height: 0 } 
        : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Изменение геометрии нескольких элементов относительно общего контура
function applyMultiGeometryChange(id, newVal) {
    const box = getSelectionBBox();
    if (box.width === 0 || box.height === 0) return;

    const dX = id === "svgPropX" ? (newVal - box.x) : 0;
    const dY = id === "svgPropY" ? (newVal - box.y) : 0;

    selectedElementsSvg.forEach(el => {
        const tag = el.tagName.toLowerCase();
        let m = el.transform?.baseVal.numberOfItems > 0 
            ? el.transform.baseVal.consolidate().matrix 
            : el.ownerSVGElement.createSVGMatrix();
        
        if (id === "svgPropX" || id === "svgPropY") {
            el.setAttribute("transform", `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e + dX} ${m.f + dY})`);
        } else if (id === "svgPropW" || id === "svgPropH" || id === "svgPropR") {
            const targetAbs = Math.abs(newVal);
            const targetSign = Math.sign(newVal) || 1;

            if (["rect", "image", "foreignObject"].includes(tag)) {
                if (id === "svgPropW") {
                    const currentAbsScaleX = Math.sqrt(m.a * m.a + m.b * m.b) || 1;
                    el.setAttribute("width", targetAbs / currentAbsScaleX);
                    if (targetSign !== Math.sign(m.a)) { m.a = -m.a; m.b = -m.b; }
                } else if (id === "svgPropH") {
                    const currentAbsScaleY = Math.sqrt(m.c * m.c + m.d * m.d) || 1;
                    el.setAttribute("height", targetAbs / currentAbsScaleY);
                    if (targetSign !== Math.sign(m.d)) { m.c = -m.c; m.d = -m.d; }
                }
                el.setAttribute("transform", `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
            } else if (tag === "circle") {
                const currentAbsScale = Math.sqrt(m.a * m.a + m.b * m.b) || 1;
                el.setAttribute("r", targetAbs / currentAbsScale);
                if (targetSign !== Math.sign(m.a)) {
                    m.a = -m.a; m.b = -m.b; m.c = -m.c; m.d = -m.d;
                    el.setAttribute("transform", `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
                }
            }
        }
    });
    
    document.dispatchEvent(new CustomEvent("svgElementsChanged"));
}

// Обновление SVG при изменении базовых инпутов (с поддержкой смены знака +/-)
function onGeometryInputChange(e) {
    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return;
    
    const id = e.target.id;
    let val = parseFloat(e.target.value);
    if (isNaN(val)) return;

    if (selectedElementsSvg.length > 1) {
        applyMultiGeometryChange(id, val);
        return;
    }

    const el = selectedElementsSvg[0];
    const tag = el.tagName.toLowerCase();

    document.dispatchEvent(new CustomEvent("svgElementsChanged"));

    if (["svgPropX", "svgPropY"].includes(id)) {
        // передаем true, чтобы получить один DOM-элемент, если он активен
        const spec = getSpecConfig(document.querySelector("#svgCanvas svg > g:nth-child(3)"), true);
        
        if (spec && typeof spec === "object") { // Проверка, что вернулся именно элемент
            const specTag = spec.tagName.toLowerCase();
            const nodeIndex = parseInt(spec.getAttribute("data-path-index"));
            
            const contentLayer = document.querySelector("#svgCanvas svg > g:nth-child(2)");
            const layerCTM = contentLayer.getCTM();
            const inv = layerCTM?.inverse();

            // 1. Получаем текущие экранные координаты маркера
            let currentScreenX = 0;
            let currentScreenY = 0;

            if (["rect", "image", "foreignObject"].includes(specTag)) {
                currentScreenX = parseFloat(spec.getAttribute("x")) || 0;
                currentScreenY = parseFloat(spec.getAttribute("y")) || 0;
            } else if (specTag === "circle") {
                currentScreenX = parseFloat(spec.getAttribute("cx")) || 0;
                currentScreenY = parseFloat(spec.getAttribute("cy")) || 0;
            } else if (specTag === "line") {
                currentScreenX = parseFloat(spec.getAttribute("x1")) || 0;
                currentScreenY = parseFloat(spec.getAttribute("y1")) || 0;
            }

            // 2. Переводим текущий маркер в логические координаты сцены, чтобы узнать положение неизменяемой оси
            const ptCurrent = spec.ownerSVGElement.createSVGPoint();
            ptCurrent.x = currentScreenX;
            ptCurrent.y = currentScreenY;
            const logicalCurrent = inv ? ptCurrent.matrixTransform(inv) : ptCurrent;

            // 3. Формируем новую точку: берем val для изменяемой оси и текущее значение для неизменяемой
            const ptNew = spec.ownerSVGElement.createSVGPoint();
            ptNew.x = id === "svgPropX" ? val : logicalCurrent.x;
            ptNew.y = id === "svgPropY" ? val : logicalCurrent.y;
            
            // Переводим обратно в экранные координаты для обновления самого маркера
            const screenPt = ptNew.matrixTransform(layerCTM);
            
            if (id === "svgPropX") {
                if (["rect", "image", "foreignObject"].includes(specTag)) spec.setAttribute("x", screenPt.x);
                else if (specTag === "circle") spec.setAttribute("cx", screenPt.x);
            } else if (id === "svgPropY") {
                if (["rect", "image", "foreignObject"].includes(specTag)) spec.setAttribute("y", screenPt.y);
                else if (specTag === "circle") spec.setAttribute("cy", screenPt.y);
            }

            // 4. САМОЕ ВАЖНОЕ: Меняем геометрию основного элемента (path), которому принадлежит этот узел
            if (tag === "path" && !isNaN(nodeIndex)) {
                const dAttr = el.getAttribute("d") || "";
                
                // Ищем все пары координат (X и Y) в строке path
                const coordRegex = /(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g;
                let matches = [];
                let match;
                
                while ((match = coordRegex.exec(dAttr)) !== null) {
                    matches.push({
                        text: match[0],
                        x: parseFloat(match[1]),
                        y: parseFloat(match[2]),
                        index: match.index
                    });
                }

                // Если нашли нужную точку по индексу — меняем её в строке d
                if (matches[nodeIndex]) {
                    const targetMatch = matches[nodeIndex];
                    const newX = id === "svgPropX" ? val : targetMatch.x;
                    const newY = id === "svgPropY" ? val : targetMatch.y;
                    
                    const updatedD = dAttr.substring(0, targetMatch.index) + 
                                     `${newX} ${newY}` + 
                                     dAttr.substring(targetMatch.index + targetMatch.text.length);
                    
                    el.setAttribute("d", updatedD);
                }
            }

            document.dispatchEvent(new CustomEvent("svgElementsChanged"));
            return;
        }

        let currentVisX = 0, currentVisY = 0;

        if (["rect", "image", "foreignObject"].includes(tag)) {
            const pt = getVisualPoint(el, parseFloat(el.getAttribute("x")) || 0, parseFloat(el.getAttribute("y")) || 0);
            currentVisX = pt.x; currentVisY = pt.y;
        } else if (tag === "circle") {
            const pt = getVisualPoint(el, parseFloat(el.getAttribute("cx")) || 0, parseFloat(el.getAttribute("cy")) || 0);
            currentVisX = pt.x; currentVisY = pt.y;
        } else if (tag === "line") {
            const pt = getVisualPoint(el, parseFloat(el.getAttribute("x1")) || 0, parseFloat(el.getAttribute("y1")) || 0);
            currentVisX = pt.x; currentVisY = pt.y;
        } else {
            const box = getTransformedBBox(el);
            currentVisX = box.x; currentVisY = box.y;
        }

        const dx = (id === "svgPropX") ? (val - currentVisX) : 0;
        const dy = (id === "svgPropY") ? (val - currentVisY) : 0;

        let m = el.transform?.baseVal.numberOfItems > 0 ? el.transform.baseVal.consolidate().matrix : el.ownerSVGElement.createSVGMatrix();
        el.setAttribute("transform", `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e + dx} ${m.f + dy})`);
        
        document.dispatchEvent(new CustomEvent("svgElementsChanged"));
        return;
    }

    if (["svgPropW", "svgPropH", "svgPropR"].includes(id)) {
        let m = el.transform?.baseVal.numberOfItems > 0 ? el.transform.baseVal.consolidate().matrix : el.ownerSVGElement.createSVGMatrix();
        
        const targetAbs = Math.abs(val);       
        const targetSign = Math.sign(val) || 1; 

        if (["rect", "image", "foreignObject"].includes(tag)) {
            const rectX = parseFloat(el.getAttribute("x")) || 0;
            const rectY = parseFloat(el.getAttribute("y")) || 0;
            const rectW = parseFloat(el.getAttribute("width")) || 0;
            const rectH = parseFloat(el.getAttribute("height")) || 0;

            if (id === "svgPropW") {
                const currentScaleX = m.a || 1; 
                el.setAttribute("width", targetAbs / Math.abs(currentScaleX));
                
                if (targetSign !== Math.sign(currentScaleX)) {
                    m.a = -m.a; m.b = -m.b;
                    m.e += Math.sign(currentScaleX) * (2 * rectX) * Math.abs(currentScaleX);
                }
            } else if (id === "svgPropH") {
                const currentScaleY = m.d || 1;
                el.setAttribute("height", targetAbs / Math.abs(currentScaleY));
                
                if (targetSign !== Math.sign(currentScaleY)) {
                    m.c = -m.c; m.d = -m.d;
                    m.f += Math.sign(currentScaleY) * (2 * rectY) * Math.abs(currentScaleY);
                }
            }
            el.setAttribute("transform", `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
        } else if (tag === "circle") {
            if (id === "svgPropR") {
                const currentAbsScaleX = Math.sqrt(m.a * m.a + m.b * m.b) || 1;
                el.setAttribute("r", targetAbs / currentAbsScaleX);
                
                if (targetSign !== Math.sign(m.a)) {
                    m.a = -m.a; m.b = -m.b; m.c = -m.c; m.d = -m.d;
                }
                el.setAttribute("transform", `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
            }

        } else if (tag === "line") {
            const currentX2 = parseFloat(el.getAttribute("x2")) || 0;
            const currentY2 = parseFloat(el.getAttribute("y2")) || 0;
            const p2 = getVisualPoint(el, currentX2, currentY2);
            
            const targetVisualX = (id === "svgPropW") ? val : p2.x;
            const targetVisualY = (id === "svgPropH") ? val : p2.y;

            try {
                const inv = m.inverse();
                const localX2 = targetVisualX * inv.a + targetVisualY * inv.c + inv.e;
                const localY2 = targetVisualX * inv.b + targetVisualY * inv.d + inv.f;
                el.setAttribute("x2", localX2);
                el.setAttribute("y2", localY2);
            } catch(err) {
                if (id === "svgPropW") el.setAttribute("x2", val);
                if (id === "svgPropH") el.setAttribute("y2", val);
            }

        } else {
            const box = getTransformedBBox(el);
            const currentW = box.width || 1;
            const currentH = box.height || 1;
            
            const factorX = (id === "svgPropW") ? (val / currentW) : 1;
            const factorY = (id === "svgPropH") ? (val / currentH) : 1;

            const newA = factorX * m.a;
            const newB = factorY * m.b;
            const newC = factorX * m.c;
            const newD = factorY * m.d;
            const newE = factorX * m.e + box.x * (1 - factorX);
            const newF = factorY * m.f + box.y * (1 - factorY);

            el.setAttribute("transform", `matrix(${newA} ${newB} ${newC} ${newD} ${newE} ${newF})`);
        }
        
        document.dispatchEvent(new CustomEvent("svgElementsChanged"));
    }
}

[inputX, inputY, inputW, inputH, inputR, svgPathType].forEach(inp => {
    if (!inp) return;

    inp.addEventListener("blur", onGeometryInputChange);

    inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            inp.blur();
        }
    });
});



// === Изменение типа искревления ===

// Функция изменения типа искривления path-сегмента
function onPathTypeChange(e) {
    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return;

    const el = selectedElementsSvg[0];
    if (!el || el.tagName.toLowerCase() !== "path") return;

    const newType = e.target.value;
    const idx = window.lastActiveEdgeIndex;
    if (idx == null) return;

    // Парсим строку "d" в удобный массив объектов сегментов
    const segments = parsePathData(el.getAttribute("d") || "");
    if (!segments[idx]) return;

    const targetSegment = segments[idx];
    const prevSegment = segments[idx - 1] || { x: 0, y: 0 };

    // Конечная точка сегмента должна остаться прежней
    const x = typeof targetSegment.x === "number" ? targetSegment.x : prevSegment.x;
    const y = typeof targetSegment.y === "number" ? targetSegment.y : prevSegment.y;

    // Создаем новый чистый объект сегмента под выбранный тип
    let updatedSegment = { type: newType };

    if (newType === "Z" || newType === "z") {
        // Для замыкания контура координаты не нужны
    } else {
        updatedSegment.x = x;
        updatedSegment.y = y;

        // Если переключаем на Квадратичную кривую (Q)
        if (newType === "Q" || newType === "q") {
            // Ставим контрольную точку ровно по центру отрезка
            updatedSegment.x1 = targetSegment.x1 ?? (prevSegment.x + x) / 2;
            updatedSegment.y1 = targetSegment.y1 ?? (prevSegment.y + y) / 2;
            
        // Если переключаем на Кубическую кривую (C)
        } else if (newType === "C" || newType === "c") {
            // Распределяем две контрольные точки на 1/3 и 2/3 длины отрезка
            updatedSegment.x1 = targetSegment.x1 ?? (prevSegment.x + (x - prevSegment.x) / 3);
            updatedSegment.y1 = targetSegment.y1 ?? (prevSegment.y + (y - prevSegment.y) / 3);
            updatedSegment.x2 = targetSegment.x2 ?? (prevSegment.x + 2 * (x - prevSegment.x) / 3);
            updatedSegment.y2 = targetSegment.y2 ?? (prevSegment.y + 2 * (y - prevSegment.y) / 3);
        }
    }

    // Заменяем сегмент в массиве и собираем строку обратно
    segments[idx] = updatedSegment;
    el.setAttribute("d", serializePathData(segments));

    // Обновляем рамку выделения, если функция существует в редакторе
    if (typeof updateSelectionBox === "function") {
        updateSelectionBox();
    }

    document.dispatchEvent(new CustomEvent("svgElementsChanged"));
}

// Подключение обработчика к input/select изменения типа сегмента
svgPathType.addEventListener("change", onPathTypeChange);


// === Интерфейс ===

// Обновление значений инпутов на основе выделенного элемента и его трансформаций
function updateGeometryInputs() {
    updatePropertiesVisibility();

    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return;
    
    document.querySelectorAll(".dynamicNodeField").forEach(el => el.remove());

    // Обработка множественного выбора
    if (selectedElementsSvg.length > 1) {
        const box = getSelectionBBox();
        if (inputX) inputX.value = box.x.toFixed(1);
        if (inputY) inputY.value = box.y.toFixed(1);
        if (inputW) inputW.value = box.width.toFixed(1);
        if (inputH) inputH.value = box.height.toFixed(1);
        return;
    }

    // получаем реальный узел только для одиночного активного маркера
    const spec = getSpecConfig(document.querySelector("#svgCanvas svg > g:nth-child(3)"), true);
    let tag;

    if (spec && typeof spec === "object") {

        const layer = document.querySelector("#svgCanvas svg > g:nth-child(2)");
        const layerCTM = layer.getCTM();
        const inv = layerCTM?.inverse();
        
        const pt = spec.ownerSVGElement.createSVGPoint();
        tag = spec.tagName.toLowerCase();

        if (["rect", "image", "foreignObject"].includes(tag)) {
            pt.x = parseFloat(spec.getAttribute("x")) || 0;
            pt.y = parseFloat(spec.getAttribute("y")) || 0;
        } else if (tag === "circle") {
            pt.x = parseFloat(spec.getAttribute("cx")) || 0;
            pt.y = parseFloat(spec.getAttribute("cy")) || 0;
        } else if (tag === "line") {
            pt.x = parseFloat(spec.getAttribute("x1")) || 0;
            pt.y = parseFloat(spec.getAttribute("y1")) || 0;
        }

        const p = inv ? pt.matrixTransform(inv) : pt;
        if (inputX) inputX.value = p.x.toFixed(1);
        if (inputY) inputY.value = p.y.toFixed(1);

        return;
    }

    // Обработка обычных элементов сцены (logical document coordinates)
    const firstEl = selectedElementsSvg[0];
    tag = firstEl.tagName.toLowerCase();

    // Отображение типа выбранного сегмента path
    if (tag === "path" && inputPathType && window.lastActiveEdgeIndex != null) {
        const segments = parsePathData(firstEl.getAttribute("d") || "");

        if (segments[window.lastActiveEdgeIndex]) {
            inputPathType.value = segments[window.lastActiveEdgeIndex].type;
        }
    }

    // Обработка стандартных SVG-элементов
    if (["rect", "image", "foreignObject"].includes(tag)) {
        const x = parseFloat(firstEl.getAttribute("x")) || 0;
        const y = parseFloat(firstEl.getAttribute("y")) || 0;
        const pt = getVisualPoint(firstEl, x, y);
        
        // Учитываем визуальное растяжение (scale)
        let scaleX = 1, scaleY = 1;
        if (firstEl.transform?.baseVal.numberOfItems > 0) {
            const m = firstEl.transform.baseVal.consolidate().matrix;
            scaleX = m.a; 
            scaleY = m.d;
        }
        
        const w = (parseFloat(firstEl.getAttribute("width")) || 0) * scaleX;
        const h = (parseFloat(firstEl.getAttribute("height")) || 0) * scaleY;

        if (inputX) inputX.value = pt.x.toFixed(1);
        if (inputY) inputY.value = pt.y.toFixed(1);
        if (inputW) inputW.value = w.toFixed(1);
        if (inputH) inputH.value = h.toFixed(1);

    } else if (tag === "circle") {
        const cx = parseFloat(firstEl.getAttribute("cx")) || 0;
        const cy = parseFloat(firstEl.getAttribute("cy")) || 0;
        const pt = getVisualPoint(firstEl, cx, cy);
        
        let scaleAvg = 1;
        if (firstEl.transform?.baseVal.numberOfItems > 0) {
            const m = firstEl.transform.baseVal.consolidate().matrix;
            scaleAvg = (m.a + m.d) / 2; 
        }
        const r = (parseFloat(firstEl.getAttribute("r")) || 0) * scaleAvg;

        if (inputX) inputX.value = pt.x.toFixed(1);
        if (inputY) inputY.value = pt.y.toFixed(1);
        if (inputR) inputR.value = r.toFixed(1);

    } else if (tag === "line") {
        // Линия использует X/Y для первой точки и W/H для второй
        const x1 = parseFloat(firstEl.getAttribute("x1")) || 0;
        const y1 = parseFloat(firstEl.getAttribute("y1")) || 0;
        const p1 = getVisualPoint(firstEl, x1, y1);
        
        const x2 = parseFloat(firstEl.getAttribute("x2")) || 0;
        const y2 = parseFloat(firstEl.getAttribute("y2")) || 0;
        const p2 = getVisualPoint(firstEl, x2, y2);

        if (inputX) inputX.value = p1.x.toFixed(1);
        if (inputY) inputY.value = p1.y.toFixed(1);
        if (inputW) inputW.value = p2.x.toFixed(1);
        if (inputH) inputH.value = p2.y.toFixed(1);

    } else {
        // Обработка сложных элементов (path, g) через трансформированный BBox
        const box = getTransformedBBox(firstEl);
        
        if (inputX) inputX.value = box.x.toFixed(1);
        if (inputY) inputY.value = box.y.toFixed(1);
        if (inputW) inputW.value = box.width.toFixed(1);
        if (inputH) inputH.value = box.height.toFixed(1);
    }
}

updateGeometryInputs();

document.addEventListener("svgSelectionChanged", () => {
    setTimeout(() => {
        updateGeometryInputs();
    }, 10);
});

// Получает визуальные координаты точки с учетом трансформаций элемента
function getVisualPoint(el, x, y) {
    if (el.transform && el.transform.baseVal.numberOfItems > 0) {
        const m = el.transform.baseVal.consolidate().matrix;
        return {
            x: x * m.a + y * m.c + m.e,
            y: x * m.b + y * m.d + m.f
        };
    }
    return { x, y };
}

// Получение BBox элемента с учетом его трансформаций 
function getTransformedBBox(el) {
    try {
        const bbox = el.getBBox();
        if (!el.transform || el.transform.baseVal.numberOfItems === 0) return bbox;
        
        const m = el.transform.baseVal.consolidate().matrix;
        // Умножаем 4 угла BBox на матрицу
        const pts = [
            { x: bbox.x, y: bbox.y },
            { x: bbox.x + bbox.width, y: bbox.y },
            { x: bbox.x, y: bbox.y + bbox.height },
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height }
        ];
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        pts.forEach(p => {
            const px = p.x * m.a + p.y * m.c + m.e;
            const py = p.x * m.b + p.y * m.d + m.f;
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
        });
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    } catch (e) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }
}



// === Видимость интерфейса ===

// Получение общих групп и полей для всего выделения
function getVisibilityConfigForSelection() {
    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return null;

    // Получаем строковый ключ состояния вместо поиска селектором matches
    const specKey = getSpecConfig(document.querySelector("#svgCanvas svg > g:nth-child(3)"));
    if (specKey && elementVisibilityMapSpec[specKey]) {
        return elementVisibilityMapSpec[specKey];
    }

    const tags = selectedElementsSvg
        .map(el => el.localName ? el.localName.toLowerCase() : el.tagName ? el.tagName.toLowerCase() : null)
        .filter(Boolean);
    if (!tags.length) return null;

    const firstConfig = elementVisibilityMap[tags[0]] || elementVisibilityMap["-"]
    if (!firstConfig) return null;

    if (tags.length === 1) {
        return { groups: firstConfig.groups || [], fields: firstConfig.fields || [] };
    }

    const commonGroups = tags.slice(1).reduce((common, tag) => {
        const config = elementVisibilityMap[tag] || elementVisibilityMap["-"] || { groups: [], fields: [] };
        return common.filter(id => config.groups && config.groups.includes(id));
    }, [...firstConfig.groups || []]);

    const commonFields = tags.slice(1).reduce((common, tag) => {
        const config = elementVisibilityMap[tag] || elementVisibilityMap["-"] || { groups: [], fields: [] };
        return common.filter(id => config.fields && config.fields.includes(id));
    }, [...firstConfig.fields || []]);

    return { groups: commonGroups, fields: commonFields };
}

// Теперь функция считает количество [data-active='1'] и возвращает нужный флаг/узел
function getSpecConfig(el, returnSingleNode = false) {
    if (!el) return null;

    const activeNodes = el.querySelectorAll("*[data-active='1']");
    
    if (activeNodes.length === 1) {
        if (returnSingleNode) return activeNodes[0];
        return "single-node";
    }
    
    if (activeNodes.length > 1) {
        return "multi-nodes";
    }

    return null;
}

// Переключение видимости блоков свойств на основе выделения
function updatePropertiesVisibility() {
    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return null;
    
    const allGroupIds = new Set(["svgGroupPathType"]);
    const allFieldIds = new Set();

    Object.values(elementVisibilityMap).forEach(config => {
        (config.groups || []).forEach(id => allGroupIds.add(id));
        (config.fields || []).forEach(id => allFieldIds.add(id));
    });

    allGroupIds.forEach(id => {
        const group = document.getElementById(id);
        if (group) group.style.display = "none";
    });
    allFieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.parentNode) el.parentNode.style.display = "none";
    });

    const config = getVisibilityConfigForSelection();
    if (!config) return;

    (config.groups || []).forEach(gId => {
        const group = document.getElementById(gId);
        if (group) group.style.display = "flex";
    });
    (config.fields || []).forEach(fId => {
        const el = document.getElementById(fId);
        if (el && el.parentNode) el.parentNode.style.display = "flex";
    });

    (config.groups || []).forEach(gId => {
        const group = document.getElementById(gId);
        if (!group) return;

        const targetFields = config.fields || [];
        const hasVisibleField = targetFields.some(fieldId => {
            const fieldEl = group.querySelector(`#${fieldId}`);
            return fieldEl && fieldEl.parentNode && fieldEl.parentNode.style.display !== "none";
        });

        if (!hasVisibleField && gId !== "svgGroupPathType") {
            group.style.display = "none";
        }
    });
}

document.addEventListener("click", () => { updatePropertiesVisibility(); });