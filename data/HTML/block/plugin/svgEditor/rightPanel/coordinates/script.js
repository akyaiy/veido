// === Общие ===

// Общая карта: какие группы и поля размеров относятся к какому элементу
const elementVisibilityMap = {
    "-": { groups: ["svgGroupPosition"], fields: ["svgPropX", "svgPropY"] },
    "g": { groups: ["svgGroupPosition"], fields: ["svgPropX", "svgPropY"] },
    "rect": { groups: ["svgGroupPosition", "svgGroupSize"], fields: ["svgPropX", "svgPropY", "svgPropW", "svgPropH"] },
    "circle": { groups: ["svgGroupPosition", "svgGroupSize"], fields: ["svgPropX", "svgPropY", "svgPropR"] },
    "line": { groups: ["svgGroupPosition", "svgGroupLine"], fields: ["svgPropX", "svgPropY"] },
    "path": { groups: ["svgGroupPosition", "svgGroupLine"], fields: ["svgPropX", "svgPropY", "svgAddNode"] }
};

// Группы
const svgGroupLine = document.getElementById("svgGroupLine");
const svgGroupPosition = document.getElementById("svgGroupPosition");
const svgGroupSize = document.getElementById("svgGroupSize");

// Инпуты
const inputX = document.getElementById("svgPropX");
const inputY = document.getElementById("svgPropY");
const inputW = document.getElementById("svgPropW");
const inputH = document.getElementById("svgPropH");
const inputR = document.getElementById("svgPropR");

// Кнопки
const btnAddNode = document.getElementById("svgAddNode");



// === Геометрия и трансформации ===

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
            try { 
                const box = el.getBBox(); 
                x = box.x; 
                y = box.y; 
                w = box.width; 
                h = box.height;
                
                // Учитываем текущий translate для точного повторного расчета (для g и path)
                const transform = el.getAttribute("transform") || "";
                const translateRegex = /translate\(([-0-9.]+)(?:[,\s]+([-0-9.]+))?\)/;
                const match = transform.match(translateRegex);
                if (match) {
                    x += parseFloat(match[1]);
                    y += parseFloat(match[2] || 0);
                }
            } catch(e) {}
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

    let vX = Infinity, vY = Infinity;
    selectedElementsSvg.forEach(subEl => {
        const subM = subEl.transform?.baseVal.numberOfItems ? subEl.transform.baseVal.consolidate().matrix : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        const subBox = subEl.getBBox();
        vX = Math.min(vX, subBox.x * subM.a + subM.e);
        vY = Math.min(vY, subBox.y * subM.d + subM.f);
    });

    const dX = id === "svgPropX" ? (newVal - vX) : 0;
    const dY = id === "svgPropY" ? (newVal - vY) : 0;

    selectedElementsSvg.forEach(el => {
        const tag = el.tagName.toLowerCase();
        
        if (id === "svgPropX" || id === "svgPropY") {
            const m = el.transform?.baseVal.numberOfItems ? el.transform.baseVal.consolidate().matrix : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
            if (m) {
                el.setAttribute("transform", `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e + dX} ${m.f + dY})`);
            }
        } else if (id === "svgPropW" || id === "svgPropH" || id === "svgPropR") {
            let scaleX = 1, scaleY = 1;

            try {
                if (el.transform?.baseVal.numberOfItems > 0) {
                    const m = el.transform.baseVal.consolidate().matrix;
                    scaleX = m.a;
                    scaleY = m.d;

                    if (id === "svgPropR" && tag === "circle") {
                        const cx = parseFloat(el.getAttribute("cx")) || 0;
                        const cy = parseFloat(el.getAttribute("cy")) || 0;
                        const avg = (m.a + m.d) / 2;

                        if (avg > 0) {
                            const newE = (cx * m.a + m.e) - (cx * avg);
                            const newF = (cy * m.d + m.f) - (cy * avg);
                            el.setAttribute("transform", `matrix(${avg} 0 0 ${avg} ${newE} ${newF})`);
                            scaleX = avg;
                        }
                    }
                }
            } catch (err) {}

            if (["rect", "image", "foreignObject"].includes(tag)) {
                if (id === "svgPropW" && scaleX > 0) {
                    el.setAttribute("width", newVal / scaleX);
                } else if (id === "svgPropH" && scaleY > 0) {
                    el.setAttribute("height", newVal / scaleY);
                }
            } else if (tag === "circle") {
                if (id === "svgPropR" && scaleX > 0) {
                    el.setAttribute("r", newVal / scaleX);
                } else if (id === "svgPropW") {
                    const currentR = parseFloat(el.getAttribute("r")) || 0;
                    if (currentR > 0 && scaleX > 0) {
                        el.setAttribute("r", (newVal / scaleX) / 2);
                    }
                } else if (id === "svgPropH") {
                    const currentR = parseFloat(el.getAttribute("r")) || 0;
                    if (currentR > 0 && scaleY > 0) {
                        el.setAttribute("r", (newVal / scaleY) / 2);
                    }
                }
            }
        }
    });
    
    // Диспатчим событие для обновления выделения в centerPanel
    document.dispatchEvent(new CustomEvent("svgElementsChanged"));
}

