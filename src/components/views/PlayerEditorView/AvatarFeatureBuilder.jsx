/**
 * AvatarFeatureBuilder.jsx — Swatch-picker grid for avatar feature selection.
 *
 * Renders per-category rows:
 *   - Skin tone: color swatches from SKIN_TONES palette
 *   - Hair style + Hair color: small avatar previews + color dots
 *   - Beard style + Beard color: same pattern
 *   - Eyes style + Eye color
 *   - Glasses style (baked colors)
 *   - Hat style (baked colors)
 *
 * Contract:
 *   - Non-blocking (plan §D5): every category has a "None" option where
 *     meaningful; skin and eyes always have a default selection.
 *   - Tap-once-to-select (no dropdowns, no nested popovers on mobile).
 *   - Selected swatch gets a gold ring; tapping again is a no-op.
 */

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import PlayerAvatar from '../../ui/PlayerAvatar';
import AvatarRenderer from '../../ui/AvatarRenderer';
import {
  SKIN_TONES,
  HAIR_COLORS,
  EYE_COLORS,
  DEFAULT_AVATAR_FEATURES,
} from '../../../constants/avatarFeatureConstants';
import { AVATAR_FEATURES } from '../../../assets/avatarFeatures';

// -----------------------------------------------------------------------------
// Row-level building blocks
// -----------------------------------------------------------------------------

const SelectionRing = ({ selected, children, onClick, 'aria-label': ariaLabel, testId }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    aria-pressed={selected}
    data-testid={testId}
    className={
      'shrink-0 rounded-full p-0.5 transition-shadow ' +
      (selected
        ? 'ring-2 ring-amber-500 ring-offset-1 ring-offset-white'
        : 'ring-1 ring-transparent hover:ring-gray-300')
    }
  >
    {children}
  </button>
);

const ColorSwatchRow = ({ palette, selectedId, onSelect, category }) => (
  <div className="flex gap-2 overflow-x-auto py-1">
    {palette.map((c) => (
      <SelectionRing
        key={c.id}
        selected={selectedId === c.id}
        onClick={() => onSelect(c.id)}
        aria-label={c.label}
        testId={`swatch-${category}-${c.id}`}
      >
        <span
          className="block w-8 h-8 rounded-full border border-gray-300"
          style={{ backgroundColor: c.hex }}
        />
      </SelectionRing>
    ))}
  </div>
);

const FeatureShapeRow = ({ category, selectedId, onSelect, avatarFeatures }) => {
  // Render each feature as a mini AvatarRenderer where everything else is
  // neutral, so only this category's shape differs between swatches.
  const features = AVATAR_FEATURES[category] || [];
  const neutralOverlay = useMemo(() => ({
    ...DEFAULT_AVATAR_FEATURES,
    // Keep user-picked skin + colors so previews feel consistent with their
    // current avatar. Style fields are overridden per-swatch below.
    skin: avatarFeatures?.skin || DEFAULT_AVATAR_FEATURES.skin,
    hairColor: avatarFeatures?.hairColor || DEFAULT_AVATAR_FEATURES.hairColor,
    beardColor: avatarFeatures?.beardColor || DEFAULT_AVATAR_FEATURES.beardColor,
    eyeColor: avatarFeatures?.eyeColor || DEFAULT_AVATAR_FEATURES.eyeColor,
  }), [avatarFeatures]);

  return (
    <div className="flex gap-2 overflow-x-auto py-1">
      {features.map((feature) => (
        <SelectionRing
          key={feature.id}
          selected={selectedId === feature.id}
          onClick={() => onSelect(feature.id)}
          aria-label={feature.label}
          testId={`swatch-${category}-${feature.id}`}
        >
          <span className="block bg-gray-100 rounded-full overflow-hidden">
            <AvatarRenderer
              avatarFeatures={{ ...neutralOverlay, [category]: feature.id }}
              size={40}
              title={feature.label}
            />
          </span>
        </SelectionRing>
      ))}
    </div>
  );
};

const CategoryBlock = ({ label, children }) => (
  <section className="space-y-1.5">
    <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
      {label}
    </div>
    {children}
  </section>
);

// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

const SECONDARY_CATEGORIES = ['eyes', 'eyeColor', 'glasses', 'hat'];

const hasAnySecondarySelection = (features) => {
  if (!features) return false;
  if (features.glasses && !features.glasses.endsWith('.none')) return true;
  if (features.hat && !features.hat.endsWith('.none')) return true;
  if (features.eyes && features.eyes !== DEFAULT_AVATAR_FEATURES.eyes) return true;
  if (features.eyeColor && features.eyeColor !== DEFAULT_AVATAR_FEATURES.eyeColor) return true;
  return false;
};

