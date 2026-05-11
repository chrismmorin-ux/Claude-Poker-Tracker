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
 *
 * Out of scope:
 *   - State-aware visibility (the consumer component decides when to mount).
 *   - Chip rendering (handled by VoiceConfirmationChips consuming `result`).
 *   - Dispatching to gameReducer / cardReducer (the consumer commits on tap).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseTranscript } from '../utils/voiceCardEntry/parser';

const HOLD_THRESHOLD_MS = 300;     // E-3
const DEFAULT_CONFIDENCE_FLOOR = 0.65; // D-3

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Optional helper: query the OS-level microphone permission status.
 * Falls back to `'unknown'` if `navigator.permissions` is unavailable.
 */
async function readMicPermissionStatus() {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.permissions &&
      typeof navigator.permissions.query === 'function'
    ) {
      const res = await navigator.permissions.query({ name: 'microphone' });
      return res.state; // 'granted' | 'denied' | 'prompt'
    }
  } catch {
    /* ignore */
  }
  return 'unknown';
}

/**
 * useVoiceCardEntry hook.
 *
 * @param {object} options
 * @param {number} options.confidenceThreshold — owner-tuned threshold (0..1)
 *
 * @returns {{
 *   supported: boolean,                           // Web Speech available
 *   permissionStatus: 'granted'|'denied'|'prompt'|'unknown',
 *   isListening: boolean,                         // mic active right now
 *   result: { cards: string[], villainAssignments: Map<number,string[]>, warnings: string[] } | null,
 *   error: string | null,                          // last non-null Web Speech error code
 *   startHold: () => void,                         // begin hold timer; 300ms passes → mic on
 *   release: () => void,                           // end hold; parse + set result
 *   reset: () => void,                             // clear `result` after commit/cancel
 * }}
 */
export function useVoiceCardEntry({
  confidenceThreshold = DEFAULT_CONFIDENCE_FLOOR,
} = {}) {
  const Ctor = getSpeechRecognitionCtor();
  const supported = !!Ctor;

  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const holdTimerRef = useRef(null);
  const startedAtRef = useRef(0);
  const lastTranscriptRef = useRef('');
  const lastConfidenceRef = useRef(0);

  // Initial permission read + listener (when supported)
  useEffect(() => {
    if (!supported) return undefined;
    let cancelled = false;
    let permObj = null;

    (async () => {
      const s = await readMicPermissionStatus();
      if (cancelled) return;
      setPermissionStatus(s);
      // Subscribe to change events when available
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
            // Stash for teardown
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

  const cleanupRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.onresult = null; } catch { /* ignore */ }
      try { rec.onerror = null; } catch { /* ignore */ }
      try { rec.onend = null; } catch { /* ignore */ }
      try { rec.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  const beginRecognition = useCallback(() => {
    if (!supported) return;
    cleanupRecognition();

    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    try { rec.lang = 'en-US'; } catch { /* ignore — some impls reject */ }

    lastTranscriptRef.current = '';
    lastConfidenceRef.current = 0;

    rec.onresult = (event) => {
      try {
        const r = event.results && event.results[0];
        const alt = r && r[0];
        if (alt) {
          lastTranscriptRef.current = alt.transcript || '';
          lastConfidenceRef.current = typeof alt.confidence === 'number' ? alt.confidence : 0;
        }
      } catch {
        /* ignore */
      }
    };

    rec.onerror = (event) => {
      const code = (event && event.error) || 'unknown';
      setError(code);
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setPermissionStatus('denied');
      }
    };

    rec.onend = () => {
      // recognition session has ended for ANY reason — clear listening flag.
      setIsListening(false);
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
      setError(null);
      startedAtRef.current = Date.now();
    } catch (err) {
      setError((err && err.message) || 'start-failed');
      recognitionRef.current = null;
    }
  }, [Ctor, supported, cleanupRecognition]);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const startHold = useCallback(() => {
    if (!supported) return;
    if (permissionStatus === 'denied') return;
    // Begin the E-3 300ms hold timer. Below threshold = no listening session.
    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      beginRecognition();
    }, HOLD_THRESHOLD_MS);
  }, [supported, permissionStatus, beginRecognition, clearHoldTimer]);

  const release = useCallback(() => {
    if (!supported) return;
    // If the hold never reached 300ms, there's no recognition to stop and
    // no transcript to parse. R6 strict no-op.
    if (holdTimerRef.current) {
      clearHoldTimer();
      return;
    }
    const rec = recognitionRef.current;
    if (!rec) return;
    try { rec.stop(); } catch { /* ignore */ }

    // Web Speech delivers the final `onresult` asynchronously between `stop()`
    // and `onend`. We compute durationMs and run the parser inside `onend` to
    // ensure all results have settled.
    const stopAt = Date.now();
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
      // parsed === null is the R6 no-op result. Surface as null result.
      setResult(parsed);
      recognitionRef.current = null;
    };
  }, [supported, confidenceThreshold, clearHoldTimer]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      clearHoldTimer();
      cleanupRecognition();
    };
  }, [clearHoldTimer, cleanupRecognition]);

  return {
    supported,
    permissionStatus,
    isListening,
    result,
    error,
    startHold,
    release,
    reset,
  };
}

export const _VCE_INTERNAL = {
  HOLD_THRESHOLD_MS,
  DEFAULT_CONFIDENCE_FLOOR,
};
