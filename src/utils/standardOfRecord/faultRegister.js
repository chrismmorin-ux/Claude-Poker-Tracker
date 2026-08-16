/**
 * faultRegister.js — the Disclaimer and the Suspected-Fault Register (WS-330).
 *
 * Register (read this first): docs/standard-of-record/DISCLAIMER-AND-FAULT-REGISTER.md
 * Vocabulary:                 docs/standard-of-record/VOCABULARY.md
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS FOR.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * WS-322 gave every comparative claim a Result Card, and WS-324 gave every surface a Stack so
 * a fault could be localized to a layer. Neither says what the numbers can HONESTLY CLAIM, and
 * neither records WHERE THE FAULT IS MOST LIKELY TO BE.
 *
 * That second gap is the expensive one. WS-291 — a falsified range model on the live
 * recommendation path — was wrong for the life of the project, and when it was finally caught
 * there was no way to know WHAT IT HAD TAINTED. Every figure published under it stayed
 * published, because nothing connected "this belief was wrong" to "these results depended on it".
 *
 * So this module holds two artefacts:
 *
 *   (1) THE DISCLAIMER — a precise statement of the estimand. Not legal boilerplate and not
 *       modesty: what was substituted, over what horizon, against which opponents, on which
 *       population, in what units, with what cluster unit.
 *
 *   (2) THE SUSPECTED-FAULT REGISTER — a RANKED list of where the fault most likely is, each
 *       entry carrying its mechanism, its site, what it contaminates, a FALSIFIER, and a status.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY RANKED, AND WHY THIS RANKING.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * A flat list of limitations is read once and ignored. A ranked register with falsifiers is a
 * WORK QUEUE — it says what to measure next, and each entry either gets confirmed and fixed or
 * retired with evidence.
 *
 * Founder decision, 2026-08-04: rank by EXPECTED DAMAGE = probability x contamination breadth,
 * with BOTH COMPONENTS SHOWN, and with breadth MEASURED rather than asserted. Ranking by
 * probability alone would put population mismatch at the top (near-certain, but bounded and
 * already understood) and bury a leakage channel that is unlikely and would invalidate
 * everything. Expected damage is what should drive what gets measured next.
 *
 * Breadth is measured as the share of known Result Cards an entry actually contaminates,
 * BLENDED with a declared prior under pseudocount shrinkage — the same idiom as `PRIOR_WEIGHT`
 * everywhere else in this repo. There are very few Result Cards today, so the prior carries the
 * ranking at first and evidence takes over as the Ladder fills. `rankFaults` returns both
 * components on every row so a reader can see which half is doing the work; a ranking whose
 * inputs are invisible is the "constants chosen by taste" fault wearing a different hat, and
 * that fault is an entry in this very register.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY CONTAMINATION IS COMPUTED AND NOT DECLARED PER CARD.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * The obvious design gives every Result Card an `exposures: string[]` naming the faults it is
 * subject to. It is also the design that fails: it asks every future card author to remember a
 * field, and this repo has watched that pattern rot three times (`predictionAudit` captured and
 * never read, `perceivedHeroRange` shipped behind a parameter no call site passed, WS-284).
 *
 * So each entry ships its own `matches(card)` PREDICATE, reading fields the card ALREADY
 * CARRIES. The reader arrives with the field, in the same change, which is the anti-rot rule
 * WS-328 states. A new card is classified the moment it exists, by code that was written when
 * the fault was described.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE REGISTER APPLIES ITS OWN DOCTRINE TO ITSELF.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * DEGENERATE SIGNAL is an entry in this register: `holdingKnowledge.covered` is always true on
 * the engine as it ships, so it discriminates nothing, and a metric that cannot fail is not
 * evidence. A matcher that flags 0% or 100% of cards has exactly that defect.
 *
 * `registerSelfCheck` therefore reports every matcher's discrimination. Non-discriminating is
 * REPORTED, NOT REJECTED — temporal staleness genuinely does apply to every corpus-derived
 * card, and the honest move is to make that visible rather than to outlaw it and push the
 * admission somewhere nothing can find it. Same argument the vocabulary makes for why the
 * `fear` warrant is legal.
 */

import { hashObject } from '../contentHash.js';
import { STACK_LAYERS } from './stack.js';

/**
 * Status of a register entry.
 *
 * `untested` and `partially-supported` are the honest majority. The two terminal states both
 * REQUIRE EVIDENCE (see `faultEntryProblems`) — an entry may not be confirmed or retired on
 * someone's say-so, because a register whose entries can quietly disappear is a caveat list
 * again.
 */
export const FAULT_STATUSES = Object.freeze([
  'untested',
  'partially-supported',
  'confirmed',
  'retired',
]);

/**
 * Where a fault LIVES.
 *
 * The stack layers come from `stack.js` and are never redefined here — WS-324 made "which layer
 * is wrong" answerable and the whole point was that one ordered vocabulary is shared. But not
 * every fault is layer-local: a stale corpus is not a bug in the equity layer, and a constant
 * chosen by reading a table rather than sweeping it is not a bug in any layer at all. Those
 * need sites of their own, or they would be forced into a layer slot where they would be
 * looked for and not found.
 */
export const NON_LAYER_SITES = Object.freeze([
  /** The data the claim stands on — population, era, selection. */
  'corpus',
  /** The measuring device itself — horizon, opponents, what it substitutes. */
  'instrument',
  /** How uncertainty was computed — denominators, clustering, intervals. */
  'statistics',
  /** How the work was done — unswept constants, leakage controls, review. */
  'process',
]);

export const FAULT_SITES = Object.freeze([...STACK_LAYERS, ...NON_LAYER_SITES]);

export const isFaultSite = (site) => FAULT_SITES.includes(site);

/** The flag a contaminated Result Card carries. */
export const SUSPECT_PENDING_REVIEW = 'suspect-pending-review';

/**
 * The corpus's own within-span drift, measured by WS-353 on 2026-08-05.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * READ `doesNotLicense` BEFORE `medianAbsDriftPP`.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * `FAULT-temporal-staleness` asks what SIXTEEN YEARS did to the population. Its written
 * falsifier answers that by fitting the same priors on SRC-005 and differencing cell by cell,
 * and that falsifier could not be run (see the entry's `falsifierBlockers`).
 *
 * What CAN be run is a strictly smaller question the same corpus answers on its own: the hands
 * carry `day/month/year`, so the pool's cells can be blocked by day and the SAME population
 * differenced against itself across the span it actually covers. That is a real measurement of
 * a real quantity. It is not a smaller version of the falsifier, and it is not evidence for or
 * against the entry — which is why it lives here as its own record rather than in the entry's
 * `evidence`, the field that gates confirmation and retirement.
 *
 * What it is FOR: a per-cell gap is unreadable without a null. This supplies one — the size of
 * gap this population produces with NO era change at all — at a nineteen-day horizon and at one
 * stake. Any future cross-era gap smaller than this is not drift; it is who logged in.
 *
 * Stat semantics are the canonical ones: the measurement ran `phh_miner.mine_hand` UNCHANGED
 * (the same function that produced the shipped 2009 cells) and added only the day blocking, so
 * the numbers below and the values in `HANDHQ_REFERENCE_STAKES` are the same quantities.
 *
 * Clustered on DAYS, never hands — the interval on each cell's slope comes from the spread
 * ACROSS days, so day-level composition (who was logged in, weekend vs weekday, traffic) is
 * inside the interval rather than hidden under it.
 */
export const WITHIN_CORPUS_DRIFT_2009 = Object.freeze({
  measuredBy: 'WS-353, 2026-08-05',
  sourceId: 'SRC-012',
  span: 'PS 2009-07-01..2009-07-20 (20 days present, contiguous); '
    + 'FTP 2009-07-01..2009-07-19 (10 days present, non-contiguous)',
  spanDays: 19,
  stakes: '50NLH ONLY — one of the seven stakes the 2009 cells cover, and the only one '
    + 'materialized on disk at C:/Users/chris/data/phh-dataset/data/handhq',
  sites: Object.freeze(['PS', 'FTP']),
  cells: 24,
  cellIndex: '2 sites x {6max, full} x {vpip, pfr, threeBet, foldTo3Bet, cbet, foldToCbet}',
  handsScored: 1065871,
  minCellDenominator: 41941,
  maxCellDenominator: 2172157,
  clusterUnit: 'days',
  medianAbsDriftPP: 0.40,
  maxAbsDriftPP: 2.58,
  medianAbsSlopePPPerDay: 0.0212,
  maxAbsSlopePPPerDay: 0.1436,
  cellsWhoseIntervalExcludesZero: 4,
  medianDailyDispersion: 4.35,
  maxDailyDispersion: 36.3,
  weekdayWeekendGapMaxPP: 0.95,
  licenses:
    'A NULL, at a nineteen-day horizon and at 50NL. The same population, same stake, same '
    + 'month, moves a cell by a median 0.40pp and up to 2.58pp; its daily rates are 4.35x '
    + '(median) to 36x overdispersed against binomial; and the weekday/weekend gap alone '
    + 'reaches 0.95pp, comparable to the whole nineteen-day fitted drift. A cross-era per-cell '
    + 'gap under roughly one point is therefore inside what this population does with NO era '
    + 'change, and must not be quoted as drift.',
  doesNotLicense:
    'ANYTHING ABOUT 2026. Nineteen days is not sixteen years, and the slope has no '
    + 'extrapolative content — it is refuted by its own extrapolation. Carried linearly over '
    + 'the 6,230 days from the corpus midpoint to 2026-08-05, the MEDIAN slope gives 132pp of '
    + 'change and the maximum gives 895pp; both are impossible for a proportion. The direction '
    + 'of a nineteen-day slope is also not the direction of a sixteen-year one: this window '
    + 'contains three weekends and no meta shift. Reporting any figure here as a drift estimate '
    + 'for the founder\'s era would be exactly the substitution this register exists to catch.',
});

/**
 * Version epoch. Bumped BY HAND only on a structural change to what an entry means.
 *
 * The full version is this plus a content hash (see `registerVersion`), so an edit to any entry
 * changes the version whether or not anyone remembers to bump the epoch. A version someone has
 * to remember to change is a version that will be wrong exactly when it matters — which is the
 * argument `strategyCard` already makes for stamping `contentHash` in the loader rather than
 * trusting the author's copy.
 */
export const REGISTER_EPOCH = 'FR-1';

// ══════════════════════════════════════════════════════════════════════════════════════
// THE DISCLAIMER
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * What this system is measuring, by component.
 *
 * Every field here is one a reader needs in order to know what the number is NOT. `units` and
 * `clusterUnit` are separated deliberately: a figure in bb/100 clustered on hands and the same
 * figure clustered on sessions are the same units and different claims.
 */
export const THE_DISCLAIMER = Object.freeze({
  substitution:
    'ONE hero decision is replaced by the surface under test; the rest of the hand plays out as '
    + 'it was recorded. This is a per-decision substitution, not a strategy played end to end.',
  horizon:
    'One decision. The value of a whole strategy is NOT measured — reading a per-decision edge '
    + 'as a winrate overstates it by roughly the decisions-per-hand factor.',
  opponents:
    'The opponents are whoever occupied the other seats in the recorded hand, or the modelled '
    + 'Field when a simulator supplies them. In the second case the opponents ARE our model of '
    + 'people, so a fault in the population model is invisible inside the result.',
  population:
    'Online 6-max and full-ring, July 2009 (SRC-011/SRC-012, the Mass Data Field). The '
    + "founder's own game is LIVE 9-handed 1/2-1/3, which is a DISTINCT population. Any live "
    + 'claim anchored here is TRANSFERRED, not measured.',
  units:
    'Big blinds per decision unless a Result Card states otherwise. Rake is MODELLED — the '
    + 'corpus records none — so every figure carries an assumed schedule.',
  clusterUnit:
    'Sessions or players, never hands. Hands are not independent within a session, so a '
    + 'hand-clustered interval is narrower than the data supports (POKER_THEORY 14.3).',
  holeCards:
    'Advice is RANGE-MARGINALIZED. Results are the value of the advice averaged over the hands '
    + 'hero COULD hold, not the hand hero HELD — a weaker claim than a cards-known instrument, '
    + 'and the strongest this corpus supports.',
});

