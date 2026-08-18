/**
 * ruleCatalogue — the space of rules a villain might be following, written as poker first.
 *
 * WHY THIS FILE EXISTS. The v0 rules were generated from what was countable, and a count was
 * then called a rule. That gets the direction backwards and it is why the founder's table
 * knowledge did not appear: the statistics can only expose the shapes the statistics happen
 * to have. A rule should begin as a claim a player would actually make, in prose, and only
 * then be handed to a test. This catalogue is the hypothesis space. Nothing here was mined;
 * every entry is a thing someone might be doing, written down so it can be refuted.
 *
 * A CATALOGUE ENTRY IS NOT A FINDING. It is a question with a shape. `testability` records
 * whether the corpus can answer it today, and entries that cannot be answered today are kept
 * deliberately — the set of unanswerable-but-real questions is the specification for what the
 * inference layer has to produce, and deleting them would hide the gap.
 *
 * FIELDS
 *   prose        first person, the way the villain would state it to themselves
 *   asks         what a person would be asking about an opponent
 *   shape        absolute | threshold | hand-class | sizing | sequence | conditional | composition
 *   conditions   the decision fields it keys on — all must be equity/price/SPR/board/sequence
 *   falsifier    the single observation that kills it
 *   testability  direct        — observable on 100% of decisions
 *                showdown      — needs revealed cards (4.70% of seat-hands, continuing-biased)
 *                inference     — needs the per-hand range narrowing layer
 *                negative      — inferred from what NEVER appears at showdown (see §NEGATIVE)
 *
 * NEGATIVE-SPACE ENTRIES, and why they are not a trick. Founder, 2026-08-18: "he never turns
 * over a winning flush when it hits ... he started with 13% of his range containing hearts and
 * now there is nothing". The absence of a showdown category is evidence. Two readings survive
 * an absence — the hands were never held, or they were folded earlier — and they are separated
 * by the BASE RATE, which comes from board combinatorics rather than from any model
 * (POKER_THEORY: base rate from board combinatorics, never the model's estimate). If a range
 * of a measured width must contain N flush combos by combinatorics, and zero ever appear at
 * showdown across M completing boards, the folding branch is what remains. The founder expects
 * the opposite to dominate in this population — people chase too much — which makes this a
 * genuine two-sided test rather than a confirmation.
 */

