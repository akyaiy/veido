// === Общие элементы ===

// интерфейс
const cpWrapper = document.getElementById("colorPickerWrapper");
const cpPreview = document.getElementById("colorPickerPreview");
const cpFormatSelect = document.getElementById("colorPickerFormatSelect");
const cpInputField = document.getElementById("colorPickerOutputField");

// canvas выбора цвета
const cpCanvas = document.getElementById("colorPickerCanvas");
const cpCtx = cpCanvas.getContext("2d");
const cpCursor = document.getElementById("colorPickerCursor");

// оттенок
const cpRunHue = document.getElementById("colorPickerHue");
const cpHueCtx = cpRunHue.getContext("2d");
const hpHueCursor = document.getElementById("colorPickerHueCursor");

// состояние цвета
let cpCurrentHue = 0;
let lastRgb = [255, 0, 0];

// состояние перетаскивания
let cpIsDragging = false;
let cpHueDragging = false;

// состояние взаимодействия
let cpCallback = null;
let currentTrigger = null;
let mousedownTarget = null;



// === Генерация фонов и градиентов ===

// функция создания радужного градиента для ползунка оттенка
function generateHueSliderBg() {
    const w = cpRunHue.width, h = cpRunHue.height;
    const grad = cpHueCtx.createLinearGradient(0, 0, w, 0);

    // Создание спектра
    for (let i = 0; i <= 360; i += 20) {
        grad.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
    }

    // Рисует градиент на холсте ползунка оттенка
    cpHueCtx.fillStyle = grad;
    cpHueCtx.fillRect(0, 0, w, h);
}

// функция рисования матрицы насыщенности и яркости
function drawColorCanvas(hue) {
    const w = cpCanvas.width, h = cpCanvas.height;

    // горизонтальный градиент от белого к выбранному оттенку
    let gridH = cpCtx.createLinearGradient(0, 0, w - 1, 0);
    gridH.addColorStop(0, "#fff");
    gridH.addColorStop(1, `hsl(${hue}, 100%, 50%)`);
    cpCtx.fillStyle = gridH;
    cpCtx.fillRect(0, 0, w, h);

    // вертикальный градиент от прозрачного к черному
    let gridV = cpCtx.createLinearGradient(0, 0, 0, h - 1);
    gridV.addColorStop(0, "rgba(0,0,0,0)");
    gridV.addColorStop(1, "#000");
    cpCtx.fillStyle = gridV;
    cpCtx.fillRect(0, 0, w, h);

    // жесткая заливка пикселей на углах для предотвращения искажений цвета
    cpCtx.fillStyle = "#fff";
    cpCtx.fillRect(0, 0, 1, 1);

    cpCtx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    cpCtx.fillRect(w - 1, 0, 1, 1);

    cpCtx.fillStyle = "#000";
    cpCtx.fillRect(0, h - 1, w, 1);
}



// === Конвертация и парсинг цветов ===

// перевод rgb в шестнадцатеричный hex формат
function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => {
        const hex = Math.min(255, Math.max(0, parseInt(x) || 0)).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join("");
}

