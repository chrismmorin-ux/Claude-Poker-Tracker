/**
 * seedRangeTestData.js - Seed players with position-aware behavior, true ranges, and session record
 *
 * Creates 6 player archetypes with realistic hand histories for testing
 * the Bayesian Range Engine. Each player has:
 * - TRUE range strings per position/action (for validation)
 * - Position-aware preflop behavior frequencies
 * - Showdown cards sampled from true ranges
 * - A real session record in IndexedDB
 *
 * Usage:
 *   window.__seedRangeData()    // Populate DB
 *   window.__clearRangeData()   // Remove seed data
 */

import { createPlayer, getAllPlayers, createSession, endSession, updateSession, deleteRangeProfile } from './persistence/index';
import { initDB, GUEST_USER_ID } from './persistence/database';
import { parseRangeString, rangeIndex } from './pokerCore/rangeMatrix';

// =============================================================================
// CARD HELPERS
// =============================================================================

const SUIT_CHARS = ['\u2660', '\u2665', '\u2666', '\u2663'];
const RANK_CHARS = 'AKQJT98765432';

/** Make a card string: makeCard('A', 0) => 'A♠' */
const makeCard = (rank, suitIdx) => `${rank}${SUIT_CHARS[suitIdx]}`;

// =============================================================================
// POSITION MAPPING (5-category)
// =============================================================================

const offsetToCategory = (offset) => {
  if (offset === 1) return 'SB';
  if (offset === 2) return 'BB';
  if (offset === 3 || offset === 4) return 'EARLY';
  if (offset === 5 || offset === 6) return 'MIDDLE';
  return 'LATE'; // 0 (BTN), 7 (HJ), 8 (CO)
};

// =============================================================================
// PLAYER ARCHETYPES WITH TRUE RANGES
// =============================================================================

