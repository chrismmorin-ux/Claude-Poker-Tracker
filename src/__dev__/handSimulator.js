/**
 * handSimulator.js - Realistic hand simulator with range-based decisions
 *
 * Deals real cards, makes range-based preflop decisions, and equity-driven
 * postflop decisions with mixing and board-texture awareness.
 *
 * Usage (dev console):
 *   await window.__sim(5)        // Simulate 5 hands
 *   await window.__simStatus()   // Print per-player stats
 *   await window.__simClear()    // Remove all sim data
 */

import { encodeCard, cardRank, cardSuit, TOTAL_CARDS } from '../utils/pokerCore/cardParser';
import { evaluate5, bestFiveFromSeven } from '../utils/pokerCore/handEvaluator';
import { analyzeBoardTexture } from '../utils/pokerCore/boardTexture';
import { parseRangeString, rangeIndex } from '../utils/pokerCore/rangeMatrix';
import { ARCHETYPES } from './seedRangeTestData';
import { createPlayer, createSession, updateSession, getAllPlayers, deletePlayer, getAllSessions, deleteSession } from '../utils/persistence/index';
import { initDB, GUEST_USER_ID } from '../utils/persistence/database';

// =============================================================================
// HELPERS
// =============================================================================

const SUIT_CHARS = ['\u2660', '\u2665', '\u2666', '\u2663']; // ♠♥♦♣
const RANK_CHARS = '23456789TJQKA';

const createDeck = () => {
  const deck = new Array(TOTAL_CARDS);
  for (let i = 0; i < TOTAL_CARDS; i++) deck[i] = i;
  return deck;
};

const shuffle = (deck, rng) => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
};

const dealCards = (deck, n) => {
  const cards = [];
  for (let i = 0; i < n; i++) cards.push(deck.pop());
  return cards;
};

const encodedToString = (enc) => {
  const r = cardRank(enc);
  const s = cardSuit(enc);
  return `${RANK_CHARS[r]}${SUIT_CHARS[s]}`;
};

/**
 * Best hand from 5, 6, or 7 cards.
 * evaluate5 only handles 5, bestFiveFromSeven only handles 7.
 * We add C(6,5) support for turn evaluations.
 */
const COMBOS_6_5 = [];
for (let a = 0; a < 6; a++)
  for (let b = a + 1; b < 6; b++)
    for (let c = b + 1; c < 6; c++)
      for (let d = c + 1; d < 6; d++)
        for (let e = d + 1; e < 6; e++)
          COMBOS_6_5.push([a, b, c, d, e]);

const bestHand = (cards) => {
  if (!cards || cards.length < 5) return 0;
  if (cards.length === 5) return evaluate5(cards);
  if (cards.length === 7) return bestFiveFromSeven(cards);
  // 6 cards: C(6,5) = 6 combinations
  if (cards.length === 6) {
    let best = 0;
    const hand5 = new Array(5);
    for (const combo of COMBOS_6_5) {
      for (let k = 0; k < 5; k++) hand5[k] = cards[combo[k]];
      const score = evaluate5(hand5);
      if (score > best) best = score;
    }
    return best;
  }
  return 0;
};

// =============================================================================
// POSITION & SEAT ORDER
// =============================================================================

const MY_SEAT = 5;
const ACTIVE_SEATS = [2, 3, 4, 5, 6, 7, 8];
const ABSENT_SEATS = [1, 9];

const seatToPosition = (seat, buttonSeat) => {
  const offset = (seat - buttonSeat + 9) % 9;
  if (offset === 1) return 'SB';
  if (offset === 2) return 'BB';
  if (offset === 3 || offset === 4) return 'EARLY';
  if (offset === 5 || offset === 6) return 'MIDDLE';
  return 'LATE'; // 0 (BTN), 7, 8
};

const getPreflopOrder = (buttonSeat, activeSeats) => {
  // UTG→BTN→SB→BB
  const ordered = activeSeats.map(s => ({
    seat: s,
    offset: (s - buttonSeat + 9) % 9,
  }));
  // SB=1, BB=2, then 3,4,5,6,7,8,0
  ordered.sort((a, b) => {
    const oa = a.offset === 0 ? 8.5 : a.offset <= 2 ? a.offset + 9 : a.offset;
    const ob = b.offset === 0 ? 8.5 : b.offset <= 2 ? b.offset + 9 : b.offset;
    return oa - ob;
  });
  return ordered.map(o => o.seat);
};

const getPostflopOrder = (buttonSeat, activeSeats) => {
  // SB→BB→UTG→BTN
  const ordered = activeSeats.map(s => ({
    seat: s,
    offset: (s - buttonSeat + 9) % 9,
  }));
  ordered.sort((a, b) => {
    const oa = a.offset === 0 ? 9 : a.offset;
    const ob = b.offset === 0 ? 9 : b.offset;
    return oa - ob;
  });
  return ordered.map(o => o.seat);
};

// =============================================================================
// HERO ARCHETYPE (solid TAG — no limping range, raise or fold)
// =============================================================================

