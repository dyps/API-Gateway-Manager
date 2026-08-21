// ─── Gateway Responses — lógica e renderização ───────────────────────────────

// ─── Valores padrão (fallback) ───────────────────────────────────────────────
function getFixedGatewayResponses() {
    return {
        "ACCESS_DENIED": {
            "statusCode": 401,
            "responseTemplates": {
                "application/json": "{\n  \"timestamp\": \"$context.authorizer.timestamp\",\n  \"status\": $context.authorizer.status,\n  \"error\": \"$context.authorizer.error\",\n  \"message\": \"$context.authorizer.message\",\n  \"path\": \"$context.authorizer.path\"\n}"
            }
        },
        "MISSING_AUTHENTICATION_TOKEN": {
            "statusCode": 404,
            "responseTemplates": {
                "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 404,\n  \"error\": \"Not Found\",\n  \"path\": \"$context.path\"\n}"
            }
        },
        "INTEGRATION_TIMEOUT": {
            "statusCode": 504,
            "responseTemplates": {
                "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 504,\n  \"error\": \"Gateway Timeout\",\n  \"path\": \"$context.path\"\n}"
            }
        },
        "UNAUTHORIZED": {
            "statusCode": 401,
            "responseTemplates": {
                "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 401,\n  \"error\": $context.error.messageString,\n  \"message\": \"Access denied\",\n  \"path\": \"$context.path\"\n}"
            }
        },
        "DEFAULT_4XX": {
            "statusCode": 404,
            "responseTemplates": {
                "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 404,\n  \"error\": \"Not Found\",\n  \"path\": \"$context.path\"\n}"
            }
        },
        "INTEGRATION_FAILURE": {
            "statusCode": 503,
            "responseTemplates": {
                "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 503,\n  \"error\": \"SERVICE_UNAVAILABLE\",\n  \"message\": \"The requested service is temporarily unavailable. Please try again in a few moments.\",\n  \"path\": \"$context.path\"\n}"
            }
        },
        "AUTHORIZER_FAILURE": {
            "statusCode": 503,
            "responseTemplates": {
                "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 503,\n  \"error\": \"Internal server error - Lambda Authorizer\",\n  \"path\": \"$context.path\"\n}"
            }
        }
    };
}

// ─── Effective responses: custom sobrescreve fixed ───────────────────────────
async function getEffectiveGatewayResponses() {
    const fixed = getFixedGatewayResponses();
    const custom = await dbGet('customGatewayResponses');
    if (!custom) return fixed;
    // Merge: custom keys sobrescrevem fixed, custom keys extras são adicionadas
    // Keys com valor null foram removidas pelo usuário
    const merged = { ...fixed, ...custom };
    const result = {};
    for (const [k, v] of Object.entries(merged)) {
        if (v !== null) result[k] = v;
    }
    return result;
}

// ─── Resolver tudo usando effective ──────────────────────────────────────────
async function resolveAllGatewayResponses() {
    const json = await dbGet('jsonConfigContent');
    if (!json) return;

    const effectiveResponses = await getEffectiveGatewayResponses();
    const currentResponses = json['x-amazon-apigateway-gateway-responses'] || {};

    const allKeys = Object.keys(effectiveResponses);
    const divergentKeys = allKeys.filter(k => currentResponses[k] && JSON.stringify(currentResponses[k]) !== JSON.stringify(effectiveResponses[k]));
    const absentKeys = allKeys.filter(k => !currentResponses[k]);

    if (divergentKeys.length === 0 && absentKeys.length === 0) return;

    if (!json['x-amazon-apigateway-gateway-responses']) {
        json['x-amazon-apigateway-gateway-responses'] = {};
    }

    [...divergentKeys, ...absentKeys].forEach(key => {
        json['x-amazon-apigateway-gateway-responses'][key] = effectiveResponses[key];
    });

    await dbSet('jsonConfigContent', json);
    renderGatewayResponses();
    showMessage(`Gateway Responses resolvidos: ${divergentKeys.length} atualizados, ${absentKeys.length} adicionados.`, 'success');
}

// ─── Inicializar botão da engrenagem ─────────────────────────────────────────
function initGatewayResponsesEditBtn() {
    const btn = document.getElementById('gwResponsesEditBtn');
    if (btn) {
        btn.addEventListener('click', () => openGatewayResponsesEditor());
        // Hover style via JS (segue padrão #compareBtn)
        btn.addEventListener('mouseenter', () => {
            btn.style.color = document.body.classList.contains('dark') ? '#818cf8' : '#6366f1';
            btn.style.transform = 'scale(1.15)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.color = document.body.classList.contains('dark') ? '#94a3b8' : '#4a5568';
            btn.style.transform = '';
        });
    }
}

