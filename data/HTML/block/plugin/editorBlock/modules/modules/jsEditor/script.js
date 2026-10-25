/* === Элементы DOM редактора кода === */

// Переключатель визуального режима
const codeWizardToggle = document.getElementById('codeWizardToggle');

// Содержимое редактора кода
const jsEditorContent = document.getElementById('jsEditorContent');

// Последний исходный код
let lastSource = '';

// Перменнная перевода ключевых слов, объектов, методов, событий, операторов и литералов
const TRANSLATIONS = {
    keywords: {
        'function': window.translate('Function'),
        'async': window.translate('Async'),
        'return': window.translate('Return'),
        'if': window.translate('If'),
        'else': window.translate('Else'),
        'for': window.translate('For'),
        'while': window.translate('While'),
        'do': window.translate('Do'),
        'switch': window.translate('Switch'),
        'case': window.translate('Case'),
        'default': window.translate('Default'),
        'break': window.translate('Break'),
        'continue': window.translate('Continue'),
        'await': window.translate('Await'),
        'addEventListener': window.translate('On'),
        'typeof': window.translate('Type'),
        'object': window.translate('Object'),
        'array': window.translate('Array'),
        'const': window.translate('Constant'),
        'let': window.translate('Let'),
        'var': window.translate('Variable'),
        'new': window.translate('Create'),
        'delete': window.translate('Delete'),
        'throw': window.translate('Throw'),
        'try': window.translate('Try'),
        'catch': window.translate('On error'),
        'finally': window.translate('Finally'),
        'class': window.translate('Class'),
        'extends': window.translate('Extends'),
        'implements': window.translate('Implements'),
        'import': window.translate('Import'),
        'export': window.translate('Export'),
        'from': window.translate('From'),
        'default': window.translate('Default'),
        'yield': window.translate('Yield'),
        'void': window.translate('No value'),
        'instanceof': window.translate('Instance'),
        'in': window.translate('In'),
        'of': window.translate('Of')
    },
    objects: {
        'console': window.translate('Console'),
        'document': window.translate('Document'),
        'window': window.translate('Window'),
        'Math': window.translate('Math'),
        'JSON': 'json',
        'Array': window.translate('Array'),
        'Object': window.translate('Object'),
        'String': window.translate('String'),
        'Number': window.translate('Number'),
        'Boolean': window.translate('Boolean'),
        'Date': window.translate('Date'),
        'Set': window.translate('Set'),
        'Map': window.translate('Map'),
        'RegExp': window.translate('RegExp')
    },
    methods: {
        'log': window.translate('Log'),
        'map': window.translate('Map'),
        'push': window.translate('Push'),
        'length': window.translate('Length'),
        'replace': window.translate('Replace'),
        'createElement': window.translate('Create element'),
        'add': window.translate('Add'),
        'append': window.translate('Append child'),
        'remove': window.translate('Remove'),
        'forEach': window.translate('For each'),
        'filter': window.translate('Filter'),
        'sort': window.translate('Sort'),
        'reduce': window.translate('Reduce'),
        'pop': window.translate('Remove last'),
        'shift': window.translate('Remove first'),
        'unshift': window.translate('Add first'),
        'slice': window.translate('Slice'),
        'concat': window.translate('Concatenate'),
        'join': window.translate('Join'),
        'split': window.translate('Split'),
        'includes': window.translate('Includes'),
        'indexOf': window.translate('Index'),
        'find': window.translate('Find'),
        'findIndex': window.translate('Find index'),
        'includes': window.translate('Includes'),
        'toString': window.translate('To string'),
        'toUpperCase': window.translate('To uppercase'),
        'toLowerCase': window.translate('To lowercase'),
        'trim': window.translate('Trim'),
        'parseInt': window.translate('Parse integer'),
        'parseFloat': window.translate('Parse float'),
        'preventDefault': window.translate('Prevent default'),
        'value': window.translate('Value'),
        'reset': window.translate('Reset'),
        'target': window.translate('Target'),
        'closest': window.translate('Closest'),
        'classList': window.translate('Class list'),
        'textContent': window.translate('Text content'),
        'fetch': window.translate('Fetch'),
        'then': window.translate('Then'),
        'resolve': window.translate('Resolve'),
        'event': window.translate('Event'),
        'setTimeout': window.translate('Timer'),
        'setInterval': window.translate('Interval'),
        'clearTimeout': window.translate('Stop timer'),
        'clearInterval': window.translate('Stop interval'),
        'alert': window.translate('Alert'),
        'confirm': window.translate('Confirm'),
        'prompt': window.translate('Prompt'),
        'querySelector': window.translate('Select'),
        'querySelectorAll': window.translate('Select all')
    },
    events: {
        'click': window.translate('Click'),
        'mouseover': window.translate('Mouse over'),
        'input': window.translate('Input'),
        'submit': window.translate('Submit'),
        'change': window.translate('Change'),
        'keyup': window.translate('Key up'),
        'keydown': window.translate('Key down'),
        'focus': window.translate('Focus'),
        'blur': window.translate('Blur'),
        'dblclick': window.translate('Double-click'),
        'mouseenter': window.translate('Mouse enter'),
        'mouseleave': window.translate('Mouse leave'),
        'resize': window.translate('Resize')
    },
    operators: {
        '&&': window.translate('And'),
        '||': window.translate('Or'),
        '++': window.translate('Increment by 1'),
        '--': window.translate('Decrement by 1'),
        '*': '×',
        '+': '+',
        '-': '-',
        '/': '/',
        '%': '%',
        '**': window.translate('Raise to power'),
        '!': window.translate('Not'),
        '~': window.translate('Bitwise not'),
        '=': '=',
        '+=': window.translate('Plus equals'),
        '-=': window.translate('Minus equals'),
        '*=': window.translate('Multiply equals'),
        '/=': window.translate('Divide equals'),
        '%=': window.translate('Remainder equals'),
        '**=': window.translate('Power equals'),
        '==': window.translate('Equals'),
        '===': window.translate('Strictly equals'),
        '!=': window.translate('Not equal'),
        '!==': window.translate('Strictly not equal'),
        '>=': '>=',
        '<=': '<=',
        '>': '>',
        '<': '<',
        '>>': window.translate('Shift right'),
        '<<': window.translate('Shift left'),
        '>>>': window.translate('Unsigned shift right'),
        '&': window.translate('Bitwise and'),
        '|': window.translate('Bitwise or'),
        '^': window.translate('Exclusive or'),
        '??': window.translate('If nullish'),
        '?.': window.translate('Optional chain'),
        '=>': window.translate('Arrow')
    },
    literals: {
        'true': window.translate('True'),
        'false': window.translate('False'),
        'null': window.translate('Null'),
        'undefined': window.translate('Undefined'),
        'NaN': window.translate('Not a number'),
        'Infinity': window.translate('Infinity'),
        '-Infinity': window.translate('Negative infinity')
    }
};



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

        if (t.value === 'do') {
            return parseDoWhileStatement(ctx);
        }

        if (t.value === 'switch') {
            return parseSwitchStatement(ctx);
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
* parseDoWhileStatement - разбор цикла do/while
* принимает контекст (ctx)
* разбирает клавиатурное слово do, тело и условие
* возвращает узел DoWhileStatement
*** */
function parseDoWhileStatement(ctx) {
   next(ctx);

   const body = (peek(ctx).type === 'Punct' && peek(ctx).value === '{') ? parseBlockStatement(ctx) : parseStatement(ctx);

   expect(ctx, 'Keyword', 'while');
   expect(ctx, 'Punct', '(');
   const test = parseExpression(ctx);
   expect(ctx, 'Punct', ')');

   if (peek(ctx).type === 'Punct' && peek(ctx).value === ';') {
       next(ctx);
   }

   return {
       type: 'DoWhileStatement',
       body,
       test
   };
}

/* ***
* parseSwitchStatement - разбор switch/case
* принимает контекст (ctx)
* разбирает выражение после switch и тело case/default
* возвращает узел SwitchStatement
*** */
function parseSwitchStatement(ctx) {
   next(ctx);
   expect(ctx, 'Punct', '(');
   const discriminant = parseExpression(ctx);
   expect(ctx, 'Punct', ')');
   expect(ctx, 'Punct', '{');

   const cases = [];

   while (!(peek(ctx).type === 'Punct' && peek(ctx).value === '}')) {
       if (peek(ctx).type === 'Keyword' && peek(ctx).value === 'case') {
           next(ctx);
           const test = parseExpression(ctx);
           expect(ctx, 'Punct', ':');

           const consequent = [];

           while (!(peek(ctx).type === 'Punct' && peek(ctx).value === '}' ||
               (peek(ctx).type === 'Keyword' && (peek(ctx).value === 'case' || peek(ctx).value === 'default')))) {
               consequent.push(parseStatement(ctx));
           }

           cases.push({
               type: 'SwitchCase',
               test,
               consequent
           });
       } else if (peek(ctx).type === 'Keyword' && peek(ctx).value === 'default') {
           next(ctx);
           expect(ctx, 'Punct', ':');

           const consequent = [];

           while (!(peek(ctx).type === 'Punct' && peek(ctx).value === '}') &&
               !(peek(ctx).type === 'Keyword' && (peek(ctx).value === 'case' || peek(ctx).value === 'default'))) {
               consequent.push(parseStatement(ctx));
           }

           cases.push({
               type: 'SwitchCase',
               test: null,
               consequent
           });
       } else {
           throw new Error('Parse error');
       }
   }

   expect(ctx, 'Punct', '}');

   return {
       type: 'SwitchStatement',
       discriminant,
       cases
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
* parseVariableBinding - разбор имени/шаблона в объявлении переменной
* принимает контекст (ctx)
* допускает обычный идентификатор и простой объектный шаблон
* возвращает строку или узел ObjectPattern
*** */
function parseVariableBinding(ctx) {
   if (peek(ctx).type === 'Punct' && peek(ctx).value === '{') {
       return parseObjectPattern(ctx);
   }

   return expect(ctx, 'Identifier').value;
}

/* ***
* parseObjectPattern - разбор объектного шаблона для деструктуризации
* принимает контекст (ctx)
* ожидает открывающую и закрывающую фигурные скобки
* возвращает узел ObjectPattern
*** */
function parseObjectPattern(ctx) {
   expect(ctx, 'Punct', '{');

   const properties = [];

   while (!(peek(ctx).type === 'Punct' && peek(ctx).value === '}')) {
       const keyToken = peek(ctx);
       let key = null;

       if (keyToken.type === 'Identifier') {
           key = next(ctx).value;
       } else if (keyToken.type === 'String') {
           key = next(ctx).value;
       } else {
           throw new Error('Parse error');
       }

       if (peek(ctx).type === 'Punct' && peek(ctx).value === ':') {
           next(ctx);
           const value = parseVariableBinding(ctx);

           properties.push({
               key,
               value
           });
       } else {
           properties.push({
               key,
               value: {
                   type: 'Identifier',
                   name: key
               }
           });
       }

       if (peek(ctx).type === 'Punct' && peek(ctx).value === ',') {
           next(ctx);
       } else {
           break;
       }
   }

   expect(ctx, 'Punct', '}');

   return {
       type: 'ObjectPattern',
       properties
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
       const id = parseVariableBinding(ctx);
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
       const param = {
           type: 'Identifier',
           name: next(ctx).value
       };

       params.push(param);
   } else if (peek(ctx).type === 'Punct' && peek(ctx).value === '(') {
       next(ctx);

       while (!(peek(ctx).type === 'Punct' && peek(ctx).value === ')')) {
           if (peek(ctx).type === 'Identifier') {
               const param = {
                   type: 'Identifier',
                   name: next(ctx).value
               };

               if (peek(ctx).type === 'Punct' && peek(ctx).value === '=') {
                   next(ctx);
                   param.defaultValue = parseAssignment(ctx);
               }

               params.push(param);
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

    if (peek(ctx).type === 'Punct' && peek(ctx).value === '?') {
        next(ctx);

        const consequent = parseAssignment(ctx);

        expect(ctx, 'Punct', ':');

        const alternate = parseAssignment(ctx);

        return {
            type: 'ConditionalExpression',
            test: left,
            consequent,
            alternate
        };
    }

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

    if (t.type === 'Keyword' && t.value === 'new') {
        next(ctx);

        const callee = parsePrimary(ctx);

        const args = [];

        if (peek(ctx).type === 'Punct' && peek(ctx).value === '(') {
            next(ctx);

            while (!(peek(ctx).type === 'Punct' && peek(ctx).value === ')')) {
                args.push(parseExpression(ctx));

                if (peek(ctx).type === 'Punct' && peek(ctx).value === ',') {
                    next(ctx);
                } else {
                    break;
                }
            }

            expect(ctx, 'Punct', ')');
        }

        return {
            type: 'NewExpression',
            callee,
            arguments: args
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

                if (peek(ctx).type === 'Punct' && peek(ctx).value === '(') {
                    next(ctx);

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

                    const body = parseBlockStatement(ctx);

                    properties.push({
                        key,
                        value: {
                            type: 'FunctionExpression',
                            id: null,
                            params,
                            body
                        }
                    });
                } else if (peek(ctx).type === 'Punct' && peek(ctx).value === ':') {
                    next(ctx);
                    const val = parseExpression(ctx);

                    properties.push({
                        key,
                        value: val
                    });
                } else {
                    // Короткий синтаксис объекта: { name, age, active: true }
                    // в этом случае значение свойства берётся из того же имени
                    properties.push({
                        key,
                        value: {
                            type: 'Identifier',
                            name: key
                        }
                    });
                }
            } else if (keyTok.type === 'String') {
                key = next(ctx).value;

                if (peek(ctx).type === 'Punct' && peek(ctx).value === ':') {
                    next(ctx);
                    const val = parseExpression(ctx);

                    properties.push({
                        key,
                        value: val
                    });
                } else {
                    properties.push({
                        key,
                        value: {
                            type: 'Identifier',
                            name: key
                        }
                    });
                }
            }

            if (peek(ctx).type === 'Punct' && peek(ctx).value === ',') {
                next(ctx);
            } else {
                break;
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
        let outText = text;

        if (typeof outText === 'string') {
            // Автоматические переводы для меток интерфейса в специальных классах
            if (cls && (cls.indexOf('transparent') !== -1 || cls.indexOf('operators') !== -1 || cls.indexOf('control') !== -1)) {
                // Прозрачные блоки часто содержат ключевые слова (return, await, object ...)
                outText = trKeyword(outText) || trMethod(outText) || trObject(outText) || trOperator(outText) || outText;
            } else if (cls && cls.indexOf('modifier') !== -1) {
                outText = trKeyword(outText) || trMethod(outText) || outText;
            } else if (cls && cls.indexOf('functionName') !== -1 && outText.startsWith('.')) {
                // Части типа ".log(...)" - переводим имя метода после точки
                const rest = outText.slice(1);
                const name = rest.split(/\(|\s/)[0];
                const translated = trMethod(name);
                outText = '.' + (translated || name) + outText.slice(1 + name.length);
            } else if (cls && cls.indexOf('valueSpecial') !== -1) {
                outText = displayValue(outText);
            } else if (cls && cls.indexOf('value') !== -1) {
                outText = displayValue(outText);
            }
        }

        e.textContent = outText;
    }

    return e;
}

/* ***
 * trKeyword - перевод ключевых слов
 * - принимает ключевое слово
 * - возвращает переведённое значение или исходное слово
*** */
function trKeyword(k) {
   if (!k) return k;
   return TRANSLATIONS.keywords[k] || TRANSLATIONS.keywords[String(k).toLowerCase()] || k;
}

/* ***
 * trObject - перевод имён объектов
 * - принимает имя объекта
 * - возвращает переведённое значение или исходное имя
*** */
function trObject(name) {
   if (!name) return name;
   return TRANSLATIONS.objects[name] || name;
}

/* ***
 * trMethod - перевод имён методов
 * - принимает имя метода
 * - возвращает переведённое значение или исходное имя
*** */
function trMethod(name) {
   if (!name) return name;
   return TRANSLATIONS.methods[name] || name;
}

/* ***
 * trEvent - перевод имён событий
 * - принимает имя события
 * - возвращает переведённое значение или исходное имя
*** */
function trEvent(name) {
   if (!name) return name;
   return TRANSLATIONS.events[name] || name;
}

/* ***
 * trOperator - перевод операторов
 * - принимает оператор
 * - возвращает переведённое значение или исходное имя
*** */
function trOperator(op) {
   if (op === undefined || op === null) return op;
   return TRANSLATIONS.operators[op] || op;
}

/* ***
 * trLiteral - перевод литералов
 * - принимает литерал
 * - возвращает переведённое значение или исходное имя
*** */
function trLiteral(val) {
   if (val === undefined) {
       return window.translate('Undefined');
   }

   if (val === null) {
       return window.translate('Null');
   }

   const s = String(val);
   return TRANSLATIONS.literals[s] !== undefined ? TRANSLATIONS.literals[s] : val;
}

/* ***
 * displayValue - отображение значения с переводом
 * - принимает значение
 * - возвращает строковое представление с переводом
*** */
function displayValue(raw) {
   if (raw === undefined || raw === null) {
       return trLiteral(raw) || window.translate('None');
   }

   let s = String(raw);

   // Если строка в кавычках — убираем их
   if (/^['"`].*['"`]$/.test(s)) {
       s = s.slice(1, -1);
   }

   const lit = trLiteral(s);
   return lit !== s ? lit : s;
}

/* ***
 * getSpecialLiteralText - получение текста для специальных литералов
 * - принимает значение
 * - возвращает строковое представление для true, false, null, undefined
*** */
function getSpecialLiteralText(value) {
   if (value === true || value === 'true') {
       return window.translate('True');
   }

   if (value === false || value === 'false') {
       return window.translate('False');
   }

   if (value === null || value === 'null') {
       return window.translate('Null');
   }

   if (value === undefined || value === 'undefined') {
       return window.translate('Undefined');
   }

   if (value === 'document' || value === 'window') {
       return trObject(value);
   }

   if (typeof value === 'string') {
       const raw = value.trim();

       if (raw === 'id' || raw === 'class' || raw.startsWith('#') || raw.startsWith('.') || /^[a-zA-Z][\w-]*(\.[a-zA-Z][\w-]*)+$/.test(raw)) {
           return raw;
       }
   }

   return null;
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
    const specialText = getSpecialLiteralText(value);

    if (specialText !== null) {
        return createElementNode('div', 'block valueSpecial', specialText);
    }

    if (typeof value === 'string') {
        const raw = value.trim();

        if (raw === 'id' || raw === 'class' || raw.startsWith('#') || raw.startsWith('.') || /^[a-zA-Z][\w-]*(\.[a-zA-Z][\w-]*)+$/.test(raw)) {
            return createElementNode('div', 'block valueSpecial', raw);
        }
    }

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
* makeConditionalExpressionBlock - создание блока ternary expression
* - принимает узел ConditionalExpression
* - возвращает DOM-блок
*** */
function makeConditionalExpressionBlock(expr) {
   if (!expr || expr.type !== 'ConditionalExpression') {
       return null;
   }

   const outer = createElementNode('div', 'block control hasChildren');
   const topLine = createElementNode('div', 'line');

   topLine.appendChild(createElementNode('div', 'block control', trKeyword('if')));
   topLine.appendChild(getConditionNode(expr.test));
   outer.appendChild(topLine);

   const inner = createElementNode('div', 'inner');
   const trueBlock = expr.consequent ? (expr.consequent.type === 'BlockStatement' ? statementToBlock(expr.consequent) : expressionToBlock(expr.consequent)) : null;

   if (trueBlock) {
       if (trueBlock.classList && trueBlock.classList.contains('inner')) {
           for (const child of Array.from(trueBlock.children)) {
               inner.appendChild(child);
           }
       } else {
           inner.appendChild(trueBlock);
       }
   }

   if (expr.alternate) {
       const elseLine = createElementNode('div', 'line');
       elseLine.appendChild(createElementNode('div', 'block control', trKeyword('else')));
       const altBlock = expr.alternate.type === 'BlockStatement' ? statementToBlock(expr.alternate) : expressionToBlock(expr.alternate);

       if (altBlock) {
           if (altBlock.classList && altBlock.classList.contains('inner')) {
               for (const child of Array.from(altBlock.children)) {
                   inner.appendChild(child);
               }
           } else {
               inner.appendChild(altBlock);
           }
       }
   }

   if (inner.children.length) {
       outer.appendChild(inner);
   }

   return outer;
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

    line.appendChild(createElementNode('div', 'block transparent', trKeyword('await')));

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
* makeNewExpressionBlock - создание блока new expression
* - принимает узел NewExpression
 * - возвращает DOM-блок
*** */
function makeNewExpressionBlock(expr) {
   if (!expr || expr.type !== 'NewExpression') {
       return null;
   }

   const outer = createElementNode('div', 'block dom');
   const line = createElementNode('div', 'line');

   line.appendChild(createElementNode('div', 'block transparent', trKeyword('new')));

   if (expr.callee) {
       line.appendChild(makeValueNode(expr.callee) || makeValueNodeLiteral(''));
   }

   if (expr.arguments && expr.arguments.length) {
       const argsInner = createElementNode('div', 'inner');

       for (const arg of expr.arguments) {
           const argBlock = makeArgBlock(arg);

           if (argBlock) {
               const argLine = createElementNode('div', 'line');
               argLine.appendChild(argBlock);
               argsInner.appendChild(argLine);
           }
       }

       if (argsInner.children.length) {
           outer.appendChild(argsInner);
       }
   }

   outer.appendChild(line);

   return outer;
}

/* ***
* makeTemplateLiteralBlock - создание блока шаблонной строки
* - принимает узел TemplateLiteral
* - возвращает DOM-блок
*** */
function makeTemplateLiteralBlock(expr) {
   if (!expr || expr.type !== 'TemplateLiteral') {
       return null;
   }

   const outer = createElementNode('div', 'block assign');
   const line = createElementNode('div', 'line');

   line.appendChild(createElementNode('div', 'block value', 'template'));

   if (expr.expressions && expr.expressions.length) {
       const inner = createElementNode('div', 'inner');

       for (const e of expr.expressions) {
           const eBlock = expressionToBlock(e);

           if (eBlock) {
               const eLine = createElementNode('div', 'line');
               eLine.appendChild(eBlock);
               inner.appendChild(eLine);
           }
       }

       if (inner.children.length) {
           outer.appendChild(line);
           outer.appendChild(inner);
       }
   }

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

    // Для оператора typeof используем перевод "тип"
    line.appendChild(createElementNode('div', 'block transparent', expr.operator === 'typeof' ? trKeyword('typeof') : expr.operator));
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
        // Показываем имя функции с круглыми скобками: name(...)
        fnName.appendChild(document.createTextNode(expr.callee.name + '('));

        for (const a of expr.arguments) {
            const argNode = makeArgBlock(a);

            if (argNode) {
                fnName.appendChild(argNode);
            }
        }

        fnName.appendChild(document.createTextNode(')'));

        return fnName;
    }

    const chain = createElementNode('div', 'chain');
    const objName = flattenMember(expr.callee.object);

    if (objName === 'console' || objName === 'document') {
        chain.appendChild(createElementNode('div', 'block transparent', trObject(objName)));
    } else {
        chain.appendChild(createElementNode('div', 'block variables', objName));
    }

    const fnName = createElementNode('div', 'block functionName subPart');

    // Методная часть: .имя(...)
    fnName.appendChild(document.createTextNode('.' + trMethod(expr.callee.property.name) + '('));

    for (const a of expr.arguments) {
        const argNode = makeArgBlock(a);

        if (argNode) {
            fnName.appendChild(argNode);
        }
    }

    fnName.appendChild(document.createTextNode(')'));

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

        if (prop === 'then') {
            const outer = createElementNode('div', 'block functions hasChildren');
            const topLine = createElementNode('div', 'line');
            const chain = makeCallChainNodeWithArgs(expr);

            topLine.appendChild(chain);
            outer.appendChild(topLine);

            if (expr.arguments[0]) {
                const inner = createElementNode('div', 'inner');
                const callback = expr.arguments[0];
                const callbackBlock = callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression'
                    ? (callback.body.type === 'BlockStatement' ? statementToBlock(callback.body) : expressionToBlock(callback.body))
                    : makeArgBlock(callback);

                if (callbackBlock) {
                    if (callbackBlock.classList && callbackBlock.classList.contains('inner')) {
                        for (const c of Array.from(callbackBlock.children)) {
                            inner.appendChild(c);
                        }
                    } else {
                        inner.appendChild(callbackBlock);
                    }
                }

                if (inner.children.length) {
                    outer.appendChild(inner);
                }
            }

            return outer;
        }

        if (prop === 'setTimeout' || prop === 'setInterval') {
            const outer = createElementNode('div', 'block functions hasChildren');
            const topLine = createElementNode('div', 'line');

            topLine.appendChild(makeCallChainNodeWithArgs(expr));
            outer.appendChild(topLine);

            if (expr.arguments[0]) {
                const inner = createElementNode('div', 'inner');
                const callback = expr.arguments[0];
                const callbackBody = callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression' ? callback.body : null;

                if (callbackBody) {
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
                }

                if (inner.children.length) {
                    outer.appendChild(inner);
                }
            }

            return outer;
        }

        if (prop === 'fetch') {
            const outer = createElementNode('div', 'block functions hasChildren');
            const topLine = createElementNode('div', 'line');

            topLine.appendChild(makeCallChainNodeWithArgs(expr));
            outer.appendChild(topLine);
            return outer;
        }

        if (prop === 'addEventListener') {
            const outer = createElementNode('div', 'block events hasChildren');
            const topLine = createElementNode('div', 'line');

            topLine.appendChild(createElementNode('div', 'block transparent', trKeyword('addEventListener')));

            // Сначала показываем событие (например "клике"), затем "на" и объект (button)
            if (expr.arguments[0]) {
                if (expr.arguments[0].type === 'Literal') {
                    const evRaw = displayValue(expr.arguments[0].value);
                    const evLabel = trEvent(evRaw) || evRaw;
                    topLine.appendChild(createElementNode('div', 'block value', evLabel));
                } else {
                    topLine.appendChild(makeValueNode(expr.arguments[0]));
                }
            }

            topLine.appendChild(createElementNode('div', 'block transparent', window.translate('On')));
            topLine.appendChild(makeVariablesNode(obj));

            outer.appendChild(topLine);

            if (expr.arguments[1]) {
                const inner = createElementNode('div', 'inner');

                if (expr.arguments[1].type === 'Identifier') {
                    inner.appendChild(makeVariablesNode(expr.arguments[1].name));
                } else {
                    let callbackBody = null;

                    if (expr.arguments[1].type === 'ArrowFunctionExpression' || expr.arguments[1].type === 'FunctionExpression') {
                        callbackBody = expr.arguments[1].body;
                    }

                    if (callbackBody) {
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
                    }
                }

                if (inner.children.length) {
                    outer.appendChild(inner);
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

        // Метка функции — объединяем async + function в одну прозрачную метку, убираем лишний '='
        const funcLabel = expr.right.async ? trKeyword('async') + ' ' + trKeyword('function') : trKeyword('function');
        line.appendChild(createElementNode('div', 'block transparent', funcLabel));

        const funcNameBlock = createElementNode('div', 'block functionName');
        const leftName = (expr.left.type === 'Identifier') ? expr.left.name : flattenMember(expr.left);

        // Показываем имя функции с параметрами в скобках: name(...)
        funcNameBlock.appendChild(document.createTextNode(leftName + '('));

        if (expr.right.params && expr.right.params.length > 0) {
            for (const p of expr.right.params) {
                funcNameBlock.appendChild(createElementNode('div', 'block variables', p));
            }
        }

        funcNameBlock.appendChild(document.createTextNode(')'));

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
        line.appendChild(createElementNode('div', 'block transparent', trKeyword('object')));
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
        line.appendChild(createElementNode('div', 'block transparent', trKeyword('array')));
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
    if (prop && prop.value && (prop.value.type === 'FunctionExpression' || prop.value.type === 'ArrowFunctionExpression')) {
        const outer = createElementNode('div', 'block functions hasChildren');
        const line = createElementNode('div', 'line');

        const funcNameBlock = createElementNode('div', 'block functionName');
        funcNameBlock.appendChild(document.createTextNode(prop.key + '('));

        const params = prop.value.params || [];

        for (const p of params) {
            const pNode = typeof p === 'string' ? makeVariablesNode(p) : makeValueNode(p);

            if (pNode) {
                funcNameBlock.appendChild(pNode);
            }
        }

        funcNameBlock.appendChild(document.createTextNode(')'));
        line.appendChild(funcNameBlock);
        outer.appendChild(line);

        if (prop.value.body) {
            const inner = createElementNode('div', 'inner');
            const bodyBlock = prop.value.body.type === 'BlockStatement' ? statementToBlock(prop.value.body) : expressionToBlock(prop.value.body);

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
            const bodyBlock = makeValueNode(node.body) || createElementNode('div', 'block dom');

            if (bodyBlock) {
                topLine.appendChild(bodyBlock);
            }

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
        if (node.name === 'document') {
            return createElementNode('div', 'block valueSpecial', trObject('document'));
        }

        return makeVariablesNode(node.name);
    }

    if (node.type === 'MemberExpression') {
        const flat = flattenMember(node);
        const parts = flat.split('.');

        if (parts.length > 1) {
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

    if (node.type === 'NewExpression') {
        return makeNewExpressionBlock(node);
    }

    if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
        return makeArrowFunctionBlock(node);
    }

    if (node.type === 'AwaitExpression') {
        return makeAwaitBlock(node);
    }

    if (node.type === 'TemplateLiteral') {
        return makeTemplateLiteralBlock(node);
    }

    if (node.type === 'ConditionalExpression') {
        return makeConditionalExpressionBlock(node);
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
        if (a.name === 'document') {
            return createElementNode('div', 'block valueSpecial', trObject('document'));
        }

        return makeVariablesNode(a.name);
    }

    if (a.type === 'MemberExpression') {
        const flat = flattenMember(a);
        const parts = flat.split('.');

        if (parts.length > 1) {
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

    if (a.type === 'NewExpression') {
        return makeNewExpressionBlock(a);
    }

    if (a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression') {
        return makeArrowFunctionBlock(a);
    }

    if (a.type === 'AwaitExpression') {
        return makeAwaitBlock(a);
    }

    if (a.type === 'TemplateLiteral') {
        return makeTemplateLiteralBlock(a);
    }

    if (a.type === 'ConditionalExpression') {
        return makeConditionalExpressionBlock(a);
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
* doWhileStatementToBlock - преобразование do...while в блок
* - принимает узел DoWhileStatement
 * - возвращает DOM-блок
*** */
function doWhileStatementToBlock(node) {
   if (!node || node.type !== 'DoWhileStatement') {
       return null;
   }

   const outer = createElementNode('div', 'block control hasChildren');
   const topLine = createElementNode('div', 'line');

   topLine.appendChild(createElementNode('div', 'block control', trKeyword('do')));
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

   const bottomLine = createElementNode('div', 'line');
   bottomLine.appendChild(createElementNode('div', 'block control', trKeyword('while')));
   bottomLine.appendChild(getConditionNode(node.test));
   outer.appendChild(bottomLine);

   return outer;
}

/* ***
* switchStatementToBlock - преобразование switch/case в блок
* - принимает узел SwitchStatement
* - возвращает DOM-блок
*** */
function switchStatementToBlock(node) {
   if (!node || node.type !== 'SwitchStatement') {
       return null;
   }

   const outer = createElementNode('div', 'block control hasChildren');
   const line = createElementNode('div', 'line');

   line.appendChild(createElementNode('div', 'block control', trKeyword('switch')));
   line.appendChild(getConditionNode(node.discriminant));
   outer.appendChild(line);

   const inner = createElementNode('div', 'inner');

   for (const c of node.cases || []) {
       const cc = createElementNode('div', 'block control hasChildren');
       const caseLine = createElementNode('div', 'line');

       caseLine.appendChild(createElementNode('div', 'block control', trKeyword('case')));
       caseLine.appendChild(makeValueNode(c.test) || makeValueNodeLiteral(''));
       cc.appendChild(caseLine);

       const caseBody = createElementNode('div', 'inner');

       for (const st of c.consequent || []) {
           const block = statementToBlock(st);

           if (block) {
               if (block.classList && block.classList.contains('inner')) {
                   for (const child of Array.from(block.children)) {
                       caseBody.appendChild(child);
                   }
               } else {
                   caseBody.appendChild(block);
               }
           }
       }

       if (caseBody.children.length) {
           cc.appendChild(caseBody);
       }

       inner.appendChild(cc);
   }

   if (inner.children.length) {
       outer.appendChild(inner);
   }

   return outer;
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

        case 'DoWhileStatement': {
            return doWhileStatementToBlock(node);
        }

        case 'SwitchStatement': {
            return switchStatementToBlock(node);
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
    } else if (expr.type === 'NewExpression') {
        block = makeNewExpressionBlock(expr);
    } else if (expr.type === 'AssignmentExpression') {
        block = makeAssignmentBlock(expr);
    } else if (expr.type === 'LogicalExpression') {
        block = makeLogicalExpressionBlock(expr);
    } else if (expr.type === 'BinaryExpression') {
        block = makeValueNode(expr);
    } else if (expr.type === 'ConditionalExpression') {
        block = makeConditionalExpressionBlock(expr);
    } else if (expr.type === 'TemplateLiteral') {
        block = makeTemplateLiteralBlock(expr);
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
        if (d.id && d.id.type === 'ObjectPattern') {
            const outer = createElementNode('div', 'block assign');
            const line = createElementNode('div', 'line');

            line.appendChild(createElementNode('div', 'block variables', '{...}'));
            outer.appendChild(line);
            parts.push(outer);
            continue;
        }

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

    // Объединяем "async" и "function" в одну метку и убираем лишний '='
    const funcLabel = node.async ? trKeyword('async') + ' ' + trKeyword('function') : trKeyword('function');
    line.appendChild(createElementNode('div', 'block transparent', funcLabel));

    const funcNameBlock = createElementNode('div', 'block functionName');

    // Имя функции с перечислением параметров в скобках
    funcNameBlock.appendChild(document.createTextNode((node.id || '') + '('));

    if (node.params && node.params.length > 0) {
        for (const p of node.params) {
            funcNameBlock.appendChild(createElementNode('div', 'block variables', p));
        }
    }

    funcNameBlock.appendChild(document.createTextNode(')'));

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

    line.appendChild(createElementNode('div', 'block control', trKeyword('if')));
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

    line.appendChild(createElementNode('div', 'block control', trKeyword('for')));

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

    topLine.appendChild(createElementNode('div', 'block control', trKeyword('while')));
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

    line.appendChild(createElementNode('div', 'block transparent', trKeyword('return')));

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
    codeWizardToggle.textContent = isWizardMode ? window.translate('Text mode') : window.translate('Visual mode');
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

// Проверяем наличие элементов редактора на странице
if (codeWizardToggle && jsEditorContent) {
    // Добавляем обработчик события для кнопки переключения режима
    codeWizardToggle.addEventListener('click', toggleCodeWizardMode);

    // Добавляем обработчики событий для перетаскивания блоков
    jsEditorContent.addEventListener('dragstart', handleDragStart);
    jsEditorContent.addEventListener('dragover', handleDragOver);
    jsEditorContent.addEventListener('drop', handleDrop);
    jsEditorContent.addEventListener('dragend', handleDragEnd);

    // Устанавливаем начальный режим редактора в текстовый
    setEditMode(false);
}