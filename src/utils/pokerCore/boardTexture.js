/**
 * boardTexture.js - Board texture classification for exploit reasoning
 *
 * Classifies community cards as wet/dry/paired/etc for board-aware exploit rules.
 */

import { cardRank, cardSuit, parseBoard } from './cardParser';
import { clamp } from '../mathUtils';

/**
 * Analyze board texture from encoded card array.
 * @param {number[]} boardCards - Encoded cards (from parseBoard)
 * @returns {Object} Board texture analysis
 */
export const analyzeBoardTexture = (boardCards) => {
  if (!boardCards || boardCards.length === 0) {
    return null;
  }

  const ranks = boardCards.map(cardRank);
  const suits = boardCards.map(cardSuit);
  const n = boardCards.length;

  // Rank frequency
  const rankFreq = new Uint8Array(13);
  for (const r of ranks) rankFreq[r]++;

  const maxRankFreq = Math.max(...rankFreq);
  const isPaired = maxRankFreq >= 2;
  const isTrips = maxRankFreq >= 3;

  // Suit frequency
  const suitFreq = new Uint8Array(4);
  for (const s of suits) suitFreq[s]++;

  const maxSuitFreq = Math.max(...suitFreq);
  const flushDraw = maxSuitFreq >= 3;
  const flushComplete = maxSuitFreq >= 4;
  const monotone = maxSuitFreq === n && n >= 3;
  const rainbow = n >= 3 && maxSuitFreq === 1;
  const twoTone = n >= 3 && !monotone && maxSuitFreq >= 2;

  // Straight connectivity: check 5-rank windows
  const rankPresent = new Uint8Array(13);
  for (const r of ranks) rankPresent[r] = 1;

  let maxInWindow = 0;
  for (let low = 0; low <= 8; low++) {
    let count = 0;
    for (let r = low; r < low + 5; r++) {
      count += rankPresent[r];
    }
    maxInWindow = Math.max(maxInWindow, count);
  }
  // Check A-2-3-4-5 wheel window
  const wheelCount = rankPresent[12] + rankPresent[0] + rankPresent[1] + rankPresent[2] + rankPresent[3];
  maxInWindow = Math.max(maxInWindow, wheelCount);

  const straightPossible = maxInWindow >= 3;

  // Connected: count adjacent-rank pairs
  let connected = 0;
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  for (let i = 1; i < sortedRanks.length; i++) {
    if (sortedRanks[i] - sortedRanks[i - 1] === 1) connected++;
  }

  // Broadway cards (T=8, J=9, Q=10, K=11, A=12)
  const highCardCount = ranks.filter(r => r >= 8).length;

  // Wetness scoring
  let wetScore = 30; // baseline
  if (flushDraw) wetScore += 25;
  if (monotone) wetScore += 35;
  if (flushComplete) wetScore += 10;
  if (straightPossible) wetScore += 15;
  wetScore += connected * 10;
  if (isPaired) wetScore -= 20;
  if (rainbow) wetScore -= 15;
  wetScore += highCardCount * 5;

  wetScore = clamp(wetScore, 0, 100);

  const texture = wetScore >= 65 ? 'wet' : wetScore >= 40 ? 'medium' : 'dry';

  return {
    isPaired,
    isTrips,
    flushDraw,
    flushComplete,
    monotone,
    rainbow,
    twoTone,
    straightPossible,
    connected,
    highCardCount,
    texture,
    wetScore,
  };
};

/**
 * Convenience: analyze from raw community card strings.
 * @param {string[]} communityCards - e.g. ["A~", "K~", "2~"]
 * @returns {Object|null} Board texture or null if no cards
 */
export const analyzeBoardFromStrings = (communityCards) => {
  const encoded = parseBoard(communityCards);
  return analyzeBoardTexture(encoded);
};
