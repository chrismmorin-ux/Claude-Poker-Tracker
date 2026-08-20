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
  'outside-engine-path', //  label-shaped, but no consumer reaches a strategy/EV parameter
  'not-yet-triaged', //      REQUIRES a ticket; aged out by the STALE EXCLUSION gate
]);

/**
 * `outside-engine-path` — added 2026-08-17, during the WS-445 triage, because the harvester
 * PROMISED this reason and the closed set did not contain it.
 *
 * `harvestLabelConstructs.mjs:70-74` justifies its deliberately broad roots by saying the cost
 * is "~20 constructs in `shapeLanguage`, `playerMatching`, `claimAdjudication` and
 * `standardOfRecord` that are not engine-parameter paths; they become exclusions carrying a
 * stated reason". No such reason existed. They are genuinely label-shaped — a feature label
 * keyed to a numeric weight is exactly the harvested shape — so `not-a-label` would have been a
 * FALSE statement about them, and `display-only` is false too where the weights drive matching.
 *
 * THE BOUNDARY, stated tightly so this does not become the escape hatch every exclusions list
 * eventually grows. It means: the construct is label-shaped, and no consumer of it reaches a
 * strategy, range, or EV parameter. Player identification, avatar rendering and range-shape
 * descriptors qualify. "It is only a fallback", "it is legacy", and "it is low reach" do NOT —
 * those are properties recorded by `liveness` and `readSites` on a ROW.
 *
 * It is reversible by construction: widen the engine into one of these areas and its constructs
 * become ledger rows in the change that does so, exactly as ROOTS widens.
 */

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
    // FOUR CONSTRUCTS, ONE ROW. They are generated together, from one corpus, under one
    // contract ("hand-edits forbidden"), and their open question is identical. Splitting them
    // into four rows would quadruple the row count without adding a single decision, and would
    // let a reader think four different things had been checked.
    sites: [
      'src/utils/exploitEngine/handhqReferencePool.js::HANDHQ_OPENER_FACING_3BET',
      'src/utils/exploitEngine/handhqReferencePool.js::HANDHQ_FOLD_VS_PREFLOP_RAISE_SPREAD',
      'src/utils/exploitEngine/handhqReferencePool.js::HANDHQ_THREE_BET_SPREAD',
      'src/utils/exploitEngine/handhqReferencePool.js::HANDHQ_FOLD_TO_CBET_SPREAD',
      'src/utils/exploitEngine/handhqReferencePool.js::HANDHQ_REFERENCE_META',
    ],
    keySpace: ['stake', 'seatBucket'],
    foundation: 'mined-corpus',
    foundationStatus: 'generated',
    provenance: 'GENERATED static Reference-class data (SRC-011): per-stake x seat-bucket (k, n) '
      + 'aggregates from the WS-262 HandHQ mining, regenerated via '
      + 'scripts/generate-handhq-reference.mjs. Hand-edited values and logic are both forbidden '
      + 'in the file by its own contract.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 17,
      cellCount: 43,
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
      'Reach 17 = OPENER_FACING_3BET 6 + FOLD_TO_CBET_SPREAD 4 + THREE_BET_SPREAD 4 + '
      + 'FOLD_VS_PREFLOP_RAISE_SPREAD 2 + REFERENCE_META 1, summed by traceLabelReaders.mjs '
      + 'across all five claimed sites. Verified as a sum, so none of the four can drift '
      + 'unwatched behind the one the row is named for.',
      'THE FILE MODELS THE DISCIPLINE THE REST OF THE LEDGER IS ASKING FOR, in its own words: '
      + '"A weakness rule judges ONE PLAYER, so the question \'is this player unusual\' has to '
      + 'be asked against the distribution over players. The two means differ materially — 82.3% '
      + 'hand-weighted against 75.8% player-weighted — and only the second has a spread '
      + 'attached." Each table states its conditioning set, its player minimum, and what it may '
      + 'NOT be used for.',
      'It also corroborates a neighbouring row rather than asserting alone: the implied prior '
      + 'weight from the fold-vs-preflop-raise spread, mean(1-mean)/sd^2 - 1, is 8.0 — arrived '
      + 'at independently of the PER_STAT_PRIOR_WEIGHT.foldTo3Bet = 10 that WS-262 measured by '
      + 'method of moments. Two methods, one answer, and the file says so.',
      'A LIMIT THE ROW MUST CARRY: HANDHQ_FOLD_TO_CBET_SPREAD rests on ~19k players against '
      + '~106k for foldTo3Bet, "a property of the gate rather than of the corpus" — clearing '
      + 'n >= 30 flop c-bets faced is much harder than n >= 30 preflop opportunities. Its sd is '
      + 'correspondingly less well determined and `players` must be quoted beside any bar '
      + 'derived from it. One row, four tables, and NOT four equally solid tables.',
      'THREE_BET_SPREAD adds a shape warning that a moments-only reading would miss: the '
      + 'quantity is bounded at 0 and right-skewed with sd ~ mean, so mean - 1sd is 0.04% for '
      + 'full-ring — below the smallest rate any finite sample can express. A symmetric bar is '
      + 'the wrong instrument and preflopFoldQuantities.js moment-matches a Beta instead.',
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
    labelId: 'LBL-four-bet-frequencies',
    title: 'Position -> fold/call4/fourBet frequencies when facing a 3-bet — the one MEASURED row in this file, and now VESTIGIAL: its single reader was removed by the fix that corrected it',
    site: {
      file: 'src/utils/rangeEngine/populationPriors.js', symbol: 'FOUR_BET_FREQUENCIES',
    },
    sites: ['src/utils/rangeEngine/populationPriors.js::FOUR_BET_FREQUENCIES'],
    keySpace: ['position', 'action'],
    foundation: 'mined-corpus',
    foundationStatus: 'generated',
    provenance: 'WS-521 / WS-270, the third preflop tree. Derived from '
      + 'exploitEngine/handhqReferencePool.js HANDHQ_OPENER_FACING_3BET, `full` seat bucket '
      + '(n = 398,577 — the 9-handed bucket), renormalised over fold/call/fourBet after '
      + 'excluding that row\'s declared `residual` of 2,897: fold 171605/395680 = 0.4337, '
      + 'call4 176091/395680 = 0.4450, fourBet 47984/395680 = 0.1213. It is the ONLY frequency '
      + 'table in populationPriors.js with a measured foundation — NO_RAISE_FREQUENCIES and '
      + 'FACED_RAISE_FREQUENCIES are both founder-estimate/undeclared (rows above). '
      + 'TRANSCRIBED, NOT READ: the source is generated and this table is a hand-copied '
      + 'renormalisation of it, because rangeEngine importing from exploitEngine would be an '
      + 'upward dependency across the analysis/exploit boundary. The transcription is pinned by '
      + 'populationPriors.test.js "matches the MEASURED HandHQ row it is derived from", which '
      + 'recomputes all three quotients from the raw counts — so a regeneration that moves the '
      + 'source fails the suite rather than drifting silently.',
    liveness: 'vestigial',
    impact: buildUnmeasuredReach({
      readSites: 0,
      cellCount: 15,
      primaryPath: false,
      instrument: {
        what: 'TWO open questions, and they are different in kind. (1) TRANSFER, shared with '
          + 'every SRC-011 row: the corpus is online 2009 and the founder game is live 9-handed '
          + '1/2-1/3, so a live reading off this table is transferred, not measured — the '
          + 'FAULT-population-mismatch falsifier applies unchanged. (2) CONDITIONING SET, and '
          + 'this one is specific to this row: HANDHQ_OPENER_FACING_3BET conditions on "this '
          + 'seat RAISED preflop, then faced a 3-bet", so it measures the fourBetAfterOpen '
          + 'situation. The cold4Bet subset — a seat reaching this tree with no prior voluntary '
          + 'action — is a different population and is NOT measured by it. CLOSED 2026-08-18 by '
          + 'the one-pass corpus job this entry called for: FACED_3BET_FREQUENCIES_BY_ROLE (row '
          + 'below) measures all three roles, and bayesianUpdater no longer applies this row '
          + 'across the whole tree. What remains open here is (1) transfer only.',
        ticket: 'WS-521',
      },
    }),
    notes: [
      'DELIBERATELY FLAT ACROSS POSITIONS, and asserted so by test. The source has seat buckets '
      + '(6max/full), not positions, so a positional gradient here would be invented and would '
      + 'then read as measured because it sits beside numbers that are. Position enters through '
      + 'the per-position prior GRIDS instead. WS-264 pass-2 position trees are the path to '
      + 'measuring the gradient.',
      'The 15 cells are 3 distinct values repeated across 5 positions — cell count overstates '
      + 'the independent quantities, which is 3.',
      'ZERO read sites as of 2026-08-20, and the reason is the point: WS-521 removed the ONLY '
      + 'one. This row used to be read at bayesianUpdater.js:110, the third '
      + 'updateScenarioRanges call, applying an OPENER-measured table across the whole '
      + 'faced-3-bet tree. The fix did not re-scope that read, it REPLACED it with the '
      + 'role-split blend (LBL-faced-3bet-role-frequencies, row below), so the pooled table '
      + 'has no consumer left. The import in bayesianUpdater.js outlived the read for two days '
      + 'and made a grep for FOUR_BET_FREQUENCIES say the engine still consumed the pooled '
      + 'table; it was removed 2026-08-20 and replaced with a comment naming the role blend. '
      + 'THE MEASUREMENT IS NOT WRONG AND IS NOT DELETED, and it must not be: POKER_THEORY '
      + 'S2.5.5a names it the INDEPENDENT CROSS-CHECK that licenses the role rows — it '
      + 'reproduces the separately-mined HANDHQ_OPENER_FACING_3BET to under 0.5pp on all '
      + 'three actions, and the cold and passive rows have no other reference. It is still '
      + 'asserted by populationPriors.test.js against the raw HandHQ counts. So this row is '
      + 'vestigial in the tracer sense ONLY — zero PRODUCTION readers — and deleting the table '
      + 'would destroy the anchor that validates its replacement. '
      + 'On the sibling asymmetry: threeBetTopFraction READS '
      + 'FACED_RAISE_FREQUENCIES to scale the 3-bet foot per position, whereas '
      + 'FOUR_BET_TOP_FRACTION deliberately does not scale, because this table is flat across '
      + 'positions and a scaling would read a gradient it does not claim to have. index.js '
      + 'consumes FACED_3BET_ACTIONS, not these numbers.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-faced-3bet-role-frequencies',
    title: 'Prior role -> fold/call4/fourBet when facing a 3-bet — the conditioning set the pooled row hid',
    site: {
      file: 'src/utils/rangeEngine/populationPriors.js', symbol: 'FACED_3BET_FREQUENCIES_BY_ROLE',
    },
    sites: [
      'src/utils/rangeEngine/populationPriors.js::FACED_3BET_FREQUENCIES_BY_ROLE',
      'src/utils/rangeEngine/populationPriors.js::FACED_3BET_ROLE_COUNTS',
    ],
    keySpace: ['priorRole', 'action'],
    foundation: 'mined-corpus',
    foundationStatus: 'measured-supported',
    provenance: 'WS-521 follow-up, 2026-08-18. MEASURED by corpus replay over 28,699 hands / 48 '
      + 'stratified files of the HandHQ 50NLH slice (FTP 14 / PS 34), classified by '
      + 'lineTaxonomy.priorRoleOf — sequence state only, never a hand or position label. Raw '
      + 'k/n retained in FACED_3BET_ROLE_COUNTS so no cell can be quoted without its '
      + 'denominator: opener n=2779 (fold 1194, call4 1250, fourBet 335); cold n=3083 (fold '
      + '2915, call4 120, fourBet 48); passive n=669 (fold 456, call4 200, fourBet 13). '
      + 'THE DEFECT IT CLOSES: bayesianUpdater applied FOUR_BET_FREQUENCIES — measured on '
      + 'OPENERS, and saying so in its own docblock — across opportunities.faced3Bet, the whole '
      + 'tree. Cold is the PLURALITY of that tree (3083/6531 = 47.2%) and folds 94.55% where '
      + 'the applied prior said 43.37%: 51.2pp on the modal action, with the 4-bet rate off by '
      + '~7.7x. That is the WS-371 mechanism (P(fold | faced any raise) 82.3% vs P(fold | I '
      + 'opened and got 3-bet) 48.4%) reproduced one tree deeper, inside the tree built to fix '
      + 'it. VALIDATION: the opener row reproduces the independently mined '
      + 'HANDHQ_OPENER_FACING_3BET table — different pipeline, different sample, no shared code '
      + '— to under 0.5pp on ALL THREE actions (0.4297/0.4498/0.1205 vs 0.4337/0.4450/0.1213). '
      + 'A table landing on an answer it was not fitted to is evidence the CLASSIFIER is right, '
      + 'which is what licenses trusting the cold and passive rows that have no such reference.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 9,
      primaryPath: true,
      instrument: {
        what: 'TRANSFER, shared with every SRC-011 row and NOT closed here: online 2009 vs a '
          + 'live 9-handed 1/2-1/3 game, so a live reading is transferred, not measured. Two '
          + 'row-specific gaps remain. (a) `passive` is thin at n=669 and is the row most likely '
          + 'to move on a larger draw. (b) The rows are flat across POSITION for the same reason '
          + 'FOUR_BET_FREQUENCIES is, but position is measurable here where it was not in the '
          + 'mined source — the replay carries position on every decision, so the positional '
          + 'split is a re-run of the same one-pass job, not new instrumentation.',
        ticket: 'WS-521',
      },
    }),
    notes: [
      'The role is a CONDITIONING SET, not a subclass: it partitions the decision population, '
      + 'not the hand grid. That is why it lives on the decision record beside raisesFaced '
      + 'rather than in SUBCLASS_ACTIONS, and why it needed no new prior grids.',
      'Applied as a blend over the VILLAIN OWN realised role mix (bayesianUpdater '
      + 'faced3BetPopFreqs), not as a fixed constant — a villain who only ever reaches this '
      + 'tree cold is priced as a cold seat. With no observations the weights fall back to the '
      + 'corpus mix, so a fresh profile is priced as the pool rather than as an opener.',
      'Pinned by populationPriors.test.js: every row sums to 1.0, every row recomputes from its '
      + 'raw k/n, the opener row is held within 1pp of the mined table at EVERY position, and a '
      + 'guard asserts the three rows are NOT interchangeable — so a future change that collapses '
      + 'them back into one table fails the suite rather than drifting silently.',
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

  // ===========================================================================
  // TRIAGE TRANCHE 3 (2026-08-17) — the exploit-scoring surface.
  //
  // A DIFFERENT KIND OF LABEL from tranche 1, and the distinction matters. Tranche 1 keyed on
  // GAME STATE (bucket, position, street) — the axes POKER_THEORY §7.1 forbids as decision
  // inputs. These key on RULE ID: a weakness the engine has already detected is looked up in a
  // table to get its impact, its risk, its evidence bar and its recognizability.
  //
  // That is not automatically the §7.1 anti-pattern. A rule id is a genuine categorical, not a
  // quantisation of a continuum, so there is no "compute it from equity instead" available.
  // What makes them ledger rows is the OTHER half of the doctrine: they are unmeasured founder
  // estimates that scale what hero is told to do, and 44 of them at a time.
  // ===========================================================================

  buildLabelEntry({
    labelId: 'LBL-impact-map',
    title: 'Rule-id -> exploit impact score, 44 cells, one read site',
    site: { file: 'src/utils/exploitEngine/exploitScoringUtils.js', symbol: 'IMPACT_MAP' },
    sites: ['src/utils/exploitEngine/exploitScoringUtils.js::IMPACT_MAP'],
    keySpace: ['ruleId'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'A one-line RULE is stated, which is more than most rows get and is still not a '
      + 'measurement: "Impact lookup by rule ID. weakness=0.7, tendency=0.4, multi-stat +0.1, '
      + 'board -0.1." That is a schema the 44 values were generated FROM, so the table is '
      + 'reproducible from four constants — and the four constants have no source.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 44,
      primaryPath: true,
      instrument: {
        what: 'Impact is a claim about EV per exploit, so the honest instrument is the '
          + 'absolute-EV ledger itself: score each rule\'s recommended deviation on the corpus '
          + 'and compare the realised ordering against this table\'s ordering. Rank correlation '
          + 'is the statistic, not per-cell agreement — the scores are used to SORT.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'The generating rule is the useful finding: because 44 cells come from four constants, a '
      + 'correction is a four-number change, not a 44-number one. That is a much cheaper fix '
      + 'than the cell count suggests, and it is invisible unless someone reads the docblock.',
      'Pairs with LBL-risk-map on the same key space and the same single read site '
      + '(exploitScoringUtils.js:148-149) — they are consumed together and must be instrumented '
      + 'together.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-risk-map',
    title: 'Rule-id -> exploit risk score, the other half of the scoring pair',
    site: { file: 'src/utils/exploitEngine/exploitScoringUtils.js', symbol: 'RISK_MAP' },
    sites: ['src/utils/exploitEngine/exploitScoringUtils.js::RISK_MAP'],
    keySpace: ['ruleId'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'Same shape of declaration as IMPACT_MAP and the same absence beneath it: "Risk '
      + 'lookup by rule ID. bluff=0.6, value=0.2, trap=0.4." Three constants, no source.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 44,
      primaryPath: true,
      instrument: {
        what: 'Risk is variance, which the corpus can answer directly: score each rule\'s '
          + 'deviation and report the realised spread, not only the mean. Run it in the same '
          + 'pass as LBL-impact-map — the two are read one line apart and combined into one '
          + 'score, so measuring either alone leaves the combination unchecked.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'Three risk classes over 44 rules means the table asserts that every bluff-shaped exploit '
      + 'carries the same risk as every other. That is a strong claim, cheaply falsifiable by '
      + 'the spread of realised outcomes, and never tested.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-consequence-weights',
    title: 'Rule-id -> evidence-threshold multiplier — how much proof an exploit must clear',
    site: { file: 'src/utils/exploitEngine/exploitValidator.js', symbol: 'CONSEQUENCE_WEIGHTS' },
    sites: ['src/utils/exploitEngine/exploitValidator.js::CONSEQUENCE_WEIGHTS'],
    keySpace: ['ruleId'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'The reasoning is stated and the numbers are not derived from it: "Consequence '
      + 'weight multiplier for evidence thresholds. High-consequence exploits (bluff-raising, '
      + 'assuming capped) need 2x evidence. Low-consequence exploits (value betting wider, '
      + 'folding more) need 0.5x." Why some exploits need more evidence is argued; why the '
      + 'factor is 2.0 rather than 1.5 or 4.0 is not.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 20,
      primaryPath: true,
      instrument: {
        what: 'This is a DECISION THRESHOLD, so its error rates are simulable without any new '
          + 'data: replay the corpus and measure how often each rule fires on a villain whose '
          + 'true rate is population-normal (false positive) and fails to fire on a genuine '
          + 'deviator (false negative), at 0.5x, 1x and 2x. The multiplier that matters is the '
          + 'one where those two curves cross for a consequence of this size.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'CONSEQUENCE-WEIGHTED CONFIDENCE IS A NAMED REPO PRINCIPLE — the poker guardrail lists it '
      + 'among the things not to simplify away — and this 20-cell table is where the principle '
      + 'is actually parameterised. The principle is doctrine; the numbers implementing it are '
      + 'unmeasured.',
      'Being wrong here is asymmetric in a way EV alone does not capture: too low and hero acts '
      + 'on noise, too high and the engine stays silent on a real read. The silent failure is '
      + 'the one nobody reports.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-recognizability-map',
    title: 'Rule-id -> how spottable the exploit is at a live table',
    site: { file: 'src/utils/exploitEngine/briefingBuilder.js', symbol: 'RECOGNIZABILITY_MAP' },
    sites: ['src/utils/exploitEngine/briefingBuilder.js::RECOGNIZABILITY_MAP'],
    keySpace: ['ruleId'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'Scale declared, values not sourced: "Recognizability lookup — how easy is this '
      + 'exploit to spot at the table. 1 = hard to spot, 5 = obvious trigger." Each entry also '
      + 'carries a `trigger` phrase and a `time` ("instant"), which are the human-facing half.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 23,
      primaryPath: false,
      instrument: {
        what: 'THE ONLY ROW IN THE LEDGER WHOSE TRUTH IS NOT IN THE CORPUS. Recognizability is a '
          + 'fact about the founder at a table, not about the field, so no re-score can settle '
          + 'it. The instrument is the prediction ledger: record whether the founder actually '
          + 'spotted the trigger in-session and compare against the 1-5 score. That is the '
          + 'predictionAudit capture that already ships and that nothing reads.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      '`primaryPath: false` — it feeds a briefing, not a decision. It is a row rather than a '
      + '`display-only` exclusion because the score orders WHICH exploits the founder is shown, '
      + 'and an ordering that puts unspottable reads first wastes the only channel that exists '
      + 'at the table.',
      'Its estimand is the founder, which makes it the one label in this ledger whose foundation '
      + 'could be measured in a single session of honest self-report and never has been.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-gto-baselines',
    title: 'Six stat baselines called GTO, holding round numbers with no solver behind them',
    site: { file: 'src/utils/exploitEngine/briefingBuilder.js', symbol: 'GTO_BASELINES' },
    sites: ['src/utils/exploitEngine/briefingBuilder.js::GTO_BASELINES'],
    keySpace: ['stat'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. The inline comments restate the values as approximations '
      + '("~22% VPIP at 9-max", "~17% PFR", "~43% fold to c-bet") with no solver run, no citation '
      + 'and no sample. The NAME asserts a source the file does not have.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 6,
      cellCount: 6,
      primaryPath: false,
      instrument: {
        what: 'Two separable questions, and conflating them is the defect. If the intended '
          + 'referent is EQUILIBRIUM, the instrument is a solver baseline and '
          + 'skillAssessment/solverBaselines.js already exists to hold one. If the intended '
          + 'referent is the FIELD, the corpus answers it by counting and the row should be '
          + 'renamed, because a population mean is not a GTO baseline.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'POKER_THEORY records GTO as an IMPORTED reference class — something cited from a solver, '
      + 'never invented — and this table is six invented numbers wearing that word. The naming '
      + 'is the finding: it is shown to the founder as the standard their villain deviates from.',
      'Read at six sites in briefingBuilder.js (137,145,153,161,169,207), all comparisons '
      + 'against observed stats.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-equity-ladder',
    title: 'The heads-up equity ladder — a derived threshold set with its generalisation stated',
    site: { file: 'src/utils/exploitEngine/actionClassifier.js', symbol: 'EQ' },
    sites: ['src/utils/exploitEngine/actionClassifier.js::EQ'],
    keySpace: ['equityTier'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'WS-277, and unusually it states what the numbers MEAN rather than only what '
      + 'they are: "Each entry is a target probability that hero ends up WINNING THE POT — read '
      + 'that way, the ladder generalizes to k callers as target^(1/k) via '
      + '`multiwayEquityThreshold`, and k=1 reproduces these exact numbers. POKER_THEORY §4.1 / '
      + '§6.4." The generalisation is derived; the five anchor values are judgment.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 24,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'The thresholds classify an action given hero equity, so their consequence is '
          + 'measurable by ablation: shift each anchor by +/-0.05 and re-score the paired '
          + 'decision set. A threshold whose neighbourhood is flat needs no measurement; one '
          + 'where advice flips is the row that has been ranked correctly by reach.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'TWENTY-FOUR READ SITES, second only to POPULATION_PRIORS in this ledger — and unlike that '
      + 'table it comes with a stated semantics that makes the multiway extension a derivation '
      + 'rather than another table. That is the pattern worth copying: define the quantity so '
      + 'precisely that the generalisation falls out instead of needing its own constants.',
      'The founder plays 9-handed live, where multiway is the common case, so the k-caller '
      + 'generalisation is not an edge path here — it is the main one.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-range-boost-switch',
    title: 'Rule-id -> positional range boost, manufactured from inline open-rate thresholds',
    site: {
      file: 'src/utils/exploitEngine/exploitScoringUtils.js', symbol: 'getRangeBoost',
    },
    sites: ['src/utils/exploitEngine/exploitScoringUtils.js::getRangeBoost#switch1'],
    keySpace: ['ruleId', 'openRateBand'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE and no docblock. The constants are inline in the switch: '
      + '`avgOpen > 20 ? 0.15 : avgOpen > 15 ? 0.08 : 0`, per rule id.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 16,
      primaryPath: true,
      instrument: {
        what: 'Ablate the boost to zero and re-score, as a sub-arm of the LBL-impact-map pass — '
          + 'it modifies the same score at exploitScoringUtils.js:144-148 and has no independent '
          + 'meaning.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'BOTH ANTI-PATTERNS IN ONE EXPRESSION: a rule-id switch (categorical) whose arms are '
      + 'threshold-as-label cut points on a continuous open rate, written inline with no name. '
      + 'Nothing about `avgOpen > 20 ? 0.15 : avgOpen > 15 ? 0.08 : 0` is greppable, which is '
      + 'why the harvest looks for AST shapes and not for tokens.',
      'The `readSites: 1` figure is INDIRECT — traceLabelReaders can only follow the enclosing '
      + 'binding for a switch, so it answers "how often is this function referenced", a weaker '
      + 'question than for a named table. The row says so rather than letting the 1 read as '
      + 'equivalent to a table\'s 1.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-bucket-raise-fraction',
    title: 'Bucket -> raise-mass multiplier, inline, on top of an already-ledgered population rate',
    site: {
      file: 'src/utils/exploitEngine/gameTreeSizingHelpers.js', symbol: 'bucketRaiseFraction',
    },
    sites: ['src/utils/exploitEngine/gameTreeSizingHelpers.js::bucketRaiseFraction#ternary1'],
    keySpace: ['bucket'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE for the multipliers. The one-line comment gives the shape '
      + 'only — "Per-bucket raise fraction is small for most buckets except nuts" — over '
      + '`bucket === \'nuts\' ? popRaiseRate * 2 : bucket === \'strong\' ? popRaiseRate : '
      + 'bucket === \'air\' ? popRaiseRate * 0.2 ...`. The surrounding lines DO document their '
      + 'fallbacks carefully (WS-482), so the omission is local rather than a house style.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 3,
      primaryPath: true,
      instrument: {
        what: 'It multiplies POPULATION_PRIORS.raise, so it belongs in the same ablation arm as '
          + 'LBL-population-priors rather than in one of its own: ablate the bucket multipliers '
          + 'to 1.0 and re-score, which asks whether raise mass varies by bucket AT ALL beyond '
          + 'the population rate.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'A SECOND INSTANCE OF THE COMPOSITION PATTERN LBL-texture-realization shows: an '
      + 'unprovenanced multiplier applied on top of another table\'s number, so the two errors '
      + 'multiply and neither file shows the product. Here the base (POPULATION_PRIORS) is '
      + 'itself the least-provenanced, highest-reach table in the engine.',
      'Indirect reach, same caveat as LBL-range-boost-switch.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-gto-open-width',
    title: 'Position label -> assumed GTO open width, one read site',
    site: { file: 'src/utils/exploitEngine/villainObservations.js', symbol: 'GTO_OPEN_WIDTH' },
    sites: ['src/utils/exploitEngine/villainObservations.js::GTO_OPEN_WIDTH'],
    keySpace: ['position'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. Four position-keyed widths with no solver citation, no '
      + 'sample and no docblock — the same word "GTO" doing the same work it does in '
      + 'GTO_BASELINES, in a different file.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 4,
      primaryPath: true,
      instrument: {
        what: 'Same fork as LBL-gto-baselines and it should be resolved in the same decision: '
          + 'either cite a solver for the equilibrium reading or count the corpus for the field '
          + 'reading. Two files independently invented a "GTO" reference, which is an argument '
          + 'for ONE imported reference class rather than two measurements.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'Found by the harvest, not by reading: nobody comparing GTO_BASELINES to GTO_OPEN_WIDTH '
      + 'would have had reason to open both files. Two unsourced tables using the same borrowed '
      + 'authority is exactly the duplication a ledger is supposed to surface.',
    ],
  }),

  // ===========================================================================
  // TRIAGE TRANCHE 4 (2026-08-17) — observation thresholds, emotional state, assumption gates.
  //
  // The tranche that found a SURVIVOR. WS-436 removed the six style labels as engine decision
  // inputs and POKER_THEORY v2.4 records that the playerStats struct "no longer carries a style
  // field at all". `tiltTransform.js::STYLE_MULTIPLIERS` still keys on Fish / Nit / LAG / TAG /
  // Unknown. Nothing in the repo pointed at it, because nothing had an index of label-keyed
  // tables — which is the argument for this ledger stated as a fact rather than as a rationale.
  // ===========================================================================

  buildLabelEntry({
    labelId: 'LBL-tilt-style-multipliers',
    title: 'The six style labels, still keying a numeric multiplier after WS-436 removed them',
    site: { file: 'src/utils/emotionalState/tiltTransform.js', symbol: 'STYLE_MULTIPLIERS' },
    sites: ['src/utils/emotionalState/tiltTransform.js::STYLE_MULTIPLIERS'],
    keySpace: ['style'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE — no docblock at all, five values beside four other bare '
      + 'coefficients (FEAR_COEFFICIENT 8, GREED_COEFFICIENT 6, FEAR_FOLD_CAP 0.25, '
      + 'GREED_RAISE_CAP 0.20).',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 3,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'THE MEASUREMENT IS ALREADY DONE — this is the one row in the ledger whose '
          + 'instrument has run and whose answer is on record. WS-436 measured the style channel '
          + 'at ΔLL −0.00076 over 10,147 paired decisions (n.s.) and advice-parity at exactly '
          + 'n=0. What remains is not a study but a check: confirm this consumer is on the same '
          + 'channel, then delete it under the existing Result Card, or state precisely why tilt '
          + 'is a different estimand from villain action.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'THE SURVIVOR. WS-436 deleted STYLE_PRIORS, STYLE_STEEPNESS_MULT, STYLE_RAISE_PARAMS, '
      + 'STYLE_BET_CENTER, STYLE_FOLD_DEFAULTS and computeFoldCurveForStyle, and POKER_THEORY '
      + 'v2.4 records that "the engine\'s playerStats struct no longer carries a style field at '
      + 'all". This table keys on Fish / Nit / LAG / TAG / Unknown and is read three times.',
      'It is a fair defence that tilt modelling is a DIFFERENT estimand from villain action, and '
      + 'that WS-436\'s null does not automatically transfer. That defence is exactly what the '
      + 'row asks someone to write down — it has never been made, because nobody knew the table '
      + 'was here.',
      'The 21.1% Unknown fallthrough measured in the archetype clustering work applies here too: '
      + 'a fifth of villains take the Unknown multiplier, so a fifth of the time this table is '
      + 'a constant wearing a label.',
      'HOW IT WAS FOUND is the point: not by an audit, not by reading, but by an AST harvest of '
      + 'label-keyed tables plus a requirement that every one be claimed. A survey looking for '
      + '"style" would have found it; every survey that ran did not.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-observation-thresholds',
    title: 'The 44-cell observation threshold block — 41 read sites behind a one-letter name',
    site: { file: 'src/utils/exploitEngine/villainObservations.js', symbol: 'T' },
    sites: ['src/utils/exploitEngine/villainObservations.js::T'],
    keySpace: ['observationRule'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'A CLAIM OF GROUNDING WITH NO CITATION: "Observation detection thresholds — all '
      + 'poker-theory-grounded. Centralizes magic numbers that were previously scattered through '
      + '33 observation rules." Individual cells carry a derivation in a trailing comment '
      + '("blindDefendMax: 25 — Below this % → over-folding blinds (MDF vs 2.5x open ~40%)"), so '
      + 'SOME are derived; the docblock asserts it of ALL 44 and the file does not show that.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 41,
      cellCount: 44,
      primaryPath: true,
      instrument: {
        what: 'Split it before measuring it, because the two halves need different instruments. '
          + 'The MDF-derived cells are checkable by re-deriving the arithmetic — no data needed. '
          + 'The rest are detection thresholds and need the false-positive/false-negative '
          + 'simulation described on LBL-consequence-weights. The first pass is a partition, and '
          + 'it is the cheapest work in this ledger.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'SECOND-WIDEST REACH IN THE HARVEST after POPULATION_PRIORS: 41 read sites, 44 cells, '
      + 'module-private, named `T`. It is unfindable by name and it decides when the engine '
      + 'tells the founder anything at all about a villain.',
      'Centralising the 33 rules\' magic numbers was the right move and it is why this row can '
      + 'exist as one row. The residue is that centralisation without provenance produces a '
      + 'single well-organised block of unsourced constants — tidier, equally unmeasured.',
      'The blanket phrase "all poker-theory-grounded" is the specific thing to distrust: it is '
      + 'true of the cells that show their derivation and unevidenced for the others, and a '
      + 'reader has no way to tell which is which without opening all 44.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-weakness-to-delta',
    title: 'Weakness id -> numeric adjustment deltas, with an explicit no-op default',
    site: { file: 'src/utils/exploitEngine/villainProfileBuilder.js', symbol: 'WEAKNESS_TO_DELTA' },
    sites: ['src/utils/exploitEngine/villainProfileBuilder.js::WEAKNESS_TO_DELTA'],
    keySpace: ['weaknessId'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'Authored 2026-06-04 (WS-155 / SPR-105). The docblock states the DEFAULT '
      + 'precisely, which is unusual and good: "Unlisted weakness ids contribute `delta: {}` — '
      + 'they remain Adjustment entries with rationale text but no numeric contribution to '
      + 'composition (informational reads, not numeric levers)." The nine listed deltas '
      + '(sizing x1.2, and so on) carry per-entry poker rationale and no measurement.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 2,
      cellCount: 9,
      primaryPath: true,
      instrument: {
        what: 'These are the numeric levers a detected weakness pulls, so they are directly '
          + 'scoreable on the absolute-EV ledger: score each weakness\'s deviation against the '
          + 'no-op default the table already defines. The counterfactual is built in — unlisted '
          + 'ids contribute nothing — so the arm needs no new control.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'The `delta: {}` default is a design worth naming: a weakness with no measured lever '
      + 'produces RATIONALE and no number, rather than a small invented adjustment. That is the '
      + 'unmeasured-tier discipline of this ledger, implemented in engine code two months before '
      + 'the ledger existed.',
      'It also makes the row cheap to resolve: the population of listed ids is nine, each with a '
      + 'stated poker rationale, and the comparison arm is already the shipped behaviour for '
      + 'every unlisted id.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-maturity-thresholds',
    title: 'Observation counts that manufacture a villain-model maturity phase',
    site: { file: 'src/utils/exploitEngine/villainProfileBuilder.js', symbol: 'MATURITY_THRESHOLDS' },
    sites: ['src/utils/exploitEngine/villainProfileBuilder.js::MATURITY_THRESHOLDS'],
    keySpace: ['maturityPhase'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. One line: "Maturity phase thresholds (total postflop '
      + 'observations)", over coarse: 1, typed: 10, individual and deep.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 3,
      cellCount: 4,
      primaryPath: true,
      instrument: {
        what: 'A sample-size threshold has an identifiable right answer: the n at which the '
          + 'per-villain posterior beats the population prior out of sample. Measure the '
          + 'crossover on the corpus per phase rather than choosing round numbers — the same '
          + 'estimator that produced PER_STAT_PRIOR_WEIGHT answers this.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'THRESHOLD-AS-LABEL again, third instance in this ledger after FOLD_RATE_THRESHOLDS and '
      + 'the SPR bands. Here the manufactured phase decides how much the engine trusts a '
      + 'per-villain read, so the label is upstream of every personalised number.',
      '`typed: 10` sits suspiciously close to PRIOR_WEIGHT = 10, which WAS measured. If the two '
      + 'are meant to be the same quantity that is a derivation worth writing down; if they are '
      + 'not, the coincidence is worth ruling out.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-fear-greed-factor-weights',
    title: 'Emotional-state factor weights — with stubbed factors carrying weight 0',
    site: { file: 'src/utils/emotionalState/fearIndex.js', symbol: 'FEAR_FACTOR_WEIGHTS' },
    sites: [
      'src/utils/emotionalState/fearIndex.js::FEAR_FACTOR_WEIGHTS',
      'src/utils/emotionalState/greedIndex.js::GREED_FACTOR_WEIGHTS',
    ],
    keySpace: ['factor'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'Both tables declare their constraint and their staging: "Weight constants for '
      + 'v1 fear aggregation. Sum of active weights <= 1.0. Stubbed factors have weight 0 in v1; '
      + 'extending them requires updating this object + adding the factor\'s computation." The '
      + 'normalisation and the staging are stated; the split between the active weights '
      + '(0.6 / 0.2 / ...) is not sourced.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 12,
      cellCount: 11,
      primaryPath: true,
      instrument: {
        what: 'Fear and greed are asserted to shift hero\'s own decisions, so the falsifier is '
          + 'in the hand history, not the corpus: does the index computed at decision time '
          + 'predict the founder\'s realised deviation from the engine line? A weight vector '
          + 'that predicts nothing is refuted regardless of how the weights were chosen.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'Two constructs, one row: same shape, same docblock, same author decision, mirrored across '
      + 'fear and greed. Reach 12 = 6 + 6, summed across both sites.',
      'THE WEIGHT-0 STUBS ARE THE HONEST PART AND THE RISKY PART AT ONCE. Declaring a factor at '
      + 'weight 0 keeps the extension point visible, and it also means the shipped index is '
      + 'effectively two factors wearing a six-factor schema. A reader of the object sees six '
      + 'named influences; the computation has two.',
      'This is the ledger\'s own INERTNESS question in miniature — the one prog-guide-authority '
      + 'raises about a standard with zero instances. A declared factor that contributes nothing '
      + 'passes every check and reads as capability.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-assumption-gate-thresholds',
    title: 'Hero- and villain-side assumption gates — schema-cited, asymmetric by design',
    site: { file: 'src/utils/assumptionEngine/assumptionTypes.js', symbol: 'VILLAIN_SIDE_THRESHOLDS' },
    sites: [
      'src/utils/assumptionEngine/assumptionTypes.js::VILLAIN_SIDE_THRESHOLDS',
      'src/utils/assumptionEngine/assumptionTypes.js::HERO_SIDE_THRESHOLDS',
    ],
    keySpace: ['gateDimension'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'Both cite a schema section and — rarely for this repo — their UNITS: '
      + '"confidence — Bayesian posterior P(claim true | evidence); stability — composite '
      + 'stability score [0, 1]; recognizability — recognizability score [0, 1]; '
      + 'asymmetricPayoff — bb per 100 trigger firings (§1.5 unit correction); sharpe — mean / '
      + 'sd floor". The hero-side set states WHY it differs: "Relaxed relative to villain-side '
      + 'because self-observation has higher noise." Schema §7.1 + CC-6 resolution. The cut '
      + 'points themselves (0.80 / 0.70 vs 0.70 / 0.60) are judgment.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 7,
      cellCount: 11,
      primaryPath: true,
      instrument: {
        what: 'A gate\'s error rates are its meaning: replay recorded assumptions and measure '
          + 'how many that cleared 0.80 were later contradicted, and how many below it would '
          + 'have held. The prediction ledger is the data source, and it is the same instrument '
          + 'LBL-recognizability-map needs — one capture serves both.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'BEST-DOCUMENTED CONSTANTS IN THE TRANCHE, and still unmeasured — which is the distinction '
      + 'the two-axis vocabulary exists to draw. Stating units and citing a schema is provenance '
      + 'for the DEFINITION, never evidence for the VALUE.',
      'The hero/villain asymmetry is a testable claim in its own right ("self-observation has '
      + 'higher noise"), and it is measurable directly as the variance of hero-side against '
      + 'villain-side estimates. If the noise ratio is not what the 0.10 relaxation assumes, the '
      + 'gap is wrong even if both gates are individually reasonable.',
      'Reach 7 = VILLAIN_SIDE 4 + HERO_SIDE 3, summed across both sites.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-calibration-ladder',
    title: 'Calibration-gap cut points that decide when an assumption is retired',
    site: { file: 'src/utils/assumptionEngine/assumptionTypes.js', symbol: 'CALIBRATION_LADDER' },
    sites: ['src/utils/assumptionEngine/assumptionTypes.js::CALIBRATION_LADDER'],
    keySpace: ['calibrationBand'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'Cites its spec — "Calibration ladder thresholds (calibration.md §3.3)" — and '
      + 'annotates each band with the action it triggers ("<= 0.20 — no action", "0.20-0.25 — '
      + 'flagged"). The document defines the ladder; nothing measures the cut points.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 9,
      cellCount: 5,
      primaryPath: false,
      instrument: {
        what: 'It governs RETIREMENT, so its cost is asymmetric and measurable as such: sweep '
          + 'the cut points over the recorded calibration history and count assumptions retired '
          + 'that were later vindicated against assumptions kept that kept mis-calibrating. The '
          + 'ladder is a policy and its regret is computable.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'ALL NINE READ SITES ARE IN `__backtest__/calibrationAccumulator.js`, which the harvester '
      + 'does not treat as a test directory. So the reach figure is real but concentrated in one '
      + 'measurement harness — the table is a knob on the instrument, not on the engine, which '
      + 'is why `primaryPath` is false and why it still needs a row.',
      'Same class as LBL-bucket-midpoint: a constant inside the measurement path. Those are the '
      + 'ones that can bias every downstream conclusion while looking like tooling.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-dial-and-decay-defaults',
    title: 'Assumption dial bounds and decay half-lives — one cash/tournament split with no evidence',
    site: { file: 'src/utils/assumptionEngine/assumptionTypes.js', symbol: 'DIAL_DEFAULTS' },
    sites: [
      'src/utils/assumptionEngine/assumptionTypes.js::DIAL_DEFAULTS',
      'src/utils/assumptionEngine/assumptionTypes.js::DEFAULT_DECAY_HALFLIFE_DAYS',
    ],
    keySpace: ['dialParameter', 'gameType'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'Schema pointers only, no derivation: "Dial defaults (schema §6.1)" over '
      + 'dialFloor 0.3 / dialCeiling 0.9 / sigmoidSteepness 8, and "Decay half-life defaults '
      + '(schema §1.2)" over cash: 30, tournament: 7. A schema section says a field exists; it '
      + 'does not say the value is 30.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 3,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'A half-life is an empirical claim about how fast a read goes stale, and it is '
          + 'directly estimable: fit the decay from the recorded history of assumptions that '
          + 'were later re-observed. 30 days versus 7 is a 4x claim about cash and tournament '
          + 'populations and the fit answers it.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'The cash/tournament split is a GAME-TYPE LABEL keying a numeric parameter — the §7.1 '
      + 'shape on an axis nobody thinks of as a label. It is also plausible: tournament reads '
      + 'genuinely stale faster because the structure moves. Plausible and unmeasured is exactly '
      + 'what this ledger records rather than resolves.',
      'Reach 3 = DECAY_HALFLIFE 2 + DIAL_DEFAULTS 1.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-stake-factor',
    title: 'Stake-category label -> blend factor in [-1, +1]',
    site: { file: 'src/utils/citedDecision/dialMath.js', symbol: 'stakeFactor' },
    sites: ['src/utils/citedDecision/dialMath.js::stakeFactor#switch1'],
    keySpace: ['stakeCategory'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'Direction argued, magnitude unsourced: "Stake-context factor maps stake '
      + 'category to [-1, +1]. Higher stakes -> negative factor (pulls blend down toward '
      + 'balanced); cash -> neutral; tournament -> slightly negative (ICM considerations)." Why '
      + 'high-stakes is -0.8 rather than -0.4 is not stated.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'The stake gradient is now MEASURABLE and was not when this was written: the full '
          + 'corpus shows a monotone gradient across stakes (3-bet +57% across the range). Fit '
          + 'the factor to that gradient instead of asserting it.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'A STAKE LABEL IS NOT A GAME METRIC, and this row is where that distinction has teeth: '
      + 'three categories stand in for a measured gradient. The founder ruling is that games are '
      + 'matched by METRIC VECTOR, not by stake level — the skill axis does not even run the '
      + 'same direction online and live — so a three-valued stake label is the coarsest possible '
      + 'proxy for the thing that actually varies.',
      'Direction-only provenance is its own category of claim: the sign is defensible from ICM '
      + 'and from field strength, the magnitude is a free parameter, and the code cannot tell '
      + 'them apart.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-deviation-type-switch',
    title: 'Deviation-type label -> recommended action override',
    site: {
      file: 'src/utils/citedDecision/citedDecisionProducer.js', symbol: 'deriveRecommendedAction',
    },
    sites: ['src/utils/citedDecision/citedDecisionProducer.js::deriveRecommendedAction#switch1'],
    keySpace: ['deviationType'],
    foundation: 'structural-computation',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE at the switch. The arms are LOGIC rather than constants — '
      + '"Bluff-prune changes hero\'s range. If baseline was bet, recommended is check." — so '
      + 'what the row records is a mapping from a label to a decision rule, not to a number.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 2,
      cellCount: 3,
      primaryPath: true,
      instrument: {
        what: 'Each arm is a stated implication, so the first instrument is a CONSISTENCY check '
          + 'rather than a measurement: does each deviation type\'s override agree with the EV '
          + 'ordering the engine computes for that spot? An override that contradicts the '
          + 'engine\'s own numbers is a defect with no sample size attached.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'Foundation `structural-computation` rather than `founder-estimate` — the arms derive an '
      + 'action from a stated definition of the deviation type and carry no fitted or estimated '
      + 'number. That is the honest reading, and it is also why the instrument is a consistency '
      + 'check: a derivation can be WRONG without being unmeasured.',
      'Only the top-composite assumption drives the override ("Top-composite assumption drives '
      + 'the primary deviation"), so this label switch decides the whole recommendation from one '
      + 'ranked entry.',
    ],
  }),

  // ===========================================================================
  // TRIAGE TRANCHE 5 (2026-08-17) — generated equity artifacts and the study/drill surface.
  //
  // Two populations that the ledger's vocabulary separates cleanly and prose never did. The
  // GENERATED artifacts (EQUITY_VS_OPEN, EQUITY_SKEW_DECOMPOSITION) are the best-founded large
  // tables in the repo: a named generator, a stated trial count, a stated sampling error. The
  // STUDY-PRIORITY frequencies are approximations by their own admission, and they rank what
  // the founder is told to study — so being wrong costs attention rather than chips, which is
  // a different currency and not a smaller one.
  // ===========================================================================

  buildLabelEntry({
    labelId: 'LBL-equity-vs-open',
    title: 'Position x hand-class preflop equity, 845 cells, Monte Carlo generated',
    site: { file: 'src/utils/pokerCore/preflopEquityTable.js', symbol: 'EQUITY_VS_OPEN' },
    sites: ['src/utils/pokerCore/preflopEquityTable.js::EQUITY_VS_OPEN'],
    keySpace: ['position', 'handClass'],
    foundation: 'structural-computation',
    foundationStatus: 'generated',
    provenance: 'Generator, trial count and error bar all stated: "Generated at 20000 Monte '
      + 'Carlo trials per cell (sampling error ~+/-35 bp). The generator samples rather than '
      + 'enumerates, so regenerating moves cells slightly; this committed file is the source of '
      + 'truth that tests and live advice read." Units are declared too — "Equity in basis '
      + 'points: EQUITY_VS_OPEN[heroPosition][handClassIndex]".',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 7,
      cellCount: 845,
      primaryPath: true,
      instrument: {
        what: 'Equity against a range is EXACTLY ENUMERABLE — 20,000 samples per cell is a '
          + 'choice, not a limit. The instrument is to enumerate rather than sample and difference '
          + 'against the committed table: any cell outside +/-35 bp is a generator defect, and '
          + 'the exercise also removes the regeneration non-determinism the docblock concedes.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'LARGEST CELL COUNT IN THE LEDGER AT 845, and among the best-founded — which is why it '
      + 'belongs in the ranking rather than in an exclusion. Cell count is not a defect signal; '
      + 'the foundation column is.',
      'The POSITION axis is the interesting part: 845 cells is 5 positions x 169 hand classes, '
      + 'so equity here is conditioned on a POSITION LABEL. That is defensible — the label is a '
      + 'proxy for the opener\'s range, which genuinely differs — and it is the §7.1 shape, so '
      + 'the row records that the proxy has never been compared against conditioning on the '
      + 'opener\'s actual estimated range.',
      'Read across three subsystems: preflopFoldResolver.js:539, populationPriors.js:230,481, '
      + 'plus research scripts — the widest cross-module spread of any generated table here.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-equity-skew-decomposition',
    title: 'The 1,032-cell equity spectrum artifact — generated, versioned, and validated on read',
    site: {
      file: 'src/utils/pokerCore/data/equitySkewDecomposition.js',
      symbol: 'EQUITY_SKEW_DECOMPOSITION',
    },
    sites: ['src/utils/pokerCore/data/equitySkewDecomposition.js::EQUITY_SKEW_DECOMPOSITION'],
    keySpace: ['handClass'],
    foundation: 'structural-computation',
    foundationStatus: 'generated',
    provenance: 'A generated artifact carrying its own manifest: `artifactVersion`, '
      + '`generatedBy: scripts/research/spectrum.py`, `engineCommit`, `engineDirty`, '
      + '`dealBookHashes`, `noiseFloorSigma`. The docblock defines each field it publishes — '
      + '"split: the ORTHOGONAL transitive/intransitive projection. Shares sum to 1. '
      + 'intransitivityMap: per class, the RMS cyclic edge against a random opponent hand, in '
      + 'percentage points — equity no strength ladder can express." And it names its validator: '
      + '"Read by src/utils/pokerCore/equityOperator.js, which validates it before use."',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 1032,
      primaryPath: true,
      instrument: {
        what: 'No defect suspected — this is the strongest-provenance artifact in the harvest. '
          + 'The open question is CONSUMPTION, not correctness: it quantifies intransitivity '
          + '"no strength ladder can express" and has ONE reader. Measure whether acting on the '
          + 'intransitivity map changes advice at all; a 1,032-cell artifact behind one read '
          + 'site is either underused or decorative, and only a re-score distinguishes those.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'THE MODEL FOR EVERY OTHER GENERATED TABLE: it carries an engine commit, a dirty flag, '
      + 'deal-book hashes and a noise floor — the same replication manifest a Result Card '
      + 'carries. Nothing in the ledger asks for more than this.',
      'One read site against 1,032 cells is the widest cells-per-reader ratio in the harvest by '
      + 'an order of magnitude. Low reach is not low importance, but it IS a question worth '
      + 'asking, and the row asks it rather than assuming either answer.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-archetype-bucket-multipliers',
    title: 'Archetype label x bucket -> combo-weight multiplier, in the drill range builder',
    site: {
      file: 'src/utils/postflopDrillContent/archetypeRangeBuilder.js',
      symbol: 'ARCHETYPE_BUCKET_MULTIPLIERS',
    },
    sites: ['src/utils/postflopDrillContent/archetypeRangeBuilder.js::ARCHETYPE_BUCKET_MULTIPLIERS'],
    keySpace: ['archetype', 'bucket'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'Scope is declared, values are not sourced: "Per-archetype x per-bucket '
      + 'combo-weight multipliers. Declarative — no decision logic consumes these values except '
      + 'via the lookup in this module." Per-entry poker rationale only ("Fish: sticky, '
      + 'call-prone. Over-represents marginal + draw").',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 3,
      cellCount: 15,
      primaryPath: true,
      instrument: {
        what: 'It crosses the two axes WS-436 and the bucket group each measured separately, so '
          + 'it inherits both results and needs neither re-derived: check whether fish/reg/pro '
          + 'separate on the drill corpus at all before pricing the multipliers. The archetype '
          + 'clustering work already found k=2 with silhouette 0.343 and a 21.1% Unknown '
          + 'fallthrough — that is the prior this table has to beat.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'THE STYLE AXIS AGAIN, under a different name, in a different subsystem — fish / reg / pro '
      + 'instead of Fish / Nit / LAG / TAG. WS-436 removed the six labels from the engine and '
      + 'display categorisation was greenfielded separately (WS-447); this table is a THIRD '
      + 'instance of the axis, in drill content.',
      'The "Declarative — no decision logic consumes these" scope note is the honest kind of '
      + 'limit, and it is also what makes the row cheap: the blast radius is stated by the '
      + 'author.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-group-call-rates',
    title: 'Domination-group label -> call frequency, a declared v2 placeholder',
    site: { file: 'src/utils/postflopDrillContent/drillModeEngine.js', symbol: 'GROUP_CALL_RATES' },
    sites: ['src/utils/postflopDrillContent/drillModeEngine.js::GROUP_CALL_RATES'],
    keySpace: ['dominationGroup'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'Declares its reason for existing, its coarseness AND its replacement: '
      + '"DOMINATION_GROUPS are finer-grained than the segmenter hand-types POP_CALLING_RATES is '
      + 'keyed by — split groups like `overcardsAx`, `pairPlusFD`, `pairPlusOesd` don\'t have '
      + 'direct entries. GROUP_CALL_RATES is a v2 prior table with coarse population-anchored '
      + 'call frequencies per group. Depth-2 integration (LSW-D1) will replace these with '
      + 'empirical fit from observed fold curves."',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 31,
      primaryPath: true,
      instrument: {
        what: 'The instrument is NAMED IN THE FILE — LSW-D1, empirical fit from observed fold '
          + 'curves — so this row does not need one invented. What it needs is for LSW-D1 to be '
          + 'a tracked item rather than a sentence in a comment, which is precisely the '
          + 'de-duplicating job the ledger does for REALIZATION_TABLE\'s three tickets.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'A MODEL EXAMPLE OF A GOOD PLACEHOLDER: it says it is a placeholder, says why the finer '
      + 'grain forced it, and names its replacement. The only thing it lacks is a tracked ticket, '
      + 'so the promise lives in a comment where nothing can age it out.',
      'It exists because POP_CALLING_RATES (LBL-pop-calling-rates) is too coarse for these '
      + 'groups — so an unmeasured table was extended by a second unmeasured table, and the two '
      + 'rows now sit in one ranking where that relationship is visible.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-study-priority-frequencies',
    title: 'The four study-priority frequency tables — approximations that rank what gets studied',
    site: {
      file: 'src/utils/postflopDrillContent/studyPriorityIndex.js', symbol: 'POSITION_PAIR_FREQ',
    },
    sites: [
      'src/utils/postflopDrillContent/studyPriorityIndex.js::POSITION_PAIR_FREQ',
      'src/utils/postflopDrillContent/studyPriorityIndex.js::VILLAIN_ACTION_FREQ',
      'src/utils/postflopDrillContent/studyPriorityIndex.js::BOARD_CLASS_FREQ',
      'src/utils/postflopDrillContent/studyPriorityIndex.js::POT_TYPE_FREQ',
    ],
    keySpace: ['positionPair', 'villainAction', 'boardClass', 'potType'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'They concede their own precision, which is why they are `declared-estimate` and '
      + 'not `undeclared`: "Numbers are approximate — the shape matters more than any individual '
      + 'cell", with the shape then argued ("BTN-vs-BB dominates because (a) BTN opens widest, '
      + '(b) BB is forced to defend the most..."). VILLAIN_ACTION_FREQ states its own '
      + 'conditioning limit: "Postflop street conditioning is an approximation — on turn/river '
      + 'the same distribution applies with minor skew we ignore in v1." BOARD_CLASS_FREQ warns '
      + 'that its categories OVERLAP and that the most-specific tag wins.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 6,
      cellCount: 72,
      primaryPath: false,
      instrument: {
        what: 'ALL FOUR ARE PURE FREQUENCY CLAIMS AND THE CORPUS ANSWERS THEM DIRECTLY — how '
          + 'often each position pair, pot type, board class and villain action actually occurs. '
          + 'This is the cheapest measurement in the entire ledger: four counts, no engine run, '
          + 'no re-score, no paired arm. The only care needed is the overlapping board classes, '
          + 'where the count must use the same most-specific-tag rule the code does.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'FOUR CONSTRUCTS, ONE ROW: they are the same estimand (occurrence frequency) from the same '
      + 'author decision, combined into one Study Priority Index. Reach 6 = POSITION_PAIR 1 + '
      + 'VILLAIN_ACTION 1 + BOARD_CLASS 2 + POT_TYPE 2.',
      'THE CURRENCY IS ATTENTION, NOT CHIPS, and that is why `primaryPath` is false and why the '
      + 'row still matters. These weights decide what the founder studies. Being wrong here does '
      + 'not misprice a hand — it spends finite study time on the wrong spots, and no EV number '
      + 'in this system would ever show it.',
      'They are also the closest thing in the repo to an OCCUPANCY measure — the frequency with '
      + 'which situations are actually lived through — which the vocabulary defines and stamps '
      + 'with a Field. These four carry no Field stamp, so which population they describe is '
      + 'unstated.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-flush-deltas',
    title: 'Suit-configuration label -> equity delta in percentage points',
    site: { file: 'src/utils/drillContent/frameworks.js', symbol: 'FLUSH_DELTAS' },
    sites: ['src/utils/drillContent/frameworks.js::FLUSH_DELTAS'],
    keySpace: ['suitConfiguration'],
    foundation: 'structural-computation',
    foundationStatus: 'declared-estimate',
    provenance: 'Derived, and the derivation is written out per cell — the most complete '
      + 'reasoning attached to any small table in this ledger: "both_suited_shared: flush routes '
      + 'are in DIFFERENT suits (JhTh vs AhKh is a card conflict); they don\'t collide on the '
      + 'same board. Empirically the HIGHER-flush side loses ~1pp vs both-offsuit baseline (its '
      + 'own flush gain is smaller than the damage from villain\'s flush) and the LOWER-flush '
      + 'side gains ~1pp." The word "empirically" appears without a citation, so the row records '
      + 'a derivation whose empirical anchor is not named.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 3,
      cellCount: 6,
      primaryPath: false,
      instrument: {
        what: 'Six equity deltas over suit configurations are EXACTLY ENUMERABLE — no sampling, '
          + 'no corpus, no re-score. Enumerate hero-vs-villain equity by suit configuration and '
          + 'difference against the table. If it agrees, the row resolves to measured with the '
          + 'enumeration as evidence; if not, the fix is arithmetic.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'PROBABLY THE CHEAPEST ROW IN THE LEDGER TO RESOLVE and one of the smallest: six cells, an '
      + 'exact computation, and a stated expected answer to check against. It is here because '
      + '"empirically ~1pp" is a measurement claim with no measurement attached, and the '
      + 'difference between a derivation and a recollection of one is invisible in a comment.',
    ],
  }),

  // ===========================================================================
  // TRIAGE TRANCHE 6 (2026-08-17) — the measurement path, and the two defects it was hiding.
  //
  // The last tranche, and the one that justifies having harvested `scripts/backtest` at all.
  // Constants inside the MEASUREMENT path are the ones that can bias every conclusion while
  // looking like tooling — and putting them in the same index as the engine's constants is
  // what made two of them collide visibly for the first time:
  //
  //   1. TWO tables price the same size buckets and DISAGREE on three of five cells.
  //   2. ONE transcription of an engine constant is pinned by a test and its SIBLING is not,
  //      in the same directory, under a documented rule that says pinning is required.
  //
  // Neither needed a measurement to find. Both needed an index.
  // ===========================================================================

  buildLabelEntry({
    labelId: 'LBL-size-bucket-midpoint-holemap',
    title: 'The SECOND size-bucket midpoint table — three of five cells disagree with the first',
    site: { file: 'scripts/backtest/holeMap.mjs', symbol: 'SIZE_BUCKET_MIDPOINT' },
    sites: ['scripts/backtest/holeMap.mjs::SIZE_BUCKET_MIDPOINT'],
    keySpace: ['sizeBucket'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. One line: "Bucket label -> the representative '
      + '`s = bet/pot` the row is priced at." Its counterpart at deviationMap.mjs:42 says '
      + '"Representative bet-to-pot ratio for each size bucket" — the same estimand, in the same '
      + 'directory, with different numbers.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'NO STUDY REQUIRED — this is a defect, not an open question. Reconcile the two '
          + 'tables to one definition and one module, then decide what the representative point '
          + 'of a bucket should be (the corpus can give the actual mean s within each bucket, '
          + 'which is a better answer than either constant). The instrument is a corpus count '
          + 'and a deletion.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'THE DISAGREEMENT, cell for cell — deviationMap.mjs:42 against holeMap.mjs:493:',
      '  0-33:     0.20  vs  0.25    (25% apart)',
      '  33-66:    0.50  vs  0.50    (agree)',
      '  66-100:   0.80  vs  0.80    (agree)',
      '  100-150:  1.25  vs  1.20',
      '  150+:     2.00  vs  1.75    (14% apart)',
      'BOTH ARE IN THE MEASUREMENT PATH, not the engine. deviationMap passes its copy to '
      + '`deriveFloor`, setting the defensive floor every deviation cell is scored AGAINST; '
      + 'holeMap prices its rows at its own copy. So two instruments that report on the same '
      + 'system price the same bucket differently, and any comparison across them inherits the '
      + 'gap silently.',
      'THIS IS THE WS-291 MECHANISM EXACTLY — "nothing forced two numbers onto the same axis, so '
      + 'a wrong number never had to meet a right one." Two modules, two constants, one estimand, '
      + 'and no reason for anyone to open both files at once. The ledger is that forcing '
      + 'function, and this is the first thing it caught by collision rather than by inspection.',
      'Neither is obviously the right one. 150+ is an open-ended bucket, so its representative '
      + 'point is a genuine modelling choice — which is an argument for measuring it, not for '
      + 'picking a winner.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-holemap-curve-transcription',
    title: 'An unpinned transcription of the engine fold curve, beside a pinned one',
    site: { file: 'scripts/backtest/holeMap.mjs', symbol: 'POPULATION_CURVE' },
    sites: ['scripts/backtest/holeMap.mjs::POPULATION_CURVE'],
    keySpace: ['curveParameter'],
    foundation: 'fitted-curve',
    foundationStatus: 'measured-supported',
    provenance: 'A TRANSCRIPTION, and it says so: "The shipped ENGINE curve, so its threshold '
      + 'can sit on the same axis as the measured one." The five values match '
      + 'villainModelData.js::POPULATION_CURVE today (maxDelta 0.95, steepness 1.0, steepnessUp '
      + '6.5, steepnessDown 0.75, midpoint 0.35), so the foundation it inherits is the measured '
      + 'one — for exactly as long as the two stay equal.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 1,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'NO STUDY REQUIRED. Add the equality test the repo already knows it needs — '
          + '`expect(holeMap.POPULATION_CURVE).toEqual(villainModelData.POPULATION_CURVE)`. If '
          + 'the harness loader makes a direct import impossible, that is the same constraint '
          + 'rakeSensitivity worked around, and it solved it.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'THE RULE IS ALREADY WRITTEN DOWN IN THIS DIRECTORY, by the sibling that follows it. '
      + 'rakeSensitivity.mjs:69 explains why its own copy exists ("loadable only through the '
      + 'Vite loader, while this module must stay importable by '
      + '`replicationStamp.collectConstants`") and then states the discipline outright: "a '
      + 'transcription is legal only with an executable equality check against the definition '
      + 'site." rakeSensitivity.test.js:73-79 enforces it byte for byte.',
      'holeMapFreshness.test.js contains no such check. One transcription is pinned, its '
      + 'neighbour is not, and the rule that distinguishes them lives in a docblock in a third '
      + 'file. That is a governance gap, not a poker one, and it is what a ledger indexing '
      + 'BOTH copies makes visible.',
      'The failure mode is silent and delayed: re-fit the engine curve and this copy keeps the '
      + 'old parameters, so the instrument measuring the engine is quietly measuring the '
      + 'previous engine. Nothing would report it.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-rake-schedules',
    title: 'The rake schedules — modelled, never observed, and reported as modelled',
    site: { file: 'scripts/backtest/heroEvRunner.mjs', symbol: 'DEFAULT_RAKE_CONFIG' },
    sites: [
      'scripts/backtest/heroEvRunner.mjs::DEFAULT_RAKE_CONFIG',
      'scripts/backtest/rakeSensitivity.mjs::ONLINE_2009_RAKE',
      'scripts/backtest/rakeSensitivity.mjs::LIVE_DOUBLE_RAKE',
      'scripts/backtest/rakeSensitivity.mjs::ZERO_RAKE',
      'scripts/backtest/probeFoldBranchRake.mjs::LIVE_1_3',
    ],
    keySpace: ['rakeSchedule'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'The strongest declaration of an assumption anywhere in the harvest, and it is '
      + 'worth quoting in full: "Modelled online 50NL rake. The corpus stores NO rake, so this '
      + 'is an assumption about the games these hands came from, not a reading of them — and it '
      + 'is reported as modelled wherever it appears. POKER_THEORY 11.3 defines the schedule '
      + 'shape." LIVE_DOUBLE_RAKE states what its simplification omits and why: a literal live '
      + 'schedule "would also need a bb-relative cap conversion... and a promo-drop term, both '
      + 'of which would blur the doubling without changing the conclusion."',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 5,
      cellCount: 12,
      primaryPath: true,
      instrument: {
        what: 'The schedules are FACTS about real card rooms, not estimates to be fitted: the '
          + 'founder\'s room publishes its rake, cap, and jackpot drop. Replacing the modelled '
          + 'live schedule with the observed one is data entry, and it is the single cheapest '
          + 'improvement to live-transferred EV in this ledger. The online 2009 schedule stays '
          + 'modelled by necessity — that corpus really does store no rake.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'FIVE CONSTRUCTS, ONE ROW, because they are one assumption expressed at five points: the '
      + 'runner default, the three sensitivity arms, and a probe. Reach 5 = 1 each.',
      'RAKE IS WHERE LIVE-VS-ONLINE TRANSFER BITES HARDEST and this row is the honest record of '
      + 'it. Live 1/2-1/3 rake is roughly double online 50NL by percentage and the cap binds '
      + 'differently, which is why LIVE_DOUBLE_RAKE exists as a sensitivity arm at all. An EV '
      + 'figure quoted from the online-rake arm is not the founder\'s EV.',
      'LIVE_1_3 (pct 0.10, cap 6, jackpotDrop 2) is the closest thing in the repo to the '
      + 'founder\'s actual schedule and it lives in a one-off probe script rather than in the '
      + 'shared schedule table. Promoting it is part of the same data-entry fix.',
      'The declaration discipline here is the model for the whole ledger: name the assumption, '
      + 'name what it is NOT (a reading of the corpus), name what the simplification drops, and '
      + 'report it as modelled at every use site.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-hero-seat-by-pos',
    title: 'Position label -> the seat the backtest harness places hero in',
    site: { file: 'scripts/backtest/entryMap.mjs', symbol: 'HERO_SEAT_BY_POS' },
    sites: ['scripts/backtest/entryMap.mjs::HERO_SEAT_BY_POS'],
    keySpace: ['position'],
    foundation: 'structural-computation',
    foundationStatus: 'declared-estimate',
    provenance: 'A stated construction rather than an estimate: "The seat this map places hero '
      + 'in for each position category, and its action index", sitting directly below the seat '
      + 'table it derives from (seat 9 = BTN = LATE, seat 1 = SB, seat 2 = BB = "last to act '
      + 'preflop"). EARLY: 3, MIDDLE: 5, LATE: 8, SB: 1, BB: 2.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 3,
      cellCount: 5,
      primaryPath: true,
      instrument: {
        what: 'It collapses each position CATEGORY to one representative seat, so the question '
          + 'is representativeness, not correctness: does scoring EARLY at seat 3 give the same '
          + 'answer as averaging over seats 3 and 4? Score the categories at every constituent '
          + 'seat once and report the spread. If it is material, every position-conditioned '
          + 'measurement in the harness carries that bias.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'A MEASUREMENT-PATH CONSTANT of the same family as LBL-bucket-midpoint: it does not price '
      + 'a hand, it decides what the instrument looks at. A representative-seat choice is '
      + 'invisible in every result it produces.',
      'It also closes a loop with LBL-positional-fold-to-3bet: the engine table keyed on '
      + 'position matchups would be measured by a harness that itself collapses position to one '
      + 'seat per category. Neither is wrong, and the composition needs stating.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-ladder-axes',
    title: 'The study-ladder axis definitions, carrying an explicitly sign-critical field',
    site: { file: 'scripts/backtest/ladderAxes.mjs', symbol: 'AXES' },
    sites: ['scripts/backtest/ladderAxes.mjs::AXES'],
    keySpace: ['ladderAxis'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'States its own most dangerous field and why it is stated centrally: '
      + '"`studiedDirection` is what the ladder hypothesis says a player MOVES TOWARD as they '
      + 'study. It is needed for the ordering test and is stated here rather than at the call '
      + 'site, because getting the sign wrong would turn \'acquired the rung\' into \'has not '
      + 'acquired it\' and the co-occurrence matrix would still look perfectly plausible."',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 3,
      cellCount: 3,
      primaryPath: true,
      instrument: {
        what: 'Each `studiedDirection` is a falsifiable claim about how players change with '
          + 'study, so the instrument is the ladder study itself run with the sign as a free '
          + 'parameter: fit the direction from the data rather than asserting it, and compare. '
          + 'An axis whose fitted direction opposes its declared one is a refuted rung.',
        ticket: 'WS-320',
      },
    }),
    notes: [
      'THE DOCBLOCK DESCRIBES A SELF-CONCEALING FAILURE — a wrong sign produces a plausible '
      + 'matrix — which is the same shape as the separability defect WS-320 hit, where a control '
      + 'axis was printed but never applied and three of five verdicts were wrong. Recognising '
      + 'the failure mode in prose did not prevent the neighbouring instance of it.',
      'The instrument ticket is WS-320 rather than WS-445: the ladder study owns this axis set, '
      + 'and the ledger\'s job here is to make sure the axis definitions are ranked alongside '
      + 'everything else rather than living only inside that study.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-outcome-aware-boosts',
    title: 'Showdown-outcome label -> range-update boost, three inline ternaries in one function',
    site: { file: 'src/utils/rangeEngine/bayesianUpdater.js', symbol: 'altSuitBoost' },
    sites: [
      'src/utils/rangeEngine/bayesianUpdater.js::altSuitBoost#ternary1',
      'src/utils/rangeEngine/bayesianUpdater.js::adjPairBoost#ternary1',
      'src/utils/rangeEngine/bayesianUpdater.js::adjKickerBoost#ternary1',
    ],
    keySpace: ['showdownOutcome'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. Three lines under one comment, "Outcome-aware boost '
      + 'levels": won 0.30 / lost 0.15 / else 0.25, won 0.25 / lost 0.10 / else 0.20, won 0.20 / '
      + 'lost 0.08 / else 0.15. Nine constants, no docblock, no citation.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 4,
      cellCount: 9,
      primaryPath: true,
      instrument: {
        what: 'The claim is that a showdown you WON is stronger evidence about villain\'s range '
          + 'than one you LOST — a 2x ratio at every level. That is a likelihood-ratio claim and '
          + 'the corpus answers it: measure how much the observed hand actually narrows the '
          + 'posterior conditional on outcome. If the ratio is 1, the outcome axis is a free '
          + 'parameter doing nothing.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'A LABEL-KEYED BOOST INSIDE THE BAYESIAN UPDATER, which is where labels-as-inputs matters '
      + 'most: this is the code that turns an observation into a range update, so a wrong '
      + 'multiplier here propagates into every subsequent estimate about that villain.',
      'The 2:1 won/lost ratio is consistent across all three boosts, which means it is ONE '
      + 'author decision expressed nine times rather than nine independent judgments. That makes '
      + 'the row cheaper to resolve and the underlying claim more load-bearing than it looks.',
      'It is also the shape POKER_THEORY warns about from the other direction: a showdown '
      + 'outcome is a draw from a distribution, not a measurement of villain\'s range, so '
      + 'weighting evidence by whether hero won risks encoding results-orientation as a prior.',
      'Reach 4 is INDIRECT — traced through the enclosing bindings, not the constructs.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-m-ratio-zones',
    title: 'M-ratio cut points that manufacture a tournament pressure zone',
    site: { file: 'src/constants/tournamentConstants.js', symbol: 'M_RATIO_ZONES' },
    sites: ['src/constants/tournamentConstants.js::M_RATIO_ZONES'],
    keySpace: ['mRatioZone'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'Header says "M-RATIO ZONES (for color coding)"; the entries carry `min` '
      + 'thresholds (GREEN 20, YELLOW 10, ...) beside `color` and `label`. The cut points are '
      + 'the Harrington zone convention, which is a citable external source the file does not '
      + 'cite.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 4,
      cellCount: 8,
      primaryPath: false,
      instrument: {
        what: 'M-ratio zones have a first-principles referent — the stack depth at which push/'
          + 'fold becomes correct — and the ICM engine that already ships can compute it. '
          + 'Compare the computed indifference points against the 20/10 convention rather than '
          + 'inheriting the convention.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'IT IS A ROW RATHER THAN A `display-only` EXCLUSION on purpose, and the reasoning belongs '
      + 'on the record: a cosmetic `label`/`color` field beside a threshold does not make the '
      + 'threshold cosmetic. Today all four readers are in the constants file itself; the moment '
      + 'a push/fold consumer reads a zone, this becomes a decision input, and `--verify` will '
      + 'flag the reach change on the run after it happens.',
      'The tournament push/fold and bubble consumers are deferred work, so this row is a '
      + 'placeholder in the useful sense: it is already ranked when the consumer arrives.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-game-type-rake-defaults',
    title: 'Game-type label -> buy-in, rebuy AND rake schedule, read by the rake resolver',
    site: { file: 'src/constants/sessionConstants.js', symbol: 'GAME_TYPES' },
    sites: ['src/constants/sessionConstants.js::GAME_TYPES'],
    keySpace: ['gameType'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'The docblock enumerates the fields and sources none of them: "Poker game types '
      + 'with default buy-in and rebuy amounts. Each game type includes: label: Display name; '
      + 'buyInDefault: Default buy-in amount for this game; rebuyDefault: Default rebuy amount '
      + 'for this game." It does not mention the `rake` sub-object at all, which is the field '
      + 'that leaves the display layer.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 12,
      cellCount: 14,
      primaryPath: true,
      instrument: {
        what: 'The rake half is the same data-entry fix as LBL-rake-schedules and should happen '
          + 'in one pass: the founder\'s rooms publish their schedules per stake. The buy-in and '
          + 'rebuy defaults are UI convenience and need no measurement.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'IT LOOKS LIKE A SETTINGS TABLE AND IS PARTLY AN ENGINE INPUT, which is why it survived '
      + 'the exclusion pass. Eleven of its twelve read sites are contexts and views; the twelfth '
      + 'is `rakeResolver.js:117`, and rake enters every EV number the app produces.',
      'THE TABLE MIXES TWO KINDS OF CONSTANT under one docblock — display defaults that can be '
      + 'anything, and a rake schedule that is a fact about a real card room. Being wrong costs '
      + 'nothing in one half and biases every EV figure in the other, and nothing in the file '
      + 'distinguishes them.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-skill-signal-weights',
    title: 'Self-coach signal weights and decay — spec-cited, and user-adjustable',
    site: { file: 'src/utils/skillAssessment/composite.js', symbol: 'DEFAULT_WEIGHTS' },
    sites: [
      'src/utils/skillAssessment/composite.js::DEFAULT_WEIGHTS',
      'src/utils/skillAssessment/shapeLanguage/temporalDecay.js::DEFAULT_DECAY_PROFILE',
    ],
    keySpace: ['signal'],
    foundation: 'founder-estimate',
    foundationStatus: 'declared-estimate',
    provenance: 'Spec-cited and not derived: "Default signal weights per SCF Gate 4 v1 spec '
      + '§SCF-G4-SPINE" over W_leak 0.5 / W_drill 0.3 / W_recent / W_test. A spec section fixes '
      + 'that the weights exist and what they are called; it is not evidence for 0.5.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 6,
      cellCount: 6,
      primaryPath: false,
      instrument: {
        what: 'Mastery is a PREDICTION — that a player scoring high on a concept plays it better '
          + '— so the weights are scoreable by how well the composite predicts subsequent '
          + 'performance on that concept. That is the same prediction-ledger instrument '
          + 'LBL-recognizability-map and LBL-assumption-gate-thresholds need; three rows, one '
          + 'capture.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'ONE OF ITS READERS IS `SignalWeightSliders.jsx`, so the founder can already move these '
      + 'weights by hand. That is unusual and mostly good — it makes the defaults a starting '
      + 'point rather than a hidden constant — and it also means the shipped default is the one '
      + 'number that never gets examined, because anyone who cares has already moved it.',
      'Mastery is a LEARNING STATE and never a user-facing rank, per the standing rule; the '
      + 'weights feed the state, not a score shown to the founder as a grade.',
      'Reach 6 = DEFAULT_WEIGHTS 4 + DEFAULT_DECAY_PROFILE 2.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-solver-baselines',
    title: 'The 62-cell solver baseline table — the repo\'s only imported GTO reference',
    site: { file: 'src/utils/skillAssessment/solverBaselines.js', symbol: 'BASELINES' },
    sites: ['src/utils/skillAssessment/solverBaselines.js::BASELINES'],
    keySpace: ['spotKey'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE for the values. The keys are richly specified spot '
      + 'descriptors ("flop:dry:BUTTON:def:ip:bet:vsBet:pfa"), which is a strong conditioning '
      + 'statement — and no solver, solve configuration, or citation is named for the '
      + 'frequencies those keys map to.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 3,
      cellCount: 62,
      primaryPath: true,
      instrument: {
        what: 'THIS ONE IS NOT MEASURED, IT IS CITED. A solver baseline is an IMPORTED reference '
          + 'class — the correct instrument is to name the solver, the tree, the bet sizes and '
          + 'the ranges each cell came from, per POKER_THEORY\'s rule that GTO is imported and '
          + 'never invented. If no such run exists, the honest status is that these are '
          + 'estimates named "baselines" and the fix is a solve, not a corpus count.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'THE THIRD "GTO" TABLE IN THE LEDGER, after LBL-gto-baselines and LBL-gto-open-width, and '
      + 'by far the most carefully keyed. Three tables in three subsystems borrow the authority '
      + 'of a solver and none of them cites one. That pattern is only visible from an index.',
      'It is the reference every leak rule scores against (LBL-leak-rule-thresholds), so its '
      + 'errors do not stay local: a wrong baseline manufactures a leak the founder then studies.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-leak-rule-thresholds',
    title: 'The ten hero leak rules — per-rule detection thresholds, loaded by registry glob',
    site: { file: 'src/utils/skillAssessment/leakRules/heroPfOpenOverfold.js', symbol: 'rule' },
    sites: [
      'src/utils/skillAssessment/leakRules/heroPfOpenOverfold.js::rule',
      'src/utils/skillAssessment/leakRules/heroPf3betOverfold.js::rule',
      'src/utils/skillAssessment/leakRules/heroOop3betUnderfold.js::rule',
      'src/utils/skillAssessment/leakRules/heroOopCbetOverfold.js::rule',
      'src/utils/skillAssessment/leakRules/heroIpCbetOverfold.js::rule',
      'src/utils/skillAssessment/leakRules/heroFlopVsDonkMisresponse.js::rule',
      'src/utils/skillAssessment/leakRules/heroTurnBarrelFrequency.js::rule',
      'src/utils/skillAssessment/leakRules/heroMultiwayBluffFrequency.js::rule',
      'src/utils/skillAssessment/leakRules/heroBbDefenseWidth.js::rule',
      'src/utils/skillAssessment/leakRules/_template.js::rule',
    ],
    keySpace: ['leakRule'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE for the thresholds. Each rule declares a uniform shape — '
      + '`threshold: { deltaPP, minSampleSize, minSeverity }` — against a `relatedConceptId`, '
      + 'with a `_template.js` fixing the contract. The shape is specified; the numbers are not '
      + 'sourced.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 10,
      cellCount: 29,
      primaryPath: true,
      instrument: {
        what: 'Each rule fires when hero deviates from a solver baseline by `deltaPP` over '
          + '`minSampleSize` hands, so its error rates are simulable exactly as '
          + 'LBL-consequence-weights describes: how often does the rule fire on a hero playing '
          + 'the baseline, and how often does it miss a real deviation of a given size? A '
          + 'threshold that cannot clear its own false-positive rate at the founder\'s hand '
          + 'volume is unusable however well chosen.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'TEN CONSTRUCTS PLUS A TEMPLATE, ONE ROW: identical shape, one registry, one instrument. '
      + 'Reach 10 = one glob-load site each at heroLeakDetector.js:19.',
      'THESE ARE THE CONSTRUCTS THE TRACE FIRST CALLED VESTIGIAL, and they are not — '
      + '`heroLeakDetector.js:19` loads them with `import.meta.glob(\'./leakRules/*.js\', '
      + '{ eager: true })`, which writes no symbol a static import scan can see. The count is a '
      + 'FLOOR: reads through the namespace object cannot be attributed, so the true reach is '
      + 'higher than 10.',
      'They score hero against LBL-solver-baselines, which has no cited solver. A detection '
      + 'threshold measured against an unsourced baseline is two unmeasured layers deep, and the '
      + 'output is a leak the founder is told to work on.',
      '_template.js is included deliberately rather than excluded as scaffolding: it fixes the '
      + 'contract every rule copies, so a change there propagates to all ten.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-concept-registry',
    title: 'The 52-concept registry — the unit every mastery and leak claim is keyed to',
    site: { file: 'src/utils/skillAssessment/tierConceptMap.js', symbol: 'CONCEPT_REGISTRY' },
    sites: ['src/utils/skillAssessment/tierConceptMap.js::CONCEPT_REGISTRY'],
    keySpace: ['conceptId'],
    foundation: 'founder-estimate',
    foundationStatus: 'undeclared',
    provenance: 'NO STATED PROVENANCE. The concept ids are self-describing and hierarchical '
      + '("bb-defense-cluster", "bb-defense-vs-BUTTON", "blocker-effects-preflop", '
      + '"capped-vs-uncapped-ranges") and nothing states how the partition was chosen or what '
      + 'the numeric fields attached to each concept are grounded in.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 16,
      cellCount: 52,
      primaryPath: true,
      instrument: {
        what: 'The standing rule is that a concept should be a COHERENT SOLVER-BASELINE REGION — '
          + 'so the partition is testable rather than a matter of taste: within a concept, spots '
          + 'should share a baseline strategy, and across concepts they should not. Cluster the '
          + 'solver baselines and compare the induced partition against these 52. A concept '
          + 'spanning two regions is an umbrella that should split.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'THIRD-WIDEST REACH IN THE LEDGER at 16 read sites, and structurally upstream of the whole '
      + 'self-coach surface: mastery, leaks and drills are all keyed to these ids. A wrong '
      + 'partition does not produce a wrong number, it produces numbers about the wrong thing.',
      'The presence of both "bb-defense-cluster" and "bb-defense-vs-BUTTON" shows the hierarchy '
      + 'is already doing the splitting the high-granularity rule asks for — which is evidence '
      + 'the partition was thought about, and still not evidence that 52 is the right cut.',
    ],
  }),

  buildLabelEntry({
    labelId: 'LBL-action-prior-construction',
    title: 'Action label -> prior grid construction — the SANCTIONED use of a label, recorded as such',
    site: { file: 'src/utils/rangeEngine/populationPriors.js', symbol: 'buildActionPrior' },
    sites: [
      'src/utils/rangeEngine/populationPriors.js::buildActionPrior#switch1',
      'src/utils/rangeEngine/populationPriors.js::openFoot#ternary1',
    ],
    keySpace: ['action', 'position'],
    foundation: 'structural-computation',
    foundationStatus: 'declared-estimate',
    provenance: 'The one construct in this ledger whose docblock ANTICIPATES the objection and '
      + 'answers it, in place: "Position-conditioned PRIORS are explicitly sanctioned by §7.2 '
      + '(\'position labels can serve as priors in a Bayesian framework\') and follow the parent '
      + 'threeBet pattern above. NO DECISION READS A LABEL." Individual arms distinguish derived '
      + 'from chosen — "Top 3-5%: QQ+, AK heavy (2.3). Foot DERIVED — see THREE_BET_TOP_FRACTION" '
      + '— while "Widen GTO charts ~20% for live 1/2" is a judgment.',
    liveness: 'unconditional',
    impact: buildUnmeasuredReach({
      readSites: 3,
      cellCount: 22,
      primaryPath: true,
      instrument: {
        what: 'Split derived from chosen and measure only the second. The feet that come from '
          + 'THREE_BET_TOP_FRACTION are derivations and check by re-derivation; OPEN_WIDENING '
          + 'and ISO_WIDENING are the free parameters, and they are claims about how much wider '
          + 'than a GTO chart the live 1/2 field actually opens — countable on the corpus with '
          + 'the transfer caveat stated.',
        ticket: 'WS-445',
      },
    }),
    notes: [
      'THE ROW THAT SHOWS THE LEDGER IS NOT A BLACKLIST. A label keying a PRIOR is sanctioned by '
      + 'POKER_THEORY §7.2; a label keying a DECISION is not. This construct is the sanctioned '
      + 'case, it says so, and it still gets a row — because the row records the FOUNDATION of '
      + 'the numbers, and OPEN_WIDENING is unmeasured whether or not its use is legitimate.',
      'Recording sanctioned uses is what stops the ledger degrading into a list of accusations. '
      + 'A reader who finds this construct by grepping for label switches needs to find the '
      + '§7.2 answer attached, not re-open a settled question.',
      'DEC-025 Amd 1 governs the subclass arms: carved from the parent, never built '
      + 'independently, never normalised. The code follows it and says so.',
      'Reach 3 is INDIRECT (enclosing bindings): buildActionPrior 1 + openFoot 2.',
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
