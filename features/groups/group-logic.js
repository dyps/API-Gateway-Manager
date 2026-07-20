// ─── Lógica de manipulação de grupos de paths ────────────────────────────────

/**
 * Insere todos os paths do grupo no objeto de paths do JSON,
 * sem sobrescrever paths já existentes de outros grupos.
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
 */
function updateGroupPaths(currentJsonPaths, groupPathsMap) {
    return { ...currentJsonPaths, ...groupPathsMap };
}

/**
 * Remove um grupo do objeto groupPathsContent.
 */
function removeGroup(groupPathsContent, groupName) {
    const result = { ...groupPathsContent };
    delete result[groupName];
    return result;
}

/**
 * Calcula os grupos com pendências.
 * Retorna array de { groupName, validationResult, isDefault, syncedGroupPaths } com hasAction = true.
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
    const activeEnv = await getActiveEnvironment();
    if (activeEnv) { defaultGroupNames = new Set(activeEnv.defaultGroups || []); }

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

/**
 * Remove um path não mapeado de jsonConfigContent.paths e re-renderiza a UI.
 */
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
