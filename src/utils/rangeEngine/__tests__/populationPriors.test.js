import { describe, it, expect } from 'vitest';
import {
  getPopulationPrior,
  NO_RAISE_FREQUENCIES,
  FACED_RAISE_FREQUENCIES,
  NO_RAISE_ACTIONS,
  FACED_RAISE_ACTIONS,
  NO_RAISE_SUBCLASSES,
  FACED_RAISE_SUBCLASSES,
  SUBCLASS_SPLIT,
  THREE_BET_TOP_FRACTION,
} from '../populationPriors';
import { RANGE_POSITIONS } from '../rangeProfile';
import {
  rangeIndex, rangeWidth, decodeIndex, averageCharts, PREFLOP_CHARTS,
} from '../../pokerCore/rangeMatrix';
import { HAND_LABELS } from '../../pokerCore/preflopEquityTable';

const GRID_SIZE = 169;

/** Combo-weighted mean — the quantity `withEquitySupport` pins. `rangeWidth` rounds to
 *  whole percent, which cannot resolve a 2.5%-wide grid. */
const comboWidth = (grid) => {
  let s = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    const { isPair, suited } = decodeIndex(i);
    s += grid[i] * (isPair ? 6 : suited ? 4 : 12);
  }
  return s / 1326;
};

describe('populationPriors', () => {
  describe('frequency tables', () => {
    it('no-raise frequencies sum to 1.0 per position', () => {
      for (const pos of RANGE_POSITIONS) {
        const freqs = NO_RAISE_FREQUENCIES[pos];
        const sum = NO_RAISE_ACTIONS.reduce((s, a) => s + freqs[a], 0);
        // BB is all zeros (check, not voluntary)
        if (pos === 'BB') {
          expect(sum).toBe(0);
        } else {
          expect(sum).toBeCloseTo(1.0, 5);
        }
      }
    });

    it('faced-raise frequencies sum to 1.0 per position', () => {
      for (const pos of RANGE_POSITIONS) {
        const freqs = FACED_RAISE_FREQUENCIES[pos];
        const sum = FACED_RAISE_ACTIONS.reduce((s, a) => s + freqs[a], 0);
        expect(sum).toBeCloseTo(1.0, 5);
      }
    });

    it('covers all 5 positions', () => {
      for (const pos of RANGE_POSITIONS) {
        expect(NO_RAISE_FREQUENCIES[pos]).toBeDefined();
        expect(FACED_RAISE_FREQUENCIES[pos]).toBeDefined();
      }
    });
  });

  describe('getPopulationPrior', () => {
    it('returns Float64Array of length 169', () => {
      const prior = getPopulationPrior('EARLY', 'open');
      expect(prior).toBeInstanceOf(Float64Array);
      expect(prior.length).toBe(GRID_SIZE);
    });

    it('values are in [0, 1]', () => {
      for (const pos of RANGE_POSITIONS) {
        for (const action of [...NO_RAISE_ACTIONS, ...FACED_RAISE_ACTIONS]) {
          const prior = getPopulationPrior(pos, action);
          for (let i = 0; i < GRID_SIZE; i++) {
            expect(prior[i]).toBeGreaterThanOrEqual(0);
            expect(prior[i]).toBeLessThanOrEqual(1.0);
          }
        }
      }
    });

    it('returns a copy (safe to mutate)', () => {
      const a = getPopulationPrior('LATE', 'open');
      const b = getPopulationPrior('LATE', 'open');
      a[0] = 999;
      expect(b[0]).not.toBe(999);
    });

    it('open prior is heavy on premiums', () => {
      const prior = getPopulationPrior('EARLY', 'open');
      const aaIdx = rangeIndex(12, 12, false); // AA
      const kkIdx = rangeIndex(11, 11, false); // KK
      const _72oIdx = rangeIndex(5, 0, false); // 72o
      expect(prior[aaIdx]).toBeGreaterThan(prior[_72oIdx]);
      expect(prior[kkIdx]).toBeGreaterThan(prior[_72oIdx]);
    });

    it('limp prior is on speculative hands, not premiums', () => {
      const prior = getPopulationPrior('LATE', 'limp');
      // Speculative hands should have weight
      const _55idx = rangeIndex(3, 3, false); // 55
      expect(prior[_55idx]).toBeGreaterThan(0);
    });

    it('BB limp prior is all zeros (BB checks, does not limp)', () => {
      const prior = getPopulationPrior('BB', 'limp');
      let sum = 0;
      for (let i = 0; i < GRID_SIZE; i++) sum += prior[i];
      expect(sum).toBe(0);
    });

    it('fold prior weights weakest hands highest', () => {
      const prior = getPopulationPrior('EARLY', 'fold');
      const aaIdx = rangeIndex(12, 12, false);
      const _72oIdx = rangeIndex(5, 0, false);
      expect(prior[_72oIdx]).toBeGreaterThan(prior[aaIdx]);
    });

    it('threeBet prior concentrates on strongest hands', () => {
      const prior = getPopulationPrior('EARLY', 'threeBet');
      const aaIdx = rangeIndex(12, 12, false);
      const _54sIdx = rangeIndex(3, 2, true);
      expect(prior[aaIdx]).toBeGreaterThan(prior[_54sIdx]);
    });
  });
});

