// === Синхронизация значений геометрии элементов ===

const inputX = document.getElementById("svgPropX");
const inputY = document.getElementById("svgPropY");
const inputW = document.getElementById("svgPropW");
const inputH = document.getElementById("svgPropH");
const inputR = document.getElementById("svgPropR");

// Общая карта: какие группы и поля размеров относятся к какому элементу
const elementVisibilityMap = {
    "g": { groups: ["svgGroupPosition"], fields: ["svgPropX", "svgPropY"] },
    "rect": { groups: ["svgGroupPosition", "svgGroupSize"], fields: ["svgPropX", "svgPropY", "svgPropW", "svgPropH"] },
    "circle": { groups: ["svgGroupPosition", "svgGroupSize"], fields: ["svgPropX", "svgPropY", "svgPropR"] },
    "line": { groups: ["svgGroupPosition", "svgGroupLine"], fields: ["svgPropX", "svgPropY", "svgAddNode"] },
    "path": { groups: ["svgGroupPosition", "svgGroupLine"], fields: ["svgPropX", "svgPropY", "svgAddNode"] }
};

// Расчет общего bounding box для группы выделенных элементов
function getSelectionBBox() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    selectedElementsSvg.forEach(el => {
        let x = 0, y = 0, w = 0, h = 0;
        const tag = el.tagName.toLowerCase();
        
        if (tag === "rect") {
            x = parseFloat(el.getAttribute("x")) || 0;
            y = parseFloat(el.getAttribute("y")) || 0;
            w = parseFloat(el.getAttribute("width")) || 0;
            h = parseFloat(el.getAttribute("height")) || 0;
        } else if (tag === "circle") {
            const r = parseFloat(el.getAttribute("r")) || 0;
            x = (parseFloat(el.getAttribute("cx")) || 0) - r;
            y = (parseFloat(el.getAttribute("cy")) || 0) - r;
            w = r * 2;
            h = r * 2;
        } else if (tag === "line") {
            const x1 = parseFloat(el.getAttribute("x1")) || 0;
            const x2 = parseFloat(el.getAttribute("x2")) || 0;
            const y1 = parseFloat(el.getAttribute("y1")) || 0;
            const y2 = parseFloat(el.getAttribute("y2")) || 0;
            x = Math.min(x1, x2);
            y = Math.min(y1, y2);
            w = Math.abs(x2 - x1);
            h = Math.abs(y2 - y1);
        } else {
            try { const box = el.getBBox(); x = box.x; y = box.y; w = box.width; h = box.height; } catch(e) {}
        }
        
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + w > maxX) maxX = x + w;
        if (y + h > maxY) maxY = y + h;
    });

    return minX === Infinity ? { x: 0, y: 0, width: 0, height: 0 } : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Изменение геометрии нескольких элементов относительно общего контура
function applyMultiGeometryChange(id, newVal) {
    const box = getSelectionBBox();
    if (box.width === 0 || box.height === 0) return;

    selectedElementsSvg.forEach(el => {
        const tag = el.tagName.toLowerCase();
        
        if (id === "svgPropX" || id === "svgPropY") {
            const delta = newVal - (id === "svgPropX" ? box.x : box.y);
            if (["rect", "image"].includes(tag)) {
                const attr = id === "svgPropX" ? "x" : "y";
                el.setAttribute(attr, (parseFloat(el.getAttribute(attr)) || 0) + delta);
            } else if (tag === "circle") {
                const attr = id === "svgPropX" ? "cx" : "cy";
                el.setAttribute(attr, (parseFloat(el.getAttribute(attr)) || 0) + delta);
            } else if (tag === "line") {
                if (id === "svgPropX") {
                    el.setAttribute("x1", (parseFloat(el.getAttribute("x1")) || 0) + delta);
                    el.setAttribute("x2", (parseFloat(el.getAttribute("x2")) || 0) + delta);
                } else {
                    el.setAttribute("y1", (parseFloat(el.getAttribute("y1")) || 0) + delta);
                    el.setAttribute("y2", (parseFloat(el.getAttribute("y2")) || 0) + delta);
                }
            }
        } else if (id === "svgPropW" || id === "svgPropH") {
            const ratio = newVal / (id === "svgPropW" ? box.width : box.height);
            if (["rect", "image"].includes(tag)) {
                if (id === "svgPropW") {
                    let x = parseFloat(el.getAttribute("x")) || 0;
                    el.setAttribute("x", box.x + (x - box.x) * ratio);
                    el.setAttribute("width", (parseFloat(el.getAttribute("width")) || 0) * ratio);
                } else {
                    let y = parseFloat(el.getAttribute("y")) || 0;
                    el.setAttribute("y", box.y + (y - box.y) * ratio);
                    el.setAttribute("height", (parseFloat(el.getAttribute("height")) || 0) * ratio);
                }
            } else if (tag === "circle") {
                let cx = parseFloat(el.getAttribute("cx")) || 0;
                let cy = parseFloat(el.getAttribute("cy")) || 0;
                let r = parseFloat(el.getAttribute("r")) || 0;
                if (id === "svgPropW") {
                    el.setAttribute("cx", box.x + (cx - box.x) * ratio);
                    el.setAttribute("r", r * ratio);
                } else {
                    el.setAttribute("cy", box.y + (cy - box.y) * ratio);
                    el.setAttribute("r", r * ratio);
                }
            }
        }
    });
}

