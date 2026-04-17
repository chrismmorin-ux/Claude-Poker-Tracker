// @vitest-environment jsdom
/**
 * usePlayerFiltering.test.js - Tests for player filtering hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayerFiltering, scorePlayerMatch } from '../usePlayerFiltering';
import { createMockPlayer } from '../../test/utils';

describe('usePlayerFiltering', () => {
  // Test players fixture
  const createTestPlayers = () => [
    createMockPlayer({
      playerId: 1,
      name: 'Alice Smith',
      nickname: 'Ace',
      gender: 'female',
      build: 'average',
      ethnicity: 'white',
      styleTags: ['tight', 'aggressive'],
      hat: true,
      sunglasses: false,
      lastSeenAt: 1000,
      handCount: 50,
    }),
    createMockPlayer({
      playerId: 2,
      name: 'Bob Jones',
      nickname: 'Bobby',
      gender: 'male',
      build: 'heavy',
      ethnicity: 'black',
      styleTags: ['loose', 'passive'],
      facialHair: 'beard',
      hat: false,
      sunglasses: true,
      lastSeenAt: 3000,
      handCount: 100,
    }),
    createMockPlayer({
      playerId: 3,
      name: 'Charlie Brown',
      nickname: '',
      gender: 'male',
      build: 'thin',
      ethnicity: 'asian',
      styleTags: ['tight', 'passive'],
      facialHair: 'mustache',
      hat: true,
      sunglasses: true,
      lastSeenAt: 2000,
      handCount: 75,
    }),
  ];

  describe('initial state', () => {
    it('returns all players when no filters applied', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      expect(result.current.filteredPlayers).toHaveLength(3);
    });

    it('returns empty array when no players provided', () => {
      const { result } = renderHook(() => usePlayerFiltering([]));
      expect(result.current.filteredPlayers).toEqual([]);
    });

    it('handles undefined players gracefully', () => {
      const { result } = renderHook(() => usePlayerFiltering());
      expect(result.current.filteredPlayers).toEqual([]);
    });

    it('has no active filters initially', () => {
      const { result } = renderHook(() => usePlayerFiltering([]));
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('defaults sortBy to lastSeen', () => {
      const { result } = renderHook(() => usePlayerFiltering([]));
      expect(result.current.sortBy).toBe('lastSeen');
    });

    it('returns empty searchTerm initially', () => {
      const { result } = renderHook(() => usePlayerFiltering([]));
      expect(result.current.searchTerm).toBe('');
    });
  });

  describe('search filtering', () => {
    it('filters by name (case-insensitive)', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setSearchTerm('alice');
      });

      expect(result.current.filteredPlayers).toHaveLength(1);
      expect(result.current.filteredPlayers[0].name).toBe('Alice Smith');
    });

    it('filters by partial name match', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setSearchTerm('rown');
      });

      expect(result.current.filteredPlayers).toHaveLength(1);
      expect(result.current.filteredPlayers[0].name).toBe('Charlie Brown');
    });

    it('filters by nickname', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setSearchTerm('bobby');
      });

      expect(result.current.filteredPlayers).toHaveLength(1);
      expect(result.current.filteredPlayers[0].nickname).toBe('Bobby');
    });

    it('returns empty when no match', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setSearchTerm('xyz123');
      });

      expect(result.current.filteredPlayers).toHaveLength(0);
    });

    it('marks searchTerm as active filter', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setSearchTerm('test');
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  describe('style tag filtering', () => {
    it('filters by style tag', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setFilterTag('tight');
      });

      expect(result.current.filteredPlayers).toHaveLength(2);
      expect(result.current.filteredPlayers.every(p => p.styleTags.includes('tight'))).toBe(true);
    });

    it('returns empty when tag not found', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setFilterTag('maniac');
      });

      expect(result.current.filteredPlayers).toHaveLength(0);
    });
  });

  describe('gender filtering', () => {
    it('filters by gender', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setFilterGender('male');
      });

      expect(result.current.filteredPlayers).toHaveLength(2);
      expect(result.current.filteredPlayers.every(p => p.gender === 'male')).toBe(true);
    });
  });

  describe('build filtering', () => {
    it('filters by build', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setFilterBuild('heavy');
      });

      expect(result.current.filteredPlayers).toHaveLength(1);
      expect(result.current.filteredPlayers[0].name).toBe('Bob Jones');
    });
  });

  describe('ethnicity filtering', () => {
    it('filters by ethnicity', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setFilterEthnicity('asian');
      });

      expect(result.current.filteredPlayers).toHaveLength(1);
      expect(result.current.filteredPlayers[0].name).toBe('Charlie Brown');
    });
  });

  describe('facial hair filtering', () => {
    it('filters by facial hair', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setFilterFacialHair('beard');
      });

      expect(result.current.filteredPlayers).toHaveLength(1);
      expect(result.current.filteredPlayers[0].name).toBe('Bob Jones');
    });
  });

  describe('hat filtering', () => {
    it('filters for players with hats', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setFilterHat('yes');
      });

      expect(result.current.filteredPlayers).toHaveLength(2);
      expect(result.current.filteredPlayers.every(p => p.hat === true)).toBe(true);
    });

    it('filters for players without hats', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setFilterHat('no');
      });

      expect(result.current.filteredPlayers).toHaveLength(1);
      expect(result.current.filteredPlayers[0].hat).toBe(false);
    });
  });

  describe('sunglasses filtering', () => {
    it('filters for players with sunglasses', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setFilterSunglasses('yes');
      });

      expect(result.current.filteredPlayers).toHaveLength(2);
      expect(result.current.filteredPlayers.every(p => p.sunglasses === true)).toBe(true);
    });

    it('filters for players without sunglasses', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setFilterSunglasses('no');
      });

      expect(result.current.filteredPlayers).toHaveLength(1);
      expect(result.current.filteredPlayers[0].sunglasses).toBe(false);
    });
  });

  describe('combined filters', () => {
    it('applies multiple filters simultaneously', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setFilterGender('male');
        result.current.setFilterHat('yes');
      });

      expect(result.current.filteredPlayers).toHaveLength(1);
      expect(result.current.filteredPlayers[0].name).toBe('Charlie Brown');
    });

    it('applies search with other filters', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setSearchTerm('b');
        result.current.setFilterGender('male');
      });

      expect(result.current.filteredPlayers).toHaveLength(2);
    });
  });

  describe('sorting', () => {
    it('sorts by lastSeen (default, descending)', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      expect(result.current.filteredPlayers[0].lastSeenAt).toBe(3000);
      expect(result.current.filteredPlayers[1].lastSeenAt).toBe(2000);
      expect(result.current.filteredPlayers[2].lastSeenAt).toBe(1000);
    });

    it('sorts by name (ascending)', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setSortBy('name');
      });

      expect(result.current.filteredPlayers[0].name).toBe('Alice Smith');
      expect(result.current.filteredPlayers[1].name).toBe('Bob Jones');
      expect(result.current.filteredPlayers[2].name).toBe('Charlie Brown');
    });

    it('sorts by handCount (descending)', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setSortBy('handCount');
      });

      expect(result.current.filteredPlayers[0].handCount).toBe(100);
      expect(result.current.filteredPlayers[1].handCount).toBe(75);
      expect(result.current.filteredPlayers[2].handCount).toBe(50);
    });

    it('handles null/undefined values in sorting', () => {
      const players = [
        createMockPlayer({ playerId: 1, name: 'Test', lastSeenAt: null }),
        createMockPlayer({ playerId: 2, name: 'Test2', lastSeenAt: 1000 }),
      ];
      const { result } = renderHook(() => usePlayerFiltering(players));

      expect(result.current.filteredPlayers[0].lastSeenAt).toBe(1000);
      expect(result.current.filteredPlayers[1].lastSeenAt).toBe(null);
    });
  });

  describe('allStyleTags', () => {
    it('returns unique style tags from all players', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      expect(result.current.allStyleTags).toContain('tight');
      expect(result.current.allStyleTags).toContain('aggressive');
      expect(result.current.allStyleTags).toContain('loose');
      expect(result.current.allStyleTags).toContain('passive');
    });

    it('returns sorted tags', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      const tags = result.current.allStyleTags;
      const sorted = [...tags].sort();
      expect(tags).toEqual(sorted);
    });

    it('handles players without styleTags', () => {
      const players = [
        createMockPlayer({ playerId: 1, styleTags: undefined }),
        createMockPlayer({ playerId: 2, styleTags: ['test'] }),
      ];
      const { result } = renderHook(() => usePlayerFiltering(players));

      expect(result.current.allStyleTags).toEqual(['test']);
    });
  });

  describe('clearFilters', () => {
    it('clears all filters', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setSearchTerm('test');
        result.current.setFilterTag('tight');
        result.current.setFilterGender('male');
        result.current.setFilterBuild('heavy');
        result.current.setFilterEthnicity('asian');
        result.current.setFilterFacialHair('beard');
        result.current.setFilterHat('yes');
        result.current.setFilterSunglasses('yes');
      });

      expect(result.current.hasActiveFilters).toBe(true);

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.searchTerm).toBe('');
      expect(result.current.filterTag).toBe('');
      expect(result.current.filterGender).toBe('');
      expect(result.current.filterBuild).toBe('');
      expect(result.current.filterEthnicity).toBe('');
      expect(result.current.filterFacialHair).toBe('');
      expect(result.current.filterHat).toBe('');
      expect(result.current.filterSunglasses).toBe('');
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('does not affect sortBy', () => {
      const players = createTestPlayers();
      const { result } = renderHook(() => usePlayerFiltering(players));

      act(() => {
        result.current.setSortBy('name');
        result.current.setSearchTerm('test');
      });

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.sortBy).toBe('name');
    });
  });

  describe('hasActiveFilters', () => {
    it('returns true when any filter is set', () => {
      const { result } = renderHook(() => usePlayerFiltering([]));

      act(() => {
        result.current.setFilterHat('yes');
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('returns false when all filters cleared', () => {
      const { result } = renderHook(() => usePlayerFiltering([]));

      act(() => {
        result.current.setFilterHat('yes');
      });

      act(() => {
        result.current.setFilterHat('');
      });

      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe('state setters', () => {
    it('exposes all filter setters', () => {
      const { result } = renderHook(() => usePlayerFiltering([]));

      expect(typeof result.current.setSearchTerm).toBe('function');
      expect(typeof result.current.setSortBy).toBe('function');
      expect(typeof result.current.setFilterTag).toBe('function');
      expect(typeof result.current.setFilterGender).toBe('function');
      expect(typeof result.current.setFilterBuild).toBe('function');
      expect(typeof result.current.setFilterEthnicity).toBe('function');
      expect(typeof result.current.setFilterFacialHair).toBe('function');
      expect(typeof result.current.setFilterHat).toBe('function');
      expect(typeof result.current.setFilterSunglasses).toBe('function');
      expect(typeof result.current.clearFilters).toBe('function');
    });
  });
});

// =============================================================================
// scorePlayerMatch — PEO-3 primitive
// =============================================================================

describe('scorePlayerMatch', () => {
  const mike = {
    playerId: 1,
    name: 'Mike',
    nickname: 'Big Mike',
    avatarFeatures: {
      skin: 'skin.medium',
      hair: 'hair.buzz',
      beard: 'beard.goatee',
      glasses: 'glasses.none',
    },
  };

  describe('name prefix match', () => {
    it('returns indices when query matches name prefix', () => {
      const r = scorePlayerMatch(mike, { nameQuery: 'Mi' });
      expect(r.nameMatchStart).toBe(0);
      expect(r.nameMatchEnd).toBe(2);
      expect(r.passesFilters).toBe(true);
    });

    it('is case-insensitive', () => {
      const r = scorePlayerMatch(mike, { nameQuery: 'MI' });
      expect(r.nameMatchEnd).toBe(2);
    });

    it('falls back to nickname prefix match when name does not match', () => {
      const r = scorePlayerMatch(mike, { nameQuery: 'Bi' });
      expect(r.nameMatchStart).toBe(0);
      expect(r.nameMatchEnd).toBe(2);
    });

    it('returns null name indices + fails filter when no prefix match', () => {
      const r = scorePlayerMatch(mike, { nameQuery: 'xyz' });
      expect(r.nameMatchStart).toBeNull();
      expect(r.passesFilters).toBe(false);
    });

    it('empty name query does not reject', () => {
      const r = scorePlayerMatch(mike, { nameQuery: '' });
      expect(r.nameMatchStart).toBeNull();
      expect(r.passesFilters).toBe(true);
    });
  });

  describe('feature filter match', () => {
    it('reports matched features', () => {
      const r = scorePlayerMatch(mike, {
        featureFilters: { beard: 'beard.goatee', hair: 'hair.buzz' },
      });
      expect(r.matchedFeatures.has('beard')).toBe(true);
      expect(r.matchedFeatures.has('hair')).toBe(true);
      expect(r.allFiltersMatch).toBe(true);
      expect(r.passesFilters).toBe(true);
    });

    it('reports unmatched filter categories', () => {
      const r = scorePlayerMatch(mike, {
        featureFilters: { beard: 'beard.full', hair: 'hair.buzz' },
      });
      expect(r.unmatchedFeatureFilters.has('beard')).toBe(true);
      expect(r.matchedFeatures.has('hair')).toBe(true);
      expect(r.allFiltersMatch).toBe(false);
      expect(r.passesFilters).toBe(false);
    });

    it('ignores empty filter values', () => {
      const r = scorePlayerMatch(mike, {
        featureFilters: { beard: '', hair: 'hair.buzz' },
      });
      expect(r.matchedFeatures.has('hair')).toBe(true);
      expect(r.unmatchedFeatureFilters.size).toBe(0);
    });

    it('handles player with null avatarFeatures (legacy)', () => {
      const legacy = { playerId: 2, name: 'Old', avatarFeatures: null };
      const r = scorePlayerMatch(legacy, { featureFilters: { beard: 'beard.goatee' } });
      expect(r.allFiltersMatch).toBe(false);
      expect(r.unmatchedFeatureFilters.has('beard')).toBe(true);
    });
  });

  describe('AND semantics across name + features', () => {
    it('passesFilters requires both name prefix AND all filter match', () => {
      const r = scorePlayerMatch(mike, {
        nameQuery: 'Mi',
        featureFilters: { beard: 'beard.goatee' },
      });
      expect(r.passesFilters).toBe(true);
    });

    it('fails when name matches but a filter does not', () => {
      const r = scorePlayerMatch(mike, {
        nameQuery: 'Mi',
        featureFilters: { beard: 'beard.full' },
      });
      expect(r.passesFilters).toBe(false);
    });

    it('fails when all filters match but name does not', () => {
      const r = scorePlayerMatch(mike, {
        nameQuery: 'xyz',
        featureFilters: { beard: 'beard.goatee' },
      });
      expect(r.passesFilters).toBe(false);
    });
  });
});