const ARCHETYPES = [
  {
    name: 'Tight Mike',
    ethnicity: 'White/Caucasian',
    build: 'Average',
    styleTags: ['TAG (Tight-Aggressive)'],
    notes: 'Seed: TAG/Nit. Opens only premiums EP, widens LP. Never limps. 3bets QQ+ only.',
    seat: '2',
    behavior: {
      EARLY:  { fold: 0.88, limp: 0, open: 0.10, coldCall: 0.02, threeBet: 0.02 },
      MIDDLE: { fold: 0.82, limp: 0, open: 0.14, coldCall: 0.03, threeBet: 0.03 },
      LATE:   { fold: 0.72, limp: 0, open: 0.20, coldCall: 0.05, threeBet: 0.03 },
      SB:     { fold: 0.78, limp: 0, open: 0.15, coldCall: 0.05, threeBet: 0.02 },
      BB:     { fold: 0.65, limp: 0, open: 0,    coldCall: 0.30, threeBet: 0.05 },
    },
    trueRanges: {
      EARLY:  { open: 'AA,KK,QQ,JJ,TT,AKs,AQs,AKo', threeBet: 'AA,KK', coldCall: 'AQo' },
      MIDDLE: { open: 'AA,KK,QQ,JJ,TT,99,AKs,AQs,AJs,AKo,AQo', threeBet: 'AA,KK,QQ', coldCall: 'AJo,KQs' },
      LATE:   { open: 'AA,KK,QQ,JJ,TT,99,88,77,AKs,AQs,AJs,ATs,KQs,KJs,AKo,AQo,AJo,KQo', threeBet: 'AA,KK,QQ', coldCall: 'ATo,KJo,QJs,JTs' },
      SB:     { open: 'AA,KK,QQ,JJ,TT,99,AKs,AQs,AJs,AKo,AQo', threeBet: 'AA,KK', coldCall: 'AJo,KQs,QJs' },
      BB:     { coldCall: 'AA,KK,QQ,JJ,TT,99,88,77,AKs,AQs,AJs,ATs,KQs,KJs,QJs,JTs,AKo,AQo,AJo', threeBet: 'AA,KK,QQ' },
    },
    limpBehavior: null,
  },
  {
    name: 'Loose Larry',
    ethnicity: 'Hispanic/Latino',
    build: 'Muscular',
    styleTags: ['LAG (Loose-Aggressive)'],
    notes: 'Seed: LAG. Opens wide all positions, 3bets light. Occasional EP limp with SCs.',
    seat: '3',
    behavior: {
      EARLY:  { fold: 0.60, limp: 0.05, open: 0.28, coldCall: 0.04, threeBet: 0.08 },
      MIDDLE: { fold: 0.50, limp: 0.03, open: 0.35, coldCall: 0.05, threeBet: 0.10 },
      LATE:   { fold: 0.35, limp: 0.02, open: 0.45, coldCall: 0.06, threeBet: 0.12 },
      SB:     { fold: 0.45, limp: 0.05, open: 0.35, coldCall: 0.05, threeBet: 0.10 },
      BB:     { fold: 0.40, limp: 0,    open: 0,    coldCall: 0.45, threeBet: 0.15 },
    },
    trueRanges: {
      EARLY:  { open: 'AA,KK,QQ,JJ,TT,99,88,77,66,AKs,AQs,AJs,ATs,A9s,A8s,A5s,KQs,KJs,KTs,QJs,QTs,JTs,T9s,98s,87s,AKo,AQo,AJo,ATo,KQo,KJo', limp: '65s,54s,76s,43s', threeBet: 'AA,KK,QQ,JJ,AKs,AQs,AKo', coldCall: 'A9o,KTo,QJo,JTo' },
      MIDDLE: { open: 'AA,KK,QQ,JJ,TT,99,88,77,66,55,AKs,AQs,AJs,ATs,A9s,A8s,A7s,A5s,A4s,KQs,KJs,KTs,K9s,QJs,QTs,Q9s,JTs,J9s,T9s,98s,87s,76s,AKo,AQo,AJo,ATo,A9o,KQo,KJo,KTo,QJo', limp: '54s,43s', threeBet: 'AA,KK,QQ,JJ,TT,AKs,AQs,AKo,AQo', coldCall: 'A8o,K9o,QTo,JTo' },
      LATE:   { open: 'AA,KK,QQ,JJ,TT,99,88,77,66,55,44,33,22,AKs,AQs,AJs,ATs,A9s,A8s,A7s,A6s,A5s,A4s,A3s,A2s,KQs,KJs,KTs,K9s,K8s,K7s,QJs,QTs,Q9s,Q8s,JTs,J9s,J8s,T9s,T8s,98s,97s,87s,86s,76s,75s,65s,54s,AKo,AQo,AJo,ATo,A9o,A8o,A7o,KQo,KJo,KTo,K9o,QJo,QTo,Q9o,JTo,J9o,T9o', limp: '43s,32s', threeBet: 'AA,KK,QQ,JJ,TT,AKs,AQs,AJs,AKo,AQo', coldCall: 'A6o,K8o,Q9o' },
      SB:     { open: 'AA,KK,QQ,JJ,TT,99,88,77,66,55,AKs,AQs,AJs,ATs,A9s,A8s,A7s,A5s,KQs,KJs,KTs,K9s,QJs,QTs,Q9s,JTs,J9s,T9s,98s,87s,76s,AKo,AQo,AJo,ATo,A9o,KQo,KJo,KTo,QJo', limp: '65s,54s,43s', threeBet: 'AA,KK,QQ,JJ,AKs,AQs,AKo', coldCall: 'A8o,K9o,QTo' },
      BB:     { coldCall: 'AA,KK,QQ,JJ,TT,99,88,77,66,55,44,AKs,AQs,AJs,ATs,A9s,A8s,A7s,A5s,KQs,KJs,KTs,K9s,QJs,QTs,Q9s,JTs,J9s,T9s,98s,87s,76s,65s,AKo,AQo,AJo,ATo,A9o,A8o,KQo,KJo,KTo,QJo,QTo,JTo,T9o', threeBet: 'AA,KK,QQ,JJ,TT,AKs,AQs,AJs,ATs,AKo,AQo' },
    },
    limpBehavior: { limpFold: 0.10, limpCall: 0.80, limpRaise: 0.10 },
  },
  {
    name: 'Limpy Lou',
    ethnicity: 'Asian',
    build: 'Heavy',
    styleTags: ['Fish', 'Passive'],
    notes: 'Seed: passive fish. Limps ~40% all positions. Opens only AA/KK. Limp range is CAPPED.',
    seat: '4',
    behavior: {
      EARLY:  { fold: 0.55, limp: 0.38, open: 0.04, coldCall: 0.03, threeBet: 0 },
      MIDDLE: { fold: 0.50, limp: 0.42, open: 0.04, coldCall: 0.04, threeBet: 0 },
      LATE:   { fold: 0.45, limp: 0.45, open: 0.05, coldCall: 0.05, threeBet: 0 },
      SB:     { fold: 0.40, limp: 0.50, open: 0.05, coldCall: 0.05, threeBet: 0 },
      BB:     { fold: 0.30, limp: 0,    open: 0,    coldCall: 0.65, threeBet: 0.05 },
    },
    trueRanges: {
      EARLY:  { open: 'AA,KK', limp: 'QQ,JJ,TT,99,88,77,66,55,44,33,22,AQs,AJs,ATs,A9s,A8s,A7s,A6s,A5s,KQs,KJs,KTs,QJs,QTs,JTs,T9s,98s,87s,76s,AQo,AJo,ATo,A9o,KQo,KJo,KTo,QJo,J7o,T4s,Q8o,93s,K4o', coldCall: 'AKs,AKo' },
      MIDDLE: { open: 'AA,KK', limp: 'QQ,JJ,TT,99,88,77,66,55,44,33,22,AQs,AJs,ATs,A9s,A8s,A7s,A6s,A5s,A4s,KQs,KJs,KTs,K9s,QJs,QTs,Q9s,JTs,J9s,T9s,98s,87s,76s,65s,AQo,AJo,ATo,A9o,A8o,KQo,KJo,KTo,QJo,QTo,J7o,T4s,Q8o,93s,K4o', coldCall: 'AKs,AKo,AQo' },
      LATE:   { open: 'AA,KK', limp: 'QQ,JJ,TT,99,88,77,66,55,44,33,22,AQs,AJs,ATs,A9s,A8s,A7s,A6s,A5s,A4s,A3s,KQs,KJs,KTs,K9s,K8s,QJs,QTs,Q9s,Q8s,JTs,J9s,J8s,T9s,T8s,98s,97s,87s,86s,76s,75s,65s,54s,AQo,AJo,ATo,A9o,A8o,A7o,KQo,KJo,KTo,K9o,QJo,QTo,Q9o,JTo,J9o,T9o,J7o,Q8o', coldCall: 'AKs,AKo,AQo,AQs' },
      SB:     { open: 'AA,KK', limp: 'QQ,JJ,TT,99,88,77,66,55,44,33,AQs,AJs,ATs,A9s,A8s,A7s,KQs,KJs,KTs,K9s,QJs,QTs,Q9s,JTs,J9s,T9s,98s,87s,76s,65s,AQo,AJo,ATo,A9o,KQo,KJo,KTo,QJo,93s,82o', coldCall: 'AKs,AKo,AQo' },
      BB:     { coldCall: 'AA,KK,QQ,JJ,TT,99,88,77,66,55,44,33,22,AKs,AQs,AJs,ATs,A9s,A8s,A7s,A6s,A5s,KQs,KJs,KTs,K9s,K8s,QJs,QTs,Q9s,Q8s,JTs,J9s,J8s,T9s,T8s,98s,97s,87s,86s,76s,65s,AKo,AQo,AJo,ATo,A9o,A8o,A7o,KQo,KJo,KTo,K9o,QJo,QTo,Q9o,JTo,J9o,T9o,98o,87o,T5o,J7o,Q8o,93s,82o,K4o', threeBet: 'AA,KK' },
    },
    limpBehavior: { limpFold: 0.15, limpCall: 0.83, limpRaise: 0.02 },
  },
  {
    name: 'Trapping Tom',
    ethnicity: 'Black/African American',
    build: 'Average',
    styleTags: ['Tricky'],
    notes: 'Seed: deceptive trapper. Mixes premiums between limp and open. Limp-reraises.',
    seat: '6',
    behavior: {
      EARLY:  { fold: 0.72, limp: 0.08, open: 0.15, coldCall: 0.03, threeBet: 0.02 },
      MIDDLE: { fold: 0.65, limp: 0.10, open: 0.18, coldCall: 0.04, threeBet: 0.03 },
      LATE:   { fold: 0.55, limp: 0.12, open: 0.22, coldCall: 0.06, threeBet: 0.05 },
      SB:     { fold: 0.60, limp: 0.15, open: 0.15, coldCall: 0.05, threeBet: 0.05 },
      BB:     { fold: 0.50, limp: 0,    open: 0,    coldCall: 0.40, threeBet: 0.10 },
    },
    trueRanges: {
      EARLY:  { open: 'JJ,TT,99,AKs,AQs,AJs,AKo', limp: 'AA,KK,QQ,76s,65s,54s', threeBet: 'AA,KK', coldCall: 'AQo,KQs' },
      MIDDLE: { open: 'JJ,TT,99,88,AKs,AQs,AJs,ATs,KQs,AKo,AQo', limp: 'AA,KK,QQ,76s,65s,54s,87s,98s', threeBet: 'AA,KK,QQ', coldCall: 'AJo,KJo,QJs' },
      LATE:   { open: 'JJ,TT,99,88,77,AKs,AQs,AJs,ATs,A9s,KQs,KJs,QJs,JTs,AKo,AQo,AJo,KQo', limp: 'AA,KK,QQ,76s,65s,54s,87s,98s,T9s', threeBet: 'AA,KK,QQ,AKs', coldCall: 'ATo,KTo,QTo,JTo' },
      SB:     { open: 'JJ,TT,99,88,AKs,AQs,AJs,ATs,KQs,KJs,AKo,AQo', limp: 'AA,KK,QQ,76s,65s,54s,87s', threeBet: 'AA,KK', coldCall: 'AJo,KJo,QJs,JTs' },
      BB:     { coldCall: 'JJ,TT,99,88,77,66,55,AKs,AQs,AJs,ATs,A9s,KQs,KJs,KTs,QJs,QTs,JTs,T9s,98s,AKo,AQo,AJo,ATo,KQo,KJo', threeBet: 'AA,KK,QQ,AKs' },
    },
    limpBehavior: { limpFold: 0.10, limpCall: 0.60, limpRaise: 0.30 },
  },
  {
    name: 'GTO Gary',
    ethnicity: 'White/Caucasian',
    build: 'Slim',
    styleTags: ['TAG (Tight-Aggressive)'],
    notes: 'Seed: near-GTO player. Position-aware, no limp range, balanced.',
    seat: '7',
    behavior: {
      EARLY:  { fold: 0.85, limp: 0, open: 0.12, coldCall: 0.02, threeBet: 0.03 },
      MIDDLE: { fold: 0.78, limp: 0, open: 0.16, coldCall: 0.03, threeBet: 0.04 },
      LATE:   { fold: 0.60, limp: 0, open: 0.28, coldCall: 0.05, threeBet: 0.07 },
      SB:     { fold: 0.65, limp: 0, open: 0.22, coldCall: 0.06, threeBet: 0.07 },
      BB:     { fold: 0.50, limp: 0, open: 0,    coldCall: 0.38, threeBet: 0.12 },
    },
    trueRanges: {
      EARLY:  { open: 'AA,KK,QQ,JJ,TT,99,AKs,AQs,AJs,ATs,KQs,AKo,AQo', threeBet: 'AA,KK,QQ,AKs', coldCall: 'AJo,KQo' },
      MIDDLE: { open: 'AA,KK,QQ,JJ,TT,99,88,AKs,AQs,AJs,ATs,A9s,KQs,KJs,KTs,QJs,QTs,JTs,AKo,AQo,AJo,KQo', threeBet: 'AA,KK,QQ,JJ,AKs,AQs', coldCall: 'ATo,KJo,QJo' },
      LATE:   { open: 'AA,KK,QQ,JJ,TT,99,88,77,66,55,44,AKs,AQs,AJs,ATs,A9s,A8s,A7s,A5s,KQs,KJs,KTs,K9s,QJs,QTs,Q9s,JTs,J9s,T9s,98s,87s,76s,AKo,AQo,AJo,ATo,A9o,KQo,KJo,KTo,QJo', threeBet: 'AA,KK,QQ,JJ,TT,AKs,AQs,AJs,AKo', coldCall: 'A8o,K9o,QTo,JTo,T9o' },
      SB:     { open: 'AA,KK,QQ,JJ,TT,99,88,77,AKs,AQs,AJs,ATs,A9s,A8s,KQs,KJs,KTs,K9s,QJs,QTs,JTs,J9s,T9s,98s,87s,AKo,AQo,AJo,ATo,KQo,KJo', threeBet: 'AA,KK,QQ,JJ,AKs,AQs,AKo', coldCall: 'A9o,KTo,QJo,JTo' },
      BB:     { coldCall: 'TT,99,88,77,66,55,44,33,22,AKs,AQs,AJs,ATs,A9s,A8s,A7s,A5s,KQs,KJs,KTs,K9s,K8s,QJs,QTs,Q9s,Q8s,JTs,J9s,J8s,T9s,T8s,98s,97s,87s,86s,76s,65s,AKo,AQo,AJo,ATo,A9o,A8o,KQo,KJo,KTo,QJo,QTo,JTo,T9o', threeBet: 'AA,KK,QQ,JJ,TT,AKs,AQs,AJs,AKo,AQo' },
    },
    limpBehavior: null,
  },
  {
    name: 'Station Sarah',
    ethnicity: 'Middle Eastern',
    build: 'Slim',
    styleTags: ['Calling Station'],
    notes: 'Seed: calling station. Cold-calls raises way too wide. Limp-calls everything. Never folds to cbets.',
    seat: '8',
    behavior: {
      EARLY:  { fold: 0.55, limp: 0.25, open: 0.05, coldCall: 0.14, threeBet: 0.01 },
      MIDDLE: { fold: 0.45, limp: 0.30, open: 0.05, coldCall: 0.19, threeBet: 0.01 },
      LATE:   { fold: 0.35, limp: 0.30, open: 0.08, coldCall: 0.25, threeBet: 0.02 },
      SB:     { fold: 0.30, limp: 0.35, open: 0.05, coldCall: 0.28, threeBet: 0.02 },
      BB:     { fold: 0.25, limp: 0,    open: 0,    coldCall: 0.72, threeBet: 0.03 },
    },
    trueRanges: {
      EARLY:  { open: 'AA,KK', limp: 'QQ,JJ,TT,99,88,77,66,55,AQs,AJs,ATs,A9s,A8s,KQs,KJs,QJs,JTs,T9s,98s,87s,AQo,AJo,ATo,KQo,KJo,J4s', coldCall: 'AA,KK,QQ,JJ,TT,99,88,AKs,AQs,AJs,ATs,A9s,KQs,KJs,QJs,JTs,AKo,AQo,AJo,ATo,KQo,J8s,64s', threeBet: 'AA,KK' },
      MIDDLE: { open: 'AA,KK', limp: 'QQ,JJ,TT,99,88,77,66,55,44,AQs,AJs,ATs,A9s,A8s,A7s,KQs,KJs,KTs,QJs,QTs,JTs,J9s,T9s,98s,87s,76s,AQo,AJo,ATo,A9o,KQo,KJo,KTo,QJo,Q3o,J4s', coldCall: 'AA,KK,QQ,JJ,TT,99,88,77,AKs,AQs,AJs,ATs,A9s,A8s,KQs,KJs,KTs,QJs,QTs,JTs,T9s,98s,AKo,AQo,AJo,ATo,A9o,KQo,KJo,KTo,QJo,64s', threeBet: 'AA,KK' },
      LATE:   { open: 'AA,KK,QQ', limp: 'JJ,TT,99,88,77,66,55,44,33,AQs,AJs,ATs,A9s,A8s,A7s,A6s,A5s,KQs,KJs,KTs,K9s,QJs,QTs,Q9s,JTs,J9s,J8s,T9s,T8s,98s,97s,87s,86s,76s,75s,65s,54s,AQo,AJo,ATo,A9o,A8o,KQo,KJo,KTo,K9o,QJo,QTo,Q9o,JTo,J9o,T9o,Q3o', coldCall: 'AA,KK,QQ,JJ,TT,99,88,77,66,AKs,AQs,AJs,ATs,A9s,A8s,A7s,KQs,KJs,KTs,K9s,QJs,QTs,Q9s,JTs,J9s,T9s,T8s,98s,87s,76s,AKo,AQo,AJo,ATo,A9o,A8o,KQo,KJo,KTo,K9o,QJo,QTo,JTo,J9o,T9o,97o,J8s,64s', threeBet: 'AA,KK,QQ' },
      SB:     { open: 'AA,KK', limp: 'QQ,JJ,TT,99,88,77,66,55,44,AQs,AJs,ATs,A9s,A8s,A7s,KQs,KJs,KTs,K9s,QJs,QTs,Q9s,JTs,J9s,T9s,98s,87s,76s,65s,AQo,AJo,ATo,A9o,A8o,KQo,KJo,KTo,QJo,QTo,82o', coldCall: 'AA,KK,QQ,JJ,TT,99,88,77,66,AKs,AQs,AJs,ATs,A9s,A8s,KQs,KJs,KTs,K9s,QJs,QTs,Q9s,JTs,J9s,T9s,98s,87s,76s,AKo,AQo,AJo,ATo,A9o,A8o,KQo,KJo,KTo,K9o,QJo,QTo,JTo,J9o', threeBet: 'AA,KK' },
      BB:     { coldCall: 'AA,KK,QQ,JJ,TT,99,88,77,66,55,44,33,22,AKs,AQs,AJs,ATs,A9s,A8s,A7s,A6s,A5s,A4s,A3s,KQs,KJs,KTs,K9s,K8s,K7s,QJs,QTs,Q9s,Q8s,Q7s,JTs,J9s,J8s,J7s,T9s,T8s,T7s,98s,97s,87s,86s,76s,75s,65s,64s,54s,53s,43s,AKo,AQo,AJo,ATo,A9o,A8o,A7o,A6o,KQo,KJo,KTo,K9o,QJo,QTo,Q9o,JTo,J9o,T9o,98o,87o,76o,T5o,J7o,Q8o,82o', threeBet: 'AA,KK' },
    },
    limpBehavior: { limpFold: 0.05, limpCall: 0.93, limpRaise: 0.02 },
  },
];

