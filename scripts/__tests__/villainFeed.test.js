/**
 * villainFeed.test.js — WS-436 B2: the styled-villain feed is LIVE, and labels are not.
 *
 * The failure mode this file exists to catch is the WS-276 family: a feed that
 * ships, resolves nothing (wrong pid key, wrong source string, wrong field
 * shape), and silently reproduces the null arm — so a before/after comparison
 * reads "no effect" when the truth is "no feed". The liveness pin is therefore
 * the SHARP one: two extreme fed villains must produce DIFFERENT advice through
 * the full heroPolicyAt path, not merely a non-null flag.
 */

import { describe, it, expect } from 'vitest';
import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';
import { createRange } from '../../src/utils/pokerCore/rangeMatrix.js';
import { encodeCard } from '../../src/utils/pokerCore/cardParser.js';
import { heroPolicyAt } from '../backtest/heroPolicy.mjs';
import { resolveVillain, VILLAIN_SOURCES } from '../backtest/villainFeed.mjs';

const A = PRIMITIVE_ACTIONS;

// ─── resolveVillain semantics (pure) ────────────────────────────────────────────

describe('resolveVillain', () => {
  const feed = {
    players: {
      v1: { vpip: 45, pfr: 8, af: 0.8, style: 'Fish', shrunk: { foldToCbet: 0.2 }, rawStats: {} },
    },
  };

  it("source 'null' returns null even with a feed and a match", () => {
    expect(resolveVillain(feed, 'v1', VILLAIN_SOURCES.NULL)).toBeNull();
  });

  it('missing feed, missing pid, or missing entry all return null (population fallback)', () => {
    expect(resolveVillain(null, 'v1', VILLAIN_SOURCES.STATS)).toBeNull();
    expect(resolveVillain(feed, null, VILLAIN_SOURCES.STATS)).toBeNull();
    expect(resolveVillain(feed, 'unknown', VILLAIN_SOURCES.STATS)).toBeNull();
  });

  it("'stats' strips the label; 'styled' keeps it; both keep the posteriors", () => {
    const stats = resolveVillain(feed, 'v1', VILLAIN_SOURCES.STATS);
    const styled = resolveVillain(feed, 'v1', VILLAIN_SOURCES.STYLED);
    expect(stats.style).toBeNull();
    expect(styled.style).toBe('Fish');
    expect(stats.shrunk).toEqual(styled.shrunk);
  });

  it('an unknown source throws rather than silently measuring the wrong arm', () => {
    expect(() => resolveVillain(feed, 'v1', 'labels')).toThrow(/Unknown villain source/);
  });
});

describe('quantization sources (ws436 §4d #2)', () => {
  // 9 players spanning [0.1, 0.9] on every stat, so tertile structure is known.
  const spread = {};
  for (let i = 0; i < 9; i++) {
    const v = 0.1 + i * 0.1;
    spread[`p${i}`] = {
      vpip: v * 100, pfr: v * 100, af: 1,
      style: 'TAG',
      shrunk: { vpip: v, pfr: v, threeBet: v, cbet: v, foldToCbet: v, foldTo3Bet: v, aggFreq: v },
      rawStats: { facedCbet: 40, foldedToCbet: Math.round(40 * v) },
    };
  }
  const feed = { players: spread };

  it('bin3 snaps every shrunk field to one of exactly 3 representative values', () => {
    const seen = new Set();
    for (const pid of Object.keys(spread)) {
      const e = resolveVillain(feed, pid, VILLAIN_SOURCES.STATS_BIN3);
      seen.add(e.shrunk.foldToCbet);
      expect(e.style).toBeNull();
    }
    expect(seen.size).toBe(3);
  });

  it('the derived observed hint follows the bin — no continuous value leaks around it', () => {
    const e = resolveVillain(feed, 'p0', VILLAIN_SOURCES.STATS_BIN3);
    // liveGameContext derives foldToCbet% from these counts; they must encode the
    // BINNED rate at the same n, so evidence weight is untouched but the value
    // is bin-resolution.
    expect(e.rawStats.foldedToCbet).toBe(Math.round(40 * e.shrunk.foldToCbet));
    expect(e.rawStats.facedCbet).toBe(40);
  });

  it('bin5 has strictly more resolution than bin3', () => {
    const uniq = (src) => new Set(
      Object.keys(spread).map(p => resolveVillain(feed, p, src).shrunk.vpip),
    ).size;
    expect(uniq(VILLAIN_SOURCES.STATS_BIN5)).toBeGreaterThan(uniq(VILLAIN_SOURCES.STATS_BIN3));
  });
});

// ─── The full heroPolicyAt path ─────────────────────────────────────────────────

