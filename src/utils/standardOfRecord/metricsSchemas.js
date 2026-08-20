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
  // v2 = WS-435 pre-flight MDE fields (mdeDetectBB / mdePower80BB), additive.
  // v3 = WS-537 change-ledger fields (changeLedger*), additive. `edgeBB` is a NET —
  // V(π_ours) − V(π_pool) over one decision set — and it has shipped alone for the life of
  // the instrument. Measured on the live hero-EV path 2026-08-20: edgeBB -0.0485, GROSS
  // 0.6952, GROSS/|NET| = 14.32 over 18 branches. SEVEN PERCENT of the per-branch movement
  // survives to the headline; the other 93% cancels. A card carrying only the 7% cannot
  // distinguish "the change did almost nothing" from "the change moved the tree hard in both
  // directions", and the renderer knowing the difference is worth nothing to the Ladder and
  // the fault matchers, which read the CARD.
  'metrics.hero-ev': 3,
  // v2 = the Stage 2 canonical-vocabulary aliases (founder-approved 2026-08-14): conditioned
  // rates and unit-suffixed CI names added BESIDE the v1 dialect keys, which stay emitted
  // forever (fault matchers and legacy readers key on them).
  // v3 = WS-435 pre-flight MDE fields (depthDeltaMdeDetectBB / depthDeltaMdePower80BB), additive.
  // v4 = WS-537 change-ledger fields (changeLedger*), additive. This variant is the one that
  // shows the cost of a bare NET most plainly: the committed RC-depth-ablation.json carries
  // `flipShareByStreet {flop 0.0072, turn 0.039, river 0.80}` — advice movement already
  // decomposed by street — beside a single aggregate `depthDeltaBB: -0.4711`. The behaviour
  // was known to be a river phenomenon and the EV figure on the card could not say so.
  'metrics.depth-ablation': 4,
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
  // WS-481. A SEPARATE kind from fold-curve-shape on purpose: that one warrants a refit of
  // the population curve's PARAMETERS, this one warrants the AXIS both sides of any such
  // curve are measured on. Sharing a kind would force the two estimand families to
  // co-evolve, which the header forbids.
  'metrics.fold-curve-axis': 1,
  // WS-482. The estimand is a THREADING change — a computed value replacing a constant at a
  // parameter — and its headline is that the parameter is not consumed. Distinct from
  // depth-ablation (which compares depth ARMS) because the question is reachability of one
  // input, not the value of a depth tier.
  'metrics.continuation-rate-threading': 1,
  // WS-534. The villain OWN rule set, scored on the founder stated objective function:
  // fewest rules, one shared vocabulary, highest behavioural AND EV coverage. A distinct kind
  // from teachable-arms because that one scores OUR narrowing rule against OUR engine on
  // Delta-log; this one scores a rule set induced for the VILLAIN, on two coverages at once,
  // and carries the shape test that lets the villain model not look like ours.
  'metrics.villain-model-card': 2,
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
  'fold-curve-axis': 'metrics.fold-curve-axis',
  'continuation-rate-threading': 'metrics.continuation-rate-threading',
  'villain-model-card': 'metrics.villain-model-card',
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

