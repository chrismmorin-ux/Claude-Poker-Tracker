/**
 * beard.js — Facial hair styles (PEO-1)
 *
 * Color resolved from --beard CSS custom property.
 * "beard.none" renders as empty paths (clean-shaven).
 */

export default [
  {
    id: 'beard.none',
    label: 'Clean Shaven',
    paths: [],
  },
  {
    id: 'beard.stubble',
    label: 'Stubble',
    paths: [
      // Pattern of small dots across jaw + chin + upper lip — visually reads
      // as "scattered stubble" (low-density facial hair) rather than a filled
      // beard shape. Each dot is tiny so the skin underneath shows through.
      {
        d: `
          M 36 62 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 40 60 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 44 61 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 48 60 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 52 60 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 56 61 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 60 60 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 64 62 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 38 66 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 42 67 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 46 68 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 50 68 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 54 68 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 58 67 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 62 66 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 40 71 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 44 73 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 48 74 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 52 74 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 56 73 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 60 71 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 46 76 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 50 77 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 54 76 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
        `,
        fill: 'var(--beard)',
        fillOpacity: 0.7,
      },
    ],
  },
  {
    id: 'beard.mustache',
    label: 'Mustache',
    paths: [
      // Classic straight mustache
      {
        d: `
          M 38 62
          C 42 60, 46 60, 50 62
          C 54 60, 58 60, 62 62
          L 62 66
          C 58 66, 54 64, 50 66
          C 46 64, 42 66, 38 66
          Z
        `,
        fill: 'var(--beard)',
      },
    ],
  },
  {
    id: 'beard.goatee',
    label: 'Goatee',
    paths: [
      // Small patch on chin + thin mustache connector
      {
        d: `
          M 44 68
          C 46 66, 54 66, 56 68
          L 56 78
          C 54 80, 46 80, 44 78
          Z
        `,
        fill: 'var(--beard)',
      },
      {
        d: `
          M 40 62
          C 46 60, 54 60, 60 62
          L 60 64
          C 54 64, 46 64, 40 64
          Z
        `,
        fill: 'var(--beard)',
      },
    ],
  },
  {
    id: 'beard.full',
    label: 'Full Beard',
    paths: [
      // Covers entire lower face: cheekbones to chin tip, ear-to-ear at jaw.
      // Connects to mustache area with no gap. Uses face silhouette extents
      // (x ~26-74, y ~56-82) so it visibly *covers* the chin rather than sit
      // on top of it.
      {
        d: `
          M 26 54
          C 28 56, 30 58, 32 60
          C 28 70, 32 78, 40 82
          C 44 84, 50 84, 50 84
          C 50 84, 56 84, 60 82
          C 68 78, 72 70, 68 60
          C 70 58, 72 56, 74 54
          C 70 60, 64 64, 60 64
          L 60 64
          C 54 66, 46 66, 40 64
          L 40 64
          C 36 64, 30 60, 26 54
          Z
        `,
        fill: 'var(--beard)',
      },
      // Mustache band (connects beard above the lip)
      {
        d: `
          M 36 60
          C 42 58, 46 58, 50 60
          C 54 58, 58 58, 64 60
          L 64 64
          C 58 62, 54 64, 50 64
          C 46 64, 42 62, 36 64
          Z
        `,
        fill: 'var(--beard)',
      },
    ],
  },
  {
    id: 'beard.soul-patch',
    label: 'Soul Patch',
    paths: [
      // Small patch below lower lip only
      {
        d: `
          M 46 70
          C 48 68, 52 68, 54 70
          L 54 74
          C 52 75, 48 75, 46 74
          Z
        `,
        fill: 'var(--beard)',
      },
    ],
  },
  {
    id: 'beard.chin-strap',
    label: 'Chin Strap',
    paths: [
      // Thin line along jaw only, no mustache
      {
        d: `
          M 28 54
          C 30 70, 40 82, 50 82
          C 60 82, 70 70, 72 54
          L 68 54
          C 66 68, 58 78, 50 78
          C 42 78, 34 68, 32 54
          Z
        `,
        fill: 'var(--beard)',
      },
    ],
  },
];
