/**
 * noteSession.test.js — VRN narration session assembly.
 *
 * Pins the RETENTION POLARITY that separates this lane from Voice Card Entry.
 * VCE gates hard because its failure mode is data corruption; VRN retains
 * aggressively because its failure mode is lost evidence. Several tests below
 * exist specifically to fail if someone "hardens" this module by adding a
 * confidence gate — that would be a regression, not an improvement.
 *
 * Surface spec: docs/design/surfaces/voice-reasoning-notes.md
 */

import { describe, it, expect } from 'vitest';
import {
  createSession,
  appendSegment,
  finalizeSession,
  appendCorrection,
  seatsReferencedBy,
  fullTranscript,
} from '../noteSession';

const idFactory = () => 'vrn-test-1';

const newSession = () =>
  createSession({ source: 'replay', startedAt: 1000, handId: 7, idFactory });

describe('createSession', () => {
  it('starts empty with the injected id and no grader results', () => {
    const s = newSession();
    expect(s.id).toBe('vrn-test-1');
    expect(s.handId).toBe(7);
    expect(s.source).toBe('replay');
    expect(s.createdAt).toBe(1000);
    expect(s.segments).toEqual([]);
    expect(s.corrections).toEqual([]);
    // `graders: {}` means NOT YET RUN — distinct from "ran and found nothing".
    expect(s.graders).toEqual({});
  });
});

describe('appendSegment — retention polarity', () => {
  it('retains a low-confidence segment (NO confidence floor — this is deliberate)', () => {
    const s = appendSegment(newSession(), {
      text: 'he is never folding the turn here',
      confidence: 0.11,
      startedAt: 1100,
      endedAt: 1400,
    });
    expect(s.segments).toHaveLength(1);
    expect(s.segments[0].confidence).toBe(0.11);
    expect(s.segments[0].text).toBe('he is never folding the turn here');
  });

  it('retains a segment with no confidence reported at all', () => {
    const s = appendSegment(newSession(), { text: 'small sizing', startedAt: 1, endedAt: 2 });
    expect(s.segments).toHaveLength(1);
    expect(s.segments[0].confidence).toBeNull();
  });

  it('drops blank / whitespace-only text (carries no evidence)', () => {
    let s = newSession();
    s = appendSegment(s, { text: '   ' });
    s = appendSegment(s, { text: '' });
    s = appendSegment(s, { text: null });
    expect(s.segments).toEqual([]);
  });

  it('trims text but preserves interior content', () => {
    const s = appendSegment(newSession(), { text: '  pot is 240  ' });
    expect(s.segments[0].text).toBe('pot is 240');
  });

  it('does not mutate the input session', () => {
    const before = newSession();
    const after = appendSegment(before, { text: 'a read' });
    expect(before.segments).toHaveLength(0);
    expect(after.segments).toHaveLength(1);
  });

  it('stamps the context handed in at segment time', () => {
    const context = { street: 'turn', actionIndex: 8, pot: 96 };
    const s = appendSegment(newSession(), { text: 'sizing is small', context });
    expect(s.segments[0].context).toEqual(context);
  });

  it('preserves segment order across a navigation-driven context change', () => {
    let s = newSession();
    s = appendSegment(s, { text: 'on the river', context: { street: 'river', actionIndex: 11 } });
    s = appendSegment(s, { text: 'back on the turn', context: { street: 'turn', actionIndex: 8 } });
    expect(s.segments.map((x) => x.context.street)).toEqual(['river', 'turn']);
  });
});

describe('finalizeSession', () => {
  it('returns null for an empty session — the only no-op condition', () => {
    expect(finalizeSession(newSession(), { endedAt: 2000 })).toBeNull();
  });

  it('returns null for a session whose every segment was blank', () => {
    let s = newSession();
    s = appendSegment(s, { text: '  ' });
    expect(finalizeSession(s, { endedAt: 2000 })).toBeNull();
  });

  it('finalizes a one-segment session and stamps endedAt', () => {
    const s = appendSegment(newSession(), { text: 'he is capped' });
    const note = finalizeSession(s, { endedAt: 2500 });
    expect(note.endedAt).toBe(2500);
    expect(note.interrupted).toBe(false);
    expect(note.segments).toHaveLength(1);
  });

  it('RETAINS an interrupted session and marks the trailing segment', () => {
    let s = newSession();
    s = appendSegment(s, { text: 'first thought' });
    s = appendSegment(s, { text: 'second thought cut off' });
    const note = finalizeSession(s, { endedAt: 3000, interrupted: true });

    expect(note).not.toBeNull();
    expect(note.interrupted).toBe(true);
    expect(note.segments[0].interrupted).toBe(false);
    expect(note.segments[1].interrupted).toBe(true);
  });

  it('does not mutate the input session when marking interruption', () => {
    let s = newSession();
    s = appendSegment(s, { text: 'thought' });
    finalizeSession(s, { endedAt: 1, interrupted: true });
    expect(s.segments[0].interrupted).toBe(false);
  });
});

describe('appendCorrection — append-only revision', () => {
  it('adds a correction without touching the original segments', () => {
    let s = appendSegment(newSession(), { text: 'he never folds' });
    const note = finalizeSession(s, { endedAt: 2000 });
    const corrected = appendCorrection(note, { text: 'actually he folds to big sizing', at: 9000 });

    expect(corrected.segments[0].text).toBe('he never folds');
    expect(corrected.corrections).toHaveLength(1);
    expect(corrected.corrections[0].text).toBe('actually he folds to big sizing');
  });

  it('ignores an empty correction', () => {
    const note = finalizeSession(appendSegment(newSession(), { text: 'x' }), { endedAt: 1 });
    expect(appendCorrection(note, { text: '   ' }).corrections).toHaveLength(0);
  });

  it('accumulates multiple corrections in order', () => {
    let note = finalizeSession(appendSegment(newSession(), { text: 'x' }), { endedAt: 1 });
    note = appendCorrection(note, { text: 'first', at: 1 });
    note = appendCorrection(note, { text: 'second', at: 2 });
    expect(note.corrections.map((c) => c.text)).toEqual(['first', 'second']);
  });
});

describe('seatsReferencedBy — enables per-player queries (Gate 2 B-3)', () => {
  it('collects the union of live seats across segments, sorted and deduped', () => {
    let s = newSession();
    s = appendSegment(s, { text: 'a', context: { seatsLive: [3, 5] } });
    s = appendSegment(s, { text: 'b', context: { seatsLive: [5, 1] } });
    const note = finalizeSession(s, { endedAt: 1 });
    expect(seatsReferencedBy(note)).toEqual([1, 3, 5]);
  });

  it('returns [] when no context carries seats', () => {
    const note = finalizeSession(appendSegment(newSession(), { text: 'a' }), { endedAt: 1 });
    expect(seatsReferencedBy(note)).toEqual([]);
  });
});

describe('fullTranscript', () => {
  it('joins segments in order', () => {
    let s = newSession();
    s = appendSegment(s, { text: 'he bets small' });
    s = appendSegment(s, { text: 'that is a draw' });
    expect(fullTranscript(finalizeSession(s, { endedAt: 1 }))).toBe('he bets small that is a draw');
  });

  it('returns empty string for a null note', () => {
    expect(fullTranscript(null)).toBe('');
  });
});
