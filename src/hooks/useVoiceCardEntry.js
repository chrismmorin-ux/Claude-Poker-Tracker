/**
 * useVoiceCardEntry — Web Speech lifecycle orchestrator for VCE
 *
 * Surface spec: docs/design/surfaces/voice-card-entry.md
 * Ticket: WS-181
 *
 * Responsibilities:
 *   - Detect Web Speech support and OS-level mic permission status.
 *   - Provide start/stop API gated by the 300ms hold threshold (Gate 2 E-3).
 *   - Track utterance duration to feed the R6 parser pre-condition.
 *   - Invoke the parser on release and surface `null` no-ops vs payload.
 *   - Surface mic-permission errors as observable state (no toasts; H-PLT04).
 *   - Emit haptic vibration on state transitions (start/stop/error).
 *
 * Activation modes:
 *   - 'hold' (default): mic activates after 300ms hold (E-3); release stops + commits.
 *   - 'tap': single tap arms mic (after 100ms guard); subsequent tap stops + commits;
 *            auto-stops after 8s of silence OR 12s absolute max.
 *
 * Low-latency behavior:
 *   - Recognition is started on `startHold` immediately, BEFORE the 300ms threshold.
 *   - If release happens before threshold, recognition is aborted silently with no
 *     parse + no UI change (R6 strict no-op gate still binds via duration check).
 *   - This eliminates the 300–700ms dead zone where users speak before mic activation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseTranscript } from '../utils/voiceCardEntry/parser';

const HOLD_THRESHOLD_MS = 300;         // E-3 — accidental-activation guard
const TAP_GUARD_MS = 100;              // tap-mode minimum press to avoid drag fires
const TAP_AUTO_STOP_SILENCE_MS = 8000; // tap-mode: stop after this much silence
const TAP_AUTO_STOP_MAX_MS = 12000;    // tap-mode: stop after this absolute duration
const DEFAULT_CONFIDENCE_FLOOR = 0.65;

// Haptic envelope (ms). Falls back silently when navigator.vibrate is unsupported.
const HAPTIC_ACTIVATE = 30;
const HAPTIC_DEACTIVATE = [40, 30, 40];
const HAPTIC_ERROR = [80, 40, 80];

function vibrate(pattern) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* iOS Safari + some Android browsers reject; ignore */
  }
}

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
 * @param {number} options.confidenceThreshold
 * @param {'hold' | 'tap'} options.activationMode
 *
 * @returns {{
 *   supported, permissionStatus, isListening, result, error,
 *   activationMode,
 *   startHold,    // hold-mode: press
 *   release,      // hold-mode: release
 *   tapToggle,    // tap-mode: single-tap toggle
 *   reset,
 * }}
 */
