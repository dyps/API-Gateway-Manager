// ─── Renderização dos paths do API Gateway ────────────────────────────────────

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
    renderPathsTopology(document.getElementById('topologyContent'), jsonConfigContent.paths);
    document.getElementById('topologyCard').classList.remove('hidden');
    const { _isSkeleton, ...cleanData } = jsonConfigContent;
    document.getElementById('jsonContent').innerHTML = '';
    renderJsonTree(document.getElementById('jsonContent'), cleanData);
}
