// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePlayerFinder,
  matchesScalar,
  matchesFilters,
  computeCongruency,
  playerEffective,
  EMPTY_FILTERS,
  SCALAR_KEYS,
} from '../usePlayerFinder';

// =============================================================================
// Test fixture — covers most filter axes without boilerplate per test.
// =============================================================================
const mike = {
  playerId: 1, name: 'Mike', lastSeenAt: 3000,
  sex: 'male', ageDecade: '40s', ethnicityTags: ['caucasian'],
  build: 'average', height: 'medium', skinTone: 'light',
  hairColor: 'brown', hairLength: 'short', hairTexture: 'straight',
  facialHair: 'goatee', beardColor: 'brown',
  accessoryInventory: [
    { accessoryId: 'a1', kind: 'hat', subtype: 'cap', color: 'red', note: 'KC Royals', timesSeen: 4 },
  ],
};
const alice = {
  playerId: 2, name: 'Alice', lastSeenAt: 5000,
  sex: 'female', ageDecade: '30s', ethnicityTags: ['hispanic'],
  build: 'slim', height: 'short', skinTone: 'tan',
  hairColor: 'black', hairLength: 'long', hairTexture: 'straight',
  facialHair: 'clean',
  accessoryInventory: [],
};
const carl = {
  playerId: 3, name: 'Carl', lastSeenAt: 1000,
  sex: 'male', ageDecade: '60s+', ethnicityTags: ['black'],
  build: 'heavy', height: 'tall', skinTone: 'dark',
  hairColor: 'gray', hairLength: 'shaved',
  facialHair: 'full', beardColor: 'gray', beardSaltPepper: true,
  accessoryInventory: [
    { accessoryId: 'b1', kind: 'glasses', subtype: 'sunglasses', color: 'black', timesSeen: 2 },
  ],
};
const players = [mike, alice, carl];