/**
 * The TREATMENT string, reusable verbatim on a Result Card.
 *
 * `ipsEstimator.TREATMENT` already supplies a string of this shape for the hero-EV instrument;
 * this is the register-level default for surfaces that do not have one of their own. Never
 * report a number without its treatment named.
 */
export const DISCLAIMER_TREATMENT =
  'per-decision substitution · one-decision horizon · recorded-or-modelled opponents · '
  + 'online 2009 population · bb per decision · modelled rake · clustered on sessions or '
  + 'players · range-marginalized policy';

// ══════════════════════════════════════════════════════════════════════════════════════
// ENTRY CONSTRUCTION
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * Build one register entry.
 *
 * @param {Object} input
 * @param {string} input.faultId - stable, greppable, and the dedupe key the queue emitter uses
 * @param {string} input.title - short enough to read in a ranked table
 * @param {string} input.site - one of FAULT_SITES
 * @param {string} input.mechanism - HOW it goes wrong. Not "the model may be off" — the path.
 * @param {string} input.contaminates - which results this would taint, in words, for a human
 * @param {(card: Object) => boolean} input.matches - the machine form of `contaminates`
 * @param {string[]} input.matchesOn - the card fields `matches` READS, from
 *   `MATCHABLE_CARD_FIELDS`. Required, non-empty, and HASHED — see `canonicalRegisterBody`.
 * @param {RegExp} [input.disclosureCue] - prose that would count as the card DISCLOSING this
 *   fault. Read by `contaminationDisclosure` for reporting only; never by `matches`.
 * @param {string} input.falsifier - the measurement that would settle it. Required: an entry
 *   with no falsifier is a worry, not a register entry, and cannot leave `untested`.
 * @param {number} input.probability - declared P(this fault is real), 0..1
 * @param {string} input.probabilityBasis - WHY that number. Stated so it can be argued with.
 * @param {number} input.priorBreadth - declared share of results affected, 0..1, used until
 *   enough Result Cards exist to measure it
 * @param {string} [input.status]
 * @param {string[]} [input.evidence] - required for `confirmed` and `retired`
 * @param {string[]} [input.falsifierBlockers] - why the falsifier CANNOT BE RUN TODAY, and what
 *   would unblock it. See the block comment above `faultEntryProblems`.
 * @param {Array} [input.clearedBlockers] - blockers that USED to be on this entry and no longer
 *   are, each carrying the evidence that cleared it and what it did NOT clear. See
 *   `clearFalsifierBlocker`.
 */
export const buildFaultEntry = ({
  faultId,
  title,
  site,
  mechanism,
  contaminates,
  matches,
  matchesOn = [],
  disclosureCue = null,
  falsifier,
  probability,
  probabilityBasis,
  priorBreadth,
  status = 'untested',
  evidence = [],
  falsifierBlockers = [],
  clearedBlockers = [],
} = {}) => {
  const entry = {
    faultId,
    title,
    site,
    mechanism,
    contaminates,
    matches,
    matchesOn: [...matchesOn],
    disclosureCue,
    falsifier,
    probability,
    probabilityBasis,
    priorBreadth,
    status,
    evidence: [...evidence],
    falsifierBlockers: [...falsifierBlockers],
    clearedBlockers: clearedBlockers.map((c) => Object.freeze({
      ...c,
      clearedBy: [...(c?.clearedBy ?? [])],
    })),
  };
  const problems = faultEntryProblems(entry);
  if (problems.length) {
    throw new Error(`fault register entry "${faultId}" is incomplete:\n  - ${problems.join('\n  - ')}`);
  }
  return Object.freeze(entry);
};

/**
 * Problems with an entry, as strings. Empty means valid.
 *
 * Exported separately from the builder for the reason `manifestProblems` and
 * `resultCardProblems` are: a checker that can disagree with its constructor is worse than no
 * checker, so there is exactly one implementation and both paths call it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY `falsifierBlockers` EXISTS (WS-352).
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * The register is a WORK QUEUE — §6 of the doc turns top-ranked entries into tickets carrying
 * their falsifier as the accept criterion. WS-352 ran the rank-1 entry's falsifier and found it
 * UNRUNNABLE: it names SRC-014 (the founder's live 1/3 pool) as one of its two arms, and SRC-014
 * has no positive identity, no export path, and no volume floor. Nothing in the register could
 * say that.
 *
 * That gap matters because `untested` was doing two incompatible jobs: "nobody got round to it"
 * and "it cannot be done, and here is what would make it possible". Those route to completely
 * different work — the first to an analyst, the second to whoever owns the ingest path — and a
 * queue that cannot tell them apart re-emits an unrunnable item at rank 1 forever.
 *
 * So the blocker is DATA, not prose in a report nothing reads. It is hashed into the register
 * version, which means removing a blocker is a recorded version change rather than a quiet edit.
 *
 * DELIBERATELY NOT `evidence`. Evidence is the field that gates confirmation and retirement, and
 * it must keep meaning "a measurement exists". Writing "we could not measure it" into the field
 * whose whole job is to prove something WAS measured would let a future entry be confirmed on
 * the record of its own failure to be tested. Blocked and settled are opposite states.
 *
 * WS-353 then ran the rank-2 entry's falsifier and found the SAME shape: the arm that is already
 * mined is fine, and the arm naming a source the founder actually plays on is unreachable. Two
 * for two on the top two entries is worth reading as a finding in itself — the register's most
 * damaging entries are the ones about the corpus, and the corpus is precisely where the repo has
 * no second population it can score. `blockedFalsifiers()` is what makes that pattern countable
 * rather than something a reader would have to notice twice.
 *
 * Hence the rule below: an entry may not be `confirmed` or `retired` while it declares its
 * falsifier is blocked. Settling an entry whose named test cannot be run means something EASIER
 * was substituted — which is exactly the move this whole apparatus exists to prevent. Clearing
 * the blocker first is not a formality; it is the author stating, in a hashed field, that the
 * test that was supposed to settle this is the test that settled it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY `clearedBlockers` EXISTS (WS-368 accept criterion 7).
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * WS-368 built the thing the first blocker on the rank-1 entry asked for — a positive, closed
 * provenance set on every hand — so that blocker stopped being true while the register went on
 * asserting it. The obvious move is to delete the string. That is the wrong move twice over.
 *
 * First, DELETION LOSES THE CLAIM. Blockers are hashed, so removing one moves the version and a
 * reader of an old Result Card can see that SOMETHING moved — but not what, and not on what
 * authority. The clearing of a blocker is exactly as much a claim about what this register can
 * settle as the raising of one, and it is a claim that should have to name its evidence. The
 * bar is the same as `confirmFault`'s and for the same reason.
 *
 * Second, CLEARING ONE BLOCKER IS NOT SETTLING AN ENTRY, and the difference is where the damage
 * would be. FAULT-population-mismatch carried three: identity, harness reachability, volume
 * floor. WS-368 answered the first. Its own commit message says so and says the other two are
 * untouched. An entry that recorded "a blocker was cleared" without recording WHAT IS STILL
 * BLOCKED reads, six months later, as an entry that came unblocked — which would license
 * confirming it on the strength of a test still nobody can run. So `note` is required and is
 * the field where the author states what the clearance does NOT cover.
 *
 * Third, MECHANISM IS NOT DATA. WS-368's migration stamps every pre-existing row `unknown`
 * rather than guessing `live`, which is correct and means the selectable live set starts EMPTY
 * and grows only from new play. The blocker "the subset cannot be selected" is genuinely
 * cleared; "there is a live arm to measure" is not, and never was this blocker's claim. That
 * distinction lives in `note` too, because it is precisely the one a reader in a hurry collapses.
 */
export const faultEntryProblems = (entry) => {
  const problems = [];
  if (entry === null || typeof entry !== 'object') return ['entry must be an object'];

  if (!entry.faultId) problems.push('faultId is required — it is the identity the queue emitter dedupes on');
  if (!entry.title) problems.push('title is required');
  if (!isFaultSite(entry.site)) {
    problems.push(`site "${entry.site}" is not one of ${FAULT_SITES.join(' | ')}`);
  }
  if (!entry.mechanism) {
    problems.push('mechanism is required — "the model may be wrong" is a worry; the PATH by which it goes wrong is an entry');
  }
  if (!entry.contaminates) problems.push('contaminates is required — an entry that taints nothing is not a fault');
  if (typeof entry.matches !== 'function') {
    problems.push(
      'matches must be a predicate over a Result Card. It is the machine form of `contaminates`, '
      + 'and it ships WITH the entry so the reader and the claim arrive together',
    );
  }
  // WS-369. The predicate itself cannot be hashed, so the entry must declare WHAT IT READS —
  // a stable descriptor that moves when the semantics move and not when the whitespace does.
  // See `canonicalRegisterBody` for why that descriptor is in the version hash.
  if (!Array.isArray(entry.matchesOn) || entry.matchesOn.length === 0) {
    problems.push(
      'matchesOn is required and must name at least one card field the matcher reads, from '
      + `${MATCHABLE_CARD_FIELDS.join(' | ')}. A matcher whose basis is undeclared can be `
      + 'rewritten from a dependency to a sentence without any reader of an old card being able '
      + 'to tell',
    );
  } else {
    const unknown = entry.matchesOn.filter((f) => !MATCHABLE_CARD_FIELDS.includes(f));
    if (unknown.length) {
      problems.push(
        `matchesOn names ${unknown.join(', ')}, which ${unknown.length === 1 ? 'is' : 'are'} not `
        + `${MATCHABLE_CARD_FIELDS.join(' | ')}. The set is closed so a typo cannot pass for a `
        + 'declaration',
      );
    }
  }
  if (entry.disclosureCue !== null && entry.disclosureCue !== undefined
    && !(entry.disclosureCue instanceof RegExp)) {
    problems.push('disclosureCue must be a RegExp over the card\'s prose, or absent');
  }
  if (!entry.falsifier) {
    problems.push(
      'falsifier is required — an entry with no falsifier can never leave `untested`, which '
      + 'turns the register back into the caveat list it exists to replace',
    );
  }
  if (!inUnitInterval(entry.probability)) {
    problems.push(`probability must be a number in [0,1] — got ${entry.probability}`);
  }
  if (!entry.probabilityBasis) {
    problems.push('probabilityBasis is required — a bare number nobody can argue with is a constant chosen by taste');
  }
  if (!inUnitInterval(entry.priorBreadth)) {
    problems.push(`priorBreadth must be a number in [0,1] — got ${entry.priorBreadth}`);
  }
  if (!FAULT_STATUSES.includes(entry.status)) {
    problems.push(`status "${entry.status}" is not one of ${FAULT_STATUSES.join(' | ')}`);
  }
  if (!Array.isArray(entry.evidence)) {
    problems.push('evidence must be an array (empty is legal for an untested entry, absent is not)');
  } else if ((entry.status === 'confirmed' || entry.status === 'retired') && entry.evidence.length === 0) {
    // The one rule that keeps the register honest in both directions. Confirming without
    // evidence lets a hunch flag every prior result; retiring without evidence lets an
    // inconvenient entry be tidied away. Entries never quietly disappear.
    problems.push(
      `status "${entry.status}" requires at least one evidence entry — an entry may not be `
      + 'confirmed or retired on assertion alone',
    );
  }

  if (!Array.isArray(entry.falsifierBlockers)) {
    problems.push('falsifierBlockers must be an array (empty means the falsifier is runnable today)');
  } else {
    if (entry.falsifierBlockers.some((b) => typeof b !== 'string' || !b.trim())) {
      problems.push(
        'every falsifierBlocker must be a non-empty string naming WHAT blocks the falsifier and '
        + 'what would unblock it — "blocked" on its own routes to nobody',
      );
    }
    if (
      entry.falsifierBlockers.length > 0
      && (entry.status === 'confirmed' || entry.status === 'retired')
    ) {
      problems.push(
        `status "${entry.status}" is not available while falsifierBlockers is non-empty — the `
        + 'named falsifier cannot be run, so anything that settled this entry was a DIFFERENT '
        + 'and easier test. Clear the blockers (a hashed, recorded change) before settling it',
      );
    }
  }

  if (!Array.isArray(entry.clearedBlockers)) {
    problems.push('clearedBlockers must be an array (empty means no blocker was ever cleared)');
  } else {
    for (const c of entry.clearedBlockers) {
      if (c === null || typeof c !== 'object' || Array.isArray(c)) {
        problems.push('every clearedBlocker must be an object { blocker, clearedBy, at, note }');
        continue;
      }
      if (typeof c.blocker !== 'string' || !c.blocker.trim()) {
        problems.push(
          'clearedBlocker.blocker must repeat the blocker text VERBATIM as it stood — a cleared '
          + 'blocker summarised into a phrase cannot be checked against what was actually raised',
        );
      }
      if (!Array.isArray(c.clearedBy) || c.clearedBy.length === 0
        || c.clearedBy.some((e) => typeof e !== 'string' || !e.trim())) {
        // Same bar as confirmation, and for the same reason in reverse: raising a blocker costs
        // nothing, so clearing one on assertion alone would let the register be quietly unblocked
        // down to the entries someone wants to settle.
        problems.push(
          'clearedBlocker.clearedBy must name at least one piece of recorded evidence (a commit, '
          + 'a measurement) — a blocker may not be cleared on assertion alone',
        );
      }
      if (typeof c.at !== 'string' || !c.at.trim()) {
        problems.push('clearedBlocker.at must carry the date the blocker was cleared');
      }
      if (typeof c.note !== 'string' || !c.note.trim()) {
        problems.push(
          'clearedBlocker.note is required and must state WHAT THIS DOES NOT CLEAR — a clearance '
          + 'with no stated limit reads later as an entry that came unblocked',
        );
      }
      if (Array.isArray(entry.falsifierBlockers) && entry.falsifierBlockers.includes(c.blocker)) {
        problems.push(
          `clearedBlocker "${String(c.blocker).slice(0, 40)}…" is ALSO still listed in `
          + 'falsifierBlockers. A blocker is cleared or it is blocking; holding both makes the '
          + 'blocked/unblocked distinction unreadable',
        );
      }
    }
  }
  return problems;
};