/**
 * THE CHANGE-LEDGER BLOCK (WS-537; SCORED-READOUT-SPEC §9, View 6).
 *
 * WHY IT IS ON THE CARD AND NOT ONLY IN THE REPORT. `scripts/backtest/changeLedger.mjs`
 * already computes the decomposition, already refuses a NET whose ledger is missing
 * (`netPublishProblems`), and already prints GROSS on the same physical line as NET. None of
 * that reaches the Ladder, the fault matchers, or any external reader: those parse the
 * Result Card. A NET that is only protected in the renderer is protected in the one place
 * nobody parses — which is the WS-291 mechanism exactly, two numbers that never have to meet.
 *
 * NET = Σ_b Δ_b, equal to the variant's headline delta BY CONSTRUCTION (the ledger asserts
 * the identity and refuses outright on drift, so a card carrying these fields has already
 * had the equality checked). GROSS = Σ_b |Δ_b|, total movement regardless of sign.
 * `GROSS/|NET|` near 1 means the change moved the tree one way; a large ratio means it
 * REDISTRIBUTED, and a NET near zero is then a CANCELLATION, not an absence of effect.
 *
 * BOTH SPELLINGS OF THE RATIO ARE CARRIED, deliberately. `changeLedgerRedistributionRatio`
 * is the founder's detector and is unbounded by design, but it is undefined at NET exactly 0
 * — which is the MOST extreme redistribution reachable and must not print as an absent
 * measurement. `changeLedgerNetShareOfGross` is its bounded reciprocal (0 at total
 * cancellation, 1 at pure one-way movement) and is always defined. One quantity, two
 * spellings, so the zero case has a number on the card.
 *
 * PARTITION PROVENANCE IS PART OF THE RESULT, not metadata about it. GROSS is a sum over
 * branches, so its size is a function of how finely the decision set was keyed: a run whose
 * `isIP` axis was unavailable on half its rows pools those rows into one `unknown` bucket and
 * reports a SMALLER GROSS than the same run keyed completely. Without `changeLedgerBranchCount`
 * and `changeLedgerKeyCompleteness` on the card a reader cannot tell a change that genuinely
 * did not redistribute from a partition too coarse to see that it did.
 *
 * @param {number} since  the (bumped) schema version these fields ship in
 * @param {string} netField  the variant's own headline key, named in the notes so the pairing
 *   this block enforces is legible from the declaration rather than only from metrics.js
 */
const changeLedgerFields = (since, netField) => [
  { name: 'changeLedgerNetBB', type: 'number|null', since, required: false, unit: 'bb per substituted decision',
    note: `NET = Σ_b Δ_b from the per-branch change ledger. EQUALS ${netField} by construction — the ledger is handed the headline it must reproduce and REFUSES on any drift above 1e-9, so a card carrying this field has had the identity checked rather than asserted. Restated here under the changeLedger prefix so the NET and its GROSS are one grep and one regex for the fault matchers, which key on TOP-LEVEL metrics names.` },
  { name: 'changeLedgerGrossBB', type: 'number|null', since, required: false, unit: 'bb per substituted decision',
    note: `GROSS = Σ_b |Δ_b| — total per-branch movement regardless of sign. THE FIELD THIS BLOCK EXISTS FOR: ${netField} must never travel without it (metricsProblems REJECTS the pair at publish, it does not warn). Measured live 2026-08-20 on the hero-EV path: NET -0.0485 against GROSS 0.6952, so 93% of the movement cancelled and the headline reported the surviving 7% with no way to say so.` },
  { name: 'changeLedgerNetBB100', type: 'number|null', since, required: false, unit: 'bb/100 hands',
    note: 'NET scaled by opportunitiesPerHand × 100 — the §9.3 row unit. NULL rather than 0 when no opportunity census was supplied: an absent census is not an opportunity count of 1, and deriving one from the scored subset is structurally refused (coverageCensus.attachOpportunityCount).' },
  { name: 'changeLedgerGrossBB100', type: 'number|null', since, required: false, unit: 'bb/100 hands',
    note: 'GROSS on the bb/100-hands scale, so the §3.3 headline has a GROSS on ITS OWN scale rather than only on the per-decision one. Without this, overallEvBB100 would be a NET whose only companion is measured in different units, which is the comparison ADR-009 forbids. Null with NET whenever the census is absent — the two are scaled by the same single composition.' },
  { name: 'changeLedgerRedistributionRatio', type: 'number|null', since, required: false, unit: 'ratio (GROSS / |NET|)',
    note: 'THE DETECTOR §9.3 asks for. Near 1 = the change moved the tree one way; large = it redistributed and a small NET is a cancellation. Unbounded BY DESIGN — a ratio in the hundreds is the instrument working, not overflowing. NULL exactly when NET is 0, which is why the bounded spelling below rides beside it.' },
  { name: 'changeLedgerNetShareOfGross', type: 'number|null', since, required: false, unit: 'share [0,1] (|NET| / GROSS)',
    note: 'The bounded reciprocal of the detector: 0 at total cancellation, 1 at pure one-way movement. Always defined where GROSS > 0, so the most extreme redistribution reachable — NET exactly 0 — reports a NUMBER instead of the null the ratio is forced to return there.' },
  { name: 'changeLedgerBranchCount', type: 'number|null', since, required: false, unit: 'count (branches)',
    note: 'Branches in the partition (street × facingAction × isIP). GROSS is a sum over these, so it is only readable against the count: a coarser partition cannot report movement it cannot separate, and a GROSS near NET on 2 branches means something different from a GROSS near NET on 18.' },
  { name: 'changeLedgerKeyCompleteness', type: 'object|null', since, required: false, unit: 'map (branch axis → {known, unknown})',
    note: 'Per-axis, how many rows carried the axis and how many keyed to "unknown". Rows missing an axis are POOLED, never dropped — the sum identity forbids dropping them — and pooling shrinks GROSS by hiding offsetting mass inside one bucket. This field is the only thing on the card that lets a reader tell an honest small GROSS from a partition too blind to find a large one.' },
];

