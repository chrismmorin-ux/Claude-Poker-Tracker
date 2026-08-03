/**
 * blindDefense.card.js — a minimal VALID Strategy Card, used as the loader's happy path.
 *
 * Deliberately small. This is a fixture proving the loader accepts a well-formed card, not a
 * strategy anybody should play — the real preflop artifact is WS-323's 169-cell Entry Map,
 * and the derived defense frequencies it should be checked against are WS-333's job. The
 * rules below are illustrative of SHAPE: one per warrant class, so every branch of the
 * warrant enum is exercised by something.
 *
 * Note what makes this one artifact rather than two: the `rationale` field is a required
 * schema field, so the reasoning is DATA that travels with the card and gets hashed with it —
 * not a comment that can drift away from the rules underneath it.
 */

export const blindDefenseCard = {
  cardId: 'fixture-blind-defense-v1',
  schemaVersion: 1,
  title: 'Blind defense vs a late-position open (fixture)',
  rationale:
    'A shape fixture for the WS-322 loader. Defends BB wider than SB against the same open, ' +
    'which is the direction pot odds alone do NOT predict — SB has the worse price by only ' +
    'about six points, yet collapses toward 3bet-or-fold because it is out of position AND ' +
    'still has a live player behind it. That third penalty is invisible to price. WS-333 is ' +
    'where the frequencies get derived rather than asserted; here they are placeholders.',

  domain: {
    gameType: 'cash',
    seats: [6, 9],
    stackDepthBB: [80, 200],
  },

  rules: [
    {
      id: 'bb-defend-vs-btn',
      when: { street: 'preflop', posCategory: 'BB', facingAction: 'raise' },
      do: { call: 0.7, raise: 0.15, fold: 0.15 },
      warrant: 'structure',
      note: 'BB has already posted, closes the action, and gets the best price of any seat.',
    },
    {
      id: 'sb-vs-btn',
      when: { street: 'preflop', posCategory: 'SB', facingAction: 'raise' },
      do: { raise: 0.2, fold: 0.8 },
      warrant: 'structure',
      note: 'Out of position with BB still to act — calling does not close the action.',
    },
    {
      id: 'btn-steal',
      when: { street: 'preflop', posCategory: 'BTN', facingAction: 'none' },
      do: 'raise',
      warrant: 'equity',
      note: 'Bare action string — desugars to { raise: 1 }.',
    },
    {
      id: 'vs-known-overfolder',
      when: { street: 'flop', posCategory: 'BTN', isIP: 'true' },
      do: { bet: 0.85, check: 0.15 },
      warrant: {
        class: 'read',
        claim: 'This pool folds to a flop c-bet in single-raised pots more than 55% of the time.',
      },
      note: 'A read warrant states the population number it depends on, so it can be scored.',
    },
    {
      id: 'turn-medium-slowdown',
      when: { street: 'turn', posCategory: 'BB' },
      do: { check: 0.8, bet: 0.2 },
      warrant: 'fear',
      note:
        'Declared as fear on purpose. The arithmetic does not justify checking this often — ' +
        'the author is avoiding a big turn pot out of position. Recording it makes the EV it ' +
        'costs measurable instead of hiding it inside an equity label.',
    },
  ],

  residual: {
    do: { fold: 1 },
    rationale:
      'Anything inside the domain no rule above reaches, we fold. Stated so the residual EV ' +
      'share is measurable — how much of this card\'s result comes from the part nobody designed.',
  },
};

export default blindDefenseCard;