const inUnitInterval = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;

// ══════════════════════════════════════════════════════════════════════════════════════
// MATCHER HELPERS
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WS-369 — A MATCHER MAY NOT READ A CARD'S PROSE TO DECIDE WHAT THAT CARD DEPENDS ON.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * `isLiveFacing` used to be `/\blive\b|1\/2|1\/3|9-handed/` over a haystack that included
 * `estimand` and `treatment`. It therefore fired on the WS-293 range-calibration card BECAUSE
 * that card's own treatment string ends "any claim about live 9-handed 1/2-1/3 is TRANSFERRED,
 * not measured" — every matching token was present ONLY because the author wrote the disclaimer,
 * and the module that emits it states it repeats the sentence three times so a reader cannot
 * skip it. Each repetition made the match more certain.
 *
 * A card with the SAME Deal Book, the same Field and the same partition, whose treatment simply
 * never uses those words, matched nothing at all. That is the dangerous card: it leans on the
 * online corpus for advice that will be read at a live table and says so nowhere.
 *
 * So the detector was inverted with respect to the risk it exists to catch — it penalised
 * disclosure and was blind to silence — and the incentive ran the wrong way: the cheapest route
 * to a clean register report was to DELETE the sentence that made the card honest. That is the
 * one incentive this entire apparatus must never create.
 *
 * THE RULE THAT REPLACES IT. A card's DEPENDENCIES are structural facts it already carries —
 * `match.dealBookId`, `match.fieldId`, `manifest.fieldVersion`, `manifest.partition`. Its
 * disclaimer is authorial text. Reading the second to infer the first is the error. Contamination
 * matchers key on the first. Disclosure is REPORTED (`contaminationDisclosure`), never MATCHED.
 *
 * AND UNKNOWN PROVENANCE MATCHES. `cardPopulation` returns `unknown` when nothing in a card's
 * identity names a population, and `unknown` is treated as live-facing and NOT as exempt. A
 * matcher that let an unnamed provenance through would rebuild the same escape hatch out of
 * omission instead of out of wording.
 */

/**
 * The card fields that name what a result DEPENDS ON. Identity only — never `estimand` or
 * `treatment`, which are the author's account of the work rather than the work's inputs.
 *
 * Never `metrics` either: a matcher that swept metric VALUES would fire on the number rather
 * than on the claim, and the same figure means different things on two different instruments.
 * (Matchers that key on metric KEY NAMES are a separate, legitimate structural basis — a card
 * reporting `n` without `ess` is asserting a precision it has not shown it has.)
 */
const provenance = (card) => [
  card?.match?.dealBookId,
  card?.match?.fieldId,
  card?.manifest?.fieldVersion,
  card?.manifest?.partition,
].filter(Boolean).join(' ').toLowerCase();

/**
 * The card's own text, flattened, for the matchers whose fault genuinely lives in the
 * instrument DECLARATION rather than in the data — see `proseMatchers` for the standing
 * warning that attaches to every one of them.
 */
const haystack = (card) => [
  card?.match?.surfaceId,
  card?.match?.dealBookId,
  card?.match?.fieldId,
  card?.estimand,
  card?.treatment,
  card?.manifest?.partition,
  card?.manifest?.fieldVersion,
].filter(Boolean).join(' ').toLowerCase();

/**
 * How a Deal Book / Field identity resolves to a POPULATION, declared rather than inferred.
 *
 * Ordered: the first pattern that hits wins, and `live` is tested first so a live Deal Book
 * cannot be captured by a venue token that happens to appear beside it.
 *
 * These are SRC ids and the naming conventions the repo's Deal Books actually use
 * (`handhq-allsites-50NLH-<hash>`, `field:handhq-50nlh-2009`). Adding a source means adding a
 * row here, which is a hashed change to what the register can see — see `matchesOn`.
 */
export const POPULATION_ANCHORS = Object.freeze([
  { venue: 'live', pattern: /\bsrc-014\b|(^|[^a-z0-9])live[-:]/ },
  {
    venue: 'online',
    pattern: /handhq|\bsrc-0(05|11|12)\b|mass data field|\bmdf\b|ignition|pokerstars|\bftp\b|\b2009\b/,
  },
  { venue: 'synthetic', pattern: /\bsrc-013\b|generated|synthetic|simulat|responsive-sim|\bsim-/ },
]);

/**
 * The population a card's RESULT STANDS ON: `live` | `online` | `synthetic` | `unknown`.
 *
 * `unknown` is a real answer and is deliberately not benign — see the block comment above.
 */
export const cardPopulation = (card) => {
  const p = provenance(card);
  if (!p) return 'unknown';
  for (const { venue, pattern } of POPULATION_ANCHORS) {
    if (pattern.test(p)) return venue;
  }
  return 'unknown';
};

/**
 * True when what the card STANDS ON is the online corpus.
 *
 * Structural: read off the Deal Book and Field identity, not off whether the author mentioned
 * the corpus in a sentence.
 */
const onOnlineCorpus = (card) => cardPopulation(card) === 'online';

/**
 * True when the card's conclusion will be read at the founder's LIVE table.
 *
 * WHY THE DEFAULT IS TRUE. This repo exists to advise a live 9-handed 1/2-1/3 game — that is
 * the first line of its CLAUDE.md and the whole content of the rank-1 register entry. So a
 * result is transferred to live play unless it was MEASURED on live play. Being measured on a
 * live population is the only thing that makes a card not live-facing, and it is a structural
 * fact about the Deal Book rather than a claim in the prose.
 *
 * Note what this does NOT do: it does not let a card buy exemption by declaring itself
 * online-only in words. An exemption purchasable with a sentence is the same defect as a match
 * triggerable by one, pointed the other way.
 */
const isLiveFacing = (card) => cardPopulation(card) !== 'live';

const metricKeys = (card) => Object.keys(card?.metrics ?? {});

/**
 * The card field paths an entry may name in `matchesOn`.
 *
 * A CLOSED SET, so a typo cannot pass for a declaration. The two prose fields are legal — some
 * faults genuinely live in the instrument declaration and there is no structural field carrying
 * it — but naming one marks the entry a prose matcher, which `proseMatchers` counts.
 */
export const MATCHABLE_CARD_FIELDS = Object.freeze([
  'match.surfaceId',
  'match.dealBookId',
  'match.fieldId',
  'manifest.partition',
  'manifest.fieldVersion',
  'manifest.constants',
  'manifest.unseededSources',
  'metrics.keys',
  'metrics.values',
  'estimand',
  'treatment',
]);

/** The card fields that are the AUTHOR'S ACCOUNT rather than the result's inputs. */
export const PROSE_CARD_FIELDS = Object.freeze(['estimand', 'treatment']);

// ══════════════════════════════════════════════════════════════════════════════════════
// THE OPENING REGISTER
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * Drawn from faults OBSERVABLE IN THE REPO TODAY, not invented.
 *
 * Two entries already have evidence: `foldTo3Bet`'s stat-definition mismatch is CONFIRMED and
 * living in a served prior, and the hand-clustering fault is partially closed by a guard that
 * exists. Everything else is `untested`, which is the honest default and the reason each entry
 * carries a falsifier: the register is a work queue, and an entry nobody can settle is not work.
 */
