/**
 * reasoningNoteWriter.js — persistence for Voice Reasoning Notes (VRN)
 *
 * Surface spec: docs/design/surfaces/voice-reasoning-notes.md
 *
 * Writes the additive `reasoningNotes` array on an existing hands record, using
 * the same `updateTx` pattern as predictionAuditWriter.js. Additive field, no IDB
 * migration required.
 *
 * The note lives ON THE HAND, not in a parallel store — DEC-021's one-source-of-
 * truth commitment. A note without its hand is not evidence about anything.
 *
 * SCHEMA-LEVEL ENFORCEMENT: this writer is append-only for segments. It exposes
 * no path that rewrites an existing note's segments, because a note the founder
 * later disagrees with is still evidence about what he thought at the time
 * (Gate 2 E-5). Revision goes through `corrections`, deletion is explicit and
 * total. The contract does not depend on caller discipline.
 */

import {
  readTx,
  updateTx,
  STORE_NAME,
  log,
  logError,
} from './database';

// =============================================================================
// SANITIZATION
// =============================================================================

/**
 * Validate + normalize a note before write. Throws on structural invalidity so a
 * malformed note fails loudly at the boundary rather than silently persisting
 * something no grader can read.
 */
export const sanitizeReasoningNote = (note) => {
  if (!note || typeof note !== 'object') {
    throw new Error('reasoningNote must be an object');
  }
  if (typeof note.id !== 'string' || !note.id) {
    throw new Error('reasoningNote missing id');
  }
  if (!Array.isArray(note.segments) || note.segments.length === 0) {
    throw new Error('reasoningNote must have at least one segment');
  }
  if (note.source !== 'replay' && note.source !== 'live') {
    throw new Error(`reasoningNote has invalid source: ${note.source}`);
  }

  return {
    id: note.id,
    handId: note.handId ?? null,
    source: note.source,
    createdAt: Number(note.createdAt) || 0,
    endedAt: Number(note.endedAt) || 0,
    interrupted: !!note.interrupted,
    segments: note.segments.map((s) => ({
      text: String(s.text ?? ''),
      confidence: Number.isFinite(s.confidence) ? s.confidence : null,
      startedAt: Number(s.startedAt) || null,
      endedAt: Number(s.endedAt) || null,
      interrupted: !!s.interrupted,
      context: s.context ?? null,
    })),
    corrections: Array.isArray(note.corrections) ? note.corrections : [],
    // `graders: {}` means NOT YET RUN, never "ran and found nothing".
    // A consumer must distinguish those two states.
    graders: note.graders && typeof note.graders === 'object' ? note.graders : {},
  };
};

// =============================================================================
// WRITE / READ API
// =============================================================================

/**
 * Append a note to a hand's `reasoningNotes` array.
 *
 * @param {number|string} handId
 * @param {Object} note — a finalized session from noteSession.finalizeSession()
 * @returns {Promise<void>} resolves on commit; rejects on get/put failure.
 */
export const appendReasoningNote = async (handId, note) => {
  const sanitized = sanitizeReasoningNote(note);
  try {
    await updateTx(STORE_NAME, handId, (hand) => {
      if (!hand) throw new Error(`Hand ${handId} not found`);
      const existing = Array.isArray(hand.reasoningNotes) ? hand.reasoningNotes : [];
      hand.reasoningNotes = [...existing, sanitized];
      return hand;
    });
    log(`reasoningNote ${sanitized.id} appended to hand ${handId} (${sanitized.segments.length} segments)`);
  } catch (error) {
    logError('appendReasoningNote failed:', error);
    throw error;
  }
};

/**
 * Append a correction to an existing note. Originals are never overwritten.
 *
 * @param {number|string} handId
 * @param {string} noteId
 * @param {{text: string, at: number, segmentIndex: number|null}} correction
 */
export const appendReasoningNoteCorrection = async (handId, noteId, correction) => {
  const text = typeof correction?.text === 'string' ? correction.text.trim() : '';
  if (!text) throw new Error('correction text is empty');

  try {
    await updateTx(STORE_NAME, handId, (hand) => {
      if (!hand) throw new Error(`Hand ${handId} not found`);
      const notes = Array.isArray(hand.reasoningNotes) ? hand.reasoningNotes : [];
      const index = notes.findIndex((n) => n.id === noteId);
      if (index === -1) throw new Error(`reasoningNote ${noteId} not found on hand ${handId}`);
      const target = notes[index];
      const updated = {
        ...target,
        corrections: [
          ...(target.corrections || []),
          {
            text,
            at: Number(correction.at) || 0,
            segmentIndex: Number.isInteger(correction.segmentIndex) ? correction.segmentIndex : null,
          },
        ],
      };
      hand.reasoningNotes = [...notes.slice(0, index), updated, ...notes.slice(index + 1)];
      return hand;
    });
    log(`correction appended to reasoningNote ${noteId} on hand ${handId}`);
  } catch (error) {
    logError('appendReasoningNoteCorrection failed:', error);
    throw error;
  }
};

/**
 * Read all notes for a hand. Returns `[]` when the hand exists but has none, and
 * `[]` when the hand is missing — callers treat both as "nothing to show".
 *
 * @param {number|string} handId
 * @returns {Promise<Array>}
 */
export const readReasoningNotes = async (handId) => {
  try {
    const hand = await readTx(STORE_NAME, (store) => store.get(handId));
    return Array.isArray(hand?.reasoningNotes) ? hand.reasoningNotes : [];
  } catch (error) {
    logError('readReasoningNotes get failed:', error);
    throw error;
  }
};

/**
 * Delete a note outright. Explicit and total — the alternative to silent editing
 * (Gate 2 E-5). Resolves to `true` when a note was removed.
 *
 * @param {number|string} handId
 * @param {string} noteId
 * @returns {Promise<boolean>}
 */
export const deleteReasoningNote = async (handId, noteId) => {
  let removed = false;
  try {
    await updateTx(STORE_NAME, handId, (hand) => {
      if (!hand) throw new Error(`Hand ${handId} not found`);
      const notes = Array.isArray(hand.reasoningNotes) ? hand.reasoningNotes : [];
      const next = notes.filter((n) => n.id !== noteId);
      removed = next.length !== notes.length;
      hand.reasoningNotes = next;
      return hand;
    });
    if (removed) log(`reasoningNote ${noteId} deleted from hand ${handId}`);
    return removed;
  } catch (error) {
    logError('deleteReasoningNote failed:', error);
    throw error;
  }
};
