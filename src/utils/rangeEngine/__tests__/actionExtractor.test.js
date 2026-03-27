import { describe, it, expect } from 'vitest';
import { extractPreflopAction, extractAllActions } from '../actionExtractor';

// ---------------------------------------------------------------------------
// Hand builder helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal hand record that actionExtractor can consume.
 *
 * @param {Object} opts
 * @param {number}  opts.playerId     - The player whose action we're extracting
 * @param {number}  opts.playerSeat   - Which seat the player occupies (1-9)
 * @param {number}  opts.dealerSeat   - Dealer button seat (1-9)
 * @param {Array}   opts.actions      - Array of { seat, action, street? } objects
 * @param {Array}   [opts.cards]      - Optional hole cards for playerSeat, e.g. ['A♠','K♠']
 * @param {Array}   [opts.wonSeats]   - Seat numbers that appear in WON entries
 * @returns {Object} Hand record
 */
const makeHand = ({ playerId, playerSeat, dealerSeat, actions, cards = null, wonSeats = [] }) => {
  const seatPlayers = { [String(playerSeat)]: String(playerId) };

  // Build actionSequence with explicit ordering and default street = preflop
  const actionSequence = actions.map((a, i) => ({
    order: i + 1,
    seat: String(a.seat),
    action: a.action,
    street: a.street || 'preflop',
  }));

  // Append WON entries after the main action sequence
  wonSeats.forEach((wonSeat, i) => {
    actionSequence.push({
      order: actions.length + i + 1,
      seat: String(wonSeat),
      action: 'won',
      street: 'showdown',
    });
  });

  const hand = {
    handId: `test-${Math.random()}`,
    seatPlayers,
    gameState: {
      dealerButtonSeat: dealerSeat,
      actionSequence,
    },
    cardState: {},
  };

  if (cards) {
    hand.cardState.allPlayerCards = { [String(playerSeat)]: cards };
  }

  return hand;
};

// ---------------------------------------------------------------------------
// Seat/position reference (dealer=1 in most tests)
// With dealerSeat=1: BTN=1, SB=2, BB=3, UTG=4, UTG+1=5, MP1=6, MP2=7, HJ=8, CO=9
// Position categories: SB→'SB', BB→'BB', UTG/UTG+1→'EARLY', MP1/MP2→'MIDDLE', HJ/CO/BTN→'LATE'
// ---------------------------------------------------------------------------

