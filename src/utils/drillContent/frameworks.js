/**
 * frameworks.js — catalog of preflop equity frameworks.
 *
 * A framework is a teachable lens. Each has:
 *   - id / name / shortDescription
 *   - subcases with numeric equity bands ([lo, hi] for the favored side)
 *   - applies(handA, handB) — returns the matched subcase or null
 *   - narrate(handA, handB, match) — plain-English explanation
 *
 * Frameworks compose. Any given matchup may match ≥ 1 of them, and the drill
 * UI shows all that apply. The STRAIGHT_COVERAGE and FLUSH_CONTENTION
 * frameworks are *modifiers* — they always apply when straight/flush potential
 * exists and refine the base bands from structural frameworks.
 *
 * Pure module — no imports from UI or state layers.
 */

import { analyzeStraightCoverage, classifyConnectedness } from './straightCombos';

// ---------- Predicates ---------- //

const isPair = (h) => h.pair;
const sharedRank = (a, b) => {
  if (a.rankHigh === b.rankHigh || a.rankHigh === b.rankLow) return a.rankHigh;
  if (a.rankLow === b.rankHigh || a.rankLow === b.rankLow) return a.rankLow;
  return -1;
};
const kickerOf = (h, sharedR) => (h.rankHigh === sharedR ? h.rankLow : h.rankHigh);

// Named rank helper for narration (A=12 → 'A', 0 → '2').
const RANK_LABELS = '23456789TJQKA';
const rankLabel = (r) => RANK_LABELS[r];
const handLabel = (h) => {
  if (h.pair) return `${rankLabel(h.rankHigh)}${rankLabel(h.rankHigh)}`;
  return `${rankLabel(h.rankHigh)}${rankLabel(h.rankLow)}${h.suited ? 's' : 'o'}`;
};

// ---------- Frameworks ---------- //

export const DECOMPOSITION = {
  id: 'decomposition',
  name: 'Equity Decomposition',
  shortDescription: 'Every hand\'s equity splits into pair-up + draws + backdoors.',
  subcases: [{ id: 'always', claim: 'Break any hand into its sources of equity.', band: null }],
  applies: () => ({ subcase: 'always', favored: null }),
  narrate: () =>
    'Every equity breaks down into: pair-up share (flopping a pair), draw share (straights/flushes made by the river), and backdoor share (runner-runner). Decompose before computing.',
};

export const DOMINATION = {
  id: 'domination',
  name: 'Domination (shared card)',
  shortDescription: 'Shared cards set a steep equity ceiling.',
  subcases: [
    {
      id: 'kicker_dominated',
      claim: 'Same high card, lower kicker (AK vs AQ, KQ vs KJ)',
      band: [0.65, 0.78],
    },
    {
      id: 'pair_dominates_kicker',
      claim: 'Pair + dominated kicker (AA vs AKo, JJ vs J5 — pair rank above other\'s kicker)',
      band: [0.86, 0.96],
    },
    {
      id: 'pair_vs_shared_over',
      claim: 'Pair with shared rank, but opponent has a HIGHER card (KK vs AKs, 77 vs A7o)',
      band: [0.60, 0.76],
    },
  ],
  applies: (a, b) => {
    const s = sharedRank(a, b);
    if (s < 0) return null;
    if (isPair(a) && isPair(b)) return null;
    if (isPair(a) || isPair(b)) {
      const pair = isPair(a) ? a : b;
      const other = isPair(a) ? b : a;
      const pairOwner = isPair(a) ? 'A' : 'B';
      if (pair.rankHigh !== s) return null; // shared rank must be the pair's rank
      const otherKicker = kickerOf(other, s);
      if (otherKicker < pair.rankHigh) {
        return { subcase: 'pair_dominates_kicker', favored: pairOwner };
      }
      return { subcase: 'pair_vs_shared_over', favored: pairOwner };
    }
    // Both unpaired, shared rank → kicker dominates
    const aK = kickerOf(a, s);
    const bK = kickerOf(b, s);
    if (aK === bK) return null;
    return { subcase: 'kicker_dominated', favored: aK > bK ? 'A' : 'B' };
  },
  narrate: (a, b, match) => {
    if (match.subcase === 'pair_dominates_kicker') {
      const pair = isPair(a) ? a : b;
      const other = isPair(a) ? b : a;
      return `${handLabel(pair)} is crushing ${handLabel(other)} via the shared rank — the pair already has a set, and ${handLabel(other)}'s kicker is lower than the pair. ${handLabel(other)} can only beat the pair by catching a straight or flush. Expect ~90% for the pair.`;
    }
    if (match.subcase === 'pair_vs_shared_over') {
      const pair = isPair(a) ? a : b;
      const other = isPair(a) ? b : a;
      return `${handLabel(pair)} has the shared rank paired, but ${handLabel(other)} has a card HIGHER than the pair — both sides have showdown value, with the pair slightly ahead. Expect ~68% for the pair.`;
    }
    const winner = match.favored === 'A' ? a : b;
    const loser = match.favored === 'A' ? b : a;
    return `${handLabel(winner)} dominates ${handLabel(loser)} — same high card, but ${handLabel(winner)} has the higher kicker. Most flops either miss both or pair the top card for the dominator. Expect ~70% for the dominator.`;
  },
};