// ─── Renderização principal ──────────────────────────────────────────────────
async function renderGatewayResponses() {
    const gatewayResponsesList = document.getElementById('gatewayResponsesList');

    const jsonConfigContent = await dbGet('jsonConfigContent');
    if (!jsonConfigContent) {
        gatewayResponsesList.innerHTML = '';
        return;
    }

    gatewayResponsesList.innerHTML = '';

    // Cache para exibir badges "custom" no render
    window._cachedCustomGwResponses = await dbGet('customGatewayResponses') || {};

    const effectiveResponses = await getEffectiveGatewayResponses();
    const currentResponses = jsonConfigContent['x-amazon-apigateway-gateway-responses'] || {};

    const allKeys = [...new Set([...Object.keys(effectiveResponses), ...Object.keys(currentResponses)])];

    const presentKeys = allKeys.filter(k => currentResponses[k]);
    const absentKeys = allKeys.filter(k => !currentResponses[k]);

    const divergentKeys = presentKeys.filter(k => {
        if (!effectiveResponses[k]) return false;
        return JSON.stringify(currentResponses[k]) !== JSON.stringify(effectiveResponses[k]);
    });

    const okKeys = presentKeys.filter(k => !divergentKeys.includes(k));

    const fragment = document.createDocumentFragment();

    // Painel: configurados corretamente
    if (okKeys.length > 0) {
        const okPanel = document.createElement('details');
        okPanel.classList.add('group-section-panel');
        const okSummary = document.createElement('summary');
        okSummary.classList.add('group-section-summary');
        okSummary.textContent = `✓ Responses configurados (${okKeys.length})`;
        okPanel.appendChild(okSummary);
        const okGrid = document.createElement('div');
        okGrid.classList.add('group-section-grid');
        okKeys.forEach(key => renderGatewayResponseItem(okGrid, key, 'ok', currentResponses, effectiveResponses));
        okPanel.appendChild(okGrid);
        fragment.appendChild(okPanel);
    }

    // Painel: divergentes e ausentes (ações disponíveis)
    const actionKeys = [...divergentKeys, ...absentKeys];
    if (actionKeys.length > 0) {
        const actionPanel = document.createElement('details');
        actionPanel.classList.add('group-section-panel');
        actionPanel.open = true;
        const actionSummary = document.createElement('summary');
        actionSummary.classList.add('group-section-summary', 'group-section-summary-action');
        actionSummary.textContent = `⚡ Responses com ações disponíveis (${actionKeys.length})`;

        const resolveAllBtn = document.createElement('button');
        resolveAllBtn.classList.add('group-action-btn', 'group-action-btn-resolve-all');
        resolveAllBtn.textContent = '⚡ Resolver tudo';
        resolveAllBtn.title = 'Adiciona responses ausentes e corrige os divergentes';
        resolveAllBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            await resolveAllGatewayResponses();
        });
        actionSummary.appendChild(resolveAllBtn);

        actionPanel.appendChild(actionSummary);
        const actionGrid = document.createElement('div');
        actionGrid.classList.add('group-section-grid');
        divergentKeys.forEach(key => renderGatewayResponseItem(actionGrid, key, 'divergent', currentResponses, effectiveResponses));
        absentKeys.forEach(key => renderGatewayResponseItem(actionGrid, key, 'absent', currentResponses, effectiveResponses));
        actionPanel.appendChild(actionGrid);
        fragment.appendChild(actionPanel);
    }

    gatewayResponsesList.appendChild(fragment);
}

