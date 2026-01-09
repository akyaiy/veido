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
    <button id="btnUp">⬆</button>
    <span id="cwdEl"></span>
    <div id="actions">
      <label class="btn">Загрузить<input id="uploadFile" type="file" hidden /></label>
      <button id="btnUpload">Загрузить</button>
      <input id="newFolderName" placeholder="Новая папка" />
      <button id="btnMkdir">Создать</button>
    </div>
  </div>
  <div id="main">
    <div id="files_view">
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