const HERO_ARCHETYPE = {
  name: 'Hero',
  seat: String(MY_SEAT),
  behavior: {
    EARLY:  { fold: 0.83, limp: 0, open: 0.13, coldCall: 0.02, threeBet: 0.02 },
    MIDDLE: { fold: 0.75, limp: 0, open: 0.18, coldCall: 0.04, threeBet: 0.03 },
    LATE:   { fold: 0.58, limp: 0, open: 0.28, coldCall: 0.07, threeBet: 0.07 },
    SB:     { fold: 0.65, limp: 0, open: 0.22, coldCall: 0.06, threeBet: 0.07 },
    BB:     { fold: 0.50, limp: 0, open: 0,    coldCall: 0.40, threeBet: 0.10 },
  },
  trueRanges: {
    EARLY:  { open: 'AA,KK,QQ,JJ,TT,99,AKs,AQs,AJs,ATs,KQs,AKo,AQo', threeBet: 'AA,KK,QQ,AKs', coldCall: 'AJo,KQo' },
    MIDDLE: { open: 'AA,KK,QQ,JJ,TT,99,88,77,66,AKs,AQs,AJs,ATs,A9s,KQs,KJs,KTs,QJs,JTs,AKo,AQo,AJo,KQo', threeBet: 'AA,KK,QQ,JJ,AKs,AQs', coldCall: 'ATo,KJo,QJo,T9s,98s' },
    LATE:   { open: 'AA,KK,QQ,JJ,TT,99,88,77,66,55,44,AKs,AQs,AJs,ATs,A9s,A8s,A7s,A5s,KQs,KJs,KTs,K9s,QJs,QTs,Q9s,JTs,J9s,T9s,98s,87s,76s,65s,AKo,AQo,AJo,ATo,A9o,KQo,KJo,KTo,QJo', threeBet: 'AA,KK,QQ,JJ,TT,AKs,AQs,AJs,AKo', coldCall: 'A8o,K9o,QTo,JTo,T9o,87o' },
    SB:     { open: 'AA,KK,QQ,JJ,TT,99,88,77,AKs,AQs,AJs,ATs,A9s,KQs,KJs,KTs,QJs,QTs,JTs,T9s,98s,AKo,AQo,AJo,ATo,KQo,KJo', threeBet: 'AA,KK,QQ,JJ,AKs,AQs,AKo', coldCall: 'A9o,KTo,QJo,JTo' },
    BB:     { coldCall: 'TT,99,88,77,66,55,44,33,AKs,AQs,AJs,ATs,A9s,A8s,A7s,A5s,KQs,KJs,KTs,K9s,QJs,QTs,Q9s,JTs,J9s,T9s,98s,87s,76s,65s,AKo,AQo,AJo,ATo,A9o,A8o,KQo,KJo,KTo,QJo,QTo,JTo,T9o', threeBet: 'AA,KK,QQ,JJ,TT,AKs,AQs,AJs,AKo,AQo' },
  },
};

// =============================================================================
// RANGE CACHE
// =============================================================================

const RANGE_CACHE = new Map();

const buildRangeCache = (archetypes) => {
  for (const arch of archetypes) {
    const posMap = new Map();
    for (const [position, actions] of Object.entries(arch.trueRanges)) {
      const actionMap = new Map();
      for (const [action, rangeStr] of Object.entries(actions)) {
        actionMap.set(action, parseRangeString(rangeStr));
      }
      posMap.set(position, actionMap);
    }
    RANGE_CACHE.set(arch.name, posMap);
  }
};

// Build cache at module load
buildRangeCache(ARCHETYPES);
buildRangeCache([HERO_ARCHETYPE]);

// =============================================================================
// EQUITY ESTIMATION
// =============================================================================

/**
 * Compute hero equity vs a random opponent hand.
 * Enumerates C(remaining, 2) opponent hands.
 */
const computeEquity = (holeCards, boardCards, deadCards) => {
  const known = new Set([...holeCards, ...boardCards, ...deadCards]);
  const remaining = [];
  for (let c = 0; c < TOTAL_CARDS; c++) {
    if (!known.has(c)) remaining.push(c);
  }

  let wins = 0, ties = 0, total = 0;
  const heroAll = [...holeCards, ...boardCards];

  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      const heroScore = bestHand(heroAll);
      const villainAll = [remaining[i], remaining[j], ...boardCards];
      const villainScore = bestHand(villainAll);
      if (heroScore > villainScore) wins++;
      else if (heroScore === villainScore) ties++;
      total++;
    }
  }

  return total === 0 ? 0.5 : (wins + ties * 0.5) / total;
};

// =============================================================================
// BOARD TEXTURE CLASSIFICATION
// =============================================================================

