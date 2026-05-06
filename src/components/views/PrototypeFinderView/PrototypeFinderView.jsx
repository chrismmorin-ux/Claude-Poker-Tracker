/**
 * @file PrototypeFinderView.jsx — interactive prototype of the unified PlayerFinder.
 *
 * Reachable in production via URL hash `#prototype-finder` (registered in
 * src/PokerTracker.jsx → HASH_TO_SCREEN). Uses MOCK player data only — no IDB
 * reads or writes. Designed to let the owner test the proposed information
 * architecture, visual system, and interaction model on their phone before
 * committing to the real implementation.
 *
 * Layout follows §1 of the design document: 3 always-on chip rows + 3
 * collapsibles (More features / Accessory boost / Fine details) +
 * sticky-bottom mode-derived footer.
 *
 * State model: single state with derived sub-modes. Tapping a result loads
 * its values into the active fields and the footer becomes "Assign to seat".
 * Editing any field flips to "Update Player & Assign".
 */

import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronDown, ChevronUp, X } from 'lucide-react';
import IdentityAvatar from '../../ui/IdentityAvatar';
import { useUI } from '../../../contexts/UIContext';
import { SCREEN } from '../../../constants/uiConstants';
import {
  SKIN_TONES,
  HAIR_COLORS,
  EYEWEAR_COLORS,
  CLOTHING_COLORS,
} from '../../../constants/avatarFeatureConstants';
import {
  HAIR_COLOR_INPUT_OPTIONS,
  HAIR_LENGTH_OPTIONS,
  HAIR_TEXTURE_OPTIONS,
} from '../PlayerEditorView/HairSection';
import { FACIAL_HAIR_OPTIONS } from '../PlayerEditorView/FacialHairSection';
import { BUILD_OPTIONS } from '../PlayerEditorView/BuildSection';
import { EYEWEAR_OPTIONS } from '../PlayerEditorView/EyewearSection';
import { HEADWEAR_OPTIONS } from '../PlayerEditorView/HeadwearSection';
import { skinKeyForFilter } from '../../../utils/identityAvatar/avatarMapping';
import {
  matchesInRange,
  RANGE_NEIGHBORS_BY_AXIS,
} from '../../../utils/playerFilterRange';
import { findMatchingAccessories } from '../../../utils/accessoryInventory';
import { MOCK_PLAYERS } from './mockPlayers';

// --- constants ----

const SEX_OPTIONS = [
  { value: 'male', label: 'M' },
  { value: 'female', label: 'F' },
  { value: 'other', label: 'Other' },
];
const AGE_OPTIONS = ['<20', '20s', '30s', '40s', '50s', '60s+'];
const ETHNICITY_OPTIONS = [
  { value: 'caucasian', label: 'White/Caucasian' },
  { value: 'hispanic', label: 'Hispanic' },
  { value: 'east-asian', label: 'East Asian' },
  { value: 'south-asian', label: 'South Asian' },
  { value: 'black', label: 'Black' },
  { value: 'middle-eastern', label: 'Middle Eastern' },
];
const ACCESSORY_KIND_OPTIONS = [
  { value: 'hat', label: 'Hat' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'jewelry', label: 'Jewelry' },
];

const HAIR_HEX = Object.fromEntries(HAIR_COLORS.map((c) => [c.id.replace(/^color\./, ''), c.hex]));
const FRAME_HEX = Object.fromEntries(EYEWEAR_COLORS.map((c) => [c.id.replace(/^frame\./, ''), c.hex]));
const FRAME_OPTIONS = [
  { value: 'black', label: 'Black' },
  { value: 'brown', label: 'Brown' },
  { value: 'tortoiseshell', label: 'Tortoise' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'red', label: 'Red' },
  { value: 'blue', label: 'Blue' },
];

const EMPTY_FILTERS = {
  sex: null,
  ageDecade: null,
  ethnicity: [],
  skinTone: null,
  hairColor: null,
  hairLength: null,
  hairTexture: null,
  facialHair: null,
  beardColor: null,
  build: null,
  eyewear: null,
  eyewearColor: null,
  headwear: null,
  accessoryKind: null,
  accessoryColor: null,
};

const SCALAR_KEYS = [
  'sex', 'ageDecade', 'skinTone', 'hairColor', 'hairLength', 'hairTexture',
  'facialHair', 'beardColor', 'build', 'eyewear', 'eyewearColor', 'headwear',
];

// --- chips & swatches ----

