/**
 * Compara dois valores recursivamente, insensível à ordem das chaves de objetos.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
  }
  return false;
}

/**
 * Valida um grupo de paths contra os paths do API Gateway.
 * @param {Object} groupPaths - Map<path, PathConfig> do grupo
 * @param {Object|null|undefined} apiGatewayPaths - paths do ApiGatewayJSON (jsonData.paths)
 * @returns {{ status: "all-found"|"partial"|"none-found", missingPaths: string[], divergentPaths: string[] }}
 */
function validateGroup(groupPaths, apiGatewayPaths) {
  const keys = Object.keys(groupPaths || {});

  // Grupo vazio → all-found sem nada
  if (keys.length === 0) {
    return { status: "all-found", missingPaths: [], divergentPaths: [] };
  }

  // apiGatewayPaths ausente → none-found com todos os paths como missing
  if (apiGatewayPaths == null) {
    return { status: "none-found", missingPaths: keys, divergentPaths: [] };
  }

  const missingPaths = [];
  const divergentPaths = [];

  for (const path of keys) {
    if (!(path in apiGatewayPaths)) {
      missingPaths.push(path);
    } else {
      // Deep comparison insensível à ordem das chaves
      let isDivergent = false;
      try {
        isDivergent = !deepEqual(groupPaths[path], apiGatewayPaths[path]);
      } catch (_) {
        // Se a comparação falhar (ex: referência circular), considerar divergente
        isDivergent = true;
      }
      if (isDivergent) {
        divergentPaths.push(path);
      }
    }
  }

  let status;
  if (missingPaths.length === 0) {
    status = "all-found";
  } else if (missingPaths.length === keys.length) {
    status = "none-found";
  } else {
    status = "partial";
  }

  return { status, missingPaths, divergentPaths };
}

/**
 * Retorna os paths do API Gateway que não estão em nenhum grupo.
 * @param {Object} groupPaths      - { [groupName]: { [path]: config } }
 * @param {Object} apiGatewayPaths - { [path]: config }
 * @returns {string[]} lista de paths não mapeados
 */
function getUnmappedPaths(groupPaths, apiGatewayPaths) {
  if (apiGatewayPaths == null) return [];

  const apiPaths = Object.keys(apiGatewayPaths);

  if (!groupPaths || Object.keys(groupPaths).length === 0) return apiPaths;

  const mappedPaths = new Set(
    Object.values(groupPaths).flatMap(group => Object.keys(group || {}))
  );

  return apiPaths.filter(path => !mappedPaths.has(path));
}
