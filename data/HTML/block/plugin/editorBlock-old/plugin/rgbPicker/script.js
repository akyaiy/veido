/* Окно выбора цвета */
const colorState = { h: 0, s: 100, l: 50 }; 
let activeContext = null;

const specRoot_2 = document.getElementById('propertiesPanel');

const picker = document.getElementById('rgb-picker');
const hueCanvas = document.getElementById('cp-hue');
const lightCanvas = document.getElementById('cp-light');
const hueThumb = document.getElementById('hue-thumb');
const lightThumb = document.getElementById('light-thumb');
const hexInput = document.getElementById('cp-hex');
const closeBtn = document.getElementById('cp-close');

const ctxHue = hueCanvas.getContext('2d');
const ctxLight = lightCanvas.getContext('2d');
let isDragging = null;

// --- CONVERTERS ---
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(H) {
    let r = 0, g = 0, b = 0;
    if (H.length === 4) {
        r = "0x" + H[1] + H[1]; g = "0x" + H[2] + H[2]; b = "0x" + H[3] + H[3];
    } else if (H.length === 7) {
        r = "0x" + H[1] + H[2]; g = "0x" + H[3] + H[4]; b = "0x" + H[5] + H[6];
    }
    r /= 255; g /= 255; b /= 255;
    let cmin = Math.min(r,g,b), cmax = Math.max(r,g,b), delta = cmax - cmin;
    let h = 0, s = 0, l = 0;

    if (delta === 0) h = 0;
    else if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;

    h = Math.round(h * 60);
    if (h < 0) h += 360;
    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);
    return { h, s, l };
}

// --- DRAWING ---
function drawHueBar() {
    const w = hueCanvas.width, h = hueCanvas.height;
    const grad = ctxHue.createLinearGradient(0, 0, w, 0);
    // Спектр: Красный -> Желтый -> Зеленый -> Голубой -> Синий -> Магента -> Красный
    grad.addColorStop(0, '#ff0000');
    grad.addColorStop(0.17, '#ffff00');
    grad.addColorStop(0.33, '#00ff00');
    grad.addColorStop(0.50, '#00ffff');
    grad.addColorStop(0.67, '#0000ff');
    grad.addColorStop(0.83, '#ff00ff');
    grad.addColorStop(1, '#ff0000');
    ctxHue.fillStyle = grad;
    ctxHue.fillRect(0, 0, w, h);
}

function drawLightBar() {
    const w = lightCanvas.width, h = lightCanvas.height;
    const grad = ctxLight.createLinearGradient(0, 0, w, 0);
    const currentColor = `hsl(${colorState.h}, 100%, 50%)`;
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.5, currentColor);
    grad.addColorStop(1, '#ffffff');
    ctxLight.fillStyle = grad;
    ctxLight.fillRect(0, 0, w, h);
}

function updateThumbs() {
    hueThumb.style.left = (colorState.h / 360) * hueCanvas.width + 'px';
    lightThumb.style.left = (colorState.l / 100) * lightCanvas.width + 'px';
}

// --- CORE LOGIC ---
function applyToSelection(hexValue) {
    if (!activeContext) return;
    
    let cssProp = activeContext.prop;
    if(cssProp === 'text-color') cssProp = 'color';
    if(cssProp === 'bg-color') cssProp = 'background-color';

    // если activeContext.ctrl привязан к полю из панели (data-prop),
    // применяем значение не к выделению, а к элементу через applyPropToElement
    if (activeContext.ctrl && activeContext.ctrl.getAttribute('data-prop')) {
        const prop = activeContext.ctrl.getAttribute('data-prop');
        const targetEl = lastHighlightedElement || activeContext.el;
        if (targetEl) {
            applyPropToElement(targetEl, prop, hexValue);
        }
    } else {
        // обычное поведение для панели форматирования (toolbar)
        if (typeof applyInlineStyleToSelection === 'function') {
            applyInlineStyleToSelection(cssProp, hexValue);
        }
        if (typeof updateSimpleFormats === 'function') {
            updateSimpleFormats(activeContext.el);
        }
    }

    // если цвет выбирался через контрол, обновим его значение тоже
    if (activeContext.ctrl && activeContext.ctrl.type === 'color') {
        activeContext.ctrl.value = hexValue;
        // обновить визуальный swatch если есть
        if (activeContext.ctrl._swatch) {
            activeContext.ctrl._swatch.style.backgroundColor = hexValue;
        }
        // сгенерируем событие, чтобы остальная логика панели сработала
        activeContext.ctrl.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function syncFromState(apply = false) {
    const hex = hslToHex(colorState.h, colorState.s, colorState.l);
    hexInput.value = hex;
    drawLightBar();
    updateThumbs();
    if (apply) applyToSelection(hex);
}

// --- EVENTS ---
function handleDrag(e, type) {
    const canvas = type === 'hue' ? hueCanvas : lightCanvas;
    const rect = canvas.getBoundingClientRect();
    let x = Math.max(0, Math.min(e.clientX - rect.left, canvas.width));
    const ratio = x / canvas.width;

    if (type === 'hue') {
        colorState.h = Math.round(ratio * 360);
        colorState.s = 100; // Сброс насыщенности при смене тона
    } else {
        colorState.l = Math.round(ratio * 100);
    }
    syncFromState();
}

function initDrag(e, type) {
    isDragging = type;
    handleDrag(e, type);
    const move = ev => handleDrag(ev, type);
    const stop = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); isDragging = null; };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', stop);
}

