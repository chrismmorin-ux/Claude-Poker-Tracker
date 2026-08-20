/**
 * changeLedger.test.js — WS-537.
 *
 * THE LOAD-BEARING TEST IS `redistribution`. Everything else guards the arithmetic; that one
 * guards the REASON THE INSTRUMENT EXISTS. Two branches move by ±5 bb, the NET comes out at
 * -0.01, and without GROSS that run is indistinguishable from a change that did nothing. The
 * assertion is that GROSS is large and `GROSS/|NET|` blows up — if this test ever passes with
 * a small ratio, the ledger has stopped separating "no effect" from "cancellation" and the
 * ticket's whole premise is unenforced.
 *
 * The identity test asserts `NET === pairedDelta.deltaBB` on real-shaped input, through the
 * ACTUAL producer rather than a re-derivation — a hand-computed expected value would only
 * prove the test agrees with itself.
 */

import { describe, it, expect } from 'vitest';
import {
  buildChangeLedger, netPublishProblems, branchKeyOf, renderChangeLedgerLines,
  changeLedgerMetricsFields,
  BRANCH_AXES, UNKNOWN_AXIS, REFUSAL_CLASSES, REFUSAL_CODES, LEDGER_REFUSALS,
} from '../backtest/changeLedger.mjs';
import {
  pairedDelta, buildDepthAblationReport, DEPTH_ABLATION_UNSEEDED_SOURCES,
} from '../backtest/depthAblationReport.mjs';
import { DEFAULT_BOOTSTRAP_SEED } from '../backtest/ipsEstimator.mjs';
import { resultCardProblems } from '../../src/utils/standardOfRecord/resultCard.js';
// The CARD boundary. `metricsProblems` is the publish path — the same function
// `resultCardProblems` calls — so the rejection asserted below is the real one, not a
// re-derivation of it.
import { metricsProblems } from '../../src/utils/standardOfRecord/metrics.js';
import { SOR_SCHEMAS } from '../../src/utils/standardOfRecord/schemas.js';
import {
  METRICS_KINDS, METRICS_SCHEMA_VERSIONS, METRICS_NET_GROSS_PAIRS,
} from '../../src/utils/standardOfRecord/metricsSchemas.js';

/**
 * One decision, shaped like `heroEvTask.mjs:437-477` produces them.
 *
 * `pOursA` / `pOursB` are the probability each arm assigns to the OBSERVED action, so the
 * importance weights are `pOursX / 0.5` and are directly controllable from the test.
 * `isIP` sits at the TOP LEVEL and the rest inside `slices`, exactly as the producer emits
 * them — a fixture that flattened them would test a shape the harness never sees.
 */
const decision = ({
  id, street, facingAction, isIP, netBB, pOursA, pOursB, playerId = `p${id}`,
  omitIsIP = false, situationKey = null,
}) => {
  const row = {
    playerId,
    handId: `h${id}`,
    order: id,
    observedAction: 'call',
    netBB,
    piPool: { call: 0.5, fold: 0.5 },
    piOursByArm: {
      depth1: { call: pOursA, fold: 1 - pOursA },
      depth2: { call: pOursB, fold: 1 - pOursB },
    },
    slices: { street, facingAction, texture: 'dry', posCategory: 'LATE', sizeBucket: 'half', playersInPot: 2 },
  };
  if (!omitIsIP) row.isIP = isIP;
  if (situationKey) row.situationKey = situationKey;
  return row;
};

const ARMS = { baseArm: 'depth1', testArm: 'depth2' };

describe('changeLedger — branch key projection', () => {
  it('projects street x facingAction x isIP, reading isIP from the TOP LEVEL not from slices', () => {
    expect(BRANCH_AXES).toEqual(['street', 'facingAction', 'isIP']);
    const d = decision({ id: 1, street: 'river', facingAction: 'bet', isIP: 'oop', netBB: 1, pOursA: 0.5, pOursB: 0.5 });
    expect(branchKeyOf(d)).toBe('river|bet|oop');
  });

  it('recovers a missing isIP from situationKey rather than degrading the partition', () => {
    // `situationKey` wire order is street:texture:posCategory:isAgg:isIP:facingAction:contextAction.
    const d = decision({
      id: 1, street: 'turn', facingAction: 'raise', isIP: 'ip', netBB: 1, pOursA: 0.5, pOursB: 0.5,
      omitIsIP: true, situationKey: 'turn:dry:LATE:agg:ip:raise:cbet',
    });
    expect(branchKeyOf(d)).toBe('turn|raise|ip');
  });

  it('keys a genuinely unavailable axis to "unknown" and never drops the decision', () => {
    const d = decision({
      id: 1, street: 'flop', facingAction: 'none', isIP: 'ip', netBB: 1, pOursA: 0.5, pOursB: 0.5,
      omitIsIP: true,
    });
    expect(branchKeyOf(d)).toBe(`flop|none|${UNKNOWN_AXIS}`);
  });
});

