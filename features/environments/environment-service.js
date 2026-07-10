// ─── Serviço de Ambientes ─────────────────────────────────────────────────────
// Carrega, detecta e troca ambientes. Interage com IndexedDB.

let _cachedEnvironments = null;

// ─── Extração de nomes de autorizadores usados nos paths ──────────────────────

/**
 * Extrai todos os nomes únicos de autorizadores referenciados no campo "security"
 * dos métodos dos paths. Funciona tanto para paths planos (jsonData.paths) quanto
 * para groupPaths (objeto de grupos → paths).
 */
function extractAuthorizerNamesFromPaths(paths) {
    const names = new Set();
    if (!paths || typeof paths !== 'object') return [];
    for (const pathConfig of Object.values(paths)) {
        for (const [method, methodConfig] of Object.entries(pathConfig || {})) {
            if (method === 'options') continue;
            if (Array.isArray(methodConfig?.security)) {
                for (const secEntry of methodConfig.security) {
                    for (const name of Object.keys(secEntry || {})) {
                        names.add(name);
                    }
                }
            }
        }
    }
    return [...names];
}

/**
 * Extrai nomes de autorizadores de um groupPaths (estrutura { grupo: { path: config } }).
 */
function extractAuthorizerNamesFromGroupPaths(groupPathsContent) {
    const names = new Set();
    if (!groupPathsContent || typeof groupPathsContent !== 'object') return [];
    for (const groupPaths of Object.values(groupPathsContent)) {
        for (const n of extractAuthorizerNamesFromPaths(groupPaths)) {
            names.add(n);
        }
    }
    return [...names];
}

async function getFixedEnvironments() {
    if (_cachedEnvironments) return _cachedEnvironments;
    try {
        // Arquivo carregado pelo usuário via UI (salvo no IndexedDB)
        const fromDb = await dbGet('environmentsContent');
        if (fromDb && Array.isArray(fromDb) && fromDb.length > 0) {
            _cachedEnvironments = fromDb;
            return _cachedEnvironments;
        }
    } catch (_) { /* IndexedDB ainda não disponível */ }

    _cachedEnvironments = [];
    return _cachedEnvironments;
}

async function isCurrentEnvironment(environment) {
    try {
        var dif = [];

        const normalize = (v) => v || '';

        if (normalize(await dbGet('authorizerCredentials')) !== normalize(environment.authorizerCredentials)) {
            dif.push("authorizerCredentials");
        }
        if (normalize(await dbGet('authorizerUri')) !== normalize(environment.authorizerUri)) {
            dif.push("authorizerUri");
        }
        if (normalize(await dbGet('connectionId')) !== normalize(environment.connectionId)) {
            dif.push("connectionId");
        }
        if (normalize(await dbGet('host')) !== normalize(environment.host)) {
            dif.push("host");
        }
        if (normalize(await dbGet('hostPortal')) !== normalize(environment.hostPortal)) {
            dif.push("hostPortal");
        }
        if (normalize(await dbGet('nlb')) !== normalize(environment.nlb)) {
            dif.push("nlb");
        }

        if (dif.length < 6) {
            console.log("valid = " + environment.name);
            console.log("dif = " + dif);
        }

        return dif.length === 0;
    } catch (error) {
        console.error('Erro em isCurrentEnvironment:', error);
        return false;
    }
}

