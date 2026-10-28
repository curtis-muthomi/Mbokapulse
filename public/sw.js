const CACHE = 'mbokapulse-shell-v1'

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    const response = await fetch('/')
    if (!response.ok) throw new Error('Unable to cache the MbokaPulse app shell.')
    await cache.put('/', response.clone())
    const html = await response.text()
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
      .map((match) => new URL(match[1], self.location.origin).href)
    await Promise.all(assets.map(async (url) => {
      const asset = await fetch(url)
      if (asset.ok) await cache.put(url, asset)
    }))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.startsWith('mbokapulse-') && name !== CACHE).map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    try {
      const response = await fetch(request)
      if (response.ok && ['document', 'script', 'style', 'image', 'font'].includes(request.destination)) {
        const cache = await caches.open(CACHE)
        await cache.put(request, response.clone())
      }
      return response
    } catch (error) {
      if (request.mode === 'navigate') {
        const appShell = await caches.match('/')
        if (appShell) return appShell
      }
      throw error
    }
  })())
})
