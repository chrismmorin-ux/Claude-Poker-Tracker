// @vitest-environment jsdom
/**
 * predictionAuditWriter.test.js — PMC Phase 5a primitive (WS-177 / SPR-068).
 *
 * Pins the writer's contract:
 *   - composeModelVersion() returns "range-${PROFILE_VERSION}+engine-${ENGINE_VERSION}".
 *   - sanitizePredictionAudit enforces AP-PMC-04 schema-level — hero entries
 *     on observedAction lose evRealized; villain entries keep it.
 *   - sanitizePredictionAudit throws on structurally invalid payloads.
 *   - writePredictionAudit persists the sanitized payload to the hands store.
 *   - readPredictionAudit returns the field or null.
 *   - Round-trip identity (write → read returns the sanitized payload).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  closeDB,
  resetDBPool,
  DB_NAME,
} from '../database';
import { saveHand } from '../handsStorage';
import {
  composeModelVersion,
  sanitizePredictionAudit,
  writePredictionAudit,
  readPredictionAudit,
} from '../predictionAuditWriter';
import { PROFILE_VERSION } from '../../rangeEngine';
import { ENGINE_VERSION } from '../../../constants/runtimeVersions';

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

const validPayload = () => ({
  predictedDistribution: [
    { actor: 'villain', actorId: 42, seat: 3, distribution: [{ action: 'fold', weight: 0.4 }, { action: 'call', weight: 0.6 }] },
  ],
  observedAction: [
    { actor: 'villain', actorId: 42, seat: 3, actionTaken: 'call', sizing: 100 },
  ],
  modelVersion: 'range-3+engine-v123',
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

describe('composeModelVersion', () => {
  it('returns "range-{PROFILE_VERSION}+engine-{ENGINE_VERSION}"', () => {
    expect(composeModelVersion()).toBe(`range-${PROFILE_VERSION}+engine-${ENGINE_VERSION}`);
  });

  it('PROFILE_VERSION is a number and ENGINE_VERSION is a string (constants intact)', () => {
    expect(typeof PROFILE_VERSION).toBe('number');
    expect(typeof ENGINE_VERSION).toBe('string');
    expect(ENGINE_VERSION.length).toBeGreaterThan(0);
  });
});

describe('sanitizePredictionAudit — AP-PMC-04 schema-level enforcement', () => {
  it('strips evRealized from hero observedAction entries', () => {
    const payload = {
      ...validPayload(),
      observedAction: [
        { actor: 'hero', actorId: 'hero', seat: 2, actionTaken: 'raise', sizing: 250, evRealized: 1.5 },
      ],
    };
    const sanitized = sanitizePredictionAudit(payload);
    expect(sanitized.observedAction[0]).not.toHaveProperty('evRealized');
    expect(sanitized.observedAction[0].actor).toBe('hero');
    expect(sanitized.observedAction[0].actionTaken).toBe('raise');
  });

  it('preserves evRealized on villain observedAction entries (strip is hero-only)', () => {
    const payload = {
      ...validPayload(),
      observedAction: [
        { actor: 'villain', actorId: 42, seat: 3, actionTaken: 'call', sizing: 100, evRealized: -0.3 },
      ],
    };
    const sanitized = sanitizePredictionAudit(payload);
    expect(sanitized.observedAction[0]).toHaveProperty('evRealized', -0.3);
  });

  it('strips evRealized from hero entries in mixed hero+villain observedAction list', () => {
    const payload = {
      ...validPayload(),
      observedAction: [
        { actor: 'villain', actorId: 42, seat: 3, actionTaken: 'bet', sizing: 50, evRealized: 0.2 },
        { actor: 'hero', actorId: 'hero', seat: 2, actionTaken: 'call', sizing: 50, evRealized: 1.1 },
        { actor: 'villain', actorId: 99, seat: 4, actionTaken: 'fold', evRealized: 0.0 },
      ],
    };
    const sanitized = sanitizePredictionAudit(payload);
    expect(sanitized.observedAction[0]).toHaveProperty('evRealized', 0.2);
    expect(sanitized.observedAction[1]).not.toHaveProperty('evRealized');
    expect(sanitized.observedAction[2]).toHaveProperty('evRealized', 0.0);
  });

  it('does not mutate the input payload', () => {
    const payload = {
      ...validPayload(),
      observedAction: [
        { actor: 'hero', actorId: 'hero', seat: 2, actionTaken: 'raise', evRealized: 1.5 },
      ],
    };
    const original = JSON.parse(JSON.stringify(payload));
    sanitizePredictionAudit(payload);
    expect(payload).toEqual(original);
  });

  it('does NOT touch predictedDistribution entries (model output is not user identity)', () => {
    const payload = {
      ...validPayload(),
      predictedDistribution: [
        { actor: 'hero', actorId: 'hero', seat: 2, distribution: [{ action: 'check', weight: 1.0 }] },
      ],
    };
    const sanitized = sanitizePredictionAudit(payload);
    expect(sanitized.predictedDistribution).toEqual(payload.predictedDistribution);
  });
});

describe('sanitizePredictionAudit — schema invariants', () => {
  it('throws when payload is null', () => {
    expect(() => sanitizePredictionAudit(null)).toThrow(/payload must be an object/);
  });

  it('throws when modelVersion is missing', () => {
    const { modelVersion: _omit, ...payload } = validPayload();
    void _omit;
    expect(() => sanitizePredictionAudit(payload)).toThrow(/missing modelVersion/);
  });

  it('throws when modelVersion is empty string', () => {
    expect(() => sanitizePredictionAudit({ ...validPayload(), modelVersion: '' }))
      .toThrow(/missing modelVersion/);
  });

  it('throws when predictedDistribution is not an array', () => {
    expect(() => sanitizePredictionAudit({ ...validPayload(), predictedDistribution: null }))
      .toThrow(/predictedDistribution must be an array/);
  });

  it('throws when observedAction is not an array', () => {
    expect(() => sanitizePredictionAudit({ ...validPayload(), observedAction: 'oops' }))
      .toThrow(/observedAction must be an array/);
  });

  it('accepts empty arrays for predictedDistribution and observedAction', () => {
    const empty = { predictedDistribution: [], observedAction: [], modelVersion: 'range-3+engine-v123' };
    expect(() => sanitizePredictionAudit(empty)).not.toThrow();
    expect(sanitizePredictionAudit(empty)).toEqual(empty);
  });
});

describe('writePredictionAudit / readPredictionAudit — round-trip', () => {
  it('writes a payload and reads it back identical (sanitized)', async () => {
    const handId = await saveHand(validHandData(), 'guest');
    const payload = validPayload();
    await writePredictionAudit(handId, payload);
    const readBack = await readPredictionAudit(handId);
    expect(readBack).toEqual(sanitizePredictionAudit(payload));
  });

  it('write then read returns sanitized payload (hero evRealized stripped)', async () => {
    const handId = await saveHand(validHandData(), 'guest');
    const payload = {
      ...validPayload(),
      observedAction: [
        { actor: 'villain', actorId: 42, seat: 3, actionTaken: 'bet', sizing: 50, evRealized: 0.2 },
        { actor: 'hero', actorId: 'hero', seat: 2, actionTaken: 'call', sizing: 50, evRealized: 1.1 },
      ],
    };
    await writePredictionAudit(handId, payload);
    const readBack = await readPredictionAudit(handId);
    expect(readBack.observedAction[0]).toHaveProperty('evRealized', 0.2);
    expect(readBack.observedAction[1]).not.toHaveProperty('evRealized');
  });

  it('overwrites an existing predictionAudit on subsequent write', async () => {
    const handId = await saveHand(validHandData(), 'guest');
    await writePredictionAudit(handId, validPayload());
    const updated = {
      ...validPayload(),
      modelVersion: 'range-3+engine-v124',
    };
    await writePredictionAudit(handId, updated);
    const readBack = await readPredictionAudit(handId);
    expect(readBack.modelVersion).toBe('range-3+engine-v124');
  });

  it('readPredictionAudit returns null when the hand exists but has no field', async () => {
    const handId = await saveHand(validHandData(), 'guest');
    // saveHand doesn't add predictionAudit on its own (auto-save in usePersistence
    // does, but saveHand is the bare API); a hand created via this path has no
    // predictionAudit field set.
    const readBack = await readPredictionAudit(handId);
    expect(readBack).toBeNull();
  });

  it('readPredictionAudit returns null for a missing handId', async () => {
    const readBack = await readPredictionAudit(99999999);
    expect(readBack).toBeNull();
  });
});

describe('writePredictionAudit — error paths', () => {
  it('rejects when handId does not exist', async () => {
    await expect(writePredictionAudit(99999999, validPayload())).rejects.toThrow(/Hand .* not found/);
  });

  it('rejects when payload is invalid (no IDB write attempted)', async () => {
    const handId = await saveHand(validHandData(), 'guest');
    await expect(writePredictionAudit(handId, { foo: 'bar' })).rejects.toThrow();
    // Confirm no partial write happened — record still has no predictionAudit field.
    const readBack = await readPredictionAudit(handId);
    expect(readBack).toBeNull();
  });
});