const classifyTexture = (boardEncoded) => {
  const tex = analyzeBoardTexture(boardEncoded);
  if (!tex) return { primary: 'rainbow', connectivity: 'disconnected', height: 'middling', wetScore: 30 };

  // Primary
  let primary;
  if (tex.monotone) primary = 'monotone';
  else if (tex.isTrips) primary = 'trips';
  else if (tex.isPaired) primary = 'paired';
  else if (tex.twoTone) primary = 'twoTone';
  else primary = 'rainbow';

  // Connectivity
  let connectivity;
  if (tex.straightPossible && tex.connected >= 3) connectivity = 'straightComplete';
  else if (tex.connected >= 2) connectivity = 'connected';
  else if (tex.straightPossible) connectivity = 'semiConnected';
  else connectivity = 'disconnected';

  // Height
  let height;
  if (tex.highCardCount >= 3) height = 'broadway';
  else if (tex.highCardCount === 2) height = 'aceHigh';
  else if (tex.highCardCount === 1) height = 'middling';
  else height = 'low';

  return { primary, connectivity, height, wetScore: tex.wetScore };
};

// =============================================================================
// TEXTURE MODIFIERS
// =============================================================================

const TEXTURE_MODS = {
  cbetByPrimary:     { rainbow: 1.15, twoTone: 1.00, monotone: 0.60, paired: 1.10, trips: 0.40 },
  aggByConn:         { disconnected: 1.10, semiConnected: 1.00, connected: 0.85, straightComplete: 0.65 },
  pfrAdvByHeight:    { broadway: 1.15, aceHigh: 1.05, middling: 0.95, low: 0.80 },
  callerDefByHeight: { broadway: 0.85, aceHigh: 0.95, middling: 1.05, low: 1.20 },
  checkRaiseByPrim:  { rainbow: 0.80, twoTone: 1.00, monotone: 1.40, paired: 1.20, trips: 0.50 },
  sizingMul: (wetScore) => wetScore >= 65 ? 1.25 : wetScore >= 40 ? 1.00 : 0.75,
};

// =============================================================================
// MIXING MODEL
// =============================================================================

const MIX_SHAPES = {
  linear:      (x) => x,
  skewAggro:   (x) => Math.sqrt(x),
  skewPassive: (x) => x * x,
  uniform:     () => 0.5,
};

const mixDecision = (equity, threshold, mixWidth, mixShape, rng) => {
  const low = threshold - mixWidth / 2;
  const high = threshold + mixWidth / 2;
  if (equity <= low) return false;
  if (equity >= high) return true;
  const position = (equity - low) / (high - low);
  const prob = MIX_SHAPES[mixShape](position);
  return rng() < prob;
};

const applyDeception = (action, deceptionRate, rng) => {
  if (rng() >= deceptionRate) return action;
  // Flip action
  if (action === 'bet') return 'check';
  if (action === 'check') return 'bet';
  if (action === 'call') return 'raise';
  return action;
};

// =============================================================================
// POSTFLOP ARCHETYPE PROFILES
// =============================================================================

const POSTFLOP_PROFILES = {
  'Tight Mike': {
    asPFR:       { cbetFreq: 0.70, cbetEquityThreshold: 0.35, barrelTurnFreq: 0.50, barrelRiverFreq: 0.35, checkRaiseFreq: 0.04 },
    asCaller:    { donkFreq: 0.05, callThreshold: 0.35, raiseThreshold: 0.70, floatFreq: 0.05 },
    facingRaise: { foldThreshold: 0.30, callCeiling: 0.65 },
    bluff:       { bluffFreq: 0.08, barrelOff: 0.40 },
    mixWidth: 0.08, deceptionRate: 0.02, mixShape: 'linear',
  },
  'Loose Larry': {
    asPFR:       { cbetFreq: 0.82, cbetEquityThreshold: 0.25, barrelTurnFreq: 0.65, barrelRiverFreq: 0.50, checkRaiseFreq: 0.08 },
    asCaller:    { donkFreq: 0.12, callThreshold: 0.28, raiseThreshold: 0.55, floatFreq: 0.15 },
    facingRaise: { foldThreshold: 0.25, callCeiling: 0.60 },
    bluff:       { bluffFreq: 0.18, barrelOff: 0.55 },
    mixWidth: 0.15, deceptionRate: 0.10, mixShape: 'skewAggro',
  },
  'Limpy Lou': {
    asPFR:       { cbetFreq: 0.40, cbetEquityThreshold: 0.50, barrelTurnFreq: 0.25, barrelRiverFreq: 0.15, checkRaiseFreq: 0.02 },
    asCaller:    { donkFreq: 0.08, callThreshold: 0.25, raiseThreshold: 0.75, floatFreq: 0.02 },
    facingRaise: { foldThreshold: 0.40, callCeiling: 0.70 },
    bluff:       { bluffFreq: 0.03, barrelOff: 0.20 },
    mixWidth: 0.05, deceptionRate: 0.01, mixShape: 'skewPassive',
  },
  'Trapping Tom': {
    asPFR:       { cbetFreq: 0.55, cbetEquityThreshold: 0.30, barrelTurnFreq: 0.45, barrelRiverFreq: 0.35, checkRaiseFreq: 0.12 },
    asCaller:    { donkFreq: 0.06, callThreshold: 0.30, raiseThreshold: 0.60, floatFreq: 0.10 },
    facingRaise: { foldThreshold: 0.28, callCeiling: 0.62 },
    bluff:       { bluffFreq: 0.12, barrelOff: 0.45 },
    mixWidth: 0.20, deceptionRate: 0.18, mixShape: 'uniform',
  },
  'GTO Gary': {
    asPFR:       { cbetFreq: 0.65, cbetEquityThreshold: 0.30, barrelTurnFreq: 0.55, barrelRiverFreq: 0.40, checkRaiseFreq: 0.07 },
    asCaller:    { donkFreq: 0.04, callThreshold: 0.32, raiseThreshold: 0.65, floatFreq: 0.08 },
    facingRaise: { foldThreshold: 0.28, callCeiling: 0.63 },
    bluff:       { bluffFreq: 0.12, barrelOff: 0.40 },
    mixWidth: 0.12, deceptionRate: 0.06, mixShape: 'linear',
  },
  'Station Sarah': {
    asPFR:       { cbetFreq: 0.45, cbetEquityThreshold: 0.45, barrelTurnFreq: 0.30, barrelRiverFreq: 0.20, checkRaiseFreq: 0.03 },
    asCaller:    { donkFreq: 0.10, callThreshold: 0.18, raiseThreshold: 0.80, floatFreq: 0.03 },
    facingRaise: { foldThreshold: 0.35, callCeiling: 0.75 },
    bluff:       { bluffFreq: 0.04, barrelOff: 0.25 },
    mixWidth: 0.04, deceptionRate: 0.01, mixShape: 'skewPassive',
  },
  'Hero': {
    asPFR:       { cbetFreq: 0.68, cbetEquityThreshold: 0.30, barrelTurnFreq: 0.55, barrelRiverFreq: 0.40, checkRaiseFreq: 0.06 },
    asCaller:    { donkFreq: 0.04, callThreshold: 0.32, raiseThreshold: 0.65, floatFreq: 0.08 },
    facingRaise: { foldThreshold: 0.28, callCeiling: 0.63 },
    bluff:       { bluffFreq: 0.12, barrelOff: 0.42 },
    mixWidth: 0.10, deceptionRate: 0.05, mixShape: 'linear',
  },
};