// перевод hex строки в массив rgb чисел
function hexToRgb(hex) {
    let c = hex.replace(/^#/, '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length !== 6) return null;
    let num = parseInt(c, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// регулярные выражения и чтение текстового ввода пользователя
function parseColorString(str) {
    str = str.trim().toLowerCase();
    if (str.startsWith('#')) return hexToRgb(str);
    let m = str.match(/\d+/g);
    if (m && m.length >= 3) return m.slice(0, 3).map(x => Math.min(255, parseInt(x)));
    if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(str)) return hexToRgb('#' + str);
    return null;
}



// === Взаимодействие и обновление интерфейса ===

// функция инициализации, позиционирования и открытия окна колорпикера
function openColorPicker(triggerEl, startValue, onColorEvent) {
    cpCallback = onColorEvent;
    currentTrigger = triggerEl;

    // Включаем видимость сразу, чтобы узнать offsetWidth и offsetHeight окна
    cpWrapper.classList.remove("hidden");

    const rect = triggerEl.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 5;

    // Ограничение по правому краю экрана
    if (left + cpWrapper.offsetWidth > window.innerWidth + window.scrollX) {
        left = window.innerWidth + window.scrollX - cpWrapper.offsetWidth - 10;
    }
    
    // Ограничение по нижнему краю экрана (если не влезает — прыгает наверх триггера)
    if (top + cpWrapper.offsetHeight > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - cpWrapper.offsetHeight - 5;
    }

    // Применяем безопасные координаты (не меньше 5px от левого и верхнего края)
    cpWrapper.style.left = `${Math.max(5, left)}px`;
    cpWrapper.style.top = `${Math.max(5, top)}px`;

    // генерация фона для ползунка оттенка и основного холста
    generateHueSliderBg();
    
    // установка начального цвета и синхронизация интерфейса
    let parsed = parseColorString(startValue || "#ff0000");
    applyRgbOrHex(parsed, true);

    // отложенный обработчик кликов для закрытия колорпикера при клике вне его и триггера
    setTimeout(() => {
        window.addEventListener("click", function closePicker(e) {
            const hitWrapper = cpWrapper.contains(e.target) || cpWrapper.contains(mousedownTarget);
            const hitTrigger = e.target === currentTrigger || mousedownTarget === currentTrigger;
            
            if (!hitWrapper && !hitTrigger) {
                cpWrapper.classList.add("hidden");
                window.removeEventListener("click", closePicker);
                if (typeof cpCallback === "function") cpCallback(rgbToHex(lastRgb[0], lastRgb[1], lastRgb[2]), "close");
            }
        });
    }, 0);
}

// обновление кружка превью, инпута и вызов внешнего колбэка
function updateInterface(r, g, b, flag, updateInput = true) {
    const hex = rgbToHex(r, g, b);
    cpPreview.style.backgroundColor = hex;
    document.querySelectorAll(".colorPickerTrigger").forEach((el) => {
        el.style.backgroundColor = hex;
    });
    if (updateInput) {
        cpInputField.value = cpFormatSelect.value === "rgb" ? `rgb(${r}, ${g}, ${b})` : hex;
    }
    if (typeof cpCallback === "function") cpCallback(hex, flag);
}

// расчет и обновление позиции курсора на основном холсте
function getColorFromCanvas(x, y) {
    // ограничение координат в пределах холста
    const w = cpCanvas.width, h = cpCanvas.height;
    x = Math.max(0, Math.min(x, w - 1));
    y = Math.max(0, Math.min(y, h - 1));

    // позиционирование курсора в процентах для адаптивности при изменении размера
    cpCursor.style.left = `${(x / w) * 100}%`;
    cpCursor.style.top = `${(y / h) * 100}%`;

    // получение цвета из пикселя холста и обновление интерфейса
    const imgData = cpCtx.getImageData(x, y, 1, 1).data;
    lastRgb = [imgData[0], imgData[1], imgData[2]];
    updateInterface(imgData[0], imgData[1], imgData[2], "change", true);
}

// определение координат клика мыши на основном холсте
function handleCanvasMove(e) {
    const rect = cpCanvas.getBoundingClientRect();
    getColorFromCanvas(((e.clientX - rect.left) / rect.width) * cpCanvas.width, ((e.clientY - rect.top) / rect.height) * cpCanvas.height);
}

// расчет позиции ползунка и оттенка на основе клика по радужной полосе
function getHueFromCanvas(x) {
    const w = cpRunHue.width;
    x = Math.max(0, Math.min(x, w - 1));
    cpCurrentHue = Math.round((x / w) * 360);
    hpHueCursor.style.left = `${(cpCurrentHue / 360) * 100}%`;
    drawColorCanvas(cpCurrentHue);
    getColorFromCanvas((parseFloat(cpCursor.style.left) / 100) * cpCanvas.width || 0, (parseFloat(cpCursor.style.top) / 100) * cpCanvas.height || 0);
}

// определение координат клика мыши на радужной полосе
function setHueFromEvent(e) {
    const rect = cpRunHue.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * cpRunHue.width;
    getHueFromCanvas(x);
}

// синхронизация положения обоих курсоров при ручном вводе цвета или старте
function applyRgbOrHex(rgb, updateField = false) {
    if (!rgb) return;
    lastRgb = rgb;
    let r = rgb[0]/255, g = rgb[1]/255, b = rgb[2]/255, max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0;
    
    // расчет оттенка в формате HSL
    if (max !== min) {
        let d = max - min;
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h /= 6;
    }

    // позиционирование курсора на радужной полосе 
    cpCurrentHue = Math.round(h * 360);
    hpHueCursor.style.left = `${(cpCurrentHue / 360) * 100}%`;
    drawColorCanvas(cpCurrentHue);

    // позиционирование курсора на основном холсте 
    cpCursor.style.left = `${(max === 0 ? 0 : 1 - (min / max)) * 100}%`;
    cpCursor.style.top = `${(1 - max) * 100}%`;
    updateInterface(rgb[0], rgb[1], rgb[2], "change", updateField);
}



// === Управление окном и событиями ===

// запуск процесса перетаскивания курсора на основном холсте
cpCanvas.addEventListener("mousedown", (e) => { cpIsDragging = true; handleCanvasMove(e); });

// отслеживание перемещения мыши и разграничение перетаскивания холста и радуги
window.addEventListener("mousemove", (e) => { 
    if (cpIsDragging) handleCanvasMove(e); 
    if (cpHueDragging) setHueFromEvent(e); 
});

// завершение процессов перетаскивания
window.addEventListener("mouseup", () => { cpIsDragging = false; cpHueDragging = false; });

// запуск процесса перетаскивания курсора на радужной полосе
cpRunHue.addEventListener("mousedown", (e) => {
    cpHueDragging = true;
    setHueFromEvent(e);
});

// обработчик ручного изменения текста в поле ввода
cpInputField.addEventListener("input", (e) => {
    applyRgbOrHex(parseColorString(e.target.value), false);
});

// обработчик переключения формата отображения цвета
cpFormatSelect.addEventListener("change", () => updateInterface(lastRgb[0], lastRgb[1], lastRgb[2], "change", true));

document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".colorPickerTrigger");
    if (!trigger) return;
    openColorPicker(trigger, rgbToHex(lastRgb[0], lastRgb[1], lastRgb[2]), null);
});
updateInterface(lastRgb[0], lastRgb[1], lastRgb[2], "init", true);

// фиксация элемента под мышкой для предотвращения закрытия при выходе за пределы окна
window.addEventListener("mousedown", (e) => { mousedownTarget = e.target; });