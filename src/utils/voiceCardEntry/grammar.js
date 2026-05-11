/**
 * voiceCardEntry/grammar.js — phonetic token table for Voice Card Entry (VCE)
 *
 * Maps spoken-form tokens from Web Speech transcripts to canonical poker
 * symbols. Authoring binding: WS-181 R5 (extended grammar w/ villain tokens) +
 * R6 (strict no-op for blank/short utterances enforced in parser, not here).
 *
 * The token set is intentionally narrow. Anything outside this table is a
 * parser warning, not an error. See `parser.js` for tolerance behavior.
 *
 * Surface spec: docs/design/surfaces/voice-card-entry.md
 */

import { RANKS, SUITS } from '../../constants/gameConstants';

// =============================================================================
// RANKS — 13 canonical tokens + phonetic variants
// =============================================================================
// RANKS in gameConstants is ['A','K','Q','J','T','9','8','7','6','5','4','3','2']
// Map each spoken form (lowercased, whitespace-stripped) to its canonical rank.

export const RANK_TOKENS = Object.freeze({
  // A
  ace: 'A',
  aces: 'A',
  ahce: 'A',
  // K
  king: 'K',
  kings: 'K',
  keng: 'K',
  // Q
  queen: 'Q',
  queens: 'Q',
  qween: 'Q',
  // J
  jack: 'J',
  jacks: 'J',
  // T (the rank "ten")
  ten: 'T',
  tens: 'T',
  '10': 'T',
  // 9
  nine: '9',
  nines: '9',
  '9': '9',
  // 8
  eight: '8',
  eights: '8',
  ate: '8',
  '8': '8',
  // 7
  seven: '7',
  sevens: '7',
  '7': '7',
  // 6
  six: '6',
  sicks: '6',
  '6': '6',
  // 5
  five: '5',
  fives: '5',
  '5': '5',
  // 4
  four: '4',
  for: '4',
  fore: '4',
  '4': '4',
  // 3
  three: '3',
  tree: '3',
  '3': '3',
  // 2
  two: '2',
  too: '2',
  to: '2',
  deuce: '2',
  deuces: '2',
  '2': '2',
});

// =============================================================================
// SUITS — 4 canonical tokens + phonetic variants
// =============================================================================
// SUITS in gameConstants is ['♠','♥','♦','♣'] using single-glyph symbols.

export const SUIT_TOKENS = Object.freeze({
  spades: '♠',
  spade: '♠',
  spaids: '♠',
  hearts: '♥',
  heart: '♥',
  harts: '♥',
  diamonds: '♦',
  diamond: '♦',
  dimonds: '♦',
  clubs: '♣',
  club: '♣',
  clubz: '♣',
  cloves: '♣',
});

// =============================================================================
// GLUE TOKEN — optional separator between rank and suit
// =============================================================================

export const GLUE_TOKENS = Object.freeze(new Set(['of']));

// =============================================================================
// VILLAIN DESIGNATORS (R5 advisory per D-1 surface decision)
// =============================================================================
// Two-token form: "player <N>". Single-token "<N>" never identifies a villain.
// Collision-resolution rule (R5 binding): the token `ten` is a villain
// designator ONLY if the immediately preceding token is `player`; otherwise
// it is the rank T.

export const VILLAIN_NUMBER_TOKENS = Object.freeze({
  one: 1,
  '1': 1,
  two: 2,
  too: 2,
  to: 2,
  '2': 2,
  three: 3,
  tree: 3,
  '3': 3,
  four: 4,
  for: 4,
  fore: 4,
  '4': 4,
  five: 5,
  '5': 5,
  six: 6,
  sicks: 6,
  '6': 6,
  seven: 7,
  '7': 7,
  eight: 8,
  ate: 8,
  '8': 8,
  nine: 9,
  '9': 9,
  ten: 10,
  '10': 10,
});

export const VILLAIN_PREFIX_TOKEN = 'player';

// =============================================================================
// SEQUENCE SEPARATORS — multi-villain delimiters (R5 advisory)
// =============================================================================
// Two recognized phrases. The parser must consume them as multi-token sequences.

export const SEPARATOR_PHRASES = Object.freeze([
  ['next', 'player'],
  ['and', 'then'],
]);

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Normalize a raw Web Speech transcript into a token array.
 * - Lowercase.
 * - Strip punctuation (keeps digits and ASCII letters; replaces all else with spaces).
 * - Collapse whitespace.
 * - Split on whitespace.
 *
 * Returns: string[]
 */
export function tokenize(transcript) {
  if (typeof transcript !== 'string') return [];
  const cleaned = transcript
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (cleaned.length === 0) return [];
  return cleaned.split(/\s+/);
}

/**
 * Returns true if `tokens` starting at `index` matches a separator phrase.
 * Returns `{ matched: boolean, length: number }`.
 */
export function matchSeparatorAt(tokens, index) {
  for (const phrase of SEPARATOR_PHRASES) {
    let ok = true;
    for (let i = 0; i < phrase.length; i++) {
      if (tokens[index + i] !== phrase[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { matched: true, length: phrase.length };
  }
  return { matched: false, length: 0 };
}

/**
 * Returns the canonical rank for a token, or null if not a rank token.
 * Honors the R5 collision rule: caller should NOT pass 'ten' if the previous
 * token was 'player' (handled in parser state machine).
 */
export function rankFor(token) {
  return RANK_TOKENS[token] ?? null;
}

/**
 * Returns the canonical suit symbol for a token, or null if not a suit token.
 */
export function suitFor(token) {
  return SUIT_TOKENS[token] ?? null;
}

/**
 * Returns the villain index (1-10) for a token, or null if not a villain-number
 * token. Caller is responsible for ensuring this token follows VILLAIN_PREFIX_TOKEN.
 */
export function villainNumberFor(token) {
  return VILLAIN_NUMBER_TOKENS[token] ?? null;
}

/**
 * Returns true if `token` is the glue token ("of").
 */
export function isGlue(token) {
  return GLUE_TOKENS.has(token);
}

// =============================================================================
// SANITY CHECK (dev-time only — exercised by grammar.test.js)
// =============================================================================
// RANK_TOKENS must cover every canonical rank from gameConstants.
// SUIT_TOKENS must cover every canonical suit.
// These are exported so tests can verify completeness.

export const CANONICAL_RANKS = RANKS;
export const CANONICAL_SUITS = SUITS;
