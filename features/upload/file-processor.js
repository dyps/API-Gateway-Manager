// ─── Processamento dos arquivos de upload ─────────────────────────────────────

async function processConfigFile(file) {
    if (!file.name.endsWith('.json')) {
        showUploadError('Por favor, selecione um arquivo JSON');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const jsonData = JSON.parse(event.target.result);

            const validation = validateApiGatewayJson(jsonData);
            if (!validation.valid) {
                showUploadError(validation.message);
                return;
            }

            await dbSet(CONFIG_CONTENT_KEY, jsonData);

            // Extrair e salvar nomes dos autorizadores encontrados nos paths
            const authNamesFromPaths = extractAuthorizerNamesFromPaths(jsonData.paths);
            if (authNamesFromPaths.length > 0) {
                const existing = await dbGet('authorizerNames') || [];
                const merged = [...new Set([...existing, ...authNamesFromPaths])];
                window._authorizerNames = merged;
                await dbSet('authorizerNames', merged);
            }

            document.getElementById('fileInputName').textContent = file.name;
            markDropZoneHasFile('dropZoneConfig', file.name);
            document.getElementById('uploadError').classList.add('hidden');
            displayConfig(jsonData);
            showMessage('Configuração salva com sucesso!', 'success');
        } catch (error) {
            showUploadError('Erro: Arquivo JSON inválido');
            console.error('Erro ao processar JSON:', error);
        }
    };
    reader.onerror = () => showUploadError('Erro ao ler o arquivo');
    reader.readAsText(file);
}

async function processGroupPathsFile(file) {
    if (!file.name.endsWith('.json')) {
        showUploadError('Por favor, selecione um arquivo JSON');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const jsonData = JSON.parse(event.target.result);
            const validation = validateGroupPathsStructure(jsonData);
            if (!validation.valid) {
                showUploadError(validation.message);
                return;
            }

            const jsonStr = JSON.stringify(jsonData);
            let dataToSave = jsonData;
            try {
                let activeEnv = null;
                for (const env of await getFixedEnvironments()) {
                    if (await isCurrentEnvironment(env)) { activeEnv = env; break; }
                }
                if (activeEnv) {
                    let sourceEnv = null;
                    for (const env of await getFixedEnvironments()) {
                        if (jsonStr.includes(env.connectionId) || jsonStr.includes(env.nlb)) { sourceEnv = env; break; }
                    }
                    if (sourceEnv && sourceEnv.connectionId !== activeEnv.connectionId) {
                        let replacedStr = jsonStr;
                        replacedStr = replacedStr.replaceAll(sourceEnv.authorizerCredentials, activeEnv.authorizerCredentials);
                        replacedStr = replacedStr.replaceAll(sourceEnv.authorizerUri, activeEnv.authorizerUri);
                        replacedStr = replacedStr.replaceAll(sourceEnv.connectionId, activeEnv.connectionId);
                        replacedStr = replacedStr.replaceAll(sourceEnv.host, activeEnv.host);
                        replacedStr = replacedStr.replaceAll(sourceEnv.hostPortal, activeEnv.hostPortal);
                        replacedStr = replacedStr.replaceAll(sourceEnv.nlb, activeEnv.nlb);
                        dataToSave = JSON.parse(replacedStr);
                    }
                }
            } catch (err) {
                console.error('Erro ao aplicar ambiente no groupPaths:', err);
            }

            await dbSet('groupPathsContent', dataToSave);

            // Extrair e salvar nomes dos autorizadores usados nos paths dos grupos
            const authNames = extractAuthorizerNamesFromGroupPaths(dataToSave);
            if (authNames.length > 0) {
                // Mesclar com nomes já salvos (podem ter vindo do JSON principal)
                const existing = await dbGet('authorizerNames') || [];
                const merged = [...new Set([...existing, ...authNames])];
                window._authorizerNames = merged;
                await dbSet('authorizerNames', merged);
            }

            document.getElementById('clearGroupPathsBtn').classList.remove('hidden');
            document.getElementById('fileInputGroupPathsName').textContent = file.name;
            markDropZoneHasFile('dropZoneGroupPaths', file.name);
            document.getElementById('uploadError').classList.add('hidden');
            // Reconstruir os radios para habilitar a troca de ambiente agora que grupos estão carregados
            const allWrapper = document.getElementById('allCardsWrapper');
            if (!allWrapper.classList.contains('hidden')) {
                await renderConfigPanel();
            }
            renderGroupPaths(dataToSave);
            showMessage('JSON de grupos salvo com sucesso!', 'success');
        } catch {
            showUploadError('Erro: Arquivo JSON inválido');
        }
    };
    reader.readAsText(file);
}

async function processEnvironmentsFile(file) {
    if (!file.name.endsWith('.json')) {
        showUploadError('Por favor, selecione um arquivo JSON');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const jsonData = JSON.parse(event.target.result);

            const validation = validateEnvironmentsJson(jsonData);
            if (!validation.valid) {
                showUploadError(validation.message);
                return;
            }

            await dbSet('environmentsContent', jsonData);

            if (typeof _cachedEnvironments !== 'undefined') {
                _cachedEnvironments = jsonData;
            }

            document.getElementById('clearEnvironmentsBtn').classList.remove('hidden');
            document.getElementById('fileInputEnvironmentsName').textContent = file.name;
            markDropZoneHasFile('dropZoneEnvironments', file.name);
            document.getElementById('uploadError').classList.add('hidden');
            showMessage('Ambientes carregados com sucesso!', 'success');

            await loadSavedConfig();
        } catch (error) {
            showUploadError('Erro: Arquivo JSON inválido');
            console.error('Erro ao processar environments.json:', error);
        }
    };
    reader.readAsText(file);
}
