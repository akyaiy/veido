
<div class="overlay">

<div id="window">
    <div id="titlebar">
        <div id="fburger">
            ☰
            <div id="fburgerMenu">
                <div class="menu_item" data-submenu="sort">#{Sorting} ▸</div>
                <div class="menu_item" data-submenu="view">#{View mode} ▸</div>
                <!-- Подменю: Сортировка -->
                <div class="submenu" id="submenu_sort">
                    <div class="submenu_group">
                        <label><input type="radio" name="sort" value="name" checked> #{By name}</label>
                        <label><input type="radio" name="sort" value="size"> #{By size}</label>
                        <label><input type="radio" name="sort" value="date"> #{By creation date}</label>
                    </div>
                    <div class="submenu_sep"><hr></div>
                    <div class="submenu_group">
                        <label><input type="checkbox" id="sortFoldersFirst"> #{Folders first}</label>
                        <label><input type="checkbox" id="showHidden"> #{Show hidden items}</label>
                    </div>
                </div>
                <!-- Подменю: Режим просмотра -->
                <div class="submenu" id="submenu_view">
                    <div class="menu_item" data-view="table">#{Table}</div>
                    <div class="menu_item" data-view="columns">#{Columns}</div>
                    <div class="menu_item" data-view="tiles">#{Tiles}</div>
                </div>
            </div>
        </div>
        <span class="title">#{File manager}</span>
        <span id="closeBtn">&times;</span>
    </div>
    <div id="toolbar">
        <div id="btnUp" class="toolbarBtn">˄</div>
        <div id="btnBack" class="toolbarBtn"><</div>
        <div id="btnForward" class="toolbarBtn">></div>
        <span id="cwdEl"></span>
        <!-- <div id="actions">
            <label class="btn">#{Upload}<input id="uploadFile" type="file" hidden /></label>
            <button id="btnUpload">#{Upload}</button>
            <input id="newFolderName" placeholder="#{New folder}" />
            <button id="btnMkdir">#{Create}</button>
        </div> -->
        <div id="btnSearch" class="toolbarBtn iconSearch ">🔍</div>
    </div>
    <div id="main">
        <div id="files_view" tabindex="0">
            <div id="files_header">
                <div class="col_name">#{Name}</div>
                <div class="col_size">#{Size}</div>
                <div class="col_date">#{Date}</div>
            </div>
        </div>
    </div>
    <div id="toolbarBottom">
        <input type="text" id="bottomInput" placeholder="#{Name}"/>
        <button id="bottomBtn">#{Open}</button>
    </div>
</div>
</div>

<div id="contextMenu" class="submenu">
  <div data-action="newFolder" data-target="files_view" class="menu_item">#{Create folder}</div>
  <div data-action="newFile" data-target="files_view" class="menu_item">#{Create file}</div>
  <div data-action="paste" data-target="files_view" class="menu_item">#{Paste}</div>
  <div data-action="copy" data-target="file" class="menu_item">#{Copy}</div>
  <div data-action="cut" data-target="file" class="menu_item">#{Cut}</div>
  <hr data-actionShow="rename fileProperties delete">
  <div data-action="rename" data-target="file" class="menu_item">#{Rename}</div>
  <div data-action="fileProperties" data-target="file" class="menu_item">#{Properties}</div>
  <div data-action="delete" data-target="file" class="menu_item">#{Delete}</div>
  <hr data-actionShow="uploadFile uploadFolder download">
  <div data-action="uploadFile" data-target="files_view" class="menu_item">#{Upload file}</div>
  <div data-action="uploadFolder" data-target="files_view" class="menu_item">#{Upload folder}</div>
  <div data-action="download" data-target="file" class="menu_item">#{Download}</div>
</div>

<div id="filePropertiesContainer">
  <div class="fileProperties" style="display: none;">
      <div class="filePropertiesTop">
          <span class="filePropertiesTitle">#{Properties}</span>
          <span class="filePropertiesClose">✕</span>
      </div>
      <div class="filePropertiesContent">
          <table></table>
      </div>
  </div>
</div>

<div class="renameWindow">
    <div class="renameHeader">
        <div class="renameTitle">#{Rename}&nbsp;</div>
        <div class="renameCurrentName"></div>
        <span class="renameWindowClose">✕</span>
    </div>
    <input type="text" class="renameInput" placeholder="#{New name}">
    <div class="renameWindowRulesRow">
        <div class="renameWindowRulesMessage"></div>
        <button class="renameBtn">#{Rename}</button>
    </div>
</div>

<div id="filePropertiesContainers"></div>