describe('changeLedger — THE LOAD-BEARING CASE: offsetting branches, near-zero NET', () => {
  // Two branches. Arm B doubles the weight on one decision of each branch and zeroes the
  // other, so each branch moves ~5 bb and the two movements very nearly cancel.
  //   flop|bet|ip   : d1 (+10 bb, w 1→2)  d2 (−10 bb,    w 1→0)   ⇒  Δ_b = +5.00
  //   river|bet|oop : d3 (+10 bb, w 1→0)  d4 (−10.04 bb, w 1→2)   ⇒  Δ_b = −5.01
  const rows = [
    decision({ id: 1, street: 'flop', facingAction: 'bet', isIP: 'ip', netBB: 10, pOursA: 0.5, pOursB: 1 }),
    decision({ id: 2, street: 'flop', facingAction: 'bet', isIP: 'ip', netBB: -10, pOursA: 0.5, pOursB: 0 }),
    decision({ id: 3, street: 'river', facingAction: 'bet', isIP: 'oop', netBB: 10, pOursA: 0.5, pOursB: 0 }),
    decision({ id: 4, street: 'river', facingAction: 'bet', isIP: 'oop', netBB: -10.04, pOursA: 0.5, pOursB: 1 }),
  ];
  const ledger = buildChangeLedger(rows, ARMS);

  it('reports a NET that is indistinguishable from "nothing happened"', () => {
    expect(ledger.available).toBe(true);
    expect(ledger.net.deltaBB).toBeCloseTo(-0.01, 4);
    expect(Math.abs(ledger.net.deltaBB)).toBeLessThan(0.05);
  });

  it('reports a GROSS three orders of magnitude larger — the movement NET cannot see', () => {
    expect(ledger.gross.deltaBB).toBeCloseTo(10.01, 4);
    expect(ledger.gross.deltaBB).toBeGreaterThan(100 * Math.abs(ledger.net.deltaBB));
  });

  it('blows GROSS/|NET| up, which is the redistribution detector firing', () => {
    expect(ledger.redistributionRatio).toBeGreaterThan(500);
    expect(ledger.redistributionRatio).toBeCloseTo(1001, 0);
    // The bounded reciprocal agrees: essentially none of the movement survived to the NET.
    expect(ledger.netShareOfGross).toBeLessThan(0.002);
  });

  it('locates the offsetting movement per branch, with opposite signs', () => {
    const byKey = Object.fromEntries(ledger.branches.map((b) => [b.key, b]));
    expect(Object.keys(byKey).sort()).toEqual(['flop|bet|ip', 'river|bet|oop']);
    expect(byKey['flop|bet|ip'].deltaBB).toBeCloseTo(5.0, 4);
    expect(byKey['river|bet|oop'].deltaBB).toBeCloseTo(-5.01, 4);
    // And they still sum to the NET — the cancellation is visible AND accounted for.
    const sum = ledger.branches.reduce((s, b) => s + b.deltaBB, 0);
    expect(sum).toBeCloseTo(ledger.net.deltaBB, 6);
  });

  it('carries per-branch n, discordance and cluster counts', () => {
    for (const b of ledger.branches) {
      expect(b.n).toBe(2);
      expect(b.discordantN).toBe(2);
      expect(b.players).toBe(2);
    }
  });
});

