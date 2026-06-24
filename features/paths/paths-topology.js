/**
 * Topologia dos Paths — SVG com elbow connectors reais (fan-out e fan-in).
 *
 * Layout em 5 colunas, esquerda → direita:
 *   Col 0: API Gateway   (1 nó)
 *   Col 1: Autorizadores (N nós)
 *   Col 2: Paths         (N nós, agrupados por auth+nlb+porta)
 *   Col 3: NLBs          (M nós, deduplicados por hostname)
 *   Col 4: Portas        (P nós, deduplicadas por nlb+porta)
 *
 * Conectores:
 *   - fan-out: 1 ponto de saída → N pontos de chegada  (linha que se bifurca)
 *   - fan-in:  N pontos de saída → 1 ponto de chegada  (linhas que convergem)
 *   - 1-para-1: linha reta com seta
 *
 * ─── TAMANHOS DOS BALÕES ─────────────────────────────────────────────────────
 * Edite BALLOON_SIZES para ajustar largura e altura de cada tipo.
 */
const BALLOON_SIZES = {
    //         w(px)  h(px)
    root:       { w: 140, h: 48 },
    authorizer: { w: 200, h: 48 },
    paths:      { w: 150, h: 48 },
    nlb:        { w: 380, h: 48 },
    port:       { w: 90,  h: 36 },
    mock:       { w: 120, h: 48 },
};

// Espaço horizontal entre colunas (onde as setas passam)
const COL_GAP   = 80;
// Espaço vertical entre nós da mesma coluna
const ROW_GAP   = 16;
// Padding externo do SVG
const SVG_PAD   = 24;

// ─── Extração de dados ────────────────────────────────────────────────────────

function extractPathInfo(pathConfig) {
    let authorizer = null, nlb = null, port = null, integrationType = null;
    for (const method of Object.keys(pathConfig || {})) {
        if (method === 'options') continue;
        const m = pathConfig[method];
        if (!authorizer && m.security?.length > 0)
            authorizer = Object.keys(m.security[0])[0];
        const integ = m['x-amazon-apigateway-integration'];
        if (integ) {
            integrationType = integ.type || null;
            if (integ.uri && integ.type === 'http') {
                const match = integ.uri.match(/^https?:\/\/([^:/]+)(?::(\d+))?/);
                if (match) { nlb = match[1]; port = match[2] || '80'; }
            }
        }
        if (nlb && integrationType) break;
    }
    return {
        authorizer: authorizer || 'Sem Autorizador',
        nlb, port,
        integrationType: integrationType || 'unknown',
    };
}

function buildTopology(apiGatewayPaths) {
    // authorizer → Map< nlbPortKey, { paths[], nlb, port, integrationType } >
    const topology = new Map();
    for (const [pathKey, pathConfig] of Object.entries(apiGatewayPaths || {})) {
        const { authorizer, nlb, port, integrationType } = extractPathInfo(pathConfig);
        if (!topology.has(authorizer)) topology.set(authorizer, new Map());
        const authMap = topology.get(authorizer);
        const nlbPortKey = nlb
            ? `${nlb}:${port}`
            : integrationType === 'mock' ? '(mock)' : '(sem destino)';
        if (!authMap.has(nlbPortKey))
            authMap.set(nlbPortKey, { paths: [], nlb, port, integrationType });
        authMap.get(nlbPortKey).paths.push(pathKey);
    }
    return topology;
}

// ─── Layout: calcula posição (x, y) de cada nó ───────────────────────────────

