import { describe, it, expect } from 'vitest';
import { extractPreflopAction, extractAllActions } from '../actionExtractor';
import { applyShowdownAnchor, updateProfileFromActions } from '../bayesianUpdater';
import { createEmptyProfile, RANGE_POSITIONS, RANGE_ACTIONS } from '../rangeProfile';
import { normalizeAllPositions } from '../crossRangeConstraints';
import { rangeIndex, decodeIndex } from '../../pokerCore/rangeMatrix';

// Helper: build a hand record with optional showdown cards and WON action
const makeHand = (playerId, seat, dealerSeat, actions, { cards = null, wonSeat = null } = {}) => {
  const seatPlayers = { [String(seat)]: String(playerId) };
  const actionSequence = actions.map((a, i) => ({
    order: i + 1,
    seat: String(a.seat),
    action: a.action,
    street: a.street || 'preflop',
  }));

  // Add showdown WON entry if specified
  if (wonSeat !== null) {
    actionSequence.push({
      order: actionSequence.length + 1,
      seat: String(wonSeat),
      action: 'won',
      street: 'showdown',
    });
  }

  const hand = {
    handId: `test-${Date.now()}-${Math.random()}`,
    seatPlayers,
    gameState: {
      dealerButtonSeat: dealerSeat,
      actionSequence,
    },
    cardState: {},
  };

  if (cards) {
    hand.cardState.allPlayerCards = { [String(seat)]: cards };
  }

  return hand;
};

describe('showdownOutcome extraction', () => {
  it('returns showdownOutcome "won" when player has cards and WON action', () => {
    const hand = makeHand(1, 3, 1, [
      { seat: 3, action: 'raise' },
    ], { cards: ['A♠', 'K♠'], wonSeat: 3 });

    const result = extractPreflopAction(1, hand);
    expect(result.showdownOutcome).toBe('won');
    expect(result.showdownIndex).not.toBeNull();
  });

  it('returns showdownOutcome "lost" when player has cards but no WON action', () => {
    const hand = makeHand(1, 3, 1, [
      { seat: 3, action: 'raise' },
    ], { cards: ['A♠', 'K♠'], wonSeat: 5 }); // someone else won

    const result = extractPreflopAction(1, hand);
    expect(result.showdownOutcome).toBe('lost');
    expect(result.showdownIndex).not.toBeNull();
  });

  it('returns showdownOutcome null when player has no showdown cards', () => {
    const hand = makeHand(1, 3, 1, [
      { seat: 3, action: 'raise' },
    ]);

    const result = extractPreflopAction(1, hand);
    expect(result.showdownOutcome).toBeNull();
    expect(result.showdownIndex).toBeNull();
  });
});

