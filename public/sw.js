// Service worker mínimo para que la app sea instalable (PWA).
// Estrategia network-first: SIEMPRE intenta traer la versión más nueva desde
// la red; solo usa la copia en caché si no hay conexión. Así no queda "pegada"
// una versión vieja (el problema de siempre) y a la vez funciona instalada.

const CACHE = 'figueroa-alcorta-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // No interceptamos llamadas a la API ni a Supabase: siempre a la red.
  if (url.pathname.startsWith('/api') || url.origin !== self.location.origin) return

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (req.mode === 'navigate') {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copia))
        }
        return res
      })
      .catch(() =>
        caches.match(req).then((r) => r || caches.match('/')),
      ),
  )
})