// Hero (seat 1, EVAL side) is CHECKED TO on the river; seat 2 ('villain-x') is
// still in. A checked-to river node, deliberately, after two wrong fixtures whose
// inertness was STRUCTURAL, not a wiring bug:
//   - flop facing-bet at depth-1: hero's raise-branch fold estimate is
//     composition-first (WS-388 — the per-combo enumeration stands alone), so a
//     stats-only villain has no channel there by measured design;
//   - river facing-bet: same raise-branch structure.
// On a checked-to node, hero's BET candidate estimates villain folding via
// estimateFoldPct(action='bet'), where the OBSERVED foldToCbet blend
// (foldEquityCalculator hasObserved path) reads the feed's raw counts; and
// villain's bet-behind response runs computeRiverCheckEV → comboActionProbabilities
// with playerStats (the A3 transfers + WS-436 tier-2 shift).
const mkDecision = () => {
  // A♥ 7♦ 2♣ 9♠ 3♣ — encoded directly (the parser wants suit SYMBOLS, not letters).
  const board = [
    encodeCard(12, 1), encodeCard(5, 2), encodeCard(0, 3),
    encodeCard(7, 0), encodeCard(1, 3),
  ];
  const range = createRange();
  for (let i = 0; i < 169; i++) range[i] = 1.0;
  const hand = {
    handId: 7,
    seatPlayers: { 1: 'hero-x', 2: 'villain-x', 3: 'other-x' },
    gameState: {
      actionSequence: [
        { order: 0, seat: '2', action: A.CHECK, street: 'river' },
      ],
      dealerButtonSeat: 9,
      communityCards: ['A♥', '7♦', '2♣', '9♠', '3♣'],
      showdownCards: {},
      currentStreet: 'river',
      blinds: { sb: 1, bb: 2 },
    },
    _backtest: {
      bb: 2,
      potBeforeByOrder: { 1: 60 },
      stackBeforeByOrder: { 1: 200 },
      committedBySeat: {},
    },
  };
  const ctx = {
    hand,
    board,
    rangeBefore: range,
    order: 1,
    street: 'river',
    facingAction: 'none',
    playerSeat: '1',
    opponentSeat: '2',
    texture: 'dry',
    posCategory: 'LATE',
    isAgg: 'agg',
    isIP: 'ip',
  };
  return { ctx, hand };
};

// Two villains at opposite poles of the one measured axis. Everything else equal.
// The rawStats counts matter: buildPlayerStats derives the OBSERVED foldToCbet hint
// (value + sample size) from them, which is the engine's tier-2 source at
// facing-bet nodes — a feed without the counts starves that channel, which is
// exactly the shape the real buildVillainFeed emits (this fixture mirrors it).
const feedWith = (foldToCbet, style) => ({
  players: {
    'villain-x': {
      vpip: 30, pfr: 15, af: 2,
      style,
      shrunk: { vpip: 0.3, pfr: 0.15, cbet: 0.55, foldToCbet, aggFreq: 0.45 },
      rawStats: {
        facedCbet: 40,
        foldedToCbet: Math.round(40 * foldToCbet),
        pfAggressorFlops: 30,
        cbetCount: 17,
        facedRaisePreflop: 20,
        threeBetCount: 2,
      },
    },
  },
});

const runPolicy = async ({ villainFeed = null, villainSource = 'null' }) => {
  const { ctx, hand } = mkDecision();
  return heroPolicyAt({
    ctx, hand, rakeConfig: null,
    comboSamples: 6, trials: 40, refinementBudgetMs: 0,
    // One fixed seed: the two runs being compared differ ONLY in the feed.
    equitySeedFor: () => 0xC0FFEE,
    villainFeed, villainSource,
  });
};

describe('heroPolicyAt × villainFeed (WS-436 B2)', () => {
  it('the channel is LIVE: opposite-pole villains produce different advice, and villainFed says so', async () => {
    const foldy = await runPolicy({ villainFeed: feedWith(0.85, null), villainSource: 'stats' });
    const sticky = await runPolicy({ villainFeed: feedWith(0.15, null), villainSource: 'stats' });
    const nul = await runPolicy({});

    // `reason ?? 'ok'` so a skip fails WITH its reason in the assertion message.
    expect(foldy.reason ?? 'ok').toBe('ok');
    expect(sticky.reason ?? 'ok').toBe('ok');
    expect(nul.reason ?? 'ok').toBe('ok');
    expect(foldy.villainFed).toBe(true);
    expect(sticky.villainFed).toBe(true);
    expect(nul.villainFed).toBe(false);

    // The sharp pin: the feed must actually reach the engine. The ENGINE-STATED EV
    // is the finest-grained output this path returns (argmax advice can mask a live
    // channel on a dominated spot); identical EV under a villain who folds 85% and
    // one who folds 15% means the wiring is inert.
    expect(foldy.evStats).not.toEqual(sticky.evStats);
  }, 60000);

  it('falsifier #1 at the harness level: a style label changes NOTHING at this HEAD', async () => {
    // buildPlayerStats cannot even represent a label post-WS-436 A3, so 'styled'
    // and 'stats' must be byte-identical here. Against the pre-WS-436 worktree
    // this same pair of arms is what MEASURES the label channel (B4 protocol).
    const stats = await runPolicy({ villainFeed: feedWith(0.85, null), villainSource: 'stats' });
    const styled = await runPolicy({ villainFeed: feedWith(0.85, 'Nit'), villainSource: 'styled' });
    expect(styled.actions).toEqual(stats.actions);
  }, 60000);

  it('an absent feed is byte-identical to the legacy null-villain path', async () => {
    const legacy = await runPolicy({});
    const explicitNull = await runPolicy({ villainFeed: feedWith(0.85, 'Nit'), villainSource: 'null' });
    expect(explicitNull.actions).toEqual(legacy.actions);
  }, 60000);
});
