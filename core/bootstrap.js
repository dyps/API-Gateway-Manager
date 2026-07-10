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

// Botões de download dos arquivos de exemplo (via Blob — funciona em file://)
document.getElementById('btnDownloadEnvExample').addEventListener('click', (e) => {
    e.preventDefault();
    const json = JSON.stringify(ENVIRONMENTS_EXAMPLE, null, 4);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'environments.example.json';
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('btnDownloadGpExample').addEventListener('click', (e) => {
    e.preventDefault();
    const json = JSON.stringify(GROUP_PATHS_EXAMPLE, null, 4);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'groupPaths.example.json';
    a.click();
    URL.revokeObjectURL(url);
});

document.addEventListener('DOMContentLoaded', async () => {
    // Restaurar lista de autorizadores do IndexedDB
    const savedAuthNames = await dbGet('authorizerNames');
    if (savedAuthNames && Array.isArray(savedAuthNames)) {
        window._authorizerNames = savedAuthNames;
    } else {
        window._authorizerNames = [];
    }

    // ─── Animação de entrada dos cards (reveal bottom-to-top) ──────────────
    // Observa quando um card remove a classe "hidden" e adiciona animação.
    // Ignora o card de upload (primeiro .card sem id específico de show/hide).
    const animatedCardIds = [
        'configsApiGatewayCard', 'groupPathsCard', 'gatewayResponsesCard',
        'topologyCard', 'pathsApiGatewayCard', 'contentCard'
    ];
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const el = mutation.target;
                if (!animatedCardIds.includes(el.id)) continue;
                if (!el.classList.contains('hidden') && !el.classList.contains('card-enter')) {
                    el.classList.add('card-enter');
                    el.addEventListener('animationend', () => {
                        el.classList.remove('card-enter');
                    }, { once: true });
                }
            }
        }
    });
    animatedCardIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });

    // Função global para disparar animação em cards já visíveis (ex: troca de ambiente)
    window.animateCard = function(cardId) {
        const el = document.getElementById(cardId);
        if (!el || el.classList.contains('hidden')) return;
        el.classList.remove('card-enter');
        // Force reflow para reiniciar a animação
        void el.offsetWidth;
        el.classList.add('card-enter');
        el.addEventListener('animationend', () => {
            el.classList.remove('card-enter');
        }, { once: true });
    };

    await loadSavedConfig();
});
