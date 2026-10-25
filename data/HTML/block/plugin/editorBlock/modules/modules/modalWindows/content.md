<!-- Модальное окно уведомления -->
<div id="modalAlert" class="modalWindow" style="display: none;">
    <div class="modalText">#{Attention! The action was completed successfully.}</div>
    <div class="modalActions">
        <button id="modalAlertBtn" class="modalButton">OK</button>
    </div>
</div>

<!-- Модальное окно подтверждения -->
<div id="modalConfirm" class="modalWindow" style="display: none;">
    <div class="modalText">#{Are you sure you want to continue?}</div>
    <div class="modalActions">
        <button id="modalConfirmCancelBtn" class="modalButton btnSecondary">#{Cancel}</button>
        <button id="modalConfirmOkBtn" class="modalButton">#{Yes}</button>
    </div>
</div>

<!-- Модальное окно ввода значения -->
<div id="modalPrompt" class="modalWindow" style="display: none;">
    <div class="modalText">#{Enter a value:}</div>
    <input type="text" id="modalPromptInput" class="modalInput">
    <div class="modalActions">
        <button id="modalPromptCancelBtn" class="modalButton btnSecondary">#{Cancel}</button>
        <button id="modalPromptOkBtn" class="modalButton">OK</button>
    </div>
</div>