// =============================================================================
// PREFLOP DECISION ENGINE
// =============================================================================

const preflopDecision = (holeCards, archetype, position, facedRaise, rng) => {
  const r1 = cardRank(holeCards[0]);
  const r2 = cardRank(holeCards[1]);
  const suited = cardSuit(holeCards[0]) === cardSuit(holeCards[1]);
  const idx = rangeIndex(r1, r2, suited);

  const posRanges = RANGE_CACHE.get(archetype.name)?.get(position);
  if (!posRanges) {
    // Fallback to behavior frequencies
    return behaviorFallback(archetype, position, facedRaise, rng);
  }

  if (facedRaise) {
    const threeBetRange = posRanges.get('threeBet');
    const coldCallRange = posRanges.get('coldCall');
    const in3bet = threeBetRange && threeBetRange[idx] > 0;
    const inColdCall = coldCallRange && coldCallRange[idx] > 0;

    if (in3bet && inColdCall) {
      // Hand in both ranges — use behavior ratios
      const b = archetype.behavior[position];
      const prob3bet = b.threeBet / (b.threeBet + b.coldCall);
      return rng() < prob3bet
        ? { action: 'raise', amount: 25 }
        : { action: 'call' };
    }
    if (in3bet) return { action: 'raise', amount: 25 };
    if (inColdCall) return { action: 'call' };
    return { action: 'fold' };
  }

  // No raise faced
  const openRange = posRanges.get('open');
  const limpRange = posRanges.get('limp');
  const inOpen = openRange && openRange[idx] > 0;
  const inLimp = limpRange && limpRange[idx] > 0;

  if (inOpen && inLimp) {
    const b = archetype.behavior[position];
    const probOpen = b.open / (b.open + (b.limp || 0.01));
    return rng() < probOpen
      ? { action: 'raise', amount: 8 }
      : { action: 'call' };
  }
  if (inOpen) return { action: 'raise', amount: 8 };
  if (inLimp) return { action: 'call' };
  return { action: 'fold' };
};

const behaviorFallback = (archetype, position, facedRaise, rng) => {
  const b = archetype.behavior[position];
  if (!b) return { action: 'fold' };
  const r = rng();
  if (facedRaise) {
    const total = b.fold + b.coldCall + b.threeBet;
    if (r < b.fold / total) return { action: 'fold' };
    if (r < (b.fold + b.coldCall) / total) return { action: 'call' };
    return { action: 'raise', amount: 25 };
  }
  let cum = b.fold;
  if (r < cum) return { action: 'fold' };
  cum += b.limp || 0;
  if (r < cum) return { action: 'call' };
  cum += b.open;
  if (r < cum) return { action: 'raise', amount: 8 };
  return { action: 'fold' };
};

// =============================================================================
// POSTFLOP DECISION ENGINE
// =============================================================================

