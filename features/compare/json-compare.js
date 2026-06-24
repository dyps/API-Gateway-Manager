// ─── Feature: Comparação de JSON (lado a lado, tipo jsoneditoronline) ────────

const COMPARE_JSON_KEY = COMPARE_REFERENCE_KEY;

/**
 * Abre o popup de comparação
 */
async function openComparePopup() {
    const overlay = document.getElementById('modalCompare');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    await renderCompareContent();
}

function closeComparePopup() {
    document.getElementById('modalCompare').classList.add('hidden');
    document.body.style.overflow = '';
}

/**
 * Renderiza o conteúdo do popup de comparação
 */
async function renderCompareContent() {
    const leftPanel = document.getElementById('compareLeftPanel');
    const rightPanel = document.getElementById('compareRightPanel');
    const diffArea = document.getElementById('compareDiffArea');
    const uploadArea = document.getElementById('compareUploadArea');

    const savedRef = await dbGet(COMPARE_JSON_KEY);

    if (!savedRef) {
        diffArea.classList.add('hidden');
        uploadArea.classList.remove('hidden');
        leftPanel.innerHTML = '';
        rightPanel.innerHTML = '';
    } else {
        uploadArea.classList.add('hidden');
        diffArea.classList.remove('hidden');
        await renderComparison(savedRef);
    }
}

/**
 * Processa o upload do JSON de referência
 */
async function handleCompareFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        const json = JSON.parse(text);
        await dbSet(COMPARE_JSON_KEY, json);
        document.getElementById('compareFileName').textContent = file.name;
        await renderCompareContent();
    } catch (e) {
        showMessage('Arquivo inválido. Envie um JSON válido.', 'error');
    }
}

/**
 * Remove o JSON de referência salvo
 */
async function clearCompareReference() {
    await dbDelete(COMPARE_JSON_KEY);
    document.getElementById('compareFileName').textContent = 'Nenhum arquivo';
    document.getElementById('compareFileInput').value = '';
    await renderCompareContent();
}

/**
 * Substitui o JSON de referência
 */
async function replaceCompareReference() {
    document.getElementById('compareFileInput').click();
}

// ─── Comparação inteligente ──────────────────────────────────────────────────

/**
 * Renderiza a comparação lado a lado
 */
async function renderComparison(referenceJson) {
    const leftPanel = document.getElementById('compareLeftPanel');
    const rightPanel = document.getElementById('compareRightPanel');

    // JSON que seria baixado (mesmo lógica do download)
    const currentJson = await dbGet('jsonConfigContent');
    if (!currentJson) {
        leftPanel.innerHTML = '<p class="compare-empty">JSON de referência carregado</p>';
        rightPanel.innerHTML = '<p class="compare-empty">Nenhum JSON do API Gateway carregado</p>';
        return;
    }

    const { _isSkeleton, ...downloadJson } = currentJson;

    leftPanel.innerHTML = '';
    rightPanel.innerHTML = '';

    const diff = deepCompare(referenceJson, downloadJson);

    const leftTree = buildCompareTree(referenceJson, diff, 'left');
    const rightTree = buildCompareTree(downloadJson, diff, 'right');

    leftPanel.appendChild(leftTree);
    rightPanel.appendChild(rightTree);
}

/**
 * Compara dois valores recursivamente.
 * Retorna um "mapa de diff" descrevendo o estado de cada campo.
 * 
 * Tipos de status:
 * - 'equal'    → valores iguais
 * - 'modified' → valor existe nos dois mas é diferente
 * - 'removed'  → existe só na referência (esquerda)
 * - 'added'    → existe só no download (direita)
 */
function deepCompare(left, right) {
    if (left === right) return { status: 'equal' };
    if (left === null || left === undefined) return { status: 'added' };
    if (right === null || right === undefined) return { status: 'removed' };

    const typeL = Array.isArray(left) ? 'array' : typeof left;
    const typeR = Array.isArray(right) ? 'array' : typeof right;

    if (typeL !== typeR) return { status: 'modified' };

    if (typeL === 'array') {
        return compareArrays(left, right);
    }

    if (typeL === 'object') {
        return compareObjects(left, right);
    }

    // Primitivos diferentes
    if (left !== right) return { status: 'modified' };
    return { status: 'equal' };
}

/**
 * Compara arrays de forma inteligente (sem considerar ordem).
 * Para cada item do left, tenta encontrar um equivalente no right.
 */