/**
 * NET → GROSS pairing, per variant. Consumed by `metricsProblems` (metrics.js), which
 * REJECTS a card whose NET is a finite number while its declared GROSS companion is not.
 *
 * WHY A DECLARATION AND NOT A NAME CONVENTION. A regex over `/Delta|edge/` would decide at
 * runtime which keys are NETs, and every new variant would silently opt itself in or out
 * depending on how its author spelled the headline. The pairing is a property of the
 * estimand, so it is declared once, here, beside the fields — and a variant that acquires a
 * NET later has to say so in this file, which is the same forcing function the strict
 * top-level key check applies to every other new key.
 *
 * This is the CARD-SIDE half of `netPublishProblems` (scripts/backtest/changeLedger.mjs).
 * That one stops a producer from minting a card when the ledger itself refused; this one
 * stops any card — from any producer, including one that never imports the ledger — from
 * carrying a NET with no GROSS beside it. Both are needed: the producer-side guard cannot
 * see a card written by a script that bypasses it, and the card-side guard cannot see WHY a
 * ledger refused.
 */
export const METRICS_NET_GROSS_PAIRS = Object.freeze({
  'metrics.hero-ev': Object.freeze([
    // edgeBB = V(π_ours) − V(π_pool) on one decision set: a paired difference, hence a NET.
    Object.freeze({ net: 'edgeBB', gross: 'changeLedgerGrossBB' }),
    // The §3.3 headline is that same NET rescaled, so it needs a GROSS on its own scale.
    Object.freeze({ net: 'overallEvBB100', gross: 'changeLedgerGrossBB100' }),
  ]),
  'metrics.depth-ablation': Object.freeze([
    Object.freeze({ net: 'depthDeltaBB', gross: 'changeLedgerGrossBB' }),
  ]),
});

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
  { name: 'mdeDetectBB', type: 'number|null', since: 2, required: false, unit: 'bb',
    note: 'WS-435: smallest edge this run could have seen at the detection boundary (Z_DETECT × bootstrap SD of the headline arm). THE SEPARATOR IS POWER, NOT SAMPLE SIZE — a null without this beside it is not a result.' },
  { name: 'mdePower80BB', type: 'number|null', since: 2, required: false, unit: 'bb',
    note: 'WS-435: smallest edge resolvable with 80% power ((Z_DETECT + Z80_POWER) × bootstrap SD). The figure the pre-flight gate blocks on; founder 2026-08-14 keeps the 80% bar an OPEN question.' },
  // WS-537 (v3) — GROSS beside NET. `edgeBB` and `overallEvBB100` are both NETs and are both
  // paired in METRICS_NET_GROSS_PAIRS above; publishing either without its companion is
  // rejected by metricsProblems, not warned about.
  ...changeLedgerFields(3, 'edgeBB'),
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
  { name: 'depthDeltaMdeDetectBB', type: 'number|null', since: 3, required: false, unit: 'bb',
    note: 'WS-435: smallest paired delta this run could have seen at the detection boundary (Z_DETECT × bootstrap SD). THE SEPARATOR IS POWER, NOT SAMPLE SIZE (classifyPlayerSignal\'s rule) — a null without this beside it is not a result.' },
  { name: 'depthDeltaMdePower80BB', type: 'number|null', since: 3, required: false, unit: 'bb',
    note: 'WS-435: smallest paired delta resolvable with 80% power ((Z_DETECT + Z80_POWER) × bootstrap SD). The figure the pre-flight gate blocks on; founder 2026-08-14 keeps the 80% bar an OPEN question.' },
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
  // WS-537 (v4) — GROSS beside NET. `flipShareByStreet` has decomposed the ADVICE movement by
  // street on this card since v1; these fields finally decompose the EV movement, so the two
  // halves of the same finding can be read on one axis instead of one being a shape and the
  // other a scalar.
  ...changeLedgerFields(4, 'depthDeltaBB'),
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

