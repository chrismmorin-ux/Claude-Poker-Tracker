/**
 * versionMismatchStorage.js — sessionStorage flag for protocol-version reload verification.
 *
 * When the user confirms a reload from the version-mismatch modal, we record
 * the pre-reload versions so the next mount of useSyncBridge can compare
 * them against the post-reload STATUS message and tell the user whether
 * the reload actually fixed the mismatch. Flag is JSON-encoded (4 fields)
 * with a 60s TTL — long enough for one heartbeat cycle, short enough that
 * stale flags from prior sessions don't trip the recovery logic.
 *
 * Shape of stored value:
 *   { ts, fromExtProtocolVersion, fromExtManifestVersion, fromAppProtocolVersion }
 */

const KEY = 'versionMismatchReload';
const TTL_MS = 60_000;

/**
 * Persist the pre-reload version snapshot for post-reload comparison.
 * @param {{ extProtocolVersion: number|null, extManifestVersion: string|null, appProtocolVersion: number }} snapshot
 */
export const writeReloadFlag = ({ extProtocolVersion, extManifestVersion, appProtocolVersion }) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({
      ts: Date.now(),
      fromExtProtocolVersion: extProtocolVersion ?? null,
      fromExtManifestVersion: extManifestVersion ?? null,
      fromAppProtocolVersion: appProtocolVersion,
    }));
  } catch (e) {
    // QuotaExceededError / disabled storage: the post-reload verification flag
    // won't persist, so useSyncBridge can't confirm whether the reload fixed
    // the mismatch. Non-fatal — degrade silently for the user, but leave a
    // breadcrumb (per .claude/rules/error-handling; matches rangeLabPersistence).
    console.warn('[versionMismatch] writeReloadFlag failed:', e?.message || e);
  }
};

/**
 * Read the pre-reload snapshot, or null if absent / stale / corrupted.
 * Stale entries (>60s) are removed as a side-effect.
 * @returns {null|{ ts: number, fromExtProtocolVersion: number|null, fromExtManifestVersion: string|null, fromAppProtocolVersion: number }}
 */
export const readReloadFlag = () => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.ts !== 'number') {
      sessionStorage.removeItem(KEY);
      return null;
    }
    if (Date.now() - parsed.ts > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
};

/** Remove the flag — called once post-reload comparison resolves either way. */
export const clearReloadFlag = () => {
  try { sessionStorage.removeItem(KEY); } catch (_) { /* swallow */ }
};

// ---------------------------------------------------------------------------
// WS-077: dismissed-despite-mismatch flag — independent lifecycle from the
// reload flag. Set when the user clicks "Continue Anyway" on the version-
// mismatch banner; persists for the session lifetime (sessionStorage handles
// the boundary). Cleared automatically when versions reconverge or when the
// user explicitly re-engages by reloading.
// ---------------------------------------------------------------------------

const DISMISS_KEY = 'versionMismatchDismissed';

/** Persist the user's "I know about the mismatch, continue anyway" override. */
export const writeDismissedFlag = () => {
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify({ ts: Date.now() }));
  } catch (e) {
    // QuotaExceededError / disabled storage: the "continue anyway" override
    // won't persist, so the banner may reappear next mount. Non-fatal — degrade
    // silently for the user, but leave a breadcrumb (per error-handling rule).
    console.warn('[versionMismatch] writeDismissedFlag failed:', e?.message || e);
  }
};

/** True iff the user has dismissed the version-mismatch banner this session. */
export const readDismissedFlag = () => {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!(parsed && typeof parsed.ts === 'number');
  } catch (_) {
    return false;
  }
};

/** Clear the dismiss override — called when versions reconverge. */
export const clearDismissedFlag = () => {
  try { sessionStorage.removeItem(DISMISS_KEY); } catch (_) { /* swallow */ }
};