function computeLayout(topology, securityDefinitions) {
    const NO_AUTH = 'Sem Autorizador';

    // Ordenar autorizadores: reais primeiro, sem-autorizador por último
    const sortedAuths = [...topology.keys()].sort((a, b) => {
        if (a === NO_AUTH) return 1;
        if (b === NO_AUTH) return -1;
        return a.localeCompare(b);
    });

    // ── Construir nós por coluna ──────────────────────────────────────────────

    // Col 0: API Gateway (único)
    const rootNode = { id: 'root', type: 'root', label: 'API Gateway', col: 0 };

    // Col 1: Autorizadores
    const authNodes = sortedAuths.map(auth => {
        let authType = '';
        let identitySource = '';
        if (auth !== NO_AUTH && securityDefinitions && securityDefinitions[auth]) {
            const def = securityDefinitions[auth];
            const authorizerExt = def['x-amazon-apigateway-authorizer'] || {};
            authType = authorizerExt.type || ''; // "token" ou "request"
            const inType = def.in; // "header" ou "query"
            const paramName = def.name; // ex: "Authorization"

            if (inType && paramName) {
                identitySource = `Em ${inType}: ${paramName}`;
            } else if (inType) {
                identitySource = `Em ${inType}`;
            } else {
                identitySource = 'Sem header ou param especificado';
            }
        } else if (auth !== NO_AUTH) {
            identitySource = 'Sem header ou param especificado';
        }
        return {
            id: `auth:${auth}`,
            type: auth === NO_AUTH ? 'noauth' : 'authorizer',
            label: auth,
            sublabel: authType ? `Tipo: ${authType}` : undefined,
            sublabel2: identitySource || undefined,
            col: 1,
            auth,
        };
    });

    // Col 2: Grupos de paths (auth × nlbPortKey)
    // Col 3: NLBs (deduplicados por hostname)
    // Col 4: Portas (deduplicadas por nlbHostname+port)
    const pathNodes = [];
    const nlbNodeMap  = new Map(); // nlbHostname → node
    const portNodeMap = new Map(); // "nlbHostname:port" → node

    // Edges: from id → to id[]
    const edges = []; // { from, to }

    // API GW → cada autorizador
    for (const an of authNodes) {
        edges.push({ from: 'root', to: an.id });
    }

    for (const auth of sortedAuths) {
        const nlbMap = topology.get(auth);
        const authId = `auth:${auth}`;

        for (const [nlbPortKey, { paths, nlb, port, integrationType }] of nlbMap) {
            const isMock = integrationType === 'mock' || !nlb;
            const pathNodeId = `paths:${auth}:${nlbPortKey}`;

            const pathNode = {
                id: pathNodeId,
                type: 'paths',
                col: 2,
                label: `${paths.length} path${paths.length !== 1 ? 's' : ''}`,
                sublabel: isMock ? 'mock' : `:${port}`,
                paths,
                isMock,
            };
            pathNodes.push(pathNode);

            // Auth → Paths
            edges.push({ from: authId, to: pathNodeId });

            if (isMock) {
                // Paths → Mock node (col 3)
                const mockId = `mock:${auth}:${nlbPortKey}`;
                if (!nlbNodeMap.has(mockId)) {
                    nlbNodeMap.set(mockId, {
                        id: mockId, type: 'mock', col: 3,
                        label: 'mock', sublabel: 'sem backend',
                    });
                }
                edges.push({ from: pathNodeId, to: mockId });
            } else {
                // NLB (col 3) — deduplicado por hostname
                if (!nlbNodeMap.has(nlb)) {
                    const short = nlb.split('.')[0];
                    nlbNodeMap.set(nlb, {
                        id: `nlb:${nlb}`, type: 'nlb', col: 3,
                        label: short, sublabel: nlb,
                    });
                }
                const nlbId = `nlb:${nlb}`;
                edges.push({ from: pathNodeId, to: nlbId });

                // Porta (col 4) — deduplicada por nlbHostname:port
                const portKey = `${nlb}:${port}`;
                if (!portNodeMap.has(portKey)) {
                    portNodeMap.set(portKey, {
                        id: `port:${portKey}`, type: 'port', col: 4,
                        label: `:${port}`, sublabel: 'porta',
                    });
                }
                const portId = `port:${portKey}`;
                edges.push({ from: nlbId, to: portId });
            }
        }
    }

    const nlbNodes  = [...nlbNodeMap.values()];
    const portNodes = [...portNodeMap.values()];

    // ── Atribuir posições Y por BLOCO ─────────────────────────────────────────
    // Cada autorizador define um bloco vertical exclusivo.
    // Os paths filhos desse auth ficam dentro do bloco.
    // NLBs e portas são posicionados depois, centrados na faixa Y de seus paths conectados.

    // Mapear auth → seus pathNodes (mocks por último dentro de cada grupo)
    const authToPathNodes = new Map();
    for (const auth of sortedAuths) {
        const authId = `auth:${auth}`;
        const childPaths = pathNodes.filter(pn =>
            edges.some(e => e.from === authId && e.to === pn.id)
        );
        // Ordenar: paths com NLB real primeiro, mocks por último
        childPaths.sort((a, b) => (a.isMock ? 1 : 0) - (b.isMock ? 1 : 0));
        authToPathNodes.set(auth, childPaths);
    }

    // Layout Y: posicionar paths em sequência, agrupar por bloco de auth
    let currentY = SVG_PAD;
    const authBlockY = new Map(); // auth → { yStart, yEnd }

    for (const auth of sortedAuths) {
        const childPaths = authToPathNodes.get(auth);
        const blockStart = currentY;

        for (const pn of childPaths) {
            const h = BALLOON_SIZES[pn.type]?.h ?? 48;
            pn.y = currentY;
            pn.h = h;
            currentY += h + ROW_GAP;
        }

        const blockEnd = currentY - ROW_GAP;
        authBlockY.set(auth, { yStart: blockStart, yEnd: blockEnd });

        // Separação extra entre blocos de autorizadores
        currentY += ROW_GAP;
    }

    // Autorizador: centrado verticalmente em seu bloco
    for (let i = 0; i < sortedAuths.length; i++) {
        const auth = sortedAuths[i];
        const block = authBlockY.get(auth);
        const authH = BALLOON_SIZES[authNodes[i].type]?.h ?? 48;
        authNodes[i].y = Math.round((block.yStart + block.yEnd) / 2 - authH / 2);
        authNodes[i].h = authH;
    }

    // Root: centrado na totalidade dos nós
    const globalYEnd = currentY - ROW_GAP;
    const rootH = BALLOON_SIZES.root.h;
    rootNode.y = Math.round((SVG_PAD + globalYEnd) / 2 - rootH / 2);
    rootNode.h = rootH;

    // NLBs: posicionar centrado na faixa Y de todos os paths que apontam para ele
    for (const nlbNode of nlbNodes) {
        const incomingPathIds = edges
            .filter(e => e.to === nlbNode.id)
            .map(e => e.from);
        const connectedPaths = pathNodes.filter(pn => incomingPathIds.includes(pn.id));
        if (connectedPaths.length > 0) {
            const minY = Math.min(...connectedPaths.map(p => p.y));
            const maxY = Math.max(...connectedPaths.map(p => p.y + (p.h || 48)));
            const nlbH = BALLOON_SIZES[nlbNode.type]?.h ?? 48;
            nlbNode.y = Math.round((minY + maxY) / 2 - nlbH / 2);
            nlbNode.h = nlbH;
        } else {
            nlbNode.y = SVG_PAD;
            nlbNode.h = BALLOON_SIZES[nlbNode.type]?.h ?? 48;
        }
    }

    // Portas: posicionar centrado na faixa Y dos NLBs que apontam para ela
    for (const portNode of portNodes) {
        const incomingNlbIds = edges
            .filter(e => e.to === portNode.id)
            .map(e => e.from);
        const connectedNlbs = nlbNodes.filter(n => incomingNlbIds.includes(n.id));
        if (connectedNlbs.length > 0) {
            const minY = Math.min(...connectedNlbs.map(n => n.y));
            const maxY = Math.max(...connectedNlbs.map(n => n.y + (n.h || 48)));
            const portH = BALLOON_SIZES[portNode.type]?.h ?? 36;
            portNode.y = Math.round((minY + maxY) / 2 - portH / 2);
            portNode.h = portH;
        } else {
            portNode.y = SVG_PAD;
            portNode.h = BALLOON_SIZES[portNode.type]?.h ?? 36;
        }
    }

    // Resolver colisões Y em NLBs (podem ter sido centrados no mesmo Y)
    nlbNodes.sort((a, b) => a.y - b.y);
    for (let i = 1; i < nlbNodes.length; i++) {
        const prev = nlbNodes[i - 1];
        const curr = nlbNodes[i];
        const minY = prev.y + prev.h + ROW_GAP;
        if (curr.y < minY) curr.y = minY;
    }

    // Resolver colisões Y em portas
    portNodes.sort((a, b) => a.y - b.y);
    for (let i = 1; i < portNodes.length; i++) {
        const prev = portNodes[i - 1];
        const curr = portNodes[i];
        const minY = prev.y + prev.h + ROW_GAP;
        if (curr.y < minY) curr.y = minY;
    }

    // Calcular altura total final
    const allYEnds = [rootNode, ...authNodes, ...pathNodes, ...nlbNodes, ...portNodes]
        .map(n => n.y + (n.h || 48));
    const totalH = Math.max(...allYEnds) + SVG_PAD;

    // ── Atribuir posições X por coluna ────────────────────────────────────────
    // x = borda esquerda do balão
    const colX = [0, 1, 2, 3, 4].map(col => {
        let x = SVG_PAD;
        if (col >= 1) x += BALLOON_SIZES.root.w + COL_GAP;
        if (col >= 2) x += BALLOON_SIZES.authorizer.w + COL_GAP;
        if (col >= 3) x += BALLOON_SIZES.paths.w + COL_GAP;
        if (col >= 4) x += BALLOON_SIZES.nlb.w + COL_GAP;
        return x;
    });

    const totalW = colX[4] + BALLOON_SIZES.port.w + SVG_PAD;

    // Atribuir x a cada nó
    const allNodes = [rootNode, ...authNodes, ...pathNodes, ...nlbNodes, ...portNodes];
    for (const n of allNodes) {
        n.x = colX[n.col];
    }

    // Índice rápido id → node
    const nodeById = new Map(allNodes.map(n => [n.id, n]));

    return { allNodes, edges, nodeById, totalW, totalH };
}