/**
 * scripts/backtest/emit-ws481-result-card.mjs — the WS-481 fold-curve AXIS correction.
 *
 * The estimand is not a curve's parameters but the VARIABLE the curve is fitted and
 * evaluated on. Its falsification half is unusual and is why the kind exists: the two
 * instruments the ticket named are BLIND to the change, and proving that — rather than
 * quoting their null — is part of the result (FIND-138).
 */
const FOLD_CURVE_AXIS_FIELDS = [
  kindField('fold-curve-axis'),
  { name: 'axisDefinition', type: 'object', since: 1, required: true, unit: 'record ({formula, sharedBy, anchorCheck})',
    note: 'The single exported definition both sides now resolve to, and the documented anchor it reproduces. A card whose axis cannot be stated is the defect this ticket removed.' },
  { name: 'trainingSideBefore', type: 'object', since: 1, required: true, unit: 'record ({numerator, denominator, worked})',
    note: 'What the TRAINING side computed before — the defect, with a worked example, so the magnitude is on the card rather than in a commit message.' },
  { name: 'blindInstruments', type: 'array', since: 1, required: true, unit: 'rows ({instrument, blindBecause, evidence})',
    note: 'Instruments that CANNOT observe this estimand, each with the evidence that establishes it. Reporting a blind instrument\'s null as a result is the failure this field exists to prevent (FIND-138).' },
  { name: 'reach', type: 'object', since: 1, required: true, unit: 'record ({playersConsidered, playersWithFittedCurve, conditioned})',
    note: 'Whether the corrected object reaches production at all. Without it a null divergence cannot be told from an inert feature.' },
  { name: 'pairedAdviceDelta', type: 'object', since: 1, required: true, unit: 'record ({paired, fed, divergent, meanTvOnDivergent, conditioned})',
    note: 'The per-decision paired divergence, CONDITIONED on a served villain model — the unconditioned rate is diluted by decisions the channel cannot reach.' },
  { name: 'controlUnfedMustBeZero', type: 'object', since: 1, required: true, unit: 'record ({n, divergent})',
    note: 'Internal control: decisions with no villain model must diverge on ZERO rows, because the channel is absent there. A nonzero value falsifies the attribution.' },
  { name: 'aggressionShift', type: 'object', since: 1, required: true, unit: 'record ({before, after, delta, basis})',
    note: 'Direction of the change in bet+raise mass. Signed, because the mechanism predicts a sign (inflated fold equity makes the engine reckless) and a result that cannot be signed cannot be checked against it.' },
  { name: 'instrumentBuilt', type: 'object', since: 1, required: true, unit: 'record ({what, coverage, omits})',
    note: 'The instrument built to make this measurable, and what it still does NOT cover — stated as data so the next reader does not rediscover the gap.' },
];

/**
 * scripts/backtest/emit-ws482-result-card.mjs — WS-482 continuation-rate threading.
 *
 * A card whose headline is a ZERO, which is why `reachability` is required rather than
 * optional: a zero EV delta means nothing until the reader knows whether the input reached
 * the computation. This kind exists so that pairing can never be dropped from the record.
 */
