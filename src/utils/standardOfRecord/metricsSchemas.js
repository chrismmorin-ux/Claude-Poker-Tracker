/**
 * metricsSchemas.js — the declared shapes of the Result Card `metrics` block (WS-434).
 *
 * WHY THIS EXISTS. `RESULT_CARD_FIELDS` declares `metrics` as a bare required object and
 * `resultCardProblems` never looked inside it. Measured consequence at HEAD 2026-08-14:
 * 12 producers, 11 distinct metrics shapes, ZERO universally shared keys, five sample-size
 * dialects (`n` / `total` / `evalN` / `nScoredDecisions` / `decisionsSeen`), three CI-naming
 * dialects, and two committed cards disagreeing on the name of the same constant. That is
 * the WS-291 mechanism — two numbers that never meet on one axis — reproduced INSIDE the
 * object built to stop it. VOCABULARY.md names the declared shape the "Scored Readout";
 * SCORED-READOUT-SPEC.md lists this declaration as ranked prerequisite #3.
 *
 * THE MODEL: A DISCRIMINATED UNION. `metrics.kind` names the variant; METRICS_KINDS maps it
 * to a schema registered in SOR_SCHEMAS, so `scripts/standardOfRecord/check-additive.mjs`
 * guards every variant exactly as it guards the Result Card itself. TWELVE KINDS, ONE PER
 * PRODUCER, deliberately — even where two shapes coincide today, a shared kind would force
 * two estimand families to co-evolve forever, and a later split would be a rename, the one
 * operation additive-only forbids.
 *
 * V1 IS THE SHAPE EACH PRODUCER EMITS AT HEAD, TRANSCRIBED VERBATIM — including its
 * dialect. Nothing was "cleaned up" at declaration time: a v1 that differs from what the
 * producers emit would either break them (the big-bang WS-434 forbids) or force a silent
 * rewrite of committed history. Canonical-vocabulary fields arrive as `since: 2` additions
 * BESIDE the dialect keys (founder-approved Stage 2); dialect keys are then marked
 * `deprecated` and emitted forever — the fault-register matchers
 * (`faultRegister.js` — regexes over TOP-LEVEL metrics key names) and external readers key
 * on them, so a rename is never available.
 *
 * DECLARATION DEPTH IS DELIBERATELY SHALLOW. Top-level keys everywhere (that is what the
 * fault matchers see and what WS-435 pins); one level deeper only where a nested path is
 * externally pinned (`divergence.preRegistration`, triple-pinned by decisionAtom.test.js,
 * schemas.js FORCING_QUESTIONS, and VOCABULARY.md) or canonical (the `{k, n, rate,
 * conditional}` leaves). Everything deeper stays `object`/`array` with a note: every
 * declared name is a forever commitment, so declare narrow and leave headroom.
 *
 * TWO DESCRIPTOR ATTRIBUTES BEYOND THE BASE FieldDescriptor:
 *   - `unit` — REQUIRED on every field in this file (schemas.test.js enforces it). "Every
 *     figure carries its units" is only checkable at declaration time; a runtime check
 *     cannot infer a number's unit. A unit change is a retype in disguise, so `unit` joins
 *     the additive snapshot.
 *   - `shape` — names another registered SOR_SCHEMAS entry the field's value must satisfy;
 *     `metricsProblems` recurses one level through it. Also snapshotted: unlinking a
 *     sub-schema would silently stop validating every leaf under it.
 */

/** Per-variant schema versions, spread into SOR_SCHEMA_VERSIONS by schemas.js. */
export const METRICS_SCHEMA_VERSIONS = Object.freeze({
  'metrics.shared.conditioned-rate': 1,
  'metrics.shared.divergence-pair': 1,
  'metrics.hero-ev': 1,
  // v2 = the Stage 2 canonical-vocabulary aliases (founder-approved 2026-08-14): conditioned
  // rates and unit-suffixed CI names added BESIDE the v1 dialect keys, which stay emitted
  // forever (fault matchers and legacy readers key on them).
  'metrics.depth-ablation': 2,
  'metrics.deviation-map': 1,
  'metrics.layer-divergence': 1,
  'metrics.per-player-width': 2,
  'metrics.range-calibration': 1,
  'metrics.atoms-instrument': 1,
  'metrics.river-flip-replicate': 2,
  'metrics.study-ladder': 1,
  'metrics.style-collapse': 1,
  'metrics.teachable-arms': 1,
  'metrics.fold-curve-shape': 2,
});

/**
 * kind → registered schema name. The kind is the slug already embedded in each producer's
 * `resultCardId` (`RC-<slug>-…`), so one grep finds the producer, the schema entry, the
 * baseline row, and every committed card of the family.
 */
export const METRICS_KINDS = Object.freeze({
  'hero-ev': 'metrics.hero-ev',
  'depth-ablation': 'metrics.depth-ablation',
  'deviation-map': 'metrics.deviation-map',
  'layer-divergence': 'metrics.layer-divergence',
  'per-player-width': 'metrics.per-player-width',
  'range-calibration': 'metrics.range-calibration',
  'atoms-instrument': 'metrics.atoms-instrument',
  'river-flip-replicate': 'metrics.river-flip-replicate',
  'study-ladder': 'metrics.study-ladder',
  'style-collapse': 'metrics.style-collapse',
  'teachable-arms': 'metrics.teachable-arms',
  'fold-curve-shape': 'metrics.fold-curve-shape',
});

/** The discriminator, identical on every variant. */
const kindField = (kind) => ({
  name: 'kind', type: 'string', since: 1, required: true, unit: 'enum',
  note: `Union discriminator — always "${kind}" for this variant. Dispatches metricsProblems to the declared field list; a card without one is invalid to PUBLISH and still legible to AUDIT (the disclaimerRegisterVersion asymmetry).`,
});

