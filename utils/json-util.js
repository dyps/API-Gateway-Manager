function jsonEquals(json1, json2) {
    // Se forem estritamente iguais (mesma referência)
    if (json1 === json2) return true;

    // Se um for nulo ou não for objeto
    if (typeof json1 !== 'object' || json1 === null ||
        typeof json2 !== 'object' || json2 === null) {
        return false;
    }

    // Pega as chaves de cada objeto
    const chaves1 = Object.keys(json1);
    const chaves2 = Object.keys(json2);

    // Se o número de chaves for diferente, já é diferente
    if (chaves1.length !== chaves2.length) return false;

    // Verifica cada chave e valor recursivamente
    for (const chave of chaves1) {
        if (!chaves2.includes(chave)) return false;

        const valor1 = json1[chave];
        const valor2 = json2[chave];

        // Recursivo para objetos/arrays
        if (!jsonEquals(valor1, valor2)) return false;
    }

    return true;
}

/**
 * Valida se o dado corresponde ao formato Map<string, Map<string, object>>.
 * @param {*} data - Valor parseado do JSON carregado.
 * @returns {{ valid: true } | { valid: false, message: string }}
 */
function validateGroupPathsStructure(data) {
    // Validar nível raiz
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return { valid: false, message: 'Formato inválido: o nível raiz deve ser um objeto JSON (Map de grupos)' };
    }

    // Validar cada grupo
    for (const g of Object.keys(data)) {
        if (typeof data[g] !== 'object' || data[g] === null || Array.isArray(data[g])) {
            return { valid: false, message: `Formato inválido: o valor do grupo "${g}" deve ser um objeto (Map de paths)` };
        }

        // Validar cada path dentro do grupo
        for (const p of Object.keys(data[g])) {
            if (typeof data[g][p] !== 'object' || data[g][p] === null || Array.isArray(data[g][p])) {
                return { valid: false, message: `Formato inválido: o valor do path "${p}" no grupo "${g}" deve ser um objeto` };
            }
        }
    }

    return { valid: true };
}
