<!-- основной контейнер color picker -->
<div id="colorPickerWrapper" class="hidden">

<!-- Основной canvas выбора цвета -->
<div id="colorPickerCanvasContainer">
    <canvas id="colorPickerCanvas" width="230" height="150"></canvas>
    <div id="colorPickerCursor" class="cpCursorCommon"></div>
</div>

<!-- Управление оттенком и предпросмотр цвета -->
<div id="colorPickerControls">
    <div id="colorPickerPreview"></div>
    <div class="cpHueContainer">
            <canvas id="colorPickerHue" width="220" height="14"></canvas>
            <div id="colorPickerHueCursor" class="cpCursorCommon"></div>
    </div>
</div>

<!-- Формат вывода цвета и значение -->
<div class="cpBottomSection">
    <select id="colorPickerFormatSelect">
        <option value="hex">HEX</option>
        <option value="rgb">RGB</option>
    </select>
    <input type="text" id="colorPickerOutputField">
</div>

</div>