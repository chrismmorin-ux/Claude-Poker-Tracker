/**
 * @file IdentityAvatar.jsx — Single unified avatar driven by identification fields.
 *
 * Per docs/design/audits/2026-05-02-gate4v2-design-player-identification-v2.md §8.1.
 *
 * Replaces (in Phase 2+):
 *   - PlayerAvatar (the chooser wrapper)
 *   - AvatarMonogram (letter fallback)
 *   - PlayerPhotoAvatar (standalone photo render)
 *   - AvatarFeatureBuilder (the manual SVG picker UI)
 *
 * Phase 1 (this file): co-exists with the above. Renders nowhere by default;
 * exists for owner to sanity-check via the corpus sample page (Phase 1 deliverable).
 *
 * Contract:
 *   - Reads player identification fields, maps via avatarMapping, renders via
 *     existing AvatarRenderer SVG primitives.
 *   - No manual override — to change the avatar, edit the identification fields.
 *   - When player is null/empty → renders default avatar (not monogram), so
 *     callers see the full silhouette path being exercised.
 *   - photoOverlay (optional) renders a small circular badge of the captured
 *     photo bottom-right, keeping the SVG avatar primary.
 *
 * Future-V2 (later phases):
 *   - Sex-driven silhouette base (needs new SVG masculine/feminine/androgynous shapes)
 *   - Build-driven silhouette weight (needs SVG variants)
 *   - Distinguishing-mark badge overlays (needs new icon SVGs)
 */

import React, { useMemo } from 'react';
import AvatarRenderer from './AvatarRenderer';
import { mapIdentityToAvatarFeatures } from '../../utils/identityAvatar/avatarMapping';

const IdentityAvatar = ({
  player,
  size = 48,
  className = '',
  title,
  headwearOverride = null,
  photoOverlay = false,
  photoUrl = null, // when photoOverlay && photoUrl provided, render badge
  testId = 'identity-avatar',
}) => {
  const avatarFeatures = useMemo(
    () => mapIdentityToAvatarFeatures(player, { headwearOverride }),
    [player, headwearOverride],
  );

  const label = title || player?.name || 'Player';

  // Photo-overlay badge sized at ~30% of avatar, anchored bottom-right.
  const badgeSize = Math.max(16, Math.round(size * 0.3));

  if (photoOverlay && photoUrl) {
    return (
      <div
        className={`relative inline-block ${className}`}
        style={{ width: size, height: size }}
        data-testid={testId}
      >
        <AvatarRenderer
          avatarFeatures={avatarFeatures}
          size={size}
          title={label}
        />
        <img
          src={photoUrl}
          alt=""
          className="absolute rounded-full ring-2 ring-white object-cover"
          style={{
            width: badgeSize,
            height: badgeSize,
            bottom: -2,
            right: -2,
          }}
          data-testid={`${testId}-photo-badge`}
        />
      </div>
    );
  }

  return (
    <AvatarRenderer
      avatarFeatures={avatarFeatures}
      size={size}
      className={className}
      title={label}
    />
  );
};

export default IdentityAvatar;
export { IdentityAvatar };