const postflopDecision = (holeCards, boardEncoded, archetype, position, situation, rng) => {
  const { isPFR, facingBet, betSize, potSize, street, facingRaiseOnBet } = situation;
  const profile = POSTFLOP_PROFILES[archetype.name];
  if (!profile) return { action: 'check' };

  const equity = computeEquity(holeCards, boardEncoded, []);
  const texture = classifyTexture(boardEncoded);
  const { mixWidth, deceptionRate, mixShape } = profile;

  const primaryMod = TEXTURE_MODS.cbetByPrimary[texture.primary] || 1.0;
  const connMod = TEXTURE_MODS.aggByConn[texture.connectivity] || 1.0;
  const heightMod = isPFR
    ? (TEXTURE_MODS.pfrAdvByHeight[texture.height] || 1.0)
    : (TEXTURE_MODS.callerDefByHeight[texture.height] || 1.0);

  // D. Facing raise on our bet
  if (facingRaiseOnBet) {
    const fr = profile.facingRaise;
    if (equity > fr.callCeiling) return { action: 'raise', amount: betSize * 3 };
    if (mixDecision(equity, fr.foldThreshold, mixWidth, mixShape, rng)) return { action: 'call' };
    return { action: 'fold' };
  }

  // C. Facing bet (call/raise/fold)
  if (facingBet) {
    const crFreq = (profile.asPFR.checkRaiseFreq || 0.05) * (TEXTURE_MODS.checkRaiseByPrim[texture.primary] || 1.0);
    if (equity > profile.asCaller.raiseThreshold && rng() < crFreq) {
      return { action: 'raise', amount: betSize * 3 };
    }
    if (mixDecision(equity, profile.asCaller.callThreshold, mixWidth, mixShape, rng)) {
      let action = 'call';
      action = applyDeception(action, deceptionRate, rng);
      return action === 'raise' ? { action: 'raise', amount: betSize * 3 } : { action };
    }
    return { action: 'fold' };
  }

  // A. isPFR, not facing bet (c-bet opportunity)
  if (isPFR) {
    let freq = profile.asPFR.cbetFreq * primaryMod * connMod * heightMod;
    if (street === 'turn') freq = profile.asPFR.barrelTurnFreq * primaryMod;
    if (street === 'river') freq = profile.asPFR.barrelRiverFreq * primaryMod;

    if (mixDecision(equity, profile.asPFR.cbetEquityThreshold, mixWidth, mixShape, rng) && rng() < freq) {
      let action = 'bet';
      action = applyDeception(action, deceptionRate, rng);
      if (action === 'bet') return { action: 'bet', amount: sizeBet(potSize, texture, rng) };
      return { action: 'check' };
    }
    // Bluff with air
    if (equity < 0.15 && rng() < profile.bluff.bluffFreq) {
      if (street === 'turn' && rng() > profile.bluff.barrelOff) return { action: 'check' };
      if (street === 'river' && rng() > profile.bluff.barrelOff * 0.7) return { action: 'check' };
      return { action: 'bet', amount: sizeBet(potSize, texture, rng) };
    }
    return { action: 'check' };
  }

  // B. Not PFR, not facing bet (donk opportunity)
  if (rng() < profile.asCaller.donkFreq * primaryMod && equity > 0.55) {
    return { action: 'bet', amount: sizeBet(potSize, texture, rng) };
  }
  return { action: 'check' };
};

// =============================================================================
// BET SIZING
// =============================================================================

const sizeBet = (potSize, texture, rng) => {
  const baseFraction = 0.50 + rng() * 0.25; // 50-75% pot
  const adjusted = baseFraction * TEXTURE_MODS.sizingMul(texture.wetScore);
  return Math.max(2, Math.round(potSize * adjusted));
};

// =============================================================================
// HAND SIMULATION LOOP
// =============================================================================

