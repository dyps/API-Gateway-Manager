// Constantes
const CONFIG_CONTENT_KEY = 'jsonConfigContent';
const LAST_DIR_CONFIG_KEY = 'lastDirHandleConfig';
const LAST_DIR_GROUP_PATHS_KEY = 'lastDirHandleGroupPaths';
const LAST_DIR_ENVIRONMENTS_KEY = 'lastDirHandleEnvironments';

// Elementos do DOM
const fileInput = document.getElementById('fileInput');
const fileInputGroupPaths = document.getElementById('fileInputGroupPaths');
const fileInputEnvironments = document.getElementById('fileInputEnvironments');

const clearBtn = document.getElementById('clearBtn');
const clearGroupPathsBtn = document.getElementById('clearGroupPathsBtn');
const clearEnvironmentsBtn = document.getElementById('clearEnvironmentsBtn');
const messageDiv = document.getElementById('message');
const fileInputName = document.getElementById('fileInputName');
const fileInputGroupPathsName = document.getElementById('fileInputGroupPathsName');
const fileInputEnvironmentsName = document.getElementById('fileInputEnvironmentsName');

const contentCard = document.getElementById('contentCard');
const jsonContent = document.getElementById('jsonContent');

const configsApiGatewayCard = document.getElementById('configsApiGatewayCard');
const groupPathsCard = document.getElementById('groupPathsCard');
const groupPathsList = document.getElementById('groupPathsList');
const pathsApiGatewayCard = document.getElementById('pathsApiGatewayCard');

var hiddenAllDivsEditFlags = false;

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

// ─── Inicialização das Drop Zones ─────────────────────────────────────────────

document.getElementById('btnChooseConfig').addEventListener('click', async (e) => {
    e.stopPropagation();
    const file = await pickFile(fileInput, LAST_DIR_CONFIG_KEY);
    if (file) await processConfigFile(file);
});

document.getElementById('btnChooseGroupPaths').addEventListener('click', async (e) => {
    e.stopPropagation();
    const file = await pickFile(fileInputGroupPaths, LAST_DIR_GROUP_PATHS_KEY);
    if (file) await processGroupPathsFile(file);
});

document.getElementById('btnChooseEnvironments').addEventListener('click', async (e) => {
    e.stopPropagation();
    const file = await pickFile(fileInputEnvironments, LAST_DIR_ENVIRONMENTS_KEY);
    if (file) await processEnvironmentsFile(file);
});

setupDropZone('dropZoneConfig', async (file) => {
    if (!file) {
        const picked = await pickFile(fileInput, LAST_DIR_CONFIG_KEY);
        if (picked) await processConfigFile(picked);
        return;
    }
    await processConfigFile(file);
});

setupDropZone('dropZoneGroupPaths', async (file) => {
    if (!file) {
        const picked = await pickFile(fileInputGroupPaths, LAST_DIR_GROUP_PATHS_KEY);
        if (picked) await processGroupPathsFile(picked);
        return;
    }
    await processGroupPathsFile(file);
});

setupDropZone('dropZoneEnvironments', async (file) => {
    if (!file) {
        const picked = await pickFile(fileInputEnvironments, LAST_DIR_ENVIRONMENTS_KEY);
        if (picked) await processEnvironmentsFile(picked);
        return;
    }
    await processEnvironmentsFile(file);
});

// ─── Processamento dos arquivos ───────────────────────────────────────────────

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
            fileInputName.textContent = file.name;
            markDropZoneHasFile('dropZoneConfig', file.name);
            uploadErrorDiv.classList.add('hidden');
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
                    if (await isCurrentEnviremnet(env)) { activeEnv = env; break; }
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
            clearGroupPathsBtn.classList.remove('hidden');
            fileInputGroupPathsName.textContent = file.name;
            markDropZoneHasFile('dropZoneGroupPaths', file.name);
            uploadErrorDiv.classList.add('hidden');
            // Reconstruir os radios para habilitar a troca de ambiente agora que grupos estão carregados
            const configsCard = document.getElementById('configsApiGatewayCard');
            if (!configsCard.classList.contains('hidden')) {
                await renderApiGatewayEditers();
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

            clearEnvironmentsBtn.classList.remove('hidden');
            fileInputEnvironmentsName.textContent = file.name;
            markDropZoneHasFile('dropZoneEnvironments', file.name);
            uploadErrorDiv.classList.add('hidden');
            showMessage('Ambientes carregados com sucesso!', 'success');

            await loadSavedConfig();
        } catch (error) {
            showUploadError('Erro: Arquivo JSON inválido');
            console.error('Erro ao processar environments.json:', error);
        }
    };
    reader.readAsText(file);
}