// =============================================================================
// HAND GENERATION ENGINE
// =============================================================================

const MY_SEAT = 5;
const HANDS_PER_PLAYER_POSITION = 12;
const SEED_VENUE = 'Seed Table';

let _seed = 42;
const seededRandom = () => {
  _seed = (_seed * 1664525 + 1013904223) & 0x7fffffff;
  return _seed / 0x7fffffff;
};
const resetSeed = () => { _seed = 42; };

/**
 * Pick an action based on position behavior probabilities.
 */
const pickAction = (positionBehavior, facedRaise) => {
  const r = seededRandom();
  const b = positionBehavior;

  if (facedRaise) {
    const foldProb = b.fold / (b.fold + b.coldCall + b.threeBet);
    const callProb = b.coldCall / (b.fold + b.coldCall + b.threeBet);
    if (r < foldProb) return 'fold';
    if (r < foldProb + callProb) return 'call';
    return 'raise';
  }

  let cumulative = 0;
  cumulative += b.fold;
  if (r < cumulative) return 'fold';
  cumulative += b.limp;
  if (r < cumulative) return 'call';
  cumulative += b.open;
  if (r < cumulative) return 'raise';
  return 'fold';
};

const pickLimpResponse = (limpBehavior) => {
  if (!limpBehavior) return 'call';
  const r = seededRandom();
  if (r < limpBehavior.limpFold) return 'fold';
  if (r < limpBehavior.limpFold + limpBehavior.limpCall) return 'call';
  return 'raise';
};

