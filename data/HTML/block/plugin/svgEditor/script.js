// === Общие ===

// Выбранный элемент
window.selectedElementsSvg = [];

// глобальный режим редактора
window.modeSvgEditor = "selection";

// Xранит индекс ребра
window.lastActiveEdgeIndex = null; 

// Выделеные узлы
window.activePathHandles = [];



// === Отрисовка узлов path ===

// Разбор path в массив абсолющих сегментов
window.parsePathData = parsePathData;
function parsePathData(d) {
    const tokens = (d || "").match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi) || [];
    const segments = [];

    let i = 0;
    let cmd = "";
    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;
    let prevCmd = "";
    let prevC2X = 0;
    let prevC2Y = 0;
    let prevQX = 0;
    let prevQY = 0;

    function isCommand(token) {
        return /^[a-zA-Z]$/.test(token);
    }

    function readNumber() {
        return parseFloat(tokens[i++]);
    }

    while (i < tokens.length) {
        let token = tokens[i++];

        if (isCommand(token)) {
            cmd = token;
        } else {
            i--;
        }

        if (!cmd) break;

        const upper = cmd.toUpperCase();
        const rel = cmd !== upper;

        // Перемещение пера
        if (upper === "M") {
            let first = true;

            while (i + 1 < tokens.length && !isCommand(tokens[i]) && !isCommand(tokens[i + 1])) {
                const nx = readNumber();
                const ny = readNumber();

                const px = rel ? x + nx : nx;
                const py = rel ? y + ny : ny;

                if (first) {
                    segments.push({ type: "M", x: px, y: py });

                    startX = px;
                    startY = py;
                    first = false;
                } else {
                    segments.push({ type: "L", x: px, y: py });
                }

                x = px;
                y = py;
                prevCmd = "L";
            }

            prevC2X = 0;
            prevC2Y = 0;
            prevQX = 0;
            prevQY = 0;
            continue;
        }

        // Линия
        if (upper === "L") {
            while (i + 1 < tokens.length && !isCommand(tokens[i]) && !isCommand(tokens[i + 1])) {
                const nx = readNumber();
                const ny = readNumber();

                x = rel ? x + nx : nx;
                y = rel ? y + ny : ny;

                segments.push({ type: "L", x, y });
                prevCmd = "L";
            }

            prevC2X = 0;
            prevC2Y = 0;
            prevQX = 0;
            prevQY = 0;
            continue;
        }

        // Горизонтальная линия
        if (upper === "H") {
            while (i < tokens.length && !isCommand(tokens[i])) {
                const nx = readNumber();

                x = rel ? x + nx : nx;

                segments.push({ type: "L", x, y });
                prevCmd = "L";
            }

            prevC2X = 0;
            prevC2Y = 0;
            prevQX = 0;
            prevQY = 0;
            continue;
        }

        // Вертикальная линия
        if (upper === "V") {
            while (i < tokens.length && !isCommand(tokens[i])) {
                const ny = readNumber();

                y = rel ? y + ny : ny;

                segments.push({ type: "L", x, y });
                prevCmd = "L";
            }

            prevC2X = 0;
            prevC2Y = 0;
            prevQX = 0;
            prevQY = 0;
            continue;
        }

        // Кубическая кривая Безье
        if (upper === "C") {
            while (i + 5 < tokens.length && !isCommand(tokens[i])) {
                const x1 = rel ? x + readNumber() : readNumber();
                const y1 = rel ? y + readNumber() : readNumber();
                const x2 = rel ? x + readNumber() : readNumber();
                const y2 = rel ? y + readNumber() : readNumber();
                const nx = rel ? x + readNumber() : readNumber();
                const ny = rel ? y + readNumber() : readNumber();

                segments.push({
                    type: "C",
                    x1,
                    y1,
                    x2,
                    y2,
                    x: nx,
                    y: ny
                });

                x = nx;
                y = ny;
                prevCmd = "C";
                prevC2X = x2;
                prevC2Y = y2;
                prevQX = 0;
                prevQY = 0;
            }

            continue;
        }

        // Сглаженная кубическая кривая Безье
        if (upper === "S") {
            while (i + 3 < tokens.length && !isCommand(tokens[i])) {
                const x2 = rel ? x + readNumber() : readNumber();
                const y2 = rel ? y + readNumber() : readNumber();
                const nx = rel ? x + readNumber() : readNumber();
                const ny = rel ? y + readNumber() : readNumber();

                const x1 = (prevCmd === "C" || prevCmd === "S") ? (2 * x - prevC2X) : x;
                const y1 = (prevCmd === "C" || prevCmd === "S") ? (2 * y - prevC2Y) : y;

                segments.push({
                    type: "C",
                    x1,
                    y1,
                    x2,
                    y2,
                    x: nx,
                    y: ny
                });

                x = nx;
                y = ny;
                prevCmd = "C";
                prevC2X = x2;
                prevC2Y = y2;
                prevQX = 0;
                prevQY = 0;
            }

            continue;
        }

        // Квадратичная кривая Безье
        if (upper === "Q") {
            while (i + 3 < tokens.length && !isCommand(tokens[i])) {
                const x1 = rel ? x + readNumber() : readNumber();
                const y1 = rel ? y + readNumber() : readNumber();
                const nx = rel ? x + readNumber() : readNumber();
                const ny = rel ? y + readNumber() : readNumber();

                segments.push({
                    type: "Q",
                    x1,
                    y1,
                    x: nx,
                    y: ny
                });

                x = nx;
                y = ny;
                prevCmd = "Q";
                prevQX = x1;
                prevQY = y1;
                prevC2X = 0;
                prevC2Y = 0;
            }

            continue;
        }

        // Сглаженная квадратичная кривая Безье
        if (upper === "T") {
            while (i + 1 < tokens.length && !isCommand(tokens[i])) {
                const nx = rel ? x + readNumber() : readNumber();
                const ny = rel ? y + readNumber() : readNumber();

                const x1 = (prevCmd === "Q" || prevCmd === "T") ? (2 * x - prevQX) : x;
                const y1 = (prevCmd === "Q" || prevCmd === "T") ? (2 * y - prevQY) : y;

                segments.push({
                    type: "Q",
                    x1,
                    y1,
                    x: nx,
                    y: ny
                });

                x = nx;
                y = ny;
                prevCmd = "Q";
                prevQX = x1;
                prevQY = y1;
                prevC2X = 0;
                prevC2Y = 0;
            }

            continue;
        }

        // Дуга
        if (upper === "A") {
            while (i + 6 < tokens.length && !isCommand(tokens[i])) {
                const rx = readNumber();
                const ry = readNumber();
                const angle = readNumber();
                const largeArcFlag = readNumber();
                const sweepFlag = readNumber();
                const nx = rel ? x + readNumber() : readNumber();
                const ny = rel ? y + readNumber() : readNumber();

                segments.push({
                    type: "A",
                    rx,
                    ry,
                    angle,
                    largeArcFlag,
                    sweepFlag,
                    x: nx,
                    y: ny
                });

                x = nx;
                y = ny;
                prevCmd = "A";
                prevC2X = 0;
                prevC2Y = 0;
                prevQX = 0;
                prevQY = 0;
            }

            continue;
        }

        // Замыкание контура
        if (upper === "Z") {
            segments.push({ type: "Z" });

            x = startX;
            y = startY;

            prevCmd = "Z";
            prevC2X = 0;
            prevC2Y = 0;
            prevQX = 0;
            prevQY = 0;
            continue;
        }

        break;
    }

    return segments;
}