async function handleClearEnvironments() {
    try {
        // Se o JSON do API Gateway é um skeleton (criado via seleção de ambiente), descarta junto
        const currentJson = await dbGet('jsonConfigContent');
        if (currentJson?._isSkeleton) {
            await dbDelete('jsonConfigContent');
            // Reset visual do dropzone do API Gateway
            clearBtn.classList.add('hidden');
            fileInput.value = '';
            fileInputName.textContent = 'Nenhum arquivo';
            markDropZoneHasFile('dropZoneConfig', null);
            contentCard.classList.add('hidden');
            pathsApiGatewayCard.classList.add('hidden');
            document.getElementById('gatewayResponsesCard').classList.add('hidden');
        }
        await dbDelete('environmentsContent');
        _cachedEnvironments = null;
    } catch (error) {
        console.error('Erro ao limpar ambientes:', error);
        showMessage('Erro ao limpar ambientes', 'error');
        return;
    }

    clearEnvironmentsBtn.classList.add('hidden');
    fileInputEnvironments.value = '';
    fileInputEnvironmentsName.textContent = 'Nenhum arquivo';
    markDropZoneHasFile('dropZoneEnvironments', null);
    showMessage('Ambientes limpos com sucesso!', 'success');

    await loadSavedConfig();
}



/**
 * Insere todos os paths do grupo no objeto de paths do JSON,
 * sem sobrescrever paths já existentes de outros grupos.
 *
 * @param {Object} currentJsonPaths  - jsonConfigContent.paths atual
 * @param {Object} groupPathsMap     - { [path]: config } do grupo a adicionar
 * @returns {Object} novo objeto de paths com os paths do grupo inseridos
 */
function addGroupPaths(currentJsonPaths, groupPathsMap) {
    const result = { ...currentJsonPaths };
    for (const path of Object.keys(groupPathsMap)) {
        if (!(path in result)) {
            result[path] = groupPathsMap[path];
        }
    }
    return result;
}

/**
 * Sobrescreve no objeto de paths do JSON apenas os paths pertencentes ao grupo.
 * Paths de outros grupos não são afetados.
 *
 * @param {Object} currentJsonPaths  - jsonConfigContent.paths atual
 * @param {Object} groupPathsMap     - { [path]: config } do grupo a atualizar
 * @returns {Object} novo objeto de paths com os paths do grupo sobrescritos
 */
function updateGroupPaths(currentJsonPaths, groupPathsMap) {
    return { ...currentJsonPaths, ...groupPathsMap };
}

/**
 * Remove um grupo do objeto groupPathsContent.
 *
 * @param {Object} groupPathsContent - objeto completo de grupos { [groupName]: { [path]: config } }
 * @param {string} groupName         - nome do grupo a remover
 * @returns {Object} novo objeto de grupos sem o grupo removido
 */
function removeGroup(groupPathsContent, groupName) {
    const result = { ...groupPathsContent };
    delete result[groupName];
    return result;
}


/**
 * Calcula os grupos com pendências (mesma lógica do renderGroupPaths).
 * Retorna array de { groupName, validationResult, isDefault } com hasAction = true.
 */
