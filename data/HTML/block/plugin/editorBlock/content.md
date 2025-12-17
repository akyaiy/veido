<div id="menuBlockEditor">
    <div id="editBlockLoad">
        <input class="code" id="editBlockInput" placeholder="block selector or id" value="pages/test">
        <button class="btn" id="editBlockLoadBtn">Load block</button>
    </div>
    <div id="plugin-menu-div">
        <div id="editor-container">
            <div id="editor-header">
                <div class="tab active" data-tab="css">CSS</div>
                <div class="tab" data-tab="js">JS</div>
            </div>
            <div id="editor-main">
                <div id="css-panel">
                    <div style="display:flex;gap:8px;margin-bottom:8px">
                        <input class="code attr-input" id="attr-id" placeholder="id">
                        <input class="code attr-input" id="attr-class" placeholder="class">
                    </div>
                    <textarea class="code" id="attr-other" placeholder="other attributes: key=value per line"></textarea>
                    <div style="height:8px"></div>
                    <textarea class="code" id="editor-css" placeholder="css style"></textarea>
                    <div style="height:8px"></div>
                    <div style="display:flex;gap:8px">
                        <button class="btn" id="attr-delete">Delete</button>
                    </div>
                </div>
                <textarea class="code hidden" id="editor-js" placeholder="js script"></textarea>
                <div style="height:8px"></div>
                <div class="inline">
                    <button class="btn hidden" id="apply-js">Apply JS</button>
                </div>
            </div>
        </div>
    </div>
</div>

<div id="editBlock">Тест</div>