// Сборка строки path из массива сегментов
window.serializePathData = serializePathData;
function serializePathData(segments) {
    const result = [];

    for (const seg of segments) {
        if (seg.type === "M") {
            result.push(`M ${formatSvgNumber(seg.x)} ${formatSvgNumber(seg.y)}`);
        } else if (seg.type === "L") {
            result.push(`L ${formatSvgNumber(seg.x)} ${formatSvgNumber(seg.y)}`);
        } else if (seg.type === "Q") {
            result.push(`Q ${formatSvgNumber(seg.x1)} ${formatSvgNumber(seg.y1)} ${formatSvgNumber(seg.x)} ${formatSvgNumber(seg.y)}`);
        } else if (seg.type === "C") {
            result.push(`C ${formatSvgNumber(seg.x1)} ${formatSvgNumber(seg.y1)} ${formatSvgNumber(seg.x2)} ${formatSvgNumber(seg.y2)} ${formatSvgNumber(seg.x)} ${formatSvgNumber(seg.y)}`);
        } else if (seg.type === "A") {
            result.push(`A ${formatSvgNumber(seg.rx)} ${formatSvgNumber(seg.ry)} ${formatSvgNumber(seg.angle)} ${formatSvgNumber(seg.largeArcFlag)} ${formatSvgNumber(seg.sweepFlag)} ${formatSvgNumber(seg.x)} ${formatSvgNumber(seg.y)}`);
        } else if (seg.type === "Z") {
            result.push("Z");
        }
    }

    return result.join(" ");
}

// Нормализация числа для записи в path
function formatSvgNumber(value) {
    if (!isFinite(value)) return "0";

    const rounded = Math.round(value * 1000) / 1000;

    return String(rounded)
        .replace(/\.0+$/, "")
        .replace(/(\.\d*?)0+$/, "$1");
}



// === Загрузка блоков редактора ===

// Название блоков для редактора
const editorBlocks = [
    "centerPanel",
    "leftPanel",
    "rightPanel",
    "topPanel",
    "topPanel2"
];

// Функция для загрузки блоков редактора 
async function loadEditorBlocks() {
    // Загрузка блоков редактора
    for (const blockName of editorBlocks) {
        await loadBlock(`plugin/svgEditor/${blockName}`, blockName);
    }

    // Событие, сигнализирующее о том, что блоки редактора загружены
    document.dispatchEvent(new Event("svgEditorBlocksLoaded"));
}
loadEditorBlocks();