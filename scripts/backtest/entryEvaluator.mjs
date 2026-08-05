/**
 * entryEvaluator.mjs — WS-323. One cell, evaluated through the production preflop advisor.
 *
 * Extracted from `run-entry-map.mjs` when the suit-aware second pass arrived and needed the
 * SAME evaluation. Two runners computing "the same" margin through two copies of this setup is
 * the shape that produces two numbers nobody can reconcile — and reconciling them is the entire
 * point of the map, since the second pass exists to check the first pass's answer at finer
 * grain. A copy would have made that check circular at best.
 *
 * Everything load-bearing about HOW a cell is priced lives here: the Field and its sweep, the
 * opener's range, the seats standing behind hero, the pot geometry, and the seeding discipline.
 */

import { openLoader } from './loader.mjs';
import { LeakageGuard, REFERENCE_FIELD_CORPUS } from './leakageGuard.mjs';
import {
  FIELD_QUANTILES,
  buildFieldSweep,
  combineInterval,
  entryMarginFrom,
  fieldPointStats,
  tableGeometry,
} from './entryMap.mjs';

/** Blinds. The map is denominated in bb, so the small blind only matters for pot geometry. */
export const BB = 1;
export const SB = 0.5;

/**
 * Villain's range facing hero.
 *
 * Built from NAMED hands via `parseRangeString` — never index literals, which are unreviewable
 * and have silently encoded the weakest hands before (index 0 is `22`, not `AA`).
 */
export const OPENER_RANGE_STRING =
  '22+,A2s+,K7s+,Q9s+,J9s+,T8s+,97s+,86s+,75s+,64s+,54s,A8o+,KTo+,QTo+,JTo';

/** The raise hero faces when `facingAction === 'raise'`, in bb. */
export const FACED_RAISE_BB = 2.5;

/**
 * Open the evaluator: load the engine, build the Field, and return a per-cell evaluate.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE REFERENCE DECLARATION IS MANDATORY (WS-375)
 *
 * This evaluator reads the SHIPPED, ALL-CORPUS aggregate table. Until WS-375 it imported
 * that table directly and contained no reference to `LeakageGuard` at all, while every
 * other scoring entry point in this directory constructs one (`heroEvRunner`,
 * `layerAblation`, `run-atoms`, `run-study-ladder`, `runner`).
 *
 * There was NO LEAK, and there is none now: this evaluator scores no corpus hand. It
 * prices the 169 preflop hand classes by Monte Carlo against a synthesised Field, and no
 * player in the corpus is ever predicted. Nothing was rerun and no published number is
 * suspect on this account.
 *
 * What was wrong is that the safety was CIRCUMSTANTIAL. The run was clean because of
 * what it happened to do, and after any change it would have been clean only because
 * someone remembered — and the natural next question after "what does the model say to
 * open" is "what did the field actually do", which the corpus can answer. So the table
 * now arrives through `guard.fieldTable()`, the mode is declared rather than absent, and
 * every corpus-hand-scoring assertion on that guard refuses.
 *
 * @param {Object} opts
 * @param {number} opts.stakeBB       - which pool segment the Field is read from
 * @param {string} opts.seatBucket    - '6max' | 'full'
 * @param {number} opts.flopSamples   - flop samples per archetype inside the advisor
 * @param {number} opts.mcReplicates  - Monte Carlo replicates at the central Field
 * @param {number} [opts.dealerSeat]  - the button; hero's seat comes from `tableGeometry`
 * @param {string} opts.reference     - REQUIRED. The reference declaration this run makes.
 *        `REFERENCE_FIELD_CORPUS` is the correct answer for an entry map. There is no
 *        default: an absent declaration is the state this ticket exists to abolish.
 */
