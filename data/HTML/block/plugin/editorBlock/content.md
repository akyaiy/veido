<div id="block-editor-app">
<div class="blocks-tabs">
    <div id="blocks-tabs">
        <div id="tab-open" class="tab active">Открыть</div>
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
                <div class="add-el" data-el="<block style='border:1px solid #000;'>[ST]</block>">блок</div>
                <div class="add-el" data-el="<img src='[LINK]'>">изображение</div>
                <div class="add-el" data-el="<a href='[LINK]'>[ST]</a>">ссылка</div>
                <div class="add-el" data-el="<table><tr><td>[ST]</td><td><br></td></tr><tr><td><br></td><td><br></td></tr></table>">таблица</div>
                <div class="add-el" data-el="<hr style='height:2px;border:0;background:#000;'>">линия</div>
            </div>
        </div>
        <hr>
        <div>
            <div>Формы</div>
            <div style="display:block;">
                <div class="add-el" data-el="<form style='border:1px solid #000;'>[ST]</form>">форма</div>
                <div class="add-el" data-el="<textarea style='border:1px solid #000;'>[ST]</textarea>">многострочное поле ввода</div>
                <div class="add-el" data-el="<input placeholder='[ST]'>">однострочное поле ввода</div>
                <div class="add-el" data-el="<select><option>вариант 1</option><option>вариант 2</option></select>">выпадающий список</div>
                <div class="add-el" data-el="<code style='border:1px solid #000;'>[ST]</code>">фрагмент кода</div>
            </div>
        </div>
        <hr>
        <div>
            <div>Медиа</div>
            <div style="display:none;">
                <div class="add-el" data-el="<figure><img src='[LINK]'><figcaption>[ST]</figcaption></figure>">изображение с подписью</div>
                <div class="add-el" data-el="<video src='[LINK]' controls style='max-width:100%;'>[ST]</video>">видео</div>
                <div class="add-el" data-el="<audio src='[LINK]' controls>[ST]</audio>">аудио</div>
                <div class="add-el" data-el="<iframe src='[LINK]' style='width:100%;height:160px;'></iframe>">веб-страница</div>
            </div>
        </div>
        <hr>
        <div>
            <div>Интерактив</div>
            <div style="display:none;">
                <div class="add-el" data-el="<button style='border:1px solid #000;'>[ST]</button>">кнопка</div>
                <div class="add-el" data-el="<details style='border:1px solid #000;width:160px;'><summary>[ST]</summary><block>контент</block></details>">сворачиваемый блок</div>
                <div class="add-el" data-el="<input type='range' min='0' max='100' value='50' style='width:160px;'>">ползунок</div>
                <div class="add-el" data-el="<progress value='50' max='100' style='width:160px;='></progress>">прогресс бар</div>
                <div class="add-el" data-el="<meter value='0.6' min='0' max='1' style='width:160px;'></meter>">шкала значения</div>
                <div class="add-el" data-el="<input type='file'>">поле для загрузки файла</div>
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
        <pre id="center-tab-pre-html" contenteditable="true" style="display:none"></pre>
        <pre id="center-tab-pre-js" contenteditable="true" style="display:none"></pre>
    </div>
</div>

