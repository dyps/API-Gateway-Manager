// ─── Validação de estrutura dos JSONs de entrada ─────────────────────────────

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