export const PAIR_OVER_PAIR = {
  id: 'pair_over_pair',
  name: 'Pair over Pair',
  shortDescription: 'Two different pairs — the higher pair is a huge favorite.',
  subcases: [{ id: 'pair_over_pair', claim: 'Higher pair wins ~82% of the time', band: [0.78, 0.85] }],
  applies: (a, b) => {
    if (!isPair(a) || !isPair(b)) return null;
    if (a.rankHigh === b.rankHigh) return null;
    return { subcase: 'pair_over_pair', favored: a.rankHigh > b.rankHigh ? 'A' : 'B' };
  },
  narrate: (a, b, match) => {
    const higher = match.favored === 'A' ? a : b;
    const lower = match.favored === 'A' ? b : a;
    return `${handLabel(higher)} vs ${handLabel(lower)} — the higher pair is a ~4.5:1 favorite. No shared card needed; the rank gap alone does it, because the lower pair essentially needs to flop a set (~11%).`;
  },
};

export const RACE = {
  id: 'race',
  name: 'Race (pair vs unpaired)',
  shortDescription: 'Pair vs unpaired, no shared rank. The classic poker race family.',
  subcases: [
    {
      id: 'pair_vs_two_overs',
      claim: 'Pair vs two overcards (77 vs AKo — the classic race)',
      band: [0.50, 0.57],
    },
    {
      id: 'pair_vs_split',
      claim: 'Pair vs one over one under (88 vs AT)',
      band: [0.62, 0.74],
    },
    {
      id: 'pair_vs_two_unders',
      claim: 'Pair vs two undercards (TT vs 87) — range widens with connectedness/suited',
      band: [0.76, 0.90],
    },
  ],
  applies: (a, b) => {
    const aPair = isPair(a);
    const bPair = isPair(b);
    if (aPair === bPair) return null;
    if (sharedRank(a, b) >= 0) return null;
    const pair = aPair ? a : b;
    const other = aPair ? b : a;
    const pairOwner = aPair ? 'A' : 'B';
    const pr = pair.rankHigh;
    const oh = other.rankHigh;
    const ol = other.rankLow;
    if (oh > pr && ol > pr) return { subcase: 'pair_vs_two_overs', favored: pairOwner };
    if (oh < pr && ol < pr) return { subcase: 'pair_vs_two_unders', favored: pairOwner };
    return { subcase: 'pair_vs_split', favored: pairOwner };
  },
  narrate: (a, b, match) => {
    const pair = isPair(a) ? a : b;
    const other = isPair(a) ? b : a;
    if (match.subcase === 'pair_vs_two_overs') {
      return `${handLabel(pair)} vs ${handLabel(other)} — a classic race. The pair is already made; the two overs win by pairing either rank (~35% flop hit) or catching a straight/flush. Expect ~54% for the pair.`;
    }
    if (match.subcase === 'pair_vs_two_unders') {
      return `${handLabel(pair)} vs ${handLabel(other)} — the pair is dominating. The unders must flop a set or runner-runner. Expect ~86% for the pair.`;
    }
    return `${handLabel(pair)} vs ${handLabel(other)} — one over, one under. The pair is strongly favored because only one of the opponent's cards is "live to pair over." Expect ~68% for the pair.`;
  },
};

export const BROADWAY_VS_CONNECTOR = {
  id: 'broadway_vs_connector',
  name: 'Broadway vs Connector',
  shortDescription: 'When a high-card broadway hand faces a middling suited/connected hand, blockers and straight coverage swing large.',
  subcases: [{ id: 'broadway_vs_connector', claim: 'Evaluate with blocker framework', band: null }],
  applies: (a, b) => {
    if (isPair(a) || isPair(b)) return null;
    const isBroadway = (h) => h.rankHigh >= 10 && h.rankLow >= 9; // AK, AQ, AJ, KQ, KJ, QJ, AT, KT, QT, JT
    const isConnectorish = (h) => {
      const cls = classifyConnectedness(h.rankHigh, h.rankLow);
      return cls === 'connector' || cls === 'one_gap';
    };
    const aBd = isBroadway(a);
    const bBd = isBroadway(b);
    const aCn = isConnectorish(a) && !aBd;
    const bCn = isConnectorish(b) && !bBd;
    // One side broadway, the other middling connector → framework applies
    if (aBd && bCn) return { subcase: 'broadway_vs_connector', favored: 'A' };
    if (bBd && aCn) return { subcase: 'broadway_vs_connector', favored: 'B' };
    return null;
  },
  narrate: (a, b, match) => {
    const broadway = match.favored === 'A' ? a : b;
    const conn = match.favored === 'A' ? b : a;
    return `${handLabel(broadway)} vs ${handLabel(conn)} — broadway hands block big chunks of a connector's straight potential. Run the Straight Coverage framework to see exactly how many combos the connector keeps live. Against a low suited connector (54s), AK leaves 3 of 4 straight combos live; against JTs, only 2 of 4.`;
  },
};

