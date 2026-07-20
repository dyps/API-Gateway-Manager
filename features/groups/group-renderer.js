// ─── Renderização dos grupos de paths (cards com badges e ações) ──────────

// Renderizar lista de grupos de paths
async function renderGroupPaths(groupPaths) {
    if (!groupPaths || Object.keys(groupPaths).length === 0) {
        document.getElementById('groupPathsList').innerHTML = '';
        return;
    }

    // Skeleton só faz sentido se o API Gateway está carregado (precisa comparar paths)
    const jsonConfigContent = await dbGet('jsonConfigContent');
    const hasApiGateway = !!(jsonConfigContent && jsonConfigContent.paths);

    if (hasApiGateway) {
        const groupCount = Object.keys(groupPaths).length;
        const skeletonFragment = document.createDocumentFragment();
        const skeletonPanel = document.createElement('div');
        skeletonPanel.classList.add('group-section-panel', 'skeleton-panel');
        const skeletonGrid = document.createElement('div');
        skeletonGrid.classList.add('group-section-grid');
        for (let i = 0; i < Math.min(groupCount, 12); i++) {
            const sk = document.createElement('div');
            sk.classList.add('group-paths-item', 'skeleton-card');
            sk.innerHTML = `<div class="sk-line sk-name"></div><div class="sk-line sk-meta"></div>`;
            skeletonGrid.appendChild(sk);
        }
        skeletonPanel.appendChild(skeletonGrid);
        skeletonFragment.appendChild(skeletonPanel);
        document.getElementById('groupPathsList').replaceChildren(skeletonFragment);
    }

    // Processar tudo fora do DOM
    let apiGatewayPaths = null;
    let syncedGroupPaths = groupPaths;
    try {
        if (jsonConfigContent && jsonConfigContent.paths) {
            apiGatewayPaths = jsonConfigContent.paths;

            let apiGwEnv = null;
            for (const env of await getFixedEnvironments()) {
                if (JSON.stringify(jsonConfigContent).includes(env.connectionId)) {
                    apiGwEnv = env;
                    break;
                }
            }

            let gpEnv = null;
            const gpStr = JSON.stringify(groupPaths);
            for (const env of await getFixedEnvironments()) {
                if (gpStr.includes(env.connectionId) || gpStr.includes(env.nlb)) {
                    gpEnv = env;
                    break;
                }
            }

            if (apiGwEnv && gpEnv && apiGwEnv.connectionId !== gpEnv.connectionId) {
                let replacedStr = gpStr;
                replacedStr = replacedStr.replaceAll(gpEnv.authorizerCredentials, apiGwEnv.authorizerCredentials);
                replacedStr = replacedStr.replaceAll(gpEnv.authorizerUri, apiGwEnv.authorizerUri);
                replacedStr = replacedStr.replaceAll(gpEnv.connectionId, apiGwEnv.connectionId);
                replacedStr = replacedStr.replaceAll(gpEnv.host, apiGwEnv.host);
                replacedStr = replacedStr.replaceAll(gpEnv.hostPortal, apiGwEnv.hostPortal);
                replacedStr = replacedStr.replaceAll(gpEnv.nlb, apiGwEnv.nlb);
                syncedGroupPaths = JSON.parse(replacedStr);
            }
        }
    } catch (err) {
        console.error('Erro ao buscar jsonConfigContent do IndexedDB:', err);
    }

    let defaultGroupNames = new Set();
    try {
        for (const env of await getFixedEnvironments()) {
            if (await isCurrentEnvironment(env)) {
                defaultGroupNames = new Set(env.defaultGroups || []);
                break;
            }
        }
    } catch (err) {
        console.error('Erro ao detectar ambiente ativo para defaultGroups:', err);
    }

    // Calcular metadados e ordenar
    const groups = Object.keys(syncedGroupPaths);
    const groupsWithMeta = groups.map(groupName => {
        const validationResult = apiGatewayPaths
            ? validateGroup(syncedGroupPaths[groupName], apiGatewayPaths)
            : null;
        const isDefault = defaultGroupNames.has(groupName);
        const status = validationResult?.status ?? 'none-found';
        const divergentPaths = validationResult?.divergentPaths ?? [];

        const hasAction = status === 'none-found'
            || status === 'partial'
            || (status === 'all-found' && divergentPaths.length > 0)
            || (!isDefault && status !== 'none-found' && apiGatewayPaths);

        let priority;
        if (isDefault && status === 'all-found' && divergentPaths.length === 0) priority = 0;
        else if (isDefault) priority = 1;
        else if (status === 'all-found' && divergentPaths.length === 0) priority = 2;
        else if (status === 'partial' || (status === 'all-found' && divergentPaths.length > 0)) priority = 3;
        else priority = 4;

        return { groupName, validationResult, isDefault, priority, hasAction };
    });

    groupsWithMeta.sort((a, b) => a.priority - b.priority);

    const okGroups = groupsWithMeta.filter(g => !g.hasAction);
    const actionGroups = groupsWithMeta.filter(g => g.hasAction);

    // Construir todo o novo DOM num fragmento fora da tela
    const finalFragment = document.createDocumentFragment();

    if (okGroups.length > 0) {
        const okPanel = document.createElement('details');
        okPanel.classList.add('group-section-panel');
        okPanel.id = 'group-panel-ok';
        const okSummary = document.createElement('summary');
        okSummary.classList.add('group-section-summary');
        okSummary.textContent = `✓ Grupos configurados (${okGroups.length})`;
        okPanel.appendChild(okSummary);
        const okGrid = document.createElement('div');
        okGrid.classList.add('group-section-grid');
        okGroups.forEach(({ groupName, validationResult, isDefault }) => {
            const pathCount = Object.keys(syncedGroupPaths[groupName]).length;
            renderGroupPathItem(okGrid, groupName, pathCount, validationResult, isDefault, syncedGroupPaths, apiGatewayPaths);
        });
        okPanel.appendChild(okGrid);
        finalFragment.appendChild(okPanel);
    }

    if (actionGroups.length > 0) {
        // Calcular se há ações reais (mesma regra do botão "Resolver tudo")
        const hasRealActions = apiGatewayPaths && actionGroups.some(({ validationResult, isDefault }) => {
            if (!validationResult) return false;
            const { status, divergentPaths } = validationResult;
            return (isDefault && status === 'none-found')
                || status === 'partial'
                || (status === 'all-found' && divergentPaths.length > 0)
                || (!isDefault && status !== 'none-found');
        });

        const actionPanel = document.createElement('details');
        actionPanel.classList.add('group-section-panel');
        actionPanel.id = 'group-panel-action';
        actionPanel.open = hasRealActions; // só abre se há pendências reais
        const actionSummary = document.createElement('summary');
        actionSummary.classList.add('group-section-summary', 'group-section-summary-action');
        actionSummary.textContent = `⚡ Grupos com ações disponíveis (${actionGroups.length})`;

        if (hasRealActions) {
            const resolveAllBtn = document.createElement('button');
            resolveAllBtn.classList.add('group-action-btn', 'group-action-btn-resolve-all');
            resolveAllBtn.textContent = '⚡ Resolver tudo';
            resolveAllBtn.title = 'Aplica todas as ações pendentes: adiciona, atualiza e remove grupos conforme necessário';
            resolveAllBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                try {
                    const jsonConfigContent = await dbGet('jsonConfigContent');
                    let updatedPaths = { ...jsonConfigContent.paths };

                    for (const { groupName, validationResult, isDefault } of actionGroups) {
                        if (!validationResult) continue;
                        const { status, divergentPaths } = validationResult;

                        if (status === 'none-found' && isDefault) {
                            updatedPaths = addGroupPaths(updatedPaths, syncedGroupPaths[groupName]);
                        } else if (status === 'partial' || (status === 'all-found' && divergentPaths.length > 0)) {
                            updatedPaths = updateGroupPaths(updatedPaths, syncedGroupPaths[groupName]);
                        } else if (!isDefault && status !== 'none-found') {
                            const groupPathKeys = Object.keys(syncedGroupPaths[groupName]);
                            groupPathKeys.forEach(p => delete updatedPaths[p]);
                        }
                    }

                    await dbSet('jsonConfigContent', { ...jsonConfigContent, paths: updatedPaths });
                    const gp = await dbGet('groupPathsContent');
                    await renderGroupPaths(gp);
                    // Fechar o painel de ações disponíveis
                    const actionPanel = document.getElementById('group-panel-action');
                    if (actionPanel) actionPanel.open = false;
                    await refreshPathsAndContent();
                    showMessage('Todas as pendências foram resolvidas', 'success');
                } catch (err) {
                    console.error('Erro ao resolver todas as pendências:', err);
                    showMessage('Erro ao resolver pendências', 'error');
                }
            });
            actionSummary.appendChild(resolveAllBtn);
            } // fim hasRealActions

        actionPanel.appendChild(actionSummary);
        const actionGrid = document.createElement('div');
        actionGrid.classList.add('group-section-grid');
        actionGroups.forEach(({ groupName, validationResult, isDefault }) => {
            const pathCount = Object.keys(syncedGroupPaths[groupName]).length;
            renderGroupPathItem(actionGrid, groupName, pathCount, validationResult, isDefault, syncedGroupPaths, apiGatewayPaths);
        });
        actionPanel.appendChild(actionGrid);
        finalFragment.appendChild(actionPanel);
    }

    const unmappedPaths = apiGatewayPaths
        ? getUnmappedPaths(syncedGroupPaths, apiGatewayPaths)
        : [];
    if (unmappedPaths.length > 0) {
        const panel = document.createElement('details');
        panel.id = 'unmapped-panel';
        const summary = document.createElement('summary');
        summary.classList.add('unmapped-panel-summary');
        summary.textContent = `${unmappedPaths.length} path${unmappedPaths.length !== 1 ? 's' : ''} não mapeado${unmappedPaths.length !== 1 ? 's' : ''}`;
        panel.appendChild(summary);
        const list = document.createElement('ul');
        list.classList.add('unmapped-panel-list');
        unmappedPaths.forEach(path => {
            const li = document.createElement('li');
            li.classList.add('unmapped-panel-item');
            const span = document.createElement('span');
            span.textContent = path;
            const removeBtn = document.createElement('button');
            removeBtn.classList.add('unmapped-remove-btn');
            removeBtn.textContent = '✕';
            removeBtn.title = 'Remover path';
            removeBtn.addEventListener('click', async (e) => { e.stopPropagation(); await removeUnmappedPath(path); });
            li.appendChild(removeBtn);
            li.appendChild(span);
            list.appendChild(li);
        });
        panel.appendChild(list);
        finalFragment.appendChild(panel);
    }

    // Swap atômico — um único repaint, sem piscar
    document.getElementById('groupPathsList').replaceChildren(finalFragment);
}

