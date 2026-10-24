# Bíblia Sagrada

App de Bíblia para celular: busca por versículo (João 3:16), capítulo (Salmos 23) ou palavra (amor), marca-texto com anotações e uma aba de devocional diário.

Funciona como app instalado (PWA): abra o link no celular e use "Adicionar à tela de início". Depois do primeiro acesso funciona sem internet.

- Marcações, fotos e reflexões ficam salvas só no celular, no navegador onde o app foi aberto.
- Devocional Momento com Deus: um texto curto por dia do ano (`devocional.json`), escrito para este app, com versículo, reflexão, "Para hoje" e oração. O versículo é mostrado com o texto da Almeida do próprio app.
- Texto bíblico: Almeida Corrigida Fiel, a partir do projeto [thiagobodruk/biblia](https://github.com/thiagobodruk/biblia).

## Atualizar o app
Depois de mudar `index.html`, `biblia.json` ou `devocional.json`, aumente `VERSION` em `sw.js` para os celulares baixarem a versão nova.

## Avisos diários
Os avisos do Momento com Deus saem de um pequeno servidor no Cloudflare (`worker/`). Cada celular escolhe um horário por dia; o servidor confere a cada 5 minutos quem deve receber o aviso.

O workflow `Publicar servidor de avisos` publica o servidor sempre que algo em `worker/` muda e grava o endereço dele em `push-config.json`. Ele precisa dos segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no repositório.
