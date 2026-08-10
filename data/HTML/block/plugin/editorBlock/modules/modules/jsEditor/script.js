/* === Элементы DOM редактора кода === */

// Переключатель визуального режима
const codeWizardToggle = document.getElementById('codeWizardToggle');

// Содержимое редактора кода
const jsEditorContent = document.getElementById('jsEditorContent');

// Последний исходный код
let lastSource = '';



/* === Лексический анализатор кода === */

/* ***
 * tokenize - разбиение исходного кода на токены
 * - принимает строку кода
 * - анализирует символы и ключевые слова
 * - возвращает массив токенов
*** */
function tokenize(code) {
    const tokens = [];
    let i = 0;
    const len = code.length;

    while (i < len) {
        const ch = code[i];

        if (isSpace(ch)) {
            i++;
            continue;
        }

        if (ch === '/' && code[i + 1] === '/') {
            let j = i + 2;

            while (j < len && code[j] !== '\n') {
                j++;
            }

            tokens.push({
                type: 'CommentLine',
                value: code.slice(i, j)
            });

            i = j;
            continue;
        }

        if (ch === '/' && code[i + 1] === '*') {
            let j = i + 2;

            while (j < len && !(code[j] === '*' && code[j + 1] === '/')) {
                j++;
            }

            j = Math.min(len, j + 2);

            tokens.push({
                type: 'CommentBlock',
                value: code.slice(i, j)
            });

            i = j;
            continue;
        }

        if (ch === '"' || ch === '\'' || ch === '`') {
            const quote = ch;
            let j = i + 1;
            let escaped = false;

            while (j < len) {
                const c = code[j];

                if (!escaped && c === quote) {
                    j++;
                    break;
                }

                if (!escaped && c === '\\') {
                    escaped = true;
                } else {
                    escaped = false;
                }

                j++;
            }

            tokens.push({
                type: 'String',
                value: code.slice(i, j)
            });

            i = j;
            continue;
        }

        if (/[0-9]/.test(ch)) {
            let j = i + 1;

            while (j < len && /[0-9\.eE+-]/.test(code[j])) {
                j++;
            }

            tokens.push({
                type: 'Numeric',
                value: code.slice(i, j)
            });

            i = j;
            continue;
        }

        if (isIdStart(ch)) {
            let j = i + 1;

            while (j < len && isId(code[j])) {
                j++;
            }

            const word = code.slice(i, j);
            const keywords = new Set(['if', 'else', 'for', 'while', 'function', 'return', 'const', 'let', 'var', 'async', 'await', 'switch', 'case', 'break', 'continue', 'typeof', 'new', 'class', 'import', 'export', 'true', 'false', 'null', 'undefined']);

            tokens.push({
                type: keywords.has(word) ? 'Keyword' : 'Identifier',
                value: word
            });

            i = j;
            continue;
        }

        const two = code.slice(i, i + 2);
        const three = code.slice(i, i + 3);
        const multi = ['===', '!==', '=>', '==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/='];

        if (multi.includes(three)) {
            tokens.push({
                type: 'Punct',
                value: three
            });

            i += 3;
            continue;
        }

        if (multi.includes(two)) {
            tokens.push({
                type: 'Punct',
                value: two
            });

            i += 2;
            continue;
        }

        tokens.push({
            type: 'Punct',
            value: ch
        });

        i++;
    }

    tokens.push({
        type: 'EOF'
    });

    return tokens;
}

/* ***
 * isSpace - проверка символа на пробел
 * - принимает символ
 * - возвращает булево значение
*** */
function isSpace(c) {
    return /\s/.test(c);
}

/* ***
 * isIdStart - проверка начала идентификатора
 * - принимает символ
 * - возвращает булево значение
*** */
function isIdStart(c) {
    return /[A-Za-z_$]/.test(c);
}

/* ***
 * isId - проверка символа идентификатора
 * - принимает символ
 * - возвращает булево значение
*** */
function isId(c) {
    return /[A-Za-z0-9_$]/.test(c);
}



/* === Синтаксический анализатор (парсер) === */

/* ***
 * peek - просмотр текущего токена
 * принимает контекст (ctx)
 * возвращает текущий токен без смещения позиции
*** */
function peek(ctx) {
    return ctx.tokens[ctx.pos];
}

/* ***
 * next - получение токена
 * принимает контекст (ctx)
 * возвращает текущий токен и увеличивает позицию
*** */
function next(ctx) {
    return ctx.tokens[ctx.pos++];
}

/* ***
 * expect - проверка и ожидание токена
 * принимает контекст (ctx), тип и значение
 * проверяет текущий токен, при несоответствии выбрасывает ошибку
 * возвращает следующий токен
*** */
function expect(ctx, type, value) {
    const t = peek(ctx);

    if (t.type !== type || (value !== undefined && t.value !== value)) {
        throw new Error('Parse error');
    }

    return next(ctx);
}

/* ***
 * parseProgram - разбор программы
 * принимает контекст (ctx)
 * циклически разбирает инструкции до конца файла
 * возвращает узел Program с телом программы
*** */
function parseProgram(ctx) {
    const body = [];

    while (peek(ctx).type !== 'EOF') {
        const node = parseStatement(ctx);

        if (node) {
            body.push(node);
        }
    }

    return {
        type: 'Program',
        body
    };
}

/* ***
 * parseStatement - разбор инструкции
 * принимает контекст (ctx)
 * определяет тип токена и вызывает соответствующий парсер
 * возвращает узел AST-инструкции
*** */
function parseStatement(ctx) {
    const t = peek(ctx);

    if (!t) {
        return null;
    }

    if (t.type === 'CommentLine' || t.type === 'CommentBlock') {
        next(ctx);

        return {
            type: 'Comment',
            value: t.value
        };
    }

    if (t.type === 'Keyword' && t.value === 'async') {
        if (ctx.tokens[ctx.pos + 1] && ctx.tokens[ctx.pos + 1].type === 'Keyword' && ctx.tokens[ctx.pos + 1].value === 'function') {
            next(ctx);

            return parseFunctionDeclaration(ctx, true);
        }
    }

    if (t.type === 'Keyword') {
        if (t.value === 'if') {
            return parseIfStatement(ctx);
        }

        if (t.value === 'for') {
            return parseForStatement(ctx);
        }

        if (t.value === 'while') {
            return parseWhileStatement(ctx);
        }

        if (t.value === 'function') {
            return parseFunctionDeclaration(ctx, false);
        }

        if (t.value === 'return') {
            return parseReturnStatement(ctx);
        }

        if (t.value === 'const' || t.value === 'let' || t.value === 'var') {
            return parseVariableDeclaration(ctx);
        }
    }

    if (t.type === 'Punct' && t.value === '{') {
        return parseBlockStatement(ctx);
    }

    return parseExpressionStatement(ctx);
}

/* ***
 * parseBlockStatement - разбор блока кода
 * принимает контекст (ctx)
 * ожидает '{', разбирает инструкции в цикле до '}'
 * возвращает узел BlockStatement
*** */
function parseBlockStatement(ctx) {
    expect(ctx, 'Punct', '{');

    const body = [];

    while (!(peek(ctx).type === 'Punct' && peek(ctx).value === '}')) {
        if (peek(ctx).type === 'EOF') {
            break;
        }

        const s = parseStatement(ctx);

        if (s) {
            body.push(s);
        }
    }

    if (peek(ctx).type === 'Punct' && peek(ctx).value === '}') {
        next(ctx);
    }

    return {
        type: 'BlockStatement',
        body
    };
}

