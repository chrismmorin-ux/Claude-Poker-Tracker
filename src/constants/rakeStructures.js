/**
 * rakeStructures.js — real rake schedules for the rooms the founder can actually drive to.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS FOR.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Rake is the largest single cost in a small-stakes live game and it is the input that
 * decides which game is worth playing at all. WS-333 measured that rake costs a blind
 * defender roughly +4.8pp of required equity live versus +2.3pp on the 2009 online corpus —
 * so a strategy conclusion carried between two rooms with different schedules is a transfer
 * claim, not a fact.
 *
 * This registry exists so that comparison can eventually be made against REAL numbers rather
 * than a placeholder. It is deliberately data-only: nothing here decides anything, and the
 * "which game is more profitable" question is a COMPARATIVE CLAIM, which under ADR-009 must
 * resolve to a Result Card rather than a table someone eyeballs.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE SHAPE THAT MATTERS: PERCENTAGE **PLUS** A FLAT DROP.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Every Chicago-area room takes a house rake AND a separate flat jackpot/promo drop. The
 * headline "10% to $6" therefore understates the true tax badly at the pot sizes most hands
 * reach — at 1/3, a $30 pot pays $3 + $2 = **$5, or 16.7%**. The percentage-only model
 * `potCalculator.estimateRake` used before 2026-08-02 could not express this at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * PROVENANCE, AND HOW MUCH TO TRUST IT.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Every entry carries `source`, `verifiedAt` and `confidence`. These were read off PokerAtlas
 * game listings and room pages in August 2026, NOT confirmed at the table. Rake structures
 * change without notice and promo drops change more often than the house rake. Treat
 * `confidence: 'reported'` as "good enough to plan with, verify before you conclude with it",
 * and re-verify anything load-bearing before it reaches a Result Card.
 *
 * `jackpotEquityRebate: null` on every entry is deliberate and is NOT the same as zero — see
 * `estimateRake`'s header. Some of a jackpot drop returns to the player pool; the fraction is
 * unpublished and unmeasured, so it is recorded as unknown rather than assumed away.
 */

/**
 * @typedef {Object} RoomRakeEntry
 * @property {string} room
 * @property {string} location
 * @property {string} state
 * @property {Object<string, object>} games - stake label -> rake config
 * @property {string} source
 * @property {string} verifiedAt - ISO date this was read
 * @property {'reported'|'confirmed'|'stale'} confidence
 * @property {string} [notes]
 */

const NFND = { noFlopNoDrop: true };

