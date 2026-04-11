<div id="block-editor-app">
<div class="blocks-tabs">
    <div class="tab-menu-wrapper" style="position: relative;">
        <div id="tabs-menu-btn">
            <svg class="tabs-svg-icon" class="svg-icon" use="8x13"></svg>
        </div>
        <div id="tabs-menu" style="display:none;">
            <div id="tab-open" class="tab">Открыть</div>
            <div  id="tab-new" class="tab">Новый</div>
        </div>
    </div>
    <div id="blocks-tabs">
    </div>
    <div class="history-actions" style="display: flex;">
        <div data-act="undo"><svg class="tabs-svg-icon" use="3x13"></svg></div>
        <div data-act="redo"><svg class="tabs-svg-icon" use="3x14"></svg></div>
    </div>
    <div class="tab" id="previewPage">Предпросмотр</div>
</div>
<div id="editor-area">
    
<div id="left-panel">
    <div class="elements-header">Html</div>
    <hr>
    <div id="elements-ul">
        <div>
            <div>Базовые элементы</div>
            <div style="display:block;">
                <div class="add-el" data-el="<div style='border:1px solid #000; display: inline-block;'>[ST]</div>" title="блок"><svg class="svg-icon" use="4x19"></svg></div>
                <div class="add-el" data-el="<img src='[LINK]'>" title="изображение"><svg class="svg-icon" use="19x19"></svg></div>
                <div class="add-el" data-el="<a href='[LINK]'>[ST]</a>" title="ссылка"><svg class="svg-icon" use="14x23"></svg></div>
                <div class="add-el" data-el="<table><tr><td>[ST]</td><td><br></td></tr><tr><td><br></td><td><br></td></tr></table>" title="таблица"><svg class="svg-icon" use="19x6"></svg></div>
                <div class="add-el" data-el="<hr style='height:2px;border:0;background:#000;'>" title="линия"><svg class="svg-icon" use="4x7"></svg></div>
            </div>
        </div>
        <hr>
        <div>
            <div>Формы</div>
            <div style="display:block;">
                <div class="add-el" data-el="<form style='border:1px solid #000;'>[ST]</form>" title="форма"><svg class="svg-icon" use="12x18"></svg></div>
                <div class="add-el" data-el="<input placeholder='[ST]'>" title="однострочное поле ввода"><svg class="svg-icon" use="19x17"></svg></div>
                <div class="add-el" data-el="<textarea style='border:1px solid #000;'>[ST]</textarea>" title="многострочное поле ввода"><svg class="svg-icon" use="19x18"></svg></div>
                <div class="add-el" data-el="<select><option>вариант 1</option><option>вариант 2</option></select>" title="выпадающий список"><svg class="svg-icon" use="10x16"></svg></div>
                <div class="add-el" data-el="<code style='border:1px solid #000;'>[ST]</code>" title="фрагмент кода"><svg class="svg-icon" use="15x9"></svg></div>
            </div>
        </div>
        <hr>
        <div>
            <div>Медиа</div>
            <div style="display:none;">
                <div class="add-el" data-el="<figure><img src='[LINK]'><figcaption>[ST]</figcaption></figure>" title="изображение с подписью"><svg class="svg-icon" use="9x13"></svg></div>
                <div class="add-el" data-el="<video src='[LINK]' controls style='max-width:100%;'>[ST]</video>" title="видео"><svg class="svg-icon" use="15x4"></svg></div>
                <div class="add-el" data-el="<audio src='[LINK]' controls>[ST]</audio>" title="аудио"><svg class="svg-icon" use="15x3"></svg></div>
                <div class="add-el" data-el="<iframe src='[LINK]' style='width:100%;height:160px;'></iframe>" title="веб-страница"><svg class="svg-icon" use="15x5"></svg></div>
            </div>
        </div>
        <hr>
        <div>
            <div>Интерактив</div>
            <div style="display:none;">
                <div class="add-el" data-el="<button style='border:1px solid #000;'>[ST]</button>" title="кнопка"><svg class="svg-icon" use="14x27"></svg></div>
                <div class="add-el" data-el="<details style='border:1px solid #000;width:160px;'><summary>[ST]</summary><div>контент</div></details>" title="сворачиваемый блок"><svg class="svg-icon" use="19x20"></svg></div>
                <div class="add-el" data-el="<input type='range' min='0' max='100' value='50' style='width:160px;'>" title="ползунок"><svg class="svg-icon" use="19x22"></svg></div>
                <div class="add-el" data-el="<progress value='50' max='100' style='width:160px;'></progress>" title="прогресс бар"><svg class="svg-icon" use="19x21"></svg></div>
                <div class="add-el" data-el="<input type='file'>" title="поле для загрузки файла"><svg class="svg-icon" use="1x19"></svg></div>
            </div>
        </div>
    </div>
