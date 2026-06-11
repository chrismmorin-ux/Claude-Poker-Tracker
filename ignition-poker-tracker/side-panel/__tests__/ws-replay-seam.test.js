// @vitest-environment jsdom
/**
 * ws-replay-seam.test.js — WS-217 replay seam test.
 *
 * Drives WebSocket frames through the REAL capture chain with no mocks:
 *
 *   raw frame string → parseWsBatch → HandStateMachine.processMessage
 *   (adaptPayload runs inside, as in production) → getLiveHandContext →
 *   buildLiveContext (the service-worker wire transform) →
 *   buildUnifiedHeaderHTML + renderStreetCard
 *
 * and asserts the rendered HUD never contains undefined/null/raw text.
 * A protocol-adapter or context-shape change that breaks the HUD fails
 * here instead of shipping green against hand-authored fixtures.
 *
 * Frame provenance: no raw captured frame dump exists in the repo
 * (spike-data/network-requests.log is HTTP URLs only). Frames are
 * reconstructed in the documented wire format
 * `<byteLen>|{"seq":n,"tDiff":ms,"data":{"pid":...}}` (SPIKE_REPORT.md)
 * from FULL_HAND_SEQUENCE, which is itself derived from the live capture.
 * A follow-up work item covers capturing a real frame dump and swapping
 * it in as the fixture source.
 *
 * Also pins the msgAdvice fixture factory to the wire contract
 * (buildActionAdvice round-trip) and to the producer's object-shaped
 * dataQuality (WS-217 accept criterion 2).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseWsBatch } from '../../shared/protocol.js';
import { HandStateMachine, STATES } from '../../shared/hand-state-machine.js';
import {
  buildLiveContext,
  validateLiveContext,
  buildActionAdvice,
} from '../../shared/wire-schemas.js';
import { FULL_HAND_SEQUENCE } from '../../shared/__tests__/fixtures/payloads.js';
import { buildUnifiedHeaderHTML } from '../render-orchestrator.js';
import { renderStreetCard, resetStreetCardState } from '../render-street-card.js';
import {
  msgAdvice, msgExploits,
  advPreflop, advFlop, advTurn, advRiver,
} from './message-sequences.js';

// ---------------------------------------------------------------------------
// Frame encoding — the documented Atmosphere wire format
// ---------------------------------------------------------------------------

let frameSeq = 0;
const encodeFrame = (msgs) => msgs.map(({ pid, payload }) => {
  const json = JSON.stringify({ seq: ++frameSeq, tDiff: 10, data: { pid, ...payload } });
  return `${new TextEncoder().encode(json).length}|${json}`;
}).join('');

/** Replay one {pid, payload} fixture entry through parse → HSM. */
const replayMessage = (hsm, msg) => {
  const parsed = parseWsBatch(encodeFrame([msg]));
  expect(parsed).toHaveLength(1);
  hsm.processMessage(parsed[0].pid, parsed[0].payload);
};

// ---------------------------------------------------------------------------
// Street slice boundaries — derived from the fixture, not hardcoded indexes.
// Each snapshot point is "everything before the next street's state message"
// (river snapshots before CO_POT_INFO so it represents a live decision point).
// ---------------------------------------------------------------------------

const stateIdx = (v) => FULL_HAND_SEQUENCE.findIndex(
  (m) => m.pid === 'CO_TABLE_STATE' && m.payload.state === v,
);
const potInfoIdx = FULL_HAND_SEQUENCE.findIndex((m) => m.pid === 'CO_POT_INFO');

const SNAPSHOTS = [
  { street: 'preflop', upTo: stateIdx(16), boardLen: 0, advFactory: advPreflop },
  { street: 'flop', upTo: stateIdx(32), boardLen: 3, advFactory: advFlop },
  { street: 'turn', upTo: stateIdx(64), boardLen: 4, advFactory: advTurn },
  { street: 'river', upTo: potInfoIdx, boardLen: 5, advFactory: advRiver },
];

