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

const DEFAULT_MAX_MS = 300000;      // 5 min absolute ceiling — a runaway-mic backstop
// Raised 20s -> 45s after live use (2026-08-01): narrating a hand means reading
// the screen between thoughts, and a pause is thinking, not finishing.
const DEFAULT_SILENCE_MS = 45000;
const MAX_RESTART_FAILURES = 4;     // consecutive failures before conceding
const RESTART_BACKOFF_MS = 250;

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
  const shouldRecordRef = useRef(false);   // intent, distinct from engine state
  const startedAtRef = useRef(0);
  const lastSpeechAtRef = useRef(0);
  const silenceTimerRef = useRef(null);
  const maxTimerRef = useRef(null);
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
   * Close out the session and hand the accumulated segments to the caller.
   * `interrupted` marks sessions that were cut rather than stopped deliberately
   * (tab hidden, unmount, engine error) so the trailing thought can be flagged
   * as possibly unfinished (Gate 2 C-3).
   */
  const endSession = useCallback((interrupted) => {
    shouldRecordRef.current = false;
    clearTimers();
    detachRecognition();
    setIsRecording(false);

    const segments = segmentsRef.current;
    segmentsRef.current = [];
    setSegmentCount(0);

    // Always deliver, even when empty — the caller decides what a no-op is.
    if (onSessionEndRef.current) {
      onSessionEndRef.current(segments, { interrupted: !!interrupted });
    }
  }, [clearTimers, detachRecognition]);

  const armSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    const check = () => {
      if (!shouldRecordRef.current) return;
      const since = Date.now() - lastSpeechAtRef.current;
      if (since >= silenceMs) {
        endSession(false);
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
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    try { rec.lang = 'en-US'; } catch { /* ignore */ }

    rec.onresult = (event) => {
      try {
        const results = event.results || [];
        const from = typeof event.resultIndex === 'number' ? event.resultIndex : 0;
        for (let i = from; i < results.length; i++) {
          const result = results[i];
          if (!result || !result.isFinal) continue;
          const alt = result[0];
          if (!alt) continue;
          const text = (alt.transcript || '').trim();
          if (!text) continue;

          const now = Date.now();
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
            startedAt: lastSpeechAtRef.current || now,
            endedAt: now,
            context,
          });
          lastSpeechAtRef.current = now;
        }
        setSegmentCount(segmentsRef.current.length);
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
        endSession(true);
        return;
      }
      if (code !== 'no-speech' && code !== 'aborted') {
        setError(code);
      }
    };

    rec.onend = () => {
      if (!shouldRecordRef.current) return;          // deliberate stop, already handled
      if (Date.now() - startedAtRef.current >= maxMs) { endSession(false); return; }

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
        endSession(true);
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
  }, [Ctor, supported, detachRecognition, endSession, maxMs]);

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
    setSegmentCount(0);
    setError(null);
    restartFailuresRef.current = 0;
    shouldRecordRef.current = true;
    startedAtRef.current = Date.now();
    lastSpeechAtRef.current = Date.now();
    setIsRecording(true);

    beginRecognition();
    armSilenceTimer();
    maxTimerRef.current = setTimeout(() => endSession(false), maxMs);
  }, [supported, permissionStatus, clearTimers, beginRecognition, armSilenceTimer, endSession, maxMs]);

  /** Deliberate stop. */
  const stop = useCallback(() => {
    if (!shouldRecordRef.current) return;
    endSession(false);
  }, [endSession]);

  /** Discard without delivering — used when the caller knows the session is void. */
  const abort = useCallback(() => {
    shouldRecordRef.current = false;
    clearTimers();
    detachRecognition();
    segmentsRef.current = [];
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
        endSession(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [endSession]);

  // Unmount mid-session is an interruption, not a discard — the words were said.
  useEffect(() => {
    return () => {
      if (shouldRecordRef.current) {
        endSession(true);
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
};
