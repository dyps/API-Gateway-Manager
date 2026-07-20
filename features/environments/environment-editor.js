async function renderEnvironmentFields(container) {
    // Só renderiza se nenhum ambiente fixo foi reconhecido
    const activeEnv = await getActiveEnvironment();
    if (activeEnv) return;

    const fields = [
        { label: "Host", key: "host", icon: "🌐", placeholder: "ex: abc123.execute-api.us-east-1.amazonaws.com" },
        { label: "Arn da Lambda", key: "authorizerUri", icon: "🔐", placeholder: "ex: arn:aws:apigateway:..." },
        { label: "Arn da Credencial", key: "authorizerCredentials", icon: "🔑", placeholder: "ex: arn:aws:iam::..." },
        { label: "VPC Link ID", key: "connectionId", icon: "🔗", placeholder: "ex: abc123" },
        { label: "NLB", key: "nlb", icon: "⚡", placeholder: "ex: http://NLB-name.elb..." },
        { label: "Host Portal", key: "hostPortal", icon: "🖥️", placeholder: "ex: 'https://portal.example.com'" },
    ];

    // Carregar valores atuais (mostra todos os campos, mesmo vazios)
    const fieldsData = [];
    for (const field of fields) {
        const value = (await dbGet(field.key)) ?? '';
        fieldsData.push({ ...field, value });
    }

    // Se nenhum campo tem valor E não há JSON carregado, não renderiza
    const hasAnyValue = fieldsData.some(f => f.value);
    const hasJson = await dbGet('jsonConfigContent');
    if (!hasAnyValue && !hasJson) return;

    const wrapper = document.createElement('div');
    wrapper.classList.add('env-fields-grid', 'div-edit-flags');

    for (const field of fieldsData) {
        const card = document.createElement('div');
        card.classList.add('env-field-card');

        const header = document.createElement('div');
        header.classList.add('env-field-header');

        const icon = document.createElement('span');
        icon.classList.add('env-field-icon');
        icon.textContent = field.icon;
        header.appendChild(icon);

        const label = document.createElement('span');
        label.classList.add('env-field-label');
        label.textContent = field.label;
        header.appendChild(label);

        card.appendChild(header);

        const input = document.createElement('input');
        input.type = 'text';
        input.classList.add('env-field-value');
        input.value = field.value;
        input.placeholder = field.placeholder;
        input.title = field.value || field.placeholder;
        input.dataset.key = field.key;

        // Salvar no IndexedDB ao perder o foco ou pressionar Enter
        input.addEventListener('blur', async () => {
            const newValue = input.value.trim();
            await dbSet(field.key, newValue);
            input.title = newValue || field.placeholder;
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
        });

        card.appendChild(input);
        wrapper.appendChild(card);
    }

    container.appendChild(wrapper);
}
