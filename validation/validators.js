// ─── Validação de estrutura dos JSONs de entrada ─────────────────────────────

/**
 * Valida a estrutura básica esperada de um arquivo exportado do API Gateway.
 * Aceita tanto Swagger 2.0 quanto OpenAPI 3.0.
 * @param {*} data - objeto já parseado
 * @returns {{ valid: boolean, message: string }}
 */
function validateApiGatewayJson(data) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return { valid: false, message: 'Erro: o arquivo do API Gateway deve ser um objeto, não um array.' };
    }

    const specFormat = detectSpecFormat(data);

    if (specFormat === 'swagger2') {
        return validateSwagger2Structure(data);
    }

    if (specFormat === 'oas30') {
        return validateOas30Structure(data);
    }

    // Formato desconhecido — tentar validar pelos paths (pode ser um export sem header)
    if (data.paths && typeof data.paths === 'object' && !Array.isArray(data.paths)) {
        if (Object.keys(data.paths).length === 0) {
            return { valid: true, message: '' };
        }
        return { valid: true, message: '' };
    }

    return { valid: false, message: 'Erro: formato não reconhecido. Esperado Swagger 2.0 ("swagger": "2.0") ou OpenAPI 3.0 ("openapi": "3.0.x").' };
}

/**
 * Valida estrutura específica de Swagger/OpenAPI 2.0.
 */
function validateSwagger2Structure(data) {
    if (!data.paths || typeof data.paths !== 'object' || Array.isArray(data.paths)) {
        return { valid: false, message: 'Erro: o arquivo Swagger 2.0 não contém a chave "paths" ou ela não é um objeto.' };
    }
    if (Object.keys(data.paths).length === 0) {
        return { valid: true, message: '' };
    }

    // Verificar se tem extensões AWS (aviso, não bloqueante)
    const hasIntegrations = checkHasAwsIntegrations(data.paths);
    if (!hasIntegrations) {
        return {
            valid: true,
            message: '',
            warning: 'Aviso: o arquivo não contém extensões "x-amazon-apigateway-integration". Verifique se exportou com a extensão "API Gateway Extensions" habilitada.'
        };
    }

    return { valid: true, message: '' };
}

/**
 * Valida estrutura específica de OpenAPI 3.0.
 */
function validateOas30Structure(data) {
    if (!data.paths || typeof data.paths !== 'object' || Array.isArray(data.paths)) {
        return { valid: false, message: 'Erro: o arquivo OpenAPI 3.0 não contém a chave "paths" ou ela não é um objeto.' };
    }
    if (Object.keys(data.paths).length === 0) {
        return { valid: true, message: '' };
    }

    // Verificar se tem extensões AWS (aviso, não bloqueante)
    const hasIntegrations = checkHasAwsIntegrations(data.paths);
    if (!hasIntegrations) {
        return {
            valid: true,
            message: '',
            warning: 'Aviso: o arquivo não contém extensões "x-amazon-apigateway-integration". Verifique se exportou com a extensão "API Gateway Extensions" habilitada.'
        };
    }

    return { valid: true, message: '' };
}

/**
 * Verifica se pelo menos um path tem x-amazon-apigateway-integration.
 */
function checkHasAwsIntegrations(paths) {
    for (const pathConfig of Object.values(paths)) {
        for (const [method, methodConfig] of Object.entries(pathConfig || {})) {
            if (typeof methodConfig === 'object' && methodConfig?.['x-amazon-apigateway-integration']) {
                return true;
            }
        }
    }
    return false;
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
