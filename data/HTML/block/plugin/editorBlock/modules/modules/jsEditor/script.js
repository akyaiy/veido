/* ===
 * Элементы DOM редактора кода
 === */

const codeWizardToggle = document.getElementById('codeWizardToggle');
const jsEditorContent = document.getElementById('jsEditorContent');
let lastSource = '';

/* ===
 * Новый парсер JavaScript -> Scratch-like блоки
 *
 * Реализован через лексер и рекурсивный парсер, формирующий простое AST,
 * затем трансформирует AST в HTML-структуру, соответствующую page.html.
 *
 * Сохраняет стиль: camelCase, комментарии и отступы в коде.
 */

// --- Лексер --------------------------------------------------------------
function tokenize(code) {
    const tokens = [];
    let i = 0;
    const len = code.length;

    const isSpace = c => /\s/.test(c);
    const isIdStart = c => /[A-Za-z_$]/.test(c);
    const isId = c => /[A-Za-z0-9_$]/.test(c);

    while (i < len) {
        const ch = code[i];
        // whitespace
        if (isSpace(ch)) { i++; continue; }

        // comments
        if (ch === '/' && code[i+1] === '/') {
            let j = i + 2;
            while (j < len && code[j] !== '\n') j++;
            tokens.push({ type: 'CommentLine', value: code.slice(i, j) });
            i = j; continue;
        }
        if (ch === '/' && code[i+1] === '*') {
            let j = i + 2;
            while (j < len && !(code[j] === '*' && code[j+1] === '/')) j++;
            j = Math.min(len, j+2);
            tokens.push({ type: 'CommentBlock', value: code.slice(i, j) });
            i = j; continue;
        }

        // strings
        if (ch === '"' || ch === "'" || ch === '`') {
            const quote = ch; let j = i + 1; let escaped = false;
            while (j < len) {
                const c = code[j];
                if (!escaped && c === quote) { j++; break; }
                if (!escaped && c === '\\') escaped = true; else escaped = false;
                j++;
            }
            tokens.push({ type: 'String', value: code.slice(i, j) });
            i = j; continue;
        }

        // numbers
        if (/[0-9]/.test(ch)) {
            let j = i + 1; while (j < len && /[0-9\.eE+-]/.test(code[j])) j++;
            tokens.push({ type: 'Numeric', value: code.slice(i, j) });
            i = j; continue;
        }

        // identifiers and keywords
        if (isIdStart(ch)) {
            let j = i + 1; while (j < len && isId(code[j])) j++;
            const word = code.slice(i, j);
            const keywords = new Set(['if','else','for','while','function','return','const','let','var','async','await','switch','case','break','continue','typeof','new','class','import','export','true','false','null','undefined']);
            tokens.push({ type: keywords.has(word) ? 'Keyword' : 'Identifier', value: word });
            i = j; continue;
        }

        // punctuators and operators
        const two = code.slice(i, i+2);
        const three = code.slice(i, i+3);
        const multi = ['===','!==','=>','==','!=','<=','>=','&&','||','++','--','+=','-=','*=','/='];
        if (multi.includes(three)) { tokens.push({ type:'Punct', value: three }); i += 3; continue; }
        if (multi.includes(two)) { tokens.push({ type:'Punct', value: two }); i += 2; continue; }

        // single char
        tokens.push({ type: 'Punct', value: ch }); i++; continue;
    }

    tokens.push({ type: 'EOF' });
    return tokens;
}

