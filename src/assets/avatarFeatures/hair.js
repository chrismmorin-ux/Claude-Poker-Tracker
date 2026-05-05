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
      // Reaches past the jaw — distinct from short (above ear) and long (past
      // shoulders). Side panels extend to y=72 (chin level). Top of hair at
      // y=14; inner front edge at y=42 (above eyes y=48-58).
      {
        d: `
          M 22 44
          C 22 20, 34 14, 50 14
          C 66 14, 78 20, 78 44
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
      // Extends past shoulders on both sides. Top of hair sits at y=12;
      // outer side panels descend to y=100 (shoulder level). Inner front
      // edge stays at y=44 to avoid covering eyes (eyes at y~48-58).
      {
        d: `
          M 22 44
          C 22 18, 34 12, 50 12
          C 66 12, 78 18, 78 44
          L 78 82
          C 78 92, 74 96, 72 100
          L 66 100
          L 66 58
          C 60 50, 40 50, 34 58
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
      // Voluminous bumpy halo — wider than straight hair, with bumpy outline.
      // Stops at y=44 (above eyes at y=48-58).
      {
        d: `
          M 18 44
          C 18 22, 32 12, 50 12
          C 68 12, 82 22, 82 44
          C 82 46, 80 47, 78 46
          C 80 49, 75 50, 73 47
          C 75 50, 70 51, 68 48
          C 70 51, 65 52, 63 49
          C 65 51, 60 52, 58 50
          C 60 52, 55 52, 53 50
          C 55 52, 50 52, 50 50
          C 50 52, 45 52, 47 50
          C 45 52, 40 52, 42 50
          C 40 52, 35 51, 37 49
          C 35 52, 30 51, 32 48
          C 30 51, 25 50, 27 47
          C 25 50, 20 49, 22 46
          C 20 47, 18 46, 18 44
          Z
        `,
        fill: 'var(--hair)',
      },
      // Layered curl-spiral overlays — small filled circles on top of the
      // halo to suggest individual curls. Slightly darker via fillOpacity
      // for shading. Five spirals across the crown.
      {
        d: `
          M 30 28
          a 4 3.5 0 1 0 0.1 0
          M 42 22
          a 4 3.5 0 1 0 0.1 0
          M 54 22
          a 4 3.5 0 1 0 0.1 0
          M 66 24
          a 4 3.5 0 1 0 0.1 0
          M 36 36
          a 3.5 3 0 1 0 0.1 0
          M 50 30
          a 3.5 3 0 1 0 0.1 0
          M 64 36
          a 3.5 3 0 1 0 0.1 0
        `,
        fill: 'rgba(0,0,0,0.18)',
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
