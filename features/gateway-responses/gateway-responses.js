// ─── Gateway Responses — lógica e renderização ───────────────────────────────

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

// Renderizar seção de Gateway Responses
async function resolveAllGatewayResponses() {
    const json = await dbGet('jsonConfigContent');
    if (!json) return;

    const fixedResponses = getFixedGatewayResponses();
    const currentResponses = json['x-amazon-apigateway-gateway-responses'] || {};

    const allKeys = Object.keys(fixedResponses);
    const divergentKeys = allKeys.filter(k => currentResponses[k] && JSON.stringify(currentResponses[k]) !== JSON.stringify(fixedResponses[k]));
    const absentKeys = allKeys.filter(k => !currentResponses[k]);

    if (divergentKeys.length === 0 && absentKeys.length === 0) return;

    if (!json['x-amazon-apigateway-gateway-responses']) {
        json['x-amazon-apigateway-gateway-responses'] = {};
    }

    [...divergentKeys, ...absentKeys].forEach(key => {
        json['x-amazon-apigateway-gateway-responses'][key] = fixedResponses[key];
    });

    await dbSet('jsonConfigContent', json);
    renderGatewayResponses();
    showMessage(`Gateway Responses resolvidos: ${divergentKeys.length} atualizados, ${absentKeys.length} adicionados.`, 'success');
}

async function renderGatewayResponses() {
    const gatewayResponsesCard = document.getElementById('gatewayResponsesCard');
    const gatewayResponsesList = document.getElementById('gatewayResponsesList');

    const jsonConfigContent = await dbGet('jsonConfigContent');
    if (!jsonConfigContent) {
        gatewayResponsesList.innerHTML = '';
        return;
    }

    gatewayResponsesList.innerHTML = '';

    const fixedResponses = getFixedGatewayResponses();
    const currentResponses = jsonConfigContent['x-amazon-apigateway-gateway-responses'] || {};

    const allTypes = Object.keys(fixedResponses);
    const extraTypes = Object.keys(currentResponses).filter(k => !fixedResponses[k]);
    const allKeys = [...new Set([...allTypes, ...extraTypes])];

    const presentKeys = allKeys.filter(k => currentResponses[k]);
    const absentKeys = allKeys.filter(k => !currentResponses[k]);

    // Detectar divergentes: presentes mas com conteúdo diferente do fixo
    const divergentKeys = presentKeys.filter(k => {
        if (!fixedResponses[k]) return false;
        return JSON.stringify(currentResponses[k]) !== JSON.stringify(fixedResponses[k]);
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
        okKeys.forEach(key => renderGatewayResponseItem(okGrid, key, 'ok', currentResponses, fixedResponses));
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
        divergentKeys.forEach(key => renderGatewayResponseItem(actionGrid, key, 'divergent', currentResponses, fixedResponses));
        absentKeys.forEach(key => renderGatewayResponseItem(actionGrid, key, 'absent', currentResponses, fixedResponses));
        actionPanel.appendChild(actionGrid);
        fragment.appendChild(actionPanel);
    }

    gatewayResponsesList.appendChild(fragment);
}

function renderGatewayResponseItem(container, key, state, currentResponses, fixedResponses) {
    const item = document.createElement('div');
    item.classList.add('group-paths-item');

    const name = document.createElement('span');
    name.classList.add('group-paths-name');
    name.textContent = key;
    item.appendChild(name);

    const meta = document.createElement('div');
    meta.classList.add('group-paths-meta');

    const statusCode = (currentResponses[key] || fixedResponses[key] || {}).statusCode;
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
    item.appendChild(meta);

    // Botões de ação
    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('group-actions');

    if (state === 'absent' && fixedResponses[key]) {
        const addBtn = document.createElement('button');
        addBtn.classList.add('group-action-btn', 'group-action-btn-add');
        addBtn.textContent = 'Adicionar';
        addBtn.addEventListener('click', async () => {
            const json = await dbGet('jsonConfigContent');
            if (!json['x-amazon-apigateway-gateway-responses']) {
                json['x-amazon-apigateway-gateway-responses'] = {};
            }
            json['x-amazon-apigateway-gateway-responses'][key] = fixedResponses[key];
            await dbSet('jsonConfigContent', json);
            renderGatewayResponses();
        });
        actionsDiv.appendChild(addBtn);
    }

    if (state === 'divergent' && fixedResponses[key]) {
        const updateBtn = document.createElement('button');
        updateBtn.classList.add('group-action-btn', 'group-action-btn-update');
        updateBtn.textContent = 'Atualizar';
        updateBtn.addEventListener('click', async () => {
            const json = await dbGet('jsonConfigContent');
            json['x-amazon-apigateway-gateway-responses'][key] = fixedResponses[key];
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