/* ***
 * parseIfStatement - разбор условного оператора if
 * принимает контекст (ctx)
 * разбирает условие и ветки выполнения (consequent и alternate)
 * возвращает узел IfStatement
*** */
function parseIfStatement(ctx) {
    next(ctx);

    let test = null;

    if (peek(ctx).type === 'Punct' && peek(ctx).value === '(') {
        next(ctx);
        test = parseExpression(ctx);

        if (peek(ctx).type === 'Punct' && peek(ctx).value === ')') {
            next(ctx);
        }
    } else {
        test = parseExpression(ctx);
    }

    let consequent = null;

    if (peek(ctx).type === 'Punct' && peek(ctx).value === '{') {
        consequent = parseBlockStatement(ctx);
    } else {
        consequent = parseStatement(ctx);
    }

    let alternate = null;

    if (peek(ctx).type === 'Keyword' && peek(ctx).value === 'else') {
        next(ctx);

        if (peek(ctx).type === 'Punct' && peek(ctx).value === '{') {
            alternate = parseBlockStatement(ctx);
        } else {
            alternate = parseStatement(ctx);
        }
    }

    return {
        type: 'IfStatement',
        test,
        consequent,
        alternate
    };
}

/* ***
 * parseForStatement - разбор цикла for
 * принимает контекст (ctx)
 * разбирает инициализацию, условие, обновление и тело цикла
 * возвращает узел ForStatement
*** */
function parseForStatement(ctx) {
    next(ctx);
    expect(ctx, 'Punct', '(');

    const init = (peek(ctx).type === 'Punct' && peek(ctx).value === ';') ? null : (peek(ctx).type === 'Keyword' && (peek(ctx).value === 'let' || peek(ctx).value === 'const' || peek(ctx).value === 'var') ? parseVariableDeclaration(ctx, true) : parseExpression(ctx));

    if (peek(ctx).type === 'Punct' && peek(ctx).value === ';') {
        next(ctx);
    }

    const test = (peek(ctx).type === 'Punct' && peek(ctx).value === ';') ? null : parseExpression(ctx);

    if (peek(ctx).type === 'Punct' && peek(ctx).value === ';') {
        next(ctx);
    }

    const update = (peek(ctx).type === 'Punct' && peek(ctx).value === ')') ? null : parseExpression(ctx);

    expect(ctx, 'Punct', ')');

    const body = (peek(ctx).type === 'Punct' && peek(ctx).value === '{') ? parseBlockStatement(ctx) : parseStatement(ctx);

    return {
        type: 'ForStatement',
        init,
        test,
        update,
        body
    };
}

/* ***
 * parseWhileStatement - разбор цикла while
 * принимает контекст (ctx)
 * разбирает условие и тело цикла
 * возвращает узел WhileStatement
*** */
function parseWhileStatement(ctx) {
    next(ctx);

    let test = null;

    if (peek(ctx).type === 'Punct' && peek(ctx).value === '(') {
        next(ctx);
        test = parseExpression(ctx);
        expect(ctx, 'Punct', ')');
    } else {
        test = parseExpression(ctx);
    }

    const body = (peek(ctx).type === 'Punct' && peek(ctx).value === '{') ? parseBlockStatement(ctx) : parseStatement(ctx);

    return {
        type: 'WhileStatement',
        test,
        body
    };
}

/* ***
 * parseFunctionDeclaration - разбор объявления функции
 * принимает контекст (ctx) и флаг асинхронности (isAsync)
 * разбирает имя, параметры и тело функции
 * возвращает узел FunctionDeclaration
*** */
function parseFunctionDeclaration(ctx, isAsync = false) {
    if (peek(ctx).type === 'Keyword' && peek(ctx).value === 'function') {
        next(ctx);
    }

    let id = null;

    if (peek(ctx).type === 'Identifier') {
        id = next(ctx).value;
    }

    expect(ctx, 'Punct', '(');

    const params = [];

    while (!(peek(ctx).type === 'Punct' && peek(ctx).value === ')')) {
        if (peek(ctx).type === 'Identifier') {
            params.push(next(ctx).value);
        }

        if (peek(ctx).type === 'Punct' && peek(ctx).value === ',') {
            next(ctx);
        } else {
            break;
        }
    }

    expect(ctx, 'Punct', ')');

    let body = null;

    if (peek(ctx).type === 'Punct' && peek(ctx).value === '{') {
        body = parseBlockStatement(ctx);
    }

    return {
        type: 'FunctionDeclaration',
        id,
        params,
        body,
        async: !!isAsync
    };
}

/* ***
 * parseReturnStatement - разбор инструкции return
 * принимает контекст (ctx)
 * разбирает возвращаемое выражение
 * возвращает узел ReturnStatement
*** */
function parseReturnStatement(ctx) {
    next(ctx);

    const arg = (peek(ctx).type === 'Punct' && peek(ctx).value === ';') ? null : parseExpression(ctx);

    if (peek(ctx).type === 'Punct' && peek(ctx).value === ';') {
        next(ctx);
    }

    return {
        type: 'ReturnStatement',
        argument: arg
    };
}

/* ***
 * parseVariableDeclaration - разбор объявления переменной
 * принимает контекст (ctx) и флаг инициализации в цикле (inForInit)
 * разбирает тип (let, const, var) и список объявлений
 * возвращает узел VariableDeclaration
*** */
function parseVariableDeclaration(ctx, inForInit = false) {
    const kind = next(ctx).value;
    const declarations = [];

    while (true) {
        const id = expect(ctx, 'Identifier').value;
        let init = null;

        if (peek(ctx).type === 'Punct' && peek(ctx).value === '=') {
            next(ctx);
            init = parseExpression(ctx);
        }

        declarations.push({
            id,
            init
        });

        if (peek(ctx).type === 'Punct' && peek(ctx).value === ',') {
            next(ctx);

            continue;
        }

        break;
    }

    if (!inForInit && peek(ctx).type === 'Punct' && peek(ctx).value === ';') {
        next(ctx);
    }

    return {
        type: 'VariableDeclaration',
        kind,
        declarations
    };
}

/* ***
 * parseExpressionStatement - разбор инструкции-выражения
 * принимает контекст (ctx)
 * разбирает выражение и опциональную точку с запятой
 * возвращает узел ExpressionStatement
*** */
function parseExpressionStatement(ctx) {
    const expr = parseExpression(ctx);

    if (peek(ctx).type === 'Punct' && peek(ctx).value === ';') {
        next(ctx);
    }

    return {
        type: 'ExpressionStatement',
        expression: expr
    };
}

/* ***
 * parseExpression - разбор выражения
 * принимает контекст (ctx)
 * вызывает парсер присваивания
 * возвращает узел выражения
*** */
function parseExpression(ctx) {
    return parseAssignment(ctx);
}

/* ***
 * lookaheadIsArrow - проверка на стрелочную функцию
 * принимает контекст (ctx) и позицию (startPos)
 * анализирует токены вперед на наличие стрелки '=>'
 * возвращает логическое значение
*** */
function lookaheadIsArrow(ctx, startPos) {
    const t = ctx.tokens[startPos];

    if (!t) {
        return false;
    }

    if (t.type === 'Identifier') {
        return ctx.tokens[startPos + 1] && ctx.tokens[startPos + 1].type === 'Punct' && ctx.tokens[startPos + 1].value === '=>';
    }

    if (t.type === 'Punct' && t.value === '(') {
        let depth = 0;
        let i = startPos;

        while (i < ctx.tokens.length) {
            const tt = ctx.tokens[i];

            if (tt.type === 'Punct' && tt.value === '(') {
                depth++;
            } else if (tt.type === 'Punct' && tt.value === ')') {
                depth--;

                if (depth === 0) {
                    return ctx.tokens[i + 1] && ctx.tokens[i + 1].type === 'Punct' && ctx.tokens[i + 1].value === '=>';
                }
            }

            i++;
        }

        return false;
    }

    return false;
}

