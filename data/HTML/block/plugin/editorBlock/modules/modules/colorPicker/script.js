/* ===
 * Состояние модуля Color Picker
=== */

// Текущие параметры выбранного цвета и формата
const pickerState = {
    h: 0,
    s: 100,
    v: 100,
    format: 'hex'
};



/* ===
 * Элементы интерфейса
=== */

// Область 2D выбора цвета
const colorArea = document.getElementById('colorArea');

// Задний фон 2D области
const colorAreaBg = document.getElementById('colorAreaBg');

// Курсор 2D области
const colorAreaCursor = document.getElementById('colorAreaCursor');

// Ползунок оттенка
const colorHueSlider = document.getElementById('colorHueSlider');

// Курсор ползунка оттенка
const colorHueCursor = document.getElementById('colorHueCursor');

// Круг предпросмотр цвета
const colorPreview = document.getElementById('colorPreview');

// Поле вывода значения цвета
const colorValueInput = document.getElementById('colorValueInput');

// Выпадающий список выбора формата
const colorFormatSelect = document.getElementById('colorFormatSelect');

// Контейнер самого пикера
const colorPickerContainer = document.getElementById('colorPicker');

// callback для прикладного модуля
let colorPickerCallback = null;
let colorPickerAnchor = null;
let colorPickerDocumentListener = null;

/* ***
 * positionColorPicker - позиционирование контейнера Color Picker относительно якорного элемента
 * - принимает якорный элемент (anchor)
 * - вычисляет координаты и размеры окна и контейнера
 * - устанавливает стили left, top и visibility для контейнера
*** */
function positionColorPicker(anchor) {
    if (!anchor) {
        return;
    }

    const rect = anchor.getBoundingClientRect();
    const margin = 10;
    const pageWidth = window.innerWidth;
    const pageHeight = window.innerHeight;

    colorPickerContainer.style.position = 'absolute';
    colorPickerContainer.style.visibility = 'hidden';
    colorPickerContainer.style.display = 'block';

    const pickerWidth = colorPickerContainer.offsetWidth;
    const pickerHeight = colorPickerContainer.offsetHeight;

    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 8;

    if (left + pickerWidth + margin > pageWidth + window.scrollX) {
        left = pageWidth + window.scrollX - pickerWidth - margin;
    }

    if (left < window.scrollX + margin) {
        left = window.scrollX + margin;
    }

    if (top + pickerHeight + margin > pageHeight + window.scrollY) {
        const aboveTop = rect.top + window.scrollY - pickerHeight - 8;
        top = aboveTop >= window.scrollY + margin ? aboveTop : window.scrollY + margin;
    }

    if (top < window.scrollY + margin) {
        top = window.scrollY + margin;
    }

    colorPickerContainer.style.left = left + 'px';
    colorPickerContainer.style.top = top + 'px';
    colorPickerContainer.style.visibility = '';
}

/* ***
 * handleDocumentMouseDown - обработчик клика по документу для закрытия Color Picker
 * - принимает объект события мыши
 * - проверяет, был ли клик внутри контейнера или якорного элемента
 * - если клик был снаружи, восстанавливает выделение, применяет callback и закрывает пикер
*** */
function handleDocumentMouseDown(event) {
    if (colorPickerContainer.style.display === 'none') {
        return;
    }

    if (colorPickerContainer.contains(event.target) || (colorPickerAnchor && colorPickerAnchor.contains(event.target))) {
        return;
    }

    window.editorBlock.restoreSelection();
    applyColorPickerCallback();
    closeColorPicker(true);
}


/* ===
 * Математические конвертеры
=== */

