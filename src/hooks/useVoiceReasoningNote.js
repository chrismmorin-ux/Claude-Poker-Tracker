/**
 * useVoiceReasoningNote — orchestrator for Voice Reasoning Notes (VRN), replay lane
 *
 * Surface spec: docs/design/surfaces/voice-reasoning-notes.md
 *
 * Wires four pieces that each stay ignorant of the others:
 *   useSpeechCapture        — Web Speech lifecycle, emits raw segments
 *   buildReplaySnapshot     — pure state binding at the replay cursor
 *   noteSession             — pure session assembly
 *   reasoningNoteWriter     — IDB append
 *
 * The founder narrates while stepping through a hand. Each segment is stamped
 * with the state that was on screen when he spoke it, so a claim carries its own
 * conditioning set (founder requirement F4).
 *
 * This hook writes NOTHING into card or game state. It reads the replay cursor
 * and appends to the hand's `reasoningNotes`. That read-only property is what
 * makes it structurally impossible for a narration containing "queen of hearts"
 * to inject a card (Gate 2 E-3).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpeechCapture } from './useSpeechCapture';
import { createSession, appendSegment, finalizeSession } from '../utils/voiceReasoning/noteSession';
import {
  appendReasoningNote,
  readReasoningNotes,
  deleteReasoningNote,
} from '../utils/persistence/reasoningNoteWriter';

/**
 * Surface-agnostic. The caller supplies `buildContext`, so the hook never learns
 * how any particular surface represents its cursor — HandReplayView steps by
 * action, the Hand Review walkthrough steps by street, and a future live lane
 * would step by whatever the table does.
 *
 * @param {object} options
 * @param {number|string|null} options.handId — hand the note attaches to
 * @param {() => object|null} options.buildContext — state binding, called per segment
 * @param {'replay'|'review'|'live'} [options.source] — which surface produced it
 * @param {boolean} [options.enabled] — feature flag
 */
export function useVoiceReasoningNote({
  handId = null,
  buildContext = null,
  source = 'replay',
  enabled = false,
} = {}) {
  const [notes, setNotes] = useState([]);
  const [saveError, setSaveError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Live refs so the segment-time context getter never closes over stale surface
  // state. `captureContext` runs inside the recognition callback, potentially
  // many renders after the session started.
  const buildContextRef = useRef(buildContext);
  const handIdRef = useRef(handId);
  const sourceRef = useRef(source);
  useEffect(() => { buildContextRef.current = buildContext; }, [buildContext]);
  useEffect(() => { handIdRef.current = handId; }, [handId]);
  useEffect(() => { sourceRef.current = source; }, [source]);

  const loadNotes = useCallback(async () => {
    if (handId === null || handId === undefined) {
      setNotes([]);
      return;
    }
    try {
      const loaded = await readReasoningNotes(handId);
      setNotes(loaded);
    } catch (error) {
      // A read failure must not blank the list the founder is looking at.
      setSaveError(error?.message || 'Could not load notes');
    }
  }, [handId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  /**
   * Called by useSpeechCapture at the instant each segment lands. Binds the
   * words to where the founder was standing in the hand at that moment.
   */
  const captureContext = useCallback(() => {
    const fn = buildContextRef.current;
    if (typeof fn !== 'function') return null;
    return fn();
  }, []);

  /**
   * Session closed — assemble and persist.
   *
   * An empty session is a silent no-op (nothing was said). Everything else is
   * retained regardless of confidence, including interrupted partials: this
   * lane's failure mode is lost evidence, not corrupt data.
   */
  const handleSessionEnd = useCallback(async (rawSegments, meta = {}) => {
    const targetHandId = handIdRef.current;
    if (targetHandId === null || targetHandId === undefined) return;
    if (!Array.isArray(rawSegments) || rawSegments.length === 0) return;

    const startedAt = rawSegments[0]?.startedAt || Date.now();
    let session = createSession({ source: sourceRef.current, startedAt, handId: targetHandId });
    for (const segment of rawSegments) {
      session = appendSegment(session, segment);
    }

    const finalized = finalizeSession(session, {
      endedAt: rawSegments[rawSegments.length - 1]?.endedAt || Date.now(),
      interrupted: !!meta.interrupted,
    });
    if (!finalized) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await appendReasoningNote(targetHandId, finalized);
      // Optimistic append keeps the just-spoken note visible immediately; the
      // reload reconciles against what actually committed.
      setNotes((prev) => [...prev, finalized]);
      await loadNotes();
    } catch (error) {
      setSaveError(error?.message || 'Could not save note');
    } finally {
      setIsSaving(false);
    }
  }, [loadNotes]);

  const {
    supported,
    permissionStatus,
    isRecording,
    segmentCount,
    error: speechError,
    start,
    stop,
  } = useSpeechCapture({
    captureContext,
    onSessionEnd: handleSessionEnd,
  });

  const removeNote = useCallback(async (noteId) => {
    const targetHandId = handIdRef.current;
    if (targetHandId === null || targetHandId === undefined) return;
    try {
      await deleteReasoningNote(targetHandId, noteId);
      await loadNotes();
    } catch (error) {
      setSaveError(error?.message || 'Could not delete note');
    }
  }, [loadNotes]);

  const toggleRecording = useCallback(() => {
    if (!enabled) return;
    if (isRecording) stop();
    else start();
  }, [enabled, isRecording, start, stop]);

  return {
    supported,
    permissionStatus,
    isRecording,
    segmentCount,
    error: speechError || saveError,
    isSaving,
    notes,
    start,
    stop,
    toggleRecording,
    removeNote,
    reload: loadNotes,
  };
}