/* ***
 * parseArrowFunction - разбор стрелочной функции
 * принимает контекст (ctx) и флаг асинхронности (isAsync)
 * разбирает параметры, знак '=>' и тело функции
 * возвращает узел ArrowFunctionExpression
*** */
function parseArrowFunction(ctx, isAsync = false) {
    const params = [];

    if (peek(ctx).type === 'Identifier') {
        params.push(next(ctx).value);
    } else if (peek(ctx).type === 'Punct' && peek(ctx).value === '(') {
        next(ctx);

        while (!(peek(ctx).type === 'Punct' && peek(ctx).value === ')')) {
            if (peek(ctx).type === 'Identifier') {
                params.push(next(ctx).value);
            }

            if (peek(ctx).type === 'Punct' && peek(ctx).value === ',') {
                next(ctx);
            } else {
                break;
            }
        }

        if (peek(ctx).type === 'Punct' && peek(ctx).value === ')') {
            next(ctx);
        }
    }

    if (peek(ctx).type === 'Punct' && peek(ctx).value === '=>') {
        next(ctx);
    }

    let body = null;

    if (peek(ctx).type === 'Punct' && peek(ctx).value === '{') {
        body = parseBlockStatement(ctx);
    } else {
        body = parseExpression(ctx);
    }

    return {
        type: 'ArrowFunctionExpression',
        params,
        body,
        async: !!isAsync
    };
}

/* ***
 * parseAssignment - разбор присваивания
 * принимает контекст (ctx)
 * проверяет на стрелочные функции, разбирает левую часть и оператор присваивания
 * возвращает узел AssignmentExpression
*** */
function parseAssignment(ctx) {
    if (peek(ctx).type === 'Keyword' && peek(ctx).value === 'async' && lookaheadIsArrow(ctx, ctx.pos + 1)) {
        next(ctx);

        return parseArrowFunction(ctx, true);
    }

    if (lookaheadIsArrow(ctx, ctx.pos)) {
        return parseArrowFunction(ctx, false);
    }

    const left = parseLogicalOr(ctx);

    if (peek(ctx).type === 'Punct' && ['=', '+=', '-=', '*=', '/='].includes(peek(ctx).value)) {
        const op = next(ctx).value;
        const right = parseAssignment(ctx);

        return {
            type: 'AssignmentExpression',
            operator: op,
            left,
            right
        };
    }

    return left;
}

/* ***
 * parseLogicalOr - разбор логического ИЛИ
 * принимает контекст (ctx)
 * разбирает операции '||'
 * возвращает узел LogicalExpression
*** */
function parseLogicalOr(ctx) {
    let left = parseLogicalAnd(ctx);

    while (peek(ctx).type === 'Punct' && peek(ctx).value === '||') {
        const op = next(ctx).value;
        const right = parseLogicalAnd(ctx);

        left = {
            type: 'LogicalExpression',
            operator: op,
            left,
            right
        };
    }

    return left;
}

/* ***
 * parseLogicalAnd - разбор логического И
 * принимает контекст (ctx)
 * разбирает операции '&&'
 * возвращает узел LogicalExpression
*** */
function parseLogicalAnd(ctx) {
    let left = parseEquality(ctx);

    while (peek(ctx).type === 'Punct' && peek(ctx).value === '&&') {
        const op = next(ctx).value;
        const right = parseEquality(ctx);

        left = {
            type: 'LogicalExpression',
            operator: op,
            left,
            right
        };
    }

    return left;
}

/* ***
 * parseEquality - разбор равенства
 * принимает контекст (ctx)
 * разбирает операторы сравнения равенства ('==', '!=', '===', '!==')
 * возвращает узел BinaryExpression
*** */
function parseEquality(ctx) {
    let left = parseRelational(ctx);

    while (peek(ctx).type === 'Punct' && ['==', '!=', '===', '!=='].includes(peek(ctx).value)) {
        const op = next(ctx).value;
        const right = parseRelational(ctx);

        left = {
            type: 'BinaryExpression',
            operator: op,
            left,
            right
        };
    }

    return left;
}

/* ***
 * parseRelational - разбор сравнения
 * принимает контекст (ctx)
 * разбирает реляционные операторы ('<', '>', '<=', '>=')
 * возвращает узел BinaryExpression
*** */
function parseRelational(ctx) {
    let left = parseAddSub(ctx);

    while (peek(ctx).type === 'Punct' && ['<', '>', '<=', '>='].includes(peek(ctx).value)) {
        const op = next(ctx).value;
        const right = parseAddSub(ctx);

        left = {
            type: 'BinaryExpression',
            operator: op,
            left,
            right
        };
    }

    return left;
}

/* ***
 * parseAddSub - разбор сложения и вычитания
 * принимает контекст (ctx)
 * разбирает операторы '+' и '-'
 * возвращает узел BinaryExpression
*** */
function parseAddSub(ctx) {
    let left = parseMulDiv(ctx);

    while (peek(ctx).type === 'Punct' && ['+', '-'].includes(peek(ctx).value)) {
        const op = next(ctx).value;
        const right = parseMulDiv(ctx);

        left = {
            type: 'BinaryExpression',
            operator: op,
            left,
            right
        };
    }

    return left;
}

/* ***
 * parseMulDiv - разбор умножения и деления
 * принимает контекст (ctx)
 * разбирает операторы '*', '/' и '%'
 * возвращает узел BinaryExpression
*** */
function parseMulDiv(ctx) {
    let left = parseUnary(ctx);

    while (peek(ctx).type === 'Punct' && ['*', '/', '%'].includes(peek(ctx).value)) {
        const op = next(ctx).value;
        const right = parseUnary(ctx);

        left = {
            type: 'BinaryExpression',
            operator: op,
            left,
            right
        };
    }

    return left;
}

/* ***
 * parseUnary - разбор унарных операторов
 * принимает контекст (ctx)
 * разбирает знаки '+', '-', '!' и ключевое слово 'typeof'
 * возвращает узел UnaryExpression
*** */
function parseUnary(ctx) {
    if (peek(ctx).type === 'Punct' && (peek(ctx).value === '+' || peek(ctx).value === '-' || peek(ctx).value === '!')) {
        const op = next(ctx).value;
        const arg = parseUnary(ctx);

        return {
            type: 'UnaryExpression',
            operator: op,
            argument: arg
        };
    }

    if (peek(ctx).type === 'Keyword' && peek(ctx).value === 'typeof') {
        next(ctx);
        const arg = parseUnary(ctx);

        return {
            type: 'UnaryExpression',
            operator: 'typeof',
            argument: arg
        };
    }

    return parseUpdate(ctx);
}

/* ***
 * parseUpdate - разбор инкремента и декремента
 * принимает контекст (ctx)
 * разбирает постфиксные операторы '++' и '--'
 * возвращает узел UpdateExpression
*** */
function parseUpdate(ctx) {
    let expr = parsePrimary(ctx);

    if (peek(ctx).type === 'Punct' && (peek(ctx).value === '++' || peek(ctx).value === '--')) {
        const op = next(ctx).value;

        return {
            type: 'UpdateExpression',
            operator: op,
            argument: expr,
            prefix: false
        };
    }

    return expr;
}

