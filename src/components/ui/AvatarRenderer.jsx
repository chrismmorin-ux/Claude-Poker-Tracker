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

import React, { useMemo, useId } from 'react';
import {
  LAYER_ORDER,
  LAYER_TO_COLOR_VAR,
  DEFAULT_AVATAR_FEATURES,
  AVATAR_VIEWBOX,
  AVATAR_VIEWBOX_SIZE,
  getSkinTone,
  getHairColor,
  getEyeColor,
  getEyewearColor,
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
 * - `skin` is the silhouette layer. As of Phase 1.6, prefers the per-sex/build
 *   variant indicated by `avatarFeatures.silhouette` (e.g., 'silhouette.male-
 *   muscular'). Falls back to the legacy 'skin.shape' singleton when silhouette
 *   is absent (older records). avatarFeatures.skin stores the TONE color id
 *   (consumed by buildColorVars) — orthogonal to the silhouette shape.
 * - Other categories resolve their feature id from avatarFeatures[category],
 *   falling through to CATEGORY_FALLBACK_ID on missing/unknown.
 */
const resolveCategoryFeature = (category, avatarFeatures) => {
  if (category === 'skin') {
    const silhouetteId = avatarFeatures?.silhouette;
    if (silhouetteId) {
      const feature = getFeatureById(silhouetteId);
      if (feature) return feature;
    }
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
  const frameColorId = avatarFeatures?.eyewearColor || DEFAULT_AVATAR_FEATURES.eyewearColor;
  return {
    '--skin': getSkinTone(skinId).hex,
    '--hair': getHairColor(hairColorId).hex,
    '--beard': getHairColor(beardColorId).hex,
    '--eye': getEyeColor(eyeColorId).hex,
    '--frame': getEyewearColor(frameColorId).hex,
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

// Y-coordinate below which hair is allowed to render when a hat is present.
// Hat brim line varies from y=32 (beanie/cowboy/fedora) to y=38 (cap/visor).
// Use y=38 so all hats fully cover the crown — strictest clip line.
const HAIR_CLIP_Y_WHEN_HATTED = 38;

const AvatarRenderer = ({ avatarFeatures, size = 48, className = '', title }) => {
  const colorStyle = useMemo(() => buildColorVars(avatarFeatures), [avatarFeatures]);
  const uniqueId = useId();
  const hairClipId = `hair-clip-${uniqueId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const layers = useMemo(
    () => LAYER_ORDER.map((category) => ({
      category,
      feature: resolveCategoryFeature(category, avatarFeatures),
    })),
    [avatarFeatures],
  );

  // Detect whether a hat is being rendered (any non-empty hat layer). When
  // present, the hair group is clipped so hair below the hat brim line
  // remains visible (sideburns, ear-line) but hair above is hidden — hair
  // can't poke through the hat.
  const hatLayer = layers.find((l) => l.category === 'hat');
  const hasHat = !!hatLayer?.feature?.paths?.length;

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
      {hasHat ? (
        <defs>
          <clipPath id={hairClipId}>
            <rect
              x={0}
              y={HAIR_CLIP_Y_WHEN_HATTED}
              width={AVATAR_VIEWBOX_SIZE}
              height={AVATAR_VIEWBOX_SIZE - HAIR_CLIP_Y_WHEN_HATTED}
            />
          </clipPath>
        </defs>
      ) : null}
      {layers.map(({ category, feature }) => {
        const isHair = category === 'hair';
        const groupProps = {
          'data-layer': category,
          'data-feature-id': feature.id,
        };
        if (isHair && hasHat) {
          groupProps.clipPath = `url(#${hairClipId})`;
          groupProps['data-hair-clipped'] = 'true';
        }
        return (
          <g key={category} {...groupProps}>
            <FeaturePaths feature={feature} />
          </g>
        );
      })}
    </svg>
  );
};

// Exported for testing; intentionally module-internal otherwise.
export { resolveCategoryFeature, buildColorVars, CATEGORY_FALLBACK_ID, LAYER_TO_COLOR_VAR };

export default AvatarRenderer;
