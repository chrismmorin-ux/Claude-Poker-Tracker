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
 */
export const buildFaultEntry = ({
  faultId,
  title,
  site,
  mechanism,
  contaminates,
  matches,
  falsifier,
  probability,
  probabilityBasis,
  priorBreadth,
  status = 'untested',
  evidence = [],
  falsifierBlockers = [],
} = {}) => {
  const entry = {
    faultId,
    title,
    site,
    mechanism,
    contaminates,
    matches,
    falsifier,
    probability,
    probabilityBasis,
    priorBreadth,
    status,
    evidence: [...evidence],
    falsifierBlockers: [...falsifierBlockers],
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
 * Hence the rule below: an entry may not be `confirmed` or `retired` while it declares its
 * falsifier is blocked. Settling an entry whose named test cannot be run means something EASIER
 * was substituted — which is exactly the move this whole apparatus exists to prevent. Clearing
 * the blocker first is not a formality; it is the author stating, in a hashed field, that the
 * test that was supposed to settle this is the test that settled it.
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
  return problems;
};

const inUnitInterval = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;

// ══════════════════════════════════════════════════════════════════════════════════════
// MATCHER HELPERS
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * The card's own text, flattened, for matchers that key on what a card SAYS it measured.
 *
 * Deliberately narrow: identity and prose only, never `metrics`. A matcher that swept the
 * metric VALUES would fire on the number rather than on the claim, and the same figure means
 * different things on two different instruments.
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

/** True when the card stands on the 2009 online corpus rather than a live or generated set. */
const onOnlineCorpus = (card) => /handhq|src-01[12]|mass data field|\bmdf\b|online|2009/.test(haystack(card));

/** True when the card makes a claim ABOUT live play. */
const isLiveFacing = (card) => /\blive\b|1\/2|1\/3|9-handed/.test(haystack(card));

const metricKeys = (card) => Object.keys(card?.metrics ?? {});

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
    matches: (card) => isLiveFacing(card) && onOnlineCorpus(card),
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
    // reason rather than being settled by a substitute. All three blockers are about the LIVE
    // arm; the SRC-012 arm is measurable today (scripts/backtest reads 1,756 HandHQ files). A
    // two-arm comparison with one unavailable arm has no reduced form — the gap between the
    // populations is the entire estimand, so there is no partial credit to bank here.
    falsifierBlockers: [
      'SRC-014 HAS NO POSITIVE IDENTITY. Live hands are distinguished only by `source` being '
      + "UNDEFINED — `saveOnlineHand` stamps source:'ignition' (handsStorage.js:444) and the "
      + 'manual path stamps nothing. So the live subset cannot be SELECTED, and an un-stamped '
      + 'import is indistinguishable from a live hand. Already an open finding in '
      + 'docs/provenance/data-source-registry.md. UNBLOCKED BY: a positive source stamp on live '
      + 'capture carrying venue and stake.',
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
    matches: (card) => /simulat|synthetic|modelled field|model-opponent/.test(haystack(card)),
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
    matches: (card) => {
      const keys = metricKeys(card).join(' ').toLowerCase();
      const saysRealized = /realiz|chips|showdown|observed/.test(`${keys} ${haystack(card)}`);
      return /ev|edge/.test(keys) && !saysRealized;
    },
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
    matches: (card) => /one-decision|per-decision/.test(haystack(card)),
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
    matches: (card) => isLiveFacing(card),
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
    matches: (card) => /foldto3bet|fold-to-3bet|preflop prior|3bet/.test(haystack(card)),
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
    matches: (card) => Boolean(card?.match?.fieldId) && !/responsive|adaptive/.test(haystack(card)),
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
    matches: (card) => /range-marginalized|marginalized/.test(haystack(card)),
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
    matches: onOnlineCorpus,
    falsifier:
      'Fit the same priors on SRC-005 (Ignition, current) and compare against the 2009 values '
      + 'cell by cell. The per-cell gap is the drift; cells that agree are stable and can be '
      + 'quoted without the era caveat.',
    probability: 0.9,
    probabilityBasis:
      'Drift over sixteen years is near-certain in direction. Which cells moved, and by how '
      + 'much, is entirely unmeasured.',
    priorBreadth: 0.85,
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
    matches: (card) => /showdown|revealed|holding/.test(haystack(card)),
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
    matches: (card) => /multiway|3-way|three-way|multi-way/.test(haystack(card)),
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
  }));

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
 * Excludes `matches` — a function has no stable serialization, and hashing its source would
 * make a whitespace change look like a semantic one. The claim a reader relies on is the PROSE
 * (`contaminates`), which is included; the matcher is the machine form of that prose and is
 * covered by tests, not by the hash.
 */
export const canonicalRegisterBody = (faults = SUSPECTED_FAULTS) => ({
  epoch: REGISTER_EPOCH,
  disclaimer: THE_DISCLAIMER,
  treatment: DISCLAIMER_TREATMENT,
  entries: faults.map((e) => ({
    faultId: e.faultId,
    title: e.title,
    site: e.site,
    mechanism: e.mechanism,
    contaminates: e.contaminates,
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
