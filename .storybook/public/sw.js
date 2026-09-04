// The smallest service worker that makes this installable. Chrome will not offer "install" without
// one that has a fetch handler, so this exists to satisfy that and nothing more: it serves from the
// network and falls back to whatever it cached last time, which is what makes an installed copy
// still open in a lift with no signal.
//
// Deliberately not a build-time-generated precache manifest. This deploys a Storybook, whose asset
// filenames change on every build; a stale precache list would be worse than no precache, and the
// runtime cache below picks up whatever the current build actually asks for.
const CACHE = "liseuse-runtime-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only GETs, and only this origin — a cross-origin font or an analytics beacon is none of our
  // business, and caching an opaque response would fill the quota for nothing.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // `.clone()` because a Response body can only be read once and the page needs the original.
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit ?? Promise.reject(new Error("offline and not cached"))))
  );
});
