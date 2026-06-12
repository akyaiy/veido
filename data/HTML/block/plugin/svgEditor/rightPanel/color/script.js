// === Общие элементы ===

// Функция инициализации 
async function init() {
    await loadBlock("plugin/colorPicker", "svgPropFillColorPicker");
    await loadBlock("plugin/colorPicker", "svgPropStrokeColorPicker");
    attachColorPickerSync();
    updateColorInputs();
}
init();



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
function getCommonAttributeValue(elements, attr) {
    const values = elements.map(el => el.getAttribute(attr));
    const uniqueValues = [...new Set(values)];
    return uniqueValues.length === 1 ? uniqueValues[0] : null;
}

// Синхронизация интерфейса с атрибутами выделенного элемента
function updateColorInputs() {
    const selected = window.selectedElementsSvg || [];

    const fill = selected.length ? getCommonAttributeValue(selected, "fill") : null;
    const fillOpacity = selected.length ? getCommonAttributeValue(selected, "fill-opacity") : null;
    const stroke = selected.length ? getCommonAttributeValue(selected, "stroke") : null;
    const strokeWidth = selected.length ? getCommonAttributeValue(selected, "stroke-width") : null;
    const strokeDasharray = selected.length ? getCommonAttributeValue(selected, "stroke-dasharray") : null;
    const strokeOpacity = selected.length ? getCommonAttributeValue(selected, "stroke-opacity") : null;

    // Вспомогательная функция: проверяет, отличаются ли значения атрибута у выделенных элементов
    const hasMixedAttr = (attr) => {
        if (selected.length <= 1) return false;
        const firstVal = selected[0].getAttribute(attr);
        return selected.some(el => el.getAttribute(attr) !== firstVal);
    };

    // Универсально проставляем цветовые триггеры по map (fill/stroke)
    Object.keys(stylePropMap).forEach(id => {
        const attr = stylePropMap[id];
        if (attr !== 'fill' && attr !== 'stroke') return;
        const trigger = document.getElementById(id);
        if (!trigger) return;
        const value = attr === 'fill' ? fill : stroke;
        // пометка программного обновления, чтобы MutationObserver не реагировал
        trigger.dataset._programmatic = '1';
        trigger.style.backgroundColor = value || '';
        setTimeout(() => { delete trigger.dataset._programmatic; }, 0);
    });

    const inputFillOp = document.getElementById("svgPropFillOpacity");
    if (inputFillOp) {
        inputFillOp.value = hasMixedAttr("fill-opacity") ? "" : (fillOpacity ?? "1");
    }

    const inputStrokeW = document.getElementById("svgPropStrokeWidth");
    if (inputStrokeW) {
        inputStrokeW.value = hasMixedAttr("stroke-width") ? "" : (stroke ? (strokeWidth ?? "1") : "0");
    }

    const inputStrokeDash = document.getElementById("svgPropStrokeDasharray");
    if (inputStrokeDash) {
        inputStrokeDash.value = hasMixedAttr("stroke-dasharray") ? "" : (strokeDasharray ?? "none");
    }

    const inputStrokeOp = document.getElementById("svgPropStrokeOpacity");
    if (inputStrokeOp) {
        inputStrokeOp.value = hasMixedAttr("stroke-opacity") ? "" : (strokeOpacity ?? "1");
    }
}

document.addEventListener("svgSelectionChanged", updateColorInputs);

// Привязываем обработчики ко всем инпутам из словаря
Object.keys(stylePropMap).forEach(id => {
    const el = document.getElementById(id);
    if (el && (el.tagName === "INPUT" || el.tagName === "SELECT")) {
        el.addEventListener("input", onStyleInputChange);
    }
});

// Функция для синхронизации изменений цвета из колорпикера с атрибутами SVG
function attachColorPickerSync() {
    // Находим все триггеры, перечисленные в stylePropMap (обычно цветовые)
    const triggers = Object.keys(stylePropMap)
        .map(id => document.getElementById(id))
        .filter(el => el && el.classList && el.classList.contains('colorPickerTrigger'));
    if (!triggers.length) return;

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type !== "attributes" || mutation.attributeName !== "style") return;
            const trigger = mutation.target;
            if (!trigger.classList.contains("colorPickerTrigger")) return;

            // если это обновление, сделанное программно (sync from selection), пропускаем
            if (trigger.dataset && trigger.dataset._programmatic) return;

            const color = trigger.style.backgroundColor || getComputedStyle(trigger).backgroundColor;
            if (!color) return;

            const attr = trigger.id === "svgPropFillColor" ? "fill" : "stroke";
            if (!selectedElementsSvg || selectedElementsSvg.length === 0) return;

            // пользователь изменил цвет через пипетку — применяем к выделенным элементам
            selectedElementsSvg.forEach(el => el.setAttribute(attr, color));
            updateColorInputs();
        });
    });

    triggers.forEach(trigger => observer.observe(trigger, { attributes: true, attributeFilter: ["style"] }));
}
