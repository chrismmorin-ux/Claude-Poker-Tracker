/**
 * holdingKnowledge.js — what do we KNOW about a seat's holding at a decision point? (WS-292)
 *
 * Lives in pokerCore because it needs board + range + card parsing and no player modelling,
 * and because every consumer of the join sits in a different directory: the villain
 * accumulator (`exploitEngine/decisionAccumulator`), the game tree
 * (`exploitEngine/gameTreeContext`), replay (`handAnalysis/replayAnalysis`) and the offline
 * corpus harness (`scripts/backtest/`). Same argument as `situationKey.js`: several engines
 * need it and none of them owns it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE MISSING JOIN.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Showdown reveals what a seat actually held. The engine carries an INFERRED range for that
 * seat at every decision. Before this module nothing joined the two — `decisionAccumulator`
 * read `playerShowdown` for `sizingTells` samples and a `handShown` field, and never once
 * reconciled the range it was carrying against the hand it had just learned the player held.
 * The ground truth and the inference sat two hundred lines apart IN THE SAME FUNCTION.
 *
 * That absence is why WS-291 — a falsified range model on the live recommendation path —
 * survived unmeasured for the life of the project. Nothing could have caught it, because
 * "was the range right?" was not a question the codebase could phrase.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * REVEALED IS A SCORING CHANNEL, NEVER AN INPUT — founder decision, 2026-08-04.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Revealed cards may GRADE an inference. They may never EDIT one. The alternative — letting
 * a known holding correct the range it is meant to be scoring — produces a model that
 * reports excellent calibration no matter how bad it is, because the thing being measured
 * was corrected using the thing measuring it.
 *
 * This repo has already been bitten by that exact shape. FIND-038: `sizingTells` told the
 * founder its reads were "confirmed by showdowns" while it actually correlated against the
 * model's OWN `avgSegmentation` and never touched `handShown` — a number that looked like
 * validation was the model agreeing with itself. The provenance registry makes the same
 * argument about data: SRC-012 is registered SEPARATELY from SRC-011 precisely because they
 * share an origin, and shared origin is the leakage vector.
 *
 * So the enforcement here is STRUCTURAL, not documentary. Revealed cards are held in a
 * module-private WeakMap and are not a property of the record:
 *
 *   - `{ ...knowledge }` does not carry them.
 *   - `const { revealed } = knowledge` yields `undefined`.
 *   - `JSON.stringify(knowledge)` does not serialize them.
 *   - The ONLY way to obtain them is `revealedHolding(knowledge)` — a named call that a
 *     reader of a live-path diff will notice, and that a grep can enumerate.
 *
 * `hasRevealedHolding` exists so a consumer can branch on WHETHER a hand is known without
 * seeing WHAT it is — the common case for "should I score this decision?".
 *
 * Accidental forward-reading was a real trap on the seam this replaces: WS-287 had to
 * distinguish `rangeBefore` from the post-narrowing range, because reading the latter to
 * score a decision conditions on the action being scored. A property you can destructure is
 * one autocomplete away from that mistake; a function call is not.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * PROVENANCE — how many times has this range been cut, and by what?
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * `narrowingCount` exists because the WS-291 chaining problem was INVISIBLE. `gameTreeDepth2`
 * narrowed a flop range three times down a line where villain acted twice, the extra firing
 * when the turn card was DEALT — and discrimination decayed +.524 → +.404 → +.179 with
 * nothing in the data structure to show a range had been cut more often than the villain had
 * acted. WS-303 diagnosed it as an off-by-one rather than a missing damping constant, and the
 * only reason that was arguable at all is that the count had to be reconstructed by reading
 * call sites.
 *
 * Carry the count with the range and the question becomes a field lookup. Per
 * `exploitEngine/CLAUDE.md`: when a comment states a fact the code could assert instead,
 * assert it. `narrowedWith()` is the only way to advance the count, so a range cannot be
 * narrowed through this primitive without saying so.
 *
 * NOTE the primitive does not narrow anything itself — `narrowByBoard` lives in
 * `exploitEngine/postflopNarrower` and pokerCore must not import an engine. The caller
 * narrows and reports what it did. That split is deliberate: this module owns the RECORD of
 * what is known, not the inference that produced it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * RANGES ARE HELD BY REFERENCE.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * A record does not copy its range. Ranges in this codebase are treated as immutable —
 * `narrowByBoard` returns a new Float64Array rather than mutating its input, and
 * `decisionAccumulator` reassigns `currentRange` instead of writing through it. Copying 169
 * floats per decision would be a real cost in the corpus harness, which scores millions of
 * them, and would buy protection against a mutation pattern this codebase does not use.
 * Callers must not mutate a range they have handed to a record.
 */

import { parseAndEncode } from './cardParser';

/**
 * Revealed holdings, keyed by the record that owns them.
 *
 * A WeakMap rather than a closure variable so records stay plain frozen objects (cheap to
 * create, structurally comparable, safe to spread) while the cards remain genuinely
 * unreachable — there is no property to find, no prototype to walk, and entries are collected
 * with their records.
 */
