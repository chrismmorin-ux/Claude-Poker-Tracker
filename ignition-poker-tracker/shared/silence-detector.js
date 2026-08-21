/**
 * shared/silence-detector.js — is capture still alive?
 *
 * WS-516. Extracted from the `ignition-capture.js` IIFE so the decision can be
 * tested directly rather than mirrored. A mirror of this logic in a test would
 * verify the mirror; that is exactly how the original defect survived — the only
 * tests that existed exercised the zero-message path, which is the one path the
 * broken guard still allowed through.
 *
 * THE DEFECT THIS REPLACES. The detector early-returned on
 * `gameWsMessageCount > 0`. That counter is monotonic and is never reset
 * anywhere, so the guard became permanently true the instant the first game
 * message arrived, and everything below it — including recency math that was
 * already written — became unreachable for the life of the content script.
 * The detector could only ever fire for a capture that NEVER STARTED: the one
 * case the founder notices anyway, because he sits down and the panel is empty.
 * The case needing an alarm — capture runs an hour, then the socket dies — was
 * structurally undetectable. An alarm that arms only before the thing it watches
 * begins is not an alarm.
 *
 * The rule that follows: liveness is a RECENCY question, asked on every tick,
 * independent of how many messages have ever been seen. "Has capture ever
 * started" is a separate and differently-worded question, and no liveness
 * decision may read it.
 */

/**
 * Escalating silence thresholds. Each carries two messages because "capture
 * never started" and "capture stopped mid-session" are different problems with
 * different actions — but both must raise.
 */
export const SILENCE_THRESHOLDS = Object.freeze([
  Object.freeze({
    afterMs: 5000,
    level: 'info',
    neverStarted: 'Probe active but no WS messages yet',
    stopped: 'No game traffic for 5s',
  }),
  Object.freeze({
    afterMs: 15000,
    level: 'warning',
    neverStarted: 'No WS traffic after 15s — is a table open?',
    stopped: 'Capture stopped — no game traffic for 15s',
  }),
  Object.freeze({
    afterMs: 60000,
    level: 'stale',
    neverStarted: 'No game traffic for 60s — connection may be pre-existing',
    stopped: 'Capture stopped 1 min ago — hands are NOT being recorded',
  }),
  Object.freeze({
    afterMs: 300000,
    level: 'dead',
    neverStarted: 'No game traffic for 5min — page reload recommended',
    stopped: 'Capture stopped 5 min ago — hands are NOT being recorded; reload the page',
  }),
]);

/** Levels at or past which capture is considered dead rather than merely quiet. */
export const RECOVERY_LEVELS = Object.freeze(['stale', 'dead']);

/**
 * A gap is only worth a permanent marker once silence reaches this long.
 * Below it, quiet is ordinary between-hands quiet, not a capture death.
 * Matches the 'stale' threshold deliberately: the ledger records the same
 * condition the recovery banner raises on.
 */
export const GAP_MIN_MS = 60000;

/**
 * Decide the silence state for one tick. Pure — all side effects belong to the
 * caller.
 *
 * @param {Object} input
 * @param {number}  input.now
 * @param {boolean} input.probeReady
 * @param {number}  input.captureStartedAt
 * @param {number|null} input.probeReadyAt
 * @param {number|null} input.lastWsMessageAt   - last GAME message, epoch ms
 * @param {boolean} input.captureEverStarted    - lifetime flag ONLY; never a liveness input
 * @param {string|null} input.prevLevel
 * @param {ReadonlyArray} [input.thresholds]
 * @returns {{
 *   level: string|null,
 *   message: string|null,
 *   silenceMs: number,
 *   escalated: boolean,
 *   recoveryNeeded: boolean,
 *   cleared: boolean,
 *   gapFrom: number|null,
 *   probeStalled: boolean,
 * }}
 */
export const evaluateSilence = ({
  now,
  probeReady,
  captureStartedAt,
  probeReadyAt = null,
  lastWsMessageAt = null,
  captureEverStarted = false,
  prevLevel = null,
  thresholds = SILENCE_THRESHOLDS,
}) => {
  const base = {
    level: prevLevel,
    message: null,
    silenceMs: 0,
    escalated: false,
    recoveryNeeded: false,
    cleared: false,
    gapFrom: null,
    probeStalled: false,
  };

  // The probe never attached. Distinct from silence: there is no channel at all,
  // so recency of game traffic is not the question being asked.
  if (!probeReady) {
    if (now - captureStartedAt > 5000 && prevLevel !== 'no_probe') {
      return { ...base, level: 'no_probe', escalated: true, probeStalled: true };
    }
    return base;
  }

  const lastActivity = lastWsMessageAt || probeReadyAt || captureStartedAt;
  const silenceMs = now - lastActivity;

  // Traffic within the first threshold means capture is alive.
  if (silenceMs < thresholds[0].afterMs) {
    return {
      ...base,
      level: null,
      silenceMs,
      cleared: prevLevel !== null,
    };
  }

  let crossed = null;
  for (const t of thresholds) {
    if (silenceMs >= t.afterMs) crossed = t;
  }
  if (!crossed) return { ...base, silenceMs };

  const escalated = crossed.level !== prevLevel;
  return {
    level: crossed.level,
    message: captureEverStarted ? crossed.stopped : crossed.neverStarted,
    silenceMs,
    escalated,
    recoveryNeeded: escalated && RECOVERY_LEVELS.includes(crossed.level),
    cleared: false,
    gapFrom: lastActivity,
    probeStalled: false,
  };
};

/**
 * Should an interval of silence be written to the durable gap ledger?
 * @param {number} from - last observed activity
 * @param {number} to   - now, or the moment traffic resumed
 */
export const isRecordableGap = (from, to) =>
  typeof from === 'number' && typeof to === 'number' && to - from >= GAP_MIN_MS;
