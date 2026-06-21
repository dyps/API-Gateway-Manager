async function renderEnvironmentFields(container) {
    // Só renderiza se nenhum ambiente fixo foi reconhecido
    for (const env of await getFixedEnvironments()) {
        if (await isCurrentEnvironment(env)) return;
    }

    const fields = [
        { label: "Host:", key: "host" },
        { label: "Arn da Lambda:", key: "authorizerUri" },
        { label: "Arn da Credencial da Lambda:", key: "authorizerCredentials" },
        { label: "Id do vpc link:", key: "connectionId" },
        { label: "NLB:", key: "nlb" },
        { label: "Host do portal deste ambiente:", key: "hostPortal" },
    ];

    for (const field of fields) {
        const value = (await dbGet(field.key)) ?? '';
        if (!value) continue;

        const row = document.createElement("div");
        row.classList.add("div-edit-flags");

        const rowName = document.createElement("div");
        rowName.classList.add("name-edit-item");
        const confName = document.createElement("span");
        confName.textContent = field.label;
        rowName.appendChild(confName);

        const input = document.createElement("input");
        input.id = "inputConfigsApiGW" + field.key;
        input.type = "text";
        input.value = value;
        input.readOnly = true;
        input.className = "inputConfigsApiGW";

        row.appendChild(rowName);
        row.appendChild(input);
        container.appendChild(row);
    }
}
