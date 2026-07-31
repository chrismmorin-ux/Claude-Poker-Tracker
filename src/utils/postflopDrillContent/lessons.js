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
          'Heads-up, a bluff needs the villain to fold some % of the time. Multiway, it needs ALL villains to fold — their fold rates multiply. Population fold-to-cbet measures 55.5% (1.06M full-ring decisions, HandHQ SRC-011), so two independent villains both fold 55.5% × 55.5% = 30.8% of the time, and three only 17.1%. The pure-bluff EV curve collapses rapidly as N grows. See "Field Size" for the full table and the required-fold-rate side of it.',
      },
      {
        kind: 'formula',
        body: 'P(all_fold) = ∏_i P(fold_i) — geometrically shrinks with N',
      },
      {
        kind: 'prose',
        heading: 'Practical implication',
        body:
          'At a 3-way flop on a board where each villain would call ~50% of the time HU, a pure bluff succeeds 25% of the time when you assume independence. Required fold equity for break-even at 33% pot is ~25% — you are at the razor edge of breakeven with a typical call rate. At half pot the requirement is 33.3% and you are already losing. Add in the fact that combined ranges dominate more hands, and pure bluffs are structurally -EV almost everywhere multiway.\n\nThe counterweight, so this does not turn you into an over-folder: defense DIVIDES across the field. Against a half-pot bet five-way you personally owe only ~20% continuation, not the 66.7% the heads-up rule demands.',
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

  {
    id: 'mw-field-size',
    title: 'Field Size — What Your Hand Is Actually Worth',
    frameworkId: 'hand_class_shift',
    summary: 'One anchor number reorders every hand you hold. Draws climb, one-pair hands fall, and the ordering inverts five-way.',
    sections: [
      {
        kind: 'prose',
        heading: 'Start here: the ordering inverts',
        body:
          'Heads-up on 9♥8♥2♠, top pair with a weak kicker is worth 73% and a bare nut flush draw is worth 57%. Top pair is the better hand by 16 points and it is not close. Six-way on that same board, the nut flush draw is worth 37% and top pair with a weak kicker is worth 31% — the draw is now the better hand. Nothing about either holding changed. The field changed, and the field is what decides which one you would rather have.\n\nThis is the concept: field size is not a modifier you apply after you evaluate your hand. It is part of what your hand IS. Every other multiway lesson here — why bluffs die, why thin value dies, why you check back air three-way — is a consequence of this one relationship.',
      },
      {
        kind: 'prose',
        heading: 'The one number you carry to the table',
        body:
          'Your fair share of the pot is 1 divided by the number of players in it. Six-way that is 16.7%. Five-way 20%, four-way 25%, three-way 33%, heads-up 50%.\n\nThat number is not the price of a call — pot odds usually let you continue for less. It is the reference line that tells you whether a holding is an asset or a liability. Everything below is stated as a MULTIPLE of fair share, because multiples are what stay stable when the field gets looser or tighter. The raw equities move; the ordering and the multiples hold.',
      },
      {
        kind: 'formula',
        body: 'fair share = 1 / (players in pot)     →     6-way = 16.7%     ·     continue at ~2×     ·     fold below 1×',
      },
      {
        kind: 'benchmark',
        heading: 'Decision 1 — continue or fold',
        anchor: '6-way fair share = 16.7%',
        intro:
          'Where your holding sits on the ladder six-way. Read the multiple, not the percentage — the multiple is what survives a looser or tighter table.',
        columns: ['Holding on the flop', '6-way equity', '× fair share'],
        rows: [
          { label: 'Top set',                       values: ['79%', '4.8×'], emphasis: true },
          { label: 'Two pair',                      values: ['57%', '3.4×'] },
          { label: 'Top pair, big kicker',          values: ['51%', '3.1×'] },
          { label: 'Combo draw (flush + straight)', values: ['43%', '2.6×'], emphasis: true },
          { label: 'Nut flush draw',                values: ['37%', '2.2×'], emphasis: true },
          { label: 'Top pair, weak kicker',         values: ['31%', '1.8×'] },
          { label: 'Bare open-ender',               values: ['22%', '1.3×'] },
          { label: 'Second pair',                   values: ['15%', '0.9×'] },
          { label: 'Bare gutshot',                  values: ['13%', '0.8×'] },
          { label: 'Air (two overcards)',           values: ['10%', '0.6×'] },
        ],
        takeaway:
          'The rule is continue at roughly 2× fair share, fold below 1×. Notice what that does to second pair and to two overcards — they are below the line six-way, which is why "hit or fold" is a real strategy multiway and not a simplification.',
        source: 'docs/research/multiway-flop-strategy-2026-07-31.md §3 (raised field, engine-computed)',
      },
      {
        kind: 'prose',
        heading: 'Why draws climb and pairs fall',
        body:
          'A draw\'s equity is a count of cards. Nine hearts are still nine hearts whether one player or five is looking at the board — the field cannot take those outs away. A one-pair hand\'s equity is the probability that nobody else connected, and that probability decays geometrically with every extra player.\n\nMeasured as retention — what fraction of its heads-up equity a holding still has six-way — nutted hands and nut-ish draws keep 64-84%. One-pair hands keep 27-59%. That gap is the entire strategy. It is also why the crossover happens where it does: the nut flush draw passes top-pair-weak-kicker at four opponents, and passes second pair at only two.',
      },
      {
        kind: 'benchmark',
        heading: 'Where the crossover happens',
        anchor: 'nut flush draw vs one-pair hands',
        intro:
          'The same two holdings on the same board, as players are added. Watch the columns cross.',
        columns: ['Opponents', 'Top pair, weak kicker', 'Nut flush draw'],
        rows: [
          { label: '1 (heads-up)', values: ['73%', '57%'] },
          { label: '2',            values: ['58%', '45%'] },
          { label: '3',            values: ['47%', '41%'] },
          { label: '4 (5-way)',    values: ['38%', '38%'], emphasis: true },
          { label: '5 (6-way)',    values: ['31%', '37%'], emphasis: true },
        ],
        takeaway:
          'Five-way is the switch. In a pot that size or bigger, a nut draw outranks any single-pair hand you hold — play them in that order, and stop treating "I have a pair" as the stronger position.',
        source: 'docs/research/multiway-flop-strategy-2026-07-31.md §3',
      },
      {
        kind: 'prose',
        heading: 'Decision 2 — bet or check',
        body:
          'Assume no fold equity, which is close to true multiway. Then betting beats checking whenever your equity exceeds your fair share — exactly the anchor number. The bar FALLS as the field grows, and it falls faster than a nut draw\'s equity does. That is why more callers is genuinely better with a nutted draw, and it is not a feel, it is one line of algebra.\n\nA bare nut flush draw at 37% six-way clears the 16.7% bar by more than double. The same 37% heads-up would be a losing bet. Put fold equity back in and the practical threshold settles in the high 20s once four or more players are in: a draw worth about 28% or better against the field is a bet, and below that you check and take the free card.',
      },
      {
        kind: 'formula',
        body: 'EV(bet) − EV(check) = bet × ( equity × (callers + 1) − 1 )   →   bet when equity > 1 / (callers + 1)',
      },
      {
        kind: 'prose',
        heading: 'One caveat on "nut"',
        body:
          'A bare nut flush draw is worth 36.6% six-way; a bare second-nut flush draw is worth 36.3%. Three tenths of a point. The nut card is barely doing anything for your EQUITY — its value is almost entirely on later streets, where it lets you stack off without reverse implied odds. Treat nuttedness as permission to build the pot, not as an equity bonus. It is why you bet BIGGER with the nut draw, not why you bet more often.',
      },
      {
        kind: 'benchmark',
        heading: 'Decision 3 — believe them, or call',
        anchor: 'a half-pot bluff needs 33% fold-through',
        intro:
          'What every opponent must fold for a half-pot bluff to break even, versus what players actually fold. Measured fold-to-c-bet across 1.06M full-ring decisions is 55.5%.',
        columns: ['Opponents', 'Each must fold', 'Actually folds through'],
        rows: [
          { label: '1', values: ['33%', '55.5%'] },
          { label: '2', values: ['58%', '30.8%'] },
          { label: '3', values: ['69%', '17.1%'] },
          { label: '4', values: ['76%', '9.5%'], emphasis: true },
          { label: '5', values: ['80%', '5.3%'], emphasis: true },
        ],
        takeaway:
          'Into five players a half-pot bluff needs 33% and gets 5.3% — short by more than six times. This is not a read about a particular opponent; it is a constraint on which bets can be profitable at all. A player betting into four or five is representing value because value is the only thing that shows a profit there. Weight their range accordingly — and do not be that player yourself.',
        source: 'docs/research/multiway-flop-strategy-2026-07-31.md §5; HandHQ reference pool SRC-011',
      },
      {
        kind: 'prose',
        heading: 'The counterweight — do not over-fold',
        body:
          'The same compounding cuts the other way, and this half is the one people miss. Minimum defense frequency DIVIDES across the field. Against a half-pot bet heads-up you must continue 66.7% of your range. Five-way you personally need to continue only 19.7% — the field collectively meets the bar and you contribute a fifth of it.\n\nApplying the heads-up defense number per player multiway is a large and expensive error in the opposite direction. Both facts point the same way in practice: fold your weak holdings, and defend with the top fifth of your range, which multiway means nutted hands and nut-ish draws, not one-pair bluff-catchers.',
      },
      {
        kind: 'example',
        context: { position: 'BTN', action: 'open' },
        opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
        board: '9h 8h 2s',
        takeaway:
          'The board every number in this lesson was measured on. Reveal the breakdown and read it through the anchor: six-way, fair share is 16.7%, so ask which slices of this range clear 2× and which sit under 1×. The nut-region and strong-draw slices are the ones that survive a five-opponent field; the one-pair slices are the ones that quietly stop being worth money.',
      },
      {
        kind: 'prose',
        heading: 'What these numbers are NOT',
        body:
          'Every figure here is one-street showdown equity — what the hand is worth if the board simply ran out with no more betting. Implied odds, reverse implied odds, position, and stack depth are not in it. That biases the numbers AGAINST nut draws and IN FAVOR of weak one-pair hands, so the conclusions are conservative — the real edge for draws is larger than shown. But it also means these are not stack-off thresholds. Use them to order your holdings and to set your continue/fold line, not to justify getting it all in on the flop.',
      },
    ],
  },
];

/**
 * Find a lesson by id.
 */
export const findLesson = (id) => LESSONS.find((l) => l.id === id) || null;