// Обновление SVG при изменении базовых инпутов
function onGeometryInputChange(e) {
    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return;
    
    const id = e.target.id;
    let val = parseFloat(e.target.value) || 0;

    if (selectedElementsSvg.length > 1) {
        applyMultiGeometryChange(id, val);
        // Событие будет диспатчено внутри applyMultiGeometryChange
        return;
    }

    const el = selectedElementsSvg[0];
    const tag = el.tagName.toLowerCase();

    // Стабильное выравнивание масштаба без накопления ошибок трансформаций
    if (["svgPropW", "svgPropH", "svgPropR"].includes(id)) {
        let scaleX = 1, scaleY = 1;

        try {
            if (el.transform?.baseVal.numberOfItems > 0) {
                const m = el.transform.baseVal.consolidate().matrix;
                scaleX = m.a;
                scaleY = m.d;

                if (id === "svgPropR" && tag === "circle") {
                    const cx = parseFloat(el.getAttribute("cx")) || 0;
                    const cy = parseFloat(el.getAttribute("cy")) || 0;
                    const avg = (m.a + m.d) / 2;

                    if (avg > 0) {
                        const newE = (cx * m.a + m.e) - (cx * avg);
                        const newF = (cy * m.d + m.f) - (cy * avg);
                        el.setAttribute("transform", `matrix(${avg} 0 0 ${avg} ${newE} ${newF})`);
                        scaleX = avg;
                    }
                }
            }
        } catch (err) {}

        if (id === "svgPropW" && scaleX > 0) val /= scaleX;
        if (id === "svgPropH" && scaleY > 0) val /= scaleY;
        if (id === "svgPropR" && scaleX > 0) val /= scaleX;
    }

    if (["svgPropX", "svgPropY"].includes(id) && tag !== "g") {
        try {
            const m = el.transform?.baseVal.numberOfItems ? el.transform.baseVal.consolidate().matrix : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
            if (m) {
                const box = el.getBBox();
                
                const visualX = box.x * m.a + m.e;
                const visualY = box.y * m.d + m.f;

                const newE = id === "svgPropX" ? m.e + (val - visualX) : m.e;
                const newF = id === "svgPropY" ? m.f + (val - visualY) : m.f;

                el.setAttribute("transform", `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${newE} ${newF})`);
                // Диспатчим событие для обновления выделения в centerPanel
                document.dispatchEvent(new CustomEvent("svgElementsChanged"));
                return;
            }
        } catch (err) {}
    }

    if (["rect", "image", "foreignObject"].includes(tag)) {
        if (id === "svgPropX") el.setAttribute("x", val);
        if (id === "svgPropY") el.setAttribute("y", val);
        if (id === "svgPropW") el.setAttribute("width", val);
        if (id === "svgPropH") el.setAttribute("height", val);
    } else if (tag === "circle") {
        if (id === "svgPropX") el.setAttribute("cx", val);
        if (id === "svgPropY") el.setAttribute("cy", val);
        if (id === "svgPropR") el.setAttribute("r", val);
    } else if (tag === "g") {
        try {
            const box = el.getBBox();
            const delta = val - (id === "svgPropX" ? box.x : box.y);
            const transform = el.getAttribute("transform") || "";
            const translateRegex = /translate\(([-0-9.]+)(?:[,\s]+([-0-9.]+))?\)/;
            const dX = id === "svgPropX" ? delta : 0;
            const dY = id === "svgPropY" ? delta : 0;
            
            if (translateRegex.test(transform)) {
                el.setAttribute("transform", transform.replace(translateRegex, (m, x, y) => `translate(${parseFloat(x) + dX}, ${(parseFloat(y) || 0) + dY})`));
            } else {
                el.setAttribute("transform", `translate(${dX}, ${dY}) ${transform}`.trim());
            }
        } catch(err) {}
    }

    // Диспатчим событие для обновления выделения в centerPanel
    document.dispatchEvent(new CustomEvent("svgElementsChanged"));
}

[inputX, inputY, inputW, inputH, inputR].forEach(inp => {
    if (inp) inp.addEventListener("input", onGeometryInputChange);
});



// === Интерфейс ===

