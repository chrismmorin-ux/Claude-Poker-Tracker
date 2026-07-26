/**
 * phhAdapter.mjs — WS-273. Converts PHH-format corpus hands into the app's hand shape.
 *
 * The backtest harness must run the ACTUAL production engine modules
 * (`decisionAccumulator`, `villainDecisionModel`, `rangeEngine`). Anything else
 * would score a different model and the number would be worthless. That makes
 * this adapter the load-bearing piece: everything downstream is only as faithful
 * as the hand records it emits.
 *
 * SOURCE FORMAT (uoftcprg/phh-dataset, HandHQ subset — see phh_miner.py for the
 * mining-side reader):
 *
 *   variant = 'NT'
 *   blinds_or_straddles = [0.25, 0.50, 0, 0, 0]
 *   actions = ['d dh p1 ????', 'p3 f', 'p4 cbr 1.50', 'd db 3c6hKc', 'p2 sm 3d6c', ...]
 *   seats = [3, 4, 6, 1, 2]
 *   players = ['GSig8Jfjwt...', ...]
 *
 * `p1` is `players[0]`, and PHH lists players in BLIND ORDER — index 0 posts the
 * small blind, index 1 the big blind, and the LAST index is the button. That
 * ordering is what lets us recover position without trusting the raw seat numbers.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SEAT EMBEDDING — the one genuinely lossy step, documented deliberately.
 *
 * The app models a 9-seat table and derives every position label from
 * `(seat - buttonSeat) mod 9` (`positionUtils.getPositionName`). Corpus tables
 * are 5-, 6-, or 9-handed with arbitrary seat numbers and gaps, so feeding raw
 * seat numbers through that arithmetic would produce labels corresponding to
 * neither the corpus table nor a real app table — pure noise on the `posCategory`
 * dimension of the situation key.
 *
 * We therefore RIGHT-ALIGN the table to the button:
 *
 *   SB              → seat 1  (offset 1)
 *   BB              → seat 2  (offset 2)
 *   button          → seat 9  (offset 0)
 *   everyone else   → seats packed BACKWARDS from the button, so the player
 *                     immediately before the button is always CO (offset 8),
 *                     the one before that HJ (7), and so on.
 *
 * Consequences, stated plainly:
 *   - 9-handed tables map EXACTLY onto the app's 9-max position names.
 *   - Short tables keep SB / BB / BTN / CO / HJ exact, and the remaining early
 *     seats land on the nearest 9-max name. A 6-max table reads
 *     SB, BB, MP2, HJ, CO, BTN.
 *   - Distance-to-button is preserved for every seat, which is what actually
 *     drives strategy (POKER_THEORY §7.2 — position labels are proxies for
 *     players-behind and postflop order, both of which survive this mapping).
 *   - `isInPosition` is exact for all table sizes: it compares offsets, and
 *     offsets stay monotone in action order.
 *
 * Tables with more than 9 dealt-in players cannot be embedded and are skipped.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HOLE CARDS ARE HIDDEN pre-showdown (`d dh p1 ????`) and that is CORRECT, not a
 * gap. The villain decision model predicts from situation context and never from
 * villain hole cards. Showdown cards (`sm`) feed range anchors exactly as they do
 * in the live app.
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';

/** PHH suit letters → the app's canonical Unicode suits (gameConstants.SUITS). */
const SUIT_MAP = { s: '♠', h: '♥', d: '♦', c: '♣' };

const VALID_RANKS = new Set(['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']);

const STREETS = ['preflop', 'flop', 'turn', 'river'];

/** Board length after a deal → the street that board length represents. */
const STREET_FOR_BOARD_LENGTH = { 0: 'preflop', 3: 'flop', 4: 'turn', 5: 'river' };

/** Why a raw hand was not converted. Counted and reported, never silently dropped. */
export const SKIP_REASONS = {
  NON_NT_VARIANT: 'non-nt-variant',
  MALFORMED: 'malformed',
  TOO_FEW_PLAYERS: 'too-few-players',
  TOO_MANY_PLAYERS: 'too-many-players',
  HEADS_UP: 'heads-up',
  NON_STANDARD_BLINDS: 'non-standard-blinds',
  UNPARSEABLE_ACTION: 'unparseable-action',
};

const EPSILON = 1e-9;

// =============================================================================
// CARD PARSING
// =============================================================================

