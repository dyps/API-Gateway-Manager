async function renderEnvironmentFields(container) {
    // Só renderiza se nenhum ambiente fixo foi reconhecido
    for (const env of await getFixedEnvironments()) {
        if (await isCurrentEnvironment(env)) return;
    }

    const fields = [
        { label: "Host", key: "host", icon: "🌐" },
        { label: "Arn da Lambda", key: "authorizerUri", icon: "🔐" },
        { label: "Arn da Credencial", key: "authorizerCredentials", icon: "🔑" },
        { label: "VPC Link ID", key: "connectionId", icon: "🔗" },
        { label: "NLB", key: "nlb", icon: "⚡" },
        { label: "Host Portal", key: "hostPortal", icon: "🖥️" },
    ];

    // Filtrar campos que têm valor
    const fieldsWithValue = [];
    for (const field of fields) {
        const value = (await dbGet(field.key)) ?? '';
        if (value) fieldsWithValue.push({ ...field, value });
    }

    if (fieldsWithValue.length === 0) return;

    const wrapper = document.createElement('div');
    wrapper.classList.add('env-fields-grid', 'div-edit-flags');

    for (const field of fieldsWithValue) {
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

        const valueEl = document.createElement('div');
        valueEl.classList.add('env-field-value');
        valueEl.textContent = field.value;
        valueEl.title = field.value;
        card.appendChild(valueEl);

        wrapper.appendChild(card);
    }

    container.appendChild(wrapper);
}