// Чтение данных из SVG в инпуты
function updateGeometryInputs() {
    updatePropertiesVisibility();

    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return;
    
    document.querySelectorAll(".dynamicNodeField").forEach(el => el.remove());

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
    } else if (tag === "g") {
        // Поддержка чтения координат одиночной группы
        try {
            const box = firstEl.getBBox();
            if (inputX) inputX.value = Math.round(box.x);
            if (inputY) inputY.value = Math.round(box.y);
        } catch (e) {}
    } else if (tag === "line") {
        const pts = [
            { x: firstEl.getAttribute("x1") || "0", y: firstEl.getAttribute("y1") || "0" },
            { x: firstEl.getAttribute("x2") || "0", y: firstEl.getAttribute("y2") || "0" }
        ];
        
        pts.forEach((pt, idx) => {
            const div = document.createElement("div");
            div.className = "dynamicNodeField";
            div.style.cursor = "ns-resize";
            div.draggable = true;
            div.innerHTML = `
                ${idx + 1}
                <input type="text" class="nodeCoords" value="x ${pt.x} y ${pt.y}">
            `;
            
            div.querySelector(".nodeCoords").addEventListener("input", (e) => {
                handleLineInput(firstEl, idx, e.target.value);
                document.dispatchEvent(new CustomEvent("svgElementsChanged"));
            });

            setNodeFieldDragHandlers(div, firstEl, idx, "line");
            
            svgGroupLine.appendChild(div);
        });
    } else if (tag === "path") {
        const dAttr = firstEl.getAttribute("d") || "";
        const commands = dAttr.match(/[a-df-z][^a-df-z]*/ig) || [];
        
        commands.forEach((cmd, i) => {
            const div = document.createElement("div");
            div.className = "dynamicNodeField";
            div.style.cursor = "ns-resize";
            div.draggable = true;
            div.innerHTML = `
                ${i + 1}
                <input type="text" class="nodeCmd" value="${cmd.trim()}">
                <button class="nodeRemoveBtn">×</button>
            `;
            
            div.querySelector(".nodeCmd").addEventListener("input", (e) => {
                handlePathInput(firstEl, commands, i, e.target.value);
                document.dispatchEvent(new CustomEvent("svgElementsChanged"));
            });
            
            div.querySelector(".nodeRemoveBtn").addEventListener("click", () => {
                removePathNode(firstEl, commands, i);
            });

            setNodeFieldDragHandlers(div, firstEl, i, "path", commands);
            svgGroupLine.appendChild(div);
        });

        // Переносим кнопку добавления ноды в самый конец контейнера
        const container = svgGroupLine;
        if (container && btnAddNode) {
            const btnWrapper = btnAddNode.parentNode;
            if (btnWrapper && btnWrapper !== container && btnWrapper.parentNode === container) {
                container.appendChild(btnWrapper);
            }
        }
    } else {
        // Обработка неизвестных элементов по умолчанию - показываем X/Y
        try {
            const box = firstEl.getBBox();
            if (inputX) inputX.value = Math.round(box.x);
            if (inputY) inputY.value = Math.round(box.y);
        } catch (e) {}
    }
}

updateGeometryInputs();

document.addEventListener("svgSelectionChanged", () => {
    updateGeometryInputs();
});


// === Редактирование структуры SVG (точки линии и команды пути) ===

// Изменение координат точки
function handleLineInput(el, idx, value) {
    const match = value.match(/x\s*([-0-9.]+)\s*y\s*([-0-9.]+)/i);
    if (match) {
        el.setAttribute("x" + (idx + 1), match[1]);
        el.setAttribute("y" + (idx + 1), match[2]);
    }
}

// Изменение отдельной команды пути
function handlePathInput(el, commands, i, value) {
    commands[i] = value;
    el.setAttribute("d", commands.join(" "));
}

// Удаление конкретной команды из массива по индексу
function removePathNode(el, commands, i) {
    commands.splice(i, 1);
    el.setAttribute("d", commands.join(" "));
    updateGeometryInputs();
    // Диспатчим событие для обновления выделения в centerPanel
    document.dispatchEvent(new CustomEvent("svgElementsChanged"));
}

// Добавление новой точки в line/path (редактирование структуры SVG)
function addNodeToPathOrLine() {
    if (!selectedElementsSvg || selectedElementsSvg.length !== 1) return;

    const el = selectedElementsSvg[0];
    const tag = el.tagName.toLowerCase();

    if (tag === "line") {
        let i = 1;
        while (el.hasAttribute("x" + i) || el.hasAttribute("y" + i)) {
            i++;
        }
        el.setAttribute("x" + i, "100");
        el.setAttribute("y" + i, "100");
        updateGeometryInputs();
        // Диспатчим событие для обновления выделения в centerPanel
        document.dispatchEvent(new CustomEvent("svgElementsChanged"));
    } else if (tag === "path") {
        const dAttr = el.getAttribute("d") || "";
        const commands = dAttr.match(/[a-df-z][^a-df-z]*/ig) || [];
        commands.push("L 100 100");
        el.setAttribute("d", commands.join(" "));
        updateGeometryInputs();
        // Диспатчим событие для обновления выделения в centerPanel
        document.dispatchEvent(new CustomEvent("svgElementsChanged"));
    }
}