export function useVoiceCardEntry({
  confidenceThreshold = DEFAULT_CONFIDENCE_FLOOR,
  activationMode = 'hold',
} = {}) {
  const Ctor = getSpeechRecognitionCtor();
  const supported = !!Ctor;

  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const holdTimerRef = useRef(null);
  const holdReachedRef = useRef(false);
  const startedAtRef = useRef(0);
  const lastTranscriptRef = useRef('');
  const lastConfidenceRef = useRef(0);
  const lastSpeechAtRef = useRef(0);
  const tapSilenceTimerRef = useRef(null);
  const tapMaxTimerRef = useRef(null);

  // Initial permission read + change subscription.
  useEffect(() => {
    if (!supported) return undefined;
    let cancelled = false;
    let permObj = null;

    (async () => {
      const s = await readMicPermissionStatus();
      if (cancelled) return;
      setPermissionStatus(s);
      try {
        if (
          typeof navigator !== 'undefined' &&
          navigator.permissions &&
          typeof navigator.permissions.query === 'function'
        ) {
          permObj = await navigator.permissions.query({ name: 'microphone' });
          if (!cancelled && permObj && typeof permObj.addEventListener === 'function') {
            const onChange = () => setPermissionStatus(permObj.state);
            permObj.addEventListener('change', onChange);
            permObj.__vceChangeHandler = onChange;
          }
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (permObj && permObj.__vceChangeHandler) {
          permObj.removeEventListener('change', permObj.__vceChangeHandler);
        }
      } catch {
        /* ignore */
      }
    };
  }, [supported]);

  const clearAllTimers = useCallback(() => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (tapSilenceTimerRef.current) { clearTimeout(tapSilenceTimerRef.current); tapSilenceTimerRef.current = null; }
    if (tapMaxTimerRef.current) { clearTimeout(tapMaxTimerRef.current); tapMaxTimerRef.current = null; }
  }, []);

  const cleanupRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.onresult = null; } catch { /* ignore */ }
      try { rec.onerror = null; } catch { /* ignore */ }
      try { rec.onend = null; } catch { /* ignore */ }
      try { rec.onspeechstart = null; } catch { /* ignore */ }
      try { rec.onspeechend = null; } catch { /* ignore */ }
      try { rec.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  // Start Web Speech right away. Hold-mode: rec runs while the user holds; if
  // they release before HOLD_THRESHOLD_MS, we abort with no chip render. This
  // eliminates the 300-700ms dead zone where users naturally speak before the
  // mic is hot. Tap-mode: rec also runs from first tap.
  const beginRecognition = useCallback(() => {
    if (!supported) return;
    cleanupRecognition();

    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    try { rec.lang = 'en-US'; } catch { /* ignore */ }

    lastTranscriptRef.current = '';
    lastConfidenceRef.current = 0;
    lastSpeechAtRef.current = Date.now();

    rec.onresult = (event) => {
      try {
        const r = event.results && event.results[0];
        const alt = r && r[0];
        if (alt) {
          lastTranscriptRef.current = alt.transcript || '';
          lastConfidenceRef.current = typeof alt.confidence === 'number' ? alt.confidence : 0;
          lastSpeechAtRef.current = Date.now();
        }
      } catch {
        /* ignore */
      }
    };

    rec.onspeechstart = () => {
      lastSpeechAtRef.current = Date.now();
    };
    rec.onspeechend = () => {
      lastSpeechAtRef.current = Date.now();
    };

    rec.onerror = (event) => {
      const code = (event && event.error) || 'unknown';
      setError(code);
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setPermissionStatus('denied');
      }
      vibrate(HAPTIC_ERROR);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
      setError(null);
      startedAtRef.current = Date.now();
      vibrate(HAPTIC_ACTIVATE);
    } catch (err) {
      setError((err && err.message) || 'start-failed');
      recognitionRef.current = null;
    }
  }, [Ctor, supported, cleanupRecognition]);

  // Finalize the current recognition session: stop the mic, parse the
  // accumulated transcript, and set `result` (or null per R6 gate).
  const finalize = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    const stopAt = Date.now();
    try { rec.stop(); } catch { /* ignore */ }
    // The final `onresult` may arrive between stop() and onend; we hand off
    // parsing to a settled-state callback in onend.
    rec.onend = () => {
      setIsListening(false);
      const durationMs = stopAt - startedAtRef.current;
      const transcript = lastTranscriptRef.current;
      const confidence = lastConfidenceRef.current;
      const parsed = parseTranscript(transcript, {
        durationMs,
        confidence,
        confidenceThreshold,
      });
      setResult(parsed);
      vibrate(HAPTIC_DEACTIVATE);
      recognitionRef.current = null;
    };
  }, [confidenceThreshold]);

  // Abort without parsing / committing — used when hold is released before
  // the HOLD_THRESHOLD_MS guard. Strict no-op per R6.
  const abort = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    rec.onresult = null;
    rec.onspeechstart = null;
    rec.onspeechend = null;
    rec.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    try { rec.stop(); } catch { /* ignore */ }
  }, []);

  // ─── HOLD MODE ───────────────────────────────────────────────────────────

  const startHold = useCallback(() => {
    if (!supported) return;
    if (activationMode !== 'hold') return;
    if (permissionStatus === 'denied') return;
    clearAllTimers();
    holdReachedRef.current = false;
    // Start recognition IMMEDIATELY so the mic is hot during the natural
    // speech-onset window. The hold timer then marks whether this session
    // counts as an intentional press.
    beginRecognition();
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      holdReachedRef.current = true;
    }, HOLD_THRESHOLD_MS);
  }, [supported, activationMode, permissionStatus, beginRecognition, clearAllTimers]);

  const release = useCallback(() => {
    if (!supported) return;
    if (activationMode !== 'hold') return;
    const reached = holdReachedRef.current;
    holdReachedRef.current = false;
    clearAllTimers();
    if (!reached) {
      // Accidental tap: abort silently. The R6 duration gate would catch this
      // anyway (because the recognition is <300ms), but explicit abort skips
      // the parser entirely and prevents a stale partial transcript leaking.
      abort();
      return;
    }
    finalize();
  }, [supported, activationMode, finalize, abort, clearAllTimers]);

  // ─── TAP MODE ────────────────────────────────────────────────────────────

  const armTapAutoStop = useCallback(() => {
    // Two timers: silence-based + absolute max. Whichever fires first stops.
    if (tapSilenceTimerRef.current) clearTimeout(tapSilenceTimerRef.current);
    if (tapMaxTimerRef.current) clearTimeout(tapMaxTimerRef.current);
    const checkSilence = () => {
      const since = Date.now() - lastSpeechAtRef.current;
      if (since >= TAP_AUTO_STOP_SILENCE_MS) {
        finalize();
      } else {
        // Reschedule for the remaining silence window
        tapSilenceTimerRef.current = setTimeout(checkSilence, TAP_AUTO_STOP_SILENCE_MS - since);
      }
    };
    tapSilenceTimerRef.current = setTimeout(checkSilence, TAP_AUTO_STOP_SILENCE_MS);
    tapMaxTimerRef.current = setTimeout(() => {
      finalize();
    }, TAP_AUTO_STOP_MAX_MS);
  }, [finalize]);

  const tapToggle = useCallback(() => {
    if (!supported) return;
    if (activationMode !== 'tap') return;
    if (permissionStatus === 'denied') return;
    if (isListening) {
      clearAllTimers();
      finalize();
      return;
    }
    // Start
    clearAllTimers();
    beginRecognition();
    // Small guard delay before auto-stop arms; gives onspeechstart time to fire.
    setTimeout(() => {
      armTapAutoStop();
    }, TAP_GUARD_MS);
  }, [supported, activationMode, permissionStatus, isListening, finalize, beginRecognition, armTapAutoStop, clearAllTimers]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimers();
      cleanupRecognition();
    };
  }, [clearAllTimers, cleanupRecognition]);

  return {
    supported,
    permissionStatus,
    isListening,
    result,
    error,
    activationMode,
    startHold,
    release,
    tapToggle,
    reset,
  };
}

export const _VCE_INTERNAL = {
  HOLD_THRESHOLD_MS,
  TAP_GUARD_MS,
  TAP_AUTO_STOP_SILENCE_MS,
  TAP_AUTO_STOP_MAX_MS,
  DEFAULT_CONFIDENCE_FLOOR,
  HAPTIC_ACTIVATE,
  HAPTIC_DEACTIVATE,
  HAPTIC_ERROR,
};