/* ***
 * parsePrimary - разбор первичных выражений
 * принимает контекст (ctx)
 * разбирает литералы, идентификаторы, массивы, объекты и функции
 * возвращает соответствующий узел AST
*** */
function parsePrimary(ctx) {
    const t = peek(ctx);

    if (t.type === 'Numeric' || t.type === 'String') {
        next(ctx);

        return {
            type: 'Literal',
            value: t.value
        };
    }

    if (t.type === 'Keyword' && (t.value === 'true' || t.value === 'false' || t.value === 'null' || t.value === 'undefined')) {
        next(ctx);

        return {
            type: 'Literal',
            value: t.value
        };
    }

    if (t.type === 'Keyword' && t.value === 'function') {
        next(ctx);

        let id = null;

        if (peek(ctx).type === 'Identifier') {
            id = next(ctx).value;
        }

        expect(ctx, 'Punct', '(');

        const params = [];

        while (!(peek(ctx).type === 'Punct' && peek(ctx).value === ')')) {
            if (peek(ctx).type === 'Identifier') {
                params.push(next(ctx).value);
            }

            if (peek(ctx).type === 'Punct' && peek(ctx).value === ',') {
                next(ctx);
            } else {
                break;
            }
        }

        expect(ctx, 'Punct', ')');

        let body = null;

        if (peek(ctx).type === 'Punct' && peek(ctx).value === '{') {
            body = parseBlockStatement(ctx);
        }

        return {
            type: 'FunctionExpression',
            id,
            params,
            body
        };
    }

    if (t.type === 'Identifier') {
        next(ctx);

        let node = {
            type: 'Identifier',
            name: t.value
        };

        while (peek(ctx).type === 'Punct' && (peek(ctx).value === '.' || peek(ctx).value === '(')) {
            if (peek(ctx).value === '.') {
                next(ctx);
                const prop = expect(ctx, 'Identifier').value;

                node = {
                    type: 'MemberExpression',
                    object: node,
                    property: {
                        type: 'Identifier',
                        name: prop
                    }
                };
            } else if (peek(ctx).value === '(') {
                next(ctx);

                const args = [];

                while (!(peek(ctx).type === 'Punct' && peek(ctx).value === ')')) {
                    args.push(parseExpression(ctx));

                    if (peek(ctx).type === 'Punct' && peek(ctx).value === ',') {
                        next(ctx);
                    }
                }

                expect(ctx, 'Punct', ')');

                node = {
                    type: 'CallExpression',
                    callee: node,
                    arguments: args
                };
            }
        }

        return node;
    }

    if (t.type === 'Punct' && t.value === '(') {
        next(ctx);
        const expr = parseExpression(ctx);
        expect(ctx, 'Punct', ')');

        return expr;
    }

    if (t.type === 'Punct' && t.value === '[') {
        next(ctx);

        const elements = [];

        while (!(peek(ctx).type === 'Punct' && peek(ctx).value === ']')) {
            elements.push(parseExpression(ctx));

            if (peek(ctx).type === 'Punct' && peek(ctx).value === ',') {
                next(ctx);
            }
        }

        expect(ctx, 'Punct', ']');

        return {
            type: 'ArrayExpression',
            elements
        };
    }

    if (t.type === 'Punct' && t.value === '{') {
        next(ctx);

        const properties = [];

        while (!(peek(ctx).type === 'Punct' && peek(ctx).value === '}')) {
            const keyTok = peek(ctx);
            let key = null;

            if (keyTok.type === 'Identifier') {
                key = next(ctx).value;
            } else if (keyTok.type === 'String') {
                key = next(ctx).value;
            }

            if (peek(ctx).type === 'Punct' && peek(ctx).value === ':') {
                next(ctx);
            }

            const val = parseExpression(ctx);

            properties.push({
                key,
                value: val
            });

            if (peek(ctx).type === 'Punct' && peek(ctx).value === ',') {
                next(ctx);
            }
        }

        expect(ctx, 'Punct', '}');

        return {
            type: 'ObjectExpression',
            properties
        };
    }

    if (t.type === 'Keyword' && t.value === 'await') {
        next(ctx);
        const arg = parsePrimary(ctx);

        return {
            type: 'AwaitExpression',
            argument: arg
        };
    }

    next(ctx);

    return {
        type: 'Literal',
        value: t.value
    };
}

/* ***
 * createParser - создание парсера кода
 * - принимает массив токенов
 * - возвращает объект с методом parseProgram
*** */
function createParser(tokens) {
    const ctx = {
        tokens,
        pos: 0
    };

    return {
        parseProgram: function () {
            return parseProgram(ctx);
        }
    };
}



/* === Трансформация AST в DOM-блоки === */

/* ***
 * createElementNode - создание DOM-элемента
 * - принимает тег, класс и текстовое содержимое
 * - возвращает созданный DOM-элемент
*** */
function createElementNode(tag, cls, text) {
    const e = document.createElement(tag);

    if (cls) {
        e.className = cls;
    }

    if (text !== undefined) {
        e.textContent = text;
    }

    return e;
}

/* ***
 * flattenMember - преобразование цепочки свойств в строку
 * - принимает узел MemberExpression или Identifier
 * - возвращает строковое представление
*** */
function flattenMember(node) {
    if (!node) {
        return '';
    }

    if (node.type === 'Identifier') {
        return node.name;
    }

    if (node.type === 'MemberExpression') {
        return flattenMember(node.object) + '.' + (node.property && node.property.name ? node.property.name : '');
    }

    return '';
}

/* ***
 * makeVariablesNode - создание узла переменной
 * - принимает значение или имя
 * - возвращает DOM-блок переменной
*** */
function makeVariablesNode(value) {
    const text = typeof value === 'string' ? value : (value && value.name ? value.name : '');

    return createElementNode('div', 'block variables', text);
}

