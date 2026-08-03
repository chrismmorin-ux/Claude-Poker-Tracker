/**
 * unenclosed.card.js — a Strategy Card that is NOT enclosed. Must fail to load.
 *
 * Every field is present and plausible except the residual clause. This is the realistic
 * failure, not a contrived one: named rules are the interesting part to write, and the
 * fallback is the part an author means to come back to. A card in exactly this state looks
 * finished, plays fine in the spots its author was thinking about, and silently has no
 * defined behaviour everywhere else — so its measured EV would be attributed entirely to
 * rules that only ever ran on the subset of hands they happened to cover.
 *
 * That is why enclosure is CHECKED rather than asserted.
 */

export const unenclosedCard = {
  cardId: 'fixture-unenclosed-v1',
  schemaVersion: 1,
  title: 'Opens only (fixture — deliberately unenclosed)',
  rationale:
    'Covers the spots the author cared about and nothing else. Loading this must throw, ' +
    'naming the residual clause as the reason.',

  domain: {
    gameType: 'cash',
    seats: [9],
    stackDepthBB: [80, 200],
  },

  rules: [
    {
      id: 'btn-open',
      when: { street: 'preflop', posCategory: 'BTN', facingAction: 'none' },
      do: 'raise',
      warrant: 'structure',
    },
    {
      id: 'co-open',
      when: { street: 'preflop', posCategory: 'CO', facingAction: 'none' },
      do: 'raise',
      warrant: 'structure',
    },
  ],

  // residual: intentionally absent.
};

export default unenclosedCard;