describe('changeLedger — NET === headline pairedDelta, BY CONSTRUCTION', () => {
  // Real-shaped input: 36 decisions across 3 streets x 2 facing actions x 2 positions, with
  // varied outcomes and arm probabilities, plus rows the estimator must drop identically.
  const streets = ['flop', 'turn', 'river'];
  const facings = ['bet', 'raise'];
  const positions = ['ip', 'oop'];
  const rows = [];
  let i = 0;
  for (const street of streets) {
    for (const facingAction of facings) {
      for (const isIP of positions) {
        for (let k = 0; k < 3; k++) {
          i++;
          rows.push(decision({
            id: i,
            street,
            facingAction,
            isIP,
            netBB: ((i * 7) % 23) - 11 + (i % 3) * 0.37,
            pOursA: 0.2 + ((i * 3) % 7) / 10,
            pOursB: 0.15 + ((i * 5) % 8) / 10,
            playerId: `player-${i % 9}`,
          }));
        }
      }
    }
  }
  // A row the estimator MUST drop (zero pool propensity on the observed action), present so
  // the two paths are proven to drop it identically rather than only on clean input.
  rows.push({
    ...decision({ id: 999, street: 'river', facingAction: 'bet', isIP: 'ip', netBB: 5, pOursA: 0.5, pOursB: 0.5 }),
    piPool: { call: 0, fold: 1 },
  });

  const delta = pairedDelta(rows, ARMS);
  const ledger = buildChangeLedger(rows, { ...ARMS, headlineDeltaBB: delta.deltaBB });

  it('reproduces the producer\'s own headline to the last reported digit', () => {
    expect(delta.deltaBB).not.toBeNull();
    expect(ledger.net.deltaBB).toBe(delta.deltaBB);
  });

  it('admits exactly the rows pairedDelta admits, and drops the same one', () => {
    expect(ledger.n).toBe(delta.n);
    expect(ledger.discordantN).toBe(delta.discordantN);
    expect(ledger.skipped['base:zero-propensity']).toBe(1);
  });

  it('stamps the identity check as HELD rather than leaving it to inspection', () => {
    expect(ledger.identity.checkedAgainstHeadline).toBe(true);
    expect(ledger.identity.agrees).toBe(true);
    expect(ledger.identity.internalAgrees).toBe(true);
  });

  it('partitions into 12 branches whose contributions sum to the headline', () => {
    expect(ledger.partition.branchCount).toBe(12);
    const sum = ledger.branches.reduce((s, b) => s + b.deltaBB, 0);
    expect(sum).toBeCloseTo(delta.deltaBB, 3);
  });

  it('emits GROSS beside NET, and GROSS is at least |NET|', () => {
    expect(ledger.gross.deltaBB).not.toBeNull();
    expect(ledger.gross.deltaBB).toBeGreaterThanOrEqual(Math.abs(ledger.net.deltaBB));
  });
});