/**
 * Sample a hand (as card strings) from an archetype's true ranges for a given position/action.
 * Returns [card1, card2] or null if no range defined.
 */
const sampleHandFromRange = (arch, position, action) => {
  const rangeStr = arch.trueRanges?.[position]?.[action];
  if (!rangeStr) return null;

  const range = parseRangeString(rangeStr);
  // Collect non-zero indices
  const candidates = [];
  for (let i = 0; i < 169; i++) {
    if (range[i] > 0) candidates.push(i);
  }
  if (candidates.length === 0) return null;

  const idx = candidates[Math.floor(seededRandom() * candidates.length)];
  const row = Math.floor(idx / 13);
  const col = idx % 13;

  // Convert to rank chars (internal: 0=2, 12=A)
  const rankChars = '23456789TJQKA';

  if (row === col) {
    // Pair: different suits
    const s1 = Math.floor(seededRandom() * 4);
    let s2 = (s1 + 1 + Math.floor(seededRandom() * 3)) % 4;
    return [makeCard(rankChars[row], s1), makeCard(rankChars[col], s2)];
  }

  const high = Math.max(row, col);
  const low = Math.min(row, col);
  const suited = row > col; // upper triangle = suited in internal format

  if (suited) {
    const s = Math.floor(seededRandom() * 4);
    return [makeCard(rankChars[high], s), makeCard(rankChars[low], s)];
  }
  // Offsuit
  const s1 = Math.floor(seededRandom() * 4);
  let s2 = (s1 + 1 + Math.floor(seededRandom() * 3)) % 4;
  return [makeCard(rankChars[high], s1), makeCard(rankChars[low], s2)];
};