/**
 * THE CANONICAL CONDITIONED RATE — `{k, n, rate, conditional}`.
 *
 * Semantics copied from its definition site (`coverageCensus.js` rate helper): `rate` is
 * k/n and NULL exactly when n is 0 — never 0, never NaN — and `conditional` is the English
 * `P(event | conditioning set)` statement that names the denominator. Every count in a
 * metrics block adopts this shape going forward (founder-approved canonical vocabulary);
 * the five legacy dialects gain `since: 2` aliases pointing here rather than renames.
 */
const CONDITIONED_RATE_FIELDS = [
  { name: 'k', type: 'number', since: 1, required: true, unit: 'count',
    note: 'Numerator — occurrences of the event inside the conditioning population.' },
  { name: 'n', type: 'number', since: 1, required: true, unit: 'count',
    note: 'Denominator — the conditioning population, stated rather than implied.' },
  { name: 'rate', type: 'number|null', since: 1, required: true, unit: 'share [0,1]',
    note: 'k/n, and NULL exactly when n is 0. A 0/0 reported as 0 would read as a measured absence; null states the question was unanswerable.' },
  { name: 'conditional', type: 'string', since: 1, required: true, unit: 'prose — P(event | conditioning set)',
    note: 'Names the denominator in words. Numbers carry their conditioning set (repo doctrine); a bare rate whose denominator lives in a doc travels without it.' },
];

/**
 * THE WS-350 DIVERGENCE PAIR — both measures, both weightings, one volume, with the
 * pre-registration stamped in. `preRegistration` is a PINNED path: decisionAtom.test.js
 * asserts the FORCING_QUESTIONS entry naming `resultCard.metrics.divergence`, and
 * VOCABULARY.md's Pre-registration entry cites it verbatim. Do not move or rename.
 */
const DIVERGENCE_PAIR_FIELDS = [
  { name: 'preRegistration', type: 'object', since: 1, required: true, unit: 'record',
    note: 'The primary/weighting declaration made BEFORE the run, stamped verbatim. Computing both and reporting whichever agreed with the prior finding is indistinguishable, in the output, from choosing honestly — this stamp is what makes the choice checkable.' },
  { name: 'comparableByMagnitude', type: 'boolean', since: 1, required: true, unit: 'flag',
    note: 'FALSE for KL vs EV-difference (nats vs chips). Guards a reader from comparing the two measures by size; what is compared is their ORDERING over surfaces.' },
  { name: 'klDirection', type: 'string', since: 1, required: true, unit: 'enum',
    note: 'Which direction KL(reference||candidate) was computed in — KL is asymmetric and the direction is part of the measure\'s identity.' },
  { name: 'weightingReported', type: 'string', since: 1, required: true, unit: 'enum',
    note: 'Which weighting the reported figures carry, echoing the pre-registration.' },
  { name: 'bySurface', type: 'object', since: 1, required: true, unit: 'map (surfaceId → {volume, kl, ev-difference})',
    note: 'Both measures per surface on the SAME paired volume. Neither is omitted and neither presented alone.' },
  { name: 'ranking', type: 'object', since: 1, required: true, unit: 'record',
    note: 'klOrder/evOrder/ranksAgree/swaps/allOrders/pairwiseSeparation. A ranking disagreement between the measures is the finding, not a nuisance.' },
  { name: 'klFloorSweep', type: 'object', since: 1, required: true, unit: 'map (floor → ranking)',
    note: 'The ranking\'s sensitivity to KL_FLOOR — whether the order is an order of signal or of the floor constant.' },
];

// ─────────────────────────────────────────────────────────────────────────────────────────
// The twelve variants. Each transcribed from its producer's metrics literal at HEAD.
// ─────────────────────────────────────────────────────────────────────────────────────────

/** scripts/backtest/heroEvReport.mjs — the reference instrument's card. */
const HERO_EV_FIELDS = [
  kindField('hero-ev'),
  { name: 'edgeBB', type: 'number|null', since: 1, required: true, unit: 'bb per substituted decision',
    note: 'estimateEdge headline — V(π_ours) − V(π_pool), self-normalized IPS. Factor 1 of overallEvBB100. Null when nothing scored.' },
  { name: 'edgeCiLowBB', type: 'number|null', since: 1, required: true, unit: 'bb',
    note: 'Player-clustered bootstrap CI, low bound. Hands are never the cluster unit (POKER_THEORY §14.3).' },
  { name: 'edgeCiHighBB', type: 'number|null', since: 1, required: true, unit: 'bb', note: 'CI high bound, same clustering.' },
  { name: 'n', type: 'number', since: 1, required: true, unit: 'count (decisions)',
    note: 'Scored decisions. NOT independent draws — see ess.' },
  { name: 'ess', type: 'number|null', since: 1, required: true, unit: 'count (effective decisions)',
    note: 'Effective sample size after importance weighting. The honest denominator when weights collapse (WS-402: a 15% ESS makes every comparison read a seventh of its sample).' },
  { name: 'players', type: 'number', since: 1, required: true, unit: 'count (players)', note: 'Contributing EVAL players — the cluster count behind the CI.' },
  { name: 'controlEdgeBB', type: 'number|null', since: 1, required: true, unit: 'bb',
    note: 'Pool-against-itself arm — must be ~0 (CONTROL_DRIFT blocker enforces). The free correctness check on the estimator.' },
  { name: 'liveShiftedCiLowBB', type: 'number|null', since: 1, required: true, unit: 'bb',
    note: 'CI low bound under the live-shift stress — the transferred-population caveat expressed as a number.' },
  { name: 'pbrEdgeBB', type: 'number|null', since: 1, required: true, unit: 'bb',
    note: 'Pool Best Response edge — the one-sided ceiling (the Equilibrium frame does not exist). Null carries its reason in exploitationEfficiencyUnavailableReason.' },
  { name: 'exploitationEfficiency', type: 'number|null', since: 1, required: true, unit: 'share [0,1]',
    note: 'edgeBB / (EV(PBR) − EV(Field)) — invariant to engine change, NOT to corpus change; the companion, never the headline (SCORED-READOUT-SPEC §3.4).' },
  { name: 'exploitationEfficiencyUnavailableReason', type: 'string|null', since: 1, required: true, unit: 'prose',
    note: 'Why efficiency is null when it is. A bare null would read as "not measured" when it may mean "the ceiling was not resolvable on this run".' },
  { name: 'overallEvBB100', type: 'number|null', since: 1, required: true, unit: 'bb/100 hands',
    note: 'THE optimizable figure (§3.3): edgeBB × opportunitiesPerHand × 100. Compose ONLY via overallEv.composeOverallEv — metricsProblems rejects the product without both factors present (WS-410 Stage 2).' },
  { name: 'opportunitiesPerHand', type: 'number|null', since: 1, required: true, unit: 'opportunities/hand',
    note: 'Factor 2, from the coverage census over the Deal Book — structurally refused if derived from the scored subset (n/handsRepresented inherits every harness sampling limit).' },
];

