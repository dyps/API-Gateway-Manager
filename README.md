# API Gateway Manager

Ferramenta para agilizar a geração e manutenção de arquivos de configuração do AWS API Gateway.

O fluxo normal sem essa ferramenta é tedioso: exportar o arquivo do API Gateway, editar manualmente dezenas de paths, trocar valores de ambiente (connectionId, NLB, ARNs, hostPortal) em centenas de lugares, e torcer para não errar nada. Esta ferramenta automatiza esse processo.

---

## O que ela faz

**Troca de ambiente com um clique**
Carregue o arquivo exportado do API Gateway e selecione o ambiente de destino. A ferramenta substitui automaticamente todos os valores internos (connectionId, NLB, ARNs do authorizer, hostPortal) para o ambiente escolhido, sem edição manual.

**Suporte a múltiplos formatos de exportação**
Aceita Swagger 2.0 e OpenAPI 3.0, em JSON ou YAML. No download, o arquivo é gerado no mesmo formato em que foi importado.

**Gerenciamento de grupos de paths**
Os paths do API Gateway são organizados em grupos lógicos (ex: "Ps Api", "Audit", "Onboarding Api"). A ferramenta compara o que está no JSON com o que deveria estar e mostra o status de cada grupo: presente, ausente, divergente. Você pode adicionar, atualizar ou remover grupos individualmente, ou resolver todas as pendências de uma vez.

**Download pronto para importar**
Gera o arquivo final validado, com o nome do ambiente e timestamp, pronto para importar direto no AWS API Gateway.

---

## Formatos aceitos

| Especificação | Formato | Identificador |
|---|---|---|
| Swagger 2.0 (OpenAPI 2.0) | JSON ou YAML | `"swagger": "2.0"` |
| OpenAPI 3.0 | JSON ou YAML | `"openapi": "3.0.x"` |

> **Importante:** Ao exportar da AWS, selecione a extensão **"API Gateway Extensions"** (ou `extensions='apigateway'` na CLI). Sem ela, o arquivo não conterá os dados de integração e autorizadores que a ferramenta precisa.

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

1. Carregue o **Arquivo do API Gateway** exportado da AWS (JSON ou YAML, Swagger 2.0 ou OpenAPI 3.0)
2. Carregue o **JSON de grupos de paths** com os grupos do seu projeto
3. Selecione o **ambiente de destino** nos cards de ambiente
4. Resolva as pendências de grupos se houver
5. Clique em **Baixar JSON** para gerar o arquivo final
