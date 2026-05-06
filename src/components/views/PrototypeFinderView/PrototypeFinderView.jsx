/**
 * @file PrototypeFinderView.jsx — interactive prototype of the unified PlayerFinder.
 *
 * v2 (2026-05-06) per owner feedback:
 *  - Filters all live ABOVE results. No collapsibles. Adding a filter
 *    never shifts the position of another filter under the user's finger.
 *  - Glasses and headwear absorbed into the accessory model — kind/subtype/
 *    color/note + attached on the spot. No more separate Eyewear / Headwear
 *    rows.
 *  - Height field (short/medium/tall) added as a stable identification axis.
 *  - Salt-pepper hair treatment toggle exposed.
 *  - Color palette ordering follows the LIGHT → DARK invariant
 *    (`feedback_color_gradient_invariant.md`).
 *  - Tap-to-load triggers a congruency check: the diff between current
 *    filters and the player's stored values is surfaced for accept / apply /
 *    add-to-inventory before final assign.
 *
 * Reachable in production via Settings → Admin / Sandbox → "Prototype:
 * Unified PlayerFinder", or directly at #prototype-finder. Mock data only.
 */

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X, AlertTriangle, Plus, Check } from 'lucide-react';
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
  { value: 'caucasian', label: 'White/Caucasian' },
  { value: 'hispanic', label: 'Hispanic' },
  { value: 'east-asian', label: 'East Asian' },
  { value: 'south-asian', label: 'South Asian' },
  { value: 'black', label: 'Black' },
  { value: 'middle-eastern', label: 'Middle Eastern' },
];
// Height — stable identification axis; range-match short ↔ medium ↔ tall.
const HEIGHT_OPTIONS = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'tall', label: 'Tall' },
];

// Glasses + headwear are now accessory KINDS, not separate fields.
// `glasses` is added; subtype options for each kind are below.
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
  'hairTreatment',
  'facialHair', 'beardColor', 'build', 'height',
];

