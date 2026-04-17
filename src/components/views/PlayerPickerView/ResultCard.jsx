/**
 * ResultCard.jsx — Recognition-optimized player row (PEO-3, plan §D7)
 *
 * Layout (left-to-right):
 *   [ Avatar | Name (prefix bolded) · feature chips (matched bright, unmatched faded) | meta ]
 *
 * Principles:
 *   - Avatar at the left edge: the eye lands on the face first.
 *   - Name: bold the matched prefix; rest normal weight.
 *   - Features: each visible feature is a small chip. Chips whose category is
 *     in `matchedFeatures` render at full opacity; others fade to 0.5. No bold
 *     for matches — the fade on non-matches creates the figure/ground contrast
 *     (plan decision D7).
 *   - Left-border accent (gold) when every active filter matches.
 *   - Meta line: "seen X ago · N hands" as a quick recency check.
 */

import React from 'react';
import PlayerAvatar from '../../ui/PlayerAvatar';
import { getFeatureById } from '../../../assets/avatarFeatures';
import { SKIN_TONES } from '../../../constants/avatarFeatureConstants';

const relativeDays = (lastSeenAt) => {
  if (!lastSeenAt) return 'never seen';
  const ms = Date.now() - lastSeenAt;
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) {
    const m = Math.floor(ms / 60_000);
    return `${m} min ago`;
  }
  if (ms < 86_400_000) {
    const h = Math.floor(ms / 3_600_000);
    return `${h}h ago`;
  }
  const d = Math.floor(ms / 86_400_000);
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
};

const NameWithHighlight = ({ name, start, end }) => {
  if (!name) return <span className="text-gray-500">Unnamed</span>;
  if (start === null || end === null || end <= start) {
    return <span className="text-gray-900">{name}</span>;
  }
  return (
    <span className="text-gray-900">
      <span className="font-bold">{name.slice(start, end)}</span>
      {name.slice(end)}
    </span>
  );
};

const FeatureChip = ({ label, matched, hasActiveFilters }) => {
  const dim = hasActiveFilters && !matched;
  return (
    <span
      className={
        'text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ' +
        (matched
          ? 'bg-amber-50 border-amber-300 text-amber-900'
          : 'bg-gray-50 border-gray-200 text-gray-600')
      }
      style={{ opacity: dim ? 0.5 : 1 }}
    >
      {label}
    </span>
  );
};

const skinLabelFor = (id) => SKIN_TONES.find(t => t.id === id)?.label || null;

const visibleFeatureLabels = (avatarFeatures) => {
  if (!avatarFeatures) return [];
  const out = [];
  if (avatarFeatures.skin) {
    const l = skinLabelFor(avatarFeatures.skin);
    if (l) out.push({ category: 'skin', label: l });
  }
  for (const cat of ['hair', 'beard', 'glasses', 'hat']) {
    const id = avatarFeatures[cat];
    if (!id || id.endsWith('.none')) continue;
    const f = getFeatureById(id);
    if (f?.label) out.push({ category: cat, label: f.label });
  }
  return out;
};

export const ResultCard = ({ player, score, onSelect, hasActiveFilters }) => {
  const features = visibleFeatureLabels(player.avatarFeatures);
  const matched = score?.matchedFeatures ?? new Set();
  const showAccent = !!score?.allFiltersMatch && hasActiveFilters;

  return (
    <button
      type="button"
      onClick={() => onSelect(player)}
      className={
        'w-full text-left flex items-center gap-3 px-3 py-2 bg-white rounded border transition ' +
        (showAccent
          ? 'border-gray-200 border-l-4 border-l-amber-500 hover:bg-amber-50/40'
          : 'border-gray-200 hover:bg-gray-50')
      }
      data-testid={`result-card-${player.playerId}`}
    >
      <div className="shrink-0 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
        <PlayerAvatar player={player} size={48} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="truncate text-sm">
            <NameWithHighlight
              name={player.name}
              start={score?.nameMatchStart ?? null}
              end={score?.nameMatchEnd ?? null}
            />
          </div>
          {player.nickname ? (
            <span className="text-xs text-gray-400 truncate">“{player.nickname}”</span>
          ) : null}
        </div>
        {features.length > 0 ? (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {features.map(({ category, label }) => (
              <FeatureChip
                key={category + label}
                label={label}
                matched={matched.has(category)}
                hasActiveFilters={hasActiveFilters}
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="shrink-0 text-right text-[11px] text-gray-500 leading-tight">
        <div>{relativeDays(player.lastSeenAt)}</div>
        <div>{player.handCount || 0} hands</div>
      </div>
    </button>
  );
};

export default ResultCard;