export const STRAIGHT_COVERAGE = {
  id: 'straight_coverage',
  name: 'Straight Coverage (modifier)',
  shortDescription: 'Count each hand\'s direct straight combos and subtract ranks shared with the opponent.',
  subcases: [{ id: 'coverage', claim: 'Each live straight combo contributes ~1.5–3% equity', band: null }],
  applies: (a, b) => {
    const cov = analyzeStraightCoverage(a, b);
    if (cov.aTotal === 0 && cov.bTotal === 0) return null;
    return { subcase: 'coverage', favored: null, details: cov };
  },
  narrate: (a, b, match) => {
    const d = match.details;
    const aStr = `${handLabel(a)}: ${d.aTotal} total straight combos${d.aBlocked ? `, ${d.aLive} live (${d.aBlocked} blocked)` : ''}`;
    const bStr = `${handLabel(b)}: ${d.bTotal} total${d.bBlocked ? `, ${d.bLive} live (${d.bBlocked} blocked)` : ''}`;
    return `${aStr}. ${bStr}. Each live combo ≈ 1.5–3% equity uplift by the river.`;
  },
};

export const FLUSH_CONTENTION = {
  id: 'flush_contention',
  name: 'Suitedness & Flush Contention (modifier)',
  shortDescription: 'Suited = +2–4% base; same-suit vs same-suit opponents contend for the same flush cards.',
  subcases: [
    { id: 'one_suited', claim: 'One suited hand — full flush upside (~+3%)', band: null },
    { id: 'both_suited_shared', claim: 'Both suited, same suit possible — contested flush', band: null },
    { id: 'both_suited_diff', claim: 'Both suited, different suits guaranteed — both retain flush upside', band: null },
    { id: 'neither_suited', claim: 'Both offsuit/pair — flushes require 4 suited board cards (~4%)', band: null },
  ],
  applies: (a, b) => {
    const aS = !isPair(a) && a.suited;
    const bS = !isPair(b) && b.suited;
    if (aS && bS) {
      // Both suited: could share a suit (1/4 of combos) or not (3/4).
      return { subcase: 'both_suited_shared', favored: null };
    }
    if (aS || bS) return { subcase: 'one_suited', favored: aS ? 'A' : 'B' };
    return { subcase: 'neither_suited', favored: null };
  },
  narrate: (a, b, match) => {
    if (match.subcase === 'one_suited') {
      const suited = match.favored === 'A' ? a : b;
      return `${handLabel(suited)} is suited — gains ~2–4% from flush potential. The opponent is offsuit/pair so can't contend for the same flush suit.`;
    }
    if (match.subcase === 'both_suited_shared') {
      return 'Both hands suited — 1 in 4 combo pairings shares the suit (flush contention); the other 3 in 4 run independently. All-suits average already bakes this in.';
    }
    return 'Neither hand is suited — flushes require 4+ matching suits on the board (~4% base each). Small effect.';
  },
};

// ---------- Registry ---------- //

export const FRAMEWORKS = {
  DECOMPOSITION,
  DOMINATION,
  PAIR_OVER_PAIR,
  RACE,
  BROADWAY_VS_CONNECTOR,
  STRAIGHT_COVERAGE,
  FLUSH_CONTENTION,
};

export const FRAMEWORK_ORDER = [
  DECOMPOSITION,
  DOMINATION,
  PAIR_OVER_PAIR,
  RACE,
  BROADWAY_VS_CONNECTOR,
  STRAIGHT_COVERAGE,
  FLUSH_CONTENTION,
];

/**
 * Run all frameworks against a matchup and return every applicable one with
 * its matched subcase + narration.
 * @returns {Array<{ framework, subcase, favored, details?, narration }>}
 */
export const classifyMatchup = (handA, handB) => {
  const out = [];
  for (const fw of FRAMEWORK_ORDER) {
    const match = fw.applies(handA, handB);
    if (!match) continue;
    out.push({
      framework: fw,
      subcase: match.subcase,
      favored: match.favored,
      details: match.details || null,
      narration: fw.narrate(handA, handB, match),
    });
  }
  return out;
};
