<div class="overlay">

<div id="window">
  <div id="titlebar">
  <div id="fburger">
    ☰
    <div id="fburgerMenu">
      <div data-view="table">Таблица</div>
      <div data-view="columns">Столбцы</div>
      <div data-view="tiles">Плитка</div>
    </div>
  </div>

<span class="title">Файловый менеджер</span>
<span id="closeBtn">&times;</span>

</div>
  <div id="toolbar">
    <button id="btnUp">⬆</button>
    <span id="cwd"></span>
    <div id="actions">
      <label class="btn">Загрузить<input id="uploadFile" type="file" hidden /></label>
      <button id="btnUpload">Загрузить</button>
      <input id="newFolderName" placeholder="Новая папка" />
      <button id="btnMkdir">Создать</button>
    </div>
  </div>
  <div id="main">
    <table id="files">
      <thead>
        <tr><th>Имя</th><th>Размер</th><th>Дата</th></tr>
      </thead>
      <tbody></tbody>
    </table>
<div id="toolbarBottom">
    <input type="text" id="bottomInput" placeholder="Название"/>
    <button id="bottomBtn">Открыть</button>
</div>
  </div>
</div>

</div>