/** scripts/backtest/depthAblationReport.mjs — paired depth-1 vs depth-2/3 delta. */
const DEPTH_ABLATION_FIELDS = [
  kindField('depth-ablation'),
  { name: 'depthDeltaBB', type: 'number|null', since: 1, required: true, unit: 'bb per substituted decision',
    note: 'Paired within-decision delta, differenced INSIDE one bootstrap draw. NAME FROZEN — WS-435 names this card\'s depthDelta* keys as a single point of truth.' },
  { name: 'depthDeltaCiLowBB', type: 'number|null', since: 1, required: true, unit: 'bb', note: 'Paired CI low, player-clustered. NAME FROZEN (WS-435).' },
  { name: 'depthDeltaCiHighBB', type: 'number|null', since: 1, required: true, unit: 'bb', note: 'Paired CI high. NAME FROZEN (WS-435).' },
  { name: 'depthDeltaExcludesZero', type: 'boolean|null', since: 1, required: true, unit: 'flag',
    note: 'Whether the paired interval excludes zero. Stated so a reader does not eyeball it off rounded bounds.' },
  { name: 'edgeBaseArmBB', type: 'number|null', since: 1, required: true, unit: 'bb', note: 'Absolute base-arm edge. Not quotable below the cluster bar — see admissibility.' },
  { name: 'edgeTestArmBB', type: 'number|null', since: 1, required: true, unit: 'bb', note: 'Absolute test-arm edge, same caveat.' },
  { name: 'topActionFlipShare', type: 'number|null', since: 1, required: true, unit: 'share [0,1]',
    note: 'Share of paired decisions whose argmax flipped. A DIAGNOSTIC, not the claim — a flip count treats a marginal check/bet flip and a stack-off flip as the same event (Amendment 1).' },
  { name: 'flipShareByStreet', type: 'object', since: 1, required: true, unit: 'map (street → share [0,1])',
    note: 'WHERE the flips are — the whole finding (river 0.80 on the committed card). On the card itself so the Ladder and fault matchers can see it.' },
  { name: 'flipCountByStreet', type: 'object', since: 1, required: true, unit: 'map (street → {flips, n})',
    note: 'The counts behind the shares. Legacy {flips, n} dialect — superseded by flipByStreetConditioned (v2) and still emitted forever.' },
  { name: 'flipByStreetConditioned', type: 'object', since: 2, required: false, unit: 'map (street → conditioned rate)',
    note: 'CANONICAL ALIAS (Stage 2) for flipCountByStreet: per-street {k, n, rate, conditional} — same counts, canonical vocabulary, validated by the conditioned-rate walk.' },
  { name: 'flipDirections', type: 'object', since: 1, required: true, unit: 'map ("from→to" → count)',
    note: 'Directional flip census — 38/40 toward passivity was the WS-378 signal, invisible in an undirected count.' },
  { name: 'meanTotalVariation', type: 'number|null', since: 1, required: true, unit: 'total variation [0,1]',
    note: 'Mean TV distance between the arms\' action distributions — movement below the argmax threshold that flip counts cannot see.' },
  { name: 'maxTotalVariation', type: 'number|null', since: 1, required: true, unit: 'total variation [0,1]', note: 'Worst single-decision movement.' },
  { name: 'identicalShare', type: 'number|null', since: 1, required: true, unit: 'share [0,1]',
    note: 'Share of decisions where the arms emitted bit-identical distributions — the null-effect mass, stated.' },
  { name: 'n', type: 'number', since: 1, required: true, unit: 'count (decisions)', note: 'Paired decisions in the delta.' },
  { name: 'discordantN', type: 'number|null', since: 1, required: true, unit: 'count (decisions)',
    note: 'Decisions where the arms\' weights actually differ — the honest denominator for the delta.' },
  { name: 'players', type: 'number', since: 1, required: true, unit: 'count (players)', note: 'Cluster count behind the CI.' },
  { name: 'divergenceN', type: 'number', since: 1, required: true, unit: 'count (decisions)', note: 'Denominator of the advice-divergence block.' },
  { name: 'controlEdgeBB', type: 'number|null', since: 1, required: true, unit: 'bb', note: 'Pool-against-itself control, must be ~0.' },
  { name: 'notAVerdict', type: 'boolean', since: 1, required: true, unit: 'flag',
    note: 'The card carries its own refusal so a reader who reaches for it out of context still meets it.' },
];

/** scripts/backtest/deviationMap.mjs — pool deviation from the MDF floor, per geometry cell. */
const DEVIATION_MAP_FIELDS = [
  kindField('deviation-map'),
  { name: 'deviationVolume', type: 'number', since: 1, required: true, unit: 'frequency-weighted deviation (points × share)',
    note: 'Total weighted deviation from the unexploitable floor. A deviation, NOT an EV figure — pricing it requires the game tree and is a different card.' },
  { name: 'totalDecisions', type: 'number', since: 1, required: true, unit: 'count (decisions)', note: 'All observed continuation decisions in the map.' },
  { name: 'wellSampledCells', type: 'number', since: 1, required: true, unit: 'count (cells)', note: 'Cells above the per-cell n bar.' },
  { name: 'thinCells', type: 'number', since: 1, required: true, unit: 'count (cells)', note: 'Cells below the bar — flagged, never dropped (RULE 7d).' },
  { name: 'minCellN', type: 'number', since: 1, required: true, unit: 'count (decisions)', note: 'The bar itself, stated on the card.' },
  { name: 'topCells', type: 'array', since: 1, required: true, unit: 'rows ({cell, n, thin, observed, floor, deviation, weighted, reads})',
    note: 'Top 10 cells by weighted deviation. Row internals undeclared at v1 — no external reader pins them.' },
];

