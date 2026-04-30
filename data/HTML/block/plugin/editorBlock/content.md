<div id="block-editor-app">
<div id="blocks-tabs-menu"><!-- loadBlockWindow --></div>
<div id="editor-area">
    
<div id="left-panel">
    <div class="elements-header">Html</div>
    <hr>
    <div id="elements-ul"><!-- loadBlockWindow --></div>
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
        <div class="tab" data-tab="js">Ивенты</div>
    </div>
    <hr>
    <div id="properties-panel-spec" style="display: none;"><!-- loadBlockWindow --></div>
    <div id="properties-panel">
        <div class="table-title">Свойства текста</div>
        <div id="properties-simpleFormats"><!-- loadBlockWindow --></div>
        <hr style="margin: 6px 0px;">
        <div id="properties-list"><!-- loadBlockWindow --></div>
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


<div id="rgb-picker-container"><!-- loadBlockWindow --></div>
<div id="ed-properties-container"><!-- loadBlockWindow --></div>
<div id="marker-modal-container"><!-- loadBlockWindow --></div>
<div id="global-editorBlock-container" style="display: none;"><!-- loadBlockWindow --></div>


</div>