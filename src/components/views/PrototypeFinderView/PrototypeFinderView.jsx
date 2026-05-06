/**
 * @file PrototypeFinderView.jsx — interactive prototype of the unified PlayerFinder.
 *
 * v6 (2026-05-06) — Visual Design System Sweep per the approved plan in
 * `.claude/plans/floating-questing-conway.md`. Resolves 20 visual
 * inconsistencies surfaced in the audit. Establishes a small token
 * system (spacing scale, type scale, color roles, capitalization rule,
 * icon scale) that carries forward to the production PlayerFinder.
 *
 * Key changes from v5:
 *   - PlainChip + SwatchChip + Pill collapsed into ONE `Chip` primitive
 *     with size + swatch + variant props.
 *   - Tab strip drops its inner background (was darker than parent card)
 *     for a clean `border-b` separator.
 *   - Spacing scale: 4 / 8 / 12 / 16 only.
 *   - Type scale: 9 / 11 / 12 / 14 / 16 only.
 *   - Color tokens: amber-500 (active), amber-500/10 (loaded bg),
 *     /30 (loaded border), /50 (soft action borders). Three opacity
 *     steps total, no more drift.
 *   - Tap targets: filter chips ≥44px tall (WCAG 2.5.5).
 *   - Icon scale: 12 / 16 / 20 / 48-56.
 *   - Result row: ONE highlight pattern (loaded). Drops the left-bar
 *     accent for has-filters-not-loaded.
 *   - CongruencyPanel: invariant slate shell; status communicated via
 *     icon + title text color only.
 *   - BUILD_OPTIONS now Title Case via {value, label} shape (fixed at
 *     source in BuildSection.jsx).
 *
 * Reachable via Settings → Admin / Sandbox or directly at
 * #prototype-finder. Mock data only.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, X, AlertTriangle, Plus, Check, RefreshCw, Camera } from 'lucide-react';
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
// CONSTANTS — option arrays
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

// Accessory subtype labels — Title Case the lowercase storage values for display.
const titleCase = (s) =>
  String(s || '')
    .split(/[-\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

// Ethnicity is now SINGLE-select (owner-confirmed 2026-05-06) — was an
// array. Free-form `ethnicityNote` captures sub-categories that don't
// change appearance: "Italian", "Romanian", "British", "Irish" etc.
// `beardTreatment` is now SEPARATE from `hairTreatment` — owner: "Salt
// and pepper needs to be individual to beard and hair."
const SCALAR_KEYS = [
  'sex', 'ageDecade', 'ethnicity', 'skinTone', 'hairColor', 'hairLength',
  'hairTexture', 'hairTreatment', 'facialHair', 'beardColor',
  'beardTreatment', 'build', 'height',
];

const EMPTY_FILTERS = {
  sex: null,
  ageDecade: null,
  ethnicity: null,           // single-select string (was array)
  ethnicityNote: '',         // free-form sub-ethnicity ("Italian", "Romanian", etc.)
  build: null,
  height: null,
  skinTone: null,
  hairColor: null,
  hairLength: null,
  hairTexture: null,
  hairTreatment: null,
  facialHair: null,
  beardColor: null,
  beardTreatment: null,      // independent of hair (owner 2026-05-06)
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
  ethnicityNote: 'Heritage',
  skinTone: 'Skin tone',
  hairColor: 'Hair color',
  hairLength: 'Hair length',
  hairTexture: 'Hair texture',
  hairTreatment: 'Hair treatment',
  facialHair: 'Facial hair',
  beardColor: 'Beard color',
  beardTreatment: 'Beard treatment',
  build: 'Build',
  height: 'Height',
  accessory: 'Accessory',
};

// ===========================================================================
// CHIP — single primitive replacing PlainChip + SwatchChip + Pill
// ===========================================================================
//
// size:    'md' (filter chips, ≥44px tap target) | 'sm' (compact, ≥36px)
// shape:   'pill' (rounded-full — selection chips) | 'square' (rounded-md —
//                                                  decision pills inside
//                                                  the congruency panel)
// swatch:  optional hex; renders a 20px color disc inside the chip
//
// Active state:   bg-amber-500 text-gray-900 border-amber-500 font-semibold shadow-sm
// Inactive state: bg-slate-800 text-gray-200 border-slate-600
//                 hover:bg-slate-700 hover:border-slate-500
const Chip = ({ active, label, swatch = null, onClick, size = 'md', shape = 'pill', testId }) => {
  const sizing = size === 'sm'
    ? 'min-h-[36px] px-3 py-1.5 text-[11px]'
    : 'min-h-[44px] px-3 py-2 text-xs';
  const radius = shape === 'square' ? 'rounded-md' : 'rounded-full';
  const state = active
    ? 'bg-amber-500 text-gray-900 border-amber-500 font-semibold shadow-sm'
    : 'bg-slate-800 text-gray-200 border-slate-600 hover:bg-slate-700 hover:border-slate-500';
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={active}
      className={`inline-flex items-center justify-center gap-1.5 ${radius} ${sizing} border transition-colors ${state}`}
    >
      {swatch ? (
        <span
          aria-hidden="true"
          className="rounded-full inline-block shrink-0"
          style={{
            background: swatch,
            width: 20,
            height: 20,
            boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.85), 0 0 0 1px rgba(0,0,0,0.4)',
          }}
        />
      ) : null}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
};

// ===========================================================================
// LAYOUT primitives
// ===========================================================================

// Card section wrapper. p-3 (12px) and mb-4 (16px) per the spacing scale.
const Card = ({ children, className = '' }) => (
  <div className={`bg-slate-800/60 border border-slate-700 rounded-lg p-3 mb-4 ${className}`}>
    {children}
  </div>
);

// Card-level header — the loud label. amber-300 + uppercase + tracking-wider.
// Optional active-count badge at the right.
const CardHeader = ({ children, count = 0 }) => (
  <div className="flex items-center justify-between mb-2">
    <span className="text-[11px] uppercase tracking-wider text-amber-300 font-bold">
      {children}
    </span>
    {count > 0 ? (
      <span className="text-[9px] font-bold rounded-full px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300">
        {count}
      </span>
    ) : null}
  </div>
);

// Inner sub-row label (e.g. "Sex" / "Age" / "Color"). Quiet — gray-500.
// Same size as CardHeader (11px); contrast is via color, not size.
const SubLabel = ({ children }) => (
  <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-1 mt-2 first:mt-0">
    {children}
  </div>
);

// Chip row — gap-2 (8px) per the spacing scale.
const ChipRow = ({ children, className = '' }) => (
  <div className={`flex flex-wrap gap-2 mb-2 ${className}`}>{children}</div>
);

// ===========================================================================
// SwatchPalette — color-only selector, single row when palette fits
// ===========================================================================
//
// Replaces chip-with-label colors. Each option renders as a 32px circle of
// pure color. Selected swatch gets an amber ring + slight scale. The selected
// option's name shows below the row as "Selected: Color Name". Compact
// enough to keep palettes on a single row when possible (skin 7, hair 8);
// larger palettes (clothing 14) wrap to two rows.
//
// Input shape — array of { value, label, hex }. Caller normalizes from
// SKIN_TONES / HAIR_COLORS / CLOTHING_COLORS / HAIR_COLOR_INPUT_OPTIONS.
const SwatchPalette = ({ value, onChange, options, hideLabel = false }) => {
  const selected = options.find((o) => o.value === value);
  return (
    <div className="mb-2">
      <div className="flex flex-wrap gap-2 mb-1">
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value === value ? null : opt.value)}
              title={opt.label}
              aria-label={opt.label}
              aria-pressed={isActive}
              className={`shrink-0 rounded-full transition-all ${
                isActive
                  ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-800/60 scale-105'
                  : 'ring-1 ring-slate-600 hover:ring-slate-500'
              }`}
              style={{
                width: 32,
                height: 32,
                background: opt.hex,
                boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.25), inset 0 0 0 3px rgba(0,0,0,0.4)',
              }}
            />
          );
        })}
      </div>
      {!hideLabel ? (
        <div className="text-[11px] text-amber-300 font-semibold ml-1 min-h-[14px]">
          {selected ? `Selected: ${selected.label}` : <span className="text-gray-500 font-normal italic">Tap a color</span>}
        </div>
      ) : null}
    </div>
  );
};

// ===========================================================================
// AgeStepper — discrete-snap slider for age decade, drag-or-tap
// ===========================================================================
//
// Replaces the chip row for age. Click any position OR drag the thumb
// across the track — both gestures snap to the nearest decade. Owner
// observation 2026-05-06: "an intuitive thing someone might do is drag
// on the age slider."
const AgeStepper = ({ value, onChange }) => {
  const trackRef = React.useRef(null);
  const idx = value ? AGE_OPTIONS.indexOf(value) : -1;
  const active = idx >= 0;

  // Snap clientX to the nearest age bucket and emit it.
  const snapAndEmit = (clientX) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const snapped = Math.round(ratio * (AGE_OPTIONS.length - 1));
    const next = AGE_OPTIONS[snapped];
    if (next !== value) onChange(next);
  };

  // Pointer events — works for both mouse and touch on modern browsers.
  // setPointerCapture lets us keep receiving move events even if the
  // pointer leaves the track during a drag.
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    snapAndEmit(e.clientX);
  };
  const onPointerMove = (e) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    snapAndEmit(e.clientX);
  };
  const onPointerUp = (e) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className="mt-1 mb-2 px-2">
      {/* Track + dots — pointer events on the wrapper enable drag-to-set. */}
      <div
        ref={trackRef}
        className="relative h-9 cursor-pointer touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Background track */}
        <div className="absolute top-1/2 left-3 right-3 h-1.5 -translate-y-1/2 bg-slate-700 rounded-full pointer-events-none" />
        {/* Active fill */}
        {active ? (
          <div
            className="absolute top-1/2 left-3 h-1.5 -translate-y-1/2 bg-amber-500 rounded-full transition-all pointer-events-none"
            style={{ width: `calc((100% - 24px) * ${idx} / ${AGE_OPTIONS.length - 1})` }}
          />
        ) : null}
        {/* Position dots — visual only, the wrapper handles taps */}
        {AGE_OPTIONS.map((opt, i) => {
          const isActive = i === idx;
          const left = `calc(12px + (100% - 24px) * ${i} / ${AGE_OPTIONS.length - 1})`;
          return (
            <span
              key={opt}
              aria-label={`Age ${opt}`}
              aria-pressed={isActive}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
              style={{ left }}
            >
              <span
                className={`block rounded-full transition-all ${
                  isActive
                    ? 'w-6 h-6 bg-amber-500 ring-2 ring-amber-300 shadow-md'
                    : 'w-3 h-3 bg-slate-800 ring-2 ring-slate-600'
                }`}
              />
            </span>
          );
        })}
      </div>
      {/* Labels — also tappable */}
      <div className="flex justify-between mt-1 px-3">
        {AGE_OPTIONS.map((opt, i) => {
          const isActive = i === idx;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt === value ? null : opt)}
              className={`text-[11px] font-semibold transition-colors ${
                isActive ? 'text-amber-300' : 'text-gray-500 hover:text-gray-300'
              }`}
              style={{ minWidth: 32 }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Pre-normalized palette inputs for SwatchPalette.
const SKIN_PALETTE = SKIN_TONES.map((t) => ({
  value: t.id.replace(/^skin\./, ''),
  label: t.label,
  hex: t.hex,
}));
const HAIR_PALETTE = HAIR_COLOR_INPUT_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  hex: HAIR_HEX[o.value],
}));
const CLOTH_PALETTE = CLOTHING_COLORS.map((c) => ({
  value: c.id.replace(/^cloth\./, ''),
  label: c.label,
  hex: c.hex,
}));

