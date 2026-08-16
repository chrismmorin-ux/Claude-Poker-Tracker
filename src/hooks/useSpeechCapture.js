/**
 * useSpeechCapture — general Web Speech lifecycle for long-form capture
 *
 * Surface spec: docs/design/surfaces/voice-reasoning-notes.md
 * Gate 2 findings: C-3 (retain partials), C-4 (flush on visibilitychange),
 *                  E-4 (deliberate activation)
 *
 * Built for Voice Reasoning Notes: a recording session that stays open while the
 * founder navigates, emitting a segment each time speech settles (founder
 * requirement F4).
 *
 * DIFFERENT FROM useVoiceCardEntry ON PURPOSE. That hook gates hard and returns
 * strict no-ops (WS-181 R6) because its failure mode is data corruption — a wrong
 * card written to a hand. This hook's failure mode is LOST EVIDENCE, so its
 * polarity is inverted:
 *   - no confidence floor; low-confidence prose is retained
 *   - partial transcripts survive interruption, marked by the caller
 *   - in-flight speech is flushed on tab-hide so a screen timeout cannot eat a
 *     narration
 * Do not "align" this hook with the card lane's gating. The asymmetry is the design.
 *
 * The hook does NOT know what a poker hand is. Callers pass `captureContext`,
 * which is invoked at the moment each segment lands so the state binding is taken
 * when the words were spoken, not when the session ends.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// Raised 5min -> 10min after live use (2026-08-01): a full preflop-through-
// showdown breakdown runs longer than five minutes, and hitting this ceiling
// truncated a narration mid-thought. Still a runaway-mic backstop — the 45s
// silence timer is what ends a session in practice.
const DEFAULT_MAX_MS = 600000;
// Raised 20s -> 45s after live use (2026-08-01): narrating a hand means reading
// the screen between thoughts, and a pause is thinking, not finishing.
const DEFAULT_SILENCE_MS = 45000;
const MAX_RESTART_FAILURES = 4;     // consecutive failures before conceding
const RESTART_BACKOFF_MS = 250;
// stop() asks the engine to finalize the audio it has already captured, and that
// result arrives asynchronously. This is how long the session waits for it
// before delivering anyway — the engine is not obliged to answer.
const TAIL_GRACE_MS = 1200;

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

async function readMicPermissionStatus() {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.permissions &&
      typeof navigator.permissions.query === 'function'
    ) {
      const res = await navigator.permissions.query({ name: 'microphone' });
      return res.state;
    }
  } catch {
    /* ignore */
  }
  return 'unknown';
}

/**
 * @param {object} options
 * @param {number} [options.maxMs] — absolute session ceiling
 * @param {number} [options.silenceMs] — stop after this much continuous silence
 * @param {() => object|null} [options.captureContext] — called per segment
 * @param {(segments: Array, meta: {interrupted: boolean}) => void} [options.onSessionEnd]
 */
