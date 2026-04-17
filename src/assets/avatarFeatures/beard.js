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
      // Thin shadow across jaw and under lip
      {
        d: `
          M 34 64
          C 40 68, 60 68, 66 64
          C 66 70, 62 74, 50 75
          C 38 74, 34 70, 34 64
          Z
        `,
        fill: 'var(--beard)',
        fillOpacity: 0.45,
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
      // Covers chin, jaw, mustache area
      {
        d: `
          M 30 56
          C 32 68, 36 78, 50 82
          C 64 78, 68 68, 70 56
          C 66 60, 60 62, 50 62
          C 40 62, 34 60, 30 56
          Z
        `,
        fill: 'var(--beard)',
      },
      {
        d: `
          M 38 60
          C 44 58, 56 58, 62 60
          L 62 64
          C 56 62, 44 62, 38 64
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
