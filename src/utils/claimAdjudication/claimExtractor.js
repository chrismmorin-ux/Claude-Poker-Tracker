/**
 * claimExtractor.js — spoken reasoning → structured claims
 *
 * Lexicon-driven, not statistical. Deliberately.
 *
 * WHAT IT REFUSES TO DO. It does not guess. A sentence it cannot confidently
 * type is returned as UNPARSED rather than forced into the nearest claim shape.
 * A wrongly-typed claim gets checked against the wrong quantity and can be
 * "disproven" by a number that has nothing to do with what was said — which,
 * under a posture where claims stand until disproven with data, is the most
 * damaging thing this module could do. Silence is recoverable; a confident
 * mis-parse is not.
 *
 * Unparsed spans are RETURNED, not dropped, so the founder can see exactly what
 * the parser ignored and the lexicon can be grown against real notes rather than
 * imagined ones.
 */

import { CLAIM_KIND, makeClaim } from './claims';

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** Sentence-ish split. Speech has little punctuation, so conjunctions count. */
const splitClauses = (text) =>
  String(text || '')
    .split(/(?:[.!?;]+|\s+(?:but|and then|so then|because|since)\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean);

const parseNumber = (token) => {
  if (token === null || token === undefined) return null;
  const word = NUMBER_WORDS[String(token).toLowerCase()];
  if (word !== undefined) return word;
  const n = Number(String(token).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// --- patterns -------------------------------------------------------------
// Each returns a partial claim or null. Order matters: the most specific
// (a stated quantity) is tried before the qualitative form.

const STACK_BB = /\b(?:about|around|roughly|~)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:big blinds?|bb|blinds deep)\b/i;
const SHORT_WORDS = /\b(short[- ]?stacked|short stack|shallow|not much behind|low on chips)\b/i;
const DEEP_WORDS = /\b(deep[- ]?stacked|deep stack|hundred blinds|plenty behind)\b/i;

const PRICED_IN = /\b(priced in|getting (?:a )?(?:great|good|the right) price|pot odds are (?:so |too )?good|can't fold|cheap call|getting (?:a )?discount)\b/i;
const BAD_PRICE = /\b(bad price|terrible odds|not getting (?:the )?odds|priced out)\b/i;
const EQUITY_PCT = /\b([0-9]{1,3})\s*(?:%|percent)\b/i;

const PLAYERS = /\b(?:(one|two|three|four|five|six|seven|eight|nine|[0-9]+))\s+(?:players?|of us|guys|opponents?|way)\b/i;
const HEADS_UP = /\bheads[- ]?up\b/i;

const SIZING = /\b(size (?:up|down)|bigger sizing|smaller sizing|should have (?:bet|raised|shoved)|I wanted to (?:size|bet|raise)|overbet|jam)\b/i;

const RANGE_WORDS = /\b(wide range|never has|always has|only (?:has|plays)|limps? (?:with )?(?:a )?(?:wide|weak)|calls? with anything|his range is)\b/i;

const extractors = [
  // Stack depth with a stated figure — most specific first.
  (clause) => {
    const m = clause.match(STACK_BB);
    if (!m) return null;
    return {
      kind: CLAIM_KIND.STACK_DEPTH,
      quantity: { value: parseNumber(m[1]), unit: 'bb' },
      comparator: 'approx',
    };
  },
  (clause) => (SHORT_WORDS.test(clause)
    ? { kind: CLAIM_KIND.STACK_DEPTH, comparator: 'lt' }
    : null),
  (clause) => (DEEP_WORDS.test(clause)
    ? { kind: CLAIM_KIND.STACK_DEPTH, comparator: 'gt' }
    : null),

  // Pot odds.
  (clause) => (PRICED_IN.test(clause)
    ? { kind: CLAIM_KIND.POT_ODDS, comparator: 'lt' }
    : null),
  (clause) => (BAD_PRICE.test(clause)
    ? { kind: CLAIM_KIND.POT_ODDS, comparator: 'gt' }
    : null),

  // Players live.
  (clause) => (HEADS_UP.test(clause)
    ? { kind: CLAIM_KIND.PLAYERS_LIVE, quantity: { value: 2, unit: 'players' } }
    : null),
  (clause) => {
    const m = clause.match(PLAYERS);
    if (!m) return null;
    const value = parseNumber(m[1]);
    return value === null
      ? null
      : { kind: CLAIM_KIND.PLAYERS_LIVE, quantity: { value, unit: 'players' } };
  },

  // Equity with a stated percentage.
  (clause) => {
    const m = clause.match(EQUITY_PCT);
    if (!m) return null;
    return {
      kind: CLAIM_KIND.EQUITY,
      quantity: { value: parseNumber(m[1]), unit: '%' },
      comparator: 'approx',
    };
  },

  (clause) => (SIZING.test(clause) ? { kind: CLAIM_KIND.SIZING } : null),
  (clause) => (RANGE_WORDS.test(clause) ? { kind: CLAIM_KIND.RANGE } : null),
];

/**
 * Extract claims from one segment.
 *
 * A clause may yield MORE THAN ONE claim — "they're short so they feel priced
 * in" asserts a stack depth and a price, and collapsing that to one claim would
 * check half of it and silently discard the other half. That compound shape is
 * the most common form real reasoning takes.
 *
 * @param {{text: string, context: object|null}} segment
 * @param {number} segmentIndex
 * @returns {{ claims: Array, unparsed: Array<string> }}
 */
export const extractFromSegment = (segment, segmentIndex = 0) => {
  const claims = [];
  const unparsed = [];

  for (const clause of splitClauses(segment?.text)) {
    let matched = false;
    for (const extract of extractors) {
      const partial = extract(clause);
      if (!partial) continue;
      matched = true;
      claims.push(makeClaim({
        ...partial,
        text: clause,
        segmentIndex,
        context: segment?.context ?? null,
      }));
    }
    if (!matched) unparsed.push(clause);
  }

  return { claims, unparsed };
};

/**
 * Extract across a whole note.
 *
 * `unparsed` is a first-class output. It is the honest measure of how much of a
 * note the parser understood, and the raw material for growing the lexicon
 * against real speech rather than invented examples.
 */
export const extractClaims = (note) => {
  const claims = [];
  const unparsed = [];
  const segments = note?.segments || [];

  segments.forEach((segment, index) => {
    const result = extractFromSegment(segment, index);
    claims.push(...result.claims);
    unparsed.push(...result.unparsed);
  });

  return {
    claims,
    unparsed,
    coverage: segments.length === 0
      ? 0
      : claims.length / (claims.length + unparsed.length || 1),
  };
};
