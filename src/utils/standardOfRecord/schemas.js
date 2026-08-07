/**
 * schemas.js — the six Standard-of-Record object shapes, versioned ADDITIVE-ONLY.
 *
 * WHY A REGISTRY RATHER THAN SIX PLAIN TYPEDEFS. ADR-009 binds every comparative claim in
 * the repo to a Result Card, and a Result Card is only worth anything if a card written in
 * August still parses in December. The IDB migration registry solved the identical problem
 * for persisted stores and its authoring rule #2 — `storesRemoved` MUST stay `[]`, forever —
 * is the discipline WS-322 was asked to copy. So the fields are DATA, enumerated here, and a
 * test walks them to assert nothing was ever removed or retyped. A typedef in a docblock
 * cannot be tested; this can.
 *
 * AUTHORING RULES (binding, and mirrored from persistence/migrationRegistry.js):
 *
 *   1. Field lists are APPEND-ONLY. Never delete a field descriptor and never change a
 *      shipped field's `type`. Both are what `__tests__/schemas.test.js` checks.
 *   2. A new field arrives with `since` set to the NEXT schema version for that object, and
 *      that object's entry in `SOR_SCHEMA_VERSIONS` is bumped in the same change.
 *   3. A field may become obsolete but never disappear. Mark it `deprecated: '<reason>'` and
 *      leave it in place — readers that still look for it get `null`, not a crash.
 *   4. `required: true` means a loader REJECTS an object lacking it. That is a deliberate
 *      choice per field, not a default: ADR-009's whole complaint is about numbers that
 *      travelled without the context needed to interpret them.
 *
 * WHY `required` IS SO AGGRESSIVE ON THE RESULT CARD. The failure this exists to prevent —
 * WS-291, a falsified range model living on the recommendation path for the life of the
 * project — was not caused by a wrong number. It was caused by a number that could not be
 * re-derived, so nobody could tell it was wrong. A Result Card missing its engine commit is
 * not a slightly-worse Result Card; it is a number nobody can ever check again.
 */

/**
 * Schema version per object type. Bump the specific object when its field list grows.
 * Consumers refuse a MAJOR they do not understand rather than duck-type it — the same rule
 * `heroEvReport.HERO_EV_SCHEMA_VERSION` already states for its own report.
 */
export const SOR_SCHEMA_VERSIONS = Object.freeze({
  strategyCard: 1,
  decisionAtom: 3,
  coverageCensus: 2,
  comparisonCensus: 1,
  resultCard: 3,
  dealBookManifest: 1,
  fieldManifest: 1,
  faultEntry: 1,
  // WS-431: the per-decision JSONL record (scripts/backtest/decisionRecord.mjs) is
  // governed HERE — its writer re-derives DECISION_RECORD_SCHEMA_VERSION from this entry,
  // so the sidecar can no longer version itself outside the additive contract.
  decisionRecord: 2,
});

/**
 * READER DEPTH — what a reader of a captured field can actually conclude from it.
 *
 * The anti-rot rule ("every captured field ships a reader") proves a field is QUERIED. It
 * does not prove the query was the right one: a reader that prints a distribution satisfies
 * the gate completely while supporting no inference at all. That is the predictionAudit
 * failure moved one level up — from "is it read" to "is it understood" — and a green tick
 * that hides it is worse than no tick.
 *
 * So a reader declares its depth, and `atomsSelfCheck` reports the mix rather than a boolean.
 * `descriptive` is a legitimate and common answer; it is only dangerous when it is invisible.
 */
export const READER_DEPTHS = Object.freeze({
  /** Reports the field's distribution or presence. Supports no claim on its own. */
  DESCRIPTIVE: 'descriptive',
  /** Supports or refutes a named claim, with an admissibility rule behind it. */
  INFERENTIAL: 'inferential',
});

/**
 * @typedef {Object} FieldDescriptor
 * @property {string} name
 * @property {string} type - 'string' | 'number' | 'boolean' | 'object' | 'array' | union with '|null'
 * @property {number} since - schema version this field first shipped in
 * @property {boolean} required - whether a loader rejects an object lacking it
 * @property {string} note - why the field exists; read by humans, not code
 * @property {string} [deprecated] - set instead of deleting; the field stays readable forever
 */

/**
 * A STRATEGY CARD — a Declared surface. Authored deliberately, warranted per rule, and
 * executable from this one artifact so a doc and an implementation cannot drift apart.
 */
const STRATEGY_CARD_FIELDS = [
  { name: 'cardId', type: 'string', since: 1, required: true,
    note: 'Stable identity. Two cards with the same id and different content are a bug, which is what contentHash catches.' },
  { name: 'schemaVersion', type: 'number', since: 1, required: true,
    note: 'Refuse a version this loader does not understand rather than duck-type it.' },
  { name: 'title', type: 'string', since: 1, required: true,
    note: 'Human-readable. A card is meant to be read by a person at a table, not only executed.' },
  { name: 'rationale', type: 'string', since: 1, required: true,
    note: 'Why this strategy, in prose. ADR-009 asks for declared surfaces WITH stated reasons; a card without reasons is a lookup table.' },
  { name: 'domain', type: 'object', since: 1, required: true,
    note: 'Declared scope — gameType, seats, stackDepthBB, positions. OUTSIDE it the card abstains explicitly and the abstention is counted.' },
  { name: 'rules', type: 'array', since: 1, required: true,
    note: 'Ordered. First match wins, so ordering is semantic and a reorder is a content change the hash will catch.' },
  { name: 'residual', type: 'object', since: 1, required: true,
    note: 'THE ENCLOSURE CLAUSE. The declared fallback for states no named rule reaches. Absent = load failure, never a warning.' },
  { name: 'contentHash', type: 'string|null', since: 1, required: false,
    note: 'sha256 over the canonical card body. Null at author time, stamped by the loader — so a card cannot claim a hash it does not have.' },
  { name: 'surfaceKind', type: 'string', since: 1, required: false,
    note: 'Always "Declared" for a Strategy Card. Present so a card and a mined Field surface can sit in one registry.' },
];

/**
 * A DECISION ATOM — one row per decision. Aggregates are VIEWS over atoms, never the record.
 *
 * The `layer` slot is load-bearing for WS-324/WS-330: a fault register that says "the model
 * was wrong" is useless, and one that says "layer 3 of the stack was wrong" is actionable.
 */