/* ***
 * convertHsvToRgb - расчет RGB на основе HSV модели
 * - принимает тон (h), насыщенность (s) и яркость (v)
 * - выполняет математическое преобразование
 * - возвращает объект со значениями r, g, b
*** */
function convertHsvToRgb(h, s, v) {
    s = s / 100;
    v = v / 100;

    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;

    let r = 0;
    let g = 0;
    let b = 0;

    if (h >= 0 && h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (h >= 60 && h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (h >= 180 && h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (h >= 240 && h < 300) {
        r = x;
        g = 0;
        b = c;
    } else if (h >= 300 && h <= 360) {
        r = c;
        g = 0;
        b = x;
    }

    const rgbResult = {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255)
    };

    return rgbResult;
}

/* ***
 * convertRgbToHex - генерация строки формата HEX
 * - принимает значения каналов r, g, b
 * - преобразует числа в шестнадцатеричный вид
 * - возвращает строку формата #RRGGBB
*** */
function convertRgbToHex(r, g, b) {
    const hexString = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();

    return hexString;
}

/* ***
 * convertRgbToHsv - конвертация RGB компонентов в модель HSV
 * - принимает значения каналов r, g, b
 * - рассчитывает тон, насыщенность и яркость
 * - возвращает объект с параметрами h, s, v
*** */
function convertRgbToHsv(r, g, b) {
    const normalizedR = r / 255;
    const normalizedG = g / 255;
    const normalizedB = b / 255;

    const maxColor = Math.max(normalizedR, normalizedG, normalizedB);
    const minColor = Math.min(normalizedR, normalizedG, normalizedB);
    const delta = maxColor - minColor;

    let h = 0;
    let s = 0;
    let v = maxColor * 100;

    if (maxColor !== 0) {
        s = (delta / maxColor) * 100;
    }

    if (maxColor === minColor) {
        h = 0;
    } else if (maxColor === normalizedR) {
        h = (normalizedG - normalizedB) / delta + (normalizedG < normalizedB ? 6 : 0);
    } else if (maxColor === normalizedG) {
        h = (normalizedB - normalizedR) / delta + 2;
    } else if (maxColor === normalizedB) {
        h = (normalizedR - normalizedG) / delta + 4;
    }

    h = h * 60;

    const hsvResult = {
        h: h,
        s: s,
        v: v
    };

    return hsvResult;
}

/* ***
 * convertHexToHsv - конвертация строки HEX в модель HSV
 * - принимает исходную HEX строку
 * - парсит шестнадцатеричные каналы цвета
 * - возвращает объект с параметрами h, s, v или null при ошибке
*** */
function convertHexToHsv(hexString) {
    let cleanHex = hexString.replace('#', '');

    if (cleanHex.length === 3) {
        cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
    }

    if (cleanHex.length !== 6) {
        return null;
    }

    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return null;
    }

    const hsvResult = convertRgbToHsv(r, g, b);

    return hsvResult;
}

/* ***
 * parseColorValue - разбор текстовой строки любого формата в HSV
 * - принимает строковое значение цвета colorValue
 * - определяет формат ввода (HEX или RGB) и парсит каналы
 * - возвращает объект HSV либо null при неверном формате
*** */
function parseColorValue(colorValue) {
    if (!colorValue) {
        return null;
    }

    const value = String(colorValue).trim();
    if (value.indexOf('#') === 0) {
        return convertHexToHsv(value);
    }

    const rgbMatch = value.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10);
        const g = parseInt(rgbMatch[2], 10);
        const b = parseInt(rgbMatch[3], 10);

        if ([r, g, b].every(function(n) { return !isNaN(n) && n >= 0 && n <= 255; })) {
            return convertRgbToHsv(r, g, b);
        }
    }

    return null;
}

/* ***
 * getColorPickerHex - получение текущего выбранного HEX значения
 * - рассчитывает RGB значения по текущему HSV состоянию
 * - преобразует полученные каналы в шестнадцатеричную строку
 * - возвращает валидный HEX цвет
*** */
function getColorPickerHex() {
    const currentRgb = convertHsvToRgb(pickerState.h, pickerState.s, pickerState.v);
    return convertRgbToHex(currentRgb.r, currentRgb.g, currentRgb.b);
}

/* ***
 * applyColorPickerCallback - отправка текущего цвета во внешний редактор
 * - проверяет наличие внешней функции обратной связи
 * - вызывает callback и передает HEX строку
*** */
function applyColorPickerCallback() {
    if (typeof colorPickerCallback === 'function') {
        colorPickerCallback(getColorPickerHex());
    }
}

