/**
 * hat.js — Hat / headwear styles (PEO-1)
 *
 * Each hat has its own fixed color(s). "hat.none" renders empty.
 * Hats draw on top of hair (LAYER_ORDER last) so they occlude the crown.
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
      // Crown + brim
      {
        d: `
          M 26 36
          C 28 22, 38 16, 50 16
          C 62 16, 72 22, 74 36
          C 70 34, 60 32, 50 32
          C 40 32, 30 34, 26 36
          Z
        `,
        fill: '#264a7a',
      },
      {
        d: `M 22 36 L 54 36 L 54 40 L 22 40 Z`,
        fill: '#1e3a60',
      },
    ],
  },
  {
    id: 'hat.beanie',
    label: 'Beanie',
    paths: [
      // Tight rounded cap + cuff
      {
        d: `
          M 26 34
          C 26 18, 38 12, 50 12
          C 62 12, 74 18, 74 34
          L 26 34
          Z
        `,
        fill: '#7a2c2c',
      },
      {
        d: `M 24 34 L 76 34 L 76 40 L 24 40 Z`,
        fill: '#5a1f1f',
      },
    ],
  },
  {
    id: 'hat.fedora',
    label: 'Fedora',
    paths: [
      // Crown + wide brim
      {
        d: `
          M 32 26
          C 34 16, 66 16, 68 26
          L 68 36
          L 32 36
          Z
        `,
        fill: '#2c2418',
      },
      {
        d: `M 14 36 L 86 36 L 82 40 L 18 40 Z`,
        fill: '#1f1a10',
      },
      {
        d: `M 32 32 L 68 32 L 68 34 L 32 34 Z`,
        fill: '#1f1a10',
      },
    ],
  },
  {
    id: 'hat.cowboy',
    label: 'Cowboy Hat',
    paths: [
      // Shaped crown + upturned brim
      {
        d: `
          M 34 28
          Q 38 14, 50 14
          Q 62 14, 66 28
          L 66 36
          L 34 36
          Z
        `,
        fill: '#6a4a2a',
      },
      {
        d: `M 10 36 Q 50 48, 90 36 L 86 42 Q 50 54, 14 42 Z`,
        fill: '#5a3e22',
      },
    ],
  },
  {
    id: 'hat.visor',
    label: 'Visor',
    paths: [
      // Just the brim, no crown (open top)
      {
        d: `M 22 36 L 78 36 L 72 42 L 28 42 Z`,
        fill: '#1f6b3a',
      },
      {
        d: `M 26 33 C 36 30, 64 30, 74 33 L 74 36 L 26 36 Z`,
        fill: '#1f6b3a',
      },
    ],
  },
];