export function useSpeechCapture({
  maxMs = DEFAULT_MAX_MS,
  silenceMs = DEFAULT_SILENCE_MS,
  captureContext = null,
  onSessionEnd = null,
} = {}) {
  const Ctor = getSpeechRecognitionCtor();
  const supported = !!Ctor;

  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [isRecording, setIsRecording] = useState(false);
  const [segmentCount, setSegmentCount] = useState(0);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const segmentsRef = useRef([]);
  const segmentCountRef = useRef(0);
  const shouldRecordRef = useRef(false);   // intent, distinct from engine state
  const sessionActiveRef = useRef(false);  // guards exactly-once delivery
  const startedAtRef = useRef(0);
  const lastSpeechAtRef = useRef(0);
  // Speech the engine has recognised but not yet marked final. Held rather than
  // pushed so it can be recovered when a session ends before the engine settles
  // — otherwise everything said since the last pause is silently discarded.
  const pendingInterimRef = useRef('');
  const segmentStartRef = useRef(0);
  const silenceTimerRef = useRef(null);
  const maxTimerRef = useRef(null);
  const graceTimerRef = useRef(null);
  // Chrome ends continuous recognition on its own after a pause — routinely,
  // several times inside one narration. Restarting is the normal path, not an
  // error path, so a single failure must not end the session.
  const restartFailuresRef = useRef(0);
  const restartTimerRef = useRef(null);
  const beginRecognitionRef = useRef(null);

  // Keep callbacks in refs so restarting recognition mid-session never closes
  // over a stale context getter.
  const captureContextRef = useRef(captureContext);
  const onSessionEndRef = useRef(onSessionEnd);
  useEffect(() => { captureContextRef.current = captureContext; }, [captureContext]);
  useEffect(() => { onSessionEndRef.current = onSessionEnd; }, [onSessionEnd]);

  useEffect(() => {
    if (!supported) return undefined;
    let cancelled = false;
    (async () => {
      const s = await readMicPermissionStatus();
      if (!cancelled) setPermissionStatus(s);
    })();
    return () => { cancelled = true; };
  }, [supported]);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
    if (graceTimerRef.current) { clearTimeout(graceTimerRef.current); graceTimerRef.current = null; }
  }, []);

  const detachRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try { rec.onresult = null; } catch { /* ignore */ }
    try { rec.onerror = null; } catch { /* ignore */ }
    try { rec.onend = null; } catch { /* ignore */ }
    try { rec.onspeechstart = null; } catch { /* ignore */ }
    try { rec.stop(); } catch { /* ignore */ }
    recognitionRef.current = null;
  }, []);

  /**
   * Commit whatever the engine recognised but never marked final.
   *
   * With `interimResults` on, a long uninterrupted stretch of speech sits in the
   * engine as a single pending result until the founder pauses. If the session
   * closes first, that pending stretch is gone — which is how a narration ends
   * up reading as though it stops mid-thought. Retained here and marked
   * `interrupted`, because an unfinalized thought may be clipped and a grader
   * has to know that.
   */
  const flushPendingInterim = useCallback(() => {
    const text = pendingInterimRef.current.trim();
    pendingInterimRef.current = '';
    if (!text) return;

    const now = Date.now();
    let context = null;
    try {
      context = captureContextRef.current ? captureContextRef.current() : null;
    } catch {
      context = null;
    }

    segmentsRef.current.push({
      text,
      // The engine never scored it. `null`, never a guessed number.
      confidence: null,
      startedAt: segmentStartRef.current || now,
      endedAt: now,
      context,
      interrupted: true,
    });
    segmentStartRef.current = 0;
    segmentCountRef.current = segmentsRef.current.length;
    setSegmentCount(segmentCountRef.current);
  }, []);

  /**
   * Tear down and hand the accumulated segments to the caller. Guarded so a
   * session is delivered exactly once no matter how many close paths race.
   *
   * `reason` names WHY the session ended. A session that hit the silence timer
   * or the length ceiling is not a deliberate stop, and recording it as one is
   * what leaves the founder unsure whether a note was cut off.
   */
  const finishSession = useCallback((interrupted, reason) => {
    if (!sessionActiveRef.current) return;
    sessionActiveRef.current = false;
    shouldRecordRef.current = false;
    clearTimers();
    detachRecognition();
    flushPendingInterim();
    setIsRecording(false);

    const segments = segmentsRef.current;
    segmentsRef.current = [];
    segmentCountRef.current = 0;
    setSegmentCount(0);

    // Always deliver, even when empty — the caller decides what a no-op is.
    if (onSessionEndRef.current) {
      onSessionEndRef.current(segments, {
        interrupted: !!interrupted,
        reason: reason || null,
      });
    }
  }, [clearTimers, detachRecognition, flushPendingInterim]);

  /**
   * Close the session. With `awaitTail`, give the engine a bounded moment to
   * finalize the audio it already captured before tearing down.
   *
   * THE BUG THIS SHAPE EXISTS FOR: `stop()` finalizes captured audio and
   * delivers it through `onresult` — asynchronously. Detaching handlers first
   * (as teardown naturally wants to) drops that final result on the floor, so
   * every session lost its tail. Leave `onresult` attached, stop, and close out
   * when the engine says it is done.
   *
   * Paths where waiting is not an option — tab hidden, unmount, permission
   * revoked, mic gone — close immediately and rely on the interim flush.
   */
  const endSession = useCallback((interrupted, reason, { awaitTail = false } = {}) => {
    if (!sessionActiveRef.current) return;

    const rec = recognitionRef.current;
    if (!awaitTail || !rec) {
      finishSession(interrupted, reason);
      return;
    }

    // The mic is closing now; the UI must not keep claiming otherwise while we
    // wait for the engine's last word.
    shouldRecordRef.current = false;
    setIsRecording(false);
    clearTimers();

    try { rec.onend = () => finishSession(interrupted, reason); } catch { /* ignore */ }
    try {
      rec.stop();
    } catch {
      finishSession(interrupted, reason);
      return;
    }
    if (sessionActiveRef.current) {
      graceTimerRef.current = setTimeout(() => finishSession(interrupted, reason), TAIL_GRACE_MS);
    }
  }, [finishSession, clearTimers]);

  const armSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    const check = () => {
      if (!shouldRecordRef.current) return;
      const since = Date.now() - lastSpeechAtRef.current;
      if (since >= silenceMs) {
        // The founder did not end this — the mic timed out while he was reading
        // the screen. Marked interrupted so a truncated note is distinguishable
        // from a finished one.
        endSession(true, 'silence', { awaitTail: true });
      } else {
        silenceTimerRef.current = setTimeout(check, silenceMs - since);
      }
    };
    silenceTimerRef.current = setTimeout(check, silenceMs);
  }, [silenceMs, endSession]);

  // Create + wire a recognition instance. Called on start and on every
  // auto-restart: Chrome ends continuous recognition on its own after a pause,
  // and a 60s narration must survive that without losing the session.
  // Returns true when a live recognition instance is running. The boolean is
  // load-bearing: the restart path in `onend` needs to know whether the mic is
  // actually listening, not merely that a call was made.
  const beginRecognition = useCallback(() => {
    if (!supported) return false;
    detachRecognition();

    const rec = new Ctor();
    rec.continuous = true;
    // ON, despite only final results becoming segments. Interims are the only
    // record of speech the engine has heard but not yet settled, and without
    // them a session that closes mid-sentence loses everything back to the last
    // pause. See flushPendingInterim.
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    try { rec.lang = 'en-US'; } catch { /* ignore */ }

    rec.onresult = (event) => {
      try {
        const results = event.results || [];
        const from = typeof event.resultIndex === 'number' ? event.resultIndex : 0;
        let interim = '';

        for (let i = from; i < results.length; i++) {
          const result = results[i];
          if (!result) continue;
          const alt = result[0];
          if (!alt) continue;
          const text = (alt.transcript || '').trim();
          if (!text) continue;

          const now = Date.now();

          if (!result.isFinal) {
            interim = interim ? `${interim} ${text}` : text;
            if (!segmentStartRef.current) segmentStartRef.current = now;
            // Interim speech is speech. Counting it keeps the silence ceiling
            // measuring actual silence rather than "no finalized result yet",
            // which is a different and much shorter quantity mid-sentence.
            lastSpeechAtRef.current = now;
            continue;
          }

          // Context is captured HERE — at segment arrival — so the binding
          // reflects where the founder was when he said these words, not where
          // he ended up by the time the session closed.
          let context = null;
          try {
            context = captureContextRef.current ? captureContextRef.current() : null;
          } catch {
            context = null;
          }

          segmentsRef.current.push({
            text,
            // No floor. Retained as-is so a grader can weigh it later.
            confidence: typeof alt.confidence === 'number' ? alt.confidence : null,
            startedAt: segmentStartRef.current || lastSpeechAtRef.current || now,
            endedAt: now,
            context,
          });
          segmentStartRef.current = 0;
          lastSpeechAtRef.current = now;
        }

        // Rebuilt from this event rather than accumulated: an utterance that
        // just went final must not also survive as a pending partial.
        pendingInterimRef.current = interim;

        // Only on a real change — interims arrive several times a second and
        // must not each cost a render.
        if (segmentsRef.current.length !== segmentCountRef.current) {
          segmentCountRef.current = segmentsRef.current.length;
          setSegmentCount(segmentCountRef.current);
        }
      } catch {
        /* a malformed result must never kill the session */
      }
    };

    rec.onspeechstart = () => { lastSpeechAtRef.current = Date.now(); };

    rec.onerror = (event) => {
      const code = (event && event.error) || 'unknown';
      // 'no-speech' and 'aborted' are routine in a long session; the restart
      // path handles them. Only surface genuine failures.
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setPermissionStatus('denied');
        setError(code);
        // No waiting — the mic is already gone. The interim flush is the only
        // thing standing between the founder and a lost tail here.
        endSession(true, code);
        return;
      }
      if (code !== 'no-speech' && code !== 'aborted') {
        setError(code);
      }
    };

    rec.onend = () => {
      if (!shouldRecordRef.current) return;          // deliberate stop, already handled
      // Chrome normally finalizes before ending; when it does not, the fresh
      // instance about to replace this one would drop the in-flight words.
      flushPendingInterim();
      if (Date.now() - startedAtRef.current >= maxMs) { endSession(true, 'max-duration'); return; }

      // ALWAYS build a fresh instance. Calling start() again on the instance
      // that just ended throws InvalidStateError in Chrome — the bug that used
      // to strand the session with the UI showing "recording" and no live mic.
      const ok = beginRecognitionRef.current && beginRecognitionRef.current();
      if (ok) {
        restartFailuresRef.current = 0;
        return;
      }

      // One failed restart is not a dead session — back off briefly and retry.
      restartFailuresRef.current += 1;
      if (restartFailuresRef.current >= MAX_RESTART_FAILURES) {
        endSession(true, 'restart-failed');
        return;
      }
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (shouldRecordRef.current && beginRecognitionRef.current) {
          beginRecognitionRef.current();
        }
      }, RESTART_BACKOFF_MS);
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setError(null);
      return true;
    } catch (err) {
      // Reported to the caller so the restart path can decide, rather than
      // swallowed here.
      setError((err && err.message) || 'start-failed');
      recognitionRef.current = null;
      return false;
    }
  }, [Ctor, supported, detachRecognition, endSession, maxMs, flushPendingInterim]);

  // Kept in a ref so `onend` always reaches the current instance-builder rather
  // than one captured when the session began.
  useEffect(() => { beginRecognitionRef.current = beginRecognition; }, [beginRecognition]);

  /** Begin a session. Deliberate activation is the caller's responsibility (E-4). */
  const start = useCallback(() => {
    if (!supported) return;
    if (permissionStatus === 'denied') return;
    if (shouldRecordRef.current) return;

    clearTimers();
    segmentsRef.current = [];
    segmentCountRef.current = 0;
    setSegmentCount(0);
    setError(null);
    restartFailuresRef.current = 0;
    pendingInterimRef.current = '';
    segmentStartRef.current = 0;
    shouldRecordRef.current = true;
    sessionActiveRef.current = true;
    startedAtRef.current = Date.now();
    lastSpeechAtRef.current = Date.now();
    setIsRecording(true);

    beginRecognition();
    armSilenceTimer();
    // Reaching the ceiling is a cut, not a finish. Marked so.
    maxTimerRef.current = setTimeout(
      () => endSession(true, 'max-duration', { awaitTail: true }),
      maxMs,
    );
  }, [supported, permissionStatus, clearTimers, beginRecognition, armSilenceTimer, endSession, maxMs]);

  /** Deliberate stop. */
  const stop = useCallback(() => {
    if (!shouldRecordRef.current) return;
    endSession(false, 'stopped', { awaitTail: true });
  }, [endSession]);

  /** Discard without delivering — used when the caller knows the session is void. */
  const abort = useCallback(() => {
    shouldRecordRef.current = false;
    sessionActiveRef.current = false;
    clearTimers();
    detachRecognition();
    segmentsRef.current = [];
    segmentCountRef.current = 0;
    pendingInterimRef.current = '';
    segmentStartRef.current = 0;
    setSegmentCount(0);
    setIsRecording(false);
  }, [clearTimers, detachRecognition]);

  // Gate 2 C-4 — flush on tab-hide. Losing a long narration to a screen timeout
  // would be this feature's worst everyday failure, and Web Speech cannot
  // survive backgrounding.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && shouldRecordRef.current) {
        // No grace window — the page may be frozen before the engine answers.
        endSession(true, 'hidden');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [endSession]);

  // Unmount mid-session is an interruption, not a discard — the words were said.
  useEffect(() => {
    return () => {
      if (shouldRecordRef.current) {
        endSession(true, 'unmounted');
      } else {
        clearTimers();
        detachRecognition();
      }
    };
  }, [endSession, clearTimers, detachRecognition]);

  return {
    supported,
    permissionStatus,
    isRecording,
    segmentCount,
    error,
    start,
    stop,
    abort,
  };
}

export const _SPEECH_CAPTURE_INTERNAL = {
  DEFAULT_MAX_MS,
  DEFAULT_SILENCE_MS,
  TAIL_GRACE_MS,
};
