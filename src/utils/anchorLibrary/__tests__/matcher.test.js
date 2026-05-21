/**
 * matcher.test.js — Live anchor matcher coverage.
 *
 * EAL Phase 6 / Stream B (SPR-055 / WS-017).
 */

import { describe, it, expect } from 'vitest';
import {
  matchesAnchor,
  getMatchingAnchors,
  DEFAULT_LIVE_STATUSES,
} from '../matcher';

// ───────────────────────────────────────────────────────────────────────────
// Helpers — anchor and situation factories aligned with seed-01 shape
// ───────────────────────────────────────────────────────────────────────────

const seedNitOverfold = (overrides = {}) => ({
  id: 'anchor:nit:river:overfold:4flush',
  archetypeName: 'Nit Over-Fold to River Overbet on 4-Flush Scare',
  status: 'active',
  polarity: 'overfold',
  tier: 2,
  lineSequence: [
    { street: 'flop', villainAction: { kind: 'call' }, boardCondition: { texture: 'any' } },
    { street: 'turn', heroAction: { kind: 'bet', sizingRange: [0.6, 1.0] }, villainAction: { kind: 'call' }, boardCondition: { texture: 'wet' } },
    { street: 'river', heroAction: { kind: 'bet', sizingRange: [1.0, 1.8] }, boardCondition: { texture: 'flush-complete', scareKind: '4-flush' } },
  ],
  ...overrides,
});