hueCanvas.addEventListener('mousedown', e => initDrag(e, 'hue'));
lightCanvas.addEventListener('mousedown', e => initDrag(e, 'light'));

// INPUT HANDLER
hexInput.addEventListener('input', (e) => {
    let val = e.target.value;
    // Разрешаем ввод без решетки, добавляем её сами для проверки
    if(!val.startsWith('#') && val.length === 6) val = '#' + val;

    if (/^#[0-9A-F]{6}$/i.test(val)) {
        const hsl = hexToHsl(val);
        colorState.h = hsl.h;
        colorState.s = hsl.s;
        colorState.l = hsl.l;
        
        drawLightBar();
        updateThumbs();
        applyToSelection(val); // <--- ПРИМЕНЯЕМ СРАЗУ
    }
});

// --- возможность открывать свой picker при клике на цветные контролы в панели ---
// клик по input или по добавленному swatch запускает picker
specRoot_2.addEventListener('click', e => {
    let ctrl = e.target.closest('input[type="color"][data-prop]');
    // если клик был по swatch, перенаправляем на связанный input
    if (!ctrl) {
        const sw = e.target.closest('.color-swatch');
        if (sw && sw._input) ctrl = sw._input;
    }
    // если клик был по тексту в label, ищем вложенный input
    if (!ctrl) {
        const lbl = e.target.closest('label');
        if (lbl) {
            const inp = lbl.querySelector('input[type="color"][data-prop]');
            if (inp) ctrl = inp;
        }
    }
    if (!ctrl) return;
    e.preventDefault();
    const prop = ctrl.getAttribute('data-prop');
    const currentHex = ctrl.value || '';
    const targetEl = lastHighlightedElement || null;
    if (!targetEl) return;
    openColorPicker({ style:{ prop }, ctrl }, targetEl, currentHex, ctrl);
});
// блокируем также события mousedown на реальный input, чтобы не показывать native picker
specRoot_2.addEventListener('mousedown', e => {
    if (e.target.closest('input[type="color"][data-prop]')) {
        e.preventDefault();
    }
});

// --- визуальные swatch-элементы для цветовых контролов -----------------------
function initColorSwatches() {
    const inputs = specRoot_2.querySelectorAll('input[type="color"][data-prop]');
    inputs.forEach(inp => {
        // создать видимый квадратик
        const sw = document.createElement('span');
        sw.className = 'color-swatch';
        sw.dataset.prop = inp.dataset.prop;
        sw.style.display = 'inline-block';
        sw.style.width = '1em';
        sw.style.height = '1em';
        sw.style.marginLeft = '0.4em';
        sw.style.verticalAlign = 'middle';
        sw.style.border = '1px solid #666';
        sw.style.backgroundColor = inp.value || '#000000';
        // скрыть сам input, но оставить для хранения значения
        inp.style.position = 'absolute';
        inp.style.opacity = '0';
        inp.style.width = '0';
        inp.style.height = '0';
        inp.style.pointerEvents = 'none';
        inp.parentNode.insertBefore(sw, inp.nextSibling);
        // связываем друг с другом
        sw._input = inp;
        inp._swatch = sw;
        // если значение input изменится программно, обновим swatch
        const observer = new MutationObserver(() => {
            sw.style.backgroundColor = inp.value || '#000000';
        });
        observer.observe(inp, { attributes: true, attributeFilter: ['value'] });
    });
}
// вызвать инициализацию сразу
if (specRoot_2) initColorSwatches();

