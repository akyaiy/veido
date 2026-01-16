<div id="block-editor-app">
<div id="blocks-tabs">
    <div id="tab-open" class="tab active">Открыть</div>
</div>
<div id="editor-area">
    
<div id="left-panel">
    <div class="elements-header">Html</div>
    <hr>
    <div id="elements-ul">
        <div class="add-el" data-el="div">&lt;div&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="span">&lt;span&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="p">&lt;p&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="img">&lt;img&gt;</div>
        <div class="add-el" data-el="a">&lt;a&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="ul">&lt;ul&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="ol">&lt;ol&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="li">&lt;li&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="button">&lt;button&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="input">&lt;input&gt;</div>
        <div class="add-el" data-el="textarea">&lt;textarea&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="select">&lt;select&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="option">&lt;option&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="table">&lt;table&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="tr">&lt;tr&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="td">&lt;td&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="th">&lt;th&gt;&lt;/&gt;</div>
        <div class="add-el" data-el="form">&lt;form&gt;&lt;/&gt;</div>
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
    <div id="properties-panel">
        <div class="table-title">Свойсвтва</div>
        <div id="properties-simpleFormats">
            <div simpleformats-button="bold" style="font-weight:bold;">B</div>
            <div simpleformats-button="italic" style="font-style:italic;">I</div>
            <div simpleformats-button="underline" style="text-decoration:underline;">U</div>
            <div simpleformats-button="strike" style="text-decoration:line-through;">S</div>
            <div simpleformats-button="text-color" style="color:blue;">T</div>
            <div simpleformats-button="bg-color" style="background-color:blue;color:white;">T</div>
            <div simpleformats-button="sup">T<span style="font-size:0.7em; vertical-align:super;">x</span></div>
            <div simpleformats-button="sub">T<span style="font-size:0.7em; vertical-align:sub;">x</span></div>
            <div simpleformats-button="delete">-</div>
        </div>
        <div id="properties-list">
            <select property-item="font-size">
                <option value="8px">8</option><option value="10px">10</option><option value="12px">12</option><option value="14px">14</option><option value="16px">16</option><option value="18px">18</option><option value="20px">20</option><option value="22px">22</option><option value="24px">24</option><option value="26px">26</option><option value="28px">28</option><option value="30px">30</option><option value="32px">32</option><option value="36px">36</option><option value="40px">40</option><option value="48px">48</option><option value="56px">56</option><option value="64px">64</option><option value="72px">72</option>
            </select>
            <select property-item="font-family">
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="Verdana, sans-serif">Verdana</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="Georgia, serif">Georgia</option>
            </select>
            <select property-item="text-align">
                <option value="left">Слева</option>
                <option value="center">По центру</option>
                <option value="right">Справа</option>
                <option value="justify">По ширине</option>
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
</div>