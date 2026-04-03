/**
 * shared/protocol.js — Ignition WebSocket protocol parser and decoders
 *
 * Pure functions. No state, no side effects.
 * Decodes the byteLength|JSON wire format and converts Ignition's
 * numeric encodings to the main app's string formats.
 *
 * Reference: spike-data/SPIKE_REPORT.md
 */

// ===========================================================================
// CONSTANTS
// ===========================================================================

const GAME_WS_URL = 'pkscb.ignitioncasino.eu/poker-games/rgs';
const LOBBY_WS_URL = '/ws-gateway/lobby';

// All known message PIDs from the game WebSocket
export const PID = {
  // Hand lifecycle
  PLAY_STAGE_INFO: 'PLAY_STAGE_INFO',
  PLAY_CLEAR_INFO: 'PLAY_CLEAR_INFO',
  PLAY_STAGE_END_REQ: 'PLAY_STAGE_END_REQ',
  PLAY_STAGE_END_RES: 'PLAY_STAGE_END_RES',
  PLAY_ACCOUNT_INFO: 'PLAY_ACCOUNT_INFO',

  // Table state
  CO_TABLE_STATE: 'CO_TABLE_STATE',
  CO_DEALER_SEAT: 'CO_DEALER_SEAT',
  CO_SIT_PLAY: 'CO_SIT_PLAY',

  // Blinds
  CO_BLIND_INFO: 'CO_BLIND_INFO',

  // Cards
  CO_CARDTABLE_INFO: 'CO_CARDTABLE_INFO',
  CO_BCARD3_INFO: 'CO_BCARD3_INFO',
  CO_BCARD1_INFO: 'CO_BCARD1_INFO',
  CO_CARDHAND_INFO: 'CO_CARDHAND_INFO',
  CO_RABBITCARD_INFO: 'CO_RABBITCARD_INFO',

  // Actions
  CO_CURRENT_PLAYER: 'CO_CURRENT_PLAYER',
  CO_SELECT_REQ: 'CO_SELECT_REQ',
  CO_SELECT_INFO: 'CO_SELECT_INFO',
  CO_SELECT_RES_V2: 'CO_SELECT_RES_V2',
  CO_SELECT_SPEED_BTN: 'CO_SELECT_SPEED_BTN',

  // Pot & chips
  CO_CHIPTABLE_INFO: 'CO_CHIPTABLE_INFO',

  // Showdown & results
  CO_PCARD_INFO: 'CO_PCARD_INFO',
  CO_SHOW_INFO: 'CO_SHOW_INFO',
  CO_RESULT_INFO: 'CO_RESULT_INFO',
  CO_POT_INFO: 'CO_POT_INFO',
  CO_LAST_HAND_NUMBER: 'CO_LAST_HAND_NUMBER',

  // Table info & options
  CO_TABLE_INFO: 'CO_TABLE_INFO',
  CO_OPTION_INFO: 'CO_OPTION_INFO',

  // Seat & account
  PLAY_SEAT_INFO: 'PLAY_SEAT_INFO',

  // Tournament-specific
  PLAY_TOUR_STAGENUMBER: 'PLAY_TOUR_STAGENUMBER',
  PLAY_TOUR_LEVEL_INFO: 'PLAY_TOUR_LEVEL_INFO',
  PLAY_TOUR_PRIZE_INFO_V4: 'PLAY_TOUR_PRIZE_INFO_V4',
  TCO_ANTE_INFO_ALL: 'TCO_ANTE_INFO_ALL',
  CO_BOUNTYRESULT_INFO: 'CO_BOUNTYRESULT_INFO',
  CO_TABLE_UPDATES: 'CO_TABLE_UPDATES',

  // Timing
  PLAY_TIME_INFO: 'PLAY_TIME_INFO',
  LATENCY_REPORT: 'LATENCY_REPORT',

  // Heartbeat
  PING: 'PING',
  PONG: 'PONG',
};

// Card decoding lookup tables
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const SUITS = ['c', 'd', 'h', 's'];
export const FACE_DOWN = 32896; // 0x8080

// Action bitmask values
export const ACTION_BITS = {
  CHECK: 64,    // 0x40
  BET: 128,     // 0x80
  CALL: 256,    // 0x100
  RAISE: 512,   // 0x200
  FOLD: 1024,   // 0x400
};

// Blind type bitmask
const BLIND_BITS = {
  SB: 2,
  BB: 4,
  POSTED: 8,
};

// Show/muck bitmask
const SHOW_BITS = {
  SHOW: 8192,   // 0x2000
  MUCK: 32768,  // 0x8000
};

// CO_TABLE_STATE values → street names
export const TABLE_STATE_MAP = {
  0: 'reset',
  2: 'setup',
  4: 'blinds',
  8: 'preflop',
  16: 'flop',
  32: 'turn',
  64: 'river',
  4096: 'showdown',    // Tournament showdown (0x1000)
  8192: 'results',     // Tournament results (0x2000)
  32768: 'showdown',   // Cash game showdown (0x8000)
  65536: 'results',    // Cash game results (0x10000)
};