/** scripts/backtest/layerAblation.mjs — WS-350 divergence pair + layer attribution. */
const LAYER_DIVERGENCE_FIELDS = [
  kindField('layer-divergence'),
  { name: 'divergence', type: 'object', since: 1, required: true, unit: 'record', shape: 'metrics.shared.divergence-pair',
    note: 'THE PAIR — both measures, both weightings, one volume, pre-registration stamped. The path metrics.divergence.preRegistration is pinned by decisionAtom.test.js and VOCABULARY.md; never move it.' },
  { name: 'attribution', type: 'object', since: 1, required: true, unit: 'record',
    note: 'Layer attribution block. Key set comes from a spread of layerAttribution output — deliberately UNDECLARED at v1; declaring it would freeze an unstable set.' },
  { name: 'counters', type: 'object', since: 1, required: true, unit: 'record (counts)',
    note: 'checkpoints / skips / armFailures / engineErrors — was the run produced cleanly, on the card.' },
  { name: 'notAnEdge', type: 'boolean', since: 1, required: true, unit: 'flag',
    note: 'Divergence is not an edge; the card refuses the misreading itself.' },
];

/** scripts/backtest/rangeCalibrationProbe.mjs — per-player width vs population width. */
const PER_PLAYER_WIDTH_FIELDS = [
  kindField('per-player-width'),
  { name: 'perPlayerMinusPopulationNatsPerDecision', type: 'number|null', since: 1, required: true, unit: 'nats/decision',
    note: 'The headline: held-out gain of the per-player width arm over the single population width.' },
  { name: 'headlineSe', type: 'number|null', since: 1, required: true, unit: 'nats/decision',
    note: 'SE of the headline. Bare-name dialect — superseded by headlineSeNatsPerDecision (v2), still emitted forever.' },
  { name: 'headlineSeNatsPerDecision', type: 'number|null', since: 2, required: false, unit: 'nats/decision',
    note: 'CANONICAL ALIAS (Stage 2) for headlineSe — the unit rides in the name, the convention hero-ev\'s BB suffixes established.' },
  { name: 'headlineArm', type: 'string', since: 1, required: true, unit: 'enum', note: 'Which arm the headline quotes (shrunk vs unshrunk).' },
  { name: 'unshrunkPerPlayerMinusPopulationNatsPerDecision', type: 'number|null', since: 1, required: true, unit: 'nats/decision',
    note: 'The maximal per-player arm — answers the question when chosen k collapsed the shrunk arm onto population.' },
  { name: 'unshrunkSe', type: 'number|null', since: 1, required: true, unit: 'nats/decision', note: 'SE of the unshrunk arm.' },
  { name: 'unshrunkPlayersMovedOffPopulation', type: 'number', since: 1, required: true, unit: 'count (players)', note: 'Players the unshrunk arm actually moved.' },
  { name: 'headlineCiLow', type: 'number|null', since: 1, required: true, unit: 'nats/decision',
    note: 'CI low. Bare-name dialect — superseded by headlineCiLowNatsPerDecision (v2), still emitted forever.' },
  { name: 'headlineCiHigh', type: 'number|null', since: 1, required: true, unit: 'nats/decision',
    note: 'CI high. Same dialect note.' },
  { name: 'headlineCiLowNatsPerDecision', type: 'number|null', since: 2, required: false, unit: 'nats/decision',
    note: 'CANONICAL ALIAS (Stage 2) for headlineCiLow.' },
  { name: 'headlineCiHighNatsPerDecision', type: 'number|null', since: 2, required: false, unit: 'nats/decision',
    note: 'CANONICAL ALIAS (Stage 2) for headlineCiHigh.' },
  { name: 'verdict', type: 'string', since: 1, required: true, unit: 'enum',
    note: 'signal | no-signal | underpowered — THE SEPARATOR IS POWER, NOT SAMPLE SIZE (classifyPlayerSignal); refuses to read a weak-power null as absence.' },
  { name: 'populationWidthMultiplier', type: 'number|null', since: 1, required: true, unit: 'width multiplier', note: 'The argmax population width itself.' },
  { name: 'populationWidthN', type: 'number', since: 1, required: true, unit: 'count (decisions)', note: 'Evidence behind the population width.' },
  { name: 'populationNarrowingWorthNats', type: 'number|null', since: 1, required: true, unit: 'nats/decision', note: 'What population narrowing alone is worth.' },
  { name: 'populationNarrowingWorthSe', type: 'number|null', since: 1, required: true, unit: 'nats/decision', note: 'Its SE.' },
  { name: 'chosenShrinkageK', type: 'number|string', since: 1, required: true, unit: 'pseudocount (or "Infinity")',
    note: 'Selected shrinkage k. Serialized as the STRING "Infinity" when unbounded — JSON has no Infinity; transcribed faithfully, not "fixed" (a fix would be a retype at birth).' },
  { name: 'playersSignal', type: 'number', since: 1, required: true, unit: 'count (players)', note: 'Players classified signal.' },
  { name: 'playersNegativeSignal', type: 'number', since: 1, required: true, unit: 'count (players)', note: 'Players classified negative-signal.' },
  { name: 'playersNoSignalObservedZero', type: 'number', since: 1, required: true, unit: 'count (players)',
    note: 'Observed-zero, distinct from never-looked — the census distinction, applied to players.' },
  { name: 'playersUnderpoweredCannotTell', type: 'number', since: 1, required: true, unit: 'count (players)', note: 'Underpowered — cannot tell, never folded into no-signal.' },
  { name: 'playersTotal', type: 'number', since: 1, required: true, unit: 'count (players)', note: 'Denominator for the class counts.' },
  { name: 'heldoutPlayers', type: 'number', since: 1, required: true, unit: 'count (players)', note: 'Held-out players in the headline.' },
  { name: 'heldoutPlayersScored', type: 'number', since: 1, required: true, unit: 'count (players)', note: 'Held-out players that produced a score.' },
  { name: 'heldoutTestDecisions', type: 'number', since: 1, required: true, unit: 'count (decisions)', note: 'Held-out test decisions.' },
  { name: 'heldoutPlayersMovedOffPopulation', type: 'number', since: 1, required: true, unit: 'count (players)', note: 'Held-out players the chosen arm moved.' },
  { name: 'poolRevealedDecisions', type: 'number', since: 1, required: true, unit: 'count (decisions)', note: 'POOL-half revealed decisions scanned.' },
  { name: 'evalRevealedDecisions', type: 'number', since: 1, required: true, unit: 'count (decisions)', note: 'EVAL-half revealed decisions scanned.' },
  { name: 'rawWidthMedian', type: 'number|null', since: 1, required: true, unit: 'width multiplier', note: 'Median raw per-player width estimate.' },
  { name: 'rawWidthP25', type: 'number|null', since: 1, required: true, unit: 'width multiplier', note: 'P25.' },
  { name: 'rawWidthP75', type: 'number|null', since: 1, required: true, unit: 'width multiplier', note: 'P75.' },
  { name: 'rawWidthPlayersWithEstimate', type: 'number', since: 1, required: true, unit: 'count (players)', note: 'Players with a raw width estimate.' },
  { name: 'rawWidthPlayersNoEstimate', type: 'number', since: 1, required: true, unit: 'count (players)', note: 'Players without one — counted, not dropped.' },
  { name: 'rawWidthEdgePinned', type: 'number', since: 1, required: true, unit: 'count (players)', note: 'Estimates pinned at the search-grid edge.' },
  { name: 'rawWidthEdgePinnedShare', type: 'number|null', since: 1, required: true, unit: 'share [0,1]', note: 'Edge-pinned share — a saturated grid is an instrument defect, stated.' },
  { name: 'medianRevealedPerPlayer', type: 'number|null', since: 1, required: true, unit: 'count (decisions)',
    note: 'Median revealed decisions per player — the identifiability number (35–51 on the well-sampled axes).' },
  { name: 'showdownConditional', type: 'boolean', since: 1, required: true, unit: 'flag',
    note: 'Every figure is conditional on the holding being revealed — a selection term, carried as data.' },
  { name: 'foldRevealRate', type: 'number', since: 1, required: true, unit: 'share [0,1]', note: 'Share of reveals arriving via fold-reveal rather than showdown.' },
];