/* ***
 * setColorPickerColor - принудительная установка цвета в пикере
 * - принимает строковое значение цвета colorValue
 * - обновляет внутреннее состояние h, s, v
 * - перерисовывает все элементы управления без вызова callback
*** */
function setColorPickerColor(colorValue) {
    const hsv = parseColorValue(colorValue);
    if (!hsv) {
        return false;
    }

    pickerState.h = hsv.h;
    pickerState.s = hsv.s;
    pickerState.v = hsv.v;
    updatePickerUi(false, false);
    return true;
}

/* ***
 * closeColorPicker - закрытие окна выбора цвета
 * - скрывает контейнер пикера с экрана и обнуляет ссылки
 * - отписывается от событий глобального клика
 * - опционально сохраняет состояние истории редактора
*** */
function closeColorPicker(saveHistory = true) {
    colorPickerContainer.style.display = 'none';
    colorPickerCallback = null;
    colorPickerAnchor = null;

    if (colorPickerDocumentListener) {
        document.removeEventListener('mousedown', colorPickerDocumentListener, true);
        colorPickerDocumentListener = null;
    }

    if (saveHistory && window.editorBlock && typeof window.editorBlock.saveHistoryState === 'function') {
        window.editorBlock.saveHistoryState();
    }
}

/* ***
 * openColorPicker - открытие окна и инициализация параметров
 * - принимает объект настроек options (цвет, формат, callback, anchor)
 * - сохраняет текущее текстовое выделение в редакторе
 * - позиционирует пикер и подписывается на закрытие
*** */
function openColorPicker(options = {}) {
    const initialColor = options.initialColor || '#000000';
    const format = options.format === 'rgb' ? 'rgb' : 'hex';
    colorPickerCallback = typeof options.callback === 'function' ? options.callback : null;
    colorPickerAnchor = options.anchor || null;

    pickerState.format = format;
    setColorPickerColor(initialColor);
    positionColorPicker(colorPickerAnchor);

    colorPickerContainer.style.display = 'block';
    updatePickerUi(false, false);

    if (!colorPickerDocumentListener) {
        colorPickerDocumentListener = handleDocumentMouseDown;
        document.addEventListener('mousedown', colorPickerDocumentListener, true);
    }

    return true;
}

// Регистрация глобальных методов расширения редактора
window.editorBlock.openColorPicker = openColorPicker;


/* ===
 * Логика обновления интерфейса
=== */

/* ***
 * updatePickerUi - синхронизация интерфейса с объектом состояния
 * - принимает флаг shouldSkipInput для блокировки перезаписи текста во время ввода
 * - принимает флаг shouldTriggerCallback для вызова внешних событий (по умолчанию true)
 * - обновляет стили задних фонов, положение ползунков и инпут
*** */
function updatePickerUi(shouldSkipInput, shouldTriggerCallback = true) {
    const currentRgb = convertHsvToRgb(pickerState.h, pickerState.s, pickerState.v);
    const currentHex = convertRgbToHex(currentRgb.r, currentRgb.g, currentRgb.b);
    const pureColor = convertHsvToRgb(pickerState.h, 100, 100);

    colorAreaBg.style.backgroundColor = 'rgb(' + pureColor.r + ', ' + pureColor.g + ', ' + pureColor.b + ')';
    colorPreview.style.backgroundColor = currentHex;
    colorAreaCursor.style.left = pickerState.s + '%';
    colorAreaCursor.style.top = (100 - pickerState.v) + '%';
    colorHueCursor.style.left = ((pickerState.h / 360) * 100) + '%';

    if (!shouldSkipInput) {
        if (pickerState.format === 'hex') {
            colorValueInput.value = currentHex;
        } else {
            colorValueInput.value = 'rgb(' + currentRgb.r + ', ' + currentRgb.g + ', ' + currentRgb.b + ')';
        }
    }
}



/* ===
 * Логика интерактивного перетаскивания
=== */

/* ***
 * updateSvCoordinates - расчет насыщенности и яркости по координатам
 * - принимает объект события мыши event
 * - вычисляет положение внутри 2D области цвета
 * - изменяет состояние пикера и запускает перерисовку
*** */
function updateSvCoordinates(event) {
    const rect = colorArea.getBoundingClientRect();

    const mouseX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const mouseY = Math.max(0, Math.min(event.clientY - rect.top, rect.height));

    pickerState.s = (mouseX / rect.width) * 100;
    pickerState.v = 100 - ((mouseY / rect.height) * 100);

    updatePickerUi(false);
}