const DECISION_ATOM_FIELDS = [
  { name: 'schemaVersion', type: 'number', since: 1, required: true, note: 'Per-object version.' },
  { name: 'atomId', type: 'string', since: 1, required: true,
    note: 'Content-addressed. Atoms live outside git (WS-328) and are referenced by this id.' },
  { name: 'situationKey', type: 'string', since: 1, required: true,
    note: 'WS-317 structured key, serialized. NOT a positional string of the caller\'s own devising.' },
  { name: 'carried', type: 'object', since: 1, required: true,
    note: 'situationKey.withCarriedContext output — sprBand, playersRemaining, source, pool. Carried, never keyed.' },
  { name: 'surfaceId', type: 'string', since: 1, required: true,
    note: 'Which surface produced the action. Without it an atom cannot be attributed.' },
  { name: 'action', type: 'object', since: 1, required: true,
    note: 'The emitted action DISTRIBUTION, always. A pure action is {act: 1.0} — one shape downstream.' },
  { name: 'ruleId', type: 'string|null', since: 1, required: true,
    note: 'Which rule fired, or null when the residual clause did. Null is the signal that measures residual EV share.' },
  { name: 'warrant', type: 'string|null', since: 1, required: true,
    note: 'The DECLARED warrant of the rule that fired. Null only for the residual.' },
  { name: 'layers', type: 'array', since: 1, required: false,
    note: 'Per-layer intermediate values for stack attribution (WS-324). Empty until a surface declares a stack.' },
  { name: 'outcome', type: 'object|null', since: 1, required: false,
    note: 'Realized result once known. Null while the atom is still a prediction — the join, not the record.' },
  { name: 'skipReason', type: 'string|null', since: 1, required: false,
    note: 'Why this decision was unscorable. Counted, never silently dropped — a skip is data.' },

  // ── v2 (WS-328): over-capture by design. ───────────────────────────────────────────────
  // Every field below ships with the FUTURE QUESTION it answers, because a field that cannot
  // name its question is speculation rather than instrumentation. `atomsSelfCheck` enforces
  // that each also ships with a reader — the discipline that stops this becoming the next
  // predictionAudit (captured, never queried, rotted silently).
  { name: 'alternativeScores', type: 'object|null', since: 2, required: false,
    note: 'Score of EVERY alternative under the card\'s model. Answers "how close was this?" — decision margin, and near-ties are where strategies differ and models are fragile.' },
  { name: 'rulesMatchedAndLost', type: 'array', since: 2, required: false,
    note: 'Rules that matched but ranked below the one that fired. Answers rule-level ablation WITHOUT a re-run — the ruleId alone cannot say what almost happened.' },
  { name: 'beliefState', type: 'object|null', since: 2, required: false,
    note: 'Range per live opponent at the decision. Expensive to recompute and the input to the belief-vs-truth join; this is the layer-1 intermediate WS-291 needed and never had.' },
  { name: 'truth', type: 'object|null', since: 2, required: false,
    note: 'Ground truth when showdown reveals, CARRYING ITS `basis`. Joined at write time via holdingKnowledge. Without basis a hypothesized branch could be scored against a revealed hand — a category error, not a miscalibration.' },
  { name: 'seeds', type: 'object', since: 2, required: false,
    note: 'Every seed this decision depended on — deal, Monte Carlo, combo sampling. Answers exact replay and retroactive pairing. A default never recorded is reproducible only by luck.' },
  { name: 'actorSeat', type: 'number|null', since: 2, required: false,
    note: 'WHICH SEAT decided. Present so villain decisions are atoms too: how a table plays back differently against card A vs card B is a first-class result, and hero-only logging makes it unreachable.' },
  { name: 'actorRole', type: 'string|null', since: 2, required: false,
    note: '"hero" or "villain". The cheap discriminator for the above — a query should not have to infer role from seat identity.' },
  { name: 'wallTimeMs', type: 'number|null', since: 2, required: false,
    note: 'Answers "is this card affordable to run?" — a strategy too slow to execute is a different kind of wrong from one that loses chips.' },
  { name: 'tokens', type: 'number|null', since: 2, required: false,
    note: 'Tokens spent when the decision was AI-authored. Null for a mechanical surface. Same affordability question, different currency.' },

  // ── v3 (WS-431): atomId's PARTS, kept — never hash-and-discarded. ──────────────────────
  // layerAblation.mjs hashed {playerId, handId, order} into atomId one-way and dropped the
  // parts; WS-410 Stage 5's branch ledger JOINS on (dealBookHash, playerId, handId, order),
  // which a one-way hash forecloses. Raw over derived, applied to identity itself.
  { name: 'playerId', type: 'string|null', since: 3, required: false,
    note: 'Pseudonymous player key. With handId + order, the WS-410 Stage 5 cross-run join key — pair this atom against any decision record or future run on the same Deal Book.' },
  { name: 'handId', type: 'string|number|null', since: 3, required: false,
    note: 'Which hand. Second part of the join key.' },
  { name: 'order', type: 'number|null', since: 3, required: false,
    note: 'Action index within the hand. Third part of the join key.' },
  { name: 'stable', type: 'object|null', since: 3, required: false,
    note: '{p, k, d} canonical run coordinates (WS-433) — ties an atom to its decision-record row and admission wave, so "same measurement" is checkable rather than asserted.' },
  { name: 'omissions', type: 'object|null', since: 3, required: false,
    note: 'fieldName → reason for every DELIBERATE non-capture (e.g. beliefState: no producer exists). Distinguishes "not captured, and why" from "captured empty" forever — the discriminator rule, shipped before the producer writes.' },
];

/**
 * THE FORCING-FUNCTION QUESTION LIST (WS-328).
 *
 * Stored WITH the schema on purpose. Each entry is a question someone will want to ask of an
 * OLD run, and the field that makes it answerable. The list is how the schema learns from its
 * own gaps: when a question turns out to be unanswerable, APPEND it here with
 * `answerable: false`, and that entry is the specification for the next field.
 *
 * This exists because the cost asymmetry is not symmetric. Capturing an extra field costs
 * bytes. NOT capturing it costs a re-run — and by then the engine has moved, so the re-run
 * does not reproduce the old number and the comparison being attempted is lost entirely. The
 * loss is total, not partial.
 */
