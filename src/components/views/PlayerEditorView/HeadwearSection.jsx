/**
 * @file HeadwearSection — per-sighting headwear tag.
 * Phase 3 (PIO G4 v2) per audit §A8.
 *
 * Headwear is volatile across sessions (rank 10, stability 0.40 per audit
 * §6) — same player wears different hat next session. So headwear lives
 * on the SIGHTING record, not the player record. This section lets the
 * user tag what the player is wearing TODAY (during this session).
 *
 * Stored on player.headwear for now (Phase 6 moves to sighting schema).
 * Renders as IdentityAvatar overlay via headwearOverride prop.
 */

import React from 'react';

export const HEADWEAR_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'cap', label: 'Cap' },
  { value: 'beanie', label: 'Beanie' },
  { value: 'visor', label: 'Visor' },
  { value: 'fedora', label: 'Fedora' },
  { value: 'cowboy', label: 'Cowboy' },
];

export const HeadwearSection = ({ value, onChange }) => {
  const selected = (value || 'none').toLowerCase();
  const toggle = (opt) => onChange(opt === selected ? null : opt);

  return (
    <section className="mb-4" data-testid="player-editor-headwear">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">
        Headwear (today)
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {HEADWEAR_OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                isSelected
                  ? 'bg-cyan-700 text-white border border-cyan-500'
                  : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
              }`}
              data-testid={`player-editor-headwear-${opt.value}`}
              aria-pressed={isSelected}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default HeadwearSection;
