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

## Sweep for the same pattern (2026-07-25)

Audited the rest of the codebase for the three shapes above.

**Found and fixed — `OnlineView.handleReloadConfirm`.** The extension
protocol-mismatch modal called plain `window.location.reload()`. A mismatch can
mean either side is behind; when it's the app, the active worker answers that
navigation from its own precache and the same stale build returns. The code
already had a `postReloadStatus === 'still-mismatched'` branch acknowledging the
reload can fail, and its advice ("update the extension manually") is wrong in
exactly the app-stale case. Now uses `hardRefresh()`.

**Found — the two staleness surfaces disagreed, which is how the bug hid.**
`DataAndAbout` computed `isStale` as `BUILD_SHA !== latestVersion` (running →
server, correct). `UpdateBanner` used `useBuildVersion`'s `updateAvailable`
(server → server, structurally blind). Same question, two answers, and the one
on the always-visible surface was the broken one. Fixed with the main change.

**Found, then fixed (2026-07-26) — a hanging chunk request had no exit.**
`importWithRecovery` catches rejection; a stalled request never rejects, so the
Suspense fallback spun forever with no timeout, message, or button. Now
`ViewLoadingFallback` (`src/components/ui/ViewLoadingFallback.jsx`): quiet while
the load is plausibly still working, then at 6s explains the delay and offers
Back to Home (leaving the Suspense boundary for an eager view always works), and
at 18s adds Update App. It deliberately never auto-refreshes — `hardRefresh`
clears the precache, so firing it in response to a weak connection would strip
the offline copy at the moment the network cannot replace it, turning a slow load
into a broken app. The founder chooses; the app only explains.

**Found, then fixed (2026-07-26) — persistence init failures degraded silently.**
`usePersistence`, `useSessionPersistence`, `usePlayerPersistence` and
`useSettingsPersistence` all `catch → setIsReady(true)` with a "continue without
persistence" comment. The app looked completely normal and saved nothing; at a
live table that surfaces when the session is already gone. Continuing is still
the right call — a tracker that refuses to open is useless at a table — so the
degradation is unchanged and only the silence was fixed:
`src/utils/persistenceHealth.js` records per-subsystem failures (and writes
**E307** to the exportable error log), and the app-root `HealthIndicator` shows
"Not saving — data at risk" at the top of its fault precedence, above sync,
because a sync fault costs re-importable hands while this costs the session being
played. Surfacing it on the pill rather than in a view was `navigation-ia.md`'s
own rule ("an operator/health signal → extend HealthIndicator") — a per-view
warning is invisible from the table, the one place it matters.

**Clean — the extension.** `onInstalled` writes `EXTENSION_JUST_UPDATED` so the
side panel surfaces a one-shot "reload the Ignition tab" banner. Orphaned
content scripts after an update are the exact same hazard, and the extension
warns instead of failing quietly. This is the pattern done right.

## Prevention

- `src/utils/__tests__/chunkRecovery.test.js` — detection across browser
  wordings, the one-shot refresh, the loop guard, and the storage-blocked case.
- `src/components/ui/__tests__/ViewErrorBoundary.test.jsx` — E405 classification
  and the stale-build surface (no Try Again, no Return to Table).
- `src/hooks/__tests__/useBuildVersion.test.js` — `updateAvailable` flips on the
  FIRST poll when the server is ahead of the running build, and re-checks on
  foreground/focus/online rather than trusting a frozen interval.
- `src/components/ui/__tests__/ViewLoadingFallback.test.jsx` — the tiers appear
  on schedule, Home leaves the boundary, and the fallback NEVER clears caches on
  its own.
- `src/utils/__tests__/persistenceHealth.test.js` — per-subsystem failure
  recording, E307 written to the exportable log, recovery clearing on a
  successful retry.
- `src/components/ui/__tests__/HealthIndicator.test.jsx` — not-saving outranks
  sync and logged errors; the error-count fault is scoped to the running build.