const simulateHand = (archetypes, buttonSeat, seatPlayers, handNumber, sessionId, rng) => {
  // 1. DEAL
  const deck = shuffle(createDeck(), rng);
  const seatHoleCards = {};
  for (const seat of ACTIVE_SEATS) {
    seatHoleCards[seat] = dealCards(deck, 2);
  }
  const communityEncoded = dealCards(deck, 5);
  const communityCards = communityEncoded.map(encodedToString);

  // Collect all dealt cards as dead cards
  const allDealt = new Set();
  for (const seat of ACTIVE_SEATS) {
    for (const c of seatHoleCards[seat]) allDealt.add(c);
  }
  for (const c of communityEncoded) allDealt.add(c);

  // Map seats to archetypes
  const seatArchetype = {};
  for (const arch of archetypes) {
    seatArchetype[Number(arch.seat)] = arch;
  }

  // 2. PREFLOP
  const seatActions = { preflop: {}, flop: {}, turn: {}, river: {} };
  const actionSequence = [];
  let order = 0;
  let currentBet = 2; // BB
  let potSize = 3; // SB + BB
  let pfrSeat = null;
  let anyRaiseSeen = false;
  const activePlayers = new Set(ACTIVE_SEATS);
  const foldedPlayers = new Set();

  const preflopOrder = getPreflopOrder(buttonSeat, ACTIVE_SEATS);

  // Identify SB and BB seats for special handling
  const sbSeat = preflopOrder[preflopOrder.length - 2];
  const bbSeat = preflopOrder[preflopOrder.length - 1];

  for (const seat of preflopOrder) {
    const arch = seat === MY_SEAT ? HERO_ARCHETYPE : seatArchetype[seat];
    if (!arch) continue;

    const position = seatToPosition(seat, buttonSeat);
    let decision = preflopDecision(seatHoleCards[seat], arch, position, anyRaiseSeen, rng);

    // BB can't fold when no raise — check instead (it's free)
    if (seat === bbSeat && !anyRaiseSeen && decision.action === 'fold') {
      decision = { action: 'check' };
    }

    seatActions.preflop[String(seat)] = [decision.action];
    const entry = { seat, action: decision.action, street: 'preflop', order: ++order };

    if (decision.action === 'raise') {
      entry.amount = decision.amount;
      entry.potRelative = decision.amount / potSize;
      potSize += decision.amount;
      currentBet = decision.amount;
      pfrSeat = seat;
      anyRaiseSeen = true;
    } else if (decision.action === 'call') {
      entry.amount = currentBet;
      potSize += currentBet;
    } else if (decision.action === 'fold') {
      foldedPlayers.add(seat);
      activePlayers.delete(seat);
    }

    actionSequence.push(entry);
  }

  // 3. POSTFLOP (flop → turn → river)
  let lastRiverAggressor = null;
  const streets = ['flop', 'turn', 'river'];
  const streetCardCounts = { flop: 3, turn: 4, river: 5 };

  for (const street of streets) {
    const activeList = [...activePlayers].filter(s => !foldedPlayers.has(s));
    if (activeList.length <= 1) break;

    const boardCards = communityEncoded.slice(0, streetCardCounts[street]);
    const postflopOrder = getPostflopOrder(buttonSeat, activeList);

    let streetBet = 0;
    let bettorSeat = null;
    let actedThisStreet = new Set();

    for (const seat of postflopOrder) {
      if (foldedPlayers.has(seat)) continue;

      const arch = seat === MY_SEAT ? HERO_ARCHETYPE : seatArchetype[seat];
      if (!arch) continue;

      const position = seatToPosition(seat, buttonSeat);
      const situation = {
        isPFR: seat === pfrSeat,
        facingBet: streetBet > 0 && !actedThisStreet.has(seat),
        facingRaiseOnBet: bettorSeat === seat, // someone raised our bet
        betSize: streetBet,
        potSize,
        street,
        playersRemaining: activeList.length,
      };

      const decision = postflopDecision(seatHoleCards[seat], boardCards, arch, position, situation, rng);
      const entry = { seat, action: decision.action, street, order: ++order };

      if (decision.action === 'bet' || decision.action === 'raise') {
        const amount = decision.amount || sizeBet(potSize, classifyTexture(boardCards), rng);
        entry.amount = amount;
        entry.potRelative = amount / potSize;
        streetBet = amount;
        bettorSeat = seat;
        potSize += amount;
        if (street === 'river') lastRiverAggressor = seat;
      } else if (decision.action === 'call') {
        entry.amount = streetBet;
        potSize += streetBet;
      } else if (decision.action === 'fold') {
        foldedPlayers.add(seat);
        activePlayers.delete(seat);
      }

      seatActions[street][String(seat)] = [decision.action];
      actionSequence.push(entry);
      actedThisStreet.add(seat);
    }

    // If someone bet, remaining players who haven't faced the bet need to act
    if (bettorSeat !== null) {
      for (const seat of postflopOrder) {
        if (foldedPlayers.has(seat) || seat === bettorSeat || !actedThisStreet.has(seat)) continue;
        // Players who already checked now face a bet
        const prevAction = seatActions[street][String(seat)]?.[0];
        if (prevAction === 'check') {
          const arch = seat === MY_SEAT ? HERO_ARCHETYPE : seatArchetype[seat];
          if (!arch) continue;
          const position = seatToPosition(seat, buttonSeat);
          const facingSituation = {
            isPFR: seat === pfrSeat,
            facingBet: true,
            facingRaiseOnBet: false,
            betSize: streetBet,
            potSize,
            street,
            playersRemaining: [...activePlayers].filter(s => !foldedPlayers.has(s)).length,
          };

          const facingDecision = postflopDecision(seatHoleCards[seat], boardCards, arch, position, facingSituation, rng);
          const facingEntry = { seat, action: facingDecision.action, street, order: ++order };

          if (facingDecision.action === 'call') {
            facingEntry.amount = streetBet;
            potSize += streetBet;
          } else if (facingDecision.action === 'raise') {
            const amt = facingDecision.amount || streetBet * 3;
            facingEntry.amount = amt;
            facingEntry.potRelative = amt / potSize;
            potSize += amt;
            if (street === 'river') lastRiverAggressor = seat;
          } else if (facingDecision.action === 'fold') {
            foldedPlayers.add(seat);
            activePlayers.delete(seat);
          }

          seatActions[street][String(seat)].push(facingDecision.action);
          actionSequence.push(facingEntry);
        }
      }
    }
  }

  // 4. SHOWDOWN
  const allPlayerCards = {};
  const remainingSeats = [...activePlayers].filter(s => !foldedPlayers.has(s));

  if (remainingSeats.length > 1) {
    // Evaluate all hands and find winner(s) — ties possible
    const seatScores = {};
    let bestScore = -1;
    const winners = new Set();

    for (const seat of remainingSeats) {
      const score = bestHand([...seatHoleCards[seat], ...communityEncoded]);
      seatScores[seat] = score;
      if (score > bestScore) {
        bestScore = score;
        winners.clear();
        winners.add(seat);
      } else if (score === bestScore) {
        winners.add(seat);
      }
    }

    // Determine showdown order: last river aggressor shows first, then postflop order
    let showdownOrder;
    if (lastRiverAggressor && remainingSeats.includes(lastRiverAggressor)) {
      const rest = remainingSeats.filter(s => s !== lastRiverAggressor);
      const orderedRest = getPostflopOrder(buttonSeat, rest);
      showdownOrder = [lastRiverAggressor, ...orderedRest];
    } else {
      showdownOrder = getPostflopOrder(buttonSeat, remainingSeats);
    }

    // Walk showdown order with mucking logic
    let currentBestShownScore = -1;

    for (const seat of showdownOrder) {
      const score = seatScores[seat];
      const isFirst = currentBestShownScore === -1;

      if (seat === MY_SEAT) {
        // Hero cards live in cardState.holeCards, not allPlayerCards
        if (score > currentBestShownScore) currentBestShownScore = score;
        const showdownAction = winners.has(seat) ? 'won' : 'mucked';
        actionSequence.push({ seat, action: showdownAction, street: 'showdown', order: ++order });
      } else if (isFirst || score >= currentBestShownScore) {
        // Must show: first to act or can beat/tie current best
        allPlayerCards[String(seat)] = seatHoleCards[seat].map(encodedToString);
        if (score > currentBestShownScore) currentBestShownScore = score;
        const showdownAction = winners.has(seat) ? 'won' : 'mucked';
        actionSequence.push({ seat, action: showdownAction, street: 'showdown', order: ++order });
      } else {
        // Beaten — muck (don't reveal cards)
        actionSequence.push({ seat, action: 'mucked', street: 'showdown', order: ++order });
      }
    }
  } else if (remainingSeats.length === 1) {
    // Everyone else folded — winner doesn't show
    const winnerSeat = remainingSeats[0];
    actionSequence.push({ seat: winnerSeat, action: 'won', street: 'showdown', order: ++order });
  }

  // 5. BUILD RECORD
  return {
    gameState: {
      currentStreet: 'showdown',
      dealerButtonSeat: buttonSeat,
      mySeat: MY_SEAT,
      blindsPosted: { sb: 1, bb: 2 },
      seatActions,
      actionSequence,
      absentSeats: ABSENT_SEATS,
    },
    cardState: {
      communityCards,
      holeCards: seatHoleCards[MY_SEAT].map(encodedToString),
      holeCardsVisible: true,
      allPlayerCards,
    },
    seatPlayers: { ...seatPlayers },
    timestamp: Date.now() - (100 - handNumber) * 60000,
    version: '1.3.0',
    userId: GUEST_USER_ID,
    sessionId,
    sessionHandNumber: handNumber,
    handDisplayId: `S${sessionId}-H${handNumber}`,
  };
};

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

