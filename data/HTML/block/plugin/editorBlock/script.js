const menu = document.getElementById('menuBlockEditor');
const pluginDiv = document.getElementById('plugin-menu-div');
const tabs = Array.from(document.querySelectorAll('#editor-header .tab'));
const cssPanel = document.getElementById('css-panel');
const editorCss = document.getElementById('editor-css');
const editorJs = document.getElementById('editor-js');
const applyJsBtn = document.getElementById('apply-js');
const inputId = document.getElementById('attr-id');
const inputClass = document.getElementById('attr-class');
const inputOther = document.getElementById('attr-other');
const deleteBtn = document.getElementById('attr-delete');
const editBlockInput = document.getElementById('editBlockInput');
const editBlockLoadBtn = document.getElementById('editBlockLoadBtn');

function setActive(tabName) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    cssPanel.classList.toggle('hidden', tabName !== 'css');
    editorJs.classList.toggle('hidden', tabName !== 'js');
    applyJsBtn.classList.toggle('hidden', tabName !== 'js' || editorJs.value.trim() === '');
}

tabs.forEach(t => {
    t.addEventListener('click', () => {
        setActive(t.dataset.tab);
    });
});

let selectedEl = null;

function unwrapIIFE(text) {
    if (!text) return '';
    if (text.includes('try {')) return text.split('try {')[1].split('} catch')[0].trim();
    if (text.includes('})();')) return text.split('{').slice(1).join('{').split('})();')[0].trim();
    return text.trim();
}

function wrapWithIIFE(body) {
    body = body.replace(/^\s*if\s*\(typeof\s+pageInit\s*===\s*["']function["']\)\s*pageInit\(\);\s*$/gm, '');
    return `(() => {\n    try {\n${body.split('\n').map(l => l ? '        '+l : '').join('\n')}\n    } catch (e) {\n        console.error("Block script error:", e);\n    }\n})();`;
}

function findEditBlock() {
    return document.getElementById('editBlock') || null;
}

editBlockLoadBtn.addEventListener('click', () => {
    loadBlock(editBlockInput.value, 'editBlock');
});

function getStyleContent() {
    const styles = Array.from(document.querySelectorAll('style[data-dynamic="editBlock"]')).filter(s => s && s.textContent);
    return styles.map(s => s.textContent || '').join('\n\n');
}

function setStyleContent(text) {
    const edit = findEditBlock();
    if (!edit) return;
    Array.from(edit.querySelectorAll('style[data-dynamic="editBlock"], style[data-dynamic]')).forEach(s => s.remove());
    const s = document.createElement('style');
    s.setAttribute('data-dynamic', 'editBlock');
    s.textContent = text;
    edit.appendChild(s);
}

function getScriptContent() {
    const script = document.querySelector('script[data-dynamic="editBlock"]');
    return script ? script.textContent : ''; 
}

function setScriptContent(text) {
    const edit = findEditBlock();
    if (!edit) return;
    Array.from(edit.querySelectorAll('script[data-dynamic="editBlock"], script[data-dynamic]')).forEach(s => s.remove());
    if (!text || !text.trim()) return;
    const script = document.createElement('script');
    script.setAttribute('data-dynamic', 'editBlock');
    script.textContent = wrapWithIIFE(text);
    edit.appendChild(script);
}

function parseStyleBlocks(styleText) {
    const re = /([^{]+)\{([^}]+)\}/g;
    const blocks = [];
    let m;
    while ((m = re.exec(styleText)) !== null) {
        const selector = m[1].trim();
        const body = m[2].trim();
        blocks.push({ selector, body, raw: selector + ' {' + body + '}' });
    }
    return blocks;
}

function getCombinedCssForEl(el) {
    if (!el) return '';
    const inline = el.getAttribute('style') || '';
    const styleText = getStyleContent() || '';
    const blocks = parseStyleBlocks(styleText);
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    const idSel = el.id ? ('#' + el.id) : '';
    const cls = el.className ? el.className.split(' ')[0] : '';
    const tagBlocks = [];
    const idBlocks = [];
    const classBlocks = [];
    blocks.forEach(b => {
        const selectors = b.selector.split(',').map(s => s.trim());
        selectors.forEach(s => {
            if (s === tag) tagBlocks.push(b.raw);
            else if (idSel && s.indexOf(idSel) !== -1) idBlocks.push(b.raw);
            else if (cls && s.indexOf('.' + cls) !== -1) classBlocks.push(b.raw);
        });
    });
    const parts = [];
    if (inline) parts.push('/* inline */\n' + inline);
    if (tagBlocks.length) parts.push('/* tag */\n' + tagBlocks.join('\n\n'));
    if (idBlocks.length) parts.push('/* id */\n' + idBlocks.join('\n\n'));
    if (classBlocks.length) parts.push('/* class */\n' + classBlocks.join('\n\n'));
    return parts.join('\n\n').trim();
}

function extractBlockFrom(source, idx) {
    const startLine = source.lastIndexOf('\n', idx) + 1;
    const openBrace = source.indexOf('{', idx);
    if (openBrace < 0) return source.slice(startLine).trim();
    let i = openBrace;
    let depth = 0;
    for (; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) {
                let j = i + 1;
                while (j < source.length && /[\s;)]/.test(source[j])) j++;
                return source.slice(startLine, j).trim();
            }
        }
    }
    return source.slice(startLine).trim();
}