export const RULES = [

  // ─── PREFLOP: what I come in with ──────────────────────────────────────────
  {
    id: 'pf-entry-width',
    prose: 'I come in with about the same share of hands every time, and it does not move much.',
    asks: 'How wide is this player, really?',
    shape: 'threshold', conditions: ['firstIn'],
    falsifier: 'entry frequency differs materially across comparable spots',
    testability: 'direct',
  },
  {
    id: 'pf-entry-is-top-down',
    prose: 'I play the best hands and fold the rest — my range is the top of the deck, nothing else.',
    asks: 'Is this a chart player or a habit player?',
    shape: 'composition', conditions: ['firstIn', 'handClass'],
    falsifier: 'a hand shown from an entry spot that sits outside a chart of that width',
    testability: 'showdown',
    note: 'Already refuted for the first villain examined: 22, 22 and 76s shown from entry spots '
      + 'inside a 12.8% frequency. Right size, wrong composition.',
  },
  {
    id: 'pf-limp-is-trap',
    prose: 'When I limp, it is because I have something huge and I want you to bet.',
    asks: 'Is the limp strong or weak?',
    shape: 'composition', conditions: ['firstIn', 'action=call'],
    falsifier: 'limped hands that fold to a single flop bet more often than a strong range could',
    testability: 'inference',
    note: 'The founder question. Measured on villain SO0Om: 3 limps — one stacked off on 644 '
      + '(trips or better), one barrelled turn and river, one check-folded to an overbet. That '
      + 'pattern fits small pairs and speculative hands, NOT a premium trap.',
  },
  {
    id: 'pf-limp-is-speculative',
    prose: 'I limp small pairs and suited hands to see a cheap flop, and I give up when I miss.',
    asks: 'Is the limping range setmining?',
    shape: 'composition', conditions: ['firstIn', 'action=call'],
    falsifier: 'limped hands that continue on dry high-card flops at a rate a setmining range cannot',
    testability: 'inference',
  },
  {
    id: 'pf-limp-behind-only',
    prose: 'I will limp along once someone else has, but I never open a limp myself.',
    asks: 'Does the limp depend on other people having entered?',
    shape: 'conditional', conditions: ['limpersAhead'],
    falsifier: 'a first-in limp with no limpers ahead',
    testability: 'direct',
  },
  {
    id: 'pf-suited-always',
    prose: 'I play every suited hand I am dealt.',
    asks: 'Are suited cards a trigger by themselves?',
    shape: 'hand-class', conditions: ['handClass=suited'],
    falsifier: 'a suited hand folded in a spot where the same offsuit hand was played',
    testability: 'inference',
    note: 'Founder example. Needs the counterfactual pairing, which only range inference supplies.',
  },
  {
    id: 'pf-pairs-always',
    prose: 'I never fold a pocket pair before the flop.',
    asks: 'Are pairs a trigger by themselves?',
    shape: 'hand-class', conditions: ['handClass=pair'],
    falsifier: 'a pocket pair shown as a fold — never directly observable, so this is a negative test',
    testability: 'negative',
  },
  {
    id: 'pf-weak-ace-trap',
    prose: 'I play any ace.',
    asks: 'Does an ace override everything else?',
    shape: 'hand-class', conditions: ['handClass=weak-ace'],
    falsifier: 'entry frequency too low to contain all Ax combos by combinatorics',
    testability: 'direct',
    note: 'Pure frequency refutation: Ax is 14.9% of hands, so an entry frequency below that '
      + 'cannot contain every ace and the rule dies with no card shown.',
  },

  // ─── PREFLOP: facing aggression ────────────────────────────────────────────
  {
    id: 'pf-defend-price',
    prose: 'I call a raise when it is cheap and fold when it gets expensive, whatever I hold.',
    asks: 'Is this player pricing, or reacting to the raise itself?',
    shape: 'threshold', conditions: ['potOddsNeeded'],
    falsifier: 'continue rate flat across price bands',
    testability: 'direct',
    note: 'Measured on the first villain: 39% / 32% / 37% across cheap / standard / steep. FLAT. '
      + 'That player is not pricing at all, which is itself the finding.',
  },
  {
    id: 'pf-3bet-value-only',
    prose: 'When I re-raise before the flop it is always for value. I do not bluff there.',
    asks: 'Is the 3-bet range polarised or pure?',
    shape: 'composition', conditions: ['facing=a raise', 'action=raise'],
    falsifier: 'a 3-bet hand shown that is outside any value range',
    testability: 'showdown',
  },
  {
    id: 'pf-fold-to-3bet-absolute',
    prose: 'If I open and someone re-raises me, I am done unless I have a monster.',
    asks: 'How much does an opener defend?',
    shape: 'threshold', conditions: ['facing=a 3-bet', 'priorRole=opener'],
    falsifier: 'continue rate against a 3-bet materially above the archetype',
    testability: 'direct',
  },
  {
    id: 'pf-cold-vs-open-different',
    prose: 'I treat a raise differently depending on whether I already put money in.',
    asks: 'Does prior investment change the response?',
    shape: 'conditional', conditions: ['priorRole'],
    falsifier: 'identical continue rates across opener / cold / passive roles',
    testability: 'direct',
    note: 'Already measured population-wide: 42.97% / 94.55% / 68.16% fold. Not close.',
  },

  // ─── FLOP: as the aggressor ────────────────────────────────────────────────
  {
    id: 'fl-cbet-range',
    prose: 'If I raised before the flop, I bet the flop. Every time, with everything.',
    asks: 'Is the c-bet automatic?',
    shape: 'absolute', conditions: ['iAmPreflopAggressor', 'facing=no bet'],
    falsifier: 'any checked flop as the preflop aggressor — the exception set is the rule',
    testability: 'direct',
  },
  {
    id: 'fl-cbet-except-connected',
    prose: 'I bet every flop except the low connected ones, where I check and give up.',
    asks: 'Is the c-bet texture-conditional?',
    shape: 'conditional', conditions: ['iAmPreflopAggressor', 'boardTexture.connected', 'boardTexture.highCard'],
    falsifier: 'c-bet frequency identical on connected and dry boards',
    testability: 'direct',
    note: 'Founder example. Fully observable — no cards needed, only texture and action.',
  },
  {
    id: 'fl-cbet-sizing-fixed',
    prose: 'I bet the same fraction of the pot every time, no matter what I have.',
    asks: 'Does sizing carry information?',
    shape: 'sizing', conditions: ['raiseToFractionOfPot'],
    falsifier: 'sizing variance beyond rounding across hand classes',
    testability: 'direct',
    note: 'Sizing rules are hand-class-INDEPENDENT and so escape the 4.7% card budget entirely. '
      + 'Underused: the first villain sizes 2.00x pot vs one limper and 1.71x vs two.',
  },
  {
    id: 'fl-sizing-tells-strength',
    prose: 'I bet big when I am strong and small when I am weak.',
    asks: 'Is sizing a tell?',
    shape: 'sizing', conditions: ['raiseToFractionOfPot', 'handClass'],
    falsifier: 'shown hand strength uncorrelated with sizing',
    testability: 'showdown',
  },
  {
    id: 'fl-multiway-tightens',
    prose: 'I bet far less when there are three or more of us.',
    asks: 'Does the player count change the aggression?',
    shape: 'conditional', conditions: ['opponentsLive'],
    falsifier: 'bet frequency flat in opponent count',
    testability: 'direct',
  },

  // ─── FLOP / TURN: as the caller, and the draw rules ────────────────────────
  {
    id: 'dr-chase-any-draw',
    prose: 'If I have a draw I am calling, and the price does not really come into it.',
    asks: 'Does this player chase regardless of price?',
    shape: 'threshold', conditions: ['potOddsNeeded', 'draw'],
    falsifier: 'continue rate on draws falling with price',
    testability: 'inference',
    note: 'Founder expects chasing to dominate this population. Two-sided test.',
  },
  {
    id: 'dr-nut-draw-ceiling',
    prose: 'I call up to about twice the pot when I have the nut flush draw.',
    asks: 'What is the ceiling on a premium draw?',
    shape: 'threshold', conditions: ['potOddsNeeded', 'draw=nut-flush'],
    falsifier: 'a fold at a price below the stated ceiling holding the nut draw',
    testability: 'inference',
    note: 'Founder example, verbatim in shape. Requires knowing the draw was held, so it needs '
      + 'the inference layer; `postflopNarrower.detectDraws` already classifies the draw.',
  },
  {
    id: 'dr-weak-draw-folds',
    prose: 'I chase the nut draw but I let the small ones go.',
    asks: 'Is the chase graded by draw quality?',
    shape: 'conditional', conditions: ['draw', 'drawQuality'],
    falsifier: 'identical continue rates for nut and non-nut draws at the same price',
    testability: 'inference',
  },
  {
    id: 'dr-small-flush-folds-to-raise',
    prose: 'I fold my small flushes when I get raised after the fourth flush card comes.',
    asks: 'Does a completed board scare the made-but-not-nut hand?',
    shape: 'sequence', conditions: ['boardTexture.monotone', 'facing=a raise', 'street>=turn'],
    falsifier: 'a small flush shown as a call in exactly that spot',
    testability: 'inference',
    note: 'Founder example, verbatim in shape.',
  },
  {
    id: 'dr-flush-never-shows',
    prose: '(implicit) I do not arrive at showdown with flushes.',
    asks: 'Did the draws get folded earlier, or were they never there?',
    shape: 'composition', conditions: ['boardTexture.monotone', 'showdown'],
    falsifier: 'flush combos appearing at showdown at the rate combinatorics predicts',
    testability: 'negative',
    note: 'THE NEGATIVE-SPACE TEST. Founder: "the lack of winning means they either did not have '
      + 'or they folded winning hands." Separated by the base rate from board combinatorics — a '
      + 'range of measured width contains a computable number of flush combos on a completing '
      + 'board. Zero showdowns across many such boards is a fold branch, not an absence.',
  },
  {
    id: 'dr-one-street-only',
    prose: 'I will pay once to see the next card, but I will not pay twice.',
    asks: 'Does the chase survive a second barrel?',
    shape: 'sequence', conditions: ['street', 'priorStreetAction=call'],
    falsifier: 'turn continue rate after a flop call equal to the flop rate',
    testability: 'direct',
    note: 'Fully observable — it is a claim about the LINE, not the cards. This is the shape a '
      + 'per-node aggregation structurally cannot see.',
  },

  // ─── TURN and RIVER ────────────────────────────────────────────────────────
  {
    id: 'tn-give-up-when-called',
    prose: 'I bet the flop, and if you call I am usually done.',
    asks: 'Does the aggression survive contact?',
    shape: 'sequence', conditions: ['street=turn', 'priorStreetAction=bet', 'wasCalled'],
    falsifier: 'a turn barrel rate as high as the c-bet rate',
    testability: 'direct',
  },
  {
    id: 'tn-barrel-scare-cards',
    prose: 'I fire again when a card comes that should scare you.',
    asks: 'Is the second barrel card-dependent?',
    shape: 'conditional', conditions: ['street=turn', 'boardChange'],
    falsifier: 'barrel frequency independent of whether the turn changed the board',
    testability: 'direct',
  },
  {
    id: 'rv-never-bluffs',
    prose: 'If I bet the river, I have it.',
    asks: 'Is a river bet always value?',
    shape: 'composition', conditions: ['street=river', 'action=bet'],
    falsifier: 'a busted draw shown as a river bet',
    testability: 'showdown',
  },
  {
    id: 'rv-fold-top-pair-to-aggression',
    prose: 'I fold top pair to a big river bet when the board got dangerous.',
    asks: 'Where is the pain threshold on a one-pair hand?',
    shape: 'conditional', conditions: ['street=river', 'handClass=top-pair', 'boardTexture', 'betFractionOfPot'],
    falsifier: 'top pair shown as a river call at that size on that texture',
    testability: 'inference',
    note: 'Founder example.',
  },
  {
    id: 'rv-bluffcatch-station',
    prose: 'I call the river with any pair because I think you are bluffing.',
    asks: 'Is there a bluffcatching floor at all?',
    shape: 'threshold', conditions: ['street=river', 'handClass'],
    falsifier: 'river folds with a made hand at a cheap price',
    testability: 'inference',
  },

  // ─── SHAPE-OF-PLAYER rules, spanning streets ───────────────────────────────
  {
    id: 'sq-check-oop-always',
    prose: 'Out of position I check. Always. I let you act first.',
    asks: 'Is position doing the work rather than the hand?',
    shape: 'absolute', conditions: ['closesAction', 'facing=no bet'],
    falsifier: 'any out-of-position lead — the exception set is the rule',
    testability: 'direct',
    note: 'Founder example. Position appears here as a DESCRIPTION of the decision, not as a '
      + 'causal input to it — permitted by POKER_THEORY §7.1.',
  },
  {
    id: 'sq-slowplay-set',
    prose: 'When I flop a set from a cheap entry, I do not raise. I let you keep betting.',
    asks: 'Does the strongest hand play passively?',
    shape: 'sequence', conditions: ['handClass=set', 'priorRole=passive-entry'],
    falsifier: 'sets shown as flop raises from limped or called entries',
    testability: 'inference',
    note: 'Founder example. Note the measured limp above raised and re-raised on 644, which is '
      + 'evidence AGAINST this for that villain.',
  },
  {
    id: 'sq-spr-stackoff',
    prose: 'When the pot is big relative to what is left, I am getting it in with any decent hand.',
    asks: 'Does SPR set the commitment point?',
    shape: 'threshold', conditions: ['spr'],
    falsifier: 'commitment rate flat across SPR bands',
    testability: 'direct',
  },
  {
    id: 'sq-same-for-both',
    prose: '(the null) I play suited connectors and small pairs exactly the same way.',
    asks: 'Is a distinction I assume exists actually there?',
    shape: 'composition', conditions: ['handClass'],
    falsifier: 'a measurable difference in continue rate between the two classes',
    testability: 'inference',
    note: 'A NEGATIVE FINDING IS THE POINT. Founder: "a definitive statement that they play them '
      + 'the exact same, that assures me we have looked into it." Must be emitted with the size '
      + 'of the difference the sample could have detected.',
  },

  // ─── OPPONENT-CONDITIONAL — the archetype interaction ──────────────────────
  {
    id: 'op-overcall-vs-aggressive',
    prose: 'I call wider against the players who are always betting.',
    asks: 'Does the opponent change the threshold?',
    shape: 'conditional', conditions: ['opponentArchetype', 'potOddsNeeded'],
    falsifier: 'identical continue thresholds regardless of who is betting',
    testability: 'inference',
    note: 'Founder example. Circular by construction and resolved by fixed-point iteration over '
      + 'provisional archetypes — see VILLAIN-ARCHETYPE-ENGINE.md §3.6. This is also the first '
      + 'real test of whether types INTERACT; earlier work established only that they EXIST.',
  },
  {
    id: 'op-overfold-vs-nit',
    prose: 'When the tight player raises, I believe them and get out.',
    asks: 'Is the fold threshold opponent-specific?',
    shape: 'conditional', conditions: ['opponentArchetype', 'facing'],
    falsifier: 'fold rate to a raise independent of the raiser',
    testability: 'inference',
  },
];