describe('changeLedger — refusal', () => {
  it('refuses the whole ledger when no decision is scorable under both arms', () => {
    const ledger = buildChangeLedger([], ARMS);
    expect(ledger.available).toBe(false);
    expect(ledger.refusal.code).toBe(LEDGER_REFUSALS.NO_SCORABLE_DECISIONS);
    expect(ledger.net).toBeNull();
  });

  it('refuses when NET does not reproduce the headline it was handed', () => {
    const rows = [
      decision({ id: 1, street: 'flop', facingAction: 'bet', isIP: 'ip', netBB: 4, pOursA: 0.5, pOursB: 0.9 }),
      decision({ id: 2, street: 'flop', facingAction: 'bet', isIP: 'ip', netBB: -2, pOursA: 0.5, pOursB: 0.1 }),
    ];
    const ledger = buildChangeLedger(rows, { ...ARMS, headlineDeltaBB: 99.9 });
    expect(ledger.available).toBe(false);
    expect(ledger.refusal.code).toBe(LEDGER_REFUSALS.IDENTITY_VIOLATED);
    expect(ledger.refusal.detail).toMatch(/not over the same decision set/);
  });

  it('files a branch where both arms agree as observed-zero, NOT unexamined', () => {
    const rows = [
      // This branch moves.
      decision({ id: 1, street: 'river', facingAction: 'bet', isIP: 'ip', netBB: 8, pOursA: 0.4, pOursB: 0.9 }),
      decision({ id: 2, street: 'river', facingAction: 'bet', isIP: 'ip', netBB: -3, pOursA: 0.4, pOursB: 0.1 }),
      // This one does not: identical probabilities on both arms.
      decision({ id: 3, street: 'flop', facingAction: 'none', isIP: 'oop', netBB: 2, pOursA: 0.5, pOursB: 0.5 }),
      decision({ id: 4, street: 'flop', facingAction: 'none', isIP: 'oop', netBB: -6, pOursA: 0.3, pOursB: 0.3 }),
    ];
    const ledger = buildChangeLedger(rows, ARMS);
    const flat = ledger.branches.find((b) => b.key === 'flop|none|oop');
    expect(flat.quotable).toBe(false);
    expect(flat.refusal.class).toBe(REFUSAL_CLASSES.OBSERVED_ZERO);
    expect(flat.refusal.code).toBe(REFUSAL_CODES.ARMS_AGREE_EVERYWHERE);
    expect(flat.discordantN).toBe(0);
  });

  it('keeps a REFUSED branch inside NET and GROSS — refusal governs quotation, not inclusion', () => {
    const rows = [
      decision({ id: 1, street: 'river', facingAction: 'bet', isIP: 'ip', netBB: 8, pOursA: 0.4, pOursB: 0.9 }),
      decision({ id: 2, street: 'river', facingAction: 'bet', isIP: 'ip', netBB: -3, pOursA: 0.4, pOursB: 0.1 }),
      decision({ id: 3, street: 'flop', facingAction: 'none', isIP: 'oop', netBB: 2, pOursA: 0.5, pOursB: 0.9 }),
    ];
    // A cluster bar nothing can clear, so every row is refused for quotation.
    const ledger = buildChangeLedger(rows, {
      ...ARMS, cellGate: { minClusters: 30, minDiscordant: 30 },
    });
    expect(ledger.branches.every((b) => b.quotable === false)).toBe(true);
    // The EXACT identity is the one that matters and it is stamped, not eyeballed. The
    // displayed column is rounded to 4dp per row, so it reconciles only to display
    // precision — asserting it more tightly would be asserting the rounding.
    expect(ledger.identity.internalAgrees).toBe(true);
    const sum = ledger.branches.reduce((s, b) => s + b.deltaBB, 0);
    expect(sum).toBeCloseTo(ledger.net.deltaBB, 3);
    expect(ledger.gross.deltaBB).toBeGreaterThan(0);
  });

  it('refuses the CELL table rather than inventing a power bar', () => {
    const rows = [decision({ id: 1, street: 'flop', facingAction: 'bet', isIP: 'ip', netBB: 3, pOursA: 0.4, pOursB: 0.8 })];
    const ledger = buildChangeLedger(rows, ARMS);
    expect(ledger.cells.available).toBe(false);
    expect(ledger.cells.reason).toMatch(/hidden editorial/);
  });

  it('counts refused cells by reason instead of deleting them', () => {
    const rows = [
      decision({ id: 1, street: 'flop', facingAction: 'bet', isIP: 'ip', netBB: 3, pOursA: 0.4, pOursB: 0.8 }),
      decision({ id: 2, street: 'turn', facingAction: 'raise', isIP: 'oop', netBB: -3, pOursA: 0.4, pOursB: 0.2 }),
    ];
    const ledger = buildChangeLedger(rows, { ...ARMS, cellGate: { minClusters: 30, minDiscordant: 5 } });
    expect(ledger.cells.available).toBe(true);
    expect(ledger.cells.quotableCells).toBe(0);
    expect(ledger.cells.totalCells).toBe(2);
    expect(ledger.cells.refusedByCode[REFUSAL_CODES.BELOW_DISCORDANCE_BAR]).toBe(2);
  });

  it('refuses the bb/100-hands column when no opportunity census was supplied', () => {
    const rows = [decision({ id: 1, street: 'flop', facingAction: 'bet', isIP: 'ip', netBB: 3, pOursA: 0.4, pOursB: 0.8 })];
    const ledger = buildChangeLedger(rows, ARMS);
    expect(ledger.net.deltaBB100).toBeNull();
    expect(ledger.gross.deltaBB100).toBeNull();
    expect(ledger.scaling.unavailableReason).toMatch(/no opportunity census/);
  });

  it('carries BOTH factors when the census is supplied, never only the product', () => {
    const rows = [decision({ id: 1, street: 'flop', facingAction: 'bet', isIP: 'ip', netBB: 3, pOursA: 0.4, pOursB: 0.8 })];
    const ledger = buildChangeLedger(rows, { ...ARMS, opportunitiesPerHand: 0.5 });
    expect(ledger.scaling.opportunitiesPerHand).toBe(0.5);
    expect(ledger.net.deltaBB100).toBeCloseTo(ledger.net.deltaBB * 50, 3);
    expect(ledger.gross.deltaBB100).toBeCloseTo(ledger.gross.deltaBB * 50, 3);
  });
});

