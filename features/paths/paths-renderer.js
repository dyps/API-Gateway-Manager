// ─── Renderização dos paths do API Gateway ────────────────────────────────────

// ─── Collapse/Expand + Filtro do card Paths ───────────────────────────────────

function initPathsCardControls() {
    const header = document.getElementById('pathsApiGatewayHeader');
    const content = document.getElementById('pathsApiGatewayDiv');
    const chevron = header?.querySelector('.card-collapse-chevron');
    const filterInput = document.getElementById('pathsFilterInput');
    const filterClear = document.getElementById('pathsFilterClear');

    if (!header || !content) return;

    // Collapse/expand ao clicar no header (exceto no input de filtro)
    header.addEventListener('click', (e) => {
        if (e.target === filterInput || e.target === filterClear || e.target.classList.contains('paths-filter-icon')) return;
        const isCollapsed = content.classList.toggle('hidden');
        chevron.textContent = isCollapsed ? '▶' : '▼';
    });

    // Filtro de paths
    filterInput.addEventListener('input', () => {
        const term = filterInput.value.trim().toLowerCase();
        filterClear.classList.toggle('hidden', !term);
        applyPathsFilter(term);
    });

    filterClear.addEventListener('click', (e) => {
        e.stopPropagation();
        filterInput.value = '';
        filterClear.classList.add('hidden');
        applyPathsFilter('');
    });
}

function applyPathsFilter(term) {
    const container = document.getElementById('pathsApiGatewayDiv');
    if (!container) return;

    // Expandir se filtro ativo
    if (term) {
        container.classList.remove('hidden');
        const chevron = document.querySelector('#pathsApiGatewayHeader .card-collapse-chevron');
        if (chevron) chevron.textContent = '▼';
    }

    // Filtrar cards individuais (.card-path-item)
    container.querySelectorAll('.card-path-item').forEach(card => {
        const pathName = card.querySelector('.name-edit-item-div span')?.textContent || '';
        const match = !term || pathName.toLowerCase().includes(term);
        card.style.display = match ? '' : 'none';
    });

    // Filtrar dentro de <details> (grupos)
    container.querySelectorAll('.paths-group-section').forEach(section => {
        let visibleCount = 0;
        section.querySelectorAll('.card-path-item').forEach(card => {
            const pathName = card.querySelector('.name-edit-item-div span')?.textContent || '';
            const match = !term || pathName.toLowerCase().includes(term);
            card.style.display = match ? '' : 'none';
            if (match) visibleCount++;
        });
        section.style.display = visibleCount > 0 ? '' : 'none';
        if (term && visibleCount > 0) section.open = true;
    });
}

/** Aplica filtro externamente (ex: ao clicar na topologia) */
function setPathsFilter(pathText) {
    const filterInput = document.getElementById('pathsFilterInput');
    const filterClear = document.getElementById('pathsFilterClear');
    const content = document.getElementById('pathsApiGatewayDiv');
    const chevron = document.querySelector('#pathsApiGatewayHeader .card-collapse-chevron');

    if (!filterInput) return;

    filterInput.value = pathText;
    filterClear.classList.toggle('hidden', !pathText);

    // Expandir o card
    if (content && content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (chevron) chevron.textContent = '▼';
    }

    applyPathsFilter(pathText.toLowerCase());

    // Scroll suave até o card (500ms)
    const card = document.getElementById('pathsApiGatewayCard');
    if (card) {
        const targetY = card.getBoundingClientRect().top + window.scrollY - 20;
        const startY = window.scrollY;
        const diff = targetY - startY;
        const duration = 600;
        let startTime = null;

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeInOutCubic
            const ease = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            window.scrollTo(0, startY + diff * ease);
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }
}

// Inicializar ao carregar
document.addEventListener('DOMContentLoaded', initPathsCardControls);

