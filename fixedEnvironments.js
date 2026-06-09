function buildSecurityDefinitions(authorizerUri, authorizerCredentials) {
    return {
        "lambda-authorizer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "x-amazon-apigateway-authtype": "custom",
            "x-amazon-apigateway-authorizer": {
                "type": "token",
                "authorizerUri": authorizerUri,
                "authorizerCredentials": authorizerCredentials,
                "authorizerResultTtlInSeconds": 0
            }
        }
    };
}

function buildSkeletonApiGateway(enviremnet) {
    const skeleton = {
        "swagger": "2.0",
        "info": {
            "title": enviremnet.title || enviremnet.name,
            "description": enviremnet.description || "",
            "version": generateVersion()
        },
        "host": enviremnet.host || "",
        "basePath": enviremnet.basePath || "/",
        "schemes": ["https"],
        "paths": {}
    };

    if (enviremnet["x-amazon-apigateway-security-policy"]) {
        skeleton["x-amazon-apigateway-security-policy"] = enviremnet["x-amazon-apigateway-security-policy"];
    }
    if (enviremnet["x-amazon-apigateway-endpoint-configuration"]) {
        skeleton["x-amazon-apigateway-endpoint-configuration"] = enviremnet["x-amazon-apigateway-endpoint-configuration"];
    }
    if (enviremnet["x-amazon-apigateway-policy"]) {
        skeleton["x-amazon-apigateway-policy"] = enviremnet["x-amazon-apigateway-policy"];
    }
    if (enviremnet.authorizerCredentials && enviremnet.authorizerUri) {
        skeleton["securityDefinitions"] = buildSecurityDefinitions(enviremnet.authorizerUri, enviremnet.authorizerCredentials);

        skeleton["x-amazon-apigateway-request-validators"] = {
            "Validate query string parameters and headers": {
                "validateRequestParameters": true,
                "validateRequestBody": false
            }
        }
    }

    return skeleton;
}

function generateVersion() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    //return "2024-12-12T22:04:18Z"
}

// Ambientes carregados de environments.json (não versionado).
// Copie environments.example.json → environments.json e preencha com seus dados reais.
// O usuário também pode carregar o arquivo pela interface — nesse caso ele fica salvo no IndexedDB.
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
        //,
        //"DEFAULT_5XX": {
        //    "statusCode": 500,
        //    "responseTemplates": {
        //        "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 500,\n  \"error\": \"Internal Server Error\",\n  \"path\": \"$context.path\"\n}"
        //    }
        //},
        //"RESOURCE_NOT_FOUND": {
        //    "statusCode": 404,
        //    "responseTemplates": {
        //        "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 404,\n  \"error\": \"Not Found\",\n  \"path\": \"$context.path\"\n}"
        //    }
        //},
        //"REQUEST_TOO_LARGE": {
        //    "statusCode": 413,
        //    "responseTemplates": {
        //        "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 413,\n  \"error\": \"Request Too Large\",\n  \"path\": \"$context.path\"\n}"
        //    }
        //},
        //"THROTTLED": {
        //    "statusCode": 429,
        //    "responseTemplates": {
        //        "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 429,\n  \"error\": \"Too Many Requests\",\n  \"path\": \"$context.path\"\n}"
        //    }
        //},
        //"QUOTA_EXCEEDED": {
        //    "statusCode": 429,
        //    "responseTemplates": {
        //        "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 429,\n  \"error\": \"Quota Exceeded\",\n  \"path\": \"$context.path\"\n}"
        //    }
        //},
        //"BAD_REQUEST_PARAMETERS": {
        //    "statusCode": 400,
        //    "responseTemplates": {
        //        "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 400,\n  \"error\": \"Bad Request\",\n  \"path\": \"$context.path\"\n}"
        //    }
        //},
        //"BAD_REQUEST_BODY": {
        //    "statusCode": 400,
        //    "responseTemplates": {
        //        "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 400,\n  \"error\": \"Bad Request\",\n  \"path\": \"$context.path\"\n}"
        //    }
        //},
        //"EXPIRED_TOKEN": {
        //    "statusCode": 401,
        //    "responseTemplates": {
        //        "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 401,\n  \"error\": \"Unauthorized\",\n  \"path\": \"$context.path\"\n}"
        //    }
        //},
        //"INVALID_SIGNATURE": {
        //    "statusCode": 403,
        //    "responseTemplates": {
        //        "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 403,\n  \"error\": \"Forbidden\",\n  \"path\": \"$context.path\"\n}"
        //    }
        //},
        //"WAF_FILTERED": {
        //    "statusCode": 403,
        //    "responseTemplates": {
        //        "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 403,\n  \"error\": \"Forbidden\",\n  \"path\": \"$context.path\"\n}"
        //    }
        //},
        //"API_CONFIGURATION_ERROR": {
        //    "statusCode": 500,
        //    "responseTemplates": {
        //        "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 500,\n  \"error\": \"Internal Server Error\",\n  \"path\": \"$context.path\"\n}"
        //    }
        //},
        //"AUTHORIZER_CONFIGURATION_ERROR": {
        //    "statusCode": 500,
        //    "responseTemplates": {
        //        "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 503,\n  \"error\": \"AUTHORIZER_CONFIGURATION_ERROR Internal Server Error\",\n  \"path\": \"$context.path\"\n}"
        //    }
        //},
        "AUTHORIZER_FAILURE": {
            "statusCode": 503,
            "responseTemplates": {
                "application/json": "{\n  \"timestamp\": \"$context.requestTime\",\n  \"status\": 503,\n  \"error\": \"Internal server error - Lambda Authorizer\",\n  \"path\": \"$context.path\"\n}"
            }
        }
    };
}