/* ***
 * makeValueNodeLiteral - создание узла литерала значения
 * - принимает значение
 * - возвращает DOM-блок значения
*** */
function makeValueNodeLiteral(value) {
    let str = String(value);

    if (/^['"`].*['"`]$/.test(str)) {
        str = str.slice(1, -1);
    }

    return createElementNode('div', 'block value', str);
}

/* ***
 * makeConditionBlock - создание блока условия
 * - принимает бинарное выражение
 * - возвращает DOM-блок условия
*** */
function makeConditionBlock(expr) {
    if (!expr || expr.type !== 'BinaryExpression') {
        return null;
    }

    const b = createElementNode('div', 'block scratchCondition');
    const l = createElementNode('div', 'line');

    l.appendChild(makeValueNode(expr.left) || createElementNode('div', 'block variables', ''));
    l.appendChild(createElementNode('div', 'block transparent', expr.operator));
    l.appendChild(makeValueNode(expr.right) || createElementNode('div', 'block value', ''));
    b.appendChild(l);

    return b;
}

/* ***
 * makeBinaryActionBlock - создание бинарного арифметического блока
 * - принимает бинарное выражение
 * - возвращает DOM-блок действия
*** */
function makeBinaryActionBlock(expr) {
    if (!expr || expr.type !== 'BinaryExpression') {
        return null;
    }

    const b = createElementNode('div', 'block dom');
    const l = createElementNode('div', 'line');

    l.appendChild(makeValueNode(expr.left) || createElementNode('div', 'block variables', ''));

    let op = expr.operator;

    if (op === '*') {
        op = '×';
    }

    l.appendChild(createElementNode('div', 'block transparent', op));
    l.appendChild(makeValueNode(expr.right) || createElementNode('div', 'block value', ''));
    b.appendChild(l);

    return b;
}

/* ***
 * makeLogicalExpressionBlock - создание логического блока
 * - принимает логическое выражение
 * - возвращает фрагмент документа с логическими блоками
*** */
function makeLogicalExpressionBlock(expr) {
    if (!expr || expr.type !== 'LogicalExpression') {
        return null;
    }

    const frag = document.createDocumentFragment();
    const left = getConditionNode(expr.left);

    if (left) {
        frag.appendChild(left);
    }

    frag.appendChild(createElementNode('div', 'block operators', expr.operator));

    const right = getConditionNode(expr.right);

    if (right) {
        frag.appendChild(right);
    }

    return frag;
}

/* ***
 * getConditionNode - получение узла условия
 * - принимает выражение
 * - возвращает DOM-узел условия
*** */
function getConditionNode(expr) {
    if (!expr) {
        return createElementNode('div', 'block variables', '');
    }

    if (expr.type === 'LogicalExpression') {
        return makeLogicalExpressionBlock(expr);
    }

    if (expr.type === 'BinaryExpression' && ['<', '>', '<=', '>=', '==', '!=', '===', '!=='].includes(expr.operator)) {
        return makeConditionBlock(expr);
    }

    return makeValueNode(expr) || createElementNode('div', 'block variables', '');
}

/* ***
 * makeAwaitBlock - создание блока ожидания асинхронной операции
 * - принимает узел await выражения
 * - возвращает DOM-блок ожидания
*** */
function makeAwaitBlock(expr) {
    if (!expr || expr.type !== 'AwaitExpression') {
        return null;
    }

    const outer = createElementNode('div', 'block dom');
    const line = createElementNode('div', 'line');

    line.appendChild(createElementNode('div', 'block transparent', 'await'));

    if (expr.argument) {
        const argNode = makeArgBlock(expr.argument);

        if (argNode) {
            line.appendChild(argNode);
        }
    }

    outer.appendChild(line);

    return outer;
}

/* ***
 * makeUpdateBlock - создание блока обновления значения
 * - принимает узел обновления
 * - возвращает DOM-блок
*** */
function makeUpdateBlock(expr) {
    if (!expr || expr.type !== 'UpdateExpression') {
        return null;
    }

    const outer = createElementNode('div', 'block assign');
    const line = createElementNode('div', 'line');

    line.appendChild(makeValueNode(expr.argument) || createElementNode('div', 'block variables', ''));
    line.appendChild(createElementNode('div', 'block transparent', expr.operator));
    outer.appendChild(line);

    return outer;
}

/* ***
 * makeUnaryBlock - создание унарного блока
 * - принимает унарное выражение
 * - возвращает DOM-блок
*** */
function makeUnaryBlock(expr) {
    if (!expr || expr.type !== 'UnaryExpression') {
        return null;
    }

    const outer = createElementNode('div', expr.operator === 'typeof' ? 'block operators' : 'block dom');
    const line = createElementNode('div', 'line');

    line.appendChild(createElementNode('div', 'block transparent', expr.operator));
    line.appendChild(makeValueNode(expr.argument) || makeValueNodeLiteral(''));
    outer.appendChild(line);

    return outer;
}

/* ***
 * makeCallChainNodeWithArgs - создание цепочки вызовов с аргументами
 * - принимает вызов функции
 * - возвращает DOM-элемент вызова
*** */
function makeCallChainNodeWithArgs(expr) {
    if (expr.callee.type === 'Identifier') {
        const fnName = createElementNode('div', 'block functionCall functionName');
        fnName.appendChild(document.createTextNode(expr.callee.name));

        for (const a of expr.arguments) {
            const argNode = makeArgBlock(a);

            if (argNode) {
                fnName.appendChild(argNode);
            }
        }

        return fnName;
    }

    const chain = createElementNode('div', 'chain');
    const objName = flattenMember(expr.callee.object);

    if (objName === 'console' || objName === 'document') {
        chain.appendChild(createElementNode('div', 'block transparent', objName));
    } else {
        chain.appendChild(createElementNode('div', 'block variables', objName));
    }

    const fnName = createElementNode('div', 'block functionName subPart');

    fnName.appendChild(document.createTextNode('.' + expr.callee.property.name));

    for (const a of expr.arguments) {
        const argNode = makeArgBlock(a);

        if (argNode) {
            fnName.appendChild(argNode);
        }
    }

    chain.appendChild(fnName);

    return chain;
}

/* ***
 * makeCallExpressionBlock - создание блока вызова функции
 * - принимает вызов функции
 * - возвращает DOM-блок вызова
*** */
function makeCallExpressionBlock(expr) {
    if (!expr || expr.type !== 'CallExpression') {
        return null;
    }

    if (expr.callee.type === 'MemberExpression') {
        const obj = flattenMember(expr.callee.object);
        const prop = expr.callee.property.name;

        if (prop === 'addEventListener') {
            const outer = createElementNode('div', 'block events hasChildren');
            const topLine = createElementNode('div', 'line');

            topLine.appendChild(createElementNode('div', 'block transparent', 'addEventListener'));
            topLine.appendChild(createElementNode('div', 'block transparent', '='));
            topLine.appendChild(makeVariablesNode(obj));

            if (expr.arguments[0]) {
                topLine.appendChild(makeValueNode(expr.arguments[0]));
            }

            outer.appendChild(topLine);

            if (expr.arguments[1]) {
                let callbackBody = null;

                if (expr.arguments[1].type === 'ArrowFunctionExpression' || expr.arguments[1].type === 'FunctionExpression') {
                    callbackBody = expr.arguments[1].body;
                }

                if (callbackBody) {
                    const inner = createElementNode('div', 'inner');
                    const block = callbackBody.type === 'BlockStatement' ? statementToBlock(callbackBody) : expressionToBlock(callbackBody);

                    if (block) {
                        if (block.classList && block.classList.contains('inner')) {
                            for (const c of Array.from(block.children)) {
                                inner.appendChild(c);
                            }
                        } else {
                            inner.appendChild(block);
                        }
                    }

                    if (inner.children.length) {
                        outer.appendChild(inner);
                    }
                }
            }

            return outer;
        }

        if (obj === 'console' && prop === 'log') {
            const outer = createElementNode('div', 'block looks');
            const line = createElementNode('div', 'line');

            line.appendChild(makeCallChainNodeWithArgs(expr));
            outer.appendChild(line);

            return outer;
        }

        if (prop === 'map') {
            const outer = createElementNode('div', 'block functions hasChildren');
            const topLine = createElementNode('div', 'line');
            const chain = createElementNode('div', 'chain');

            chain.appendChild(makeVariablesNode(obj));
            chain.appendChild(createElementNode('div', 'block functionName subPart', '.' + prop));
            topLine.appendChild(chain);
            outer.appendChild(topLine);

            const inner = createElementNode('div', 'inner');

            if (expr.arguments[0]) {
                const argNode = makeArgBlock(expr.arguments[0]);

                if (argNode) {
                    inner.appendChild(argNode);
                }
            }

            if (inner.children.length) {
                outer.appendChild(inner);
            }

            return outer;
        }

        if (prop === 'remove') {
            const outer = createElementNode('div', 'block dom');
            const line = createElementNode('div', 'line');

            line.appendChild(makeCallChainNodeWithArgs(expr));
            outer.appendChild(line);

            return outer;
        }
    }

    return makeCallChainNodeWithArgs(expr);
}

/* ***
 * makeAssignmentBlock - создание блока присваивания
 * - принимает выражение присваивания
 * - возвращает DOM-блок
*** */
function makeAssignmentBlock(expr) {
    if (!expr || expr.type !== 'AssignmentExpression') {
        return null;
    }

    if (expr.right && (expr.right.type === 'ArrowFunctionExpression' || expr.right.type === 'FunctionExpression')) {
        const outer = createElementNode('div', 'block functions hasChildren');
        const line = createElementNode('div', 'line');

        if (expr.right.async) {
            line.appendChild(createElementNode('div', 'block modifier', 'async'));
        }

        line.appendChild(createElementNode('div', 'block transparent', 'function'));
        line.appendChild(createElementNode('div', 'block transparent', '='));

        const funcNameBlock = createElementNode('div', 'block functionName');
        const leftName = (expr.left.type === 'Identifier') ? expr.left.name : flattenMember(expr.left);

        funcNameBlock.appendChild(document.createTextNode(leftName));

        if (expr.right.params && expr.right.params.length > 0) {
            for (const p of expr.right.params) {
                funcNameBlock.appendChild(createElementNode('div', 'block variables', p));
            }
        }

        line.appendChild(funcNameBlock);
        outer.appendChild(line);

        if (expr.right.body) {
            const inner = createElementNode('div', 'inner');
            const bodyBlock = expr.right.body.type === 'BlockStatement' ? statementToBlock(expr.right.body) : expressionToBlock(expr.right.body);

            if (bodyBlock) {
                if (bodyBlock.classList && bodyBlock.classList.contains('inner')) {
                    for (const child of Array.from(bodyBlock.children)) {
                        inner.appendChild(child);
                    }
                } else {
                    inner.appendChild(bodyBlock);
                }

                if (inner.children.length) {
                    outer.appendChild(inner);
                }
            }
        }

        return outer;
    }

    let isHasChildren = false;

    if (expr.right && (expr.right.type === 'ObjectExpression' || expr.right.type === 'ArrayExpression')) {
        isHasChildren = true;
    } else if (expr.right && expr.right.type === 'CallExpression' && expr.right.callee.type === 'MemberExpression') {
        if (expr.right.callee.property.name === 'map') {
            isHasChildren = true;
        }
    }

    const outer = createElementNode('div', isHasChildren ? 'block assign hasChildren' : 'block assign');
    const line = createElementNode('div', 'line');

    if (expr.right && expr.right.type === 'ObjectExpression') {
        line.appendChild(createElementNode('div', 'block transparent', 'object'));
        line.appendChild(makeValueNode(expr.left));
        outer.appendChild(line);

        const objBlock = makeObjectBlock(expr.right);

        if (objBlock) {
            const inner = objBlock.querySelector('.inner');

            if (inner) {
                outer.appendChild(inner);
            }
        }

        return outer;
    }

    if (expr.right && expr.right.type === 'ArrayExpression') {
        line.appendChild(createElementNode('div', 'block transparent', 'array'));
        line.appendChild(makeValueNode(expr.left));
        outer.appendChild(line);

        const arrBlock = makeArrayBlock(expr.right);

        if (arrBlock) {
            const inner = arrBlock.querySelector('.inner');

            if (inner) {
                outer.appendChild(inner);
            }
        }

        return outer;
    }

    line.appendChild(makeValueNode(expr.left));
    line.appendChild(createElementNode('div', 'block transparent', expr.operator));

    if (expr.right && expr.right.type === 'CallExpression' && expr.right.callee.type === 'MemberExpression' && expr.right.callee.property.name === 'map') {
        outer.appendChild(line);

        const inner = createElementNode('div', 'inner');
        const callBlock = makeCallExpressionBlock(expr.right);

        if (callBlock) {
            inner.appendChild(callBlock);
        }

        outer.appendChild(inner);

        return outer;
    }

    line.appendChild(makeValueNode(expr.right) || makeValueNodeLiteral(''));
    outer.appendChild(line);

    return outer;
}

/* ***
 * makeObjProp - создание блока свойства объекта
 * - принимает свойство объекта
 * - возвращает DOM-блок
*** */
function makeObjProp(prop) {
    const assignB = createElementNode('div', 'block assign');
    const ln = createElementNode('div', 'line');

    ln.appendChild(makeVariablesNode(prop.key));
    ln.appendChild(createElementNode('div', 'block transparent', '='));
    ln.appendChild(makeValueNode(prop.value) || makeValueNodeLiteral(''));
    assignB.appendChild(ln);

    return assignB;
}

/* ***
 * makeArrayBlock - создание блока массива
 * - принимает узел массива
 * - возвращает DOM-блок массива
*** */
function makeArrayBlock(expr) {
    if (!expr || expr.type !== 'ArrayExpression') {
        return null;
    }

    const outer = createElementNode('div', 'block assign hasChildren');
    const top = createElementNode('div', 'line');

    top.appendChild(createElementNode('div', 'block transparent', 'array'));
    outer.appendChild(top);

    const inner = createElementNode('div', 'inner');

    for (const element of expr.elements) {
        const valueNode = makeValueNode(element) || makeValueNodeLiteral('');
        const line = createElementNode('div', 'line');

        line.appendChild(valueNode);
        inner.appendChild(line);
    }

    if (inner.children.length) {
        outer.appendChild(inner);
    }

    return outer;
}

/* ***
 * makeObjectBlock - создание блока объекта
 * - принимает узел объекта
 * - возвращает DOM-блок объекта
*** */
function makeObjectBlock(expr) {
    if (!expr || expr.type !== 'ObjectExpression') {
        return null;
    }

    const outer = createElementNode('div', 'block assign hasChildren');
    const top = createElementNode('div', 'line');

    top.appendChild(createElementNode('div', 'block transparent', 'object'));
    outer.appendChild(top);

    const inner = createElementNode('div', 'inner');

    for (const prop of expr.properties) {
        const propBlock = makeObjProp(prop);

        if (propBlock) {
            inner.appendChild(propBlock);
        }
    }

    if (inner.children.length) {
        outer.appendChild(inner);
    }

    return outer;
}

/* ***
 * makeArrowFunctionBlock - создание блока стрелочной функции
 * - принимает узел стрелочной функции
 * - возвращает DOM-блок
*** */
function makeArrowFunctionBlock(node) {
    if (!node) {
        return null;
    }

    const outer = createElementNode('div', 'block assign');
    const topLine = createElementNode('div', 'line');
    const params = node.params ? node.params.map(makeVariablesNode) : [];

    for (const p of params) {
        topLine.appendChild(p);
    }

    topLine.appendChild(createElementNode('div', 'block transparent', '=>'));

    if (node.body) {
        if (node.body.type === 'BlockStatement') {
            const inner = createElementNode('div', 'inner');
            const b = statementToBlock(node.body);

            if (b) {
                if (b.classList && b.classList.contains('inner')) {
                    for (const c of Array.from(b.children)) {
                        inner.appendChild(c);
                    }
                } else {
                    inner.appendChild(b);
                }
            }

            outer.classList.add('hasChildren');
            outer.appendChild(topLine);

            if (inner.children.length) {
                outer.appendChild(inner);
            }

            return outer;
        }

        if (node.body.type === 'BinaryExpression') {
            const left = makeValueNode(node.body.left) || createElementNode('div', 'block variables', '');
            let op = node.body.operator;

            if (op === '*') {
                op = '×';
            }

            const right = makeValueNode(node.body.right) || createElementNode('div', 'block value', '');

            topLine.appendChild(left);
            topLine.appendChild(createElementNode('div', 'block transparent', op));
            topLine.appendChild(right);
            outer.appendChild(topLine);
        } else {
            const bodyBlock = expressionToBlock(node.body);

            if (bodyBlock) {
                topLine.appendChild(bodyBlock);
            }

            outer.appendChild(topLine);
        }
    } else {
        outer.appendChild(topLine);
    }

    return outer;
}

/* ***
 * makeValueNode - создание узла значения по типу AST
 * - принимает узел AST
 * - возвращает DOM-блок значения
*** */
function makeValueNode(node) {
    if (!node) {
        return null;
    }

    if (node.type === 'Literal') {
        return makeValueNodeLiteral(node.value);
    }

    if (node.type === 'Identifier') {
        return makeVariablesNode(node.name);
    }

    if (node.type === 'MemberExpression') {
        const flat = flattenMember(node);
        const parts = flat.split('.');

        if (parts.length > 2) {
            const chain = createElementNode('div', 'chain');

            chain.appendChild(createElementNode('div', 'block variables', parts.slice(0, -1).join('.')));
            chain.appendChild(createElementNode('div', 'block subPart', '.' + parts[parts.length - 1]));

            return chain;
        }

        return makeVariablesNode(flat);
    }

    if (node.type === 'CallExpression') {
        return makeCallExpressionBlock(node);
    }

    if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
        return makeArrowFunctionBlock(node);
    }

    if (node.type === 'AwaitExpression') {
        return makeAwaitBlock(node);
    }

    if (node.type === 'ArrayExpression') {
        return makeArrayBlock(node);
    }

    if (node.type === 'ObjectExpression') {
        return makeObjectBlock(node);
    }

    if (node.type === 'BinaryExpression') {
        if (['<', '>', '<=', '>=', '==', '!=', '===', '!=='].includes(node.operator)) {
            return makeConditionBlock(node);
        }

        return makeBinaryActionBlock(node);
    }

    if (node.type === 'LogicalExpression') {
        return makeLogicalExpressionBlock(node);
    }

    if (node.type === 'UpdateExpression') {
        return makeUpdateBlock(node);
    }

    if (node.type === 'AssignmentExpression') {
        return makeAssignmentBlock(node);
    }

    if (node.type === 'UnaryExpression') {
        return makeUnaryBlock(node);
    }

    return null;
}