// --- Простой парсер (рекурсивный) --------------------------------------
function createParser(tokens) {
    let pos = 0;
    function peek() { return tokens[pos]; }
    function next() { return tokens[pos++]; }
    function expect(type, value) {
        const t = peek();
        if (t.type !== type || (value !== undefined && t.value !== value)) throw new Error('Parse error');
        return next();
    }

    function parseProgram() {
        const body = [];
        while (peek().type !== 'EOF') {
            const node = parseStatement(); if (node) body.push(node);
        }
        return { type: 'Program', body };
    }

    function parseStatement() {
        const t = peek();
        if (!t) return null;
        if (t.type === 'CommentLine' || t.type === 'CommentBlock') { next(); return { type: 'Comment', value: t.value }; }
        if (t.type === 'Keyword' && t.value === 'async') {
            if (tokens[pos+1] && tokens[pos+1].type === 'Keyword' && tokens[pos+1].value === 'function') {
                next(); // consume async
                return parseFunctionDeclaration(true);
            }
        }
        if (t.type === 'Keyword') {
            if (t.value === 'if') return parseIfStatement();
            if (t.value === 'for') return parseForStatement();
            if (t.value === 'while') return parseWhileStatement();
            if (t.value === 'function') return parseFunctionDeclaration(false);
            if (t.value === 'return') return parseReturnStatement();
            if (t.value === 'const' || t.value === 'let' || t.value === 'var') return parseVariableDeclaration();
        }
        if (t.type === 'Punct' && t.value === '{') return parseBlockStatement();
        return parseExpressionStatement();
    }

    function parseBlockStatement() {
        expect('Punct','{');
        const body = [];
        while (!(peek().type === 'Punct' && peek().value === '}')) {
            if (peek().type === 'EOF') break;
            const s = parseStatement(); if (s) body.push(s);
        }
        if (peek().type === 'Punct' && peek().value === '}') next();
        return { type: 'BlockStatement', body };
    }

    function parseIfStatement() {
        next();
        if (peek().type === 'Punct' && peek().value === '(') { next(); var test = parseExpression(); if (peek().type === 'Punct' && peek().value === ')') next(); }
        else var test = parseExpression();
        let consequent = null;
        if (peek().type === 'Punct' && peek().value === '{') consequent = parseBlockStatement(); else consequent = parseStatement();
        let alternate = null;
        if (peek().type === 'Keyword' && peek().value === 'else') { next(); if (peek().type === 'Punct' && peek().value === '{') alternate = parseBlockStatement(); else alternate = parseStatement(); }
        return { type: 'IfStatement', test, consequent, alternate };
    }

    function parseForStatement() {
        next();
        expect('Punct','(');
        const init = (peek().type === 'Punct' && peek().value === ';') ? null : (peek().type === 'Keyword' && (peek().value==='let'||peek().value==='const'||peek().value==='var') ? parseVariableDeclaration(true) : parseExpression());
        if (peek().type === 'Punct' && peek().value === ';') next();
        const test = (peek().type === 'Punct' && peek().value === ';') ? null : parseExpression();
        if (peek().type === 'Punct' && peek().value === ';') next();
        const update = (peek().type === 'Punct' && peek().value === ')') ? null : parseExpression();
        expect('Punct',')');
        const body = (peek().type === 'Punct' && peek().value === '{') ? parseBlockStatement() : parseStatement();
        return { type: 'ForStatement', init, test, update, body };
    }

    function parseWhileStatement() { next(); if (peek().type === 'Punct' && peek().value === '(') { next(); var test = parseExpression(); expect('Punct',')'); } else var test = parseExpression(); const body = (peek().type==='Punct'&&peek().value==='{')?parseBlockStatement():parseStatement(); return { type:'WhileStatement', test, body }; }

    function parseFunctionDeclaration(isAsync=false) {
        if (peek().type === 'Keyword' && peek().value === 'function') next();
        let id = null;
        if (peek().type === 'Identifier') id = next().value;
        expect('Punct','(');
        const params = [];
        while (!(peek().type === 'Punct' && peek().value === ')')) {
            if (peek().type === 'Identifier') params.push(next().value);
            if (peek().type === 'Punct' && peek().value === ',') next();
            else break;
        }
        expect('Punct',')');
        let body = null;
        if (peek().type === 'Punct' && peek().value === '{') body = parseBlockStatement();
        return { type: 'FunctionDeclaration', id, params, body, async: !!isAsync };
    }

    function parseReturnStatement() { next(); const arg = (peek().type==='Punct'&&peek().value===';')?null:parseExpression(); if (peek().type==='Punct'&&peek().value===';') next(); return { type: 'ReturnStatement', argument: arg }; }

    function parseVariableDeclaration(inForInit=false) {
        const kind = next().value;
        const declarations = [];
        while (true) {
            const id = expect('Identifier').value;
            let init = null;
            if (peek().type === 'Punct' && peek().value === '=') { next(); init = parseExpression(); }
            declarations.push({ id, init });
            if (peek().type === 'Punct' && peek().value === ',') { next(); continue; }
            break;
        }
        if (!inForInit && peek().type === 'Punct' && peek().value === ';') next();
        return { type: 'VariableDeclaration', kind, declarations };
    }

    function parseExpressionStatement() {
        const expr = parseExpression();
        if (peek().type === 'Punct' && peek().value === ';') next();
        return { type: 'ExpressionStatement', expression: expr };
    }

    function parseExpression() { return parseAssignment(); }
    
    function lookaheadIsArrow(startPos) {
        const t = tokens[startPos];
        if (!t) return false;
        if (t.type === 'Identifier') return tokens[startPos+1] && tokens[startPos+1].type === 'Punct' && tokens[startPos+1].value === '=>';
        if (t.type === 'Punct' && t.value === '(') {
            let depth = 0; let i = startPos;
            while (i < tokens.length) {
                const tt = tokens[i];
                if (tt.type === 'Punct' && tt.value === '(') depth++;
                else if (tt.type === 'Punct' && tt.value === ')') { depth--; if (depth === 0) return tokens[i+1] && tokens[i+1].type === 'Punct' && tokens[i+1].value === '=>'; }
                i++;
            }
            return false;
        }
        return false;
    }

    function parseArrowFunction(isAsync=false) {
        const params = [];
        if (peek().type === 'Identifier') { params.push(next().value); }
        else if (peek().type === 'Punct' && peek().value === '(') {
            next();
            while (!(peek().type === 'Punct' && peek().value === ')')) {
                if (peek().type === 'Identifier') params.push(next().value);
                if (peek().type === 'Punct' && peek().value === ',') next();
                else break;
            }
            if (peek().type === 'Punct' && peek().value === ')') next();
        }
        if (peek().type === 'Punct' && peek().value === '=>') next();
        let body = null;
        if (peek().type === 'Punct' && peek().value === '{') body = parseBlockStatement();
        else body = parseExpression();
        return { type: 'ArrowFunctionExpression', params, body, async: !!isAsync };
    }

    function parseAssignment() {
        if (peek().type === 'Keyword' && peek().value === 'async' && lookaheadIsArrow(pos+1)) {
            next(); return parseArrowFunction(true);
        }
        if (lookaheadIsArrow(pos)) return parseArrowFunction(false);

        const left = parseLogicalOr();
        if (peek().type === 'Punct' && ['=','+=','-=','*=','/='].includes(peek().value)) {
            const op = next().value; const right = parseAssignment(); return { type: 'AssignmentExpression', operator: op, left, right };
        }
        return left;
    }
    function parseLogicalOr() {
        let left = parseLogicalAnd();
        while (peek().type === 'Punct' && peek().value === '||') { const op = next().value; const right = parseLogicalAnd(); left = { type: 'LogicalExpression', operator: op, left, right }; }
        return left;
    }
    function parseLogicalAnd() {
        let left = parseEquality();
        while (peek().type === 'Punct' && peek().value === '&&') { const op = next().value; const right = parseEquality(); left = { type: 'LogicalExpression', operator: op, left, right }; }
        return left;
    }
    function parseEquality() { let left = parseRelational(); while (peek().type==='Punct' && ['==','!=','===','!=='].includes(peek().value)) { const op=next().value; const right=parseRelational(); left={type:'BinaryExpression',operator:op,left,right}; } return left; }
    function parseRelational() { let left = parseAddSub(); while (peek().type==='Punct' && ['<','>','<=','>='].includes(peek().value)) { const op=next().value; const right=parseAddSub(); left={type:'BinaryExpression',operator:op,left,right}; } return left; }
    function parseAddSub() { let left = parseMulDiv(); while (peek().type==='Punct' && ['+','-'].includes(peek().value)) { const op=next().value; const right=parseMulDiv(); left={type:'BinaryExpression',operator:op,left,right}; } return left; }
    function parseMulDiv() { let left = parseUnary(); while (peek().type==='Punct' && ['*','/','%'].includes(peek().value)) { const op=next().value; const right=parseUnary(); left={type:'BinaryExpression',operator:op,left,right}; } return left; }
    function parseUnary() {
        if (peek().type==='Punct' && (peek().value==='+'||peek().value==='-'||peek().value==='!')) { const op=next().value; const arg=parseUnary(); return { type:'UnaryExpression', operator:op, argument:arg }; }
        if (peek().type==='Keyword' && peek().value==='typeof') { next(); const arg = parseUnary(); return { type:'UnaryExpression', operator:'typeof', argument:arg }; }
        return parseUpdate();
    }
    function parseUpdate() { let expr = parsePrimary(); if (peek().type==='Punct' && (peek().value==='++'||peek().value==='--')) { const op = next().value; return { type:'UpdateExpression', operator:op, argument:expr, prefix:false }; } return expr; }

    function parsePrimary() {
        const t = peek();
        if (t.type === 'Numeric' || t.type === 'String') { next(); return { type:'Literal', value: t.value }; }
        if (t.type === 'Keyword' && (t.value==='true'||t.value==='false'||t.value==='null'||t.value==='undefined')) { next(); return { type:'Literal', value: t.value }; }
        if (t.type === 'Keyword' && t.value === 'function') {
            // anonymous function expression
            next();
            let id = null;
            if (peek().type === 'Identifier') id = next().value;
            expect('Punct','(');
            const params = [];
            while (!(peek().type === 'Punct' && peek().value === ')')) {
                if (peek().type === 'Identifier') params.push(next().value);
                if (peek().type === 'Punct' && peek().value === ',') next();
                else break;
            }
            expect('Punct',')');
            let body = null;
            if (peek().type === 'Punct' && peek().value === '{') body = parseBlockStatement();
            return { type: 'FunctionExpression', id, params, body };
        }
        if (t.type === 'Identifier') { next(); let node = { type:'Identifier', name: t.value };
            while (peek().type === 'Punct' && (peek().value === '.' || peek().value === '(')) {
                if (peek().value === '.') { next(); const prop = expect('Identifier').value; node = { type:'MemberExpression', object: node, property: { type:'Identifier', name: prop } }; }
                else if (peek().value === '(') { next(); const args = []; while (!(peek().type==='Punct' && peek().value===')')) { args.push(parseExpression()); if (peek().type==='Punct' && peek().value===',') next(); } expect('Punct',')'); node = { type:'CallExpression', callee: node, arguments: args }; }
            }
            return node;
        }
        if (t.type === 'Punct' && t.value === '(') { next(); const expr = parseExpression(); expect('Punct',')'); return expr; }
        if (t.type === 'Punct' && t.value === '[') { next(); const elements = []; while (!(peek().type==='Punct' && peek().value===']')) { elements.push(parseExpression()); if (peek().type==='Punct'&&peek().value===',') next(); } expect('Punct',']'); return { type:'ArrayExpression', elements }; }
        if (t.type === 'Punct' && t.value === '{') { next(); const properties = []; while (!(peek().type==='Punct'&&peek().value==='}')) { const keyTok = peek(); let key = null; if (keyTok.type==='Identifier') key = next().value; else if (keyTok.type==='String') key = next().value; if (peek().type==='Punct'&&peek().value===':') next(); const val = parseExpression(); properties.push({ key, value: val }); if (peek().type==='Punct'&&peek().value===',') next(); } expect('Punct','}'); return { type:'ObjectExpression', properties }; }
        if (t.type === 'Keyword' && t.value === 'await') { next(); const arg = parsePrimary(); return { type:'AwaitExpression', argument: arg }; }
        next(); return { type:'Literal', value: t.value };
    }

    return { parseProgram };
}