/** scripts/backtest/rangeCalibrationReport.mjs — range model vs uniform, with selection bounds. */
const RANGE_CALIBRATION_FIELDS = [
  kindField('range-calibration'),
  { name: 'villainDeltaLogVsUniform', type: 'number|null', since: 1, required: true, unit: 'nats/decision',
    note: 'Mean log P(true holding) minus log uniform-over-live-combos, villain arm. CONDITIONAL ON REVEAL.' },
  { name: 'actingDeltaLogVsUniform', type: 'number|null', since: 1, required: true, unit: 'nats/decision', note: 'Acting-player arm.' },
  { name: 'chainDepth3DeltaLogVsUniform', type: 'number|null', since: 1, required: true, unit: 'nats/decision', note: 'Chained-narrowing arm at depth 3.' },
  { name: 'villainCoverage', type: 'number|null', since: 1, required: true, unit: 'share [0,1]',
    note: 'Share of revealed holdings inside the retained range. Saturates at 1.0 BY CONSTRUCTION since WS-291/302 — see coverageSaturated.' },
  { name: 'villainRetainedFraction', type: 'number|null', since: 1, required: true, unit: 'share [0,1]', note: 'Range mass retained — coverage\'s denominator side.' },
  { name: 'villainCoverageLift', type: 'number|null', since: 1, required: true, unit: 'ratio', note: 'Coverage vs retained-combo baseline.' },
  { name: 'actingCoverage', type: 'number|null', since: 1, required: true, unit: 'share [0,1]', note: 'Acting arm coverage.' },
  { name: 'actingRetainedFraction', type: 'number|null', since: 1, required: true, unit: 'share [0,1]', note: 'Acting arm retained fraction.' },
  { name: 'actingCoverageLift', type: 'number|null', since: 1, required: true, unit: 'ratio', note: 'Acting arm lift.' },
  { name: 'villainRevealRate', type: 'number|null', since: 1, required: true, unit: 'share [0,1]',
    note: 'P(holding revealed) — the selection term itself, as data.' },
  { name: 'villainCoverageBoundLow', type: 'number|null', since: 1, required: true, unit: 'share [0,1]',
    note: 'Worst-case population coverage if every unrevealed holding missed. The population claim; the coverage figures above are reveal-conditional.' },
  { name: 'villainCoverageBoundHigh', type: 'number|null', since: 1, required: true, unit: 'share [0,1]', note: 'Best-case bound.' },
  { name: 'villainCoverageBoundWidth', type: 'number|null', since: 1, required: true, unit: 'share [0,1]', note: 'Bound width — the price of the selection.' },
  { name: 'actingRevealRate', type: 'number|null', since: 1, required: true, unit: 'share [0,1]', note: 'Acting arm reveal rate.' },
  { name: 'actingCoverageBoundLow', type: 'number|null', since: 1, required: true, unit: 'share [0,1]', note: 'Acting arm bound low.' },
  { name: 'actingCoverageBoundHigh', type: 'number|null', since: 1, required: true, unit: 'share [0,1]', note: 'Acting arm bound high.' },
  { name: 'actingCoverageBoundWidth', type: 'number|null', since: 1, required: true, unit: 'share [0,1]', note: 'Acting arm bound width.' },
  { name: 'villainN', type: 'number|null', since: 1, required: true, unit: 'count (decisions)', note: 'Villain-arm scored decisions.' },
  { name: 'actingN', type: 'number|null', since: 1, required: true, unit: 'count (decisions)', note: 'Acting-arm scored decisions.' },
  { name: 'players', type: 'number|null', since: 1, required: true, unit: 'count (players)', note: 'Players scanned.' },
  { name: 'handsRead', type: 'number|null', since: 1, required: true, unit: 'count (hands)', note: 'Hands read.' },
  { name: 'decisionsSeen', type: 'number|null', since: 1, required: true, unit: 'count (decisions)', note: 'Decisions seen before selection.' },
  { name: 'coverageSaturated', type: 'boolean', since: 1, required: true, unit: 'flag',
    note: 'Coverage pinned at 1.0 by construction — it can no longer distinguish a good range model from a bad one and must not be quoted as evidence the run went well.' },
  { name: 'discriminatingMetric', type: 'string', since: 1, required: true, unit: 'enum',
    note: 'Which metric is actually carrying the run when coverage saturates (deltaLogVsUniform cannot saturate).' },
  { name: 'showdownConditional', type: 'boolean', since: 1, required: true, unit: 'flag', note: 'Selection term carried as data, same as per-player-width.' },
];

