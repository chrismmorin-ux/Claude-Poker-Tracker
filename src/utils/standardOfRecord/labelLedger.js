/**
 * labelLedger.js — the Label & Foundation Ledger (WS-445).
 *
 * Every DISCRETE KEY standing between raw game data and a numeric engine parameter — a position
 * label, a style label, a hand-strength bucket, a board-texture category, an SPR zone, a stack
 * tier, a line tag, a size bucket — together with the DATA FOUNDATION underneath it and the
 * evidence tier of that foundation.
 *
 * WHY IT EXISTS. WS-436 removed the six style labels after measuring that they carried no
 * villain-action information (ΔLL −0.00076 over 10,147 paired decisions, n.s.). Style was ONE
 * taxonomy, found by stumbling onto it. A survey at HEAD found 49 label families and an AST
 * harvest found 145 constructs — so the question the founder asked on 2026-08-08 ("make sure
 * its all in order and properly listed somewhere such that we can rank the estimated impact")
 * had no answer anywhere in the repo.
 *
 * WHY IT IS SITED HERE and not in a directory of its own: `FAULT-constants-by-taste` is already
 * rank 11 in `faultRegister.js` — *any unswept constant is a suspected fault by default*, prior
 * breadth 0.50. This ledger is that single register entry's per-instance expansion. A separate
 * directory would read as a competing register rather than as its detail.
 *
 * WHY PROSE DID NOT WORK, which is the premise for all of the machinery below.
 * `exploitEngine/CLAUDE.md:87-129` and `:205-218` already forbid label-shaped decision inputs in
 * four separate forms, with worked examples. 49 families exist anyway. A rule that is only
 * written down is not a control.
 *
 * THE DIVISION OF LABOUR, copied from the fault register: PROSE LIVES IN THE DOC
 * (`docs/standard-of-record/LABEL-AND-FOUNDATION-LEDGER.md`), DATA LIVES HERE, and a drift test
 * asserts the doc's ranked table matches `rankLabels()` id-for-id in exact order. There is no
 * generator — per `faultRegister.test.js:466-467`, a generator would just move the drift.
 */

import { hashObject } from '../contentHash.js';

// =============================================================================
// VOCABULARIES — closed sets, each with a predicate beside it
// =============================================================================

/**
 * What the numbers actually rest on. The founder's four, closed.
 *
 * This is ORTHOGONAL to `FOUNDATION_STATUSES` below and the two must not be collapsed: the
 * foundation is what KIND of thing produced the number, the status is what we currently KNOW
 * about whether it holds.
 */
export const FOUNDATIONS = Object.freeze([
  'founder-estimate',
  'mined-corpus',
  'fitted-curve',
  'structural-computation',
]);

export const isFoundation = (v) => FOUNDATIONS.includes(v);

/**
 * What the SOURCE currently claims about its foundation. Five values, and the fifth is the one
 * that earns the vocabulary.
 *
 * `measured-refuted` — measured, NOT supported, and still shipping. `FOLD_CURVE_STREET_MODS`
 * (`villainModelData.js:412`) is the standing instance: its own docblock records that refitting
 * per street returns the same shape on all three and that applying the multipliers makes the
 * hold-out WORSE (Brier flop 0.23668 → 0.23723), and it is still multiplied into the primary
 * fold estimate at `foldEquityCalculator.js:329`.
 *
 * A four-value set cannot say *we looked, it failed, it ships*. Collapsing that into
 * `undeclared` erases the most damning fact the survey found; collapsing it into
 * `measured-supported` launders it. Note this is NOT an accusation of carelessness — POKER_THEORY
 * v2.3 records the null deliberately, and leaving a ~5e-4 effect alone rather than tuning on it
 * is defensible. The ledger's job is to make that decision RANKABLE rather than discoverable
 * only by reading one docblock.
 */
export const FOUNDATION_STATUSES = Object.freeze([
  'undeclared', //         no provenance stated anywhere — REALIZATION_TABLE, BUCKET_MIDPOINT
  'declared-estimate', //  provenance stated, and it says founder estimate
  'measured-refuted', //   measured, not supported, still shipping
  'measured-supported', // a Result Card supports it — ACTION_TAU_FRACTION
  'generated', //          mechanically produced from a corpus — handhqReferencePool
]);

export const isFoundationStatus = (v) => FOUNDATION_STATUSES.includes(v);

/**
 * How a BOUNDED row got its bound. A closed set on purpose.
 *
 * Without it, BOUNDED becomes the dumping ground — "bounded by 1.0 bb/100 because everything
 * is" — and the ladder's middle rung stops meaning anything. A bound must name a technique this
 * repo has a name for.
 */
