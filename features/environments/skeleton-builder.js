// ─── Construção de skeleton e security definitions ───────────────────────────
// Movido de fixedEnvironments.js — funções puras sem side effects.

function buildSecurityDefinitions(authorizerUri, authorizerCredentials, securityDefinitions, primaryAuthName) {
    // Determinar o nome do autorizador primário.
    // Se não informado, inferir: o que NÃO está em securityDefinitions extras é o primário.
    // Fallback: primeiro nome encontrado em authorizerNames salvo, ou "lambda-authorizer".
    let resolvedPrimaryName = primaryAuthName;

    if (!resolvedPrimaryName) {
        // Se há securityDefinitions extras, o primário é o que NÃO está lá
        const extraNames = securityDefinitions ? Object.keys(securityDefinitions) : [];
        const savedNames = window._authorizerNames || [];
        if (savedNames.length > 0 && extraNames.length > 0) {
            resolvedPrimaryName = savedNames.find(n => !extraNames.includes(n)) || savedNames[0];
        } else if (savedNames.length > 0) {
            resolvedPrimaryName = savedNames[0];
        } else {
            resolvedPrimaryName = 'lambda-authorizer';
        }
    }

    const definitions = {
        [resolvedPrimaryName]: {
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

    if (securityDefinitions && typeof securityDefinitions === 'object') {
        for (const [key, def] of Object.entries(securityDefinitions)) {
            const authorizer = def["x-amazon-apigateway-authorizer"] || {};
            definitions[key] = {
                ...def,
                "x-amazon-apigateway-authtype": def["x-amazon-apigateway-authtype"] || "custom",
                "x-amazon-apigateway-authorizer": {
                    ...authorizer,
                    "authorizerUri": authorizer.authorizerUri || authorizerUri,
                    "authorizerCredentials": authorizer.authorizerCredentials || authorizerCredentials,
                    "authorizerResultTtlInSeconds": authorizer.authorizerResultTtlInSeconds ?? 0
                }
            };
        }
    }

    return definitions;
}

function buildSkeletonApiGateway(environment) {
    const skeleton = {
        "swagger": "2.0",
        "info": {
            "title": environment.title || environment.name,
            "description": environment.description || "",
            "version": generateVersion()
        },
        "host": environment.host || "",
        "basePath": environment.basePath || "/",
        "schemes": ["https"],
        "paths": {},
        "_isSkeleton": true
    };

    if (environment["x-amazon-apigateway-security-policy"]) {
        skeleton["x-amazon-apigateway-security-policy"] = environment["x-amazon-apigateway-security-policy"];
    }
    if (environment["x-amazon-apigateway-endpoint-configuration"]) {
        skeleton["x-amazon-apigateway-endpoint-configuration"] = environment["x-amazon-apigateway-endpoint-configuration"];
    }
    if (environment["x-amazon-apigateway-policy"]) {
        skeleton["x-amazon-apigateway-policy"] = environment["x-amazon-apigateway-policy"];
    }
    if (environment.authorizerCredentials && environment.authorizerUri) {
        skeleton["securityDefinitions"] = buildSecurityDefinitions(environment.authorizerUri, environment.authorizerCredentials, environment.securityDefinitions);

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
}