const CONTINUATION_RATE_THREADING_FIELDS = [
  kindField('continuation-rate-threading'),
  { name: 'threading', type: 'object', since: 1, required: true, unit: 'record ({parameter, from, to, sitesThreaded, sitesLeftOnPrior, why})',
    note: 'What value replaced what, at how many of the call sites, and which sites deliberately kept the prior (a hypothesized future street has no computed value to thread).' },
  { name: 'reachability', type: 'object', since: 1, required: true, unit: 'record ({deadParameters, liveConsumers, evidence})',
    note: 'REQUIRED. Whether the threaded parameter is consumed at all, with file:line spans. A null EV delta from an unread parameter is a different fact from a null EV delta from a small effect, and only this field separates them.' },
  { name: 'evDelta', type: 'object', since: 1, required: true, unit: 'record ({instrument, scenarios, recommendations, moved, topActionFlips, meanAbsDelta})',
    note: 'The paired EV comparison. `moved` is the count of recommendations whose EV changed at all.' },
  { name: 'stagesRan', type: 'object', since: 1, required: true, unit: 'record (stage → outcome/weightConsumed)',
    note: 'Proof the measured null is not a gating artifact — the stages containing the threaded call sites must be shown to have executed.' },
  { name: 'adviceDelta', type: 'object', since: 1, required: true, unit: 'record ({instrument, paired, divergent, control})',
    note: 'The argmax-distribution arm, with its same-code determinism control. A control that does not return zero invalidates the arm.' },
  { name: 'collateralFixes', type: 'array', since: 1, required: true, unit: 'rows ({site, defect, live})',
    note: 'Corrections found by the same sweep that stand independently of the headline — kept ON the card so a zero headline does not bury them.' },
];

/**
 * WS-534 - the VILLAIN MODEL CARD. The flag in the ground for the rule-evolution programme.
 *
 * THE OBJECTIVE FUNCTION, founder 2026-08-17, verbatim: "Least amount of rules, standardized
 * vocab, highest amount of behavioral and EV coverage of the villain." Three terms that trade
 * against each other, so the card reports a FRONTIER rather than a point - for each rule
 * count, the best coverage achieved. A single headline would hide the trade the programme
 * exists to navigate.
 *
 * WHY behaviouralCoverage AND evCoverage ARE BOTH REQUIRED AND NEVER COLLAPSED. They are
 * different quantities and this repo has already measured the gap: `evCost.mjs` establishes
 * that an estimate error costs nothing unless it moves hero across a decision boundary. A rule
 * set can predict 95% of the actions and capture almost none of the money, or predict 60% and
 * capture most of it. A card carrying only one of them cannot be read.
 *
 * WHY shapeTest IS REQUIRED. Founder, same session: "the shape of villain decision model may
 * look different than ours, they may have different rulesets, or rulesets that transform in a
 * strange way to our engine." If induction is run inside HERO rule grammar, a villain who
 * reasons on an axis that grammar lacks - pot commitment, recent history, stack ratio to one
 * opponent - cannot be expressed, and the fit will pack that structure into the nearest
 * available shape and report good coverage anyway. So every card carries a GRAMMAR-FREE
 * reference fitted on the same decisions, and the gap between them is the evidence that the
 * grammar is or is not the binding constraint. A card without it is asserting that our shape
 * is the villain shape, which is exactly the claim under test.
 */
