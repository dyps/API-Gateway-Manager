// ─── UI do painel de configuração e seletor de ambiente ───────────────────────

const HIDDEN_ENVS_KEY = 'hiddenEnvironments';

async function renderConfigPanel() {
    const container = document.getElementById("configsApiGatewayEditers");
    container.innerHTML = "";

    await renderEnvironmentSelector(container);
    await renderEnvironmentFields(container);

    if (shouldHideEditFlags) {
        hideEditFlags();
    }

    await renderDownloadSection(container);

    // Configurar botão de olho
    const eyeBtn = document.getElementById('envViewerBtn');
    if (eyeBtn) {
        eyeBtn.onclick = async () => {
            await showEnvValuesDialog();
        };
    }
}

// ─── Novo componente: cards de ambiente com hide/show ──────────────────────────

async function renderEnvironmentSelector(container) {
    const environments = await getFixedEnvironments();
    const hiddenEnvs = await getHiddenEnvironments();

    // Wrapper com posição relativa para o botão "+"
    const wrapper = document.createElement('div');
    wrapper.classList.add('env-selector-wrapper');

    // Botão "+" para restaurar ambientes escondidos (só aparece se há algum escondido)
    const addBtn = document.createElement('button');
    addBtn.classList.add('env-restore-btn');
    addBtn.textContent = '+';
    addBtn.title = 'Mostrar ambientes ocultos';
    if (hiddenEnvs.length === 0) addBtn.classList.add('hidden');
    wrapper.appendChild(addBtn);

    // Grid de cards
    const grid = document.createElement('div');
    grid.classList.add('env-selector-grid');

    const [existingJson, groupPaths] = await Promise.all([
        dbGet('jsonConfigContent'),
        dbGet('groupPathsContent')
    ]);
    const canSwitch = !!(existingJson || groupPaths);

    for (const environment of environments) {
        const isHidden = hiddenEnvs.includes(environment.name);
        if (isHidden) continue;

        const isCurrent = await isCurrentEnvironment(environment);
        const card = createEnvironmentCard(environment, isCurrent, canSwitch);
        grid.appendChild(card);
    }

    wrapper.appendChild(grid);
    container.appendChild(wrapper);

    // Popup do botão "+" — lista ambientes escondidos para restaurar
    addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showRestorePopup(addBtn, environments, hiddenEnvs, wrapper);
    });
}

function createEnvironmentCard(environment, isCurrent, canSwitch) {
    const card = document.createElement('div');
    card.classList.add('env-card');
    if (isCurrent) {
        card.classList.add('env-card-active');
        shouldHideEditFlags = true;
    }
    if (!canSwitch) {
        card.classList.add('env-card-disabled');
        card.title = 'Carregue o JSON do API Gateway ou de Grupos para trocar de ambiente';
    }

    // Conteúdo principal
    const body = document.createElement('div');
    body.classList.add('env-card-body');

    const name = document.createElement('span');
    name.classList.add('env-card-name');
    name.textContent = environment.name;
    body.appendChild(name);

    if (isCurrent) {
        const badge = document.createElement('span');
        badge.classList.add('env-card-badge');
        badge.textContent = '● ativo';
        body.appendChild(badge);
    }

    card.appendChild(body);

    // Botão ✕ para esconder (não aparece no ativo)
    if (!isCurrent) {
        const hideBtn = document.createElement('button');
        hideBtn.classList.add('env-card-hide-btn');
        hideBtn.textContent = '✕';
        hideBtn.title = `Ocultar "${environment.name}"`;
        hideBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await hideEnvironmentCard(environment.name);
        });
        card.appendChild(hideBtn);
    }

    // Click no card = selecionar ambiente
    if (canSwitch && !isCurrent) {
        card.addEventListener('click', async () => {
            await selectEnvironment(environment);
        });
    }

    return card;
}

async function selectEnvironment(environment) {
    const currentJson = await dbGet('jsonConfigContent');
    if (!currentJson) {
        const skeleton = buildSkeletonApiGateway(environment);
        await dbSet('jsonConfigContent', skeleton);
        await dbSet('envName', environment.name);
        await dbSet('authorizerCredentials', environment.authorizerCredentials);
        await dbSet('authorizerUri', environment.authorizerUri);
        await dbSet('connectionId', environment.connectionId);
        await dbSet('host', environment.host);
        await dbSet('hostPortal', environment.hostPortal);
        await dbSet('nlb', environment.nlb);
    } else {
        await switchEnvironment(environment);
    }
    await loadSavedConfig();
}

