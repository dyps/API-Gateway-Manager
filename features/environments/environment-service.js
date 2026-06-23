// ─── Serviço de Ambientes ─────────────────────────────────────────────────────
// Carrega, detecta e troca ambientes. Interage com IndexedDB.

let _cachedEnvironments = null;

async function getFixedEnvironments() {
    if (_cachedEnvironments) return _cachedEnvironments;
    try {
        // Prioridade 1: arquivo carregado pelo usuário via UI (salvo no IndexedDB)
        const fromDb = await dbGet('environmentsContent');
        if (fromDb && Array.isArray(fromDb) && fromDb.length > 0) {
            _cachedEnvironments = fromDb;
            return _cachedEnvironments;
        }
    } catch (_) { /* IndexedDB ainda não disponível, segue pro fetch */ }

    try {
        // Prioridade 2: arquivo environments.json local (não versionado)
        const response = await fetch('environments.json');
        if (!response.ok) throw new Error(`HTTP ${response.status} ao carregar environments.json`);
        _cachedEnvironments = await response.json();
    } catch (err) {
        console.warn('environments.json não encontrado ou inválido. Carregue o arquivo pela interface.', err);
        _cachedEnvironments = [];
    }
    return _cachedEnvironments;
}

async function isCurrentEnvironment(environment) {
    try {
        var dif = [];

        if (await dbGet('authorizerCredentials') !== environment.authorizerCredentials) {
            dif.push("authorizerCredentials");
        }
        if (await dbGet('authorizerUri') !== environment.authorizerUri) {
            dif.push("authorizerUri");
        }
        if (await dbGet('connectionId') !== environment.connectionId) {
            dif.push("connectionId");
        }
        if (await dbGet('host') !== environment.host) {
            dif.push("host");
        }
        if (await dbGet('hostPortal') !== environment.hostPortal) {
            dif.push("hostPortal");
        }
        if (await dbGet('nlb') !== environment.nlb) {
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
        if (jsonData.securityDefinitions["lambda-authorizer"]) {
            if (jsonData.securityDefinitions["lambda-authorizer"]["x-amazon-apigateway-authorizer"]) {
                if (jsonData.securityDefinitions["lambda-authorizer"]["x-amazon-apigateway-authorizer"].authorizerUri) {
                    await dbSet("authorizerUri", jsonData.securityDefinitions["lambda-authorizer"]["x-amazon-apigateway-authorizer"].authorizerUri);
                }
                if (jsonData.securityDefinitions["lambda-authorizer"]["x-amazon-apigateway-authorizer"].authorizerCredentials) {
                    await dbSet("authorizerCredentials", jsonData.securityDefinitions["lambda-authorizer"]["x-amazon-apigateway-authorizer"].authorizerCredentials);
                }
            }
        }
    }

    const vpcLinkEntry = Object.values(jsonData.paths || {}).find(p =>
        p["x-amazon-apigateway-any-method"]?.["x-amazon-apigateway-integration"]?.connectionType === "VPC_LINK"
    );
    if (vpcLinkEntry) {
        const integration = vpcLinkEntry["x-amazon-apigateway-any-method"]["x-amazon-apigateway-integration"];
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
            const anyMethodOrigin = vpcLinkEntry["x-amazon-apigateway-any-method"]
                ?.["x-amazon-apigateway-integration"]
                ?.responses?.default
                ?.responseParameters?.["method.response.header.Access-Control-Allow-Origin"];
            if (anyMethodOrigin) {
                await dbSet("hostPortal", anyMethodOrigin);
            }
        }
    }
}