export const FORCING_QUESTIONS = Object.freeze([
  { question: 'How close was this decision?', field: 'alternativeScores', answerable: true },
  { question: 'What would rule-level ablation say, without a re-run?', field: 'rulesMatchedAndLost', answerable: true },
  { question: 'Which rules fired vs the residual clause?', field: 'ruleId', answerable: true },
  { question: 'What is EV by warrant class?', field: 'warrant', answerable: true },
  { question: 'What did we believe each opponent held here?', field: 'beliefState', answerable: true },
  { question: 'What did they actually hold, and was the belief observed or hypothesized?', field: 'truth', answerable: true },
  { question: 'Can this exact decision be replayed bit-for-bit?', field: 'seeds', answerable: true },
  { question: 'Does the table play back differently against card A vs card B?', field: 'actorSeat', answerable: true },
  { question: 'Why is 4-bet coverage thin?', field: 'skipReason', answerable: true },
  { question: 'Is this card affordable to run?', field: 'wallTimeMs', answerable: true },
  { question: 'Does this card earn more against a table that has been together two hours?', field: 'seatOccupancyTimeline', answerable: true, note: 'On the atom SET manifest, not the atom — occupancy is a property of the table over time, not of one decision.' },
  { question: 'Which contexts did we never reach at all?', field: 'coverageCensus.cells', answerable: true, note: 'The zeros. Answerable only because the census emits them.' },
  { question: 'How much of the divergence between two surfaces does a given layer account for?', field: 'layers', answerable: true, note: 'ANSWERABLE as of WS-324, without settling FSA open question #2. `layerAttribution.js` takes `d` as a REQUIRED argument with no default and decomposes whatever it yields — by layer and by situation, asserted to sum to the same total. A decomposition of a divergence is not a definition of one, so Phase 3 still owns the choice of `d`.' },
  { question: 'Which layer is wrong, independently of whether the recommendation was?', field: 'layers', answerable: true, note: 'ANSWERABLE as of WS-324 via `layerProbes.js`, for the four layers with a ground truth source. This is the question nothing could ask while WS-291 was live: a layer-1 fault presenting as layer-5 symptoms, undiagnosable because nothing scored the layers independently.' },
  { question: 'Which divergence measure `d` is the right one — KL, or EV-difference?', field: 'resultCard.metrics.divergence', answerable: true, note: 'ANSWERABLE as of WS-350, and the answer is NOT "one of them". `divergence.js` is the single comparison path FSA Phase 3 owed ADR-009; it computes BOTH candidates on the SAME paired volume, refuses to run without a pre-registered primary, and stamps the pair plus the pre-registration into `resultCard.metrics.divergence`. That field is what made the question answerable: a card carrying only the primary would let a run report whichever measure agreed with its prior finding and look identical to an honest one. The measures are NOT comparable by magnitude (nats vs chips) — `comparableByMagnitude: false` rides in the payload — so what is compared is their ORDERING over surfaces, and a disagreement there is reported as the finding. NOTE the entry is kept rather than deleted: the schema is additive-only, and a reader of an OLD atom set needs to know this question was once unanswerable.' },
  // ── WS-328 additions. The first three became answerable; the last two are the LIST LEARNING
  // FROM ITS OWN GAPS — questions this work found it could NOT answer, appended per the rule
  // above, each one the specification for a later field or a later instrument.
  { question: 'Was this context examined and empty, or never examined at all?', field: 'coverageCensus.examination', answerable: true, note: 'ANSWERABLE as of WS-328. The v1 census emitted a hit count per cell, which separates hit from not-hit and nothing else — a zero could equally mean examined-and-empty, never-examined, or dropped-by-a-bug. `examination` is DECLARED and never inferred, so a never-looked cell is a positively-marked row rather than an absence.' },
  { question: 'Which contexts did the instrument reach and then DISCARD?', field: 'coverageCensus.cells[].status', answerable: true, note: 'ANSWERABLE as of WS-328 via the `dropped` status, which carries the atom-level skipReason. Previously a drop and a genuine zero were the same empty cell.' },
  { question: 'Do the atoms this Result Card was computed from still exist, and are they the ones it used?', field: 'resultCard.atomSetHash', answerable: true, note: 'ANSWERABLE as of WS-328. `atomStore.resolveAtomSet` returns an explicit reason — not-found, hash-mismatch, truncated — rather than an empty list. A card without its atoms is still a valid anchor; a card that SILENTLY lost them would let a re-derivation run on a different set.' },
  { question: 'Does a bold card make the table play back differently toward us?', field: 'actorSeat', answerable: false, note: 'NOT ANSWERABLE, and the earlier `actorSeat` entry above over-claims it — kept rather than edited, because additive-only applies to this list too and a reader of an old atom set needs to see what was believed at the time. Villain atoms from the 2009 corpus are a RECORDING: those villains never saw our card, so their actions cannot respond to it. Capturing actorSeat is necessary and not sufficient; the sufficient condition is a RESPONSIVE Field, which is WS-326\'s simulator. Until then the founder premise that a bold strategy changes others\' behaviour toward us is untestable on this instrument, and any number suggesting otherwise is measuring something else.' },
  { question: 'What did the surface score for each alternative at a HERO node in a replayed corpus hand?', field: 'alternativeScores', answerable: false, note: 'NOT ANSWERABLE on the corpus. `phhAdapter` sets `gameState.mySeat = null` because a corpus hand has no hero, so every reconstructed decision is actorRole "villain" and the hero branch of `reconstructPredictionAudit` is never taken. The field is populated on LIVE captures, where mySeat exists. The specification this implies: either a hero-seat assignment pass over corpus hands, or accepting that hero-side alternativeScores is a live-only field and saying so wherever it is quoted.' },

  { question: 'What if layer N had been correct — without re-running an engine that has since moved?', field: 'seeds', answerable: true, note: 'PARTIALLY. `layerAblation.js` substitutes from stored atoms with zero evaluation, but can only speak to the substituted layer itself — every layer downstream was evaluated at the ORIGINAL input. Propagating needs layer functions PINNED to this atom set\'s engine commit and replayed from these seeds. `substitutionReach` returns which layers a given substitution can and cannot answer for, rather than letting a caller assume it reached the action.' },
]);