// ─── Helpers visuais ──────────────────────────────────────────────────────────

const BALLOON_META = {
    root:       { icon: '🌐', cls: 'tb-root' },
    authorizer: { icon: '🔐', cls: 'tb-authorizer' },
    noauth:     { icon: '🔓', cls: 'tb-authorizer' },
    paths:      { icon: '📋', cls: 'tb-paths' },
    nlb:        { icon: '⚡', cls: 'tb-nlb' },
    port:       { icon: '🔌', cls: 'tb-port' },
    mock:       { icon: '🔁', cls: 'tb-mock' },
};

// Ponto de saída (borda direita, centro vertical) de um nó
function exitPoint(n) {
    const w = BALLOON_SIZES[n.type]?.w ?? BALLOON_SIZES.authorizer.w;
    const h = BALLOON_SIZES[n.type]?.h ?? BALLOON_SIZES.authorizer.h;
    return { x: n.x + w, y: n.y + h / 2 };
}

// Ponto de entrada (borda esquerda, centro vertical) de um nó
function entryPoint(n) {
    const h = BALLOON_SIZES[n.type]?.h ?? BALLOON_SIZES.authorizer.h;
    return { x: n.x, y: n.y + h / 2 };
}

/**
 * Desenha um conector elbow ortogonal de (x1,y1) para (x2,y2).
 * Usa linha horizontal saindo de x1, curva para y2, linha horizontal chegando em x2.
 * midX = ponto de inflexão horizontal.
 */
