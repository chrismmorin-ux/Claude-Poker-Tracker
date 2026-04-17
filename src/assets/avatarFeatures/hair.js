/**
 * hair.js — Scalp hair styles (PEO-1)
 *
 * Color resolved from --hair CSS custom property set by AvatarRenderer.
 * "hair.none" renders as empty paths (bald scalp — face shape shows through).
 */

export default [
  {
    id: 'hair.none',
    label: 'None / Bald',
    paths: [],
  },
  {
    id: 'hair.buzz',
    label: 'Buzz Cut',
    paths: [
      // Thin cap hugging the crown
      {
        d: `
          M 28 40
          C 28 24, 38 18, 50 18
          C 62 18, 72 24, 72 40
          C 68 34, 60 32, 50 32
          C 40 32, 32 34, 28 40
          Z
        `,
        fill: 'var(--hair)',
      },
    ],
  },
  {
    id: 'hair.short-wavy',
    label: 'Short Wavy',
    paths: [
      // Wavy top with a light fringe over forehead
      {
        d: `
          M 26 44
          C 26 24, 38 16, 50 16
          C 62 16, 74 24, 74 44
          C 72 40, 68 38, 66 40
          C 64 36, 60 36, 58 40
          C 56 36, 52 36, 50 40
          C 48 36, 44 36, 42 40
          C 40 36, 36 38, 34 40
          C 32 38, 28 40, 26 44
          Z
        `,
        fill: 'var(--hair)',
      },
    ],
  },
  {
    id: 'hair.side-part',
    label: 'Side Part',
    paths: [
      // Asymmetric sweep — heavier on right (viewer's left)
      {
        d: `
          M 26 44
          C 26 22, 36 16, 50 16
          C 64 16, 74 24, 74 44
          C 70 38, 66 36, 62 38
          L 58 30
          C 52 28, 44 28, 38 32
          C 32 36, 28 40, 26 44
          Z
        `,
        fill: 'var(--hair)',
      },
    ],
  },
  {
    id: 'hair.medium',
    label: 'Medium Length',
    paths: [
      // Reaches to mid-ear
      {
        d: `
          M 24 46
          C 24 22, 36 14, 50 14
          C 64 14, 76 22, 76 46
          L 76 58
          C 74 54, 70 52, 68 52
          L 68 42
          C 60 38, 40 38, 32 42
          L 32 52
          C 30 52, 26 54, 24 58
          Z
        `,
        fill: 'var(--hair)',
      },
    ],
  },
  {
    id: 'hair.long',
    label: 'Long',
    paths: [
      // Extends down past shoulders on both sides
      {
        d: `
          M 22 48
          C 22 20, 34 12, 50 12
          C 66 12, 78 20, 78 48
          L 78 82
          C 78 92, 74 96, 72 100
          L 66 100
          L 66 58
          C 60 48, 40 48, 34 58
          L 34 100
          L 28 100
          C 26 96, 22 92, 22 82
          Z
        `,
        fill: 'var(--hair)',
      },
    ],
  },
  {
    id: 'hair.receding',
    label: 'Receding',
    paths: [
      // Thin sides, back/crown visible, front hairline raised
      {
        d: `
          M 28 40
          C 28 28, 34 22, 42 20
          C 40 26, 40 30, 40 34
          C 46 32, 54 32, 60 34
          C 60 30, 60 26, 58 20
          C 66 22, 72 28, 72 40
          C 68 38, 60 36, 50 36
          C 40 36, 32 38, 28 40
          Z
        `,
        fill: 'var(--hair)',
      },
    ],
  },
  {
    id: 'hair.curly',
    label: 'Curly',
    paths: [
      // Series of small circular bumps approximating curls
      {
        d: `
          M 26 42
          C 26 22, 38 16, 50 16
          C 62 16, 74 22, 74 42
          C 72 44, 68 44, 66 42
          C 66 44, 62 46, 60 44
          C 60 46, 56 46, 54 44
          C 54 46, 50 46, 48 44
          C 48 46, 44 46, 42 44
          C 42 46, 38 46, 36 44
          C 36 46, 32 46, 30 44
          C 28 44, 26 44, 26 42
          Z
        `,
        fill: 'var(--hair)',
      },
    ],
  },
];