/**
 * A COVERAGE CENSUS — the record of what was HIT, including contexts hit ZERO times.
 *
 * This is the object with no existing analogue in the repo. `calibrationMetrics.aggregateBySlice`
 * groups observed rows only, so a context with no rows simply never appears in the output and
 * reads as absent-because-irrelevant rather than absent-because-unmeasured. Those are opposite
 * facts and the census is what tells them apart.
 */
const COVERAGE_CENSUS_FIELDS = [
  { name: 'schemaVersion', type: 'number', since: 1, required: true, note: 'Per-object version.' },
  { name: 'domain', type: 'object', since: 1, required: true,
    note: 'The declared domain being censused. A census without its domain cannot say what "zero" means.' },
  { name: 'cells', type: 'array', since: 1, required: true,
    note: 'One row per context IN THE DECLARED DOMAIN, with its hit count — including the zeros. The zeros are the point.' },
  { name: 'totalContexts', type: 'number', since: 1, required: true, note: 'Denominator, stated rather than inferred from cells.length.' },
  { name: 'hitContexts', type: 'number', since: 1, required: true, note: 'Numerator.' },
  { name: 'abstentions', type: 'number', since: 1, required: true,
    note: 'Decisions where the card declared itself out of domain. Explicitly counted per WS-322 — never silently skipped.' },

  // ── v2 (WS-328): the never-looked cells, made representable. ───────────────────────────
  // v1 emitted a hit count per cell, which distinguishes "hit" from "not hit" and NOTHING
  // else. A cell at zero could still mean three different things — examined and empty, never
  // examined, or examined and dropped by a bug — and those license opposite conclusions.
  { name: 'examination', type: 'object', since: 2, required: true,
    note: 'The DECLARED examined set: {mode, examinedContexts, unexaminedReason, basis}. Required and never inferred — inferring examination from observation makes "we never looked" structurally unrepresentable, which is the defect, not the design. mode "exhaustive" is a POSITIVE CLAIM that the run covered the reachable domain, in the same spirit as an empty manifest.unseededSources.' },
  { name: 'statusCounts', type: 'object', since: 2, required: true,
    note: 'Cells by status — hit | observed-zero | unexamined | dropped | unreachable | unattributable. Stated so a report cannot print a single coverage percentage that silently folds a coverage GAP into a measured ABSENCE.' },
  { name: 'axes', type: 'array', since: 2, required: true,
    note: 'The ordered axes the contexts were enumerated from. Ordered because the context key is positional, and two censuses whose axes were declared in different orders must not be silently unioned.' },
];

/**
 * A DEAL BOOK MANIFEST — a versioned, seeded, content-hashed hand set.
 *
 * Replaces "a corpus slice defined by ad-hoc CLI filtering", which is what every measurement
 * in this repo currently runs against. Two arms provably receiving identical deals is a
 * WS-326 acceptance criterion and it is unprovable without this object.
 */
const DEAL_BOOK_MANIFEST_FIELDS = [
  { name: 'schemaVersion', type: 'number', since: 1, required: true, note: 'Per-object version.' },
  { name: 'dealBookId', type: 'string', since: 1, required: true, note: 'Human-facing name for the slice.' },
  { name: 'kind', type: 'string', since: 1, required: true,
    note: '"corpus-slice" or "generated". A generated book needs its generator seed; a corpus slice needs its file identities.' },
  { name: 'sliceSpec', type: 'object', since: 1, required: true,
    note: 'The filter that defined the set — root, sites, stakes, caps. Recorded so the slice is re-derivable.' },
  { name: 'members', type: 'array', since: 1, required: true,
    note: 'File IDENTITIES, not a count. `config.files` records only a number today, which cannot detect that the corpus changed underneath a rerun.' },
  { name: 'memberCount', type: 'number', since: 1, required: true, note: 'Stated, so a truncated members list is detectable.' },
  { name: 'seeds', type: 'object', since: 1, required: true,
    note: 'Every seed the book depends on. Empty object is legal for a pure corpus slice and must be explicit, not absent.' },
  { name: 'contentHash', type: 'string', since: 1, required: true,
    note: 'sha256 over sliceSpec + member identities + seeds. THE property WS-326 leans on: same slice, same hash, always.' },
];

/**
 * A FIELD MANIFEST — who occupies the other seats.
 *
 * `behaviorPolicy.buildPolicyTable` already returns a provenance block that is a Field
 * manifest in all but name; this schema is the shape it maps onto.
 */
const FIELD_MANIFEST_FIELDS = [
  { name: 'schemaVersion', type: 'number', since: 1, required: true, note: 'Per-object version.' },
  { name: 'fieldId', type: 'string', since: 1, required: true, note: 'Identity of this opponent population.' },
  { name: 'surfaceKind', type: 'string', since: 1, required: true,
    note: 'Normally "Field". Present so Field and Declared surfaces share one registry vocabulary.' },
  { name: 'sources', type: 'array', since: 1, required: true,
    note: 'SRC-* ids from the promoted provenance registry. Provenance must survive the join at row grain.' },
  { name: 'partition', type: 'string|null', since: 1, required: true,
    note: 'POOL/EVAL stamp. Null ONLY for a field with no fitted component; leakageGuard already enforces the stamp itself.' },
  { name: 'responsive', type: 'boolean', since: 1, required: true,
    note: 'Static field vs one that adapts to hero. WS-326 requires both arms to be reported as a pair, so this must be a field, not a note.' },
  { name: 'observations', type: 'number|null', since: 1, required: false, note: 'Sample behind the policy, when mined.' },
  { name: 'version', type: 'string|null', since: 1, required: false, note: 'Field version for the replication manifest.' },
];

/**
 * A RESULT CARD — the standardized scorecard plus its replication manifest.
 *
 * Every `required: true` here is a field whose absence would make the number unreplicable.
 * That is the entire bar ADR-009 sets, expressed as data.
 */