/**
 * Map primitive action + context to range action key.
 */
const mapToRangeAction = (primitiveAction, facedRaise) => {
  if (primitiveAction === 'fold') return 'fold';
  if (facedRaise) {
    return primitiveAction === 'call' ? 'coldCall' : 'threeBet';
  }
  return primitiveAction === 'call' ? 'limp' : 'open';
};

const generateBoard = (seed) => {
  const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  const used = new Set();
  const cards = [];
  let s = seed;

  while (cards.length < 5) {
    s = (s * 7 + 13) & 0xfff;
    const rankIdx = s % 13;
    const suitIdx = (s >> 4) % 4;
    const card = makeCard(ranks[rankIdx], suitIdx);
    if (!used.has(card)) {
      used.add(card);
      cards.push(card);
    }
  }
  return cards;
};

const generateAllHands = (playerIds, sessionId) => {
  resetSeed();
  const hands = [];
  let handNumber = 0;

  const seatPlayers = { [String(MY_SEAT)]: 'hero' };
  for (const arch of ARCHETYPES) {
    seatPlayers[arch.seat] = playerIds[arch.name];
  }

  const totalHands = HANDS_PER_PLAYER_POSITION * 5;
  for (let h = 0; h < totalHands; h++) {
    const dealerButton = (h % 9) + 1;
    handNumber++;

    const seatActions = { preflop: {}, flop: {}, turn: {}, river: {} };
    const actionSequence = [];
    const allPlayerCards = {};
    let order = 0;
    let anyRaiseSeen = false;
    let currentBet = 2; // BB

    const playerPositions = {};
    for (const arch of ARCHETYPES) {
      const seatNum = Number(arch.seat);
      const offset = (seatNum - dealerButton + 9) % 9;
      playerPositions[arch.name] = offsetToCategory(offset);
    }

    for (const arch of ARCHETYPES) {
      const seat = arch.seat;
      const seatNum = Number(seat);
      const position = playerPositions[arch.name];
      const posBehavior = arch.behavior[position];
      if (!posBehavior) continue;

      const facedRaise = anyRaiseSeen;
      const action = pickAction(posBehavior, facedRaise);

      seatActions.preflop[seat] = [action];
      actionSequence.push({
        seat: seatNum, action, street: 'preflop', order: ++order,
      });

      if (action === 'raise') {
        anyRaiseSeen = true;
        const isThreeBet = facedRaise;
        const raiseAmount = isThreeBet ? 25 : 8;
        actionSequence[actionSequence.length - 1].amount = raiseAmount;
        actionSequence[actionSequence.length - 1].potRelative = isThreeBet ? 3.0 : 4.0;
        currentBet = raiseAmount;
      } else if (action === 'call') {
        actionSequence[actionSequence.length - 1].amount = currentBet;
      }

      // Sample cards from true range for non-fold actions
      if (action !== 'fold') {
        const rangeAction = mapToRangeAction(action, facedRaise);
        const cards = sampleHandFromRange(arch, position, rangeAction);
        // ~20% showdown rate
        if (cards && seededRandom() < 0.20) {
          allPlayerCards[seat] = cards;
        }
      }

      // Limp sub-actions
      if (action === 'call' && !facedRaise && !anyRaiseSeen) {
        if (seededRandom() < 0.30 && arch.limpBehavior) {
          const response = pickLimpResponse(arch.limpBehavior);
          seatActions.preflop[seat].push(response);
          actionSequence.push({
            seat: seatNum, action: response, street: 'preflop', order: ++order,
          });
        }
      }
    }

    // Hero always plays
    seatActions.preflop[String(MY_SEAT)] = ['call'];
    actionSequence.push({
      seat: MY_SEAT, action: 'call', street: 'preflop', order: ++order,
      amount: currentBet,
    });

    // Postflop actions for non-folded players
    const activePlayers = Object.entries(seatActions.preflop)
      .filter(([, actions]) => actions[0] !== 'fold')
      .map(([seat]) => seat);

    if (activePlayers.length >= 2) {
      for (const street of ['flop', 'turn', 'river']) {
        if (street === 'turn' && seededRandom() < 0.25) break;
        if (street === 'river' && seededRandom() < 0.35) break;

        let streetBet = 0;
        for (const seat of activePlayers) {
          const r = seededRandom();
          let action;
          if (r < 0.35) action = 'check';
          else if (r < 0.60) action = 'bet';
          else if (r < 0.80) action = 'call';
          else action = 'fold';

          seatActions[street][seat] = [action];
          const entry = { seat: Number(seat), action, street, order: ++order };

          if (action === 'bet') {
            const potFractions = [0.33, 0.50, 0.66, 0.75, 1.0];
            const fraction = potFractions[Math.floor(seededRandom() * potFractions.length)];
            entry.amount = Math.round(fraction * 20);
            entry.potRelative = fraction;
            streetBet = entry.amount;
          } else if (action === 'call' && streetBet > 0) {
            entry.amount = streetBet;
          }

          actionSequence.push(entry);
        }
      }
    }

    const board = generateBoard(h * 37 + 7);

    hands.push({
      gameState: {
        currentStreet: 'showdown',
        dealerButtonSeat: dealerButton,
        mySeat: MY_SEAT,
        blindsPosted: { sb: 1, bb: 2 },
        seatActions,
        actionSequence,
        absentSeats: [],
      },
      cardState: {
        communityCards: board,
        holeCards: ['A\u2660', 'K\u2665'],
        holeCardsVisible: true,
        allPlayerCards,
      },
      seatPlayers: { ...seatPlayers },
      timestamp: Date.now() - (totalHands - h) * 120000,
      version: '1.3.0',
      userId: GUEST_USER_ID,
      sessionId,
      sessionHandNumber: handNumber,
      handDisplayId: `S${sessionId}-H${handNumber}`,
    });
  }

  return hands;
};

