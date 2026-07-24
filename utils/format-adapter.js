// ─── Adaptador de Formatos (Swagger 2.0 / OpenAPI 3.0 / JSON / YAML) ─────────
// Módulo responsável por detectar e normalizar diferentes formatos de exportação
// do AWS API Gateway para a estrutura interna do app (baseada em Swagger 2.0).

/**
 * Tenta parsear o conteúdo de um arquivo (JSON ou YAML).
 * @param {string} text - conteúdo bruto do arquivo
 * @param {string} filename - nome do arquivo (para detectar extensão)
 * @returns {{ data: any, format: 'json'|'yaml' }} objeto parseado + formato detectado
 * @throws {Error} se não conseguir parsear em nenhum formato
 */
function parseFileContent(text, filename) {
    const ext = filename.toLowerCase().split('.').pop();

    // Tentar JSON primeiro (mais comum e mais rápido)
    if (ext === 'json' || ext !== 'yaml' && ext !== 'yml') {
        try {
            return { data: JSON.parse(text), format: 'json' };
        } catch (jsonErr) {
            // Se extensão era .json, falha direto
            if (ext === 'json') {
                throw new Error('Arquivo JSON inválido: ' + jsonErr.message);
            }
            // Senão, tenta YAML abaixo
        }
    }

    // Tentar YAML
    if (typeof jsyaml !== 'undefined') {
        try {
            const data = jsyaml.load(text);
            if (data && typeof data === 'object') {
                return { data, format: 'yaml' };
            }
            throw new Error('Conteúdo YAML não resultou em um objeto válido.');
        } catch (yamlErr) {
            throw new Error('Não foi possível parsear o arquivo como JSON nem YAML: ' + yamlErr.message);
        }
    }

    // js-yaml não está disponível
    throw new Error('Formato YAML não suportado (biblioteca js-yaml não carregada). Use um arquivo JSON.');
}

/**
 * Detecta o formato de especificação de um objeto já parseado.
 * @param {object} data - objeto parseado do arquivo
 * @returns {'swagger2'|'oas30'|'unknown'}
 */
function detectSpecFormat(data) {
    if (!data || typeof data !== 'object') return 'unknown';
    if (data.swagger === '2.0') return 'swagger2';
    if (typeof data.openapi === 'string' && data.openapi.startsWith('3.')) return 'oas30';
    return 'unknown';
}

/**
 * Normaliza um documento OpenAPI 3.0 para a estrutura interna (equivalente Swagger 2.0).
 * A conversão foca nos campos usados pelo app:
 * - servers → host, basePath, schemes
 * - components.securitySchemes → securityDefinitions
 * - components.schemas → definitions
 * - paths → copia direto (extensões AWS são idênticas)
 * 
 * Adiciona `_sourceFormat: 'oas30'` para permitir reconversão no download.
 * 
 * @param {object} oas30Data - documento OpenAPI 3.0
 * @returns {object} documento normalizado (estrutura Swagger 2.0)
 */
function normalizeOas30ToInternal(oas30Data) {
    const normalized = {};

    // Marcar formato de origem
    normalized._sourceFormat = 'oas30';
    normalized._originalOpenApiVersion = oas30Data.openapi;

    // swagger field (para compatibilidade interna)
    normalized.swagger = '2.0';

    // info (idêntico em ambos)
    if (oas30Data.info) {
        normalized.info = { ...oas30Data.info };
    }

    // servers → host, basePath, schemes
    if (Array.isArray(oas30Data.servers) && oas30Data.servers.length > 0) {
        const serverUrl = oas30Data.servers[0].url || '';
        const parsed = parseServerUrl(serverUrl);
        normalized.host = parsed.host;
        normalized.basePath = parsed.basePath;
        normalized.schemes = parsed.schemes;
    } else {
        normalized.host = '';
        normalized.basePath = '/';
        normalized.schemes = ['https'];
    }

    // components.securitySchemes → securityDefinitions
    const secSchemes = oas30Data.components?.securitySchemes;
    if (secSchemes && typeof secSchemes === 'object') {
        normalized.securityDefinitions = convertSecuritySchemes(secSchemes);
    }

    // components.schemas → definitions (raramente usado pelo app, mas preserva)
    if (oas30Data.components?.schemas) {
        normalized.definitions = { ...oas30Data.components.schemas };
    }

    // paths (estrutura e extensões AWS são idênticas em ambos formatos)
    if (oas30Data.paths) {
        normalized.paths = oas30Data.paths;
    }

    // Extensões AWS de raiz (copiar direto — são iguais em OAS2 e OAS3)
    const awsExtensions = [
        'x-amazon-apigateway-gateway-responses',
        'x-amazon-apigateway-request-validators',
        'x-amazon-apigateway-security-policy',
        'x-amazon-apigateway-endpoint-configuration',
        'x-amazon-apigateway-policy'
    ];
    for (const ext of awsExtensions) {
        if (oas30Data[ext] !== undefined) {
            normalized[ext] = oas30Data[ext];
        }
    }

    return normalized;
}

/**
 * Converte um documento interno (Swagger 2.0) de volta para OpenAPI 3.0.
 * Usado no download quando o arquivo original era OAS 3.0.
 * 
 * @param {object} internalData - documento no formato interno
 * @returns {object} documento OpenAPI 3.0
 */
