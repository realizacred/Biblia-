# Bíblia Sagrada

App de Bíblia para celular: busca por versículo (João 3:16), capítulo (Salmos 23) ou palavra (amor), marca-texto com anotações e uma aba de devocional diário.

Funciona como app instalado (PWA): abra o link no celular e use "Adicionar à tela de início". Depois do primeiro acesso funciona sem internet.

- Marcações, fotos e reflexões ficam salvas só no celular, no navegador onde o app foi aberto.
- Devocional Luz Diária: leituras de manhã e noite do *Daily Light on the Daily Path* (1875, domínio público), com as referências tiradas de [gm5dna/daily-light](https://github.com/gm5dna/daily-light) e mostradas com o texto da Almeida.
- Texto bíblico: Almeida Corrigida Fiel, a partir do projeto [thiagobodruk/biblia](https://github.com/thiagobodruk/biblia).

## Atualizar o app
Depois de mudar `index.html` ou `biblia.json`, aumente `VERSION` em `sw.js` para os celulares baixarem a versão nova.