describe('outcome-aware anchor boosts', () => {
  const AKs_index = rangeIndex(12, 11, true);  // A=12, K=11, suited
  const AKo_index = rangeIndex(12, 11, false); // offsuit variant

  it('applies higher boosts for won outcome', () => {
    const profile = createEmptyProfile(1, 'user1');
    applyShowdownAnchor(profile, 'LATE', 'open', AKs_index, 'won');

    expect(profile.ranges.LATE.open[AKs_index]).toBe(1.0);
    expect(profile.ranges.LATE.open[AKo_index]).toBeCloseTo(0.30, 2); // alt suit boost
  });

  it('applies lower boosts for lost outcome', () => {
    const profile = createEmptyProfile(1, 'user1');
    applyShowdownAnchor(profile, 'LATE', 'open', AKs_index, 'lost');

    expect(profile.ranges.LATE.open[AKs_index]).toBe(1.0);
    expect(profile.ranges.LATE.open[AKo_index]).toBeCloseTo(0.15, 2); // lower boost
  });

  it('applies default boosts when outcome is null', () => {
    const profile = createEmptyProfile(1, 'user1');
    applyShowdownAnchor(profile, 'LATE', 'open', AKs_index, null);

    expect(profile.ranges.LATE.open[AKs_index]).toBe(1.0);
    expect(profile.ranges.LATE.open[AKo_index]).toBeCloseTo(0.25, 2); // default
  });

  it('applies outcome-aware pair boosts', () => {
    const TT_index = rangeIndex(8, 8, false);  // T=8
    const _99_index = rangeIndex(7, 7, false);
    const JJ_index = rangeIndex(9, 9, false);

    const wonProfile = createEmptyProfile(1, 'user1');
    applyShowdownAnchor(wonProfile, 'MIDDLE', 'open', TT_index, 'won');
    const wonLower = wonProfile.ranges.MIDDLE.open[_99_index];
    const wonHigher = wonProfile.ranges.MIDDLE.open[JJ_index];

    const lostProfile = createEmptyProfile(2, 'user1');
    applyShowdownAnchor(lostProfile, 'MIDDLE', 'open', TT_index, 'lost');
    const lostLower = lostProfile.ranges.MIDDLE.open[_99_index];
    const lostHigher = lostProfile.ranges.MIDDLE.open[JJ_index];

    // Won boosts should be strictly higher than lost boosts
    expect(wonLower).toBeGreaterThan(lostLower);
    expect(wonHigher).toBeGreaterThan(lostHigher);
    // Won: 0.25, Lost: 0.10
    expect(wonLower).toBeCloseTo(0.25, 2);
    expect(lostLower).toBeCloseTo(0.10, 2);
  });

  it('stores outcome in anchor record', () => {
    const profile = createEmptyProfile(1, 'user1');
    applyShowdownAnchor(profile, 'LATE', 'open', AKs_index, 'won');

    expect(profile.showdownAnchors).toHaveLength(1);
    expect(profile.showdownAnchors[0].outcome).toBe('won');
  });
});

describe('showdownsSeen counting', () => {
  it('increments showdownsSeen per position in updateProfileFromActions', () => {
    const profile = createEmptyProfile(1, 'user1');
    const extractions = [
      { position: 'LATE', rangeAction: 'open', facedRaise: false, showdownIndex: rangeIndex(12, 11, true), showdownOutcome: 'won' },
      { position: 'LATE', rangeAction: 'open', facedRaise: false, showdownIndex: null, showdownOutcome: null },
      { position: 'EARLY', rangeAction: 'fold', facedRaise: false, showdownIndex: rangeIndex(5, 4, false), showdownOutcome: 'lost' },
    ];

    updateProfileFromActions(profile, extractions);

    expect(profile.opportunities.LATE.showdownsSeen).toBe(1);
    expect(profile.opportunities.EARLY.showdownsSeen).toBe(1);
    expect(profile.opportunities.MIDDLE.showdownsSeen).toBe(0);
  });
});

describe('rebuild idempotency (FIND-026)', () => {
  // The stateless full-rebuild applies showdown anchors additively, but each rebuild
  // starts from a FRESH empty profile and runs updateProfileFromActions exactly once,
  // then normalizes. Two rebuilds from identical data MUST yield identical grids —
  // anchors do NOT accumulate across rebuilds (the FIND-026 concern). This guards it.
  const rebuild = (extractions) => {
    const profile = createEmptyProfile(1, 'user1');
    updateProfileFromActions(profile, extractions);
    normalizeAllPositions(profile.ranges);
    return profile;
  };

  it('two rebuilds from the same showdown-bearing data produce byte-identical grids', () => {
    const extractions = [
      { position: 'LATE', rangeAction: 'open', facedRaise: false, showdownIndex: rangeIndex(12, 12, false), showdownOutcome: 'won' }, // AA open, won
      { position: 'LATE', rangeAction: 'open', facedRaise: false, showdownIndex: rangeIndex(12, 11, true), showdownOutcome: 'won' },  // AKs open, won
      { position: 'LATE', rangeAction: 'open', facedRaise: false, showdownIndex: null, showdownOutcome: null },
      { position: 'EARLY', rangeAction: 'coldCall', facedRaise: true, showdownIndex: rangeIndex(10, 10, false), showdownOutcome: 'lost' }, // QQ coldCall, lost
    ];
    const a = rebuild(extractions);
    const b = rebuild(extractions);
    for (const pos of RANGE_POSITIONS) {
      for (const action of RANGE_ACTIONS) {
        expect(Array.from(b.ranges[pos][action])).toEqual(Array.from(a.ranges[pos][action]));
      }
    }
  });

  it('the anchored hand is pinned to 1.0 and not pushed above it on rebuild', () => {
    const AA = rangeIndex(12, 12, false);
    const extractions = [
      { position: 'LATE', rangeAction: 'open', facedRaise: false, showdownIndex: AA, showdownOutcome: 'won' },
    ];
    const a = rebuild(extractions);
    const b = rebuild(extractions);
    // Pre-normalization the anchor is 1.0; post-normalization it stays bounded and equal across rebuilds.
    expect(b.ranges.LATE.open[AA]).toBe(a.ranges.LATE.open[AA]);
    expect(a.ranges.LATE.open[AA]).toBeLessThanOrEqual(1.0);
  });
});