async function isCurrentEnviremnet(enviremnet) {
    try {


        var dif = [];

        if (await dbGet('authorizerCredentials') !== enviremnet.authorizerCredentials) {
            dif.push("authorizerCredentials");
        }
        if (await dbGet('authorizerUri') !== enviremnet.authorizerUri) {
            dif.push("authorizerUri");
        }
        if (await dbGet('connectionId') !== enviremnet.connectionId) {
            dif.push("connectionId");
        }
        if (await dbGet('host') !== enviremnet.host) {
            dif.push("host");
        }
        if (await dbGet('hostPortal') !== enviremnet.hostPortal) {
            dif.push("hostPortal");
        }
        if (await dbGet('nlb') !== enviremnet.nlb) {
            dif.push("nlb");
        }

        if (dif.length < 6
            //&& dif.length !== 0
        ) {
            console.log("valid = " + enviremnet.name)
            console.log("dif = " + dif)
        }

        return dif.length === 0;
    } catch (error) {
        console.error('Erro em isCurrentEnviremnet:', error);
        return false;
    }
}

async function changeEnvironments(enviremnet) {
    try {
        //como recarrega depois... pega
        const jsonData = await dbGet('jsonConfigContent');
        let json = JSON.stringify(jsonData);

        const currentConnectionId = await dbGet('connectionId');
        const currentHostPortal = await dbGet('hostPortal');
        const currentNlb = await dbGet('nlb');

        json = json.replaceAll(currentConnectionId, enviremnet.connectionId);
        json = json.replaceAll(currentNlb, enviremnet.nlb);

        // Atualiza campos diretos no objeto (title, basePath e campos x-amazon-apigateway-* de raiz)
        const updatedJson = JSON.parse(json);

        if (enviremnet.host) {
            updatedJson.host = enviremnet.host;
        }

        if (enviremnet.hostPortal) {
            updatedJson.paths = JSON.parse(JSON.stringify(updatedJson.paths).replaceAll(currentHostPortal, enviremnet.hostPortal));
        }

        if (updatedJson.info && enviremnet.title) {
            updatedJson.info.title = enviremnet.title;
        }

        if (updatedJson.info && enviremnet.description) {
            updatedJson.info.description = enviremnet.description;
        }

        if (updatedJson.info) {
            updatedJson.info.version = generateVersion();
        }

        if (enviremnet.basePath) {
            updatedJson.basePath = enviremnet.basePath;
        }

        if (enviremnet["x-amazon-apigateway-security-policy"]) {
            updatedJson["x-amazon-apigateway-security-policy"] = enviremnet["x-amazon-apigateway-security-policy"];
        }

        // x-amazon-apigateway-endpoint-configuration: adiciona/atualiza ou remove
        if (enviremnet["x-amazon-apigateway-endpoint-configuration"]) {
            updatedJson["x-amazon-apigateway-endpoint-configuration"] = enviremnet["x-amazon-apigateway-endpoint-configuration"];
        } else {
            delete updatedJson["x-amazon-apigateway-endpoint-configuration"];
        }

        // x-amazon-apigateway-policy: adiciona/atualiza ou remove
        if (enviremnet["x-amazon-apigateway-policy"]) {
            updatedJson["x-amazon-apigateway-policy"] = enviremnet["x-amazon-apigateway-policy"];
        } else {
            delete updatedJson["x-amazon-apigateway-policy"];
        }

        // securityDefinitions: adiciona/atualiza ou remove conforme o ambiente tem authorizer
        if (enviremnet.authorizerCredentials && enviremnet.authorizerUri) {
            updatedJson.securityDefinitions = buildSecurityDefinitions(enviremnet.authorizerUri, enviremnet.authorizerCredentials);
        } else {
            delete updatedJson.securityDefinitions;
        }

        await dbSet('envName', enviremnet.name);
        await dbSet('authorizerCredentials', enviremnet.authorizerCredentials);
        await dbSet('authorizerUri', enviremnet.authorizerUri);
        await dbSet('connectionId', enviremnet.connectionId);
        await dbSet('host', enviremnet.host);
        await dbSet('hostPortal', enviremnet.hostPortal);
        await dbSet('nlb', enviremnet.nlb);
        await dbSet('jsonConfigContent', updatedJson);

        const groupPathsData = await dbGet('groupPathsContent');
        if (groupPathsData) {
            let gpJson = JSON.stringify(groupPathsData);
            gpJson = gpJson.replaceAll(currentConnectionId, enviremnet.connectionId);
            gpJson = gpJson.replaceAll(currentHostPortal, enviremnet.hostPortal);
            gpJson = gpJson.replaceAll(currentNlb, enviremnet.nlb);
            await dbSet('groupPathsContent', JSON.parse(gpJson));
        }
    } catch (error) {
        console.error('Erro em changeEnvironments:', error);
    }
}// recarrega depois

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

    // Busca o primeiro path que tenha integração VPC_LINK para extrair connectionId, NLB e hostPortal
    const vpcLinkEntry = Object.values(jsonData.paths || {}).find(p =>
        p["x-amazon-apigateway-any-method"]?.["x-amazon-apigateway-integration"]?.connectionType === "VPC_LINK"
    );
    if (vpcLinkEntry) {
        const integration = vpcLinkEntry["x-amazon-apigateway-any-method"]["x-amazon-apigateway-integration"];
        if (integration.uri) {
            // Extrai protocolo + host sem porta, preservando o case original
            // ex: "http://HOST:8092/resolve" → "http://HOST"
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