const SIM_STORAGE_KEY = '__simState';
const SIM_VENUE = 'Simulator';

const getSimState = () => {
  try {
    const raw = localStorage.getItem(SIM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const setSimState = (state) => {
  localStorage.setItem(SIM_STORAGE_KEY, JSON.stringify(state));
};

const clearSimState = () => {
  localStorage.removeItem(SIM_STORAGE_KEY);
};

const ensureSimSession = async () => {
  const existing = getSimState();
  if (existing) return existing;

  // Create players with "Sim " prefix
  const playerIds = {};
  const seatPlayers = { [String(MY_SEAT)]: 'hero' };

  for (const arch of ARCHETYPES) {
    const playerId = await createPlayer({
      name: `Sim ${arch.name}`,
      ethnicity: arch.ethnicity,
      build: arch.build,
      styleTags: arch.styleTags,
      notes: `Simulator: ${arch.notes}`,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    playerIds[arch.name] = playerId;
    seatPlayers[arch.seat] = playerId;
  }

  // Create session
  const sessionId = await createSession({
    venue: SIM_VENUE,
    gameType: '1/2',
    buyIn: 200,
  });

  const state = { sessionId, playerIds, seatPlayers, handCount: 0 };
  setSimState(state);
  console.log(`[sim] Created session ${sessionId} with 6 players`);
  return state;
};

// =============================================================================
// PUBLIC API
// =============================================================================

export const sim = async (n = 10) => {
  const state = await ensureSimSession();
  const { sessionId, seatPlayers } = state;
  let { handCount } = state;

  console.log(`[sim] Simulating ${n} hands (session ${sessionId}, starting at hand ${handCount + 1})...`);

  const rng = Math.random;
  const hands = [];

  for (let i = 0; i < n; i++) {
    handCount++;
    const buttonSeat = ACTIVE_SEATS[(handCount - 1) % ACTIVE_SEATS.length];
    const hand = simulateHand(ARCHETYPES, buttonSeat, seatPlayers, handCount, sessionId, rng);
    hands.push(hand);
  }

  // Batch write to IndexedDB
  const db = await initDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['hands'], 'readwrite');
    const store = tx.objectStore('hands');
    for (const hand of hands) {
      store.add(hand);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
  db.close();

  // Update session
  await updateSession(sessionId, { handCount });
  state.handCount = handCount;
  setSimState(state);

  // Summary
  let showdownCount = 0;
  for (const hand of hands) {
    showdownCount += Object.keys(hand.cardState.allPlayerCards).length;
  }

  console.log(`[sim] Done: ${n} hands created (total: ${handCount})`);
  console.log(`[sim] Showdown observations: ${showdownCount}`);

  // Per-player VPIP/PFR summary
  const stats = {};
  for (const arch of ARCHETYPES) stats[arch.name] = { hands: 0, vpip: 0, pfr: 0 };

  for (const hand of hands) {
    for (const arch of ARCHETYPES) {
      const seat = arch.seat;
      const actions = hand.gameState.seatActions.preflop[seat];
      if (!actions) continue;
      stats[arch.name].hands++;
      if (actions[0] !== 'fold') stats[arch.name].vpip++;
      if (actions[0] === 'raise') stats[arch.name].pfr++;
    }
  }

  console.log('\n  Player         VPIP    PFR');
  console.log('  ' + '-'.repeat(35));
  for (const arch of ARCHETYPES) {
    const s = stats[arch.name];
    const vpipPct = s.hands > 0 ? Math.round(s.vpip / s.hands * 100) : 0;
    const pfrPct = s.hands > 0 ? Math.round(s.pfr / s.hands * 100) : 0;
    console.log(`  ${arch.name.padEnd(15)} ${String(vpipPct).padStart(3)}%    ${String(pfrPct).padStart(3)}%`);
  }

  return { handCount, showdownCount };
};

export const simStatus = async () => {
  const state = getSimState();
  if (!state) {
    console.log('[simStatus] No sim session found. Run __sim(n) first.');
    return;
  }

  const { sessionId, handCount } = state;
  console.log(`[simStatus] Session ${sessionId}, ${handCount} hands\n`);

  // Read hands from DB
  const db = await initDB();
  const hands = await new Promise((resolve, reject) => {
    const tx = db.transaction(['hands'], 'readonly');
    const store = tx.objectStore('hands');
    const index = store.index('sessionId');
    const req = index.getAll(sessionId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
  db.close();

  const stats = {};
  for (const arch of ARCHETYPES) {
    stats[arch.name] = { hands: 0, vpip: 0, pfr: 0, showdowns: 0 };
  }

  for (const hand of hands) {
    for (const arch of ARCHETYPES) {
      const seat = arch.seat;
      const actions = hand.gameState.seatActions.preflop?.[seat];
      if (!actions) continue;
      stats[arch.name].hands++;
      if (actions[0] !== 'fold') stats[arch.name].vpip++;
      if (actions[0] === 'raise') stats[arch.name].pfr++;
      if (hand.cardState.allPlayerCards[seat]) stats[arch.name].showdowns++;
    }
  }

  console.log('  Player         Hands  VPIP    PFR   SD');
  console.log('  ' + '-'.repeat(45));
  for (const arch of ARCHETYPES) {
    const s = stats[arch.name];
    const vpipPct = s.hands > 0 ? Math.round(s.vpip / s.hands * 100) : 0;
    const pfrPct = s.hands > 0 ? Math.round(s.pfr / s.hands * 100) : 0;
    console.log(`  ${arch.name.padEnd(15)} ${String(s.hands).padStart(5)}  ${String(vpipPct).padStart(3)}%    ${String(pfrPct).padStart(3)}%  ${String(s.showdowns).padStart(3)}`);
  }
};

export const simClear = async () => {
  const state = getSimState();
  if (!state) {
    console.log('[simClear] No sim session to clear.');
    return;
  }

  console.log('[simClear] Removing sim data...');

  const { sessionId, playerIds } = state;

  // Delete hands
  const db = await initDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['hands'], 'readwrite');
    const store = tx.objectStore('hands');
    const index = store.index('sessionId');
    const req = index.getAllKeys(sessionId);
    req.onsuccess = () => {
      const count = req.result.length;
      for (const key of req.result) store.delete(key);
      console.log(`  Deleted ${count} hands`);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });

  // Delete session
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['sessions'], 'readwrite');
    const store = tx.objectStore('sessions');
    store.delete(sessionId);
    tx.oncomplete = () => {
      console.log(`  Deleted session ${sessionId}`);
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
  });
  db.close();

  // Delete players
  for (const [name, id] of Object.entries(playerIds)) {
    await deletePlayer(id);
    console.log(`  Deleted Sim ${name} (${id})`);
  }

  clearSimState();
  console.log('[simClear] Done!');
};

// Window registration
if (typeof window !== 'undefined') {
  window.__sim = sim;
  window.__simStatus = simStatus;
  window.__simClear = simClear;
}