function renderGatewayResponseItem(container, key, state, currentResponses, effectiveResponses) {
    const item = document.createElement('div');
    item.classList.add('group-paths-item');

    const name = document.createElement('span');
    name.classList.add('group-paths-name');
    name.textContent = key;
    item.appendChild(name);

    const meta = document.createElement('div');
    meta.classList.add('group-paths-meta');

    const statusCode = (currentResponses[key] || effectiveResponses[key] || {}).statusCode;
    if (statusCode) {
        const sc = document.createElement('span');
        sc.classList.add('group-paths-count');
        sc.textContent = `HTTP ${statusCode}`;
        meta.appendChild(sc);
    }

    const badge = document.createElement('span');
    badge.classList.add('group-status-badge');
    if (state === 'ok') {
        badge.classList.add('badge-success');
        badge.textContent = '✓ Configurado';
    } else if (state === 'divergent') {
        badge.classList.add('badge-warning');
        badge.textContent = '⚠ Config divergente';
    } else {
        badge.classList.add('badge-error');
        badge.textContent = '✕ Ausente';
    }
    meta.appendChild(badge);

    // Badge "customizado" se há override
    const custom = window._cachedCustomGwResponses;
    if (custom && custom[key]) {
        const customBadge = document.createElement('span');
        customBadge.classList.add('group-status-badge', 'badge-default');
        customBadge.textContent = '⚙ Custom';
        meta.appendChild(customBadge);
    }

    item.appendChild(meta);

    // Botões de ação
    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('group-actions');

    if (state === 'absent' && effectiveResponses[key]) {
        const addBtn = document.createElement('button');
        addBtn.classList.add('group-action-btn', 'group-action-btn-add');
        addBtn.textContent = 'Adicionar';
        addBtn.addEventListener('click', async () => {
            const json = await dbGet('jsonConfigContent');
            if (!json['x-amazon-apigateway-gateway-responses']) {
                json['x-amazon-apigateway-gateway-responses'] = {};
            }
            json['x-amazon-apigateway-gateway-responses'][key] = effectiveResponses[key];
            await dbSet('jsonConfigContent', json);
            renderGatewayResponses();
        });
        actionsDiv.appendChild(addBtn);
    }

    if (state === 'divergent' && effectiveResponses[key]) {
        const updateBtn = document.createElement('button');
        updateBtn.classList.add('group-action-btn', 'group-action-btn-update');
        updateBtn.textContent = 'Atualizar';
        updateBtn.addEventListener('click', async () => {
            const json = await dbGet('jsonConfigContent');
            json['x-amazon-apigateway-gateway-responses'][key] = effectiveResponses[key];
            await dbSet('jsonConfigContent', json);
            renderGatewayResponses();
        });
        actionsDiv.appendChild(updateBtn);
    }

    if (state !== 'absent') {
        const removeBtn = document.createElement('button');
        removeBtn.classList.add('group-action-btn', 'group-action-btn-remove');
        removeBtn.textContent = 'Remover';
        removeBtn.addEventListener('click', async () => {
            const json = await dbGet('jsonConfigContent');
            if (json['x-amazon-apigateway-gateway-responses']) {
                delete json['x-amazon-apigateway-gateway-responses'][key];
                if (Object.keys(json['x-amazon-apigateway-gateway-responses']).length === 0) {
                    delete json['x-amazon-apigateway-gateway-responses'];
                }
            }
            await dbSet('jsonConfigContent', json);
            renderGatewayResponses();
        });
        actionsDiv.appendChild(removeBtn);
    }

    if (actionsDiv.children.length > 0) {
        item.appendChild(actionsDiv);
    }

    container.appendChild(item);
}

// ─── Editor de Gateway Responses (modal dinâmico) ────────────────────────────