// --- Трансформация AST -> DOM блоки (page.html стиль) -------------------
function astToBlocks(ast) {
    function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text!==undefined) e.textContent = text; return e; }

    function flattenMember(node) {
        if (!node) return '';
        if (node.type === 'Identifier') return node.name;
        if (node.type === 'MemberExpression') return flattenMember(node.object) + '.' + (node.property && node.property.name ? node.property.name : '');
        return '';
    }

    function makeVariablesNode(value) {
        const text = typeof value === 'string' ? value : (value && value.name ? value.name : '');
        return el('div','block variables', text);
    }

    function makeValueNodeLiteral(value) {
        let str = String(value);
        if (/^['"`].*['"`]$/.test(str)) {
            str = str.slice(1, -1);
        }
        return el('div','block value', str);
    }

    function makeConditionBlock(expr) {
        if (!expr || expr.type !== 'BinaryExpression') return null;
        const b = el('div','block scratch-condition');
        const l = el('div','line');
        l.appendChild(makeValueNode(expr.left) || el('div','block variables',''));
        l.appendChild(el('div','block transparent', expr.operator));
        l.appendChild(makeValueNode(expr.right) || el('div','block value',''));
        b.appendChild(l);
        return b;
    }

    function makeBinaryActionBlock(expr) {
        if (!expr || expr.type !== 'BinaryExpression') return null;
        const b = el('div','block dom');
        const l = el('div','line');
        l.appendChild(makeValueNode(expr.left) || el('div','block variables',''));
        let op = expr.operator;
        if (op === '*') op = '×';
        l.appendChild(el('div','block transparent', op));
        l.appendChild(makeValueNode(expr.right) || el('div','block value',''));
        b.appendChild(l);
        return b;
    }

    function makeLogicalExpressionBlock(expr) {
        if (!expr || expr.type !== 'LogicalExpression') return null;
        const frag = document.createDocumentFragment();
        const left = getConditionNode(expr.left);
        if (left) frag.appendChild(left);
        frag.appendChild(el('div','block operators', expr.operator));
        const right = getConditionNode(expr.right);
        if (right) frag.appendChild(right);
        return frag;
    }

    function getConditionNode(expr) {
        if (!expr) return el('div', 'block variables', '');
        if (expr.type === 'LogicalExpression') return makeLogicalExpressionBlock(expr);
        if (expr.type === 'BinaryExpression' && ['<','>','<=','>=','==','!=','===','!=='].includes(expr.operator)) return makeConditionBlock(expr);
        return makeValueNode(expr) || el('div', 'block variables', '');
    }

    function makeAwaitBlock(expr) {
        if (!expr || expr.type !== 'AwaitExpression') return null;
        const outer = el('div','block dom');
        const line = el('div','line');
        line.appendChild(el('div','block transparent','await'));
        if (expr.argument) {
            const argNode = makeArgBlock(expr.argument);
            if (argNode) line.appendChild(argNode);
        }
        outer.appendChild(line);
        return outer;
    }

    function makeUpdateBlock(expr) {
        if (!expr || expr.type !== 'UpdateExpression') return null;
        const outer = el('div','block assign');
        const line = el('div','line');
        line.appendChild(makeValueNode(expr.argument) || el('div','block variables',''));
        line.appendChild(el('div','block transparent', expr.operator));
        outer.appendChild(line);
        return outer;
    }

    function makeUnaryBlock(expr) {
        if (!expr || expr.type !== 'UnaryExpression') return null;
        const outer = el('div', expr.operator === 'typeof' ? 'block operators' : 'block dom');
        const line = el('div','line');
        line.appendChild(el('div','block transparent', expr.operator));
        line.appendChild(makeValueNode(expr.argument) || makeValueNodeLiteral(''));
        outer.appendChild(line);
        return outer;
    }

    function makeCallChainNodeWithArgs(expr) {
        if (expr.callee.type === 'Identifier') {
            const fnName = el('div', 'block function-call function-name');
            fnName.appendChild(document.createTextNode(expr.callee.name));
            for(const a of expr.arguments) {
                const argNode = makeArgBlock(a);
                if (argNode) fnName.appendChild(argNode);
            }
            return fnName;
        }
        const chain = el('div', 'chain');
        let objName = flattenMember(expr.callee.object);
        if (objName === 'console' || objName === 'document') {
            chain.appendChild(el('div', 'block transparent', objName));
        } else {
            chain.appendChild(el('div', 'block variables', objName));
        }
        const fnName = el('div', 'block function-name sub-part');
        fnName.appendChild(document.createTextNode('.' + expr.callee.property.name));
        for(const a of expr.arguments) {
            const argNode = makeArgBlock(a);
            if (argNode) fnName.appendChild(argNode);
        }
        chain.appendChild(fnName);
        return chain;
    }

    function makeCallExpressionBlock(expr) {
        if (!expr || expr.type !== 'CallExpression') return null;
        
        if (expr.callee.type === 'MemberExpression') {
            const obj = flattenMember(expr.callee.object);
            const prop = expr.callee.property.name;
            
            if (prop === 'addEventListener') {
                const outer = el('div','block events has-children');
                const topLine = el('div','line');
                topLine.appendChild(el('div','block transparent', 'addEventListener'));
                topLine.appendChild(el('div','block transparent', '='));
                topLine.appendChild(makeVariablesNode(obj));
                if (expr.arguments[0]) topLine.appendChild(makeValueNode(expr.arguments[0]));
                outer.appendChild(topLine);
                
                if (expr.arguments[1]) {
                    let callbackBody = null;
                    if (expr.arguments[1].type === 'ArrowFunctionExpression' || expr.arguments[1].type === 'FunctionExpression') {
                        callbackBody = expr.arguments[1].body;
                    }
                    if (callbackBody) {
                        const inner = el('div', 'inner');
                        const block = callbackBody.type === 'BlockStatement' ? statementToBlock(callbackBody) : expressionToBlock(callbackBody);
                        if (block) {
                            if (block.classList && block.classList.contains('inner')) {
                                for (const c of Array.from(block.children)) inner.appendChild(c);
                            } else {
                                inner.appendChild(block);
                            }
                        }
                        if (inner.children.length) outer.appendChild(inner);
                    }
                }
                return outer;
            }
            if (obj === 'console' && prop === 'log') {
                const outer = el('div','block looks');
                const line = el('div','line');
                line.appendChild(makeCallChainNodeWithArgs(expr));
                outer.appendChild(line);
                return outer;
            }
            if (prop === 'map') {
                const outer = el('div','block functions has-children');
                const topLine = el('div','line');
                const chain = el('div', 'chain');
                chain.appendChild(makeVariablesNode(obj));
                chain.appendChild(el('div', 'block function-name sub-part', '.' + prop));
                topLine.appendChild(chain);
                outer.appendChild(topLine);
                const inner = el('div','inner');
                if (expr.arguments[0]) {
                    const argNode = makeArgBlock(expr.arguments[0]);
                    if (argNode) inner.appendChild(argNode);
                }
                if (inner.children.length) outer.appendChild(inner);
                return outer;
            }
            if (prop === 'remove') {
                const outer = el('div','block dom');
                const line = el('div','line');
                line.appendChild(makeCallChainNodeWithArgs(expr));
                outer.appendChild(line);
                return outer;
            }
        }
        return makeCallChainNodeWithArgs(expr);
    }

    function makeAssignmentBlock(expr) {
        if (!expr || expr.type !== 'AssignmentExpression') return null;

        if (expr.right && (expr.right.type === 'ArrowFunctionExpression' || expr.right.type === 'FunctionExpression')) {
            const outer = el('div', 'block functions has-children');
            const line = el('div', 'line');
            if (expr.right.async) {
                line.appendChild(el('div', 'block modifier', 'async'));
            }
            line.appendChild(el('div', 'block transparent', 'function'));
            line.appendChild(el('div', 'block transparent', '='));
            
            const funcNameBlock = el('div', 'block function-name');
            const leftName = (expr.left.type === 'Identifier') ? expr.left.name : flattenMember(expr.left);
            funcNameBlock.appendChild(document.createTextNode(leftName));
            
            if (expr.right.params && expr.right.params.length > 0) {
                for (const p of expr.right.params) {
                    funcNameBlock.appendChild(el('div', 'block variables', p)); 
                }
            }
            line.appendChild(funcNameBlock);
            outer.appendChild(line);

            if (expr.right.body) {
                const inner = el('div', 'inner');
                let bodyBlock = expr.right.body.type === 'BlockStatement' ? statementToBlock(expr.right.body) : expressionToBlock(expr.right.body);
                if (bodyBlock) {
                    if (bodyBlock.classList && bodyBlock.classList.contains('inner')) {
                        for (const child of Array.from(bodyBlock.children)) inner.appendChild(child);
                    } else {
                        inner.appendChild(bodyBlock);
                    }
                    if (inner.children.length) outer.appendChild(inner);
                }
            }
            return outer;
        }

        let isHasChildren = false;
        if (expr.right && (expr.right.type === 'ObjectExpression' || expr.right.type === 'ArrayExpression')) {
            isHasChildren = true;
        } else if (expr.right && expr.right.type === 'CallExpression' && expr.right.callee.type === 'MemberExpression') {
            if (expr.right.callee.property.name === 'map') isHasChildren = true;
        }

        const outer = el('div', isHasChildren ? 'block assign has-children' : 'block assign');
        const line = el('div','line');
        
        if (expr.right && expr.right.type === 'ObjectExpression') {
            line.appendChild(el('div', 'block transparent', 'object'));
            line.appendChild(makeValueNode(expr.left));
            outer.appendChild(line);
            const objBlock = makeObjectBlock(expr.right);
            if (objBlock) {
                const inner = objBlock.querySelector('.inner');
                if (inner) outer.appendChild(inner);
            }
            return outer;
        }
        
        if (expr.right && expr.right.type === 'ArrayExpression') {
            line.appendChild(el('div', 'block transparent', 'array'));
            line.appendChild(makeValueNode(expr.left));
            outer.appendChild(line);
            const arrBlock = makeArrayBlock(expr.right);
            if (arrBlock) {
                const inner = arrBlock.querySelector('.inner');
                if (inner) outer.appendChild(inner);
            }
            return outer;
        }

        line.appendChild(makeValueNode(expr.left));
        line.appendChild(el('div','block transparent', expr.operator));
        
        if (expr.right && expr.right.type === 'CallExpression' && expr.right.callee.type === 'MemberExpression' && expr.right.callee.property.name === 'map') {
            outer.appendChild(line);
            const inner = el('div', 'inner');
            const callBlock = makeCallExpressionBlock(expr.right);
            if (callBlock) inner.appendChild(callBlock);
            outer.appendChild(inner);
            return outer;
        }
        
        line.appendChild(makeValueNode(expr.right) || makeValueNodeLiteral(''));
        outer.appendChild(line);
        return outer;
    }

    function makeObjProp(prop) {
        const assignB = el('div','block assign');
        const ln = el('div','line');
        ln.appendChild(makeVariablesNode(prop.key));
        ln.appendChild(el('div','block transparent','='));
        ln.appendChild(makeValueNode(prop.value) || makeValueNodeLiteral(''));
        assignB.appendChild(ln);
        return assignB;
    }

    function makeArrayBlock(expr) {
        if (!expr || expr.type !== 'ArrayExpression') return null;
        const outer = el('div','block assign has-children');
        const top = el('div','line');
        top.appendChild(el('div','block transparent','array'));
        outer.appendChild(top);
        const inner = el('div','inner');
        for (const element of expr.elements) {
            const valueNode = makeValueNode(element) || makeValueNodeLiteral('');
            const line = el('div','line');
            line.appendChild(valueNode);
            inner.appendChild(line);
        }
        if (inner.children.length) outer.appendChild(inner);
        return outer;
    }

    function makeObjectBlock(expr) {
        if (!expr || expr.type !== 'ObjectExpression') return null;
        const outer = el('div','block assign has-children');
        const top = el('div','line');
        top.appendChild(el('div','block transparent','object'));
        outer.appendChild(top);
        const inner = el('div','inner');
        for (const prop of expr.properties) {
            const propBlock = makeObjProp(prop);
            if (propBlock) inner.appendChild(propBlock);
        }
        if (inner.children.length) outer.appendChild(inner);
        return outer;
    }

    function makeArrowFunctionBlock(node) {
        if (!node) return null;
        const outer = el('div','block assign');
        const topLine = el('div','line');
        const params = node.params ? node.params.map(p => makeVariablesNode(p)) : [];
        for (const p of params) topLine.appendChild(p);
        topLine.appendChild(el('div','block transparent','=>'));
        
        if (node.body) {
            if (node.body.type === 'BlockStatement') {
                const inner = el('div', 'inner');
                const b = statementToBlock(node.body);
                if (b) {
                    if (b.classList && b.classList.contains('inner')) {
                        for(const c of Array.from(b.children)) inner.appendChild(c);
                    } else {
                        inner.appendChild(b);
                    }
                }
                outer.classList.add('has-children');
                outer.appendChild(topLine);
                if (inner.children.length) outer.appendChild(inner);
                return outer;
            } else if (node.body.type === 'BinaryExpression') {
                const left = makeValueNode(node.body.left) || el('div','block variables','');
                let op = node.body.operator;
                if (op === '*') op = '×';
                const right = makeValueNode(node.body.right) || el('div','block value','');
                topLine.appendChild(left);
                topLine.appendChild(el('div','block transparent', op));
                topLine.appendChild(right);
                outer.appendChild(topLine);
            } else {
                const bodyBlock = expressionToBlock(node.body);
                if (bodyBlock) topLine.appendChild(bodyBlock);
                outer.appendChild(topLine);
            }
        } else {
            outer.appendChild(topLine);
        }
        return outer;
    }

    function makeValueNode(node) {
        if (!node) return null;
        if (node.type === 'Literal') return makeValueNodeLiteral(node.value);
        if (node.type === 'Identifier') return makeVariablesNode(node.name);
        if (node.type === 'MemberExpression') {
            const flat = flattenMember(node);
            const parts = flat.split('.');
            if (parts.length > 2) {
                const chain = el('div', 'chain');
                chain.appendChild(el('div', 'block variables', parts.slice(0, -1).join('.')));
                chain.appendChild(el('div', 'block sub-part', '.' + parts[parts.length - 1]));
                return chain;
            }
            return makeVariablesNode(flat);
        }
        if (node.type === 'CallExpression') return makeCallExpressionBlock(node);
        if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') return makeArrowFunctionBlock(node);
        if (node.type === 'AwaitExpression') return makeAwaitBlock(node);
        if (node.type === 'ArrayExpression') return makeArrayBlock(node);
        if (node.type === 'ObjectExpression') return makeObjectBlock(node);
        if (node.type === 'BinaryExpression') {
            if (['<','>','<=','>=','==','!=','===','!=='].includes(node.operator)) return makeConditionBlock(node);
            return makeBinaryActionBlock(node);
        }
        if (node.type === 'LogicalExpression') return makeLogicalExpressionBlock(node);
        if (node.type === 'UpdateExpression') return makeUpdateBlock(node);
        if (node.type === 'AssignmentExpression') return makeAssignmentBlock(node);
        if (node.type === 'UnaryExpression') return makeUnaryBlock(node);
        return null;
    }

    function makeArgBlock(a) {
        if (!a) return null;
        if (a.type === 'Literal') return makeValueNodeLiteral(a.value);
        if (a.type === 'Identifier') return makeVariablesNode(a.name);
        if (a.type === 'MemberExpression') {
            const flat = flattenMember(a);
            const parts = flat.split('.');
            if (parts.length > 2) {
                const chain = el('div', 'chain');
                chain.appendChild(el('div', 'block variables', parts.slice(0, -1).join('.')));
                chain.appendChild(el('div', 'block sub-part', '.' + parts[parts.length - 1]));
                return chain;
            }
            return makeVariablesNode(flat);
        }
        if (a.type === 'CallExpression') return makeCallExpressionBlock(a);
        if (a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression') return makeArrowFunctionBlock(a);
        if (a.type === 'AwaitExpression') return makeAwaitBlock(a);
        if (a.type === 'BinaryExpression') return makeBinaryActionBlock(a);
        if (a.type === 'LogicalExpression') return makeLogicalExpressionBlock(a);
        if (a.type === 'ArrayExpression') return makeArrayBlock(a);
        if (a.type === 'ObjectExpression') return makeObjectBlock(a);
        if (a.type === 'UpdateExpression') return makeUpdateBlock(a);
        if (a.type === 'AssignmentExpression') return makeAssignmentBlock(a);
        if (a.type === 'UnaryExpression') return makeUnaryBlock(a);
        return makeValueNode(a) || makeValueNodeLiteral('');
    }

    function statementToBlock(node) {
        if (!node) return null;
        switch(node.type) {
            case 'Comment': return el('div','block comments', node.value);
            case 'ExpressionStatement': return expressionToBlock(node.expression);
            case 'VariableDeclaration': return variableDeclarationToBlock(node);
            case 'FunctionDeclaration': return functionDeclarationToBlock(node);
            case 'IfStatement': return ifStatementToBlock(node);
            case 'ForStatement': return forStatementToBlock(node);
            case 'WhileStatement': return whileStatementToBlock(node);
            case 'ReturnStatement': return returnToBlock(node);
            case 'BlockStatement': {
                const inner = el('div','inner');
                for (const s of node.body) {
                    const b = statementToBlock(s);
                    if (b) inner.appendChild(b);
                }
                return inner.children.length ? inner : null;
            }
        }
        return null;
    }

    function expressionToBlock(expr) {
        if (!expr) return null;
        let block = null;
        if (expr.type === 'AwaitExpression') block = makeAwaitBlock(expr);
        else if (expr.type === 'CallExpression') block = makeCallExpressionBlock(expr);
        else if (expr.type === 'AssignmentExpression') block = makeAssignmentBlock(expr);
        else if (expr.type === 'LogicalExpression') block = makeLogicalExpressionBlock(expr);
        else if (expr.type === 'BinaryExpression') block = makeValueNode(expr);
        else if (expr.type === 'UpdateExpression') block = makeUpdateBlock(expr);
        else if (expr.type === 'UnaryExpression') block = makeUnaryBlock(expr);
        else if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') block = makeArrowFunctionBlock(expr);
        else block = makeValueNode(expr);
        
        if (block) {
            // Оборачиваем цепи, чтобы отдельные вызовы на строке были в блоке Assign
            if (block.nodeType === Node.DOCUMENT_FRAGMENT || (block.classList && block.classList.contains('chain'))) {
                const outer = el('div', 'block assign');
                const line = el('div', 'line');
                line.appendChild(block);
                outer.appendChild(line);
                return outer;
            }
        }
        return block;
    }

    function variableDeclarationToBlock(node) {
        const parts = [];
        for (const d of node.declarations) {
            if (d.init) {
                const pseudoExpr = {
                    type: 'AssignmentExpression',
                    operator: '=',
                    left: { type: 'Identifier', name: d.id },
                    right: d.init
                };
                const assignBlock = makeAssignmentBlock(pseudoExpr);
                if (assignBlock) parts.push(assignBlock);
            } else {
                const outer = el('div','block assign');
                const line = el('div','line');
                line.appendChild(el('div','block variables', d.id));
                outer.appendChild(line);
                parts.push(outer);
            }
        }
        if (parts.length === 1) return parts[0];
        const container = el('div','inner');
        for (const p of parts) container.appendChild(p);
        return container;
    }

    function functionDeclarationToBlock(node) {
        const outer = el('div', 'block functions has-children');
        const line = el('div', 'line');
        
        if (node.async) {
            line.appendChild(el('div', 'block modifier', 'async'));
        }
        line.appendChild(el('div', 'block transparent', 'function'));
        line.appendChild(el('div', 'block transparent', '='));
        
        const funcNameBlock = el('div', 'block function-name');
        funcNameBlock.appendChild(document.createTextNode(node.id || ''));
        if (node.params && node.params.length > 0) {
            for (const p of node.params) {
                funcNameBlock.appendChild(el('div', 'block variables', p));
            }
        }
        line.appendChild(funcNameBlock);
        outer.appendChild(line);

        if (node.body) {
            const inner = el('div', 'inner');
            const bodyBlock = statementToBlock(node.body);
            if (bodyBlock) {
                if (bodyBlock.classList && bodyBlock.classList.contains('inner')) {
                    for (const child of Array.from(bodyBlock.children)) {
                        inner.appendChild(child);
                    }
                } else {
                    inner.appendChild(bodyBlock);
                }
                outer.appendChild(inner);
            }
        }
        return outer;
    }

    function ifStatementToBlock(node) {
        const outer = el('div', 'block control has-children');
        const line = el('div', 'line');
        line.appendChild(el('div', 'block control', 'if'));
        line.appendChild(getConditionNode(node.test));
        outer.appendChild(line);

        if (node.consequent) {
            const inner = el('div', 'inner');
            const consBlock = statementToBlock(node.consequent);
            if (consBlock) {
                if (consBlock.classList && consBlock.classList.contains('inner')) {
                    for (const child of Array.from(consBlock.children)) {
                        inner.appendChild(child);
                    }
                } else {
                    inner.appendChild(consBlock);
                }
                outer.appendChild(inner);
            }
        }
        return outer;
    }

    function forStatementToBlock(node) {
        const outer = el('div', 'block control has-children');
        const line = el('div', 'line');
        line.appendChild(el('div', 'block control', 'for'));
        
        if (node.init) {
            const initBlock = makeValueNode(node.init) || (node.init.type === 'VariableDeclaration' ? variableDeclarationToBlock(node.init) : null);
            if (initBlock) line.appendChild(initBlock);
        }
        if (node.test) {
            line.appendChild(getConditionNode(node.test));
        }
        if (node.update) {
            const updateBlock = makeValueNode(node.update);
            if (updateBlock) line.appendChild(updateBlock);
        }
        outer.appendChild(line);

        if (node.body) {
            const inner = el('div', 'inner');
            const bodyBlock = statementToBlock(node.body);
            if (bodyBlock) {
                if (bodyBlock.classList && bodyBlock.classList.contains('inner')) {
                    for (const child of Array.from(bodyBlock.children)) {
                        inner.appendChild(child);
                    }
                } else {
                    inner.appendChild(bodyBlock);
                }
                outer.appendChild(inner);
            }
        }
        return outer;
    }

    function whileStatementToBlock(node) {
        const outer = el('div','block control has-children');
        const topLine = el('div','line');
        topLine.appendChild(el('div','block control','while'));
        topLine.appendChild(getConditionNode(node.test));
        outer.appendChild(topLine);
        const inner = el('div','inner');
        const body = statementToBlock(node.body);
        if (body) {
            if (body.classList && body.classList.contains('inner')) {
                for (const child of Array.from(body.children)) inner.appendChild(child);
            } else {
                inner.appendChild(body);
            }
        }
        if (inner.children.length) outer.appendChild(inner);
        return outer;
    }

    function returnToBlock(node) {
        const outer = el('div','block dom');
        const line = el('div','line');
        line.appendChild(el('div','block transparent','return'));
        if (node.argument) line.appendChild(makeValueNode(node.argument));
        outer.appendChild(line);
        return outer;
    }

    const frag = document.createDocumentFragment();
    for (const s of ast.body) {
        const b = statementToBlock(s);
        if (b) frag.appendChild(b);
    }
    return frag;
}

// --- Внешняя точка: parseToBlocks --------------------------------------
function parseToBlocks(code) {
    lastSource = code || '';

    const tokens = tokenize(code);
    const parser = createParser(tokens);
    const ast = parser.parseProgram();
    
    const blocksFragment = astToBlocks(ast);

    if (typeof jsEditorContent !== 'undefined' && jsEditorContent) {
        while (blocksFragment.firstChild) jsEditorContent.appendChild(blocksFragment.firstChild);
    }

    return blocksFragment;
}
window.editorBlock = window.editorBlock || {};
window.editorBlock.parseToBlocks = parseToBlocks;


/* ***
 * parseToText - собирает исходный JS код из DOM-структуры
 * Берёт textContent у строк и восстанавливает переносы
 *** */
function parseToText(container) {
    if (lastSource) return lastSource;

    const root = (container && container === jsEditorContent) ? jsEditorContent : container;
    if (!root) return '';
    const lines = [];

    for (const child of root.children) {
        if (child.classList.contains('block')) {
            const lineNode = child.querySelector('.line');
            if (lineNode) lines.push(lineNode.textContent.trim());
            const inner = child.querySelector('.inner');
            if (inner) {
                const innerText = parseToText(inner);
                if (innerText) lines.push(...innerText.split('\n').map(l => l));
            }
        } else if (child.classList.contains('line')) {
            if (child.textContent.trim()) lines.push(child.textContent.trim());
        }
    }

    return lines.join('\n') + (lines.length ? '\n' : '');
}
window.editorBlock.parseToText = parseToText;


/* ===
 * Drag & Drop handlers (упрощённые)
 === */
let dragged = null;
function handleDragStart(event){ const b = event.target.closest('.block'); if (!b) return; dragged = b; event.dataTransfer.effectAllowed = 'move'; }
function handleDragOver(event){ event.preventDefault(); const target = event.target.closest('.block, .inner, #jsEditorContent'); if (!dragged || !target) return; if (target.classList && target.classList.contains('inner')) { target.appendChild(dragged); return; } const parent = target.parentNode; if (parent) parent.insertBefore(dragged, target.nextSibling); }
function handleDrop(event){ event.preventDefault(); }
function handleDragEnd(){ dragged = null; }


/* ===
 * Режимы редактора
 === */
function setEditMode(isWizardMode) {
    if (!jsEditorContent || !codeWizardToggle) return;
    if (isWizardMode) {
        const codeText = jsEditorContent.textContent || '';
        jsEditorContent.innerHTML = '';
        parseToBlocks(codeText);
        jsEditorContent.classList.add('wizard');
    } else {
        if (jsEditorContent.classList.contains('wizard')) {
            const codeText = parseToText(jsEditorContent);
            jsEditorContent.innerHTML = '';
            jsEditorContent.textContent = codeText;
            jsEditorContent.classList.remove('wizard');
        }
    }
    jsEditorContent.setAttribute('contenteditable', isWizardMode ? 'false' : 'plaintext-only');
    codeWizardToggle.classList.toggle('wizard', isWizardMode);
    codeWizardToggle.textContent = isWizardMode ? 'Текстовый режим' : 'Визуальный режим';
}
function toggleCodeWizardMode(){ if (!jsEditorContent) return; setEditMode(!jsEditorContent.classList.contains('wizard')); }

/* Инициализация */
if (codeWizardToggle && jsEditorContent) {
    codeWizardToggle.addEventListener('click', toggleCodeWizardMode);
    jsEditorContent.addEventListener('dragstart', handleDragStart);
    jsEditorContent.addEventListener('dragover', handleDragOver);
    jsEditorContent.addEventListener('drop', handleDrop);
    jsEditorContent.addEventListener('dragend', handleDragEnd);
    setEditMode(false);
}