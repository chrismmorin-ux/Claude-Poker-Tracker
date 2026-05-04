/**
 * usePlayerFiltering.js - Player filtering, searching, and sorting hook
 *
 * Encapsulates all player filtering logic for PlayersView.
 * Extracted from PlayersView.jsx to improve maintainability.
 *
 * Also exports `scorePlayerMatch` (PEO-3) — a pure primitive used by the
 * PlayerPickerView's ResultCard to render highlight metadata (name-prefix
 * bolding + matched-feature accents).
 */

import { useState, useMemo, useCallback, useEffect } from 'react';

// W4-A1-F8 Phase 1: persist PlayerFilters state to localStorage so the
// 10 selects + search + sort survive a reload. Mirrors the SV-F7 pattern
// from SessionsView.jsx but generalized to a JSON-encoded bundle.
const STORAGE_KEY = 'playersView.filters';

const loadInitialFilters = () => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

// =============================================================================
// scorePlayerMatch — pure highlight primitive (PEO-3)
// =============================================================================

/**
 * Determine the highlight metadata for a player against a live query.
 *
 * @param {object} player  — a player record (from allPlayers)
 * @param {object} query
 *   @param {string} query.nameQuery         — live text input (lowercased internally)
 *   @param {object} query.featureFilters    — { skin?, hair?, hairColor?, beard?,
 *                                               beardColor?, eyes?, eyeColor?,
 *                                               glasses?, hat? } (each value is a
 *                                               namespaced id OR undefined)
 *   @param {string} [query.nameField='name']  — which player field to match prefix on
 *                                               (defaults to name; picker also
 *                                               checks nickname via the nameMatch*
 *                                               fields below).
 * @returns {{
 *   nameMatchStart: number | null,     // inclusive, 0-based (case-insensitive prefix)
 *   nameMatchEnd: number | null,       // exclusive
 *   matchedFeatures: Set<string>,      // categories that matched a filter
 *   unmatchedFeatureFilters: Set<string>, // filters where player has a different value
 *   allFiltersMatch: boolean,
 *   passesFilters: boolean,            // true ⇔ allFiltersMatch AND name-prefix matches
 * }}
 */
export const scorePlayerMatch = (player, query = {}) => {
  const nameQuery = (query.nameQuery ?? '').toString().trim();
  const featureFilters = query.featureFilters || {};

  // --- Name prefix match (checked against both name and nickname) ---------
  let nameMatchStart = null;
  let nameMatchEnd = null;
  let namePasses = true;

  if (nameQuery.length > 0) {
    const q = nameQuery.toLowerCase();
    const candidates = [player?.name, player?.nickname].filter(Boolean);
    let best = null;
    for (const candidate of candidates) {
      const idx = candidate.toLowerCase().indexOf(q);
      if (idx === 0) {
        // Prefer a prefix match on `name` specifically — but accept nickname too.
        best = { start: 0, end: q.length, onName: candidate === player?.name };
        if (best.onName) break;
      }
    }
    if (best) {
      nameMatchStart = best.start;
      nameMatchEnd = best.end;
    } else {
      namePasses = false;
    }
  }

  // --- Feature filter match -----------------------------------------------
  const matchedFeatures = new Set();
  const unmatchedFeatureFilters = new Set();
  const playerFeatures = player?.avatarFeatures || {};
  const activeFilterCategories = Object.entries(featureFilters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '');

  for (const [category, filterValue] of activeFilterCategories) {
    if (playerFeatures[category] === filterValue) {
      matchedFeatures.add(category);
    } else {
      unmatchedFeatureFilters.add(category);
    }
  }
  const allFiltersMatch = unmatchedFeatureFilters.size === 0;

  return {
    nameMatchStart,
    nameMatchEnd,
    matchedFeatures,
    unmatchedFeatureFilters,
    allFiltersMatch,
    passesFilters: namePasses && allFiltersMatch,
  };
};

/**
 * Custom hook for player filtering, searching, and sorting
 * @param {Array} allPlayers - All players from player state
 * @param {Object} [tendencyMap={}] - Map of playerId -> tendency stats (for VPIP sorting)
 * @returns {Object} Filtered players, filter state, and setters
 */
