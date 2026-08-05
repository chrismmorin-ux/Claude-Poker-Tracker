// @vitest-environment jsdom
/**
 * handProvenance.test.js — the write-side half of WS-368.
 *
 * The migration test covers what happens to rows that already exist. This
 * covers the rule that stops the problem recurring: every hand gets a positive
 * channel at construction, the stamp carries venue and stake, an import can
 * never wear the live channel, and nothing anywhere is guessed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  HAND_SOURCE,
  HAND_SOURCES,
  PROVENANCE_SCHEMA_VERSION,
  isHandSource,
  parseStakeLabel,
  liveHandProvenance,
  ignitionHandProvenance,
  importedHandProvenance,
  unknownHandProvenance,
  backfillHandProvenance,
  handProvenanceProblems,
} from '../handProvenance';
import { validateHandRecord } from '../validation';
import { closeDB, resetDBPool, DB_NAME } from '../database';

const deleteEntireDB = () =>
  new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });

beforeEach(async () => {
  closeDB();
  resetDBPool();
  await deleteEntireDB();
});

afterEach(async () => {
  closeDB();
  resetDBPool();
  vi.restoreAllMocks();
});

// ===========================================================================
// The channel is not a parameter
// ===========================================================================

describe('provenance constructors — the channel cannot be chosen by a caller', () => {
  it('each constructor produces exactly one channel', () => {
    expect(liveHandProvenance(null).source).toBe(HAND_SOURCE.LIVE);
    expect(ignitionHandProvenance(null).source).toBe(HAND_SOURCE.IGNITION);
    expect(importedHandProvenance({}).source).toBe(HAND_SOURCE.IMPORT);
    expect(unknownHandProvenance().source).toBe(HAND_SOURCE.UNKNOWN);
  });

  it('the scalar and the object always agree (the scalar is a projection)', () => {
    [liveHandProvenance(null), ignitionHandProvenance(null), importedHandProvenance({}), unknownHandProvenance()]
      .forEach((stamp) => expect(stamp.provenance.channel).toBe(stamp.source));
  });

  it('stamps are frozen so the scalar and the object cannot be edited apart', () => {
    const stamp = liveHandProvenance(null);
    expect(Object.isFrozen(stamp)).toBe(true);
    expect(Object.isFrozen(stamp.provenance)).toBe(true);
  });

  it('every channel is a member of the closed set', () => {
    expect(HAND_SOURCES).toEqual(['live', 'ignition', 'import', 'unknown']);
    HAND_SOURCES.forEach((s) => expect(isHandSource(s)).toBe(true));
    expect(isHandSource('LIVE')).toBe(false);
    expect(isHandSource(undefined)).toBe(false);
  });
});

// ===========================================================================
// The stamp carries venue and stake
// ===========================================================================

describe('liveHandProvenance — carries population identity from the session', () => {
  it('takes venue and stake from the active session record', () => {
    const { provenance } = liveHandProvenance({
      sessionId: 7,
      venue: 'Wind Creek',
      gameType: '1/3',
    });
    expect(provenance.venue).toBe('Wind Creek');
    expect(provenance.stakeLabel).toBe('1/3');
    expect(provenance.stake).toEqual({ sb: 1, bb: 3 });
    expect(provenance.sessionId).toBe(7);
    expect(provenance.schemaVersion).toBe(PROVENANCE_SCHEMA_VERSION);
  });

  it('a 1/2 hand and a 1/3 hand at a different venue are distinguishable', () => {
    const a = liveHandProvenance({ venue: 'Parx', gameType: '1/2' }).provenance;
    const b = liveHandProvenance({ venue: 'Wind Creek', gameType: '1/3' }).provenance;
    expect(a.venue).not.toBe(b.venue);
    expect(a.stake).not.toEqual(b.stake);
  });

  it('is still positively live with no active session — venue/stake go null, not default', () => {
    const { source, provenance } = liveHandProvenance(null);
    expect(source).toBe(HAND_SOURCE.LIVE);
    expect(provenance.venue).toBeNull();
    expect(provenance.stake).toBeNull();
    expect(provenance.stakeLabel).toBeNull();
  });
});

describe('parseStakeLabel — records what is known, never infers what is not', () => {
  it.each([
    ['1/3', { sb: 1, bb: 3 }],
    ['0.02/0.05', { sb: 0.02, bb: 0.05 }],
    ['$1 / $2', { sb: 1, bb: 2 }],
  ])('parses %s', (label, expected) => {
    expect(parseStakeLabel(label)).toEqual(expected);
  });

  it.each(['NL Holdem', '1/2/5', '', 'PLO', undefined, null, 42])(
    'refuses to invent blinds from %s',
    (label) => {
      expect(parseStakeLabel(label)).toBeNull();
    },
  );

  it('an unparseable gameType keeps the label verbatim and leaves stake null', () => {
    const { provenance } = liveHandProvenance({ venue: 'Parx', gameType: 'NL Holdem' });
    expect(provenance.stakeLabel).toBe('NL Holdem');
    expect(provenance.stake).toBeNull();
  });

  it('prefers the session\'s validated stakes object over the label', () => {
    const { provenance } = ignitionHandProvenance({
      venue: 'Ignition',
      gameType: 'NL Holdem',
      stakes: { sb: 0.02, bb: 0.05 },
    });
    expect(provenance.stake).toEqual({ sb: 0.02, bb: 0.05 });
  });
});

// ===========================================================================
// The contamination vector
// ===========================================================================

describe('importedHandProvenance — an import can never wear the live channel', () => {
  it('stamps import even when the file claims the hand was live', () => {
    const stamp = importedHandProvenance({
      source: 'live',
      provenance: { channel: 'live', venue: 'Wind Creek', stake: { sb: 1, bb: 3 } },
    });
    expect(stamp.source).toBe(HAND_SOURCE.IMPORT);
    expect(stamp.provenance.channel).toBe(HAND_SOURCE.IMPORT);
  });

  it('preserves the claim as evidence rather than promoting it to truth', () => {
    const stamp = importedHandProvenance({
      source: 'live',
      provenance: { channel: 'live', venue: 'Wind Creek' },
    });
    expect(stamp.provenance.original.source).toBe('live');
    expect(stamp.provenance.original.provenance.venue).toBe('Wind Creek');
    // The claim does NOT become this row's venue — that would read as measured.
    expect(stamp.provenance.venue).toBeNull();
  });

  it('records nothing when the file claimed nothing', () => {
    expect(importedHandProvenance({}).provenance.original).toBeNull();
    expect(importedHandProvenance({ source: 'nonsense' }).provenance.original).toBeNull();
  });
});

// ===========================================================================
// Backfill reads, never chooses
// ===========================================================================

describe('backfillHandProvenance — promotes a recorded fact, never creates one', () => {
  it('reconstructs from a trustworthy scalar and flags it as reconstructed', () => {
    const stamp = backfillHandProvenance('ignition');
    expect(stamp.source).toBe(HAND_SOURCE.IGNITION);
    expect(stamp.provenance.backfilled).toBe(true);
  });

  it('returns null when there is nothing trustworthy to read', () => {
    expect(backfillHandProvenance(undefined)).toBeNull();
    expect(backfillHandProvenance(null)).toBeNull();
    expect(backfillHandProvenance('')).toBeNull();
    expect(backfillHandProvenance('garbage')).toBeNull();
    // 'unknown' is an absence of knowledge, not a channel to backfill from.
    expect(backfillHandProvenance('unknown')).toBeNull();
  });
});

// ===========================================================================
// The guard
// ===========================================================================

const makeHandBody = () => ({
  timestamp: Date.now(),
  gameState: { currentStreet: 'flop', dealerButtonSeat: 1, mySeat: 3 },
  cardState: { communityCards: ['Ah', 'Kd', '2c', null, null], holeCards: ['Js', 'Ts'] },
});

describe('validateHandRecord — a hand cannot be persisted without provenance', () => {
  it('REJECTS an otherwise-valid record with no source', () => {
    const result = validateHandRecord(makeHandBody());
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Missing source/);
  });

  it('rejects a bare source string with no structured provenance', () => {
    const result = validateHandRecord({ ...makeHandBody(), source: 'live' });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Missing provenance object/);
  });

  it('rejects a source outside the closed set', () => {
    const result = validateHandRecord({
      ...makeHandBody(),
      source: 'casino',
      provenance: { channel: 'casino', schemaVersion: 1 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/source must be one of/);
  });

  it('rejects a scalar that disagrees with the object (the drift case)', () => {
    const result = validateHandRecord({
      ...makeHandBody(),
      source: 'live',
      provenance: { channel: 'import', schemaVersion: 1, venue: null, stakeLabel: null, stake: null },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/must equal source/);
  });

  it('accepts a record stamped by a constructor', () => {
    const record = { ...makeHandBody(), ...liveHandProvenance({ venue: 'Wind Creek', gameType: '1/3' }) };
    expect(validateHandRecord(record)).toEqual({ valid: true, errors: [] });
  });

  it('accepts every channel a constructor can produce', () => {
    [liveHandProvenance(null), ignitionHandProvenance(null), importedHandProvenance({}), unknownHandProvenance()]
      .forEach((stamp) => {
        expect(validateHandRecord({ ...makeHandBody(), ...stamp }).valid).toBe(true);
      });
  });
});

describe('handProvenanceProblems — reports structural faults', () => {
  it('is empty for a well-formed stamp', () => {
    expect(handProvenanceProblems(liveHandProvenance(null))).toEqual([]);
  });

  it('flags a malformed stake object', () => {
    const problems = handProvenanceProblems({
      source: 'live',
      provenance: { channel: 'live', schemaVersion: 1, venue: null, stakeLabel: null, stake: { sb: '1' } },
    });
    expect(problems.join(' ')).toMatch(/provenance\.stake must be/);
  });
});
