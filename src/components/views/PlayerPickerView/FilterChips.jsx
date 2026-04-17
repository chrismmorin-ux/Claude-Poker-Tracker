/**
 * FilterChips.jsx — Inline-expandable characteristic filter chips (PEO-3)
 *
 * Plan §D7 calls for inline panels (NO nested popovers) so mobile landscape
 * users don't wrestle with stacked overlays. When a chip is tapped its swatch
 * panel expands below; tapping elsewhere or re-tapping collapses it.
 *
 * Categories surfaced:
 *   Skin, Hair (style), Beard (style), Glasses, Hat
 * Color subfilters (hair color, beard color, eye color) are omitted from the
 * quick-filter chip row — users pick those in the editor. At the picker, a
 * player's visual identity is dominated by shape + tone, not precise shade.
 */

import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { SKIN_TONES } from '../../../constants/avatarFeatureConstants';
import { AVATAR_FEATURES } from '../../../assets/avatarFeatures';
import AvatarRenderer from '../../ui/AvatarRenderer';

// Quick-filter categories: mix of colors (skin) + styles.
const CHIP_CATEGORIES = [
  { key: 'skin',    label: 'Skin',    type: 'color' },
  { key: 'hair',    label: 'Hair',    type: 'shape' },
  { key: 'beard',   label: 'Beard',   type: 'shape' },
  { key: 'glasses', label: 'Glasses', type: 'shape' },
  { key: 'hat',     label: 'Hat',     type: 'shape' },
];

const shortLabelFor = (category, id) => {
  if (!id) return null;
  if (category === 'skin') {
    return SKIN_TONES.find(t => t.id === id)?.label || null;
  }
  const list = AVATAR_FEATURES[category] || [];
  return list.find(f => f.id === id)?.label || null;
};

const ColorPanel = ({ onPick, selectedId }) => (
  <div className="flex flex-wrap gap-2 p-2 bg-white border border-gray-200 rounded-b shadow-sm">
    {SKIN_TONES.map((tone) => (
      <button
        key={tone.id}
        type="button"
        onClick={() => onPick(tone.id)}
        aria-label={tone.label}
        aria-pressed={selectedId === tone.id}
        className={
          'relative w-8 h-8 rounded-full border transition-shadow ' +
          (selectedId === tone.id ? 'ring-2 ring-amber-500' : 'border-gray-300 hover:ring-1 hover:ring-gray-400')
        }
        style={{ backgroundColor: tone.hex }}
        data-testid={`chip-panel-skin-${tone.id}`}
      >
        {selectedId === tone.id ? (
          <Check size={12} className="absolute inset-0 m-auto text-white drop-shadow" />
        ) : null}
      </button>
    ))}
  </div>
);

const ShapePanel = ({ category, onPick, selectedId }) => {
  const features = AVATAR_FEATURES[category] || [];
  return (
    <div className="flex flex-wrap gap-2 p-2 bg-white border border-gray-200 rounded-b shadow-sm">
      {features.map((feature) => (
        <button
          key={feature.id}
          type="button"
          onClick={() => onPick(feature.id)}
          aria-label={feature.label}
          aria-pressed={selectedId === feature.id}
          title={feature.label}
          className={
            'shrink-0 rounded-full p-0.5 transition-shadow ' +
            (selectedId === feature.id
              ? 'ring-2 ring-amber-500'
              : 'ring-1 ring-transparent hover:ring-gray-300')
          }
          data-testid={`chip-panel-${category}-${feature.id}`}
        >
          <span className="block bg-gray-100 rounded-full overflow-hidden">
            <AvatarRenderer
              avatarFeatures={{ [category]: feature.id }}
              size={36}
              title={feature.label}
            />
          </span>
        </button>
      ))}
    </div>
  );
};

export const FilterChips = ({ featureFilters, onFilterChange, onClearAll }) => {
  const [openKey, setOpenKey] = useState(null);

  const togglePanel = (key) => setOpenKey((prev) => (prev === key ? null : key));

  const handlePick = (category, id) => {
    // Tapping the currently-selected value clears it (toggle).
    const current = featureFilters[category];
    onFilterChange(category, current === id ? '' : id);
  };

  const hasAny = Object.values(featureFilters).some(v => !!v);

  return (
    <div className="space-y-1" data-testid="filter-chips">
      <div className="flex flex-wrap gap-1.5 items-center">
        {CHIP_CATEGORIES.map(({ key, label }) => {
          const selected = featureFilters[key];
          const selectedLabel = shortLabelFor(key, selected);
          const active = !!selected;
          const open = openKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => togglePanel(key)}
              aria-expanded={open}
              aria-pressed={active}
              className={
                'flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition ' +
                (active
                  ? 'bg-amber-50 border-amber-400 text-amber-900'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50')
              }
              data-testid={`filter-chip-${key}`}
            >
              <span>{label}{selectedLabel ? `: ${selectedLabel}` : ''}</span>
              <ChevronDown size={12} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
          );
        })}
        {hasAny ? (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-gray-500 hover:text-gray-800 underline ml-1"
            data-testid="clear-filters-btn"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {openKey ? (
        <div>
          {openKey === 'skin' ? (
            <ColorPanel
              onPick={(id) => handlePick('skin', id)}
              selectedId={featureFilters.skin}
            />
          ) : (
            <ShapePanel
              category={openKey}
              onPick={(id) => handlePick(openKey, id)}
              selectedId={featureFilters[openKey]}
            />
          )}
        </div>
      ) : null}
    </div>
  );
};

export default FilterChips;
