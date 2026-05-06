/**
 * hat.js — Hat / headwear styles.
 *
 * Colors use CSS custom properties so the avatar can recolor hats based
 * on observed accessory color. AvatarRenderer's buildColorVars() sets:
 *   --hat       — primary hat color (crown, headband, etc.)
 *   --hat-trim  — secondary darker shade (brim, band, indent details);
 *                 derived from --hat via CSS color-mix in buildColorVars
 *
 * If avatarFeatures.hatColor is null/unset, the path fallback hex is used
 * (the original design color) so existing hats render exactly as before.
 *
 * Geometry conventions:
 *   - Head outline runs from x=22-78 at the temples (widest), narrowing
 *     toward crown (x=33-67 at y=18) and jaw (x=40-60 at y=78).
 *   - Hat brim line is at y=36 for caps and visors, y=32 for fitted hats
 *     (beanie/cowboy/fedora) so they sit higher.
 *   - Hat shapes must extend wider than the head outline at the brim line
 *     so the hat visibly *sits on* the head rather than appearing inside it.
 */

export default [
  {
    id: 'hat.none',
    label: 'None',
    paths: [],
  },
  {
    id: 'hat.cap',
    label: 'Baseball Cap',
    paths: [
      // Crown — primary color
      {
        d: `
          M 22 38
          C 22 22, 30 14, 50 14
          C 66 14, 76 20, 78 38
          Z
        `,
        fill: 'var(--hat, #264a7a)',
      },
      // Brim — trim color
      {
        d: `
          M 16 38
          L 60 38
          C 60 41, 50 44, 16 42
          Z
        `,
        fill: 'var(--hat-trim, #1e3a60)',
      },
      // Button on top — trim color
      {
        d: `M 50 14 m -1.5 0 a 1.5 1.5 0 1 0 3 0 a 1.5 1.5 0 1 0 -3 0`,
        fill: 'var(--hat-trim, #1e3a60)',
      },
    ],
  },
  {
    id: 'hat.beanie',
    label: 'Beanie',
    paths: [
      // Single-color beanie — primary color
      {
        d: `
          M 18 32
          C 18 12, 32 6, 50 6
          C 68 6, 82 12, 82 32
          L 82 44
          C 82 52, 78 54, 74 54
          C 70 54, 68 50, 66 46
          C 60 42, 40 42, 34 46
          C 32 50, 30 54, 26 54
          C 22 54, 18 52, 18 44
          Z
        `,
        fill: 'var(--hat, #7a2c2c)',
      },
      // Subtle ribbed knit lines (low-opacity) — stay neutral, not recolored
      {
        d: `
          M 26 22 L 28 52 M 34 14 L 34 46 M 42 10 L 42 44
          M 50 8 L 50 44 M 58 10 L 58 44 M 66 14 L 66 46 M 74 22 L 72 52
        `,
        stroke: 'rgba(0,0,0,0.18)',
        strokeWidth: '0.7',
        strokeLinecap: 'round',
        fill: 'none',
      },
    ],
  },
  {
    id: 'hat.fedora',
    label: 'Fedora',
    paths: [
      // Crown — primary
      {
        d: `
          M 28 24
          C 30 14, 70 14, 72 24
          L 72 36
          L 28 36
          Z
        `,
        fill: 'var(--hat, #2c2418)',
      },
      // Wide brim — trim
      {
        d: `
          M 12 36
          C 12 36, 22 41, 50 41
          C 78 41, 88 36, 88 36
          C 88 38, 80 42, 50 42
          C 20 42, 12 38, 12 36
          Z
        `,
        fill: 'var(--hat-trim, #1f1a10)',
      },
      // Hat band (small accent at base of crown) — trim, slightly darker
      {
        d: `M 28 32 L 72 32 L 72 35 L 28 35 Z`,
        fill: 'var(--hat-trim, #0e0a06)',
      },
    ],
  },
  {
    id: 'hat.cowboy',
    label: 'Cowboy Hat',
    paths: [
      // Crown — primary
      {
        d: `
          M 30 22
          Q 32 10, 42 10
          Q 50 8, 58 10
          Q 68 10, 70 22
          L 70 36
          L 30 36
          Z
        `,
        fill: 'var(--hat, #6a4a2a)',
      },
      // Brim — trim
      {
        d: `
          M 8 36
          Q 30 30, 50 36
          Q 70 30, 92 36
          Q 88 44, 78 44
          Q 64 46, 50 44
          Q 36 46, 22 44
          Q 12 44, 8 36
          Z
        `,
        fill: 'var(--hat-trim, #5a3e22)',
      },
      // Crown indent (the pinch on top) — trim
      {
        d: `M 42 12 Q 50 18, 58 12 L 58 16 Q 50 22, 42 16 Z`,
        fill: 'var(--hat-trim, #4d3315)',
      },
    ],
  },
  {
    id: 'hat.visor',
    label: 'Visor',
    paths: [
      // Headband — primary
      {
        d: `
          M 22 36
          C 22 32, 30 30, 50 30
          C 70 30, 78 32, 78 36
          L 78 38
          L 22 38
          Z
        `,
        fill: 'var(--hat, #1f6b3a)',
      },
      // Brim — primary (same color, single-tone visor)
      {
        d: `
          M 14 38
          L 78 38
          C 76 42, 50 44, 16 42
          Z
        `,
        fill: 'var(--hat, #1f6b3a)',
      },
    ],
  },
];