/* ***
 * updateHueCoordinates - расчет тона по горизонтальной координате
 * - принимает объект события мыши event
 * - вычисляет положение на радужном ползунке оттенка
 * - изменяет состояние пикера и запускает перерисовку
*** */
function updateHueCoordinates(event) {
    const rect = colorHueSlider.getBoundingClientRect();

    const mouseX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));

    pickerState.h = (mouseX / rect.width) * 360;

    if (pickerState.h === 360) {
        pickerState.h = 359.9;
    }

    updatePickerUi(false);
}

/* ***
 * createDragSession - инициализация сессии перемещения мыши
 * - принимает событие нажатия event и функцию-обработчик координат moveHandler
 * - регистрирует глобальные слушатели документа для плавного перемещения
*** */
function createDragSession(event, moveHandler) {
    moveHandler(event);

    /* ***
     * handleMouseMove - прослойка для отслеживания движения
     * - принимает объект события мыши moveEvent
     * - вызывает основной обработчик координат
    *** */
    function handleMouseMove(moveEvent) {
        moveHandler(moveEvent);
    }

    /* ***
     * handleMouseUp - завершение сессии перемещения
     * - удаляет глобальные слушатели событий документа
*** */
    function handleMouseUp() {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}



/* ===
 * Обработчики событий модуля
=== */

/* ***
 * handleAreaMouseDown - клик и начало перетаскивания в 2D области
 * - принимает объект события мыши event
 * - запускает интерактивную сессию перемещения для выбора параметров s и v
*** */
function handleAreaMouseDown(event) {
    createDragSession(event, updateSvCoordinates);
}

/* ***
 * handleSliderMouseDown - клик и начало перетаскивания на ползунке тона
 * - принимает объект события мыши event
 * - запускает интерактивную сессию перемещения для выбора параметра h
*** */
function handleSliderMouseDown(event) {
    createDragSession(event, updateHueCoordinates);
}

/* ***
 * handleFormatChange - изменение формата отображения цвета
 * - принимает объект события изменения select event
 * - обновляет состояние формата и полностью перерисовывает текстовое поле
*** */
function handleFormatChange(event) {
    pickerState.format = event.target.value;

    updatePickerUi(false, true);
}

/* ***
 * handleValueInput - ручное изменение значения в текстовом поле
 * - принимает объект события ввода текста event
 * - парсит строку в зависимости от выбранного формата
 * - обновляет состояние и визуальные маркеры без перезаписи текста
*** */
function handleValueInput(event) {
    const inputValue = event.target.value.trim();

    let parsedHsv = null;

    if (pickerState.format === 'hex') {
        parsedHsv = convertHexToHsv(inputValue);
    } else {
        let cleanRgb = inputValue;

        if (cleanRgb.indexOf('rgb(') !== -1) {
            cleanRgb = cleanRgb.replace('rgb(', '');
        }

        if (cleanRgb.indexOf(')') !== -1) {
            cleanRgb = cleanRgb.replace(')', '');
        }

        const rgbChannels = cleanRgb.split(',');

        if (rgbChannels.length === 3) {
            const r = parseInt(rgbChannels[0].trim(), 10);
            const g = parseInt(rgbChannels[1].trim(), 10);
            const b = parseInt(rgbChannels[2].trim(), 10);

            if (
                !isNaN(r) && r >= 0 && r <= 255 &&
                !isNaN(g) && g >= 0 && g <= 255 &&
                !isNaN(b) && b >= 0 && b <= 255
            ) {
                parsedHsv = convertRgbToHsv(r, g, b);
            }
        }
    }

    if (parsedHsv !== null) {
        pickerState.h = parsedHsv.h;
        pickerState.s = parsedHsv.s;
        pickerState.v = parsedHsv.v;

        updatePickerUi(true, true);
    }
}

// Добавление обработчиков взаимодействия с пикером
colorArea.addEventListener('mousedown', handleAreaMouseDown);
colorHueSlider.addEventListener('mousedown', handleSliderMouseDown);
colorFormatSelect.addEventListener('change', handleFormatChange);
colorValueInput.addEventListener('input', handleValueInput);

// Первоначальный рендеринг модуля при загрузке
updatePickerUi(false);