// =============================================================================
// Pure helpers
// =============================================================================
describe('usePlayerFinder — pure helpers', () => {
  describe('matchesScalar', () => {
    it('returns true when filter is null', () => {
      expect(matchesScalar('sex', null, 'male')).toBe(true);
    });
    it('returns true when player value is null (uncertain ≠ negative match)', () => {
      expect(matchesScalar('sex', 'male', null)).toBe(true);
    });
    it('strict-axis: lowercase equality', () => {
      expect(matchesScalar('sex', 'male', 'male')).toBe(true);
      expect(matchesScalar('sex', 'male', 'female')).toBe(false);
    });
    it('range-axis: includes neighbors', () => {
      // ageDecade range: 30s neighbors include 20s, 30s, 40s
      expect(matchesScalar('ageDecade', '30s', '40s')).toBe(true);
      expect(matchesScalar('ageDecade', '30s', '20s')).toBe(true);
      expect(matchesScalar('ageDecade', '30s', '60s+')).toBe(false);
    });
    it('range-axis: height neighbors (added in Phase B)', () => {
      expect(matchesScalar('height', 'medium', 'short')).toBe(true);
      expect(matchesScalar('height', 'medium', 'tall')).toBe(true);
      expect(matchesScalar('height', 'short', 'tall')).toBe(false);
    });
  });

  describe('playerEffective', () => {
    it('exposes ethnicity as scalar from ethnicityTags array', () => {
      expect(playerEffective(mike).ethnicity).toBe('caucasian');
      expect(playerEffective(alice).ethnicity).toBe('hispanic');
    });
    it('returns null ethnicity when no tags', () => {
      expect(playerEffective({ playerId: 99, ethnicityTags: [] }).ethnicity).toBe(null);
    });
    it('falls back beardColor → hairColor when beardColor unset', () => {
      expect(playerEffective(alice).beardColor).toBe('black');  // hairColor fallback
    });
    it('translates beardSaltPepper boolean to beardTreatment', () => {
      expect(playerEffective(carl).beardTreatment).toBe('salt-pepper');
    });
  });

  describe('matchesFilters', () => {
    it('empty filters match every player', () => {
      expect(matchesFilters(EMPTY_FILTERS, '', mike)).toBe(true);
      expect(matchesFilters(EMPTY_FILTERS, '', alice)).toBe(true);
      expect(matchesFilters(EMPTY_FILTERS, '', carl)).toBe(true);
    });
    it('filters by sex', () => {
      const f = { ...EMPTY_FILTERS, sex: 'female' };
      expect(matchesFilters(f, '', mike)).toBe(false);
      expect(matchesFilters(f, '', alice)).toBe(true);
      expect(matchesFilters(f, '', carl)).toBe(false);
    });
    it('combines axes with AND semantics', () => {
      // Use strict axes (hairTexture is non-range; facialHair is non-range)
      // to avoid range-axis adjacency widening the match unexpectedly.
      const f = { ...EMPTY_FILTERS, sex: 'female', facialHair: 'goatee' };
      expect(matchesFilters(f, '', mike)).toBe(false);  // wrong sex
      expect(matchesFilters(f, '', alice)).toBe(false); // right sex, wrong facialHair
      expect(matchesFilters(f, '', carl)).toBe(false);  // wrong sex AND facialHair
      // None of the players match both — proves AND wiring.
    });
    it('range-axis adjacency widens the match', () => {
      // ageDecade '50s' is neighbor of '60s+' (carl)
      const f = { ...EMPTY_FILTERS, ageDecade: '50s' };
      expect(matchesFilters(f, '', carl)).toBe(true);
    });
    it('name query is substring search across name + nickname', () => {
      expect(matchesFilters(EMPTY_FILTERS, 'mik', mike)).toBe(true);
      expect(matchesFilters(EMPTY_FILTERS, 'mik', alice)).toBe(false);
    });
  });

  describe('computeCongruency', () => {
    it('returns empty array when filters and player agree on all set axes', () => {
      const f = { ...EMPTY_FILTERS, sex: 'male', ageDecade: '40s' };
      // mike has both — no diff, even though other player axes are set
      // (filter only diffs axes it actually filters on).
      expect(computeCongruency(f, mike)).toEqual([]);
    });
    it('reports mismatch when player has a different value', () => {
      const f = { ...EMPTY_FILTERS, hairColor: 'blonde' };
      const items = computeCongruency(f, mike); // mike is brown
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        axis: 'hairColor', kind: 'mismatch',
        filterValue: 'blonde', playerValue: 'brown',
      });
    });
    it('reports addition when player axis is null', () => {
      const f = { ...EMPTY_FILTERS, beardColor: 'red' };
      // alice has no beardColor (and hairColor=black so effective=black not null)
      // — so use a player with both null. Use a synthetic player.
      const blank = { playerId: 99, ethnicityTags: [] };
      const items = computeCongruency(f, blank);
      expect(items.find((i) => i.axis === 'beardColor')).toMatchObject({
        kind: 'addition', filterValue: 'red', playerValue: null,
      });
    });
    it('reports accessory addition when no inventory item matches', () => {
      const f = {
        ...EMPTY_FILTERS,
        accessory: { kind: 'hat', subtype: 'beanie', color: 'green', note: '' },
      };
      const items = computeCongruency(f, mike); // mike has cap/red/KC Royals
      expect(items.find((i) => i.axis === 'accessory')).toBeTruthy();
    });
    it('does NOT report accessory addition when inventory matches', () => {
      const f = {
        ...EMPTY_FILTERS,
        accessory: { kind: 'hat', subtype: null, color: null, note: '' },
      };
      const items = computeCongruency(f, mike); // mike has hat in inventory
      expect(items.find((i) => i.axis === 'accessory')).toBeFalsy();
    });
  });

  it('SCALAR_KEYS exports include the canonical axes', () => {
    expect(SCALAR_KEYS).toContain('sex');
    expect(SCALAR_KEYS).toContain('ethnicity');
    expect(SCALAR_KEYS).toContain('height');
    expect(SCALAR_KEYS).toContain('hairTreatment');
    expect(SCALAR_KEYS).toContain('beardTreatment');
  });
});