// ===========================================================================
// TOURNAMENT MESSAGE DETECTION
// ===========================================================================

/** Keywords that suggest a message contains tournament-relevant data. */
const TOURNAMENT_KEYWORDS = [
  'tournament', 'tourney', 'blind', 'level', 'player', 'elimination',
  'registration', 'status', 'payout', 'prize', 'rebuy', 'addon',
  'break', 'table', 'seat', 'stack', 'ante', 'remaining', 'bust',
  'knockout', 'bounty',
];

/**
 * Check if a parsed JSON object likely contains tournament data.
 * @param {object} obj - Parsed JSON from a non-game WebSocket message
 * @returns {boolean}
 */
export const isTournamentRelated = (obj) => {
  if (!obj || typeof obj !== 'object') return false;
  const keyStr = Object.keys(obj).join(' ').toLowerCase();
  return TOURNAMENT_KEYWORDS.some(kw => keyStr.includes(kw));
};

// ===========================================================================
// MESSAGE PARSER
// ===========================================================================

/**
 * Extract a domain message from a parsed JSON object.
 * @param {object} parsed - Parsed JSON from a WebSocket frame segment
 * @returns {{ seq: number, tDiff: number, pid: string, payload: object, lobby?: boolean } | null}
 */
const _extractMessage = (parsed) => {
  if (!parsed || typeof parsed !== 'object') return null;

  // Game messages have seq + tDiff + data.pid structure
  if (parsed.data && parsed.data.pid) {
    const { pid, ...payload } = parsed.data;
    return {
      seq: parsed.seq || 0,
      tDiff: parsed.tDiff || 0,
      pid,
      payload,
    };
  }

  // Lobby/non-game messages — check for tournament-relevant data
  if (isTournamentRelated(parsed)) {
    return {
      seq: 0,
      tDiff: 0,
      pid: '__LOBBY__',
      payload: parsed,
      lobby: true,
    };
  }

  return null;
};

/**
 * Parse an Atmosphere-batched WebSocket frame into an array of messages.
 *
 * Atmosphere with TrackMessageSize=true sends frames as:
 *   <byteLen1>|<json1><byteLen2>|<json2>...
 *
 * The byteLength prefix may not exactly match JS string length (encoding
 * differences), so we use it as a hint and fall back to brace-scanning
 * when JSON.parse fails at the hinted offset.
 *
 * @param {string} raw - Raw WebSocket frame string (may contain multiple messages)
 * @returns {Array<{ seq: number, tDiff: number, pid: string, payload: object }>}
 */
export const parseWsBatch = (raw) => {
  if (!raw || typeof raw !== 'string') return [];

  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];

  const results = [];
  let cursor = 0;

  while (cursor < trimmed.length) {
    // Skip whitespace between segments
    while (cursor < trimmed.length && trimmed[cursor] === ' ') cursor++;
    if (cursor >= trimmed.length) break;

    const pipeIndex = trimmed.indexOf('|', cursor);

    // No pipe found — try bare JSON for remainder
    if (pipeIndex < 0) {
      try {
        const parsed = JSON.parse(trimmed.substring(cursor));
        const msg = _extractMessage(parsed);
        if (msg) results.push(msg);
      } catch (_) { /* malformed remainder, skip */ }
      break;
    }

    const prefix = trimmed.substring(cursor, pipeIndex);
    const byteLen = parseInt(prefix, 10);

    // Non-numeric prefix — fall back to old single-message parse (everything after first pipe)
    if (isNaN(byteLen)) {
      try {
        const parsed = JSON.parse(trimmed.substring(pipeIndex + 1));
        const msg = _extractMessage(parsed);
        if (msg) results.push(msg);
      } catch (_) { /* malformed, skip */ }
      break;
    }

    // Empty segment (e.g., "0|") — skip
    if (byteLen === 0) {
      cursor = pipeIndex + 1;
      continue;
    }

    const jsonStart = pipeIndex + 1;

    // Find the actual end of this JSON object by scanning for balanced braces.
    // byteLen is a hint but may not match JS char count exactly.
    const jsonEnd = _findJsonEnd(trimmed, jsonStart);
    if (jsonEnd < 0) {
      // Can't find valid JSON boundary — try parsing remainder and stop
      try {
        const parsed = JSON.parse(trimmed.substring(jsonStart));
        const msg = _extractMessage(parsed);
        if (msg) results.push(msg);
      } catch (_) { /* skip */ }
      break;
    }

    try {
      const parsed = JSON.parse(trimmed.substring(jsonStart, jsonEnd));
      const msg = _extractMessage(parsed);
      if (msg) results.push(msg);
    } catch (_) { /* malformed segment, continue to next */ }

    cursor = jsonEnd;
  }

  return results;
};