// ─── reporting ───────────────────────────────────────────────────────────────

const TESTABILITY_ORDER = ['direct', 'showdown', 'inference', 'negative'];

export const catalogueSummary = () => {
  const byT = new Map();
  const byShape = new Map();
  for (const r of RULES) {
    byT.set(r.testability, (byT.get(r.testability) || 0) + 1);
    byShape.set(r.shape, (byShape.get(r.shape) || 0) + 1);
  }
  return { total: RULES.length, byTestability: byT, byShape };
};

if (process.argv[1] && process.argv[1].endsWith('ruleCatalogue.mjs')) {
  const s = catalogueSummary();
  console.log(`RULE CATALOGUE — ${s.total} candidate rules, written as poker before being written as tests\n`);
  for (const t of TESTABILITY_ORDER) {
    const rules = RULES.filter(r => r.testability === t);
    if (!rules.length) continue;
    const header = {
      direct: 'TESTABLE NOW — observable on 100% of decisions, no cards required',
      showdown: 'NEEDS SHOWDOWNS — 4.70% of seat-hands, biased toward hands that continued',
      inference: 'NEEDS THE RANGE-INFERENCE LAYER — the hand was never shown, so the range must be carried',
      negative: 'NEGATIVE SPACE — inferred from what NEVER appears, against a combinatorial base rate',
    }[t];
    console.log('='.repeat(96));
    console.log(`${header}   [${rules.length}]`);
    console.log('='.repeat(96));
    for (const r of rules) {
      console.log(`\n  ${r.id}  (${r.shape})`);
      console.log(`    "${r.prose}"`);
      console.log(`    asks      : ${r.asks}`);
      console.log(`    dies if   : ${r.falsifier}`);
      if (r.note) console.log(`    note      : ${r.note.replace(/\s+/g, ' ')}`);
    }
    console.log('');
  }
  console.log('='.repeat(96));
  console.log('BY SHAPE: ' + [...s.byShape.entries()].sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`).join('  ·  '));
  console.log(`\n${RULES.filter(r => r.testability === 'direct').length} of ${s.total} can be tested today.`);
  console.log(`${RULES.filter(r => r.testability === 'inference' || r.testability === 'negative').length} require the inference layer — that set IS its specification.`);
}