const PlainChip = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2.5 py-1 rounded-full text-xs transition-colors border ${
      active
        ? 'bg-amber-500 text-gray-900 border-amber-600 font-semibold shadow-sm'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
    }`}
    aria-pressed={active}
  >
    {label}
  </button>
);

const SwatchChip = ({ active, label, hex, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs transition-colors border ${
      active
        ? 'bg-amber-500 text-gray-900 border-amber-600 font-semibold shadow-sm'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
    }`}
    aria-pressed={active}
  >
    <span
      className="rounded-full inline-block shrink-0"
      style={{
        background: hex,
        width: 18,
        height: 18,
        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.85), 0 0 0 1px rgba(0,0,0,0.25)',
      }}
    />
    <span className="whitespace-nowrap">{label}</span>
  </button>
);

const FieldRow = ({ label, children }) => (
  <div className="flex items-start gap-2 mb-1.5">
    <div className="text-[10px] uppercase tracking-wide text-gray-400 w-20 shrink-0 pt-1.5 font-semibold">
      {label}
    </div>
    <div className="flex flex-wrap gap-1 items-center">{children}</div>
  </div>
);

const SubRow = ({ label, children }) => (
  <div className="mb-2">
    <div className="text-gray-400 text-[10px] uppercase tracking-wide mb-1 font-semibold">{label}</div>
    <div className="flex flex-wrap gap-1 items-center">{children}</div>
  </div>
);

// --- collapsible section ----