async function openGatewayResponsesEditor() {
    const fixed = getFixedGatewayResponses();
    const custom = await dbGet('customGatewayResponses') || {};
    window._cachedCustomGwResponses = custom;

    const allKeys = [...new Set([...Object.keys(fixed), ...Object.keys(custom)])];

    // Filtrar keys removidas (valor null no custom = foi excluído pelo usuário)
    const visibleKeys = allKeys.filter(key => {
        if (custom[key] === null) return false; // Removido
        return true;
    });

    // Remover modal anterior se existir
    const existing = document.getElementById('gwResponsesEditorOverlay');
    if (existing) existing.remove();

    const isDark = document.body.classList.contains('dark');

    // Bloquear scroll do body
    document.body.style.overflow = 'hidden';

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'gwResponsesEditorOverlay';
    overlay.classList.add('modal-overlay');

    function closeEditor() {
        overlay.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', escHandler);
        renderGatewayResponses();
    }

    function escHandler(e) {
        if (e.key === 'Escape') closeEditor();
    }
    document.addEventListener('keydown', escHandler);

    // Modal box
    const modal = document.createElement('div');
    modal.classList.add('modal-box');
    modal.style.cssText = 'max-width:900px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-shrink:0;';

    const title = document.createElement('h3');
    title.textContent = 'Editor de Gateway Responses';
    title.style.margin = '0';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.classList.add('modal-close-btn');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', closeEditor);
    header.appendChild(closeBtn);

    modal.appendChild(header);

    // Descrição
    const desc = document.createElement('p');
    desc.style.cssText = `font-size:0.82rem;color:${isDark ? '#94a3b8' : '#718096'};margin-bottom:0.75rem;flex-shrink:0;`;
    desc.textContent = 'Edite os templates de cada response ou adicione novos. Valores customizados sobrescrevem os padrões de fábrica.';
    modal.appendChild(desc);

    // Toolbar: Restaurar tudo ao padrão
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.75rem;flex-shrink:0;flex-wrap:wrap;align-items:center;';

    const resetAllBtn = document.createElement('button');
    resetAllBtn.classList.add('group-action-btn', 'group-action-btn-remove');
    resetAllBtn.textContent = '↺ Restaurar tudo ao padrão';
    resetAllBtn.style.cssText = 'font-size:0.75rem;padding:0.35rem 0.8rem;';
    resetAllBtn.title = 'Remove todas as customizações e volta aos valores de fábrica';
    resetAllBtn.addEventListener('click', async () => {
        await dbSet('customGatewayResponses', {});
        window._cachedCustomGwResponses = {};
        closeEditor();
        showMessage('Todos os Gateway Responses restaurados ao padrão de fábrica.', 'success');
    });
    toolbar.appendChild(resetAllBtn);

    const addNewBtn = document.createElement('button');
    addNewBtn.classList.add('group-action-btn', 'group-action-btn-add');
    addNewBtn.textContent = '+ Novo Response Type';
    addNewBtn.style.cssText = 'font-size:0.75rem;padding:0.35rem 0.8rem;';
    addNewBtn.addEventListener('click', () => {
        const newItem = createEditorItem('', { statusCode: 200, responseTemplates: { 'application/json': '' } }, true, false, true);
        itemsContainer.appendChild(newItem);
        newItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Abrir o details do novo item
        const details = newItem.querySelector('details');
        if (details) details.open = true;
        const keyInput = newItem.querySelector('.gw-editor-key-input');
        if (keyInput) keyInput.focus();
    });
    toolbar.appendChild(addNewBtn);

    modal.appendChild(toolbar);

    // Corpo scrollável
    const body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow-y:auto;padding-right:0.5rem;';

    // Container dos items
    const itemsContainer = document.createElement('div');
    itemsContainer.id = 'gwEditorItems';
    itemsContainer.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem;';

    visibleKeys.sort().forEach(key => {
        const isCustom = !!custom[key];
        const isFixed = !!fixed[key];
        const data = custom[key] || fixed[key];
        itemsContainer.appendChild(createEditorItem(key, data, isCustom, isFixed));
    });

    body.appendChild(itemsContainer);
    modal.appendChild(body);

    // Footer: salvar
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:0.6rem;margin-top:1rem;flex-shrink:0;justify-content:flex-end;';

    const saveBtn = document.createElement('button');
    saveBtn.style.cssText = `font-size:0.82rem;padding:0.45rem 1.4rem;background:${isDark ? '#1a3a2a' : '#ecfdf5'};color:${isDark ? '#6ee7b7' : '#047857'};border:1px solid ${isDark ? '#065f46' : '#6ee7b7'};border-radius:0.375rem;font-weight:600;cursor:pointer;`;
    saveBtn.textContent = '💾 Salvar';
    saveBtn.addEventListener('click', async () => {
        const result = collectEditorData(itemsContainer);
        if (result.error) {
            showMessage(result.error, 'error');
            return;
        }
        await dbSet('customGatewayResponses', result.data);
        window._cachedCustomGwResponses = result.data;
        document.body.style.overflow = '';
        document.removeEventListener('keydown', escHandler);
        overlay.remove();
        renderGatewayResponses();
        showMessage('Templates de Gateway Responses salvos.', 'success');
    });
    footer.appendChild(saveBtn);

    modal.appendChild(footer);
    overlay.appendChild(modal);

    // Fechar ao clicar fora
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeEditor();
    });

    document.body.appendChild(overlay);
}

