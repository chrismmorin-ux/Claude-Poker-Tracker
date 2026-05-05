/**
 * hat.js — Hat / headwear styles (Phase 1.7)
 *
 * Each hat has a fixed color (or two colors for caps with brims of a
 * different shade). "hat.none" renders empty. Hats draw on top of hair
 * (LAYER_ORDER last) and AvatarRenderer applies a clip-path to the hair
 * group below the hat-line so hair doesn't poke through the crown.
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
      // Crown — taller at the front, slopes down toward the back. Sits on
      // the head from y=14 (front peak) to y=36 (cap base around the head).
      {
        d: `
          M 22 38
          C 22 22, 30 14, 50 14
          C 66 14, 76 20, 78 38
          C 70 36, 60 35, 50 35
          C 40 35, 30 36, 22 38
          Z
        `,
        fill: '#264a7a',
      },
      // Brim — extends FORWARD from the cap with a curved underside (looks
      // like a baseball cap brim viewed slightly from the front).
      {
        d: `
          M 18 38
          C 18 38, 50 38, 56 38
          L 56 42
          C 54 44, 30 44, 18 42
          Z
        `,
        fill: '#1e3a60',
      },
      // Button on top of crown
      {
        d: `M 50 14 m -1.5 0 a 1.5 1.5 0 1 0 3 0 a 1.5 1.5 0 1 0 -3 0`,
        fill: '#1e3a60',
      },
    ],
  },
  {
    id: 'hat.beanie',
    label: 'Beanie',
    paths: [
      // Smooth single-color beanie — covers ears (extends down to y=50 on
      // the sides) with a rounded crown. No cuff line, no two-tone, no flaps.
      // Slightly wider than head at temples to *sit on* properly.
      {
        d: `
          M 20 32
          C 20 14, 34 8, 50 8
          C 66 8, 80 14, 80 32
          C 80 42, 78 48, 76 50
          C 72 52, 64 52, 58 52
          L 42 52
          C 36 52, 28 52, 24 50
          C 22 48, 20 42, 20 32
          Z
        `,
        fill: '#7a2c2c',
      },
      // Subtle ribbed knit lines (low-opacity) — gives texture without
      // breaking the single-color rule
      {
        d: `
          M 28 24 L 30 50 M 36 18 L 36 52 M 44 14 L 44 52
          M 52 14 L 52 52 M 60 18 L 60 52 M 68 24 L 68 50
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
      // Crown — pinched top, fits the head width
      {
        d: `
          M 28 24
          C 30 14, 70 14, 72 24
          L 72 36
          L 28 36
          Z
        `,
        fill: '#2c2418',
      },
      // Wide brim — extends well beyond head sides (fedoras have ~30%
      // wider brim than the head)
      {
        d: `
          M 12 36
          C 12 36, 22 41, 50 41
          C 78 41, 88 36, 88 36
          C 88 38, 80 42, 50 42
          C 20 42, 12 38, 12 36
          Z
        `,
        fill: '#1f1a10',
      },
      // Hat band (small accent at base of crown)
      {
        d: `M 28 32 L 72 32 L 72 35 L 28 35 Z`,
        fill: '#0e0a06',
      },
    ],
  },
  {
    id: 'hat.cowboy',
    label: 'Cowboy Hat',
    paths: [
      // Crown — pinched-top cowboy crown, slightly taller than fedora.
      // Sized to actually sit on the head (crown width matches head temples).
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
        fill: '#6a4a2a',
      },
      // Brim — wide and curved upward at the sides (signature cowboy curl)
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
        fill: '#5a3e22',
      },
      // Crown indent (the pinch on top)
      {
        d: `M 42 12 Q 50 18, 58 12 L 58 16 Q 50 22, 42 16 Z`,
        fill: '#4d3315',
      },
    ],
  },
  {
    id: 'hat.visor',
    label: 'Visor',
    paths: [
      // Open-top visor — just the brim + headband (no crown).
      // Headband sits on the head; brim extends forward.
      // Headband
      {
        d: `
          M 22 36
          C 22 32, 30 30, 50 30
          C 70 30, 78 32, 78 36
          L 78 38
          L 22 38
          Z
        `,
        fill: '#1f6b3a',
      },
      // Brim — curved outward from the headband
      {
        d: `
          M 14 38
          L 78 38
          C 76 42, 50 44, 16 42
          Z
        `,
        fill: '#1f6b3a',
      },
    ],
  },
];
