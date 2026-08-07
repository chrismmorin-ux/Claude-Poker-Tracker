/**
 * WS-318 PREMISE EVIDENCE — NOT A REGRESSION SUITE. DELETE WHEN WS-318 IS FIXED.
 *
 * WS-318 says weakness matching is "far looser than intended" and that the string
 * "in flop agg spots" is on screen today. Both are FALSE. The mechanism the ticket
 * describes (axis 3 is `isAgg`, compared while the naming said "action") is real and
 * present in both named files — but two upstream producers make the whole feature
 * DEAD, so the match rate is 0 and the string can never render.
 *
 *   PRODUCER 1 — replayAnalysis.js:660 calls a SEVEN-parameter builder with FOUR args:
 *       buildSituationKeyFn(street, texture, posCategory, action)
 *     `action` lands in the isAgg slot and axes 4-6 come out empty, so the key that
 *     reaches matchHeroWeakness is `flop:dry:LATE:call:::` — axis 3 holds an ACTION.
 *     Weakness keys from decisionAccumulator hold 'agg'/'def' there. Never equal.
 *
 *   PRODUCER 2 — handSignificance.buildQuickSituationKeys emits FOUR axes
 *     (`flop:unknown:EARLY:call`). parseSituationKey requires 7 or 8, so
 *     tryParseSituationKey returns null and both branches short-circuit to 0.
 *
 * CONSEQUENCE FOR THE TICKET: acceptance criterion 4 ("Match rate WILL move — report
 * how many matches are gained/lost") is UNSATISFIABLE by editing only the two named
 * files. 0 before, 0 after, under (a) contextAction, (b) isAgg, or (c) both.
 *
 * These assertions pin the CURRENT BROKEN behaviour deliberately, so the finding
 * cannot be lost. They MUST fail once the producers are fixed — that is the point.
 */
import { describe, it, expect } from 'vitest';
import { buildSituationKey } from '../../exploitEngine/decisionAccumulator';
import { tryParseSituationKey } from '../../pokerCore/situationKey';
import { matchHeroWeakness } from '../heroAnalysis';
import { computeHandSignificance } from '../handSignificance';

describe('WS-318 premise diagnostic', () => {
  it('A. the key replayAnalysis actually passes to matchHeroWeakness', () => {
    // replayAnalysis.js:660 — buildSituationKeyFn(street, texture, posCategory, action)
    // 4 args into a 7-param builder.
    const produced = buildSituationKey('flop', 'dry', 'LATE', 'call');
    console.log('PRODUCTION KEY   =', JSON.stringify(produced));
    console.log('PARSED           =', JSON.stringify(tryParseSituationKey(produced)));
    expect(produced).toBe('flop:dry:LATE:call:::');
    expect(tryParseSituationKey(produced).isAgg).toBe('call'); // axis 3 holds an ACTION
  });

  it('B. a real weakness key from the accumulator holds agg/def at axis 3', () => {
    const weaknessKey = buildSituationKey('flop', 'dry', 'LATE', 'def', 'ip', 'bet', 'call');
    console.log('WEAKNESS KEY     =', JSON.stringify(weaknessKey));
    expect(tryParseSituationKey(weaknessKey).isAgg).toBe('def');
  });

  it('C. therefore matchHeroWeakness NEVER matches in production', () => {
    const weaknesses = [{
      label: 'Over-calls on the river',
      situationKeys: [
        buildSituationKey('flop', 'dry', 'LATE', 'def', 'ip', 'bet', 'call'),
        buildSituationKey('flop', 'dry', 'LATE', 'agg', 'ip', 'none', 'cbet'),
      ],
      sampleSize: 9,
    }];
    for (const action of ['call', 'bet', 'raise', 'check', 'fold']) {
      const prodKey = buildSituationKey('flop', 'dry', 'LATE', action);
      const res = matchHeroWeakness(prodKey, weaknesses);
      console.log(`  action=${action.padEnd(6)} key=${prodKey.padEnd(24)} match=`, res);
      expect(res).toBeNull();
    }
  });

  it('D. handSignificance quick keys are 4-axis and never parse', () => {
    const hand = {
      gameState: {
        mySeat: 1, dealerButtonSeat: 9, blindsPosted: { sb: 1, bb: 2 },
        actionSequence: [
          { seat: 1, action: 'call', street: 'flop', order: 0, amount: 10 },
          { seat: 3, action: 'bet', street: 'flop', order: 1, amount: 10 },
        ],
      },
      seatPlayers: { 1: 'hero', 3: 'villain1' },
      cardState: { allPlayerCards: {} },
    };
    // Every 7-axis weakness key we could plausibly hold:
    const tendencyMap = {
      hero: {
        weaknesses: [{
          label: 'x', sampleSize: 5,
          situationKeys: [
            buildSituationKey('flop', 'unknown', 'EARLY', 'def', 'ip', 'none', 'call'),
            buildSituationKey('flop', 'unknown', 'EARLY', 'agg', 'ip', 'none', 'cbet'),
            buildSituationKey('flop', 'unknown', 'EARLY', 'call', '', '', ''),
          ],
        }],
      },
      villain1: {
        weaknesses: [{
          label: 'y', sampleSize: 5,
          situationKeys: [buildSituationKey('flop', 'unknown', 'LATE', 'agg', 'ip', 'none', 'cbet')],
        }],
      },
    };
    const withW = computeHandSignificance(hand, 'hero', tendencyMap);
    const withoutW = computeHandSignificance(hand, 'hero', {});
    console.log('heroLearning  withWeakness=', withW.factors.heroLearning,
      ' withoutWeakness=', withoutW.factors.heroLearning);
    console.log('villainIntel  withWeakness=', withW.factors.villainIntel,
      ' withoutWeakness=', withoutW.factors.villainIntel);
    // If weakness matching worked at all, heroLearning would differ by 0.25
    expect(withW.factors.heroLearning).toBe(withoutW.factors.heroLearning);
  });
});