describe('netPublishProblems — the publish guard', () => {
  const rows = [
    decision({ id: 1, street: 'flop', facingAction: 'bet', isIP: 'ip', netBB: 4, pOursA: 0.4, pOursB: 0.9 }),
    decision({ id: 2, street: 'river', facingAction: 'bet', isIP: 'oop', netBB: -4, pOursA: 0.4, pOursB: 0.2 }),
  ];

  it('passes a NET that has a GROSS beside it', () => {
    const ledger = buildChangeLedger(rows, ARMS);
    expect(netPublishProblems(ledger, { netBB: ledger.net.deltaBB, field: 'depthDeltaBB' })).toEqual([]);
  });

  it('REFUSES a NET published with no ledger at all', () => {
    const problems = netPublishProblems(null, { netBB: -0.4711, field: 'depthDeltaBB' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/NET is never published without/);
  });

  it('REFUSES a NET whose ledger refused', () => {
    const refused = buildChangeLedger([], ARMS);
    const problems = netPublishProblems(refused, { netBB: -0.4711, field: 'depthDeltaBB' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/change ledger REFUSED/);
  });

  it('says nothing when there is no NET to publish', () => {
    expect(netPublishProblems(null, { netBB: null })).toEqual([]);
  });
});

describe('changeLedger — render', () => {
  it('prints GROSS on the same line as NET, and the ratio beside them', () => {
    const rows = [
      decision({ id: 1, street: 'flop', facingAction: 'bet', isIP: 'ip', netBB: 10, pOursA: 0.5, pOursB: 1 }),
      decision({ id: 2, street: 'flop', facingAction: 'bet', isIP: 'ip', netBB: -10, pOursA: 0.5, pOursB: 0 }),
      decision({ id: 3, street: 'river', facingAction: 'bet', isIP: 'oop', netBB: 10, pOursA: 0.5, pOursB: 0 }),
      decision({ id: 4, street: 'river', facingAction: 'bet', isIP: 'oop', netBB: -10.04, pOursA: 0.5, pOursB: 1 }),
    ];
    const out = renderChangeLedgerLines(buildChangeLedger(rows, ARMS)).join('\n');
    const netLine = out.split('\n').find((l) => l.includes('NET') && l.includes('GROSS'));
    expect(netLine).toBeTruthy();
    expect(netLine).toMatch(/GROSS\/\|NET\|/);
    expect(out).toMatch(/flop\|bet\|ip/);
    expect(out).toMatch(/river\|bet\|oop/);
  });

  it('says loudly when there is no ledger to render', () => {
    expect(renderChangeLedgerLines(null).join('\n')).toMatch(/NO CHANGE LEDGER/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// THE CARD BOUNDARY (WS-537, closing task).
//
// Everything above guards the ledger. These guard the ONE PLACE THE LEDGER HAS TO REACH: the
// Result Card. `netPublishProblems` stops a producer from minting a card when the ledger
// refused, and `renderChangeLedgerLines` keeps GROSS on the same line as NET on the page —
// but the Ladder and the fault-register matchers parse `metrics`, and until these fields
// existed a `depth-ablation` card shipped `depthDeltaBB` with no GROSS anywhere on it. A NET
// protected only in the renderer is protected in the one place nobody parses.
//
// The load-bearing assertions here are the two REJECTS cases. If either ever passes with an
// empty problem list, the card boundary has stopped enforcing the pair and every guard above
// is a convention again.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * A schema-conforming placeholder for one declared field. Built FROM the declaration rather
 * than hand-listed: a hand-listed fixture stops covering a variant the moment someone adds a
 * required field, and would then assert the rule against a shape the producer no longer emits.
 */
const declaredPlaceholder = (field, kind) => {
  if (field.name === 'kind') return kind;
  switch (field.type.split('|')[0].trim()) {
    case 'number': return 1;
    case 'string': return 'x';
    case 'boolean': return true;
    case 'array': return [];
    case 'object': return {};
    default: return null;
  }
};

/** A complete metrics block for a kind, with the ledger fields spread in as the producer does. */
const blockFor = (kind, ledger, headlineKey, headlineValue) => ({
  ...Object.fromEntries(
    SOR_SCHEMAS[METRICS_KINDS[kind]].map((f) => [f.name, declaredPlaceholder(f, kind)]),
  ),
  [headlineKey]: headlineValue,
  ...changeLedgerMetricsFields(ledger),
});

describe('changeLedger — the Result Card metrics block', () => {
  // Rows with real redistribution: the branches move in opposite directions, so GROSS is
  // materially larger than |NET| and the detector has something to detect.
  const rows = [
    decision({ id: 1, street: 'flop', facingAction: 'bet', isIP: 'ip', netBB: 6, pOursA: 0.4, pOursB: 0.95 }),
    decision({ id: 2, street: 'river', facingAction: 'bet', isIP: 'oop', netBB: -6, pOursA: 0.4, pOursB: 0.15 }),
    decision({ id: 3, street: 'turn', facingAction: 'check', isIP: 'ip', netBB: 1, pOursA: 0.5, pOursB: 0.6 }),
  ];

  it('publishes a hero-ev card whose NET has its GROSS beside it', () => {
    const ledger = buildChangeLedger(rows, ARMS);
    const block = blockFor('hero-ev', ledger, 'edgeBB', ledger.net.deltaBB);
    // The §3.3 headline is the same NET rescaled; with no census the ledger refuses the
    // bb/100 column, so the product is null here too and its pair is vacuously satisfied.
    block.overallEvBB100 = null;
    expect(metricsProblems(block)).toEqual([]);
  });

  it('publishes a depth-ablation card whose NET has its GROSS beside it', () => {
    const ledger = buildChangeLedger(rows, ARMS);
    const block = blockFor('depth-ablation', ledger, 'depthDeltaBB', ledger.net.deltaBB);
    expect(metricsProblems(block)).toEqual([]);
  });

  it('REJECTS a hero-ev card carrying a NET with no GROSS beside it', () => {
    const ledger = buildChangeLedger(rows, ARMS);
    const block = blockFor('hero-ev', ledger, 'edgeBB', ledger.net.deltaBB);
    block.overallEvBB100 = null;
    block.changeLedgerGrossBB = null; // the whole failure mode, in one line
    const problems = metricsProblems(block);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/edgeBB is a NET/);
    expect(problems[0]).toMatch(/changeLedgerGrossBB/);
    expect(problems[0]).toMatch(/opposite findings/);
  });

  it('REJECTS a depth-ablation card carrying a NET with no GROSS beside it', () => {
    const ledger = buildChangeLedger(rows, ARMS);
    const block = blockFor('depth-ablation', ledger, 'depthDeltaBB', ledger.net.deltaBB);
    delete block.changeLedgerGrossBB; // omitted entirely, not merely nulled
    const problems = metricsProblems(block);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/depthDeltaBB is a NET/);
  });

  it('REJECTS the rescaled headline without a GROSS on ITS OWN scale', () => {
    // The trap this closes: a card that satisfies the per-decision pair and then publishes
    // overallEvBB100 — the same NET times opportunitiesPerHand times 100 — with no companion
    // in bb/100 hands. Comparing a bb GROSS against a bb/100 NET is two scales on one axis,
    // which is the ADR-009 failure the pairing exists to prevent.
    const ledger = buildChangeLedger(rows, ARMS);
    const block = blockFor('hero-ev', ledger, 'edgeBB', ledger.net.deltaBB);
    block.overallEvBB100 = 2.4;
    block.opportunitiesPerHand = 1.2; // keeps overallEvFactorProblems silent
    block.changeLedgerGrossBB100 = null;
    const problems = metricsProblems(block);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/overallEvBB100 is a NET/);
    expect(problems[0]).toMatch(/changeLedgerGrossBB100/);
  });

  it('says nothing when the headline itself is null — an empty run still writes its artifact', () => {
    const block = blockFor('hero-ev', null, 'edgeBB', null);
    block.overallEvBB100 = null;
    expect(metricsProblems(block)).toEqual([]);
  });

  it('carries the ledger values UNCHANGED onto the card', () => {
    const ledger = buildChangeLedger(rows, ARMS);
    const fields = changeLedgerMetricsFields(ledger);
    expect(fields.changeLedgerNetBB).toBe(ledger.net.deltaBB);
    expect(fields.changeLedgerGrossBB).toBe(ledger.gross.deltaBB);
    expect(fields.changeLedgerNetBB100).toBe(ledger.net.deltaBB100);
    expect(fields.changeLedgerGrossBB100).toBe(ledger.gross.deltaBB100);
    expect(fields.changeLedgerRedistributionRatio).toBe(ledger.redistributionRatio);
    expect(fields.changeLedgerNetShareOfGross).toBe(ledger.netShareOfGross);
    expect(fields.changeLedgerBranchCount).toBe(ledger.partition.branchCount);
    expect(fields.changeLedgerKeyCompleteness).toEqual(ledger.partition.keyCompleteness);
    // The detector actually detects on this fixture — otherwise the equalities above would be
    // asserted on a run with nothing to redistribute and the test would pass forever.
    expect(fields.changeLedgerGrossBB).toBeGreaterThan(Math.abs(fields.changeLedgerNetBB));
    expect(fields.changeLedgerRedistributionRatio).toBeGreaterThan(1);
  });

  it('copies keyCompleteness rather than sharing it with the report object', () => {
    // A card is an artifact. If it shared structure with the live report, a later mutation of
    // the report would silently rewrite a published number.
    const ledger = buildChangeLedger(rows, ARMS);
    const fields = changeLedgerMetricsFields(ledger);
    expect(fields.changeLedgerKeyCompleteness).not.toBe(ledger.partition.keyCompleteness);
    expect(fields.changeLedgerKeyCompleteness.street).not.toBe(ledger.partition.keyCompleteness.street);
  });

  it('emits an explicit run of nulls for a refused ledger, never an omitted block', () => {
    // Omission is indistinguishable from a card minted before these fields existed; an
    // explicit null says the slot was there and could not be filled. The producer-side guard
    // is what stops that state from coexisting with a real headline.
    const fields = changeLedgerMetricsFields(buildChangeLedger([], ARMS));
    expect(Object.keys(fields)).toHaveLength(8);
    expect(Object.values(fields).every((v) => v === null)).toBe(true);
    expect(changeLedgerMetricsFields(null)).toEqual(fields);
  });

  it('carries the partition provenance a reader needs to size GROSS', () => {
    const ledger = buildChangeLedger(rows, ARMS);
    const fields = changeLedgerMetricsFields(ledger);
    expect(fields.changeLedgerBranchCount).toBe(3);
    expect(Object.keys(fields.changeLedgerKeyCompleteness)).toEqual(BRANCH_AXES);
    for (const axis of BRANCH_AXES) {
      expect(fields.changeLedgerKeyCompleteness[axis]).toEqual({ known: 3, unknown: 0 });
    }
  });

  it('reports an INCOMPLETE branch key on the card, so a small GROSS is readable', () => {
    // Rows missing `isIP` are pooled into one `unknown` bucket rather than dropped (the sum
    // identity forbids dropping them), and pooling can hide offsetting mass. The card has to
    // say so, or a reader cannot tell an honest small GROSS from a partition too blind to
    // find a large one.
    const blind = rows.map((r) => { const c = { ...r }; delete c.isIP; return c; });
    const fields = changeLedgerMetricsFields(buildChangeLedger(blind, ARMS));
    expect(fields.changeLedgerKeyCompleteness.isIP).toEqual({ known: 0, unknown: 3 });
    expect(fields.changeLedgerKeyCompleteness.street).toEqual({ known: 3, unknown: 0 });
  });
});

describe('changeLedger — the schema version bump that admitted these fields', () => {
  // WS-434 authoring rule: a new field arrives with `since` equal to the bumped version, and
  // the version is bumped in the same change. `check-additive.mjs` enforces it against the
  // committed baseline; this asserts the two variants this ticket touched, by name, so a
  // later edit cannot quietly re-home a field to an older version to dodge that gate.
  const LEDGER_KEYS = [
    'changeLedgerNetBB', 'changeLedgerGrossBB', 'changeLedgerNetBB100', 'changeLedgerGrossBB100',
    'changeLedgerRedistributionRatio', 'changeLedgerNetShareOfGross',
    'changeLedgerBranchCount', 'changeLedgerKeyCompleteness',
  ];

  it.each([
    ['metrics.hero-ev', 3],
    ['metrics.depth-ablation', 4],
  ])('%s is at version %i and its ledger fields all claim that version', (schema, version) => {
    expect(METRICS_SCHEMA_VERSIONS[schema]).toBe(version);
    const byName = new Map(SOR_SCHEMAS[schema].map((f) => [f.name, f]));
    for (const key of LEDGER_KEYS) {
      expect(byName.has(key), `${schema}.${key} is not declared`).toBe(true);
      expect(byName.get(key).since, `${schema}.${key}.since`).toBe(version);
      expect(byName.get(key).unit, `${schema}.${key}.unit`).toBeTruthy();
      expect(byName.get(key).note, `${schema}.${key}.note`).toBeTruthy();
    }
  });

  it('declares the NET to GROSS pairing the publish rule reads, rather than inferring it', () => {
    expect(METRICS_NET_GROSS_PAIRS['metrics.hero-ev']).toEqual([
      { net: 'edgeBB', gross: 'changeLedgerGrossBB' },
      { net: 'overallEvBB100', gross: 'changeLedgerGrossBB100' },
    ]);
    expect(METRICS_NET_GROSS_PAIRS['metrics.depth-ablation']).toEqual([
      { net: 'depthDeltaBB', gross: 'changeLedgerGrossBB' },
    ]);
  });

  it('every declared NET and GROSS in the pairing exists on its variant', () => {
    for (const [schema, pairs] of Object.entries(METRICS_NET_GROSS_PAIRS)) {
      const names = new Set(SOR_SCHEMAS[schema].map((f) => f.name));
      for (const { net, gross } of pairs) {
        expect(names.has(net), `${schema}.${net}`).toBe(true);
        expect(names.has(gross), `${schema}.${gross}`).toBe(true);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// END TO END, THROUGH THE REAL PRODUCER.
//
// Everything above tests the projection function and the card rule in isolation. This runs
// `buildDepthAblationReport` — the actual instrument — and asserts the MINTED CARD carries the
// same GROSS the report's ledger computed. The failure it guards is the cheap one: a producer
// that builds a ledger, prints it, and then forgets to spread it into `metrics`. That state
// passes every isolated test in this file and ships exactly the card WS-537 exists to stop.
// ═══════════════════════════════════════════════════════════════════════════════════════════

const e2eDecision = (playerId, handId, observedAction, netBB, d1, d2, street = 'flop') => ({
  playerId,
  handId,
  observedAction,
  netBB,
  netBBUnraked: netBB,
  piOurs: d2,
  piOursByArm: { depth1: d1, depth2: d2 },
  piPool: { call: 0.4, fold: 0.4, raise: 0.2 },
  slices: { street },
});

/** Enough players that the cluster bootstrap is defined; shape copied from depthAblation.test.js. */
const e2ePlayers = (n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d1 = { call: 0.6, fold: 0.4, raise: 0 };
    const d2 = { call: 0.3, fold: 0.4, raise: 0.3 };
    out.push(e2eDecision(`p${i}`, `h${i}`, 'call', (i % 7) - 3, d1, d2));
    out.push(e2eDecision(`p${i}`, `h${i}b`, 'fold', (i % 5) - 2, d1, d2, 'turn'));
  }
  return out;
};

const e2eRun = (decisions) => ({
  complete: true,
  decisionsScored: decisions.length,
  decisions,
  integrity: {
    poolPct: 50,
    behaviorPolicy: { partition: 'pool-train', poolPct: 50, observations: 12191, players: 400, hierarchy: [] },
  },
  counters: { checkpoints: 1, handsRead: 10, evalPlayers: 2, adapterSkips: {}, policySkips: {}, outcomeUnresolved: {} },
  config: {
    poolPct: 50,
    rakeConfig: null,
    rakeIsModelled: true,
    depthArms: [{ id: 'depth1', refinementBudgetMs: 0 }, { id: 'depth2', refinementBudgetMs: 2000 }],
    primaryArmId: 'depth2',
  },
  surfaceId: 'engine-read',
  fieldId: 'pool-mined-behavior-policy',
  runtimeMs: 1,
  dealBook: { dealBookId: 'handhq-allsites-50NLH-deadbeef' },
  replicationStamp: {
    engineCommit: 'a'.repeat(40),
    engineDirty: false,
    dealBookHash: `sha256:${'b'.repeat(64)}`,
    fieldVersion: 'behavior-policy@pool-train/12191obs',
    partition: 'pool-train@50',
    seeds: { clusterBootstrap: DEFAULT_BOOTSTRAP_SEED },
    unseededSources: [...DEPTH_ABLATION_UNSEEDED_SOURCES],
    constants: {
      PRIOR_WEIGHT: 10,
      ACTION_TAU_FRACTION: { check: 1 },
      MIN_CONTINUATION_WEIGHT: 0.05,
      REFINEMENT_BUDGET_MS: { depth1: 0, depth2: 2000 },
      MAX_STAGE_SHARE: 0.4,
      REFINEMENT_UNITS_PER_MS: 300,
      KL_FLOOR: 1e-6,
    },
    disclaimerRegisterVersion: 'FR-1+000000000000',
    knownDivergences: [],
  },
});

describe('changeLedger — the minted depth-ablation card carries the pair', () => {
  const report = buildDepthAblationReport(e2eRun(e2ePlayers(40)), { baseArm: 'depth1', testArm: 'depth2' });

  it('mints a card at all — the publish guard did not refuse this run', () => {
    expect(report.resultCardProblems).toEqual([]);
    expect(report.resultCard).not.toBeNull();
  });

  it('publishes GROSS beside the NET, both equal to the ledger the report computed', () => {
    const m = report.resultCard.metrics;
    expect(m.changeLedgerNetBB).toBe(report.changeLedger.net.deltaBB);
    expect(m.changeLedgerGrossBB).toBe(report.changeLedger.gross.deltaBB);
    expect(m.changeLedgerRedistributionRatio).toBe(report.changeLedger.redistributionRatio);
    expect(m.changeLedgerNetShareOfGross).toBe(report.changeLedger.netShareOfGross);
    expect(m.changeLedgerBranchCount).toBe(report.changeLedger.partition.branchCount);
    expect(m.changeLedgerKeyCompleteness).toEqual(report.changeLedger.partition.keyCompleteness);
  });

  it('publishes a NET equal to the headline it decomposes — the identity, on the card', () => {
    const m = report.resultCard.metrics;
    expect(m.changeLedgerNetBB).toBe(m.depthDeltaBB);
    expect(report.changeLedger.identity.agrees).toBe(true);
  });

  it('refuses the bb/100 column rather than inventing an opportunity count', () => {
    // No census on this fixture. NULL, not 0 — an absent census is not one opportunity per
    // hand, and deriving one from the scored subset is structurally forbidden.
    const m = report.resultCard.metrics;
    expect(m.changeLedgerNetBB100).toBeNull();
    expect(m.changeLedgerGrossBB100).toBeNull();
  });

  it('survives the wired publish path — resultCardProblems is clean on the minted card', () => {
    expect(resultCardProblems(report.resultCard)).toEqual([]);
  });
});
