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
import { buildReplaySnapshot } from '../utils/voiceReasoning/replaySnapshot';
import { createSession, appendSegment, finalizeSession } from '../utils/voiceReasoning/noteSession';
import {
  appendReasoningNote,
  readReasoningNotes,
  deleteReasoningNote,
} from '../utils/persistence/reasoningNoteWriter';

/**
 * @param {object} options
 * @param {number|string|null} options.handId — hand being replayed
 * @param {object} options.replayState — return value of useReplayState()
 * @param {object|null} options.selectedHand — the hand record
 * @param {boolean} [options.enabled] — feature flag
 */
export function useVoiceReasoningNote({
  handId = null,
  replayState = null,
  selectedHand = null,
  enabled = false,
} = {}) {
  const [notes, setNotes] = useState([]);
  const [saveError, setSaveError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Live refs so the segment-time context getter never closes over stale replay
  // state. `captureContext` runs inside the recognition callback, potentially
  // many renders after the session started.
  const replayStateRef = useRef(replayState);
  const selectedHandRef = useRef(selectedHand);
  const handIdRef = useRef(handId);
  useEffect(() => { replayStateRef.current = replayState; }, [replayState]);
  useEffect(() => { selectedHandRef.current = selectedHand; }, [selectedHand]);
  useEffect(() => { handIdRef.current = handId; }, [handId]);

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
    const rs = replayStateRef.current;
    if (!rs) return null;
    return buildReplaySnapshot(rs, selectedHandRef.current);
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
    let session = createSession({ source: 'replay', startedAt, handId: targetHandId });
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
