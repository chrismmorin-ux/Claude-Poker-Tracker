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
  getClothingColor,
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
  // Hat color — resolved from a CLOTHING_COLORS key. When unset, --hat /
  // --hat-trim are NOT set so the SVG paths use their fallback hex (the
  // original design colors), preserving the unrecolored render. When set,
  // --hat-trim is derived from --hat via CSS color-mix (modern browsers
  // support this in inline style values).
  const hatEntry = getClothingColor(avatarFeatures?.hatColor);
  const hatVars = hatEntry
    ? {
        '--hat': hatEntry.hex,
        '--hat-trim': `color-mix(in srgb, ${hatEntry.hex} 70%, black)`,
      }
    : {};
  return {
    '--skin': getSkinTone(skinId).hex,
    '--hair': getHairColor(hairColorId).hex,
    '--beard': getHairColor(beardColorId).hex,
    '--eye': getEyeColor(eyeColorId).hex,
    '--frame': getEyewearColor(frameColorId).hex,
    ...hatVars,
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
      fillRule={p.fillRule ?? undefined}
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

// Salt-pepper treatment overlay — white streak pattern rendered ON TOP of
// the hair (or beard) shape, clipped to the underlying shape so streaks
// don't spill onto skin. Mimics the natural "white hairs scattered through
// the primary color" appearance. Uses small dots and short streaks
// distributed across the head area.
const SALT_PEPPER_HAIR_PATHS = [
  // Scattered short streaks across the crown
  { d: 'M 28 24 l 2 1.5 M 35 18 l 2.5 1 M 42 14 l 2 1.5 M 50 12 l 2.5 1.5 M 58 14 l 2 1 M 65 18 l 2.5 1.5 M 72 24 l 2 1', stroke: '#fff', strokeWidth: 1.2, strokeLinecap: 'round', fill: 'none' },
  // Mid-crown streaks
  { d: 'M 30 30 l 2 1 M 38 24 l 2 1.5 M 46 20 l 2 1 M 54 20 l 2 1 M 62 24 l 2 1.5 M 70 30 l 2 1', stroke: '#fff', strokeWidth: 1, strokeLinecap: 'round', fill: 'none' },
  // Lower scattered dots (sideburn / ear-line area for longer hair)
  { d: 'M 26 38 l 1.5 0.8 M 32 36 l 1.5 0.8 M 68 36 l 1.5 0.8 M 74 38 l 1.5 0.8', stroke: '#fff', strokeWidth: 0.9, strokeLinecap: 'round', fill: 'none' },
];

const SALT_PEPPER_BEARD_PATHS = [
  // Streaks across beard area (jaw + chin + sideburns at y=56-78)
  { d: 'M 32 60 l 1.5 0.8 M 40 58 l 1.5 0.8 M 48 60 l 1.5 0.8 M 56 58 l 1.5 0.8 M 64 60 l 1.5 0.8', stroke: '#fff', strokeWidth: 1, strokeLinecap: 'round', fill: 'none' },
  { d: 'M 36 66 l 1.5 0.8 M 44 68 l 1.5 0.8 M 52 68 l 1.5 0.8 M 60 66 l 1.5 0.8', stroke: '#fff', strokeWidth: 1, strokeLinecap: 'round', fill: 'none' },
  { d: 'M 42 74 l 1.5 0.8 M 50 76 l 1.5 0.8 M 58 74 l 1.5 0.8', stroke: '#fff', strokeWidth: 0.9, strokeLinecap: 'round', fill: 'none' },
];

const AvatarRenderer = ({ avatarFeatures, size = 48, className = '', title }) => {
  const colorStyle = useMemo(() => buildColorVars(avatarFeatures), [avatarFeatures]);
  const uniqueId = useId();
  const safeId = uniqueId.replace(/[^a-zA-Z0-9_-]/g, '');
  const hairClipId = `hair-clip-${safeId}`;
  const hairShapeClipId = `hair-shape-${safeId}`;
  const beardShapeClipId = `beard-shape-${safeId}`;

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

  // Salt-pepper treatment overlays — render white streak pattern clipped
  // to the underlying hair / beard shape.
  const hairTreatment = avatarFeatures?.hairTreatment;
  const beardTreatment = avatarFeatures?.beardTreatment ?? hairTreatment; // beard mirrors hair by default
  const hairLayer = layers.find((l) => l.category === 'hair');
  const beardLayer = layers.find((l) => l.category === 'beard');
  const hasHair = !!hairLayer?.feature?.paths?.length;
  const hasBeard = !!beardLayer?.feature?.paths?.length;
  const showHairSaltPepper = hairTreatment === 'salt-pepper' && hasHair;
  const showBeardSaltPepper = beardTreatment === 'salt-pepper' && hasBeard;

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
      {(hasHat || showHairSaltPepper || showBeardSaltPepper) ? (
        <defs>
          {hasHat ? (
            <clipPath id={hairClipId}>
              <rect
                x={0}
                y={HAIR_CLIP_Y_WHEN_HATTED}
                width={AVATAR_VIEWBOX_SIZE}
                height={AVATAR_VIEWBOX_SIZE - HAIR_CLIP_Y_WHEN_HATTED}
              />
            </clipPath>
          ) : null}
          {showHairSaltPepper ? (
            <clipPath id={hairShapeClipId}>
              {hairLayer.feature.paths.map((p, i) => (
                <path key={i} d={p.d} />
              ))}
            </clipPath>
          ) : null}
          {showBeardSaltPepper ? (
            <clipPath id={beardShapeClipId}>
              {beardLayer.feature.paths.map((p, i) => (
                <path key={i} d={p.d} />
              ))}
            </clipPath>
          ) : null}
        </defs>
      ) : null}
      {layers.map(({ category, feature }) => {
        const isHair = category === 'hair';
        const isBeard = category === 'beard';
        const groupProps = {
          'data-layer': category,
          'data-feature-id': feature.id,
        };
        if (isHair && hasHat) {
          groupProps.clipPath = `url(#${hairClipId})`;
          groupProps['data-hair-clipped'] = 'true';
        }
        const layerNode = (
          <g key={category} {...groupProps}>
            <FeaturePaths feature={feature} />
          </g>
        );
        // After the hair layer, optionally render the salt-pepper overlay
        // group clipped to the hair shape. Same after the beard.
        if (isHair && showHairSaltPepper) {
          return (
            <React.Fragment key={category}>
              {layerNode}
              <g
                data-layer="hair-treatment"
                data-treatment="salt-pepper"
                clipPath={`url(#${hairShapeClipId})`}
              >
                {SALT_PEPPER_HAIR_PATHS.map((p, i) => (
                  <path key={i} d={p.d} fill={p.fill ?? 'none'}
                    stroke={p.stroke} strokeWidth={p.strokeWidth}
                    strokeLinecap={p.strokeLinecap} />
                ))}
              </g>
            </React.Fragment>
          );
        }
        if (isBeard && showBeardSaltPepper) {
          return (
            <React.Fragment key={category}>
              {layerNode}
              <g
                data-layer="beard-treatment"
                data-treatment="salt-pepper"
                clipPath={`url(#${beardShapeClipId})`}
              >
                {SALT_PEPPER_BEARD_PATHS.map((p, i) => (
                  <path key={i} d={p.d} fill={p.fill ?? 'none'}
                    stroke={p.stroke} strokeWidth={p.strokeWidth}
                    strokeLinecap={p.strokeLinecap} />
                ))}
              </g>
            </React.Fragment>
          );
        }
        return layerNode;
      })}
    </svg>
  );
};

// Exported for testing; intentionally module-internal otherwise.
export { resolveCategoryFeature, buildColorVars, CATEGORY_FALLBACK_ID, LAYER_TO_COLOR_VAR };

export default AvatarRenderer;
