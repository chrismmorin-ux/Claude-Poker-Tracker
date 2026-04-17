/**
 * skin.js — Face + neck + shoulders silhouette (PEO-1)
 *
 * The "skin" category contributes ONE feature: the base face shape.
 * Tone selection happens via the --skin CSS custom property set by
 * AvatarRenderer from the user's chosen SKIN_TONE id.
 *
 * All paths render against the 100×100 AVATAR_VIEWBOX.
 */

// Head + neck + shoulders, drawn as one filled path.
// Head: rounded dome from (26,48) up to (74,48) via top curve.
// Jaw: tapers to chin at (50,82).
// Neck: short vertical, widening to shoulders at y=100.
const HEAD_AND_SHOULDERS = `
  M 50 18
  C 33 18, 26 32, 26 48
  C 26 62, 31 73, 40 78
  L 40 84
  C 40 88, 35 90, 30 92
  L 16 100
  L 84 100
  L 70 92
  C 65 90, 60 88, 60 84
  L 60 78
  C 69 73, 74 62, 74 48
  C 74 32, 67 18, 50 18
  Z
`;

export default [
  {
    id: 'skin.shape',
    label: 'Face',
    paths: [
      { d: HEAD_AND_SHOULDERS, fill: 'var(--skin)' },
    ],
  },
];
