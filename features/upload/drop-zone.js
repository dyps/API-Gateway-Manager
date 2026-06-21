// ─── Drop Zone Setup ──────────────────────────────────────────────────────────

function setupDropZone(dropZoneId, onFile) {
    const zone = document.getElementById(dropZoneId);
    if (!zone) return;

    ['dragenter', 'dragover'].forEach(evt => {
        zone.addEventListener(evt, e => { e.preventDefault(); zone.classList.add('drag-over'); });
    });
    ['dragleave', 'dragend', 'drop'].forEach(evt => {
        zone.addEventListener(evt, e => { e.preventDefault(); zone.classList.remove('drag-over'); });
    });
    zone.addEventListener('drop', e => {
        const file = e.dataTransfer?.files?.[0];
        if (file) onFile(file);
    });
    zone.addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') return;
        onFile(null);
    });
}

/**
 * Abre o seletor de arquivo.
 * Salva o FileSystemFileHandle do arquivo escolhido no IndexedDB.
 * Na próxima vez, passa esse handle no startIn — o browser abre na pasta onde o arquivo estava.
 */
async function pickFile(inputEl, fileHandleKey) {
    if (window.showOpenFilePicker) {
        try {
            const opts = {
                types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
                multiple: false
            };
            try {
                const savedHandle = await dbGet(fileHandleKey);
                if (savedHandle) opts.startIn = savedHandle;
            } catch (_) { /* sem handle salvo, abre no local padrão */ }

            const [fileHandle] = await window.showOpenFilePicker(opts);

            // Salvar o FileSystemFileHandle do arquivo — startIn aceita file handle e abre na pasta dele
            try { await dbSet(fileHandleKey, fileHandle); } catch (_) { /* ignora */ }

            return await fileHandle.getFile();
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Erro ao abrir picker:', err);
            return null;
        }
    }
    // Fallback: input tradicional
    return new Promise(resolve => {
        const handler = () => {
            inputEl.removeEventListener('change', handler);
            resolve(inputEl.files?.[0] ?? null);
        };
        inputEl.addEventListener('change', handler);
        inputEl.click();
    });
}

function markDropZoneHasFile(zoneId, filename) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;
    if (filename && filename !== 'Nenhum arquivo') {
        zone.classList.add('has-file');
    } else {
        zone.classList.remove('has-file');
    }
}