<div id="right-panel">
    <div id="css-js-tabs">
        <div class="tab active" data-tab="properties">Свойства</div>
        <div class="tab" data-tab="css">CSS</div>
        <div class="tab" data-tab="js">JS</div>
    </div>
    <hr>
    <!--  -->
    <div id="properties-panel-spec" style="display: none;">
        <div class="table-title" style="padding-bottom: 5px;">Свойства элементов</div>
        <label data-target="image">Ссылка: <input type="text" data-prop="img-src"></label>
        <label data-target="link">Ссылка: <input type="text" data-prop="link-href"></label>
        <label data-target="input">Подсказка (ввода): <input type="text" data-prop="input-placeholder"></label>
        <label data-target="input">Тип:
            <select data-prop="input-type">
                <option value="text">текст</option>
                <option value="email">почта</option>
                <option value="password">пороль</option>
                <option value="number">число</option>
            </select>
        </label>
        <label data-target="table">Строки: <input type="number" min="1" step="1" data-prop="table-rows" value="1"></label>
        <label data-target="table">Столбцы: <input type="number" min="1" step="1" data-prop="table-cols" value="1"></label>
        <label data-target="form">Метод формы:
            <select data-prop="form-method">
                <option value="">-</option>
                <option value="get">get</option>
                <option value="post">post</option>
            </select>
        </label>
        <label data-target="form">Действие: <input type="text" data-prop="form-action"></label>
        <label data-target="all">Ширина: <input data-prop="width-value"></label>
        <label data-target="all">Высота: <br><input data-prop="height-value"></label>
        <label data-target="all">Отступы:
            <div class="margin-grid">
                <div class="col left">
                    <input data-prop="margin-left" placeholder="Слева">
                </div>
                <div class="col center">
                    <input data-prop="margin-top" placeholder="Сверху">
                    <input data-prop="margin-bottom" placeholder="Снизу">
                </div>
                <div class="col right">
                    <input data-prop="margin-right" placeholder="Справа">
                </div>
            </div>
        </label>
        <label data-target="all">Внутренние отступы:
            <div class="padding-grid">
                <div class="col left">
                    <input data-prop="padding-left" placeholder="Слева">
                </div>
                <div class="col center">
                    <input data-prop="padding-top" placeholder="Сверху">
                    <input data-prop="padding-bottom" placeholder="Снизу">
                </div>
                <div class="col right">
                    <input data-prop="padding-right" placeholder="Справа">
                </div>
            </div>
        </label>
        <label data-target="all">Фон: <br><input type="color" data-prop="background-color"></label>
        <label data-target="all">Цвет текста: <input type="color" data-prop="color"></label>
        <label data-target="all">Размер шрифта: <input data-prop="font-size"></label>
        <label data-target="all">Выравнивание текста:
            <select data-prop="text-align">
                <option value="">-</option>
                <option value="left">Слева</option>
                <option value="center">По центру</option>
                <option value="right">Справа</option>
            </select>
        </label>
        <label data-target="all">Прозрачность: <input data-prop="opacity"></label>
        <label data-target="all">Граница: 
            <select data-prop="border-width">
                <option value="">-</option>
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
                <option value="">-</option>
                <option value="solid">сплошной</option>
                <option value="dashed">пунктирный</option>
                <option value="dotted">точечный</option>
                <option value="double">двойной</option>
            </select>
            <input type="color" data-prop="border-color">
        </label>
        <label data-target="all">Радиус скругления: <input data-prop="border-radius"></label>
    </div>
    <!--  -->
    <div id="properties-panel">
        <div class="table-title">Свойства текста</div>
        <div id="properties-simpleFormats">
            <div simpleformats-button="bold" style="font-weight:bold;">B</div>
            <div simpleformats-button="italic" style="font-style:italic;">I</div>
            <div simpleformats-button="underline" style="text-decoration:underline;">U</div>
            <div simpleformats-button="strike" style="text-decoration:line-through;">S</div>
            <div simpleformats-button="text-color" style="color:blue;">T</div>
            <div simpleformats-button="bg-color" style="background-color:blue;color:white;">T</div>
            <div simpleformats-button="sup">T<span style="font-size:0.7em; vertical-align:super;">x</span></div>
            <div simpleformats-button="sub">T<span style="font-size:0.7em; vertical-align:sub;">x</span></div>
            <div simpleformats-button="border-color" style="border: 2px solid blue;">T</div>
            <div simpleformats-button="delete">-</div>
        </div>
        <div id="properties-list">
            Размер текста:
            <select property-item="font-size">
                <option value="">-</option><option value="8px">8</option><option value="10px">10</option><option value="12px">12</option><option value="14px">14</option><option value="16px">16</option><option value="18px">18</option><option value="20px">20</option><option value="22px">22</option><option value="24px">24</option><option value="26px">26</option><option value="28px">28</option><option value="30px">30</option><option value="32px">32</option><option value="36px">36</option><option value="40px">40</option><option value="48px">48</option><option value="56px">56</option><option value="64px">64</option><option value="72px">72</option>
            </select>
            Шрифт:
            <select property-item="font-family">
                <option value="">-</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="Verdana, sans-serif">Verdana</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="Georgia, serif">Georgia</option>
            </select>
            Выравнивание:
            <select property-item="text-align">
                <option value="">-</option>
                <option value="left">Слева</option>
                <option value="center">По центру</option>
                <option value="right">Справа</option>
                <option value="justify">По ширине</option>
            </select>
            Список:
            <select property-item="list">
                <option value="">-</option>
                <option value="disc">Точка</option>
                <option value="circle">Кружок</option>
                <option value="square">Квадрат</option>
                <option value="decimal">Нумерованный</option>
            </select>
            Межстрочный интервал:
            <select property-item="line-height">
                <option value="">-</option>
                <option value="1">1</option>
                <option value="1.2">1.2</option>
                <option value="1.4">1.4</option>
                <option value="1.5">1.5</option>
                <option value="1.6">1.6</option>
                <option value="1.8">1.8</option>
                <option value="2">2</option>
            </select>
            Ширина границ:
            <select property-item="border-width">
                <option value="">-</option>
                <option value="1px">1px</option>
                <option value="2px">2px</option>
                <option value="3px">3px</option>
                <option value="4px">4px</option>
                <option value="5px">5px</option>
            </select>
            Отступ:
            <select property-item="padding">
                <option value="">-</option>
                <option value="2px">2px</option>
                <option value="4px">4px</option>
                <option value="6px">6px</option>
                <option value="8px">8px</option>
                <option value="10px">10px</option>
            </select>
        </div>
    </div>
    <!--  -->
    <div id="css-panel" style="display: none;">
        <div id="tag-label">TAG</div>
        <div id="id-class-row">
            <input class="code" id="attr-id" placeholder="id">
            <input class="code" id="attr-class" placeholder="class">
        </div>
        <div class="table-wrap">
            <div class="table-title">Атрибуты</div>
            <table id="attributes-table">
                <tr><td contenteditable="true" data-placeholder="name"></td><td contenteditable="true" data-placeholder="value"></td></tr>
            </table>
        </div>
        <div class="table-wrap">
            <div class="table-title">Свойства</div>
            <table id="properties-table">
               <tr><td contenteditable="true" data-placeholder="property"></td><td contenteditable="true" data-placeholder="value"></td></tr>
            </table>
        </div>
    </div>
    <div id="js-panel" style="display: none;">
        <div class="table-title">События и функции</div>
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
        <button id="cp-close" type="button">&times;</button> </div>
</div>


<div id="ed-properties">
    <div act="paste">Вставить</div>
    <div act="copy" class="elementProp">Копировать</div>
    <div act="cut" class="elementProp">Вырезать</div>
    <div act="delete" class="elementProp">Удалить</div>
    <div act="deleteLine" class="elementTableProp">Удалить строку</div>
    <div act="deleteColumn" class="elementTableProp">Удалить столбец</div>
</div>


</div>