function compareArrays(left, right) {
    const result = { status: 'equal', type: 'array', items: [] };
    const rightUsed = new Set();

    // Para cada item da esquerda, encontra o melhor match na direita
    for (let i = 0; i < left.length; i++) {
        let bestMatch = -1;
        let bestDiff = null;

        for (let j = 0; j < right.length; j++) {
            if (rightUsed.has(j)) continue;
            const d = deepCompare(left[i], right[j]);
            if (d.status === 'equal') {
                bestMatch = j;
                bestDiff = d;
                break;
            }
            if (d.status === 'modified' && bestMatch === -1) {
                // Usa heurística: se são objetos, verifica similaridade
                if (typeof left[i] === 'object' && typeof right[j] === 'object' && !Array.isArray(left[i])) {
                    const similarity = calcSimilarity(left[i], right[j]);
                    if (similarity > 0.5 && bestMatch === -1) {
                        bestMatch = j;
                        bestDiff = d;
                    }
                }
            }
        }

        if (bestMatch !== -1) {
            rightUsed.add(bestMatch);
            result.items.push({ leftIndex: i, rightIndex: bestMatch, diff: bestDiff });
            if (bestDiff.status !== 'equal') result.status = 'modified';
        } else {
            result.items.push({ leftIndex: i, rightIndex: -1, diff: { status: 'removed' } });
            result.status = 'modified';
        }
    }

    // Itens que só existem na direita
    for (let j = 0; j < right.length; j++) {
        if (!rightUsed.has(j)) {
            result.items.push({ leftIndex: -1, rightIndex: j, diff: { status: 'added' } });
            result.status = 'modified';
        }
    }

    return result;
}

/**
 * Compara objetos recursivamente
 */
function compareObjects(left, right) {
    const result = { status: 'equal', type: 'object', children: {} };
    const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);

    for (const key of allKeys) {
        const inLeft = key in left;
        const inRight = key in right;

        if (inLeft && inRight) {
            const childDiff = deepCompare(left[key], right[key]);
            result.children[key] = childDiff;
            if (childDiff.status !== 'equal') result.status = 'modified';
        } else if (inLeft && !inRight) {
            result.children[key] = { status: 'removed' };
            result.status = 'modified';
        } else {
            result.children[key] = { status: 'added' };
            result.status = 'modified';
        }
    }

    return result;
}

/**
 * Calcula similaridade entre dois objetos (% de chaves iguais)
 */
function calcSimilarity(a, b) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    const allKeys = new Set([...keysA, ...keysB]);
    if (allKeys.size === 0) return 1;
    let matches = 0;
    for (const k of allKeys) {
        if (k in a && k in b && JSON.stringify(a[k]) === JSON.stringify(b[k])) {
            matches++;
        }
    }
    return matches / allKeys.size;
}

// ─── Renderização da árvore ──────────────────────────────────────────────────

/**
 * Constrói a árvore visual de um lado (left ou right)
 */
function buildCompareTree(data, diff, side) {
    const container = document.createElement('div');
    container.className = 'cmp-tree';
    const root = createTreeNode('root', data, diff, side, 0);
    container.appendChild(root);
    return container;
}

/**
 * Cria um nó da árvore (recursivo)
 */
function createTreeNode(key, value, diff, side, depth) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cmp-node';
    wrapper.style.paddingLeft = (depth * 16) + 'px';

    const type = Array.isArray(value) ? 'array' : typeof value;
    const isExpandable = (type === 'object' || type === 'array') && value !== null;

    // Determina a cor de fundo baseada no status do diff
    const bgClass = getDiffBgClass(diff, side);

    const row = document.createElement('div');
    row.className = 'cmp-row' + (bgClass ? ' ' + bgClass : '');

    if (isExpandable) {
        const toggle = document.createElement('span');
        toggle.className = 'cmp-toggle';
        toggle.textContent = '▶';
        row.appendChild(toggle);

        const label = document.createElement('span');
        label.className = 'cmp-key';
        const count = type === 'array' ? value.length : Object.keys(value).length;
        const bracket = type === 'array' ? `[${count}]` : `{${count}}`;
        label.textContent = key === 'root' ? bracket : `${key}: ${bracket}`;
        row.appendChild(label);

        wrapper.appendChild(row);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'cmp-children hidden';

        if (type === 'object' && diff && diff.type === 'object') {
            const keys = Object.keys(value);
            for (const childKey of keys) {
                const childDiff = diff.children ? diff.children[childKey] : null;
                const childNode = createTreeNode(childKey, value[childKey], childDiff, side, depth + 1);
                childrenContainer.appendChild(childNode);
            }
            // Chaves que não existem neste lado mas existem no outro
            if (diff.children) {
                for (const childKey of Object.keys(diff.children)) {
                    if (!(childKey in value)) {
                        const ghostNode = createGhostNode(childKey, diff.children[childKey], side, depth + 1);
                        if (ghostNode) childrenContainer.appendChild(ghostNode);
                    }
                }
            }
        } else if (type === 'array' && diff && diff.type === 'array') {
            renderArrayChildren(childrenContainer, value, diff, side, depth);
        } else {
            // Sem diff info detalhada — renderiza normalmente
            if (type === 'array') {
                value.forEach((item, i) => {
                    const childNode = createTreeNode(String(i), item, null, side, depth + 1);
                    childrenContainer.appendChild(childNode);
                });
            } else {
                for (const childKey of Object.keys(value)) {
                    const childNode = createTreeNode(childKey, value[childKey], null, side, depth + 1);
                    childrenContainer.appendChild(childNode);
                }
            }
        }

        wrapper.appendChild(childrenContainer);

        // Toggle expand/collapse
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !childrenContainer.classList.contains('hidden');
            if (isOpen) {
                childrenContainer.classList.add('hidden');
                toggle.textContent = '▶';
            } else {
                childrenContainer.classList.remove('hidden');
                toggle.textContent = '▼';
            }
        });

        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            toggle.click();
        });

        // Se há diferenças, auto-expandir o primeiro nível
        if (depth === 0) {
            childrenContainer.classList.remove('hidden');
            toggle.textContent = '▼';
        }

    } else {
        // Valor primitivo
        const label = document.createElement('span');
        label.className = 'cmp-key';
        label.textContent = key === 'root' ? '' : `${key}: `;
        row.appendChild(label);

        const val = document.createElement('span');
        val.className = 'cmp-value ' + getValueClass(value);
        val.textContent = formatPrimitive(value);
        row.appendChild(val);

        wrapper.appendChild(row);
    }

    return wrapper;
}