export const BOUND_METHODS = Object.freeze([
  'range-envelope', //               replace the table by its per-column extremum, re-score
  'column-extremum-substitution', // substitute the most extreme cell everywhere, re-score
  'ablation-delta', //               delete the channel, re-score the same decisions
  'reach-times-swing', //            consumer-site reach × plausible parameter swing
]);

export const isBoundMethod = (v) => BOUND_METHODS.includes(v);

/**
 * Why a harvested construct is NOT a label-shaped input.
 *
 * An exclusion is a RECORDED JUDGMENT, which is the whole reason the harvest is deliberately
 * over-inclusive: a false positive costs one reasoned line here, a false negative costs a row
 * nobody ever writes. Every reason that is not self-evident from the construct requires a
 * ticket, so "not yet triaged" cannot become a permanent resting place.
 */
export const EXCLUSION_REASONS = Object.freeze([
  'ui-geometry', //          layout, sizing, colour — no engine parameter
  'result-card-artifact', // a built Result Card / manifest, not a lookup table
  'schema-or-version', //    schema versions, migration numbers
  'display-only', //         drives presentation, explicitly not a decision input
  'test-fixture', //         exists to be asserted against
  'not-a-label', //          keys are not labels (indices, ids, hand names)
  'not-yet-triaged', //      REQUIRES a ticket; aged out by the STALE EXCLUSION gate
]);

export const isExclusionReason = (v) => EXCLUSION_REASONS.includes(v);

/** Reasons that may not stand alone — they are a promise to come back. */
const TICKETED_REASONS = Object.freeze(['not-yet-triaged']);

// =============================================================================
// IMPACT — the three-tier evidence ladder
// =============================================================================

/**
 * THE LOAD-BEARING MECHANIC OF THIS WHOLE MODULE (founder decision, 2026-08-16).
 *
 * The ranking currency is absolute EV, but most rows start unmeasured. The failure this guards
 * against is named in WS-445's own `decision_flags`: *the ledger silently becomes a list of
 * unmeasured guesses wearing EV units.*
 *
 * The guard is not a rule, it is a SHAPE. `buildUnmeasuredReach` mints no EV key at all —
 * `absEvBB100` is `undefined`, not `null`. There is no slot to fill, and nothing for a future
 * `if (tier !== 'unmeasured')` relaxation to unlock. Three layers enforce it:
 *
 *   1. the three constructors mint disjoint key sets (here);
 *   2. `buildLabelEntry` DERIVES the tier from the payload and accepts no `tier` argument, so
 *      tier and payload cannot disagree;
 *   3. `labelEntryProblems` validates the key set EXACTLY — an extra key is a violation, not
 *      only a missing one — which is what stops someone bolting `absEvBB100` on by hand.
 */

const MEASURED_KEYS = ['tier', 'absEvBB100', 'ci', 'resultCardId', 'clusterUnit', 'method'];
const BOUNDED_KEYS = ['tier', 'boundBB100', 'boundDirection', 'method', 'derivation'];
const UNMEASURED_KEYS = ['tier', 'readSites', 'cellCount', 'primaryPath', 'instrument'];

/** Keys that may NEVER appear on an unmeasured impact, by any name this repo uses for EV. */
const EV_BEARING_KEYS = Object.freeze([
  'absEvBB100', 'boundBB100', 'ci', 'evBB', 'ev', 'edgeBB', 'bb100', 'impact',
]);

/**
 * A row whose impact is MEASURED: a Result Card exists and this is what it says.
 * `resultCardId` is required and is the join — see `labelEntryProblems`.
 */
export const buildMeasuredImpact = ({
  absEvBB100, ci = null, resultCardId, clusterUnit, method,
}) => Object.freeze({
  tier: 'measured', absEvBB100, ci, resultCardId, clusterUnit, method,
});

/**
 * A row whose impact is BOUNDED: no card, but an analytic bound whose method is named.
 * `boundDirection` forces a `≤`/`≥` glyph at render time so a BOUND is never read as an
 * ESTIMATE — `≤ 0.90` and `0.90` are different claims.
 */
export const buildBoundedImpact = ({
  boundBB100, boundDirection = '<=', method, derivation,
}) => Object.freeze({
  tier: 'bounded', boundBB100, boundDirection, method, derivation,
});

/**
 * A row whose impact is UNMEASURED. Carries REACH — how much of the engine it touches — and the
 * INSTRUMENT that would measure it. It carries no EV figure and cannot be given one.
 *
 * `instrument` is required and non-empty, held to the bar `falsifier` clears in the fault
 * register: an entry with no instrument is a complaint, not a ledger row.
 */