const Section = ({ title, badge, defaultOpen = false, accent = 'slate', children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const accentBorder = {
    slate: 'border-slate-700',
    amber: 'border-amber-700/60',
  }[accent];
  const accentBg = {
    slate: 'bg-slate-800/60',
    amber: 'bg-amber-900/20',
  }[accent];
  return (
    <div className={`rounded-lg border ${accentBorder} ${accentBg} mb-2 overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-700/30 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-gray-200 font-semibold">{title}</span>
          {badge ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40">
              {badge}
            </span>
          ) : null}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open ? (
        <div
          className="px-3 pb-3 pt-1"
          style={{ animation: 'fadeIn 150ms ease-out' }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
};

// --- result row ----

const ResultRow = ({ player, onTap, hasActiveFilters, matchedAccessories, isLoaded }) => {
  const head = player.name || <span className="italic text-gray-500">(unnamed)</span>;
  const subtitle = [
    player.sex,
    player.ageDecade,
    (player.ethnicityTags || []).slice(0, 2).join(' · '),
  ].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={() => onTap(player)}
      className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
        isLoaded
          ? 'bg-amber-500/15 border-amber-500'
          : hasActiveFilters
            ? 'bg-slate-800 border-l-4 border-l-amber-500 border-slate-700'
            : 'bg-slate-800 border-slate-700 hover:bg-slate-700/60'
      }`}
    >
      <div className="shrink-0 rounded-full overflow-hidden bg-slate-900 border border-slate-600">
        <IdentityAvatar player={player} size={48} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-100 truncate">
          {head}
          {player.nickname ? <span className="ml-1.5 text-gray-400 text-xs">"{player.nickname}"</span> : null}
        </div>
        <div className="text-[11px] text-gray-400 capitalize truncate">{subtitle}</div>
        {matchedAccessories.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {matchedAccessories.map((acc) => {
              const headline = [acc.color, acc.subtype].filter(Boolean).join(' ') || acc.kind;
              return (
                <span
                  key={acc.accessoryId}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900"
                >
                  {headline}
                  {acc.note ? <span className="ml-1 italic">({acc.note})</span> : null}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="shrink-0 text-right text-[10px] text-gray-500 leading-tight">
        <div>{player.handCount || 0} hands</div>
      </div>
    </button>
  );
};

// --- main view ----

export const PrototypeFinderView = () => {
  const { setCurrentScreen } = useUI();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [nameQuery, setNameQuery] = useState('');
  const [activeRecord, setActiveRecord] = useState(null);
  const [editsDirty, setEditsDirty] = useState(false);

  // Decision toggle: result-tap CLEARS filters or PRESERVES filters?
  // Default clears (per design doc §5). Owner can flip to compare in-prototype.
  const [resultTapClearsFilters, setResultTapClearsFilters] = useState(true);

  // Set seat label for the prototype (mock — owner-pickable).
  const [seat] = useState(3);

  // ---- Filtering ----
  const accessoryFilterActive = !!filters.accessoryKind || !!filters.accessoryColor;

  const matchesFilters = (player) => {
    // Effective view (skin derives from ethnicity if not explicit; beard
    // falls back to hair color).
    const effective = {
      sex: player.sex,
      ageDecade: player.ageDecade,
      skinTone: skinKeyForFilter(player),
      hairColor: player.hairColor,
      hairLength: player.hairLength,
      hairTexture: player.hairTexture,
      facialHair: player.facialHair,
      beardColor: player.beardColor || player.hairColor || null,
      build: player.build,
      eyewear: player.eyewear,
      eyewearColor: player.eyewearColor,
      headwear: player.headwear,
    };

    for (const key of SCALAR_KEYS) {
      const filterValue = filters[key];
      if (!filterValue) continue;
      const playerValue = (effective[key] || '').toString().toLowerCase();
      if (!playerValue) continue;
      if (RANGE_NEIGHBORS_BY_AXIS[key]) {
        if (!matchesInRange(key, filterValue, playerValue)) return false;
      } else if (playerValue !== filterValue.toString().toLowerCase()) {
        return false;
      }
    }

    if (filters.ethnicity.length > 0) {
      const tags = Array.isArray(player.ethnicityTags) ? player.ethnicityTags : [];
      if (tags.length > 0) {
        const ok = filters.ethnicity.some((sel) => tags.map((t) => t.toLowerCase()).includes(sel));
        if (!ok) return false;
      }
    }

    if (nameQuery.trim().length > 0) {
      const q = nameQuery.toLowerCase().trim();
      const haystack = `${player.name || ''} ${player.nickname || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  };

  const sortedResults = useMemo(() => {
    const accFilter = accessoryFilterActive
      ? { kind: filters.accessoryKind, color: filters.accessoryColor }
      : null;
    const out = [];
    for (const p of MOCK_PLAYERS) {
      if (!matchesFilters(p)) continue;
      const matched = accFilter ? findMatchingAccessories(p.accessoryInventory, accFilter) : [];
      out.push({ player: p, matchedAccessories: matched });
    }
    out.sort((a, b) => {
      if (accessoryFilterActive) {
        const ah = a.matchedAccessories.length > 0 ? 1 : 0;
        const bh = b.matchedAccessories.length > 0 ? 1 : 0;
        if (ah !== bh) return bh - ah;
      }
      return (b.player.lastSeenAt || 0) - (a.player.lastSeenAt || 0);
    });
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, nameQuery, accessoryFilterActive]);

  const hasActiveFilters =
    !!nameQuery
    || filters.ethnicity.length > 0
    || SCALAR_KEYS.some((k) => !!filters[k])
    || !!filters.accessoryKind
    || !!filters.accessoryColor;

  const totalActiveCount =
    SCALAR_KEYS.filter((k) => !!filters[k]).length
    + filters.ethnicity.length
    + (filters.accessoryKind ? 1 : 0)
    + (filters.accessoryColor ? 1 : 0)
    + (nameQuery.trim() ? 1 : 0);

  // ---- Handlers ----

  const setScalar = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
  };
  const toggleEthnicity = (tag) => {
    setFilters((prev) => ({
      ...prev,
      ethnicity: prev.ethnicity.includes(tag)
        ? prev.ethnicity.filter((t) => t !== tag)
        : [...prev.ethnicity, tag],
    }));
  };
  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setNameQuery('');
  };

  const onTapResult = (player) => {
    setActiveRecord(player);
    setEditsDirty(false);
    if (resultTapClearsFilters) {
      // §5 design: clear filters so user sees the full record.
      setFilters(EMPTY_FILTERS);
      setNameQuery(player.name || '');
    }
  };
  const clearActiveRecord = () => {
    setActiveRecord(null);
    setEditsDirty(false);
  };

  // ---- Mode + footer label ----

  const mode = activeRecord
    ? (editsDirty ? 'editing-existing' : 'viewing-existing')
    : (hasActiveFilters ? 'composing-new' : 'idle');

  const footerLabel = {
    'editing-existing': `Update & Assign to Seat ${seat}`,
    'viewing-existing': `Assign to Seat ${seat}`,
    'composing-new': `Save & Assign as new player`,
    idle: '',
  }[mode];

  // ---- Render ----

  return (
    <div
      className="h-dvh w-full flex flex-col bg-slate-900 text-gray-100 overflow-hidden"
      data-testid="prototype-finder-view"
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* TOP BAR */}
      <div className="sticky top-0 z-20 flex items-center justify-between bg-slate-950 px-3 py-2 border-b border-slate-700">
        <button
          type="button"
          onClick={() => setCurrentScreen(SCREEN.TABLE)}
          className="flex items-center gap-1 text-sm font-medium hover:bg-slate-800 px-2 py-1 rounded text-gray-200"
        >
          <ChevronLeft size={18} />
          Back
        </button>
        <div className="text-sm font-semibold text-gray-100 truncate mx-2">
          {activeRecord ? `Assigning ${activeRecord.name || 'player'} → Seat ${seat}` : `Pick for Seat ${seat}`}
        </div>
        <div className="text-[10px] text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 shrink-0">
          PROTOTYPE
        </div>
      </div>

      {/* SCROLL REGION */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* STICKY: Name + 3 always-on chip rows */}
        <div className="sticky top-0 z-10 -mx-3 px-3 pb-3 bg-slate-900 mb-2">
          <input
            type="text"
            value={nameQuery}
            onChange={(e) => {
              setNameQuery(e.target.value);
              if (activeRecord) setEditsDirty(true);
            }}
            placeholder="Name or nickname"
            className="w-full bg-slate-800 text-gray-100 text-sm placeholder:text-gray-500 rounded-lg border border-slate-700 px-3 py-2.5 mb-2 focus:border-amber-500 focus:outline-none"
          />

          <FieldRow label="Sex">
            {SEX_OPTIONS.map((o) => (
              <PlainChip
                key={o.value}
                label={o.label}
                active={filters.sex === o.value}
                onClick={() => setScalar('sex', o.value)}
              />
            ))}
          </FieldRow>

          <FieldRow label="Age">
            {AGE_OPTIONS.map((o) => (
              <PlainChip key={o} label={o} active={filters.ageDecade === o} onClick={() => setScalar('ageDecade', o)} />
            ))}
          </FieldRow>

          <FieldRow label="Ethnicity">
            {ETHNICITY_OPTIONS.map((o) => (
              <PlainChip
                key={o.value}
                label={o.label}
                active={filters.ethnicity.includes(o.value)}
                onClick={() => toggleEthnicity(o.value)}
              />
            ))}
          </FieldRow>

          <div className="flex items-center justify-between mt-1">
            <div className="text-[10px] text-gray-500">
              {totalActiveCount > 0 ? `${totalActiveCount} filter${totalActiveCount === 1 ? '' : 's'} active` : 'No filters'}
            </div>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] text-gray-300 hover:text-amber-300 underline"
              >
                Clear all
              </button>
            ) : null}
          </div>
        </div>

        {/* RESULTS */}
        <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5 font-semibold flex items-center justify-between">
          <span>Results · {sortedResults.length}</span>
          {activeRecord ? (
            <button
              type="button"
              onClick={clearActiveRecord}
              className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200"
            >
              <X size={12} />
              Clear loaded
            </button>
          ) : null}
        </div>
        <div className="space-y-1.5 mb-3">
          {sortedResults.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-500 bg-slate-800/50 rounded-lg border border-dashed border-slate-700">
              No matches. Adjust a filter, or save as new player below.
            </div>
          ) : (
            sortedResults.map(({ player, matchedAccessories }) => (
              <ResultRow
                key={player.playerId}
                player={player}
                hasActiveFilters={hasActiveFilters}
                matchedAccessories={matchedAccessories}
                isLoaded={activeRecord?.playerId === player.playerId}
                onTap={onTapResult}
              />
            ))
          )}
        </div>

        {/* COLLAPSIBLE: More features */}
        <Section
          title="More features"
          badge={
            ['skinTone', 'hairColor', 'hairLength', 'hairTexture', 'facialHair', 'beardColor', 'build', 'eyewear', 'eyewearColor', 'headwear']
              .filter((k) => filters[k]).length || null
          }
        >
          <SubRow label="Skin tone">
            {SKIN_TONES.map((t) => {
              const key = t.id.replace(/^skin\./, '');
              return <SwatchChip key={t.id} label={t.label} hex={t.hex} active={filters.skinTone === key} onClick={() => setScalar('skinTone', key)} />;
            })}
          </SubRow>

          <SubRow label="Hair color">
            {HAIR_COLOR_INPUT_OPTIONS.map((opt) => (
              <SwatchChip key={opt.value} label={opt.label} hex={HAIR_HEX[opt.value]} active={filters.hairColor === opt.value} onClick={() => setScalar('hairColor', opt.value)} />
            ))}
          </SubRow>

          <SubRow label="Hair length">
            {HAIR_LENGTH_OPTIONS.map((opt) => (
              <PlainChip key={opt.value} label={opt.label} active={filters.hairLength === opt.value} onClick={() => setScalar('hairLength', opt.value)} />
            ))}
          </SubRow>

          <SubRow label="Hair texture">
            {HAIR_TEXTURE_OPTIONS.map((opt) => (
              <PlainChip key={opt.value} label={opt.label} active={filters.hairTexture === opt.value} onClick={() => setScalar('hairTexture', opt.value)} />
            ))}
          </SubRow>

          <SubRow label="Facial hair">
            {FACIAL_HAIR_OPTIONS.map((opt) => (
              <PlainChip key={opt.value} label={opt.label} active={filters.facialHair === opt.value} onClick={() => setScalar('facialHair', opt.value)} />
            ))}
          </SubRow>

          <SubRow label="Beard color">
            {HAIR_COLOR_INPUT_OPTIONS.map((opt) => (
              <SwatchChip key={opt.value} label={opt.label} hex={HAIR_HEX[opt.value]} active={filters.beardColor === opt.value} onClick={() => setScalar('beardColor', opt.value)} />
            ))}
          </SubRow>

          <SubRow label="Build">
            {BUILD_OPTIONS.map((opt) => (
              <PlainChip key={opt} label={opt} active={filters.build === opt} onClick={() => setScalar('build', opt)} />
            ))}
          </SubRow>

          <SubRow label="Eyewear">
            {EYEWEAR_OPTIONS.map((opt) => (
              <PlainChip key={opt.value} label={opt.label} active={filters.eyewear === opt.value} onClick={() => setScalar('eyewear', opt.value)} />
            ))}
          </SubRow>

          <SubRow label="Frame color">
            {FRAME_OPTIONS.map((opt) => (
              <SwatchChip key={opt.value} label={opt.label} hex={FRAME_HEX[opt.value]} active={filters.eyewearColor === opt.value} onClick={() => setScalar('eyewearColor', opt.value)} />
            ))}
          </SubRow>

          <SubRow label="Headwear">
            {HEADWEAR_OPTIONS.map((opt) => (
              <PlainChip key={opt.value} label={opt.label} active={filters.headwear === opt.value} onClick={() => setScalar('headwear', opt.value)} />
            ))}
          </SubRow>
        </Section>

        {/* COLLAPSIBLE: Accessory boost */}
        <Section
          title="Accessory match"
          badge={(filters.accessoryKind || filters.accessoryColor) ? 'boost' : null}
          accent="amber"
        >
          <div className="text-[10px] text-amber-200/80 mb-2">
            Boosts matching players to top — does not exclude others.
          </div>
          <SubRow label="Kind">
            {ACCESSORY_KIND_OPTIONS.map((o) => (
              <PlainChip key={o.value} label={o.label} active={filters.accessoryKind === o.value} onClick={() => setScalar('accessoryKind', o.value)} />
            ))}
          </SubRow>
          <SubRow label="Color">
            {CLOTHING_COLORS.map((c) => {
              const key = c.id.replace(/^cloth\./, '');
              return <SwatchChip key={c.id} label={c.label} hex={c.hex} active={filters.accessoryColor === key} onClick={() => setScalar('accessoryColor', key)} />;
            })}
          </SubRow>
        </Section>

        {/* DECISION TOGGLE — visible in prototype only */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 mb-2">
          <div className="text-[10px] uppercase tracking-wide text-amber-300 mb-1 font-semibold">
            Prototype-only · §5 design decision
          </div>
          <div className="text-xs text-gray-300 mb-2">
            When you tap a result, should the filters CLEAR (you see the full record) or PRESERVE
            (you keep filtering to compare)?
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setResultTapClearsFilters(true)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border ${
                resultTapClearsFilters ? 'bg-amber-500 text-gray-900 border-amber-600' : 'bg-slate-800 text-gray-300 border-slate-700'
              }`}
            >
              Clear on tap (default)
            </button>
            <button
              type="button"
              onClick={() => setResultTapClearsFilters(false)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border ${
                !resultTapClearsFilters ? 'bg-amber-500 text-gray-900 border-amber-600' : 'bg-slate-800 text-gray-300 border-slate-700'
              }`}
            >
              Preserve filters
            </button>
          </div>
        </div>

        {/* Spacer for footer */}
        <div className="h-16" />
      </div>

      {/* FOOTER */}
      {mode !== 'idle' ? (
        <div className="absolute bottom-0 left-0 right-0 px-3 py-3 bg-slate-950/95 border-t border-slate-700 backdrop-blur z-30">
          <button
            type="button"
            onClick={() => alert(`[prototype] Would: ${footerLabel}`)}
            className="w-full bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold rounded-lg py-3 text-sm shadow-lg active:scale-[0.99] transition-transform"
          >
            {footerLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default PrototypeFinderView;