export const SUSPECTED_FAULTS = Object.freeze([
  buildFaultEntry({
    faultId: 'FAULT-population-mismatch',
    title: 'Population mismatch — live claims anchored on an online corpus',
    site: 'corpus',
    mechanism:
      "The founder's real game is LIVE 9-handed 1/2-1/3. The corpus is ONLINE 6-max and "
      + 'full-ring. The repo\'s own founder-ratified rule is that live and online are DISTINCT '
      + 'populations that are never merged. So every live-facing claim anchored on this corpus '
      + 'is TRANSFERRED, not measured, and nothing in the number says so.',
    contaminates: 'Any live-facing recommendation validated on the Mass Data Field.',
    // WS-369. `contaminates` is a statement about what a card DEPENDS ON, and this is now the
    // machine form of that sentence rather than of "any card that mentions live play". Both
    // halves read the Deal Book and Field identity: the card stands on the online corpus, and
    // it was not measured on the live population it will be read against.
    matches: (card) => isLiveFacing(card) && onOnlineCorpus(card),
    matchesOn: ['match.dealBookId', 'match.fieldId', 'manifest.fieldVersion', 'manifest.partition'],
    // Reported, never matched. See `contaminationDisclosure`.
    disclosureCue: /transferred, not measured|\btransferred\b.*\blive\b|\blive\b.*\btransferred\b/,
    falsifier:
      'Measure the same estimand on SRC-014 (live 1/3) and on SRC-012. If the two agree within '
      + 'their intervals on a shared spot set, transfer is supported for that spot class; if '
      + 'they diverge, every transferred claim of that shape is wrong by the measured gap.',
    probability: 0.95,
    probabilityBasis:
      'Near-certain as a STRUCTURAL fact — the populations genuinely differ. What is uncertain '
      + 'is the magnitude, not the existence.',
    priorBreadth: 0.9,
    // WS-352 ran this falsifier on 2026-08-05. It is UNRUNNABLE, and stays `untested` for that
    // reason rather than being settled by a substitute. All three blockers were about the LIVE
    // arm; the SRC-012 arm is measurable today (scripts/backtest reads 1,756 HandHQ files). A
    // two-arm comparison with one unavailable arm has no reduced form — the gap between the
    // populations is the entire estimand, so there is no partial credit to bank here.
    //
    // Accept criterion 7 of WS-368 (commit 3befa26d) cleared the FIRST of the three. TWO REMAIN, so the
    // entry is still blocked, still `untested`, and still may not be confirmed or retired. The
    // cleared one is preserved in `clearedBlockers` below with what it did and did not cover.
    falsifierBlockers: [
      'SRC-014 IS UNREACHABLE BY THE HARNESS. It is browser IndexedDB on the founder\'s device '
      + 'with no export path in the repo; SRC-012 is scored by node scripts over an on-disk '
      + 'corpus root. No harness can currently read both arms, so "the same estimand on both" '
      + 'has no execution path regardless of identity. UNBLOCKED BY: an export of live hands '
      + 'into a Deal Book the existing harness can score.',
      'NO VOLUME FLOOR IS STATED. The falsifier turns on whether two intervals overlap, and '
      + 'SRC-014 is the smallest source by orders of magnitude — so a null result would be '
      + 'unreadable, indistinguishable between "transfer holds" and "the live arm had no power". '
      + 'UNBLOCKED BY: stating the minimum live n PER SPOT CLASS at which the comparison could '
      + 'resolve, before any live data is collected against it.',
    ],
    clearedBlockers: [
      {
        blocker:
          'SRC-014 HAS NO POSITIVE IDENTITY. Live hands are distinguished only by `source` being '
          + "UNDEFINED — `saveOnlineHand` stamps source:'ignition' (handsStorage.js:444) and the "
          + 'manual path stamps nothing. So the live subset cannot be SELECTED, and an un-stamped '
          + 'import is indistinguishable from a live hand. Already an open finding in '
          + 'docs/provenance/data-source-registry.md. UNBLOCKED BY: a positive source stamp on live '
          + 'capture carrying venue and stake.',
        clearedBy: [
          'commit 3befa26d (WS-368) — src/utils/persistence/handProvenance.js defines a CLOSED set '
          + "{live, ignition, import, unknown}. Every write path stamps at construction: saveHand "
          + 'reads venue and stake off the active session, saveOnlineHand off the online session, '
          + 'and a new saveImportedHand closes the import vector that exportUtils previously routed '
          + 'through saveHand unstamped. The stamp is spread AFTER ...handData in the record '
          + 'literal, so a payload claiming source:"live" cannot survive any writer, and '
          + 'validateHandRecord rejects an unstamped record. `getHandsBySource("live")` is therefore '
          + 'a real selector: the exact capability this blocker said did not exist.',
          'commit 3befa26d — IndexedDB migration v28 stamps every pre-existing unstamped row '
          + "`unknown` with reason recorded-before-provenance-stamping, NEVER `live`, preserving "
          + 'the pre-migration value under observedSource. That is what makes the selector '
          + 'trustworthy rather than merely present: no row acquires a live identity it did not earn.',
          'Verified at HEAD 2026-08-05: 265 tests in persistence/__tests__/handProvenance.test.js '
          + 'and 228 in migrationV28.test.js, the latter seeding a v27 database and asserting '
          + '`unknown` explicitly-not-`live` and that getHandsBySource("live") stays empty for them.',
        ],
        at: '2026-08-05',
        note:
          'CLEARS IDENTITY AND NOTHING ELSE. The other two blockers on this entry are untouched '
          + 'and still hold: there is no export path from browser IndexedDB reachable by the node '
          + 'harness that scores SRC-012, and no volume floor has been stated, so a null would '
          + 'still be unreadable between "transfer holds" and "no power". The entry stays BLOCKED '
          + 'and stays `untested`. '
          + 'AND THE MECHANISM IS NOT THE DATA. Because v28 stamps existing rows `unknown` rather '
          + 'than guessing, the selectable live set starts EMPTY and grows only from hands played '
          + 'after 2026-08-05. "The live subset can now be selected" is true; "there is a live arm '
          + 'to measure" is not yet true, and this clearance does not assert it. '
          + 'Session-level provenance is deliberately still absent (see sessionsFilter.js) — '
          + 'sessions already state venue, gameType and stakes positively, so nothing measurable '
          + 'turns on it.',
      },
    ],
  }),

  buildFaultEntry({
    faultId: 'FAULT-leakage-unclosed-channel',
    title: 'Corpus-mined priors leaking into corpus backtests through an unclosed channel',
    site: 'process',
    mechanism:
      'Priors mined from the corpus and then evaluated on the corpus leak BY CONSTRUCTION '
      + 'unless structurally prevented. The leakage guard closes three named channels. A '
      + 'fourth is always possible, and a leak inflates every result in the same direction, so '
      + 'nothing looks anomalous.',
    contaminates:
      'Every backtested figure at once. This is the entry with the widest blast radius and the '
      + 'lowest probability — which is exactly why ranking by probability alone would bury it.',
    // A card with no POOL/EVAL stamp cannot demonstrate it avoided the leak. `partition: null`
    // is legal (a field with no fitted component) but it is also the state in which leakage
    // would be undetectable, so it is the honest trigger.
    matches: (card) => !card?.manifest?.partition,
    matchesOn: ['manifest.partition'],
    falsifier:
      'Re-fit every prior on POOL only, re-run on EVAL only, and compare against the current '
      + 'figures. A gap beyond Monte Carlo noise localizes an open channel; agreement retires '
      + 'the entry for the channels exercised by that run, and no others.',
    probability: 0.15,
    probabilityBasis:
      'Low: three channels are closed and enforced. Not zero: the guard enumerates channels, '
      + 'and an enumeration cannot prove it is complete.',
    priorBreadth: 1.0,
  }),

  buildFaultEntry({
    faultId: 'FAULT-model-opponent-bias',
    title: 'Model-opponent bias — the simulator\'s opponents are our model of people',
    site: 'instrument',
    mechanism:
      'Instrument II scores a strategy against simulated opponents. Those opponents ARE the '
      + 'population model. Any fault in the model therefore becomes an INVISIBLE fault in every '
      + 'EV number the simulator emits — the instrument cannot detect an error it is built on.',
    contaminates: 'Every simulator-derived EV figure, including agreement checks that use one.',
    // WS-369: narrowed from the prose haystack to the Field identity. Whether the opponents were
    // simulated is a property of the FIELD the card was scored against, which the card names
    // structurally — not of whether the author used the word "simulated" in a sentence.
    matches: (card) => /simulat|synthetic|modelled field|model-opponent/.test(provenance(card)),
    matchesOn: ['match.dealBookId', 'match.fieldId', 'manifest.fieldVersion', 'manifest.partition'],
    falsifier:
      'The WS-326 agreement gate: run the same estimand on Instrument I (corpus substitution, '
      + 'real opponents) and Instrument II. Divergence beyond their joint interval bounds the '
      + 'bias; agreement bounds it below that width and no tighter.',
    probability: 0.7,
    probabilityBasis:
      'The population model is known to be imperfect (this register lists several of its '
      + 'faults). The open question is how much of it survives into simulator EV.',
    priorBreadth: 0.4,
  }),

  buildFaultEntry({
    faultId: 'FAULT-self-grading-circularity',
    title: 'Self-grading circularity — the engine graded by its own arithmetic',
    site: 'instrument',
    mechanism:
      'The engine picks argmax-EV under its own villain model. Grading that choice with the '
      + 'same arithmetic is very nearly marking its own homework: a model that is wrong in a '
      + 'consistent direction will score its own advice highly precisely BECAUSE it is wrong. '
      + 'Realized chips are the only external anchor, and they are noisy.',
    contaminates: 'Any result whose metric is model EV rather than a realized outcome.',
    // WS-369: the escape clause used to read the PROSE haystack, so a card could buy exemption
    // by using the word "realized" in its treatment while reporting nothing but model EV. What
    // the card measured is in its METRIC KEYS; that is the only thing consulted now.
    matches: (card) => {
      const keys = metricKeys(card).join(' ').toLowerCase();
      const reportsRealized = /realiz|chips|showdown|observed/.test(keys);
      return /ev|edge/.test(keys) && !reportsRealized;
    },
    matchesOn: ['metrics.keys'],
    falsifier:
      'Score the same decisions against REALIZED chips and against model EV. A systematic gap '
      + "in the engine's favour is the optimizer's curse made visible (WS-295); no gap beyond "
      + 'noise retires the entry at that sample size, and states the size.',
    probability: 0.8,
    probabilityBasis:
      "The mechanism is structural rather than hypothesized — argmax under a model is biased "
      + 'upward under that model whenever the model has error. Magnitude unmeasured.',
    priorBreadth: 0.6,
  }),

  buildFaultEntry({
    faultId: 'FAULT-horizon-bias',
    title: 'Horizon bias — a one-decision edge read as a winrate',
    site: 'instrument',
    mechanism:
      'Instrument I substitutes ONE decision into an otherwise-recorded hand. It does not '
      + 'measure the value of playing a whole strategy. `ipsEstimator` states this, and the '
      + 'statement is easily lost downstream — at which point a per-decision edge gets read as '
      + 'bb/100 and overstates the result by roughly the decisions-per-hand factor.',
    contaminates: 'Any figure quoted as a winrate that was produced by per-decision substitution.',
    // WS-369: PROSE MATCHER, and knowingly so — see `proseMatchers`. The horizon is a property
    // of the instrument, declared in `treatment` (from `ipsEstimator.TREATMENT`, a module
    // constant rather than free text) and carried by no structural field. Note that this entry's
    // own mechanism says the fault FIRES where a downstream reader DROPS the treatment string —
    // exactly the card this matcher cannot see. Making it structural needs a horizon field on
    // the card, which is a schema change and not this ticket.
    matches: (card) => /one-decision|per-decision/.test(haystack(card)),
    matchesOn: ['treatment', 'estimand', 'match.surfaceId'],
    falsifier:
      'Run a whole-strategy arm — every hero decision in the hand supplied by the surface — on '
      + 'the same Deal Book, and compare against the per-decision figure scaled by observed '
      + 'decisions per hand. The gap is the bias.',
    probability: 0.6,
    probabilityBasis:
      'The instrument is correctly labelled at source, so this is a TRANSMISSION fault: it '
      + 'fires only where a downstream reader drops the treatment string.',
    priorBreadth: 0.7,
  }),

  buildFaultEntry({
    faultId: 'FAULT-modelled-rake',
    title: 'Modelled rake — the corpus records none, so every figure assumes a schedule',
    site: 'instrument',
    mechanism:
      'The corpus contains no rake. Every EV figure therefore carries an ASSUMED schedule, and '
      + 'the assumption does not transfer: measured on the same spot, live 1/2 (10%, $8 cap) '
      + 'needs +4.8pp of extra defending equity where the 2009 online corpus (5%, $3 cap) needs '
      + '+2.3pp. A rake-driven conclusion measured online understates the live effect by about '
      + 'half.',
    contaminates: 'Every bb-denominated EV figure, and marginal calls most of all.',
    matches: (card) => metricKeys(card).some((k) => /bb|ev|edge/i.test(k)),
    matchesOn: ['metrics.keys'],
    falsifier:
      'Sweep the rake schedule across the live and online configurations and report the '
      + 'conclusion under each. A conclusion that survives both is rake-robust and can be '
      + 'quoted without the schedule; one that flips must state which pool it was measured on.',
    probability: 0.9,
    probabilityBasis:
      'The assumption is certain to be present. Whether it changes a given conclusion is the '
      + 'open part, and WS-333 already measured one spot where it does.',
    priorBreadth: 0.8,
  }),

  buildFaultEntry({
    faultId: 'FAULT-untaxed-fold-branch',
    title: 'The fold branch of every postflop EV paid an unraked pot — the gate was read as the showdown, not the flop',
    site: 'ev',
    mechanism:
      'POKER_THEORY §11.3 stated that rake "never affects fold-equity from villain folding (no '
      + 'showdown, no drop)". That renamed a real rule: the live rule is NO FLOP, NO DROP — the '
      + 'house drops once a flop is dealt, however the hand ends, so a bet that takes the pot '
      + 'down uncontested IS raked. Nine postflop fold branches across four modules therefore '
      + 'paid out an untaxed pot while their call/raise siblings were correctly raked. This is '
      + 'NOT the same fault as `FAULT-modelled-rake` (which schedule) or '
      + '`FAULT-rake-inert-on-live-path` (rake absent on the live surface): it fired even where '
      + 'a rake config WAS supplied, which includes the corpus instrument '
      + '(heroEvRunner.DEFAULT_RAKE_CONFIG = 5% to $3). So it contaminates MEASURED figures, not '
      + 'only transferred ones. Direction is sign-consistent: it understates the §6.3 '
      + 'auto-profit threshold, i.e. inflates fold equity, which makes the engine reckless '
      + 'rather than timid (§13.3).',
    contaminates:
      'Every postflop bb-denominated EV figure for an action carrying a fold branch — bet, '
      + 'raise and check-raise — and therefore every aggression-frequency and top-action claim '
      + 'derived from one.',
    // Structural matcher: any card whose metrics carry an EV/bb quantity stands on this
    // arithmetic. Deliberately NOT gated on population — unlike the two rake entries above,
    // this one fires on the online corpus too, which is the whole reason it is separate.
    matches: (card) => metricKeys(card).some((k) => /bb|ev|edge/i.test(k)),
    matchesOn: ['metrics.keys'],
    falsifier:
      'Price the same decision set with the fold branch taxed and untaxed, paired, same seeds. '
      + 'If the aggression mix and the top-action argmax are unchanged, the omission was inert '
      + 'and the entry retires. Run and RECORDED POSITIVE 2026-08-15 — see `evidence`.',
    probability: 1.0,
    probabilityBasis:
      'CONFIRMED as a code fact at nine sites, and confirmed as a rule by the founder from '
      + 'direct play plus an independent external check. Fixed by WS-451; the entry exists to '
      + 'flag the cards computed BEFORE the fix, which is the WS-291 failure this register was '
      + 'built for.',
    priorBreadth: 0.55,
    status: 'confirmed',
    evidence: [
      'Founder, direct observation 2026-08-14: "folded pots postflop are raked"; and "there is '
      + 'no rake preflop in almost all games that I play in" (the noFlopNoDrop half).',
      'Independent external check 2026-08-14 (PokerCoaching, PokerNews, Pokercode, 2+2 '
      + 'cardroom forum): the waiver trigger is the flop being dealt, not the showdown.',
      'Nine code sites enumerated in .claude/workstream/findings/FIND-137.yaml and fixed under '
      + 'WS-451; potCalculator.rakedShowdownPot renamed to rakedPot because the word "showdown" '
      + 'in the name WAS the error.',
      'Magnitude, unit-pinned in rakePerBranch.test.js at the founder\'s 1/3 structure (10% to '
      + '$6 plus $2 drop): the §6.3 threshold moves 40.0%→44.4% ($20 into $30), 40.0%→43.5% '
      + '($40 into $60), 39.9%→40.9% ($133 into $200) — largest where the flat drop dominates.',
      'Production divergence probe (scripts/backtest/probeFoldBranchRake.mjs, depth-1, 8 flop spots, '
      + 'live 1/3 config): aggressive candidates lost 2.30–9.08 bb where the check lost only '
      + '0.77–1.94; bet-minus-check edge narrowed on 8 of 8 spots and flipped bet→check on 1. '
      + 'Both directions were pre-registered before the run.',
      'The full suite (664 files, 15,321 tests) passed BEFORE the fix and after — no existing '
      + 'test pinned a fold branch against a rake config, which is how this survived a six-lens '
      + 'eng-engine challenge that ruled the rake arithmetic "right twice over".',
    ],
  }),

  buildFaultEntry({
    faultId: 'FAULT-rake-inert-on-live-path',
    title: 'Rake is inert on the live app path — estimateRake returns 0 on every live decision',
    site: 'instrument',
    mechanism:
      '`liveHandState.rakeConfig` is READ (`useLiveActionAdvisor.js:162`) and never written, '
      + 'and `GAME_TYPES[ONE_TWO].rake` is never mapped into an engine config. So the corpus '
      + 'instrument applies rake and the live advisor does not — the two disagree silently, and '
      + 'the disagreement runs the wrong way: the surface giving advice at a real table is the '
      + 'one ignoring the rake that table charges.',
    contaminates:
      'Any comparison between a corpus-measured figure and live advisor behaviour, and every '
      + 'marginal live recommendation.',
    // WS-369: the same repair as the rank-1 entry, and it is the second consumer of
    // `isLiveFacing` — a card is exposed to a rake-inert live advisor unless it was measured on
    // the live population itself.
    matches: (card) => isLiveFacing(card),
    matchesOn: ['match.dealBookId', 'match.fieldId', 'manifest.fieldVersion', 'manifest.partition'],
    falsifier:
      'Assert `estimateRake` returns non-zero on a live 1/2 decision through the advisor path. '
      + 'It returns 0 today; when it does not, the entry retires with that test as evidence.',
    probability: 1.0,
    probabilityBasis:
      'CONFIRMED as a code fact and documented in VOCABULARY.md under WS-333, where it was '
      + 'filed rather than fixed. Only its consequence for any given claim is open.',
    priorBreadth: 0.25,
    status: 'partially-supported',
    evidence: [
      'docs/standard-of-record/VOCABULARY.md — "rake is inert on the live app path", WS-333',
      'src/hooks/useLiveActionAdvisor.js:162 reads liveHandState.rakeConfig; no writer exists',
    ],
  }),

  buildFaultEntry({
    faultId: 'FAULT-stat-definition-mismatch',
    title: 'foldTo3Bet counts folds facing ANY preflop raise, while its name says otherwise',
    site: 'foldProbability',
    mechanism:
      'The WS-236/WS-254 quirk: the stat named `foldTo3Bet` is computed over folds facing any '
      + 'preflop raise, not folds facing a 3-bet. Anything consuming it as a 3-bet-specific '
      + 'number is reading a different quantity than it believes, and the number is plausible '
      + 'enough that nothing downstream notices.',
    contaminates: 'Any surface or prior consuming foldTo3Bet, and every fold-probability layer built on one.',
    // WS-369: PROSE MATCHER. Which stats a surface consumes is not on the card — only the
    // surface id is, and it is not resolvable to a stack from here. Declared rather than hidden.
    matches: (card) => /foldto3bet|fold-to-3bet|preflop prior|3bet/.test(haystack(card)),
    matchesOn: ['estimand', 'treatment', 'match.surfaceId', 'match.fieldId'],
    falsifier:
      'Recompute the stat restricted to folds facing an actual 3-bet and compare against the '
      + 'served value. Already known to differ; the measurement fixes the magnitude and tells '
      + 'every consumer how far off it was.',
    probability: 1.0,
    probabilityBasis: 'CONFIRMED. Not a suspicion — a known semantic mismatch living in a served prior.',
    priorBreadth: 0.3,
    status: 'confirmed',
    evidence: [
      'WS-236 / WS-254 — the counting rule was traced to the definition site and the name kept',
      'WS-325 carries this as the worked example for the Mass Data Field stack audit',
    ],
  }),

  buildFaultEntry({
    faultId: 'FAULT-static-field-overstatement',
    title: 'A Field that never adapts inflates every aggressive strategy',
    site: 'instrument',
    mechanism:
      'A static Field plays the same way no matter how hero plays. A strategy that bluffs more, '
      + 'barrels more, or steals more therefore never gets punished for being predictable, and '
      + 'its measured edge is an upper bound rather than an estimate.',
    contaminates: 'Every result for an aggressive surface, and the Pool Best Response ceiling most of all.',
    // WS-369: the "responsive" escape now has to be in the FIELD's identity, where a responsive
    // Field would actually be named, rather than anywhere in the card's prose.
    matches: (card) => Boolean(card?.match?.fieldId) && !/responsive|adaptive/.test(provenance(card)),
    matchesOn: ['match.fieldId', 'manifest.fieldVersion', 'match.dealBookId', 'manifest.partition'],
    falsifier:
      'Run the same surface against a responsive Field (WS-326) and against the static one. The '
      + 'drop is the overstatement, and it should be largest for the most aggressive surfaces — '
      + 'a flat result across aggression levels would refute the mechanism rather than the size.',
    probability: 0.85,
    probabilityBasis:
      'Structural: a non-adapting opponent cannot counter-adjust. Certain in direction, '
      + 'unmeasured in size.',
    priorBreadth: 0.7,
  }),

  buildFaultEntry({
    faultId: 'FAULT-masked-hole-cards',
    title: 'Range-marginalized advice — the value of advice averaged over hands hero could hold',
    site: 'range',
    mechanism:
      'Hero\'s actual holding is not always known to the surface, so advice is marginalized over '
      + 'the range. The result is the value of the ADVICE averaged over hands hero COULD hold, '
      + 'not the value of the play hero MADE with the hand hero HELD.',
    contaminates: 'Every figure from a range-marginalized policy — a weaker claim than a cards-known instrument.',
    // WS-369: PROSE MATCHER. Whether hole cards were known is a property of the instrument with
    // no structural field on the card. Same escape-by-omission as the horizon entry.
    matches: (card) => /range-marginalized|marginalized/.test(haystack(card)),
    matchesOn: ['treatment', 'estimand'],
    falsifier:
      'On the showdown subset where hole cards ARE revealed, compute both the marginalized and '
      + 'the cards-known figure. The gap bounds the weakening — on a selected subset, which is '
      + 'itself a limitation this register lists separately.',
    probability: 0.99,
    probabilityBasis:
      'Certain — it is a property of the instrument, not a defect in it. Listed because it is '
      + 'the difference between what the number says and what a reader will assume it says.',
    priorBreadth: 0.5,
  }),

  buildFaultEntry({
    faultId: 'FAULT-temporal-staleness',
    title: 'July 2009 — sixteen years of population drift',
    site: 'corpus',
    mechanism:
      'The corpus is sixteen years old. Population tendencies have moved. Weak pseudocounts '
      + 'limit how far a stale prior can pull a posterior, but that is a MITIGATION, not a '
      + 'control: it bounds the damage without measuring it.',
    contaminates: 'Every prior mined from the corpus, and every claim that leans on one.',
    // WS-369: structural now, via the shared `cardPopulation` resolution — a card is stale
    // because of the Deal Book it stands on, not because it said "2009" somewhere.
    matches: onOnlineCorpus,
    matchesOn: ['match.dealBookId', 'match.fieldId', 'manifest.fieldVersion', 'manifest.partition'],
    falsifier:
      'Fit the same priors on SRC-005 (Ignition, current) and compare against the 2009 values '
      + 'cell by cell. The per-cell gap is the drift; cells that agree are stable and can be '
      + 'quoted without the era caveat.',
    probability: 0.9,
    probabilityBasis:
      'Drift over sixteen years is near-certain in direction. Which cells moved, and by how '
      + 'much, is entirely unmeasured.',
    priorBreadth: 0.85,
    // WS-353 ran this falsifier on 2026-08-05. It is UNRUNNABLE, and stays `untested` for that
    // reason rather than being settled by a substitute. The 2009 arm is in hand — it IS
    // `HANDHQ_REFERENCE_STAKES`, already mined. Every blocker is on the SRC-005 arm, and the
    // third one is the interesting one: it is the only blocker in this register that a
    // measurement has partially addressed (`WITHIN_CORPUS_DRIFT_2009`), and the measurement
    // narrowed it without clearing it, because the horizon it fixes is nineteen days.
    falsifierBlockers: [
      'SRC-005 HAS NO ARTEFACT ANY HARNESS CAN READ. Two export paths exist and neither yields '
      + 'the hands the falsifier needs. The extension popup export '
      + '(ignition-poker-tracker/popup/popup.js:160) dumps the volatile CAPTURE BUFFER, not the '
      + 'persisted store, and the only artefact it has ever produced on this machine '
      + '(~/Downloads/ignition-hands-1781851220916.json, 2026-06-19) contains ZERO hands. The '
      + 'app path, exportAllData / downloadBackup (src/utils/exportUtils.js:32,83), is a '
      + 'founder-driven browser download with no on-disk instance, and there is no node-side '
      + 'adapter from an app hand record to a mined (k,n) cell — the 2009 cells came from '
      + 'phh_miner.py over PHH files while the app counts through buildPlayerStats / '
      + 'STAT_COUNT_FIELDS in the browser. UNBLOCKED BY: a committed SRC-005 export-to-Deal-Book '
      + 'adapter emitting the six (k,n) pairs per stake x seat bucket through the SAME stat '
      + 'definitions the 2009 mine used, so "the same priors" is a checked claim rather than a '
      + 'second implementation of six definitions.',
      '"CELL BY CELL" PRESUPPOSES AN INDEX BOTH ARMS SHARE, AND THEY DO NOT. The 2009 values are '
      + '7 stakes (25NL-1000NL) x {6max, full} x 6 stats pooled over SIX networks. SRC-005 is ONE '
      + 'network at the founder\'s stake, which the provenance registry records as 0.02/0.05 — '
      + 'BELOW the mined 25NL floor, with the gap noted there explicitly. Nearest-stake '
      + 'resolution would therefore put a STAKE step inside every per-cell gap alongside the era '
      + 'step, with SITE confounded on top of both, and none of the three can be separated from '
      + 'one site at one stake. UNBLOCKED BY: reading off the SRC-005 export which stake x '
      + 'seat-bucket cells actually carry hands, restricting the comparison to cells populated on '
      + 'BOTH arms, and stating in advance that site remains confounded because it cannot be '
      + 'broken by this design.',
      'NO PER-CELL GAP IS READABLE WITHOUT A NULL, AND THE ONLY NULL THIS CORPUS SUPPLIES IS '
      + 'NINETEEN DAYS LONG. WS-353 measured the corpus\'s own within-span drift — see '
      + 'WITHIN_CORPUS_DRIFT_2009: same population, same stake, 24 cells, median fitted drift '
      + '0.40pp and max 2.58pp over 18-19 days, daily rates 4.35x (median) to 36x overdispersed '
      + 'against binomial, weekday/weekend gap up to 0.95pp. So a cross-era gap under roughly one '
      + 'point is inside what this population does with NO era change at all. That fixes the '
      + 'floor at NINETEEN DAYS and at 50NL; the floor at sixteen years is unknown and cannot be '
      + 'obtained from a corpus spanning three weeks, and the nineteen-day slope must not be '
      + 'extrapolated to get it. Also unstated: the minimum SRC-005 n per cell at which a null '
      + 'would be readable. UNBLOCKED BY: stating BEFORE any SRC-005 comparison both the minimum '
      + 'per-cell gap that counts as drift and the minimum SRC-005 per-cell n at which "no gap" '
      + 'means anything.',
    ],
  }),

  buildFaultEntry({
    faultId: 'FAULT-precision-overstatement',
    title: 'ESS, not n, is the honest denominator',
    site: 'statistics',
    mechanism:
      'Importance weighting means the effective sample size can be far below the raw count. '
      + '10,000 decisions at ESS 40 is a 40-decision result wearing a large n. Weight clipping '
      + 'props the figure up, and it does so visibly ONLY IF the clipped share is reported.',
    contaminates: 'Every interval, every gate that reads a sample size, and every "well-sampled" claim.',
    // Structural, not textual: a card that reports n without ESS is asserting a precision it
    // has not shown it has.
    matches: (card) => {
      const keys = metricKeys(card).map((k) => k.toLowerCase());
      const hasN = keys.some((k) => k === 'n' || /count|decisions/.test(k));
      const hasEss = keys.some((k) => /ess|effective/.test(k));
      return hasN && !hasEss;
    },
    matchesOn: ['metrics.keys'],
    falsifier:
      'Report ESS and the clipped weight share alongside n on every card. Where ESS/n is near '
      + '1 the entry retires for that result; where it is small the interval was always wrong '
      + 'and by a computable factor.',
    probability: 0.75,
    probabilityBasis:
      'The mechanism is certain wherever weighting is used. Whether any published figure is '
      + 'actually affected depends on the realized weight distribution, which is unreported.',
    priorBreadth: 0.6,
  }),

  buildFaultEntry({
    faultId: 'FAULT-showdown-selection',
    title: 'Showdown-conditional quantities are a selected set',
    site: 'statistics',
    mechanism:
      'Hands reaching showdown are not a random sample of hands. Any hand-conditional quantity '
      + 'derived from shown cards is conditioned on reaching showdown, and P(x | showdown) is '
      + 'never a population rate — the selection runs hardest against exactly the strong and '
      + 'weak tails a range model cares about.',
    contaminates: 'Any rate estimated from revealed holdings, including range-model ground truth.',
    // WS-369: PROSE MATCHER. Showdown-conditioning is a property of the estimand and nothing
    // structural records it.
    matches: (card) => /showdown|revealed|holding/.test(haystack(card)),
    matchesOn: ['estimand', 'treatment'],
    falsifier:
      'Compare a rate estimated on the showdown subset against the same rate estimated with a '
      + 'selection correction over all hands. The gap is the selection effect; agreement '
      + 'retires the entry for that quantity only.',
    probability: 0.85,
    probabilityBasis:
      'Selection is structurally certain. Its size depends on the quantity, and is unmeasured '
      + 'for every quantity the repo currently derives this way.',
    priorBreadth: 0.35,
  }),

  buildFaultEntry({
    faultId: 'FAULT-constants-by-taste',
    title: 'Any unswept constant is a suspected fault by default',
    site: 'process',
    mechanism:
      'The repo has TWICE had to undo a constant picked by reading a table rather than sweeping '
      + 'it. A load-bearing constant whose sensitivity was never measured is not known to be '
      + 'right; it is known to be unobjected-to, which is a different thing.',
    contaminates: 'Any result whose conclusion depends on a constant that was never swept.',
    matches: (card) => Object.keys(card?.manifest?.constants ?? {}).length > 0,
    matchesOn: ['manifest.constants'],
    falsifier:
      'Sweep each stamped constant across a plausible range and record the margin at which the '
      + "conclusion flips — which is exactly what the Result Card's `fragility` field holds. A "
      + 'conclusion that survives the sweep is robust; one that does not was always knife-edge.',
    probability: 0.7,
    probabilityBasis:
      'Two confirmed historical instances, and no sweep exists for most current constants. The '
      + 'base rate in this repo is not low.',
    priorBreadth: 0.5,
  }),

  buildFaultEntry({
    faultId: 'FAULT-degenerate-signal',
    title: 'A metric that cannot fail is not evidence',
    site: 'instrument',
    mechanism:
      '`holdingKnowledge.covered` is ALWAYS TRUE on the engine as it ships, so it discriminates '
      + 'nothing while looking like a passing check. This class of always-passing signal should '
      + 'be actively hunted, because a green tick that cannot go red is worse than no tick — it '
      + 'consumes the attention a real check would have got.',
    contaminates: 'Any conclusion resting on a check that could not have failed.',
    // Structural and genuinely discriminating: scan the card's own metrics for a value that
    // cannot vary — a rate pinned at exactly 1 or 0, or a boolean pass.
    matches: (card) => Object.values(card?.metrics ?? {}).some(
      (v) => v === true || v === 1 || v === 1.0 || v === 0,
    ),
    matchesOn: ['metrics.values'],
    falsifier:
      'For each check, exhibit an input on which it FAILS. A check with no such input is '
      + 'degenerate and must be removed or repaired; producing the failing input retires the '
      + 'entry for that check.',
    probability: 0.6,
    probabilityBasis:
      'One instance confirmed in the shipping engine. Whether others exist is exactly what the '
      + 'falsifier is for.',
    priorBreadth: 0.3,
  }),

  buildFaultEntry({
    faultId: 'FAULT-multiway-approximation',
    title: 'Multiway is approximated',
    site: 'equity',
    mechanism:
      'Multiway equity and fold correlation are approximated rather than computed exactly. The '
      + 'approximation is a known open gap, already ticketed, and it is listed here so that '
      + 'results touching multiway spots inherit the caveat rather than depending on the reader '
      + 'remembering the ticket.',
    contaminates: 'Any result covering three-or-more-way pots.',
    // WS-369: PROSE MATCHER. Player count per spot is not a card-level field.
    matches: (card) => /multiway|3-way|three-way|multi-way/.test(haystack(card)),
    matchesOn: ['estimand', 'treatment'],
    falsifier:
      'Compare the approximation against an exact multiway computation on a bounded spot set. '
      + 'The gap bounds the error for spots of that shape and no others.',
    probability: 0.9,
    probabilityBasis: 'Known and ticketed. Listed for inheritance, not discovery.',
    priorBreadth: 0.2,
  }),

  buildFaultEntry({
    faultId: 'FAULT-monte-carlo-irreproducibility',
    title: 'The hero-EV instrument is not bit-reproducible',
    site: 'instrument',
    mechanism:
      '`heroPolicy -> evaluateGameTree -> handVsRange` reaches `pokerCore/monteCarloEquity`, '
      + 'which calls `Math.random()` in its shuffle and its weighted draw. Two runs over the '
      + 'same Deal Book with identical seeds agree to within Monte Carlo noise, NOT exactly. A '
      + 'small difference between two Result Cards is therefore not evidence of a change.',
    contaminates: 'Any comparison between two cards whose difference is near the noise floor.',
    matches: (card) => (card?.manifest?.unseededSources ?? []).length > 0,
    matchesOn: ['manifest.unseededSources'],
    falsifier:
      'Run the same Deal Book twice with identical seeds and report the spread. That spread is '
      + 'the noise floor, below which no difference may be quoted as a change. Seeding the '
      + 'shuffle would retire the entry outright.',
    probability: 1.0,
    probabilityBasis:
      'CONFIRMED by code inspection and already declared in `HERO_EV_UNSEEDED_SOURCES`. The '
      + 'noise floor itself has never been measured, which is what keeps this open.',
    priorBreadth: 0.4,
    status: 'partially-supported',
    evidence: [
      'scripts/backtest/replicationStamp.mjs — HERO_EV_UNSEEDED_SOURCES declares the chain',
      'docs/standard-of-record/VOCABULARY.md — "Known limit, stated rather than implied"',
    ],
  }),

  buildFaultEntry({
    faultId: 'FAULT-refinement-depth-non-monotonicity',
    title: 'More refinement is not known to be better — depth is a controlled variable, not a rung',
    site: 'ev',
    mechanism:
      'The depth-2/3 refinement stages REPLACE candidate EVs with differently-computed ones, '
      + 'and nothing establishes that a larger refinement budget moves advice toward money. '
      + 'The measured evidence points the other way in places: WS-378 saw depth-2 flip the '
      + 'top action on 32 of 45 river decisions with 34 of 34 directions toward passivity, '
      + 'and DEC-036 records that at the shipped budget most stages return partial — so the '
      + 'shipped engine is a specific truncation of the tree, not an approximation ordered '
      + 'below a better one. A figure produced at one budget therefore does not bound the '
      + 'figure at any other budget, in either direction. WS-432\'s logical clock made the '
      + 'truncation DETERMINISTIC and stampable; it did not make it monotone.',
    contaminates:
      'Any result produced with refinement enabled (a nonzero REFINEMENT_BUDGET_MS in any '
      + 'arm): its figure describes exactly that budget, and reading it as a bound on a '
      + 'deeper or shallower configuration assumes a monotonicity nobody has measured.',
    // Structural: the manifest floor (WS-432) stamps REFINEMENT_BUDGET_MS on every card —
    // a scalar on single-arm runs, an object keyed by arm id on multi-arm runs, and the
    // legacy 'engine-default' sentinel when the run took the engine's own (nonzero) default.
    matches: (card) => {
      const v = card?.manifest?.constants?.REFINEMENT_BUDGET_MS;
      if (v == null) return false;
      if (v === 'engine-default') return true; // the engine's default budget is nonzero
      if (typeof v === 'number') return v !== 0;
      if (typeof v === 'object') {
        return Object.values(v).some((x) => (typeof x === 'number' ? x !== 0 : x === 'engine-default'));
      }
      return false;
    },
    matchesOn: ['manifest.constants'],
    falsifier:
      'The WS-361 one-scale comparison, run as a budget LADDER: score the same paired '
      + 'decision set through the hero-EV arm at logical budgets 0, the shipped 2000ms-'
      + 'equivalent, and effectively unbounded, all seeded. A monotone non-decreasing edge '
      + 'across the ladder (within the paired-delta intervals) retires the entry for that '
      + 'decision class; a measured inversion CONFIRMS it and bounds its size in bb. The '
      + 'logical clock is what makes this runnable at all — under the wall clock the ladder '
      + 'rungs were not stable configurations.',
    probability: 0.6,
    probabilityBasis:
      'The WS-378 river flips were real, measured, and one-directional, and the depth-2 EV '
      + 'path is explicitly unvalidated (WS-361). Against that, the river gap that produced '
      + 'the 38-of-40 pull has since been closed, so the surviving magnitude is unknown '
      + 'rather than demonstrated.',
    priorBreadth: 0.5,
  }),

  buildFaultEntry({
    faultId: 'FAULT-hand-clustering',
    title: 'Hands are not independent within a session',
    site: 'statistics',
    mechanism:
      'A variance claim whose cluster unit is the hand understates its interval, because hands '
      + 'within a session share a table, a lineup, and a hero state. The repo has already been '
      + 'bitten: an interrupted run reported a tight interval from three contributing players '
      + 'and passed a gate that decides whether the founder stops building.',
    contaminates: 'Any interval, and any gate that reads one.',
    // Deliberately checks the RESIDUAL risk, not the closed one. `CLUSTER_UNITS` excludes
    // 'hands' and `resultCardProblems` rejects it, so the card-level channel is shut — but a
    // metric computed upstream can still be hand-clustered before it ever reaches a card, and
    // the declared unit would not know.
    matches: (card) => metricKeys(card).some((k) => /ci|interval|stderr|se$|variance/i.test(k)),
    matchesOn: ['metrics.keys'],
    falsifier:
      'Recompute one published interval with a session-level cluster bootstrap and compare '
      + 'against the stored bounds. Agreement retires the residual channel for that instrument; '
      + 'a widening says every interval from it was too tight.',
    probability: 0.5,
    probabilityBasis:
      'The card-level channel is CLOSED by construction, which is why this is not higher. The '
      + 'upstream channel is open and unmeasured, which is why it is not retired.',
    priorBreadth: 0.45,
    status: 'partially-supported',
    evidence: [
      'src/utils/standardOfRecord/resultCard.js — CLUSTER_UNITS excludes "hands" and the '
      + 'validator rejects it, closing the card-level channel',
    ],
  }),
]);