/** scripts/backtest/run-atoms.mjs — the reconstruction instrument's coverage card. */
const ATOMS_INSTRUMENT_FIELDS = [
  kindField('atoms-instrument'),
  { name: 'scoredShare', type: 'number|null', since: 1, required: true, unit: 'share [0,1]',
    note: 'Flat convenience copy of scoredGivenModeled.rate — the one duplicate scalar tolerated, because a top-level key is what the fault matchers can see.' },
  { name: 'scoredGivenModeled', type: 'object', since: 1, required: true, unit: 'conditioned rate', shape: 'metrics.shared.conditioned-rate',
    note: 'P(scored | modeled node) with its full conditioning set — the canonical shape this whole schema standardizes on.' },
  { name: 'modeledNodes', type: 'number', since: 1, required: true, unit: 'count (nodes)', note: 'The conditioning population, also stated flat.' },
  { name: 'neverLookedGivenReachable', type: 'object', since: 1, required: true, unit: 'conditioned rate', shape: 'metrics.shared.conditioned-rate',
    note: 'The never-looked cells — a coverage GAP, structurally distinct from a measured absence (WS-328 census doctrine).' },
  { name: 'observedZeroGivenExamined', type: 'object', since: 1, required: true, unit: 'conditioned rate', shape: 'metrics.shared.conditioned-rate',
    note: 'Examined and empty — the measured absence, beside the gap, never folded into it.' },
  { name: 'droppedGivenReachable', type: 'object', since: 1, required: true, unit: 'conditioned rate', shape: 'metrics.shared.conditioned-rate',
    note: 'Reached and then DISCARDED, with skip reasons — previously indistinguishable from a genuine zero.' },
  { name: 'predictionAuditDivergence', type: 'object', since: 1, required: true, unit: 'record ({wiredScored, unwiredScored, lift, divergedNodes, conditional})',
    note: 'Wired-vs-unwired scoring divergence. Carries a conditional WITHOUT k/n/rate (lift is null when unwired is empty) — a deliberate partial variant, not an undeclared dialect.' },
  { name: 'skipReasons', type: 'object', since: 1, required: true, unit: 'map (reason → count)', note: 'A skip is data, never silently dropped.' },
  { name: 'droppedDecisions', type: 'number', since: 1, required: true, unit: 'count (decisions)', note: 'Total dropped.' },
  { name: 'partiallyDroppedCells', type: 'number', since: 1, required: true, unit: 'count (cells)', note: 'Cells that lost some but not all decisions.' },
  { name: 'partitionExcludedDecisions', type: 'number', since: 1, required: true, unit: 'count (decisions)', note: 'Excluded by the POOL/EVAL partition — counted, so leakage control is visible.' },
  { name: 'leakage', type: 'object', since: 1, required: true, unit: 'record (guard summary)',
    note: 'LeakageGuard summary — poolPct / referenceMode / evalPlayersChecked / decisionsChecked / statWindowsChecked. Structural leakage control, on the card.' },
];