// ===========================================================================
// HELPERS
// ===========================================================================

const playerEffective = (player) => ({
  sex: player.sex,
  ageDecade: player.ageDecade,
  // Ethnicity now scalar — pull first tag from the array shape stored on
  // the player record. Existing players store ethnicityTags as array;
  // we expose the first element as the canonical effective value.
  ethnicity: Array.isArray(player.ethnicityTags) && player.ethnicityTags.length > 0
    ? player.ethnicityTags[0]
    : null,
  ethnicityNote: player.ethnicityNote || '',
  skinTone: skinKeyForFilter(player),
  hairColor: player.hairColor,
  hairLength: player.hairLength,
  hairTexture: player.hairTexture,
  hairTreatment: player.hairSaltPepper === true ? 'salt-pepper' : (player.hairTreatment || null),
  facialHair: player.facialHair,
  beardColor: player.beardColor || player.hairColor || null,
  beardTreatment: player.beardSaltPepper === true ? 'salt-pepper' : (player.beardTreatment || null),
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

const countActiveInGroup = (filters, keys) =>
  keys.filter((k) => !!filters[k]).length;

const accessoryFilterCount = (filters) =>
  (filters.accessory.kind ? 1 : 0)
  + (filters.accessory.subtype ? 1 : 0)
  + (filters.accessory.color ? 1 : 0)
  + ((filters.accessory.note || '').trim() ? 1 : 0);

// ===========================================================================
// CONGRUENCY DIFF + PER-AXIS DECISIONS
// ===========================================================================

const computeCongruency = (filters, player) => {
  const eff = playerEffective(player);
  const items = [];

  // SCALAR_KEYS now includes 'ethnicity' (single-select) — handled by the
  // unified scalar loop, no special-case branch needed anymore.
  for (const axis of SCALAR_KEYS) {
    const fv = filters[axis];
    if (!fv) continue;
    const pv = eff[axis];
    if (!pv) {
      items.push({ axis, kind: 'addition', filterValue: fv, playerValue: null });
      continue;
    }
    if (fv.toString().toLowerCase() !== pv.toString().toLowerCase()) {
      items.push({ axis, kind: 'mismatch', filterValue: fv, playerValue: pv });
    }
  }

  // ethnicityNote — free-form heritage (Italian / Romanian / etc).
  // Surface as a diff so the owner can choose: keep player's existing note,
  // OR overwrite with their typed value, OR add when player has none.
  const noteFilter = (filters.ethnicityNote || '').trim();
  const notePlayer = (eff.ethnicityNote || '').trim();
  if (noteFilter && noteFilter.toLowerCase() !== notePlayer.toLowerCase()) {
    if (!notePlayer) {
      items.push({ axis: 'ethnicityNote', kind: 'addition', filterValue: noteFilter, playerValue: null });
    } else {
      items.push({ axis: 'ethnicityNote', kind: 'mismatch', filterValue: noteFilter, playerValue: notePlayer });
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
// CONGRUENCY PANEL — invariant slate shell, status via icon+title color only
// ===========================================================================

// Decision badge: +NEW (emerald, additive) vs DIFF (amber, conflict).
// Same shape, role-bound color. Resolves audit finding 5's badge half.
const DecisionBadge = ({ kind }) => {
  const isAddition = kind === 'addition';
  const palette = isAddition
    ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
    : 'text-amber-300 bg-amber-500/10 border-amber-500/30';
  return (
    <span className={`text-[9px] font-bold rounded px-2 py-0.5 border ${palette}`}>
      {isAddition ? '+ NEW' : 'DIFF'}
    </span>
  );
};

const DecisionRow = ({ item, decision, onPick }) => {
  const left = item.kind === 'mismatch'
    ? { id: 'filter', label: `Filter: ${formatValue(item.axis, item.filterValue)}` }
    : { id: 'add',    label: `Add: ${formatValue(item.axis, item.filterValue)}` };
  const right = item.kind === 'mismatch'
    ? { id: 'player', label: `Keep: ${formatValue(item.axis, item.playerValue)}` }
    : { id: 'skip',   label: 'Skip' };

  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">
          {FIELD_LABEL[item.axis] || item.axis}
        </span>
        <DecisionBadge kind={item.kind} />
      </div>
      <div className="flex gap-2">
        <Chip
          shape="square"
          size="sm"
          active={decision === left.id}
          label={left.label}
          onClick={() => onPick(left.id)}
        />
        <Chip
          shape="square"
          size="sm"
          active={decision === right.id}
          label={right.label}
          onClick={() => onPick(right.id)}
        />
      </div>
    </div>
  );
};

const CongruencyPanel = ({ player, items, decisions, onDecide, onCancel, onAssign, seat }) => {
  const allMatch = items.length === 0;

  const applyCount = items.reduce((n, item) => {
    const d = decisions[`${item.axis}-${item.kind}`];
    return n + ((d === 'filter' || d === 'add') ? 1 : 0);
  }, 0);

  return (
    <Card className="border-amber-500/50">
      <div className="flex items-center gap-2 mb-3">
        {allMatch ? (
          <>
            <Check size={16} className="text-emerald-300 shrink-0" />
            <span className="text-sm font-semibold text-emerald-300">
              Player matches all filters
            </span>
          </>
        ) : (
          <>
            <AlertTriangle size={16} className="text-amber-300 shrink-0" />
            <span className="text-sm font-semibold text-amber-300">
              {items.length} difference{items.length === 1 ? '' : 's'} — pick per axis
            </span>
          </>
        )}
      </div>

      {!allMatch ? (
        <div className="mb-3">
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
      ) : null}

      <div className={`grid ${allMatch ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
        {!allMatch ? (
          <button
            type="button"
            onClick={onCancel}
            className="bg-slate-700 hover:bg-slate-600 text-gray-200 text-sm font-semibold rounded-md min-h-[44px] px-3"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onAssign(applyCount)}
          className="bg-amber-500 hover:bg-amber-400 text-gray-900 text-sm font-semibold rounded-md min-h-[44px] px-3 shadow-sm"
        >
          {allMatch
            ? `Assign ${player.name || 'player'} → Seat ${seat}`
            : `Assign · apply ${applyCount}`}
        </button>
      </div>
    </Card>
  );
};

// ===========================================================================
// RESULT ROW — single highlight pattern
// ===========================================================================

const ResultRow = ({ player, onTap, matchedAccessories, isLoaded }) => {
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
      className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors min-h-[64px] ${
        isLoaded
          ? 'bg-amber-500/10 border-2 border-amber-500'
          : 'bg-slate-800 border border-slate-700 hover:bg-slate-700/60'
      }`}
    >
      <div className="shrink-0 rounded-full overflow-hidden bg-slate-900 border border-slate-600">
        <IdentityAvatar player={player} size={48} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-100 truncate">
          {head}
          {player.nickname ? <span className="ml-2 text-gray-400 text-xs">"{player.nickname}"</span> : null}
        </div>
        <div className="text-[11px] text-gray-300 capitalize truncate">{subtitle}</div>
        {matchedAccessories.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {matchedAccessories.map((acc) => {
              const headline = [acc.color, acc.subtype].filter(Boolean).join(' ') || acc.kind;
              return (
                <span
                  key={acc.accessoryId}
                  className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300"
                >
                  {headline}
                  {acc.note ? <span className="ml-1 italic">({acc.note})</span> : null}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="shrink-0 text-right text-[11px] text-gray-500 leading-tight">
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
  const [decisions, setDecisions] = useState({});
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
    || SCALAR_KEYS.some((k) => !!filters[k])
    || (filters.ethnicityNote && filters.ethnicityNote.trim())
    || accFilterActive
    || (filters.accessory.note && filters.accessory.note.trim());

  const tabBadges = {
    skin: filters.skinTone ? 1 : 0,
    hair: countActiveInGroup(filters, ['hairColor', 'hairLength', 'hairTexture', 'hairTreatment']),
    beard: countActiveInGroup(filters, ['facialHair', 'beardColor', 'beardTreatment']),
    accessory: accessoryFilterCount(filters),
  };

  // ---- Handlers ----
  const setScalar = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
  };
  // Single-select ethnicity. Tap an active chip to clear; tap a different
  // chip to switch. Was multi-select; owner-confirmed 2026-05-06 the visual
  // categories are mutually exclusive at the chip level (sub-ethnicities
  // like "Italian" / "Romanian" go in the free-text note below).
  const setEthnicity = (tag) => {
    setFilters((prev) => ({
      ...prev,
      ethnicity: prev.ethnicity === tag ? null : tag,
    }));
  };
  const setEthnicityNote = (note) => {
    setFilters((prev) => ({ ...prev, ethnicityNote: note }));
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
  const onAssign = () => {
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

  // Live builder avatar — synthetic player from filters when composing new;
  // the loaded record otherwise. Ethnicity is now single-select; pack it
  // into the array shape the avatar mapping expects.
  const livePlayer = activeRecord || {
    playerId: 'live-builder',
    sex: filters.sex,
    ageDecade: filters.ageDecade,
    ethnicityTags: filters.ethnicity ? [filters.ethnicity] : [],
    ethnicityNote: filters.ethnicityNote,
    skinTone: filters.skinTone,
    hairColor: filters.hairColor,
    hairLength: filters.hairLength,
    hairTexture: filters.hairTexture,
    hairSaltPepper: filters.hairTreatment === 'salt-pepper',
    facialHair: filters.facialHair,
    beardColor: filters.beardColor,
    // Beard treatment now independent of hair (owner 2026-05-06).
    // beardSaltPepper hands directly to AvatarRenderer's beardTreatment slot.
    beardSaltPepper: filters.beardTreatment === 'salt-pepper',
    build: filters.build,
    // Headwear / eyewear pull from the accessory filter for the live preview.
    // Hat color recoloring on the avatar is a follow-up (hat asset paths
    // currently use hardcoded fills — see hat.js — so changing accessory
    // color updates the data but not the rendered hat color yet).
    headwear: filters.accessory.kind === 'hat' ? filters.accessory.subtype : null,
    eyewear: filters.accessory.kind === 'glasses' ? filters.accessory.subtype : null,
  };

  // SCALAR_KEYS already counts every filter axis including ethnicity —
  // no double-count needed.
  const totalActiveCount =
    SCALAR_KEYS.filter((k) => !!filters[k]).length
    + (filters.ethnicityNote && filters.ethnicityNote.trim() ? 1 : 0)
    + accessoryFilterCount(filters);

  const builderStatus = activeRecord
    ? { line1: 'Viewing', line2: activeRecord.name || '(unnamed player)' }
    : totalActiveCount === 0
      ? { line1: 'Building', line2: 'pick features below' }
      : { line1: 'Building', line2: `${totalActiveCount} feature${totalActiveCount === 1 ? '' : 's'} set` };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="h-dvh w-full flex flex-col bg-slate-900 text-gray-100 overflow-hidden">
      {/* TOP BAR */}
      <div className="bg-slate-950 border-b border-slate-700 shrink-0">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            type="button"
            onClick={() => setCurrentScreen(SCREEN.SETTINGS)}
            className="flex items-center gap-2 text-sm font-semibold hover:bg-slate-800 px-2 py-1 rounded text-gray-200 min-h-[44px]"
          >
            <ChevronLeft size={20} />
            Back
          </button>
          <div className="text-base font-semibold text-gray-100 truncate mx-2">
            Pick for Seat {seat}
          </div>
          <button
            type="button"
            onClick={forceFresh}
            className="flex items-center gap-2 text-xs font-semibold text-amber-300 px-3 py-1 rounded-md border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 shrink-0 min-h-[44px]"
            title="Unregister SW + clear caches + reload"
          >
            <RefreshCw size={16} />
            Force fresh
          </button>
        </div>
        <div className="px-3 py-1 bg-amber-500/10 border-t border-amber-500/30 text-amber-300 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider uppercase">
            🧪 Prototype v8
          </span>
          <span className="text-[9px] font-mono text-amber-300/80">
            build {buildInfo.sha} · {buildInfo.built}
          </span>
        </div>
      </div>

      {/* BUILDER HEADER — outside scroll, always visible. Camera button
          overlaps the avatar (bottom-right) per the production
          PlayerProfileView photo-overlay convention. Owner 2026-05-06:
          "I don't see the camera option we used to have either." */}
      <div className="bg-slate-900 border-b border-slate-700 px-3 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0" style={{ width: 56, height: 56 }}>
            <div
              className={`rounded-full overflow-hidden border-2 transition-colors ${
                activeRecord ? 'border-amber-500' : (totalActiveCount > 0 ? 'border-amber-500/50' : 'border-slate-700')
              }`}
              style={{ width: 56, height: 56 }}
            >
              <IdentityAvatar player={livePlayer} size={56} />
            </div>
            <button
              type="button"
              onClick={() => alert('[prototype] Would open camera capture modal — multi-face crop, save photoBlobId atomically with the player record on assign.')}
              aria-label="Add photo"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 hover:bg-amber-400 text-gray-900 flex items-center justify-center shadow-md ring-2 ring-slate-900"
            >
              <Camera size={12} />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[11px] uppercase tracking-wider text-amber-300 font-bold">
                {builderStatus.line1}
              </span>
              <span className="text-sm font-semibold text-gray-100 truncate">
                {builderStatus.line2}
              </span>
            </div>
            <input
              type="text"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Name or nickname"
              className="w-full bg-slate-800 text-gray-100 text-xs placeholder:text-gray-500 rounded-md border border-slate-700 px-3 py-2 focus:border-amber-500 focus:outline-none min-h-[44px]"
            />
          </div>
        </div>
      </div>

      {/* SCROLL COLUMN */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4">
        {/* IDENTITY card — always visible primary axes */}
        <Card>
          <CardHeader count={
            (filters.sex ? 1 : 0)
            + (filters.ageDecade ? 1 : 0)
            + (filters.ethnicity ? 1 : 0)
            + (filters.ethnicityNote && filters.ethnicityNote.trim() ? 1 : 0)
          }>
            Identity
          </CardHeader>
          <SubLabel>Sex</SubLabel>
          <ChipRow>
            {SEX_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} active={filters.sex === o.value} onClick={() => setScalar('sex', o.value)} />
            ))}
          </ChipRow>
          <SubLabel>Age decade</SubLabel>
          <AgeStepper value={filters.ageDecade} onChange={(v) => setFilters((prev) => ({ ...prev, ageDecade: v }))} />
          <SubLabel>Ethnicity</SubLabel>
          <ChipRow>
            {ETHNICITY_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                active={filters.ethnicity === o.value}
                onClick={() => setEthnicity(o.value)}
              />
            ))}
          </ChipRow>
          {/* Free-form sub-ethnicity note. Captures Italian / Romanian /
              British / Irish — heritage labels that don't change appearance
              but help identification context. Not used for filter matching;
              just attached to the player on assign. */}
          <input
            type="text"
            value={filters.ethnicityNote}
            onChange={(e) => setEthnicityNote(e.target.value)}
            placeholder='Heritage note (e.g., "Italian", "Romanian", "Irish")'
            className="w-full bg-slate-800 text-gray-100 text-xs placeholder:text-gray-500 rounded-md border border-slate-700 px-3 py-2 focus:border-amber-500 focus:outline-none min-h-[44px] mb-0"
          />
        </Card>

        {/* BODY card */}
        <Card>
          <CardHeader count={(filters.build ? 1 : 0) + (filters.height ? 1 : 0)}>
            Body
          </CardHeader>
          <SubLabel>Build</SubLabel>
          <ChipRow>
            {BUILD_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} active={filters.build === o.value} onClick={() => setScalar('build', o.value)} />
            ))}
          </ChipRow>
          <SubLabel>Height</SubLabel>
          <ChipRow className="mb-0">
            {HEIGHT_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} active={filters.height === o.value} onClick={() => setScalar('height', o.value)} />
            ))}
          </ChipRow>
        </Card>

        {/* FEATURES card with tab strip */}
        <Card>
          <CardHeader count={tabBadges.skin + tabBadges.hair + tabBadges.beard + tabBadges.accessory}>
            Features
          </CardHeader>
          {/* Tab strip — no inner background; sits on the card with a
              border-b separator. Tabs read as nav, not nested container. */}
          <div className="flex gap-1 mb-3 border-b border-slate-700 -mx-1 px-1 pb-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-3 rounded-md text-sm font-semibold transition-colors min-h-[44px] ${
                  activeTab === t.id
                    ? 'bg-amber-500 text-gray-900 shadow-sm'
                    : 'text-gray-300 hover:bg-slate-800 hover:text-gray-100'
                }`}
              >
                <span>{t.label}</span>
                {tabBadges[t.id] > 0 ? (
                  <span className={`text-[9px] font-bold rounded-full px-2 py-0.5 ${
                    activeTab === t.id ? 'bg-gray-900 text-amber-300' : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                  }`}>
                    {tabBadges[t.id]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {activeTab === 'skin' ? (
            <div>
              <SubLabel>Skin tone</SubLabel>
              <SwatchPalette
                value={filters.skinTone}
                onChange={(v) => setFilters((prev) => ({ ...prev, skinTone: v }))}
                options={SKIN_PALETTE}
              />
            </div>
          ) : null}

          {activeTab === 'hair' ? (
            <div>
              <SubLabel>Color</SubLabel>
              <SwatchPalette
                value={filters.hairColor}
                onChange={(v) => setFilters((prev) => ({ ...prev, hairColor: v }))}
                options={HAIR_PALETTE}
              />
              <SubLabel>Length</SubLabel>
              <ChipRow>
                {HAIR_LENGTH_OPTIONS.map((opt) => (
                  <Chip key={opt.value} label={opt.label} active={filters.hairLength === opt.value} onClick={() => setScalar('hairLength', opt.value)} />
                ))}
              </ChipRow>
              <SubLabel>Texture</SubLabel>
              <ChipRow>
                {HAIR_TEXTURE_OPTIONS.map((opt) => (
                  <Chip key={opt.value} label={opt.label} active={filters.hairTexture === opt.value} onClick={() => setScalar('hairTexture', opt.value)} />
                ))}
              </ChipRow>
              <SubLabel>Treatment</SubLabel>
              <ChipRow className="mb-0">
                <Chip label="Salt & pepper" active={filters.hairTreatment === 'salt-pepper'} onClick={() => setScalar('hairTreatment', 'salt-pepper')} />
              </ChipRow>
            </div>
          ) : null}

          {/* Beard tab — Color FIRST (parity with Hair tab), then Style,
              then independent Treatment (salt-pepper). Owner 2026-05-06:
              "Salt and pepper needs to be individual to beard and hair." */}
          {activeTab === 'beard' ? (
            <div>
              <SubLabel>Color</SubLabel>
              <SwatchPalette
                value={filters.beardColor}
                onChange={(v) => setFilters((prev) => ({ ...prev, beardColor: v }))}
                options={HAIR_PALETTE}
              />
              <SubLabel>Style</SubLabel>
              <ChipRow>
                {FACIAL_HAIR_OPTIONS.map((opt) => (
                  <Chip key={opt.value} label={opt.label} active={filters.facialHair === opt.value} onClick={() => setScalar('facialHair', opt.value)} />
                ))}
              </ChipRow>
              <SubLabel>Treatment</SubLabel>
              <ChipRow className="mb-0">
                <Chip
                  label="Salt & pepper"
                  active={filters.beardTreatment === 'salt-pepper'}
                  onClick={() => setScalar('beardTreatment', 'salt-pepper')}
                />
              </ChipRow>
            </div>
          ) : null}

          {activeTab === 'accessory' ? (
            <div>
              <div className="text-[11px] text-amber-300/80 italic mb-2">
                Accessory match boosts results — never excludes. Glasses + headwear live here.
              </div>
              <SubLabel>Kind</SubLabel>
              <ChipRow>
                {ACCESSORY_KINDS.map((k) => (
                  <Chip
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
                      <Chip
                        key={sub}
                        label={titleCase(sub)}
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
                  <SwatchPalette
                    value={filters.accessory.color}
                    onChange={(v) => setAccessory({ color: v })}
                    options={CLOTH_PALETTE}
                  />
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
                    className="w-full bg-slate-800 text-gray-100 text-xs placeholder:text-gray-500 rounded-md border border-slate-700 px-3 py-2 focus:border-amber-500 focus:outline-none min-h-[44px]"
                  />
                </>
              ) : null}
            </div>
          ) : null}
        </Card>

        {/* ACTIVE-FILTER COUNT BAR */}
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="text-[11px] text-gray-300">
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
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">
            Results · {sortedResults.length}
          </span>
          {activeRecord ? (
            <button
              type="button"
              onClick={cancelLoaded}
              className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200 font-semibold"
            >
              <X size={12} />
              Clear loaded
            </button>
          ) : null}
        </div>
        <div className="space-y-2">
          {sortedResults.length === 0 ? (
            <div className="bg-slate-800/60 border border-dashed border-slate-700 rounded-lg p-3 text-center text-sm text-gray-500">
              No matches. Adjust a filter, or save as new player.
            </div>
          ) : (
            sortedResults.map(({ player, matchedAccessories }) => (
              <ResultRow
                key={player.playerId}
                player={player}
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
            className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-dashed border-amber-500/50 rounded-lg py-3 text-sm font-semibold flex items-center justify-center gap-2 min-h-[44px]"
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
