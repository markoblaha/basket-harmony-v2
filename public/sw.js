/*
 * Service worker appky Basket Harmony.
 *  - Offline: appka sa otvorí aj bez signálu (obal stránky z vyrovnávacej pamäte, kód a obrázky
 *    sa pamätajú po prvom stiahnutí). Údaje (Supabase) sa tu neukladajú – tie drží appka sama.
 *  - Upozornenia do telefónu (push): zobrazí upozornenie a po ťuknutí otvorí správnu obrazovku.
 * Pri zmene tohto súboru zvýš VERZIU, aby sa stará vyrovnávacia pamäť zmazala.
 */
const VERSION = "bh-2026-11-03-1";
const SHELL = "/";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll([SHELL, "/manifest.webmanifest", "/icon-192.png"])).catch(() => undefined));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

/** Sieť s časovým limitom – pri slabom signáli (obchod) sa po 3,5 s použije uložená kópia. */
function networkFirst(req, key) {
  return new Promise((resolve) => {
    let done = false;
    const fallback = () =>
      caches.match(key).then((hit) => {
        if (!done && hit) {
          done = true;
          resolve(hit);
        }
        return hit;
      });
    const timer = setTimeout(fallback, 3500);
    fetch(req)
      .then((res) => {
        clearTimeout(timer);
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(key, copy));
        }
        if (!done) {
          done = true;
          resolve(res);
        }
      })
      .catch(() => {
        clearTimeout(timer);
        fallback().then((hit) => {
          if (!done) {
            done = true;
            resolve(hit || Response.error());
          }
        });
      });
  });
}

function cacheFirst(req) {
  return caches.match(req).then(
    (hit) =>
      hit ||
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }),
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Google – nikdy z pamäte
  if (url.pathname.startsWith("/prototyp/")) return; // veľká ukážka – len online
  if (req.mode === "navigate") {
    e.respondWith(networkFirst(req, SHELL));
    return;
  }
  // Súbory s odtlačkom v názve (/assets/…) a obrázky sa nemenia – stačí ich stiahnuť raz.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/mk/") || /\.(png|svg|webp|woff2?)$/.test(url.pathname)) {
    e.respondWith(cacheFirst(req));
  }
});

/* ------------------------------------------------------------------ upozornenia do telefónu */
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { title: e.data ? e.data.text() : "Basket Harmony" };
  }
  const title = d.title || "Basket Harmony";
  e.waitUntil(
    (async () => {
      // Kto má appku práve otvorenú na obrazovke, dostane upozornenie priamo v appke – nie dvakrát.
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (wins.some((w) => w.visibilityState === "visible" && w.focused)) return;
      await self.registration.showNotification(title, {
        body: d.body || "",
        tag: d.tag || undefined,
        renotify: !!d.tag,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: d.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if ("focus" in w) {
          await w.focus();
          if ("navigate" in w) await w.navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
