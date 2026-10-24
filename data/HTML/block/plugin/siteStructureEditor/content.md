
<div id="siteStructureEditor">



<!-- Верхняя панель -->
<div id="topPanel">
    <div id="fileMenu">
        <div id="fileMenuIcon"><svg class="svgIcon" use="8x13"></svg></div>
        <div id="fileMenuList">
            <div id="newFile">#{New}</div>
            <div id="openFile">#{Open}</div>
            <div id="saveFile">#{Save}</div>
        </div>
    </div>
    <div id="fileList"></div>
    <div id="siteHistory">
        <div id="historyBack" title="#{Back}"><svg class="svgIcon" use="3x13"></svg></div>
        <div id="historyForward" title="#{Forward}"><svg class="svgIcon" use="3x14"></svg></div>
    </div>
</div>



<!-- Основная панель -->
<div id="mainPanel">

<div id="centerPanel">
    <div id="mapSettings">
        <div id="viewSettings">
            <select id="viewType">
                <option value="cards">#{Cards}</option>
                <option value="tree">#{Tree}</option>
                <!-- <option value="colors">#{Colors}</option> -->
            </select>
        </div>
        <div id="gridSettings">
            <input id="gridSizeValue" type="number" min="1" max="100" value="10">
            <input id="gridSize" type="range" min="1" max="100" value="10">
        </div>
        <div id="zoomSettings">
            <input id="zoomValue" type="number" min="10" max="300" value="100">
            <input id="zoom" type="range" min="10" max="300" value="100">
        </div>
    </div>
    <div id="siteMap"></div>
</div>

<div id="openedFiles"></div>

<div id="rightPanel">
<div id="pageProperties">

<div data-property="id"><label>ID</label><input type="number" min="1"></div>
<div data-property="name"><label>#{Name}</label><input type="text"></div>
<div data-property="title"><label>#{Title}</label><input type="text"></div>
<div data-property="caption"><label>#{Caption}</label><textarea></textarea></div>
<div data-property="description"><label>#{Description}</label><textarea></textarea></div>
<hr>

<div data-property="types"><label>#{Types}</label><div class="multipleSelect"><div class="multipleSelectValue">#{Select types}</div><div class="multipleSelectList"><input type="text" class="multipleSelectAdd" placeholder="#{Add type}"><label><input type="checkbox" value="page">#{Page}</label><label><input type="checkbox" value="section">#{Section}</label><label><input type="checkbox" value="service">#{Service}</label><label><input type="checkbox" value="dynamic">#{Dynamic}</label><label><input type="checkbox" value="external">#{External}</label></div></div></div>
<div data-property="theme"><label>#{Theme}</label><select><option value="">#{Default}</option><option value="light">#{Light}</option><option value="dark">#{Dark}</option></select></div>
<div data-property="order"><label>#{Order}</label><select></select></div>
<div data-property="redirect"><label>#{Redirect}</label><input type="text"></div>
<hr>

<div data-property="status"><label>#{Status}</label><select><option value="draft">#{Draft}</option><option value="published">#{Published}</option><option value="hidden">#{Hidden}</option><option value="archived">#{Archived}</option></select></div>
<div data-property="access"><label>#{Access}</label><div class="multipleSelect"><div class="multipleSelectValue">#{Configure access}</div><div class="multipleSelectList"><div class="accessAdd"><input type="text" placeholder="#{Add user}"><select><option value="read">#{Read}</option><option value="edit">#{Edit}</option><option value="full">#{Full}</option></select></div><div class="accessItem" data-access="guest"><span>#{Guest}</span><select><option value="read">#{Read}</option><option value="edit">#{Edit}</option><option value="full">#{Full}</option></select></div><div class="accessItem" data-access="user"><span>#{User}</span><select><option value="read">#{Read}</option><option value="edit">#{Edit}</option><option value="full">#{Full}</option></select></div><div class="accessItem" data-access="admin"><span>#{Administrator}</span><select><option value="read">#{Read}</option><option value="edit">#{Edit}</option><option value="full">#{Full}</option></select></div></div></div></div>
<hr>

<div data-property="position"><label>#{Position}</label><div><input type="number" data-position="x" placeholder="X"><input type="number" data-position="y" placeholder="Y"></div></div>
<div data-property="view"><label>#{View}</label><select><option value="expanded">#{Expanded}</option><option value="collapsed">#{Collapsed}</option></select></div>

</div>
</div>

</div>



<!-- Контекстное меню -->
<div id="contextMenu">
    <div data-action="create" data-target="empty">#{Create}</div>
    <div data-action="paste" data-target="empty">#{Paste}</div>
    <div data-action="copy" data-target="page">#{Copy}</div>
    <div data-action="cut" data-target="page">#{Cut}</div>
    <div data-action="delete" data-target="page">#{Delete}</div>
</div>



</div>