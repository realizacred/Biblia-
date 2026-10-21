# Bíblia Sagrada

App de Bíblia para celular: busca por versículo (João 3:16), capítulo (Salmos 23) ou palavra (amor), marca-texto com anotações e uma aba de devocional diário.

Funciona como app instalado (PWA): abra o link no celular e use "Adicionar à tela de início". Depois do primeiro acesso funciona sem internet.

- Marcações, fotos e reflexões ficam salvas só no celular, no navegador onde o app foi aberto.
- Devocional Luz Diária: leituras de manhã e noite do *Daily Light on the Daily Path* (1875, domínio público), com as referências tiradas de [gm5dna/daily-light](https://github.com/gm5dna/daily-light) e mostradas com o texto da Almeida.
- Texto bíblico: Almeida Corrigida Fiel, a partir do projeto [thiagobodruk/biblia](https://github.com/thiagobodruk/biblia).

## Atualizar o app
Depois de mudar `index.html` ou `biblia.json`, aumente `VERSION` em `sw.js` para os celulares baixarem a versão nova.

## Avisos diários
Os avisos da Luz Diária saem de um pequeno servidor no Cloudflare (`worker/`). Cada celular escolhe o horário da manhã e da noite; o servidor confere a cada 5 minutos quem deve receber o aviso.

O workflow `Publicar servidor de avisos` publica o servidor sempre que algo em `worker/` muda e grava o endereço dele em `push-config.json`. Ele precisa dos segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no repositório.