// ─── Hide/Show de ambientes ───────────────────────────────────────────────────

async function getHiddenEnvironments() {
    try {
        const hidden = await dbGet(HIDDEN_ENVS_KEY);
        return Array.isArray(hidden) ? hidden : [];
    } catch (_) {
        return [];
    }
}

async function hideEnvironmentCard(envName) {
    const hidden = await getHiddenEnvironments();
    if (!hidden.includes(envName)) {
        hidden.push(envName);
        await dbSet(HIDDEN_ENVS_KEY, hidden);
    }
    // Re-renderiza o painel inteiro
    await renderConfigPanel();
}

async function restoreEnvironmentCard(envName) {
    const hidden = await getHiddenEnvironments();
    const updated = hidden.filter(n => n !== envName);
    await dbSet(HIDDEN_ENVS_KEY, updated);
    await renderConfigPanel();
}

function showRestorePopup(anchorBtn, allEnvironments, hiddenEnvs, wrapper) {
    // Remove popup existente
    const existing = document.querySelector('.env-restore-popup');
    if (existing) { existing.remove(); return; }

    const popup = document.createElement('div');
    popup.classList.add('env-restore-popup');

    // Posicionar com fixed baseado no botão "+"
    const rect = anchorBtn.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.top = (rect.bottom + 4) + 'px';
    popup.style.right = (window.innerWidth - rect.right) + 'px';

    const title = document.createElement('div');
    title.classList.add('env-restore-popup-title');
    title.textContent = 'Ambientes ocultos';
    popup.appendChild(title);

    for (const envName of hiddenEnvs) {
        const item = document.createElement('div');
        item.classList.add('env-restore-popup-item');

        const label = document.createElement('span');
        label.textContent = envName;
        item.appendChild(label);

        const restoreBtn = document.createElement('button');
        restoreBtn.classList.add('env-restore-popup-btn');
        restoreBtn.textContent = 'Restaurar';
        restoreBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            popup.remove();
            await restoreEnvironmentCard(envName);
        });
        item.appendChild(restoreBtn);

        popup.appendChild(item);
    }

    document.body.appendChild(popup);

    // Fechar ao clicar fora
    const closeHandler = (e) => {
        if (!popup.contains(e.target) && e.target !== anchorBtn) {
            popup.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

// ─── Utilidades de UI ─────────────────────────────────────────────────────────

function hideEditFlags() {
    document.querySelectorAll('.div-edit-flags').forEach(el => {
        el.classList.add('hidden');
    });
}

async function showEnvValuesDialog() {
    const fields = [
        { label: "Host", key: "host" },
        { label: "Arn da Lambda", key: "authorizerUri" },
        { label: "Arn da Credencial da Lambda", key: "authorizerCredentials" },
        { label: "Id do vpc link", key: "connectionId" },
        { label: "NLB", key: "nlb" },
        { label: "Host do portal deste ambiente", key: "hostPortal" },
    ];

    const existing = document.getElementById('envValuesDialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'envValuesDialog';
    overlay.classList.add('modal-overlay');

    const dialog = document.createElement('div');
    dialog.classList.add('modal-box', 'env-values-dialog');

    const title = document.createElement('h3');
    title.textContent = 'Valores do Ambiente Atual';
    dialog.appendChild(title);

    for (const field of fields) {
        const value = (await dbGet(field.key)) ?? '(não definido)';

        const row = document.createElement('div');
        row.classList.add('env-values-row');

        const label = document.createElement('div');
        label.textContent = field.label;
        label.classList.add('env-values-label');

        const val = document.createElement('div');
        val.textContent = value;
        val.classList.add('env-values-value');

        row.appendChild(label);
        row.appendChild(val);
        dialog.appendChild(row);
    }

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Fechar';
    closeBtn.classList.add('env-values-close-btn');
    closeBtn.onclick = () => overlay.remove();
    dialog.appendChild(closeBtn);

    overlay.appendChild(dialog);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}