async function switchEnvironment(environment) {
    try {
        const jsonData = await dbGet('jsonConfigContent');
        if (!jsonData) return;

        let json = JSON.stringify(jsonData);

        const currentConnectionId = await dbGet('connectionId');
        const currentHostPortal = await dbGet('hostPortal');
        const currentNlb = await dbGet('nlb');

        // Substituição global no JSON serializado (só se os valores atuais existem)
        if (currentConnectionId && environment.connectionId) {
            json = json.replaceAll(currentConnectionId, environment.connectionId);
        }
        if (currentNlb && environment.nlb) {
            json = json.replaceAll(currentNlb, environment.nlb);
        }

        const updatedJson = JSON.parse(json);

        if (environment.host) {
            updatedJson.host = environment.host;
        }

        // hostPortal só em paths (Access-Control-Allow-Origin)
        if (currentHostPortal && environment.hostPortal) {
            updatedJson.paths = JSON.parse(JSON.stringify(updatedJson.paths).replaceAll(currentHostPortal, environment.hostPortal));
        }

        if (updatedJson.info && environment.title) {
            updatedJson.info.title = environment.title;
        }

        if (updatedJson.info && environment.description) {
            updatedJson.info.description = environment.description;
        }

        if (updatedJson.info) {
            updatedJson.info.version = generateVersion();
        }

        if (environment.basePath) {
            updatedJson.basePath = environment.basePath;
        }

        if (environment["x-amazon-apigateway-security-policy"]) {
            updatedJson["x-amazon-apigateway-security-policy"] = environment["x-amazon-apigateway-security-policy"];
        }

        if (environment["x-amazon-apigateway-endpoint-configuration"]) {
            updatedJson["x-amazon-apigateway-endpoint-configuration"] = environment["x-amazon-apigateway-endpoint-configuration"];
        } else {
            delete updatedJson["x-amazon-apigateway-endpoint-configuration"];
        }

        if (environment["x-amazon-apigateway-policy"]) {
            updatedJson["x-amazon-apigateway-policy"] = environment["x-amazon-apigateway-policy"];
        } else {
            delete updatedJson["x-amazon-apigateway-policy"];
        }

        if (environment.authorizerCredentials && environment.authorizerUri) {
            updatedJson.securityDefinitions = buildSecurityDefinitions(environment.authorizerUri, environment.authorizerCredentials, environment.securityDefinitions);
        } else {
            delete updatedJson.securityDefinitions;
        }

        // Persistir todos os valores do novo ambiente no DB
        await dbSet('envName', environment.name);
        await dbSet('authorizerCredentials', environment.authorizerCredentials || '');
        await dbSet('authorizerUri', environment.authorizerUri || '');
        await dbSet('connectionId', environment.connectionId || '');
        await dbSet('host', environment.host || '');
        await dbSet('hostPortal', environment.hostPortal || '');
        await dbSet('nlb', environment.nlb || '');
        await dbSet('jsonConfigContent', updatedJson);

        // Atualizar groupPathsContent — só connectionId, hostPortal e nlb
        // (authorizerUri e authorizerCredentials NÃO existem dentro dos paths,
        //  eles ficam em securityDefinitions na raiz do API Gateway JSON)
        const groupPathsData = await dbGet('groupPathsContent');
        if (groupPathsData) {
            let gpJson = JSON.stringify(groupPathsData);
            if (currentConnectionId && environment.connectionId) {
                gpJson = gpJson.replaceAll(currentConnectionId, environment.connectionId);
            }
            if (currentHostPortal && environment.hostPortal) {
                gpJson = gpJson.replaceAll(currentHostPortal, environment.hostPortal);
            }
            if (currentNlb && environment.nlb) {
                gpJson = gpJson.replaceAll(currentNlb, environment.nlb);
            }
            await dbSet('groupPathsContent', JSON.parse(gpJson));
        }
    } catch (error) {
        console.error('Erro em switchEnvironment:', error);
    }
}