/* ***
 * makeArgBlock - создание блока аргумента функции
 * - принимает узел аргумента
 * - возвращает DOM-блок
*** */
function makeArgBlock(a) {
    if (!a) {
        return null;
    }

    if (a.type === 'Literal') {
        return makeValueNodeLiteral(a.value);
    }

    if (a.type === 'Identifier') {
        return makeVariablesNode(a.name);
    }

    if (a.type === 'MemberExpression') {
        const flat = flattenMember(a);
        const parts = flat.split('.');

        if (parts.length > 2) {
            const chain = createElementNode('div', 'chain');

            chain.appendChild(createElementNode('div', 'block variables', parts.slice(0, -1).join('.')));
            chain.appendChild(createElementNode('div', 'block subPart', '.' + parts[parts.length - 1]));

            return chain;
        }

        return makeVariablesNode(flat);
    }

    if (a.type === 'CallExpression') {
        return makeCallExpressionBlock(a);
    }

    if (a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression') {
        return makeArrowFunctionBlock(a);
    }

    if (a.type === 'AwaitExpression') {
        return makeAwaitBlock(a);
    }

    if (a.type === 'BinaryExpression') {
        return makeBinaryActionBlock(a);
    }

    if (a.type === 'LogicalExpression') {
        return makeLogicalExpressionBlock(a);
    }

    if (a.type === 'ArrayExpression') {
        return makeArrayBlock(a);
    }

    if (a.type === 'ObjectExpression') {
        return makeObjectBlock(a);
    }

    if (a.type === 'UpdateExpression') {
        return makeUpdateBlock(a);
    }

    if (a.type === 'AssignmentExpression') {
        return makeAssignmentBlock(a);
    }

    if (a.type === 'UnaryExpression') {
        return makeUnaryBlock(a);
    }

    return makeValueNode(a) || makeValueNodeLiteral('');
}