export const usePlayerFiltering = (allPlayers = [], tendencyMap = {}) => {
  // Filter state — initialized from localStorage (W4-A1-F8 Phase 1).
  // useMemo([]) so the read happens once on mount, not on every render.
  const initial = useMemo(loadInitialFilters, []);
  const [searchTerm, setSearchTerm] = useState(initial.searchTerm ?? '');
  const [filterTag, setFilterTag] = useState(initial.filterTag ?? '');
  const [filterGender, setFilterGender] = useState(initial.filterGender ?? '');
  const [filterBuild, setFilterBuild] = useState(initial.filterBuild ?? '');
  const [filterEthnicity, setFilterEthnicity] = useState(initial.filterEthnicity ?? '');
  const [filterFacialHair, setFilterFacialHair] = useState(initial.filterFacialHair ?? '');
  const [filterHat, setFilterHat] = useState(initial.filterHat ?? ''); // '', 'yes', 'no'
  const [filterSunglasses, setFilterSunglasses] = useState(initial.filterSunglasses ?? ''); // '', 'yes', 'no'
  // PIO G5 child D (WS-163 / SPR-035, 2026-05-04) — new filter axes.
  const [filterAgeDecade, setFilterAgeDecade] = useState(initial.filterAgeDecade ?? '');
  const [filterWardrobe, setFilterWardrobe] = useState(initial.filterWardrobe ?? '');
  const [filterJewelry, setFilterJewelry] = useState(initial.filterJewelry ?? '');
  const [filterLogo, setFilterLogo] = useState(initial.filterLogo ?? '');
  const [sortBy, setSortBy] = useState(initial.sortBy ?? 'lastSeen'); // 'lastSeen', 'name', 'handCount'

  // Persist on any filter change. Single bundled write keeps the storage
  // shape consistent and avoids 10 individual setItem calls.
  useEffect(() => {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        searchTerm, filterTag, filterGender, filterBuild, filterEthnicity,
        filterFacialHair, filterHat, filterSunglasses,
        filterAgeDecade, filterWardrobe, filterJewelry, filterLogo,
        sortBy,
      }));
    } catch {
      // localStorage unavailable (private mode, quota exceeded) — silent.
    }
  }, [searchTerm, filterTag, filterGender, filterBuild, filterEthnicity, filterFacialHair, filterHat, filterSunglasses, filterAgeDecade, filterWardrobe, filterJewelry, filterLogo, sortBy]);

  // Filtered and sorted players
  const filteredPlayers = useMemo(() => {
    let result = [...allPlayers];

    // Filter by search term (name or nickname)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.nickname && p.nickname.toLowerCase().includes(term))
      );
    }

    // Filter by style tag
    if (filterTag) {
      result = result.filter(p =>
        p.styleTags && p.styleTags.includes(filterTag)
      );
    }

    // Filter by gender
    if (filterGender) {
      result = result.filter(p => p.gender === filterGender);
    }

    // Filter by build
    if (filterBuild) {
      result = result.filter(p => p.build === filterBuild);
    }

    // Filter by ethnicity
    if (filterEthnicity) {
      result = result.filter(p => p.ethnicity === filterEthnicity);
    }

    // Filter by facial hair
    if (filterFacialHair) {
      result = result.filter(p => p.facialHair === filterFacialHair);
    }

    // Filter by hat
    if (filterHat === 'yes') {
      result = result.filter(p => p.hat === true);
    } else if (filterHat === 'no') {
      result = result.filter(p => !p.hat);
    }

    // Filter by sunglasses
    if (filterSunglasses === 'yes') {
      result = result.filter(p => p.sunglasses === true);
    } else if (filterSunglasses === 'no') {
      result = result.filter(p => !p.sunglasses);
    }

    // PIO G5 child D (WS-163 / SPR-035) — new filter axes.

    // Filter by age decade (string equality on Player.ageDecade)
    if (filterAgeDecade) {
      result = result.filter(p => p.ageDecade === filterAgeDecade);
    }

    // Filter by wardrobe (array-contains on Player.wardrobe)
    if (filterWardrobe) {
      result = result.filter(p => Array.isArray(p.wardrobe) && p.wardrobe.includes(filterWardrobe));
    }

    // Filter by jewelry (array-contains on Player.jewelry)
    if (filterJewelry) {
      result = result.filter(p => Array.isArray(p.jewelry) && p.jewelry.includes(filterJewelry));
    }

    // Filter by logo (array-contains on Player.logo)
    if (filterLogo) {
      result = result.filter(p => Array.isArray(p.logo) && p.logo.includes(filterLogo));
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'lastSeen') {
        return (b.lastSeenAt || 0) - (a.lastSeenAt || 0);
      } else if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'handCount') {
        return (b.handCount || 0) - (a.handCount || 0);
      } else if (sortBy === 'vpip') {
        const aVpip = tendencyMap[a.playerId]?.vpip ?? -1;
        const bVpip = tendencyMap[b.playerId]?.vpip ?? -1;
        return bVpip - aVpip;
      }
      return 0;
    });

    return result;
  }, [allPlayers, searchTerm, filterTag, filterGender, filterBuild, filterEthnicity, filterFacialHair, filterHat, filterSunglasses, filterAgeDecade, filterWardrobe, filterJewelry, filterLogo, sortBy, tendencyMap]);

  // Get unique style tags from all players for filter dropdown
  const allStyleTags = useMemo(() => {
    const tags = new Set();
    allPlayers.forEach(p => {
      if (p.styleTags) {
        p.styleTags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }, [allPlayers]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterTag('');
    setFilterGender('');
    setFilterBuild('');
    setFilterEthnicity('');
    setFilterFacialHair('');
    setFilterHat('');
    setFilterSunglasses('');
    setFilterAgeDecade('');
    setFilterWardrobe('');
    setFilterJewelry('');
    setFilterLogo('');
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(
      searchTerm ||
      filterTag ||
      filterGender ||
      filterBuild ||
      filterEthnicity ||
      filterFacialHair ||
      filterHat ||
      filterSunglasses ||
      filterAgeDecade ||
      filterWardrobe ||
      filterJewelry ||
      filterLogo
    );
  }, [searchTerm, filterTag, filterGender, filterBuild, filterEthnicity, filterFacialHair, filterHat, filterSunglasses, filterAgeDecade, filterWardrobe, filterJewelry, filterLogo]);

  return {
    // Filtered results
    filteredPlayers,
    allStyleTags,

    // Search
    searchTerm,
    setSearchTerm,

    // Sorting
    sortBy,
    setSortBy,

    // Filters - individual
    filterTag,
    setFilterTag,
    filterGender,
    setFilterGender,
    filterBuild,
    setFilterBuild,
    filterEthnicity,
    setFilterEthnicity,
    filterFacialHair,
    setFilterFacialHair,
    filterHat,
    setFilterHat,
    filterSunglasses,
    setFilterSunglasses,

    // PIO G5 child D (WS-163 / SPR-035) — new filter axes
    filterAgeDecade,
    setFilterAgeDecade,
    filterWardrobe,
    setFilterWardrobe,
    filterJewelry,
    setFilterJewelry,
    filterLogo,
    setFilterLogo,

    // Utility
    clearFilters,
    hasActiveFilters,
  };
};