// ══════════════════════════════════════════════════════════════════════════════════════
// RANKING
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * Pseudocount weight on the declared breadth prior.
 *
 * Chosen to match `PRIOR_WEIGHT = 10` in `rangeEngine/populationPriors.js` — not because the
 * quantities are related, but because the repo has ONE convention for how strongly a declared
 * prior resists evidence and inventing a second number here would be exactly the "constant
 * chosen by taste" this register warns about. At 10, the prior still dominates below ~10 cards
 * and evidence dominates above ~40.
 */
export const BREADTH_PRIOR_WEIGHT = 10;

/** Which Result Cards an entry contaminates. */
export const contaminatedCards = (entry, cards = []) => {
  if (typeof entry?.matches !== 'function') return [];
  return cards.filter((card) => {
    try {
      return Boolean(entry.matches(card));
    } catch {
      // A matcher that throws on a card shaped differently than it expected must not take the
      // whole register down with it. Treating the throw as "no match" is the wrong-but-safe
      // direction only if it is VISIBLE, which is what registerSelfCheck reports.
      return false;
    }
  });
};

/** Observed share of cards an entry contaminates, or null when there are no cards to measure. */
export const measuredBreadth = (entry, cards = []) => {
  if (!cards.length) return null;
  return contaminatedCards(entry, cards).length / cards.length;
};

