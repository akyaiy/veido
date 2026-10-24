<div class="table-title" style="padding-bottom: 5px;">#{Element properties}</div>
<label data-target="all">ID: <input type="text" data-prop="id"><br></label>
<label data-target="img a figure video audio iframe">#{Link}: <input type="text" data-prop="link"></label>
<label data-target="input textarea select">#{Placeholder}: <input type="text" data-prop="input-placeholder"></label>
<label data-target="input textarea select">#{Type}: <select data-prop="input-type">
    <option value="text">#{Text}</option>
    <option value="email">#{Email}</option>
    <option value="password">#{Password}</option>
    <option value="number">#{Number}</option>
</select></label>
<label data-target="table">#{Rows}: <input type="number" min="1" step="1" data-prop="table-rows" value="1"></label>
<label data-target="table">#{Columns}: <input type="number" min="1" step="1" data-prop="table-cols" value="1"></label>
<label data-target="form">#{Form method}: <select data-prop="form-method">
    <option value="">#{Default}</option>
    <option value="get">get</option>
    <option value="post">post</option>
</select></label>
<label data-target="form">#{Form action}: <input type="text" data-prop="form-action"></label>
<label data-target="video">#{Poster}: <input type="text" data-prop="video-poster"></label>
<label data-target="button">#{Action type}: <select data-prop="button-type">
    <option value="">#{Default}</option>
    <option value="button">button</option>
    <option value="submit">submit</option>
    <option value="reset">reset</option>
</select></label>
<label data-target="details">#{Open by default}: <input type="checkbox" data-prop="details-open"></label>
<label data-target="input:range">#{Minimum value}: <input type="number" step="any" data-prop="range-min"></label>
<label data-target="input:range">#{Maximum value}: <input type="number" step="any" data-prop="range-max"></label>
<label data-target="input:range">#{Current value}: <input type="number" step="any" data-prop="range-value"></label>
<label data-target="progress">#{Current value}: <input type="number" step="any" data-prop="progress-value"></label>
<label data-target="input:file">#{Accepted file types}: <input type="text" data-prop="file-accept"></label>
<label data-target="input:file">#{Multiple files}: <input type="checkbox" data-prop="file-multiple"></label>
<label data-target="all">#{Width}: <input data-prop="width-value"></label>
<label data-target="all">#{Height}: <br><input data-prop="height-value"></label>
<label data-target="all">#{Margin}: <div class="margin-grid">
    <div class="col left"><input data-prop="margin-left" placeholder="#{Left}"></div>
    <div class="col center"><input data-prop="margin-top" placeholder="#{Top}"><input data-prop="margin-bottom" placeholder="#{Bottom}"></div>
    <div class="col right"><input data-prop="margin-right" placeholder="#{Right}"></div>
</div></label>
<label data-target="all">#{Padding}: <div class="padding-grid">
    <div class="col left"><input data-prop="padding-left" placeholder="#{Left}"></div>
    <div class="col center"><input data-prop="padding-top" placeholder="#{Top}"><input data-prop="padding-bottom" placeholder="#{Bottom}"></div>
    <div class="col right"><input data-prop="padding-right" placeholder="#{Right}"></div>
</div></label>
<label data-target="all">#{Background}: <input type="color" data-prop="background-color"><br></label>
<label data-target="all">#{Cursor}: <select data-prop="cursor">
    <option value="">#{Default}</option>
    <option value="pointer">#{Pointer}</option>
    <option value="text">#{Text}</option>
    <option value="wait">#{Wait}</option>
    <option value="not-allowed">#{Not allowed}</option>
    <option value="help">#{Help}</option>
</select></label>
<label data-target="text link input textarea select button code">#{Text color}: <input type="color" data-prop="color"><br></label>
<label data-target="text link input textarea select button code">#{Font size}: <input data-prop="font-size"></label>
<label data-target="text link input textarea select button code">#{Text alignment}: <select data-prop="text-align">
    <option value="">#{Default}</option>
    <option value="left">#{Left}</option>
    <option value="center">#{Center}</option>
    <option value="right">#{Right}</option>
</select></label>
<label data-target="all">#{Opacity}: <input data-prop="opacity"></label>
<label data-target="all">#{Border}: <input type="color" data-prop="border-color">
    <select data-prop="border-width">
        <option value="">#{Default}</option>
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
        <option value="">#{Default}</option>
        <option value="solid">#{Solid}</option>
        <option value="dashed">#{Dashed}</option>
        <option value="dotted">#{Dotted}</option>
        <option value="double">#{Double}</option>
    </select>
</label>
<label data-target="all">#{Border radius}: <input data-prop="border-radius"></label>
<label data-target="block">#{Display}: <select data-prop="display">
    <option value="">#{Default}</option>
    <option value="block">#{Block}</option>
    <option value="inline">#{Inline}</option>
    <option value="inline-block">#{Inline block}</option>
    <option value="flex">Flex</option>
    <option value="none">#{Hidden}</option>
</select></label>
<label data-target="input textarea select">#{Resize}: <select data-prop="resize">
    <option value="">#{Default}</option>
    <option value="none">#{Disable resizing}</option>
    <option value="both">#{Both}</option>
    <option value="horizontal">#{Horizontal}</option>
    <option value="vertical">#{Vertical}</option>
    <option value="auto">#{Auto}</option>
</select></label>
<hr style="margin: 6px 0px;">
<label>
    #{Show CSS}
    <input type="checkbox" id="toggle-css-panel" style="width: auto;">
</label>
<div id="css-panel" style="display: none">
    <div id="tag-label">TAG</div>
    <div class="table-wrap">
        <div class="table-title">#{Attributes}</div>
        <table id="attributes-table"><tr><td contenteditable="true" data-placeholder="name"></td><td contenteditable="true" data-placeholder="value"></td></tr></table>
    </div>
    <div class="table-wrap">
        <div class="table-title">#{Properties}</div>
        <table id="properties-table"><tr><td contenteditable="true" data-placeholder="property"></td><td contenteditable="true" data-placeholder="value"></td></tr></table>
    </div>
</div>