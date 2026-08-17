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
      readSites: 4,
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
      'readSites CORRECTED 2 -> 4 on 2026-08-17 by traceLabelReaders.mjs, on the first run of '
      + 'the instrument that defines the counting rule. The three sites the hand count missed '
      + 'are gameTreeConstants.js:61-63, where the `REALIZATION` back-compat alias reads 6 of '
      + 'these 30 cells. THE ALIAS HAS ZERO IMPORTERS anywhere in src/ or scripts/ — so 3 of '
      + 'the 4 sites are reach through dead code, and the live reach is gameTreeEquity.js:39 '
      + 'alone. The count stays mechanical and this note carries the interpretation, which is '
      + 'the same split `liveness` makes: a reach figure that quietly editorialised about '
      + 'which readers "really count" could not be reproduced by anyone.',
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

  // ===========================================================================
  // TRIAGE TRANCHE 1 (2026-08-17) — the game-tree and preflop core.
  //
  // Every `readSites` below is DERIVED by `traceLabelReaders.mjs`, never counted by hand, and
  // `check-label-ledger.sh` re-derives them on every run. Every `provenance` is quoted or cited
  // from the defining file; where the source states nothing, the row says NO STATED PROVENANCE
  // rather than supplying a plausible one, because a foundation invented rather than read is
  // `FAULT-constants-by-taste` wearing a new hat.
  //
  // THE PATTERN THE TRANCHE MADE VISIBLE, which no single row shows: the bucket-keyed tables in
  // gameTreeConstants.js and postflopNarrower.js are all founder estimates of ONE population,
  // read on the primary path, and they are the input side of exactly the decomposition WS-436
  // measured on the output side. WS-436 found the label channel carried no information and the
  // same-source continuous replacement was WORSE. These rows are where that result has to be
  // re-tested, one axis at a time, and they should be instrumented as a GROUP rather than
  // individually — ablating `POP_CALLING_RATES` alone while `BUCKET_EQUITY_ANCHORS` still keys
  // on the same five buckets measures a seam, not the axis.
  // ===========================================================================

  buildLabelEntry({
    labelId: 'LBL-pop-calling-rates',
    title: 'Bucket-keyed population calling rates — declared a founder estimate, on the primary path',
    site: { file: 'src/utils/exploitEngine/gameTreeConstants.js', symbol: 'POP_CALLING_RATES' },
    sites: ['src/utils/exploitEngine/gameTreeConstants.js::POP_CALLING_RATES'],
    keySpace: ['bucket'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'gameTreeConstants.js:97-101 states it outright: "PROVENANCE (2026-06-19 · '
      + 'WS-235 / FIND-023 / registry SRC-009): POP_CALLING_RATES + POP_BETTING_RATES are a '
      + 'FOUNDER ESTIMATE of the live 1/2 pool, NOT a measured dataset (author-estimate, '
      + 'Field-frame fallback). WS-235 Step 2 grounds them from observed hands." Step 2 has not '
      + 'run — the row is the record that it has not.',
    liveness: 'guarded',
    impact: buildUnmeasuredReach({
      readSites: 6,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'Ablate the five bucket rates to their combo-weighted mean (one number, no bucket '
          + 'axis) and re-score the paired decision set, differencing per decision — the same '
          + 'arm shape as WS-436 ran on the style axis. Ablate it TOGETHER with '
          + 'POP_BETTING_RATES and BUCKET_EQUITY_ANCHORS: they key on the same five buckets, so '
          + 'ablating one alone measures a seam between two survivors, not the bucket axis.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'exploitEngine/CLAUDE.md names using POP_CALLING_RATES[bucket] where per-combo equity is '
      + 'available as an anti-pattern by name. The table is still read at six sites.',
      'Read at actionClassifier.js:257, gameTreeContext.js:104,118, gameTreeDepth2.js:443, '
      + 'gameTreeEquity.js:166, gameTreeSizingHelpers.js:140.',
      '`guarded`, not `unconditional`: the docblock says "when villain model unavailable". The '
      + 'guard is what makes it a FALLBACK, and a fallback on an unmodelled villain is the case '
      + 'the founder actually faces at a live table with a new player.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-pop-betting-rates',
    title: 'Bucket-keyed population betting rates — the same declared estimate, the other side of the node',
    site: { file: 'src/utils/exploitEngine/gameTreeConstants.js', symbol: 'POP_BETTING_RATES' },
    sites: ['src/utils/exploitEngine/gameTreeConstants.js::POP_BETTING_RATES'],
    keySpace: ['bucket'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'Covered by the same PROVENANCE block as POP_CALLING_RATES '
      + '(gameTreeConstants.js:97-101) — FOUNDER ESTIMATE of the live 1/2 pool, explicitly NOT '
      + 'a measured dataset. Its own comment adds only poker prose: "Air bluffs more than it '
      + 'calls (25%) — opportunistic stabs when checked to."',
    liveness: 'guarded',
    impact: buildUnmeasuredReach({
      readSites: 6,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'Same ablation arm as LBL-pop-calling-rates, run in the same group — betting and '
          + 'calling rates are the two branches of one node and moving one alone changes the '
          + 'node`s implied aggression as a side effect.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'Read at gameTreeContext.js:105,130, gameTreeDepth2.js:567,1552, gameTreeEquity.js:192,218.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-bucket-equity-anchors',
    title: 'Bucket-keyed hero-equity anchors — no provenance at all, seven read sites',
    site: {
      file: 'src/utils/exploitEngine/gameTreeConstants.js', symbol: 'BUCKET_EQUITY_ANCHORS',
    },
    sites: ['src/utils/exploitEngine/gameTreeConstants.js::BUCKET_EQUITY_ANCHORS'],
    keySpace: ['bucket'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. The whole comment is "Bucket equity anchors: hero\'s '
      + 'equity AGAINST each villain bucket. Population fallback — used only when dynamic '
      + 'enrichment is unavailable." No measurement, no citation, no sample. Founder estimate '
      + 'by omission — and note it sits directly beside POP_CALLING_RATES, which DOES carry a '
      + 'provenance block, so the omission is not a house style.',
    liveness: 'guarded',
    impact: buildUnmeasuredReach({
      readSites: 7,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'It states an equity, so unlike a rate table it has a directly computable truth: '
          + 'compute hero equity against each bucket\'s combo set from the range engine on the '
          + 'corpus board set and difference against the five anchors. That is a CALIBRATION '
          + 'check, not an ablation, and it can run without a re-score.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'Highest reach in this tranche among the bucket tables: read at gameTreeContext.js:174,271, '
      + 'gameTreeEquity.js:134,166,192,218, preflopFlopEV.js:473.',
      'The falsifier is cheaper here than anywhere else in the tranche — an equity claim can be '
      + 'checked against the engine that already computes equity, with no EV re-score at all. '
      + 'That it has never been run is the finding.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-texture-realization',
    title: 'Board-texture label x position -> equity-realization multiplier',
    site: { file: 'src/utils/exploitEngine/gameTreeConstants.js', symbol: 'TEXTURE_REALIZATION' },
    sites: ['src/utils/exploitEngine/gameTreeConstants.js::TEXTURE_REALIZATION'],
    keySpace: ['texture', 'position'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. The comment gives poker prose only — "Wet boards hurt OOP '
      + 'more (draws threaten, less pot control). Dry boards help OOP (made hands hold up, fewer '
      + 'scare cards)" — with no measurement and no sample.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 3,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'Ablate to 1.0 (no texture adjustment) and re-score the paired decision set. It '
          + 'multiplies REALIZATION_TABLE at gameTreeEquity.js:44-46, so run it as a second arm '
          + 'of the WS-407 realization ablation rather than as a separate study.',
        ticket: 'WS-407',
      },
    }),
    notes: [
      'Read at gameTreeEquity.js:44,45,46 — all three on the realization path, multiplicatively '
      + 'on top of LBL-realization-table. Two unprovenanced founder-estimate tables compose on '
      + 'the same number, which neither row shows on its own.',
      'The three-way texture label (wet/dry/paired) is itself a THRESHOLD-AS-LABEL downstream of '
      + 'a board classifier — the hole POKER_THEORY §17.3 names and this gate does not close.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-action-multipliers',
    title: 'Action x bucket Dirichlet-prior multipliers — labelled LEGACY, still read on the model path',
    site: { file: 'src/utils/exploitEngine/postflopNarrower.js', symbol: 'ACTION_MULTIPLIERS' },
    sites: ['src/utils/exploitEngine/postflopNarrower.js::ACTION_MULTIPLIERS'],
    keySpace: ['action', 'bucket'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. Introduced under the banner comment "LEGACY MULTIPLIERS '
      + '(kept for villainDecisionModel Dirichlet priors)" (postflopNarrower.js:616) and a bare '
      + '"Action multipliers: [nuts, strong, marginal, draw, air]". No measurement, no citation.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 7,
      cellCount: 20,
      primaryPath: true,
      instrument: {
        what: 'These seed the villainDecisionModel Dirichlet exactly as STYLE_PRIORS did, so the '
          + 'WS-436 instrument applies unchanged: paired ΔLL against a flat seed over the same '
          + '10,147 corpus decisions, plus advice-parity on the 130-decision set. WS-436 already '
          + 'built and validated that harness — this is a re-run on a different seed table, not '
          + 'a new instrument.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'Read at postflopNarrower.js:644,678,681, villainDecisionModel.js:623,674,675, and '
      + 'scripts/backtest/teachableArmsProbe.mjs:353.',
      'THE MOST DIRECTLY TESTABLE ROW IN THE TRANCHE, and the reason it is here: WS-436 measured '
      + 'that a label-keyed Dirichlet SEED carried no villain-action information. This is a '
      + 'label-keyed Dirichlet seed. The result does not transfer automatically — style keyed on '
      + 'a player, this keys on a hand-strength bucket — but the harness does, and nobody has '
      + 'pointed it at this table.',
      'The word LEGACY in the banner is not a provenance and is not a deprecation: it has seven '
      + 'live readers, none guarded.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-default-continuation-rates',
    title: 'Action-keyed population continuation rates — the constant tests pin themselves to',
    site: {
      file: 'src/utils/exploitEngine/postflopNarrower.js', symbol: 'DEFAULT_CONTINUATION_RATES',
    },
    sites: ['src/utils/exploitEngine/postflopNarrower.js::DEFAULT_CONTINUATION_RATES'],
    keySpace: ['action'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE for the VALUES. The comment justifies only the EXPORT: '
      + '"Default continuation rates per action (population averages). Exported so tests can '
      + 'state expectations RELATIVE to the rate a weight is pinned to, rather than against '
      + 'absolute constants that quietly encode the current floor (WS-291)." The inline notes '
      + 'are restatements ("~55% defend vs cbet"), not sources.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 3,
      cellCount: 4,
      primaryPath: true,
      instrument: {
        what: 'The four rates are directly measurable on the corpus as marginal action '
          + 'frequencies — no ablation and no re-score needed, just a count with its conditioning '
          + 'set. Compare each against its corpus (k, n) and report the gap; only then decide '
          + 'whether an EV arm is worth running.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'Read at postflopNarrower.js:886 and heroRangeBuilder.js:60,213.',
      'A SECOND-ORDER RISK the WS-291 comment half-names: tests state expectations relative to '
      + 'this table, so if the values are wrong the tests are calibrated to the wrong floor and '
      + 'will keep passing. Correcting the numbers is therefore a test-suite event, not only an '
      + 'engine one — which is a reason to measure it early, not late.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-outs-scaling',
    title: 'Action-keyed per-out scaling on the bucket multipliers',
    site: { file: 'src/utils/exploitEngine/postflopNarrower.js', symbol: 'OUTS_SCALING' },
    sites: ['src/utils/exploitEngine/postflopNarrower.js::OUTS_SCALING'],
    keySpace: ['action'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. "Per-action scaling: how much each draw out adjusts the '
      + 'multiplier", with worked arithmetic in the inline comments ("8 outs: +0.20, 15 outs: '
      + '+0.375 (semi-bluff)") that shows the CONSEQUENCE of the constant and not its source.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 4,
      primaryPath: true,
      instrument: {
        what: 'Ablate to zero (outs do not scale the multiplier) as a sub-arm of the '
          + 'LBL-action-multipliers ablation — it modifies that table at postflopNarrower.js:649 '
          + 'and has no independent meaning.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'Module-private, one read site — and that read site is inside the multiplier it scales. '
      + 'Low reach is a statement about how much CODE touches it, never about whether it matters: '
      + 'a per-out scalar on the draw bucket moves every semi-bluff decision the engine prices.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-fold-rate-thresholds',
    title: 'Fold-rate cut points that MANUFACTURE the veryLow..veryHigh labels',
    site: { file: 'src/utils/exploitEngine/villainModelData.js', symbol: 'FOLD_RATE_THRESHOLDS' },
    sites: ['src/utils/exploitEngine/villainModelData.js::FOLD_RATE_THRESHOLDS'],
    keySpace: ['foldRateBand'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'Poker prose, no measurement: "Fold-rate classification thresholds for '
      + 'human-readable language. Poker theory: MDF at 75% pot ≈ 0.43, so \'normal\' ≈ '
      + 'population fold rate. \'high\' (0.55) = exploitably overfolds; \'veryHigh\' (0.65) = '
      + 'auto-profit bluffs." The MDF figure is a derivation for ONE cut point; the other four '
      + 'are unsourced.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 9,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'First establish whether any consumer is a DECISION rather than a phrase. '
          + 'villainProfileBuilder.js:68-72 is the site to read: if a manufactured band feeds a '
          + 'numeric parameter there, this is a threshold-as-label defect and the instrument is '
          + 'an ablation to the continuous fold rate. If every consumer only renders language, '
          + 'the row resolves to `display-only` — WITH the evidence, per resolveLabel.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'THIS IS THE THRESHOLD-AS-LABEL FORM, caught only because the cut points happen to live in '
      + 'a keyed numeric table. `getSPRZone` does the identical thing from SPR_BAND_EDGES and is '
      + 'INVISIBLE to the harvest (POKER_THEORY §17.3). The two belong to one family and the gate '
      + 'sees one of them — that asymmetry is the clearest statement of the hole that exists.',
      'Read at thoughtCatalog.js:175,271 and villainProfileBuilder.js:68,69,70,71,72,164.',
      'The docblock says the labels are "for human-readable language", which if true across all '
      + 'nine sites makes this display-only. The row exists because that claim is untested and '
      + 'the file that would falsify it is the profile BUILDER, not a renderer.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-population-curve',
    title: 'The fold-vs-sizing population curve — FITTED and hold-out scored, and the strongest foundation in the engine',
    site: { file: 'src/utils/exploitEngine/villainModelData.js', symbol: 'POPULATION_CURVE' },
    sites: ['src/utils/exploitEngine/villainModelData.js::POPULATION_CURVE'],
    keySpace: ['curveParameter'],
    foundation: 'fitted-curve',
    foundationStatus: 'measured-supported',
    provenance: 'A fit with a stated objective and a HOLD-OUT score, quoted from the docblock: '
      + 'residual-vs-sizing slope +0.1409 -> +0.0078, Brier 0.24054 -> 0.23530 on 316,178 '
      + 'held-out decisions. The asymmetric pair beats both the symmetric fallback (0.24127) and '
      + 'the best free symmetric curve (0.23689).',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 13,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'The FOUNDATION is measured; the EV IMPACT is not, and those are different '
          + 'questions. The instrument for the second is a paired re-score against the flat '
          + 'constant the fit replaced, which the fit itself never ran — Brier is a calibration '
          + 'score, not bb/100.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'A `measured-supported` foundation carrying an `unmeasured` impact is not a contradiction '
      + 'and is the combination this ledger exists to be able to express: we know the curve fits, '
      + 'we do not know what fitting it is worth in EV.',
      'TRANSFERRED, NOT MEASURED, and the source says so: "The corpus is online cash, July 2009, '
      + '50NL, two sites, 3-9 handed. The founder plays live 9-handed 1/2-1/3." Per WS-259 it '
      + 'supplies SHAPE only — d(fold)/d(sizing) — while the LEVEL comes from the §6.5a tier '
      + 'hierarchy. That split is why POPULATION_PRIORS.bet.fold and STAT_PRIORS.foldToCbet were '
      + 'deliberately NOT changed by the same fit.',
      'Residual stated by the source rather than hidden: below ~0.15x pot the curve over-predicts '
      + 'folding by 3-13 points. The named fix is re-expressing it in the price s/(1+2s) (§6.2), '
      + 'a functional-form change deliberately not taken.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-population-curve-raise',
    title: 'The facing-a-RAISE fold curve — separately fitted, and deliberately unscaled',
    site: {
      file: 'src/utils/exploitEngine/villainModelData.js', symbol: 'POPULATION_CURVE_RAISE',
    },
    sites: ['src/utils/exploitEngine/villainModelData.js::POPULATION_CURVE_RAISE'],
    keySpace: ['curveParameter'],
    foundation: 'fitted-curve',
    foundationStatus: 'measured-supported',
    provenance: 'WS-402: "A separate population, fitted separately, and never previously merged '
      + '— which is how the engine came to price hero\'s raises with the [bet curve]." The '
      + 'docblock also records a deliberate NON-action: "NO PER-STYLE SCALING IS APPLIED TO THIS '
      + 'CURVE, DELIBERATELY... borrowing the bet multipliers would attach an unmeasured '
      + 'adjustment to a freshly measured curve."',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'Same shape as LBL-population-curve: paired re-score against the previous behaviour '
          + '(the bet curve applied to raises), which is what WS-402 corrected without pricing.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'One read site, gameTreeEvaluator.js:705 — and the WS-402 note says that before this curve '
      + 'existed that site used the BET curve. A single read site gated the correctness of every '
      + 'raise the engine priced.',
      'The refusal to borrow per-style multipliers is the ledger\'s own doctrine appearing '
      + 'spontaneously in engine code a year earlier: do not attach an unmeasured adjustment to a '
      + 'measured foundation.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-population-priors',
    title: 'Facing-state x action population priors — 46 read sites, the widest reach in the engine',
    site: { file: 'src/utils/exploitEngine/villainModelData.js', symbol: 'POPULATION_PRIORS' },
    sites: ['src/utils/exploitEngine/villainModelData.js::POPULATION_PRIORS'],
    keySpace: ['facingAction', 'action'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE at the definition. It is named in the POPULATION_CURVE '
      + 'docblock as a thing deliberately NOT updated by that fit ("`POPULATION_PRIORS.bet.fold` '
      + 'and `STAT_PRIORS.foldToCbet` are deliberately NOT changed here"), which cites its ROLE '
      + 'in the tier hierarchy without ever citing its source.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 46,
      cellCount: 8,
      primaryPath: true,
      instrument: {
        what: 'Eight marginal action frequencies, directly countable on the corpus with their '
          + 'conditioning sets — the same cheap check as LBL-default-continuation-rates and it '
          + 'should run in the same pass. An EV arm only after the gap is known.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'FORTY-SIX READ SITES — the largest reach of any construct in the harvest, and the row '
      + 'exists because nothing anywhere said so. This is the number the ledger was built to '
      + 'surface: an unprovenanced eight-cell founder estimate is the engine\'s single most '
      + 'depended-upon table.',
      'It is explicitly the LEVEL half of the split POPULATION_CURVE describes: the curve was '
      + 'allowed to import an online-mined SHAPE precisely because the level stays here. So the '
      + 'quality of the measured curve is bounded by the quality of this unmeasured table.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-stat-priors',
    title: 'Per-stat Beta priors — a declared estimate carrying an imported Reference tier above it',
    site: { file: 'src/utils/exploitEngine/bayesianConfidence.js', symbol: 'STAT_PRIORS' },
    sites: ['src/utils/exploitEngine/bayesianConfidence.js::STAT_PRIORS'],
    keySpace: ['stat'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'The docblock declares the tier and its limit: these "are the prior the blend '
      + 'starts from and degrades to when a segment is thin — still NOT a measured dataset on '
      + 'their own." It also records what remains unimproved: "(The range-grid priors and preflop '
      + 'fold/limp/open trees remain pure founder estimate — follow-up.)" WS-263 (2026-07-25) '
      + 'inserted an imported Reference tier (handhqReferencePool.js, SRC-011) above it for '
      + 'online numeric-stake segments — POKER_THEORY §6.5a.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 7,
      cellCount: 18,
      primaryPath: true,
      instrument: {
        what: 'Nine Beta(alpha, beta) pairs, each a claim about a population mean AND a '
          + 'confidence. Both are measurable on the corpus: the mean by counting, the effective '
          + 'weight by the method-of-moments overdispersion estimate PER_STAT_PRIOR_WEIGHT '
          + 'already uses. That measurement exists and has never been turned on this table.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'Read at tendencyCalculations.js:308,313, poolBaseline.js:554, preflopFoldResolver.js:238,405, '
      + 'statRules.js:35, and scripts/backtest/statPriorScore.mjs:125 — note the last one: a '
      + 'scoring script already points at it.',
      'THE ROW THAT PAIRS WITH LBL-per-stat-prior-weight, and the pairing is the point: the '
      + 'WEIGHT of these priors was measured (12.9M hands, N_eff, the flat 200 refuted as ~20x '
      + 'too confident) while the LOCATION they shrink toward was not. Half a prior measured is '
      + 'the kind of asymmetry only a ledger with both rows in it makes visible.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-per-stat-prior-weight',
    title: 'Per-stat prior weights — MEASURED on 12.9M hands, and the row other estimates should be held to',
    site: { file: 'src/utils/exploitEngine/poolBaseline.js', symbol: 'PER_STAT_PRIOR_WEIGHT' },
    sites: ['src/utils/exploitEngine/poolBaseline.js::PER_STAT_PRIOR_WEIGHT'],
    keySpace: ['stat'],
    foundation: 'mined-corpus',
    foundationStatus: 'measured-supported',
    provenance: 'The docblock states method, source and a refutation: "MEASURED, not hand-tuned '
      + '(WS-262 mining, docs/research/mass-pool-data-2026-07-25.md): method-of-moments on '
      + 'between-player overdispersion across 12.9M imported hands — N_eff = '
      + 'mean(1-mean)/sd_between^2 - 1 over players with n >= 30... The former flat cap of 200 '
      + 'was refuted as ~20x too confident; PRIOR_WEIGHT = 10 was validated (vpip)."',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 6,
      primaryPath: true,
      instrument: {
        what: 'No defect suspected. Two open questions, both measurable: (1) only vpip was '
          + 'VALIDATED, the other five carry the same 10 by assumption — re-run the estimator '
          + 'per stat; (2) transfer, since 12.9M online hands is not the founder\'s live pool.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'THIRD COUNTER-EXAMPLE, and the cheapest one to copy: it states the estimator, the sample, '
      + 'the population, the prior belief it refuted, and by how much. Any row above could have '
      + 'been written this way for the cost of a paragraph at the time.',
      'The uniform 10 across six stats is the residue: measured for vpip, propagated to the rest. '
      + 'That is a materially better position than an estimate, and it is not the same as six '
      + 'measurements.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-preflop-raise-sizes',
    title: 'Sizing-context label -> raise multiplier, module-private, seven read sites',
    site: { file: 'src/utils/exploitEngine/preflopAdvisor.js', symbol: 'PREFLOP_RAISE_SIZES' },
    sites: ['src/utils/exploitEngine/preflopAdvisor.js::PREFLOP_RAISE_SIZES'],
    keySpace: ['sizingContext'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE for the VALUES. The docblock is entirely about a UNIT '
      + 'HAZARD — which group is a bb multiple and which is a multiple of the bet faced, and that '
      + 'the first "must go through `resolveBigBlind` — never `potSize * multiplier`, which '
      + 'silently reads a bb multiple as a pot multiple and inflates every open (at 1/2 an '
      + 'unopened pot is 1.5bb, so a \'2.5bb\' open became 3.75bb)". A recorded bug, not a source.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 7,
      cellCount: 20,
      primaryPath: true,
      instrument: {
        what: 'Ten sizing contexts x two-element ranges are directly comparable to corpus sizing '
          + 'distributions for the same contexts — a distributional check with (k, n), no '
          + 're-score. Where the corpus disagrees, THEN price the difference.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'One of the 42-of-128 MODULE-PRIVATE tables (33%) that motivated harvesting by AST rather '
      + 'than by export tag — harvestLabelConstructs.mjs:15-19 names this exact symbol as the '
      + 'reason a gate keyed on exports would miss a third of the surface.',
      'Read at preflopAdvisor.js:420,504,583,637,673,674,675.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-positional-fold-to-3bet',
    title: 'Position-matchup label -> fold-to-3bet rate — the §7.1 anti-pattern in its plainest form',
    site: {
      file: 'src/utils/exploitEngine/preflopFoldResolver.js', symbol: 'POSITIONAL_FOLD_TO_3BET',
    },
    sites: ['src/utils/exploitEngine/preflopFoldResolver.js::POSITIONAL_FOLD_TO_3BET'],
    keySpace: ['positionMatchup'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE beyond an assertion of calibration with no calibrator: '
      + '"Fold-to-3bet rates by hero->villain positional matchup. Calibrated for typical 1/2 live '
      + 'dynamics. Key insight: UTG opens tight and folds the wide part to 3-bets, while BTN '
      + 'opens wide and defends wide." No sample, no date, no method. "Calibrated" here is a '
      + 'claim the file cannot support.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 2,
      cellCount: 10,
      primaryPath: true,
      instrument: {
        what: 'Ten matchup cells are directly countable in the corpus with (k, n) per cell — the '
          + 'same shape handhqReferencePool already publishes for opener-facing-3bet. The '
          + 'instrument exists and is pointed at a neighbouring table; point it here.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'POKER_THEORY §7.1 and exploitEngine/CLAUDE.md forbid deriving a villain decision from a '
      + 'POSITION LABEL — "compute from game state" — and this table is a position label keyed '
      + 'directly to a fold rate, read on the primary preflop path. It is the anti-pattern in its '
      + 'least disguised form, and prose forbade it for months while it sat here.',
      'HANDHQ_OPENER_FACING_3BET (LBL-handhq-reference-pool) measures a closely related estimand '
      + 'from a real corpus and does not feed this resolver. One measured table and one estimate '
      + 'answering nearly the same question, not connected — visible only once both are rows.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-positional-fold-to-4bet',
    title: 'Villain 3-bet position label -> fold-to-4bet rate',
    site: {
      file: 'src/utils/exploitEngine/preflopFoldResolver.js', symbol: 'POSITIONAL_FOLD_TO_4BET',
    },
    sites: ['src/utils/exploitEngine/preflopFoldResolver.js::POSITIONAL_FOLD_TO_4BET'],
    keySpace: ['position'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. Poker prose only: "Fold-to-4bet rates by villain\'s 3-bet '
      + 'position. EP 3-bettors have tight 3-bet ranges -> fold less to 4-bets. LP 3-bettors '
      + 'often 3-bet light -> fold more to 4-bets."',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'Same corpus count as LBL-positional-fold-to-3bet, one node deeper. Run them '
          + 'together: 4-bet cells are far sparser, so the honest output may be "n too small", '
          + 'which is itself a finding about how much the engine should lean on this table.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'The sparsity is the risk: a five-cell table over 4-bet pots is exactly where a corpus '
      + 'count will be thin and where a founder estimate is therefore hardest to displace. That '
      + 'is a reason to know the n, not a reason to skip the measurement.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-faced-raise-frequencies',
    title: 'Position -> fold/coldCall/3bet frequencies when facing a raise',
    site: {
      file: 'src/utils/rangeEngine/populationPriors.js', symbol: 'FACED_RAISE_FREQUENCIES',
    },
    sites: ['src/utils/rangeEngine/populationPriors.js::FACED_RAISE_FREQUENCIES'],
    keySpace: ['position', 'action'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. "Action frequencies when FACING a raise. fold + coldCall + '
      + 'threeBet = 1.0 per position." The comment states a normalisation constraint, not a '
      + 'source. bayesianConfidence.js:44 independently records that "the preflop '
      + 'fold/limp/open trees remain pure founder estimate — follow-up", which is this family.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 4,
      cellCount: 15,
      primaryPath: true,
      instrument: {
        what: 'Fifteen cells, all directly countable on the corpus by position with (k, n). Run '
          + 'as one pass with NO_RAISE_FREQUENCIES and SUBCLASS_SPLIT — they partition the same '
          + 'preflop decision and measuring one alone leaves the partition inconsistent.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'Read at populationPriors.js:570,571, preflopFoldResolver.js:233, bayesianUpdater.js:85 — '
      + 'so it crosses the rangeEngine/exploitEngine boundary, which no single file shows.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-no-raise-frequencies',
    title: 'Position -> fold/limp/open frequencies when no raise has been seen',
    site: { file: 'src/utils/rangeEngine/populationPriors.js', symbol: 'NO_RAISE_FREQUENCIES' },
    sites: ['src/utils/rangeEngine/populationPriors.js::NO_RAISE_FREQUENCIES'],
    keySpace: ['position', 'action'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. "Action frequencies when NO raise has been seen. fold + '
      + 'limp + open = 1.0 per position." A normalisation constraint, not a source. Same family '
      + 'as the "pure founder estimate" the bayesianConfidence docblock defers.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 15,
      primaryPath: true,
      instrument: {
        what: 'Same corpus count as LBL-faced-raise-frequencies, in the same pass, for the same '
          + 'reason — the two tables partition the preflop node between them.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'One read site (bayesianUpdater.js:75) and fifteen cells: reach ranks it low and it seeds '
      + 'the preflop prior grid for every unmodelled villain.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-faced-raise-rate',
    title: 'Position -> probability of facing a raise — VESTIGIAL, zero readers, still exported',
    site: { file: 'src/utils/rangeEngine/populationPriors.js', symbol: 'FACED_RAISE_RATE' },
    sites: ['src/utils/rangeEngine/populationPriors.js::FACED_RAISE_RATE'],
    keySpace: ['position'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE, and the comment concedes the point: "How often does a '
      + 'player in this position face a raise before acting? Table-dependent; these are '
      + 'reasonable live 1/2 defaults."',
    liveness: 'vestigial',
    impact: buildUnmeasuredReach({
      readSites: 0,
      cellCount: 5,
      primaryPath: false,
      instrument: {
        what: 'Nothing to measure while nothing reads it. The instrument is a DELETION with a '
          + 'recorded falsifier: remove the export, run the suite, and if nothing breaks resolve '
          + 'this row with the commit as evidence. If something does break, the trace missed a '
          + 'reader and that is a defect in traceLabelReaders.mjs worth more than the table.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'FOUND BY THE TRACE, not by reading: zero production read sites anywhere in src/ or '
      + 'scripts/. It is exported, so nothing warns, and it sits in the middle of a file whose '
      + 'other tables are live.',
      'The only genuinely vestigial NAMED table in the harvest — the ten other zero-reader '
      + 'candidates the trace first reported were `leakRules/*.js::rule`, and they were a FALSE '
      + 'vestigial caused by `import.meta.glob`. That near-miss is why this row states the '
      + 'deletion falsifier instead of just recommending deletion.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-subclass-split',
    title: 'Parent action x position -> subclass shares, 25 cells behind one read site',
    site: { file: 'src/utils/rangeEngine/populationPriors.js', symbol: 'SUBCLASS_SPLIT' },
    sites: ['src/utils/rangeEngine/populationPriors.js::SUBCLASS_SPLIT'],
    keySpace: ['parentAction', 'position', 'subclass'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE for the NUMBERS, but an unusually complete statement of '
      + 'the STRUCTURE they must satisfy: squeeze requires "a raise AND a caller already in front '
      + 'of you"; limpReraise share "FALLS with position"; "BB cannot limp at all '
      + '(rangeEngine/CLAUDE.md §5), so its limpReraise share is exactly 0 — the subclass grid '
      + 'stays empty by construction"; isoRaise share "RISES with position". Structural '
      + 'constraints are derivations, and they are not measurements of the shares.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 25,
      primaryPath: true,
      instrument: {
        what: 'Countable per cell on the corpus, but the CONSTRAINTS are testable first and for '
          + 'free: monotonicity in position for limpReraise and isoRaise, and the exact zero at '
          + 'BB. A structural violation would be a defect independent of any sample size.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'DEC-025 Amd 1 governs the shape: a subclass grid is CARVED FROM THE PARENT and split '
      + 'against n_parent, never built independently and never normalised into a distribution. '
      + 'This table is the split itself, so an error here mis-carves every child grid.',
      'One read site (bayesianUpdater.js:242) gating 25 cells across five positions and five '
      + 'subclasses — the widest cell-count-per-reader ratio in the tranche.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-open-rate-prior',
    title: 'The Beta prior regularising position-aware open-rate detection',
    site: { file: 'src/utils/rangeEngine/traitDetector.js', symbol: 'OPEN_RATE_PRIOR' },
    sites: ['src/utils/rangeEngine/traitDetector.js::OPEN_RATE_PRIOR'],
    keySpace: ['betaParameter'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'The reasoning is stated in full and the value is still a judgment: it replaces '
      + 'the "old hard n < 5 -> bail gate (FIND-011)" so that "small samples stay near the prior, '
      + 'so noise cannot manufacture a positional spread"; the weight "is heavier than '
      + 'rangeEngine\'s PRIOR_WEIGHT=10 single-rate convention on purpose — detecting a '
      + '*difference* between two rates needs more regularization than estimating one rate."',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 2,
      cellCount: 2,
      primaryPath: true,
      instrument: {
        what: 'This one has a proper statistical falsifier rather than a corpus count: simulate '
          + 'players with NO positional spread at the stated sample sizes and measure the '
          + 'false-positive rate of the >0.5 detection gate. If it exceeds the intended level '
          + 'the prior is too light, and the estimator answers directly.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'Lowest cell count in the tranche (2) and one of the better-argued constants in the repo. '
      + 'It is here because the argument is about the DIRECTION of the choice (heavier than 10) '
      + 'and not about the value, and a false-positive rate is measurable rather than arguable.',
      'It regularises a DIFFERENCE between two rates, which is the case where a bad prior is '
      + 'least visible: the trait either fires or it does not, and nothing reports how often it '
      + 'fires on noise.',
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
