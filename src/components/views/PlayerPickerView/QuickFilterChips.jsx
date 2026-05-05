/**
 * @file QuickFilterChips — full identification-axis filter panel.
 *
 * Per feedback_picker_editor_field_parity.md: every editor identification
 * field must have a corresponding picker filter row. Sex / Ethnicity / Age
 * are always visible (highest discrimination, smallest size). The remaining
 * axes — skin / hair / beard / build / eyewear / headwear — sit behind a
 * collapsible "More filters" toggle so the default picker view stays compact.
 *
 * All matching is permissive: a player with NULL on a filtered axis is NOT
 * excluded (uncertain ≠ negative match). See `usePlayerPicker.matchesQuickFilter`.
 *
 * Owner workflow: at the table, sex/ethnicity/age get most players narrowed
 * to a few candidates; expanding "More filters" lets the user pick on the
 * actually-visible features (skin tone, hair color, beard, etc.) to confirm.
 */

import React, { useState } from 'react';
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

export const SEX_OPTIONS = [
  { value: 'male', label: 'M' },
  { value: 'female', label: 'F' },
  { value: 'other', label: 'Other' },
];

export const AGE_OPTIONS = ['<20', '20s', '30s', '40s', '50s', '60s+'];

export const ETHNICITY_OPTIONS = [
  { value: 'caucasian',       label: 'White/Caucasian' },
  { value: 'hispanic',        label: 'Hispanic' },
  { value: 'east-asian',      label: 'East Asian' },
  { value: 'south-asian',     label: 'South Asian' },
  { value: 'black',           label: 'Black' },
  { value: 'middle-eastern',  label: 'Middle Eastern' },
];

const HAIR_HEX_BY_KEY = Object.fromEntries(
  HAIR_COLORS.map((c) => [c.id.replace(/^color\./, ''), c.hex]),
);
const FRAME_HEX_BY_KEY = Object.fromEntries(
  EYEWEAR_COLORS.map((c) => [c.id.replace(/^frame\./, ''), c.hex]),
);
// Accessory kind options (must match AccessoryInventorySection.ACCESSORY_KINDS).
export const ACCESSORY_KIND_OPTIONS = [
  { value: 'hat',     label: 'Hat' },
  { value: 'top',     label: 'Top' },
  { value: 'bottom',  label: 'Bottom' },
  { value: 'jewelry', label: 'Jewelry' },
];

const FRAME_COLOR_OPTIONS = [
  { value: 'black',         label: 'Black' },
  { value: 'brown',         label: 'Brown' },
  { value: 'tortoiseshell', label: 'Tortoise' },
  { value: 'gold',          label: 'Gold' },
  { value: 'silver',        label: 'Silver' },
  { value: 'red',           label: 'Red' },
  { value: 'blue',          label: 'Blue' },
];

// --- Sub-components --------------------------------------------------------

const Row = ({ label, children }) => (
  <div className="flex items-start gap-2 mb-1.5">
    <div className="text-[10px] uppercase tracking-wide text-gray-500 w-20 shrink-0 pt-1.5">
      {label}
    </div>
    <div className="flex flex-wrap gap-1 items-center">{children}</div>
  </div>
);