/**
 * Declared prior blended with observed evidence under pseudocount shrinkage.
 *
 * Returns the components as well as the result, because the founder's ranking decision was
 * explicitly "showing both components" — a blended number alone would hide whether a rank came
 * from measurement or from someone's estimate.
 */
export const blendedBreadth = (entry, cards = [], { priorWeight = BREADTH_PRIOR_WEIGHT } = {}) => {
  const n = cards.length;
  const flagged = contaminatedCards(entry, cards).length;
  const prior = entry.priorBreadth;
  const blended = (prior * priorWeight + flagged) / (priorWeight + n);
  return {
    prior,
    observed: n ? flagged / n : null,
    blended,
    flagged,
    n,
    // How much of the blend is evidence rather than assertion. At n=0 this is 0 and the row is
    // pure prior; a reader should discount it accordingly.
    evidenceWeight: n / (priorWeight + n),
  };
};

/** probability x contamination breadth. The founder's ranking axis, 2026-08-04. */
export const expectedDamage = (entry, cards = [], options = {}) =>
  entry.probability * blendedBreadth(entry, cards, options).blended;

/**
 * The register, ranked by expected damage, with both components on every row.
 *
 * `retired` entries sort last regardless of score and keep their evidence — they stay visible
 * because an entry that vanished on retirement would let the register be tidied down to the
 * comfortable ones.
 */
