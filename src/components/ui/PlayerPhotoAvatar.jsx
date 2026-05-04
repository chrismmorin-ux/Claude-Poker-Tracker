/**
 * @file PlayerPhotoAvatar — render a player's photo (or initial-letter fallback).
 *
 * Loads the photo blob via getPhotoBlob → URL.createObjectURL; cleans up the
 * object URL on unmount or when photoBlobId changes.
 *
 * Used by PlayerProfileView Header (SPR-036 / WS-161). Future surfaces can
 * reuse this component for unified photo rendering.
 *
 * SPR-036 / WS-161 (2026-05-04).
 */

import React, { useEffect, useState } from 'react';
import { getPhotoBlob } from '../../utils/persistence/playerPhotosStore';

export const PlayerPhotoAvatar = ({
  player,
  size = 40,
  className = '',
}) => {
  const [photoUrl, setPhotoUrl] = useState(null);
  const photoBlobId = player?.photoBlobId ?? null;

  useEffect(() => {
    let cancelled = false;
    let url = null;

    if (typeof photoBlobId === 'number' && Number.isFinite(photoBlobId)) {
      getPhotoBlob(photoBlobId).then((record) => {
        if (cancelled) return;
        if (record?.blob) {
          url = URL.createObjectURL(record.blob);
          setPhotoUrl(url);
        } else {
          setPhotoUrl(null);
        }
      }).catch(() => {
        if (!cancelled) setPhotoUrl(null);
      });
    } else {
      setPhotoUrl(null);
    }

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoBlobId]);

  const dimensionStyle = { width: size, height: size };

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={player?.name || 'Player'}
        className={`rounded-full object-cover border border-gray-300 ${className}`}
        style={dimensionStyle}
        data-testid="player-photo-avatar-image"
      />
    );
  }

  // Fallback: initial-letter avatar.
  const initial = (player?.name || '?').charAt(0).toUpperCase();
  return (
    <div
      className={`rounded-full bg-gray-600 flex items-center justify-center text-gray-300 font-semibold ${className}`}
      style={dimensionStyle}
      data-testid="player-photo-avatar-fallback"
    >
      {initial}
    </div>
  );
};
