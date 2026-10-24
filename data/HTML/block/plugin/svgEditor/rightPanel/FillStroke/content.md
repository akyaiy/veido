<div id="tabsFillStroke">
    <div data-block="svgGroupFill">#{Fill}</div>
    <div data-block="svgGroupStroke">#{Stroke}</div>
    <div data-block="svgGroupStrokeStyle">#{Stroke style}</div>
</div>

<div id="svgGroupFill" class="tabFillStroke">
    <div>#{Color}: <div id="svgPropFillColor" class="colorPickerTrigger" data-color-role="svgPropFillColor"></div> <div id="svgPropFillColorPicker" data-color-role="svgPropFillColor"></div></div>
    <div>#{Opacity}: <input type="number" id="svgPropFillOpacity" step="0.01"></div>
</div>

<div id="svgGroupStroke" class="tabFillStroke">
    <div>#{Color}: <div id="svgPropStrokeColor" class="colorPickerTrigger" data-color-role="svgPropStrokeColor"></div> <div id="svgPropStrokeColorPicker" data-color-role="svgPropStrokeColor"></div></div>
    <div>#{Opacity}: <input type="number" id="svgPropStrokeOpacity" step="0.01"></div>
</div>

<div id="svgGroupStrokeStyle" class="tabFillStroke">
    <div>#{Width}: <input type="number" id="svgPropStrokeWidth"></div>
    <div>#{Dash pattern}:
        <select id="svgPropStrokeDasharray">
            <option value="none">#{None}</option>
            <option value="1 3">#{Dots}</option>
            <option value="4 4">#{Dashes}</option>
            <option value="10 4 2 4">#{Dash dot}</option>
        </select>
    </div>
</div>