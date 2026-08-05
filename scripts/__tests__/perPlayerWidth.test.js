/**
 * perPlayerWidth.test.js — WS-321 guards.
 *
 * Two families, and both exist because of a specific way this repo has been wrong before.
 *
 * 1. THE PARAMETER IS REACHABLE AND COMPOSES. `perceivedHeroRange` (WS-276) shipped correct
 *    and unreachable for months because no call site passed it, and `softWeights`' score-
 *    amplitude knob was inert because the scaling cancelled in the IQR. A width multiplier is
 *    exactly that shape of risk again, so these tests assert the parameter MOVES the output,
 *    that it moves it by COMPOSING with `ACTION_TAU_FRACTION` rather than replacing it, and
 *    that omitting it is bit-identical to the shipped engine.
 *
 * 2. THE ESTIMATOR SEPARATES "NO SIGNAL" FROM "TOO FEW REVEALED TO TELL". Collapsing the
 *    observed-zero into the never-looked is the failure §11.8 documents at length (chi2/df =
 *    1.005 at a median of 2 observations per player is a weak-power null, not proof of
 *    absence). The classifier is pinned in all four regimes, including the one where the same
 *    point estimate must classify differently depending only on how tightly it is pinned.
 *
 * Ranges come from the shared NAMED-HAND fixtures, never grid-index literals (WS-300).
 */

import { describe, test, expect } from 'vitest';

import {
  narrowByBoard, ACTION_TAU_FRACTION, DEFAULT_WIDTH_MULTIPLIER,
} from '../../src/utils/exploitEngine/postflopNarrower.js';
import { TAU_FRACTION, MIN_CONTINUATION_WEIGHT } from '../../src/utils/pokerCore/softWeights.js';
import {
  WIDTH_GRID, K_GRID,
  mkWidthStat, pushWidth, summarizeWidth,
  interpolatedArgmax, shrinkLogWidth, classifyPlayerSignal,
  playerActionComposition, evalSubgroup, orderHandsByTime, fitWidthsAtK, tQuantile95,
  perPlayerWidthVerdict, PER_PLAYER_WIDTH_VERDICTS,
} from '../backtest/rangeCalibrationProbe.mjs';
import { parseAndEncode } from '../../src/utils/pokerCore/cardParser.js';
import { fullRange } from '../../src/utils/exploitEngine/__tests__/fixtures/ranges.js';

const cards = (...strs) => strs.map(parseAndEncode);
const FLOP = cards('A♠', '7♥', '2♦');

const spread = (r) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < r.length; i++) {
    if (r[i] <= 0) continue;
    if (r[i] < lo) lo = r[i];
    if (r[i] > hi) hi = r[i];
  }
  return hi - lo;
};

const identical = (a, b) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

// ─── 1. the width parameter is reachable, composes, and is inert at 1.0 ────────────────────

