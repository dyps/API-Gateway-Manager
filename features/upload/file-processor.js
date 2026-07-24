// ─── Processamento dos arquivos de upload ─────────────────────────────────────

async function processConfigFile(file) {
    if (!isAcceptedFileFormat(file.name)) {
        showUploadError('Por favor, selecione um arquivo JSON ou YAML (.json, .yaml, .yml)');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            // 1. Parsear (JSON ou YAML)
            const { data: rawData, format: fileFormat } = parseFileContent(event.target.result, file.name);

            // 2. Validar estrutura
            const validation = validateApiGatewayJson(rawData);
            if (!validation.valid) {
                showUploadError(validation.message);
                return;
            }

            // Mostrar aviso sobre extensões AWS (não bloqueante)
            if (validation.warning) {
                showMessage(validation.warning, 'error');
            }

            // 3. Normalizar formato (OAS 3.0 → interno baseado em Swagger 2.0)
            let jsonData;
            const specFormat = detectSpecFormat(rawData);

            if (specFormat === 'oas30') {
                jsonData = normalizeOas30ToInternal(rawData);
                showMessage('Arquivo OpenAPI 3.0 importado e convertido com sucesso!', 'success');
            } else {
                jsonData = rawData;
            }

            // Salvar formato de origem e formato do arquivo para uso no download
            jsonData._sourceFormat = specFormat === 'oas30' ? 'oas30' : 'swagger2';
            jsonData._fileFormat = fileFormat; // 'json' ou 'yaml'

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

            if (specFormat !== 'oas30') {
                showMessage('Configuração salva com sucesso!', 'success');
            }
        } catch (error) {
            showUploadError('Erro: ' + (error.message || 'Arquivo inválido'));
            console.error('Erro ao processar arquivo:', error);
        }
    };
    reader.onerror = () => showUploadError('Erro ao ler o arquivo');
    reader.readAsText(file);
}

async function processGroupPathsFile(file) {
    if (!isAcceptedFileFormat(file.name)) {
        showUploadError('Por favor, selecione um arquivo JSON ou YAML (.json, .yaml, .yml)');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const { data: jsonData } = parseFileContent(event.target.result, file.name);
            const validation = validateGroupPathsStructure(jsonData);
            if (!validation.valid) {
                showUploadError(validation.message);
                return;
            }

            const jsonStr = JSON.stringify(jsonData);
            let dataToSave = jsonData;
            try {
                const activeEnv = await getActiveEnvironment();
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
        } catch (error) {
            showUploadError('Erro: ' + (error.message || 'Arquivo inválido'));
            console.error('Erro ao processar arquivo de grupos:', error);
        }
    };
    reader.readAsText(file);
}

async function processEnvironmentsFile(file) {
    if (!isAcceptedFileFormat(file.name)) {
        showUploadError('Por favor, selecione um arquivo JSON ou YAML (.json, .yaml, .yml)');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const { data: jsonData } = parseFileContent(event.target.result, file.name);

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
            showUploadError('Erro: ' + (error.message || 'Arquivo inválido'));
            console.error('Erro ao processar environments:', error);
        }
    };
    reader.readAsText(file);
}
