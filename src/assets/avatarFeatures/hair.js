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
      // Reaches past the jaw — clearly between short (above ear) and long (past
      // shoulders). Side panels extend to ~y=72 (chin level) so the difference
      // from short is visible at 24px size.
      {
        d: `
          M 22 46
          C 22 22, 34 14, 50 14
          C 66 14, 78 22, 78 46
          L 78 72
          C 76 68, 72 66, 70 66
          L 70 42
          C 60 38, 40 38, 30 42
          L 30 66
          C 28 66, 24 68, 22 72
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
      // Voluminous bumpy halo — distinct from straight short by the bumpy
      // outline (overall envelope wider, with circular lobes around the perimeter).
      {
        d: `
          M 22 46
          C 22 24, 36 14, 50 14
          C 64 14, 78 24, 78 46
          C 78 50, 74 52, 72 50
          C 73 54, 69 56, 66 53
          C 67 56, 63 58, 60 55
          C 61 57, 57 58, 55 56
          C 55 58, 51 58, 50 56
          C 49 58, 45 58, 45 56
          C 43 58, 39 57, 40 55
          C 37 58, 33 56, 34 53
          C 31 56, 27 54, 28 50
          C 26 52, 22 50, 22 46
          Z
        `,
        fill: 'var(--hair)',
      },
    ],
  },
  {
    id: 'hair.braided',
    label: 'Braided',
    paths: [
      // Long hair with vertical braid sections — distinguishable from straight long
      // by the parallel "braid line" overlays. Outer envelope mirrors hair.long.
      {
        d: `
          M 22 48
          C 22 20, 34 12, 50 12
          C 66 12, 78 20, 78 48
          L 78 86
          C 78 94, 74 98, 72 100
          L 66 100
          L 66 58
          C 60 48, 40 48, 34 58
          L 34 100
          L 28 100
          C 26 98, 22 94, 22 86
          Z
        `,
        fill: 'var(--hair)',
      },
      // Braid sectional dividers — uses white-with-low-opacity so the lines
      // read on both dark and light hair colors. The braids are the
      // distinguishing visual cue vs straight long hair.
      {
        d: `
          M 26 60 L 26 96 M 30 60 L 30 96 M 70 60 L 70 96 M 74 60 L 74 96
        `,
        stroke: 'rgba(255,255,255,0.55)',
        strokeWidth: '1.4',
        strokeLinecap: 'round',
        fill: 'none',
      },
      // Diagonal cross-weave hint — adds the characteristic braid-pattern
      // suggestion without literal weave geometry. Three short cross-strokes
      // per side at varying y so the eye reads "braided sections".
      {
        d: `
          M 24 70 L 32 74 M 24 84 L 32 88
          M 76 70 L 68 74 M 76 84 L 68 88
        `,
        stroke: 'rgba(255,255,255,0.4)',
        strokeWidth: '1.2',
        strokeLinecap: 'round',
        fill: 'none',
      },
      // Center-part hairline (white-ish) — visible on dark hair to suggest
      // the braid origin point at the scalp.
      {
        d: `M 50 14 L 50 38`,
        stroke: 'rgba(255,255,255,0.5)',
        strokeWidth: '1.0',
        strokeLinecap: 'round',
        fill: 'none',
      },
    ],
  },
];
