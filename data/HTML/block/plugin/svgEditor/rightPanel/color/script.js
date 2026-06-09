// === Настройки стилей элементов ===

// Словарь соответствия ID инпутов и атрибутов SVG
const stylePropMap = {
    "svgPropFill": "fill",
    "svgPropFillOpacity": "fill-opacity",
    "svgPropStroke": "stroke",
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

// Привязываем обработчики ко всем инпутам из словаря
Object.keys(stylePropMap).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener("input", onStyleInputChange);
    }
});

// Чтение данных из выделенного элемента в инпуты
function updateColorInputs() {
    if (!selectedElementsSvg || selectedElementsSvg.length === 0) return;
    
    const firstEl = selectedElementsSvg[0];
    
    const fill = firstEl.getAttribute("fill");
    const fillOpacity = firstEl.getAttribute("fill-opacity");
    const stroke = firstEl.getAttribute("stroke");
    const strokeWidth = firstEl.getAttribute("stroke-width");
    const strokeDasharray = firstEl.getAttribute("stroke-dasharray");
    const strokeOpacity = firstEl.getAttribute("stroke-opacity");

    const inputFill = document.getElementById("svgPropFill");
    if (inputFill) inputFill.value = fill;

    const inputStroke = document.getElementById("svgPropStroke");
    if (inputStroke) inputStroke.value = stroke;

    const inputFillOp = document.getElementById("svgPropFillOpacity");
    if (inputFillOp) inputFillOp.value = fillOpacity;

    const inputStrokeW = document.getElementById("svgPropStrokeWidth");
    if (inputStrokeW) inputStrokeW.value = strokeWidth;

    const inputStrokeDash = document.getElementById("svgPropStrokeDasharray");
    if (inputStrokeDash) inputStrokeDash.value = strokeDasharray;

    const inputStrokeOp = document.getElementById("svgPropStrokeOpacity");
    if (inputStrokeOp) inputStrokeOp.value = strokeOpacity;
}