export const buildUnmeasuredReach = ({
  readSites, cellCount, primaryPath, instrument,
}) => Object.freeze({
  tier: 'unmeasured', readSites, cellCount, primaryPath, instrument,
});

const keysFor = (tier) => {
  if (tier === 'measured') return MEASURED_KEYS;
  if (tier === 'bounded') return BOUNDED_KEYS;
  if (tier === 'unmeasured') return UNMEASURED_KEYS;
  return null;
};

/**
 * The shape a `resultCardId` has on disk, e.g.
 * `RC-per-player-width-790a6ffd-1c560bcc`. Shape only — the greppability join is a test.
 */
export const RESULT_CARD_ID_PATTERN = /^RC-[A-Za-z0-9-]+$/;

/**
 * Problems with an impact object. Exported separately from the constructors for the reason
 * `resultCard.js:117-123` states: a validator that can only ever agree with its own constructor
 * is not a validator. This one is run against hand-authored rows too.
 */
export const impactProblems = (impact) => {
  const problems = [];
  if (!impact || typeof impact !== 'object') return ['impact: missing'];

  const expected = keysFor(impact.tier);
  if (!expected) {
    return [`impact.tier: "${impact.tier}" is not one of measured | bounded | unmeasured`];
  }

  const actual = Object.keys(impact).sort();
  const want = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(want)) {
    const extra = actual.filter((k) => !want.includes(k));
    const missing = want.filter((k) => !actual.includes(k));
    if (extra.length) {
      const evExtra = extra.filter((k) => EV_BEARING_KEYS.includes(k));
      problems.push(`impact(${impact.tier}): unexpected key(s) ${extra.join(', ')}.`
        + (evExtra.length
          ? ` ${evExtra.join(', ')} carries EV, and an UNMEASURED row carries no EV figure and`
            + ' cannot be given one — that is the point of the tier, not a formatting rule.'
          : ''));
    }
    if (missing.length) {
      problems.push(`impact(${impact.tier}): missing key(s) ${missing.join(', ')}`);
    }
  }

  if (impact.tier === 'measured') {
    if (!Number.isFinite(impact.absEvBB100)) {
      problems.push('impact.absEvBB100: a measured row states a number');
    }
    if (!impact.resultCardId || !RESULT_CARD_ID_PATTERN.test(impact.resultCardId)) {
      problems.push('impact.resultCardId: a MEASURED row names the Result Card that measured '
        + 'it. Without this join the tier is a word, and the ledger becomes the list of '
        + 'unmeasured guesses wearing EV units that WS-445 exists to prevent.');
    }
    if (impact.clusterUnit !== 'sessions' && impact.clusterUnit !== 'players') {
      problems.push('impact.clusterUnit: must be "sessions" or "players" — hands are not a '
        + 'legal cluster unit (resultCard.js CLUSTER_UNITS)');
    }
  }

  if (impact.tier === 'bounded') {
    if (!Number.isFinite(impact.boundBB100)) {
      problems.push('impact.boundBB100: a bounded row states a number');
    }
    if (impact.boundDirection !== '<=' && impact.boundDirection !== '>=') {
      problems.push('impact.boundDirection: must be "<=" or ">=" — a bound renders with its '
        + 'glyph so it is never read as an estimate');
    }
    if (!isBoundMethod(impact.method)) {
      problems.push(`impact.method: "${impact.method}" is not in BOUND_METHODS. A bound must `
        + 'name a technique this repo has a name for, or BOUNDED becomes a dumping ground.');
    }
    if (!impact.derivation || !impact.derivation.trim()) {
      problems.push('impact.derivation: state how the bound was derived, in prose');
    }
  }

  if (impact.tier === 'unmeasured') {
    if (!Number.isInteger(impact.readSites) || impact.readSites < 0) {
      problems.push('impact.readSites: reach is COUNTED, not claimed — an integer');
    }
    if (!Number.isInteger(impact.cellCount) || impact.cellCount < 0) {
      problems.push('impact.cellCount: an integer');
    }
    if (typeof impact.primaryPath !== 'boolean') {
      problems.push('impact.primaryPath: boolean — is it read on a straight-line path?');
    }
    if (!impact.instrument || !impact.instrument.what || !impact.instrument.what.trim()) {
      problems.push('impact.instrument.what: an UNMEASURED row NAMES the instrument that would '
        + 'measure it. An entry with no instrument is a complaint, not a ledger row.');
    }
    if (!impact.instrument || !impact.instrument.ticket
        || !/^WS-\d+$/.test(impact.instrument.ticket)) {
      problems.push('impact.instrument.ticket: name the WS-NNN that would build the instrument. '
        + 'A gap with no owner is how a surface nobody can settle re-emits at rank 1 forever.');
    }
  }

  return problems;
};

