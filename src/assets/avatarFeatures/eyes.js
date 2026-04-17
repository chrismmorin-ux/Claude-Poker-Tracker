/**
 * eyes.js — Eye shapes (PEO-1)
 *
 * Iris color via --eye CSS custom property; whites always #ffffff;
 * eyelid/lash lines always #1b1714 (near-black) for legibility.
 */

const WHITE = '#ffffff';
const LID = '#1b1714';

// Eye x-positions (left/right as viewer sees) and shared y-position.
const LEFT_X = 40;
const RIGHT_X = 60;
const EYE_Y = 50;

const makeRoundEye = (cx) => [
  { d: `M ${cx - 5} ${EYE_Y} a 5 3.5 0 1 0 10 0 a 5 3.5 0 1 0 -10 0 Z`, fill: WHITE },
  { d: `M ${cx - 2} ${EYE_Y} a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0 Z`, fill: 'var(--eye)' },
  { d: `M ${cx - 0.8} ${EYE_Y - 0.6} a 0.8 0.8 0 1 0 1.6 0 a 0.8 0.8 0 1 0 -1.6 0 Z`, fill: '#0b0908' },
];

const makeNarrowEye = (cx) => [
  { d: `M ${cx - 5} ${EYE_Y} q 5 -2 10 0 q -5 2 -10 0 Z`, fill: WHITE },
  { d: `M ${cx - 2} ${EYE_Y - 0.5} a 2 1.5 0 1 0 4 0 a 2 1.5 0 1 0 -4 0 Z`, fill: 'var(--eye)' },
];

const makeAlmondEye = (cx) => [
  {
    d: `
      M ${cx - 5.5} ${EYE_Y + 0.5}
      Q ${cx} ${EYE_Y - 3.5}, ${cx + 5.5} ${EYE_Y + 0.5}
      Q ${cx} ${EYE_Y + 3.5}, ${cx - 5.5} ${EYE_Y + 0.5}
      Z
    `,
    fill: WHITE,
  },
  { d: `M ${cx - 1.8} ${EYE_Y} a 1.8 1.8 0 1 0 3.6 0 a 1.8 1.8 0 1 0 -3.6 0 Z`, fill: 'var(--eye)' },
];

const makeClosedEye = (cx) => [
  {
    d: `M ${cx - 5} ${EYE_Y} q 5 -1.5 10 0`,
    fill: 'none',
    stroke: LID,
    strokeWidth: 1,
    strokeLinecap: 'round',
  },
];

export default [
  {
    id: 'eyes.round',
    label: 'Round',
    paths: [...makeRoundEye(LEFT_X), ...makeRoundEye(RIGHT_X)],
  },
  {
    id: 'eyes.narrow',
    label: 'Narrow',
    paths: [...makeNarrowEye(LEFT_X), ...makeNarrowEye(RIGHT_X)],
  },
  {
    id: 'eyes.almond',
    label: 'Almond',
    paths: [...makeAlmondEye(LEFT_X), ...makeAlmondEye(RIGHT_X)],
  },
  {
    id: 'eyes.closed',
    label: 'Closed',
    paths: [...makeClosedEye(LEFT_X), ...makeClosedEye(RIGHT_X)],
  },
];