/* ***
 * statementToBlock - преобразование инструкции AST в DOM-блок
 * - принимает узел инструкции
 * - возвращает DOM-блок
*** */
function statementToBlock(node) {
    if (!node) {
        return null;
    }

    switch (node.type) {
        case 'Comment': {
            return createElementNode('div', 'block comments', node.value);
        }

        case 'ExpressionStatement': {
            return expressionToBlock(node.expression);
        }

        case 'VariableDeclaration': {
            return variableDeclarationToBlock(node);
        }

        case 'FunctionDeclaration': {
            return functionDeclarationToBlock(node);
        }

        case 'IfStatement': {
            return ifStatementToBlock(node);
        }

        case 'ForStatement': {
            return forStatementToBlock(node);
        }

        case 'WhileStatement': {
            return whileStatementToBlock(node);
        }

        case 'ReturnStatement': {
            return returnToBlock(node);
        }

        case 'BlockStatement': {
            const inner = createElementNode('div', 'inner');

            for (const s of node.body) {
                const b = statementToBlock(s);

                if (b) {
                    inner.appendChild(b);
                }
            }

            return inner.children.length ? inner : null;
        }

        default: {
            break;
        }
    }

    return null;
}

/* ***
 * expressionToBlock - преобразование выражения AST в DOM-блок
 * - принимает узел выражения
 * - возвращает DOM-блок
*** */
function expressionToBlock(expr) {
    if (!expr) {
        return null;
    }

    let block = null;

    if (expr.type === 'AwaitExpression') {
        block = makeAwaitBlock(expr);
    } else if (expr.type === 'CallExpression') {
        block = makeCallExpressionBlock(expr);
    } else if (expr.type === 'AssignmentExpression') {
        block = makeAssignmentBlock(expr);
    } else if (expr.type === 'LogicalExpression') {
        block = makeLogicalExpressionBlock(expr);
    } else if (expr.type === 'BinaryExpression') {
        block = makeValueNode(expr);
    } else if (expr.type === 'UpdateExpression') {
        block = makeUpdateBlock(expr);
    } else if (expr.type === 'UnaryExpression') {
        block = makeUnaryBlock(expr);
    } else if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') {
        block = makeArrowFunctionBlock(expr);
    } else {
        block = makeValueNode(expr);
    }

    if (block) {
        if (block.nodeType === Node.DOCUMENT_FRAGMENT || (block.classList && block.classList.contains('chain'))) {
            const outer = createElementNode('div', 'block assign');
            const line = createElementNode('div', 'line');

            line.appendChild(block);
            outer.appendChild(line);

            return outer;
        }
    }

    return block;
}

/* ***
 * variableDeclarationToBlock - преобразование объявления переменной в блок
 * - принимает узел VariableDeclaration
 * - возвращает DOM-блок
*** */
function variableDeclarationToBlock(node) {
    const parts = [];

    for (const d of node.declarations) {
        if (d.init) {
            const pseudoExpr = {
                type: 'AssignmentExpression',
                operator: '=',
                left: {
                    type: 'Identifier',
                    name: d.id
                },
                right: d.init
            };
            const assignBlock = makeAssignmentBlock(pseudoExpr);

            if (assignBlock) {
                parts.push(assignBlock);
            }
        } else {
            const outer = createElementNode('div', 'block assign');
            const line = createElementNode('div', 'line');

            line.appendChild(createElementNode('div', 'block variables', d.id));
            outer.appendChild(line);
            parts.push(outer);
        }
    }

    if (parts.length === 1) {
        return parts[0];
    }

    const container = createElementNode('div', 'inner');

    for (const p of parts) {
        container.appendChild(p);
    }

    return container;
}