/** scripts/backtest/run-river-flip-replicate.mjs — seeded-replicate flip stability. */
const RIVER_FLIP_REPLICATE_FIELDS = [
  kindField('river-flip-replicate'),
  { name: 'systematicFlipShare', type: 'number|null', since: 1, required: true, unit: 'share [0,1]',
    note: 'Share of river decisions whose top action differs between the arms in EVERY one of R seeded replicates — systematic, not seed noise. Null when n is 0 (the producer\'s `n ? … : null` path — transcribed, not idealized).' },
  { name: 'systematicFlipCiLow', type: 'number|null', since: 1, required: true, unit: 'share [0,1] (player-clustered)',
    note: 'The QUOTABLE interval, clustered on players as clusterUnit promises. Bare-suffix dialect — superseded by systematicFlipCiLowShare (v2), still emitted forever.' },
  { name: 'systematicFlipCiHigh', type: 'number|null', since: 1, required: true, unit: 'share [0,1] (player-clustered)', note: 'Quotable interval, high. Same dialect note.' },
  { name: 'systematicFlipCiLowBinomialOverDecisions', type: 'number|null', since: 1, required: true, unit: 'share [0,1] (binomial over decisions)',
    note: 'Within-node-set precision — named separately so it can never be mistaken for the generalising interval. Null-tolerant for the n=0 path.' },
  { name: 'systematicFlipCiHighBinomialOverDecisions', type: 'number|null', since: 1, required: true, unit: 'share [0,1] (binomial over decisions)', note: 'Same, high bound.' },
  { name: 'seedDependentShare', type: 'number|null', since: 1, required: true, unit: 'share [0,1]',
    note: 'Decisions that flip in SOME replicates — the seed-noise mass, separated from the systematic signal. Null when n is 0.' },
  { name: 'singleEvaluationFlipShare', type: 'number|null', since: 1, required: true, unit: 'share [0,1]',
    note: 'What a single unreplicated evaluation would have reported — the number this instrument exists to correct. Null when n is 0.' },
  { name: 'systematicFlip', type: 'object|null', since: 2, required: false, unit: 'conditioned rate', shape: 'metrics.shared.conditioned-rate',
    note: 'CANONICAL ALIAS (Stage 2): {k: systematic flips, n: replicated decisions, rate, conditional} — the headline share carrying its own conditioning set.' },
  { name: 'systematicFlipCiLowShare', type: 'number|null', since: 2, required: false, unit: 'share [0,1] (player-clustered)',
    note: 'CANONICAL ALIAS (Stage 2) for systematicFlipCiLow — unit-suffixed so the two interval families are named, not inferred.' },
  { name: 'systematicFlipCiHighShare', type: 'number|null', since: 2, required: false, unit: 'share [0,1] (player-clustered)',
    note: 'CANONICAL ALIAS (Stage 2) for systematicFlipCiHigh.' },
  { name: 'n', type: 'number', since: 1, required: true, unit: 'count (decisions)', note: 'Replicated river decisions.' },
  { name: 'players', type: 'number', since: 1, required: true, unit: 'count (players)', note: 'Contributing players (cluster count).' },
  { name: 'replicates', type: 'number', since: 1, required: true, unit: 'count (replicates)', note: 'R — seeded replicates per decision.' },
  { name: 'flipDirections', type: 'object', since: 1, required: true, unit: 'map ("from→to" → count)', note: 'Directional census of the systematic flips.' },
  { name: 'perArmArgmaxStability', type: 'object', since: 1, required: true, unit: 'map (arm → stability record)',
    note: 'Argmax stability within each arm across replicates — 1.000 is the frozen-clock determinism proof.' },
  { name: 'notAVerdict', type: 'boolean', since: 1, required: true, unit: 'flag', note: 'Outcome-free; not an EV claim; the card says so itself.' },
];

/** scripts/backtest/studyLadderReport.mjs — between-player heterogeneity ladder. */
const STUDY_LADDER_FIELDS = [
  kindField('study-ladder'),
  { name: 'handsSeen', type: 'number', since: 1, required: true, unit: 'count (hands)', note: 'Corpus hands read by the run.' },
  { name: 'primaryMinN', type: 'number', since: 1, required: true, unit: 'count (observations)', note: 'Per-player minimum for the primary verdict.' },
  { name: 'priorWeight', type: 'number', since: 1, required: true, unit: 'pseudocount', note: 'Beta-Binomial shrinkage pseudocount (leave-one-out prior).' },
  { name: 'controlAxis', type: 'string', since: 1, required: true, unit: 'enum',
    note: 'The same-run control axis — χ²/df is not comparable across runs (POKER_THEORY §15.3.1), so every verdict reads against this.' },
  { name: 'axes', type: 'object', since: 1, required: true, unit: 'map (axisId → axis block)',
    note: 'Per-axis separability evidence. Carries the RENAMED conditioning dialect ({conditioning, numerator, evalK, evalN, evalRate}) plus, since Stage 2, a canonical `conditioned` {k, n, rate, conditional} inside each block — validated by the conditioned-rate walk without freezing the block shape.' },
  { name: 'correlations', type: 'array', since: 1, required: true, unit: 'rows ({a, b, pearson, spearman, reliabilities, …})',
    note: 'Cross-axis correlations, disattenuated — whether two axes are one trait twice. ARRAY, not object (pinned from the committed card).' },
  { name: 'ordering', type: 'object', since: 1, required: true, unit: 'record ({thresholds[], pairwise[], nesting})',
    note: 'Threshold ordering and pairwise nesting between axes.' },
  { name: 'leakage', type: 'object', since: 1, required: true, unit: 'record (guard summary)', note: 'LeakageGuard summary, same shape as atoms-instrument.leakage.' },
];

/** scripts/backtest/emit-ws436-result-card.mjs — the style-label removal parity card. */
const STYLE_COLLAPSE_FIELDS = [
  kindField('style-collapse'),
  { name: 'villainPrediction', type: 'object', since: 1, required: true, unit: 'record (prose+figures)',
    note: 'Paired log-loss contrasts for the villain-prediction half. One-shot narrative card; internals deliberately undeclared.' },
  { name: 'advicePath', type: 'object', since: 1, required: true, unit: 'record (prose+figures)',
    note: 'Paired TV contrasts for the advice half, including the falsifier that MUST be zero.' },
  { name: 'absoluteEV', type: 'object', since: 1, required: true, unit: 'record ({statement, evDeltaOnMeasuredSet})',
    note: 'The absolute-EV statement WS-445\'s ledger row consumes — a removal at parity, delta exactly 0 on the measured set.' },
  { name: 'determinism', type: 'object', since: 1, required: true, unit: 'record (prose)',
    note: 'In-process and cross-process determinism gates at the corrected HEAD.' },
];

