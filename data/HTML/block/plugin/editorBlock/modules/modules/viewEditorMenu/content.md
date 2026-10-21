<div id="viewEditorMenu">
    <select id="viewEditorMenuSelect">
        <option value="manual">Вручную</option>
        <option value="375x667">Мобильный - 375x667</option>
        <option value="768x1024">Планшет - 768x1024</option>
        <option value="1024x768">Ноутбук - 1024x768</option>
        <option value="1440x900">Десктоп - 1440x900</option>
        <option value="2560x1440">4K - 2560x1440</option>
    </select>
    <button id="viewEditorRotate" type="button">↻</button>
    <div class="viewEditorSizeInputs">
        <label class="viewEditorSizeField">
            <span>X</span>
            <input id="viewEditorWidthInput" type="number" min="1" step="1" inputmode="numeric" placeholder="Ширина" />
        </label>
        <label class="viewEditorSizeField">
            <span>Y</span>
            <input id="viewEditorHeightInput" type="number" min="1" step="1" inputmode="numeric" placeholder="Высота" />
        </label>
        <label class="viewEditorSizeField viewEditorZoomField">
            <span>Масштаб</span>
            <input id="viewEditorZoomInput" type="number" min="0.1" max="10" step="0.1" inputmode="decimal" placeholder="Zoom" />
        </label>
    </div>
</div>