const REVEALED = new WeakMap();

/**
 * Marks objects built here, so `revealedHolding` can reject a look-alike.
 *
 * Attached NON-ENUMERABLY, which is load-bearing rather than tidy. Spread and `Object.assign`
 * copy enumerable symbol-keyed properties, so an enumerable brand would ride along into
 * `{ ...knowledge }` — and that copy has no WeakMap entry, so it would pass the brand check
 * and return `null` from `revealedHolding`, reading as "this hand never went to showdown".
 * A silently shrinking calibration sample is precisely the failure this module exists to
 * prevent. Non-enumerable, the copy fails the check and throws.
 */
const BRAND = Symbol('holdingKnowledge');

/** Thrown rather than returning a wrong-but-plausible record. */
export class HoldingKnowledgeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HoldingKnowledgeError';
  }
}

/**
 * Why a supplied holding was not accepted.
 *
 * `null` means nothing was supplied — a decision with no showdown, which is the common case
 * and not a problem. A non-null value means something WAS supplied and could not be used,
 * which is a data-quality signal worth counting rather than silently dropping. The pre-WS-292
 * call sites dropped these samples with no record that they had; three separate sites each
 * re-implemented the check and none of them reported a total.
 */
export const REVEAL_DROP_REASONS = Object.freeze({
  UNPARSEABLE: 'unparseable',       // not two readable card strings / encodings
  BOARD_COLLISION: 'board-collision', // a "held" card is already on the board
});

/** Default for `revealedAt`: a showdown is how a holding becomes known in this codebase. */
export const REVEAL_AT_SHOWDOWN = 'showdown';

const isEncodedCard = (v) => Number.isInteger(v) && v >= 0 && v <= 51;

/**
 * Normalize a supplied holding to two encoded cards.
 *
 * Accepts card strings (`['Ah', 'Kd']`, the shape `gameState.showdownCards` stores) or
 * already-encoded integers, because both exist at call sites today and forcing one would
 * push a conversion into every consumer — which is the duplication this module removes.
 *
 * @returns {{cards: number[]|null, dropped: string|null}}
 */
const normalizeRevealed = (revealed, board) => {
  if (revealed === null || revealed === undefined) return { cards: null, dropped: null };
  if (!Array.isArray(revealed) || revealed.length !== 2) {
    return { cards: null, dropped: REVEAL_DROP_REASONS.UNPARSEABLE };
  }

  const cards = revealed.map((c) => (isEncodedCard(c) ? c : parseAndEncode(c)));
  if (cards.some((c) => !isEncodedCard(c))) {
    return { cards: null, dropped: REVEAL_DROP_REASONS.UNPARSEABLE };
  }
  if (cards[0] === cards[1]) {
    return { cards: null, dropped: REVEAL_DROP_REASONS.UNPARSEABLE };
  }
  // A card cannot be both on the board and in a hand. When it is, the hand record is wrong
  // and every downstream equity/percentile call would be computed on an impossible deal.
  if (Array.isArray(board) && (board.includes(cards[0]) || board.includes(cards[1]))) {
    return { cards: null, dropped: REVEAL_DROP_REASONS.BOARD_COLLISION };
  }
  return { cards, dropped: null };
};

/**
 * Build the record of what is known about a seat's holding at one decision point.
 *
 * @param {Object}  args
 * @param {Float64Array} args.range 169-cell inferred range AS IT STOOD at this decision.
 *   Held by reference — see the note on mutation above.
 * @param {number[]} [args.board] encoded board cards, used to reject impossible holdings.
 * @param {Array|null} [args.revealed] the seat's actual cards, if the hand reached showdown.
 *   Card strings or encoded integers. Absent, unparseable and board-colliding are all
 *   distinguishable afterwards via `provenance.revealDropped`.
 * @param {string|number|null} [args.seat] whose holding this is.
 * @param {string|null} [args.street] the street of the decision.
 * @param {string[]} [args.narrowedBy] actions this range has already been narrowed by, in
 *   order. Length is the narrowing count.
 * @param {string} [args.revealedAt] when the holding became known. Always LATER than the
 *   decision — that asymmetry is the whole reason revealed cards are gated.
 * @param {string|null} [args.source] SRC-* id from the data-source registry, carried so
 *   provenance survives the join at row grain.
 * @returns {Readonly<Object>} frozen record: `{ range, seat, provenance }`. Note the absence
 *   of a `revealed` property — that is the point; use `revealedHolding()`.
 */
/**
 * Assemble and seal a record around ALREADY-NORMALIZED cards.
 *
 * Shared by `holdingKnowledgeAt` (which normalizes first) and `narrowedWith` (which carries
 * cards already validated on the prior record). Both paths must build the record and attach
 * its cards in one place: an earlier draft attached them to one object and returned another,
 * which read fine and silently produced records whose ground truth was unreachable.
 */