const RESULT_CARD_FIELDS = [
  { name: 'schemaVersion', type: 'number', since: 1, required: true, note: 'Per-object version.' },
  { name: 'resultCardId', type: 'string', since: 1, required: true, note: 'The greppable token WS-329 scans docs and session notes for.' },
  { name: 'match', type: 'object', since: 1, required: true,
    note: 'Surface x Deal Book x Field — the three things whose combination produced this number.' },
  { name: 'estimand', type: 'string', since: 1, required: true,
    note: 'WHAT was measured, in words. Two instruments only agree if they are measuring the same thing (AS-710).' },
  { name: 'treatment', type: 'string', since: 1, required: true,
    note: 'Never report a number without its treatment named. ipsEstimator.TREATMENT already supplies this string.' },
  { name: 'metrics', type: 'object', since: 1, required: true, note: 'The figures themselves.' },
  { name: 'clusterUnit', type: 'string', since: 1, required: true,
    note: 'Sessions or players — NEVER hands. POKER_THEORY 14.3: hands are not independent within a session.' },
  { name: 'admissibility', type: 'object', since: 1, required: true,
    note: 'May this be quoted, and why not. heroEvReport.assessAdmissibility is the working precedent.' },
  { name: 'manifest', type: 'object', since: 1, required: true,
    note: 'THE REPLICATION MANIFEST. See MANIFEST_FIELDS — this is the object ADR-009 actually binds.' },
  { name: 'census', type: 'object|null', since: 1, required: false,
    note: 'Coverage census for this run when one was computed. Null until WS-328 builds the computation.' },
  { name: 'warrantAttribution', type: 'object|null', since: 1, required: false,
    note: 'EV split by warrant class, and the residual clause\'s share. Required by WS-327; the slot exists now so the schema does not have to change then.' },

  // ── v2 (WS-328): the atom set this card was computed from. ─────────────────────────────
  { name: 'atomSetHash', type: 'string|null', since: 2, required: false,
    note: 'Content hash of the atom set. Referenced BY HASH, never by path: the card is the anchor and stays valid when the store moves, and the atoms are what let you ask NEW questions of an OLD run.' },
  { name: 'atomCount', type: 'number|null', since: 2, required: false,
    note: 'How many atoms the hash resolves to. Stated so a truncated or partially-written set is detectable — a short read must not read as a small sample.' },
  { name: 'anchorGeneration', type: 'number|null', since: 2, required: false,
    note: 'Which Deal Book generation this card stands on. The Ladder REFUSES to compare across generations that have not been rebased; without this field that refusal is unenforceable and the Ladder silently fragments.' },

  // ── v2 anti-shallowness (founder directive 2026-08-03). ────────────────────────────────
  // These exist because capture-with-a-reader proves a field was QUERIED, not that the query
  // was the RIGHT one. Each field below targets a specific way a confident number can still
  // be wrong: an unmade comparison, an unrecorded reversal, or an unstated margin.
  { name: 'fragility', type: 'object|null', since: 2, required: false,
    note: 'MARGIN TO FLIP — how far each load-bearing constant or assumption would have to move to REVERSE this conclusion. A result reported without it invites the reader to treat a knife-edge and a robust finding as the same claim.' },
  { name: 'flipRegister', type: 'object|null', since: 2, required: false,
    note: 'How many times the conclusion on this estimand has REVERSED, and when. A fourth reversal must not read like a first-time finding. Flipping under new evidence is healthy; flipping unrecorded is not.' },
  { name: 'comparisonCensus', type: 'object|null', since: 2, required: false,
    note: 'Which contrasts were RUN vs merely POSSIBLE. The coverage census makes unreached situations visible; this makes undrawn comparisons visible. Without it "that comparison was never made" is indistinguishable from "that comparison was made and found nothing".' },

  // ── v3 (WS-431): the decision record this card's headline was computed from. ───────────
  { name: 'decisionRecord', type: 'object|null', since: 3, required: false,
    note: '{contentHash, rowCount, schemaVersion} of the per-decision JSONL record — BY HASH, never by path (atomStore doctrine). This is what makes the headline REDERIVABLE: the inversion test recomputes edgeBB from the record alone. Null when the run captured no record; a null-with-error shape means a sink ran and its hash failed.' },
];

/**
 * A COMPARISON CENSUS — the contrasts that COULD have been drawn, and which actually were.
 *
 * The Coverage Census answers "which situations did we never reach". This answers the
 * question one level up: "which comparisons did we never make". They are different negative
 * spaces and the second is the one that hides a wrong conclusion, because an unmade
 * comparison leaves no trace at all — there is no empty row to notice.
 *
 * Founder directive 2026-08-03: the worry is generating data that supports a conclusion and
 * only later discovering that a particular type of comparison was never made. This object is
 * that worry made checkable.
 */
const COMPARISON_CENSUS_FIELDS = [
  { name: 'schemaVersion', type: 'number', since: 1, required: true, note: 'Per-object version.' },
  { name: 'axis', type: 'string', since: 1, required: true,
    note: 'What kind of contrast this censuses — "surface" | "layer" | "generation" | "field". Stated so two censuses are not silently unioned across axes.' },
  { name: 'possible', type: 'array', since: 1, required: true,
    note: 'Every contrast the available artifacts MAKE POSSIBLE. The denominator, enumerated rather than counted, so an unmade comparison is nameable and not just missing.' },
  { name: 'drawn', type: 'array', since: 1, required: true,
    note: 'The contrasts actually run, each pointing at the Result Card that ran it. A contrast claimed without a card is not drawn.' },
  { name: 'notDrawn', type: 'array', since: 1, required: true,
    note: 'THE POINT OF THE OBJECT. Possible minus drawn, each with a reason where one is known. Computed and stored rather than left to be derived, so it survives into any report that quotes the census.' },
  { name: 'blockedReasons', type: 'object', since: 1, required: true,
    note: 'Why a possible contrast was not drawn — "no shared deal book", "generations not rebased", "not attempted". Distinguishes cannot-be-drawn from was-not-drawn, which have opposite implications for a conclusion.' },
];

/**
 * THE REPLICATION MANIFEST — nested inside every Result Card.
 *
 * ADR-009 names the contents; this is that list made checkable. Note how much of it does not
 * exist anywhere in the repo today: no script captures a commit SHA, no corpus is hashed, and
 * the seeds are function defaults that never reach an output file.
 */
