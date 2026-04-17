/**
 * AvatarMonogram.jsx — Initials fallback for players without avatarFeatures (PEO-1)
 *
 * Renders 1-2 letter initials on a deterministic background color derived
 * from the player's name. Used by PlayerAvatar when avatarFeatures is null
 * (legacy records) or when no name is available (blank silhouette fallback).
 */

import React, { useMemo } from 'react';

// Palette chosen for good contrast with white text and visual distinction.
const MONOGRAM_PALETTE = [
  '#3b6aa0', // steel blue
  '#6a3ba0', // royal purple
  '#a03b6a', // rose
  '#a06a3b', // amber
  '#3ba06a', // teal green
  '#6aa03b', // olive
  '#a03b3b', // brick
  '#3ba0a0', // cyan
];

const UNNAMED_BG = '#6b6b6b';

const hashName = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

const getInitials = (name) => {
  if (!name) return '?';
  const trimmed = String(name).trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getBgColor = (name) => {
  if (!name || !String(name).trim()) return UNNAMED_BG;
  return MONOGRAM_PALETTE[hashName(String(name)) % MONOGRAM_PALETTE.length];
};

const AvatarMonogram = ({ name, size = 48, className = '', title }) => {
  const initials = useMemo(() => getInitials(name), [name]);
  const bg = useMemo(() => getBgColor(name), [name]);

  const fontSize = Math.max(10, Math.round(size * 0.42));

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={title || `Monogram for ${name || 'unnamed player'}`}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="50" cy="50" r="50" fill={bg} />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontWeight="600"
        fontSize={(fontSize / size) * 100}
      >
        {initials}
      </text>
    </svg>
  );
};

export { getInitials, getBgColor, MONOGRAM_PALETTE };
export default AvatarMonogram;
