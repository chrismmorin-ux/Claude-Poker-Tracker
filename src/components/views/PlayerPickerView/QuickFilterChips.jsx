/**
 * @file QuickFilterChips — discriminator-ranked must-have filters (Phase 4).
 *
 * Per audit §8.3: the picker becomes a progressive filter on the highest-
 * discrimination identification fields:
 *   1. Sex (~0.79 bits)
 *   2. Ethnicity (~1.90 bits)
 *   3. Age decade (~1.61 bits)
 * Combined: ~4.3 bits, enough to partition a 30-person table to ~1-2
 * candidates.
 *
 * Replaces the OLD FilterChips (which filtered on avatarFeatures-style
 * skin/hair/beard/glasses/hat shape IDs — the wrong axis for recognition).
 *
 * Three independent chip rows. Each is a single-select toggle (tap selected
 * to clear). Ethnicity is multi-tag because a player may match multiple
 * ethnicity tags. Selected values feed into both the result list filter
 * and the "+ Create new" CTA (which pre-seeds these into the editor).
 */

import React from 'react';

export const SEX_OPTIONS = [
  { value: 'male', label: 'M' },
  { value: 'female', label: 'F' },
  { value: 'other', label: 'Other' },
];

export const AGE_OPTIONS = ['<20', '20s', '30s', '40s', '50s', '60s+'];

// Mirrors EthnicityTagsSection / avatarMapping ETHNICITY_TO_SKIN keys.
export const ETHNICITY_OPTIONS = [
  { value: 'caucasian',       label: 'White/Caucasian' },
  { value: 'hispanic',        label: 'Hispanic' },
  { value: 'east-asian',      label: 'East Asian' },
  { value: 'south-asian',     label: 'South Asian' },
  { value: 'black',           label: 'Black' },
  { value: 'middle-eastern',  label: 'Middle Eastern' },
];

const Row = ({ label, children }) => (
  <div className="flex items-center gap-2 mb-1.5">
    <div className="text-[10px] uppercase tracking-wide text-gray-500 w-16 shrink-0">
      {label}
    </div>
    <div className="flex flex-wrap gap-1.5 items-center">{children}</div>
  </div>
);

const Chip = ({ label, active, onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
      active
        ? 'bg-amber-500 text-gray-900 border border-amber-600 font-semibold'
        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
    }`}
    data-testid={testId}
    aria-pressed={active}
  >
    {label}
  </button>
);

export const QuickFilterChips = ({
  sex,
  ethnicity,           // array
  ageDecade,
  onSexChange,
  onEthnicityToggle,   // (value) → toggles in/out of array
  onAgeChange,
  onClearAll,
}) => {
  const ethArr = Array.isArray(ethnicity) ? ethnicity : [];
  const hasAny = !!sex || ethArr.length > 0 || !!ageDecade;

  return (
    <div data-testid="quick-filter-chips">
      <Row label="Sex">
        {SEX_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            active={sex === o.value}
            onClick={() => onSexChange(sex === o.value ? null : o.value)}
            testId={`quick-filter-sex-${o.value}`}
          />
        ))}
      </Row>

      <Row label="Ethnicity">
        {ETHNICITY_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            active={ethArr.includes(o.value)}
            onClick={() => onEthnicityToggle(o.value)}
            testId={`quick-filter-ethnicity-${o.value}`}
          />
        ))}
      </Row>

      <Row label="Age">
        {AGE_OPTIONS.map((o) => (
          <Chip
            key={o}
            label={o}
            active={ageDecade === o}
            onClick={() => onAgeChange(ageDecade === o ? null : o)}
            testId={`quick-filter-age-${o}`}
          />
        ))}
        {hasAny ? (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-gray-500 hover:text-gray-800 underline ml-2"
            data-testid="quick-filter-clear-all"
          >
            Clear all
          </button>
        ) : null}
      </Row>
    </div>
  );
};

export default QuickFilterChips;