describe('extractPreflopAction', () => {

  // -------------------------------------------------------------------------
  // Null-return guards
  // -------------------------------------------------------------------------

  describe('null-return guards', () => {
    it('returns null when player is not found in seatPlayers', () => {
      const hand = makeHand({
        playerId: 99,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'fold' }],
      });
      // playerId=99 is mapped to seat 4, but we search for playerId=1
      expect(extractPreflopAction(1, hand)).toBeNull();
    });

    it('returns null when hand has no seatPlayers at all', () => {
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'fold' }],
      });
      delete hand.seatPlayers;
      expect(extractPreflopAction(1, hand)).toBeNull();
    });

    it('returns null when dealerButtonSeat is missing', () => {
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'fold' }],
      });
      delete hand.gameState.dealerButtonSeat;
      expect(extractPreflopAction(1, hand)).toBeNull();
    });

    it('returns null when dealerButtonSeat is null', () => {
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'fold' }],
      });
      hand.gameState.dealerButtonSeat = null;
      expect(extractPreflopAction(1, hand)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Voluntary-action filter: BB check without a raise
  // -------------------------------------------------------------------------

  describe('BB check without raise faced', () => {
    it('returns null when BB checks and no raise was faced', () => {
      // dealerSeat=1 → BB is seat 3
      const hand = makeHand({
        playerId: 1,
        playerSeat: 3,
        dealerSeat: 1,
        // Everyone else limps, BB checks (no raise before BB acts)
        actions: [
          { seat: 4, action: 'call' },
          { seat: 5, action: 'call' },
          { seat: 3, action: 'check' }, // BB option check
        ],
      });
      expect(extractPreflopAction(1, hand)).toBeNull();
    });

    it('does NOT return null when BB checks after facing a raise (unexpected path → null for check)', () => {
      // dealerSeat=1 → BB is seat 3; someone raises before BB, BB checks — that's an
      // unexpected action (you can't check after a raise), so it falls to the else → null.
      const hand = makeHand({
        playerId: 1,
        playerSeat: 3,
        dealerSeat: 1,
        actions: [
          { seat: 4, action: 'raise' },
          { seat: 3, action: 'check' }, // invalid but tests the else branch
        ],
      });
      // facedRaise=true, action=check → not BB-no-raise path, hits else → null
      expect(extractPreflopAction(1, hand)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Action classification: no raise faced
  // -------------------------------------------------------------------------

  describe('action classification — no raise faced', () => {
    it('classifies fold as rangeAction "fold"', () => {
      // dealerSeat=1, player at seat 4 (UTG = EARLY)
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'fold' }],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.rangeAction).toBe('fold');
      expect(result.facedRaise).toBe(false);
    });

    it('classifies call without prior raise as "limp"', () => {
      // Player at seat 4 calls into an unraised pot
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'call' }],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.rangeAction).toBe('limp');
      expect(result.facedRaise).toBe(false);
    });

    it('classifies raise without prior raise as "open"', () => {
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.rangeAction).toBe('open');
      expect(result.facedRaise).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Action classification: facing a raise
  // -------------------------------------------------------------------------

  describe('action classification — facing a raise', () => {
    it('classifies call after a prior raise as "coldCall"', () => {
      // Seat 4 opens, seat 6 cold-calls
      const hand = makeHand({
        playerId: 1,
        playerSeat: 6,
        dealerSeat: 1,
        actions: [
          { seat: 4, action: 'raise' },
          { seat: 6, action: 'call' },
        ],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.rangeAction).toBe('coldCall');
      expect(result.facedRaise).toBe(true);
    });

    it('classifies raise after a prior raise as "threeBet"', () => {
      // Seat 4 opens, seat 6 three-bets
      const hand = makeHand({
        playerId: 1,
        playerSeat: 6,
        dealerSeat: 1,
        actions: [
          { seat: 4, action: 'raise' },
          { seat: 6, action: 'raise' },
        ],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.rangeAction).toBe('threeBet');
      expect(result.facedRaise).toBe(true);
    });

    it('BB fold after a raise classifies as "fold" with facedRaise=true', () => {
      // dealerSeat=1 → BB is seat 3; opener raises, BB folds
      const hand = makeHand({
        playerId: 1,
        playerSeat: 3,
        dealerSeat: 1,
        actions: [
          { seat: 4, action: 'raise' },
          { seat: 3, action: 'fold' },
        ],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.rangeAction).toBe('fold');
      expect(result.facedRaise).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Unexpected action → null
  // -------------------------------------------------------------------------

  describe('unexpected actions', () => {
    it('returns null for a check by a non-BB seat when no raise is faced', () => {
      // Seat 4 is UTG (not BB) — checking preflop without a raise is invalid poker
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'check' }],
      });
      expect(extractPreflopAction(1, hand)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Position extraction
  // -------------------------------------------------------------------------

  describe('position extraction', () => {
    it('assigns correct position category for BTN seat', () => {
      // dealerSeat=1 → seat 1 is BTN → category LATE
      const hand = makeHand({
        playerId: 1,
        playerSeat: 1,
        dealerSeat: 1,
        actions: [{ seat: 1, action: 'fold' }],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.position).toBe('LATE');
    });

    it('assigns correct position category for SB seat', () => {
      // dealerSeat=1 → seat 2 is SB → category SB
      const hand = makeHand({
        playerId: 1,
        playerSeat: 2,
        dealerSeat: 1,
        actions: [{ seat: 2, action: 'fold' }],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.position).toBe('SB');
    });

    it('assigns correct position category for BB seat', () => {
      // dealerSeat=1 → seat 3 is BB → category BB; raise faced so fold is valid
      const hand = makeHand({
        playerId: 1,
        playerSeat: 3,
        dealerSeat: 1,
        actions: [
          { seat: 4, action: 'raise' },
          { seat: 3, action: 'fold' },
        ],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.position).toBe('BB');
    });

    it('assigns correct position category for UTG seat (EARLY)', () => {
      // dealerSeat=1 → seat 4 is UTG → category EARLY
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.position).toBe('EARLY');
    });

    it('assigns correct position category for MP seat (MIDDLE)', () => {
      // dealerSeat=1 → seat 6 is MP1 → category MIDDLE
      const hand = makeHand({
        playerId: 1,
        playerSeat: 6,
        dealerSeat: 1,
        actions: [{ seat: 6, action: 'raise' }],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.position).toBe('MIDDLE');
    });

    it('wraps dealer seat correctly: dealer at seat 9 makes seat 1 SB', () => {
      // dealerSeat=9 → seat 1 is SB, seat 2 is BB, seat 3 is UTG
      const hand = makeHand({
        playerId: 1,
        playerSeat: 1,
        dealerSeat: 9,
        actions: [{ seat: 1, action: 'fold' }],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.position).toBe('SB');
    });
  });

  // -------------------------------------------------------------------------
  // No-action fallback: player in hand but took no action
  // -------------------------------------------------------------------------

  describe('player in hand but took no preflop action', () => {
    it('treats missing actions as fold with facedRaise=false', () => {
      // Player is in seatPlayers but has no preflop action entries
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        // Actions recorded only for other seats
        actions: [
          { seat: 5, action: 'raise' },
          { seat: 6, action: 'fold' },
        ],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.rangeAction).toBe('fold');
      expect(result.facedRaise).toBe(false);
      expect(result.showdownIndex).toBeNull();
      expect(result.showdownOutcome).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Showdown card extraction
  // -------------------------------------------------------------------------

  describe('showdown card extraction', () => {
    it('extracts a valid showdown index for suited cards', () => {
      // A♠K♠ suited → should produce a numeric index in [0, 168]
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
        cards: ['A♠', 'K♠'],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.showdownIndex).toBeTypeOf('number');
      expect(result.showdownIndex).toBeGreaterThanOrEqual(0);
      expect(result.showdownIndex).toBeLessThan(169);
    });

    it('extracts a valid showdown index for offsuit cards', () => {
      // A♠K♥ offsuit → numeric index in [0, 168]
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
        cards: ['A♠', 'K♥'],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.showdownIndex).toBeTypeOf('number');
      expect(result.showdownIndex).toBeGreaterThanOrEqual(0);
      expect(result.showdownIndex).toBeLessThan(169);
    });

    it('suited and offsuit same ranks produce different indexes', () => {
      const handSuited = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
        cards: ['A♠', 'K♠'],
      });
      const handOffsuit = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
        cards: ['A♠', 'K♥'],
      });
      const resultSuited = extractPreflopAction(1, handSuited);
      const resultOffsuit = extractPreflopAction(1, handOffsuit);
      expect(resultSuited.showdownIndex).not.toBe(resultOffsuit.showdownIndex);
    });

    it('returns showdownIndex=null when no cards are recorded', () => {
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
        // no cards
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.showdownIndex).toBeNull();
    });

    it('returns showdownIndex=null when only one card is recorded', () => {
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
        cards: ['A♠', null],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.showdownIndex).toBeNull();
    });

    it('returns showdownIndex=null when cards array is empty', () => {
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
        cards: [],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.showdownIndex).toBeNull();
    });

    it('returns showdownIndex=null when a card string is unparseable', () => {
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
        cards: ['A♠', 'INVALID'],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.showdownIndex).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Showdown outcome
  // -------------------------------------------------------------------------

  describe('showdown outcome determination', () => {
    it('returns showdownOutcome "won" when the player seat appears in WON entries', () => {
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
        cards: ['A♠', 'K♠'],
        wonSeats: [4], // seat 4 won
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.showdownOutcome).toBe('won');
    });

    it('returns showdownOutcome "lost" when another seat won', () => {
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
        cards: ['A♠', 'K♠'],
        wonSeats: [7], // different seat won
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.showdownOutcome).toBe('lost');
    });

    it('returns showdownOutcome=null when no cards are recorded (no showdown)', () => {
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'fold' }],
        wonSeats: [7],
        // no cards for seat 4 → showdownIndex=null → no outcome lookup
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      expect(result.showdownOutcome).toBeNull();
    });

    it('returns showdownOutcome=null when actionSequence has no WON entries but cards present', () => {
      // Cards present → showdownIndex computed; but no WON entry → 'lost'
      // (seatWon=false → 'lost', not null — outcome is only null when showdownIndex is null)
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
        cards: ['A♠', 'K♠'],
        wonSeats: [], // nobody recorded as winning
      });
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      // showdownIndex is set → outcome must be 'won' or 'lost'
      expect(result.showdownOutcome).toBe('lost');
    });

    it('returns showdownOutcome=null when actionSequence itself is absent', () => {
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
        cards: ['A♠', 'K♠'],
      });
      // Remove actionSequence entirely so the outcome lookup finds no array
      delete hand.gameState.actionSequence;
      // Without actionSequence, buildTimeline falls back to seatActions.
      // We must still have a preflop action — provide it via seatActions.
      hand.gameState.seatActions = {
        preflop: { '4': ['raise'] },
      };
      const result = extractPreflopAction(1, hand);
      expect(result).not.toBeNull();
      // showdownIndex is set but no actionSequence for WON lookup → null
      expect(result.showdownOutcome).toBeNull();
    });

    it('handles seat number as string in WON entry (mixed type comparison)', () => {
      // Verifies String(e.seat) === String(seat) coercion path
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
        cards: ['Q♥', 'Q♦'],
        wonSeats: [4],
      });
      const result = extractPreflopAction(1, hand);
      expect(result.showdownOutcome).toBe('won');
    });
  });

  // -------------------------------------------------------------------------
  // Return shape
  // -------------------------------------------------------------------------

  describe('return shape', () => {
    it('returns all five required fields on a happy-path extraction', () => {
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
        cards: ['A♠', 'K♠'],
        wonSeats: [4],
      });
      const result = extractPreflopAction(1, hand);
      expect(result).toMatchObject({
        position: expect.any(String),
        rangeAction: expect.any(String),
        facedRaise: expect.any(Boolean),
        showdownIndex: expect.any(Number),
        showdownOutcome: expect.any(String),
      });
    });

    it('always includes facedRaise as a boolean', () => {
      const hand = makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'fold' }],
      });
      const result = extractPreflopAction(1, hand);
      expect(typeof result.facedRaise).toBe('boolean');
    });
  });
});