// =============================================================================
// ENTRIES
// =============================================================================

/** Liveness, mirroring the harvester's consumer-trace classification. */
export const LIVENESS = Object.freeze([
  'unconditional', // read on a straight-line path
  'guarded', //       every reader sits behind an else / ?? / || fallback
  'test-only', //     readers exist, all of them in tests
  'vestigial', //     zero production readers in scope
]);

export const isLiveness = (v) => LIVENESS.includes(v);

export const LABEL_STATUSES = Object.freeze(['open', 'resolved']);

/**
 * Problems with a whole entry. Exported separately from `buildLabelEntry`, same reason as above.
 */
export const labelEntryProblems = (entry) => {
  const problems = [];
  if (!entry || typeof entry !== 'object') return ['entry: missing'];

  if (!/^LBL-[a-z0-9-]+$/.test(entry.labelId ?? '')) {
    problems.push(`labelId: "${entry.labelId}" must match LBL-<kebab>`);
  }
  if (!entry.title || !entry.title.trim()) problems.push('title: required');

  if (!entry.site || !entry.site.file || !entry.site.symbol) {
    problems.push('site: { file, symbol } required');
  } else if ('line' in entry.site) {
    // Line numbers are supplied at REPORT time by the harvester and never stored. A stored line
    // would move `ledgerVersion()` on every unrelated edit above a table, which is exactly the
    // meaninglessness `registerVersion` was designed to avoid.
    problems.push('site.line: never stored — the harvester supplies it at report time');
  }

  if (!Array.isArray(entry.sites) || entry.sites.length === 0) {
    problems.push('sites: at least one harvest key this row claims');
  }
  if (!Array.isArray(entry.keySpace) || entry.keySpace.length === 0) {
    problems.push('keySpace: the discrete axes, e.g. ["street","position","sprZone"]');
  }
  if (!isFoundation(entry.foundation)) {
    problems.push(`foundation: "${entry.foundation}" not in FOUNDATIONS`);
  }
  if (!isFoundationStatus(entry.foundationStatus)) {
    problems.push(`foundationStatus: "${entry.foundationStatus}" not in FOUNDATION_STATUSES`);
  }
  if (!isLiveness(entry.liveness)) {
    problems.push(`liveness: "${entry.liveness}" not in LIVENESS`);
  }
  if (!LABEL_STATUSES.includes(entry.status)) {
    problems.push(`status: "${entry.status}" not in LABEL_STATUSES`);
  }
  if (!entry.provenance || !entry.provenance.trim()) {
    problems.push('provenance: what the SOURCE claims today, quoted or cited by file:line. '
      + '"Nothing stated" is a valid and important answer — write it.');
  }

  problems.push(...impactProblems(entry.impact));

  // The two cross-field claims that can silently disagree.
  if (entry.impact?.tier === 'measured' && entry.foundationStatus !== 'measured-supported'
      && entry.foundationStatus !== 'measured-refuted' && entry.foundationStatus !== 'generated') {
    problems.push(`foundationStatus "${entry.foundationStatus}" contradicts a MEASURED impact `
      + '— a card measured it, so the foundation is not undeclared or a bare estimate');
  }
  if (entry.status === 'resolved' && (!entry.resolvedBy || !entry.resolvedBy.evidence?.length)) {
    problems.push('resolvedBy.evidence: resolving REQUIRES recorded evidence. Raising a row '
      + 'costs nothing, so clearing one on assertion alone is how a register gets quietly '
      + 'emptied.');
  }

  return problems;
};

/** Construct an entry, throwing on any problem. Mirrors `buildFaultEntry`. */
export const buildLabelEntry = (spec) => {
  const entry = Object.freeze({
    labelId: spec.labelId,
    title: spec.title,
    site: Object.freeze({ file: spec.site?.file, symbol: spec.site?.symbol }),
    sites: Object.freeze([...(spec.sites ?? [])]),
    keySpace: Object.freeze([...(spec.keySpace ?? [])]),
    foundation: spec.foundation,
    foundationStatus: spec.foundationStatus,
    provenance: spec.provenance,
    liveness: spec.liveness,
    impact: spec.impact,
    status: spec.status ?? 'open',
    resolvedBy: spec.resolvedBy ?? null,
    notes: Object.freeze([...(spec.notes ?? [])]),
  });
  const problems = labelEntryProblems(entry);
  if (problems.length) {
    throw new Error(`buildLabelEntry(${spec.labelId}): ${problems.join(' | ')}`);
  }
  return entry;
};

