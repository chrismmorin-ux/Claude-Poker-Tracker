/**
 * AvatarRenderer.jsx — SVG feature-avatar composer (PEO-1)
 *
 * Renders a layered SVG portrait from an `avatarFeatures` object.
 * Layer composition order is declarative (LAYER_ORDER from constants).
 * Colors are applied via CSS custom properties on the root <svg> so each
 * feature's paths can reference var(--skin) / var(--hair) / etc. once.
 *
 * Usage:
 *   <AvatarRenderer avatarFeatures={player.avatarFeatures} size={48} />
 *
 * Contract:
 *   - If avatarFeatures is null/undefined → renders fully-defaulted avatar.
 *   - If a category's selected feature id is missing → falls back to
 *     `<category>.none` (empty layer).
 *   - Render is branch-free in the path dimension: every layer always iterates
 *     its feature's paths, which may be an empty array.
 */

import React, { useMemo } from 'react';
import {
  LAYER_ORDER,
  LAYER_TO_COLOR_VAR,
  DEFAULT_AVATAR_FEATURES,
  AVATAR_VIEWBOX,
  getSkinTone,
  getHairColor,
  getEyeColor,
} from '../../constants/avatarFeatureConstants';
import { getFeatureById } from '../../assets/avatarFeatures';

// Per-category fallback feature IDs when avatarFeatures[category] is missing or
// points to a non-registered id. Skin is always the face shape (tone is a color
// selection, not a feature). Eyes always render a real shape (no "none").
// Hair/beard/glasses/hat have explicit "<category>.none" entries.
const CATEGORY_FALLBACK_ID = {
  skin: 'skin.shape',
  hair: 'hair.none',
  beard: 'beard.none',
  eyes: 'eyes.round',
  glasses: 'glasses.none',
  hat: 'hat.none',
};

/**
 * Resolve the feature for a category from the avatarFeatures object.
 *
 * - `skin` is always the singleton face shape; avatarFeatures.skin stores a
 *   tone color id (consumed by buildColorVars), not a feature id.
 * - Other categories resolve their feature id from avatarFeatures[category],
 *   falling through to CATEGORY_FALLBACK_ID on missing/unknown.
 */
const resolveCategoryFeature = (category, avatarFeatures) => {
  if (category === 'skin') {
    return getFeatureById('skin.shape') || { id: 'skin.shape', paths: [] };
  }
  const requestedId = avatarFeatures?.[category];
  if (requestedId) {
    const feature = getFeatureById(requestedId);
    if (feature) return feature;
  }
  const fallbackId = CATEGORY_FALLBACK_ID[category];
  return getFeatureById(fallbackId) || { id: fallbackId, paths: [] };
};

/**
 * Build the CSS custom property map for color vars used by feature paths.
 * Guards against unknown color ids by falling through to defaults.
 */
const buildColorVars = (avatarFeatures) => {
  const skinId = avatarFeatures?.skin || DEFAULT_AVATAR_FEATURES.skin;
  const hairColorId = avatarFeatures?.hairColor || DEFAULT_AVATAR_FEATURES.hairColor;
  const beardColorId = avatarFeatures?.beardColor || DEFAULT_AVATAR_FEATURES.beardColor;
  const eyeColorId = avatarFeatures?.eyeColor || DEFAULT_AVATAR_FEATURES.eyeColor;
  return {
    '--skin': getSkinTone(skinId).hex,
    '--hair': getHairColor(hairColorId).hex,
    '--beard': getHairColor(beardColorId).hex,
    '--eye': getEyeColor(eyeColorId).hex,
  };
};

/**
 * Render the <path> elements of a feature, applying optional stroke metadata.
 */
const FeaturePaths = ({ feature }) => {
  if (!feature?.paths?.length) return null;
  return feature.paths.map((p, i) => (
    <path
      key={i}
      d={p.d}
      fill={p.fill ?? 'currentColor'}
      fillOpacity={p.fillOpacity ?? undefined}
      stroke={p.stroke ?? undefined}
      strokeWidth={p.strokeWidth ?? undefined}
      strokeLinecap={p.strokeLinecap ?? undefined}
      strokeLinejoin={p.strokeLinejoin ?? undefined}
    />
  ));
};

const AvatarRenderer = ({ avatarFeatures, size = 48, className = '', title }) => {
  const colorStyle = useMemo(() => buildColorVars(avatarFeatures), [avatarFeatures]);

  const layers = useMemo(
    () => LAYER_ORDER.map((category) => ({
      category,
      feature: resolveCategoryFeature(category, avatarFeatures),
    })),
    [avatarFeatures],
  );

  return (
    <svg
      viewBox={AVATAR_VIEWBOX}
      width={size}
      height={size}
      role="img"
      aria-label={title || 'Player avatar'}
      className={className}
      style={colorStyle}
    >
      {title ? <title>{title}</title> : null}
      {layers.map(({ category, feature }) => (
        <g key={category} data-layer={category} data-feature-id={feature.id}>
          <FeaturePaths feature={feature} />
        </g>
      ))}
    </svg>
  );
};

// Exported for testing; intentionally module-internal otherwise.
export { resolveCategoryFeature, buildColorVars, CATEGORY_FALLBACK_ID, LAYER_TO_COLOR_VAR };

export default AvatarRenderer;