describe('widthMultiplier — the parameter WS-321 adds to narrowByBoard', () => {
  test('omitting it is BIT-IDENTICAL to passing 1.0 — the shipped engine does not move', () => {
    for (const action of ['raise', 'call', 'check', 'bet']) {
      const shipped = narrowByBoard(fullRange(), action, FLOP, []);
      const explicit = narrowByBoard(fullRange(), action, FLOP, [], { widthMultiplier: 1 });
      expect(identical(shipped, explicit), `${action} moved at widthMultiplier=1`).toBe(true);
    }
    expect(DEFAULT_WIDTH_MULTIPLIER).toBe(1);
  });

  test('a larger multiplier FLATTENS the range — this is the knob doing work, not being ignored', () => {
    // The shipped-but-inert failure mode in its purest form: if `widthMultiplier` were
    // dropped on the floor, these two ranges would be identical and this assertion is the
    // only thing standing between that and a published per-player width.
    for (const action of ['raise', 'call', 'bet']) {
      const sharp = narrowByBoard(fullRange(), action, FLOP, [], { widthMultiplier: 1 });
      const wide = narrowByBoard(fullRange(), action, FLOP, [], { widthMultiplier: 16 });
      expect(identical(sharp, wide), `${action}: widthMultiplier had NO effect`).toBe(false);
      expect(spread(wide), `${action}: a wider width must flatten, not sharpen`)
        .toBeLessThan(spread(sharp));
    }
  });

  test('it COMPOSES with ACTION_TAU_FRACTION rather than overriding it', () => {
    // The whole answer to the ticket's decision_flag. A per-player OVERRIDE would hand the
    // check branch the raise branch's sharpness; a MULTIPLIER scales each action's own
    // measured softness, so the ratio between actions is preserved exactly.
    const m = 4;
    for (const action of ['raise', 'call', 'check', 'bet']) {
      const viaMultiplier = narrowByBoard(fullRange(), action, FLOP, [], { widthMultiplier: m });
      const viaEquivalentTau = narrowByBoard(fullRange(), action, FLOP, [], {
        tauFraction: ACTION_TAU_FRACTION[action] * m,
      });
      expect(identical(viaMultiplier, viaEquivalentTau), `${action} does not compose`).toBe(true);
    }
    // ...and the actions are genuinely different, so the equality above is not vacuous.
    expect(ACTION_TAU_FRACTION.check).not.toBe(ACTION_TAU_FRACTION.raise);
  });

  test('an explicit tauFraction still wins, and the multiplier scales THAT', () => {
    const a = narrowByBoard(fullRange(), 'check', FLOP, [], { tauFraction: 0.5, widthMultiplier: 2 });
    const b = narrowByBoard(fullRange(), 'check', FLOP, [], { tauFraction: 1.0 });
    expect(identical(a, b)).toBe(true);
  });

  test('a zero or negative multiplier falls back to 1.0 — WS-366 must not return by a new door', () => {
    // tau = 0 collapses the logistic into a step. That is precisely the defect WS-366 undid
    // preflop, and a per-player fit that ever produced 0 would reintroduce it postflop.
    const shipped = narrowByBoard(fullRange(), 'call', FLOP, []);
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const got = narrowByBoard(fullRange(), 'call', FLOP, [], { widthMultiplier: bad });
      expect(identical(shipped, got), `widthMultiplier=${bad} was not rejected`).toBe(true);
    }
  });

  test('softWeights is UNTOUCHED — the postflop IQR assumption WS-366 relied on still holds', () => {
    // WS-366 fixed the preflop caller through `tauFraction` precisely so this module stayed
    // bit-identical. WS-321 delivers its parameter the same way, so these must not have moved.
    expect(TAU_FRACTION).toBe(0.3);
    expect(MIN_CONTINUATION_WEIGHT).toBe(0.05);
    expect(ACTION_TAU_FRACTION).toEqual({
      check: 1.0, bet: 0.3, call: 0.3, raise: 0.3,
    });
  });
});

// ─── 2. the sweep grid ────────────────────────────────────────────────────────────────────

describe('WIDTH_GRID', () => {
  test('contains 1.0 — without the control arm there is nothing to compare against', () => {
    expect(WIDTH_GRID).toContain(1);
  });

  test('is ascending and log-spaced, so nearest-in-log is a meaningful snap', () => {
    for (let i = 1; i < WIDTH_GRID.length; i++) {
      expect(WIDTH_GRID[i]).toBeGreaterThan(WIDTH_GRID[i - 1]);
      expect(WIDTH_GRID[i] / WIDTH_GRID[i - 1]).toBeCloseTo(2, 10);
    }
  });

  test('K_GRID carries the pure-population control as an ARM, not as an argument', () => {
    expect(K_GRID).toContain(Infinity);
    expect(K_GRID).toContain(0);
  });
});

// ─── 3. paired accumulation ───────────────────────────────────────────────────────────────

