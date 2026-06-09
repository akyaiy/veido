<!-- основной контейнер color picker -->
<div class="colorPickerWrapper hidden">

<!-- Основной canvas выбора цвета -->
<div class="colorPickerCanvasContainer">
    <canvas class="colorPickerCanvas" width="230" height="150"></canvas>
    <div class="colorPickerCursor cpCursorCommon"></div>
</div>

<!-- Управление оттенком и предпросмотр цвета -->
<div class="colorPickerControls">
    <div class="colorPickerPreview"></div>
    <div class="cpHueContainer">
            <canvas class="colorPickerHue" width="220" height="14"></canvas>
            <div class="colorPickerHueCursor cpCursorCommon"></div>
    </div>
</div>

<!-- Формат вывода цвета и значение -->
<div class="cpBottomSection">
    <select class="colorPickerFormatSelect">
        <option value="hex">HEX</option>
        <option value="rgb">RGB</option>
    </select>
    <input type="text" class="colorPickerOutputField">
</div>

</div>