/**
 * voiceCardEntry/parser.js — transcript → cards for Voice Card Entry (VCE)
 *
 * Pure function. No side effects. No state.
 *
 * Pre-conditions (R6 strict no-op gate, binding):
 *   - transcript is a non-empty string
 *   - durationMs >= 500
 *   - confidence >= confidenceThreshold
 *   - parsed card count >= 1 (post-walk)
 *
 * Any pre-condition failure returns `null`. The hook treats `null` as
 * "PTT cycle was a no-op — render nothing."
 *
 * Surface spec: docs/design/surfaces/voice-card-entry.md
 */

import {
  tokenize,
  rankFor,
  suitFor,
  isGlue,
  matchSeparatorAt,
  villainNumberFor,
  VILLAIN_PREFIX_TOKEN,
} from './grammar';

/**
 * Parse a Web Speech transcript into a structured card payload.
 *
 * @param {string} transcript
 * @param {object} options
 * @param {number} options.durationMs            — utterance length in ms (R6 gate)
 * @param {number} options.confidence            — Web Speech result confidence 0..1
 * @param {number} options.confidenceThreshold   — owner-configured floor (R6 gate)
 *
 * @returns {null | {
 *   cards: string[],                                  // canonical 2-char card strings ("A♥") in order
 *   villainAssignments: Map<number, string[]>,        // villainIndex (1..10) → 2 cards (advisory per D-1)
 *   warnings: string[]                                // human-readable diagnostics
 * }}
 */
export function parseTranscript(transcript, options = {}) {
  const {
    durationMs = 0,
    confidence = 0,
    confidenceThreshold = 0.65,
  } = options;

  // R6 pre-condition gate: empty / short / low-confidence ⇒ strict no-op
  if (typeof transcript !== 'string' || transcript.trim().length === 0) {
    return null;
  }
  if (durationMs < 500) return null;
  if (confidence < confidenceThreshold) return null;

  const tokens = tokenize(transcript);
  if (tokens.length === 0) return null;

  const cards = [];
  const villainAssignments = new Map();
  const warnings = [];

  // State machine. We walk tokens left-to-right.
  //
  // States:
  //   IDLE                 — expecting next meaningful token (rank, "player", separator, or noise)
  //   AFTER_PLAYER         — last token was "player"; expect a villain-number token
  //   AFTER_RANK           — emitted a rank; expect "of" or a suit
  //   AFTER_RANK_AFTER_OF  — saw rank then "of"; expect a suit
  //
  // The `currentVillain` value is metadata stamped onto any subsequent
  // card emitted. Per D-1 (per-villain PTT) + R5 advisory: villain tokens
  // in the utterance are only useful for the rare case the hook hands a
  // raw multi-villain transcript through, which the hook does NOT do in
  // the per-villain PTT surface flow. We still parse them robustly.

  let state = 'IDLE';
  let pendingRank = null;
  let currentVillain = null;     // villain index this card group belongs to (advisory)
  let pendingVillainCards = [];  // cards accumulated for currentVillain in this group

  // commit pending villain group (called on separator or end of stream)
  const flushVillainGroup = () => {
    if (currentVillain !== null && pendingVillainCards.length > 0) {
      const existing = villainAssignments.get(currentVillain) || [];
      villainAssignments.set(currentVillain, [...existing, ...pendingVillainCards]);
      pendingVillainCards = [];
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    // Separator detection always runs first (two-token phrases).
    const sep = matchSeparatorAt(tokens, i);
    if (sep.matched) {
      // Any in-flight pendingRank is abandoned; warn the user.
      if (pendingRank !== null) {
        warnings.push(`Dangling rank '${pendingRank}' dropped at separator '${tokens.slice(i, i + sep.length).join(' ')}'`);
        pendingRank = null;
      }
      flushVillainGroup();
      currentVillain = null; // separator resets villain context
      state = 'IDLE';
      i += sep.length - 1; // -1 because for-loop will increment
      continue;
    }

    switch (state) {
      case 'IDLE': {
        if (tok === VILLAIN_PREFIX_TOKEN) {
          flushVillainGroup();
          currentVillain = null;
          state = 'AFTER_PLAYER';
          continue;
        }
        // R5 binding: 'ten' is a rank by default; only a villain designator
        // when preceded by 'player' (handled in AFTER_PLAYER branch below).
        const r = rankFor(tok);
        if (r !== null) {
          pendingRank = r;
          state = 'AFTER_RANK';
          continue;
        }
        // Bare suit without rank — discard with a warning.
        if (suitFor(tok) !== null) {
          warnings.push(`Suit '${tok}' without preceding rank — ignored`);
          continue;
        }
        // Glue without rank — discard quietly (likely Web Speech filler).
        if (isGlue(tok)) continue;
        // Anything else: unknown token, log warning, continue.
        warnings.push(`Unknown token: '${tok}'`);
        continue;
      }

      case 'AFTER_PLAYER': {
        // The token that follows "player" MUST be a villain-number token.
        // Per R5 collision rule, 'ten' lands here as a villain designator.
        const v = villainNumberFor(tok);
        if (v !== null) {
          flushVillainGroup();
          currentVillain = v;
          pendingVillainCards = [];
          state = 'IDLE';
          continue;
        }
        // Bad villain designator (e.g., "player chips"). Warn and resync.
        warnings.push(`Expected villain number after 'player', got '${tok}'`);
        state = 'IDLE';
        // Re-process this token as IDLE on the next loop iteration.
        i--;
        continue;
      }

      case 'AFTER_RANK': {
        if (isGlue(tok)) {
          state = 'AFTER_RANK_AFTER_OF';
          continue;
        }
        const s = suitFor(tok);
        if (s !== null) {
          const card = `${pendingRank}${s}`;
          cards.push(card);
          if (currentVillain !== null) pendingVillainCards.push(card);
          pendingRank = null;
          state = 'IDLE';
          continue;
        }
        // Another rank arrives before we got a suit — abandon the prior rank.
        const r = rankFor(tok);
        if (r !== null) {
          warnings.push(`Rank '${pendingRank}' dropped — no suit before next rank '${r}'`);
          pendingRank = r;
          // stay in AFTER_RANK
          continue;
        }
        if (tok === VILLAIN_PREFIX_TOKEN) {
          warnings.push(`Rank '${pendingRank}' dropped — encountered 'player' before suit`);
          pendingRank = null;
          flushVillainGroup();
          currentVillain = null;
          state = 'AFTER_PLAYER';
          continue;
        }
        // Unknown token between rank and suit — log and stay in state.
        warnings.push(`Unknown token between rank and suit: '${tok}'`);
        continue;
      }

      case 'AFTER_RANK_AFTER_OF': {
        const s = suitFor(tok);
        if (s !== null) {
          const card = `${pendingRank}${s}`;
          cards.push(card);
          if (currentVillain !== null) pendingVillainCards.push(card);
          pendingRank = null;
          state = 'IDLE';
          continue;
        }
        // 'of' was followed by something that isn't a suit — abandon.
        warnings.push(`Expected suit after 'of', got '${tok}' — rank '${pendingRank}' dropped`);
        pendingRank = null;
        state = 'IDLE';
        i--; // re-process tok in IDLE state
        continue;
      }

      default:
        // Defensive: unknown state. Reset.
        state = 'IDLE';
        break;
    }
  }

  // End-of-stream cleanup.
  if (pendingRank !== null) {
    warnings.push(`Trailing rank '${pendingRank}' dropped — no suit followed`);
  }
  flushVillainGroup();

  // R6 post-condition: at least 1 card parsed
  if (cards.length === 0) return null;

  return { cards, villainAssignments, warnings };
}