/** @type {RoomRakeEntry[]} */
export const CHICAGO_AREA_RAKE = [
  {
    room: 'Wind Creek Chicago Southland',
    location: 'Hazel Crest, IL',
    state: 'IL',
    games: {
      // 9-handed, $100–$500 buy-in, $6 mandatory UTG straddle.
      '1/3': { pct: 0.10, cap: 6, jackpotDrop: 2, dropThreshold: 20, ...NFND },
    },
    source: 'https://www.pokeratlas.com/poker-cash-game/wind-creek-chicago-southland-hazel-crest-no-limit-holdem-1-3',
    verifiedAt: '2026-08-02',
    confidence: 'reported',
    notes: 'The founder\'s home room — this is the pool behind SRC-014. The mandatory $6 UTG '
      + 'straddle is a structural feature, not a rake term, but it changes the effective blind '
      + 'level and therefore every pot-odds quantity WS-333 derives. Not yet modelled.',
  },
  {
    room: 'Rivers Casino Des Plaines',
    location: 'Des Plaines, IL',
    state: 'IL',
    games: {
      '1/3': { pct: 0.10, cap: 6, jackpotDrop: 2, dropThreshold: 20, ...NFND },
      '5/10': { pct: 0.10, cap: 6, jackpotDrop: 1, dropThreshold: 20, ...NFND },
    },
    source: 'https://www.pokeratlas.com/poker-cash-game/rivers-casino-des-plaines-no-limit-holdem-1-3',
    verifiedAt: '2026-08-02',
    confidence: 'reported',
    notes: 'Rake reported as 10% to $6 for 6-9 players with a $1 bad-beat drop taken at $20; '
      + 'the 1/3 listing reports $2 for promos. The two figures may be the same money counted '
      + 'differently — VERIFY AT THE TABLE before using the 1/3 drop in a conclusion.',
  },
  {
    room: 'Horseshoe Hammond',
    location: 'Hammond, IN',
    state: 'IN',
    games: {
      '1/2': { pct: 0.10, cap: 5, jackpotDrop: 1, dropThreshold: 20, ...NFND },
      '1/3': { pct: 0.10, cap: 6, jackpotDrop: 1, dropThreshold: 20, ...NFND },
      '2/5': { pct: 0.10, cap: 6, jackpotDrop: 1, dropThreshold: 20, ...NFND },
    },
    source: 'https://www.pokeratlas.com/poker-cash-game/horseshoe-hammond-no-limit-holdem-1-3',
    verifiedAt: '2026-08-02',
    confidence: 'reported',
    notes: 'SOURCES DISAGREE on the cap: a room review reports 10% to $5, PokerAtlas listings '
      + 'report 10% to $6 for 1/3 and 2/5. Recorded here as $5 at 1/2 and $6 above, which is '
      + 'the reading that reconciles them, but this is the least certain entry in the file. '
      + 'The largest room in the region and the one most likely to be worth the drive — worth '
      + 'confirming first.',
  },
  {
    room: 'Hollywood Casino Aurora',
    location: 'Aurora, IL',
    state: 'IL',
    games: {},
    source: 'https://poker.fandom.com/wiki/Hollywood_Aurora',
    verifiedAt: '2026-08-02',
    confidence: 'stale',
    notes: 'Only a SHORT-HANDED scale was found (max $4 at 5-6 players, $2 at 4). The '
      + 'full-table figure — the one that matters — was not located. Left EMPTY rather than '
      + 'guessed: an invented entry here would be indistinguishable from a measured one.',
  },
  {
    room: "Bally's Chicago",
    location: 'Chicago, IL',
    state: 'IL',
    games: {},
    source: 'https://casinos.ballys.com/chicago/casino.htm',
    verifiedAt: '2026-08-02',
    confidence: 'stale',
    notes: 'Permanent room announced with renderings; no published rake schedule found. Empty '
      + 'until confirmed.',
  },
];

/** Rooms that no longer spread cash games — recorded so they are not re-researched. */
export const CHICAGO_AREA_CLOSED = [
  { room: "Harrah's Joliet", closed: '2020-10', note: 'WSOP-branded room closed permanently.' },
  { room: 'Ameristar East Chicago', closed: '2015-07', note: 'Cash games ended; still hosts MSPT events in the ballroom.' },
];

/**
 * Look up a room's schedule for a stake.
 * Returns null when the room or the game is not registered — never a guess.
 */
export const rakeForRoom = (roomName, stakeLabel) => {
  const entry = CHICAGO_AREA_RAKE.find((r) => r.room.toLowerCase() === String(roomName).toLowerCase());
  if (!entry) return null;
  const cfg = entry.games[stakeLabel];
  if (!cfg) return null;
  return { rakeConfig: cfg, source: entry.source, verifiedAt: entry.verifiedAt, confidence: entry.confidence };
};

/**
 * Effective rake as a PERCENTAGE of a given pot, which is the number that actually decides
 * whether a game beats another one.
 *
 * The headline percentage is not this number. Comparing two rooms on their advertised
 * percentages compares the wrong quantity, because the flat drop and the cap both bite hardest
 * where the percentage looks smallest.
 */
export const effectiveRakePct = (rakeConfig, potSize) => {
  if (!rakeConfig || !(potSize > 0)) return 0;
  const { pct = 0, cap = Infinity, jackpotDrop = 0, dropThreshold = 0 } = rakeConfig;
  const house = Math.min(potSize * pct, cap);
  const drop = jackpotDrop > 0 && potSize >= dropThreshold ? jackpotDrop : 0;
  return (house + drop) / potSize;
};
