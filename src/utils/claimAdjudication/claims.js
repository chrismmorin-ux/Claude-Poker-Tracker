/**
 * claims.js — the vocabulary a reasoning note is translated into
 *
 * Surface spec: docs/design/surfaces/voice-reasoning-notes.md (Phase 2 graders)
 *
 * WHY A VOCABULARY RATHER THAN AN ENUM OF FEATURES. The engine is expected to
 * support more and increasingly complex positions over time. A parser built as a
 * switch over "the things we can check today" would need editing every time the
 * engine grows, and would silently drop everything it did not yet recognise.
 * So a claim is a STRUCTURED ASSERTION, and what can currently be *checked* is a
 * separate question answered by the resolver registry. Adding an engine
 * capability registers a resolver; the vocabulary does not move.
 *
 * FOUNDER POSTURE (ratified 2026-08-01):
 *   "my claims are assumed valid until disproven with the data or proven with
 *    model upgrades."
 *
 * That posture is why there are FOUR verdicts and not two. `blocked` is not a
 * polite failure — it is the load-bearing one. It says the claim stands, names
 * the capability that would settle it, and becomes engine work. A parser that
 * collapsed `blocked` into `disproven` would refute true claims with absence of
 * evidence, which inverts the whole point.
 */

/** What a claim asserts about. Open by construction — resolvers declare what they take. */
export const CLAIM_KIND = Object.freeze({
  POT_ODDS: 'pot-odds',           // "he's getting a great price", "priced in"
  STACK_DEPTH: 'stack-depth',     // "they're short", "40 big blinds deep"
  PLAYERS_LIVE: 'players-live',   // "three of us saw the flop", "heads up"
  EQUITY: 'equity',               // "I'm way ahead", "that's a coinflip"
  RANGE: 'range',                 // "he limps a wide range", "never has aces"
  SIZING: 'sizing',               // "I should size up"
  POSITION: 'position',           // "he's opening from early"
  ACTION: 'action',               // "UTG limped"
  BOARD: 'board',                 // "that card bricks"
});

export const VERDICT = Object.freeze({
  /** The data agrees. */
  SUPPORTED: 'supported',
  /** The data contradicts it, and the data was admissible enough to say so. */
  DISPROVEN: 'disproven',
  /**
   * Not checkable. The claim STANDS. `gap` names what would settle it — a
   * missing field, an inadmissible provenance, or an engine capability that does
   * not exist yet. This is the queue of model upgrades, generated rather than
   * guessed.
   */
  BLOCKED: 'blocked',
  /** Checkable in principle by nothing — a preference, a plan, a counterfactual. */
  UNFALSIFIABLE: 'unfalsifiable',
});

/** Why a claim could not be checked. Drives the work queue, so it is specific. */
export const GAP = Object.freeze({
  MISSING_FIELD: 'missing-field',             // the snapshot never recorded it
  INADMISSIBLE_PROVENANCE: 'inadmissible-provenance', // recorded, but not evidence (INV-STK-01)
  NO_RESOLVER: 'no-resolver',                 // nothing can answer this shape yet
  AMBIGUOUS: 'ambiguous',                     // needs a clarification to be decidable
  WRONG_SEGMENT: 'wrong-segment',             // the population the claim is about is inadmissible here
});

/**
 * Hedged language is not a weaker claim — it is a claim about the speaker's
 * confidence, and refuting it as though it were asserted flatly is unfair. A
 * grader may report divergence on a hedged claim but must not mark it disproven.
 */
/**
 * FIRST-PERSON EPISTEMIC MARKERS ONLY.
 *
 * The distinction is load-bearing and was found by testing against the founder's
 * real KK note. "They're short stacked and more LIKELY to consider themselves
 * priced in" contains no hedge: "likely" is doing FREQUENCY work — a claim about
 * how often villains behave a certain way — not expressing doubt about the
 * speaker's own knowledge. Same for "he MIGHT have aces", which is a range
 * assertion, and "sort of a bluffcatcher", which modifies the object.
 *
 * Treating those as hedges shields flatly-asserted claims from refutation, which
 * is the opposite of the intended effect: the founder wants to be told when he
 * is wrong, and a frequency word must not buy immunity.
 */
const HEDGES = [
  'i think', 'i thought', 'i guess', 'i feel like', 'i believe',
  'not sure', 'pretty sure', 'probably', 'maybe', 'i suspect',
];

/**
 * KNOWN LIMITATION — hedge scope is the whole clause, not the sub-span that
 * produced a given claim. In "I think they're short, so his odds are good", the
 * hedge belongs to the first assertion only, but both claims from that clause
 * inherit it. Erring this way is deliberate: it under-refutes rather than
 * over-refutes, and under this posture a missed refutation is recoverable while
 * a wrong one is corrosive. Narrowing it needs span-level attribution.
 */
export const isHedged = (text) => {
  const t = String(text || '').toLowerCase();
  return HEDGES.some((h) => t.includes(h));
};

/**
 * @param {object} spec
 * @param {string} spec.kind — CLAIM_KIND
 * @param {string} spec.text — the phrase that produced it, verbatim
 * @param {number} spec.segmentIndex — which segment of the note
 * @param {object|null} [spec.quantity] — { value, unit } when one was stated
 * @param {string|null} [spec.comparator] — 'lt' | 'gt' | 'approx' | 'eq'
 * @param {object|null} [spec.subject] — { seat } | { role: 'hero'|'villain' } | { position }
 * @param {object|null} [spec.context] — the snapshot the segment was bound to
 */
export const makeClaim = ({
  kind,
  text = '',
  segmentIndex = 0,
  quantity = null,
  comparator = null,
  subject = null,
  context = null,
} = {}) => ({
  kind,
  text: String(text),
  segmentIndex: Number(segmentIndex) || 0,
  quantity,
  comparator,
  subject,
  context,
  hedged: isHedged(text),
});

/**
 * @param {object} spec
 * @param {string} spec.verdict — VERDICT
 * @param {object|null} [spec.actual] — what the data says, with units
 * @param {object|null} [spec.basis] — { resolver, provenance, n }
 * @param {string|null} [spec.gap] — GAP, required when verdict is BLOCKED
 * @param {string|null} [spec.detail] — one line a human can read
 * @param {object|null} [spec.clarification] — { question, whyItMatters }
 */
export const makeVerdict = ({
  verdict,
  actual = null,
  basis = null,
  gap = null,
  detail = null,
  clarification = null,
} = {}) => {
  if (verdict === VERDICT.BLOCKED && !gap) {
    // A blocked verdict without a named gap is just a shrug, and produces no
    // work item. The whole value of the tier is the name.
    throw new Error('a BLOCKED verdict must name its gap');
  }
  return { verdict, actual, basis, gap, detail, clarification };
};

/**
 * A hedged claim can diverge from the data but cannot be DISPROVEN.
 * Applied centrally so no individual resolver has to remember the rule.
 */
export const applyHedgePolicy = (claim, verdict) => {
  if (!claim?.hedged || verdict.verdict !== VERDICT.DISPROVEN) return verdict;
  return {
    ...verdict,
    verdict: VERDICT.BLOCKED,
    gap: GAP.AMBIGUOUS,
    detail: `${verdict.detail || 'Data diverges from this.'} Stated as a hedge, so recorded as divergence rather than refutation.`,
  };
};
