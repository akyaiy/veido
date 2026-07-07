<div class="overlay">

<div id="window">
    <div id="titlebar">
        <div id="fburger">
            ☰
            <div id="fburgerMenu">
                <div class="menu_item" data-submenu="sort">Сортировка ▸</div>
                <div class="menu_item" data-submenu="view">Режим просмотра ▸</div>
                <!-- Подменю: Сортировка -->
                <div class="submenu" id="submenu_sort">
                    <div class="submenu_group">
                        <label><input type="radio" name="sort" value="name" checked> По имени</label>
                        <label><input type="radio" name="sort" value="size"> По размеру</label>
                        <label><input type="radio" name="sort" value="date"> По дате создания</label>
                    </div>
                    <div class="submenu_sep"><hr></div>
                    <div class="submenu_group">
                        <label><input type="checkbox" id="sortFoldersFirst"> С начала папки</label>
                        <label><input type="checkbox" id="showHidden"> Показывать скрытые объекты</label>
                    </div>
                </div>
                <!-- Подменю: Режим просмотра -->
                <div class="submenu" id="submenu_view">
                    <div class="menu_item" data-view="table">Таблица</div>
                    <div class="menu_item" data-view="columns">Столбцы</div>
                    <div class="menu_item" data-view="tiles">Плитка</div>
                </div>
            </div>
        </div>
        <span class="title">Файловый менеджер</span>
        <span id="closeBtn">&times;</span>
    </div>
    <div id="toolbar">
        <div id="btnUp" class="toolbarBtn">˄</div>
        <div id="btnBack" class="toolbarBtn"><</div>
        <div id="btnForward" class="toolbarBtn">></div>
        <span id="cwdEl"></span>
        <!-- <div id="actions">
            <label class="btn">Загрузить<input id="uploadFile" type="file" hidden /></label>
            <button id="btnUpload">Загрузить</button>
            <input id="newFolderName" placeholder="Новая папка" />
            <button id="btnMkdir">Создать</button>
        </div> -->
        <div id="btnSearch" class="toolbarBtn iconSearch ">🔍</div>
    </div>
    <div id="main">
        <div id="files_view" tabindex="0">
            <div id="files_header">
                <div class="col_name">Имя</div>
                <div class="col_size">Размер</div>
                <div class="col_date">Дата</div>
            </div>
        </div>
    </div>
    <div id="toolbarBottom">
        <input type="text" id="bottomInput" placeholder="Название"/>
        <button id="bottomBtn">Открыть</button>
    </div>
</div>
</div>

<div id="contextMenu" class="submenu">
  <div data-action="newFolder" data-target="files_view" class="menu_item">Создать папку</div>
  <div data-action="newFile" data-target="files_view" class="menu_item">Создать файл</div>
  <div data-action="paste" data-target="files_view" class="menu_item">Вставить</div>
  <div data-action="copy" data-target="file" class="menu_item">Копировать</div>
  <div data-action="cut" data-target="file" class="menu_item">Вырезать</div>
  <hr data-actionShow="rename fileProperties delete">
  <div data-action="rename" data-target="file" class="menu_item">Переименовать</div>
  <div data-action="fileProperties" data-target="file" class="menu_item">Свойства</div>
  <div data-action="delete" data-target="file" class="menu_item">Удалить</div>
  <hr data-actionShow="share uploadFile uploadFolder download">
  <div data-action="uploadFile" data-target="files_view" class="menu_item">Загрузить файл</div>
  <div data-action="uploadFolder" data-target="files_view" class="menu_item">Загрузить папку</div>
  <div data-action="share" data-target="file" class="menu_item">Поделиться</div>
  <div data-action="download" data-target="file" class="menu_item">Скачать</div>
</div>

<div id="filePropertiesContainer">
  <div class="fileProperties" style="display: none;">
      <div class="filePropertiesTop">
          <span class="filePropertiesTitle">Свойства</span>
          <span class="filePropertiesClose">✕</span>
      </div>
      <div class="filePropertiesContent">
          <table></table>
      </div>
  </div>
</div>

<div class="renameWindow">
    <div class="renameHeader">
        <div class="renameTitle">Переименовать&nbsp;</div>
        <div class="renameCurrentName"></div>
        <span class="renameWindowClose">✕</span>
    </div>
    <input type="text" class="renameInput" placeholder="Новое имя">
    <div class="renameWindowRulesRow">
        <div class="renameWindowRulesMessage"></div>
        <button class="renameBtn">Переименовать</button>
    </div>
</div>

<div id="filePropertiesContainers"></div>

<div id="shareWindow" style="display: none;">
    <div class="shareHeader">
        <span class="shareTitle">Настройка доступа</span>
        <span class="shareClose">✕</span>
    </div>
    <div class="shareContent">
        <div class="shareAddForm">
            <input type="text" class="shareNewName" placeholder="Имя пользователя">
            <select class="shareNewRights">
                <option value="644">Чтение</option>
                <option value="755">Редактирование</option>
                <option value="777">Полный доступ</option>
            </select>
            <button class="shareAddUser">+</button>
        </div>
        <div class="shareUsers">
        </div>
    </div>
    <div class="shareUserTemplate" style="display: none;">
        <div class="shareUserRow">
            <span class="shareUserName"></span>
            <select class="shareRights">
                <option value="644">Чтение</option>
                <option value="755">Редактирование</option>
                <option value="777">Полный доступ</option>
            </select>
            <button class="shareUserDelete">✕</button>
        </div>
    </div>
    <div class="shareFooter">
        <button class="shareCancel">Отмена</button>
        <button class="shareSave">Сохранить</button>
    </div>
</div>