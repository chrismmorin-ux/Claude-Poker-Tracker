/**
 * lessons.js — curated teaching content for the postflop Lessons tab.
 *
 * Mirrors the preflop Lessons shape. Each lesson pairs plain-English theory
 * with worked examples. The UI renders sections sequentially; `example`
 * sections reveal a full hand-type breakdown on click.
 *
 * Lead lesson is **Range Decomposition** — the pedagogical spine that ties
 * every other framework together. All equity numbers in narrations are
 * engine-exact from the hand-type breakdown; the teaching text is the
 * translation layer.
 *
 * Shape:
 *   { id, title, frameworkId, summary, sections: Section[] }
 *
 * Section kinds:
 *   { kind: 'prose',   heading?, body }
 *   { kind: 'formula', body }
 *   { kind: 'example', context, opposingContext?, board, takeaway }
 *
 * Pure module — no imports from UI or state layers.
 */

export const LESSONS = [
  {
    id: 'range-decomposition',
    title: 'Range Decomposition',
    frameworkId: 'range_decomposition',
    summary: "Every range on every board breaks into precise hand-type shares — don't think in fuzzy labels.",
    sections: [
      {
        kind: 'prose',
        heading: 'The Core Idea',
        body:
          'On any flop, a range decomposes into specific hand types: made flushes, made straights, sets, trips, two-pair, overpairs, TPTK+, TP-weak, middle pair, bottom pair, underpairs, combo draws, flush draws, OESDs, gutshots, overcards, and air. Every postflop decision starts from knowing the %s. "Villain has a pair" is a fuzzy claim — "BB call range on K72r is 8% TPTK+, 15% TP-weak, 21% middle pair, 20% bottom pair, 10% underpair, 2% two-pair-or-better, and 24% air" is an actionable one.',
      },
      {
        kind: 'formula',
        body: 'Range on board = flush+ ∪ straight+ ∪ (set/trips/two-pair) ∪ top-pair tier ∪ mid/low pair ∪ strong draws ∪ weak draws ∪ air  (sums to 100%)',
      },
      {
        kind: 'prose',
        heading: 'Why Decompose',
        body:
          "Without decomposing, you bet 'because villain folds a lot.' With decomposing, you bet because villain's range is 45% air and 20% weak draws — 65% of combos whose continue-EV against your sizing is negative. The numbers dictate sizing: big bets make sense against polarized ranges (strong + air), small bets against condensed ones (mostly medium). Precision is what survives tight spots.",
      },
      {
        kind: 'example',
        context: { position: 'BTN', action: 'open' },
        opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
        board: 'Ks 7h 2d',
        takeaway:
          'Classic dry board. BTN has the K in range 3× more often than BB can have AA. BB range is capped — the TPTK+ shares are similar, but BB has zero overpair+ (no AA/KK in flat range). Decomposition shows the asymmetry that range advantage alone does not.',
      },
      {
        kind: 'example',
        context: { position: 'BTN', action: 'open' },
        opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
        board: '6h 5d 4c',
        takeaway:
          "Contrast: BTN's range whiffs HARD here (few small pairs, lots of high-card offsuits). BB's flatting range connects with small pairs, suited connectors, and trap hands. Decomposition shows nut region flipping — the image of 'BTN dominates' is wrong.",
      },
      {
        kind: 'prose',
        heading: 'Common Mistakes',
        body:
          "Collapsing the distribution into fuzzy labels ('villain has a medium hand'). Engine-level precision costs nothing at the table if you've trained on it beforehand; all that's needed is knowing roughly what the %s are for each archetype/flop pair. That's what this trainer is for.",
      },
    ],
  },

  {
    id: 'capped-ranges',
    title: 'Capped Ranges',
    frameworkId: 'capped_range_check',
    summary: 'Passive preflop lines exclude the board-rewarded premiums.',
    sections: [
      {
        kind: 'prose',
        heading: 'The Core Idea',
        body:
          "A range is 'capped' when it cannot contain the strongest possible made hands on a given board. BB flatting vs BTN excludes AA (it 3bets); on an A-high board, the BB caller literally cannot have top set. The caller's strongest holding is AK/AQ (TPTK or TP-good) and maybe 77/22 sets — far behind a serious value-bet range.",
      },
      {
        kind: 'formula',
        body: "Engine's isCapped gate: straight+ ∪ sets ∪ trips ∪ two-pair < 2% of the range on this board.",
      },
      {
        kind: 'example',
        context: { position: 'BB', action: 'call', vs: 'BTN' },
        board: 'Ah Kd 7s',
        takeaway:
          "BB call range has no AA/KK (both 3bet for value). On AK7, its strongest typical holding is TPTK (AK) or ~3% set combos (77). Nut region runs ~5% total — the range cannot credibly threaten stacks. PFR bets wide for value, small for tempo.",
      },
      {
        kind: 'example',
        context: { position: 'BB', action: 'call', vs: 'CO' },
        board: 'Kh Qd 2s',
        takeaway:
          'Similar shape: no KK in BB flat range (3bets for value). KQ on KQ2 gives BB two-pair — part of the nut region — but only a small fraction of combos. The caller is capped around top-two-pair.',
      },
      {
        kind: 'prose',
        heading: 'Common Mistakes',
        body:
          "Assuming a range is capped just because the villain called preflop. Some opponents slow-play AA preflop (especially live 1/2 fish); trap lines UNcap the range permanently. The engine's isCapped flag is a structural gate — combine it with showdown data when profiling a specific villain.",
      },
    ],
  },

  {
    id: 'nut-advantage',
    title: 'Nut Advantage',
    frameworkId: 'nut_advantage',
    summary: 'Range advantage ≠ nut advantage. Sizing depends on who has the top of the range.',
    sections: [
      {
        kind: 'prose',
        heading: 'The Core Idea',
        body:
          "Range advantage (average equity) and nut advantage (share of straights+/sets/trips/two-pair) can diverge. A range can have more overall equity while holding fewer nut combos. Bet sizing scales with nut advantage — not range advantage. Big bets require nut combos to threaten stacks; small bets work well when you have the wider pair distribution but no nut edge.",
      },
      {
        kind: 'example',
        context: { position: 'BTN', action: 'open' },
        opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
        board: 'Ah Qd 7s',
        takeaway:
          'BTN has both advantages: all the AA/QQ/77 sets, plus AQ two-pairs, plus every AQ/AK/KQ combo. BB is capped at top-pair-max. BTN can bet big and bet wide. Nut advantage is what makes the overbet threat real.',
      },
      {
        kind: 'example',
        context: { position: 'BTN', action: 'open' },
        opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
        board: '6h 5d 4c',
        takeaway:
          "Nut advantage flips to BB here: BB's flat range has more 66/55/44 sets, more 76s/65s two-pair and straight combos than BTN's wide broadway open. BTN still has the air + overcards — arguably more range advantage on average — but cannot threaten stacks. Cbet smaller and fold more turn cards.",
      },
      {
        kind: 'prose',
        heading: 'Reading the Delta',
        body:
          "The Explorer shows 'Nut region Δ' — a signed percentage-point delta in the combined straight+/set/trips/two-pair share. +8 pp or more is a crushing advantage; 3-8 pp is real (polarized bigger bets are supported); under 3 pp the sizing decision is less constrained. Air and top-pair alone don't make a nut advantage. This is the key distinction from range advantage.",
      },
    ],
  },

  {
    id: 'range-morphology',
    title: 'Range Morphology',
    frameworkId: 'range_morphology',
    summary: 'Ranges come in four shapes. Each has a sizing signature.',
    sections: [
      {
        kind: 'prose',
        heading: 'The Four Shapes',
        body:
          "Linear (merged): strong → medium → weak → air, top-down, monotonic. Polarized: strong + air, little medium. Condensed: mostly medium (mid/low pair, weak draws), few nuts, low air. Capped: no straight+/sets/two-pair worth mentioning. Each shape corresponds to a natural sizing strategy: linear merges, polarized forces large sizes with balanced bluffs, condensed uses small pot-control sizing, capped can only bluff-catch.",
      },
      {
        kind: 'formula',
        body: 'polarized ≈ (nut region + top pair ≥ 20%) AND (air ≥ 30%) AND (mid-low pair + weak draws ≤ 30%)',
      },
      {
        kind: 'example',
        context: { position: 'BTN', action: 'open' },
        board: 'Ks 7h 2d',
        takeaway:
          "BTN open on K72r — linear/merged: pairs 77-AA (overpair), AK (TPTK), KQ/KJ (TP-weak), small-A suited hands (TP of K? no — those miss), plus broadway offsuits (air). Top-down with no hole. Merged sizing (~33-50%) fits.",
      },
      {
        kind: 'example',
        context: { position: 'BB', action: 'call', vs: 'BTN' },
        board: 'Ah Kd 7s',
        takeaway:
          "BB call range on AK7 — capped: no AA/KK (3bet for value), only 77 set (~2% of range) for the nut region. The rest is TPTK (AK), TP-weak (KJ, KQ — wait KQ/KJ missed), plus bluff-catchers. Typical capped-check-and-bluff-catch spot.",
      },
      {
        kind: 'example',
        context: { position: 'BTN', action: 'open' },
        opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
        board: 'Jd 9h 8c',
        takeaway:
          "Middling wet board. BB defend range is LINEAR here — lots of straights (QT, T7s, T9s), lots of pairs, lots of OESDs/gutshots. Merged distribution; medium bet sizing is the default, not polarized overbets.",
      },
    ],
  },

  {
    id: 'board-tilt',
    title: 'Board Tilt',
    frameworkId: 'board_tilt',
    summary: 'Texture structurally favors certain archetypes before combat even begins.',
    sections: [
      {
        kind: 'prose',
        heading: 'The Core Idea',
        body:
          "Multi-broadway boards (AKQ, KQJ) favor the preflop raiser (PFR) structurally — the PFR's open range is broadway-heavy; the caller's defending range is not. Low-connected boards (7-5-4, 6-5-4) favor the defender — the caller's flatting range has more small pairs and suited connectors that actually connect, while the PFR's broadway hands whiff. Paired boards (K-7-7) help the wider range (more trip combos). Monotone boards shift toward blockers over pairs.",
      },
      {
        kind: 'example',
        context: { position: 'BTN', action: 'open' },
        opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
        board: 'Ah Kd Qs',
        takeaway:
          'AKQ — high-card. BTN has every AK/AQ/KQ/JT straight combo and all the big pair overpairs. BB defends this board with weaker pairs and speculative hands. Classic PFR-favored.',
      },
      {
        kind: 'example',
        context: { position: 'BTN', action: 'open' },
        opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
        board: '7c 5h 4d',
        takeaway:
          "Low-connected. BTN's wide broadway-heavy open whiffs on 754 — most combos are two overcards with nothing. BB's flatting range has more small pairs (44, 55, 66) that flop sets and more low suited connectors (65s, 54s, 76s) that hit. Defender favored.",
      },
      {
        kind: 'example',
        context: { position: 'BTN', action: 'open' },
        opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
        board: 'Ah 9h 4h',
        takeaway:
          'Monotone. The suited holdings in each range dominate equity — pairs matter less, flush blockers matter more. Hero holding the A♥ controls the nut flush blocker and can bluff wider; without it, bluffing frequency drops sharply.',
      },
      {
        kind: 'prose',
        heading: 'Common Mistakes',
        body:
          "Thinking board-tilt is the whole story. Board-tilt is a STRUCTURAL prior — it tells you what's likely before you measure. Always confirm with the specific range decomposition; textures can mislead when opponents' ranges are atypical (e.g., a tight-passive villain's flatting range against a specific open).",
      },
    ],
  },

  {
    id: 'whiff-rate',
    title: 'Whiff Rate',
    frameworkId: 'whiff_rate',
    summary: 'Cbet frequency scales with whiff rate — but so does the defender\'s float frequency.',
    sections: [
      {
        kind: 'prose',
        heading: 'The Core Idea',
        body:
          "A range's whiff rate on a flop is the fraction of combos with no pair, no draw, no overcards — strictly nothing. High whiff rate → your continuation-bets as bluffs land more often because villain has fewer continuing hands. But defenders adjust: against a heavy-whiff bluff frequency, floaters widen. The equilibrium is not 'bet 100% because villain whiffs 60%' — it's 'bet the sizing that maximizes EV against villain's actual continue range.'",
      },
      {
        kind: 'example',
        context: { position: 'BTN', action: 'open' },
        board: 'Ks 7h 2d',
        takeaway:
          "BTN is the widest opener; K72r is a dry 'cbet everything small' board in theory. But BTN's range here has lots of TP, mid pairs, low pairs that whiff, and a trail of air (small suited hands with backdoors only). Pedagogical air is ~15-25% — cbet frequency is high but sizing stays small because villain's defending range is not polarized.",
      },
      {
        kind: 'example',
        context: { position: 'UTG', action: 'open' },
        board: '6c 5h 4d',
        takeaway:
          "UTG on 654 — near-zero pedagogical air (every combo has overpairs or overcards). The 'UTG whiffs 654' intuition is wrong; what UTG has is few SETS (nut region capped) but plenty of one-pair hands. The real weakness is nut advantage, not whiff rate.",
      },
      {
        kind: 'prose',
        heading: 'Common Mistakes',
        body:
          "Using whiff rate as the sole cbet trigger. Whiff rate answers 'what % of combos cannot call?'; it does NOT answer 'what sizing maximizes EV against the call range?'. Those two are different questions. Tight ranges on low boards have LOW whiff rates because overpairs dominate — but they still want to cbet, just because they have nut advantage, not because villain has nothing.",
      },
    ],
  },

  // ======================================================================
  // MULTIWAY LESSONS
  // ======================================================================
  {
    id: 'mw-bluff-death',
    title: 'Why Bluffs Die in Multiway',
    frameworkId: 'fold_equity_compression',
    summary: 'Fold equity compounds multiplicatively. One extra villain is a catastrophe for pure bluffs.',
    sections: [
      {
        kind: 'prose',
        heading: 'The Core Math',
        body:
          'Heads-up, a bluff needs the villain to fold some % of the time. Multiway, it needs ALL villains to fold — their fold rates multiply. If each villain independently folds 60% of the time to your cbet, all-folds happens 60% × 60% = 36% HU vs the combined two villains. With three villains it drops to 21.6%. The pure-bluff EV curve collapses rapidly as N grows.',
      },
      {
        kind: 'formula',
        body: 'P(all_fold) = ∏_i P(fold_i) — geometrically shrinks with N',
      },
      {
        kind: 'prose',
        heading: 'Practical implication',
        body:
          'At a 3-way flop on a board where each villain would call ~50% of the time HU, a pure bluff succeeds 25% of the time when you assume independence. Required fold equity for break-even at 33% pot is ~25% — you are at the razor edge of breakeven with a typical call rate. Add in the fact that combined ranges dominate more hands, and pure bluffs are structurally -EV almost everywhere multiway.',
      },
      {
        kind: 'prose',
        heading: 'What still works',
        body:
          'SEMI-BLUFFS — hands with fold equity PLUS equity when called — retain value multiway because the realized-equity branch compensates for the compressed fold equity. Flush draws, open-enders, combo draws can still bet because even when one villain continues, you have 35%+ to improve and win a large pot. Pure air (no equity when called) is where the leak lives.',
      },
      {
        kind: 'example',
        context: { position: 'BTN', action: 'open' },
        board: 'Js 8h 5d',
        takeaway:
          'BTN opens wide, both blinds flat. On J85r, BTN\'s HU whiff rate might be 35%, but his "bluff combo" count 3-way is far smaller — only hands with backdoor equity (A2s-A5s backdoor-flush, suited connectors) retain positive bluff EV. Pure air hands (KQo, QJo offsuit) should check back.',
      },
    ],
  },

  {
    id: 'mw-nut-necessity',
    title: 'Nut Necessity & Value Shrinkage',
    frameworkId: 'nut_necessity',
    summary: 'Multiway: someone always has it. Thin value becomes -EV; nut hands get bigger payoffs.',
    sections: [
      {
        kind: 'prose',
        heading: 'The Core Idea',
        body:
          'A hand that\'s 65% vs one villain\'s continuing range is NOT 65% vs two combined continuing ranges. The probability "someone has me beat" rises geometrically with N. Middle pair that prints a profit HU on a thin value bet is often break-even 3-way and -EV 4-way+. The value threshold must tighten.',
      },
      {
        kind: 'formula',
        body: 'P(best_hand | MW) ≈ P(best_vs_1)^N (approximate — depends on range correlation)',
      },
      {
        kind: 'prose',
        heading: 'The flip side — nut hands gain',
        body:
          'If you DO have the nuts or near-nuts, multiway is a gift. More callers = more total money to extract. Sets, straights, flushes on wet boards play MUCH bigger multiway because multiple villains are likely drawing or have one-pair hands that will pay off. Bet larger sizings; build the pot.',
      },
      {
        kind: 'example',
        context: { position: 'BTN', action: 'open' },
        board: 'Ah 9s 4c',
        takeaway:
          'TPTK AJ vs one villain: thin value bet on the river prints. Vs two villains: TPTK on a river where both villains called flop + turn is often behind — someone has a set, two-pair, or better ace. Bet small or check.',
      },
    ],
  },

  {
    id: 'mw-srp-3way',
    title: 'The SRP 3-way Spot',
    frameworkId: 'hand_class_shift',
    summary: 'Most common multiway scenario — BTN opens, both blinds call. Study this most.',
    sections: [
      {
        kind: 'prose',
        heading: 'Why this matters most',
        body:
          'Across live 1/2 and 2/5 cash, the most-frequent multiway situation is BTN open, SB + BB both cold-call, 3-way SRP. If you play 1000 hands, this spot occurs 30-50 times depending on table composition. HU-optimized intuition mis-solves it systematically.',
      },
      {
        kind: 'prose',
        heading: 'Recalibration checklist',
        body:
          '1. CBET FREQUENCY drops ~40% vs HU. Default "cbet 75% of range" becomes "cbet 35%".\n'
          + '2. CBET SIZING polarizes. Merged 33% cbets lose money multiway; use 50-60% with polar range.\n'
          + '3. BLUFFS need equity. Pure air is -EV; semi-bluffs still break even or profit.\n'
          + '4. VALUE TIGHTENS. Middle pair → check-call; top pair weak → bet-fold; TPTK → bet-call.\n'
          + '5. POSITION MAGNIFIES. IP in MW is worth even more than HU — you see both villains act before deciding.',
      },
      {
        kind: 'example',
        context: { position: 'BTN', action: 'open' },
        board: 'Js 8h 5d',
        takeaway:
          'Full worked 3-way line in Line Mode: "BTN vs BB + SB · 3-way SRP · J♠8♥5♦". Walk it end-to-end — it\'s the reference multiway study spot.',
      },
    ],
  },

  {
    id: 'mw-squeeze',
    title: 'Squeezing vs Flatting With Callers Behind',
    frameworkId: 'squeeze_geometry',
    summary: 'Open + cold-call creates pot odds that make a squeeze uniquely +EV. Flats narrow.',
    sections: [
      {
        kind: 'prose',
        heading: 'The Geometry',
        body:
          'When a player opens and at least one other cold-calls before you, the pot contains dead money (blinds) plus two stackless contributions. A squeeze (re-raise) needs less fold equity to break even because more chips are already in the pot. The "standard 3bet size" shape and sizing both shift.',
      },
      {
        kind: 'formula',
        body: 'Squeeze EV = P(all_fold) × pot + (1 - P(all_fold)) × [continue_EV - squeeze_risk]',
      },
      {
        kind: 'prose',
        heading: 'Facing a squeeze with caller behind',
        body:
          'When you are the original raiser + a cold-caller flatted + a squeezer makes it large — you are sandwiched. The caller\'s range is now narrow (they flatted twice instead of 3-betting or folding, so likely pocket pairs / suited broadways), and they can over-squeeze. Default: call pre only with hands that dominate both ranges (QQ+/AK), fold the rest. 4-bet is the most common positive-EV response with top of range.',
      },
    ],
  },

  {
    id: 'mw-cbet-shifts',
    title: 'C-bet Frequency on Textured Boards in Multiway',
    frameworkId: 'bluff_frequency_collapse',
    summary: 'Paired, low, and wet boards all have different MW cbet recalibrations.',
    sections: [
      {
        kind: 'prose',
        heading: 'Paired boards (KK7, QQ3)',
        body:
          'HU: paired boards love wide cbets — villain\'s flatting range whiffs hard. Multiway: STILL love wide cbets for the same reason, but sizing drops to 25-33% because we\'re bluffing into multiple narrow continuing ranges. Paired-board whiff-rate is high enough that even 3-way, small cbets profit.',
      },
      {
        kind: 'prose',
        heading: 'Low-connected boards (654, 875)',
        body:
          'HU: BTN range whiffs these; defender has range advantage. Multiway: EVEN WORSE for BTN because two villains combined have more of the small-pair + suited-connector combos that connect. Cbet frequency drops to ~20-25% with only the strongest value and best combo draws.',
      },
      {
        kind: 'prose',
        heading: 'Wet boards (JT9, 987ss)',
        body:
          'HU: polar-value sizing (75%+) with strong hands and semi-bluffs. Multiway: ONLY bet with genuine nuts or near-nuts. The equity redistribution on wet boards in MW is brutal — someone has a straight, or a flush draw that you can\'t fold out. Check back TPTK type hands for pot control.',
      },
    ],
  },

  {
    id: 'mw-overcalling',
    title: 'Overcalling Theory',
    frameworkId: 'fold_equity_compression',
    summary: 'Third-in-pot decisions: cheaper price, but equity redistribution is brutal.',
    sections: [
      {
        kind: 'prose',
        heading: 'The situation',
        body:
          'A player bets, another player calls, and now you\'re deciding whether to call as the third player. Pot odds are BETTER than for the first caller (more dead money), but the call range that worked HU is wrong here. You now need equity that clears both villains AND backs out of bad turn spots.',
      },
      {
        kind: 'formula',
        body:
          'Overcall threshold: equity_vs_both_ranges > pot_odds × realization_penalty — where realization penalty is higher than HU (roughly 0.8× instead of 0.85× IP).',
      },
      {
        kind: 'prose',
        heading: 'When to overcall',
        body:
          '1. Clear nut draws (combo draw, open-ender with flush draw) — implied odds are large multiway.\n'
          + '2. Small pairs set-mining, if stacks are deep enough (SPR > 6) to realize the set-mine.\n'
          + '3. Clear dominance hands (TPTK on a dry board, overpair vs flop lead).\n'
          + '\nDon\'t overcall with middling weak hands like KJo on JT7tt — two villains likely have you beat or drawing dead, and you can\'t stand a turn bet.',
      },
    ],
  },
];

/**
 * Find a lesson by id.
 */
export const findLesson = (id) => LESSONS.find((l) => l.id === id) || null;
