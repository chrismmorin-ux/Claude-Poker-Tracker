/**
 * @file PrototypeFinderView.jsx — interactive prototype of the unified PlayerFinder.
 *
 * v4 (2026-05-06) per owner feedback on v3:
 *  - Visual density rationalized. Always-visible primary axes (small
 *    chip count) get a clean stacked layout. Chip-heavy axes (Skin,
 *    Hair, Beard, Accessory) live in a SEGMENTED TAB control — only
 *    one tab's content visible at a time. Switching tabs is instant
 *    and never shifts result-list position (tab strip stays put; tab
 *    content sits in a fixed slot below; results live below that).
 *  - Per-axis congruency. When a result is tapped, each diff row gets
 *    two pill buttons (filter value vs player value); user picks
 *    per-axis. Defaults: mismatches → player value (profile is
 *    canonical); additions → add (new info worth attaching).
 *
 * Reachable via Settings → Admin / Sandbox → "Prototype: Unified
 * PlayerFinder", or directly at #prototype-finder. Mock data only.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, X, AlertTriangle, Plus, Check, RefreshCw } from 'lucide-react';
import IdentityAvatar from '../../ui/IdentityAvatar';
import { useUI } from '../../../contexts/UIContext';
import { SCREEN } from '../../../constants/uiConstants';
import {
  SKIN_TONES,
  HAIR_COLORS,
  CLOTHING_COLORS,
} from '../../../constants/avatarFeatureConstants';
import {
  HAIR_COLOR_INPUT_OPTIONS,
  HAIR_LENGTH_OPTIONS,
  HAIR_TEXTURE_OPTIONS,
} from '../PlayerEditorView/HairSection';
import { FACIAL_HAIR_OPTIONS } from '../PlayerEditorView/FacialHairSection';
import { BUILD_OPTIONS } from '../PlayerEditorView/BuildSection';
import { skinKeyForFilter } from '../../../utils/identityAvatar/avatarMapping';
import {
  matchesInRange,
  RANGE_NEIGHBORS_BY_AXIS,
} from '../../../utils/playerFilterRange';
import { findMatchingAccessories } from '../../../utils/accessoryInventory';
import { MOCK_PLAYERS, MOCK_HEIGHTS } from './mockPlayers';

// ===========================================================================
// CONSTANTS
// ===========================================================================

const SEX_OPTIONS = [
  { value: 'male', label: 'M' },
  { value: 'female', label: 'F' },
  { value: 'other', label: 'Other' },
];
const AGE_OPTIONS = ['<20', '20s', '30s', '40s', '50s', '60s+'];
const ETHNICITY_OPTIONS = [
  { value: 'caucasian', label: 'White' },
  { value: 'hispanic', label: 'Hispanic' },
  { value: 'east-asian', label: 'East Asian' },
  { value: 'south-asian', label: 'South Asian' },
  { value: 'black', label: 'Black' },
  { value: 'middle-eastern', label: 'Middle East' },
];
const HEIGHT_OPTIONS = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'tall', label: 'Tall' },
];

const ACCESSORY_KINDS = [
  { kind: 'hat',     label: 'Hat',     subtypes: ['cap', 'beanie', 'visor', 'cowboy', 'fedora'] },
  { kind: 'glasses', label: 'Glasses', subtypes: ['clear', 'sunglasses', 'readers', 'aviators'] },
  { kind: 'top',     label: 'Top',     subtypes: ['t-shirt', 'hoodie', 'polo', 'button-down', 'sweater', 'jacket', 'vest'] },
  { kind: 'bottom',  label: 'Bottom',  subtypes: ['jeans', 'shorts', 'slacks', 'sweatpants'] },
  { kind: 'jewelry', label: 'Jewelry', subtypes: ['ring', 'chain', 'watch', 'earrings', 'bracelet'] },
  { kind: 'other',   label: 'Other',   subtypes: [] },
];

const HAIR_HEX = Object.fromEntries(HAIR_COLORS.map((c) => [c.id.replace(/^color\./, ''), c.hex]));

const SCALAR_KEYS = [
  'sex', 'ageDecade', 'skinTone', 'hairColor', 'hairLength', 'hairTexture',
  'hairTreatment', 'facialHair', 'beardColor', 'build', 'height',
];

const EMPTY_FILTERS = {
  sex: null,
  ageDecade: null,
  ethnicity: [],
  build: null,
  height: null,
  skinTone: null,
  hairColor: null,
  hairLength: null,
  hairTexture: null,
  hairTreatment: null,
  facialHair: null,
  beardColor: null,
  accessory: { kind: null, subtype: null, color: null, note: '' },
};

const RANGE_NEIGHBORS_INCLUDING_HEIGHT = {
  ...RANGE_NEIGHBORS_BY_AXIS,
  height: {
    short: ['short', 'medium'],
    medium: ['short', 'medium', 'tall'],
    tall: ['medium', 'tall'],
  },
};

const FIELD_LABEL = {
  sex: 'Sex',
  ageDecade: 'Age',
  ethnicity: 'Ethnicity',
  skinTone: 'Skin tone',
  hairColor: 'Hair color',
  hairLength: 'Hair length',
  hairTexture: 'Hair texture',
  hairTreatment: 'Hair treatment',
  facialHair: 'Facial hair',
  beardColor: 'Beard color',
  build: 'Build',
  height: 'Height',
  accessory: 'Accessory',
};

// ===========================================================================
// PRIMITIVES
// ===========================================================================

const PlainChip = ({ active, label, onClick, size = 'md' }) => {
  const sz = size === 'sm' ? 'px-2 py-0.5 text-[11px] min-h-[28px]' : 'px-3 py-1.5 text-xs min-h-[34px]';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${sz} rounded-full transition-colors border ${
        active
          ? 'bg-amber-500 text-gray-900 border-amber-500 font-semibold shadow-sm'
          : 'bg-slate-800 text-gray-200 border-slate-600 hover:bg-slate-700 hover:border-slate-500'
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
};

const SwatchChip = ({ active, label, hex, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs transition-colors border min-h-[34px] ${
      active
        ? 'bg-amber-500 text-gray-900 border-amber-500 font-semibold shadow-sm'
        : 'bg-slate-800 text-gray-200 border-slate-600 hover:bg-slate-700 hover:border-slate-500'
    }`}
    aria-pressed={active}
  >
    <span
      className="rounded-full inline-block shrink-0"
      style={{
        background: hex,
        width: 20,
        height: 20,
        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.85), 0 0 0 1px rgba(0,0,0,0.4)',
      }}
    />
    <span className="whitespace-nowrap">{label}</span>
  </button>
);

const SubLabel = ({ children }) => (
  <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1 mt-2 first:mt-0">
    {children}
  </div>
);

const ChipRow = ({ children, className = '' }) => (
  <div className={`flex flex-wrap gap-1 mb-2 ${className}`}>{children}</div>
);

// Card label — appears above each grouping card. Quieter than v3.
const PrimaryHeader = ({ children, count = 0 }) => (
  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-amber-300/80 font-bold mb-2 px-0.5">
    <span>{children}</span>
    {count > 0 ? (
      <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5 bg-amber-500/20 text-amber-200 border border-amber-500/40">
        {count}
      </span>
    ) : null}
  </div>
);

// ===========================================================================
// HELPERS
// ===========================================================================

const playerEffective = (player) => ({
  sex: player.sex,
  ageDecade: player.ageDecade,
  skinTone: skinKeyForFilter(player),
  hairColor: player.hairColor,
  hairLength: player.hairLength,
  hairTexture: player.hairTexture,
  hairTreatment: player.hairSaltPepper === true ? 'salt-pepper' : (player.hairTreatment || null),
  facialHair: player.facialHair,
  beardColor: player.beardColor || player.hairColor || null,
  build: player.build,
  height: MOCK_HEIGHTS[player.playerId] || null,
});

const matchesInRangeLocal = (axis, filterValue, playerValue) => {
  const map = RANGE_NEIGHBORS_INCLUDING_HEIGHT[axis];
  if (!map) return matchesInRange(axis, filterValue, playerValue);
  const neighbors = map[filterValue.toString().toLowerCase()];
  if (!neighbors) return playerValue.toLowerCase() === filterValue.toLowerCase();
  return neighbors.includes(playerValue.toString().toLowerCase());
};

const matchesScalar = (axis, filterValue, playerValue) => {
  if (!filterValue) return true;
  if (!playerValue) return true;
  if (RANGE_NEIGHBORS_INCLUDING_HEIGHT[axis]) {
    return matchesInRangeLocal(axis, filterValue, playerValue);
  }
  return playerValue.toString().toLowerCase() === filterValue.toString().toLowerCase();
};

// Per-tab active filter count.
const countActiveInGroup = (filters, keys) =>
  keys.filter((k) => !!filters[k]).length;

const ACCESSORY_FILTER_ACTIVE_COUNT = (filters) =>
  (filters.accessory.kind ? 1 : 0)
  + (filters.accessory.subtype ? 1 : 0)
  + (filters.accessory.color ? 1 : 0)
  + ((filters.accessory.note || '').trim() ? 1 : 0);

// ===========================================================================
// CONGRUENCY DIFF + PER-AXIS DECISIONS
// ===========================================================================

const computeCongruency = (filters, player) => {
  const eff = playerEffective(player);
  const items = []; // { axis, kind: 'mismatch' | 'addition', filterValue, playerValue }

  for (const axis of SCALAR_KEYS) {
    const fv = filters[axis];
    if (!fv) continue;
    const pv = eff[axis];
    if (!pv) {
      items.push({ axis, kind: 'addition', filterValue: fv, playerValue: null });
      continue;
    }
    // Range axes: tolerant — only flag if STRICTLY different (any difference,
    // even adjacent, surfaces so owner can pick more-specific value).
    if (fv.toString().toLowerCase() !== pv.toString().toLowerCase()) {
      items.push({ axis, kind: 'mismatch', filterValue: fv, playerValue: pv });
    }
  }

  if (filters.ethnicity.length > 0) {
    const playerTags = (player.ethnicityTags || []).map((t) => t.toLowerCase());
    const filterTags = filters.ethnicity.map((t) => t.toLowerCase());
    const allMatch = filterTags.every((t) => playerTags.includes(t));
    if (!allMatch) {
      if (playerTags.length === 0) {
        items.push({ axis: 'ethnicity', kind: 'addition', filterValue: filters.ethnicity, playerValue: null });
      } else {
        items.push({ axis: 'ethnicity', kind: 'mismatch', filterValue: filters.ethnicity, playerValue: player.ethnicityTags });
      }
    }
  }

  const acc = filters.accessory;
  const accFilterActive = !!(acc.kind || acc.subtype || acc.color || (acc.note && acc.note.trim()));
  if (accFilterActive) {
    const inv = Array.isArray(player.accessoryInventory) ? player.accessoryInventory : [];
    const matchKind = acc.kind ? (e) => e.kind === acc.kind : () => true;
    const matchSub = acc.subtype ? (e) => e.subtype === acc.subtype : () => true;
    const matchColor = acc.color ? (e) => e.color === acc.color : () => true;
    const matchNote = (acc.note && acc.note.trim())
      ? (e) => (e.note || '').toLowerCase().includes(acc.note.toLowerCase().trim())
      : () => true;
    const found = inv.find((e) => matchKind(e) && matchSub(e) && matchColor(e) && matchNote(e));
    if (!found) {
      items.push({ axis: 'accessory', kind: 'addition', filterValue: acc, playerValue: null });
    }
  }

  return items;
};

const formatValue = (axis, value) => {
  if (Array.isArray(value)) return value.join(', ');
  if (axis === 'accessory' && typeof value === 'object' && value) {
    const parts = [];
    if (value.color) parts.push(value.color);
    if (value.subtype) parts.push(value.subtype);
    if (value.kind) parts.unshift(value.kind);
    const head = parts.join(' ');
    return head + (value.note ? ` (${value.note})` : '');
  }
  return String(value || '—');
};

// ===========================================================================
// CONGRUENCY PANEL — per-axis decisions
// ===========================================================================

const DecisionRow = ({ item, decision, onPick }) => {
  const left = item.kind === 'mismatch'
    ? { id: 'filter', label: formatValue(item.axis, item.filterValue) }
    : { id: 'add',    label: formatValue(item.axis, item.filterValue) };
  const right = item.kind === 'mismatch'
    ? { id: 'player', label: formatValue(item.axis, item.playerValue) }
    : { id: 'skip',   label: 'Skip' };

  const Pill = ({ side, label }) => (
    <button
      type="button"
      onClick={() => onPick(side.id)}
      className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-semibold border transition-colors text-center truncate ${
        decision === side.id
          ? 'bg-amber-500 text-gray-900 border-amber-500'
          : 'bg-slate-800 text-gray-300 border-slate-600 hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold w-20 shrink-0">
          {FIELD_LABEL[item.axis] || item.axis}
        </span>
        {item.kind === 'addition' ? (
          <span className="text-[9px] text-emerald-300 px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 font-semibold">+ NEW</span>
        ) : (
          <span className="text-[9px] text-amber-300 px-1 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 font-semibold">DIFF</span>
        )}
      </div>
      <div className="flex gap-1.5 ml-1">
        <Pill side={left} label={`${item.kind === 'addition' ? 'Add' : 'Filter'}: ${left.label}`} />
        <Pill side={right} label={item.kind === 'addition' ? 'Skip' : `Keep: ${right.label}`} />
      </div>
    </div>
  );
};

const CongruencyPanel = ({ player, items, decisions, onDecide, onCancel, onAssign, seat }) => {
  if (items.length === 0) {
    return (
      <div className="bg-emerald-900/30 border border-emerald-600/40 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2 mb-2 text-emerald-200 text-sm font-semibold">
          <Check size={16} />
          Player matches all filters — ready to assign
        </div>
        <button
          type="button"
          onClick={() => onAssign(0)}
          className="w-full bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold rounded-lg py-2.5 text-sm shadow-sm"
        >
          Assign {player.name || 'player'} → Seat {seat}
        </button>
      </div>
    );
  }

  // Count how many decisions resolve to "apply" (filter or add).
  const applyCount = items.reduce((n, item) => {
    const d = decisions[`${item.axis}-${item.kind}`];
    return n + ((d === 'filter' || d === 'add') ? 1 : 0);
  }, 0);

  return (
    <div className="bg-slate-800 border border-amber-500/40 rounded-lg p-3 mb-3">
      <div className="flex items-center gap-2 mb-3 text-amber-200 text-sm font-semibold">
        <AlertTriangle size={16} />
        {items.length} difference{items.length === 1 ? '' : 's'} — pick per axis
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const key = `${item.axis}-${item.kind}`;
          return (
            <DecisionRow
              key={key}
              item={item}
              decision={decisions[key]}
              onPick={(side) => onDecide(key, side)}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-700">
        <button
          type="button"
          onClick={onCancel}
          className="bg-slate-700 hover:bg-slate-600 text-gray-200 text-xs font-semibold rounded-lg py-2.5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onAssign(applyCount)}
          className="bg-amber-500 hover:bg-amber-400 text-gray-900 text-xs font-semibold rounded-lg py-2.5"
        >
          Assign · apply {applyCount}
        </button>
      </div>
    </div>
  );
};

// ===========================================================================
// RESULT ROW
// ===========================================================================

const ResultRow = ({ player, onTap, hasActiveFilters, matchedAccessories, isLoaded }) => {
  const head = player.name || <span className="italic text-gray-500">(unnamed)</span>;
  const eff = playerEffective(player);
  const subtitle = [
    player.sex,
    player.ageDecade,
    eff.height,
    (player.ethnicityTags || []).slice(0, 1).join(' · '),
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

// ===========================================================================
// FORCE-FRESH (cache bust)
// ===========================================================================

const forceFresh = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (typeof caches !== 'undefined' && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {}
  window.location.reload(true);
};

// ===========================================================================
// MAIN VIEW
// ===========================================================================

const TABS = [
  { id: 'skin',      label: 'Skin' },
  { id: 'hair',      label: 'Hair' },
  { id: 'beard',     label: 'Beard' },
  { id: 'accessory', label: 'Accessory' },
];

export const PrototypeFinderView = () => {
  const { setCurrentScreen } = useUI();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [nameQuery, setNameQuery] = useState('');
  const [activeTab, setActiveTab] = useState('skin');
  const [activeRecord, setActiveRecord] = useState(null);
  const [decisions, setDecisions] = useState({}); // { 'axis-kind': 'filter'|'player'|'add'|'skip' }
  const [buildInfo, setBuildInfo] = useState({ sha: '?', built: '?' });

  const seat = 3;

  useEffect(() => {
    fetch('/version.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        const sha = (data.version || '').slice(0, 7);
        const built = (data.built || '').slice(0, 16).replace('T', ' ');
        setBuildInfo({ sha, built });
      })
      .catch(() => setBuildInfo({ sha: 'unknown', built: 'unknown' }));
  }, []);

  // ---- Filtering ----
  const accFilterActive = !!(filters.accessory.kind || filters.accessory.color);

  const matchesFilters = (player) => {
    const eff = playerEffective(player);
    for (const axis of SCALAR_KEYS) {
      const fv = filters[axis];
      if (!fv) continue;
      if (!matchesScalar(axis, fv, eff[axis])) return false;
    }
    if (filters.ethnicity.length > 0) {
      const tags = (player.ethnicityTags || []).map((t) => t.toLowerCase());
      if (tags.length > 0) {
        const ok = filters.ethnicity.some((sel) => tags.includes(sel.toLowerCase()));
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
    const out = [];
    for (const p of MOCK_PLAYERS) {
      if (!matchesFilters(p)) continue;
      const matched = accFilterActive
        ? findMatchingAccessories(p.accessoryInventory, {
            kind: filters.accessory.kind,
            color: filters.accessory.color,
          })
        : [];
      out.push({ player: p, matchedAccessories: matched });
    }
    out.sort((a, b) => {
      if (accFilterActive) {
        const ah = a.matchedAccessories.length > 0 ? 1 : 0;
        const bh = b.matchedAccessories.length > 0 ? 1 : 0;
        if (ah !== bh) return bh - ah;
      }
      return (b.player.lastSeenAt || 0) - (a.player.lastSeenAt || 0);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, nameQuery, accFilterActive]);

  const hasActiveFilters =
    !!nameQuery
    || filters.ethnicity.length > 0
    || SCALAR_KEYS.some((k) => !!filters[k])
    || accFilterActive
    || (filters.accessory.note && filters.accessory.note.trim());

  // ---- Tab badges ----
  const tabBadges = {
    skin: filters.skinTone ? 1 : 0,
    hair: countActiveInGroup(filters, ['hairColor', 'hairLength', 'hairTexture', 'hairTreatment']),
    beard: countActiveInGroup(filters, ['facialHair', 'beardColor']),
    accessory: ACCESSORY_FILTER_ACTIVE_COUNT(filters),
  };

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
  const setAccessory = (patch) => {
    setFilters((prev) => ({ ...prev, accessory: { ...prev.accessory, ...patch } }));
  };
  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setNameQuery('');
  };

  const onTapResult = (player) => {
    setActiveRecord(player);
    // Compute initial per-axis decisions: mismatches default to "player",
    // additions default to "add" (new info usually worth keeping).
    const items = computeCongruency(filters, player);
    const initial = {};
    for (const item of items) {
      const key = `${item.axis}-${item.kind}`;
      initial[key] = item.kind === 'mismatch' ? 'player' : 'add';
    }
    setDecisions(initial);
  };
  const cancelLoaded = () => {
    setActiveRecord(null);
    setDecisions({});
  };
  const onDecide = (key, side) => {
    setDecisions((prev) => ({ ...prev, [key]: side }));
  };
  const onAssign = (applyCount) => {
    if (!activeRecord) return;
    const items = computeCongruency(filters, activeRecord);
    const applied = [];
    for (const item of items) {
      const key = `${item.axis}-${item.kind}`;
      const d = decisions[key];
      if (d === 'filter' || d === 'add') {
        applied.push(`${FIELD_LABEL[item.axis] || item.axis}: ${formatValue(item.axis, item.filterValue)}`);
      }
    }
    const summary = applied.length > 0
      ? `Apply to ${activeRecord.name || 'player'}:\n  ${applied.join('\n  ')}\n\nThen assign to seat ${seat}.`
      : `Assign ${activeRecord.name || 'player'} to seat ${seat} as-is (no changes applied).`;
    alert(`[prototype]\n${summary}`);
    setActiveRecord(null);
    setDecisions({});
  };

  const congruencyItems = activeRecord ? computeCongruency(filters, activeRecord) : [];

  // Live avatar source — when an existing player is loaded, show their record
  // straight; when composing new, build a synthetic player from current
  // filter values so every chip tap updates the avatar in real time.
  // Accessory.kind === 'hat' / 'glasses' feed the legacy headwear/eyewear
  // avatar slots so the preview shows what the player would look like.
  const livePlayer = activeRecord || {
    playerId: 'live-builder',
    sex: filters.sex,
    ageDecade: filters.ageDecade,
    ethnicityTags: filters.ethnicity,
    skinTone: filters.skinTone,
    hairColor: filters.hairColor,
    hairLength: filters.hairLength,
    hairTexture: filters.hairTexture,
    hairSaltPepper: filters.hairTreatment === 'salt-pepper',
    facialHair: filters.facialHair,
    beardColor: filters.beardColor,
    build: filters.build,
    // Accessory → avatar slot mapping (preview only).
    headwear: filters.accessory.kind === 'hat' ? filters.accessory.subtype : null,
    eyewear: filters.accessory.kind === 'glasses' ? filters.accessory.subtype : null,
  };

  // Active-axis count for the status line under the avatar.
  const totalActiveCount =
    SCALAR_KEYS.filter((k) => !!filters[k]).length
    + filters.ethnicity.length
    + ACCESSORY_FILTER_ACTIVE_COUNT(filters);

  const builderStatus = activeRecord
    ? { line1: 'Viewing', line2: activeRecord.name || '(unnamed player)' }
    : totalActiveCount === 0
      ? { line1: 'Building', line2: 'pick features below' }
      : { line1: 'Building player', line2: `${totalActiveCount} feature${totalActiveCount === 1 ? '' : 's'} set` };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="h-dvh w-full flex flex-col bg-slate-900 text-gray-100 overflow-hidden">
      {/* TOP BAR */}
      <div className="sticky top-0 z-30 bg-slate-950 border-b border-slate-700">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            type="button"
            onClick={() => setCurrentScreen(SCREEN.SETTINGS)}
            className="flex items-center gap-1 text-sm font-medium hover:bg-slate-800 px-2 py-1 rounded text-gray-200"
          >
            <ChevronLeft size={18} />
            Back
          </button>
          <div className="text-sm font-semibold text-gray-100 truncate mx-2">
            Pick for Seat {seat}
          </div>
          <button
            type="button"
            onClick={forceFresh}
            className="flex items-center gap-1 text-[10px] text-amber-300 px-2 py-1 rounded border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 shrink-0"
            title="Unregister SW + clear caches + reload"
          >
            <RefreshCw size={10} />
            Force fresh
          </button>
        </div>
        <div className="px-3 py-1 bg-amber-500/15 border-t border-amber-500/30 text-amber-200 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider uppercase">
            🧪 Prototype v5
          </span>
          <span className="text-[9px] font-mono text-amber-100/70">
            build {buildInfo.sha} · {buildInfo.built}
          </span>
        </div>
      </div>

      {/* BUILDER HEADER — outside the scroll region so the live avatar is
          always visible as the user fills in features. The avatar IS the
          "what am I building" anchor. Synthetic player derived from filters
          (composing-new) or the loaded record (viewing-existing). */}
      <div className="bg-slate-900 border-b border-slate-700 px-3 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`shrink-0 rounded-full overflow-hidden border-2 transition-colors ${
            activeRecord ? 'border-amber-500' : (totalActiveCount > 0 ? 'border-amber-500/40' : 'border-slate-700')
          }`} style={{ width: 56, height: 56 }}>
            <IdentityAvatar player={livePlayer} size={56} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 leading-none mb-1">
              <span className="text-[10px] uppercase tracking-wider text-amber-300/80 font-bold">
                {builderStatus.line1}
              </span>
              <span className="text-sm font-semibold text-gray-100 truncate">{builderStatus.line2}</span>
            </div>
            <input
              type="text"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Name or nickname"
              className="w-full bg-slate-800 text-gray-100 text-xs placeholder:text-gray-500 rounded border border-slate-700 px-2 py-1.5 focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* SCROLL COLUMN */}
      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-4">

        {/* IDENTITY — always visible, primary axes */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-2.5 mb-2">
          <PrimaryHeader count={(filters.sex ? 1 : 0) + (filters.ageDecade ? 1 : 0) + filters.ethnicity.length}>
            Identity
          </PrimaryHeader>
          <SubLabel>Sex</SubLabel>
          <ChipRow>
            {SEX_OPTIONS.map((o) => (
              <PlainChip key={o.value} label={o.label} active={filters.sex === o.value} onClick={() => setScalar('sex', o.value)} />
            ))}
          </ChipRow>
          <SubLabel>Age decade</SubLabel>
          <ChipRow>
            {AGE_OPTIONS.map((o) => (
              <PlainChip key={o} label={o} active={filters.ageDecade === o} onClick={() => setScalar('ageDecade', o)} />
            ))}
          </ChipRow>
          <SubLabel>Ethnicity</SubLabel>
          <ChipRow className="mb-0">
            {ETHNICITY_OPTIONS.map((o) => (
              <PlainChip key={o.value} label={o.label} active={filters.ethnicity.includes(o.value)} onClick={() => toggleEthnicity(o.value)} />
            ))}
          </ChipRow>
        </div>

        {/* BODY — always visible, small chip count */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-2.5 mb-2">
          <PrimaryHeader count={(filters.build ? 1 : 0) + (filters.height ? 1 : 0)}>
            Body
          </PrimaryHeader>
          <SubLabel>Build</SubLabel>
          <ChipRow>
            {BUILD_OPTIONS.map((o) => (
              <PlainChip key={o} label={o} active={filters.build === o} onClick={() => setScalar('build', o)} />
            ))}
          </ChipRow>
          <SubLabel>Height</SubLabel>
          <ChipRow className="mb-0">
            {HEIGHT_OPTIONS.map((o) => (
              <PlainChip key={o.value} label={o.label} active={filters.height === o.value} onClick={() => setScalar('height', o.value)} />
            ))}
          </ChipRow>
        </div>

        {/* TABBED CHIP-HEAVY AXES */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-2.5 mb-2">
          <PrimaryHeader count={tabBadges.skin + tabBadges.hair + tabBadges.beard + tabBadges.accessory}>
            Features
          </PrimaryHeader>
          {/* Segmented tab strip */}
          <div className="flex gap-1 mb-3 bg-slate-900 p-1 rounded-lg border border-slate-700">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 px-2 py-2 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === t.id
                    ? 'bg-amber-500 text-gray-900 shadow-sm'
                    : 'text-gray-300 hover:bg-slate-800'
                }`}
              >
                <span>{t.label}</span>
                {tabBadges[t.id] > 0 ? (
                  <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 ${
                    activeTab === t.id ? 'bg-gray-900 text-amber-300' : 'bg-amber-500 text-gray-900'
                  }`}>
                    {tabBadges[t.id]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Active tab content */}
          {activeTab === 'skin' ? (
            <div>
              <SubLabel>Skin tone</SubLabel>
              <ChipRow className="mb-0">
                {SKIN_TONES.map((t) => {
                  const key = t.id.replace(/^skin\./, '');
                  return <SwatchChip key={t.id} label={t.label} hex={t.hex} active={filters.skinTone === key} onClick={() => setScalar('skinTone', key)} />;
                })}
              </ChipRow>
            </div>
          ) : null}

          {activeTab === 'hair' ? (
            <div>
              <SubLabel>Color</SubLabel>
              <ChipRow>
                {HAIR_COLOR_INPUT_OPTIONS.map((opt) => (
                  <SwatchChip key={opt.value} label={opt.label} hex={HAIR_HEX[opt.value]} active={filters.hairColor === opt.value} onClick={() => setScalar('hairColor', opt.value)} />
                ))}
              </ChipRow>
              <SubLabel>Length</SubLabel>
              <ChipRow>
                {HAIR_LENGTH_OPTIONS.map((opt) => (
                  <PlainChip key={opt.value} label={opt.label} active={filters.hairLength === opt.value} onClick={() => setScalar('hairLength', opt.value)} />
                ))}
              </ChipRow>
              <SubLabel>Texture</SubLabel>
              <ChipRow>
                {HAIR_TEXTURE_OPTIONS.map((opt) => (
                  <PlainChip key={opt.value} label={opt.label} active={filters.hairTexture === opt.value} onClick={() => setScalar('hairTexture', opt.value)} />
                ))}
              </ChipRow>
              <SubLabel>Treatment</SubLabel>
              <ChipRow className="mb-0">
                <PlainChip label="Salt & pepper" active={filters.hairTreatment === 'salt-pepper'} onClick={() => setScalar('hairTreatment', 'salt-pepper')} />
              </ChipRow>
            </div>
          ) : null}

          {activeTab === 'beard' ? (
            <div>
              <SubLabel>Style</SubLabel>
              <ChipRow>
                {FACIAL_HAIR_OPTIONS.map((opt) => (
                  <PlainChip key={opt.value} label={opt.label} active={filters.facialHair === opt.value} onClick={() => setScalar('facialHair', opt.value)} />
                ))}
              </ChipRow>
              <SubLabel>Color</SubLabel>
              <ChipRow className="mb-0">
                {HAIR_COLOR_INPUT_OPTIONS.map((opt) => (
                  <SwatchChip key={opt.value} label={opt.label} hex={HAIR_HEX[opt.value]} active={filters.beardColor === opt.value} onClick={() => setScalar('beardColor', opt.value)} />
                ))}
              </ChipRow>
            </div>
          ) : null}

          {activeTab === 'accessory' ? (
            <div>
              <div className="text-[10px] text-amber-200/70 mb-2 italic">
                Accessory match boosts results — never excludes. Glasses + headwear live here.
              </div>
              <SubLabel>Kind</SubLabel>
              <ChipRow>
                {ACCESSORY_KINDS.map((k) => (
                  <PlainChip
                    key={k.kind}
                    label={k.label}
                    active={filters.accessory.kind === k.kind}
                    onClick={() => setAccessory({
                      kind: filters.accessory.kind === k.kind ? null : k.kind,
                      subtype: null,
                    })}
                  />
                ))}
              </ChipRow>
              {filters.accessory.kind && ACCESSORY_KINDS.find((k) => k.kind === filters.accessory.kind)?.subtypes.length > 0 ? (
                <>
                  <SubLabel>Subtype</SubLabel>
                  <ChipRow>
                    {ACCESSORY_KINDS.find((k) => k.kind === filters.accessory.kind).subtypes.map((sub) => (
                      <PlainChip
                        key={sub}
                        label={sub}
                        size="sm"
                        active={filters.accessory.subtype === sub}
                        onClick={() => setAccessory({ subtype: filters.accessory.subtype === sub ? null : sub })}
                      />
                    ))}
                  </ChipRow>
                </>
              ) : null}
              {filters.accessory.kind && filters.accessory.kind !== 'other' ? (
                <>
                  <SubLabel>Color</SubLabel>
                  <ChipRow>
                    {CLOTHING_COLORS.map((c) => {
                      const key = c.id.replace(/^cloth\./, '');
                      return <SwatchChip key={c.id} label={c.label} hex={c.hex} active={filters.accessory.color === key} onClick={() => setAccessory({ color: filters.accessory.color === key ? null : key })} />;
                    })}
                  </ChipRow>
                </>
              ) : null}
              {filters.accessory.kind ? (
                <>
                  <SubLabel>Note</SubLabel>
                  <input
                    type="text"
                    value={filters.accessory.note}
                    onChange={(e) => setAccessory({ note: e.target.value })}
                    placeholder={filters.accessory.kind === 'other' ? 'free-text descriptor' : 'e.g. "KC Royals", "WSOP"'}
                    className="w-full bg-slate-900 text-gray-100 text-xs placeholder:text-gray-500 rounded border border-slate-700 px-2 py-2 focus:border-amber-500 focus:outline-none"
                  />
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ACTIVE-FILTER COUNT BAR */}
        <div className="flex items-center justify-between px-1 py-2">
          <div className="text-[11px] text-gray-400">
            {hasActiveFilters ? `${sortedResults.length} match${sortedResults.length === 1 ? '' : 'es'}` : 'No filters · all players'}
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

        {/* CONGRUENCY PANEL */}
        {activeRecord ? (
          <CongruencyPanel
            player={activeRecord}
            items={congruencyItems}
            decisions={decisions}
            onDecide={onDecide}
            onCancel={cancelLoaded}
            onAssign={onAssign}
            seat={seat}
          />
        ) : null}

        {/* RESULTS */}
        <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5 font-bold flex items-center justify-between mt-1">
          <span>Results · {sortedResults.length}</span>
          {activeRecord ? (
            <button
              type="button"
              onClick={cancelLoaded}
              className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200"
            >
              <X size={12} />
              Clear loaded
            </button>
          ) : null}
        </div>
        <div className="space-y-1.5">
          {sortedResults.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-500 bg-slate-800/50 rounded-lg border border-dashed border-slate-700">
              No matches. Adjust a filter, or save as new player.
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

        {!activeRecord && hasActiveFilters ? (
          <button
            type="button"
            onClick={() => alert('[prototype] Would: Save & Assign as new player using current filter values + accessory entry.')}
            className="w-full mt-3 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-dashed border-amber-500/40 rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Save & Assign as NEW player using these values
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default PrototypeFinderView;