export const rankFaults = (faults = SUSPECTED_FAULTS, cards = [], options = {}) => {
  const rows = faults.map((entry) => {
    const breadth = blendedBreadth(entry, cards, options);
    return {
      entry,
      faultId: entry.faultId,
      title: entry.title,
      site: entry.site,
      status: entry.status,
      probability: entry.probability,
      breadth,
      expectedDamage: entry.probability * breadth.blended,
    };
  });

  return rows.sort((a, b) => {
    const aRetired = a.status === 'retired';
    const bRetired = b.status === 'retired';
    if (aRetired !== bRetired) return aRetired ? 1 : -1;
    if (b.expectedDamage !== a.expectedDamage) return b.expectedDamage - a.expectedDamage;
    // Deterministic tiebreak, so the doc's ordering is stable across runs and the drift test
    // is checking content rather than sort luck.
    return a.faultId.localeCompare(b.faultId);
  });
};

// ══════════════════════════════════════════════════════════════════════════════════════
// RETROACTIVE FLAGGING — the mechanism WS-291 needed and did not have
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * Flag every Result Card contaminated by a fault in one of the given statuses.
 *
 * Defaults to `confirmed` only. An untested suspicion must NOT flag results — if it did, every
 * card would carry every caveat on day one and the flag would mean nothing, which is the flat
 * caveat list this register exists to replace.
 *
 * Returns one row per AFFECTED card, not per card. A card with no faults does not appear.
 */
export const flagContaminated = ({ faults = SUSPECTED_FAULTS, cards = [], statuses = ['confirmed'] } = {}) => {
  const active = faults.filter((f) => statuses.includes(f.status));
  const byCard = new Map();

  for (const entry of active) {
    for (const card of contaminatedCards(entry, cards)) {
      const id = card?.resultCardId;
      if (!id) continue;
      if (!byCard.has(id)) {
        byCard.set(id, {
          resultCardId: id,
          status: SUSPECT_PENDING_REVIEW,
          faultIds: [],
          reasons: [],
        });
      }
      const row = byCard.get(id);
      // Idempotent by construction: re-running, or a fault appearing twice in the input, adds
      // nothing. A flag count that grew on re-run would look like new evidence.
      if (!row.faultIds.includes(entry.faultId)) {
        row.faultIds.push(entry.faultId);
        row.reasons.push(`${entry.faultId}: ${entry.contaminates}`);
      }
    }
  }

  return [...byCard.values()].sort((a, b) => a.resultCardId.localeCompare(b.resultCardId));
};

/**
 * Confirm an entry, and report what that confirmation invalidates.
 *
 * Returns a NEW register — entries are frozen and confirmation is a version change, not a
 * mutation. The returned `flagged` list is the retroactive invalidation trail: the cards whose
 * conclusions now need review because something they stood on turned out to be true.
 *
 * @param {Object} input
 * @param {Array} input.faults
 * @param {string} input.faultId
 * @param {string[]} input.evidence - REQUIRED and non-empty
 * @param {Array} [input.cards] - the cards to flag
 */
export const confirmFault = ({ faults = SUSPECTED_FAULTS, faultId, evidence = [], cards = [] } = {}) => {
  const target = faults.find((f) => f.faultId === faultId);
  if (!target) {
    throw new Error(`fault register: no entry with faultId "${faultId}"`);
  }
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error(
      `fault register: confirming "${faultId}" requires evidence. An entry may not be confirmed `
      + 'on assertion alone — that is how a hunch would come to invalidate every prior result.',
    );
  }

  const confirmed = buildFaultEntry({
    ...target,
    status: 'confirmed',
    evidence: [...target.evidence, ...evidence],
  });
  const next = faults.map((f) => (f.faultId === faultId ? confirmed : f));

  return {
    faults: next,
    entry: confirmed,
    flagged: flagContaminated({ faults: [confirmed], cards }),
  };
};

/**
 * Retire an entry. Same evidence bar as confirmation, and for the same reason in reverse.
 *
 * The entry is NOT removed. It stays in the register carrying the evidence that settled it, so
 * "we looked and it was fine" is distinguishable from "nobody ever wrote it down".
 */
export const retireFault = ({ faults = SUSPECTED_FAULTS, faultId, evidence = [] } = {}) => {
  const target = faults.find((f) => f.faultId === faultId);
  if (!target) throw new Error(`fault register: no entry with faultId "${faultId}"`);
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error(
      `fault register: retiring "${faultId}" requires evidence. Entries never quietly disappear.`,
    );
  }
  const retired = buildFaultEntry({
    ...target,
    status: 'retired',
    evidence: [...target.evidence, ...evidence],
  });
  return { faults: faults.map((f) => (f.faultId === faultId ? retired : f)), entry: retired };
};

// ══════════════════════════════════════════════════════════════════════════════════════
// SELF-CHECK — the register held to its own DEGENERATE SIGNAL standard
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * Report each matcher's discrimination over a card set.
 *
 * `FAULT-degenerate-signal` says a metric that cannot fail is not evidence. A matcher that
 * flags every card, or no card, has exactly that property — it partitions nothing, so the
 * "contaminates" claim it encodes is untested by the data.
 *
 * This REPORTS rather than rejects. Some faults genuinely do apply to everything (temporal
 * staleness applies to every corpus-derived card), and outlawing the honest statement would
 * push it somewhere nothing can find it. `discriminating: false` at n=0 is expected and means
 * only that there is nothing yet to measure against.
 */
export const registerSelfCheck = (faults = SUSPECTED_FAULTS, cards = []) => {
  const n = cards.length;
  const rows = faults.map((entry) => {
    let threw = false;
    let flagged = 0;
    for (const card of cards) {
      try {
        if (entry.matches(card)) flagged += 1;
      } catch {
        threw = true;
      }
    }
    const share = n ? flagged / n : null;
    return {
      faultId: entry.faultId,
      flagged,
      n,
      share,
      threw,
      discriminating: n > 0 && flagged > 0 && flagged < n,
      // Named so a reader is told WHY a row is non-discriminating, rather than being left to
      // infer it from a false boolean.
      note: n === 0
        ? 'no cards to measure against'
        : flagged === 0
          ? 'matches nothing in this card set — either the fault is absent here, or the matcher is wrong'
          : flagged === n
            ? 'matches everything — honest for a universal fault, but it partitions nothing and cannot be tested by these cards'
            : null,
    };
  });

  return {
    rows,
    cardCount: n,
    nonDiscriminating: rows.filter((r) => !r.discriminating).map((r) => r.faultId),
    threwOn: rows.filter((r) => r.threw).map((r) => r.faultId),
  };
};

/**
 * Entries that decide contamination by reading the card's PROSE, with the standing warning.
 *
 * WS-369 fixed the instance that was noticed. The defect is generic, so this makes the residual
 * countable instead of leaving it to be rediscovered one entry at a time.
 *
 * A prose matcher can be escaped by DELETING A SENTENCE, and it fires hardest on the most
 * carefully-written card. That is invisible to both existing diagnostics: `registerSelfCheck`
 * reports a matcher that matches nothing and a matcher that matches everything, and a matcher
 * that matches THE WRONG CARDS looks healthy to both.
 *
 * Some of these are irreducible today rather than unfixed — horizon, hole-card knowledge,
 * showdown conditioning and player count are properties of the instrument with no structural
 * field on the Result Card to carry them. Making those structural is a card-schema change. Until
 * then they are declared, not hidden.
 */
export const proseMatchers = (faults = SUSPECTED_FAULTS) => faults
  .filter((f) => (f.matchesOn ?? []).some((field) => PROSE_CARD_FIELDS.includes(field)))
  .map((f) => ({
    faultId: f.faultId,
    matchesOn: [...f.matchesOn],
    proseFields: f.matchesOn.filter((field) => PROSE_CARD_FIELDS.includes(field)),
    warning:
      'decides contamination from the author\'s account of the work rather than from the work\'s '
      + 'inputs — escapable by deleting a sentence, and biased toward flagging the cards that '
      + 'disclose most',
  }));