const VILLAIN_MODEL_CARD_FIELDS = [
  kindField('villain-model-card'),
  { name: 'villainScope', type: 'object', since: 1, required: true, unit: "record ({level: 'field'|'stratum'|'individual', id, nDecisions})",
    note: 'WHOSE model this is. `field` is 350+ players pooled and describes no one; `individual` requires the WS-527 fit. Never inferred from the id - declared, because a pooled card mislabelled as one villain is the exact error the Field Strategy Card was renamed to prevent.' },
  { name: 'ruleCount', type: 'number', since: 1, required: true, unit: 'count (rules)',
    note: 'Rules in the card, excluding the residual clause. The first term of the objective function; smaller is better at equal coverage.' },
  { name: 'vocabulary', type: 'object', since: 1, required: true, unit: 'record ({predicateCount, sharedPredicateCount, reuseRate, permutationNull})',
    note: 'The second term. `reuseRate` is how much of this vocabulary is shared with other villains - the commonality claim. `permutationNull` is the same figure computed over villains formed by SHUFFLING hands between them; without it, commonality is guaranteed by construction because the vocabulary was chosen.' },
  { name: 'behavioralCoverage', type: 'object', since: 1, required: true, unit: 'record ({top1Accuracy, logLoss, entropyCeiling, n})',
    note: 'Does the rule set predict what the villain DOES. `entropyCeiling` rides with it always: a villain mixing 60/40 caps any rule set at 60% there, so accuracy is only readable against its ceiling. Baseline to beat is the shipped villain predictor at log-loss 0.757 (WS-436, n=10,147).' },
  { name: 'evCoverage', type: 'object', since: 1, required: true, unit: 'record ({capturedShare, ruleSetEdgeBB, fullModelEdgeBB, n})',
    note: 'Does the rule set capture the MONEY. `capturedShare` = edge of the hero best response to the RULE SET, over edge of the hero best response to the FULL fitted model, both played against the same observed villain. Same shape as `exploitationEfficiency` one level in. Not clamped: below 0 and above 1 are both real readings.' },
  { name: 'residualShare', type: 'number|null', since: 1, required: true, unit: 'share (0-1) of EV',
    note: 'EV share arriving through the residual clause - how much of the money comes from the part nobody designed. A Strategy Card headline metric, carried here so a card with 3 rules and a 90% residual cannot read as a 3-rule model.' },
  { name: 'frontier', type: 'array', since: 1, required: true, unit: 'array ({ruleCount, behavioralCoverage, evCoverage})',
    note: 'The curve the founder watches evolve: best coverage achieved at each rule count. THE record; the headline row is a view over it. Reported even where it is flat, because a flat frontier means added rules bought nothing and that is the finding.' },
  { name: 'shapeTest', type: 'object', since: 1, required: true, unit: 'record ({heroGrammarCoverage, grammarFreeCoverage, gapBehavioral, gapEv, verdict, namedMissingAxis})',
    note: 'Is OUR rule grammar the binding constraint? A grammar-free reference is fitted on the SAME decisions. A material gap means the villain reasons on an axis our grammar cannot express, and the named missing axis is the finding - not a tuning problem.' },
  { name: 'axes', type: 'array', since: 1, required: true, unit: 'array (axis names)',
    note: 'The declared axis set the rules may key on. Declared, never inferred from which axes happened to be used: an axis absent from this list was never available, which is a different fact from an axis that was available and unused.' },
  { name: 'census', type: 'object', since: 1, required: true, unit: 'record (axis -> {observed-zero, unexamined, dropped})',
    note: 'Per-axis coverage. A zero is three different facts and the Census refuses to collapse them. Without this a drill surface quizzes only where the data is thick and teaches a distorted game while reading as authoritative.' },
  { name: 'evFidelity', type: 'object', since: 2, required: true, unit: "record ({targetScope, targetEdgeBB, ruleSetEdgeBB, matchErrorBB, mdeDetectBB, n})",
    note: 'THE HEADLINE UNDER THE FOUNDER RULING OF 2026-08-18: the objective is to PLAY LIKE THE VILLAIN, not to beat the field. `matchErrorBB` = |ruleSetEdgeBB - targetEdgeBB| and is MINIMISED; a rung that beats the field is a WORSE villain model, not a better one. `targetEdgeBB` is the realised edge of the population being modelled and is 0 by construction when that population is the whole field (edgeBB = wisValue - poolValue, and a rule set behaving exactly like the field carries weight 1 at every decision, so the two values coincide exactly). `targetScope` names the population, because the dominant stratum is NOT the field and matching the wrong one is a silent error. `mdeDetectBB` rides alongside always: a matchError below the run MDE is unmeasured, not small.' },
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
  'metrics.fold-curve-axis': Object.freeze(FOLD_CURVE_AXIS_FIELDS),
  'metrics.continuation-rate-threading': Object.freeze(CONTINUATION_RATE_THREADING_FIELDS),
  'metrics.villain-model-card': Object.freeze(VILLAIN_MODEL_CARD_FIELDS),
});
