/**
 * usePlayerFiltering.js - Player filtering, searching, and sorting hook
 *
 * Encapsulates all player filtering logic for PlayersView.
 * Extracted from PlayersView.jsx to improve maintainability.
 */

import { useState, useMemo, useCallback } from 'react';

/**
 * Custom hook for player filtering, searching, and sorting
 * @param {Array} allPlayers - All players from player state
 * @returns {Object} Filtered players, filter state, and setters
 */
export const usePlayerFiltering = (allPlayers = []) => {
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterBuild, setFilterBuild] = useState('');
  const [filterEthnicity, setFilterEthnicity] = useState('');
  const [filterFacialHair, setFilterFacialHair] = useState('');
  const [filterHat, setFilterHat] = useState(''); // '', 'yes', 'no'
  const [filterSunglasses, setFilterSunglasses] = useState(''); // '', 'yes', 'no'
  const [sortBy, setSortBy] = useState('lastSeen'); // 'lastSeen', 'name', 'handCount'

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

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'lastSeen') {
        return (b.lastSeenAt || 0) - (a.lastSeenAt || 0);
      } else if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'handCount') {
        return (b.handCount || 0) - (a.handCount || 0);
      }
      return 0;
    });

    return result;
  }, [allPlayers, searchTerm, filterTag, filterGender, filterBuild, filterEthnicity, filterFacialHair, filterHat, filterSunglasses, sortBy]);

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
      filterSunglasses
    );
  }, [searchTerm, filterTag, filterGender, filterBuild, filterEthnicity, filterFacialHair, filterHat, filterSunglasses]);

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

    // Utility
    clearFilters,
    hasActiveFilters,
  };
};
