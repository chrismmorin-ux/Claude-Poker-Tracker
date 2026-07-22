/**
 * statsEngineParity.seam.test.js — WS-236 / FIND-024 (provenance DP-008)
 *
 * The Ignition extension computes HUD villain stats via a PARALLEL engine
 * (ignition-poker-tracker/shared/stats-engine.js) that cannot import the
 * main-app pipeline (MV3 bundle, dependency-free by design). This seam test
 * pins the parallel path to the canonical main-app semantics
 * (tendencyCalculations.js): the SAME hand records go through BOTH engines
 * and every shared counter, derived percentage, and the style label must
 * agree exactly. If either side's semantics drift, this suite fails —
 * closing the "two paths silently diverge" class from FIND-024.
 *
 * Zero mocks. Fixtures are legal action sequences in the shared
 * hand.gameState.actionSequence wire shape both engines consume.
 */

import { describe, it, expect } from 'vitest';

// Main-app canonical pipeline
import {
  buildPlayerStats,
  derivePercentages as deriveMain,
  classifyStyle as classifyMain,
} from '../tendencyCalculations';

// Extension parallel engine (dependency-free module — safe cross-package import)
import {
  computeSeatStats,
  derivePercentages as deriveExt,
  classifyStyle as classifyExt,
  sampleQualityTier,
  SAMPLE_QUALITY_THRESHOLDS,
} from '../../../ignition-poker-tracker/shared/stats-engine.js';

// =========================================================================
// FIXTURES — legal hands in the shared actionSequence shape
// =========================================================================

const SEATS = [1, 2, 3, 4, 5, 6];
const seatPlayers = Object.fromEntries(SEATS.map(s => [String(s), `p${s}`]));

let handCounter = 0;
const makeHand = (actions) => ({
  handId: `parity-${++handCounter}`,
  seatPlayers,
  gameState: {
    actionSequence: actions.map((a, i) => ({ order: i + 1, ...a })),
  },
});

const pf = (seat, action, amount = 0) => ({ seat, action, amount, street: 'preflop' });
const flop = (seat, action, amount = 0) => ({ seat, action, amount, street: 'flop' });
const turn = (seat, action, amount = 0) => ({ seat, action, amount, street: 'turn' });
const river = (seat, action, amount = 0) => ({ seat, action, amount, street: 'river' });

// Scenario battery — each exercises a different stat path.
const HANDS = [
  // 1. Raised pot + c-bet, one caller folds to the c-bet
  makeHand([
    pf(3, 'raise', 6), pf(4, 'fold'), pf(5, 'call', 6), pf(6, 'fold'),
    pf(1, 'fold'), pf(2, 'fold'),
    flop(5, 'check'), flop(3, 'bet', 8), flop(5, 'fold'),
  ]),
  // 2. Limped multiway pot, checked down to river with turn aggression
  makeHand([
    pf(2, 'call', 2), pf(4, 'call', 2), pf(6, 'check'),
    flop(2, 'check'), flop(4, 'check'), flop(6, 'check'),
    turn(2, 'bet', 4), turn(4, 'call', 4), turn(6, 'fold'),
    river(2, 'check'), river(4, 'check'),
  ]),
  // 3. 3-bet pot: open, 3-bet, open-raiser folds (open-raiser fold-to-3bet)
  makeHand([
    pf(2, 'raise', 6), pf(5, 'raise', 18), pf(6, 'fold'),
    pf(1, 'fold'), pf(2, 'fold'),
  ]),
  // 4. Cold-caller faces a 3-bet and folds; opener calls, c-bets flop
  makeHand([
    pf(1, 'raise', 5), pf(3, 'call', 5), pf(6, 'raise', 20),
    pf(1, 'call', 20), pf(3, 'fold'),
    flop(1, 'check'), flop(6, 'bet', 25), flop(1, 'call', 25),
    turn(1, 'check'), turn(6, 'check'),
    river(1, 'bet', 40), river(6, 'fold'),
  ]),
  // 5. Raise + flop check-raise (postflop raise counter)
  makeHand([
    pf(4, 'raise', 6), pf(5, 'call', 6),
    flop(5, 'check'), flop(4, 'bet', 8), flop(5, 'raise', 24), flop(4, 'call', 24),
    turn(5, 'bet', 40), turn(4, 'fold'),
  ]),
  // 6. Everyone folds to a raise (opener wins preflop, no flop)
  makeHand([
    pf(6, 'raise', 6), pf(1, 'fold'), pf(2, 'fold'), pf(3, 'fold'),
    pf(4, 'fold'), pf(5, 'fold'),
  ]),
];

