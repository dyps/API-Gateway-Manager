// ─── Construção de skeleton e security definitions ───────────────────────────
// Movido de fixedEnvironments.js — funções puras sem side effects.

function buildSecurityDefinitions(authorizerUri, authorizerCredentials, securityDefinitions) {
    const definitions = {
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