</div>

<div id="center-panel">
    <div id="loadedBlock" aria-label="loadedBlock">
        <div id="loadedBlockMain"></div>
        <div class="small-handle"></div>
    </div>
    <div id="center-tabs">
        <div class="center-tab active" data-tab="view">Внешний вид</div>
        <div class="center-tab" data-tab="html">HTML код</div>
        <div class="center-tab" data-tab="js">JS код</div>
    </div>
    <div id="center-tab-controls" style="display:flex;gap:8px;padding:6px 8px">
        <!-- <button id="btn-load-from-view" style="display:none">Загрузить из внешнего вида</button>
        <button id="btn-apply-to-view" style="display:none">Применить в внешний вид</button> -->
        <button id="btn-apply-js" style="display:none">Применить JS</button>
    </div>
    <div id="center-tab-content">
        <pre id="center-tab-pre-html" contenteditable="true" style="display:none;"></pre>
        <pre id="center-tab-pre-js" contenteditable="true" style="display:none; "></pre>
    </div>
</div>

<div id="right-panel">
    <div id="css-js-tabs">
        <div class="tab active" data-tab="properties">Свойства</div>
        <!-- <div class="tab" data-tab="css">Свойства+</div> -->
        <div class="tab" data-tab="js">Ивенты</div>
    </div>
    <hr>
    <!--  -->
    <div id="properties-panel-spec" style="display: none;">
        <div class="table-title" style="padding-bottom: 5px;">Свойства элементов</div>
        <label data-target="all">ID: <input type="text" data-prop="id"><br></label>
        <label data-target="img a figure video audio iframe">Ссылка: <input type="text" data-prop="link"></label>
        <label data-target="input textarea select">Подсказка: <input type="text" data-prop="input-placeholder"></label>
        <label data-target="input textarea select">Тип: <select data-prop="input-type">
            <option value="text">текст</option>
            <option value="email">почта</option>
            <option value="password">пороль</option>
            <option value="number">число</option>
        </select></label>
        <label data-target="table">Строки: <input type="number" min="1" step="1" data-prop="table-rows" value="1"></label>
        <label data-target="table">Столбцы: <input type="number" min="1" step="1" data-prop="table-cols" value="1"></label>
        <label data-target="form">Метод формы: <select data-prop="form-method">
            <option value="">По умолчанию</option>
            <option value="get">get</option>
            <option value="post">post</option>
        </select></label>
        <label data-target="form">Действие формы: <input type="text" data-prop="form-action"></label>
        <label data-target="video">Заставка" <input type="text" data-prop="video-poster"></label>
        <label data-target="button">Тип действия: <select data-prop="button-type">
            <option value="">По умолчанию</option>
            <option value="button">button</option>
            <option value="submit">submit</option>
            <option value="reset">reset</option>
        </select></label>
        <label data-target="details">Открыть по умолчанию: <input type="checkbox" data-prop="details-open"></label>
        <label data-target="input:range">Мин значение: <input type="number" step="any" data-prop="range-min"></label>
        <label data-target="input:range">Макс значение: <input type="number" step="any" data-prop="range-max"></label>
        <label data-target="input:range">Текущее значение: <input type="number" step="any" data-prop="range-value"></label>
        <label data-target="progress">Текущее значение: <input type="number" step="any" data-prop="progress-value"></label>
        <label data-target="input:file">Допустимые типы: <input type="text" data-prop="file-accept"></label>
        <label data-target="input:file">Несколько файлов: <input type="checkbox" data-prop="file-multiple"></label>
        <label data-target="all">Ширина: <input data-prop="width-value"></label>
        <label data-target="all">Высота: <br><input data-prop="height-value"></label>
        <label data-target="all">Внешние отступы: <div class="margin-grid">
            <div class="col left"><input data-prop="margin-left" placeholder="Слева"></div>
            <div class="col center"><input data-prop="margin-top" placeholder="Сверху"><input data-prop="margin-bottom" placeholder="Снизу"></div>
            <div class="col right"><input data-prop="margin-right" placeholder="Справа"></div>
        </div></label>
        <label data-target="all">Отступы от границ: <div class="padding-grid">
            <div class="col left"><input data-prop="padding-left" placeholder="Слева"></div>
            <div class="col center"><input data-prop="padding-top" placeholder="Сверху"><input data-prop="padding-bottom" placeholder="Снизу"></div>
            <div class="col right"><input data-prop="padding-right" placeholder="Справа"></div>
        </div></label>
        <label data-target="all">Фон: <input type="color" data-prop="background-color"><br></label>
        <label data-target="all">Курсор: <select data-prop="cursor">
            <option value="">По умолчанию</option>
            <option value="pointer">Указатель</option>
            <option value="text">Текст</option>
            <option value="wait">Ожидание</option>
            <option value="not-allowed">Запрещено</option>
            <option value="help">Помощь</option>
        </select></label>
        <label data-target="text link input textarea select button code">Цвет текста: <input type="color" data-prop="color"><br></label>
        <label data-target="text link input textarea select button code">Размер шрифта: <input data-prop="font-size"></label>
        <label data-target="text link input textarea select button code">Выравнивание текста: <select data-prop="text-align">
            <option value="">По умолчанию</option>
            <option value="left">Слева</option>
            <option value="center">По центру</option>
            <option value="right">Справа</option>
        </select></label>
        <label data-target="all">Прозрачность: <input data-prop="opacity"></label>
        <label data-target="all">Граница: <input type="color" data-prop="border-color">
            <select data-prop="border-width">
                <option value="">По умолчанию</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
            </select>
            <select data-prop="border-style">
                <option value="">По умолчанию</option>
                <option value="solid">сплошной</option>
                <option value="dashed">пунктирный</option>
                <option value="dotted">точечный</option>
                <option value="double">двойной</option>
            </select>
        </label>
        <label data-target="all">Радиус скругления: <input data-prop="border-radius"></label>
        <label data-target="block">Отображение элемента: <select data-prop="display">
            <option value="">По умолчанию</option>
            <option value="block">Блочный</option>
            <option value="inline">Строчный</option>
            <option value="inline-block">Инлайн блок</option>
            <option value="flex">Flex</option>
            <option value="none">Не отображать</option>
        </select></label>
        <label data-target="input textarea select">Изменение размера: <select data-prop="resize">
            <option value="">По умолчанию</option>
            <option value="none">Запретить изменение размера</option>
            <option value="both">Обе стороны</option>
            <option value="horizontal">По горизонтали</option>
            <option value="vertical">По вертикали</option>
            <option value="auto">Авто</option>
        </select></label>
        <hr style="margin: 6px 0px;">
        <label>
            Показать CSS
            <input type="checkbox" id="toggle-css-panel" style="width: auto;">
        </label>
        <div id="css-panel" style="display: none">
            <div id="tag-label">TAG</div>
            <div class="table-wrap">
                <div class="table-title">Атрибуты</div>
                <table id="attributes-table"><tr><td contenteditable="true" data-placeholder="name"></td><td contenteditable="true" data-placeholder="value"></td></tr></table>
            </div>
            <div class="table-wrap">
                <div class="table-title">Свойства</div>
                <table id="properties-table"><tr><td contenteditable="true" data-placeholder="property"></td><td contenteditable="true" data-placeholder="value"></td></tr></table>
            </div>
        </div>
    </div>
    <!--  -->
    <div id="properties-panel">
        <div class="table-title">Свойства текста</div>
        <div id="properties-simpleFormats">
            <div simpleformats-button="bold"><svg class="svg-icon" use="8x4"></svg></div>
            <div simpleformats-button="italic"><svg class="svg-icon" use="8x5"></svg></div>
            <div simpleformats-button="underline"><svg class="svg-icon" use="8x6"></svg></div>
            <div simpleformats-button="strike"><svg class="svg-icon" use="8x7"></svg></div>
            <div simpleformats-button="text-color"><svg class="svg-icon" use="8x4" use-color="#516ed7"></svg></div>
            <div simpleformats-button="bg-color"><svg class="svg-icon" use="8x4" use-background="#516ed7"></svg></div>
            <div simpleformats-button="sup"><svg class="svg-icon" use="8x8"></svg></div>
            <div simpleformats-button="sub"><svg class="svg-icon" use="8x9"></svg></div>
            <div simpleformats-button="delete"><svg class="svg-icon" use="1x28"></svg></div>
            <br>
            <div simpleformats-button="text-align-left" title="Слева"><svg class="svg-icon" use="8x10"></svg></div>
            <div simpleformats-button="text-align-center" title="По центру"><svg class="svg-icon" use="8x11"></svg></div>
            <div simpleformats-button="text-align-right" title="Справа"><svg class="svg-icon" use="8x12"></svg></div>
            <div simpleformats-button="text-align-justify" title="По ширине"><svg class="svg-icon" use="8x13"></svg></div>
            <div simpleformats-button="list-disc" title="Точка"><svg class="svg-icon" use="19x23"></svg></div>
            <div simpleformats-button="list-circle" title="Кружок"><svg class="svg-icon" use="10x10"></svg></div>
            <div simpleformats-button="list-square" title="Квадрат"><svg class="svg-icon" use="19x24"></svg></div>
            <div simpleformats-button="list-decimal" title="Нумерованный"><svg class="svg-icon" use="10x11"></svg></div>
        </div>
        <hr style="margin: 6px 0px;">
        <div id="properties-list">
            Размер текста:
            <select property-item="font-size">
                <option value="">По умолчанию</option><option value="8px">8</option><option value="10px">10</option><option value="12px">12</option><option value="14px">14</option><option value="16px">16</option><option value="18px">18</option><option value="20px">20</option><option value="22px">22</option><option value="24px">24</option><option value="26px">26</option><option value="28px">28</option><option value="30px">30</option><option value="32px">32</option><option value="36px">36</option><option value="40px">40</option><option value="48px">48</option><option value="56px">56</option><option value="64px">64</option><option value="72px">72</option>
            </select>
            Шрифт:
            <select property-item="font-family">
                <option value="">По умолчанию</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="Verdana, sans-serif">Verdana</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="Georgia, serif">Georgia</option>
            </select>
            Межстрочный интервал:
            <select property-item="line-height">
                <option value="">По умолчанию</option>
                <option value="1">1</option>
                <option value="1.2">1.2</option>
                <option value="1.4">1.4</option>
                <option value="1.5">1.5</option>
                <option value="1.6">1.6</option>
                <option value="1.8">1.8</option>
                <option value="2">2</option>
            </select>
            Внешние отступы:
            <select property-item="padding">
                <option value="">По умолчанию</option>
                <option value="2px">2px</option>
                <option value="4px">4px</option>
                <option value="6px">6px</option>
                <option value="8px">8px</option>
                <option value="10px">10px</option>
            </select>
        </div>
    </div>
    <div id="js-panel" style="display: none;">
        <div class="table-title">События и функции</div>
        <div id="editor-js-panel-name">
            <select id="selector-type" style="flex: 0 0 35%; min-width: 0;">
                <option value="id">id</option>
                <option value="class">class</option>
            </select>
            <input id="selector-name-id" type="text" style="flex:1; min-width:0;">
            <input id="selector-name-class" type="text" style="flex:1; min-width:0; display: none;">
            <select id="selector-class" style="flex: 0 0 5%; min-width: 0; display: none;">
            </select>
        </div>
        <table id="editor-js-panel">
        </table>
    </div>