/** scripts/backtest/teachableArmsProbe.mjs — Δlog share of engine narrowing (DIAGNOSTIC). */
const TEACHABLE_ARMS_FIELDS = [
  kindField('teachable-arms'),
  { name: 'arms', type: 'object', since: 1, required: true, unit: 'map (armId → {deltaLogVsUniform, …})',
    note: 'Five arms scored PAIRED on one identical decision set — a decision counts only when all five produced a score.' },
  { name: 'shareOfEngineEdge', type: 'object', since: 1, required: true, unit: 'record ({A2, A3, A4, engineEdgeDeltaLog} — shares of Δlog)',
    note: 'Never null ON A CARD: teachableArmsResultCard throws before minting when the engine edge is not positive — a share of a non-existent edge is not a number.' },
  { name: 'handsRead', type: 'number|null', since: 1, required: true, unit: 'count (hands)', note: 'Hands read.' },
  { name: 'nPlayersPool', type: 'number|null', since: 1, required: true, unit: 'count (players)', note: 'POOL players (mining half).' },
  { name: 'nPlayersEval', type: 'number|null', since: 1, required: true, unit: 'count (players)', note: 'EVAL players (scoring half).' },
  { name: 'nMinedDecisions', type: 'number|null', since: 1, required: true, unit: 'count (decisions)', note: 'Decisions the tables were mined from.' },
  { name: 'nScoredDecisions', type: 'number|null', since: 1, required: true, unit: 'count (decisions)', note: 'All-five-arms paired decisions scored.' },
  { name: 'a3Table', type: 'object|null', since: 1, required: true, unit: 'map (action → class → {p, n, …})',
    note: 'The 12-number likelihood table itself — the rule a human is meant to hold in their head, committed as a citable artifact rather than gitignored output.' },
  { name: 'a4Table', type: 'object|null', since: 1, required: true, unit: 'map (action → class → {p, n, …})', note: 'The 15-number table (A3 + check-position split).' },
];

/** scripts/foldCurve/emit-result-card.mjs — the WS-283 fold-curve SHAPE refit card. */
const FOLD_CURVE_SHAPE_FIELDS = [
  kindField('fold-curve-shape'),
  { name: 'fit', type: 'object', since: 1, required: true, unit: 'record ({partition, n, k, marginalFoldRate, conditioned})',
    note: 'POOL-days fit set. Carries the {n, k, marginalFoldRate} dialect plus, since Stage 2, a canonical `conditioned` {k, n, rate, conditional} — walk-validated.' },
  { name: 'holdOut', type: 'object', since: 1, required: true, unit: 'record ({partition, n, k, marginalFoldRate, residualSlopeVsBetFraction, brier})',
    note: 'EVAL-days hold-out with before/after residual slope and Brier — the falsification half of the fit.' },
  { name: 'holdOutBySizeBucket', type: 'array', since: 1, required: true, unit: 'rows ({bucket, betOverPot, n, k, observed, errBefore, errAfter})',
    note: 'The observed gradient on the WS-273 sizing buckets.' },
  { name: 'inverseConditional', type: 'object', since: 1, required: true, unit: 'map (sizing bucket → share) + note',
    note: 'P(bucket | folded) — reported because P(fold|size) and P(size|fold) support OPPOSITE readings (big bets dominate the fold RATE and are a tiny share of the folds). The repo\'s only inverse conditional on a card; keep byte-identical.' },
  { name: 'facingRaiseHeldOutSeparately', type: 'object', since: 1, required: true, unit: 'record ({n, k, marginalFoldRate, residualSlopeVsBetFraction, brier, note})',
    note: 'The raise arm — FIT SEPARATELY, NEVER MERGED. A raise is a different decision.' },
  { name: 'holdOutByStreet', type: 'array', since: 1, required: true, unit: 'rows ({street, n, marginalFoldRate, slope, brier})',
    note: 'Per-street hold-out — where the shape holds and where it does not.' },
  { name: 'fittedCurve', type: 'object', since: 1, required: true, unit: 'record (logistic parameters)', note: 'The shipped POPULATION_CURVE parameters this card warrants.' },
  { name: 'previousCurve', type: 'object', since: 1, required: true, unit: 'record (logistic parameters)', note: 'The parameters this run replaced — the diff is the claim.' },
  { name: 'nullResults', type: 'object', since: 1, required: true, unit: 'record (prose)',
    note: 'Measured-and-refuted components (street modifiers, symmetric fallback) — kept on the card per never-delete-for-null-result.' },
  { name: 'holdOutBySizeBucketConditioned', type: 'array', since: 2, required: false, unit: 'rows ({bucket, conditioned})',
    note: 'CANONICAL ALIAS (Stage 2) for holdOutBySizeBucket\'s {n, k, observed} triples — each row a bucket with its {k, n, rate, conditional}, walk-validated.' },
  { name: 'residualNotRemoved', type: 'string', since: 1, required: true, unit: 'prose',
    note: 'The known remaining defect (sub-0.15x over-prediction) and the principled fix deliberately not taken — stated on the card, not in a doc.' },
];

/** All variant + shared entries, spread into SOR_SCHEMAS by schemas.js. */
export const METRICS_SCHEMA_ENTRIES = Object.freeze({
  'metrics.shared.conditioned-rate': Object.freeze(CONDITIONED_RATE_FIELDS),
  'metrics.shared.divergence-pair': Object.freeze(DIVERGENCE_PAIR_FIELDS),
  'metrics.hero-ev': Object.freeze(HERO_EV_FIELDS),
  'metrics.depth-ablation': Object.freeze(DEPTH_ABLATION_FIELDS),
  'metrics.deviation-map': Object.freeze(DEVIATION_MAP_FIELDS),
  'metrics.layer-divergence': Object.freeze(LAYER_DIVERGENCE_FIELDS),
  'metrics.per-player-width': Object.freeze(PER_PLAYER_WIDTH_FIELDS),
  'metrics.range-calibration': Object.freeze(RANGE_CALIBRATION_FIELDS),
  'metrics.atoms-instrument': Object.freeze(ATOMS_INSTRUMENT_FIELDS),
  'metrics.river-flip-replicate': Object.freeze(RIVER_FLIP_REPLICATE_FIELDS),
  'metrics.study-ladder': Object.freeze(STUDY_LADDER_FIELDS),
  'metrics.style-collapse': Object.freeze(STYLE_COLLAPSE_FIELDS),
  'metrics.teachable-arms': Object.freeze(TEACHABLE_ARMS_FIELDS),
  'metrics.fold-curve-shape': Object.freeze(FOLD_CURVE_SHAPE_FIELDS),
});