/**
 * Find the end index of a JSON object starting at `start` in `str`.
 * Tracks brace depth, respects string literals. Returns -1 if no match.
 */
const _findJsonEnd = (str, start) => {
  if (start >= str.length || str[start] !== '{') return -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i + 1; }
  }
  return -1; // unbalanced
};

/**
 * Parse an incoming WebSocket message from the game server.
 * Backwards-compatible wrapper — returns the first message from a batch, or null.
 *
 * @param {string} raw - Raw WebSocket message string
 * @returns {{ seq: number, tDiff: number, pid: string, payload: object } | null}
 */
export const parseWsMessage = (raw) => {
  const batch = parseWsBatch(raw);
  return batch.length > 0 ? batch[0] : null;
};

// ===========================================================================
// CARD DECODER
// ===========================================================================

/**
 * Decode an Ignition card integer to our string format.
 *
 * @param {number} n - Card integer (0-51) or 32896 for face-down
 * @returns {string} Card string like 'Ah', 'Td', '2c' or '' for face-down/invalid
 */
export const decodeCard = (n) => {
  if (n === FACE_DOWN || n === null || n === undefined) return '';
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 51) return '';

  const rankIdx = n % 13;
  const suitIdx = Math.floor(n / 13);
  if (suitIdx >= SUITS.length) return '';

  return RANKS[rankIdx] + SUITS[suitIdx];
};

// ===========================================================================
// ACTION DECODER
// ===========================================================================

/**
 * Decode an action bitmask to a primitive action string.
 * Priority: fold > raise > call > bet > check
 *
 * @param {number} btn - Action bitmask from CO_SELECT_INFO.btn
 * @returns {string|null} 'check'|'bet'|'call'|'raise'|'fold' or null
 */
export const decodeAction = (btn) => {
  if (typeof btn !== 'number') return null;
  if (btn & ACTION_BITS.FOLD) return 'fold';
  if (btn & ACTION_BITS.RAISE) return 'raise';
  if (btn & ACTION_BITS.CALL) return 'call';
  if (btn & ACTION_BITS.BET) return 'bet';
  if (btn & ACTION_BITS.CHECK) return 'check';
  return null;
};

// ===========================================================================
// BLIND TYPE DECODER
// ===========================================================================

/**
 * Decode blind type from CO_BLIND_INFO.btn
 * @param {number} btn - Blind bitmask
 * @returns {'sb'|'bb'|'posted'|null}
 */
export const decodeBlindType = (btn) => {
  if (typeof btn !== 'number') return null;
  if (btn & BLIND_BITS.POSTED) return 'posted';
  if (btn & BLIND_BITS.BB) return 'bb';
  if (btn & BLIND_BITS.SB) return 'sb';
  return null;
};

// ===========================================================================
// STREET MAPPER
// ===========================================================================

/**
 * Map CO_TABLE_STATE value to street name.
 * @param {number} state - Table state bitmask value
 * @returns {string|null}
 */
export const mapStreet = (state) => {
  return TABLE_STATE_MAP[state] || null;
};

// ===========================================================================
// SHOW/MUCK DECODER
// ===========================================================================

/**
 * Decode show/muck action from CO_SHOW_INFO.btn
 * @param {number} btn - Show action bitmask
 * @returns {'show'|'muck'}
 */
export const decodeShowAction = (btn) => {
  if (typeof btn !== 'number') return 'muck';
  if (btn & SHOW_BITS.SHOW) return 'show';
  return 'muck';
};

// ===========================================================================
// URL FILTER
// ===========================================================================

/**
 * Check if a WebSocket URL is a game server (not lobby/other).
 * Uses multiple patterns for resilience against URL changes.
 */
export const isGameWsUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  if (url.includes(GAME_WS_URL)) return true;
  if (url.includes('/poker-games/') || url.includes('/rgs')) return true;
  // Lobby WebSocket carries game messages multiplexed with lobby traffic
  if (url.includes(LOBBY_WS_URL) && url.includes('pkscb.ignitioncasino')) return true;
  return false;
};

// ===========================================================================
// TABLE STATE EXTRACTOR
// ===========================================================================

/**
 * Extract the table state numeric value from a CO_TABLE_STATE payload.
 *
 * @param {object} payload - Raw CO_TABLE_STATE payload
 * @returns {number|null} State number or null
 */
export const extractTableState = (payload) => {
  const candidate = payload.state ?? payload.tableState ?? payload.status ??
                    payload.value ?? payload.s;

  if (candidate !== undefined && candidate !== null) {
    const num = typeof candidate === 'number' ? candidate : Number(candidate);
    if (TABLE_STATE_MAP[num] !== undefined) return num;
  }

  // Fallback: scan values for a recognized state number
  for (const val of Object.values(payload)) {
    if (typeof val === 'number' && TABLE_STATE_MAP[val] !== undefined) {
      return val;
    }
  }

  return null;
};

// Re-export GAME_WS_URL for consumers that need it
export { GAME_WS_URL };
