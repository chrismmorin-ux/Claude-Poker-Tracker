/**
 * glasses.js — Glasses / eyewear styles (PEO-1)
 *
 * Frame color fixed (black for most, brown for horn-rim, gold for aviators).
 * "glasses.none" renders empty (no eyewear).
 */

const BLACK = '#1b1714';
const TINT = '#2c2a28';

export default [
  {
    id: 'glasses.none',
    label: 'None',
    paths: [],
  },
  {
    id: 'glasses.round',
    label: 'Round',
    paths: [
      // Two circles + bridge
      {
        d: `M 35 50 a 6 5 0 1 0 12 0 a 6 5 0 1 0 -12 0 Z M 53 50 a 6 5 0 1 0 12 0 a 6 5 0 1 0 -12 0 Z`,
        fill: 'none',
        stroke: BLACK,
        strokeWidth: 1.3,
      },
      {
        d: `M 47 50 L 53 50`,
        fill: 'none',
        stroke: BLACK,
        strokeWidth: 1.3,
      },
    ],
  },
  {
    id: 'glasses.square',
    label: 'Square',
    paths: [
      {
        d: `M 34 46 h 12 v 8 h -12 Z M 54 46 h 12 v 8 h -12 Z`,
        fill: 'none',
        stroke: BLACK,
        strokeWidth: 1.4,
      },
      {
        d: `M 46 50 L 54 50`,
        fill: 'none',
        stroke: BLACK,
        strokeWidth: 1.4,
      },
    ],
  },
  {
    id: 'glasses.aviator',
    label: 'Aviator',
    paths: [
      // Teardrop lenses
      {
        d: `M 34 46 q 12 -2 13 4 q -1 6 -7 6 q -7 0 -6 -10 Z M 66 46 q -12 -2 -13 4 q 1 6 7 6 q 7 0 6 -10 Z`,
        fill: 'none',
        stroke: '#b8893a',
        strokeWidth: 1.2,
      },
      {
        d: `M 47 49 L 53 49`,
        fill: 'none',
        stroke: '#b8893a',
        strokeWidth: 1.2,
      },
    ],
  },
  {
    id: 'glasses.shades',
    label: 'Shades',
    paths: [
      // Filled opaque lenses (covers eyes)
      {
        d: `M 33 45 h 14 v 9 q -7 3 -14 0 Z`,
        fill: TINT,
      },
      {
        d: `M 53 45 h 14 v 9 q -7 3 -14 0 Z`,
        fill: TINT,
      },
      {
        d: `M 47 49 L 53 49`,
        fill: 'none',
        stroke: BLACK,
        strokeWidth: 1.4,
      },
    ],
  },
  {
    id: 'glasses.horn-rim',
    label: 'Horn-Rimmed',
    paths: [
      // Thick top-bar square frame
      {
        d: `M 33 45 h 14 v 9 h -14 Z`,
        fill: 'none',
        stroke: '#3b2416',
        strokeWidth: 2.2,
      },
      {
        d: `M 53 45 h 14 v 9 h -14 Z`,
        fill: 'none',
        stroke: '#3b2416',
        strokeWidth: 2.2,
      },
      {
        d: `M 47 49 L 53 49`,
        fill: 'none',
        stroke: '#3b2416',
        strokeWidth: 2.2,
      },
    ],
  },
];
