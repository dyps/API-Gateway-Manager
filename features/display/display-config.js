// ─── Lifecycle de exibição do JSON carregado ──────────────────────────────────

// Carregar configuração salva (bootstrap principal)
async function loadSavedConfig() {
    try {
        const [jsonData, groupPaths, environmentsData] = await Promise.all([
            dbGet(CONFIG_CONTENT_KEY),
            dbGet('groupPathsContent'),
            dbGet('environmentsContent')
        ]);

        if (environmentsData) {
            document.getElementById('clearEnvironmentsBtn').classList.remove('hidden');
            document.getElementById('fileInputEnvironmentsName').textContent = 'JSON carregado';
            markDropZoneHasFile('dropZoneEnvironments', 'JSON carregado');
        }

        if (groupPaths) {
            document.getElementById('clearGroupPathsBtn').classList.remove('hidden');
            document.getElementById('fileInputGroupPathsName').textContent = 'JSON carregado';
            markDropZoneHasFile('dropZoneGroupPaths', 'JSON carregado');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        if (jsonData) {
            document.getElementById('configsApiGatewayCard').classList.remove('hidden');
            await displayConfig(jsonData);
        } else if (environmentsData) {
            document.getElementById('configsApiGatewayCard').classList.remove('hidden');
            document.getElementById('allCardsWrapper').classList.remove('hidden');
            if (groupPaths) {
                document.getElementById('apiGatewayCardsWrapper').classList.remove('hidden');
                renderGroupPaths(groupPaths);
            } else {
                document.getElementById('apiGatewayCardsWrapper').classList.add('hidden');
            }
            await renderConfigPanel();
        } else if (groupPaths) {
            document.getElementById('configsApiGatewayCard').classList.add('hidden');
            document.getElementById('allCardsWrapper').classList.remove('hidden');
            document.getElementById('apiGatewayCardsWrapper').classList.remove('hidden');
            renderGroupPaths(groupPaths);
        } else {
            document.getElementById('allCardsWrapper').classList.add('hidden');
            document.getElementById('apiGatewayCardsWrapper').classList.add('hidden');
        }
    } catch (error) {
        console.error('Erro ao carregar configuração:', error);
        showMessage('Erro ao carregar dados salvos', 'error');
    }
}

// Exibir configuração completa
async function displayConfig(jsonData) {
    const isSkeleton = !!jsonData._isSkeleton;

    if (!isSkeleton) {
        document.getElementById('clearBtn').classList.remove('hidden');
        const fileInputName = document.getElementById('fileInputName');
        if (!fileInputName.textContent || fileInputName.textContent === 'Nenhum arquivo') {
            fileInputName.textContent = 'JSON carregado';
        }
        markDropZoneHasFile('dropZoneConfig', fileInputName.textContent);
    } else {
        document.getElementById('clearBtn').classList.add('hidden');
        document.getElementById('fileInputName').textContent = 'Nenhum arquivo';
        markDropZoneHasFile('dropZoneConfig', null);
    }

    const groupPaths = await dbGet('groupPathsContent');
    if (groupPaths) {
        document.getElementById('clearGroupPathsBtn').classList.remove('hidden');
        const gpName = document.getElementById('fileInputGroupPathsName');
        if (!gpName.textContent || gpName.textContent === 'Nenhum arquivo') {
            gpName.textContent = 'JSON carregado';
        }
    }

    document.getElementById('allCardsWrapper').classList.remove('hidden');
    document.getElementById('apiGatewayCardsWrapper').classList.remove('hidden');

    // Guardar securityDefinitions antes de loadConfigs deletar
    const _secDefs = jsonData.securityDefinitions ? { ...jsonData.securityDefinitions } : {};

    await loadConfigs(jsonData);

    renderPathsTopology(document.getElementById('topologyContent'), jsonData.paths || {}, _secDefs);

    const savedForViewer = await dbGet('jsonConfigContent');
    const { _isSkeleton: _flag, ...cleanForViewer } = savedForViewer || {};
    const jsonContent = document.getElementById('jsonContent');
    jsonContent.innerHTML = '';
    renderJsonTree(jsonContent, cleanForViewer);

    try {
        const groupPathsContent = await dbGet('groupPathsContent');
        if (groupPathsContent) {
            renderGroupPaths(groupPathsContent);
        }
    } catch (err) {
        console.error('Erro ao recalcular status dos grupos:', err);
    }

    renderGatewayResponses();
}

async function loadConfigs(jsonData) {
    await dbSet("host", jsonData.host);
    delete jsonData.host;

    delete jsonData.swagger;
    delete jsonData.info;
    delete jsonData.schemes;

    await loadURIsLambda(jsonData);

    for (const env of await getFixedEnvironments()) {
        if (await isCurrentEnvironment(env)) {
            await dbSet('envName', env.name);
            invalidateActiveEnvCache();
            break;
        }
    }

    renderConfigPanel();

    delete jsonData.securityDefinitions;
    delete jsonData.definitions;
    delete jsonData["x-amazon-apigateway-request-validators"];

    loadPaths(jsonData.paths);

    return jsonData.paths;
}