// =============================================================================
// SEED / CLEAR
// =============================================================================

export const seedRangeTestData = async () => {
  console.log('[seedRangeData] Creating 6 archetype players with position-aware behavior...');

  // 1. Create a real session record
  const sessionId = await createSession({
    venue: SEED_VENUE,
    gameType: '1/2',
    buyIn: 200,
  });
  console.log(`  Created session: ${sessionId}`);

  // 2. Create players
  const playerIds = {};
  for (const arch of ARCHETYPES) {
    const playerId = await createPlayer({
      name: arch.name,
      ethnicity: arch.ethnicity,
      build: arch.build,
      styleTags: arch.styleTags,
      notes: arch.notes,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    playerIds[arch.name] = playerId;
    console.log(`  Created ${arch.name} (seat ${arch.seat}, ID: ${playerId})`);
  }

  // 3. Generate hands with session ID
  const hands = generateAllHands(playerIds, sessionId);

  // 4. Save hands to IndexedDB
  const db = await initDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['hands'], 'readwrite');
    const store = tx.objectStore('hands');
    for (const hand of hands) {
      store.add(hand);
    }
    tx.oncomplete = () => {
      console.log(`[seedRangeData] Saved ${hands.length} hands`);
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
  });
  db.close();

  // 5. Update session with hand count and end it
  await updateSession(sessionId, { handCount: hands.length });
  await endSession(sessionId, 400);

  // 6. Print summary
  console.log('\n=== SEED DATA SUMMARY ===');
  console.log(`Total hands: ${hands.length}`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`Session venue: ${SEED_VENUE}`);
  console.log('\nPlayer archetypes with TRUE ranges:');

  for (const arch of ARCHETYPES) {
    const id = playerIds[arch.name];
    console.log(`\n  ${arch.name} (Seat ${arch.seat}, ID: ${id})`);
    console.log(`    Style: ${arch.styleTags.join(', ')}`);
    console.log(`    Behavior by position:`);
    for (const [pos, b] of Object.entries(arch.behavior)) {
      const vpip = Math.round((1 - b.fold) * 100);
      const pfr = Math.round((b.open + b.threeBet) * 100);
      const limp = Math.round((b.limp || 0) * 100);
      console.log(`      ${pos.padEnd(6)}: VPIP ~${vpip}%, PFR ~${pfr}%, Limp ~${limp}%`);
    }
    if (arch.trueRanges) {
      console.log(`    True ranges defined for ${Object.keys(arch.trueRanges).length} positions`);
    }
  }

  let showdownCount = 0;
  for (const hand of hands) {
    showdownCount += Object.keys(hand.cardState.allPlayerCards).length;
  }
  console.log(`\nTotal showdown observations: ${showdownCount}`);

  return { playerIds, handCount: hands.length, sessionId };
};