const EMPTY_FILTERS = {
  sex: null,
  ageDecade: null,
  ethnicity: [],
  skinTone: null,
  hairColor: null,
  hairLength: null,
  hairTexture: null,
  hairTreatment: null, // 'salt-pepper' | null
  facialHair: null,
  beardColor: null,
  build: null,
  height: null,
  // Accessory boost — kind+color, with optional subtype + free-text note for
  // capture-style filtering ("blue cap KC Royals").
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

// ===========================================================================
// PRIMITIVES
// ===========================================================================

const PlainChip = ({ active, label, onClick, size = 'md' }) => {
  const sz = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${sz} rounded-full transition-colors border ${
        active
          ? 'bg-amber-500 text-gray-900 border-amber-600 font-semibold shadow-sm'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
    <div className="text-[10px] uppercase tracking-wide text-gray-400 w-16 shrink-0 pt-1.5 font-semibold">
      {label}
    </div>
    <div className="flex flex-wrap gap-1 items-center">{children}</div>
  </div>
);

const SectionLabel = ({ children }) => (
  <div className="text-[10px] uppercase tracking-wide text-amber-300/90 font-semibold mt-3 mb-1.5 px-1 border-l-2 border-amber-500/40 pl-2">
    {children}
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

const matchesScalar = (axis, filterValue, playerValue) => {
  if (!filterValue) return true;
  if (!playerValue) return true; // permissive on null
  if (RANGE_NEIGHBORS_INCLUDING_HEIGHT[axis]) {
    return matchesInRangeLocal(axis, filterValue, playerValue);
  }
  return playerValue.toString().toLowerCase() === filterValue.toString().toLowerCase();
};

const matchesInRangeLocal = (axis, filterValue, playerValue) => {
  const map = RANGE_NEIGHBORS_INCLUDING_HEIGHT[axis];
  if (!map) return matchesInRange(axis, filterValue, playerValue);
  const neighbors = map[filterValue.toString().toLowerCase()];
  if (!neighbors) return playerValue.toLowerCase() === filterValue.toLowerCase();
  return neighbors.includes(playerValue.toString().toLowerCase());
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
};

// ===========================================================================
// CONGRUENCY-CHECK COMPUTATION
// ===========================================================================

/**
 * Compare current filters to a player's effective values. Returns three
 * categorized lists:
 *   - mismatches: filter set + player has different value (true conflict)
 *   - additions:  filter set + player has no value (new info to attach)
 *   - matches:    filter set + player has matching value (silent — not shown)
 *
 * Range axes count as a "match" if filter and player values are adjacent,
 * even if not identical. The mismatch is only surfaced for STRICT-non-match
 * cases (e.g., filter says 30s, player says 60s+ — beyond ladder range).
 */
const computeCongruency = (filters, player) => {
  const eff = playerEffective(player);
  const mismatches = [];
  const additions = [];

  // Scalar axes
  for (const axis of SCALAR_KEYS) {
    const fv = filters[axis];
    if (!fv) continue;
    const pv = eff[axis];
    if (!pv) {
      additions.push({ axis, filterValue: fv, playerValue: null });
    } else if (!matchesInRangeLocal
      // Range matchers are tolerant; we surface only when the values are
      // truly different (not adjacent).
      ? false
      : !matchesInRangeLocal(axis, fv, pv)
    ) {
      mismatches.push({ axis, filterValue: fv, playerValue: pv });
    } else if (fv.toString().toLowerCase() !== pv.toString().toLowerCase()) {
      // Adjacent on ladder — soft mismatch worth surfacing in case owner
      // wants to update the player to the more-specific filter value.
      mismatches.push({ axis, filterValue: fv, playerValue: pv, soft: true });
    }
  }

  // Ethnicity (multi-tag)
  if (filters.ethnicity.length > 0) {
    const playerTags = (player.ethnicityTags || []).map((t) => t.toLowerCase());
    const newTags = filters.ethnicity.filter((t) => !playerTags.includes(t.toLowerCase()));
    if (newTags.length > 0) {
      // Player either has no ethnicity or has a different/missing one.
      if (playerTags.length === 0) {
        additions.push({ axis: 'ethnicity', filterValue: filters.ethnicity, playerValue: null });
      } else {
        // Some overlap or different overlap — surface as soft mismatch.
        const filterSet = filters.ethnicity.map((t) => t.toLowerCase());
        const allMatch = filterSet.every((t) => playerTags.includes(t));
        if (!allMatch) {
          mismatches.push({
            axis: 'ethnicity',
            filterValue: filters.ethnicity,
            playerValue: player.ethnicityTags,
            soft: true,
          });
        }
      }
    }
  }

  // Accessory — if filter set with a kind/color/subtype/note, check player's
  // inventory for a matching item.
  const acc = filters.accessory;
  const accFilterActive = acc.kind || acc.subtype || acc.color || (acc.note && acc.note.trim());
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
      additions.push({
        axis: 'accessory',
        filterValue: acc,
        playerValue: null,
      });
    }
  }

  return { mismatches, additions };
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

// ===========================================================================
// CONGRUENCY PANEL
// ===========================================================================

const formatValue = (axis, value) => {
  if (Array.isArray(value)) return value.join(', ');
  if (axis === 'accessory' && typeof value === 'object') {
    const parts = [];
    if (value.kind) parts.push(value.kind);
    if (value.color) parts.push(value.color);
    if (value.subtype) parts.push(value.subtype);
    const head = parts.join(' ');
    return head + (value.note ? ` (${value.note})` : '');
  }
  return value || '—';
};

const CongruencyPanel = ({ player, mismatches, additions, onAccept, onApply, onCancel, seat }) => {
  const noDiff = mismatches.length === 0 && additions.length === 0;

  if (noDiff) {
    return (
      <div className="bg-emerald-900/30 border border-emerald-600/50 rounded-lg p-3 mb-2">
        <div className="flex items-center gap-2 mb-2 text-emerald-300 text-sm font-semibold">
          <Check size={16} />
          Everything matches — ready to assign
        </div>
        <button
          type="button"
          onClick={onAccept}
          className="w-full bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold rounded-lg py-2.5 text-sm shadow-sm"
        >
          Assign {player.name || 'player'} → Seat {seat}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-amber-600/50 rounded-lg p-3 mb-2">
      <div className="flex items-center gap-2 mb-2 text-amber-200 text-sm font-semibold">
        <AlertTriangle size={16} />
        Differences detected — review before assigning
      </div>
      <div className="space-y-1.5 mb-3">
        {mismatches.map((m, i) => (
          <div key={`m-${i}`} className="flex items-center gap-2 text-xs">
            <span className="text-[10px] uppercase tracking-wide text-gray-500 w-16 shrink-0 font-semibold">
              {FIELD_LABEL[m.axis] || m.axis}
            </span>
            <span className="text-amber-300 shrink-0">filter: {formatValue(m.axis, m.filterValue)}</span>
            <span className="text-gray-500 shrink-0">·</span>
            <span className="text-gray-200 shrink-0">player: {formatValue(m.axis, m.playerValue)}</span>
          </div>
        ))}
        {additions.map((a, i) => (
          <div key={`a-${i}`} className="flex items-center gap-2 text-xs">
            <Plus size={12} className="text-emerald-400 shrink-0" />
            <span className="text-[10px] uppercase tracking-wide text-gray-500 w-12 shrink-0 font-semibold">
              {FIELD_LABEL[a.axis] || a.axis}
            </span>
            <span className="text-emerald-300">new: {formatValue(a.axis, a.filterValue)}</span>
            <span className="text-gray-500 text-[11px] italic ml-auto">(player has none)</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="bg-slate-700 hover:bg-slate-600 text-gray-200 text-xs font-semibold rounded-lg py-2"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="bg-slate-700 hover:bg-slate-600 text-gray-200 text-xs font-semibold rounded-lg py-2"
          title="Keep player's stored values; assign without changes"
        >
          Keep player as-is
        </button>
        <button
          type="button"
          onClick={onApply}
          className="bg-amber-500 hover:bg-amber-400 text-gray-900 text-xs font-semibold rounded-lg py-2"
          title="Apply your filter values to the player record before assigning"
        >
          Apply changes
        </button>
      </div>
    </div>
  );
};

// ===========================================================================
// MAIN VIEW
// ===========================================================================

export const PrototypeFinderView = () => {
  const { setCurrentScreen } = useUI();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [nameQuery, setNameQuery] = useState('');
  const [activeRecord, setActiveRecord] = useState(null);

  const seat = 3; // mock

  // ----- Filtering -----
  const accFilterActive = !!(filters.accessory.kind || filters.accessory.color);

  const matchesFilters = (player) => {
    const eff = playerEffective(player);
    for (const axis of SCALAR_KEYS) {
      const fv = filters[axis];
      if (!fv) continue;
      const pv = eff[axis];
      if (!matchesScalar(axis, fv, pv)) return false;
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

  // ----- Handlers -----
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
    // Owner-confirmed §5 decision: PRESERVE filters on tap so the
    // congruency check has both sides of the comparison available.
    setActiveRecord(player);
  };
  const cancelLoaded = () => setActiveRecord(null);

  // ----- Congruency computation for the active record -----
  const congruency = activeRecord ? computeCongruency(filters, activeRecord) : null;

  // Apply the filter values to the player and assign (mock).
  const onApply = () => {
    if (!activeRecord) return;
    const summary = [];
    for (const m of congruency.mismatches) {
      summary.push(`${FIELD_LABEL[m.axis] || m.axis}: ${formatValue(m.axis, m.playerValue)} → ${formatValue(m.axis, m.filterValue)}`);
    }
    for (const a of congruency.additions) {
      summary.push(`+ ${FIELD_LABEL[a.axis] || a.axis}: ${formatValue(a.axis, a.filterValue)}`);
    }
    alert(`[prototype] Would update ${activeRecord.name || 'player'}:\n${summary.join('\n')}\n\nThen assign to seat ${seat}.`);
    setActiveRecord(null);
  };
  const onAccept = () => {
    if (!activeRecord) return;
    alert(`[prototype] Would assign ${activeRecord.name || 'player'} to seat ${seat} as-is.`);
    setActiveRecord(null);
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="h-dvh w-full flex flex-col bg-slate-900 text-gray-100 overflow-hidden">
      {/* TOP BAR */}
      <div className="sticky top-0 z-20 flex items-center justify-between bg-slate-950 px-3 py-2 border-b border-slate-700">
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
        <div className="text-[10px] text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 shrink-0">
          PROTOTYPE v2
        </div>
      </div>

      {/* SCROLLABLE COLUMN — filters above, results below. Filter changes
          never shift results-position, results changes never shift filters
          (they're DOM-above results).  */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* Name search */}
        <input
          type="text"
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
          placeholder="Name or nickname"
          className="w-full bg-slate-800 text-gray-100 text-sm placeholder:text-gray-500 rounded-lg border border-slate-700 px-3 py-2.5 mb-2 focus:border-amber-500 focus:outline-none"
        />

        {/* IDENTIFICATION FILTERS — always visible, no collapsibles. */}
        <SectionLabel>Identity</SectionLabel>
        <FieldRow label="Sex">
          {SEX_OPTIONS.map((o) => (
            <PlainChip key={o.value} label={o.label} active={filters.sex === o.value} onClick={() => setScalar('sex', o.value)} />
          ))}
        </FieldRow>
        <FieldRow label="Age">
          {AGE_OPTIONS.map((o) => (
            <PlainChip key={o} label={o} active={filters.ageDecade === o} onClick={() => setScalar('ageDecade', o)} />
          ))}
        </FieldRow>
        <FieldRow label="Ethnicity">
          {ETHNICITY_OPTIONS.map((o) => (
            <PlainChip key={o.value} label={o.label} active={filters.ethnicity.includes(o.value)} onClick={() => toggleEthnicity(o.value)} />
          ))}
        </FieldRow>

        <SectionLabel>Body</SectionLabel>
        <FieldRow label="Build">
          {BUILD_OPTIONS.map((opt) => (
            <PlainChip key={opt} label={opt} active={filters.build === opt} onClick={() => setScalar('build', opt)} />
          ))}
        </FieldRow>
        <FieldRow label="Height">
          {HEIGHT_OPTIONS.map((opt) => (
            <PlainChip key={opt.value} label={opt.label} active={filters.height === opt.value} onClick={() => setScalar('height', opt.value)} />
          ))}
        </FieldRow>

        <SectionLabel>Skin</SectionLabel>
        <FieldRow label="Tone">
          {SKIN_TONES.map((t) => {
            const key = t.id.replace(/^skin\./, '');
            return <SwatchChip key={t.id} label={t.label} hex={t.hex} active={filters.skinTone === key} onClick={() => setScalar('skinTone', key)} />;
          })}
        </FieldRow>

        <SectionLabel>Hair</SectionLabel>
        <FieldRow label="Color">
          {HAIR_COLOR_INPUT_OPTIONS.map((opt) => (
            <SwatchChip key={opt.value} label={opt.label} hex={HAIR_HEX[opt.value]} active={filters.hairColor === opt.value} onClick={() => setScalar('hairColor', opt.value)} />
          ))}
        </FieldRow>
        <FieldRow label="Length">
          {HAIR_LENGTH_OPTIONS.map((opt) => (
            <PlainChip key={opt.value} label={opt.label} active={filters.hairLength === opt.value} onClick={() => setScalar('hairLength', opt.value)} />
          ))}
        </FieldRow>
        <FieldRow label="Texture">
          {HAIR_TEXTURE_OPTIONS.map((opt) => (
            <PlainChip key={opt.value} label={opt.label} active={filters.hairTexture === opt.value} onClick={() => setScalar('hairTexture', opt.value)} />
          ))}
        </FieldRow>
        <FieldRow label="Treatment">
          <PlainChip
            label="Salt & pepper"
            active={filters.hairTreatment === 'salt-pepper'}
            onClick={() => setScalar('hairTreatment', 'salt-pepper')}
          />
        </FieldRow>

        <SectionLabel>Facial hair</SectionLabel>
        <FieldRow label="Style">
          {FACIAL_HAIR_OPTIONS.map((opt) => (
            <PlainChip key={opt.value} label={opt.label} active={filters.facialHair === opt.value} onClick={() => setScalar('facialHair', opt.value)} />
          ))}
        </FieldRow>
        <FieldRow label="Color">
          {HAIR_COLOR_INPUT_OPTIONS.map((opt) => (
            <SwatchChip key={opt.value} label={opt.label} hex={HAIR_HEX[opt.value]} active={filters.beardColor === opt.value} onClick={() => setScalar('beardColor', opt.value)} />
          ))}
        </FieldRow>

        {/* ACCESSORY — kind + subtype + color + free-text note. Glasses and
            headwear live HERE now; no more separate Eyewear/Headwear axes. */}
        <SectionLabel>Accessory <span className="text-amber-200/70 normal-case font-normal">· boost only · also lets you attach new gear to the player</span></SectionLabel>
        <FieldRow label="Kind">
          {ACCESSORY_KINDS.map((k) => (
            <PlainChip
              key={k.kind}
              label={k.label}
              active={filters.accessory.kind === k.kind}
              onClick={() => setAccessory({
                kind: filters.accessory.kind === k.kind ? null : k.kind,
                subtype: null, // reset subtype when kind changes
              })}
            />
          ))}
        </FieldRow>
        {filters.accessory.kind && ACCESSORY_KINDS.find((k) => k.kind === filters.accessory.kind)?.subtypes.length > 0 ? (
          <FieldRow label="Subtype">
            {ACCESSORY_KINDS.find((k) => k.kind === filters.accessory.kind).subtypes.map((sub) => (
              <PlainChip
                key={sub}
                label={sub}
                size="sm"
                active={filters.accessory.subtype === sub}
                onClick={() => setAccessory({ subtype: filters.accessory.subtype === sub ? null : sub })}
              />
            ))}
          </FieldRow>
        ) : null}
        {filters.accessory.kind && filters.accessory.kind !== 'other' ? (
          <FieldRow label="Color">
            {CLOTHING_COLORS.map((c) => {
              const key = c.id.replace(/^cloth\./, '');
              return <SwatchChip key={c.id} label={c.label} hex={c.hex} active={filters.accessory.color === key} onClick={() => setAccessory({ color: filters.accessory.color === key ? null : key })} />;
            })}
          </FieldRow>
        ) : null}
        {filters.accessory.kind ? (
          <div className="ml-[72px] mb-2">
            <input
              type="text"
              value={filters.accessory.note}
              onChange={(e) => setAccessory({ note: e.target.value })}
              placeholder={
                filters.accessory.kind === 'other'
                  ? 'free-text descriptor (e.g. "Lakers gym bag")'
                  : 'note (e.g., "KC Royals", "WSOP")'
              }
              className="w-full bg-slate-800 text-gray-100 text-xs placeholder:text-gray-500 rounded border border-slate-700 px-2 py-1.5 focus:border-amber-500 focus:outline-none"
            />
          </div>
        ) : null}

        {/* ACTIVE-FILTER FOOTER */}
        <div className="flex items-center justify-between mt-2 mb-3 pt-2 border-t border-slate-800">
          <div className="text-[10px] text-gray-400">
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

        {/* CONGRUENCY PANEL — only when a result is loaded */}
        {activeRecord ? (
          <CongruencyPanel
            player={activeRecord}
            mismatches={congruency.mismatches}
            additions={congruency.additions}
            onCancel={cancelLoaded}
            onAccept={onAccept}
            onApply={onApply}
            seat={seat}
          />
        ) : null}

        {/* RESULTS */}
        <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5 font-semibold flex items-center justify-between">
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
        <div className="space-y-1.5 mb-3">
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

        {/* CREATE-NEW shortcut when no result is loaded but filters/name are dirty */}
        {!activeRecord && hasActiveFilters ? (
          <button
            type="button"
            onClick={() => alert('[prototype] Would: Save & Assign as new player using current filter values + accessory entry.')}
            className="w-full bg-slate-800 hover:bg-slate-700 text-amber-300 border border-dashed border-amber-500/40 rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Save & Assign as NEW player using these values
          </button>
        ) : null}

        <div className="h-4" />
      </div>
    </div>
  );
};

export default PrototypeFinderView;