function elbowPath(x1, y1, x2, y2, midX) {
    const mx = midX ?? (x1 + x2) / 2;
    if (Math.abs(y1 - y2) < 2) {
        // Linha reta
        return `M ${x1} ${y1} L ${x2} ${y2}`;
    }
    const r = 6; // raio do canto arredondado
    const goDown = y2 > y1;
    const rs = goDown ? r : -r;

    // H até (mx-r), curva, V até (y2±r), curva, H até x2
    return [
        `M ${x1} ${y1}`,
        `H ${mx - r}`,
        `Q ${mx} ${y1} ${mx} ${y1 + rs}`,
        `V ${y2 - rs}`,
        `Q ${mx} ${y2} ${mx + r} ${y2}`,
        `H ${x2}`,
    ].join(' ');
}

// ─── Renderização SVG ─────────────────────────────────────────────────────────

function renderPathsTopology(container, apiGatewayPaths, securityDefinitions) {
    container.innerHTML = '';

    if (!apiGatewayPaths || Object.keys(apiGatewayPaths).length === 0) {
        const empty = document.createElement('p');
        empty.classList.add('topology-empty');
        empty.textContent = 'Nenhum path carregado.';
        container.appendChild(empty);
        return;
    }

    const topology = buildTopology(apiGatewayPaths);
    const { allNodes, edges, nodeById, totalW, totalH } = computeLayout(topology, securityDefinitions);

    const dark = document.body.classList.contains('dark');
    const strokeColor  = dark ? '#475569' : '#94a3b8';
    const arrowColor   = dark ? '#64748b' : '#94a3b8';
    const shadowColor  = dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)';

    // Wrapper com scroll horizontal
    const wrapper = document.createElement('div');
    wrapper.classList.add('topo-svg-wrapper');
    container.appendChild(wrapper);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', totalW);
    svg.setAttribute('height', totalH);
    svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
    svg.classList.add('topo-svg');
    wrapper.appendChild(svg);

    // ── Defs
    const defs = document.createElementNS(svgNS, 'defs');
    defs.innerHTML = `
        <marker id="topo-arrow" markerWidth="8" markerHeight="6"
                refX="8" refY="3" orient="auto" markerUnits="userSpaceOnUse">
            <polygon points="0 0, 8 3, 0 6" fill="${arrowColor}"/>
        </marker>
        <filter id="topo-shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3"
                flood-color="${shadowColor}"/>
        </filter>
    `;
    svg.appendChild(defs);

    // ── Alocar corredores verticais exclusivos por grupo de conexão ─────────────
    // Um "grupo" é identificado pelo fromId (fan-out) ou toId (fan-in).
    // Cada grupo recebe um midX único dentro do gap entre as duas colunas,
    // garantindo que linhas verticais de grupos diferentes nunca se sobreponham.

    // Passo 1: identificar todos os grupos distintos por transição de coluna
    // colTransition "C→C+1" → lista de fromIds (fan-out) ou toIds (fan-in)
    const transitionGroups = new Map(); // "fromCol→toCol" → Set<groupKey>

    // Deduplicar edges
    const edgeSet = new Set();
    const uniqueEdges = edges.filter(e => {
        const key = `${e.from}→${e.to}`;
        if (edgeSet.has(key)) return false;
        edgeSet.add(key);
        return true;
    });

    // Construir fromMap e toMap
    const fromMap = new Map();
    const toMap   = new Map();
    for (const { from, to } of uniqueEdges) {
        if (!fromMap.has(from)) fromMap.set(from, new Set());
        if (!toMap.has(to))     toMap.set(to, new Set());
        fromMap.get(from).add(to);
        toMap.get(to).add(from);
    }

    // Para cada edge, determinar qual é o "grupo líder" (fan-out usa fromId, fan-in usa toId)
    // e registrar na transição de coluna
    for (const { from, to } of uniqueEdges) {
        const fn = nodeById.get(from);
        const tn = nodeById.get(to);
        if (!fn || !tn) continue;
        const transKey = `${fn.col}→${tn.col}`;
        if (!transitionGroups.has(transKey)) transitionGroups.set(transKey, new Set());

        const targets = [...(fromMap.get(from) || [])].map(id => nodeById.get(id)).filter(n => n?.col === tn.col);
        const sources = [...(toMap.get(to)     || [])].map(id => nodeById.get(id)).filter(n => n?.col === fn.col);

        // Líder do grupo: se fan-out, usa fromId; se fan-in, usa toId; senão fromId
        const groupKey = targets.length > 1 ? `out:${from}` : sources.length > 1 ? `in:${to}` : `out:${from}`;
        transitionGroups.get(transKey).add(groupKey);
    }

    // Passo 2: para cada transição de coluna, distribuir midX pelos grupos
    // Os grupos são distribuídos uniformemente no gap entre as colunas
    const groupMidX = new Map(); // groupKey → midX

    for (const [transKey, groupSet] of transitionGroups) {
        const [fromColStr] = transKey.split('→');
        const fromCol = parseInt(fromColStr);

        // X da borda direita da coluna de origem
        const fromColRightX = (nodeById.get([...fromMap.keys()].find(id => nodeById.get(id)?.col === fromCol)) || { x: SVG_PAD, col: fromCol })
            ? (() => {
                const sampleNode = [...nodeById.values()].find(n => n.col === fromCol);
                if (!sampleNode) return SVG_PAD;
                return sampleNode.x + (BALLOON_SIZES[sampleNode.type]?.w ?? BALLOON_SIZES.authorizer.w);
            })()
            : SVG_PAD;

        const groups = [...groupSet];
        const n = groups.length;

        // Distribuir os midX dentro do gap: do começo ao fim do gap
        const xStart = fromColRightX + 10;
        const xEnd   = fromColRightX + COL_GAP - 20;
        const step   = n === 1 ? 0 : (xEnd - xStart) / (n - 1);

        groups.forEach((gKey, i) => {
            groupMidX.set(gKey, Math.round(xStart + i * step));
        });
    }

    // Função que retorna o midX correto para uma edge
    function getEdgeMidX(fromNode, toNode) {
        const targets = [...(fromMap.get(fromNode.id) || [])].map(id => nodeById.get(id)).filter(n => n?.col === toNode.col);
        const sources = [...(toMap.get(toNode.id)     || [])].map(id => nodeById.get(id)).filter(n => n?.col === fromNode.col);

        const groupKey = targets.length > 1
            ? `out:${fromNode.id}`
            : sources.length > 1
                ? `in:${toNode.id}`
                : `out:${fromNode.id}`;

        return groupMidX.get(groupKey) ?? (fromNode.x + (BALLOON_SIZES[fromNode.type]?.w ?? 140) + COL_GAP / 2);
    }

    // ── Desenhar arestas
    const edgeGroup = document.createElementNS(svgNS, 'g');
    svg.appendChild(edgeGroup);

    const drawn = new Set();

    for (const { from, to } of uniqueEdges) {
        const edgeKey = `${from}→${to}`;
        if (drawn.has(edgeKey)) continue;

        const fromNode = nodeById.get(from);
        const toNode   = nodeById.get(to);
        if (!fromNode || !toNode) continue;

        const allTargets = [...(fromMap.get(from) || [])];
        const allSources = [...(toMap.get(to)     || [])];
        const midX = getEdgeMidX(fromNode, toNode);

        // Fan-out: este from tem múltiplos destinos na mesma coluna destino
        const sameColTargets = allTargets
            .map(id => nodeById.get(id))
            .filter(n => n && n.col === toNode.col);

        // Fan-in: este to tem múltiplas origens na mesma coluna origem
        const sameColSources = allSources
            .map(id => nodeById.get(id))
            .filter(n => n && n.col === fromNode.col);

        const isFanOut = sameColTargets.length > 1;
        const isFanIn  = sameColSources.length > 1;

        if (isFanOut) {
            sameColTargets.forEach(t => drawn.add(`${from}→${t.id}`));

            const ep = exitPoint(fromNode);
            const targetYs = sameColTargets.map(t => entryPoint(t).y);
            // A linha vertical deve cobrir desde o ponto de saída até o destino mais distante
            const allYs = [ep.y, ...targetYs];
            const yTop = Math.min(...allYs);
            const yBot = Math.max(...allYs);

            // Linha horizontal do nó até midX (na altura da origem)
            const hLineOut = document.createElementNS(svgNS, 'line');
            hLineOut.setAttribute('x1', ep.x);   hLineOut.setAttribute('y1', ep.y);
            hLineOut.setAttribute('x2', midX);    hLineOut.setAttribute('y2', ep.y);
            hLineOut.setAttribute('stroke', strokeColor);
            hLineOut.setAttribute('stroke-width', '1.5');
            edgeGroup.appendChild(hLineOut);

            // Linha vertical no midX cobrindo da origem ao destino mais distante
            const vLine = document.createElementNS(svgNS, 'line');
            vLine.setAttribute('x1', midX);  vLine.setAttribute('y1', yTop);
            vLine.setAttribute('x2', midX);  vLine.setAttribute('y2', yBot);
            vLine.setAttribute('stroke', strokeColor);
            vLine.setAttribute('stroke-width', '1.5');
            edgeGroup.appendChild(vLine);

            // Seta horizontal de midX até cada destino
            for (const t of sameColTargets) {
                const en = entryPoint(t);
                const arrowLine = document.createElementNS(svgNS, 'line');
                arrowLine.setAttribute('x1', midX);   arrowLine.setAttribute('y1', en.y);
                arrowLine.setAttribute('x2', en.x);   arrowLine.setAttribute('y2', en.y);
                arrowLine.setAttribute('stroke', strokeColor);
                arrowLine.setAttribute('stroke-width', '1.5');
                arrowLine.setAttribute('marker-end', 'url(#topo-arrow)');
                edgeGroup.appendChild(arrowLine);
            }

        } else if (isFanIn) {
            sameColSources.forEach(s => drawn.add(`${s.id}→${to}`));

            const en = entryPoint(toNode);
            const sourceYs = sameColSources.map(s => exitPoint(s).y);
            // A linha vertical deve cobrir desde a origem mais distante até o ponto de chegada
            const allYs = [...sourceYs, en.y];
            const yTop = Math.min(...allYs);
            const yBot = Math.max(...allYs);

            // Linha vertical no midX cobrindo de todas as origens até o destino
            const vLine = document.createElementNS(svgNS, 'line');
            vLine.setAttribute('x1', midX);  vLine.setAttribute('y1', yTop);
            vLine.setAttribute('x2', midX);  vLine.setAttribute('y2', yBot);
            vLine.setAttribute('stroke', strokeColor);
            vLine.setAttribute('stroke-width', '1.5');
            edgeGroup.appendChild(vLine);

            // Linha horizontal de cada origem até midX
            for (const s of sameColSources) {
                const ep = exitPoint(s);
                const hLine = document.createElementNS(svgNS, 'line');
                hLine.setAttribute('x1', ep.x);   hLine.setAttribute('y1', ep.y);
                hLine.setAttribute('x2', midX);   hLine.setAttribute('y2', ep.y);
                hLine.setAttribute('stroke', strokeColor);
                hLine.setAttribute('stroke-width', '1.5');
                edgeGroup.appendChild(hLine);
            }

            // Linha horizontal do midX até o destino (na altura do destino)
            const hLineIn = document.createElementNS(svgNS, 'line');
            hLineIn.setAttribute('x1', midX);   hLineIn.setAttribute('y1', en.y);
            hLineIn.setAttribute('x2', en.x);   hLineIn.setAttribute('y2', en.y);
            hLineIn.setAttribute('stroke', strokeColor);
            hLineIn.setAttribute('stroke-width', '1.5');
            hLineIn.setAttribute('marker-end', 'url(#topo-arrow)');
            edgeGroup.appendChild(hLineIn);

        } else {
            // 1 para 1: seta direta horizontal
            drawn.add(edgeKey);
            const ep = exitPoint(fromNode);
            const en = entryPoint(toNode);

            if (Math.abs(ep.y - en.y) < 2) {
                // Mesma altura: linha reta simples
                const line = document.createElementNS(svgNS, 'line');
                line.setAttribute('x1', ep.x);
                line.setAttribute('y1', ep.y);
                line.setAttribute('x2', en.x);
                line.setAttribute('y2', en.y);
                line.setAttribute('stroke', strokeColor);
                line.setAttribute('stroke-width', '1.5');
                line.setAttribute('marker-end', 'url(#topo-arrow)');
                edgeGroup.appendChild(line);
            } else {
                // Alturas diferentes: elbow
                const pathEl = document.createElementNS(svgNS, 'path');
                pathEl.setAttribute('d', elbowPath(ep.x, ep.y, en.x, en.y, midX));
                pathEl.setAttribute('fill', 'none');
                pathEl.setAttribute('stroke', strokeColor);
                pathEl.setAttribute('stroke-width', '1.5');
                pathEl.setAttribute('marker-end', 'url(#topo-arrow)');
                edgeGroup.appendChild(pathEl);
            }
        }
    }

    // ── Desenhar balões via foreignObject
    const nodeGroup = document.createElementNS(svgNS, 'g');
    svg.appendChild(nodeGroup);

    for (const node of allNodes) {
        const meta = BALLOON_META[node.type];
        if (!meta) continue;
        const w = BALLOON_SIZES[node.type]?.w ?? BALLOON_SIZES.authorizer.w;
        const h = BALLOON_SIZES[node.type]?.h ?? BALLOON_SIZES.authorizer.h;

        const fo = document.createElementNS(svgNS, 'foreignObject');
        fo.setAttribute('x', node.x);
        fo.setAttribute('y', node.y);
        fo.setAttribute('width', w);
        fo.setAttribute('height', h);
        fo.style.overflow = 'visible';
        fo.style.pointerEvents = 'none'; // o fo não captura clicks

        const div = document.createElement('div');
        div.classList.add('topo-balloon', meta.cls);
        div.style.width    = w + 'px';
        div.style.minHeight = h + 'px';
        div.style.pointerEvents = 'auto'; // só o balão visível captura clicks

        const iconEl = document.createElement('span');
        iconEl.classList.add('tb-icon');
        iconEl.textContent = meta.icon;
        div.appendChild(iconEl);

        const body = document.createElement('div');
        body.classList.add('tb-body');

        const labelEl = document.createElement('div');
        labelEl.classList.add('tb-label');
        labelEl.textContent = node.label.length > 46
            ? node.label.slice(0, 44) + '…' : node.label;
        if (node.label.length > 46) div.title = node.label;
        body.appendChild(labelEl);

        if (node.sublabel) {
            const sub = document.createElement('div');
            sub.classList.add('tb-sub');
            sub.textContent = node.sublabel;
            body.appendChild(sub);
        }
        if (node.sublabel2) {
            const sub2 = document.createElement('div');
            sub2.classList.add('tb-sub');
            sub2.textContent = node.sublabel2;
            body.appendChild(sub2);
        }
        div.appendChild(body);

        // Nós de paths: clicáveis
        if (node.type === 'paths' && node.paths?.length) {
            div.classList.add('tb-clickable');
            const chevron = document.createElement('span');
            chevron.classList.add('tb-chevron');
            chevron.textContent = '▼';
            div.appendChild(chevron);

            const panel = document.createElement('div');
            panel.classList.add('topo-paths-inline', 'hidden');
            const ul = document.createElement('ul');
            node.paths.forEach(p => {
                const li = document.createElement('li');
                li.textContent = p;
                ul.appendChild(li);
            });
            panel.appendChild(ul);

            // Painel abre abaixo do balão com position absolute no wrapper
            div.addEventListener('click', () => {
                const existingPanel = wrapper.querySelector(`[data-panel="${node.id}"]`);
                if (existingPanel) {
                    existingPanel.remove();
                    chevron.textContent = '▼';
                    return;
                }
                chevron.textContent = '▲';

                const floatPanel = document.createElement('div');
                floatPanel.classList.add('topo-paths-inline');
                floatPanel.setAttribute('data-panel', node.id);

                // Calcular posição relativa ao wrapper usando o boundingRect do balão
                const divRect = div.getBoundingClientRect();
                const wrapRect = wrapper.getBoundingClientRect();
                const panelLeft = divRect.left - wrapRect.left + wrapper.scrollLeft;
                const panelTop  = divRect.bottom - wrapRect.top;

                floatPanel.style.cssText = `
                    position:absolute;
                    left:${panelLeft}px;
                    top:${panelTop + 4}px;
                    min-width:${w}px;
                    max-width:320px;
                    z-index:20;
                    pointer-events:auto;
                `;
                const clonedPanel = panel.cloneNode(true);
                clonedPanel.classList.remove('hidden');
                const clonedUl = clonedPanel.querySelector('ul') || clonedPanel;
                floatPanel.appendChild(clonedUl);

                const closeFloatPanel = (e) => {
                    if (!floatPanel.contains(e.target) && !div.contains(e.target)) {
                        floatPanel.remove();
                        chevron.textContent = '▼';
                        document.removeEventListener('click', closeFloatPanel);
                    }
                };
                setTimeout(() => document.addEventListener('click', closeFloatPanel), 0);
                wrapper.appendChild(floatPanel);
            });
        }

        fo.appendChild(div);
        nodeGroup.appendChild(fo);
    }

    // ── Legenda
    const legend = document.createElement('div');
    legend.classList.add('topo-legend');
    [
        { type: 'root',       desc: 'API Gateway' },
        { type: 'authorizer', desc: 'Autorizador' },
        { type: 'noauth',     desc: 'Sem autorizador' },
        { type: 'paths',      desc: 'Paths (clique para expandir)' },
        { type: 'nlb',        desc: 'Network Load Balancer' },
        { type: 'port',       desc: 'Porta TCP' },
        { type: 'mock',       desc: 'Integração mock' },
    ].forEach(({ type, desc }) => {
        const meta = BALLOON_META[type];
        if (!meta) return;
        const item = document.createElement('div');
        item.classList.add('topo-legend-item');
        item.innerHTML = `<span class="topo-legend-badge ${meta.cls}">${meta.icon}</span>`
                       + `<span class="topo-legend-text">${desc}</span>`;
        legend.appendChild(item);
    });
    container.appendChild(legend);
}