/**
 * Split an entry's contaminated cards into the ones that DISCLOSE the fault and the ones that
 * are SILENT about it.
 *
 * The distinction WS-352 could not represent, and the reason it could not: matching and
 * disclosure were the same test. They are now separate, and the ordering is the whole point —
 * the DEPENDENCY decides contamination, the PROSE only annotates it. A disclosing card is not
 * less contaminated for having said so; a silent one is not less contaminated for having not.
 *
 * `silent` is the list worth reading. Those cards are subject to the fault and a reader taking
 * the number at face value would never learn it — a reporting failure on top of a real exposure.
 *
 * Entries with no `disclosureCue` report every matched card as `undetermined`, because "we did
 * not look" and "we looked and found nothing" are different facts (WS-328's rule, applied here).
 */
export const contaminationDisclosure = (entry, cards = []) => {
  const matched = contaminatedCards(entry, cards);
  const cue = entry?.disclosureCue ?? null;
  const idOf = (c) => c?.resultCardId ?? null;
  if (!cue) {
    return { faultId: entry?.faultId ?? null, disclosed: [], silent: [], undetermined: matched.map(idOf) };
  }
  const prose = (c) => [c?.estimand, c?.treatment].filter(Boolean).join(' ').toLowerCase();
  return {
    faultId: entry.faultId,
    disclosed: matched.filter((c) => cue.test(prose(c))).map(idOf),
    silent: matched.filter((c) => !cue.test(prose(c))).map(idOf),
    undetermined: [],
  };
};

/**
 * Entries whose falsifier cannot currently be run, with what blocks each one.
 *
 * The work-queue emitter (§6 of the doc) ranks by expected damage, which is a statement about
 * what is worth measuring — not about what CAN be measured. Without this, the rank-1 entry is
 * re-emitted as an analysis ticket indefinitely when the actual next action belongs to whoever
 * owns the data path. A blocked entry is not lower priority; it is DIFFERENT work.
 */
export const blockedFalsifiers = (faults = SUSPECTED_FAULTS) => faults
  .filter((f) => (f.falsifierBlockers ?? []).length > 0)
  .map((f) => ({
    faultId: f.faultId,
    title: f.title,
    status: f.status,
    blockers: [...f.falsifierBlockers],
    // Reported alongside, because "1 of 3 cleared" and "3 of 3 still standing" route to the
    // same ticket today but mean different things about how far the data path has come.
    clearedCount: (f.clearedBlockers ?? []).length,
  }));

/**
 * Clear ONE blocker off an entry, naming the evidence that cleared it.
 *
 * Returns a NEW register. Entries are frozen, and the clearance is a version change rather than
 * a mutation — same shape as `confirmFault`, same evidence bar, and for the mirror-image reason:
 * confirmation without evidence lets a hunch invalidate prior results; unblocking without
 * evidence lets an entry be walked toward settlement one quiet edit at a time.
 *
 * `blocker` must match an existing blocker VERBATIM. Matching on a prefix or a fuzzy phrase would
 * let a clearance land on a blocker the author was not looking at.
 *
 * The entry's status is NOT touched. Clearing the last blocker makes the falsifier runnable; it
 * does not run it, and it does not settle anything.
 *
 * @param {Object} input
 * @param {Array} [input.faults]
 * @param {string} input.faultId
 * @param {string} input.blocker - the blocker text, verbatim
 * @param {string[]} input.evidence - REQUIRED and non-empty
 * @param {string} input.note - REQUIRED: what this clearance does NOT cover
 * @param {string} [input.at]
 */
export const clearFalsifierBlocker = ({
  faults = SUSPECTED_FAULTS, faultId, blocker, evidence = [], note = '', at = null,
} = {}) => {
  const target = faults.find((f) => f.faultId === faultId);
  if (!target) throw new Error(`fault register: no entry with faultId "${faultId}"`);
  if (!(target.falsifierBlockers ?? []).includes(blocker)) {
    throw new Error(
      `fault register: "${faultId}" does not declare that blocker verbatim. A clearance must name `
      + 'the exact blocker it clears, or it can land on one nobody was looking at.',
    );
  }
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error(
      `fault register: clearing a blocker on "${faultId}" requires evidence. Raising a blocker `
      + 'costs nothing, so clearing one on assertion alone is how a register gets quietly unblocked.',
    );
  }
  if (typeof note !== 'string' || !note.trim()) {
    throw new Error(
      `fault register: clearing a blocker on "${faultId}" requires a note stating what it does NOT `
      + 'clear. One of three cleared is not an entry that came unblocked.',
    );
  }

  const cleared = buildFaultEntry({
    ...target,
    falsifierBlockers: target.falsifierBlockers.filter((b) => b !== blocker),
    clearedBlockers: [
      ...(target.clearedBlockers ?? []),
      { blocker, clearedBy: [...evidence], at: at ?? new Date().toISOString().slice(0, 10), note },
    ],
  });

  return {
    faults: faults.map((f) => (f.faultId === faultId ? cleared : f)),
    entry: cleared,
    // The whole point of the return value: what is STILL blocked. A caller that reads only
    // `entry` can mistake a partial clearance for a full one.
    remainingBlockers: [...cleared.falsifierBlockers],
    stillBlocked: cleared.falsifierBlockers.length > 0,
  };
};

/** Problems across the whole register. Empty means every entry is well-formed and unique. */
export const registerProblems = (faults = SUSPECTED_FAULTS) => {
  const problems = [];
  const seen = new Set();
  for (const entry of faults) {
    problems.push(...faultEntryProblems(entry).map((p) => `${entry?.faultId ?? '<unnamed>'}: ${p}`));
    if (seen.has(entry?.faultId)) problems.push(`duplicate faultId "${entry.faultId}"`);
    seen.add(entry?.faultId);
  }
  return problems;
};

// ══════════════════════════════════════════════════════════════════════════════════════
// VERSION
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * The canonical body the register's version hash is taken over.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * DOES THE MATCHER BELONG IN THE HASH? WS-369 ANSWERS: THE SOURCE NO, THE BASIS YES.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * The original exclusion was reasoned and half right. A function has no stable serialization;
 * hashing its source would move the version on a rename, a reformat, or an extracted helper, and
 * a version that churns for non-reasons is a version nobody reads. That argument is decisive
 * against hashing the SOURCE. It is not an argument against hashing the CLAIM.
 *
 * And there is a claim. `falsifierBlockers` is hashed on the stated ground that it says what this
 * register can currently SETTLE, and a reader holding an old Result Card needs to detect a change
 * in that. What a matcher READS is the same kind of statement about the same card: it says what
 * the register can SEE. WS-369 is the proof by construction — the matcher moved from the card's
 * prose to the card's dependencies, the contamination set changed, and under the old body the
 * version would not have moved by a single character. Two cards stamped `FR-1+8c4e65578ca2` could
 * have been screened by opposite predicates with nothing in either card recording which. That is
 * exactly the invisibility the stamp exists to prevent, and it is worse than a wrong number,
 * because under-matching SHRINKS the list `confirmFault` returns and shrinks it silently.
 *
 * So the middle path, and it is the one the ticket named: hash `matchesOn`, a declared descriptor
 * of the card fields the predicate reads. It changes when the semantics change — moving from
 * `treatment` to `match.dealBookId` is precisely a change of declared fields — and does not
 * change when the whitespace does. Its vocabulary is closed (`MATCHABLE_CARD_FIELDS`) so a typo
 * cannot pass for a declaration, and the tests bind the descriptor to the behaviour rather than
 * trusting it: every entry that does not declare a prose field is asserted invariant under
 * scrambling `estimand` and `treatment`.
 *
 * WHAT THIS DOES TO EXISTING STAMPS. Adding `matchesOn` moves `registerVersion()` off
 * `FR-1+8c4e65578ca2`. Prior cards keep the stamp they were minted with, and are NOT re-stamped —
 * the WS-352 rule holds: a stamp correctly records what the card was produced under. The gain is
 * forward-looking and is the whole point: from here on, a reader comparing an old card's stamp to
 * today's register can tell that the screening changed, which before this change they could not.
 * Re-screening those cards is not automatic and must not be: that is the confirm/retire
 * machinery's job, and it requires evidence.
 *
 * `matches` itself is still excluded, and so is `disclosureCue` — the cue annotates a match for
 * reporting and never alters the contamination set, so it makes no claim about what the register
 * can see.
 */
export const canonicalRegisterBody = (faults = SUSPECTED_FAULTS) => ({
  epoch: REGISTER_EPOCH,
  disclaimer: THE_DISCLAIMER,
  treatment: DISCLAIMER_TREATMENT,
  // Hashed for the same reason `falsifierBlockers` is: it is a claim about what this register
  // can currently settle. A reader holding an old Result Card needs to be able to tell that the
  // null a drift claim was read against has moved. Not an entry, so it sits beside them.
  withinCorpusDrift: WITHIN_CORPUS_DRIFT_2009,
  entries: faults.map((e) => ({
    faultId: e.faultId,
    title: e.title,
    site: e.site,
    mechanism: e.mechanism,
    contaminates: e.contaminates,
    // WS-369. Hashed: the declared basis of the matcher. See the block comment above.
    matchesOn: e.matchesOn,
    falsifier: e.falsifier,
    probability: e.probability,
    probabilityBasis: e.probabilityBasis,
    priorBreadth: e.priorBreadth,
    status: e.status,
    evidence: e.evidence,
    // Hashed deliberately. A blocker is a claim about what this register CAN currently settle,
    // and removing one is a claim that the falsifier became runnable — both are exactly the kind
    // of change a reader of an old Result Card needs to be able to detect.
    falsifierBlockers: e.falsifierBlockers,
    // Hashed for the SAME reason, from the other side. Removing a blocker already moves the
    // version; carrying the removal's evidence in the hashed body is what lets a reader tell
    // WHICH way the register moved and on whose authority, rather than only that it moved.
    clearedBlockers: e.clearedBlockers,
  })),
});

/**
 * The version a Result Card stamps into `manifest.disclaimerRegisterVersion`.
 *
 * `FR-1+<short hash>`. The epoch is readable and quotable; the hash is what makes the version
 * HONEST — edit any entry and it changes whether or not anyone remembered to bump anything.
 *
 * Async because `hashObject` is (Web Crypto's digest is async and the browser path has to
 * work). Every caller that needs it — `buildStampInput` — is already async.
 */
export const registerVersion = async (faults = SUSPECTED_FAULTS) => {
  const hash = await hashObject(canonicalRegisterBody(faults));
  return `${REGISTER_EPOCH}+${hash.replace('sha256:', '').slice(0, 12)}`;
};

/**
 * The shape `registerVersion` mints, as a checkable pattern. `FR-<epoch>+<12 lowercase hex>`.
 *
 * IT LIVES HERE, BESIDE THE MINTER, ON PURPOSE — the same argument `manifestProblems` and
 * `buildReplicationManifest` already make: a checker that can disagree with its producer is
 * worse than no checker. `manifest.js` imports this rather than re-declaring the shape.
 *
 * WHY A SHAPE CHECK AT ALL (WS-353 follow-up). `manifestProblems` checked only that the field was
 * TRUTHY. That catches `null`, `''` and an absent key — but it passes any non-empty string,
 * including `'unknown'`, `'v1'`, or a hand-typed near-miss. The stamp exists for exactly one
 * purpose: to be JOINED back to a register version when a fault is later confirmed, so the
 * results that stood on it can be found. A string that cannot be joined satisfies a presence
 * check while delivering none of that — and it is worse than `null`, because `null` announces
 * that the card cannot name its register and an unjoinable string quietly claims that it can.
 *
 * `\d+` rather than a literal `1`: bumping the epoch is a legal, expected change, and a
 * validator pinned to today's epoch would reject every card minted the day after.
 */
export const REGISTER_VERSION_PATTERN = /^FR-\d+\+[0-9a-f]{12}$/;

/** True when `value` has the shape `registerVersion()` mints. Shape only — not a join. */
export const isRegisterVersionShape = (value) =>
  typeof value === 'string' && REGISTER_VERSION_PATTERN.test(value);
