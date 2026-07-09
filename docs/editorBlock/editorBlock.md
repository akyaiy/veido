# Документация editorBlock

`editorBlock` - редактор HTML-блоков, предназначенный для создания и редактирования MD, CSS и JS-кода через веб-интерфейс.



## Структура внешнего вида

![editorBlock](./img/editorBlock.png)

### Верхняя панель
- Меню действий с файлами - управление файлами (сохранение, открытие итд.)
- Вкладки блоков - переключение между открытыми блоками
- Кнопки назад / вперёд - история изменений
- Кнопка предпросмотра - запуск режима просмотра блока

### Левая панель
- Кнопки вставки элементов (разбитые по вкладкам) - добавление HTML-элементов в блок

### Центральная панель
- Основной блок просмотра визуального режима, MD-кода или JS-кода
- Кнопки переключения режимов (визуальный / MD / JS)

### Правая панель
- Сверху вкладки для переключения разделов:
- Свойства текста - параметры текста (цвет, размер итд.)
- Свойства элемента - свойства стиля и атрибуты выбранного элемента
- Редактор событий - обработчики JS событий элемента и назначение функций



## Модули

Модуль - отдельный компонент редактора, который отвечает за свою часть интерфейса или логики.

### Основа редактора
- [mainBlock](./modules/mainBlock.md) - основной каркас редактора и базовые стили/логика

### Работа с файлами
- [fileMenu](./modules/modules/fileMenu.md) - меню действий с модулем

### Управление модулями
- [blocksContainers](./modules/modules/blocksContainers.md) - хранилище данных модулей
- [blocksTabs](./modules/modules/blocksTabs.md) - вкладки открытых модулей
- [viewBlock](./modules/modules/viewBlock.md) - область отображения модуля
- [editorHistory](./modules/modules/editorHistory.md) - история изменений
- [blockPreview](./modules/modules/blockPreview.md) - режим предпросмотра

### Редакторы
- [viewEditor](./modules/modules/viewEditor.md) - визуальный редактор модуля
- [mdEditor](./modules/modules/mdEditor.md) - редактор MD-кода
- [jsEditor](./modules/modules/jsEditor.md) - редактор JS-кода

### Редактирование
- [insertingElements](./modules/modules/insertingElements.md) - вставка HTML-элементов в модуль
- [propertiesText](./modules/modules/propertiesText.md) - свойства текста
- [propertiesElement](./modules/modules/propertiesElement.md) - свойства элемента (размеры, отступы итд.)
- [attributesElement](./modules/modules/attributesElement.md) - HTML-атрибуты элемента (id, class, data-*)
- [eventsEditor](./modules/modules/eventsEditor.md) - JS события элемента (обработчики и назначение функций)

### Всплывающие окна
- [colorPicker](./modules/modules/colorPicker.md) - выбор цвета через окно
- [contextMenu](./modules/modules/contextMenu.md) - контекстное меню (по правому клику)
- [modalWindows](./modules/modules/modalWindows.md) - модальные окна



## Схема зависимостей и иерархии модулей

Нижние модули зависят от верхних, получая от верхних данные и функции.

![editorBlock](./img/componentDependencyMap.png)