describe('pushWidth / summarizeWidth — paired, because every arm sees the same decisions', () => {
  test('the reference arm has exactly zero mean difference and zero SE', () => {
    const s = mkWidthStat(3);
    pushWidth(s, [0.1, 0.5, -0.2], 1);
    pushWidth(s, [0.3, 0.9, 0.4], 1);
    const out = summarizeWidth(s);
    expect(out.n).toBe(2);
    expect(out.meanD[1]).toBe(0);
    expect(out.se[1]).toBe(0);
  });

  test('deltaLog is the published per-arm mean and meanD is its paired contrast', () => {
    const s = mkWidthStat(2);
    pushWidth(s, [1, 3], 0);
    pushWidth(s, [2, 5], 0);
    const out = summarizeWidth(s);
    expect(out.deltaLog[0]).toBeCloseTo(1.5, 12);
    expect(out.deltaLog[1]).toBeCloseTo(4.0, 12);
    expect(out.meanD[1]).toBeCloseTo(2.5, 12);
  });

  test('the paired SE is TIGHTER than the unpaired one when arms move together', () => {
    // Two arms that differ by a near-constant offset but whose LEVELS vary a lot. An
    // unpaired comparison would drown in the level variance; the paired one sees the offset.
    const s = mkWidthStat(2);
    for (const base of [-5, 0, 5, 10, -8, 3]) pushWidth(s, [base, base + 0.5], 0);
    const out = summarizeWidth(s);
    expect(out.meanD[1]).toBeCloseTo(0.5, 12);
    expect(out.se[1]).toBeLessThan(1e-9);
  });

  test('n = 1 yields a NULL standard error, never 0', () => {
    const s = mkWidthStat(2);
    pushWidth(s, [1, 2], 0);
    expect(summarizeWidth(s).se[1]).toBeNull();
  });
});

// ─── 4. the argmax ────────────────────────────────────────────────────────────────────────

describe('interpolatedArgmax', () => {
  const logGrid = WIDTH_GRID.map(Math.log);

  test('an interior peak is interpolated OFF the grid point', () => {
    // A parabola whose true vertex sits between two grid points.
    const values = logGrid.map((x) => -((x - (logGrid[2] + 0.4)) ** 2));
    const got = interpolatedArgmax(logGrid, values);
    expect(got.interpolated).toBe(true);
    expect(got.logWidth).toBeGreaterThan(logGrid[2]);
    expect(got.logWidth).toBeLessThan(logGrid[3]);
  });

  test('an EDGE optimum is reported at the edge, never extrapolated past the grid', () => {
    const rising = logGrid.map((_, i) => i);
    const got = interpolatedArgmax(logGrid, rising);
    expect(got.interpolated).toBe(false);
    expect(got.logWidth).toBe(logGrid[logGrid.length - 1]);
  });

  test('a perfectly FLAT curve does not invent a width', () => {
    const flat = logGrid.map(() => 0.42);
    const got = interpolatedArgmax(logGrid, flat);
    expect(got.interpolated).toBe(false);
    expect(logGrid).toContain(got.logWidth);
  });
});

// ─── 5. shrinkage, and the absence of a threshold gate ────────────────────────────────────