// =============================================================================
// Hook integration
// =============================================================================
describe('usePlayerFinder — hook state machine', () => {
  it('returns all players sorted by lastSeen desc with no filters', () => {
    const { result } = renderHook(() => usePlayerFinder({ allPlayers: players }));
    const ids = result.current.results.map((r) => r.player.playerId);
    expect(ids).toEqual([2, 1, 3]); // alice 5000, mike 3000, carl 1000
  });

  it('setScalar applies + toggles off on second tap', () => {
    const { result } = renderHook(() => usePlayerFinder({ allPlayers: players }));
    act(() => result.current.setScalar('sex', 'male'));
    expect(result.current.filters.sex).toBe('male');
    act(() => result.current.setScalar('sex', 'male'));
    expect(result.current.filters.sex).toBe(null);
  });

  it('setEthnicity is single-select (changing to a new tag replaces)', () => {
    const { result } = renderHook(() => usePlayerFinder({ allPlayers: players }));
    act(() => result.current.setEthnicity('caucasian'));
    expect(result.current.filters.ethnicity).toBe('caucasian');
    act(() => result.current.setEthnicity('black'));
    expect(result.current.filters.ethnicity).toBe('black');
    act(() => result.current.setEthnicity('black')); // tap active to clear
    expect(result.current.filters.ethnicity).toBe(null);
  });

  it('setAccessory patches the composite without losing other fields', () => {
    const { result } = renderHook(() => usePlayerFinder({ allPlayers: players }));
    act(() => result.current.setAccessory({ kind: 'hat' }));
    act(() => result.current.setAccessory({ color: 'red' }));
    expect(result.current.filters.accessory).toEqual({
      kind: 'hat', subtype: null, color: 'red', note: '',
    });
  });

  it('clearAll resets filters and nameQuery', () => {
    const { result } = renderHook(() => usePlayerFinder({ allPlayers: players }));
    act(() => {
      result.current.setScalar('sex', 'male');
      result.current.setNameQuery('mik');
      result.current.setAccessory({ kind: 'hat' });
    });
    act(() => result.current.clearAll());
    expect(result.current.filters.sex).toBe(null);
    expect(result.current.filters.accessory.kind).toBe(null);
    expect(result.current.nameQuery).toBe('');
  });

  it('hasActiveFilters is true when any axis is set', () => {
    const { result } = renderHook(() => usePlayerFinder({ allPlayers: players }));
    expect(result.current.hasActiveFilters).toBe(false);
    act(() => result.current.setScalar('sex', 'male'));
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('tabBadges count active axes per group', () => {
    const { result } = renderHook(() => usePlayerFinder({ allPlayers: players }));
    act(() => {
      result.current.setScalar('skinTone', 'tan');
      result.current.setScalar('hairColor', 'brown');
      result.current.setScalar('hairLength', 'short');
      result.current.setScalar('beardColor', 'brown');
      result.current.setAccessory({ kind: 'hat', color: 'red' });
    });
    expect(result.current.tabBadges).toEqual({
      skin: 1,
      hair: 2,      // hairColor + hairLength
      beard: 1,     // beardColor
      accessory: 2, // kind + color
    });
  });

  it('loadRecord seeds decisions for each diff item', () => {
    const { result } = renderHook(() => usePlayerFinder({ allPlayers: players }));
    act(() => result.current.setScalar('hairColor', 'blonde')); // mike is brown → mismatch
    act(() => result.current.loadRecord(mike));
    expect(result.current.activeRecord).toBe(mike);
    // Default decision for a mismatch is 'player' (keep player's value).
    expect(result.current.decisions['hairColor-mismatch']).toBe('player');
  });

  it('decideAxis updates the per-axis decision', () => {
    const { result } = renderHook(() => usePlayerFinder({ allPlayers: players }));
    act(() => result.current.setScalar('hairColor', 'blonde'));
    act(() => result.current.loadRecord(mike));
    act(() => result.current.decideAxis('hairColor-mismatch', 'filter'));
    expect(result.current.decisions['hairColor-mismatch']).toBe('filter');
  });

  it('cancelLoaded clears activeRecord and decisions', () => {
    const { result } = renderHook(() => usePlayerFinder({ allPlayers: players }));
    act(() => result.current.loadRecord(mike));
    act(() => result.current.cancelLoaded());
    expect(result.current.activeRecord).toBe(null);
    expect(result.current.decisions).toEqual({});
  });

  it('livePlayer mirrors filters when no record loaded', () => {
    const { result } = renderHook(() => usePlayerFinder({ allPlayers: players }));
    act(() => {
      result.current.setScalar('sex', 'female');
      result.current.setEthnicity('hispanic');
      result.current.setScalar('hairTreatment', 'salt-pepper');
    });
    expect(result.current.livePlayer.sex).toBe('female');
    expect(result.current.livePlayer.ethnicityTags).toEqual(['hispanic']);
    expect(result.current.livePlayer.hairSaltPepper).toBe(true);
  });

  it('accessory filter sorts matchers to the top', () => {
    const { result } = renderHook(() => usePlayerFinder({ allPlayers: players }));
    act(() => result.current.setAccessory({ kind: 'glasses' }));
    // Carl has glasses inventory → should sort first even though alice has
    // higher lastSeenAt. Mike is filtered out (no glasses).
    const ids = result.current.results.map((r) => r.player.playerId);
    expect(ids[0]).toBe(3); // carl
  });

  it('initialFilters seed the filter state at mount', () => {
    const seed = { sex: 'male', skinTone: 'dark' };
    const { result } = renderHook(() =>
      usePlayerFinder({ allPlayers: players, initialFilters: seed }),
    );
    expect(result.current.filters.sex).toBe('male');
    expect(result.current.filters.skinTone).toBe('dark');
  });

  it('initialActiveRecord pre-loads the active record', () => {
    const { result } = renderHook(() =>
      usePlayerFinder({ allPlayers: players, initialActiveRecord: mike }),
    );
    expect(result.current.activeRecord).toBe(mike);
  });
});
