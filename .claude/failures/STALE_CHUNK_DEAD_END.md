# STALE_CHUNK_DEAD_END

**Status:** RESOLVED 2026-07-25.

## Pattern

A deploy lands while a page is open. The running bundle keeps asking for the
chunk filenames it was built against; those filenames stopped existing the
moment `dist/` was replaced. The first lazy view opened after that point cannot
load, and every control that could fix it is itself behind a lazy chunk.

## Symptoms

- Founder taps a seat on the Table screen (→ `PlayerFinderView`) and lands on the
  error boundary: **E401**, "Failed to fetch dynamically imported module:
  https://poker-tracker-…".
- "Try Again" does nothing — `React.lazy` caches the rejected promise, so
  resetting the boundary re-throws the identical error.
- "Reload Page" comes back to the same broken build — the active worker answers
  the navigation from its own precache via `navigateFallback`.
- Settings → Force Update, the one control that would have fixed it, is behind
  `SettingsView`'s chunk. Same failure. The founder is locked out of the fix by
  the bug.
- The update banner never appeared, so there was no warning beforehand.

## Root cause

Four independent things had to line up, and did:

1. **Views are code-split** (`viewRegistry.jsx`) with content-hashed filenames.
   Only Homebase and TableView are eager.
2. **Workbox runs `skipWaiting` + `clientsClaim`** (`vite.config.js`). The new
   worker activates immediately and deletes the outdated precache — taking the
   old chunks with it — while the page keeps running the old JS.
3. **Firebase rewrites `**` → `/index.html`** (`firebase.json`). The missing
   chunk returns HTML with a 200, so the import fails on a MIME mismatch rather
   than an honest 404.
4. **`useBuildVersion` compared the server to itself.** `current` was seeded
   from the FIRST `/version.json` poll, but `version.json` always reports the
   server's newest build — so a page that was already stale on load recorded the
   new SHA as "current" and `updateAvailable` could never become true. The
   staleness detector was structurally incapable of detecting the staleness it
   existed to detect.

(2) and (4) are the load-bearing pair: the caches get cleaned out from under the
running page, and the one mechanism that would have prompted a reload first was
blind.

## Fix

1. **`src/utils/chunkRecovery.js`** — `importWithRecovery()` wraps every lazy
   view import. A chunk-load failure (matched across the Chrome/Firefox/Safari
   wordings plus the MIME-type variant) triggers `hardRefresh()`: drop caches,
   unregister the worker, reload. Guarded by a per-tab `sessionStorage` flag so
   a genuinely missing chunk reports honestly instead of looping. IndexedDB is
   untouched.
2. **`ErrorBoundary` + `ViewErrorBoundary`** — classify chunk failures as
   **E405** and render a plain-language "A new version is ready" surface whose
   only button is the hard refresh. Both boundaries live in the main bundle, so
   the exit is always reachable.
3. **`useBuildVersion`** — seeds `current` from `BUILD_SHA` (the identity
   compiled into the running bundle) instead of the first poll, so an install
   that was stale on load raises the banner on its first poll.

## Generalisation

**A recovery control must not live behind the thing it recovers.** Any
self-healing path — force update, reset, safe mode — belongs in the eagerly
loaded bundle. If it's code-split, the failure it handles can take it out too.

**A staleness check must compare the running artifact to the server, never the
server to itself.** Poll-vs-poll only detects changes that happen after the poll
starts; it is blind to the case where you were already behind. Whatever
identifies the running build has to be compiled INTO it (`buildInfo.js`).

**`skipWaiting` + `clientsClaim` buys instant activation at the cost of pulling
the rug from under open pages.** If you keep them, you owe the app an automatic
reload path AND a recovery path for the window in between.

## Prevention

- `src/utils/__tests__/chunkRecovery.test.js` — detection across browser
  wordings, the one-shot refresh, the loop guard, and the storage-blocked case.
- `src/components/ui/__tests__/ViewErrorBoundary.test.jsx` — E405 classification
  and the stale-build surface (no Try Again, no Return to Table).
- `src/hooks/__tests__/useBuildVersion.test.js` — `updateAvailable` flips on the
  FIRST poll when the server is ahead of the running build.