function createEditorItem(key, data, isCustom, isFixed, isNew = false) {
    const isDark = document.body.classList.contains('dark');

    const item = document.createElement('div');
    item.classList.add('gw-editor-item');
    item.style.cssText = `
        border: 1px solid ${isDark ? '#3a4459' : '#e2e8f0'};
        border-radius: 0.5rem;
        background: ${isDark ? '#252c3b' : '#f8fafc'};
        transition: border-color 0.2s;
        overflow: hidden;
    `;
    item.dataset.originalKey = key;
    item.dataset.isFixed = isFixed ? '1' : '0';

    // Wrap no <details> para colapsar
    const details = document.createElement('details');
    details.style.cssText = 'margin:0;';
    if (isNew) details.open = true; // Novos abrem expandidos

    // Summary: key name + statusCode + badges (clickável para expandir)
    const summary = document.createElement('summary');
    summary.style.cssText = `
        display:flex;align-items:center;gap:0.5rem;padding:0.6rem 0.75rem;cursor:pointer;
        user-select:none;list-style:none;flex-wrap:wrap;
    `;
    summary.classList.add('gw-editor-summary');

    // Nome do response type (exibição no summary)
    const nameSpan = document.createElement('span');
    nameSpan.classList.add('gw-editor-name-display');
    nameSpan.style.cssText = `font-size:0.82rem;font-weight:700;color:${isDark ? '#a0c4ff' : '#1e40af'};font-family:monospace;`;
    nameSpan.textContent = key || '(novo)';
    summary.appendChild(nameSpan);

    // Status code display
    const scSpan = document.createElement('span');
    scSpan.style.cssText = `font-size:0.68rem;color:${isDark ? '#94a3b8' : '#718096'};`;
    scSpan.textContent = `HTTP ${data.statusCode || 200}`;
    summary.appendChild(scSpan);

    // Badges
    if (isCustom && isFixed) {
        const badge = document.createElement('span');
        badge.classList.add('group-status-badge', 'badge-default');
        badge.textContent = '⚙ Customizado';
        badge.style.fontSize = '0.62rem';
        summary.appendChild(badge);
    } else if (isCustom && !isFixed) {
        const badge = document.createElement('span');
        badge.classList.add('group-status-badge', 'badge-default');
        badge.textContent = '+ Custom';
        badge.style.fontSize = '0.62rem';
        summary.appendChild(badge);
    }

    // Botão remover (funciona pra todos — fixos e custom)
    const removeBtn = document.createElement('button');
    removeBtn.classList.add('group-action-btn', 'group-action-btn-remove');
    removeBtn.textContent = '✕';
    removeBtn.style.cssText = 'font-size:0.68rem;margin-left:auto;padding:0.15rem 0.4rem;';
    removeBtn.title = 'Remover este response type';
    removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        item.remove();
    });
    summary.appendChild(removeBtn);

    details.appendChild(summary);

    // Conteúdo expandido
    const content = document.createElement('div');
    content.style.cssText = 'padding:0.5rem 0.75rem 0.75rem;';

    // Row: key input + statusCode input
    const row1 = document.createElement('div');
    row1.style.cssText = 'display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;';

    // Label key
    const keyLabel = document.createElement('span');
    keyLabel.style.cssText = `font-size:0.7rem;color:${isDark ? '#64748b' : '#a0aec0'};`;
    keyLabel.textContent = 'Type:';
    row1.appendChild(keyLabel);

    // Key input (editável para todos)
    const keyInput = document.createElement('input');
    keyInput.classList.add('gw-editor-key-input');
    keyInput.type = 'text';
    keyInput.value = key;
    keyInput.placeholder = 'RESPONSE_TYPE (ex: DEFAULT_5XX)';
    keyInput.style.cssText = `
        font-size:0.82rem;font-weight:700;padding:0.3rem 0.5rem;border:1px solid ${isDark ? '#3a4459' : '#e2e8f0'};
        border-radius:0.3rem;background:${isDark ? '#1e2330' : '#fff'};color:${isDark ? '#e2e8f0' : '#1a202c'};
        flex:1;min-width:150px;outline:none;font-family:monospace;
    `;
    // Atualizar o nome no summary ao mudar
    keyInput.addEventListener('input', () => {
        nameSpan.textContent = keyInput.value.trim() || '(novo)';
    });
    row1.appendChild(keyInput);

    // Status code
    const scInputLabel = document.createElement('span');
    scInputLabel.style.cssText = `font-size:0.7rem;color:${isDark ? '#64748b' : '#a0aec0'};`;
    scInputLabel.textContent = 'HTTP:';
    row1.appendChild(scInputLabel);

    const scInput = document.createElement('input');
    scInput.classList.add('gw-editor-sc-input');
    scInput.type = 'number';
    scInput.min = '100';
    scInput.max = '599';
    scInput.value = data.statusCode || 200;
    scInput.style.cssText = `
        font-size:0.82rem;padding:0.3rem 0.4rem;border:1px solid ${isDark ? '#3a4459' : '#e2e8f0'};
        border-radius:0.3rem;background:${isDark ? '#1e2330' : '#fff'};color:${isDark ? '#e2e8f0' : '#1a202c'};
        width:65px;outline:none;text-align:center;
    `;
    // Atualizar display no summary
    scInput.addEventListener('input', () => {
        scSpan.textContent = `HTTP ${scInput.value || '?'}`;
    });
    row1.appendChild(scInput);

    // Botão restaurar padrão individual (se é um fixed que foi customizado)
    if (isCustom && isFixed) {
        const resetBtn = document.createElement('button');
        resetBtn.classList.add('group-action-btn', 'group-action-btn-update');
        resetBtn.textContent = '↺ Padrão';
        resetBtn.style.fontSize = '0.68rem';
        resetBtn.title = 'Restaurar ao valor de fábrica';
        resetBtn.addEventListener('click', () => {
            const fixedData = getFixedGatewayResponses()[key];
            if (fixedData) {
                scInput.value = fixedData.statusCode;
                scSpan.textContent = `HTTP ${fixedData.statusCode}`;
                textarea.value = fixedData.responseTemplates?.['application/json'] || '';
                item.dataset.resetToDefault = '1';
                showMessage(`"${key}" restaurado ao padrão (salve para confirmar).`, 'success');
            }
        });
        row1.appendChild(resetBtn);
    }

    content.appendChild(row1);

    // Textarea do template
    const templateLabel = document.createElement('label');
    templateLabel.style.cssText = `font-size:0.7rem;color:${isDark ? '#64748b' : '#a0aec0'};margin-bottom:0.2rem;display:block;`;
    templateLabel.textContent = 'Response Template (application/json):';
    content.appendChild(templateLabel);

    const textarea = document.createElement('textarea');
    textarea.classList.add('gw-editor-template-input');
    textarea.value = data.responseTemplates?.['application/json'] || '';
    textarea.rows = 6;
    textarea.spellcheck = false;
    textarea.style.cssText = `
        width:100%;font-size:0.78rem;padding:0.5rem;border:1px solid ${isDark ? '#3a4459' : '#e2e8f0'};
        border-radius:0.3rem;background:${isDark ? '#1e2330' : '#fff'};color:${isDark ? '#e2e8f0' : '#1a202c'};
        font-family:'Monaco','Menlo','Ubuntu Mono',monospace;line-height:1.5;resize:vertical;
        outline:none;tab-size:2;
    `;
    content.appendChild(textarea);

    details.appendChild(content);
    item.appendChild(details);

    return item;
}