/* ***
 * functionDeclarationToBlock - преобразование объявления функции в блок
 * - принимает узел FunctionDeclaration
 * - возвращает DOM-блок
*** */
function functionDeclarationToBlock(node) {
    const outer = createElementNode('div', 'block functions hasChildren');
    const line = createElementNode('div', 'line');

    if (node.async) {
        line.appendChild(createElementNode('div', 'block modifier', 'async'));
    }

    line.appendChild(createElementNode('div', 'block transparent', 'function'));
    line.appendChild(createElementNode('div', 'block transparent', '='));

    const funcNameBlock = createElementNode('div', 'block functionName');

    funcNameBlock.appendChild(document.createTextNode(node.id || ''));

    if (node.params && node.params.length > 0) {
        for (const p of node.params) {
            funcNameBlock.appendChild(createElementNode('div', 'block variables', p));
        }
    }

    line.appendChild(funcNameBlock);
    outer.appendChild(line);

    if (node.body) {
        const inner = createElementNode('div', 'inner');
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

/* ***
 * ifStatementToBlock - преобразование условного оператора if в блок
 * - принимает узел IfStatement
 * - возвращает DOM-блок
*** */
function ifStatementToBlock(node) {
    const outer = createElementNode('div', 'block control hasChildren');
    const line = createElementNode('div', 'line');

    line.appendChild(createElementNode('div', 'block control', 'if'));
    line.appendChild(getConditionNode(node.test));
    outer.appendChild(line);

    if (node.consequent) {
        const inner = createElementNode('div', 'inner');
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

/* ***
 * forStatementToBlock - преобразование цикла for в блок
 * - принимает узел ForStatement
 * - возвращает DOM-блок
*** */
function forStatementToBlock(node) {
    const outer = createElementNode('div', 'block control hasChildren');
    const line = createElementNode('div', 'line');

    line.appendChild(createElementNode('div', 'block control', 'for'));

    if (node.init) {
        const initBlock = makeValueNode(node.init) || (node.init.type === 'VariableDeclaration' ? variableDeclarationToBlock(node.init) : null);

        if (initBlock) {
            line.appendChild(initBlock);
        }
    }

    if (node.test) {
        line.appendChild(getConditionNode(node.test));
    }

    if (node.update) {
        const updateBlock = makeValueNode(node.update);

        if (updateBlock) {
            line.appendChild(updateBlock);
        }
    }

    outer.appendChild(line);

    if (node.body) {
        const inner = createElementNode('div', 'inner');
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

/* ***
 * whileStatementToBlock - преобразование цикла while в блок
 * - принимает узел WhileStatement
 * - возвращает DOM-блок
*** */
function whileStatementToBlock(node) {
    const outer = createElementNode('div', 'block control hasChildren');
    const topLine = createElementNode('div', 'line');

    topLine.appendChild(createElementNode('div', 'block control', 'while'));
    topLine.appendChild(getConditionNode(node.test));
    outer.appendChild(topLine);

    const inner = createElementNode('div', 'inner');
    const body = statementToBlock(node.body);

    if (body) {
        if (body.classList && body.classList.contains('inner')) {
            for (const child of Array.from(body.children)) {
                inner.appendChild(child);
            }
        } else {
            inner.appendChild(body);
        }
    }

    if (inner.children.length) {
        outer.appendChild(inner);
    }

    return outer;
}

/* ***
 * returnToBlock - преобразование возврата значения в блок
 * - принимает узел ReturnStatement
 * - возвращает DOM-блок
*** */
function returnToBlock(node) {
    const outer = createElementNode('div', 'block dom');
    const line = createElementNode('div', 'line');

    line.appendChild(createElementNode('div', 'block transparent', 'return'));

    if (node.argument) {
        line.appendChild(makeValueNode(node.argument));
    }

    outer.appendChild(line);

    return outer;
}

/* ***
 * astToBlocks - конвертация AST в документ с блоками
 * - принимает объект AST
 * - возвращает фрагмент DOM документа
*** */
function astToBlocks(ast) {
    const frag = document.createDocumentFragment();

    for (const s of ast.body) {
        const b = statementToBlock(s);

        if (b) {
            frag.appendChild(b);
        }
    }

    return frag;
}



/* === Главные функции управления редактором === */

/* ***
 * parseToBlocks - преобразование исходного кода в блоки редактора
 * - принимает строку исходного кода
 * - строит синтаксическое дерево и добавляет блоки в редактор
 * - возвращает фрагмент блоков
*** */
function parseToBlocks(code) {
    lastSource = code || '';

    const tokens = tokenize(code);
    const parser = createParser(tokens);
    const ast = parser.parseProgram();
    const blocksFragment = astToBlocks(ast);

    if (typeof jsEditorContent !== 'undefined' && jsEditorContent) {
        while (blocksFragment.firstChild) {
            jsEditorContent.appendChild(blocksFragment.firstChild);
        }
    }

    return blocksFragment;
}

/* ***
 * parseToText - сборка исходного JS кода из DOM-структуры блоков
 * - принимает контейнер редактора
 * - возвращает собранную строку кода
*** */
function parseToText(container) {
    if (lastSource) {
        return lastSource;
    }

    const root = (container && container === jsEditorContent) ? jsEditorContent : container;

    if (!root) {
        return '';
    }

    const lines = [];

    for (const child of root.children) {
        if (child.classList.contains('block')) {
            const lineNode = child.querySelector('.line');

            if (lineNode) {
                lines.push(lineNode.textContent.trim());
            }

            const inner = child.querySelector('.inner');

            if (inner) {
                const innerText = parseToText(inner);

                if (innerText) {
                    lines.push(...innerText.split('\n'));
                }
            }
        } else if (child.classList.contains('line')) {
            if (child.textContent.trim()) {
                lines.push(child.textContent.trim());
            }
        }
    }

    return lines.join('\n') + (lines.length ? '\n' : '');
}



/* === Перетаскивание элементов (Drag & Drop) === */

// Перетаскиваемый элемент редактора
let draggedElement = null;

/* ***
 * handleDragStart - обработка начала перетаскивания блока
 * - принимает объект события
 * - сохраняет перетаскиваемый элемент
*** */
function handleDragStart(event) {
    const b = event.target.closest('.block');

    if (!b) {
        return;
    }

    draggedElement = b;
    event.dataTransfer.effectAllowed = 'move';
}

/* ***
 * handleDragOver - обработка наведения при перетаскивании
 * - принимает объект события
 * - разрешает перемещение и обновляет позицию блока
*** */
function handleDragOver(event) {
    event.preventDefault();

    const target = event.target.closest('.block, .inner, #jsEditorContent');

    if (!draggedElement || !target) {
        return;
    }

    if (target.classList && target.classList.contains('inner')) {
        target.appendChild(draggedElement);

        return;
    }

    const parent = target.parentNode;

    if (parent) {
        parent.insertBefore(draggedElement, target.nextSibling);
    }
}

/* ***
 * handleDrop - обработка сброса элемента
 * - принимает объект события
*** */
function handleDrop(event) {
    event.preventDefault();
}

/* ***
 * handleDragEnd - обработка окончания перетаскивания
 * - сбрасывает сохраненный элемент
*** */
function handleDragEnd() {
    draggedElement = null;
}



/* === Управление режимами редактора === */

/* ***
 * setEditMode - установка режима работы редактора
 * - принимает булево значение режима мастера блоков
*** */
function setEditMode(isWizardMode) {
    if (!jsEditorContent || !codeWizardToggle) {
        return;
    }

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

/* ***
 * toggleCodeWizardMode - переключение визуального режима редактора
*** */
function toggleCodeWizardMode() {
    if (!jsEditorContent) {
        return;
    }

    setEditMode(!jsEditorContent.classList.contains('wizard'));
}



/* === Инициализация редактора === */

if (codeWizardToggle && jsEditorContent) {
    codeWizardToggle.addEventListener('click', toggleCodeWizardMode);
    jsEditorContent.addEventListener('dragstart', handleDragStart);
    jsEditorContent.addEventListener('dragover', handleDragOver);
    jsEditorContent.addEventListener('drop', handleDrop);
    jsEditorContent.addEventListener('dragend', handleDragEnd);

    setEditMode(false);
}