function convertInternalToOas30(internalData) {
    const oas30 = {};

    oas30.openapi = internalData._originalOpenApiVersion || '3.0.1';

    // info
    if (internalData.info) {
        oas30.info = { ...internalData.info };
    }

    // host + basePath + schemes → servers
    const scheme = (internalData.schemes && internalData.schemes[0]) || 'https';
    const host = internalData.host || '';
    const basePath = internalData.basePath || '/';
    if (host) {
        oas30.servers = [{ url: `${scheme}://${host}${basePath === '/' ? '' : basePath}` }];
    }

    // securityDefinitions → components.securitySchemes
    if (internalData.securityDefinitions) {
        oas30.components = oas30.components || {};
        oas30.components.securitySchemes = convertSecurityDefsToSchemes(internalData.securityDefinitions);
    }

    // definitions → components.schemas
    if (internalData.definitions) {
        oas30.components = oas30.components || {};
        oas30.components.schemas = { ...internalData.definitions };
    }

    // paths
    if (internalData.paths) {
        oas30.paths = internalData.paths;
    }

    // Extensões AWS de raiz
    const awsExtensions = [
        'x-amazon-apigateway-gateway-responses',
        'x-amazon-apigateway-request-validators',
        'x-amazon-apigateway-security-policy',
        'x-amazon-apigateway-endpoint-configuration',
        'x-amazon-apigateway-policy'
    ];
    for (const ext of awsExtensions) {
        if (internalData[ext] !== undefined) {
            oas30[ext] = internalData[ext];
        }
    }

    return oas30;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Parseia uma URL de server OAS3 em host, basePath e schemes.
 * Ex: "https://abc123.execute-api.us-east-1.amazonaws.com/dev"
 *   → { host: "abc123.execute-api.us-east-1.amazonaws.com", basePath: "/dev", schemes: ["https"] }
 */
function parseServerUrl(url) {
    const result = { host: '', basePath: '/', schemes: ['https'] };

    try {
        // Tratar variáveis de servidor {variable} substituindo por placeholder
        const cleanUrl = url.replace(/\{[^}]+\}/g, 'placeholder');
        const parsed = new URL(cleanUrl);
        result.schemes = [parsed.protocol.replace(':', '')];
        // Usar o host original (sem substituição de variáveis)
        const hostMatch = url.match(/^https?:\/\/([^/]+)/);
        result.host = hostMatch ? hostMatch[1] : parsed.host;
        // basePath: tudo após o host
        const pathMatch = url.match(/^https?:\/\/[^/]+(\/.*)/);
        result.basePath = pathMatch ? pathMatch[1] : '/';
        // Remover trailing slash exceto se é só "/"
        if (result.basePath.length > 1 && result.basePath.endsWith('/')) {
            result.basePath = result.basePath.slice(0, -1);
        }
    } catch (e) {
        // Se não conseguir parsear, tenta extrair direto
        const hostMatch = url.match(/^https?:\/\/([^/]+)/);
        if (hostMatch) result.host = hostMatch[1];
    }

    return result;
}

/**
 * Converte OAS3 securitySchemes para Swagger 2.0 securityDefinitions.
 * As extensões x-amazon-apigateway-* são preservadas intactas.
 */
function convertSecuritySchemes(schemes) {
    const defs = {};
    for (const [name, scheme] of Object.entries(schemes)) {
        const def = {};

        // Mapear tipos OAS3 → Swagger 2.0
        if (scheme.type === 'apiKey') {
            def.type = 'apiKey';
            def.name = scheme.name || 'Authorization';
            def.in = scheme.in || 'header';
        } else if (scheme.type === 'http' && scheme.scheme === 'bearer') {
            // bearer em OAS3 → apiKey em Swagger 2.0 (API Gateway usa apiKey)
            def.type = 'apiKey';
            def.name = 'Authorization';
            def.in = 'header';
        } else if (scheme.type === 'oauth2') {
            def.type = 'oauth2';
            // Simplificar — copiar o que houver
            if (scheme.flows) def.flows = scheme.flows;
        } else {
            // Tipo desconhecido — preservar como está
            def.type = scheme.type || 'apiKey';
        }

        // Copiar extensões AWS (são as mesmas em ambos os formatos)
        for (const [key, val] of Object.entries(scheme)) {
            if (key.startsWith('x-amazon-apigateway-')) {
                def[key] = val;
            }
        }

        defs[name] = def;
    }
    return defs;
}

/**
 * Converte Swagger 2.0 securityDefinitions para OAS3 securitySchemes.
 * Inverso de convertSecuritySchemes.
 */
function convertSecurityDefsToSchemes(defs) {
    const schemes = {};
    for (const [name, def] of Object.entries(defs)) {
        const scheme = {};

        if (def.type === 'apiKey') {
            scheme.type = 'apiKey';
            scheme.name = def.name || 'Authorization';
            scheme.in = def.in || 'header';
        } else if (def.type === 'oauth2') {
            scheme.type = 'oauth2';
            if (def.flows) scheme.flows = def.flows;
        } else {
            scheme.type = def.type || 'apiKey';
        }

        // Copiar extensões AWS
        for (const [key, val] of Object.entries(def)) {
            if (key.startsWith('x-amazon-apigateway-')) {
                scheme[key] = val;
            }
        }

        schemes[name] = scheme;
    }
    return schemes;
}

/**
 * Verifica se o arquivo aceito é de um formato suportado.
 * @param {string} filename
 * @returns {boolean}
 */
function isAcceptedFileFormat(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    return ['json', 'yaml', 'yml'].includes(ext);
}