// ---------------------------------------------------------------------------
// Derived subclass split (WS-256 / DEC-025, POKER_THEORY §2.5.3)
// ---------------------------------------------------------------------------

describe('SUBCLASS_SPLIT', () => {
  it('each position sums to 1.0 within a parent', () => {
    for (const [parent, byPosition] of Object.entries(SUBCLASS_SPLIT)) {
      for (const pos of RANGE_POSITIONS) {
        const fractions = Object.values(byPosition[pos]);
        const total = fractions.reduce((a, b) => a + b, 0);
        expect(total, `${parent}.${pos}`).toBeCloseTo(1.0, 10);
      }
    }
  });

  it('covers every position for both parents', () => {
    for (const parent of ['open', 'threeBet']) {
      for (const pos of RANGE_POSITIONS) {
        expect(SUBCLASS_SPLIT[parent][pos], `${parent}.${pos}`).toBeDefined();
      }
    }
  });

  it('names exactly the subclasses of the parent it splits', () => {
    expect(Object.keys(SUBCLASS_SPLIT.open.LATE).sort()).toEqual([...NO_RAISE_SUBCLASSES].sort());
    expect(Object.keys(SUBCLASS_SPLIT.threeBet.LATE).sort()).toEqual([...FACED_RAISE_SUBCLASSES].sort());
  });

  it('holds every fraction in [0, 1]', () => {
    for (const byPosition of Object.values(SUBCLASS_SPLIT)) {
      for (const pos of RANGE_POSITIONS) {
        for (const f of Object.values(byPosition[pos])) {
          expect(f).toBeGreaterThanOrEqual(0);
          expect(f).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('gives BB a zero limp-reraise share — BB cannot limp (CLAUDE.md §5)', () => {
    expect(SUBCLASS_SPLIT.threeBet.BB.limpReraise).toBe(0);
  });

  it('raises the squeeze and iso-raise shares as position gets later', () => {
    // Both require someone already in front of you, so later position means
    // more opportunity — derived from who acts when, not from the label.
    expect(SUBCLASS_SPLIT.threeBet.LATE.squeeze).toBeGreaterThan(SUBCLASS_SPLIT.threeBet.EARLY.squeeze);
    expect(SUBCLASS_SPLIT.open.LATE.isoRaise).toBeGreaterThan(SUBCLASS_SPLIT.open.EARLY.isoRaise);
  });

  it('lowers the limp-reraise share as position gets later', () => {
    // It requires having limped first, and limping is an early/middle habit.
    expect(SUBCLASS_SPLIT.threeBet.LATE.limpReraise).toBeLessThan(SUBCLASS_SPLIT.threeBet.EARLY.limpReraise);
  });
});

// =============================================================================
// SUPPORT EVERYWHERE (WS-302)
// =============================================================================

describe('prior support (WS-302)', () => {
  // Every prior grid the engine can build, so a new `case` in buildActionPrior that
  // forgets the guarantee fails here rather than in production.
  const ALL_ACTIONS = [
    ...NO_RAISE_ACTIONS, ...FACED_RAISE_ACTIONS,
    ...NO_RAISE_SUBCLASSES, ...FACED_RAISE_SUBCLASSES,
  ].filter((a, i, xs) => xs.indexOf(a) === i);

  // A grid that is IDENTICALLY zero describes a scenario that cannot occur, not a range
  // with holes. BB has no voluntary no-raise action, so it cannot limp (CLAUDE.md §5 —
  // "do not attempt to 'fix' it").
  //
  // BB `limpReraise` is deliberately NOT in this set. Its grid is a SHAPE, and the shape
  // is non-zero; what makes the BB subclass empty is `SUBCLASS_SPLIT.threeBet.BB
  // .limpReraise = 0`, applied downstream in `updateSubclassRanges`. Two different
  // mechanisms, and only the one that zeroes the grid itself belongs here.
  const STRUCTURAL = new Set(['BB_limp']);
  const each = (fn) => {
    for (const pos of RANGE_POSITIONS) {
      for (const action of ALL_ACTIONS) fn(pos, action, STRUCTURAL.has(`${pos}_${action}`));
    }
  };

  it('assigns no live cell exactly zero', () => {
    each((pos, action, structural) => {
      const prior = getPopulationPrior(pos, action);
      let nonZero = 0;
      for (let i = 0; i < GRID_SIZE; i++) if (prior[i] > 0) nonZero++;
      // A zero here is a claim that the villain CANNOT hold that hand, and
      // `bayesianUpdater` multiplies the prior, so no evidence could ever lift it.
      expect(nonZero, `${pos} ${action}`).toBe(structural ? 0 : GRID_SIZE);
    });
  });

  it('preserves range width exactly — support fills holes, it does not widen', () => {
    each((pos, action) => {
      const before = getPopulationPrior(pos, action, { supportLambda: 0 });
      const after = getPopulationPrior(pos, action);
      expect(rangeWidth(after), `${pos} ${action}`).toBe(rangeWidth(before));
    });
  });

  it('leaves the structurally impossible grid identically zero', () => {
    // Support fills holes in a range. It must not invent a range for a scenario that
    // cannot happen — BB is never facing "no raise" voluntarily, so it never limps.
    for (const key of STRUCTURAL) {
      const [pos, action] = key.split('_');
      const prior = getPopulationPrior(pos, action);
      expect(Array.from(prior).reduce((s, v) => s + v, 0), key).toBe(0);
    }
  });

  it('pins the lambda = 0 doctrine grid — the sweep control arm', () => {
    // The control arm of the sweep. If this drifts, the sweep's lambda = 0 column stops
    // being a baseline and the whole comparison is unanchored.
    //
    // RE-ANCHORED AT WS-304, and the drift is the point of that ticket rather than an
    // accident. The anchor also CHANGED KIND, from a cell count to a width, because the
    // open branch's foot is now solved rather than asserted: the count is an incidental
    // output of that solve, the width is what the solve targets.
    //
    // Previously {EARLY 106, MIDDLE 108, LATE 119, SB 111, BB 116} cells for `open` and 5
    // for EARLY `threeBet`.
    const chart = {
      EARLY: averageCharts('UTG', 'UTG+1'),
      MIDDLE: averageCharts('MP1', 'MP2'),
      LATE: averageCharts('HJ', 'CO', 'BTN'),
      SB: PREFLOP_CHARTS.SB,
      BB: PREFLOP_CHARTS.BB,
    };
    for (const pos of RANGE_POSITIONS) {
      const off = getPopulationPrior(pos, 'open', { supportLambda: 0 });
      // "Widen GTO charts ~20% for live 1/2" — the branch's own comment, now enforced.
      expect(comboWidth(off) / comboWidth(chart[pos]), pos).toBeCloseTo(1.20, 2);
    }
    expect(
      Array.from(getPopulationPrior('EARLY', 'threeBet', { supportLambda: 0 }))
        .filter((v) => v > 0).length,
    ).toBe(10);
  });

  it('ranks off-chart support by real equity, not by chart membership', () => {
    // The founder's decision (WS-302): a live player strays off-chart with a small pair
    // far more often than with 32o, so the floor must not be flat. 22 beats 72o beats
    // nothing — and the ordering follows EQUITY_VS_OPEN, not handStrengthTier (which
    // ranks 22 BELOW K3o).
    const prior = getPopulationPrior('EARLY', 'open');
    const at = (label) => prior[HAND_LABELS.indexOf(label)];
    expect(at('22')).toBeGreaterThan(at('72o'));
    expect(at('72o')).toBeGreaterThan(0);
    expect(at('AA')).toBeGreaterThan(at('22'));
  });

  it('keeps a narrow 3-bet prior narrow — the floor self-limits', () => {
    // POKER_THEORY §2.3: a 3-bet from a typical live player is almost always a monster.
    // A flat 0.05 floor on a 2.5%-wide grid would erase that read; the primitive caps the
    // floor at 90% of the target mean instead.
    //
    // WS-304 moved the numbers here, and the reason is derived rather than incidental. The
    // floor IS 90% of the range width by construction, so an assertion on the floor is an
    // assertion on the width — and the old width (1.04%) was NARROWER than the 2.56%
    // combo width of the hand set §2.3 names as the live-pool value 3-bet (QQ+ = 18
    // combos, AK = 16). That is precisely why AK could not fit inside it. At the derived
    // width the floor lands at 0.018, so the ratio to AA necessarily falls.
    const prior = getPopulationPrior('EARLY', 'threeBet');
    const junk = prior[HAND_LABELS.indexOf('72o')];
    expect(junk).toBeGreaterThan(0);
    expect(junk).toBeLessThan(0.03);
    expect(prior[HAND_LABELS.indexOf('AA')]).toBeGreaterThan(25 * junk);
    // The read that actually broke: before WS-304, AKo and 72o carried the SAME number
    // here — both sat exactly on the floor, because AK was not in the doctrine grid at all.
    expect(prior[HAND_LABELS.indexOf('AKo')]).toBeGreaterThan(4 * junk);
  });
});

// =============================================================================
// HAND STRENGTH ORDERING (WS-304)
// =============================================================================

describe('hand strength ordering (WS-304)', () => {
  const at = (prior, label) => prior[HAND_LABELS.indexOf(label)];
  const rankOf = (prior, label) => Array.from(prior.keys())
    .sort((a, b) => prior[b] - prior[a])
    .indexOf(HAND_LABELS.indexOf(label));
  const width = comboWidth;

  it('puts AK in the top region of the 3-bet prior alongside QQ+, on every position', () => {
    // POKER_THEORY §2.3: "Value 3-bet: QQ+, AK — expecting to be called by worse", and
    // "live low-stakes: most players 3-bet only premiums (QQ+, AK)". AK is one of the two
    // holdings the doctrine names. Measured before this fix, the EARLY prior at lambda = 0
    // read AA=1.0000 KK=0.7159 QQ=0.4318 JJ=0.1477 AKs=0.0057 AKo=0.0000 — AKo ranked
    // 157th of 169, i.e. the model said a villain who 3-bet and turned over AK was holding
    // a hand they could not have had.
    for (const pos of RANGE_POSITIONS) {
      const prior = getPopulationPrior(pos, 'threeBet');
      expect(rankOf(prior, 'AKs'), `${pos} AKs rank`).toBeLessThan(8);
      expect(rankOf(prior, 'AKo'), `${pos} AKo rank`).toBeLessThan(8);
      // "alongside QQ+" — comparable weight, not a rounding error next to it.
      expect(at(prior, 'AKo') / at(prior, 'QQ'), `${pos} AKo:QQ`).toBeGreaterThan(0.4);
      // …and clearly separated from everything the doctrine does NOT name.
      for (const weak of ['KQo', 'A5s', '76s', '22', '72o']) {
        expect(at(prior, 'AKo'), `${pos} AKo vs ${weak}`).toBeGreaterThan(at(prior, weak));
      }
    }
  });

  it('derives the 3-bet width from the combo count of the hand set §2.3 names', () => {
    // A linear ramp over the top f of a combo-uniform percentile axis has combo-weighted
    // mean f/2. THREE_BET_TOP_FRACTION = 0.05 therefore gives a range width of 2.50%,
    // against 34/1326 = 2.56% — the exact combo count of QQ+ (18) plus AK (16). The
    // threshold is that identity solved, not a number tuned until AK cleared it.
    const w = width(getPopulationPrior('EARLY', 'threeBet', { supportLambda: 0 }));
    expect(w).toBeCloseTo(THREE_BET_TOP_FRACTION / 2, 3);
    expect(w).toBeCloseTo(34 / 1326, 2);
  });

  it('scales the 3-bet foot by declared 3-bet propensity, not by a position label', () => {
    // The old code branched on `position === 'LATE' || position === 'BB'`, which left SB
    // on EARLY's tight threshold while FACED_RAISE_FREQUENCIES declares SB 3-betting at
    // 0.12 — twice EARLY, equal to LATE — and §2.5.2 calls the blind 3-bet wider and more
    // merged. Width now tracks the declared frequency ratio exactly.
    const w = (pos) => width(getPopulationPrior(pos, 'threeBet', { supportLambda: 0 }));
    for (const pos of RANGE_POSITIONS) {
      const ratio = FACED_RAISE_FREQUENCIES[pos].threeBet / FACED_RAISE_FREQUENCIES.EARLY.threeBet;
      expect(w(pos) / w('EARLY'), pos).toBeCloseTo(ratio, 1);
    }
    expect(w('SB')).toBeGreaterThan(w('EARLY'));
  });

  it('ranks a small pair above a junk broadway — the rank sum did the opposite', () => {
    // `(rank1 + rank2 + 8·isPair + 2·suited)/32` scored 22 at 0.250 and K3o at 0.375, so a
    // pair's whole pair bonus was worth less than one rank step at the top of the deck.
    // Asserted at lambda = 0, on the DOCTRINE grid — WS-302's support already ranked by
    // equity, so this only fails if the ordering underneath it is wrong.
    const open = getPopulationPrior('EARLY', 'open', { supportLambda: 0 });
    expect(at(open, '22')).toBeGreaterThan(at(open, 'K3o'));
    // The cold-call foot sat between them, so 22 — the hand a live pool set-mines with —
    // was assigned EXACTLY ZERO cold-call weight while K3o carried 0.3.
    const coldCall = getPopulationPrior('EARLY', 'coldCall', { supportLambda: 0 });
    expect(at(coldCall, '22')).toBeGreaterThan(0);
    expect(at(coldCall, '22')).toBeGreaterThanOrEqual(at(coldCall, 'K3o'));
    // …and the fold prior runs the other way: 22 is folded LESS often than K3o.
    const fold = getPopulationPrior('EARLY', 'fold', { supportLambda: 0 });
    expect(at(fold, '22')).toBeLessThan(at(fold, 'K3o'));
  });

  it('includes both hands §2.3 names as light 3-bets in the bluff tails', () => {
    // §2.3: "Bluff 3-bet (light 3-bet): A5s, 76s". The old tail band (0.40 < s < 0.60 on
    // the rank sum) scored 76s at 0.344 and excluded it — the doctrine's own example was
    // outside the tail the comment cited it for. The squeeze tail (0.35 < s < 0.62)
    // excluded it too.
    for (const action of ['cold3Bet', 'squeeze']) {
      const prior = getPopulationPrior('EARLY', action, { supportLambda: 0 });
      expect(at(prior, '76s'), `${action} 76s`).toBeGreaterThan(0);
      expect(at(prior, 'A5s'), `${action} A5s`).toBeGreaterThan(0);
    }
  });

  it('keeps the transported regions the same size as the ones they replaced', () => {
    // Every threshold that carried no doctrine number of its own was moved by quantile
    // matching, so each region selects the SAME fraction of the 1326 combos as before and
    // only its membership changed. Range width is the observable: `limp`, `coldCall` and
    // `fold` are pure threshold shapes with no chart term, so theirs must be preserved.
    const PRE_WS304_WIDTH = { limp: 0.3180, coldCall: 0.2499, fold: 0.5164 };
    for (const [action, before] of Object.entries(PRE_WS304_WIDTH)) {
      const after = width(getPopulationPrior('EARLY', action, { supportLambda: 0 }));
      expect(Math.abs(after - before), `${action} ${after}`).toBeLessThan(0.03);
    }
  });
});

describe('prior support preserves each action\'s SHAPE (WS-302)', () => {
  // The support ranks by the grid's own smoothed shape, not by raw equity, because these
  // three actions run in three different directions. A monotone equity ramp got `open`
  // right and inverted the other two — caught here.
  const at = (prior, label) => prior[HAND_LABELS.indexOf(label)];

  it('open rises with hand strength', () => {
    for (const pos of RANGE_POSITIONS) {
      const p = getPopulationPrior(pos, 'open');
      expect(at(p, 'AA'), pos).toBeGreaterThan(at(p, 'T9s'));
      expect(at(p, 'T9s'), pos).toBeGreaterThan(at(p, '32o'));
    }
  });

  it('fold FALLS with hand strength — weak hands fold most', () => {
    // An ascending ramp here claims the hand most often folded is aces.
    for (const pos of RANGE_POSITIONS) {
      const p = getPopulationPrior(pos, 'fold');
      expect(at(p, '32o'), pos).toBeGreaterThan(at(p, 'T9s'));
      expect(at(p, 'T9s'), pos).toBeGreaterThan(at(p, 'AA'));
    }
  });

  it('limp is HUMPED — speculative hands, not the best and not the worst (§2.2)', () => {
    // §2.2: limp ranges hold small pairs, suited connectors, weak suited aces. Both a
    // rising ramp (modal limp = AA) and a falling one (modal limp = 32o) are wrong.
    for (const pos of RANGE_POSITIONS) {
      if (pos === 'BB') continue; // BB cannot limp — structural, asserted elsewhere
      const p = getPopulationPrior(pos, 'limp');
      const peak = at(p, '54s');
      expect(peak, `${pos} vs premium`).toBeGreaterThan(at(p, 'AA'));
      expect(peak, `${pos} vs junk`).toBeGreaterThan(at(p, '32o'));
    }
  });

  it('coldCall is HUMPED — medium hands flat, premiums mostly raise', () => {
    for (const pos of RANGE_POSITIONS) {
      const p = getPopulationPrior(pos, 'coldCall');
      expect(at(p, 'AJs'), pos).toBeGreaterThan(at(p, 'AA'));
      expect(at(p, 'AJs'), pos).toBeGreaterThan(at(p, '32o'));
    }
  });
});