// =============================================================================
// THE LEDGER
// =============================================================================

/**
 * SEED ROWS. The four highest-signal defects the WS-445 survey found, plus two strong-row
 * counter-examples so the bar is visible rather than described.
 *
 * The remaining rows are added by triaging the harvest — `node
 * scripts/standardOfRecord/check-label-ledger.mjs` lists every construct not yet claimed.
 * A foundation or a bound INVENTED rather than read is `FAULT-constants-by-taste` wearing a new
 * hat, which is the fault this ledger exists to expose, so every row is founder-ratified.
 */
export const LABEL_LEDGER = Object.freeze([
  buildLabelEntry({
    labelId: 'LBL-style-collapse',
    title: 'The six villain style labels as a Dirichlet prior seed (removed by WS-436)',
    site: { file: 'src/utils/exploitEngine/villainModelData.js', symbol: 'STYLE_PRIORS' },
    sites: ['src/utils/exploitEngine/villainModelData.js::STYLE_PRIORS'],
    keySpace: ['style'],
    foundation: 'founder-estimate',
    foundationStatus: 'measured-supported',
    provenance: 'WS-235 / FIND-023 / SRC-009 — declared a founder estimate of the live 1/2 pool, '
      + '"do NOT cite as measured". Removed by WS-436 after measurement.',
    liveness: 'vestigial',
    impact: buildMeasuredImpact({
      absEvBB100: 0,
      ci: null,
      resultCardId: 'RC-STYLE-COLLAPSE-2026-08-12',
      clusterUnit: 'players',
      method: 'ablation-delta',
    }),
    status: 'resolved',
    resolvedBy: {
      commit: 'WS-436',
      evidence: [
        'ΔLL −0.00076 vs population over 10,147 paired decisions, n.s. — the label channel '
        + 'carried no measurable villain-action information.',
        'Advice-parity: 0 of 130 paired decisions changed at population villains, exact n=0 '
        + 'identities end-to-end.',
        'The one same-source replacement tried (continuous shrunk seed in the model priors) was '
        + 'REFUTED at ΔLL −0.00691, t=−5.64.',
      ],
      note: 'The worked example every other row is held to. Its lesson is that the FOUNDATION '
        + 'column matters more than the LABEL column — the replacement failed for a reason the '
        + 'label taxonomy could not express.',
    },
    notes: ['docs/research/ws436-style-collapse-2026-08-12.result-card.json'],
  }),

  buildLabelEntry({
    labelId: 'LBL-realization-table',
    title: 'Equity realization keyed by street x ip/oop x SPR zone — 30 cells on every showdown EV',
    site: { file: 'src/utils/exploitEngine/gameTreeConstants.js', symbol: 'REALIZATION_TABLE' },
    sites: ['src/utils/exploitEngine/gameTreeConstants.js::REALIZATION_TABLE'],
    keySpace: ['street', 'position', 'sprZone'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. gameTreeConstants.js:30-33 gives poker-theory prose '
      + '("realization increases as SPR decreases... OOP realizes less than IP at every SPR") '
      + 'and no measurement, no citation, no sample. Founder estimate by omission.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 2,
      cellCount: 30,
      primaryPath: true,
      instrument: {
        what: 'Ablation: replace the 30-cell lookup with its per-column extremum and re-score '
          + 'the 260-decision set from out/depth-ablation.json, differencing per decision. '
          + 'WS-407 states the arm costs zero additional compute.',
        ticket: 'WS-407',
      },
    }),
    notes: [
      'Read via gameTreeEquity.js:39 (adjustedRealization) -> :121 rolloutValue -> '
      + 'gameTreeEvaluator.js:331,386 and eight sites in gameTreeDepth2. No guard, no fallback.',
      'THREE separate instrument tickets already exist for this one table and none references '
      + 'the others: WS-404 (P=28), WS-407 (24), WS-498 (30). Collapsing them onto one row is '
      + 'the clearest evidence the ledger is a deduplicating index, not just an inventory.',
      'sprMidpointMultiplier two files away is documented as a "continuous function replacing '
      + 'zone-based table" — the same axis is handled both ways inside one module.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-fold-curve-street-mods',
    title: 'Street-keyed fold-curve multipliers — measured, NOT supported, still shipping',
    site: {
      file: 'src/utils/exploitEngine/villainModelData.js', symbol: 'FOLD_CURVE_STREET_MODS',
    },
    sites: ['src/utils/exploitEngine/villainModelData.js::FOLD_CURVE_STREET_MODS'],
    keySpace: ['street'],
    foundation: 'founder-estimate',
    foundationStatus: 'measured-refuted',
    provenance: 'villainModelData.js:389-411 states it outright: "THE POKER-THEORY '
      + 'JUSTIFICATION THESE ONCE CARRIED WAS MEASURED AND IS NOT SUPPORTED (WS-283)." '
      + 'Refitting per street returns the same shape on all three; applying the multipliers is '
      + 'worse than not applying them (Brier flop 0.23668 -> 0.23723, river 0.22844 -> 0.22885). '
      + 'Recorded as an UNSUPPORTED TIE-BREAK, not as poker theory.',
    liveness: 'unconditional',
    impact: buildBoundedImpact({
      boundBB100: 0.05,
      boundDirection: '<=',
      method: 'ablation-delta',
      derivation: 'The measured Brier effect is ~5e-4, an order of magnitude below the '
        + 'population-curve correction (4.7e-3) whose own re-fit moved Brier 0.24054 -> 0.23530. '
        + 'The EV consequence is bounded above by that ratio against the population correction, '
        + 'pending the paired re-score WS-283 would run.',
    }),
    notes: [
      'Read at foldEquityCalculator.js:329 via resolveFoldCurveParams, on the primary path.',
      'NOT an unnoticed defect. POKER_THEORY v2.3 records the null deliberately and leaving a '
      + '~5e-4 effect alone rather than tuning on it is defensible. What the ledger adds is that '
      + 'the decision is currently discoverable ONLY by reading one docblock in one file; a row '
      + 'makes it rankable against everything else.',
      'Deletion is WS-283\'s follow-up. WS-283 is runs_on: node1 and currently BLOCKED for code.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-bucket-midpoint',
    title: 'Size-bucket label -> bet/pot ratio, inside the MEASUREMENT path',
    site: { file: 'scripts/backtest/deviationMap.mjs', symbol: 'BUCKET_MIDPOINT' },
    sites: ['scripts/backtest/deviationMap.mjs::BUCKET_MIDPOINT'],
    keySpace: ['sizeBucket'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. The comment reads only "Representative bet-to-pot ratio '
      + 'for each size bucket".',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'Recompute the deviation map with the midpoints replaced by the observed mean '
          + 'bet/pot ratio WITHIN each bucket, taken from the same observations, and difference '
          + 'the resulting floors per cell. The instrument is cheap because the observations '
          + 'already carry the true ratio.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'Read at deviationMap.mjs:61 as the argument to deriveFloor — it sets the defensive floor '
      + 'every deviation cell is scored AGAINST. A label table with no provenance contaminating '
      + 'the instrument rather than the engine, which is why it outranks its cell count.',
      'An unrecognized bucket is dropped silently by the !Number.isFinite(s) guard.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-action-tau-fraction',
    title: 'Per-action narrowing softness — the strong-row counter-example',
    site: { file: 'src/utils/exploitEngine/postflopNarrower.js', symbol: 'ACTION_TAU_FRACTION' },
    sites: ['src/utils/exploitEngine/postflopNarrower.js::ACTION_TAU_FRACTION'],
    keySpace: ['action'],
    foundation: 'fitted-curve',
    foundationStatus: 'measured-supported',
    provenance: 'postflopNarrower.js:560-601 carries a swept log grid over 349,179 corpus hands '
      + 'with per-action deltas (raise +0.54/+0.60, call +0.18/+0.17, bet +0.15/+0.16, check '
      + '−0.19/−0.15). A check narrowed by equity reads WORSE than not narrowing at all.',
    liveness: 'unconditional',
    impact: buildMeasuredImpact({
      absEvBB100: 0.54,
      ci: null,
      resultCardId: 'RC-per-player-width-790a6ffd',
      clusterUnit: 'players',
      method: 'ablation-delta',
    }),
    notes: [
      'Included as a counter-example: this is what a row with a real foundation looks like, so '
      + 'the bar is visible rather than described.',
      'Three of its four values are the identifier TAU_FRACTION rather than numeric literals — '
      + 'a detector requiring two numeric literals MISSED it, which is why leafKind accepts '
      + 'references.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-handhq-reference-pool',
    title: 'Per-stake x seat-bucket reference aggregates — generated, the best foundation here',
    site: {
      file: 'src/utils/exploitEngine/handhqReferencePool.js', symbol: 'HANDHQ_OPENER_FACING_3BET',
    },
    sites: ['src/utils/exploitEngine/handhqReferencePool.js::HANDHQ_OPENER_FACING_3BET'],
    keySpace: ['stake', 'seatBucket'],
    foundation: 'mined-corpus',
    foundationStatus: 'generated',
    provenance: 'GENERATED static Reference-class data (SRC-011): per-stake x seat-bucket (k, n) '
      + 'aggregates from the WS-262 HandHQ mining, regenerated via '
      + 'scripts/generate-handhq-reference.mjs. Hand-edited values and logic are both forbidden '
      + 'in the file by its own contract.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 6,
      cellCount: 12,
      primaryPath: true,
      instrument: {
        what: 'No defect is suspected. The open question is TRANSFER, not provenance: the '
          + 'corpus is online 2009 and the founder game is live 9-handed 1/2-1/3, so any live '
          + 'claim resting on it is transferred rather than measured. The instrument is the '
          + 'FAULT-population-mismatch falsifier — measure the same estimand on a live source '
          + 'and on SRC-012 and compare on a shared spot set.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'Second counter-example, and a different KIND of strong row from ACTION_TAU_FRACTION: '
      + 'generated rather than fitted. Its foundation is sound and its transfer is not, and the '
      + 'ledger has to be able to say both at once.',
    ],
  }),
]);

// =============================================================================
// RANKING
// =============================================================================

/**
 * Reach, for rows with no honest EV number. Every component is reported on the row — the rule
 * `rankFaults` sets at faultRegister.js:1445-1448 — so a reader can see which term carried the
 * rank rather than trusting a scalar.
 */
export const reachScore = (entry) => {
  const i = entry.impact;
  return (i.primaryPath ? 1000 : 0) + (i.readSites * 10) + Math.min(i.cellCount, 99);
};

const impactMagnitude = (entry) => {
  const i = entry.impact;
  if (i.tier === 'measured') return Math.abs(i.absEvBB100);
  if (i.tier === 'bounded') return Math.abs(i.boundBB100);
  return 0;
};

/**
 * TWO ARRAYS, NEVER ONE.
 *
 * The founder's "sort separately" is enforced by the RETURN SHAPE rather than by a flag a
 * caller can ignore. No exported function concatenates them, and a test asserts `ranked`
 * contains no unmeasured row. Concatenating them is what would put a reach rank and a bb/100
 * on one axis, which is the comparison the tier system exists to forbid.
 */
export const rankLabels = (entries = LABEL_LEDGER) => {
  const open = entries.filter((e) => e.status === 'open');
  const resolved = entries.filter((e) => e.status !== 'open');

  const ranked = entries
    .filter((e) => e.impact.tier !== 'unmeasured')
    .map((e) => ({
      labelId: e.labelId,
      tier: e.impact.tier,
      magnitude: impactMagnitude(e),
      entry: e,
    }))
    .sort((a, b) => b.magnitude - a.magnitude || a.labelId.localeCompare(b.labelId));

  const unmeasured = entries
    .filter((e) => e.impact.tier === 'unmeasured')
    .map((e) => ({
      labelId: e.labelId,
      reach: reachScore(e),
      primaryPath: e.impact.primaryPath,
      readSites: e.impact.readSites,
      cellCount: e.impact.cellCount,
      entry: e,
    }))
    .sort((a, b) => b.reach - a.reach || a.labelId.localeCompare(b.labelId));

  return {
    ranked, unmeasured, open, resolved,
  };
};

// =============================================================================
// THE BLIND-SPOT RULE — ledgerSelfCheck
// =============================================================================

/**
 * The register held to its own standard, placed here beside the rows for the same reason
 * `registerSelfCheck` is (faultRegister.js:1607).
 *
 * THE NAIVE VERSION OF THIS CHECK IS BACKWARDS. "Fail if too few rows are measured" rewards
 * relabelling: the cheapest way to pass is to call things measured. So the checks below fire on
 * the SUSPICIOUS direction — a ledger that has run out of things to be unsure about.
 *
 * WS-445's accept criteria state the principle: *if the ledger cannot name anything that could
 * make the engine better, that is not evidence the engine is done — it is evidence we are in a
 * blind spot.*
 */
export const ledgerSelfCheck = (entries = LABEL_LEDGER) => {
  const problems = [];
  const notes = [];

  const total = entries.length;
  const unmeasured = entries.filter((e) => e.impact.tier === 'unmeasured');
  const measured = entries.filter((e) => e.impact.tier === 'measured');
  const openGaps = unmeasured.filter((e) => e.status === 'open');

  // BS-1 — the inverted ratio.
  if (total > 0 && unmeasured.length === 0) {
    problems.push('BLIND SPOT (BS-1): every row claims a measured or bounded impact. A ledger '
      + 'asserting the engine\'s entire label surface is grounded is making a claim no evidence '
      + 'in this repo supports. Zero unmeasured rows is a reason to look harder, not to ship.');
  }
  if (total > 0 && measured.length / total > 0.5 && openGaps.length === 0) {
    problems.push('BLIND SPOT (BS-1): a majority of rows read MEASURED and nothing is left to '
      + 'instrument. Check that "measured" has not quietly come to mean "I looked at it".');
  }

  // BS-2 — zero open instrument tickets is itself the failure.
  if (total > 0 && openGaps.length === 0 && unmeasured.length > 0) {
    problems.push('BLIND SPOT (BS-2): no open instrument gaps. A ledger with nothing left to '
      + 'instrument is not a finished ledger; it is a ledger that stopped asking.');
  }

  // BS-4 — coverage, REPORTED not gated. Forcing a card per row would produce fake cards.
  const withCard = entries.filter((e) => e.impact.tier === 'measured').length;
  notes.push(`coverage: ${withCard} of ${total} rows carry a Result Card`);
  notes.push(`open instrument gaps: ${openGaps.length}`);

  // Degenerate rows are REPORTED, not rejected — registerSelfCheck's explicit design choice.
  for (const e of unmeasured) {
    if (e.impact.readSites === 0 && e.liveness !== 'vestigial') {
      notes.push(`${e.labelId}: 0 read sites but liveness "${e.liveness}" — reach is degenerate, `
        + 'so its rank is carried entirely by cellCount. Check the consumer trace.');
    }
  }

  return { problems, notes };
};

// =============================================================================
// VERSION
// =============================================================================

export const LEDGER_EPOCH = 'LL-1';

/**
 * The hashed body. Line numbers are deliberately absent — see `labelEntryProblems`. `notes` are
 * excluded because they annotate rather than claim; everything a reader of an old artifact would
 * need to detect a change is in.
 */
export const canonicalLedgerBody = (entries = LABEL_LEDGER) => ({
  epoch: LEDGER_EPOCH,
  entries: entries.map((e) => ({
    labelId: e.labelId,
    title: e.title,
    site: e.site,
    sites: e.sites,
    keySpace: e.keySpace,
    foundation: e.foundation,
    foundationStatus: e.foundationStatus,
    provenance: e.provenance,
    liveness: e.liveness,
    impact: e.impact,
    status: e.status,
    resolvedBy: e.resolvedBy,
  })),
});

/** `LL-1+<12 hex>`. Async for the same reason `registerVersion` is — Web Crypto's digest is. */
export const ledgerVersion = async (entries = LABEL_LEDGER) => {
  const hash = await hashObject(canonicalLedgerBody(entries));
  return `${LEDGER_EPOCH}+${hash.replace('sha256:', '').slice(0, 12)}`;
};

export const LEDGER_VERSION_PATTERN = /^LL-\d+\+[0-9a-f]{12}$/;

export const isLedgerVersionShape = (v) =>
  typeof v === 'string' && LEDGER_VERSION_PATTERN.test(v);

// =============================================================================
// STATE CHANGES — both require evidence
// =============================================================================

/**
 * Resolve a row. Returns a NEW ledger; entries are frozen.
 *
 * Requires evidence and a note stating what is NOT covered, reusing `clearFalsifierBlocker`'s
 * contract verbatim (faultRegister.js:1763): raising a row costs nothing, so clearing one on
 * assertion alone is how a register gets quietly emptied.
 */
export const resolveLabel = ({
  labelId, commit, evidence = [], note, entries = LABEL_LEDGER,
}) => {
  const idx = entries.findIndex((e) => e.labelId === labelId);
  if (idx === -1) throw new Error(`resolveLabel: no row "${labelId}"`);
  if (!evidence.length) {
    throw new Error(`resolveLabel(${labelId}): evidence is required. Raising a row costs `
      + 'nothing, so resolving one on assertion alone is how a register gets quietly emptied.');
  }
  if (!note || !note.trim()) {
    throw new Error(`resolveLabel(${labelId}): a note stating what this does NOT cover is `
      + 'required. One of three cleared is not a row that came resolved.');
  }
  const next = entries.slice();
  next[idx] = buildLabelEntry({
    ...entries[idx], status: 'resolved', resolvedBy: { commit, evidence, note },
  });
  return Object.freeze(next);
};
