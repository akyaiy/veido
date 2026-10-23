# Blocks: библиотека сайта через VFS

<p class="blocks-lead">Эта страница читает <code>blocks/tree.json</code>, затем лениво запрашивает <code>meta.json</code> каждого Block и его физический <code>content.md</code>. Block не встраивается в Page и не хранит свои байты в HTML Provider.</p>

<section class="blocks-demo" aria-labelledby="blocks-demo-title">
  <div class="blocks-toolbar"><div><p class="blocks-kicker">html@site[html-demo]:///blocks</p><h2 id="blocks-demo-title">Библиотека Blocks</h2></div><button type="button" id="blocks-refresh">Обновить</button></div>
  <p id="blocks-status" role="status">Загрузка дерева…</p>
  <div id="blocks-tree" class="blocks-tree"></div>
</section>

<section class="blocks-demo blocks-contract"><h2>Что проверяет демо</h2><ul><li><strong>ui-component</strong> требует <code>content.md</code>, <code>style.css</code> и <code>script.js</code>.</li><li><strong>content</strong> содержит только <code>content.md</code>.</li><li>Кнопка «Показать source» читает physical URI из metadata через VFS, а не через HTML Store.</li></ul></section>
