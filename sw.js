// Bump VERSION whenever index.html or biblia.json changes so phones pick up the new files.
const VERSION = "biblia-v5";
const CORE = ["./", "index.html", "biblia.json", "devocional.json", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache first for everything (app files and Google Fonts), falling back to the network and saving what it returns.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok || res.type === "opaque") {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match("index.html"))));
});

// Daily reminder: the worker only says that it is time; the text comes from the cached devotional.
const BOOK_NAMES = ["Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio", "Josué", "Juízes", "Rute", "1 Samuel", "2 Samuel", "1 Reis", "2 Reis", "1 Crônicas", "2 Crônicas", "Esdras", "Neemias", "Ester", "Jó", "Salmos", "Provérbios", "Eclesiastes", "Cânticos", "Isaías", "Jeremias", "Lamentações", "Ezequiel", "Daniel", "Oseias", "Joel", "Amós", "Obadias", "Jonas", "Miqueias", "Naum", "Habacuque", "Sofonias", "Ageu", "Zacarias", "Malaquias", "Mateus", "Marcos", "Lucas", "João", "Atos", "Romanos", "1 Coríntios", "2 Coríntios", "Gálatas", "Efésios", "Filipenses", "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses", "1 Timóteo", "2 Timóteo", "Tito", "Filemom", "Hebreus", "Tiago", "1 Pedro", "2 Pedro", "1 João", "2 João", "3 João", "Judas", "Apocalipse"];

async function cachedJson(file) {
  const res = (await caches.match(file, { ignoreSearch: true })) || (await fetch(file));
  return res.json();
}

async function reminderBody() {
  try {
    const [devo, bible] = await Promise.all([cachedJson("devocional.json"), cachedJson("biblia.json")]);
    const d = new Date();
    const key = String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const { t, r: [b, c, from, to] } = devo[key];
    let text = bible[b][c - 1].slice(from - 1, to).join(" ");
    if (text.length > 90) text = text.slice(0, 87).replace(/\s+\S*$/, "") + "…";
    return `${t}. “${text}” ${BOOK_NAMES[b]} ${c}:${from}${to > from ? "-" + to : ""}`;
  } catch (e) {
    return "O seu momento com Deus de hoje está esperando por você.";
  }
}

self.addEventListener("push", e => {
  e.waitUntil(reminderBody().then(body => self.registration.showNotification("Momento com Deus", {
    body,
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    tag: "momento",
    data: { url: "./?p=m#devocional" },
  })));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("navigate" in c) return c.navigate(url).then(w => w && w.focus());
    return self.clients.openWindow(url);
  }));
});