async function calcPendingActionGroups() {
    const groupPaths = await dbGet('groupPathsContent');
    const jsonConfigContent = await dbGet('jsonConfigContent');
    if (!groupPaths || !jsonConfigContent?.paths) return [];

    const apiGatewayPaths = jsonConfigContent.paths;

    // Sincronizar ambiente se necessário
    let syncedGroupPaths = groupPaths;
    let apiGwEnv = null;
    for (const env of await getFixedEnvironments()) {
        if (JSON.stringify(jsonConfigContent).includes(env.connectionId)) { apiGwEnv = env; break; }
    }
    let gpEnv = null;
    const gpStr = JSON.stringify(groupPaths);
    for (const env of await getFixedEnvironments()) {
        if (gpStr.includes(env.connectionId) || gpStr.includes(env.nlb)) { gpEnv = env; break; }
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

    let defaultGroupNames = new Set();
    for (const env of await getFixedEnvironments()) {
        if (await isCurrentEnviremnet(env)) { defaultGroupNames = new Set(env.defaultGroups || []); break; }
    }

    const result = [];
    for (const groupName of Object.keys(syncedGroupPaths)) {
        const validationResult = validateGroup(syncedGroupPaths[groupName], apiGatewayPaths);
        const isDefault = defaultGroupNames.has(groupName);
        const { status, divergentPaths } = validationResult;
        const hasAction = status === 'none-found'
            || status === 'partial'
            || (status === 'all-found' && divergentPaths.length > 0)
            || (!isDefault && status !== 'none-found' && apiGatewayPaths);
        if (hasAction) result.push({ groupName, validationResult, isDefault, syncedGroupPaths });
    }
    return result;
}

/**
 * Resolve todas as pendências: adiciona padrões ausentes, atualiza divergentes, remove não-padrão presentes.
 */
async function resolveAllPendingGroups() {
    const actionGroups = await calcPendingActionGroups();
    if (actionGroups.length === 0) return;
    const jsonConfigContent = await dbGet('jsonConfigContent');
    let updatedPaths = { ...jsonConfigContent.paths };
    for (const { groupName, validationResult, isDefault, syncedGroupPaths } of actionGroups) {
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
}

// Carregar configuração ao abrir a página
document.addEventListener('DOMContentLoaded', async () => {
    await loadSavedConfig();
});

// Limpar configuração completa (API Gateway)
async function handleClearConfig() {
    // Preservar groupPathsContent e environmentsContent antes de limpar tudo
    const groupPaths = await dbGet('groupPathsContent');
    const environmentsData = await dbGet('environmentsContent');

    try {
        await dbClear();
        // Restaurar os dados que não pertencem ao API Gateway
        if (groupPaths) {
            await dbSet('groupPathsContent', groupPaths);
        }
        if (environmentsData) {
            await dbSet('environmentsContent', environmentsData);
            _cachedEnvironments = environmentsData;
        } else {
            _cachedEnvironments = null; // força reload do fetch na próxima chamada
        }
    } catch (error) {
        console.error('Erro ao limpar configuração:', error);
        showMessage('Erro ao limpar configuração', 'error');
        return;
    }

    contentCard.classList.add('hidden');
    clearBtn.classList.add('hidden');
    configsApiGatewayCard.classList.add('hidden');
    pathsApiGatewayCard.classList.add('hidden');
    document.getElementById('gatewayResponsesCard').classList.add('hidden');

    fileInput.value = '';
    fileInputName.textContent = 'Nenhum arquivo';
    markDropZoneHasFile('dropZoneConfig', null);

    // Restaurar estado visual do groupPaths e environments se ainda existem
    if (environmentsData) {
        // Tem ambientes (com ou sem grupos): mostra seletor
        configsApiGatewayCard.classList.remove('hidden');
        await renderApiGatewayEditers();
        if (groupPaths) {
            clearGroupPathsBtn.classList.remove('hidden');
            if (fileInputGroupPathsName.textContent === 'Nenhum arquivo') {
                fileInputGroupPathsName.textContent = 'JSON carregado';
            }
            renderGroupPaths(groupPaths);
        }
    } else if (groupPaths) {
        // Só grupos sem ambientes: mostra grupos, esconde card de config
        configsApiGatewayCard.classList.add('hidden');
        clearGroupPathsBtn.classList.remove('hidden');
        if (fileInputGroupPathsName.textContent === 'Nenhum arquivo') {
            fileInputGroupPathsName.textContent = 'JSON carregado';
        }
        renderGroupPaths(groupPaths);
    }

    showMessage('Configuração limpa com sucesso!', 'success');
}

// Limpar apenas o JSON de Grupos de Paths
async function handleClearGroupPaths() {
    try {
        // Se o JSON do API Gateway é um skeleton, descarta junto com os grupos
        const currentJson = await dbGet('jsonConfigContent');
        if (currentJson?._isSkeleton) {
            await dbDelete('jsonConfigContent');
            // Reset visual do dropzone do API Gateway
            clearBtn.classList.add('hidden');
            fileInput.value = '';
            fileInputName.textContent = 'Nenhum arquivo';
            markDropZoneHasFile('dropZoneConfig', null);
            contentCard.classList.add('hidden');
            pathsApiGatewayCard.classList.add('hidden');
            document.getElementById('gatewayResponsesCard').classList.add('hidden');
        }
        await dbDelete('groupPathsContent');
    } catch (error) {
        console.error('Erro ao limpar grupos de paths:', error);
        showMessage('Erro ao limpar JSON de grupos', 'error');
        return;
    }

    clearGroupPathsBtn.classList.add('hidden');
    fileInputGroupPaths.value = '';
    fileInputGroupPathsName.textContent = 'Nenhum arquivo';
    markDropZoneHasFile('dropZoneGroupPaths', null);

    renderGroupPaths(null);

    // Reconstruir os radios para refletir o novo estado (pode voltar a disabled)
    const configsCard = document.getElementById('configsApiGatewayCard');
    if (!configsCard.classList.contains('hidden')) {
        await renderApiGatewayEditers();
    }

    showMessage('JSON de grupos limpo com sucesso!', 'success');
}

// Carregar configuração salva
async function loadSavedConfig() {
    try {
        const [jsonData, groupPaths, environmentsData] = await Promise.all([
            dbGet(CONFIG_CONTENT_KEY),
            dbGet('groupPathsContent'),
            dbGet('environmentsContent')
        ]);

        if (environmentsData) {
            clearEnvironmentsBtn.classList.remove('hidden');
            fileInputEnvironmentsName.textContent = 'JSON carregado';
            markDropZoneHasFile('dropZoneEnvironments', 'JSON carregado');
        }

        if (groupPaths) {
            clearGroupPathsBtn.classList.remove('hidden');
            fileInputGroupPathsName.textContent = 'JSON carregado';
            markDropZoneHasFile('dropZoneGroupPaths', 'JSON carregado');
        }

        if (jsonData) {
            // displayConfig já chama renderGroupPaths no final, depois que loadConfigs termina
            await displayConfig(jsonData);
        } else if (environmentsData) {
            // Tem ambientes (com ou sem grupos): mostra seletor de ambientes
            configsApiGatewayCard.classList.remove('hidden');
            await renderApiGatewayEditers();
            if (groupPaths) renderGroupPaths(groupPaths);
        } else if (groupPaths) {
            // Só grupos, sem ambientes e sem API Gateway: mostra grupos, esconde card de config
            configsApiGatewayCard.classList.add('hidden');
            renderGroupPaths(groupPaths);
        } else {
            // Nada carregado: esconde tudo
            configsApiGatewayCard.classList.add('hidden');
        }
    } catch (error) {
        console.error('Erro ao carregar configuração:', error);
        showMessage('Erro ao carregar dados salvos', 'error');
    }
}

// Exibir configuração
async function displayConfig(jsonData) {
    const isSkeleton = !!jsonData._isSkeleton;

    // Só marca o dropzone do API Gateway como "com arquivo" se for um JSON real (não skeleton)
    if (!isSkeleton) {
        clearBtn.classList.remove('hidden');
        if (!fileInputName.textContent || fileInputName.textContent === 'Nenhum arquivo') {
            fileInputName.textContent = 'JSON carregado';
        }
        markDropZoneHasFile('dropZoneConfig', fileInputName.textContent);
    } else {
        // Skeleton: garantir que o dropzone fique limpo
        clearBtn.classList.add('hidden');
        fileInputName.textContent = 'Nenhum arquivo';
        markDropZoneHasFile('dropZoneConfig', null);
    }

    // Verificar se já existe groupPathsContent salvo
    const groupPaths = await dbGet('groupPathsContent');
    if (groupPaths) {
        clearGroupPathsBtn.classList.remove('hidden');
        if (!fileInputGroupPathsName.textContent || fileInputGroupPathsName.textContent === 'Nenhum arquivo') {
            fileInputGroupPathsName.textContent = 'JSON carregado';
        }
    }

    configsApiGatewayCard.classList.remove('hidden');
    pathsApiGatewayCard.classList.remove('hidden');

    restante = await loadConfigs(jsonData);

    // Mostrar no viewer o objeto completo do IndexedDB (mesmo que sai no download), sem flag interna
    const savedForViewer = await dbGet('jsonConfigContent');
    const { _isSkeleton: _flag, ...cleanForViewer } = savedForViewer || {};
    jsonContent.innerHTML = '';
    newJsonViewr(jsonContent, cleanForViewer);

    contentCard.classList.remove('hidden');

    // Recalcular status dos grupos com o novo API Gateway carregado
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

    delete jsonData.swagger;//quando for gerar o novo la na frente tem que colocar de volta essas coisas *-*
    delete jsonData.info;
    delete jsonData.schemes;




    await loadURIsLambda(jsonData)

    for (const env of await getFixedEnvironments()) {
        if (await isCurrentEnviremnet(env)) {
            await dbSet('envName', env.name);
            break;
        }
    }

    renderApiGatewayEditers()

    delete jsonData.securityDefinitions

    delete jsonData.definitions;
    delete jsonData["x-amazon-apigateway-request-validators"];

    loadPaths(jsonData.paths)

    //delete jsonData.paths; // tem que melhorar
    return jsonData.paths;

}

async function loadPaths(paths) {
    const container = document.getElementById('pathsApiGatewayDiv');
    container.innerHTML = '';
    alterDivPathsBackground = true;

    // Tentar buscar groupPathsContent para organizar por grupos
    let groupPathsContent = null;
    try {
        groupPathsContent = await dbGet('groupPathsContent');
    } catch (e) { /* sem grupos, renderiza flat */ }

    if (!groupPathsContent || Object.keys(groupPathsContent).length === 0) {
        // Sem grupos: renderiza flat como antes
        Object.keys(paths).forEach(keyPath => {
            newDivPathsApiGatewayEditer(container, keyPath, paths[keyPath]);
        });
        return;
    }

    // Construir mapa de path → groupName
    const pathToGroup = {};
    for (const [groupName, groupPaths] of Object.entries(groupPathsContent)) {
        for (const p of Object.keys(groupPaths)) {
            pathToGroup[p] = groupName;
        }
    }

    // Agrupar paths do API Gateway por grupo
    const grouped = {}; // groupName → [keyPath, ...]
    const unmapped = [];
    for (const keyPath of Object.keys(paths)) {
        const g = pathToGroup[keyPath];
        if (g) {
            if (!grouped[g]) grouped[g] = [];
            grouped[g].push(keyPath);
        } else {
            unmapped.push(keyPath);
        }
    }

    // Renderizar cada grupo como <details> colapsável
    for (const groupName of Object.keys(grouped)) {
        const section = document.createElement('details');
        section.classList.add('paths-group-section');
        section.open = false;

        const summary = document.createElement('summary');
        summary.classList.add('paths-group-summary');
        summary.textContent = `${groupName} (${grouped[groupName].length})`;
        section.appendChild(summary);

        grouped[groupName].forEach(keyPath => {
            newDivPathsApiGatewayEditer(section, keyPath, paths[keyPath]);
        });

        container.appendChild(section);
    }

    // Paths não mapeados no final
    if (unmapped.length > 0) {
        const section = document.createElement('details');
        section.classList.add('paths-group-section');
        section.open = false;

        const summary = document.createElement('summary');
        summary.classList.add('paths-group-summary', 'paths-group-summary-unmapped');
        summary.textContent = `Não mapeados (${unmapped.length})`;
        section.appendChild(summary);

        unmapped.forEach(keyPath => {
            newDivPathsApiGatewayEditer(section, keyPath, paths[keyPath]);
        });

        container.appendChild(section);
    }
}

// Atualiza Paths do ApiGateway e Conteúdo do JSON sem reprocessar o objeto inteiro
async function refreshPathsAndContent() {
    const jsonConfigContent = await dbGet('jsonConfigContent');
    if (!jsonConfigContent || !jsonConfigContent.paths) return;
    loadPaths(jsonConfigContent.paths);
    // Mostrar o mesmo conteúdo que seria gerado no download (sem a flag interna)
    const { _isSkeleton, ...cleanData } = jsonConfigContent;
    jsonContent.innerHTML = '';
    newJsonViewr(jsonContent, cleanData);
}

// Mostrar mensagem de sucesso (desaparece em 5s)
let _messageTimeout = null;
function showMessage(text, type) {
    if (_messageTimeout) {
        clearTimeout(_messageTimeout);
        _messageTimeout = null;
    }

    messageDiv.textContent = text;
    messageDiv.classList.remove('visible', 'success', 'error', 'hidden');
    void messageDiv.offsetWidth;
    messageDiv.classList.add(type, 'visible');

    _messageTimeout = setTimeout(() => {
        messageDiv.classList.add('hidden');
        messageDiv.classList.remove('visible');
        _messageTimeout = null;
    }, 5000);
}

// Mostrar erro de upload dentro do card (não desaparece, tem botão ✕)
const uploadErrorDiv  = document.getElementById('uploadError');
const uploadErrorText = document.getElementById('uploadErrorText');
document.getElementById('btnCloseUploadError').addEventListener('click', () => {
    uploadErrorDiv.classList.add('hidden');
});

function showUploadError(text) {
    uploadErrorText.textContent = text;
    // Reinicia a animação mesmo se já estava visível
    uploadErrorDiv.classList.add('hidden');
    void uploadErrorDiv.offsetWidth;
    uploadErrorDiv.classList.remove('hidden');
}

async function renderApiGatewayEditers() {
    const container = document.getElementById("configsApiGatewayEditers");
    container.innerHTML = ""; // limpa antes de renderizar

    await newFixedEnvironments(container)

    await addAllDivApiGatewayEditer(container);

    if (hiddenAllDivsEditFlags) {
        hiddenDivEditFlags()
    }

    await newDivDownload(container)

    // Configurar botão de olho
    const eyeBtn = document.getElementById('envViewerBtn');
    if (eyeBtn) {
        eyeBtn.onclick = async () => {
            await showEnvValuesDialog();
        };
    }
}

async function newFixedEnvironments(container) {
    var rowFixedEnvironments = document.createElement("div");
    rowFixedEnvironments.classList.add("div-fixed-environments")

    for (const enviremnet of await getFixedEnvironments()) {
        await newDivRadio(rowFixedEnvironments, null, enviremnet);
    }

    container.appendChild(rowFixedEnvironments);
}

async function newDivRadio(container, checked = false, enviremnet = null) {
    if (!enviremnet) return;

    var divButon = document.createElement("div");
    divButon.classList.add("div-radio")
    var btn = document.createElement('input');
    btn.classList.add("radio")
    btn.type = "radio";
    btn.name = "radioEnvironments";

    if (checked) btn.checked = true;

    divButon.appendChild(btn);

    var fixedEnvironmentsName = document.createElement("span");
    fixedEnvironmentsName.textContent = enviremnet.name;

    // Só permite selecionar se tiver API Gateway ou grupos carregados
    const [existingJson, groupPaths] = await Promise.all([
        dbGet('jsonConfigContent'),
        dbGet('groupPathsContent')
    ]);
    const canSwitch = !!(existingJson || groupPaths);

    if (!canSwitch) {
        btn.disabled = true;
        divButon.title = 'Carregue o JSON do API Gateway ou de Grupos para trocar de ambiente';
        divButon.style.opacity = '0.5';
        divButon.style.cursor = 'not-allowed';
    } else {
        btn.addEventListener("change", async () => {
            if (btn.checked) {
                const currentJson = await dbGet('jsonConfigContent');
                if (!currentJson) {
                    const skeleton = buildSkeletonApiGateway(enviremnet);
                    await dbSet('jsonConfigContent', skeleton);
                    await dbSet('envName', enviremnet.name);
                    await dbSet('authorizerCredentials', enviremnet.authorizerCredentials);
                    await dbSet('authorizerUri', enviremnet.authorizerUri);
                    await dbSet('connectionId', enviremnet.connectionId);
                    await dbSet('host', enviremnet.host);
                    await dbSet('hostPortal', enviremnet.hostPortal);
                    await dbSet('nlb', enviremnet.nlb);
                } else {
                    await changeEnvironments(enviremnet);
                }
                await loadSavedConfig();
            }
        });

        divButon.addEventListener("dblclick", () => {
            btn.checked = true;
            btn.dispatchEvent(new Event("change"));
        });
    }

    if (await isCurrentEnviremnet(enviremnet)) {
        btn.checked = true;
        hiddenAllDivsEditFlags = true;
    }

    divButon.appendChild(fixedEnvironmentsName);
    container.appendChild(divButon);
}


function hiddenDivEditFlags() {
    document.querySelectorAll('.div-edit-flags').forEach(el => {
        el.classList.add('hidden');
    });
}

async function newDivDownload(container) {
    var jsonData = await dbGet('jsonConfigContent');

    // Container onde vai ficar o botão
    var row = document.createElement("div");

    // Se existir JSON no IndexedDB, cria botão
    if (jsonData) {
        var btn = document.createElement('button');
        btn.classList.add("downloadBtn")
        btn.textContent = "Baixar JSON";

        btn.onclick = async function () {
            const jsonData = await dbGet('jsonConfigContent');
            if (!jsonData) return;

            // Validação 1: arquivo não pode ter paths vazio
            const pathsObj = jsonData.paths || {};
            if (Object.keys(pathsObj).length === 0) {
                await showAlertDialog(
                    '⚠️ Nenhum path encontrado',
                    'O JSON não contém nenhum path. Verifique se os grupos foram aplicados corretamente antes de baixar.'
                );
                return;
            }

            // Validação 2: ambiente do JSON deve bater com o ambiente selecionado
            const savedEnvName = await dbGet('envName');
            let detectedEnvName = null;
            const jsonStr2 = JSON.stringify(jsonData);
            // Replica a lógica de isCurrentEnviremnet mas contra o conteúdo do JSON,
            // contando quantos campos batem — o ambiente com mais matches ganha
            let bestScore = 0;
            for (const env of await getFixedEnvironments()) {
                let score = 0;
                if (jsonStr2.includes(env.authorizerCredentials)) score++;
                if (jsonStr2.includes(env.authorizerUri))         score++;
                if (jsonStr2.includes(env.connectionId))          score++;
                if (jsonStr2.includes(env.host))                  score++;
                if (jsonStr2.includes(env.hostPortal))            score++;
                if (jsonStr2.includes(env.nlb))                   score++;
                if (score > bestScore) {
                    bestScore = score;
                    detectedEnvName = env.name;
                }
            }
            if (detectedEnvName && savedEnvName && detectedEnvName !== savedEnvName) {
                const proceed = await showConfirmDialog(
                    '⚠️ Divergência de ambiente',
                    `O ambiente selecionado é <strong>${savedEnvName}</strong>, mas o conteúdo do JSON parece ser de <strong>${detectedEnvName}</strong>.<br><br>Deseja baixar mesmo assim?`
                );
                if (!proceed) return;
            }

            const pending = await calcPendingActionGroups();
            const criticalGroups = pending.filter(({ validationResult, isDefault }) => {
                const { status } = validationResult;
                return (isDefault && status === 'none-found') || (!isDefault && status !== 'none-found');
            });

            const fixedResponses = getFixedGatewayResponses();
            const currentResponses = jsonData['x-amazon-apigateway-gateway-responses'] || {};
            const gwPending = Object.keys(fixedResponses).filter(k =>
                !currentResponses[k] || JSON.stringify(currentResponses[k]) !== JSON.stringify(fixedResponses[k])
            );

            const hasPending = criticalGroups.length > 0 || gwPending.length > 0;
            if (hasPending) {
                const confirmed = await showDownloadPendingDialog(criticalGroups.length, gwPending.length);
                if (confirmed === null) return; // cancelou
                if (confirmed === true) {
                    if (criticalGroups.length > 0) {
                        await resolveAllPendingGroups();
                        const gp = await dbGet('groupPathsContent');
                        await renderGroupPaths(gp);
                    }
                    if (gwPending.length > 0) {
                        await resolveAllGatewayResponses();
                    }
                }
            }

            const finalData = await dbGet('jsonConfigContent');
            // Remover flag interna antes de serializar
            const { _isSkeleton, ...cleanData } = finalData;
            const jsonStr = JSON.stringify(cleanData);
            var blob = new Blob([jsonStr], { type: "application/json" });
            var url = URL.createObjectURL(blob);
            var a = document.createElement("a");
            a.href = url;
            var envName = await dbGet('envName');
            if (!envName) envName = "NãoDefinido";
            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const timestamp = `${pad(now.getDate())}-${pad(now.getMonth()+1)}-${now.getFullYear()}_${pad(now.getHours())}h${pad(now.getMinutes())}`;
            a.download = `API Gateway Ambiente-${envName}_${timestamp}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };

        row.appendChild(btn);
    } else {
        // Verificar se tem ambientes ou grupos carregados para dar orientação
        const groupPathsData = await dbGet('groupPathsContent');
        const environmentsData = await dbGet('environmentsContent');

        const hint = document.createElement('p');
        hint.style.cssText = 'font-size:0.875rem;color:#718096;margin:0;line-height:1.6;';

        if (environmentsData && !groupPathsData) {
            hint.innerHTML = '✅ Ambientes carregados. Carregue o <strong>JSON de Grupos de Paths</strong> para visualizar e gerenciar os grupos, ou o <strong>JSON do API Gateway</strong> para habilitar a edição completa.';
        } else if (environmentsData && groupPathsData) {
            hint.innerHTML = '✅ Ambientes e grupos carregados. Carregue o <strong>JSON do API Gateway</strong> para habilitar a edição, validação dos grupos e o download do JSON final — ou <strong>selecione um ambiente</strong> para criar do zero.';
        } else {
            hint.textContent = 'Nenhum JSON salvo.';
        }
        row.appendChild(hint);
    }
    container.appendChild(row);
}

var alterDivPathsBackground = true;

function newDivPathsApiGatewayEditer(container, keyPath, path) {
    var row = document.createElement("div");
    row.classList.add("card-path-item")

    if (alterDivPathsBackground) {
        row.classList.add("background-color-gray-1")
        alterDivPathsBackground = false;
    } else {
        row.classList.add("background-color-gray-2")
        alterDivPathsBackground = true;
    }

    var rowHeader = document.createElement("div");
    rowHeader.classList.add("row-header")

    var divName = document.createElement("div");
    divName.classList.add("name-edit-item-div")

    var confName = document.createElement("span");// nome tipo /api/{proxy+}
    confName.textContent = keyPath;

    divName.appendChild(confName);

    rowHeader.appendChild(divName);

    var rowConfsEnables = document.createElement("div");
    rowConfsEnables.classList.add("div-row-confs")

    rowHeader.appendChild(rowConfsEnables);

    //talves depois mudar adicionar aqui o que pega se tem as coisa

    // aqui que add


    row.appendChild(rowHeader)

    var row2 = document.createElement("div");
    row2.classList.add("jsonContent")

    newJsonViewr(row2, path)


    row.appendChild(row2)

    container.appendChild(row);

}

// Renderizar lista de grupos de paths
async function renderGroupPaths(groupPaths) {
    if (!groupPaths || Object.keys(groupPaths).length === 0) {
        groupPathsCard.classList.add('hidden');
        groupPathsList.innerHTML = '';
        return;
    }

    groupPathsCard.classList.remove('hidden');

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
        groupPathsList.replaceChildren(skeletonFragment);
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
            if (await isCurrentEnviremnet(env)) {
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
        const actionPanel = document.createElement('details');
        actionPanel.classList.add('group-section-panel');
        actionPanel.id = 'group-panel-action';
        actionPanel.open = true;
        const actionSummary = document.createElement('summary');
        actionSummary.classList.add('group-section-summary', 'group-section-summary-action');
        actionSummary.textContent = `⚡ Grupos com ações disponíveis (${actionGroups.length})`;

        if (apiGatewayPaths) {
            // Só mostra "Resolver tudo" se há ações que realmente modificam algo
            const hasRealActions = actionGroups.some(({ validationResult, isDefault }) => {
                if (!validationResult) return false;
                const { status, divergentPaths } = validationResult;
                return (isDefault && status === 'none-found')
                    || status === 'partial'
                    || (status === 'all-found' && divergentPaths.length > 0)
                    || (!isDefault && status !== 'none-found');
            });

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
        }

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
    groupPathsList.replaceChildren(finalFragment);
    groupPathsCard.classList.remove('hidden');
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

// Remove um path não mapeado de jsonConfigContent.paths e re-renderiza a UI
async function removeUnmappedPath(path) {
    try {
        const jsonConfigContent = await dbGet('jsonConfigContent');
        if (!jsonConfigContent || !jsonConfigContent.paths) return;
        if (!(path in jsonConfigContent.paths)) return;

        const updatedPaths = { ...jsonConfigContent.paths };
        delete updatedPaths[path];
        await dbSet('jsonConfigContent', { ...jsonConfigContent, paths: updatedPaths });

        const groupPathsContent = await dbGet('groupPathsContent');
        renderGroupPaths(groupPathsContent);
    } catch (err) {
        console.error('Erro ao remover path:', err);
        showMessage('Erro ao remover path', 'error');
    }
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

async function showEnvValuesDialog() {
    const fields = [
        { label: "Host", key: "host" },
        { label: "Arn da Lambda", key: "authorizerUri" },
        { label: "Arn da Credencial da Lambda", key: "authorizerCredentials" },
        { label: "Id do vpc link", key: "connectionId" },
        { label: "NLB", key: "nlb" },
        { label: "Host do portal deste ambiente", key: "hostPortal" },
    ];

    const existing = document.getElementById('envValuesDialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'envValuesDialog';
    overlay.classList.add('modal-overlay');

    const dialog = document.createElement('div');
    dialog.classList.add('modal-box', 'env-values-dialog');

    const title = document.createElement('h3');
    title.textContent = 'Valores do Ambiente Atual';
    dialog.appendChild(title);

    for (const field of fields) {
        const value = (await dbGet(field.key)) ?? '(não definido)';

        const row = document.createElement('div');
        row.classList.add('env-values-row');

        const label = document.createElement('div');
        label.textContent = field.label;
        label.classList.add('env-values-label');

        const val = document.createElement('div');
        val.textContent = value;
        val.classList.add('env-values-value');

        row.appendChild(label);
        row.appendChild(val);
        dialog.appendChild(row);
    }

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Fechar';
    closeBtn.classList.add('env-values-close-btn');
    closeBtn.onclick = () => overlay.remove();
    dialog.appendChild(closeBtn);

    overlay.appendChild(dialog);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
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
        gatewayResponsesCard.classList.add('hidden');
        return;
    }

    gatewayResponsesCard.classList.remove('hidden');
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

// ─── Dialogs genéricos ────────────────────────────────────────────────────────

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

// ─── Validação do JSON do API Gateway ────────────────────────────────────────

/**
 * Valida a estrutura básica esperada do JSON do API Gateway (Swagger/OpenAPI 2.0 AWS).
 * @param {*} data - objeto já parseado
 * @returns {{ valid: boolean, message: string }}
 */
function validateApiGatewayJson(data) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return { valid: false, message: 'Erro: o JSON do API Gateway deve ser um objeto, não um array.' };
    }
    if (!data.paths || typeof data.paths !== 'object' || Array.isArray(data.paths)) {
        return { valid: false, message: 'Erro: o JSON do API Gateway não contém a chave "paths" ou ela não é um objeto.' };
    }
    if (Object.keys(data.paths).length === 0) {
        return { valid: false, message: 'Aviso: o JSON do API Gateway foi aceito, mas não contém nenhum path em "paths".' };
    }
    return { valid: true, message: '' };
}

/**
 * Valida a estrutura básica esperada do JSON de Ambientes.
 * @param {*} data - objeto já parseado
 * @returns {{ valid: boolean, message: string }}
 */
function validateEnvironmentsJson(data) {
    if (!Array.isArray(data)) {
        return { valid: false, message: 'Erro: o arquivo de ambientes deve ser um array JSON ( [ ... ] ).' };
    }
    if (data.length === 0) {
        return { valid: false, message: 'Erro: o array de ambientes está vazio.' };
    }
    const requiredFields = ['name', 'connectionId', 'nlb', 'host'];
    const firstItem = data[0];
    const missingFields = requiredFields.filter(f => !(f in firstItem));
    if (missingFields.length > 0) {
        return {
            valid: false,
            message: `Erro: o primeiro item do array de ambientes não contém os campos obrigatórios: ${missingFields.map(f => `"${f}"`).join(', ')}.`
        };
    }
    return { valid: true, message: '' };
}

// ─── Setup dos modais de info/ajuda ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Helper genérico para abrir/fechar modal
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
        // Fechar clicando no overlay
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modalId);
        });
        // Fechar com Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal(modalId);
        });
    }

    // Modal de armazenamento local (ícone "i" no título)
    bindModal('btnInfoStorage', 'modalStorage', 'btnCloseModalStorage');

    // Modais de ajuda de cada drop-zone
    bindModal('btnHelpConfig',      'modalHelpConfig',      'btnCloseModalHelpConfig');
    bindModal('btnHelpEnvironments', 'modalHelpEnvironments', 'btnCloseModalHelpEnvironments');
    bindModal('btnHelpGroupPaths',   'modalHelpGroupPaths',   'btnCloseModalHelpGroupPaths');
});

// ─── Dark Mode ────────────────────────────────────────────────────────────────

(function () {
    const btn = document.getElementById('btnDarkMode');
    const STORAGE_KEY = 'darkMode';

    function applyDark(on) {
        document.body.classList.toggle('dark', on);
        btn.textContent = on ? '☀️' : '🌙';
        btn.title = on ? 'Modo claro' : 'Modo escuro';
    }

    // Restaurar estado salvo (dark mode é o padrão)
    const saved = localStorage.getItem(STORAGE_KEY);
    applyDark(saved === null ? true : saved === 'true');
    document.documentElement.classList.remove('dark-pre');

    btn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark');
        localStorage.setItem(STORAGE_KEY, isDark);
        btn.textContent = isDark ? '☀️' : '🌙';
        btn.title = isDark ? 'Modo claro' : 'Modo escuro';
    });
})();
