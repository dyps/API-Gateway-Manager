// ─── Handlers de limpeza (clear) ──────────────────────────────────────────────

async function handleClearEnvironments() {
    try {
        const currentJson = await dbGet('jsonConfigContent');
        if (currentJson?._isSkeleton) {
            await dbDelete('jsonConfigContent');
            // Limpar campos do ambiente que foram salvos com o skeleton
            await dbDelete('envName');
            await dbDelete('host');
            await dbDelete('nlb');
            await dbDelete('connectionId');
            await dbDelete('authorizerUri');
            await dbDelete('authorizerCredentials');
            await dbDelete('hostPortal');

            document.getElementById('clearBtn').classList.add('hidden');
            document.getElementById('fileInput').value = '';
            document.getElementById('fileInputName').textContent = 'Nenhum arquivo';
            markDropZoneHasFile('dropZoneConfig', null);
            document.getElementById('contentCard').classList.add('hidden');
            document.getElementById('pathsApiGatewayCard').classList.add('hidden');
            document.getElementById('topologyCard').classList.add('hidden');
            document.getElementById('gatewayResponsesCard').classList.add('hidden');

            // Recalcular authorizerNames sem o skeleton
            const groupPaths = await dbGet('groupPathsContent');
            if (groupPaths) {
                const authNames = extractAuthorizerNamesFromGroupPaths(groupPaths);
                window._authorizerNames = authNames;
                await dbSet('authorizerNames', authNames);
            } else {
                window._authorizerNames = [];
                await dbDelete('authorizerNames');
            }
        }
        await dbDelete('environmentsContent');
        _cachedEnvironments = null;
    } catch (error) {
        console.error('Erro ao limpar ambientes:', error);
        showMessage('Erro ao limpar ambientes', 'error');
        return;
    }

    document.getElementById('clearEnvironmentsBtn').classList.add('hidden');
    document.getElementById('fileInputEnvironments').value = '';
    document.getElementById('fileInputEnvironmentsName').textContent = 'Nenhum arquivo';
    markDropZoneHasFile('dropZoneEnvironments', null);
    showMessage('Ambientes limpos com sucesso!', 'success');

    await loadSavedConfig();
}

async function handleClearConfig() {
    const groupPaths = await dbGet('groupPathsContent');
    const environmentsData = await dbGet('environmentsContent');

    try {
        await dbClear();
        if (groupPaths) {
            await dbSet('groupPathsContent', groupPaths);
            // Recalcular authorizerNames do groupPaths que sobrou
            const authNames = extractAuthorizerNamesFromGroupPaths(groupPaths);
            window._authorizerNames = authNames;
            await dbSet('authorizerNames', authNames);
        } else {
            window._authorizerNames = [];
        }
        if (environmentsData) {
            await dbSet('environmentsContent', environmentsData);
            _cachedEnvironments = environmentsData;
        } else {
            _cachedEnvironments = null;
        }
    } catch (error) {
        console.error('Erro ao limpar configuração:', error);
        showMessage('Erro ao limpar configuração', 'error');
        return;
    }

    document.getElementById('contentCard').classList.add('hidden');
    document.getElementById('clearBtn').classList.add('hidden');
    document.getElementById('configsApiGatewayCard').classList.add('hidden');
    document.getElementById('pathsApiGatewayCard').classList.add('hidden');
    document.getElementById('topologyCard').classList.add('hidden');
    document.getElementById('gatewayResponsesCard').classList.add('hidden');

    document.getElementById('fileInput').value = '';
    document.getElementById('fileInputName').textContent = 'Nenhum arquivo';
    markDropZoneHasFile('dropZoneConfig', null);

    if (environmentsData) {
        document.getElementById('configsApiGatewayCard').classList.remove('hidden');
        await renderConfigPanel();
        if (groupPaths) {
            document.getElementById('clearGroupPathsBtn').classList.remove('hidden');
            const gpName = document.getElementById('fileInputGroupPathsName');
            if (gpName.textContent === 'Nenhum arquivo') {
                gpName.textContent = 'JSON carregado';
            }
            renderGroupPaths(groupPaths);
        }
    } else if (groupPaths) {
        document.getElementById('configsApiGatewayCard').classList.add('hidden');
        document.getElementById('clearGroupPathsBtn').classList.remove('hidden');
        const gpName = document.getElementById('fileInputGroupPathsName');
        if (gpName.textContent === 'Nenhum arquivo') {
            gpName.textContent = 'JSON carregado';
        }
        renderGroupPaths(groupPaths);
    }

    showMessage('Configuração limpa com sucesso!', 'success');
}

async function handleClearGroupPaths() {
    try {
        const currentJson = await dbGet('jsonConfigContent');
        if (currentJson?._isSkeleton) {
            await dbDelete('jsonConfigContent');
            // Limpar campos do ambiente que foram salvos com o skeleton
            await dbDelete('envName');
            await dbDelete('host');
            await dbDelete('nlb');
            await dbDelete('connectionId');
            await dbDelete('authorizerUri');
            await dbDelete('authorizerCredentials');
            await dbDelete('hostPortal');

            document.getElementById('clearBtn').classList.add('hidden');
            document.getElementById('fileInput').value = '';
            document.getElementById('fileInputName').textContent = 'Nenhum arquivo';
            markDropZoneHasFile('dropZoneConfig', null);
            document.getElementById('contentCard').classList.add('hidden');
            document.getElementById('pathsApiGatewayCard').classList.add('hidden');
            document.getElementById('gatewayResponsesCard').classList.add('hidden');
        }
        await dbDelete('groupPathsContent');
        // Recalcular authorizerNames a partir do JSON principal (se existir)
        if (currentJson && !currentJson._isSkeleton && currentJson.paths) {
            const authNames = extractAuthorizerNamesFromPaths(currentJson.paths);
            window._authorizerNames = authNames;
            await dbSet('authorizerNames', authNames);
        } else {
            window._authorizerNames = [];
            await dbDelete('authorizerNames');
        }
    } catch (error) {
        console.error('Erro ao limpar grupos de paths:', error);
        showMessage('Erro ao limpar JSON de grupos', 'error');
        return;
    }

    document.getElementById('clearGroupPathsBtn').classList.add('hidden');
    document.getElementById('fileInputGroupPaths').value = '';
    document.getElementById('fileInputGroupPathsName').textContent = 'Nenhum arquivo';
    markDropZoneHasFile('dropZoneGroupPaths', null);

    renderGroupPaths(null);

    const configsCard = document.getElementById('configsApiGatewayCard');
    if (!configsCard.classList.contains('hidden')) {
        await renderConfigPanel();
    }

    showMessage('JSON de grupos limpo com sucesso!', 'success');
}