describe('FM-SEL-01 observability — revealMechanism field (WS-175 / SPR-067)', () => {
  const AKs_index = rangeIndex(12, 11, true);

  it('extractor emits revealMechanism="showdown" when showdown cards are present', () => {
    const hand = makeHand(1, 3, 1, [
      { seat: 3, action: 'raise' },
    ], { cards: ['A♠', 'K♠'], wonSeat: 3 });

    const result = extractPreflopAction(1, hand);
    expect(result.revealMechanism).toBe('showdown');
  });

  it('extractor emits revealMechanism=null when no showdown cards', () => {
    const hand = makeHand(1, 3, 1, [
      { seat: 3, action: 'raise' },
    ]);

    const result = extractPreflopAction(1, hand);
    expect(result.revealMechanism).toBeNull();
  });

  it('extractor emits revealMechanism=null on the synthetic-fold path (no preflop actions)', () => {
    // No preflop action recorded → extractor returns synthesised fold
    const hand = makeHand(1, 3, 1, [
      { seat: 5, action: 'raise' }, // some other seat acted
    ]);

    const result = extractPreflopAction(1, hand);
    expect(result).not.toBeNull();
    expect(result.rangeAction).toBe('fold');
    expect(result.revealMechanism).toBeNull();
  });

  it('applyShowdownAnchor records revealMechanism on the anchor', () => {
    const profile = createEmptyProfile(1, 'user1');
    applyShowdownAnchor(profile, 'LATE', 'open', AKs_index, 'won', 'showdown');

    expect(profile.showdownAnchors).toHaveLength(1);
    expect(profile.showdownAnchors[0].revealMechanism).toBe('showdown');
  });

  it('applyShowdownAnchor defaults revealMechanism to "showdown" when arg omitted (back-compat)', () => {
    const profile = createEmptyProfile(1, 'user1');
    applyShowdownAnchor(profile, 'LATE', 'open', AKs_index, 'won');

    expect(profile.showdownAnchors[0].revealMechanism).toBe('showdown');
  });

  it('applyShowdownAnchor accepts reserved future mechanisms without altering boost magnitudes', () => {
    // Per WS-175 / SPR-067 disposition: field is observability-only today.
    // Boost magnitudes MUST be identical regardless of mechanism — pin behaviour
    // so a future mechanism-aware correction is intentional, not accidental.
    const AKo_index = rangeIndex(12, 11, false);

    const showdownProfile = createEmptyProfile(1, 'user1');
    applyShowdownAnchor(showdownProfile, 'LATE', 'open', AKs_index, 'won', 'showdown');

    const muckedProfile = createEmptyProfile(2, 'user1');
    applyShowdownAnchor(muckedProfile, 'LATE', 'open', AKs_index, 'won', 'mucked-shown');

    const allInProfile = createEmptyProfile(3, 'user1');
    applyShowdownAnchor(allInProfile, 'LATE', 'open', AKs_index, 'won', 'all-in-runout');

    // Anchor magnitudes must match — accept-with-rails means NO math change today.
    expect(muckedProfile.ranges.LATE.open[AKs_index]).toBe(showdownProfile.ranges.LATE.open[AKs_index]);
    expect(muckedProfile.ranges.LATE.open[AKo_index]).toBe(showdownProfile.ranges.LATE.open[AKo_index]);
    expect(allInProfile.ranges.LATE.open[AKs_index]).toBe(showdownProfile.ranges.LATE.open[AKs_index]);
    expect(allInProfile.ranges.LATE.open[AKo_index]).toBe(showdownProfile.ranges.LATE.open[AKo_index]);

    // But the field IS persisted distinctly per anchor — observability hook intact.
    expect(muckedProfile.showdownAnchors[0].revealMechanism).toBe('mucked-shown');
    expect(allInProfile.showdownAnchors[0].revealMechanism).toBe('all-in-runout');
  });

  it('updateProfileFromActions plumbs revealMechanism from extraction → anchor record', () => {
    const profile = createEmptyProfile(1, 'user1');
    const extractions = [
      { position: 'LATE', rangeAction: 'open', facedRaise: false, showdownIndex: AKs_index, showdownOutcome: 'won', revealMechanism: 'showdown' },
    ];

    updateProfileFromActions(profile, extractions);

    expect(profile.showdownAnchors).toHaveLength(1);
    expect(profile.showdownAnchors[0].revealMechanism).toBe('showdown');
  });

  it('updateProfileFromActions falls back to "showdown" when extraction lacks revealMechanism (back-compat)', () => {
    // Older extraction shapes (pre-SPR-067) may not have the field — must still anchor cleanly.
    const profile = createEmptyProfile(1, 'user1');
    const extractions = [
      { position: 'LATE', rangeAction: 'open', facedRaise: false, showdownIndex: AKs_index, showdownOutcome: 'won' },
    ];

    updateProfileFromActions(profile, extractions);

    expect(profile.showdownAnchors).toHaveLength(1);
    expect(profile.showdownAnchors[0].revealMechanism).toBe('showdown');
  });
});