// Renderizar item de grupo com badge de status e lista expandível
function renderGroupPathItem(container, groupName, pathCount, validationResult, isDefault, groupPathsContent, currentJsonPaths) {
    const item = document.createElement('div');
    item.classList.add('group-paths-item');

    // Linha 1: nome do grupo
    const name = document.createElement('span');
    name.classList.add('group-paths-name');
    name.textContent = groupName;
    item.appendChild(name);

    // Linha 2: count + badge lado a lado
    const meta = document.createElement('div');
    meta.classList.add('group-paths-meta');

    const count = document.createElement('span');
    count.classList.add('group-paths-count');
    count.textContent = `${pathCount} path${pathCount !== 1 ? 's' : ''}`;
    meta.appendChild(count);

    // Badge padrão (antes do badge de status)
    if (isDefault) {
        const defaultBadge = document.createElement('span');
        defaultBadge.classList.add('group-status-badge', 'badge-default');
        defaultBadge.textContent = '★ padrão';
        meta.appendChild(defaultBadge);
    }

    if (validationResult) {
        const badge = document.createElement('span');
        badge.classList.add('group-status-badge');

        const { status, divergentPaths } = validationResult;

        if (status === 'all-found' && divergentPaths.length === 0) {
            badge.classList.add('badge-success');
            badge.textContent = '✓ Todos encontrados';
        } else if ((status === 'all-found' && divergentPaths.length > 0) || status === 'partial') {
            badge.classList.add('badge-warning');
            badge.textContent = status === 'partial' ? '⚠ Parcialmente encontrado' : '⚠ Config divergente';
        } else if (status === 'none-found') {
            badge.classList.add('badge-error');
            badge.textContent = '✕ Nenhum encontrado';
        }

        meta.appendChild(badge);
    }

    item.appendChild(meta);

    // Botões de ação (baseados no status de validação)
    if (validationResult) {
        const { status, divergentPaths } = validationResult;
        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('group-actions');

        if (status === 'none-found') {
            // Botão Adicionar
            const addBtn = document.createElement('button');
            addBtn.classList.add('group-action-btn', 'group-action-btn-add');
            addBtn.textContent = 'Adicionar';
            if (!currentJsonPaths) {
                addBtn.disabled = true;
                addBtn.title = 'Carregue um JSON do API Gateway para habilitar esta ação';
            } else {
                addBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        const jsonConfigContent = await dbGet('jsonConfigContent');
                        const updatedPaths = addGroupPaths(jsonConfigContent.paths, groupPathsContent[groupName]);
                        await dbSet('jsonConfigContent', { ...jsonConfigContent, paths: updatedPaths });
                        const gp = await dbGet('groupPathsContent');
                        await renderGroupPaths(gp);
                        await refreshPathsAndContent();
                    } catch (err) {
                        console.error('Erro ao adicionar grupo:', err);
                        showMessage('Erro ao adicionar grupo', 'error');
                    }
                });
            }
            actionsDiv.appendChild(addBtn);
        } else {
            // Botão Atualizar (quando partial ou all-found com divergências)
            if (status === 'partial' || (status === 'all-found' && divergentPaths.length > 0)) {
                const updateBtn = document.createElement('button');
                updateBtn.classList.add('group-action-btn', 'group-action-btn-update');
                updateBtn.textContent = 'Atualizar';
                if (!currentJsonPaths) {
                    updateBtn.disabled = true;
                    updateBtn.title = 'Carregue um JSON do API Gateway para habilitar esta ação';
                } else {
                    updateBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        try {
                            const jsonConfigContent = await dbGet('jsonConfigContent');
                            const updatedPaths = updateGroupPaths(jsonConfigContent.paths, groupPathsContent[groupName]);
                            await dbSet('jsonConfigContent', { ...jsonConfigContent, paths: updatedPaths });
                            const gp = await dbGet('groupPathsContent');
                            await renderGroupPaths(gp);
                            await refreshPathsAndContent();
                        } catch (err) {
                            console.error('Erro ao atualizar grupo:', err);
                            showMessage('Erro ao atualizar grupo', 'error');
                        }
                    });
                }
                actionsDiv.appendChild(updateBtn);
            }

            // Botão Remover — apenas para grupos encontrados que não são padrão
            // Remove os paths do grupo do JSON do API Gateway (jsonConfigContent), não do groupPaths
            if (!isDefault && currentJsonPaths) {
                const removeBtn = document.createElement('button');
                removeBtn.classList.add('group-action-btn', 'group-action-btn-remove');
                removeBtn.textContent = 'Remover';
                removeBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        const jsonConfigContent = await dbGet('jsonConfigContent');
                        const groupPathKeys = Object.keys(groupPathsContent[groupName]);
                        const updatedPaths = { ...jsonConfigContent.paths };
                        groupPathKeys.forEach(p => delete updatedPaths[p]);
                        await dbSet('jsonConfigContent', { ...jsonConfigContent, paths: updatedPaths });
                        const gp = await dbGet('groupPathsContent');
                        await renderGroupPaths(gp);
                        await refreshPathsAndContent();
                    } catch (err) {
                        console.error('Erro ao remover grupo do JSON:', err);
                        showMessage('Erro ao remover grupo do JSON', 'error');
                    }
                });
                actionsDiv.appendChild(removeBtn);
            }
        }

        if (actionsDiv.children.length > 0) {
            item.appendChild(actionsDiv);
        }
    }

    // Linha 3: lista expandível de paths ausentes/divergentes (se houver)
    if (validationResult) {
        const { missingPaths, divergentPaths } = validationResult;
        if (missingPaths.length > 0 || divergentPaths.length > 0) {
            const details = document.createElement('div');
            details.classList.add('group-paths-details', 'hidden');

            if (missingPaths.length > 0) {
                const missingSection = document.createElement('div');
                const missingTitle = document.createElement('strong');
                missingTitle.textContent = 'Paths ausentes:';
                missingSection.appendChild(missingTitle);
                const missingList = document.createElement('ul');
                missingPaths.forEach(p => {
                    const li = document.createElement('li');
                    li.textContent = p;
                    missingList.appendChild(li);
                });
                missingSection.appendChild(missingList);
                details.appendChild(missingSection);
            }

            if (divergentPaths.length > 0) {
                const divergentSection = document.createElement('div');
                const divergentTitle = document.createElement('strong');
                divergentTitle.textContent = 'Paths divergentes:';
                divergentSection.appendChild(divergentTitle);
                const divergentList = document.createElement('ul');
                divergentPaths.forEach(p => {
                    const li = document.createElement('li');
                    li.textContent = p;
                    divergentList.appendChild(li);
                });
                divergentSection.appendChild(divergentList);
                details.appendChild(divergentSection);
            }

            item.appendChild(details);
            item.classList.add('has-details');
            item.addEventListener('click', () => {
                details.classList.toggle('hidden');
            });
        }
    }

    container.appendChild(item);
}

