<div id="block-editor-app">
    <div id="blocks-tabs">
        <div id="tab-open" class="tab active">Открыть</div>
    </div>
    <div id="editor-area">
        <div id="left-panel">
            <div class="elements-header">Html</div>
            <hr>
            <div id="elements-ul">
                <div class="add-el" data-el="div">&lt;div&gt;</div>
                <div class="add-el" data-el="span">&lt;span&gt;</div>
                <div class="add-el" data-el="p">&lt;p&gt;</div>
                <div class="add-el" data-el="img">&lt;img&gt;</div>
                <div class="add-el" data-el="a">&lt;a&gt;</div>
                <div class="add-el" data-el="ul">&lt;ul&gt;</div>
                <div class="add-el" data-el="li">&lt;li&gt;</div>
                <div class="add-el" data-el="button">&lt;button&gt;</div>
                <div class="add-el" data-el="input">&lt;input&gt;</div>
                <div class="add-el" data-el="table">&lt;table&gt;</div>
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
        </div>
        <div id="right-panel">
            <div id="css-js-tabs">
                <div class="tab active" data-tab="css">CSS</div>
                <div class="tab" data-tab="js">JS</div>
            </div>
            <hr>
            <div id="css-panel">
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
                <table id="editor-js-panel">
                    <tr><td contenteditable="true" data-placeholder="trigger"></td><td contenteditable="true" data-placeholder="name"></td>
                </table>
            </div>
        </div>
    </div>
</div>