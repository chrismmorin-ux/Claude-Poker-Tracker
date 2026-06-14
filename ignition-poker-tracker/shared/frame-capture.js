/**
 * shared/frame-capture.js — raw WebSocket frame recorder (debug ground-truth tool)
 *
 * PURPOSE: the test suite is built on hand-authored fixtures, so it cannot catch
 * producer/format drift against the REAL Ignition wire. This module lets the
 * founder capture a real session's raw frames to a downloadable file, which then
 * becomes the first real test fixture and confirms which live-path defects fire.
 *
 * DESIGN:
 *  - Deliberately self-contained — does NOT route through shared/settings.js, so a
 *    throwaway diagnostic flag never touches the side-panel render snapshot/contract.
 *  - The flag lives in chrome.storage.local under FRAME_CAPTURE_FLAG (default off).
 *  - Each content-script context (manifest runs `all_frames: true`, so several may
 *    run at once) writes its OWN buffer key (FRAME_CAPTURE_PREFIX + contextId) to
 *    avoid cross-frame read-merge-write races. The options page merges all keys.
 *  - Records EVERY incoming frame regardless of game/non-game classification — the
 *    `isGameWsUrl` filter is itself a suspected defect, so we must not let it strip
 *    data. Binary frames (no payload from the probe) are recorded as metadata so a
 *    format move to binary is visible in the export.
 *
 * All I/O is dependency-injected (storage / now / timers) so the recorder is unit
 * testable without a browser — matching the codebase's DI convention.
 */

export const FRAME_CAPTURE_FLAG = 'capture.rawFrames';
export const FRAME_CAPTURE_PREFIX = 'capture.frames::';

const DEFAULT_MAX_RECORDS = 4000;
const DEFAULT_MAX_BYTES = 4_500_000; // ~4.5MB per context; chrome.storage.local default quota is 10MB
const DEFAULT_FLUSH_DELAY_MS = 1500;

// ---------------------------------------------------------------------------
// FLAG — read/write/observe (chrome.storage.local, direct)
// ---------------------------------------------------------------------------

export async function isCaptureEnabled(storage = chrome.storage.local) {
  const raw = await storage.get(FRAME_CAPTURE_FLAG);
  return Boolean(raw?.[FRAME_CAPTURE_FLAG]);
}

export async function setCaptureEnabled(on, storage = chrome.storage.local) {
  await storage.set({ [FRAME_CAPTURE_FLAG]: Boolean(on) });
}

/**
 * Fire `onChange(enabled)` whenever the capture flag flips in local storage.
 * Returns an unsubscribe function.
 */
export function observeCaptureFlag(onChange, runtime = chrome) {
  const listener = (changes, area) => {
    if (area !== 'local') return;
    if (!Object.prototype.hasOwnProperty.call(changes, FRAME_CAPTURE_FLAG)) return;
    onChange(Boolean(changes[FRAME_CAPTURE_FLAG].newValue));
  };
  runtime.storage.onChanged.addListener(listener);
  return () => runtime.storage.onChanged.removeListener(listener);
}

// ---------------------------------------------------------------------------
// RECORDER — content-script side ring buffer with debounced flush
// ---------------------------------------------------------------------------

/**
 * @param {object} opts
 * @param {string} opts.contextId   unique per content-script load (keys the buffer)
 * @returns recorder { enabled, setEnabled, record, flushNow, _state }
 */
export function createFrameRecorder({
  storage = chrome.storage.local,
  contextId,
  now = () => Date.now(),
  maxRecords = DEFAULT_MAX_RECORDS,
  maxBytes = DEFAULT_MAX_BYTES,
  flushDelayMs = DEFAULT_FLUSH_DELAY_MS,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  if (!contextId) throw new Error('createFrameRecorder: contextId is required');
  const storageKey = FRAME_CAPTURE_PREFIX + contextId;

  let buffer = [];
  let approxBytes = 0;
  let enabled = false;
  let dirty = false;
  let flushTimer = null;

  const trim = () => {
    while (buffer.length > maxRecords || approxBytes > maxBytes) {
      const dropped = buffer.shift();
      if (!dropped) break;
      approxBytes -= dropped._b || 0;
    }
  };

  const serialize = () => buffer.map(({ _b, ...rest }) => rest);

  async function flush() {
    if (!dirty) return;
    dirty = false;
    try {
      await storage.set({ [storageKey]: serialize() });
    } catch (_) {
      // Likely quota — drop the oldest 90% and retry once so capture survives.
      const keep = Math.max(200, Math.floor(buffer.length * 0.1));
      while (buffer.length > keep) {
        const d = buffer.shift();
        approxBytes -= d?._b || 0;
      }
      try { await storage.set({ [storageKey]: serialize() }); } catch (__) { /* give up this flush */ }
    }
  }

  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeoutFn(() => { flushTimer = null; flush(); }, flushDelayMs);
  };

  return {
    get enabled() { return enabled; },

    setEnabled(on) {
      enabled = Boolean(on);
      if (!enabled && flushTimer) { clearTimeoutFn(flushTimer); flushTimer = null; }
    },

    /** Append a record. No-op when disabled (cheap guard on the hot path). */
    record(rec) {
      if (!enabled || !rec) return;
      const full = { t: now(), ...rec };
      const sz = (typeof full.data === 'string' ? full.data.length : 0) + 96;
      full._b = sz;
      buffer.push(full);
      approxBytes += sz;
      trim();
      dirty = true;
      scheduleFlush();
    },

    /** Force an immediate write (call on pagehide / context teardown). */
    flushNow() {
      if (flushTimer) { clearTimeoutFn(flushTimer); flushTimer = null; }
      return flush();
    },

    _state() { return { length: buffer.length, approxBytes, storageKey, enabled }; },
  };
}

// ---------------------------------------------------------------------------
// EXPORT / CLEAR — options-page side (merges all context buffers)
// ---------------------------------------------------------------------------

/** Read every context's buffer, merge, and sort chronologically. */
export async function collectFrames(storage = chrome.storage.local) {
  const all = await storage.get(null);
  const records = [];
  for (const [k, v] of Object.entries(all || {})) {
    if (k.startsWith(FRAME_CAPTURE_PREFIX) && Array.isArray(v)) records.push(...v);
  }
  records.sort((a, b) => (a.t || 0) - (b.t || 0));
  return records;
}

/** Newline-delimited JSON (.jsonl) — one record per line. */
export function toJsonl(records) {
  return records.map((r) => JSON.stringify(r)).join('\n');
}

/** Remove all capture buffers. Returns the number of keys cleared. */
export async function clearFrames(storage = chrome.storage.local) {
  const all = await storage.get(null);
  const keys = Object.keys(all || {}).filter((k) => k.startsWith(FRAME_CAPTURE_PREFIX));
  if (keys.length) await storage.remove(keys);
  return keys.length;
}