const MANIFEST_FIELDS = [
  { name: 'engineCommit', type: 'string', since: 1, required: true,
    note: 'git rev-parse HEAD. Nothing in the repo captured this before WS-322; an engine upgrade silently invalidated every prior figure.' },
  { name: 'engineDirty', type: 'boolean', since: 1, required: true,
    note: 'Uncommitted changes present at run time. A dirty tree means the commit does NOT identify the code that ran, and saying so is the honest move.' },
  { name: 'dealBookHash', type: 'string', since: 1, required: true, note: 'Content hash of the hand set.' },
  { name: 'fieldVersion', type: 'string|null', since: 1, required: true, note: 'Which opponent model, at which version.' },
  { name: 'partition', type: 'string|null', since: 1, required: true, note: 'POOL/EVAL split and the walk-forward prefix.' },
  { name: 'seeds', type: 'object', since: 1, required: true,
    note: 'Every seed actually used, by name. A default that is never recorded is not reproducible, only reproducible-by-luck.' },
  { name: 'unseededSources', type: 'array', since: 1, required: true,
    note: 'Named sources of randomness the run could NOT seed. Required, and an empty array is a positive claim of bit-reproducibility — not a default. The live case: gameTreeEvaluator reaches monteCarloEquity, which calls Math.random(); a manifest listing only the bootstrap seed would assert a replicability the run cannot deliver.' },
  { name: 'constants', type: 'object', since: 1, required: true,
    note: 'Load-bearing constants read from their DEFINITION sites. Minimum set per ADR-009: PRIOR_WEIGHT, ACTION_TAU_FRACTION, MIN_CONTINUATION_WEIGHT.' },
  { name: 'disclaimerRegisterVersion', type: 'string|null', since: 1, required: false,
    note: 'Which disclaimer + suspected-fault register the run stood under (WS-330). `required` stays FALSE here on purpose while manifestProblems rejects a missing one: the flagger has to be able to PARSE a legacy card in order to flag it, so validation tightens and reading does not.' },
  { name: 'knownDivergences', type: 'array', since: 1, required: false,
    note: 'Places the stamped value is known to disagree with a shadow copy elsewhere in the tree. Recording it beats silently picking one.' },
];

/**
 * A FAULT ENTRY — one row of the suspected-fault register (WS-330).
 *
 * Registered here, rather than left as a loose shape in `faultRegister.js`, because a Result
 * Card stamps the register VERSION and that stamp is only meaningful if the thing it versions
 * has a stable shape. A register whose entries could be retyped would let an old card name a
 * version whose entries no longer mean what they meant.
 */
const FAULT_ENTRY_FIELDS = [
  { name: 'faultId', type: 'string', since: 1, required: true,
    note: 'Stable identity, greppable, and the key the queue emitter dedupes on so re-running it emits nothing new.' },
  { name: 'title', type: 'string', since: 1, required: true, note: 'Short enough to read in a ranked table.' },
  { name: 'site', type: 'string', since: 1, required: true,
    note: 'Where the fault lives — a stack layer, or one of corpus | instrument | statistics | process. Not every fault is layer-local, and forcing one into a layer slot means it gets looked for where it is not.' },
  { name: 'mechanism', type: 'string', since: 1, required: true,
    note: 'The PATH by which it goes wrong. "The model may be off" is a worry; a mechanism is an entry.' },
  { name: 'contaminates', type: 'string', since: 1, required: true,
    note: 'Which results this would taint, for a human. The prose half of the contamination claim, and the half the version hash covers.' },
  { name: 'matches', type: 'function', since: 1, required: true,
    note: 'The machine half — a predicate over a Result Card, reading fields the card already carries. Ships WITH the entry so the reader and the claim arrive together, which is the anti-rot rule that keeps this from becoming another predictionAudit.' },
  { name: 'falsifier', type: 'string', since: 1, required: true,
    note: 'The measurement that would settle it. Required: an entry with no falsifier can never leave `untested`, which turns the register back into the caveat list it replaces.' },
  { name: 'probability', type: 'number', since: 1, required: true, note: 'Declared P(this fault is real), 0..1. Half of the ranking.' },
  { name: 'probabilityBasis', type: 'string', since: 1, required: true,
    note: 'WHY that number, so it can be argued with. A bare probability nobody can dispute is a constant chosen by taste — which is itself an entry in this register.' },
  { name: 'priorBreadth', type: 'number', since: 1, required: true,
    note: 'Declared share of results affected, used until enough Result Cards exist to measure it. Blended with the observed share under pseudocount shrinkage.' },
  { name: 'status', type: 'string', since: 1, required: true, note: 'untested | partially-supported | confirmed | retired.' },
  { name: 'evidence', type: 'array', since: 1, required: true,
    note: 'REQUIRED non-empty for confirmed and retired. Confirming without evidence lets a hunch invalidate every prior result; retiring without evidence lets an inconvenient entry be tidied away.' },
];

/**
 * A DECISION RECORD — one `kind: 'decision'` JSONL line per scored backtest decision
 * (`scripts/backtest/decisionRecord.mjs`). The rich sibling of the Decision Atom: same
 * decisions, full capture. Registered here (WS-431) because it shipped ungoverned — its
 * docblock CLAIMED the additive contract while nothing enforced it, the exact WS-291
 * two-shapes mechanism recurring inside the subsystem built to close it.
 *
 * v1 = the shape `af8b9815` shipped. `stable` was added by WS-433 without a version bump
 * (unnoticed — there was no schema to notice); v2 declares it, plus close-time summary and
 * estimator meta. Every field states the future question it answers (the v2 convention
 * above): the record's whole purpose is questions nobody asked when the run was designed.
 */
