import { logger } from './errorHandler';
import { hardRefresh } from './swUpdate';

/**
 * chunkRecovery — survive a deploy that happens mid-session.
 *
 * Views are code-split (viewRegistry.jsx), so their JS chunks are fetched the
 * first time the founder opens them. Chunk filenames are content-hashed, and a
 * Firebase deploy replaces the whole `dist/` — the previous build's chunks stop
 * existing the moment a new build ships.
 *
 * That leaves a window where the app is broken with no way out:
 *   1. A page loaded before the deploy is still running the old bundle.
 *   2. The new service worker activates (skipWaiting + clientsClaim) and Workbox
 *      deletes the old precache, taking the old chunks with it.
 *   3. The first lazy view the founder opens after that requests a chunk that is
 *      gone from cache AND gone from the server.
 *   4. `firebase.json` rewrites every unmatched path to /index.html, so the
 *      request comes back as HTML with a 200 — the import rejects with either
 *      "Failed to fetch dynamically imported module" or a MIME-type complaint.
 *
 * Observed 2026-07-25: tapping a seat on the Table screen (→ PlayerFinderView)
 * dead-ended on the E401 boundary. Every recovery control — Settings' Force
 * Update included — is itself behind a lazy chunk, so the founder was locked out
 * of the fix by the bug.
 *
 * The recovery is the same one the Update banner performs: drop the caches,
 * unregister the worker, reload. Done automatically, once per tab, so a deploy
 * mid-session costs a reload instead of a dead end.
 */

// Per-tab guard. If the reload didn't fix it, the problem isn't staleness —
// looping would trap the founder in a refresh cycle with nothing on screen.
const RECOVERY_KEY = 'chunkRecoveryAttempted';

const readAttempted = () => {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === '1';
  } catch {
    // sessionStorage unavailable (private mode / blocked storage). Treating it
    // as "already attempted" is the safe read: one honest error beats a loop.
    return true;
  }
};

const markAttempted = () => {
  try {
    sessionStorage.setItem(RECOVERY_KEY, '1');
  } catch {
    /* nothing to do — readAttempted() fails closed in this environment */
  }
};

/** Test seam. Production never needs it. */
export const __resetChunkRecovery = () => {
  try {
    sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    /* nothing to reset */
  }
};

// Browsers disagree on the wording, and the Firebase rewrite adds a MIME-type
// variant on top. Match on the phrases rather than the error type — none of
// these throw a distinguishable class.
const CHUNK_ERROR_PATTERNS = [
  'failed to fetch dynamically imported module', // Chrome / Edge
  'error loading dynamically imported module',   // Firefox
  'importing a module script failed',            // Safari
  'failed to load module script',                // MIME-type mismatch (HTML for JS)
  'expected a javascript module script',         // MIME-type mismatch, long form
  'unable to preload css',                       // Vite's CSS-chunk preloader
  'loading chunk',                               // legacy chunk-loader wording
  'loading css chunk',
];

/**
 * Is this the "the chunk I asked for isn't there" failure?
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export const isChunkLoadError = (error) => {
  const message = typeof error === 'string' ? error : error?.message;
  if (!message) return false;
  const lower = message.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
};

/**
 * Run a dynamic import, self-healing once if its chunk has gone missing.
 *
 * On a chunk failure this clears the caches, unregisters the worker and
 * reloads. The returned promise deliberately never settles in that case: the
 * page is navigating away, and settling it either way would flash the error
 * boundary or a broken view on the way out.
 *
 * Any non-chunk error (a genuine module-level throw) is re-thrown untouched so
 * the error boundary reports it accurately.
 *
 * @param {() => Promise<any>} importFn - the `() => import('...')` thunk
 * @param {string} [label] - module name for the log line
 * @returns {Promise<any>} the module namespace
 */
export const importWithRecovery = async (importFn, label = 'unknown') => {
  try {
    return await importFn();
  } catch (error) {
    if (!isChunkLoadError(error)) throw error;

    if (readAttempted()) {
      // Already refreshed this tab and the chunk still won't load — the server
      // is genuinely missing it, or the network is down. Report it honestly.
      logger.error('chunkRecovery', new Error(
        `Chunk for "${label}" still unreachable after a refresh: ${error.message}`
      ));
      throw error;
    }

    markAttempted();
    logger.error('chunkRecovery', new Error(
      `Chunk for "${label}" missing — refreshing to the current build: ${error.message}`
    ));

    await hardRefresh();
    return new Promise(() => {});
  }
};
