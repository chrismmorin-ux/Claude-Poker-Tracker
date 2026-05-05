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
      // Buzz cut = very short hair, mostly skin showing through. Renders as
      // a SHADOW shape over the crown (thin, low-opacity fill of the hair
      // color) PLUS a dot pattern simulating individual hair stubs — same
      // technique as beard.stubble.
      {
        d: `
          M 28 40
          C 28 24, 38 18, 50 18
          C 62 18, 72 24, 72 40
          C 68 38, 60 36, 50 36
          C 40 36, 32 38, 28 40
          Z
        `,
        fill: 'var(--hair)',
        fillOpacity: 0.35,
      },
      // Dot stubble pattern across the crown — low-density hair stubs.
      {
        d: `
          M 32 24 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 36 22 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 40 20 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 44 19 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 48 18 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 52 18 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 56 19 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 60 20 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 64 22 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 68 24 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 30 28 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 34 26 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 38 24 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 42 23 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 46 22 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 50 22 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 54 22 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 58 23 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 62 24 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 66 26 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 70 28 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 32 32 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 36 30 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 40 28 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 44 27 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 48 26 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 52 26 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 56 27 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 60 28 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 64 30 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 68 32 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 34 36 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 40 34 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 46 32 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 52 32 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 58 32 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 64 34 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
          M 70 36 m -0.6 0 a 0.6 0.6 0 1 0 1.2 0 a 0.6 0.6 0 1 0 -1.2 0
        `,
        fill: 'var(--hair)',
        fillOpacity: 0.85,
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
      // Medium-length hair as a single C-shaped path (NOT an annulus).
      // Outline: covers crown + falls down both side panels to jaw level
      // (y=74) without crossing the chin. The "face cutout" is drawn into
      // the same path via the inside-out perimeter — eliminates the
      // evenodd artifact where the inner cutout used to dip past the
      // outer envelope and fill a goatee-shaped strip below the jaw.
      {
        d: `
          M 22 44
          C 22 20, 34 14, 50 14
          C 66 14, 78 20, 78 44
          L 78 72
          C 76 74, 72 74, 70 74
          L 66 74
          L 66 44
          C 66 42, 60 40, 50 40
          C 40 40, 34 42, 34 44
          L 34 74
          L 30 74
          C 28 74, 24 74, 22 72
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
      // Long hair as an annulus: outer envelope covers crown (y=12) and falls
      // past shoulders (y=100). EVEN-ODD inner cutout is the FULL FACE region
      // (x=28-72 wide at brow, narrowing to chin at y=82). Eyes, nose, mouth
      // all clearly inside the cutout.
      {
        d: `
          M 22 44
          C 22 18, 34 12, 50 12
          C 66 12, 78 18, 78 44
          L 78 82
          C 78 92, 74 96, 72 100
          L 28 100
          C 26 96, 22 92, 22 82
          Z
          M 28 42
          C 30 60, 36 78, 50 84
          C 64 78, 70 60, 72 42
          Z
        `,
        fill: 'var(--hair)',
        fillRule: 'evenodd',
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
      // Layered curl-spiral overlays — DENSE pattern of small filled circles
      // distributed across the crown to read as "tightly curled hair". Two
      // overlapping layers (darker shading + lighter highlights) give the
      // characteristic textured curl appearance.
      {
        // Darker shading curls
        d: `
          M 26 30 a 3 2.5 0 1 0 0.1 0
          M 32 22 a 3 2.5 0 1 0 0.1 0
          M 38 18 a 3 2.5 0 1 0 0.1 0
          M 44 16 a 3 2.5 0 1 0 0.1 0
          M 50 16 a 3 2.5 0 1 0 0.1 0
          M 56 16 a 3 2.5 0 1 0 0.1 0
          M 62 18 a 3 2.5 0 1 0 0.1 0
          M 68 22 a 3 2.5 0 1 0 0.1 0
          M 74 30 a 3 2.5 0 1 0 0.1 0
          M 28 38 a 3 2.5 0 1 0 0.1 0
          M 36 32 a 3 2.5 0 1 0 0.1 0
          M 42 26 a 3 2.5 0 1 0 0.1 0
          M 50 24 a 3 2.5 0 1 0 0.1 0
          M 58 26 a 3 2.5 0 1 0 0.1 0
          M 64 32 a 3 2.5 0 1 0 0.1 0
          M 72 38 a 3 2.5 0 1 0 0.1 0
          M 32 42 a 2.5 2 0 1 0 0.1 0
          M 40 36 a 2.5 2 0 1 0 0.1 0
          M 50 32 a 2.5 2 0 1 0 0.1 0
          M 60 36 a 2.5 2 0 1 0 0.1 0
          M 68 42 a 2.5 2 0 1 0 0.1 0
        `,
        fill: 'rgba(0,0,0,0.22)',
      },
      // Lighter highlight curls — small dots offset from the darker ones
      // for the "two-tone curl pattern" depth
      {
        d: `
          M 30 26 a 1.5 1.5 0 1 0 0.1 0
          M 36 20 a 1.5 1.5 0 1 0 0.1 0
          M 42 18 a 1.5 1.5 0 1 0 0.1 0
          M 50 18 a 1.5 1.5 0 1 0 0.1 0
          M 58 18 a 1.5 1.5 0 1 0 0.1 0
          M 64 20 a 1.5 1.5 0 1 0 0.1 0
          M 70 26 a 1.5 1.5 0 1 0 0.1 0
          M 34 30 a 1.5 1.5 0 1 0 0.1 0
          M 42 24 a 1.5 1.5 0 1 0 0.1 0
          M 50 22 a 1.5 1.5 0 1 0 0.1 0
          M 58 24 a 1.5 1.5 0 1 0 0.1 0
          M 66 30 a 1.5 1.5 0 1 0 0.1 0
        `,
        fill: 'rgba(255,255,255,0.18)',
      },
    ],
  },
  {
    id: 'hair.slick-back',
    label: 'Slick-Back',
    paths: [
      // Slick-back: hair combed straight back, low-volume, defined
      // backward direction. Outer envelope is short on top (no front
      // fringe — receded back from forehead) with white highlight lines
      // showing the comb-back direction.
      {
        d: `
          M 28 36
          C 28 22, 38 16, 50 16
          C 62 16, 72 22, 72 36
          L 70 42
          C 64 38, 36 38, 30 42
          Z
        `,
        fill: 'var(--hair)',
      },
      // Slick-back direction lines — parallel curves running front-to-back
      // across the top, suggesting hair pulled backward.
      {
        d: `
          M 32 22 C 38 24, 56 24, 68 26
          M 30 26 C 38 28, 58 28, 70 30
          M 30 30 C 38 32, 60 32, 70 34
          M 32 34 C 40 36, 60 36, 68 38
        `,
        stroke: 'rgba(255,255,255,0.35)',
        strokeWidth: '0.7',
        strokeLinecap: 'round',
        fill: 'none',
      },
    ],
  },
  {
    id: 'hair.combover',
    label: 'Combover',
    paths: [
      // Combover: thin layer of hair across a thinning crown, asymmetric
      // direction (combed sideways across the top). Outer shape is thin
      // (close to scalp) with strong sideways direction lines.
      {
        d: `
          M 28 36
          C 28 22, 38 18, 50 18
          C 62 18, 72 22, 72 36
          L 70 40
          C 66 36, 32 36, 30 40
          Z
        `,
        fill: 'var(--hair)',
      },
      // Combover direction lines — DIAGONAL across the top (left-to-right),
      // suggesting hair combed across the head to cover thinning area.
      {
        d: `
          M 30 24 L 64 28
          M 28 28 L 66 32
          M 30 32 L 68 34
          M 32 36 L 68 36
        `,
        stroke: 'rgba(255,255,255,0.45)',
        strokeWidth: '0.9',
        strokeLinecap: 'round',
        fill: 'none',
      },
      // Subtle "thinning" hint — small gaps in the hair color near the
      // crown to suggest hair sparseness underneath the combover
      {
        d: `
          M 50 22 m -1 0 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0
          M 56 24 m -1 0 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0
        `,
        fill: 'rgba(255,220,180,0.4)', // skin-tone-ish gap dots
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
          M 22 44
          C 22 18, 34 12, 50 12
          C 66 12, 78 18, 78 44
          L 78 86
          C 78 94, 74 98, 72 100
          L 28 100
          C 26 98, 22 94, 22 86
          Z
          M 28 42
          C 30 60, 36 78, 50 84
          C 64 78, 70 60, 72 42
          Z
        `,
        fill: 'var(--hair)',
        fillRule: 'evenodd',
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