const matchingNitSituation = (overrides = {}) => ({
  villainStyle: 'Nit',
  actionHistory: {
    flop: { villainAction: { kind: 'call' }, board: { texture: 'wet' } },
    turn: { heroAction: { kind: 'bet', sizing: 0.75 }, villainAction: { kind: 'call' }, board: { texture: 'wet' } },
    river: { heroAction: { kind: 'bet', sizing: 1.2 }, board: { texture: 'flush-complete', scareKind: '4-flush' } },
  },
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
describe('matchesAnchor — full match', () => {
  it('returns true for SEED-01-shaped situation matching SEED-01-shaped anchor', () => {
    expect(matchesAnchor(matchingNitSituation(), seedNitOverfold())).toBe(true);
  });

  it('returns true when villainStyle is absent on situation (wildcard)', () => {
    const sit = matchingNitSituation();
    delete sit.villainStyle;
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(true);
  });

  it('matches villainStyle case-insensitively', () => {
    const sit = matchingNitSituation({ villainStyle: 'NIT' });
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(true);
  });

  it("treats anchor texture 'any' as a wildcard", () => {
    // Flop step has texture 'any' — should match a flop with texture 'dry' too.
    const sit = matchingNitSituation();
    sit.actionHistory.flop.board = { texture: 'dry' };
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('matchesAnchor — style mismatch', () => {
  it('returns false when villain style does not match anchor archetype style', () => {
    const sit = matchingNitSituation({ villainStyle: 'LAG' });
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(false);
  });

  it('returns false when villainStyle is a non-string truthy value', () => {
    const sit = matchingNitSituation({ villainStyle: 42 });
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(false);
  });

  it('treats empty-string villainStyle as wildcard', () => {
    const sit = matchingNitSituation({ villainStyle: '' });
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('matchesAnchor — street structure', () => {
  it('returns false when a required street is missing from actionHistory', () => {
    const sit = matchingNitSituation();
    delete sit.actionHistory.river;
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(false);
  });

  it('returns false when actionHistory entry is null', () => {
    const sit = matchingNitSituation();
    sit.actionHistory.turn = null;
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(false);
  });

  it('returns false for empty lineSequence', () => {
    expect(matchesAnchor(matchingNitSituation(), seedNitOverfold({ lineSequence: [] }))).toBe(false);
  });

  it('returns false when lineSequence is not an array', () => {
    expect(matchesAnchor(matchingNitSituation(), seedNitOverfold({ lineSequence: null }))).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('matchesAnchor — heroAction kind + sizing', () => {
  it('returns false when actual hero action kind differs', () => {
    const sit = matchingNitSituation();
    sit.actionHistory.turn.heroAction = { kind: 'check' };
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(false);
  });

  it('returns false when sizing is below the range', () => {
    const sit = matchingNitSituation();
    sit.actionHistory.turn.heroAction = { kind: 'bet', sizing: 0.4 };
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(false);
  });

  it('returns false when sizing is above the range', () => {
    const sit = matchingNitSituation();
    sit.actionHistory.river.heroAction = { kind: 'bet', sizing: 2.5 };
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(false);
  });

  it('returns false when sizing range is specified but actual sizing is missing', () => {
    const sit = matchingNitSituation();
    sit.actionHistory.turn.heroAction = { kind: 'bet' }; // no sizing
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(false);
  });

  it('matches sizing exactly at the lower bound', () => {
    const sit = matchingNitSituation();
    sit.actionHistory.turn.heroAction = { kind: 'bet', sizing: 0.6 };
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(true);
  });

  it('matches sizing exactly at the upper bound', () => {
    const sit = matchingNitSituation();
    sit.actionHistory.river.heroAction = { kind: 'bet', sizing: 1.8 };
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('matchesAnchor — villainAction', () => {
  it('returns false when villain action kind differs', () => {
    const sit = matchingNitSituation();
    sit.actionHistory.flop.villainAction = { kind: 'raise' };
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(false);
  });

  it('returns false when villainAction is missing entirely on a step that requires it', () => {
    const sit = matchingNitSituation();
    delete sit.actionHistory.flop.villainAction;
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('matchesAnchor — boardCondition', () => {
  it('returns false when texture mismatches a non-wildcard anchor texture', () => {
    const sit = matchingNitSituation();
    sit.actionHistory.turn.board = { texture: 'dry' };
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(false);
  });

  it('returns false when scareKind differs', () => {
    const sit = matchingNitSituation();
    sit.actionHistory.river.board = { texture: 'flush-complete', scareKind: 'overcard' };
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(false);
  });

  it('returns false when board is missing on a step with a board constraint', () => {
    const sit = matchingNitSituation();
    delete sit.actionHistory.river.board;
    expect(matchesAnchor(sit, seedNitOverfold())).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('matchesAnchor — sprRange', () => {
  it('matches when actual SPR is in range', () => {
    const anchor = seedNitOverfold();
    anchor.lineSequence[1].sprRange = [4, 13];
    const sit = matchingNitSituation();
    sit.actionHistory.turn.spr = 7;
    expect(matchesAnchor(sit, anchor)).toBe(true);
  });

  it('returns false when actual SPR is out of range', () => {
    const anchor = seedNitOverfold();
    anchor.lineSequence[1].sprRange = [4, 13];
    const sit = matchingNitSituation();
    sit.actionHistory.turn.spr = 2;
    expect(matchesAnchor(sit, anchor)).toBe(false);
  });

  it('returns false when SPR range is specified but actual SPR is missing', () => {
    const anchor = seedNitOverfold();
    anchor.lineSequence[1].sprRange = [4, 13];
    expect(matchesAnchor(matchingNitSituation(), anchor)).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('matchesAnchor — wildcards on anchor side', () => {
  it('matches a step that omits heroAction (wildcards hero behavior)', () => {
    const anchor = seedNitOverfold();
    anchor.lineSequence[2] = { street: 'river', boardCondition: { texture: 'flush-complete', scareKind: '4-flush' } };
    const sit = matchingNitSituation();
    // hero might have checked instead of bet — should still match since anchor has no heroAction constraint
    sit.actionHistory.river.heroAction = { kind: 'check' };
    expect(matchesAnchor(sit, anchor)).toBe(true);
  });

  it('matches a step that omits boardCondition (wildcards board)', () => {
    const anchor = seedNitOverfold();
    anchor.lineSequence[1] = { street: 'turn', heroAction: { kind: 'bet', sizingRange: [0.6, 1.0] }, villainAction: { kind: 'call' } };
    const sit = matchingNitSituation();
    sit.actionHistory.turn.board = { texture: 'dry' };
    expect(matchesAnchor(sit, anchor)).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('matchesAnchor — invalid inputs', () => {
  it('returns false for null situation', () => {
    expect(matchesAnchor(null, seedNitOverfold())).toBe(false);
  });

  it('returns false for null anchor', () => {
    expect(matchesAnchor(matchingNitSituation(), null)).toBe(false);
  });

  it('returns false for missing actionHistory', () => {
    expect(matchesAnchor({ villainStyle: 'Nit' }, seedNitOverfold())).toBe(false);
  });

  it('does not throw on malformed step', () => {
    const anchor = seedNitOverfold();
    anchor.lineSequence[0] = null;
    expect(() => matchesAnchor(matchingNitSituation(), anchor)).not.toThrow();
    expect(matchesAnchor(matchingNitSituation(), anchor)).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('getMatchingAnchors — status filter (default)', () => {
  it('returns matching active anchors only', () => {
    const active = seedNitOverfold({ id: 'a:active', status: 'active' });
    const retired = seedNitOverfold({ id: 'a:retired', status: 'retired' });
    const candidate = seedNitOverfold({ id: 'a:candidate', status: 'candidate' });
    const suppressed = seedNitOverfold({ id: 'a:suppressed', status: 'suppressed' });
    const result = getMatchingAnchors(matchingNitSituation(), [active, retired, candidate, suppressed]);
    expect(result.map((a) => a.id)).toEqual(['a:active']);
  });

  it("treats anchors without a status field as 'active'", () => {
    const anchor = seedNitOverfold();
    delete anchor.status;
    expect(getMatchingAnchors(matchingNitSituation(), [anchor])).toHaveLength(1);
  });

  it('short-circuits on candidate status (red line #6 / accept_criteria)', () => {
    const cand = seedNitOverfold({ status: 'candidate' });
    expect(getMatchingAnchors(matchingNitSituation(), [cand])).toEqual([]);
  });

  it('default allow-list is active-only', () => {
    expect([...DEFAULT_LIVE_STATUSES]).toEqual(['active']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('getMatchingAnchors — status filter (opt-out)', () => {
  it('returns retired anchors when includeStatuses opts them in', () => {
    const retired = seedNitOverfold({ id: 'a:retired', status: 'retired' });
    const result = getMatchingAnchors(matchingNitSituation(), [retired], {
      includeStatuses: ['active', 'retired'],
    });
    expect(result.map((a) => a.id)).toEqual(['a:retired']);
  });

  it('returns all states when full allow-list is passed', () => {
    const ids = ['active', 'expiring', 'retired', 'suppressed', 'candidate'];
    const anchors = ids.map((s) => seedNitOverfold({ id: `a:${s}`, status: s }));
    const result = getMatchingAnchors(matchingNitSituation(), anchors, {
      includeStatuses: ids,
    });
    expect(result.map((a) => a.id).sort()).toEqual(ids.map((s) => `a:${s}`).sort());
  });

  it('falls back to default active-only when includeStatuses is empty array', () => {
    const retired = seedNitOverfold({ status: 'retired' });
    expect(getMatchingAnchors(matchingNitSituation(), [retired], { includeStatuses: [] })).toEqual([]);
  });

  it('falls back to default when options is null/undefined/non-object', () => {
    const retired = seedNitOverfold({ status: 'retired' });
    expect(getMatchingAnchors(matchingNitSituation(), [retired], null)).toEqual([]);
    expect(getMatchingAnchors(matchingNitSituation(), [retired], undefined)).toEqual([]);
    expect(getMatchingAnchors(matchingNitSituation(), [retired], 'not-an-object')).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('getMatchingAnchors — multiple anchors', () => {
  it('returns multiple matching anchors in input order', () => {
    const a1 = seedNitOverfold({ id: 'a:1' });
    const a2 = seedNitOverfold({ id: 'a:2' });
    const result = getMatchingAnchors(matchingNitSituation(), [a1, a2]);
    expect(result.map((a) => a.id)).toEqual(['a:1', 'a:2']);
  });

  it('skips non-matching anchors but keeps matching ones', () => {
    const matching = seedNitOverfold({ id: 'a:match' });
    const wrongStyle = seedNitOverfold({ id: 'a:nomatch', archetypeName: 'LAG Bluff Catcher' });
    const result = getMatchingAnchors(matchingNitSituation({ villainStyle: 'Nit' }), [matching, wrongStyle]);
    expect(result.map((a) => a.id)).toEqual(['a:match']);
  });

  it('returns empty array for empty anchors input', () => {
    expect(getMatchingAnchors(matchingNitSituation(), [])).toEqual([]);
  });

  it('returns empty array for non-array anchors input', () => {
    expect(getMatchingAnchors(matchingNitSituation(), null)).toEqual([]);
    expect(getMatchingAnchors(matchingNitSituation(), undefined)).toEqual([]);
    expect(getMatchingAnchors(matchingNitSituation(), 'string')).toEqual([]);
  });

  it('skips null/undefined/non-object anchors gracefully', () => {
    const valid = seedNitOverfold({ id: 'a:valid' });
    const result = getMatchingAnchors(matchingNitSituation(), [null, undefined, 'string', valid]);
    expect(result.map((a) => a.id)).toEqual(['a:valid']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('getMatchingAnchors — single-step anchor', () => {
  it('matches an anchor with a single LineStep', () => {
    const oneStep = seedNitOverfold({
      id: 'a:onestep',
      lineSequence: [{ street: 'flop', villainAction: { kind: 'call' } }],
    });
    expect(getMatchingAnchors(matchingNitSituation(), [oneStep]).map((a) => a.id)).toEqual(['a:onestep']);
  });
});
