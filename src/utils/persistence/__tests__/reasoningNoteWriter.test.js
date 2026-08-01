// @vitest-environment jsdom
/**
 * reasoningNoteWriter.test.js — VRN persistence contract.
 *
 * Pins:
 *   - notes append to the hand record (one source of truth, DEC-021)
 *   - append-only: originals survive corrections (Gate 2 E-5)
 *   - low-confidence and interrupted segments persist (retention polarity)
 *   - sanitize throws loudly on structurally invalid notes
 *   - round-trip identity through IDB
 *
 * Surface spec: docs/design/surfaces/voice-reasoning-notes.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { closeDB, resetDBPool, DB_NAME } from '../database';
import { saveHand } from '../handsStorage';
import * as writerApi from '../reasoningNoteWriter';
import {
  sanitizeReasoningNote,
  appendReasoningNote,
  appendReasoningNoteCorrection,
  readReasoningNotes,
  deleteReasoningNote,
} from '../reasoningNoteWriter';

const deleteEntireDB = () =>
  new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });

const validHandData = () => ({
  gameState: {
    currentStreet: 'preflop',
    dealerButtonSeat: 1,
    mySeat: 2,
    actionSequence: [],
    absentSeats: [],
  },
  cardState: {
    communityCards: ['', '', '', '', ''],
    holeCards: ['', ''],
    holeCardsVisible: false,
    allPlayerCards: {},
  },
  seatPlayers: {},
});

const validNote = (overrides = {}) => ({
  id: 'vrn-1',
  handId: 1,
  source: 'replay',
  createdAt: 1000,
  endedAt: 2000,
  interrupted: false,
  segments: [
    {
      text: 'he is repping the flush but he would have raised the turn',
      confidence: 0.42,
      startedAt: 1000,
      endedAt: 1800,
      interrupted: false,
      context: { street: 'river', actionIndex: 11, pot: 240, stacks: null },
    },
  ],
  corrections: [],
  graders: {},
  ...overrides,
});

beforeEach(async () => {
  closeDB();
  resetDBPool();
  await deleteEntireDB();
});

afterEach(async () => {
  closeDB();
  resetDBPool();
});

describe('sanitizeReasoningNote', () => {
  it('accepts a well-formed note and normalizes it', () => {
    const clean = sanitizeReasoningNote(validNote());
    expect(clean.id).toBe('vrn-1');
    expect(clean.source).toBe('replay');
    expect(clean.segments).toHaveLength(1);
    expect(clean.segments[0].confidence).toBe(0.42);
  });

  it('preserves a low-confidence segment (no floor at the persistence boundary either)', () => {
    const clean = sanitizeReasoningNote(
      validNote({ segments: [{ text: 'muttered read', confidence: 0.03 }] }),
    );
    expect(clean.segments[0].confidence).toBe(0.03);
    expect(clean.segments[0].text).toBe('muttered read');
  });

  it('normalizes an absent confidence to null rather than dropping the segment', () => {
    const clean = sanitizeReasoningNote(validNote({ segments: [{ text: 'a thought' }] }));
    expect(clean.segments).toHaveLength(1);
    expect(clean.segments[0].confidence).toBeNull();
  });

  it('throws on a note with no segments', () => {
    expect(() => sanitizeReasoningNote(validNote({ segments: [] }))).toThrow(/at least one segment/);
  });

  it('throws on a missing id', () => {
    expect(() => sanitizeReasoningNote(validNote({ id: '' }))).toThrow(/missing id/);
  });

  it('throws on an unknown source', () => {
    expect(() => sanitizeReasoningNote(validNote({ source: 'telepathy' }))).toThrow(/invalid source/);
  });

  it('throws on a non-object', () => {
    expect(() => sanitizeReasoningNote(null)).toThrow(/must be an object/);
  });

  it('defaults graders to {} — meaning NOT YET RUN', () => {
    expect(sanitizeReasoningNote(validNote({ graders: undefined })).graders).toEqual({});
  });
});

describe('appendReasoningNote / readReasoningNotes', () => {
  it('returns [] for a hand with no notes', async () => {
    const handId = await saveHand(validHandData());
    expect(await readReasoningNotes(handId)).toEqual([]);
  });

  it('round-trips a note through IDB', async () => {
    const handId = await saveHand(validHandData());
    await appendReasoningNote(handId, validNote({ handId }));

    const notes = await readReasoningNotes(handId);
    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe('vrn-1');
    expect(notes[0].segments[0].text).toContain('repping the flush');
    expect(notes[0].segments[0].context.street).toBe('river');
  });

  it('preserves the null stacks marker through persistence', async () => {
    const handId = await saveHand(validHandData());
    await appendReasoningNote(handId, validNote({ handId }));
    const notes = await readReasoningNotes(handId);
    expect(notes[0].segments[0].context.stacks).toBeNull();
  });

  it('appends rather than replacing — multiple notes accumulate in order', async () => {
    const handId = await saveHand(validHandData());
    await appendReasoningNote(handId, validNote({ id: 'vrn-1', handId }));
    await appendReasoningNote(handId, validNote({ id: 'vrn-2', handId }));

    const notes = await readReasoningNotes(handId);
    expect(notes.map((n) => n.id)).toEqual(['vrn-1', 'vrn-2']);
  });

  it('persists an interrupted note — a cut-off thought is still evidence', async () => {
    const handId = await saveHand(validHandData());
    await appendReasoningNote(handId, validNote({
      handId,
      interrupted: true,
      segments: [{ text: 'he would only do that with', interrupted: true }],
    }));

    const notes = await readReasoningNotes(handId);
    expect(notes[0].interrupted).toBe(true);
    expect(notes[0].segments[0].interrupted).toBe(true);
  });

  it('rejects a write to a missing hand', async () => {
    await expect(appendReasoningNote(999999, validNote())).rejects.toThrow(/not found/);
  });
});

describe('appendReasoningNoteCorrection — append-only revision', () => {
  it('adds a correction and leaves the original segment text intact', async () => {
    const handId = await saveHand(validHandData());
    await appendReasoningNote(handId, validNote({ handId }));

    await appendReasoningNoteCorrection(handId, 'vrn-1', {
      text: 'rethinking this — he does raise the turn with sets',
      at: 5000,
    });

    const notes = await readReasoningNotes(handId);
    expect(notes[0].segments[0].text).toContain('repping the flush');
    expect(notes[0].corrections).toHaveLength(1);
    expect(notes[0].corrections[0].text).toContain('rethinking this');
    expect(notes[0].corrections[0].at).toBe(5000);
  });

  it('leaves sibling notes untouched', async () => {
    const handId = await saveHand(validHandData());
    await appendReasoningNote(handId, validNote({ id: 'vrn-1', handId }));
    await appendReasoningNote(handId, validNote({ id: 'vrn-2', handId }));

    await appendReasoningNoteCorrection(handId, 'vrn-2', { text: 'correction', at: 1 });

    const notes = await readReasoningNotes(handId);
    expect(notes[0].corrections).toHaveLength(0);
    expect(notes[1].corrections).toHaveLength(1);
  });

  it('throws on an empty correction', async () => {
    const handId = await saveHand(validHandData());
    await appendReasoningNote(handId, validNote({ handId }));
    await expect(
      appendReasoningNoteCorrection(handId, 'vrn-1', { text: '  ' }),
    ).rejects.toThrow(/empty/);
  });

  it('throws when the target note does not exist', async () => {
    const handId = await saveHand(validHandData());
    await expect(
      appendReasoningNoteCorrection(handId, 'nope', { text: 'x', at: 1 }),
    ).rejects.toThrow(/not found/);
  });

  it('exposes no path that rewrites existing segment text', () => {
    // Schema-level guarantee: revision goes through corrections, deletion is
    // explicit and total. If a segment-rewriting export ever appears, this
    // assertion should be revisited deliberately, not silently.
    const api = Object.keys(writerApi);
    expect(api).not.toContain('updateReasoningNoteSegment');
    expect(api).not.toContain('replaceReasoningNote');
    expect(api).toContain('appendReasoningNoteCorrection');
  });
});

describe('deleteReasoningNote', () => {
  it('removes the note and reports true', async () => {
    const handId = await saveHand(validHandData());
    await appendReasoningNote(handId, validNote({ handId }));

    expect(await deleteReasoningNote(handId, 'vrn-1')).toBe(true);
    expect(await readReasoningNotes(handId)).toEqual([]);
  });

  it('reports false when the note was not there', async () => {
    const handId = await saveHand(validHandData());
    await appendReasoningNote(handId, validNote({ handId }));

    expect(await deleteReasoningNote(handId, 'ghost')).toBe(false);
    expect(await readReasoningNotes(handId)).toHaveLength(1);
  });
});