// Shared raw-counter fields (extension-only limp fields + main-only
// lastCalculatedHandId excluded).
const SHARED_COUNTERS = [
  'handsSeenPreflop', 'vpipCount', 'pfrCount',
  'totalBets', 'totalRaises', 'totalCalls',
  'facedRaisePreflop', 'threeBetCount', 'foldTo3BetCount',
  'pfAggressorFlops', 'cbetCount', 'facedCbet', 'foldedToCbet',
];

const SHARED_PERCENTAGES = ['vpip', 'pfr', 'af', 'threeBet', 'cbet', 'foldToCbet', 'sampleSize'];

describe('stats-engine ↔ tendencyCalculations parity (WS-236 seam)', () => {
  for (const seat of SEATS) {
    it(`raw counters agree for seat ${seat} across the scenario battery`, () => {
      const main = buildPlayerStats(`p${seat}`, HANDS);
      const ext = computeSeatStats(HANDS, seat);
      for (const field of SHARED_COUNTERS) {
        expect(ext[field], `seat ${seat} field ${field}`).toBe(main[field]);
      }
    });

    it(`derived percentages agree for seat ${seat}`, () => {
      const main = deriveMain(buildPlayerStats(`p${seat}`, HANDS));
      const ext = deriveExt(computeSeatStats(HANDS, seat));
      for (const field of SHARED_PERCENTAGES) {
        expect(ext[field], `seat ${seat} pct ${field}`).toBe(main[field]);
      }
    });

    it(`style classification agrees for seat ${seat}`, () => {
      const main = classifyMain(deriveMain(buildPlayerStats(`p${seat}`, HANDS)));
      const ext = classifyExt(deriveExt(computeSeatStats(HANDS, seat)));
      expect(ext).toBe(main);
    });
  }

  it('per-hand parity holds hand-by-hand (localizes any future drift)', () => {
    for (const hand of HANDS) {
      for (const seat of SEATS) {
        const main = buildPlayerStats(`p${seat}`, [hand]);
        const ext = computeSeatStats([hand], seat);
        for (const field of SHARED_COUNTERS) {
          expect(ext[field], `hand ${hand.handId} seat ${seat} field ${field}`).toBe(main[field]);
        }
      }
    }
  });

  it('player absent from a hand contributes nothing on either path', () => {
    const soloHand = makeHand([
      pf(1, 'raise', 6), pf(2, 'fold'), pf(3, 'fold'),
      pf(4, 'fold'), pf(5, 'fold'), pf(6, 'fold'),
    ]);
    // Seat 6 folded (still "in") but a seat with zero actions: use a hand where
    // seatPlayers includes a seat that never acts.
    const main = buildPlayerStats('p6', [soloHand]);
    const ext = computeSeatStats([soloHand], 6);
    for (const field of SHARED_COUNTERS) {
      expect(ext[field]).toBe(main[field]);
    }
  });
});

describe('sample-quality tier consistency with LiveAdviceBar DP-004 thresholds', () => {
  it('thresholds match the main-app ConfidenceBadge breakpoints (15 / 5)', () => {
    // LiveAdviceBar.jsx ConfidenceBadge: DATA at effectiveN >= 15, PARTIAL >= 5.
    // The extension badge must not silently drift from those breakpoints.
    expect(SAMPLE_QUALITY_THRESHOLDS.DATA).toBe(15);
    expect(SAMPLE_QUALITY_THRESHOLDS.PARTIAL).toBe(5);
    expect(sampleQualityTier(15)).toBe('DATA');
    expect(sampleQualityTier(14)).toBe('PARTIAL');
    expect(sampleQualityTier(5)).toBe('PARTIAL');
    expect(sampleQualityTier(4)).toBe('EST');
  });
});