closeBtn.addEventListener('click', () => picker.style.display = 'none');
document.addEventListener('mousedown', e => {
    if (picker.style.display === 'block' &&
        !picker.contains(e.target) &&
        !e.target.closest('[simpleformats-button]')) {
        picker.style.display = 'none';

        restoreSelection(); 
        const hex = hslToHex(colorState.h, colorState.s, colorState.l);
        
        if (typeof applyToSelection === 'function') {
            applyToSelection(hex);
        }
    }
});

/* стандартнй выбор цвета */
const presetsWrap = document.getElementById('color-presets');

const presetColors = [
    [
        ['#660000','#990000','#ff0000','#ff6666','#ff9999'],
        ['#663300','#994d00','#ff8000','#ffb366','#ffd699'],
        ['#666600','#999900','#ffff00','#ffff66','#ffff99'],
        ['#336600','#4d9900','#80ff00','#b3ff66','#d9ff99'],
        ['#006666','#009999','#00ffff','#66ffff','#99ffff'],
        ['#003366','#004d99','#0080ff','#66b3ff','#99d6ff'],
        ['#330066','#4d0099','#8000ff','#b366ff','#d9b3ff'],
        ['#660033','#99004d','#ff0080','#ff66b3','#ff99cc'],
        ['#000000','#444444','#888888','#cccccc','#ffffff']
    ],
    [
        ['#0f0f0f','#3a0ca3','#ff006e','#2ec4b6','#ffd60a'],
        ['#001219','#005f73','#0a9396','#94d2bd','#e9d8a6'],
        ['#1b4332','#2d6a4f','#40916c','#74c69d','#b7e4c7'],
        ['#2b2d42','#8d99ae','#ef233c','#fca311','#06d6a0']
    ],
];

const presetGroupsWrap = document.createElement('div');
presetGroupsWrap.id = 'color-presets-groups';
presetsWrap.appendChild(presetGroupsWrap);

presetColors.forEach(group => {
    const groupWrap = document.createElement('div');
    groupWrap.className = 'color-preset-group';

    group.forEach(col => {
        col.forEach(color => {
            const el = document.createElement('div');
            el.style.backgroundColor = color;

            el.addEventListener('click', () => {
                const hsl = hexToHsl(color);
                colorState.h = hsl.h;
                colorState.s = hsl.s;
                colorState.l = hsl.l;

                syncFromState(true);
            });

            groupWrap.appendChild(el);
        });
    });

    presetGroupsWrap.appendChild(groupWrap);
});


// --- OPEN ---
// openColorPicker — открывает собственное окно выбора цвета
// cfg: объект конфигурации, минимум { style:{ prop: 'css-property' } }
// el: элемент, с которым связаны изменения (обычно выделенный элемент или null)
// currentHex: стартовый цвет (строка '#rrggbb')
// positionEl (опционально): элемент для позиционирования окна picker, по умолчанию используется el
function openColorPicker(cfg, el, currentHex, positionEl) {
    // activeContext хранит назначение: css-свойство, целевой элемент и возможно контрол
    activeContext = { prop: cfg.style.prop, el, ctrl: cfg.ctrl || null };
    
    // Парсинг стартового цвета
    if (currentHex && /^#[0-9A-F]{6}$/i.test(currentHex)) {
        Object.assign(colorState, hexToHsl(currentHex));
    } else {
        colorState.h = 0; colorState.s = 100; colorState.l = 50;
    }

    picker.style.display = 'block';
    drawHueBar();
    syncFromState();

    // Positioning — элемент, по которому вычисляем координаты
    const posEl = positionEl || el;
    if (posEl) {
        const r = posEl.getBoundingClientRect();
        let top = r.bottom + window.scrollY + 6;
        let left = r.left + window.scrollX;
        if (left + 300 > window.innerWidth) left = window.innerWidth - 310;
        if (left < 10) left = 10;
        if (r.bottom + 160 > window.innerHeight) top = r.top + window.scrollY - 170;
        picker.style.top = top + 'px';
        picker.style.left = left + 'px';
    }
}

document.addEventListener('mousedown', e => {
    const btn = e.target.closest('[simpleformats-button]');
    if(!btn) return;
    const type = btn.getAttribute('simpleformats-button');
    if(['text-color','bg-color'].includes(type)){
        openColorPicker({ style:{ prop: type } }, btn, null);
    }
});