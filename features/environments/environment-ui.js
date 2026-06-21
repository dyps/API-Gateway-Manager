// ─── UI do painel de configuração e radios de ambiente ────────────────────────

async function renderConfigPanel() {
    const container = document.getElementById("configsApiGatewayEditers");
    container.innerHTML = "";

    await renderEnvironmentRadios(container);
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

async function renderEnvironmentRadios(container) {
    var rowFixedEnvironments = document.createElement("div");
    rowFixedEnvironments.classList.add("div-fixed-environments");

    for (const environment of await getFixedEnvironments()) {
        await createEnvironmentRadio(rowFixedEnvironments, null, environment);
    }

    container.appendChild(rowFixedEnvironments);
}

async function createEnvironmentRadio(container, checked = false, environment = null) {
    if (!environment) return;

    var divButon = document.createElement("div");
    divButon.classList.add("div-radio");
    var btn = document.createElement('input');
    btn.classList.add("radio");
    btn.type = "radio";
    btn.name = "radioEnvironments";

    if (checked) btn.checked = true;

    divButon.appendChild(btn);

    var fixedEnvironmentsName = document.createElement("span");
    fixedEnvironmentsName.textContent = environment.name;

    // Só permite selecionar se tiver API Gateway ou grupos carregados
    const [existingJson, groupPaths] = await Promise.all([
        dbGet('jsonConfigContent'),
        dbGet('groupPathsContent')
    ]);
    const canSwitch = !!(existingJson || groupPaths);

    if (!canSwitch) {
        btn.disabled = true;
        divButon.title = 'Carregue o JSON do API Gateway ou de Grupos para trocar de ambiente';
        divButon.style.opacity = '0.5';
        divButon.style.cursor = 'not-allowed';
    } else {
        btn.addEventListener("change", async () => {
            if (btn.checked) {
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
        });

        divButon.addEventListener("dblclick", () => {
            btn.checked = true;
            btn.dispatchEvent(new Event("change"));
        });
    }

    if (await isCurrentEnvironment(environment)) {
        btn.checked = true;
        shouldHideEditFlags = true;
    }

    divButon.appendChild(fixedEnvironmentsName);
    container.appendChild(divButon);
}

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