describe('shrinkLogWidth — §11.5 shrinkage, not a minimum-N gate', () => {
  const pop = Math.log(1);
  const raw = Math.log(8);

  test('n = 0 lands EXACTLY on the population value', () => {
    expect(shrinkLogWidth({ rawLogWidth: raw, populationLogWidth: pop, n: 0, k: 10 }).logWidth)
      .toBe(pop);
  });

  test('it is CONTINUOUS in n — no sample size switches the player value on', () => {
    // The gate this forbids would show as a jump between adjacent n. Measure every step.
    let prev = shrinkLogWidth({ rawLogWidth: raw, populationLogWidth: pop, n: 0, k: 10 }).logWidth;
    let maxJump = 0;
    for (let n = 1; n <= 200; n++) {
      const cur = shrinkLogWidth({ rawLogWidth: raw, populationLogWidth: pop, n, k: 10 }).logWidth;
      maxJump = Math.max(maxJump, Math.abs(cur - prev));
      expect(cur, `estimate moved AWAY from raw at n=${n}`).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
    // The largest single-step move is the first one, k/(k+1) of nothing — tiny against the
    // full population-to-raw distance. A gate would produce a step of the FULL distance.
    expect(maxJump).toBeLessThan(0.1 * Math.abs(raw - pop));
  });

  test('k = Infinity is the pure-population control at any n', () => {
    const got = shrinkLogWidth({ rawLogWidth: raw, populationLogWidth: pop, n: 10000, k: Infinity });
    expect(got.logWidth).toBe(pop);
    expect(got.weight).toBe(0);
  });

  test('k = 0 is the unshrunk per-player fit', () => {
    const got = shrinkLogWidth({ rawLogWidth: raw, populationLogWidth: pop, n: 3, k: 0 });
    expect(got.logWidth).toBe(raw);
    expect(got.weight).toBe(1);
  });

  test('a player with NO raw estimate stays on population rather than getting a made-up one', () => {
    expect(shrinkLogWidth({ rawLogWidth: undefined, populationLogWidth: pop, n: 50, k: 10 }).logWidth)
      .toBe(pop);
  });
});

// ─── 6. THE SEPARATION — observed zero vs never looked ────────────────────────────────────

describe('classifyPlayerSignal — "no signal" and "too few to tell" are different findings', () => {
  const POP = 0.5; // the population buys 0.5 nats from narrowing

  test('a large effect against small noise is SIGNAL', () => {
    const got = classifyPlayerSignal({ signal: 0.6, se: 0.05, populationSignal: POP });
    expect(got.class).toBe('signal');
  });

  test('a measurably NEGATIVE effect is its own class, not folded into "no signal"', () => {
    // The founder's mechanism: equity-shaped narrowing is worse than not narrowing for this
    // player. Reporting that as "no signal" would delete the finding the ticket is about.
    const got = classifyPlayerSignal({ signal: -0.6, se: 0.05, populationSignal: POP });
    expect(got.class).toBe('negative-signal');
  });

  test('THE LOAD-BEARING CASE: the SAME zero estimate classifies differently by POWER', () => {
    // Identical point estimate. Different resolution. This is the observed-zero versus the
    // never-looked, and everything in this ticket turns on the two not being the same row.
    const tight = classifyPlayerSignal({ signal: 0.0, se: 0.05, populationSignal: POP });
    const loose = classifyPlayerSignal({ signal: 0.0, se: 0.90, populationSignal: POP });
    expect(tight.class).toBe('no-signal');
    expect(loose.class).toBe('underpowered');
    expect(tight.resolvable).toBe(true);
    expect(loose.resolvable).toBe(false);
    // and the boundary is the population effect size, not a hand-picked n
    expect(tight.mde).toBeLessThanOrEqual(POP);
    expect(loose.mde).toBeGreaterThan(POP);
  });

  test('a player with no standard error at all is UNDERPOWERED, never "no signal"', () => {
    for (const se of [null, undefined, 0, Number.NaN]) {
      expect(classifyPlayerSignal({ signal: 0, se, populationSignal: POP }).class)
        .toBe('underpowered');
    }
  });

  test('SMALL SAMPLES get a Student-t interval, not a normal one', () => {
    // The median player here has single-digit revealed decisions. At df = 2 the correct
    // multiplier is 4.303 against the normal's 1.960, so using z would call a 3-decision
    // player's noise a finding — hardest exactly where the data is thinnest.
    expect(tQuantile95(1)).toBeCloseTo(12.706, 3);
    expect(tQuantile95(2)).toBeCloseTo(4.303, 3);
    expect(tQuantile95(9)).toBeCloseTo(2.262, 3);
    expect(tQuantile95(5000)).toBeCloseTo(1.96, 2);
  });

  test('the SAME estimate is a finding at large n and unresolvable at n = 3', () => {
    // Identical point estimate and identical standard error. Only the degrees of freedom
    // differ, and that alone must decide whether this player is reportable.
    const args = { signal: 0.30, se: 0.13, populationSignal: POP };
    expect(classifyPlayerSignal({ ...args, n: 500 }).class).toBe('signal');
    // n = 3 -> df = 2 -> t = 4.303 -> mde = 0.559, wider than the population effect itself.
    const thin = classifyPlayerSignal({ ...args, n: 3 });
    expect(thin.class).toBe('underpowered');
    expect(thin.mde).toBeGreaterThan(POP);
    // The normal quantile would have called this one a finding. That is the bug avoided.
    expect(classifyPlayerSignal({ ...args, z: 1.959963985 }).class).toBe('signal');
  });

  test('n = 1 cannot be classified at all — the t quantile is infinite', () => {
    expect(tQuantile95(0)).toBe(Infinity);
    expect(classifyPlayerSignal({ signal: 5, se: 0.001, n: 1, populationSignal: POP }).class)
      .toBe('underpowered');
  });

  test('every classification carries the numbers that produced it', () => {
    const got = classifyPlayerSignal({ signal: 0.1, se: 0.2, populationSignal: POP });
    expect(got).toHaveProperty('mde');
    expect(got).toHaveProperty('se');
    expect(got).toHaveProperty('resolvable');
    expect(got.reason.length).toBeGreaterThan(20);
  });
});

// ─── 7. per-player selection accounting ───────────────────────────────────────────────────

describe('playerActionComposition — the inverse conditional, per player', () => {
  test('fold reveals at zero and is reported, not omitted', () => {
    const got = playerActionComposition(
      { bet: 6, check: 4 },
      { bet: 20, check: 20, fold: 60 },
    );
    expect(got.fold.revealed).toBe(0);
    expect(got.fold.revealRate).toBe(0);
    expect(got.fold.selectionRatio).toBe(0);
  });

  test('an over-represented action gets selectionRatio > 1', () => {
    const got = playerActionComposition({ raise: 8, check: 2 }, { raise: 10, check: 90 });
    expect(got.raise.selectionRatio).toBeGreaterThan(1);
    expect(got.check.selectionRatio).toBeLessThan(1);
    expect(got.raise.shareOfRevealed).toBeCloseTo(0.8, 12);
    expect(got.raise.shareOfScoreable).toBeCloseTo(0.1, 12);
  });
});

// ─── 8. splits ────────────────────────────────────────────────────────────────────────────

describe('splits are structural, not conventional', () => {
  test('evalSubgroup is deterministic and independent of the POOL/EVAL salt', () => {
    const a = evalSubgroup('player-abc');
    expect(evalSubgroup('player-abc')).toBe(a);
    const groups = new Set();
    for (let i = 0; i < 400; i++) groups.add(evalSubgroup(`p${i}`));
    expect(groups).toEqual(new Set(['calib', 'heldout']));
  });

  test('orderHandsByTime sorts by handId within a site, and by site first', () => {
    const h = (site, handId) => ({ handId, _backtest: { site } });
    const got = orderHandsByTime([h('PS', 5), h('FTP', 9), h('FTP', 2), h('PS', 1)]);
    expect(got.map((x) => `${x._backtest.site}${x.handId}`))
      .toEqual(['FTP2', 'FTP9', 'PS1', 'PS5']);
  });

  test('orderHandsByTime puts id-less hands LAST rather than interleaving them silently', () => {
    const h = (handId) => ({ handId, _backtest: { site: 'FTP' } });
    const got = orderHandsByTime([h(null), h(3), h(1)]);
    expect(got.map((x) => x.handId)).toEqual([1, 3, null]);
  });

  test('the corpus read order this replaces really is NOT temporal', () => {
    // Files are discovered lexicographically: 1, 10, 100, 1000. Their handId ranges are
    // disjoint and ascending in file NUMBER, so read order interleaves time. This asserts the
    // defect the sort exists to fix, so the sort cannot be removed as "obviously redundant".
    const lexicographic = ['1', '10', '100', '1000'].sort();
    expect(lexicographic).toEqual(['1', '10', '100', '1000']);
    expect(lexicographic.map(Number)).not.toEqual([1, 2, 3, 4]);
  });
});

// ─── 9. the fit, and the verdict ──────────────────────────────────────────────────────────

describe('fitWidthsAtK', () => {
  const logGrid = WIDTH_GRID.map(Math.log);
  const mkPlayer = (playerId, nTrain, argmaxIdx, testMeanD) => ({
    playerId,
    subgroup: 'heldout',
    train: { n: nTrain },
    test: { n: 10, meanD: testMeanD, se: testMeanD.map(() => 0.01) },
    trainArgmax: { logWidth: logGrid[argmaxIdx], argmaxIdx, interpolated: false },
  });

  test('at k = Infinity every player snaps to the population arm and the diff is exactly 0', () => {
    const popIdx = WIDTH_GRID.indexOf(1);
    const zero = WIDTH_GRID.map((_, g) => (g === popIdx ? 0 : 0.3));
    const fit = fitWidthsAtK({
      perPlayer: [mkPlayer('a', 40, 6, zero), mkPlayer('b', 40, 0, zero)],
      populationLogWidth: Math.log(1), logGrid, k: Infinity,
    });
    for (const row of fit.players) expect(row.snappedWidth).toBe(1);
    expect(fit.meanDiffPerDecision).toBe(0);
  });

  test('at k = 0 a player with a strong raw estimate is allowed all the way there', () => {
    const gains = WIDTH_GRID.map((_, g) => (g === 6 ? 0.4 : 0));
    const fit = fitWidthsAtK({
      perPlayer: [mkPlayer('a', 40, 6, gains)],
      populationLogWidth: Math.log(1), logGrid, k: 0,
    });
    expect(fit.players[0].snappedIdx).toBe(6);
    expect(fit.meanDiffPerDecision).toBeCloseTo(0.4, 12);
  });

  test('every row carries its n — a width without one is not reportable', () => {
    const fit = fitWidthsAtK({
      perPlayer: [mkPlayer('a', 7, 5, WIDTH_GRID.map(() => 0))],
      populationLogWidth: Math.log(1), logGrid, k: 10,
    });
    expect(fit.players[0]).toHaveProperty('nTrain', 7);
    expect(fit.players[0]).toHaveProperty('nTest', 10);
    expect(fit.players[0]).toHaveProperty('shrinkWeight');
    expect(fit.players[0].shrinkWeight).toBeCloseTo(7 / 17, 12);
  });
});

describe('perPlayerWidthVerdict — a null is a RESULT, and must be sayable', () => {
  test('an interval clear of zero on the high side BEATS', () => {
    const got = perPlayerWidthVerdict({ heldout: { meanDiffPerDecision: 0.10, se: 0.01 } });
    expect(got.verdict).toBe(PER_PLAYER_WIDTH_VERDICTS.BEATS);
  });

  test('an interval clear of zero on the low side is a measured NULL, not "unresolved"', () => {
    const got = perPlayerWidthVerdict({ heldout: { meanDiffPerDecision: -0.10, se: 0.01 } });
    expect(got.verdict).toBe(PER_PLAYER_WIDTH_VERDICTS.NULL);
  });

  test('an interval spanning zero is UNRESOLVED — distinct from a measured null', () => {
    const got = perPlayerWidthVerdict({ heldout: { meanDiffPerDecision: 0.001, se: 0.05 } });
    expect(got.verdict).toBe(PER_PLAYER_WIDTH_VERDICTS.UNRESOLVED);
    expect(got.ci[0]).toBeLessThan(0);
    expect(got.ci[1]).toBeGreaterThan(0);
  });

  test('no standard error means UNRESOLVED, never a verdict', () => {
    expect(perPlayerWidthVerdict({ heldout: { meanDiffPerDecision: 0.5, se: null } }).verdict)
      .toBe(PER_PLAYER_WIDTH_VERDICTS.UNRESOLVED);
  });

  test('a DEGENERATE shrunk arm falls through to the unshrunk one, and says which it used', () => {
    // If k is selected at Infinity every player snaps back to population and the shrunk
    // difference is identically 0 with no variance. Reporting that as "the two are equal"
    // would hide a measured loss behind a shrinkage constant that had already decided to
    // ignore it — the question would look answered when it had only been declined.
    const got = perPlayerWidthVerdict({
      heldout: {
        meanDiffPerDecision: 0,
        se: null,
        unshrunk: { meanDiffPerDecision: -0.04, se: 0.008 },
      },
    });
    expect(got.arm).toBe('unshrunk (k = 0)');
    expect(got.verdict).toBe(PER_PLAYER_WIDTH_VERDICTS.NULL);
    expect(got.diff).toBeCloseTo(-0.04, 12);
  });

  test('a non-degenerate shrunk arm is used as-is and is labelled as such', () => {
    const got = perPlayerWidthVerdict({
      heldout: {
        meanDiffPerDecision: 0.05, se: 0.01,
        unshrunk: { meanDiffPerDecision: -0.9, se: 0.01 },
      },
    });
    expect(got.arm).toBe('shrunk (chosen k)');
    expect(got.verdict).toBe(PER_PLAYER_WIDTH_VERDICTS.BEATS);
  });
});
