/**
 * plumbingProof.card.js — a Strategy Card that exists to prove the WIRE, not to be played.
 *
 * *** THIS IS NOT POKER CONTENT AND MUST NEVER BE QUOTED AS A RESULT. ***
 *
 * WS-425's prototype needs one card that (a) loads under the real
 * `src/utils/standardOfRecord/strategyCard.js` validator, (b) declares a domain the backtest
 * harness can actually satisfy, (c) matches on `handClass` so the RANGE-MARGINALIZATION path
 * is exercised rather than described, and (d) leaves a small, non-zero residual so the
 * residual-EV-share accounting has something to report.
 *
 * The numbers below are placeholders chosen to hit those four properties. They are not a
 * strategy, not derived from anything, and not defended. The real cards this harness is being
 * built for are externally-published charts and frequency tables, and they arrive separately.
 *
 * WHAT IT DEMONSTRATES, rule by rule:
 *   - `oop-premium-bet` / `facing-bet-premium-raise` key on `handClass`, so the card cannot be
 *     evaluated at a decision (the corpus masks hole cards) and must be marginalized over
 *     hero's inferred range. That is the whole point of the fixture.
 *   - `unopened-default` / `facing-bet-default` are class-level MIXES, which is what a
 *     published frequency ("c-bet 30% here") looks like once encoded.
 *   - the residual catches `facingAction: 'raise'`, which no rule reaches — so the residual
 *     share is small and non-zero, which is the interesting case. A residual that fires
 *     never or always tests nothing.
 */

export const plumbingProofCard = {
  cardId: 'fixture-plumbing-proof-v1',
  schemaVersion: 1,
  title: 'Plumbing proof (fixture — not a strategy)',
  rationale:
    'A wire fixture for WS-425. It exists so that the Strategy Card -> arm -> IPS estimator '
    + 'path can be run end to end against the real loader and the real corpus before any '
    + 'published material is encoded. Every frequency below is a placeholder. The card is '
    + 'shaped to exercise three things that are easy to get wrong and impossible to notice '
    + 'from a passing test: hand-class matching against a masked-holding corpus, a mixed '
    + 'action distribution, and a residual clause that actually fires.',

  domain: {
    gameType: 'cash',
    // Wide on purpose. A fixture that abstains everywhere would "pass" while proving nothing,
    // which is the failure mode this whole file exists to avoid.
    seats: [2, 10],
    stackDepthBB: [5, 500],
  },

  rules: [
    {
      id: 'oop-premium-bet',
      when: { facingAction: 'none', handClass: ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'] },
      do: { bet: 1 },
      warrant: 'equity',
      note: 'Hand-class match. Unreachable without range marginalization — the corpus has no hand here.',
    },
    {
      id: 'unopened-default',
      when: { facingAction: 'none' },
      do: { check: 0.7, bet: 0.3 },
      warrant: 'structure',
      note: 'A class-level mix — the shape a published frequency takes once encoded.',
    },
    {
      id: 'facing-bet-premium-raise',
      when: { facingAction: 'bet', handClass: ['AA', 'KK', 'QQ'] },
      do: { raise: 1 },
      warrant: 'equity',
      note: 'Second hand-class rule, on the other response set.',
    },
    {
      id: 'facing-bet-default',
      when: { facingAction: 'bet' },
      do: { fold: 0.6, call: 0.4 },
      warrant: 'structure',
      note: 'Placeholder defense frequency.',
    },
  ],

  residual: {
    do: { fold: 1 },
    rationale:
      'Facing a raise is inside this card\'s domain and no rule above reaches it, so the '
      + 'residual answers. Kept deliberately narrow so the residual share is small and '
      + 'non-zero — a residual that never fires, or always fires, measures nothing.',
  },
};

export default plumbingProofCard;