const sealRecord = ({ range, seat, street, narrowedBy, revealedAt, source, cards, dropped }) => {
  const record = {
    range,
    seat: seat === null || seat === undefined ? null : String(seat),
    provenance: Object.freeze({
      street,
      // The actions this range has been cut by, in order. Reading it answers "is this a flop
      // range or one cut three times?" — the WS-291 question that had no answer.
      narrowedBy: Object.freeze([...narrowedBy]),
      narrowingCount: narrowedBy.length,
      // `true` only when a usable holding is attached. Lets a consumer decide whether to
      // score WITHOUT calling revealedHolding(), which keeps the gated call rare and greppable.
      hasRevealed: cards !== null,
      revealedAt: cards !== null ? revealedAt : null,
      revealDropped: dropped,
      source,
    }),
  };
  Object.defineProperty(record, BRAND, { value: true, enumerable: false });
  Object.freeze(record);
  if (cards !== null) REVEALED.set(record, cards);
  return record;
};

export const holdingKnowledgeAt = ({
  range,
  board = [],
  revealed = null,
  seat = null,
  street = null,
  narrowedBy = [],
  revealedAt = REVEAL_AT_SHOWDOWN,
  source = null,
} = {}) => {
  if (!range || typeof range.length !== 'number' || range.length !== 169) {
    throw new HoldingKnowledgeError(
      `holdingKnowledgeAt requires a 169-cell range, got ${range ? range.length : range}`,
    );
  }
  if (!Array.isArray(narrowedBy)) {
    throw new HoldingKnowledgeError('narrowedBy must be an array of action names');
  }

  const { cards, dropped } = normalizeRevealed(revealed, board);
  return sealRecord({
    range,
    seat,
    street,
    narrowedBy,
    revealedAt,
    source,
    cards: cards === null ? null : Object.freeze(cards),
    dropped,
  });
};

/** True for records built by `holdingKnowledgeAt`. */
export const isHoldingKnowledge = (k) => Boolean(k && k[BRAND] === true);

/**
 * Does a usable revealed holding exist for this record?
 *
 * Prefer this over `revealedHolding(k) !== null` when the answer only gates control flow:
 * it keeps the number of sites that actually TOUCH ground truth small enough to audit.
 */
export const hasRevealedHolding = (k) => Boolean(isHoldingKnowledge(k) && REVEALED.has(k));

/**
 * THE EXPLICIT ASK — read the hand this seat turned out to hold.
 *
 * Every call is a place where ground truth enters a computation, so every call must be able
 * to justify itself as SCORING rather than INFERENCE. Grep for this name when reviewing:
 * a new call on a live recommendation path is the failure this module exists to prevent.
 *
 * @param {Object} knowledge record from `holdingKnowledgeAt`
 * @returns {number[]|null} `[c1, c2]` encoded, or null when nothing usable was revealed
 * @throws {HoldingKnowledgeError} when handed something that is not one of our records —
 *   a wrong-but-plausible `null` here would read as "no showdown" and silently shrink a
 *   calibration sample instead of failing.
 */
export const revealedHolding = (knowledge) => {
  if (!isHoldingKnowledge(knowledge)) {
    throw new HoldingKnowledgeError(
      'revealedHolding requires a record from holdingKnowledgeAt',
    );
  }
  return REVEALED.get(knowledge) ?? null;
};

/**
 * Derive a new record for the same seat after narrowing by one action.
 *
 * The ONLY way to advance `narrowingCount`, so a range cannot be cut through this primitive
 * without the record saying so. Pass the range the caller's narrower returned; this module
 * does not narrow (pokerCore may not import `exploitEngine/postflopNarrower`).
 *
 * Any revealed holding carries across unchanged — it is a fact about the hand, not about the
 * range, and it is still gated behind `revealedHolding` on the new record.
 *
 * @param {Object} knowledge prior record
 * @param {string} action the villain action that justified this narrowing. Dealing a card is
 *   NOT an action — that miscount is exactly what WS-303 found.
 * @param {Float64Array} range the narrowed range
 * @returns {Readonly<Object>} new frozen record
 */
export const narrowedWith = (knowledge, action, range) => {
  if (!isHoldingKnowledge(knowledge)) {
    throw new HoldingKnowledgeError('narrowedWith requires a record from holdingKnowledgeAt');
  }
  if (typeof action !== 'string' || action.length === 0) {
    throw new HoldingKnowledgeError('narrowedWith requires the action that justified the cut');
  }
  if (!range || typeof range.length !== 'number' || range.length !== 169) {
    throw new HoldingKnowledgeError(
      `narrowedWith requires a 169-cell range, got ${range ? range.length : range}`,
    );
  }
  const prior = knowledge.provenance;
  // Ground truth carries across directly: it was already validated against the board when the
  // first record was built, and re-normalizing would mean threading the board through every
  // narrowing for a check that cannot change its answer.
  return sealRecord({
    range,
    seat: knowledge.seat,
    street: prior.street,
    narrowedBy: [...prior.narrowedBy, action],
    revealedAt: prior.revealedAt ?? REVEAL_AT_SHOWDOWN,
    source: prior.source,
    cards: REVEALED.get(knowledge) ?? null,
    dropped: prior.revealDropped,
  });
};
