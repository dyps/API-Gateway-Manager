// ─── Dialogs genéricos (alert, confirm, download pending) ────────────────────

async function showAlertDialog(title, message) {
    return new Promise((resolve) => {
        const existing = document.getElementById('genericAlertDialog');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'genericAlertDialog';
        overlay.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            background:rgba(0,0,0,0.55);display:flex;align-items:center;
            justify-content:center;z-index:9999;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background:#1a1f2e;border:1px solid #2d3748;border-radius:0.75rem;
            padding:1.5rem;min-width:340px;max-width:90vw;
            box-shadow:0 8px 32px rgba(0,0,0,0.4);
        `;

        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        titleEl.style.cssText = 'margin:0 0 0.75rem;font-size:1rem;color:#fbbf24;';
        dialog.appendChild(titleEl);

        const msg = document.createElement('p');
        msg.innerHTML = message;
        msg.style.cssText = 'margin:0 0 1.25rem;font-size:0.875rem;color:#cbd5e0;line-height:1.6;';
        dialog.appendChild(msg);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;justify-content:flex-end;';

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.cssText = 'padding:0.4rem 1.2rem;font-size:0.82rem;background:#2d3748;color:#e2e8f0;border:none;border-radius:0.375rem;cursor:pointer;font-weight:600;';
        okBtn.onclick = () => { overlay.remove(); resolve(); };

        btnRow.appendChild(okBtn);
        dialog.appendChild(btnRow);

        overlay.appendChild(dialog);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(); } });
        document.body.appendChild(overlay);
        okBtn.focus();
    });
}

async function showConfirmDialog(title, message) {
    return new Promise((resolve) => {
        const existing = document.getElementById('genericConfirmDialog');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'genericConfirmDialog';
        overlay.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            background:rgba(0,0,0,0.55);display:flex;align-items:center;
            justify-content:center;z-index:9999;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background:#1a1f2e;border:1px solid #2d3748;border-radius:0.75rem;
            padding:1.5rem;min-width:360px;max-width:90vw;
            box-shadow:0 8px 32px rgba(0,0,0,0.4);
        `;

        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        titleEl.style.cssText = 'margin:0 0 0.75rem;font-size:1rem;color:#fbbf24;';
        dialog.appendChild(titleEl);

        const msg = document.createElement('p');
        msg.innerHTML = message;
        msg.style.cssText = 'margin:0 0 1.25rem;font-size:0.875rem;color:#cbd5e0;line-height:1.6;';
        dialog.appendChild(msg);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:0.6rem;justify-content:flex-end;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.style.cssText = 'padding:0.4rem 0.9rem;font-size:0.82rem;background:#2d3748;color:#a0aec0;border:none;border-radius:0.375rem;cursor:pointer;';
        cancelBtn.onclick = () => { overlay.remove(); resolve(false); };

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Baixar mesmo assim';
        confirmBtn.style.cssText = 'padding:0.4rem 0.9rem;font-size:0.82rem;background:#7c2d12;color:#fed7aa;border:none;border-radius:0.375rem;cursor:pointer;font-weight:600;';
        confirmBtn.onclick = () => { overlay.remove(); resolve(true); };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(confirmBtn);
        dialog.appendChild(btnRow);

        overlay.appendChild(dialog);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
        document.body.appendChild(overlay);
        cancelBtn.focus();
    });
}

async function showDownloadPendingDialog(groupCount, gwCount) {
    return new Promise((resolve) => {
        const existing = document.getElementById('downloadPendingDialog');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'downloadPendingDialog';
        overlay.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            background:rgba(0,0,0,0.55);display:flex;align-items:center;
            justify-content:center;z-index:9999;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background:#1a1f2e;border:1px solid #2d3748;border-radius:0.75rem;
            padding:1.5rem;min-width:360px;max-width:90vw;
            box-shadow:0 8px 32px rgba(0,0,0,0.4);
        `;

        const title = document.createElement('h3');
        title.textContent = '⚠ Pendências encontradas';
        title.style.cssText = 'margin:0 0 0.75rem;font-size:1rem;color:#fbbf24;';
        dialog.appendChild(title);

        const lines = [];
        if (groupCount > 0) lines.push(`• ${groupCount} grupo${groupCount !== 1 ? 's' : ''} de paths com ações pendentes`);
        if (gwCount > 0) lines.push(`• ${gwCount} Gateway Response${gwCount !== 1 ? 's' : ''} ausentes ou divergentes`);

        const msg = document.createElement('p');
        msg.innerHTML = lines.join('<br>') + '<br><br>Deseja resolver antes de baixar?';
        msg.style.cssText = 'margin:0 0 1.25rem;font-size:0.875rem;color:#cbd5e0;line-height:1.6;';
        dialog.appendChild(msg);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:0.6rem;justify-content:flex-end;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.style.cssText = 'padding:0.4rem 0.9rem;font-size:0.82rem;background:#2d3748;color:#a0aec0;border:none;border-radius:0.375rem;cursor:pointer;';
        cancelBtn.onclick = () => { overlay.remove(); resolve(null); };

        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'Baixar assim mesmo';
        downloadBtn.style.cssText = 'padding:0.4rem 0.9rem;font-size:0.82rem;background:#2d3748;color:#e2e8f0;border:none;border-radius:0.375rem;cursor:pointer;';
        downloadBtn.onclick = () => { overlay.remove(); resolve(false); };

        const resolveBtn = document.createElement('button');
        resolveBtn.textContent = '⚡ Resolver e baixar';
        resolveBtn.style.cssText = 'padding:0.4rem 0.9rem;font-size:0.82rem;background:#1a3a2a;color:#6ee7b7;border:none;border-radius:0.375rem;cursor:pointer;font-weight:600;';
        resolveBtn.onclick = () => { overlay.remove(); resolve(true); };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(downloadBtn);
        btnRow.appendChild(resolveBtn);
        dialog.appendChild(btnRow);

        overlay.appendChild(dialog);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
        document.body.appendChild(overlay);
    });
}
