// === Общие элементы ===

// функция загрузки блоков колорпикера для разных ролей цвета
async function loadColorPicker() {
    await loadBlock("plugin/colorPicker", "svgPropFillColorPicker");
    await loadBlock("plugin/colorPicker", "svgPropStrokeColorPicker");
    attachColorPickerSync();
}
loadColorPicker();



// === Настройки стилей элементов ===

// Словарь соответствия ID элементов и атрибутов SVG
const stylePropMap = {
    "svgPropFillColor": "fill",
    "svgPropFillOpacity": "fill-opacity",
    "svgPropStrokeColor": "stroke",
    "svgPropStrokeWidth": "stroke-width",
    "svgPropStrokeDasharray": "stroke-dasharray",
    "svgPropStrokeOpacity": "stroke-opacity"
};

// Обновление атрибутов у выделенных элементов при изменении значений
function onStyleInputChange(e) {
    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return;
    
    const attr = stylePropMap[e.target.id];
    if (!attr) return;
    
    const val = e.target.value;

    selectedElementsSvg.forEach((el) => {
        el.setAttribute(attr, val);
    });
}

// Чтение данных из выделенного элемента в интерфейс
function updateColorInputs() {
    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return;
    
    const firstEl = selectedElementsSvg[0];
    
    const fill = firstEl.getAttribute("fill");
    const fillOpacity = firstEl.getAttribute("fill-opacity");
    const stroke = firstEl.getAttribute("stroke");
    const strokeWidth = firstEl.getAttribute("stroke-width");
    const strokeDasharray = firstEl.getAttribute("stroke-dasharray");
    const strokeOpacity = firstEl.getAttribute("stroke-opacity");

    const triggerFill = document.getElementById("svgPropFillColor");
    if (triggerFill && fill) triggerFill.style.backgroundColor = fill;

    const triggerStroke = document.getElementById("svgPropStrokeColor");
    if (triggerStroke && stroke) triggerStroke.style.backgroundColor = stroke;

    const inputFillOp = document.getElementById("svgPropFillOpacity");
    if (inputFillOp) inputFillOp.value = fillOpacity || "";

    const inputStrokeW = document.getElementById("svgPropStrokeWidth");
    if (inputStrokeW) inputStrokeW.value = strokeWidth || "";

    const inputStrokeDash = document.getElementById("svgPropStrokeDasharray");
    if (inputStrokeDash) inputStrokeDash.value = strokeDasharray || "none";

    const inputStrokeOp = document.getElementById("svgPropStrokeOpacity");
    if (inputStrokeOp) inputStrokeOp.value = strokeOpacity || "";
}

// Привязываем обработчики ко всем инпутам из словаря
Object.keys(stylePropMap).forEach(id => {
    const el = document.getElementById(id);
    if (el && (el.tagName === "INPUT" || el.tagName === "SELECT")) {
        el.addEventListener("input", onStyleInputChange);
    }
});

function attachColorPickerSync() {
    const triggers = ["svgPropFillColor", "svgPropStrokeColor"].map(id => document.getElementById(id)).filter(Boolean);
    if (!triggers.length) return;

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type !== "attributes" || mutation.attributeName !== "style") return;
            const trigger = mutation.target;
            if (!trigger.classList.contains("colorPickerTrigger")) return;

            const color = trigger.style.backgroundColor || getComputedStyle(trigger).backgroundColor;
            if (!color) return;

            const attr = trigger.id === "svgPropFillColor" ? "fill" : "stroke";
            if (!selectedElementsSvg || selectedElementsSvg.length === 0) return;

            selectedElementsSvg.forEach(el => el.setAttribute(attr, color));
            updateColorInputs();
        });
    });

    triggers.forEach(trigger => observer.observe(trigger, { attributes: true, attributeFilter: ["style"] }));
}