const DECISION_RECORD_FIELDS = [
  { name: 'schemaVersion', type: 'number', since: 1, required: true, note: 'Per-object version, from SOR_SCHEMA_VERSIONS.decisionRecord. Refuse, never duck-type.' },
  { name: 'playerId', type: 'string', since: 1, required: true,
    note: 'Cluster identity — the CI bootstrap resamples PLAYERS, and rederiving the headline from this file requires clustering on exactly this key.' },
  { name: 'handId', type: 'string|number', since: 1, required: true,
    note: 'With `order`, the WS-410 Stage 5 join key — retroactive pairing of this decision against any atom set on the same Deal Book, without a re-run.' },
  { name: 'order', type: 'number', since: 1, required: true,
    note: 'Action index within the hand. The other half of the cross-run join key.' },
  { name: 'stable', type: 'object|null', since: 2, required: false,
    note: '{p, k, d} canonical coordinates (WS-433). The canonicalization key that makes completion-order rows one measurement, and the sort key the content hash is computed under.' },
  { name: 'observedAction', type: 'string', since: 1, required: true,
    note: 'What the player actually did — the estimator\'s conditioning event. Without it no importance weight exists.' },
  { name: 'observedAmount', type: 'number|null', since: 1, required: false,
    note: 'Sizing of the observed action. Answers sizing-conditioned re-analysis the action label alone cannot.' },
  { name: 'netBB', type: 'number', since: 1, required: true,
    note: 'The whole hand\'s realized net in bb — R_d, stored raw, never pre-multiplied by any weight.' },
  { name: 'netBBUnraked', type: 'number|null', since: 1, required: false,
    note: 'Same outcome before modelled rake — rake-sensitivity re-analysis (WS-429\'s question) without a re-run.' },
  { name: 'street', type: 'string', since: 1, required: true,
    note: 'Per-street decomposition of any aggregate — the axis WS-291\'s river/pre-river split needed.' },
  { name: 'heroSeat', type: 'number|null', since: 1, required: false,
    note: 'Positional decomposition — which seats pay. A label-free coordinate, not a bucket.' },
  { name: 'buttonSeat', type: 'number|null', since: 1, required: false,
    note: 'With heroSeat, derives relative position from raw state instead of storing a position label.' },
  { name: 'opponentSeat', type: 'number|null', since: 1, required: false,
    note: 'Villain identity axis. Present since WS-393 — WS-410 §4.3\'s claim that it is discarded is corrected by this line.' },
  { name: 'board', type: 'array|null', since: 1, required: false,
    note: 'Raw board cards — texture re-bucketing under any FUTURE texture model, not the one current at write time.' },
  { name: 'boardLabels', type: 'array|null', since: 1, required: false,
    note: 'Human handles for the same cards; a browsing affordance, derivable but cheap.' },
  { name: 'situationKey', type: 'string|null', since: 1, required: false,
    note: 'WS-317 structured key, serialized — the join to declared surfaces and the atom store\'s keying axis.' },
  { name: 'contextAction', type: 'string|null', since: 1, required: false,
    note: 'The facing-action context label the policy conditioned on — checkable against slices.facingAction.' },
  { name: 'isAgg', type: 'boolean|null', since: 1, required: false,
    note: 'Aggressor flag at the node — initiative-conditioned decomposition.' },
  { name: 'isIP', type: 'boolean|null', since: 1, required: false,
    note: 'Position-in-hand flag — IP/OOP decomposition without re-deriving from seats.' },
  { name: 'rangeEquityPct', type: 'number|null', since: 1, required: false,
    note: 'Range-vs-range equity at the node — the cheap conditioning axis for "where does the edge live".' },
  { name: 'segmentation', type: 'object|null', since: 1, required: false,
    note: 'segmentRange output at the node — which strength segments the range held, for composition-conditioned queries (fear-drives-medium doctrine).' },
  { name: 'geometry', type: 'object|null', since: 1, required: false,
    note: 'Raw pot/bet/stack coordinates (WS-393) — SPR decomposition from state, never from a zone label.' },
  { name: 'piOurs', type: 'object', since: 1, required: true,
    note: 'Our policy\'s action distribution at the node — THE estimator input, kept separate from piPool and never pre-multiplied.' },
  { name: 'evStats', type: 'object|null', since: 1, required: false,
    note: 'Primary-arm EV statistics incl. achieved depth — how much of the run the clock decided (WS-432\'s question).' },
  { name: 'piOursByArm', type: 'object', since: 1, required: true,
    note: 'Per-arm distributions — the between-arms contrast is the point of a multi-arm run and cannot be reconstructed from the primary alone.' },
  { name: 'piPool', type: 'object', since: 1, required: true,
    note: 'The behavior policy\'s distribution — the estimator\'s denominator, raw.' },
  { name: 'poolEvidenceN', type: 'number|null', since: 1, required: false,
    note: 'Observations behind piPool — answers "how much of this weight is prior vs evidence".' },
  { name: 'piPbr', type: 'object|null', since: 1, required: false,
    note: 'Pool-best-response distribution (WS-331) — the ceiling contrast at this node. Null carries pbrSkipReason.' },
  { name: 'piPbrBySweep', type: 'object|array|null', since: 1, required: false,
    note: 'PBR across the shrink sweep — ceiling re-derivation at any sweep point without a re-run.' },
  { name: 'slices', type: 'object', since: 1, required: true,
    note: 'The declared slice axes (street/facing/texture/position/size/playersInPot/showdown) — the standard decomposition menu.' },
  { name: 'pPoolObserved', type: 'number|null', since: 1, required: false,
    note: 'piPool evaluated at the observed action — the weight\'s denominator, stored so the weight is checkable.' },
  { name: 'pOursObservedByArm', type: 'object', since: 1, required: false,
    note: 'piOurs at the observed action, per arm — the weight\'s numerator, same reason.' },
  { name: 'wRawByArm', type: 'object', since: 1, required: false,
    note: 'UNCAPPED importance ratio per arm. The cap is an ESTIMATOR property applied at read time (ipsEstimator.weightFor) — answers "where does the cap bind" which a capped value forecloses.' },
  { name: 'heroTruth', type: 'object', since: 1, required: false,
    note: 'Showdown-revealed holding with truthAvailable/reason discriminator and range-coverage reading. DIAGNOSTIC ONLY — conditioning on it is the selection heroPolicy exists to avoid.' },
  { name: 'evStatsByArm', type: 'object', since: 1, required: false,
    note: 'evStats per arm — depth/budget forensics for the arm contrast.' },
  { name: 'combosByArm', type: 'object', since: 1, required: false,
    note: 'Per-combo detail incl. the ranked candidate list with EVs — "which combos leak", the 103-minute-run question, and the near-ties a future change would flip.' },
  { name: 'policyDiagByArm', type: 'object', since: 1, required: false,
    note: 'samples/engineErrors/outOfSet per arm — was this row produced cleanly, queryable per decision.' },
  { name: 'pbrSkipReason', type: 'string|null', since: 1, required: false,
    note: 'WHY piPbr is null — the null discriminator (truth.basis pattern): "not computed" vs "refused, and for what reason".' },
  { name: 'omitted', type: 'object|null', since: 2, required: false,
    note: 'fieldName → reason for every DELIBERATE omission, so absent-vs-empty is decidable forever. Shipped before any producer relies on ambiguous null (WS-431 discriminator rule).' },
];