// appSeatData arrives via push_exploits keyed by seat — build it from the
// same wire factory the service worker shape mirrors.
const APP_SEAT_DATA = msgExploits([
  { seat: 3, style: 'LAG', sampleSize: 38 },
  { seat: 5, style: 'TAG', sampleSize: 120 },
]).seats.reduce((acc, s) => ({ ...acc, [s.seat]: s }), {});

const FOCUSED_VILLAIN = 3;

// The established no-undefined assertion trio (render-orchestrator.test.js)
// plus raw-pid and object-coercion leaks.
const expectCleanHtml = (html, label) => {
  expect(html, label).not.toContain('>undefined<');
  expect(html, label).not.toContain('>null<');
  expect(html, label).not.toMatch(/(?<!=")undefined(?!")/);
  expect(html, label).not.toContain('[object Object]');
  expect(html, label).not.toContain('CO_'); // raw protocol pid leaked to HUD
  expect(html, label).not.toContain('NaN');
};

// ---------------------------------------------------------------------------
// 1. Frame encoding round-trip
// ---------------------------------------------------------------------------

describe('frame encoding round-trip (parseWsBatch)', () => {
  it('every fixture message survives encode → parse with pid and payload intact', () => {
    for (const msg of FULL_HAND_SEQUENCE) {
      const parsed = parseWsBatch(encodeFrame([msg]));
      expect(parsed).toHaveLength(1);
      expect(parsed[0].pid).toBe(msg.pid);
      expect(parsed[0].payload).toEqual(msg.payload);
    }
  });

  it('a whole street batched into ONE concatenated frame parses losslessly', () => {
    const preflopSlice = FULL_HAND_SEQUENCE.slice(0, stateIdx(16));
    const parsed = parseWsBatch(encodeFrame(preflopSlice));
    expect(parsed).toHaveLength(preflopSlice.length);
    parsed.forEach((p, i) => {
      expect(p.pid).toBe(preflopSlice[i].pid);
      expect(p.payload).toEqual(preflopSlice[i].payload);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Full-hand replay through the HSM
// ---------------------------------------------------------------------------

describe('full-hand replay through HSM', () => {
  it('replays all frames with zero errors and completes the hand', () => {
    const onHandComplete = vi.fn();
    const onError = vi.fn();
    const hsm = new HandStateMachine('ws-replay-seam', onHandComplete, onError);

    for (const msg of FULL_HAND_SEQUENCE) replayMessage(hsm, msg);

    expect(onError).not.toHaveBeenCalled();
    expect(onHandComplete).toHaveBeenCalledTimes(1);
    // handEnd emits the record then resets — IDLE means ready for next hand.
    expect(hsm.state).toBe(STATES.IDLE);
    const record = onHandComplete.mock.calls[0][0];
    expect(record).not.toBeNull();
    expect(record.ignitionMeta.handNumber).toBe('12345');
  });

  it('river context carries decoded cards, hero seat, pot, and aggressor', () => {
    const hsm = new HandStateMachine('ws-replay-seam-ctx', vi.fn(), vi.fn());
    FULL_HAND_SEQUENCE.slice(0, potInfoIdx).forEach((m) => replayMessage(hsm, m));

    const ctx = hsm.getLiveHandContext();
    expect(ctx.currentStreet).toBe('river');
    expect(ctx.communityCards).toEqual(['A♠', '9♦', 'A♦', '2♣', 'K♠']);
    expect(ctx.holeCards).toEqual(['8♦', 'K♥']);
    expect(ctx.heroSeat).toBe(5);
    expect(ctx.pot).toBe(1050); // CO_CHIPTABLE_INFO 105000 cents → dollars
    expect(ctx.pfAggressor).toBe(5); // hero raised preflop
    expect(ctx.actionSequence.length).toBeGreaterThan(0);
    for (const a of ctx.actionSequence) {
      expect(a.seat).toBeDefined();
      expect(a.action).toBeDefined();
      expect(a.street).toBeDefined();
      expect(a.order).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Street-by-street render output — the full seam
// ---------------------------------------------------------------------------

describe('street-by-street render from replayed context', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="street-card"></div>';
    resetStreetCardState();
  });

  for (const { street, upTo, boardLen, advFactory } of SNAPSHOTS) {
    it(`${street}: rendered HUD is clean with and without advice`, () => {
      const onError = vi.fn();
      const hsm = new HandStateMachine(`seam-${street}`, vi.fn(), onError);
      FULL_HAND_SEQUENCE.slice(0, upTo).forEach((m) => replayMessage(hsm, m));
      expect(onError).not.toHaveBeenCalled();

      // The service-worker wire transform — part of the seam under test.
      const ctx = buildLiveContext(hsm.getLiveHandContext());
      const { valid, errors } = validateLiveContext(ctx);
      expect(errors).toEqual([]);
      expect(valid).toBe(true);
      expect(ctx.currentStreet).toBe(street);
      expect(ctx.communityCards.filter(Boolean)).toHaveLength(boardLen);

      const advice = msgAdvice(advFactory()).advice;
      const card = document.getElementById('street-card');

      // Pre-advice state (advice = null) — the HUD's waiting path.
      const headerNoAdvice = buildUnifiedHeaderHTML(null, ctx, {
        focusedVillainSeat: FOCUSED_VILLAIN,
        pinnedVillainSeat: null,
        appSeatData: APP_SEAT_DATA,
        currentLiveContext: ctx,
        currentTableState: null,
      });
      expectCleanHtml(headerNoAdvice.html, `${street} header (no advice)`);

      renderStreetCard(street, null, ctx, APP_SEAT_DATA, FOCUSED_VILLAIN, null, {});
      expectCleanHtml(card.innerHTML, `${street} street card (no advice)`);

      // With wire-realistic advice (object-shaped dataQuality included).
      const header = buildUnifiedHeaderHTML(advice, ctx, {
        focusedVillainSeat: FOCUSED_VILLAIN,
        pinnedVillainSeat: null,
        appSeatData: APP_SEAT_DATA,
        currentLiveContext: ctx,
        currentTableState: null,
      });
      expect(header.isWaiting).toBe(false);
      expectCleanHtml(header.html, `${street} header (with advice)`);

      renderStreetCard(street, advice, ctx, APP_SEAT_DATA, FOCUSED_VILLAIN, null, {});
      expect(card.innerHTML.length).toBeGreaterThan(0);
      expectCleanHtml(card.innerHTML, `${street} street card (with advice)`);
    });
  }
});

// ---------------------------------------------------------------------------
// 4. msgAdvice ↔ ADVICE_FIELDS wire contract
// ---------------------------------------------------------------------------

describe('msgAdvice fixture ↔ wire contract', () => {
  it('every msgAdvice key survives the buildActionAdvice wire pick', () => {
    // The flopBreakdown incident class: a fixture key missing from
    // ADVICE_FIELDS gets silently dropped at the wire while fixture-injected
    // tests stay green. Round-tripping the factory output fails loudly.
    const fixtureAdvice = msgAdvice({}).advice;
    const wire = buildActionAdvice(fixtureAdvice);
    const dropped = Object.keys(fixtureAdvice).filter((k) => !(k in wire));
    expect(dropped).toEqual([]);
  });

  it('fixture dataQuality matches the producer object shape', () => {
    // Producer: src/hooks/useLiveActionAdvisor.js:135 — never a string.
    const { dataQuality } = msgAdvice({}).advice;
    expect(typeof dataQuality.sampleSize).toBe('number');
    expect(['none', 'speculative', 'developing', 'established']).toContain(dataQuality.tier);
    expect(typeof dataQuality.confidenceNote).toBe('string');
  });
});