async function loadPaths(paths) {
    const container = document.getElementById('pathsApiGatewayDiv');
    container.innerHTML = '';
    alterDivPathsBackground = true;

    // Tentar buscar groupPathsContent para organizar por grupos
    let groupPathsContent = null;
    try {
        groupPathsContent = await dbGet('groupPathsContent');
    } catch (e) { /* sem grupos, renderiza flat */ }

    if (!groupPathsContent || Object.keys(groupPathsContent).length === 0) {
        // Sem grupos: renderiza flat como antes
        Object.keys(paths).forEach(keyPath => {
            renderPathCard(container, keyPath, paths[keyPath]);
        });
        return;
    }

    // Construir mapa de path → groupName
    const pathToGroup = {};
    for (const [groupName, groupPaths] of Object.entries(groupPathsContent)) {
        for (const p of Object.keys(groupPaths)) {
            pathToGroup[p] = groupName;
        }
    }

    // Agrupar paths do API Gateway por grupo
    const grouped = {};
    const unmapped = [];
    for (const keyPath of Object.keys(paths)) {
        const g = pathToGroup[keyPath];
        if (g) {
            if (!grouped[g]) grouped[g] = [];
            grouped[g].push(keyPath);
        } else {
            unmapped.push(keyPath);
        }
    }

    // Renderizar cada grupo como <details> colapsável
    for (const groupName of Object.keys(grouped)) {
        const section = document.createElement('details');
        section.classList.add('paths-group-section');
        section.open = false;

        const summary = document.createElement('summary');
        summary.classList.add('paths-group-summary');
        summary.textContent = `${groupName} (${grouped[groupName].length})`;
        section.appendChild(summary);

        grouped[groupName].forEach(keyPath => {
            renderPathCard(section, keyPath, paths[keyPath]);
        });

        container.appendChild(section);
    }

    // Paths não mapeados no final
    if (unmapped.length > 0) {
        const section = document.createElement('details');
        section.classList.add('paths-group-section');
        section.open = false;

        const summary = document.createElement('summary');
        summary.classList.add('paths-group-summary', 'paths-group-summary-unmapped');
        summary.textContent = `Não mapeados (${unmapped.length})`;
        section.appendChild(summary);

        unmapped.forEach(keyPath => {
            renderPathCard(section, keyPath, paths[keyPath]);
        });

        container.appendChild(section);
    }
}

function renderPathCard(container, keyPath, path) {
    var row = document.createElement("div");
    row.classList.add("card-path-item");

    if (alterDivPathsBackground) {
        row.classList.add("background-color-gray-1");
        alterDivPathsBackground = false;
    } else {
        row.classList.add("background-color-gray-2");
        alterDivPathsBackground = true;
    }

    var rowHeader = document.createElement("div");
    rowHeader.classList.add("row-header");

    var divName = document.createElement("div");
    divName.classList.add("name-edit-item-div");

    var confName = document.createElement("span");
    confName.textContent = keyPath;

    divName.appendChild(confName);
    rowHeader.appendChild(divName);

    var rowConfsEnables = document.createElement("div");
    rowConfsEnables.classList.add("div-row-confs");
    rowHeader.appendChild(rowConfsEnables);

    row.appendChild(rowHeader);

    var row2 = document.createElement("div");
    row2.classList.add("jsonContent");
    renderJsonTree(row2, path);

    row.appendChild(row2);
    container.appendChild(row);
}

// Atualiza Paths do ApiGateway e Conteúdo do JSON sem reprocessar o objeto inteiro
async function refreshPathsAndContent() {
    const jsonConfigContent = await dbGet('jsonConfigContent');
    if (!jsonConfigContent || !jsonConfigContent.paths) return;
    loadPaths(jsonConfigContent.paths);
    renderPathsTopology(document.getElementById('topologyContent'), jsonConfigContent.paths, jsonConfigContent.securityDefinitions || {});
    document.getElementById('topologyCard').classList.remove('hidden');
    const { _isSkeleton, ...cleanData } = jsonConfigContent;
    document.getElementById('jsonContent').innerHTML = '';
    renderJsonTree(document.getElementById('jsonContent'), cleanData);
}
