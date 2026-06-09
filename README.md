# JSON Config Manager

Um site simples e funcional para gerenciar arquivos JSON localmente.

## Características

- ✅ Upload de arquivo JSON
- ✅ Salvamento automático do caminho do arquivo (usando localStorage)
- ✅ Carregamento automático ao recarregar a página
- ✅ Visualização formatada do conteúdo JSON
- ✅ Limpeza de configuração
- ✅ Validação de arquivo JSON
- ✅ Interface responsiva e intuitiva

## Como Usar

### Opção 1: Abrir direto no navegador

1. Baixe os arquivos:
   - `index.html`
   - `style.css`
   - `script.js`

2. Coloque os três arquivos na mesma pasta

3. Abra o arquivo `index.html` no seu navegador (duplo clique)

### Opção 2: Usar um servidor local (recomendado)

Se você tem Python instalado:

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Depois acesse: `http://localhost:8000`

Se você tem Node.js instalado:

```bash
# Instalar http-server globalmente
npm install -g http-server

# Executar
http-server
```

Depois acesse: `http://localhost:8080`

## Como Funciona

1. **Selecione um arquivo JSON** usando o input de arquivo
2. **Clique em "Salvar"** para salvar o arquivo
3. **O caminho e conteúdo serão exibidos** na página
4. **Ao recarregar a página**, o arquivo será carregado automaticamente
5. **Clique em "Limpar Configuração"** para remover o arquivo salvo

## Armazenamento

Os dados são salvos no **localStorage** do navegador, então:
- Os dados persistem entre recarregamentos da página
- Os dados são específicos por navegador e domínio
- Limpar o cache do navegador remove os dados salvos

## Estrutura de Arquivos

```
json-config-simple/
├── index.html      # Estrutura HTML
├── style.css       # Estilos CSS
├── script.js       # Lógica JavaScript
└── README.md       # Este arquivo
```

## Compatibilidade

- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari
- ✅ Opera
- ✅ Qualquer navegador moderno com suporte a localStorage

## Próximas Funcionalidades

Você pode adicionar:
- Edição do JSON na página
- Download do arquivo modificado
- Validação mais avançada
- Suporte a múltiplos arquivos
- Histórico de alterações

## Licença

Livre para usar e modificar conforme necessário.