btnAddNode.addEventListener("click", addNodeToPathOrLine);

// Переменные для перетаскивания нод линии и команд пути
let draggedField = null;
let draggedSourceIndex = null;
let draggedTag = null;

// Установка обработчиков для перетаскивания нод линии и команд пути
function setNodeFieldDragHandlers(div, el, index, tag, commands) {
    div.addEventListener("mousedown", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;

        e.preventDefault();

        draggedField = div;
        draggedSourceIndex = index;
        draggedTag = tag;

        div.style.marginTop = "5px";
        div.style.marginBottom = "5px";

        const onMouseMove = (moveEvent) => {
            if (!draggedField) return;

            const container = svgGroupLine;
            const fields = Array.from(container.querySelectorAll(".dynamicNodeField"));

            const targetField = fields.find(field => {
                if (field === draggedField) return false;
                const rect = field.getBoundingClientRect();
                return moveEvent.clientY > rect.top && moveEvent.clientY < rect.bottom;
            });

            if (!targetField) return;

            const currentIdx = fields.indexOf(draggedField);
            const targetIdx = fields.indexOf(targetField);

            if (currentIdx === targetIdx) return;

            if (targetIdx > currentIdx) {
                container.insertBefore(draggedField, targetField.nextSibling);
            } else {
                container.insertBefore(draggedField, targetField);
            }
        };

        const onMouseUp = () => {
            if (!draggedField) return;

            const container = svgGroupLine;
            const fields = Array.from(container.querySelectorAll(".dynamicNodeField"));
            const targetIdx = fields.indexOf(draggedField);

            if (tag === "line") {
                swapLinePoints(el, draggedSourceIndex, targetIdx);
            } else if (tag === "path") {
                swapPathCommands(el, commands, draggedSourceIndex, targetIdx);
            }

            updateGeometryInputs();

            // Диспатчим событие для обновления выделения в centerPanel
            document.dispatchEvent(new CustomEvent("svgElementsChanged"));

            draggedField.style.marginTop = "";
            draggedField.style.marginBottom = "";

            draggedField = null;
            removeListeners();
        };

        function removeListeners() {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        }

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });
}

// Функция для обмена координатами точек линии по индексам
function swapLinePoints(el, idxA, idxB) {
    if (idxA === idxB) return;
    const aX = el.getAttribute("x" + (idxA + 1)) || "0";
    const aY = el.getAttribute("y" + (idxA + 1)) || "0";
    const bX = el.getAttribute("x" + (idxB + 1)) || "0";
    const bY = el.getAttribute("y" + (idxB + 1)) || "0";
    el.setAttribute("x" + (idxA + 1), bX);
    el.setAttribute("y" + (idxA + 1), bY);
    el.setAttribute("x" + (idxB + 1), aX);
    el.setAttribute("y" + (idxB + 1), aY);
}

// Функция для обмена командами пути по индексам
function swapPathCommands(el, commands, idxA, idxB) {
    if (idxA === idxB) return;
    const tmp = commands[idxA];
    commands[idxA] = commands[idxB];
    commands[idxB] = tmp;
    el.setAttribute("d", commands.join(" "));
}



// === Видимость интерфейса ===

// Получение общих групп и полей для всего выделения
function getVisibilityConfigForSelection() {
    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return null;

    const tags = selectedElementsSvg
        .map(el => el.localName ? el.localName.toLowerCase() : el.tagName ? el.tagName.toLowerCase() : null)
        .filter(Boolean);
    if (!tags.length) return null;

    const firstConfig = elementVisibilityMap[tags[0]] || elementVisibilityMap["-"];
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

    (config.groups || []).forEach(gId => {
        const group = document.getElementById(gId);
        if (!group) return;

        const groupFields = Array.from(group.querySelectorAll("input[id], select[id], textarea[id]"))
            .map(el => el.id)
            .filter(id => allFieldIds.has(id));

        if (groupFields.length === 0) return; 

        const visibleFieldExists = groupFields.some(fieldId => {
            const fieldEl = document.getElementById(fieldId);
            return fieldEl && fieldEl.parentNode && fieldEl.parentNode.style.display !== "none";
        });

        if (!visibleFieldExists) {
            group.style.display = "none";
        }
    });
}

document.addEventListener("click", () => { updatePropertiesVisibility(); });