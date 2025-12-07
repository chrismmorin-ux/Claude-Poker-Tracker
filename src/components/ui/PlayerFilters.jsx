/**
 * PlayerFilters.jsx - Search, sort, and filter controls for players
 *
 * Extracted from PlayersView.jsx for better maintainability.
 */

import React from 'react';
import {
  ETHNICITY_OPTIONS,
  BUILD_OPTIONS,
  GENDER_OPTIONS,
  FACIAL_HAIR_OPTIONS
} from '../../constants/playerConstants';

/**
 * PlayerFilters - Search, sort, and physical feature filter controls
 *
 * @param {Object} props
 * @param {string} props.searchTerm - Current search term
 * @param {Function} props.setSearchTerm - Update search term
 * @param {string} props.sortBy - Current sort field
 * @param {Function} props.setSortBy - Update sort field
 * @param {string} props.filterGender - Gender filter value
 * @param {Function} props.setFilterGender - Update gender filter
 * @param {string} props.filterBuild - Build filter value
 * @param {Function} props.setFilterBuild - Update build filter
 * @param {string} props.filterEthnicity - Ethnicity filter value
 * @param {Function} props.setFilterEthnicity - Update ethnicity filter
 * @param {string} props.filterFacialHair - Facial hair filter value
 * @param {Function} props.setFilterFacialHair - Update facial hair filter
 * @param {string} props.filterHat - Hat filter value ('', 'yes', 'no')
 * @param {Function} props.setFilterHat - Update hat filter
 * @param {string} props.filterSunglasses - Sunglasses filter value
 * @param {Function} props.setFilterSunglasses - Update sunglasses filter
 * @param {string} props.filterTag - Style tag filter value
 * @param {Function} props.setFilterTag - Update style tag filter
 * @param {Array<string>} props.allStyleTags - Available style tags for dropdown
 */
export const PlayerFilters = ({
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
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
  filterTag,
  setFilterTag,
  allStyleTags
}) => {
  return (
    <>
      {/* Search and Sort */}
      <div className="mt-4 flex gap-3 items-center">
        {/* Search */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name or nickname..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
        >
          <option value="lastSeen">Last Seen</option>
          <option value="name">Name</option>
          <option value="handCount">Hand Count</option>
        </select>
      </div>

      {/* Physical Feature Filters */}
      <div className="mt-3 grid grid-cols-7 gap-2">
        {/* Gender */}
        <select
          value={filterGender}
          onChange={(e) => setFilterGender(e.target.value)}
          className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">All Genders</option>
          {GENDER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Build */}
        <select
          value={filterBuild}
          onChange={(e) => setFilterBuild(e.target.value)}
          className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">All Builds</option>
          {BUILD_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Ethnicity */}
        <select
          value={filterEthnicity}
          onChange={(e) => setFilterEthnicity(e.target.value)}
          className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">All Ethnicities</option>
          {ETHNICITY_OPTIONS.map(eth => (
            <option key={eth} value={eth}>{eth}</option>
          ))}
        </select>

        {/* Facial Hair */}
        <select
          value={filterFacialHair}
          onChange={(e) => setFilterFacialHair(e.target.value)}
          className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">All Facial Hair</option>
          {FACIAL_HAIR_OPTIONS.map(fh => (
            <option key={fh} value={fh}>{fh}</option>
          ))}
        </select>

        {/* Hat */}
        <select
          value={filterHat}
          onChange={(e) => setFilterHat(e.target.value)}
          className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">Hat?</option>
          <option value="yes">Wears Hat</option>
          <option value="no">No Hat</option>
        </select>

        {/* Sunglasses */}
        <select
          value={filterSunglasses}
          onChange={(e) => setFilterSunglasses(e.target.value)}
          className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">Sunglasses?</option>
          <option value="yes">Wears Sunglasses</option>
          <option value="no">No Sunglasses</option>
        </select>

        {/* Style Tag */}
        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">All Styles</option>
          {allStyleTags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </div>
    </>
  );
};

export default PlayerFilters;
