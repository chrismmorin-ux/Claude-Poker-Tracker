/**
 * aksSqueezeHandEval.test.js — one-off hand-review harness (2026-08-07)
 *
 * Hand: 1/3 live, BTN straddle $7. BB calls 7 (folds later). MP open-jams 45
 * (all-in) into 15. HJ calls 45 (395 total). Hero (CO, $750) squeezes to 200
 * with AKs. BTN (straddler, 1000+) jams. BB folds, HJ calls all-in, hero calls
 * all-in. Showdown: MP 46s (straight, wins main), HJ 55 (set, wins side 1),
 * BTN KK (wins side 2 vs hero). Hero AKs whiffs.
 *
 * Part 1: builds the hand via real reducer dispatches (record validation).
 *         Always runs — doubles as a regression test for straddle + all-in
 *         flags + per-pot winner attribution through the real reducers.
 * Parts 2-3 (heavy, ~45s CPU): exact 4-way all-in equity by full board
 *         enumeration + decision-time EV vs modeled ranges. Skipped in the
 *         normal suite; run with:
 *           HAND_EVAL=1 npx vitest run src/test/aksSqueezeHandEval.test.js --project unit
 *         Results + full writeup: docs/hand-reviews/2026-08-07-aks-squeeze-4way.md
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { gameReducer, initialGameState, GAME_ACTIONS } from '../reducers/gameReducer';
import { cardReducer, initialCardState, CARD_ACTIONS } from '../reducers/cardReducer';
import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';
import { ACTIONS } from '../constants/gameConstants';
import { buildTimeline } from '../utils/handAnalysis';
import { parseAndEncode } from '../utils/pokerCore/cardParser';
import { bestFiveFromSeven } from '../utils/pokerCore/handEvaluator';
import { parseRangeString } from '../utils/pokerCore/rangeMatrix';
import { handVsRangesMW } from '../utils/pokerCore/monteCarloEquity';
import { computeHandVsHand } from '../utils/pokerCore/preflopEquity';

const OUT = process.env.SCRATCH_OUT || '/tmp/aks-squeeze-out';

// ── Seat map ──────────────────────────────────────────────────────────────
// Dealer/BTN straddler = seat 1, SB = 2, BB = 3, UTG = 4, MP = 6, HJ = 8,
// hero CO = 9.
const BTN = 1, SB = 2, BB = 3, UTG = 4, UTG1 = 5, MP = 6, LJ = 7, HJ = 8, HERO = 9;

// ── Pot layers (from stated stacks) ──────────────────────────────────────
// Dead money: SB 1 + BB 7 (called straddle, folded to jam) = 8
// MP all-in 45 · HJ all-in 395 · Hero all-in 750 · BTN matches 750
const MAIN_POT = 45 * 4 + 8;           // 188 — all four live
const SIDE1 = (395 - 45) * 3;          // 1050 — HJ, hero, BTN
const SIDE2 = (750 - 395) * 2;         // 710 — hero vs BTN
const HERO_TOTAL_IN = 750;
const HERO_CALL_COST = 550;            // 200 already in when BTN jams

describe('AKs squeeze 4-way hand review', () => {
  it('Part 1: hand record builds cleanly through the real reducers', () => {
    const record = (seat, action, amount, allIn) => ({
      type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
      payload: { seat, action, ...(amount !== undefined && { amount }), ...(allIn && { allIn: true }) },
    });
    const { FOLD, CALL, RAISE } = PRIMITIVE_ACTIONS;

    const gameDispatches = [
      { type: GAME_ACTIONS.SET_DEALER, payload: BTN },
      { type: GAME_ACTIONS.SET_MY_SEAT, payload: HERO },
      { type: GAME_ACTIONS.RECORD_STRADDLE, payload: { seat: BTN, amount: 7 } },
      record(SB, FOLD),
      record(BB, CALL, 7),
      record(UTG, FOLD),
      record(UTG1, FOLD),
      record(MP, RAISE, 45, true),      // open-jam, all-in
      record(LJ, FOLD),
      record(HJ, CALL, 45),
      record(HERO, RAISE, 200),         // the squeeze
      record(BTN, RAISE, 1000, true),   // straddler jams over
      record(BB, FOLD),
      record(HJ, CALL, 395, true),      // all-in for less
      record(HERO, CALL, 750, true),    // hero calls off
      // Showdown — per-pot winner attribution (0=main, 1, 2)
      { type: GAME_ACTIONS.SET_POT_WINNER, payload: { seat: MP, pot: 0 } },
      { type: GAME_ACTIONS.SET_POT_WINNER, payload: { seat: HJ, pot: 1 } },
      { type: GAME_ACTIONS.SET_POT_WINNER, payload: { seat: BTN, pot: 2 } },
      { type: GAME_ACTIONS.RECORD_SHOWDOWN_ACTION, payload: { seat: HERO, action: ACTIONS.MUCKED } },
    ];
    const gameState = gameDispatches.reduce(gameReducer, initialGameState);

    const setHole = (index, card) => ({ type: CARD_ACTIONS.SET_HOLE_CARD, payload: { index, card } });
    const setSeatCard = (seat, slotIndex, card) => ({ type: CARD_ACTIONS.SET_PLAYER_CARD, payload: { seat, slotIndex, card } });
    const cardDispatches = [
      setHole(0, 'A♠'), setHole(1, 'K♠'),
      setSeatCard(MP, 0, '6♥'), setSeatCard(MP, 1, '4♥'),
      setSeatCard(HJ, 0, '5♣'), setSeatCard(HJ, 1, '5♦'),
      setSeatCard(BTN, 0, 'K♥'), setSeatCard(BTN, 1, 'K♦'),
      // Board not entered — exact runout wasn't recorded, only outcomes.
    ];
    const cardState = cardDispatches.reduce(cardReducer, initialCardState);

    // Every dispatch must have landed (reducers silently reject invalid ones)
    // 1 straddle + 12 betting actions + 3 WON + 1 mucked = 17 entries
    expect(gameState.actionSequence).toHaveLength(17);
    expect(gameState.actionSequence[0].action).toBe(PRIMITIVE_ACTIONS.STRADDLE);
    expect(cardState.holeCards).toEqual(['A♠', 'K♠']);
    expect(cardState.allPlayerCards[MP]).toEqual(['6♥', '4♥']);
    expect(cardState.allPlayerCards[HJ]).toEqual(['5♣', '5♦']);
    expect(cardState.allPlayerCards[BTN]).toEqual(['K♥', 'K♦']);

    const handRecord = {
      timestamp: Date.now(),
      gameState,
      cardState,
      seatPlayers: {},
    };
    // buildTimeline walks betting streets only — the 4 showdown entries stay
    // in actionSequence (asserted above) but are not timeline rows.
    const timeline = buildTimeline(handRecord);
    expect(timeline.length).toBe(13);
    expect(timeline.every(e => e.street === 'preflop')).toBe(true);
    const showdown = gameState.actionSequence.filter(e => e.street === 'showdown');
    expect(showdown).toHaveLength(4);
    expect(showdown.filter(e => e.action === ACTIONS.WON).map(e => e.pot)).toEqual([0, 1, 2]);

    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(`${OUT}/hand-record.json`, JSON.stringify(handRecord, null, 2));
    console.log('[Part 1] hand record valid; timeline entries:', timeline.length);
  });

  it.skipIf(!process.env.HAND_EVAL)('Part 2: exact 4-way all-in equity + pot-layer EV (full enumeration)', () => {
    const hero = ['A♠', 'K♠'].map(parseAndEncode);
    const mp = ['6♥', '4♥'].map(parseAndEncode);
    const hj = ['5♣', '5♦'].map(parseAndEncode);
    const btn = ['K♥', 'K♦'].map(parseAndEncode);
    const dead = new Set([...hero, ...mp, ...hj, ...btn]);
    expect(dead.size).toBe(8);

    const deck = [];
    for (let c = 0; c < 52; c++) if (!dead.has(c)) deck.push(c);
    expect(deck.length).toBe(44);

    const seven = new Array(7);
    const score = (h, b0, b1, b2, b3, b4) => {
      seven[0] = h[0]; seven[1] = h[1];
      seven[2] = b0; seven[3] = b1; seven[4] = b2; seven[5] = b3; seven[6] = b4;
      return bestFiveFromSeven(seven);
    };

    // Expected dollars per player + hero per-pot equity shares
    const ev = { hero: 0, mp: 0, hj: 0, btn: 0 };
    let heroMainEq = 0, heroS1Eq = 0, heroS2Eq = 0;
    let boards = 0;

    for (let i = 0; i < 40; i++)
      for (let j = i + 1; j < 41; j++)
        for (let k = j + 1; k < 42; k++)
          for (let l = k + 1; l < 43; l++)
            for (let m = l + 1; m < 44; m++) {
              const b0 = deck[i], b1 = deck[j], b2 = deck[k], b3 = deck[l], b4 = deck[m];
              const sH = score(hero, b0, b1, b2, b3, b4);
              const sM = score(mp, b0, b1, b2, b3, b4);
              const sJ = score(hj, b0, b1, b2, b3, b4);
              const sB = score(btn, b0, b1, b2, b3, b4);
              boards++;

              // Main pot: all four
              const maxMain = Math.max(sH, sM, sJ, sB);
              let n = 0;
              if (sH === maxMain) n++;
              if (sM === maxMain) n++;
              if (sJ === maxMain) n++;
              if (sB === maxMain) n++;
              const mainShare = MAIN_POT / n;
              if (sH === maxMain) { ev.hero += mainShare; heroMainEq += 1 / n; }
              if (sM === maxMain) ev.mp += mainShare;
              if (sJ === maxMain) ev.hj += mainShare;
              if (sB === maxMain) ev.btn += mainShare;

              // Side pot 1: HJ, hero, BTN
              const maxS1 = Math.max(sH, sJ, sB);
              let n1 = 0;
              if (sH === maxS1) n1++;
              if (sJ === maxS1) n1++;
              if (sB === maxS1) n1++;
              const s1Share = SIDE1 / n1;
              if (sH === maxS1) { ev.hero += s1Share; heroS1Eq += 1 / n1; }
              if (sJ === maxS1) ev.hj += s1Share;
              if (sB === maxS1) ev.btn += s1Share;

              // Side pot 2: hero vs BTN
              if (sH > sB) { ev.hero += SIDE2; heroS2Eq += 1; }
              else if (sB > sH) ev.btn += SIDE2;
              else { ev.hero += SIDE2 / 2; ev.btn += SIDE2 / 2; heroS2Eq += 0.5; }
            }

    expect(boards).toBe(1086008); // C(44,5)

    const result = {
      boards,
      potLayers: { MAIN_POT, SIDE1, SIDE2, total: MAIN_POT + SIDE1 + SIDE2 },
      heroEquityByPot: {
        main: heroMainEq / boards,
        side1: heroS1Eq / boards,
        side2: heroS2Eq / boards,
      },
      expectedDollars: {
        hero: ev.hero / boards,
        mp: ev.mp / boards,
        hj: ev.hj / boards,
        btn: ev.btn / boards,
      },
      heroNetWholeHand: ev.hero / boards - HERO_TOTAL_IN,
      heroCallEVCardsFaceUp: ev.hero / boards - HERO_CALL_COST,
      pairwise: {
        aksVsKK: computeHandVsHand('AKs', 'KK').equity,
        aksVs55: computeHandVsHand('AKs', '55').equity,
        aksVs64s: computeHandVsHand('AKs', '64s').equity,
      },
    };
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(`${OUT}/exact-equity.json`, JSON.stringify(result, null, 2));
    console.log('[Part 2]', JSON.stringify(result, null, 2));
  }, 600000);

  it.skipIf(!process.env.HAND_EVAL)('Part 3: decision-time EV of the call vs modeled ranges', async () => {
    const hero = ['A♠', 'K♠'].map(parseAndEncode);

    // MP $45 open-jam over a $7 straddle (~6.4 straddles) — wide shove range.
    // (His actual 64s is wider than even this model — noted in the writeup.)
    const mpRange = parseRangeString(
      '22+,A2s+,A8o+,K9s+,KJo+,QTs+,QJo,JTs,T9s,98s,87s,76s,65s,54s',
    );
    // HJ flat-calls 45 with 350 behind — pairs/broadway-ish, sets 55 in range.
    const hjRange = parseRangeString('22+,ATs+,AJo+,KTs+,KQo,QJs,JTs,T9s,98s');
    // BTN straddler 5-bet jam over the squeeze — three scenarios.
    const btnScenarios = {
      'ultra-tight (KK+)': parseRangeString('KK+'),
      'standard (QQ+, AK)': parseRangeString('QQ+,AKs,AKo'),
      'wide (TT+, AQs+, AKo)': parseRangeString('TT+,AQs+,AKo'),
    };

    const opts = { trials: 150000, batchSize: 5000, convergenceThreshold: 0.0001 };
    const out = {};
    for (const [label, btnRange] of Object.entries(btnScenarios)) {
      const [main, s1, s2] = await Promise.all([
        handVsRangesMW(hero, [mpRange, hjRange, btnRange], [], opts),
        handVsRangesMW(hero, [hjRange, btnRange], [], opts),
        handVsRangesMW(hero, [btnRange], [], opts),
      ]);
      const winnings = main.equity * MAIN_POT + s1.equity * SIDE1 + s2.equity * SIDE2;
      out[label] = {
        eqMain: main.equity, eqSide1: s1.equity, eqSide2: s2.equity,
        ciHalfMain: main.ciHalf,
        expectedWinnings: Math.round(winnings * 10) / 10,
        callEV: Math.round((winnings - HERO_CALL_COST) * 10) / 10,
      };
    }
    fs.writeFileSync(`${OUT}/decision-ev.json`, JSON.stringify(out, null, 2));
    console.log('[Part 3]', JSON.stringify(out, null, 2));
    expect(Object.keys(out)).toHaveLength(3);
  }, 600000);
});
