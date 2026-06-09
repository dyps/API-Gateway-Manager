# API Gateway Manager

Ferramenta para agilizar a geração e manutenção de arquivos JSON de configuração do AWS API Gateway.

O fluxo normal sem essa ferramenta é tedioso: exportar o JSON do API Gateway, editar manualmente dezenas de paths, trocar valores de ambiente (connectionId, NLB, ARNs, hostPortal) em centenas de lugares, e torcer para não errar nada. Esta ferramenta automatiza esse processo.

---

## O que ela faz

**Troca de ambiente com um clique**
Carregue o JSON do API Gateway e selecione o ambiente de destino. A ferramenta substitui automaticamente todos os valores internos (connectionId, NLB, ARNs do authorizer, hostPortal) para o ambiente escolhido, sem edição manual.

**Gerenciamento de grupos de paths**
Os paths do API Gateway são organizados em grupos lógicos (ex: "Ps Api", "Audit", "Onboarding Api"). A ferramenta compara o que está no JSON com o que deveria estar e mostra o status de cada grupo: presente, ausente, divergente. Você pode adicionar, atualizar ou remover grupos individualmente, ou resolver todas as pendências de uma vez.

**Download pronto para importar**
Gera o JSON final validado, com o nome do ambiente e timestamp, pronto para importar direto no AWS API Gateway.

---

## Configuração inicial

Copie o arquivo de exemplo e preencha com os dados reais dos seus ambientes:

```
environments.example.json  →  environments.json
```

Cada ambiente precisa de: nome, ARNs do authorizer, connectionId, host, NLB, hostPortal e os grupos padrão que ele deve conter.

> O `environments.json` está no `.gitignore` — seus dados reais não são versionados.

Para os grupos de paths, o arquivo de exemplo mostra a estrutura esperada:

```
groupPaths.example.json
```

---

## Como abrir

Abra o arquivo `index.html` diretamente no navegador. Nenhuma instalação necessária.

---

## Fluxo de uso

1. Carregue o **JSON do API Gateway** exportado da AWS
2. Carregue o **JSON de grupos de paths** com os grupos do seu projeto
3. Selecione o **ambiente de destino** nos botões de rádio
4. Resolva as pendências de grupos se houver
5. Clique em **Baixar JSON** para gerar o arquivo final
