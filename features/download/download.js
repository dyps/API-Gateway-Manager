// ─── Seção de download do JSON final ──────────────────────────────────────────

async function renderDownloadSection(container) {
    var jsonData = await dbGet('jsonConfigContent');
    var row = document.createElement("div");

    if (jsonData) {
        var btn = document.createElement('button');
        btn.classList.add("downloadBtn");
        btn.textContent = "Baixar JSON";

        btn.onclick = async function () {
            const jsonData = await dbGet('jsonConfigContent');
            if (!jsonData) return;

            // Validação 1: arquivo não pode ter paths vazio
            const pathsObj = jsonData.paths || {};
            if (Object.keys(pathsObj).length === 0) {
                await showAlertDialog(
                    '⚠️ Nenhum path encontrado',
                    'O JSON não contém nenhum path. Verifique se os grupos foram aplicados corretamente antes de baixar.'
                );
                return;
            }

            // Validação 2: ambiente do JSON deve bater com o ambiente selecionado
            const savedEnvName = await dbGet('envName');
            let detectedEnvName = null;
            const jsonStr2 = JSON.stringify(jsonData);
            let bestScore = 0;
            for (const env of await getFixedEnvironments()) {
                let score = 0;
                if (jsonStr2.includes(env.authorizerCredentials)) score++;
                if (jsonStr2.includes(env.authorizerUri))         score++;
                if (jsonStr2.includes(env.connectionId))          score++;
                if (jsonStr2.includes(env.host))                  score++;
                if (jsonStr2.includes(env.hostPortal))            score++;
                if (jsonStr2.includes(env.nlb))                   score++;
                if (score > bestScore) {
                    bestScore = score;
                    detectedEnvName = env.name;
                }
            }
            if (detectedEnvName && savedEnvName && detectedEnvName !== savedEnvName) {
                const proceed = await showConfirmDialog(
                    '⚠️ Divergência de ambiente',
                    `O ambiente selecionado é <strong>${savedEnvName}</strong>, mas o conteúdo do JSON parece ser de <strong>${detectedEnvName}</strong>.<br><br>Deseja baixar mesmo assim?`
                );
                if (!proceed) return;
            }

            const pending = await calcPendingActionGroups();
            const criticalGroups = pending.filter(({ validationResult, isDefault }) => {
                const { status } = validationResult;
                return (isDefault && status === 'none-found') || (!isDefault && status !== 'none-found');
            });

            const fixedResponses = getFixedGatewayResponses();
            const currentResponses = jsonData['x-amazon-apigateway-gateway-responses'] || {};
            const gwPending = Object.keys(fixedResponses).filter(k =>
                !currentResponses[k] || JSON.stringify(currentResponses[k]) !== JSON.stringify(fixedResponses[k])
            );

            const hasPending = criticalGroups.length > 0 || gwPending.length > 0;
            if (hasPending) {
                const confirmed = await showDownloadPendingDialog(criticalGroups.length, gwPending.length);
                if (confirmed === null) return;
                if (confirmed === true) {
                    if (criticalGroups.length > 0) {
                        await resolveAllPendingGroups();
                        const gp = await dbGet('groupPathsContent');
                        await renderGroupPaths(gp);
                    }
                    if (gwPending.length > 0) {
                        await resolveAllGatewayResponses();
                    }
                }
            }

            const finalData = await dbGet('jsonConfigContent');
            const { _isSkeleton, ...cleanData } = finalData;
            const jsonStr = JSON.stringify(cleanData);
            var blob = new Blob([jsonStr], { type: "application/json" });
            var url = URL.createObjectURL(blob);
            var a = document.createElement("a");
            a.href = url;
            var envName = await dbGet('envName');
            if (!envName) envName = "NãoDefinido";
            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const timestamp = `${pad(now.getDate())}-${pad(now.getMonth()+1)}-${now.getFullYear()}_${pad(now.getHours())}h${pad(now.getMinutes())}`;
            a.download = `API Gateway Ambiente-${envName}_${timestamp}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };

        row.appendChild(btn);
    } else {
        const groupPathsData = await dbGet('groupPathsContent');
        const environmentsData = await dbGet('environmentsContent');

        const hint = document.createElement('p');
        hint.style.cssText = 'font-size:0.875rem;color:#718096;margin:0;line-height:1.6;';

        if (environmentsData && !groupPathsData) {
            hint.innerHTML = '✅ Ambientes carregados. Carregue o <strong>JSON de Grupos de Paths</strong> para visualizar e gerenciar os grupos, ou o <strong>JSON do API Gateway</strong> para habilitar a edição completa.';
        } else if (environmentsData && groupPathsData) {
            hint.innerHTML = '✅ Ambientes e grupos carregados. Carregue o <strong>JSON do API Gateway</strong> para habilitar a edição, validação dos grupos e o download do JSON final — ou <strong>selecione um ambiente</strong> para criar do zero.';
        } else {
            hint.textContent = 'Nenhum JSON salvo.';
        }
        row.appendChild(hint);
    }
    container.appendChild(row);
}
