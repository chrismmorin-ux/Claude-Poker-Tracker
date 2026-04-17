/**
 * PlayerAvatar.jsx — Unified player-avatar wrapper (PEO-1)
 *
 * Canonical rendering path for player avatars throughout the app.
 * Decides between feature-avatar and monogram fallback based on data presence.
 *
 * Per program decision D6: feature avatar is the canonical identity sigil.
 * Raw image uploads (`player.avatar`) are surfaced only in detail views via
 * dedicated components — never here, to keep list rendering fast and uniform.
 *
 * Usage:
 *   <PlayerAvatar player={player} size={48} />
 *   <PlayerAvatar player={{ name: 'Mike' }} size={32} />  // monogram fallback
 *   <PlayerAvatar size={40} />                             // unnamed silhouette
 */

import React from 'react';
import AvatarRenderer from './AvatarRenderer';
import AvatarMonogram from './AvatarMonogram';

const PlayerAvatar = ({ player, size = 48, className = '', title }) => {
  const avatarFeatures = player?.avatarFeatures;
  const name = player?.name;

  if (avatarFeatures && typeof avatarFeatures === 'object') {
    return (
      <AvatarRenderer
        avatarFeatures={avatarFeatures}
        size={size}
        className={className}
        title={title || name}
      />
    );
  }

  return (
    <AvatarMonogram
      name={name}
      size={size}
      className={className}
      title={title || name}
    />
  );
};

export default PlayerAvatar;