/**
 * The record file's `kind: 'meta'` first line — run identity + everything required to
 * rederive the headline from the rows alone (v2: the estimator block).
 */
const DECISION_RECORD_META_FIELDS = [
  { name: 'kind', type: 'string', since: 1, required: true, note: '"meta" — the self-describing discriminator; readers filter on it.' },
  { name: 'schemaVersion', type: 'number', since: 1, required: true, note: 'Same contract as the rows.' },
  { name: 'writtenAt', type: 'string', since: 1, required: true, note: 'Wall-clock provenance. EXCLUDED from the content hash — identity lives in the fields below.' },
  { name: 'run', type: 'string', since: 1, required: false, note: 'Which runner wrote this (hero-ev / depth-ablation) — files outlive the invocation that made them.' },
  { name: 'dealBookId', type: 'string|null', since: 1, required: false, note: 'The Deal Book identity half of "same measurement".' },
  { name: 'dealBookHash', type: 'string|null', since: 1, required: false, note: 'The content half — a record is comparable only within one Deal Book hash.' },
  { name: 'engineCommit', type: 'string|null', since: 1, required: false, note: 'Engine version the rows were produced under.' },
  { name: 'engineDirty', type: 'boolean|null', since: 1, required: false, note: 'Dirty-tree honesty flag, surfaced not hidden.' },
  { name: 'arms', type: 'array', since: 1, required: false, note: 'The arm roster with budgets — what piOursByArm\'s keys mean.' },
  { name: 'constants', type: 'object', since: 1, required: false, note: 'The replication-stamp constants active at write time.' },
  { name: 'estimator', type: 'object', since: 2, required: false,
    note: 'weightCap / bootstrapSeed / bootstrapResamples / bootstrapAlpha, IMPORTED from ipsEstimator — without these the headline and its CI are not rederivable from this file (the WS-431 inversion criterion).' },
  { name: 'caveat', type: 'string', since: 1, required: true, note: 'States that a truncated file is a biased subsample of PLAYERS — the file warns its own reader.' },
];

/** The `kind: 'summary'` last line `close()` appends (v2). */
const DECISION_RECORD_SUMMARY_FIELDS = [
  { name: 'kind', type: 'string', since: 2, required: true, note: '"summary".' },
  { name: 'schemaVersion', type: 'number', since: 2, required: true, note: 'Same contract as the rows.' },
  { name: 'rowCount', type: 'number', since: 2, required: true, note: 'Decision-line count from a re-read of the file itself, not the writer\'s counter — ground truth over bookkeeping.' },
  { name: 'contentHash', type: 'string|null', since: 2, required: true,
    note: 'sha256 over rows canonicalized by stable(p,k,d) — the BY-HASH reference a Result Card carries (never the path; atomStore doctrine), run-invariant across serial/pool and fresh/resumed runs.' },
  { name: 'canonicalOrder', type: 'string', since: 2, required: true, note: 'Names the sort the hash was computed under, so a reader canonicalizes the same way.' },
];

/** Every registered object type, by name. */
export const SOR_SCHEMAS = Object.freeze({
  strategyCard: Object.freeze(STRATEGY_CARD_FIELDS),
  decisionAtom: Object.freeze(DECISION_ATOM_FIELDS),
  coverageCensus: Object.freeze(COVERAGE_CENSUS_FIELDS),
  comparisonCensus: Object.freeze(COMPARISON_CENSUS_FIELDS),
  dealBookManifest: Object.freeze(DEAL_BOOK_MANIFEST_FIELDS),
  fieldManifest: Object.freeze(FIELD_MANIFEST_FIELDS),
  resultCard: Object.freeze(RESULT_CARD_FIELDS),
  faultEntry: Object.freeze(FAULT_ENTRY_FIELDS),
  decisionRecord: Object.freeze(DECISION_RECORD_FIELDS),
});

/** The record file's meta/summary lines, registered like MANIFEST_SCHEMA — same guard. */
export const DECISION_RECORD_META_SCHEMA = Object.freeze(DECISION_RECORD_META_FIELDS);
export const DECISION_RECORD_SUMMARY_SCHEMA = Object.freeze(DECISION_RECORD_SUMMARY_FIELDS);

/** The nested manifest shape, registered separately so it is guarded by the same test. */
export const MANIFEST_SCHEMA = Object.freeze(MANIFEST_FIELDS);

/** Thrown by every loader/validator in this directory. Never returns a partial object. */
export class StandardOfRecordError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'StandardOfRecordError';
    Object.assign(this, detail);
  }
}

const typeMatches = (value, type) => {
  const alternatives = type.split('|').map((t) => t.trim());
  return alternatives.some((t) => {
    if (t === 'null') return value === null;
    if (t === 'array') return Array.isArray(value);
    if (t === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    return typeof value === t; // eslint-disable-line valid-typeof
  });
};

/**
 * Check an object against a registered field list.
 *
 * Returns a list of problems rather than throwing, so a caller can decide whether a missing
 * field is fatal here (loaders: yes) or reportable (tooling: sometimes). Unknown extra fields
 * are ALLOWED and deliberately not reported — additive-only means a newer producer writing a
 * field this reader has never heard of must not break the reader.
 */
export const checkAgainstSchema = (obj, fields, { label = 'object' } = {}) => {
  const problems = [];
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return [`${label} must be an object`];
  }
  for (const field of fields) {
    const present = Object.prototype.hasOwnProperty.call(obj, field.name);
    if (!present) {
      if (field.required) problems.push(`${label}.${field.name} is required (${field.note})`);
      continue;
    }
    if (!typeMatches(obj[field.name], field.type)) {
      problems.push(`${label}.${field.name} must be ${field.type}, got ${obj[field.name] === null ? 'null' : typeof obj[field.name]}`);
    }
  }
  return problems;
};
