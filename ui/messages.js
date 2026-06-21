// ─── Mensagens de feedback (toast + erro inline) ─────────────────────────────

let _messageTimeout = null;

function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    if (_messageTimeout) {
        clearTimeout(_messageTimeout);
        _messageTimeout = null;
    }

    messageDiv.textContent = text;
    messageDiv.classList.remove('visible', 'success', 'error', 'hidden');
    void messageDiv.offsetWidth;
    messageDiv.classList.add(type, 'visible');

    _messageTimeout = setTimeout(() => {
        messageDiv.classList.add('hidden');
        messageDiv.classList.remove('visible');
        _messageTimeout = null;
    }, 5000);
}

function showUploadError(text) {
    const uploadErrorDiv = document.getElementById('uploadError');
    const uploadErrorText = document.getElementById('uploadErrorText');
    uploadErrorText.textContent = text;
    // Reinicia a animação mesmo se já estava visível
    uploadErrorDiv.classList.add('hidden');
    void uploadErrorDiv.offsetWidth;
    uploadErrorDiv.classList.remove('hidden');
}
