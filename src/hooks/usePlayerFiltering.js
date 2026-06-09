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
import {
  migratePlayerLegacyFields,
  LEGACY_GENDER_TO_SEX,
  LEGACY_ETHNICITY_TO_TAG,
} from '../utils/identityAvatar/migratePlayerLegacyFields';
// scorePlayerMatch moved to src/utils/playerMatching/ in WS-164 / SPR-110 and
// extended with the §PIO-G4-PVA weighted recognition score + confidence band.
// Re-exported here to preserve the public import path used by tests + consumers.
import { scorePlayerMatch } from '../utils/playerMatching/scorePlayerMatch.js';

export { scorePlayerMatch };

// Phase C (plan floating-questing-conway, 2026-05-06): the hook reads modern
// identification fields (sex / ethnicityTags / eyewear / headwear). PlayerFilters
// dropdowns still emit legacy-shape values ('Male', 'White/Caucasian', 'yes'/'no')
// because the legacy filter dropdown UI is owned by Phase D. Translation lives here.
const norm = (s) => (s || '').toString().trim().toLowerCase();

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
    // Phase C: migrate each record once at the top so the predicates below
    // can read modern fields. migratePlayerLegacyFields is non-destructive on
    // already-migrated records, so this is idempotent + safe to apply broadly.
    let result = allPlayers.map(p => migratePlayerLegacyFields(p));

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

    // Filter by gender → sex (modern). Translate legacy dropdown value
    // ('Male' / 'female') through the migration map to the canonical sex enum.
    if (filterGender) {
      const target = LEGACY_GENDER_TO_SEX[norm(filterGender)] || norm(filterGender);
      result = result.filter(p => p.sex === target);
    }

    // Filter by build
    if (filterBuild) {
      result = result.filter(p => p.build === filterBuild);
    }

    // Filter by ethnicity → ethnicityTags (modern). Translate legacy display
    // string ('White/Caucasian') to canonical tag ('caucasian') via the
    // migration map, then array-contains match.
    if (filterEthnicity) {
      const target = LEGACY_ETHNICITY_TO_TAG[norm(filterEthnicity)] || norm(filterEthnicity);
      result = result.filter(p =>
        Array.isArray(p.ethnicityTags) && p.ethnicityTags.includes(target)
      );
    }

    // Filter by facial hair
    if (filterFacialHair) {
      result = result.filter(p => p.facialHair === filterFacialHair);
    }

    // Filter by hat → headwear (modern). 'yes' = wears any headwear, 'no' = none.
    if (filterHat === 'yes') {
      result = result.filter(p => !!p.headwear);
    } else if (filterHat === 'no') {
      result = result.filter(p => !p.headwear);
    }

    // Filter by sunglasses → eyewear (modern). Strict: 'yes' matches sunglasses
    // ONLY (not clear/aviators/readers); 'no' excludes sunglasses (clear/readers
    // pass through, since the dropdown is binary "Wears Sunglasses").
    if (filterSunglasses === 'yes') {
      result = result.filter(p => p.eyewear === 'sunglasses');
    } else if (filterSunglasses === 'no') {
      result = result.filter(p => p.eyewear !== 'sunglasses');
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