async function loadURIsLambda(jsonData) {
    if (jsonData.securityDefinitions) {
        // Extrair nomes dos autorizadores dos paths carregados
        const authNames = extractAuthorizerNamesFromPaths(jsonData.paths);
        if (authNames.length > 0) {
            window._authorizerNames = authNames;
            await dbSet('authorizerNames', authNames);
        }

        // Inferir o autorizador primário: aquele com type "token" (header-based)
        // ou, se só tem um, usa esse mesmo.
        const secDefs = jsonData.securityDefinitions;
        const defEntries = Object.entries(secDefs);
        let primaryName = null;

        if (defEntries.length === 1) {
            primaryName = defEntries[0][0];
        } else {
            // Busca o que tem type "token" (padrão do API GW para header/Authorization)
            for (const [name, def] of defEntries) {
                const authExt = def['x-amazon-apigateway-authorizer'] || {};
                if (authExt.type === 'token') {
                    primaryName = name;
                    break;
                }
            }
            // Se não achou token, compara com securityDefinitions do env ativo
            // para encontrar o que NÃO é extra
            if (!primaryName && authNames.length > 0) {
                const envs = await getFixedEnvironments();
                for (const env of envs) {
                    const extraNames = env.securityDefinitions ? Object.keys(env.securityDefinitions) : [];
                    if (extraNames.length > 0) {
                        primaryName = authNames.find(n => !extraNames.includes(n));
                        if (primaryName) break;
                    }
                }
            }
            // Fallback: primeiro authorizer encontrado nos paths
            if (!primaryName) primaryName = authNames[0] || defEntries[0][0];
        }

        const primaryDef = secDefs[primaryName];
        const missing = [];

        if (primaryDef && primaryDef['x-amazon-apigateway-authorizer']) {
            const authExt = primaryDef['x-amazon-apigateway-authorizer'];
            if (authExt.authorizerUri) {
                await dbSet("authorizerUri", authExt.authorizerUri);
            } else {
                await dbSet("authorizerUri", '');
                missing.push('authorizerUri (Arn da Lambda)');
            }
            if (authExt.authorizerCredentials) {
                await dbSet("authorizerCredentials", authExt.authorizerCredentials);
            } else {
                await dbSet("authorizerCredentials", '');
                missing.push('authorizerCredentials (Arn da Credencial)');
            }
        } else {
            await dbSet("authorizerUri", '');
            await dbSet("authorizerCredentials", '');
            missing.push('authorizerUri (Arn da Lambda)', 'authorizerCredentials (Arn da Credencial)');
        }

        if (missing.length > 0) {
            showUploadError(`Autorizador "${primaryName}": não encontrado no JSON — ${missing.join(', ')}`);
        }
    }

    // Buscar primeiro path com integração VPC_LINK em qualquer método
    let vpcLinkEntry = null;
    let vpcLinkMethod = null;
    for (const pathConfig of Object.values(jsonData.paths || {})) {
        for (const method of Object.keys(pathConfig)) {
            if (method === 'options') continue;
            const integ = pathConfig[method]?.['x-amazon-apigateway-integration'];
            if (integ?.connectionType === 'VPC_LINK') {
                vpcLinkEntry = pathConfig;
                vpcLinkMethod = method;
                break;
            }
        }
        if (vpcLinkEntry) break;
    }

    if (vpcLinkEntry && vpcLinkMethod) {
        const integration = vpcLinkEntry[vpcLinkMethod]["x-amazon-apigateway-integration"];
        if (integration.uri) {
            const nlbMatch = integration.uri.match(/^(https?:\/\/[^:/]+)/);
            await dbSet("nlb", nlbMatch ? nlbMatch[1] : integration.uri);
        }
        if (integration.connectionId) {
            await dbSet("connectionId", integration.connectionId);
        }

        const optionsOrigin = vpcLinkEntry.options
            ?.["x-amazon-apigateway-integration"]
            ?.responses?.default
            ?.responseParameters?.["method.response.header.Access-Control-Allow-Origin"];
        if (optionsOrigin) {
            await dbSet("hostPortal", optionsOrigin);
        } else {
            const methodOrigin = vpcLinkEntry[vpcLinkMethod]
                ?.["x-amazon-apigateway-integration"]
                ?.responses?.default
                ?.responseParameters?.["method.response.header.Access-Control-Allow-Origin"];
            if (methodOrigin) {
                await dbSet("hostPortal", methodOrigin);
            }
        }
    }
}