export const AvatarFeatureBuilder = ({ avatarFeatures, onFeatureChange, previewName }) => {
  const features = avatarFeatures || {};
  const hairChosen = !!features.hair && features.hair !== 'hair.none';
  const beardChosen = !!features.beard && features.beard !== 'beard.none';

  // F8 + F9: secondary-detail rows (eyes/glasses/hat + their colors) collapse
  // by default to match PhysicalSection's density pattern. Auto-open if the
  // record already has meaningful selections in this group (edit-mode), so
  // existing data isn't hidden from the user.
  const [moreOpen, setMoreOpen] = useState(() => hasAnySecondarySelection(features));
  const MoreIcon = moreOpen ? ChevronDown : ChevronRight;

  return (
    <div className="bg-white border border-gray-200 rounded p-3 space-y-4" data-testid="avatar-feature-builder">
      {/* Live preview */}
      <div className="flex items-center gap-3">
        <div className="rounded-full overflow-hidden bg-gray-100 border border-gray-300 shrink-0">
          <PlayerAvatar
            player={{ name: previewName, avatarFeatures: features }}
            size={72}
            title={previewName || 'Avatar preview'}
          />
        </div>
        <div className="text-xs text-gray-600">
          Pick what stands out about this player.
          <br />
          <span className="text-gray-400">Nothing here is required.</span>
        </div>
      </div>

      <CategoryBlock label="Skin Tone">
        <ColorSwatchRow
          palette={SKIN_TONES}
          selectedId={features.skin}
          onSelect={(id) => onFeatureChange('skin', id)}
          category="skin"
        />
      </CategoryBlock>

      <CategoryBlock label="Hair Style">
        <FeatureShapeRow
          category="hair"
          selectedId={features.hair}
          onSelect={(id) => onFeatureChange('hair', id)}
          avatarFeatures={features}
        />
      </CategoryBlock>

      {hairChosen ? (
        <CategoryBlock label="Hair Color">
          <ColorSwatchRow
            palette={HAIR_COLORS}
            selectedId={features.hairColor}
            onSelect={(id) => onFeatureChange('hairColor', id)}
            category="hairColor"
          />
        </CategoryBlock>
      ) : null}

      <CategoryBlock label="Beard / Facial Hair">
        <FeatureShapeRow
          category="beard"
          selectedId={features.beard}
          onSelect={(id) => onFeatureChange('beard', id)}
          avatarFeatures={features}
        />
      </CategoryBlock>

      {beardChosen ? (
        <CategoryBlock label="Beard Color">
          <ColorSwatchRow
            palette={HAIR_COLORS}
            selectedId={features.beardColor}
            onSelect={(id) => onFeatureChange('beardColor', id)}
            category="beardColor"
          />
        </CategoryBlock>
      ) : null}

      {/* Secondary block — collapsible. Matches PhysicalSection pattern. */}
      <div className="border-t border-gray-100 pt-2">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-500 font-semibold hover:text-gray-700"
          data-testid="avatar-more-toggle"
        >
          <MoreIcon size={14} />
          More details (eyes, glasses, hat)
        </button>

        {moreOpen ? (
          <div className="mt-3 space-y-4">
            <CategoryBlock label="Eyes">
              <FeatureShapeRow
                category="eyes"
                selectedId={features.eyes}
                onSelect={(id) => onFeatureChange('eyes', id)}
                avatarFeatures={features}
              />
            </CategoryBlock>

            <CategoryBlock label="Eye Color">
              <ColorSwatchRow
                palette={EYE_COLORS}
                selectedId={features.eyeColor}
                onSelect={(id) => onFeatureChange('eyeColor', id)}
                category="eyeColor"
              />
            </CategoryBlock>

            <CategoryBlock label="Glasses">
              <FeatureShapeRow
                category="glasses"
                selectedId={features.glasses}
                onSelect={(id) => onFeatureChange('glasses', id)}
                avatarFeatures={features}
              />
            </CategoryBlock>

            <CategoryBlock label="Hat">
              <FeatureShapeRow
                category="hat"
                selectedId={features.hat}
                onSelect={(id) => onFeatureChange('hat', id)}
                avatarFeatures={features}
              />
            </CategoryBlock>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// Exported for tests.
export const __INTERNAL__ = { SECONDARY_CATEGORIES, hasAnySecondarySelection };

export default AvatarFeatureBuilder;
