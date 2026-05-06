/**
 * @file IdentificationFields — chip-row block for identification axes.
 *
 * Single source of truth for the picker filter chips AND the editor field
 * sections. Per `feedback_picker_editor_field_parity.md`: the picker and
 * editor are not different feature sets — they are the SAME identification
 * model presented from two angles (lookup vs capture). One component, one
 * field set, one set of chip definitions; behavior bends via the `mode`
 * prop only.
 *
 * State shape contract — filter shape (the canonical UI shape produced by
 * `usePlayerFinder`):
 *   {
 *     sex, ageDecade, ethnicity, ethnicityNote, build, height,
 *     skinTone,
 *     hairColor, hairLength, hairTexture, hairTreatment,
 *     facialHair, beardColor, beardTreatment,
 *     accessory: { kind, subtype, color, note }
 *   }
 *
 * In `mode='edit'`, the calling view is responsible for projecting an
 * existing player record into filter shape on hydration, and translating
 * filter shape back into the player record shape on save (e.g.,
 * `accessory` → `accessoryInventory` upsert; `hairTreatment === 'salt-pepper'`
 * → `hairSaltPepper: true`). The chip rows themselves are mode-agnostic.
 *
 * Props:
 *   - filters       : current filter-shape values
 *   - setScalar     : (key, value) => void
 *   - setEthnicity  : (tag) => void
 *   - setEthnicityNote : (note) => void
 *   - setAccessory  : (patch) => void
 *   - activeTab     : 'skin' | 'hair' | 'beard' | 'accessory'
 *   - setActiveTab  : (tab) => void
 *   - tabBadges     : { skin, hair, beard, accessory } (counts)
 *   - mode          : 'filter' (default) | 'edit'.
 *                     mode='filter' shows the accessory positive-boost hint;
 *                     mode='edit' is currently visually identical (the
 *                     translation lives in the calling view's save handler).
 */

import React from 'react';
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
import { Chip } from '../../ui/Chip';
import { Card, CardHeader, SubLabel, ChipRow } from '../../ui/Card';
import { SwatchPalette } from '../../ui/SwatchPalette';
import { AgeStepper } from '../../ui/AgeStepper';

// ===========================================================================
// CONSTANT OPTIONS — local to this surface
// ===========================================================================

const SEX_OPTIONS = [
  { value: 'male', label: 'M' },
  { value: 'female', label: 'F' },
  { value: 'other', label: 'Other' },
];

// Ethnicity scalar select. Single-select (was multi); sub-categories like
// "Italian" / "Romanian" go into the free-text heritage note below.
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

// Pre-normalized swatch palettes for the SwatchPalette primitive.
const HAIR_HEX = Object.fromEntries(HAIR_COLORS.map((c) => [c.id.replace(/^color\./, ''), c.hex]));
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