const PlainChip = ({ label, active, onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
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

const SwatchChip = ({ label, hex, active, onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs transition-colors ${
      active
        ? 'bg-amber-500 text-gray-900 border border-amber-600 font-semibold'
        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
    }`}
    data-testid={testId}
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
      aria-hidden="true"
    />
    <span className="whitespace-nowrap">{label}</span>
  </button>
);

const SubRow = ({ label, children }) => (
  <div className="mb-2">
    <div className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">{label}</div>
    <div className="flex flex-wrap gap-1 items-center">{children}</div>
  </div>
);

// --- Main component --------------------------------------------------------

export const QuickFilterChips = ({
  quickFilter,
  onSet,                // (key, value) — sets a scalar field; same arg toggles off
  onEthnicityToggle,    // (tag) — toggles in/out of the array
  onClearAll,
}) => {
  const [expanded, setExpanded] = useState(false);

  const sex = quickFilter.sex || null;
  const ethArr = Array.isArray(quickFilter.ethnicity) ? quickFilter.ethnicity : [];
  const age = quickFilter.ageDecade || null;
  const skin = (quickFilter.skinTone || '').toLowerCase();
  const hairColor = (quickFilter.hairColor || '').toLowerCase();
  const hairLength = (quickFilter.hairLength || '').toLowerCase();
  const hairTexture = (quickFilter.hairTexture || '').toLowerCase();
  const facialHair = (quickFilter.facialHair || '').toLowerCase();
  const beardColor = (quickFilter.beardColor || '').toLowerCase();
  const build = (quickFilter.build || '').toLowerCase();
  const eyewear = (quickFilter.eyewear || '').toLowerCase();
  const eyewearColor = (quickFilter.eyewearColor || '').toLowerCase();
  const headwear = (quickFilter.headwear || '').toLowerCase();
  const accessoryKind = (quickFilter.accessoryKind || '').toLowerCase();
  const accessoryColor = (quickFilter.accessoryColor || '').toLowerCase();

  const hasAny =
    !!sex || ethArr.length > 0 || !!age ||
    !!skin || !!hairColor || !!hairLength || !!hairTexture ||
    !!facialHair || !!beardColor || !!build ||
    !!eyewear || !!eyewearColor || !!headwear ||
    !!accessoryKind || !!accessoryColor;

  // Toggle helper: if the value is already selected, clearing returns null.
  const toggleScalar = (key, current, value) => {
    onSet(key, current === value ? null : value);
  };

  return (
    <div data-testid="quick-filter-chips">
      {/* Always-visible: highest-discrimination axes. */}
      <Row label="Sex">
        {SEX_OPTIONS.map((o) => (
          <PlainChip
            key={o.value}
            label={o.label}
            active={sex === o.value}
            onClick={() => toggleScalar('sex', sex, o.value)}
            testId={`quick-filter-sex-${o.value}`}
          />
        ))}
      </Row>

      <Row label="Ethnicity">
        {ETHNICITY_OPTIONS.map((o) => (
          <PlainChip
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
          <PlainChip
            key={o}
            label={o}
            active={age === o}
            onClick={() => toggleScalar('ageDecade', age, o)}
            testId={`quick-filter-age-${o}`}
          />
        ))}
      </Row>

      {/* Toggle for the rest. */}
      <div className="flex items-center justify-between mt-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-gray-700 hover:text-gray-900 underline"
          data-testid="quick-filter-more-toggle"
          aria-expanded={expanded}
        >
          {expanded ? '− Hide filters' : '+ More filters'}
        </button>
        {hasAny ? (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-gray-500 hover:text-gray-800 underline"
            data-testid="quick-filter-clear-all"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div
          className="mt-2 pt-2 border-t border-gray-200 max-h-[40vh] overflow-y-auto"
          data-testid="quick-filter-more"
        >
          {/* Accessory filter — POSITIVE BOOST ONLY. Matching players float
              to top, non-matchers still appear (could just not be wearing
              that accessory today). Users can filter on kind, color, or both. */}
          <div className="bg-amber-50/40 border border-amber-200/60 rounded-md p-2 mb-3">
            <div className="text-amber-800 text-[11px] font-semibold uppercase tracking-wide mb-1">
              Accessory (boost match — never excludes)
            </div>
            <SubRow label="Kind">
              {ACCESSORY_KIND_OPTIONS.map((opt) => (
                <PlainChip
                  key={opt.value}
                  label={opt.label}
                  active={accessoryKind === opt.value}
                  onClick={() => toggleScalar('accessoryKind', accessoryKind, opt.value)}
                  testId={`quick-filter-accessory-kind-${opt.value}`}
                />
              ))}
            </SubRow>
            <SubRow label="Color">
              {CLOTHING_COLORS.map((c) => {
                const key = c.id.replace(/^cloth\./, '');
                return (
                  <SwatchChip
                    key={c.id}
                    label={c.label}
                    hex={c.hex}
                    active={accessoryColor === key}
                    onClick={() => toggleScalar('accessoryColor', accessoryColor, key)}
                    testId={`quick-filter-accessory-color-${key}`}
                  />
                );
              })}
            </SubRow>
          </div>

          <SubRow label="Skin tone">
            {SKIN_TONES.map((t) => {
              const key = t.id.replace(/^skin\./, '');
              return (
                <SwatchChip
                  key={t.id}
                  label={t.label}
                  hex={t.hex}
                  active={skin === key}
                  onClick={() => toggleScalar('skinTone', skin, key)}
                  testId={`quick-filter-skin-${key}`}
                />
              );
            })}
          </SubRow>

          <SubRow label="Hair color">
            {HAIR_COLOR_INPUT_OPTIONS.map((opt) => (
              <SwatchChip
                key={opt.value}
                label={opt.label}
                hex={HAIR_HEX_BY_KEY[opt.value]}
                active={hairColor === opt.value}
                onClick={() => toggleScalar('hairColor', hairColor, opt.value)}
                testId={`quick-filter-hair-color-${opt.value}`}
              />
            ))}
          </SubRow>

          <SubRow label="Hair length">
            {HAIR_LENGTH_OPTIONS.map((opt) => (
              <PlainChip
                key={opt.value}
                label={opt.label}
                active={hairLength === opt.value}
                onClick={() => toggleScalar('hairLength', hairLength, opt.value)}
                testId={`quick-filter-hair-length-${opt.value}`}
              />
            ))}
          </SubRow>

          <SubRow label="Hair texture">
            {HAIR_TEXTURE_OPTIONS.map((opt) => (
              <PlainChip
                key={opt.value}
                label={opt.label}
                active={hairTexture === opt.value}
                onClick={() => toggleScalar('hairTexture', hairTexture, opt.value)}
                testId={`quick-filter-hair-texture-${opt.value}`}
              />
            ))}
          </SubRow>

          <SubRow label="Facial hair">
            {FACIAL_HAIR_OPTIONS.map((opt) => (
              <PlainChip
                key={opt.value}
                label={opt.label}
                active={facialHair === opt.value}
                onClick={() => toggleScalar('facialHair', facialHair, opt.value)}
                testId={`quick-filter-facial-${opt.value}`}
              />
            ))}
          </SubRow>

          <SubRow label="Beard color">
            {HAIR_COLOR_INPUT_OPTIONS.map((opt) => (
              <SwatchChip
                key={opt.value}
                label={opt.label}
                hex={HAIR_HEX_BY_KEY[opt.value]}
                active={beardColor === opt.value}
                onClick={() => toggleScalar('beardColor', beardColor, opt.value)}
                testId={`quick-filter-beard-color-${opt.value}`}
              />
            ))}
          </SubRow>

          <SubRow label="Build">
            {BUILD_OPTIONS.map((opt) => (
              <PlainChip
                key={opt}
                label={opt}
                active={build === opt}
                onClick={() => toggleScalar('build', build, opt)}
                testId={`quick-filter-build-${opt}`}
              />
            ))}
          </SubRow>

          <SubRow label="Eyewear">
            {EYEWEAR_OPTIONS.map((opt) => (
              <PlainChip
                key={opt.value}
                label={opt.label}
                active={eyewear === opt.value}
                onClick={() => toggleScalar('eyewear', eyewear, opt.value)}
                testId={`quick-filter-eyewear-${opt.value}`}
              />
            ))}
          </SubRow>

          <SubRow label="Frame color">
            {FRAME_COLOR_OPTIONS.map((opt) => (
              <SwatchChip
                key={opt.value}
                label={opt.label}
                hex={FRAME_HEX_BY_KEY[opt.value]}
                active={eyewearColor === opt.value}
                onClick={() => toggleScalar('eyewearColor', eyewearColor, opt.value)}
                testId={`quick-filter-frame-${opt.value}`}
              />
            ))}
          </SubRow>

          <SubRow label="Headwear">
            {HEADWEAR_OPTIONS.map((opt) => (
              <PlainChip
                key={opt.value}
                label={opt.label}
                active={headwear === opt.value}
                onClick={() => toggleScalar('headwear', headwear, opt.value)}
                testId={`quick-filter-headwear-${opt.value}`}
              />
            ))}
          </SubRow>
        </div>
      ) : null}
    </div>
  );
};

export default QuickFilterChips;