export const openEntryEvaluator = async ({
  stakeBB,
  seatBucket,
  flopSamples,
  mcReplicates,
  dealerSeat = 9,
  reference,
}) => {
  // Constructed BEFORE the loader so a run with no declaration fails immediately rather
  // than after paying for module loading — and, more importantly, so there is no window
  // in which the corpus table is in scope without a guard beside it.
  const guard = new LeakageGuard({ reference });

  const loader = await openLoader();

  const [preflopEquity, rangeMatrix, equityTable, advisor, pool, poolBaseline, betaMath] =
    await Promise.all([
      loader.load('/src/utils/pokerCore/preflopEquity.js'),
      loader.load('/src/utils/pokerCore/rangeMatrix.js'),
      loader.load('/src/utils/pokerCore/preflopEquityTable.js'),
      loader.load('/src/utils/exploitEngine/preflopAdvisor.js'),
      loader.load('/src/utils/exploitEngine/handhqReferencePool.js'),
      loader.load('/src/utils/exploitEngine/poolBaseline.js'),
      loader.load('/src/utils/pokerCore/betaMath.js'),
    ]);

  // ── The 169 hand classes, taken from the machine-written authority ────────────────────────
  // `HAND_LABELS` is GENERATED alongside the equity table, so it cannot drift from the grid
  // indexing the way a hand-derived list could. Never an index list either way: index 0 is
  // `22`, not `AA` (RANK_CHARS is ascending), and five test files once encoded "tight range"
  // fixtures that were in fact small pairs and junk because they assumed the opposite.
  const handClasses = [...equityTable.HAND_LABELS];
  if (handClasses.length !== 169) {
    throw new Error(`expected 169 hand labels, got ${handClasses.length}`);
  }

  // ── The Field ─────────────────────────────────────────────────────────────────────────────
  // Through the guard, not around it: `fieldTable` is the only sanctioned way to obtain the
  // all-corpus rows, and it refuses in any mode but the declared one.
  // The catch closes the loader and RE-THROWS. It must never do anything else: WS-284
  // found both catch blocks in `scorePlayer` downgrading a guard refusal to a skipped
  // checkpoint, which is a guard that reports success by staying quiet.
  let stakes;
  try {
    stakes = guard.fieldTable(pool.HANDHQ_REFERENCE_STAKES, pool.HANDHQ_REFERENCE_META);
  } catch (e) {
    await loader.close();
    throw e;
  }
  const stake = stakes.find((s) => s.bb === stakeBB);
  if (!stake) {
    throw new Error(
      `no pool segment for bb=${stakeBB}; have ${stakes.map((s) => s.bb).join(', ')}`,
    );
  }
  const bucket = stake.buckets[seatBucket];
  if (!bucket) throw new Error(`no seat bucket "${seatBucket}" at bb=${stakeBB}`);

  const fieldSweep = buildFieldSweep(
    bucket.stats,
    poolBaseline.PER_STAT_PRIOR_WEIGHT,
    betaMath.betaQuantile,
    poolBaseline.DEFAULT_STAT_PRIOR_WEIGHT,
  );
  const CENTRAL = FIELD_QUANTILES.indexOf(0.5);
  const centralStats = fieldPointStats(fieldSweep, CENTRAL);

  const openerRange = rangeMatrix.parseRangeString(OPENER_RANGE_STRING);

  /** Every combo of a hand class, in the equity module's stable order. */
  const combosOf = (handClass) =>
    preflopEquity.enumerateHandCombos(preflopEquity.parseHandClass(handClass));

  /**
   * Price one cell for one specific pair of hole cards.
   *
   * ─────────────────────────────────────────────────────────────────────────────────────────
   * THE SEEDING DISCIPLINE, WHICH IS NOT INCIDENTAL
   * ─────────────────────────────────────────────────────────────────────────────────────────
   *
   * `seedBase` is supplied by the caller and derived from the cell's position in the STABLE
   * enumeration — not from a running counter of evaluated cells, which shifts the moment a cell
   * is skipped, and not from the clock, which would make the map unreplicable.
   *
   * Within a cell: each MC replicate gets `seedBase + r`, so replicates genuinely re-draw
   * flops. Without that the advisor seeds its flop sampler from hero's cards alone, every
   * replicate is bit-identical, and `mcError` comes out 0 — perfect precision reported for a
   * number resting on a handful of flops. That frozen sample is also a per-hand BIAS large
   * enough, at the shipped depth, to put QQ above AA.
   *
   * Across the Field sweep: every quantile shares ONE seed (`seedBase`), so the sweep isolates
   * the Field's effect instead of confounding it with a different flop draw. That is what makes
   * `modelError` a sensitivity to the FIELD rather than more sampling noise.
   */
  const evaluateCell = async (cell, { heroCards, seedBase }) => {
    const geo = tableGeometry(cell.posCategory, cell.facingAction);
    const facingRaise = cell.facingAction === 'raise';
    const villainBet = facingRaise ? FACED_RAISE_BB * BB : 0;
    // Pot before hero acts: the blinds, plus the opener's raise when facing one.
    const potSize = SB + BB + villainBet;

    /**
     * The seats behind hero, each stood up as its own entry carrying the Field's stats.
     *
     * THE DEFECT THIS FIXES, caught by the first smoke run. Passing neither `seatsToAct` nor
     * `playersToAct` sends `orStandIns` down its documented degradation path, where it stands
     * up exactly ONE synthetic seat. UTG was therefore priced as though a single player could
     * act behind it, fold equity was correspondingly enormous, and the map reported 32o as a
     * +1.18bb open from EARLY — any two cards, profitably, from the worst seat at the table.
     *
     * The same omission zeroed the Field sweep: a synthetic seat carries
     * `playerStats: { position }` and nothing else, so the swept stats never reached the seats
     * whose folding the EV is made of, and `modelError` came out identically 0. A sensitivity
     * sweep that cannot move the answer reports false certainty, which in this map means false
     * `fringe-tight` — a confident rule resting on nothing.
     *
     * Per WS-274: players remaining means WHO. Each seat resolves individually.
     */
    const seatsFor = (statsPoint) => geo.seatsBehind.map(({ seat, posCategory }) => ({
      seat,
      position: posCategory,
      playerStats: { ...statsPoint, position: posCategory },
      villainModel: null,
      statPriors: null,
    }));

    const posContext = {
      heroPosition: cell.posCategory,
      heroSeat: geo.heroSeat,
      villainSeat: geo.opener?.seat ?? null,
      dealerSeat,
      villainPosition: geo.opener?.posCategory ?? null,
      playersToAct: geo.seatsBehind.length,
      situation: null,
    };

    const evaluate = async (statsPoint, seed) => {
      const out = await advisor.computePreflopAdvice(
        openerRange,
        heroCards,
        potSize,
        facingRaise ? 'raise' : null,
        villainBet,
        statsPoint,
        { ...posContext, seatsToAct: seatsFor(statsPoint) },
        null,   // no per-villain model: the Field is a population, not a person
        null,   // rake: the corpus config is stamped by the caller, not assumed here
        undefined,
        { flopSamplesPerArchetype: flopSamples, flopSeed: seed },
      );
      return entryMarginFrom(out.recommendations, BB);
    };

    // Monte Carlo replicates at the CENTRAL Field. The engine reaches monteCarloEquity, which
    // calls Math.random(), so repeated evaluation at identical inputs genuinely re-draws.
    const mcMargins = [];
    for (let r = 0; r < mcReplicates; r++) {
      const m = await evaluate(centralStats, seedBase + r);
      if (m) mcMargins.push(m.marginBB);
    }

    if (mcMargins.length === 0) {
      // No entry action at all. A real state, reported rather than silently read as EV 0 —
      // reading it as zero would drop the cell into the fringe, the one band where a wrong
      // entry does the most damage.
      return { degenerate: true };
    }

    const modelMargins = [];
    for (let q = 0; q < FIELD_QUANTILES.length; q++) {
      if (q === CENTRAL) {
        // Already covered by the MC replicates; reuse their mean rather than paying twice.
        modelMargins.push(mcMargins.reduce((a, b) => a + b, 0) / mcMargins.length);
        continue;
      }
      const m = await evaluate(fieldPointStats(fieldSweep, q), seedBase);
      if (m) modelMargins.push(m.marginBB);
    }

    const best = await evaluate(centralStats, seedBase);

    return {
      degenerate: false,
      bestAction: best?.action ?? null,
      ...combineInterval(mcMargins, modelMargins),
    };
  };

  return {
    handClasses,
    combosOf,
    evaluateCell,
    guard,
    close: () => loader.close(),
    /** The run's own integrity report — a result that carries its own proof (WS-375). */
    integrity: guard.summary(),
    /** Everything the artifact needs to stamp about how these numbers were produced. */
    fieldStamp: {
      sourceId: pool.HANDHQ_REFERENCE_META.sourceId,
      referenceMode: guard.referenceMode,
      stakeBB,
      seatBucket,
      openerRange: OPENER_RANGE_STRING,
      facedRaiseBB: FACED_RAISE_BB,
      spreadFrom: 'poolBaseline.PER_STAT_PRIOR_WEIGHT (between-player overdispersion, WS-262)',
      sweep: fieldSweep,
    },
  };
};

/**
 * The seed a cell is evaluated at.
 *
 * Derived from the cell's index in the STABLE enumeration and, for the suit pass, the combo's
 * index within its class. The stride is wide enough that no cell's replicate seeds can collide
 * with the next cell's — a collision would silently correlate two cells' flop draws and shrink
 * their apparent independent error.
 */
export const seedFor = (cellIndex, comboIndex = 0) => (cellIndex + 1) * 1000 + comboIndex * 16;