function extractNamedFunction(source, name) {
    const fnPatterns = [
        new RegExp('\\bfunction\\s+' + name + '\\s*\\(', 'g'),
        new RegExp('\\b(var|let|const)\\s+' + name + '\\s*=\\s*function\\b', 'g'),
        new RegExp('\\b(var|let|const)\\s+' + name + '\\s*=\\s*\\(', 'g'),
        new RegExp('\\b' + name + '\\s*=\\s*\\(', 'g')
    ];
    for (let p of fnPatterns) {
        const m = p.exec(source);
        if (!m) continue;
        const idx = m.index;
        return extractBlockFrom(source, idx);
    }
    return '';
}

function getMatchedJsBlocksForEl(el) {
    if (!el) return [];
    let src = getScriptContent() || '';
    if (!src) return [];
    src = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const blocks = [];
    const id = el.id || '';
    const cls = el.className ? el.className.split(' ')[0] : '';
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    function extractBalanced(str, startIndex, openChar, closeChar) {
        let count = 0;
        let inString = false;
        let strChar = '';
        for (let i = startIndex; i < str.length; i++) {
            const char = str[i];
            if ((char === '"' || char === "'" || char === '`') && str[i - 1] !== '\\') {
                if (!inString) {
                    inString = true;
                    strChar = char;
                } else if (char === strChar) {
                    inString = false;
                }
            }
            if (!inString) {
                if (char === openChar) count++;
                if (char === closeChar) count--;
            }
            if (count === 0 && i > startIndex) return str.substring(startIndex, i + 1);
        }
        return '';
    }
    function findFnDefinition(fnName) {
        if (!fnName) return;
        const fnRegexes = [
            new RegExp(`function\\s+${fnName}\\s*\\(`, 'g'),
            new RegExp(`(?:const|let|var)\\s+${fnName}\\s*=\\s*\\(`, 'g'),
            new RegExp(`(?:const|let|var)\\s+${fnName}\\s*=\\s*function`, 'g')
        ];
        fnRegexes.forEach(r => {
            let m;
            while ((m = r.exec(src)) !== null) {
                const start = m.index;
                const openParenIndex = src.indexOf('(', start);
                const args = extractBalanced(src, openParenIndex, '(', ')');
                const bodyStart = src.indexOf('{', start + args.length);
                if (bodyStart !== -1) {
                    const body = extractBalanced(src, bodyStart, '{', '}');
                    const fullFn = src.substring(start, bodyStart) + body;
                    if (!blocks.includes(fullFn.trim())) blocks.push(fullFn.trim());
                }
            }
        });
    }
    function processMatch(startRegex, type) {
        let m;
        while ((m = startRegex.exec(src)) !== null) {
            const start = m.index;
            const openParen = src.indexOf('(', start + m[0].length - 1);
            if (openParen === -1) continue;
            
            const args = extractBalanced(src, openParen, '(', ')');
            if (!args) continue;
            
            let end = openParen + args.length;
            if (src[end] === ';') end++;

            const fullStatement = src.substring(start, end);
            if (!blocks.includes(fullStatement.trim())) blocks.push(fullStatement.trim());
            
            if (type === 'event') {
                const parts = args.slice(1, -1).split(',');
                if (parts.length >= 2) {
                    const handler = parts[1].trim();
                    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(handler)) {
                        findFnDefinition(handler);
                    }
                }
            }
        }
    }
    if (id) {
        const varMatch = new RegExp(`(?:const|let|var)\\s+([a-zA-Z0-9_$]+)\\s*=\\s*document\\.(?:getElementById\\(['"\`]${id}['"\`]|querySelector\\(['"\`]#${id}['"\`])`).exec(src);
        const varName = varMatch ? varMatch[1] : null;
        processMatch(new RegExp(`document\\.getElementById\\(['"\`]${id}['"\`]\\)\\.addEventListener`, 'g'), 'event');
        processMatch(new RegExp(`document\\.querySelector\\(['"\`]#${id}['"\`]\\)\\.addEventListener`, 'g'), 'event');
        
        const propRegex = new RegExp(`document\\.getElementById\\(['"\`]${id}['"\`]\\)\\.[a-zA-Z]+\\s*=\\s*([^;]+);`, 'gs');
        let m;
        while ((m = propRegex.exec(src)) !== null) {
            if (m[0] && !blocks.includes(m[0].trim())) blocks.push(m[0].trim());
        }
        if (varName) {
            processMatch(new RegExp(`${varName}\\.addEventListener`, 'g'), 'event');
            const varPropRegex = new RegExp(`${varName}\\.on[a-zA-Z]+\\s*=\\s*[^;]+;`, 'gs');
            while ((m = varPropRegex.exec(src)) !== null) {
                if (m[0] && !blocks.includes(m[0].trim())) blocks.push(m[0].trim());
            }
        }
    }
    if (cls) {
        processMatch(new RegExp(`querySelectorAll\\(['"\`]\\.${cls}['"\`]\\)\\.forEach`, 'g'), 'loop');
        processMatch(new RegExp(`querySelector\\(['"\`]\\.${cls}['"\`]\\)\\.addEventListener`, 'g'), 'event');
    }
    if (tag) {
        processMatch(new RegExp(`querySelectorAll\\(['"\`]${tag}['"\`]\\)\\.forEach`, 'g'), 'loop');
        const tagPropRegex = new RegExp(`${tag}\\.on[a-zA-Z]+\\s*=\\s*[^;]+;`, 'gs');
        let m;
        while ((m = tagPropRegex.exec(src)) !== null) {
            if (m[0] && !blocks.includes(m[0].trim())) blocks.push(m[0].trim());
        }
    }
    const inlineAttrs = Array.from(el.attributes || []).filter(a => a.name.startsWith('on'));
    inlineAttrs.forEach(a => {
        const code = a.value && a.value.trim();
        if (code && !blocks.includes(code)) blocks.push(code);
    });
    return Array.from(new Set(blocks));
}
function formatOtherAttrsForEditor(el) {
    const other = Array.from(el.attributes || []).filter(a => !['id','class','style'].includes(a.name));
    return other.map(a => {
        const v = a.value === '' ? '""' : ('"' + String(a.value).replace(/"/g, '&quot;') + '"');
        return a.name + '=' + v;
    }).join('\n');
}

function parseAttrValue(raw) {
    if (!raw) return '';
    const trimmed = raw.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
    return trimmed;
}

function applyAttrsImmediate(el) {
    if (!el) return;
    if (el.id === 'editBlock') return;
    el.id = inputId.value.trim();
    el.className = inputClass.value.trim();
    const other = inputOther.value.split('\n').map(l => l.trim()).filter(Boolean);
    const existingAttrs = Array.from(el.attributes).map(a => a.name).filter(n => !['id','class','style'].includes(n));
    existingAttrs.forEach(n => el.removeAttribute(n));
    other.forEach(line => {
        const kv = line.split('=');
        const k = kv[0] ? kv[0].trim() : '';
        const v = kv.slice(1).join('=');
        if (!k) return;
        if (!v) el.setAttribute(k, '');
        else el.setAttribute(k, parseAttrValue(v));
    });
}

function updateEditorsForEl(el) {
    if (!el || el.id === 'editBlock') {
        inputId.value = '';
        inputClass.value = '';
        inputOther.value = '';
        editorCss.value = '';
        editorJs.value = '';
        applyJsBtn.classList.add('hidden');
        selectedEl = null;
        return;
    }
    selectedEl = el;
    inputId.value = el.id || '';
    inputClass.value = el.className || '';
    inputOther.value = formatOtherAttrsForEditor(el);
    editorCss.value = getCombinedCssForEl(el);
    const jsBlocks = getMatchedJsBlocksForEl(el);
    editorJs.value = jsBlocks.length ? jsBlocks.join('\n\n') : '';
    applyJsBtn.classList.toggle('hidden', editorJs.value.trim() === '');
}

inputId.addEventListener('input', () => {
    if (!selectedEl) return;
    if (selectedEl.id === 'editBlock') return;
    selectedEl.id = inputId.value.trim();
    editorCss.value = getCombinedCssForEl(selectedEl);
});

inputClass.addEventListener('input', () => {
    if (!selectedEl) return;
    selectedEl.className = inputClass.value;
    editorCss.value = getCombinedCssForEl(selectedEl);
});

inputOther.addEventListener('input', () => {
    if (!selectedEl) return;
    const other = inputOther.value.split('\n').map(l => l.trim()).filter(Boolean);
    const existingAttrs = Array.from(selectedEl.attributes).map(a => a.name).filter(n => !['id','class','style'].includes(n));
    existingAttrs.forEach(n => selectedEl.removeAttribute(n));
    other.forEach(line => {
        const kv = line.split('=');
        const k = kv[0] ? kv[0].trim() : '';
        const v = kv.slice(1).join('=');
        if (!k) return;
        if (!v) selectedEl.setAttribute(k, '');
        else selectedEl.setAttribute(k, parseAttrValue(v));
    });
});

editorCss.addEventListener('input', () => {
    if (!selectedEl) return;
    const content = editorCss.value || '';
    const inlineMatch = content.match(/\/\*\s*inline\s*\*\/\s*([\s\S]*?)(?=\n\/\*|$)/);
    const inlinePart = inlineMatch ? inlineMatch[1].trim() : content.split(/\n\/\*/)[0].trim();
    if (inlinePart) selectedEl.setAttribute('style', inlinePart);
    editorCss.value = getCombinedCssForEl(selectedEl);
});

applyJsBtn.addEventListener('click', () => {
    if (!selectedEl) return;
    const newJs = editorJs.value || '';
    const toRemove = getMatchedJsBlocksForEl(selectedEl);
    const existing = unwrapIIFE(getScriptContent() || '');
    let updated = existing;
    toRemove.forEach(block => {
        if (!block) return;
        const esc = escapeRegExp(block);
        updated = updated.replace(new RegExp(esc, 'g'), '');
    });
    updated = updated.trim();
    const merged = (updated + '\n' + newJs).trim();
    setScriptContent(merged);
    editorJs.value = getMatchedJsBlocksForEl(selectedEl).join('\n\n');
    applyJsBtn.classList.toggle('hidden', editorJs.value.trim() === '');
});

deleteBtn.addEventListener('click', () => {
    if (!selectedEl) return;
    if (selectedEl.id === 'editBlock') return;
    selectedEl.remove();
    selectedEl = findEditBlock();
    updateEditorsForEl(selectedEl);
});

function onEditBlockClick(e) {
    if (!e.target) return;
    const editBlock = findEditBlock();
    if (!editBlock) return;
    if (!editBlock.contains(e.target)) return;
    if (e.target.id === 'editBlock') {
        selectedEl = null;
        updateEditorsForEl(null);
        return;
    }
    selectedEl = e.target;
    updateEditorsForEl(selectedEl);
    e.stopPropagation();
}

const editBlockEl = findEditBlock();
if (editBlockEl) editBlockEl.addEventListener('click', onEditBlockClick, true);

const mo = new MutationObserver(() => {
    selectedEl = null;
    updateEditorsForEl(null);
});

if (editBlockEl) mo.observe(editBlockEl, { childList: true, subtree: true });

if (!selectedEl) selectedEl = null;
updateEditorsForEl(selectedEl);