function collectEditorData(container) {
    const items = container.querySelectorAll('.gw-editor-item');
    const fixed = getFixedGatewayResponses();
    const result = {};
    const seenKeys = new Set();

    for (const item of items) {
        const keyInput = item.querySelector('.gw-editor-key-input');
        const scInput = item.querySelector('.gw-editor-sc-input');
        const textarea = item.querySelector('.gw-editor-template-input');

        const key = keyInput.value.trim().toUpperCase();
        if (!key) {
            return { error: 'Todos os response types precisam ter um nome.' };
        }
        if (seenKeys.has(key)) {
            return { error: `Response type "${key}" está duplicado.` };
        }
        seenKeys.add(key);

        const statusCode = parseInt(scInput.value, 10);
        if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
            return { error: `Status code inválido para "${key}".` };
        }

        const template = textarea.value;

        // Se marcou "restaurar padrão", não salva como custom
        if (item.dataset.resetToDefault === '1') continue;

        // Se é um fixed e os valores são iguais ao padrão, não salva como custom
        const isFixed = item.dataset.isFixed === '1';
        if (isFixed && fixed[key]) {
            const fixedSc = fixed[key].statusCode;
            const fixedTemplate = fixed[key].responseTemplates?.['application/json'] || '';
            if (statusCode === fixedSc && template === fixedTemplate) {
                continue; // Sem mudança, não precisa de custom
            }
        }

        // Salvar no custom
        result[key] = {
            statusCode,
            responseTemplates: {
                'application/json': template
            }
        };
    }

    // Marcar fixed keys que foram removidas (não estão no editor) como null
    for (const fixedKey of Object.keys(fixed)) {
        if (!seenKeys.has(fixedKey)) {
            result[fixedKey] = null; // Sinaliza remoção
        }
    }

    return { data: result };
}