/**
 * Renderiza filhos de um array usando o diff inteligente
 */
function renderArrayChildren(container, value, diff, side, depth) {
    if (!diff || !diff.items) {
        value.forEach((item, i) => {
            const childNode = createTreeNode(String(i), item, null, side, depth + 1);
            container.appendChild(childNode);
        });
        return;
    }

    if (side === 'left') {
        for (const item of diff.items) {
            if (item.leftIndex === -1) continue; // só existe na direita
            const childDiff = item.diff;
            const childNode = createTreeNode(String(item.leftIndex), value[item.leftIndex], childDiff, side, depth + 1);
            container.appendChild(childNode);
        }
        // Ghost nodes para itens que só existem na direita
        for (const item of diff.items) {
            if (item.leftIndex === -1 && item.rightIndex !== -1) {
                const ghost = document.createElement('div');
                ghost.className = 'cmp-node';
                ghost.style.paddingLeft = ((depth + 1) * 16) + 'px';
                const row = document.createElement('div');
                row.className = 'cmp-row cmp-bg-green';
                const label = document.createElement('span');
                label.className = 'cmp-key cmp-ghost';
                label.textContent = `[${item.rightIndex}]: (só no download)`;
                row.appendChild(label);
                ghost.appendChild(row);
                container.appendChild(ghost);
            }
        }
    } else {
        for (const item of diff.items) {
            if (item.rightIndex === -1) continue; // só existe na esquerda
            const childDiff = item.diff;
            const childNode = createTreeNode(String(item.rightIndex), value[item.rightIndex], childDiff, side, depth + 1);
            container.appendChild(childNode);
        }
        // Ghost nodes para itens que só existem na esquerda
        for (const item of diff.items) {
            if (item.rightIndex === -1 && item.leftIndex !== -1) {
                const ghost = document.createElement('div');
                ghost.className = 'cmp-node';
                ghost.style.paddingLeft = ((depth + 1) * 16) + 'px';
                const row = document.createElement('div');
                row.className = 'cmp-row cmp-bg-red';
                const label = document.createElement('span');
                label.className = 'cmp-key cmp-ghost';
                label.textContent = `[${item.leftIndex}]: (só na referência)`;
                row.appendChild(label);
                ghost.appendChild(row);
                container.appendChild(ghost);
            }
        }
    }
}

/**
 * Cria nó fantasma para chaves que não existem neste lado
 */
function createGhostNode(key, diff, side, depth) {
    // Se está no lado esquerdo e o status é 'added', mostra fantasma verde
    // Se está no lado direito e o status é 'removed', mostra fantasma vermelho
    if (side === 'left' && diff.status === 'added') {
        const ghost = document.createElement('div');
        ghost.className = 'cmp-node';
        ghost.style.paddingLeft = (depth * 16) + 'px';
        const row = document.createElement('div');
        row.className = 'cmp-row cmp-bg-green';
        const label = document.createElement('span');
        label.className = 'cmp-key cmp-ghost';
        label.textContent = `${key}: (só no download)`;
        row.appendChild(label);
        ghost.appendChild(row);
        return ghost;
    }
    if (side === 'right' && diff.status === 'removed') {
        const ghost = document.createElement('div');
        ghost.className = 'cmp-node';
        ghost.style.paddingLeft = (depth * 16) + 'px';
        const row = document.createElement('div');
        row.className = 'cmp-row cmp-bg-red';
        const label = document.createElement('span');
        label.className = 'cmp-key cmp-ghost';
        label.textContent = `${key}: (só na referência)`;
        row.appendChild(label);
        ghost.appendChild(row);
        return ghost;
    }
    return null;
}

/**
 * Retorna a classe CSS de background baseada no diff
 */
function getDiffBgClass(diff, side) {
    if (!diff) return '';
    switch (diff.status) {
        case 'equal': return '';
        case 'modified': return 'cmp-bg-yellow';
        case 'removed': return side === 'left' ? 'cmp-bg-red' : '';
        case 'added': return side === 'right' ? 'cmp-bg-green' : '';
        default: return '';
    }
}

function getValueClass(value) {
    if (value === null) return 'cmp-val-null';
    if (typeof value === 'string') return 'cmp-val-string';
    if (typeof value === 'number') return 'cmp-val-number';
    if (typeof value === 'boolean') return 'cmp-val-bool';
    return '';
}

function formatPrimitive(value) {
    if (value === null) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    return String(value);
}