export const clearRangeTestData = async () => {
  console.log('[clearRangeData] Removing seed data...');

  // 1. Find and delete seed players + their range profiles
  const allPlayers = await getAllPlayers();
  const seedNames = new Set(ARCHETYPES.map(a => a.name));

  for (const player of allPlayers) {
    if (seedNames.has(player.name)) {
      // Delete range profile first
      try {
        await deleteRangeProfile(player.playerId);
        console.log(`  Deleted range profile for: ${player.name}`);
      } catch {
        // Profile may not exist
      }
      const { deletePlayer } = await import('./persistence/index');
      await deletePlayer(player.playerId);
      console.log(`  Deleted player: ${player.name}`);
    }
  }

  // 2. Find and delete seed session + hands
  const { getAllSessions } = await import('./persistence/index');
  const sessions = await getAllSessions();
  const seedSessions = sessions.filter(s => s.venue === SEED_VENUE);

  const db = await initDB();
  for (const session of seedSessions) {
    // Delete hands for this session
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['hands'], 'readwrite');
      const store = tx.objectStore('hands');
      const index = store.index('sessionId');
      const req = index.getAllKeys(session.sessionId);
      req.onsuccess = () => {
        const count = req.result.length;
        for (const key of req.result) {
          store.delete(key);
        }
        console.log(`  Deleted ${count} hands for session ${session.sessionId}`);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });

    // Delete session record
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions'], 'readwrite');
      const store = tx.objectStore('sessions');
      store.delete(session.sessionId);
      tx.oncomplete = () => {
        console.log(`  Deleted session: ${session.sessionId}`);
        resolve();
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  }
  db.close();

  console.log('[clearRangeData] Done!');
};

// Expose on window for console access
if (typeof window !== 'undefined') {
  window.__seedRangeData = seedRangeTestData;
  window.__clearRangeData = clearRangeTestData;
}

export { ARCHETYPES };