const titleCase = (s) =>
  String(s || '')
    .split(/[-\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

const TABS = [
  { id: 'skin',      label: 'Skin' },
  { id: 'hair',      label: 'Hair' },
  { id: 'beard',     label: 'Beard' },
  { id: 'accessory', label: 'Accessory' },
];

// ===========================================================================
// COMPONENT
// ===========================================================================

export const IdentificationFields = ({
  filters,
  setScalar,
  setEthnicity,
  setEthnicityNote,
  setAccessory,
  activeTab,
  setActiveTab,
  tabBadges,
  mode = 'filter',
}) => {
  const accKindEntry = ACCESSORY_KINDS.find((k) => k.kind === filters.accessory.kind);
  const subtypes = accKindEntry?.subtypes || [];

  return (
    <>
      {/* IDENTITY card — sex, age, ethnicity, heritage note */}
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
            <Chip
              key={o.value}
              label={o.label}
              active={filters.sex === o.value}
              onClick={() => setScalar('sex', o.value)}
            />
          ))}
        </ChipRow>
        <SubLabel>Age decade</SubLabel>
        <AgeStepper
          value={filters.ageDecade}
          onChange={(v) => setScalar('ageDecade', v === filters.ageDecade ? null : v)}
        />
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
        <input
          type="text"
          value={filters.ethnicityNote || ''}
          onChange={(e) => setEthnicityNote(e.target.value)}
          placeholder='Heritage note (e.g., "Italian", "Romanian", "Irish")'
          className="w-full bg-slate-800 text-gray-100 text-xs placeholder:text-gray-500 rounded-md border border-slate-700 px-3 py-2 focus:border-amber-500 focus:outline-none min-h-[44px] mb-0"
        />
      </Card>

      {/* BODY card — build + height */}
      <Card>
        <CardHeader count={(filters.build ? 1 : 0) + (filters.height ? 1 : 0)}>
          Body
        </CardHeader>
        <SubLabel>Build</SubLabel>
        <ChipRow>
          {BUILD_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              active={filters.build === o.value}
              onClick={() => setScalar('build', o.value)}
            />
          ))}
        </ChipRow>
        <SubLabel>Height</SubLabel>
        <ChipRow className="mb-0">
          {HEIGHT_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              active={filters.height === o.value}
              onClick={() => setScalar('height', o.value)}
            />
          ))}
        </ChipRow>
      </Card>

      {/* FEATURES card — tabbed (skin / hair / beard / accessory) */}
      <Card>
        <CardHeader count={tabBadges.skin + tabBadges.hair + tabBadges.beard + tabBadges.accessory}>
          Features
        </CardHeader>
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
              onChange={(v) => setScalar('skinTone', v === filters.skinTone ? null : v)}
              options={SKIN_PALETTE}
            />
          </div>
        ) : null}

        {activeTab === 'hair' ? (
          <div>
            <SubLabel>Color</SubLabel>
            <SwatchPalette
              value={filters.hairColor}
              onChange={(v) => setScalar('hairColor', v === filters.hairColor ? null : v)}
              options={HAIR_PALETTE}
            />
            <SubLabel>Length</SubLabel>
            <ChipRow>
              {HAIR_LENGTH_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  active={filters.hairLength === opt.value}
                  onClick={() => setScalar('hairLength', opt.value)}
                />
              ))}
            </ChipRow>
            <SubLabel>Texture</SubLabel>
            <ChipRow>
              {HAIR_TEXTURE_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  active={filters.hairTexture === opt.value}
                  onClick={() => setScalar('hairTexture', opt.value)}
                />
              ))}
            </ChipRow>
            <SubLabel>Treatment</SubLabel>
            <ChipRow className="mb-0">
              <Chip
                label="Salt & pepper"
                active={filters.hairTreatment === 'salt-pepper'}
                onClick={() => setScalar('hairTreatment', 'salt-pepper')}
              />
            </ChipRow>
          </div>
        ) : null}

        {activeTab === 'beard' ? (
          <div>
            <SubLabel>Color</SubLabel>
            <SwatchPalette
              value={filters.beardColor}
              onChange={(v) => setScalar('beardColor', v === filters.beardColor ? null : v)}
              options={HAIR_PALETTE}
            />
            <SubLabel>Style</SubLabel>
            <ChipRow>
              {FACIAL_HAIR_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  active={filters.facialHair === opt.value}
                  onClick={() => setScalar('facialHair', opt.value)}
                />
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
            {mode === 'filter' ? (
              <div className="text-[11px] text-amber-300/80 italic mb-2">
                Accessory match boosts results — never excludes. Glasses + headwear live here.
              </div>
            ) : null}
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
            {filters.accessory.kind && subtypes.length > 0 ? (
              <>
                <SubLabel>Subtype</SubLabel>
                <ChipRow>
                  {subtypes.map((sub) => (
                    <Chip
                      key={sub}
                      label={titleCase(sub)}
                      size="sm"
                      active={filters.accessory.subtype === sub}
                      onClick={() => setAccessory({
                        subtype: filters.accessory.subtype === sub ? null : sub,
                      })}
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
                  onChange={(v) => setAccessory({
                    color: v === filters.accessory.color ? null : v,
                  })}
                  options={CLOTH_PALETTE}
                />
              </>
            ) : null}
            {filters.accessory.kind ? (
              <>
                <SubLabel>Note</SubLabel>
                <input
                  type="text"
                  value={filters.accessory.note || ''}
                  onChange={(e) => setAccessory({ note: e.target.value })}
                  placeholder={filters.accessory.kind === 'other' ? 'free-text descriptor' : 'e.g. "KC Royals", "WSOP"'}
                  className="w-full bg-slate-800 text-gray-100 text-xs placeholder:text-gray-500 rounded-md border border-slate-700 px-3 py-2 focus:border-amber-500 focus:outline-none min-h-[44px]"
                />
              </>
            ) : null}
          </div>
        ) : null}
      </Card>
    </>
  );
};

export default IdentificationFields;
