<div id="window">
  <div id="titlebar">Файловый менеджер</div>
  <div id="toolbar">
    <button id="btnUp">⬆</button>
    <span id="cwd"></span>
    <select id="viewMode">
      <option value="table">Таблица</option>
      <option value="columns">Столбцы</option>
      <option value="tiles">Плитка</option>
    </select>
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
  </div>
</div>
