<!-- await loadBlock("plugin/editorText", (document.documentElement.appendChild(document.createElement('div')).id = 'plugin-menu-div')); -->
<div id="plugin-menu-div">
    <div id="editor-container">
        <div id="editor-header">
            <div class="tab active" data-tab="html">HTML / MD</div>
            <div class="tab" data-tab="css">CSS</div>
            <div class="tab" data-tab="js">JS</div>
            <div class="header-buttons">
                <button class="small" id="btn-apply">Apply</button>
                <button class="small" id="btn-clone">Clone #content</button>
            </div>
        </div>
        <div id="editor-main">
            <textarea class="code" id="editor-html"></textarea>
            <textarea class="code hidden" id="editor-css"></textarea>
            <textarea class="code hidden" id="editor-js"></textarea>
        </div>
    </div>
</div>