// ---------------------------------------------------------------------------
// extractAllActions
// ---------------------------------------------------------------------------

describe('extractAllActions', () => {
  it('returns an empty array when handed an empty list', () => {
    expect(extractAllActions(1, [])).toEqual([]);
  });

  it('filters out null results and keeps valid extractions', () => {
    const hands = [
      // Hand 1: player not in hand → null
      makeHand({
        playerId: 99,   // player 99 occupies seat 4; we query player 1
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'fold' }],
      }),
      // Hand 2: valid fold
      makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'fold' }],
      }),
      // Hand 3: valid open
      makeHand({
        playerId: 1,
        playerSeat: 4,
        dealerSeat: 1,
        actions: [{ seat: 4, action: 'raise' }],
      }),
    ];

    const results = extractAllActions(1, hands);
    expect(results).toHaveLength(2);
    expect(results[0].rangeAction).toBe('fold');
    expect(results[1].rangeAction).toBe('open');
  });

  it('returns empty array when player is absent from all hands', () => {
    const hands = [
      makeHand({ playerId: 2, playerSeat: 5, dealerSeat: 1, actions: [{ seat: 5, action: 'fold' }] }),
      makeHand({ playerId: 3, playerSeat: 6, dealerSeat: 1, actions: [{ seat: 6, action: 'raise' }] }),
    ];
    expect(extractAllActions(1, hands)).toHaveLength(0);
  });

  it('collects results across all hands the player appears in', () => {
    const hands = [
      makeHand({ playerId: 1, playerSeat: 4, dealerSeat: 1, actions: [{ seat: 4, action: 'raise' }] }),
      makeHand({ playerId: 1, playerSeat: 4, dealerSeat: 1, actions: [{ seat: 4, action: 'fold' }] }),
      makeHand({ playerId: 1, playerSeat: 4, dealerSeat: 1, actions: [
        { seat: 5, action: 'raise' },
        { seat: 4, action: 'call' },
      ]}),
    ];
    const results = extractAllActions(1, hands);
    expect(results).toHaveLength(3);
    expect(results.map(r => r.rangeAction)).toEqual(['open', 'fold', 'coldCall']);
  });

  it('preserves hand order in the returned array', () => {
    const rangeActions = ['open', 'limp', 'fold', 'threeBet'];
    const hands = [
      makeHand({ playerId: 1, playerSeat: 4, dealerSeat: 1, actions: [{ seat: 4, action: 'raise' }] }),
      makeHand({ playerId: 1, playerSeat: 4, dealerSeat: 1, actions: [{ seat: 4, action: 'call' }] }),
      makeHand({ playerId: 1, playerSeat: 4, dealerSeat: 1, actions: [{ seat: 4, action: 'fold' }] }),
      makeHand({ playerId: 1, playerSeat: 4, dealerSeat: 1, actions: [
        { seat: 5, action: 'raise' },
        { seat: 4, action: 'raise' },
      ]}),
    ];
    const results = extractAllActions(1, hands);
    expect(results.map(r => r.rangeAction)).toEqual(rangeActions);
  });

  it('each result object contains position, rangeAction, facedRaise, showdownIndex, showdownOutcome', () => {
    const hand = makeHand({
      playerId: 1,
      playerSeat: 4,
      dealerSeat: 1,
      actions: [{ seat: 4, action: 'raise' }],
    });
    const [result] = extractAllActions(1, [hand]);
    expect(result).toHaveProperty('position');
    expect(result).toHaveProperty('rangeAction');
    expect(result).toHaveProperty('facedRaise');
    expect(result).toHaveProperty('showdownIndex');
    expect(result).toHaveProperty('showdownOutcome');
  });
});
