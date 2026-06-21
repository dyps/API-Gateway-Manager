// ─── Bootstrap — inicialização da aplicação ──────────────────────────────────
// Este arquivo deve ser carregado por último.

// Bind do botão de fechar erro de upload
document.getElementById('btnCloseUploadError').addEventListener('click', () => {
    document.getElementById('uploadError').classList.add('hidden');
});

// ─── Inicialização das Drop Zones ─────────────────────────────────────────────

document.getElementById('btnChooseConfig').addEventListener('click', async (e) => {
    e.stopPropagation();
    const file = await pickFile(document.getElementById('fileInput'), LAST_DIR_CONFIG_KEY);
    if (file) await processConfigFile(file);
});

document.getElementById('btnChooseGroupPaths').addEventListener('click', async (e) => {
    e.stopPropagation();
    const file = await pickFile(document.getElementById('fileInputGroupPaths'), LAST_DIR_GROUP_PATHS_KEY);
    if (file) await processGroupPathsFile(file);
});

document.getElementById('btnChooseEnvironments').addEventListener('click', async (e) => {
    e.stopPropagation();
    const file = await pickFile(document.getElementById('fileInputEnvironments'), LAST_DIR_ENVIRONMENTS_KEY);
    if (file) await processEnvironmentsFile(file);
});

setupDropZone('dropZoneConfig', async (file) => {
    if (!file) {
        const picked = await pickFile(document.getElementById('fileInput'), LAST_DIR_CONFIG_KEY);
        if (picked) await processConfigFile(picked);
        return;
    }
    await processConfigFile(file);
});

setupDropZone('dropZoneGroupPaths', async (file) => {
    if (!file) {
        const picked = await pickFile(document.getElementById('fileInputGroupPaths'), LAST_DIR_GROUP_PATHS_KEY);
        if (picked) await processGroupPathsFile(picked);
        return;
    }
    await processGroupPathsFile(file);
});

setupDropZone('dropZoneEnvironments', async (file) => {
    if (!file) {
        const picked = await pickFile(document.getElementById('fileInputEnvironments'), LAST_DIR_ENVIRONMENTS_KEY);
        if (picked) await processEnvironmentsFile(picked);
        return;
    }
    await processEnvironmentsFile(file);
});

// ─── Setup dos modais de info/ajuda ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    function openModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('hidden');
    }
    function closeModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    }
    function bindModal(openBtnId, modalId, closeBtnId) {
        const openBtn = document.getElementById(openBtnId);
        const modal   = document.getElementById(modalId);
        const closeBtn = document.getElementById(closeBtnId);
        if (!openBtn || !modal) return;

        openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openModal(modalId);
        });
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeModal(modalId));
        }
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modalId);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal(modalId);
        });
    }

    bindModal('btnInfoStorage', 'modalStorage', 'btnCloseModalStorage');
    bindModal('btnHelpConfig', 'modalHelpConfig', 'btnCloseModalHelpConfig');
    bindModal('btnHelpEnvironments', 'modalHelpEnvironments', 'btnCloseModalHelpEnvironments');
    bindModal('btnHelpGroupPaths', 'modalHelpGroupPaths', 'btnCloseModalHelpGroupPaths');
});

// ─── Carregar configuração ao abrir a página ──────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    await loadSavedConfig();
});