// Получение общих групп и полей для всего выделения
function getVisibilityConfigForSelection() {
    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return null;

    // Собираем массив тегов всех элементов
    const tags = selectedElementsSvg
        .map(el => el.localName ? el.localName.toLowerCase() : el.tagName ? el.tagName.toLowerCase() : null)
        .filter(Boolean);
    if (!tags.length) return null;

    // Базовый конфиг первого элемента
    const firstConfig = elementVisibilityMap[tags[0]];
    if (!firstConfig) return null;

    // Для одного элемента возвращаем его свойства
    if (tags.length === 1) {
        return { groups: firstConfig.groups || [], fields: firstConfig.fields || [] };
    }

    // Ищем только общие группы для всех тегов
    const commonGroups = tags.slice(1).reduce((common, tag) => {
        const config = elementVisibilityMap[tag] || { groups: [], fields: [] };
        return common.filter(id => config.groups && config.groups.includes(id));
    }, [...firstConfig.groups || []]);

    // Ищем только общие поля для всех тегов
    const commonFields = tags.slice(1).reduce((common, tag) => {
        const config = elementVisibilityMap[tag] || { groups: [], fields: [] };
        return common.filter(id => config.fields && config.fields.includes(id));
    }, [...firstConfig.fields || []]);

    return { groups: commonGroups, fields: commonFields };
}

// Переключение видимости блоков свойств на основе выделения
function updatePropertiesVisibility() {
    const allGroupIds = new Set();
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
        if (group) group.style.display = "grid";
    });
    (config.fields || []).forEach(fId => {
        const el = document.getElementById(fId);
        if (el && el.parentNode) el.parentNode.style.display = "grid";
    });

    // Если группа содержит поля, но ни одно из них не видно, скрываем группу.
    (config.groups || []).forEach(gId => {
        const group = document.getElementById(gId);
        if (!group) return;

        const groupFields = Array.from(group.querySelectorAll("input[id], select[id], textarea[id]"))
            .map(el => el.id)
            .filter(id => allFieldIds.has(id));

        if (groupFields.length === 0) return; // в группе нет полей, оставляем её

        const visibleFieldExists = groupFields.some(fieldId => {
            const fieldEl = document.getElementById(fieldId);
            return fieldEl && fieldEl.parentNode && fieldEl.parentNode.style.display !== "none";
        });

        if (!visibleFieldExists) {
            group.style.display = "none";
        }
    });
}

// Обновление SVG при изменении базовых инпутов
function onGeometryInputChange(e) {
    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return;
    
    const id = e.target.id;
    const val = parseFloat(e.target.value) || 0;

    if (selectedElementsSvg.length > 1) {
        applyMultiGeometryChange(id, val);
        return;
    }

    const el = selectedElementsSvg[0];
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
    }
}

// Привязываем события стандартным инпутам
[inputX, inputY, inputW, inputH, inputR].forEach(inp => {
    if (inp) inp.addEventListener("input", onGeometryInputChange);
});

document.addEventListener("click", () => { updatePropertiesVisibility(); });

requestAnimationFrame(() => {
    updateGeometryInputs();
});

// Чтение данных из SVG в инпуты
function updateGeometryInputs() {
    updatePropertiesVisibility();

    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return;
    
    document.querySelectorAll(".dynamic-node-field").forEach(el => el.remove());

    if (selectedElementsSvg.length > 1) {
        const box = getSelectionBBox();
        if (inputX) inputX.value = Math.round(box.x);
        if (inputY) inputY.value = Math.round(box.y);
        if (inputW) inputW.value = Math.round(box.width);
        if (inputH) inputH.value = Math.round(box.height);
        return;
    }

    const firstEl = selectedElementsSvg[0];
    const tag = firstEl.tagName.toLowerCase();

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
        const pts = ["1", "2"];
        pts.forEach((p, idx) => {
            const div = document.createElement("div");
            div.className = "dynamic-node-field";
            div.innerHTML = `
                <button class="node-remove-btn">-</button>
                X <input type="number" class="node-x" value="${firstEl.getAttribute("x" + p) || 0}">
                Y <input type="number" class="node-y" value="${firstEl.getAttribute("y" + p) || 0}">
            `;
            div.querySelector(".node-x").addEventListener("input", (e) => firstEl.setAttribute("x" + p, e.target.value));
            div.querySelector(".node-y").addEventListener("input", (e) => firstEl.setAttribute("y" + p, e.target.value));
            div.querySelector(".node-remove-btn").addEventListener("click", () => { firstEl.remove(); updateGeometryInputs(); });
        });
    } else if (tag === "path") {
        const dAttr = firstEl.getAttribute("d") || "";
        const commands = dAttr.match(/[a-df-z][^a-df-z]*/ig) || [];
        
        commands.forEach((cmd, i) => {
            const div = document.createElement("div");
            div.className = "dynamic-node-field";
            div.innerHTML = `
                <button class="node-remove-btn">-</button>
                <input type="text" class="node-cmd" value="${cmd.trim()}">
            `;
            div.querySelector(".node-cmd").addEventListener("input", (e) => {
                commands[i] = e.target.value;
                firstEl.setAttribute("d", commands.join(" "));
            });
            div.querySelector(".node-remove-btn").addEventListener("click", () => {
                commands.splice(i, 1);
                firstEl.setAttribute("d", commands.join(" "));
                updateGeometryInputs();
            });
        });
    }
}