describe('full pipeline integration', () => {
  it('extracts outcome and applies differentiated boosts through full pipeline', () => {
    // Use seat 1 with dealer at 1 (BTN = LATE position)
    const hand1 = makeHand(1, 1, 1, [
      { seat: 1, action: 'raise' },
    ], { cards: ['A♠', 'K♠'], wonSeat: 1 });

    const hand2 = makeHand(1, 1, 1, [
      { seat: 1, action: 'raise' },
    ], { cards: ['Q♥', 'J♥'], wonSeat: 5 });

    const extractions = extractAllActions(1, [hand1, hand2]);
    expect(extractions).toHaveLength(2);
    expect(extractions[0].showdownOutcome).toBe('won');
    expect(extractions[1].showdownOutcome).toBe('lost');

    const pos = extractions[0].position;
    const profile = createEmptyProfile(1, 'user1');
    updateProfileFromActions(profile, extractions);

    // Both confirmed hands should be 1.0
    const AKs_idx = rangeIndex(12, 11, true);
    const QJs_idx = rangeIndex(10, 9, true);
    expect(profile.ranges[pos].open[AKs_idx]).toBe(1.0);
    expect(profile.ranges[pos].open[QJs_idx]).toBe(1.0);

    // Won hand (AKs) should have higher alt-suit boost than lost hand (QJs)
    const AKo_idx = rangeIndex(12, 11, false);
    const QJo_idx = rangeIndex(10, 9, false);
    expect(profile.ranges[pos].open[AKo_idx]).toBeGreaterThanOrEqual(profile.ranges[pos].open[QJo_idx]);

    // showdownsSeen should be 2 for the position
    expect(profile.opportunities[pos].showdownsSeen).toBe(2);
  });
});