/**
 * '3c6hKc' → ['3♣', '6♥', 'K♣'].
 * Returns null if any pair is unparseable, so a malformed board fails the hand
 * rather than silently truncating the runout.
 *
 * @param {string} str
 * @returns {string[]|null}
 */
export const parsePhhCards = (str) => {
  if (typeof str !== 'string' || str.length === 0 || str.length % 2 !== 0) return null;
  const out = [];
  for (let i = 0; i < str.length; i += 2) {
    const rank = str[i].toUpperCase();
    const suit = SUIT_MAP[str[i + 1].toLowerCase()];
    if (!VALID_RANKS.has(rank) || !suit) return null;
    out.push(rank + suit);
  }
  return out;
};

// =============================================================================
// RAW PHH PARSING
// =============================================================================

const parseBracketList = (value) => {
  const open = value.indexOf('[');
  const close = value.lastIndexOf(']');
  if (open === -1 || close === -1 || close < open) return null;
  const body = value.slice(open + 1, close).trim();
  if (body === '') return [];
  return body.split(',').map(t => t.trim().replace(/^['"]|['"]$/g, ''));
};

const parseNumberList = (value) => {
  const list = parseBracketList(value);
  if (!list) return null;
  const nums = list.map(Number);
  return nums.some(n => !Number.isFinite(n)) ? null : nums;
};

/** Keys we need. Everything else in the record is ignored. */
const WANTED_KEYS = new Set([
  'variant', 'antes', 'blinds_or_straddles', 'actions',
  'seats', 'seat_count', 'players', 'hand', 'starting_stacks',
]);

/**
 * Parse a single `key = value` line into the raw hand accumulator.
 *
 * Split on the FIRST '=' and trim the key rather than matching line prefixes:
 * `seats` and `seat_count` share a prefix, and prefix matching silently assigns
 * one to the other depending on check order.
 */
const applyLine = (raw, line) => {
  const eq = line.indexOf('=');
  if (eq === -1) return;
  const key = line.slice(0, eq).trim();
  if (!WANTED_KEYS.has(key)) return;
  const value = line.slice(eq + 1).trim();

  switch (key) {
    case 'variant':
      raw.variant = value.replace(/^['"]|['"]$/g, '');
      break;
    case 'antes':
      raw.antes = parseNumberList(value);
      break;
    case 'blinds_or_straddles':
      raw.blinds = parseNumberList(value);
      break;
    case 'starting_stacks':
      raw.startingStacks = parseNumberList(value);
      break;
    case 'actions':
      raw.actions = parseBracketList(value);
      break;
    case 'seats':
      raw.seats = parseNumberList(value);
      break;
    case 'seat_count':
      raw.seatCount = Number(value);
      break;
    case 'players':
      raw.players = parseBracketList(value);
      break;
    case 'hand':
      raw.handId = Number(value);
      break;
    default:
      break;
  }
};

/**
 * Stream raw hand records out of a `.phhs` file.
 *
 * Streaming rather than slurping: a single corpus file is tens of MB and a full
 * stake directory is gigabytes.
 *
 * @param {string} filePath
 * @yields {Object} raw hand record
 */
export async function* iterPhhHands(filePath) {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let raw = null;
  for await (const line of rl) {
    if (line.startsWith('[')) {
      if (raw) yield raw;
      raw = {};
      continue;
    }
    if (raw) applyLine(raw, line);
  }
  if (raw) yield raw;
}

// =============================================================================
// SEAT EMBEDDING
// =============================================================================

/**
 * Map a blind-order player index onto an app seat, right-aligned to the button.
 * See the file header for the full rationale and its limits.
 *
 * @param {number} i - 0-based index into `players` (0 = SB, 1 = BB, n-1 = button)
 * @param {number} n - dealt-in player count (3..9)
 * @returns {number} app seat 1-9
 */
export const appSeatForIndex = (i, n) => {
  if (i === 0) return 1;                 // SB  → offset 1
  if (i === 1) return 2;                 // BB  → offset 2
  if (i === n - 1) return 9;             // BTN → offset 0
  return i + 10 - n;                     // packed backwards from CO (offset 8)
};

/** The button always lands on seat 9 under this embedding. */
export const BUTTON_SEAT = 9;

// =============================================================================
// HAND CONVERSION
// =============================================================================

/**
 * Convert one raw PHH record into the app's hand shape.
 *
 * Action labels are DERIVED from betting state, never read off the token — the
 * same doctrine `recordSeatAction.js` enforces in the live app (WS-182):
 *   `cbr` with no live bet → BET,   otherwise → RAISE
 *   `cc`  with nothing owed → CHECK, otherwise → CALL
 * Preflop the live bet starts at the big blind, so an open is a RAISE and a BB
 * option is a CHECK — matching `recordSeatAction.effectiveCurrentBet`.
 *
 * Amounts follow the app's convention exactly (`buildSeatActionPayload`):
 *   BET / RAISE → `amount` is the TOTAL street commitment (the "raise to" number)
 *   CALL        → `amount` is the amount owed and actually called
 *   CHECK/FOLD  → no `amount` field
 *
 * @param {Object} raw - from iterPhhHands
 * @param {Object} [meta] - { site, stakeLabel, bb } passed through for slicing
 * @returns {{ hand: Object }|{ skip: string }}
 */
export const toAppHand = (raw, meta = {}) => {
  if (!raw || typeof raw !== 'object') return { skip: SKIP_REASONS.MALFORMED };
  if (raw.variant !== 'NT') return { skip: SKIP_REASONS.NON_NT_VARIANT };

  const { actions, blinds, players } = raw;
  if (!Array.isArray(actions) || !Array.isArray(blinds) || !Array.isArray(players)) {
    return { skip: SKIP_REASONS.MALFORMED };
  }

  const n = players.length;
  if (n === 2) return { skip: SKIP_REASONS.HEADS_UP };
  if (n < 3) return { skip: SKIP_REASONS.TOO_FEW_PLAYERS };
  if (n > 9) return { skip: SKIP_REASONS.TOO_MANY_PLAYERS };

  // Exactly two posted blinds, at indices 0 and 1. Anything else is a straddle
  // or a non-standard structure; the app models straddles as a distinct
  // primitive and conflating them with blinds would corrupt preflop line tags.
  const posted = blinds.slice(0, n);
  const nonZero = posted.map((v, i) => (v > EPSILON ? i : -1)).filter(i => i !== -1);
  if (nonZero.length !== 2 || nonZero[0] !== 0 || nonZero[1] !== 1) {
    return { skip: SKIP_REASONS.NON_STANDARD_BLINDS };
  }
  const sb = posted[0];
  const bb = posted[1];
  if (!(bb > sb)) return { skip: SKIP_REASONS.NON_STANDARD_BLINDS };

  const seatOf = (playerIndex) => appSeatForIndex(playerIndex, n);

  const seatPlayers = {};
  for (let i = 0; i < n; i++) seatPlayers[seatOf(i)] = players[i];

  // ---- betting-state walk ----
  const antes = Array.isArray(raw.antes) ? raw.antes : [];
  let pot = antes.reduce((s, a) => s + (a > 0 ? a : 0), 0) + sb + bb;

  const committed = new Array(n).fill(0);       // this street only
  const totalCommitted = new Array(n).fill(0);  // whole hand, for remaining stacks
  committed[0] = sb;
  committed[1] = bb;
  totalCommitted[0] = sb;
  totalCommitted[1] = bb;
  let currentBet = bb;

  const startingStacks = Array.isArray(raw.startingStacks) ? raw.startingStacks : null;

  const board = [];
  let street = 'preflop';

  const actionSequence = [];
  const showdownCards = {};
  let order = 0;

  // Backtest-only side tables. Kept OUT of `gameState` so the engine-facing hand
  // shape stays exactly what the app produces, while the harness still gets the
  // pot and stack context it needs for the SPR-zone slice.
  const potBeforeByOrder = {};
  const streetByOrder = {};
  const stackBeforeByOrder = {};

  for (const token of actions) {
    const parts = token.trim().split(/\s+/);
    if (parts.length === 0) continue;

    // Dealer tokens: 'd dh pN ????' (hole cards, always hidden) and
    // 'd db <cards>' (board). Street is derived from cumulative board length,
    // never from a deal counter — an all-in runout deals the remaining streets
    // after the last betting action and after `sm` reveals.
    if (parts[0] === 'd') {
      if (parts[1] === 'db') {
        const dealt = parsePhhCards(parts[2] ?? '');
        if (!dealt) return { skip: SKIP_REASONS.UNPARSEABLE_ACTION };
        board.push(...dealt);
        const next = STREET_FOR_BOARD_LENGTH[board.length];
        if (!next) return { skip: SKIP_REASONS.UNPARSEABLE_ACTION };
        street = next;
        committed.fill(0);
        currentBet = 0;
      }
      continue;
    }

    const m = /^p(\d+)$/.exec(parts[0]);
    if (!m) return { skip: SKIP_REASONS.UNPARSEABLE_ACTION };
    const pi = Number(m[1]) - 1;
    if (!Number.isInteger(pi) || pi < 0 || pi >= n) {
      return { skip: SKIP_REASONS.UNPARSEABLE_ACTION };
    }
    const verb = parts[1];
    const seat = seatOf(pi);

    if (verb === 'sm') {
      const shown = parts[2] ? parsePhhCards(parts[2]) : null;
      if (shown) showdownCards[seat] = shown;
      continue;
    }

    const owed = currentBet - committed[pi];
    // Pot as it stood when this seat had to decide — the SPR denominator — and
    // the seat's own remaining stack, its numerator.
    potBeforeByOrder[order] = Number(pot.toFixed(2));
    streetByOrder[order] = street;
    if (startingStacks && Number.isFinite(startingStacks[pi])) {
      stackBeforeByOrder[order] = Number((startingStacks[pi] - totalCommitted[pi]).toFixed(2));
    }

    if (verb === 'f') {
      actionSequence.push({ order: order++, seat, action: PRIMITIVE_ACTIONS.FOLD, street });
      continue;
    }

    if (verb === 'cc') {
      if (owed > EPSILON) {
        actionSequence.push({
          order: order++, seat, action: PRIMITIVE_ACTIONS.CALL, street, amount: owed,
        });
        pot += owed;
        committed[pi] = currentBet;
        totalCommitted[pi] += owed;
      } else {
        actionSequence.push({ order: order++, seat, action: PRIMITIVE_ACTIONS.CHECK, street });
      }
      continue;
    }

    if (verb === 'cbr') {
      const raiseTo = Number(parts[2]);
      if (!Number.isFinite(raiseTo) || raiseTo <= 0) {
        return { skip: SKIP_REASONS.UNPARSEABLE_ACTION };
      }
      const isBet = currentBet <= EPSILON;
      actionSequence.push({
        order: order++,
        seat,
        action: isBet ? PRIMITIVE_ACTIONS.BET : PRIMITIVE_ACTIONS.RAISE,
        street,
        amount: raiseTo,
      });
      const increment = raiseTo - committed[pi];
      pot += increment;
      committed[pi] = raiseTo;
      totalCommitted[pi] += increment;
      currentBet = raiseTo;
      continue;
    }

    return { skip: SKIP_REASONS.UNPARSEABLE_ACTION };
  }

  return {
    hand: {
      handId: raw.handId ?? null,
      seatPlayers,
      gameState: {
        actionSequence,
        dealerButtonSeat: BUTTON_SEAT,
        mySeat: null,          // corpus hands have no hero
        communityCards: board,
        showdownCards,
        currentStreet: street,
        // Final total pot. The app stores a single live `potSize`; the engine's
        // bet-fraction stream divides by it, so this inherits the app's existing
        // approximation rather than inventing a different one. It does not enter
        // the action distributions this harness scores.
        potSize: Number(pot.toFixed(2)),
        blinds: { sb, bb },
      },
      // Backtest-only provenance. Ignored by the engine; used for slicing.
      _backtest: {
        site: meta.site ?? null,
        stakeLabel: meta.stakeLabel ?? null,
        bb,
        dealtIn: n,
        seatCount: Number.isFinite(raw.seatCount) ? raw.seatCount : n,
        playerIndexBySeat: Object.fromEntries(
          Array.from({ length: n }, (_, i) => [seatOf(i), i]),
        ),
        // Per-decision context for the SPR-zone slice. `stackBefore` is the
        // ACTING seat's own remaining stack, not the multiway effective stack —
        // a documented approximation, adequate for zone bucketing.
        potBeforeByOrder,
        stackBeforeByOrder,
        streetByOrder,
      },
    },
  };
};

/**
 * Stream converted app hands out of a `.phhs` file, tallying skips by reason.
 *
 * @param {string} filePath
 * @param {Object} [meta] - { site, stakeLabel }
 * @returns {AsyncGenerator<Object>} app-shaped hands
 */
export async function* iterAppHands(filePath, meta = {}, stats = null) {
  for await (const raw of iterPhhHands(filePath)) {
    const result = toAppHand(raw, meta);
    if (result.skip) {
      if (stats) stats[result.skip] = (stats[result.skip] || 0) + 1;
      continue;
    }
    if (stats) stats.converted = (stats.converted || 0) + 1;
    yield result.hand;
  }
}