</div>

</div>


<div id="rgb-picker" class="rgb-picker">
    <div class="picker-row">
        <div class="canvas-wrap">
            <canvas id="cp-hue" width="280" height="20"></canvas>
            <div id="hue-thumb" class="picker-thumb"></div>
        </div>
    </div>
    <div class="picker-row">
        <div class="canvas-wrap">
            <canvas id="cp-light" width="280" height="20"></canvas>
            <div id="light-thumb" class="picker-thumb"></div>
        </div>
    </div>
    <div class="picker-row inputs">
        <input id="cp-hex" type="text" placeholder="#000000" maxlength="7" />
        <button id="cp-close" type="button">&times;</button> 
    </div>
</div>


<div id="ed-properties">
    <div act="paste">Вставить</div>
    <div act="copy" class="elementProp">Копировать</div>
    <div act="cut" class="elementProp">Вырезать</div>
    <div act="delete" class="elementProp">Удалить</div>
    <div act="deleteLine" class="elementTableProp">Удалить строку</div>
    <div act="deleteColumn" class="elementTableProp">Удалить столбец</div>
</div>


<div class="marker-modal-backdrop" style="display: none;">
    <div class="marker-modal">
        <div class="marker-name"></div>
        <div class="marker-text" style="display: none;"></div>
        <input class="marker-input" type="text" style="display: none;">
        <div class="marker-modal-buttons">
            <button class="marker-cancel">Отмена</button>
            <button class="marker-ok">OK</button>
        </div>
    </div>
</div>


</div>