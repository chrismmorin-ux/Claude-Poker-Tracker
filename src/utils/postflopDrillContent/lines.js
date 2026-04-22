/**
 * lines.js — curated branching hand walkthroughs ("lines") for Line Mode.
 *
 * Each line is a root node + a DAG of authored decision and terminal nodes.
 * Every decision has every branch (right or wrong) with its own rationale;
 * wrong picks still navigate forward so the user can see the consequences.
 *
 * Schema is defined in `lineSchema.js` and validated by lines.test.js.
 *
 * Pure module — no imports from UI, state, or persistence layers.
 */

// ---------- Line 1: BTN vs BB SRP IP, dry Q72r ---------- //
//
// This is the reference HU line — the most common single-raised-pot
// position matchup in live cash, on the most common dry-flop texture.
// Teaches: merged-range cbet sizing, board-tilt (PFR-favored high-card
// dry), capped-range checking, double-barrel EV on bricks, river thin-
// value on checked-through lines.

const LINE_BTN_VS_BB_SRP_DRY_Q72R = {
  id: 'btn-vs-bb-srp-ip-dry-q72r',
  title: 'BTN vs BB · SRP · Dry Q72r',
  summary:
    'Heads-up single-raised pot, hero in position on a dry queen-high flop. '
    + 'The reference line for merged-range cbetting and thin-value barreling.',
  tags: ['hu', 'srp', 'ip', 'dry', 'high-card'],
  setup: {
    hero: { position: 'BTN', action: 'open' },
    villains: [
      { position: 'BB', action: 'call', vs: 'BTN' },
    ],
    potType: 'srp',
    effStack: 100,
  },
  rootId: 'flop_root',
  nodes: {
    // ===== FLOP ROOT =====
    flop_root: {
      id: 'flop_root',
      street: 'flop',
      board: ['Q♠', '7♥', '2♣'],
      pot: 5.5,
      villainAction: { kind: 'check' },
      frameworks: ['range_advantage', 'range_morphology', 'board_tilt', 'capped_range_check'],
      sections: [
        {
          kind: 'prose',
          heading: 'The board',
          body:
            'Q♠ 7♥ 2♣ is the canonical dry high-card flop. Rainbow, no '
            + 'straight draws, no possible two-pair combos that connect the '
            + 'BB flat range, one over-rank (A) on the turn.',
        },
        {
          kind: 'why',
          heading: 'Who owns this board',
          body:
            'BTN open range has every Q combo (QQ for set, AQ/KQ for TPTK, '
            + 'QJs/QTs for TP-good) plus the entire overpair tier (AA, KK). '
            + 'BB flats without the overpairs (3bets KK+/AA pre) — its nut '
            + 'region on this flop is ~2% (only 77, 22 sets) and its typical '
            + 'value hands cap at AQ/KQ top-pair-good. Range advantage AND '
            + 'nut advantage both favor BTN.',
        },
        {
          kind: 'prose',
          heading: 'Range morphology',
          body:
            'BTN range here is MERGED — strong hands, top-pair tier, '
            + 'middling pairs, and air are all present in roughly descending '
            + 'order. Merged ranges prefer merged sizing: ~33% pot. Polarized '
            + 'sizing (~75%+) requires a polarized value region — mostly '
            + 'strong hands and air — which BTN does not have here.',
        },
      ],
      decision: {
        prompt: 'Villain checks. Hero acts. Which cbet size?',
        branches: [
          {
            label: 'Cbet 33% pot (~1.8bb)',
            nextId: 'turn_brick',
            correct: true,
            rationale:
              'Correct. Merged sizing matches a merged range. 33% denies '
              + 'equity to villain\'s many weak pair combos (88-TT middle '
              + 'pair, low pocket pairs, KQ/QJ/QT weak TP that floats), wins '
              + 'at high frequency against air, and keeps thin value hands '
              + 'ahead. Cbet frequency can approach 80-90% at this size.',
          },
          {
            label: 'Cbet 75% pot (~4.1bb)',
            nextId: 'turn_brick',
            correct: false,
            rationale:
              'Sizing leak. Polarized sizing folds out exactly the hands '
              + 'we beat (88-TT, 55-66, KJ, J-high floats) while getting '
              + 'called by hands that either crush us (rare sets) or draw '
              + 'near-breakeven (KQ/QJ). We keep the small cbet range-wide; '
              + 'we do not earn the big bet because we have no polar value '
              + 'region to protect.',
          },
          {
            label: 'Check back',
            nextId: 'turn_checked_back',
            correct: false,
            rationale:
              'Too passive. Hero\'s range benefits enormously from betting '
              + 'here — fold equity against villain\'s 45-60% whiff combos, '
              + 'denies equity to villain\'s 30-40% middle/low pair region, '
              + 'and sets up a credible turn barrel. Check-back range should '
              + 'be narrow (some pocket pairs that don\'t want to bloat, a '
              + 'few traps). Giving up EV here.',
          },
        ],
      },
    },

    // ===== TURN AFTER CBET CALLED =====
    turn_brick: {
      id: 'turn_brick',
      street: 'turn',
      board: ['Q♠', '7♥', '2♣', '3♦'],
      pot: 9.1,
      villainAction: { kind: 'check' },
      frameworks: ['range_advantage', 'nut_advantage'],
      sections: [
        {
          kind: 'prose',
          heading: 'Villain called flop. Turn is 3♦ (brick).',
          body:
            'The 3♦ changes nothing about the range structure — it is not '
            + 'a rank villain\'s flatting range pairs with at meaningful '
            + 'frequency (22-33 sets are tiny combos; 3-x hands are mostly '
            + 'folded preflop). Villain\'s flop call range is concentrated '
            + 'in Q-x, middle pairs (88-JJ), low pocket pairs (33-66), and '
            + 'some 7-x combos. Villain checks the turn again.',
        },
        {
          kind: 'why',
          heading: 'What our range wants to do',
          body:
            'Hero\'s range going into the turn is still PFR-merged: AA-JJ '
            + 'overpairs, AQ/KQ/QJ TPTK, weaker TP hands. The brick turn '
            + 'keeps our equity advantage intact. Continuing to pressure '
            + 'villain\'s many one-pair hands with a second barrel denies '
            + 'equity, gets thin value from weaker Qx, and folds out the '
            + 'middle pairs that were floating the flop.',
        },
        {
          kind: 'adjust',
          heading: 'Against a station',
          body:
            'If villain is a passive calling station, value shrinks '
            + '(they call down wider, bluffs work less) but we also value-'
            + 'own them more — still barrel for value, but skip bluffs '
            + 'with no equity.',
        },
      ],
      decision: {
        prompt: 'Villain checks. Double barrel or check back?',
        branches: [
          {
            label: 'Bet 50% pot (~4.5bb)',
            nextId: 'river_after_barrel',
            correct: true,
            rationale:
              'Correct. Second barrel at a medium size extracts from the '
              + 'wide middle/low-pair float range, denies equity to the '
              + 'draw combos (runner-runner stuff), and keeps villain\'s '
              + 'capped range under pressure. Our range still crushes '
              + 'villain\'s continuing range at this point.',
          },
          {
            label: 'Check back',
            nextId: 'river_after_turn_checkback',
            correct: false,
            rationale:
              'Gives up too much EV. Villain\'s range is capped and weak — '
              + 'checking turn forfeits value from the float region '
              + '(middle pairs, weak Qx) and lets a free card potentially '
              + 'hit villain\'s overcards. Check-back range should be narrow '
              + 'pot-control hands and the occasional slowplay, not default.',
          },
          {
            label: 'Overbet (150% pot)',
            nextId: 'river_after_barrel',
            correct: false,
            rationale:
              'Wrong shape. Overbets polarize into a nut-region + air range. '
              + 'Hero\'s range on the turn is still merged — mostly top-pair '
              + 'and overpairs that do not want to get raised off. The '
              + 'correct value sizing is the one that keeps weaker Qx and '
              + 'middle pairs in, not the one that folds them out.',
          },
        ],
      },
    },

    // ===== TURN AFTER FLOP CHECK-BACK =====
    turn_checked_back: {
      id: 'turn_checked_back',
      street: 'turn',
      board: ['Q♠', '7♥', '2♣', '3♦'],
      pot: 5.5,
      villainAction: { kind: 'bet', size: 0.6 },
      frameworks: ['capped_range_check', 'board_tilt'],
      sections: [
        {
          kind: 'mismatch',
          heading: 'Villain leads into the checked-flop range',
          body:
            'Because hero checked flop, villain\'s range is not capped the '
            + 'way it would be after calling a cbet. Villain is now leading '
            + '60% pot into a range he reads as weak. This is a classic '
            + 'probe-bet spot — villain\'s probe range on dry low bricks is '
            + 'wide (any pair he thinks is ahead, some air with equity, '
            + 'occasional 77/22 traps).',
        },
        {
          kind: 'why',
          heading: 'What hero actually has',
          body:
            'Hero\'s check-back range includes the occasional AA/KK slowplay, '
            + 'some pocket pairs (99-JJ) that chose pot control, QJ/QT '
            + 'marginal TP, plus the AK/AJ type hands that whiff this flop. '
            + 'Calling turn here keeps villain\'s bluffs in and preserves '
            + 'equity realization with pair hands.',
        },
      ],
      decision: {
        prompt: 'Villain bets 60% pot into our checked-flop range. What now?',
        branches: [
          {
            label: 'Call',
            nextId: 'river_after_flop_checkback',
            correct: true,
            rationale:
              'Correct. Our range has enough pair-strength hands to call '
              + 'down comfortably, and overfolding against a probe bet is '
              + 'a classic exploit point. Pot odds of ~30% require modest '
              + 'equity; any pair plus ace-high with a backdoor has it.',
          },
          {
            label: 'Fold',
            nextId: 'terminal_overfold',
            correct: false,
            rationale:
              'Overfold. Villain\'s probe range is too wide to fold our '
              + 'pair hands. MDF math on a 60%-pot lead requires us to '
              + 'defend ~63% of our range; any pair plus ace-highs clears '
              + 'that threshold easily.',
          },
          {
            label: 'Raise',
            nextId: 'terminal_turn_spew',
            correct: false,
            rationale:
              'Turns a bluff-catcher into a bloated raise with no coherent '
              + 'value region. Our checked-flop range has too few premiums '
              + 'to raise for value credibly, and too many medium pairs '
              + 'that want to showdown cheaply. Raising is spew.',
          },
        ],
      },
    },

    // ===== RIVER AFTER DOUBLE BARREL =====
    river_after_barrel: {
      id: 'river_after_barrel',
      street: 'river',
      board: ['Q♠', '7♥', '2♣', '3♦', '8♠'],
      pot: 18.1,
      villainAction: { kind: 'check' },
      frameworks: ['range_morphology', 'nut_advantage'],
      sections: [
        {
          kind: 'prose',
          heading: 'River 8♠ (another brick). Villain checks.',
          body:
            'Villain has now called two streets and checked river. His '
            + 'continuing range is concentrated in Qx (KQ, QJ, QT, Q9s), '
            + 'middle pocket pairs (88, 99, TT, JJ), and the occasional '
            + 'slow-played set (77, 22, QQ). Pure bluffs are largely gone; '
            + 'pure nuts would likely have raised turn. The range is '
            + 'CONDENSED — mostly pairs, few polar hands.',
        },
        {
          kind: 'why',
          heading: 'Thin value is the frame',
          body:
            'Against a condensed pair-heavy range, thin value with better '
            + 'pairs (AQ, KQ, QQ+) is the right frame. We want the sizing '
            + 'that keeps middle pairs in — they are the combos we beat. '
            + 'A small bet maximizes their call frequency; a big bet folds '
            + 'them out and leaves us only the Qx hands calling (mostly '
            + 'chops or losses).',
        },
      ],
      decision: {
        prompt: 'Villain checks river. Our move with AQ?',
        branches: [
          {
            label: 'Bet 33% pot for thin value',
            nextId: 'terminal_thin_value_win',
            correct: true,
            rationale:
              'Correct. 33% keeps 88-JJ and the occasional weaker Qx '
              + 'calling — hands we beat. Villain\'s bluff-catching range '
              + 'at this sizing is wide; our thin-value frequency should '
              + 'be high. This is where most of the EV on this line lives.',
          },
          {
            label: 'Bet 75% pot',
            nextId: 'terminal_overbet_river',
            correct: false,
            rationale:
              'Sizing leak. 75% folds out exactly the middle pairs and '
              + 'weaker Qx — the combos we beat. We get called mostly by '
              + 'QQ+/AQ (chops or crushes) and by the rare slowplayed set '
              + '(loses). Net EV is worse than the small value bet.',
          },
          {
            label: 'Check back',
            nextId: 'terminal_gave_up_value',
            correct: false,
            rationale:
              'Missed value. Villain\'s range is condensed and weak — '
              + 'checking forfeits the equity we\'ve built over three '
              + 'streets. Villain will almost never bluff after calling '
              + 'twice and checking river; our pair hand has to bet itself.',
          },
        ],
      },
    },

    // ===== RIVER AFTER TURN CHECK-BACK =====
    river_after_turn_checkback: {
      id: 'river_after_turn_checkback',
      street: 'river',
      board: ['Q♠', '7♥', '2♣', '3♦', '8♠'],
      pot: 9.1,
      villainAction: { kind: 'bet', size: 0.75 },
      frameworks: ['range_morphology'],
      sections: [
        {
          kind: 'mismatch',
          heading: 'Villain bets river after we checked turn',
          body:
            'This sequence — called flop cbet, we checked turn, villain '
            + 'bets 75% pot on river — is a common polar line. Villain '
            + 'reads our checked turn as weak and attacks. His range is '
            + 'POLARIZED: value (AQ/KQ turned into value by river, sets, '
            + 'occasional two-pair) plus natural bluffs (busted backdoor '
            + 'draws, floaters with showdown-bad holdings).',
        },
        {
          kind: 'why',
          heading: 'Bluff frequency matters here',
          body:
            'Pot odds of 75% into 100% pot require ~30% equity to break '
            + 'even. Villain\'s bluff frequency at this sizing against a '
            + 'range-capped checked-turn line is meaningful — typically '
            + '25-35% bluffs depending on opponent type. Our medium pair '
            + 'is roughly break-even; the question is whether to over- or '
            + 'underweight bluff-catching.',
        },
      ],
      decision: {
        prompt: 'Villain bets 75% pot. Our play with 99?',
        branches: [
          {
            label: 'Call',
            nextId: 'terminal_bluff_catch_win',
            correct: true,
            rationale:
              'Correct. Our medium pair blocks some of villain\'s '
              + 'slowplay region (QQ impossible here since we\'re on 99, '
              + 'but 99 blocks 99 itself). MDF math plus villain\'s '
              + 'typical polar bluff frequency makes the call +EV. '
              + 'Overfolding this spot is the most common leak at the '
              + 'stakes where this line matters.',
          },
          {
            label: 'Fold',
            nextId: 'terminal_overfold_river',
            correct: false,
            rationale:
              'Overfold. Villain\'s polar line on a brick river has '
              + 'enough natural bluff combos (busted backdoors, ace-high '
              + 'floats) that folding a medium pair is too tight. You '
              + 'would need villain to be a nit for this fold to be '
              + 'correct, and most population players at live 1/2–5/10 '
              + 'are not that tight.',
          },
          {
            label: 'Raise',
            nextId: 'terminal_river_raise_spew',
            correct: false,
            rationale:
              'Spew. Our medium pair has no credible raise-value story — '
              + 'villain\'s polar range collapses our bluff-catcher into '
              + 'a raise that only folds out the bluffs we beat and gets '
              + 'called/3bet by the value we lose to.',
          },
        ],
      },
    },

    // ===== RIVER AFTER FLOP CHECK-BACK + TURN CALL =====
    river_after_flop_checkback: {
      id: 'river_after_flop_checkback',
      street: 'river',
      board: ['Q♠', '7♥', '2♣', '3♦', '8♠'],
      pot: 12.1,
      villainAction: { kind: 'check' },
      frameworks: ['range_morphology'],
      sections: [
        {
          kind: 'prose',
          heading: 'We checked flop, called turn probe, villain checks river.',
          body:
            'Villain\'s range shifted through the hand: flop-check range '
            + '(wide, capped), turn-probe range (narrowed to pair+ and a '
            + 'few bluffs), now check-river (weak, likely medium pair or '
            + 'worse). His river check is a give-up — if he had turned '
            + 'up with value, he would bet again for protection.',
        },
        {
          kind: 'why',
          heading: 'We can value-own',
          body:
            'Our range here is stronger than he reads — we checked flop '
            + 'with some premiums (slowplay), called turn with our pair '
            + 'hands. A thin value bet with Qx or better prints against '
            + 'his weak pair calling range.',
        },
      ],
      decision: {
        prompt: 'Villain checks river. Our move with AQ?',
        branches: [
          {
            label: 'Bet 50% pot for value',
            nextId: 'terminal_thin_value_win',
            correct: true,
            rationale:
              'Correct. Villain\'s range is weak pairs and busted airs; '
              + 'weak pair will hero-call our modest sizing enough of the '
              + 'time to make this very +EV. This is the value we '
              + 'deferred by checking flop.',
          },
          {
            label: 'Check back',
            nextId: 'terminal_gave_up_value',
            correct: false,
            rationale:
              'Missed value. Villain will rarely bluff after a turn probe '
              + 'went called + river check — the line is mostly give-up '
              + 'or thin value from him. Our Qx has to bet itself.',
          },
          {
            label: 'Overbet (125% pot)',
            nextId: 'terminal_overbet_river',
            correct: false,
            rationale:
              'Folds out the weak pairs we beat. Overbet sizing on this '
              + 'river works when we have a polar value region — here we '
              + 'are value-owning weak pairs, which requires small sizing.',
          },
        ],
      },
    },

    // ===== TERMINALS =====
    terminal_thin_value_win: {
      id: 'terminal_thin_value_win',
      street: 'river',
      board: ['Q♠', '7♥', '2♣', '3♦', '8♠'],
      pot: 18.1,
      sections: [
        {
          kind: 'prose',
          heading: 'Thin value hits',
          body:
            'This is where the line\'s EV lives. Betting small on the '
            + 'river against a condensed capped range prints over a large '
            + 'sample. Even when villain wakes up with a trap, the frequency '
            + 'of weak-pair calls across the population makes this '
            + 'structurally +EV.',
        },
        {
          kind: 'why',
          heading: 'Takeaway',
          body:
            'Sizing matches the shape of villain\'s range, not the '
            + 'strength of your own hand. Condensed ranges get small bets. '
            + 'Polar ranges get big bets. Never let your confidence in '
            + 'your hand push you into a size that folds out the hands '
            + 'you beat.',
        },
      ],
    },

    terminal_overbet_river: {
      id: 'terminal_overbet_river',
      street: 'river',
      board: ['Q♠', '7♥', '2♣', '3♦', '8♠'],
      pot: 18.1,
      sections: [
        {
          kind: 'prose',
          heading: 'Sizing leak — the pairs folded',
          body:
            'Against a condensed range, an overbet folds out the hands '
            + 'you beat. The only callers are stronger made hands (chops '
            + 'or losses) plus the rare slowplay. Net EV is worse than '
            + 'the small-value sizing even though you won the pot when '
            + 'they folded — winning uncontested is not the goal when '
            + 'you hold the value.',
        },
        {
          kind: 'why',
          heading: 'Takeaway',
          body:
            'The sizing question is always "what is villain\'s range and '
            + 'what size maximizes EV against it?" — never "how big can I '
            + 'get away with?". Condensed ranges punish oversizing.',
        },
      ],
    },

    terminal_gave_up_value: {
      id: 'terminal_gave_up_value',
      street: 'river',
      board: ['Q♠', '7♥', '2♣', '3♦', '8♠'],
      pot: 18.1,
      sections: [
        {
          kind: 'prose',
          heading: 'Check-back forfeits the pot edge',
          body:
            'Villain\'s range is weak-pair-heavy and rarely bluffs after '
            + 'passive lines. Checking back showdowns our hand in the pot '
            + 'that already exists instead of building it. The session EV '
            + 'cost of these missed thin-value bets accumulates fast.',
        },
        {
          kind: 'why',
          heading: 'Takeaway',
          body:
            'Thin value is the bread-and-butter of winning live poker. '
            + 'If you beat the top of villain\'s calling range, you bet. '
            + 'If you beat a large share of villain\'s calling range and '
            + 'his bluff frequency after a check is low, you still bet.',
        },
      ],
    },

    terminal_bluff_catch_win: {
      id: 'terminal_bluff_catch_win',
      street: 'river',
      board: ['Q♠', '7♥', '2♣', '3♦', '8♠'],
      pot: 16.0,
      sections: [
        {
          kind: 'prose',
          heading: 'Bluff-catch lands',
          body:
            'Calling with a medium pair on a polar river bet against a '
            + 'capped-checked-turn line is one of the highest-EV '
            + 'bluff-catching spots in live cash. Villain\'s natural '
            + 'bluff region (busted backdoors, ace-high floats) is wide '
            + 'enough that calling prints, even when he sometimes shows '
            + 'up with the nuts.',
        },
        {
          kind: 'why',
          heading: 'Takeaway',
          body:
            'Overfolding river against polar bets is the single most '
            + 'expensive recurring leak at the stakes this line targets. '
            + 'Trust the pot odds and the population bluff frequency.',
        },
      ],
    },

    terminal_overfold: {
      id: 'terminal_overfold',
      street: 'turn',
      board: ['Q♠', '7♥', '2♣', '3♦'],
      pot: 5.5,
      sections: [
        {
          kind: 'prose',
          heading: 'Overfold',
          body:
            'Folding a pair hand to a turn probe when villain\'s range '
            + 'is uncapped and wide is a structural leak. MDF would have '
            + 'us defend most of our range here; instead we defended '
            + 'none of it.',
        },
      ],
    },

    terminal_turn_spew: {
      id: 'terminal_turn_spew',
      street: 'turn',
      board: ['Q♠', '7♥', '2♣', '3♦'],
      pot: 5.5,
      sections: [
        {
          kind: 'prose',
          heading: 'Raise spew',
          body:
            'Raising a turn probe with a medium pair turns our '
            + 'bluff-catcher into a polarized raise we cannot defend. '
            + 'Villain\'s continuing range is stronger than our raise '
            + 'story, and the pot balloons out of our control with no '
            + 'plan for villain\'s 3bet.',
        },
      ],
    },

    terminal_overfold_river: {
      id: 'terminal_overfold_river',
      street: 'river',
      board: ['Q♠', '7♥', '2♣', '3♦', '8♠'],
      pot: 9.1,
      sections: [
        {
          kind: 'prose',
          heading: 'Overfold — the most common live leak',
          body:
            'Folding medium pair on a polar river bet against a capped '
            + 'checked-turn line is where most live winners lose their '
            + 'edge. Villain\'s bluff region at this sizing is too wide '
            + 'to overfold; the fold is only correct against a nit.',
        },
      ],
    },

    terminal_river_raise_spew: {
      id: 'terminal_river_raise_spew',
      street: 'river',
      board: ['Q♠', '7♥', '2♣', '3♦', '8♠'],
      pot: 16.0,
      sections: [
        {
          kind: 'prose',
          heading: 'Raise spew — wrong tool for the spot',
          body:
            'Raising a polar river bet with a bluff-catcher folds out the '
            + 'bluffs and gets called or 3-bet by the value. There is no '
            + 'coherent raise range that includes 99 here — it is a '
            + 'pure call-or-fold decision.',
        },
      ],
    },
  },
};

// ---------- Line 2: BTN vs BB 3BP IP, wet T♥9♥6♠, villain donks ---------- //
//
// Second reference line. Covers the "bluff didn't fold villain — now facing
// river / check-raise aggression" pathway explicitly: two of the decision
// nodes put hero on the receiving end of continued BB pressure AFTER hero's
// own aggression failed. These are the high-variance spots where most live
// players bleed chips by over- or under-continuing.

const LINE_BTN_VS_BB_3BP_WET_T96 = {
  id: 'btn-vs-bb-3bp-ip-wet-t96',
  title: 'BTN vs BB · 3BP · Wet T♥9♥6♠ — villain donks',
  summary:
    '3-bet pot, hero in position on a wet middling two-tone flop. BB leads '
    + 'into the caller. Covers the full "bluff doesn\'t fold them — now '
    + 'facing river aggression" pathway with explicit check-raise branch.',
  tags: ['hu', '3bp', 'ip', 'wet', 'two-tone', 'middling'],
  setup: {
    hero: { position: 'BTN', action: 'call', vs: 'BB' },
    villains: [
      { position: 'BB', action: 'threeBet', vs: 'BTN' },
    ],
    potType: '3bp',
    effStack: 90,
  },
  rootId: 'flop_root',
  nodes: {
    // ===== FLOP ROOT — BB donks 33% =====
    flop_root: {
      id: 'flop_root',
      street: 'flop',
      board: ['T♥', '9♥', '6♠'],
      pot: 20.5,
      villainAction: { kind: 'donk', size: 0.33 },
      // RT-106 (schema v2) exemplar: hand-level teaching — node pins hero's
      // specific holding (J♥T♠, the hand the decision prompt already speaks
      // about), plus the bucket taxonomy this node spans. Bucket taxonomy
      // is pinned in RT-110; these strings are illustrative for v2.
      heroHolding: {
        combos: ['J♥T♠'],
        bucketCandidates: ['topPair', 'flushDraw', 'openEnder', 'overpair', 'air'],
      },
      frameworks: ['range_advantage', 'range_morphology', 'board_tilt'],
      sections: [
        {
          kind: 'prose',
          heading: 'The spot',
          body:
            'BB 3bet pre, hero called. BB leads 33% into the capped caller '
            + 'on T♥9♥6♠ — a wet, two-tone, highly-connected board. '
            + 'Flush draw, open-enders (J, 8 for QJs/87s kinds of hands), '
            + 'pair+draw combos everywhere.',
        },
        {
          kind: 'why',
          heading: 'Why BB donks here',
          body:
            'BB\'s 3bet range is polarized: big pairs (TT+), AQ/AK, KQs, '
            + 'plus some A5s/A4s blocker bluffs. On T96ss, BB has nut '
            + 'advantage — more sets (TT, 99, 66), many overpairs (JJ-AA) '
            + 'that are under pressure and prefer to charge draws. The '
            + 'small donk targets hero\'s capped flatting range (which '
            + 'reads weighted toward TT-JJ, AQ, suited broadways, small '
            + 'pocket pairs that flopped second-pair-ish).',
        },
        {
          kind: 'adjust',
          heading: 'Against a maniac 3-bettor',
          body:
            'If villain 3bets wide (A2s-A9s, K9s+, suited gappers), the '
            + 'donk frequency is a bluff-heavy lead — more of a "range '
            + 'protection" move than a value bet. Shift toward raising '
            + 'flop with strong draws and folding less.',
        },
        // RT-113 exemplar — compute sections were placeholder text until
        // 2026-04-21. This interactive calculator lets the student compute
        // call pot-odds facing the 33% donk here and check their break-even
        // equity against the authored "TPTK has enough equity to call" claim.
        {
          kind: 'compute',
          calculator: 'potOdds',
          heading: 'Pot odds for calling the donk',
          intro:
            'Verify: BB leads ~6.8bb (33% of 20.5bb). Hero calls 6.8bb into a '
            + '20.5 + 6.8 = 27.3bb pot. Break-even equity = 6.8 / (27.3 + 6.8). '
            + 'TPTK with a backdoor flush plays strong even against BB\'s '
            + 'donk range at this price.',
        },
      ],
      decision: {
        prompt: 'BB donks 33%. Hero with J♥T♠ (top pair + backdoor flush)?',
        branches: [
          {
            label: 'Call',
            nextId: 'turn_after_call',
            correct: true,
            rationale:
              'Correct. TPTK-ish with a backdoor flush has too much '
              + 'equity and showdown value to fold. Raising punishes BB\'s '
              + 'overpair region (JJ+) which doesn\'t fold and reopens us '
              + 'to a 3bet. Calling keeps the pot controllable, realizes '
              + 'our equity in position, and floats wider IP in 3BPs pays.',
          },
          {
            label: 'Raise to 9bb',
            nextId: 'terminal_flop_raise_folds_weak',
            correct: false,
            rationale:
              'Raise-folds our own equity. Against BB\'s polarized donk '
              + 'range, raising folds out the bluffs we beat (A-high '
              + 'blocker combos) and gets called or 3bet by the entire '
              + 'overpair/set region. We end up bloating the pot with a '
              + 'one-pair hand that wants to see both turn and river '
              + 'cheap to realize equity.',
          },
          {
            label: 'Fold',
            nextId: 'terminal_flop_overfold',
            correct: false,
            rationale:
              'Structural overfold. JTs type hands have ~40%+ equity '
              + 'against BB\'s 3bet range on T96ss — folding a hand this '
              + 'live to a small lead is a direct money-giving leak. BB '
              + 'needs us to fold far more often than hero\'s range here '
              + 'can credibly defend; we have a top-pair combo.',
          },
        ],
      },
    },

    // ===== TURN =====
    turn_after_call: {
      id: 'turn_after_call',
      street: 'turn',
      board: ['T♥', '9♥', '6♠', '2♣'],
      pot: 34.0,
      villainAction: { kind: 'check' },
      frameworks: ['range_morphology', 'capped_range_check'],
      sections: [
        {
          kind: 'prose',
          heading: 'Turn 2♣ — total brick. BB checks.',
          body:
            'The 2♣ is inert — no flush completes, no straight fills, no '
            + 'meaningful hand classes reshuffle. BB\'s range going into '
            + 'the turn was the flop-donk range; checking it now '
            + 'concentrates weakness. Overpairs that wanted to charge '
            + 'draws still want to — their check is not natural. This is '
            + 'a capped-post-donk check, signaling mostly showdown-value '
            + 'medium hands (AQ/AK no pair, some JJ-QQ slowing).',
        },
        {
          kind: 'why',
          heading: 'Hero\'s range looks stronger now',
          body:
            'Hero called flop with every pair, strong draw, and float. '
            + 'On this brick turn, hero has the nut-advantage pieces BB '
            + 'doesn\'t — sets of T/9/6 (rare but present), pair+flush '
            + 'draw combos (JhTh, Th8h, 9h8h), and top-pair tier. BB\'s '
            + 'range is weaker than the flop-donk implied.',
        },
      ],
      decision: {
        prompt: 'BB checks 2♣ turn. Hero\'s play?',
        branches: [
          {
            label: 'Bet 66% pot (~22bb)',
            nextId: 'river_brick_v_calls',
            correct: true,
            rationale:
              'Correct. Take the initiative back. BB\'s check weakens '
              + 'the range; our top pair plus backdoor flush has both '
              + 'protection and thin-value merit. 66% charges draws, '
              + 'pressures BB\'s weak pairs, and keeps the river '
              + 'manageable. Semi-bluff frequency with draws on this '
              + 'turn should be similarly high.',
          },
          {
            label: 'Check back',
            nextId: 'river_checkback',
            correct: false,
            rationale:
              'Too passive — BUT leads to the most instructive spot in '
              + 'the line. Check-back forfeits value and initiative, and '
              + 'on the river we often face a polar BB probe. You will '
              + 'see that tree now (the "my bluff attempt didn\'t '
              + 'happen — now I\'m facing aggression" path).',
          },
          {
            label: 'Overbet (110% pot, ~37bb)',
            nextId: 'river_brick_v_checkraises',
            correct: false,
            rationale:
              'Wrong shape. Overbet sizing in 3BP on a brick turn after '
              + 'villain\'s donk-check line is polar — but hero\'s range '
              + 'here is not polar enough to support it. BB can and will '
              + 'check-raise the overpair/set region for maximum value, '
              + 'and we watch the pot balloon with one pair. This leads '
              + 'to the "I bluffed big, got check-raised" spot.',
          },
        ],
      },
    },

    // ===== RIVER AFTER TURN BET CALLED =====
    river_brick_v_calls: {
      id: 'river_brick_v_calls',
      street: 'river',
      board: ['T♥', '9♥', '6♠', '2♣', '3♦'],
      pot: 78.0,
      villainAction: { kind: 'check' },
      frameworks: ['range_morphology'],
      sections: [
        {
          kind: 'prose',
          heading: 'River 3♦ brick. BB calls turn, checks river.',
          body:
            'BB called the turn bet, river bricked, BB checks. The '
            + 'check-call-check line condenses BB\'s range to medium '
            + 'made hands: JJ-QQ that weren\'t willing to raise, some '
            + 'slowplays (sets that wanted action), AQ/AK that hit top '
            + 'pair or paired the board, plus the rare trapped AA/KK. '
            + 'Almost no bluff combos remain.',
        },
        {
          kind: 'why',
          heading: 'Our bet-again story is thin',
          body:
            'A river value bet here needs BB to call worse. Against BB\'s '
            + 'condensed range, our top pair (JT) beats only a sliver of '
            + 'the continue range — some AQ/KQ missed, the rare '
            + 'second-pair. JJ-QQ calls and crushes us; sets trap. The '
            + 'thin value bet is structurally -EV.',
        },
      ],
      decision: {
        prompt: 'BB checks river. Hero\'s play with JT?',
        branches: [
          {
            label: 'Check back',
            nextId: 'terminal_correct_checkback',
            correct: true,
            rationale:
              'Correct. Showdown realized, pot preserved. Against a '
              + 'condensed pair-heavy range, top pair wants to see the '
              + 'card and go home. Betting hopes for a miracle worse '
              + 'pair call and loses the pot-equity if we run into the '
              + 'trap. Fold-equity = 0.',
          },
          {
            label: 'Bet 50% pot for thin value',
            nextId: 'terminal_river_overbet_spew',
            correct: false,
            rationale:
              'Value-own leak. The worse hands fold (any air that '
              + 'floated to the river), and the worse pairs that call '
              + 'still beat you sometimes. Without a natural bluff '
              + 'region to protect (hero\'s river bluffs here are '
              + 'structurally rare), the bet is pure value thin against '
              + 'a range that mostly beats you.',
          },
          {
            label: 'Overbet (125% pot)',
            nextId: 'terminal_river_overbet_spew',
            correct: false,
            rationale:
              'Polar sizing without a polar range. Overbets require '
              + 'nut combos and air bluffs — hero has neither in '
              + 'credible quantity on this line. BB folds only the '
              + 'second-pair region we beat, and calls with the better '
              + 'made hands. This is the classic "sized out of my own '
              + 'thin value" spot.',
          },
        ],
      },
    },

    // ===== RIVER AFTER TURN CHECK-BACK — facing aggression =====
    river_checkback: {
      id: 'river_checkback',
      street: 'river',
      board: ['T♥', '9♥', '6♠', '2♣', '3♦'],
      pot: 34.0,
      villainAction: { kind: 'bet', size: 0.75 },
      frameworks: ['range_morphology'],
      sections: [
        {
          kind: 'mismatch',
          heading: 'We checked turn. Now BB bets 75% river — facing aggression after a missed bluff window.',
          body:
            'This is the "I could have bet turn and didn\'t, and now '
            + 'villain is firing into my capped checked-turn range" spot. '
            + 'BB reads our checked turn as weak (correctly — our strong '
            + 'hands usually bet). His river bet is polar: value hands '
            + 'that kept checking to trap (JJ-QQ/sets/slowplayed AA-KK) '
            + 'plus natural bluffs (A-high blockers, busted backdoor '
            + 'flush draws).',
        },
        {
          kind: 'why',
          heading: 'Why this is a bluff-catch, not a fold',
          body:
            'Pot odds: 25.5 to win 76.5 → we need ~25% equity. Against a '
            + 'polar range in 3BP on a brick-runout two-tone board, BB\'s '
            + 'natural bluff frequency is typically 30-40%: enough missed '
            + 'draws and A-high floats carry through, and villain knows '
            + 'our checked turn cannot defend wide. Hero\'s top pair is '
            + 'a bluff-catcher that crushes the bluff region and loses '
            + 'to the value region — call-or-fold.',
        },
        {
          kind: 'adjust',
          heading: 'Against a tight 3-bettor',
          body:
            'If villain 3bets narrow (QQ+/AK only), the polar bluff '
            + 'frequency drops toward zero and folding becomes correct. '
            + 'Against population / recreational BB 3bets, the wider '
            + 'polar range pays the call.',
        },
      ],
      decision: {
        prompt: 'BB bets 75% pot on river. Hero with JT?',
        branches: [
          {
            label: 'Call',
            nextId: 'terminal_callcatch_win',
            correct: true,
            rationale:
              'Correct. Top pair is a pure bluff-catcher here. Pot '
              + 'odds and BB\'s polar bluff frequency make the call '
              + '+EV against anything except a nit. The "checked turn '
              + 'now facing aggression" spot is WHERE the EV is — '
              + 'overfolding this line is the most common recreational '
              + 'leak.',
          },
          {
            label: 'Fold',
            nextId: 'terminal_flop_overfold',
            correct: false,
            rationale:
              'Overfold. Folding top pair to a polar river bet in '
              + '3BP against a population BB is where winners lose '
              + 'their edge. You would need strong reads that villain '
              + 'is a nit. Default is call.',
          },
          {
            label: 'Raise to 90bb (jam)',
            nextId: 'terminal_river_overbet_spew',
            correct: false,
            rationale:
              'Raise spew. Top pair is a bluff-catcher, not a raise. '
              + 'BB\'s value range never folds; BB\'s bluff range '
              + 'never bluff-calls. We turn the best part of our '
              + 'bluff-catching frequency into a net loss.',
          },
        ],
      },
    },

    // ===== TURN OVERBET GOT CHECK-RAISED — the "bluff didn't fold them" spot =====
    river_brick_v_checkraises: {
      id: 'river_brick_v_checkraises',
      street: 'turn',
      board: ['T♥', '9♥', '6♠', '2♣'],
      pot: 108.0,
      villainAction: { kind: 'checkraise', size: 3.0 },
      frameworks: ['range_morphology', 'nut_advantage'],
      sections: [
        {
          kind: 'mismatch',
          heading: 'Hero overbet. BB check-raised to 3×. The bluff didn\'t fold them.',
          body:
            'This is the "my aggression didn\'t work — now I have to '
            + 'make a decision in a blown-up pot" spot. BB\'s turn '
            + 'check-raise against a capped IP overbet is almost purely '
            + 'value: sets (TT/99/66), overpairs (JJ-AA) that decided to '
            + 'trap the flop, and the occasional nut flush draw '
            + 'semi-bluff (A♥Kx, A♥Q♥).',
        },
        {
          kind: 'why',
          heading: 'The math of continuing',
          body:
            'To call the check-raise: price ~47bb to win ~155bb → needs '
            + '~30% equity. Our top pair vs BB\'s check-raise range '
            + 'averages ~18-22% equity. Folding is correct even though '
            + 'the pot is large — pot odds are not met.',
        },
        {
          kind: 'adjust',
          heading: 'Versus a spewy 3-bettor',
          body:
            'If villain is a known maniac who check-raise-bluffs turn, '
            + 'the math shifts — BB\'s value concentration drops and '
            + 'calling becomes defensible. Without that read, the fold '
            + 'is standard.',
        },
      ],
      decision: {
        prompt: 'BB check-raises the overbet to 90bb total. Hero with JT?',
        branches: [
          {
            label: 'Fold',
            nextId: 'terminal_correct_fold_cr',
            correct: true,
            rationale:
              'Correct. Pot odds not met; BB\'s range is value-heavy. '
              + 'The lesson: oversizing turn in a 3BP without a polar '
              + 'value range sets this trap. Accepting the loss here '
              + 'is cheaper than continuing.',
          },
          {
            label: 'Call',
            nextId: 'terminal_called_cr_light',
            correct: false,
            rationale:
              'Equity-light call. We pay ~47bb to continue with ~20% '
              + 'equity, then face the river with no plan. The pot '
              + 'odds do not justify it. The sunk-cost trap — '
              + '"I already invested this much" — is the classic '
              + 'amateur spew pattern.',
          },
          {
            label: 'Jam (shove)',
            nextId: 'terminal_called_cr_light',
            correct: false,
            rationale:
              'Spew jam. Folds out none of BB\'s value; gets called '
              + 'by everything that beats us. Hero\'s range for '
              + 'jamming here has essentially no value combos — it '
              + 'is a pure bluff jam vs a value-heavy range.',
          },
        ],
      },
    },

    // ===== TERMINALS (7) =====
    terminal_correct_checkback: {
      id: 'terminal_correct_checkback',
      street: 'river',
      board: ['T♥', '9♥', '6♠', '2♣', '3♦'],
      pot: 78.0,
      sections: [
        {
          kind: 'prose',
          heading: 'Pot preserved',
          body:
            'Check-back realizes our equity in a pot we probably win '
            + 'at showdown against BB\'s weaker pairs, and avoids the '
            + 'value-own trap against stronger ones. In 3BPs this is '
            + 'often the single most important discipline — not trying '
            + 'to squeeze thin value against condensed ranges.',
        },
        {
          kind: 'why',
          heading: 'Takeaway',
          body:
            'When you bet every street and villain peels every street, '
            + 'his range narrows to "calls but never raises." That '
            + 'shape beats your top-pair tier more often than it '
            + 'loses to it. Showdown the hand, take the pot.',
        },
      ],
    },

    terminal_callcatch_win: {
      id: 'terminal_callcatch_win',
      street: 'river',
      board: ['T♥', '9♥', '6♠', '2♣', '3♦'],
      pot: 85.0,
      sections: [
        {
          kind: 'prose',
          heading: 'Bluff-catch prints',
          body:
            'This is the EV of the entire line. Checking turn forfeits '
            + 'value — but when villain fires river, the polar-range '
            + 'math gives us a profitable call with top pair. The '
            + 'session cost of overfolding this exact spot is what '
            + 'separates break-even and winning regs.',
        },
        {
          kind: 'why',
          heading: 'Takeaway',
          body:
            'Capped ranges facing polar aggression have ONE defense: '
            + 'bluff-catching at the right pot odds. Give BB his bluff '
            + 'combos. You do not need hero\'s hand to be strong — '
            + 'you need villain\'s range to be capped enough that the '
            + 'price pays.',
        },
      ],
    },

    terminal_correct_fold_cr: {
      id: 'terminal_correct_fold_cr',
      street: 'turn',
      board: ['T♥', '9♥', '6♠', '2♣'],
      pot: 108.0,
      sections: [
        {
          kind: 'prose',
          heading: 'Fold absorbs the loss, ends the spew',
          body:
            'Bad overbet, worse check-raise, correct fold. The entire '
            + 'line cost ~37bb — painful, but continuing would have '
            + 'cost 80bb+ on worse equity. The lesson is in the '
            + 'sizing choice two streets ago, not in the fold itself.',
        },
        {
          kind: 'why',
          heading: 'Takeaway — sizing discipline in 3BPs',
          body:
            '3-bet pots have higher SPR volatility than SRPs. Overbet '
            + 'sizings require a genuinely polar range (nuts + air '
            + 'balanced). Merged value hands (TPTK/overpair) prefer '
            + 'medium sizings that get called by worse pairs, not '
            + 'overbets that only fold out the floats we beat.',
        },
      ],
    },

    terminal_flop_overfold: {
      id: 'terminal_flop_overfold',
      street: 'flop',
      board: ['T♥', '9♥', '6♠'],
      pot: 20.5,
      sections: [
        {
          kind: 'prose',
          heading: 'Overfold — gave up free equity',
          body:
            'Folding top-pair-plus-backdoor to a small flop lead in '
            + '3BP is a structural leak. BB\'s polarized donk range '
            + 'includes plenty of bluffs and plenty of overpairs that '
            + 'have 55-65% equity — our hand has ~40-50% equity '
            + 'against that shape. Folding here is pure -EV.',
        },
      ],
    },

    terminal_flop_raise_folds_weak: {
      id: 'terminal_flop_raise_folds_weak',
      street: 'flop',
      board: ['T♥', '9♥', '6♠'],
      pot: 50.0,
      sections: [
        {
          kind: 'prose',
          heading: 'Raise bloats the pot with a medium hand',
          body:
            'Raising in this spot folds out the A-high/blocker bluffs '
            + 'BB gives us for free and gets called or 3-bet by '
            + 'everything that dominates us. Hero\'s raise range on '
            + 'the flop needs to be polar — nut draws for semi-bluffs '
            + 'plus the rare slowplayed set for value. JTs middles '
            + 'between both and doesn\'t fit.',
        },
        {
          kind: 'why',
          heading: 'Takeaway',
          body:
            'In capped IP positions, calls are cheaper than raises '
            + 'unless your hand is genuinely polar or you have a '
            + 'read-based exploit. Don\'t raise top-pair in 3BP '
            + 'without a concrete plan for what you do when BB 3bets.',
        },
      ],
    },

    terminal_called_cr_light: {
      id: 'terminal_called_cr_light',
      street: 'turn',
      board: ['T♥', '9♥', '6♠', '2♣'],
      pot: 200.0,
      sections: [
        {
          kind: 'prose',
          heading: 'Continued light — now out of plan',
          body:
            'Calling the check-raise with ~20% equity and no river '
            + 'plan is the most expensive way to lose this hand. The '
            + 'pot is enormous, the SPR is low, and hero\'s hand '
            + 'class has no strong river action. Every river is '
            + 'either a crying call, a weak fold, or a bluff the '
            + 'player doesn\'t have the line for.',
        },
        {
          kind: 'why',
          heading: 'Takeaway — the sunk-cost trap',
          body:
            'Pot size already paid in does not change the forward EV '
            + 'of the next decision. Every continuation needs pot-odds '
            + 'math, not "I\'m already pot-committed." Walk away '
            + 'early when the line goes wrong.',
        },
      ],
    },

    terminal_river_overbet_spew: {
      id: 'terminal_river_overbet_spew',
      street: 'river',
      board: ['T♥', '9♥', '6♠', '2♣', '3♦'],
      pot: 78.0,
      sections: [
        {
          kind: 'prose',
          heading: 'Wrong tool for the spot',
          body:
            'Betting the river against a condensed or balanced-calling '
            + 'BB range with a medium-strength hand rarely clears the '
            + 'EV bar. Either villain folds the hands we beat, or '
            + 'villain calls with the hands we lose to. Thin-value '
            + 'bets require a range that clearly dominates the call '
            + 'region; we do not have that here.',
        },
      ],
    },
  },
};

// ---------- Line 3: BTN vs BB + SB, 3-way SRP IP, J♠8♥5♦ ---------- //
//
// First multiway line. BTN opens, both blinds cold-call → 3-way SRP.
// Hero on BTN in position, flop is a middling semi-wet J85r. This is
// where most live cash EV gets won or lost — the BTN opens wide, bad
// blinds defend too wide (calling-station behavior), and hero has to
// recalibrate every standard HU heuristic.
//
// Teaches: Fold Equity Compression, Nut Necessity, Bluff Frequency
// Collapse, Hand Class Shift, Equity Redistribution.

const LINE_BTN_VS_BB_SB_SRP_MW_J85 = {
  id: 'btn-vs-bb-sb-srp-mw-j85',
  title: 'BTN vs BB + SB · 3-way SRP · J♠8♥5♦',
  summary:
    '3-way single-raised pot, hero on BTN in position. Both blinds cold-called. '
    + 'Teaches the multiway recalibration — why HU cbet frequency, nut thresholds, '
    + 'and bluff EV all shift when a second villain is in the hand.',
  tags: ['mw', '3-way', 'srp', 'ip', 'middling', 'dry'],
  setup: {
    hero: { position: 'BTN', action: 'open' },
    villains: [
      { position: 'SB', action: 'call', vs: 'BTN' },
      { position: 'BB', action: 'call', vs: 'BTN' },
    ],
    potType: 'srp-3way',
    effStack: 100,
  },
  rootId: 'flop_root',
  nodes: {
    flop_root: {
      id: 'flop_root',
      street: 'flop',
      board: ['J♠', '8♥', '5♦'],
      pot: 10.0,
      villainAction: { kind: 'check' },
      frameworks: [
        'fold_equity_compression',
        'bluff_frequency_collapse',
        'nut_necessity',
        'hand_class_shift',
        'range_advantage',
      ],
      sections: [
        {
          kind: 'prose',
          heading: '3-way SRP: SB + BB both flat, flop is J85 rainbow.',
          body:
            'BTN opened 3bb, SB called, BB called. Both blinds check the '
            + 'flop. Pot is 10bb, ~97bb behind each. J85r is middling-dry: '
            + 'pair tier, one overcard (Q/K/A), some straight draws (76s, '
            + 'T9s, 97s, 64s), no flush possibilities.',
        },
        {
          kind: 'why',
          heading: 'Why multiway changes everything',
          body:
            'HU BTN-vs-BB on J85r, cbet frequency is ~75% at 33% pot. 3-way, '
            + 'the math inverts: if each villain continues 50% vs 33% bet, '
            + 'P(both fold) = 0.25. Bluff-only cbets need 50%+ fold equity '
            + 'to break even at this size — we\'re nowhere near that. Plus, '
            + 'when someone DOES continue, we face two ranges instead of '
            + 'one — the probability someone has you beat rises.',
        },
        {
          kind: 'adjust',
          heading: 'Calling-station blinds',
          body:
            'If both blinds are known stations (cold-call wide, never fold '
            + 'postflop), reduce cbet frequency further. Bluffs die; only '
            + 'value and strong semi-bluffs should bet. The flip side: '
            + 'value-bet THIN against stations — middle pair turns into a '
            + 'value hand for small sizings.',
        },
        {
          kind: 'mismatch',
          heading: 'The HU-player trap',
          body:
            'Players who learn poker from HU simulators cbet this flop '
            + 'wide because "PFR has range advantage, villain range is '
            + 'capped." That holds HU. In 3-way, BB + SB\'s combined range '
            + 'has more total set+two-pair combos, more straight draws, '
            + 'and more mid-pair hands that continue. Hero\'s range '
            + 'advantage structurally evaporates.',
        },
      ],
      decision: {
        prompt: 'Both villains check. Hero with A♦J♣ (TPTK)?',
        branches: [
          {
            label: 'Bet 50% pot (~5bb) — polar value+ semi-bluffs',
            nextId: 'turn_after_cbet',
            correct: true,
            rationale:
              'Correct. A polar 50% sizing with only TPTK+, sets, two-pair, '
              + 'combo draws, and OESDs (narrow ~25-30% of range) still '
              + 'clears a credible value threshold. AJ here is thin but '
              + 'defensible as value merge against both villains\' wide '
              + 'flatting ranges.',
          },
          {
            label: 'Bet 33% pot wide (cbet ~60% of range)',
            nextId: 'terminal_mw_wide_bluff_loses',
            correct: false,
            rationale:
              'HU-style cbet. Wide small cbets assume one villain and one '
              + 'continue range. 3-way, villains continue 40-55% each, so '
              + 'our bluffs fold 70%+ of villains only ~25% of the time '
              + 'combined. Pure bluffs are -EV. See Bluff Frequency '
              + 'Collapse framework.',
          },
          {
            label: 'Check back',
            nextId: 'turn_after_checkback',
            correct: false,
            rationale:
              'Legitimate sometimes with AJ (pot control, realize equity), '
              + 'BUT leaves value on the table here — J85r is a great '
              + 'texture for our TPTK to charge middle pairs and draws. '
              + 'Check-back range should be weaker pairs and air with '
              + 'showdown, not TPTK. Flagged as sub-optimal.',
          },
        ],
      },
    },

    turn_after_cbet: {
      id: 'turn_after_cbet',
      street: 'turn',
      board: ['J♠', '8♥', '5♦', '2♣'],
      pot: 25.0,
      villainAction: { kind: 'check' },
      frameworks: ['equity_redistribution', 'nut_necessity'],
      sections: [
        {
          kind: 'prose',
          heading: 'One villain called flop. Turn 2♣ brick. Both check to hero.',
          body:
            'BB called the flop cbet; SB folded. The hand is now effectively '
            + 'HU (BTN vs BB) on the turn. But the lesson is in the preflop '
            + 'calibration — if we\'d cbet the wider HU-style range, we\'d '
            + 'have needed to barrel turn with hands that don\'t want to, '
            + 'or give up lots of equity on rivers. The polar cbet puts '
            + 'us in control.',
        },
        {
          kind: 'why',
          heading: 'BB\'s range after cold-call + call flop cbet',
          body:
            'Cold-calling OOP to a BTN open with the SB still to act is a '
            + 'weak-range play — strong hands 3bet for protection. So BB\'s '
            + 'range is pair heavy (88-TT, AJ/KJ weak, small pocket pairs), '
            + 'with some suited connectors. Calling the polar 50% cbet '
            + 'narrows this further — middling pairs, top pair weak, '
            + 'occasional draws.',
        },
      ],
      decision: {
        prompt: 'BB checks turn 2♣. Hero with AJ?',
        branches: [
          {
            label: 'Bet 60% pot (~15bb)',
            nextId: 'terminal_mw_value_bet',
            correct: true,
            rationale:
              'Correct. BB\'s call range is pair-heavy and capped — our '
              + 'TPTK is ahead of the bulk. 60% charges draws (straight '
              + 'draw combos that peeled), extracts from weaker jacks and '
              + 'overpairs-we-beat. Hero\'s range here warrants value '
              + 'betting after the polar flop line.',
          },
          {
            label: 'Check back',
            nextId: 'terminal_mw_gave_up_value',
            correct: false,
            rationale:
              'Passive. Our TPTK has bet-fold EV against BB\'s range but '
              + 'we should prefer bet-call — the value is too clear to '
              + 'give up. Checking forfeits ~20% pot expectation against '
              + 'weaker pairs and middling Jx.',
          },
          {
            label: 'Overbet pot',
            nextId: 'terminal_mw_overbet_folds_pairs',
            correct: false,
            rationale:
              'Folds out BB\'s weaker Jx and middle pairs — the exact '
              + 'combos we beat. BB\'s continuing range at overbet sizing '
              + 'is disproportionately the combos that crush us (JJ, sets). '
              + 'Sizing matches range, not hand strength.',
          },
        ],
      },
    },

    turn_after_checkback: {
      id: 'turn_after_checkback',
      street: 'turn',
      board: ['J♠', '8♥', '5♦', '2♣'],
      pot: 10.0,
      villainAction: { kind: 'bet', size: 0.5 },
      frameworks: ['equity_redistribution', 'position_with_callers'],
      sections: [
        {
          kind: 'mismatch',
          heading: 'We checked flop. Now SB leads turn 50% into BB + us.',
          body:
            'SB (who acts first OOP) bets 50% pot into the checked-flop '
            + '3-way pot. BB still to act behind. This is the "blind leads '
            + 'into the checked-back pot" spot — uncomfortable because '
            + 'we\'re sandwiched: SB represents something, BB can check-raise '
            + 'or call-and-trap. But pot odds are reasonable and our '
            + 'range has equity.',
        },
        {
          kind: 'why',
          heading: 'Position with callers behind',
          body:
            'When BB still has to act, our call range has to be resilient '
            + 'to BB raising. That constrains us to hands that want to see '
            + 'a river — pair+ or strong equity draws — not air floats. AJ '
            + 'has TPTK strength plus a good kicker and can comfortably '
            + 'take heat. See Position With Callers framework.',
        },
      ],
      decision: {
        prompt: 'SB bets 50% pot with BB still to act. Hero with AJ?',
        branches: [
          {
            label: 'Call',
            nextId: 'river_after_mw_barrel',
            correct: true,
            rationale:
              'Correct. TPTK is too strong to fold against SB\'s lead '
              + 'range — SB\'s stabs include air, middle pairs, weak top '
              + 'pairs. Calling keeps BB\'s bluff combos in the pot '
              + '(BB often check-calls behind with marginal stuff). Our '
              + 'range realizes equity well in position.',
          },
          {
            label: 'Fold',
            nextId: 'terminal_mw_overfold',
            correct: false,
            rationale:
              'Overfold. AJ is far too strong to fold to a 50% lead — '
              + 'we have ~60%+ equity vs SB\'s lead range. The only world '
              + 'where folding is correct is if we have a read that SB '
              + 'never leads without two pair+.',
          },
          {
            label: 'Raise to 12bb',
            nextId: 'terminal_mw_raise_spew',
            correct: false,
            rationale:
              'Raising with BB behind is spew. BB either folds (denying '
              + 'us his bluff-calls) or raises (forcing us off our hand). '
              + 'Our TPTK wants to see the river, not get blown off.',
          },
        ],
      },
    },

    river_after_mw_barrel: {
      id: 'river_after_mw_barrel',
      street: 'river',
      board: ['J♠', '8♥', '5♦', '2♣', '7♠'],
      pot: 20.0,
      villainAction: { kind: 'check' },
      frameworks: ['nut_necessity'],
      sections: [
        {
          kind: 'prose',
          heading: 'River 7♠. BB checks; SB (turn bettor) also checks.',
          body:
            'Both villains check river. BB\'s check after turn-call-river '
            + 'indicates weak — his turn call range was pairs + draws, the '
            + '7♠ didn\'t complete straight draws he\'d have (76s did, but '
            + 'T9s/64s missed). SB\'s check-check-give-up line on a turn '
            + 'he led is classic give-up after failing to fold out BB + '
            + 'hero.',
        },
        {
          kind: 'why',
          heading: 'Value bet vs check-back?',
          body:
            'Hero\'s TPTK beats: busted draws (huge chunk of continuing '
            + 'range since no draws came in), weaker Jx that BB kept with, '
            + 'middle pairs that called once. Loses to: sets (rare — BB '
            + 'usually check-raised), two-pair (even rarer). Thin value '
            + 'bet is +EV, small sizing.',
        },
      ],
      decision: {
        prompt: 'Both villains check river. Hero with AJ?',
        branches: [
          {
            label: 'Bet 33% pot for thin value',
            nextId: 'terminal_mw_value_bet',
            correct: true,
            rationale:
              'Correct. Target SB\'s weak give-up range + BB\'s '
              + 'missed-draws + weak Jx. Small sizing maximizes call '
              + 'frequency from weaker hands. Expected profit is small '
              + 'per session but consistent — this is where live earnings '
              + 'accumulate.',
          },
          {
            label: 'Check back',
            nextId: 'terminal_mw_gave_up_value',
            correct: false,
            rationale:
              'Too passive. Both villains signaled weakness — our TPTK is '
              + 'usually best. Checking forfeits the value we earned by '
              + 'navigating turn correctly. Don\'t give up thin value in '
              + 'MW when both villains have tipped weak.',
          },
          {
            label: 'Overbet',
            nextId: 'terminal_mw_overbet_folds_pairs',
            correct: false,
            rationale:
              'Sizing leak — we fold out exactly the pair-weaker hands '
              + 'we beat. Polar sizing works with a polar range; our range '
              + 'here is condensed (medium-pair + TPTK tier).',
          },
        ],
      },
    },

    // ===== Terminals =====
    terminal_mw_value_bet: {
      id: 'terminal_mw_value_bet',
      street: 'river',
      board: ['J♠', '8♥', '5♦', '2♣', '7♠'],
      pot: 25.0,
      sections: [
        {
          kind: 'prose',
          heading: 'MW thin value prints',
          body:
            'Thin value bets against MW capped-pair-heavy ranges are the '
            + 'core winning line against recreational tables. The edge per '
            + 'pot is small but frequent — these bets compound across '
            + 'sessions.',
        },
        {
          kind: 'why',
          heading: 'Takeaway',
          body:
            'Multiway demands tighter thresholds on BLUFFS, not on VALUE. '
            + 'Bluff less (fold equity compression), value-bet similarly '
            + 'or MORE (more callers = more total value extracted).',
        },
      ],
    },

    terminal_mw_wide_bluff_loses: {
      id: 'terminal_mw_wide_bluff_loses',
      street: 'flop',
      board: ['J♠', '8♥', '5♦'],
      pot: 10.0,
      sections: [
        {
          kind: 'mismatch',
          heading: 'Wide cbet bleeds EV against 2+ ranges',
          body:
            'A 33% cbet with 60% of range in 3-way requires both villains '
            + 'fold combined. At reasonable continue rates, that\'s a '
            + 'low-probability event. The pure-bluff hands never realize '
            + 'enough equity, and the thin-value hands face too many '
            + 'better hands in the continuing range.',
        },
        {
          kind: 'why',
          heading: 'Takeaway — Bluff Frequency Collapse',
          body:
            'For every additional villain, divide your default HU cbet '
            + 'frequency by roughly the per-villain continue rate. Two '
            + 'villains at 50% continue each = 25% all-fold = cbet '
            + 'frequency needs to drop by ~60% vs HU.',
        },
      ],
    },

    terminal_mw_gave_up_value: {
      id: 'terminal_mw_gave_up_value',
      street: 'river',
      board: ['J♠', '8♥', '5♦', '2♣', '7♠'],
      pot: 20.0,
      sections: [
        {
          kind: 'prose',
          heading: 'Check-back when you should have bet',
          body:
            'Giving up thin value in MW is costly. Villains folding into '
            + 'capped-range-check usually have weak hands; your TPTK '
            + 'profits from a small bet against their wide calling range.',
        },
      ],
    },

    terminal_mw_overbet_folds_pairs: {
      id: 'terminal_mw_overbet_folds_pairs',
      street: 'river',
      board: ['J♠', '8♥', '5♦', '2♣', '7♠'],
      pot: 20.0,
      sections: [
        {
          kind: 'prose',
          heading: 'Overbet vs condensed range — pure value-own',
          body:
            'Against condensed pair-heavy ranges, overbets get called only '
            + 'by the hands that dominate you (JJ sets, etc.) and fold out '
            + 'exactly the hands you beat. Net EV is worse than a small '
            + 'value bet OR check-back.',
        },
      ],
    },

    terminal_mw_overfold: {
      id: 'terminal_mw_overfold',
      street: 'turn',
      board: ['J♠', '8♥', '5♦', '2♣'],
      pot: 10.0,
      sections: [
        {
          kind: 'prose',
          heading: 'Overfold vs MW lead',
          body:
            'Folding TPTK vs a 50% lead in 3-way is a leak of ~4bb/100 '
            + 'at the scale this matters. SB\'s lead range is too wide to '
            + 'give up TPTK. Default is call; fold only vs known nit.',
        },
      ],
    },

    terminal_mw_raise_spew: {
      id: 'terminal_mw_raise_spew',
      street: 'turn',
      board: ['J♠', '8♥', '5♦', '2♣'],
      pot: 10.0,
      sections: [
        {
          kind: 'prose',
          heading: 'Raise with caller behind — no plan',
          body:
            'Raising turn with BB still to act is structural spew. BB '
            + 'often has the stronger continuing hand (BB\'s check-call '
            + 'flop range is Jx heavy); SB\'s range disappears when '
            + 'raised. You\'re forcing BB to narrow to hands that beat '
            + 'you — the raise earns nothing.',
        },
        {
          kind: 'why',
          heading: 'Takeaway — Position With Callers',
          body:
            'In MW, raising from the middle commits you against the worst '
            + 'combination of continuing ranges. If there\'s a caller '
            + 'behind, call the current action and realize equity in '
            + 'position rather than raising into uncertainty.',
        },
      ],
    },
  },
};

// ---------- Line 4: CO vs BB SRP OOP, paired K♠7♦7♣ ---------- //

const LINE_CO_VS_BB_SRP_OOP_PAIRED = {
  id: 'co-vs-bb-srp-oop-paired-k77',
  title: 'CO vs BB · SRP · Paired K♠7♦7♣',
  summary:
    'Single-raised pot, hero in CO but BB defended so hero is OOP on a '
    + 'paired board. Teaches small-cbet frequency on paired textures and '
    + 'turn card-reading.',
  tags: ['hu', 'srp', 'oop', 'paired', 'dry'],
  setup: {
    hero: { position: 'CO', action: 'open' },
    villains: [{ position: 'BB', action: 'call', vs: 'CO' }],
    potType: 'srp',
    effStack: 100,
  },
  rootId: 'flop_root',
  nodes: {
    flop_root: {
      id: 'flop_root',
      street: 'flop',
      board: ['K♠', '7♦', '7♣'],
      pot: 5.5,
      villainAction: null,
      frameworks: ['range_advantage', 'whiff_rate'],
      sections: [
        {
          kind: 'prose',
          heading: 'Paired K77 rainbow — the textbook small-cbet board.',
          body:
            'BB defended vs CO open. Hero acts first OOP. Paired boards '
            + 'have the highest whiff rates — BB rarely has 7x in defend '
            + 'range, Kx is small. Huge wide-small-cbet board.',
        },
        {
          kind: 'why',
          heading: 'Why cbet',
          body:
            'Hero\'s range has all the Kx combos and overpairs; BB has '
            + 'few 7x combos (suited 7x only, rare). Nut advantage clearly '
            + 'hero. Wide range-bet at 25-33% prints against BB\'s mostly-'
            + 'whiff continuing range.',
        },
      ],
      decision: {
        prompt: 'Hero acts OOP. Cbet or check?',
        branches: [
          { label: 'Cbet 33% pot', nextId: 'turn_brick', correct: true, rationale: 'Correct. High-whiff paired boards want wide small cbets. Nut advantage + range advantage both favor hero.' },
          { label: 'Cbet 75% pot', nextId: 'terminal_oversized_paired', correct: false, rationale: 'Sizing leak. Paired board hands polarize into trips (rare) + bluffs; 75% sizing gets called by the exact hands we beat small.' },
          { label: 'Check', nextId: 'terminal_checkback_paired', correct: false, rationale: 'Gives up free equity. Paired boards are the best wide-cbet spots — checking wastes the structural edge.' },
        ],
      },
    },
    turn_brick: {
      id: 'turn_brick',
      street: 'turn',
      board: ['K♠', '7♦', '7♣', '2♥'],
      pot: 9.1,
      villainAction: null,
      frameworks: ['range_morphology'],
      sections: [
        { kind: 'prose', heading: 'Turn brick 2♥, villain called flop cbet.', body: 'BB called the small cbet with Kx (weak), middling pocket pairs (55-QQ), some 7x slowplays, occasional backdoor float. Hero\'s range still has more value (better Kx, overpairs).' },
        { kind: 'why', heading: 'Continue barreling?', body: 'Turn is a pure brick. Hero\'s nut advantage intact; villain\'s range narrow. Another small value bet extracts from weaker Kx and folds out mid pocket pairs.' },
      ],
      decision: {
        prompt: 'Hero acts. Barrel or check?',
        branches: [
          { label: 'Bet 50% pot', nextId: 'river_after_barrel', correct: true, rationale: 'Correct. Nut advantage persists; charge villain\'s middle pairs and weak Kx.' },
          { label: 'Check', nextId: 'terminal_turn_check_paired', correct: false, rationale: 'Passive. Gives villain a free card and forfeits thin value from middling pairs.' },
          { label: 'Overbet', nextId: 'terminal_overbet_river_paired', correct: false, rationale: 'Folds out weaker pairs we beat; polar sizing needs polar range which hero lacks here.' },
        ],
      },
    },
    river_after_barrel: {
      id: 'river_after_barrel',
      street: 'river',
      board: ['K♠', '7♦', '7♣', '2♥', '4♦'],
      pot: 18.1,
      villainAction: null,
      frameworks: ['range_morphology'],
      sections: [
        { kind: 'prose', heading: 'River 4♦ brick, villain called turn.', body: 'Villain\'s range is now pair-heavy — middling pocket pairs, weak Kx. Hero needs thin value sizing to extract.' },
      ],
      decision: {
        prompt: 'Hero with AKo. Bet or check?',
        branches: [
          { label: 'Bet 33% pot for thin value', nextId: 'terminal_thin_value_paired', correct: true, rationale: 'Correct. Target villain\'s weak Kx and middle pairs that call small.' },
          { label: 'Check', nextId: 'terminal_checkback_paired', correct: false, rationale: 'Missed value. Villain\'s range is weak enough to bet-get-called.' },
          { label: 'Bet 75% pot', nextId: 'terminal_overbet_river_paired', correct: false, rationale: 'Sizing leak. Folds out exactly the pair-weaker calls we target.' },
        ],
      },
    },
    terminal_thin_value_paired: { id: 'terminal_thin_value_paired', street: 'river', board: ['K♠', '7♦', '7♣', '2♥', '4♦'], pot: 18.1, sections: [{ kind: 'prose', heading: 'Thin value prints', body: 'Small bets vs weak capped ranges are the core of paired-board EV.' }] },
    terminal_checkback_paired:  { id: 'terminal_checkback_paired',  street: 'river', board: ['K♠', '7♦', '7♣', '2♥', '4♦'], pot: 18.1, sections: [{ kind: 'prose', heading: 'Missed value', body: 'Villain checks = weak; bet cleans up the pot.' }] },
    terminal_overbet_river_paired: { id: 'terminal_overbet_river_paired', street: 'river', board: ['K♠', '7♦', '7♣', '2♥', '4♦'], pot: 18.1, sections: [{ kind: 'prose', heading: 'Overbet folds weak', body: 'Oversizing against capped ranges folds out weak-pair calls.' }] },
    terminal_oversized_paired: { id: 'terminal_oversized_paired', street: 'flop', board: ['K♠', '7♦', '7♣'], pot: 5.5, sections: [{ kind: 'prose', heading: 'Oversized paired cbet', body: 'Polar size on merged range — mismatched.' }] },
    terminal_turn_check_paired: { id: 'terminal_turn_check_paired', street: 'turn', board: ['K♠', '7♦', '7♣', '2♥'], pot: 9.1, sections: [{ kind: 'prose', heading: 'Turn check-back', body: 'Gave up the barrel lane on a nut-advantaged brick turn.' }] },
  },
};

// ---------- Line 5: SB vs BTN 3BP OOP wet T♠9♠8♥ ---------- //

const LINE_SB_VS_BTN_3BP_OOP_WET = {
  id: 'sb-vs-btn-3bp-oop-wet-t98',
  title: 'SB vs BTN · 3BP · Wet T♠9♠8♥',
  summary:
    '3-bet pot, hero in SB, defended vs BTN 3bet. Flop is max-wet — '
    + 'two-tone + middling connected. Teaches overpair defense and '
    + 'equity-realization on scary boards.',
  tags: ['hu', '3bp', 'oop', 'wet', 'two-tone', 'middling'],
  setup: {
    hero: { position: 'SB', action: 'fourBet', vs: 'BTN' }, // note: ACT is "open from SB" but wrapped as 4bet vs BTN 3bet — treat as 4bp for schema
    villains: [{ position: 'BTN', action: 'threeBet', vs: 'SB' }],
    potType: '3bp',
    effStack: 90,
  },
  rootId: 'flop_root',
  nodes: {
    flop_root: {
      id: 'flop_root',
      street: 'flop',
      board: ['T♠', '9♠', '8♥'],
      pot: 21.0,
      villainAction: null,
      frameworks: ['range_advantage', 'nut_advantage', 'range_morphology'],
      sections: [
        { kind: 'prose', heading: 'Wet middling two-tone 3BP — straight on board, every draw alive.', body: 'Hero in SB flatted BTN 3bet (rare but OK with QQ, AK, AQs in modern frames). Flop T98ss contains a made straight (QJ, J7, 76), flush draws, open-enders. Every range has equity redistribution.' },
        { kind: 'mismatch', heading: 'Overpair is NOT the nuts here', body: 'AA on T98ss is crushed by 3bet-range straights (QJs, JJ coin-flip with hero range). This is the classic "my overpair isn\'t nutted on wet boards" teaching spot.' },
      ],
      decision: {
        prompt: 'Hero acts OOP with A♦A♣.',
        branches: [
          { label: 'Check (pot control)', nextId: 'turn_after_check', correct: true, rationale: 'Correct. AA on T98ss is a bluff-catcher, not a nut hand. Check-call keeps BTN\'s bluffs in; check-raise overcommits.' },
          { label: 'Bet 33% pot', nextId: 'terminal_bet_wet_aa', correct: false, rationale: 'Thin value + equity denial doesn\'t justify — BTN\'s continue range crushes AA on this texture.' },
          { label: 'Bet 75% pot', nextId: 'terminal_bet_wet_aa', correct: false, rationale: 'Polar sizing with a non-nut hand on a wet board. BTN calls with draws and sets, raises with straights. AA is a mess.' },
        ],
      },
    },
    turn_after_check: {
      id: 'turn_after_check',
      street: 'turn',
      board: ['T♠', '9♠', '8♥', '2♣'],
      pot: 21.0,
      villainAction: { kind: 'bet', size: 0.66 },
      frameworks: ['range_morphology'],
      sections: [
        { kind: 'prose', heading: '2♣ brick, BTN bets 66% pot.', body: 'BTN\'s turn bet after hero\'s check includes value (overpairs, sets, straights) + draws (flush draws, pair+draw). AA\'s equity is ~50% against this range (behind straights, ahead of draws and worse pairs).' },
      ],
      decision: {
        prompt: 'BTN bets turn. Hero with AA?',
        branches: [
          { label: 'Call', nextId: 'river_after_turn_call', correct: true, rationale: 'Correct. Call-call with overpair on wet board. Raise-folds equity vs draws; fold is too tight vs BTN range.' },
          { label: 'Fold', nextId: 'terminal_overfold_aa', correct: false, rationale: 'Too tight. AA has ~50% equity vs BTN\'s turn bet range; pot odds make calling profitable.' },
          { label: 'Raise', nextId: 'terminal_raise_wet_aa', correct: false, rationale: 'Bloats the pot with a hand that\'s ahead of draws but behind straights. Call and re-evaluate river.' },
        ],
      },
    },
    river_after_turn_call: {
      id: 'river_after_turn_call',
      street: 'river',
      board: ['T♠', '9♠', '8♥', '2♣', '7♠'],
      pot: 49.0,
      villainAction: { kind: 'bet', size: 1.0 },
      frameworks: ['nut_advantage'],
      sections: [
        { kind: 'mismatch', heading: 'River 7♠ completes straights AND flush. BTN bets pot.', body: 'Worst possible card — 7♠ makes every straight that had J or 6, completes the flush draw. AA is now a bluff-catcher against a polar range that\'s value-heavy.' },
      ],
      decision: {
        prompt: 'BTN jams-equivalent (pot bet). Hero with AA?',
        branches: [
          { label: 'Fold', nextId: 'terminal_fold_river_wet', correct: true, rationale: 'Correct. Range is value-heavy on this runout. AA beats only missed-draws (rare after calling turn).' },
          { label: 'Call', nextId: 'terminal_crying_call_wet', correct: false, rationale: 'Crying call. BTN\'s polar bet on this runout has too little bluff combo for AA to profit.' },
          { label: 'Raise', nextId: 'terminal_raise_wet_aa', correct: false, rationale: 'Spew — no realistic value range for hero to raise with AA here.' },
        ],
      },
    },
    terminal_fold_river_wet: { id: 'terminal_fold_river_wet', street: 'river', board: ['T♠', '9♠', '8♥', '2♣', '7♠'], pot: 49.0, sections: [{ kind: 'prose', heading: 'Save your stack', body: 'Overpair discipline on wet runouts is a core 3BP skill.' }] },
    terminal_crying_call_wet: { id: 'terminal_crying_call_wet', street: 'river', board: ['T♠', '9♠', '8♥', '2♣', '7♠'], pot: 49.0, sections: [{ kind: 'prose', heading: 'Called light on a scare runout', body: 'BTN\'s bluff frequency on runouts that complete draws is low.' }] },
    terminal_overfold_aa: { id: 'terminal_overfold_aa', street: 'turn', board: ['T♠', '9♠', '8♥', '2♣'], pot: 21.0, sections: [{ kind: 'prose', heading: 'Overfold', body: 'AA too strong to fold to one turn bet on a not-yet-scary card.' }] },
    terminal_raise_wet_aa: { id: 'terminal_raise_wet_aa', street: 'turn', board: ['T♠', '9♠', '8♥', '2♣'], pot: 21.0, sections: [{ kind: 'prose', heading: 'Raise into wet range', body: 'Raising with non-nut hands on wet boards invites worse outcomes.' }] },
    terminal_bet_wet_aa: { id: 'terminal_bet_wet_aa', street: 'flop', board: ['T♠', '9♠', '8♥'], pot: 21.0, sections: [{ kind: 'prose', heading: 'Betting non-nut hands on wet', body: 'AA on T98ss wants to pot control, not build the pot.' }] },
  },
};

// ---------- Line 6: UTG vs BTN 4BP deep ---------- //

const LINE_UTG_VS_BTN_4BP_DEEP = {
  id: 'utg-vs-btn-4bp-deep',
  title: 'UTG vs BTN · 4BP · A♠K♦2♠',
  summary:
    '4-bet pot, UTG hero vs BTN 4bet-caller on Ace-high flop. Teaches '
    + 'range concentration at low SPR and the value of blocker logic.',
  tags: ['hu', '4bp', 'low-spr', 'high-card', 'ace-high'],
  setup: {
    hero: { position: 'UTG', action: 'open' },
    villains: [{ position: 'BTN', action: 'fourBet', vs: 'UTG' }], // scenario: hero opened, BTN 3bet, UTG 4bet, BTN called.
    potType: '4bp',
    effStack: 100,
  },
  rootId: 'flop_root',
  nodes: {
    flop_root: {
      id: 'flop_root',
      street: 'flop',
      board: ['A♠', 'K♦', '2♠'],
      pot: 55.0,
      villainAction: { kind: 'check' },
      frameworks: ['range_morphology', 'capped_range_check'],
      sections: [
        { kind: 'prose', heading: 'AK2ss in a 4BP, SPR ~0.8. Villain checks.', body: 'Ranges are extremely narrow: hero UTG 4bet range = QQ+/AK mostly; BTN 4bet-call range = QQ-KK/AK/AKs/AQs. AK2ss massively favors AK and AA/KK (sets). Low SPR means decisions are stack-committed.' },
        { kind: 'why', heading: 'Range concentration at 4BP SPR', body: 'Both players have highly concentrated value ranges on this flop. Hero\'s range has all AA/KK (3 combos) + every AK (16 combos) + QQ (6). Villain lacks AA/KK (almost — some 4bet-call), has QQ + AK + occasional AQs.' },
      ],
      decision: {
        prompt: 'Villain checks. Hero with AK.',
        branches: [
          { label: 'Jam (all-in)', nextId: 'terminal_jam_4bp_correct', correct: true, rationale: 'Correct at this SPR. Fold equity + value merge, villain must call with worse Ax. Low SPR = no reason to slow-play.' },
          { label: 'Bet 50% pot', nextId: 'terminal_bet_50_4bp', correct: false, rationale: 'Suboptimal sizing for 4BP SPR. The pot is already ~55bb; 27bb bet commits us anyway without the all-in threat.' },
          { label: 'Check back', nextId: 'terminal_checkback_4bp', correct: false, rationale: 'Slowplay leak. Villain rarely improves on the turn; no reason to give free cards with the top of hero\'s range.' },
        ],
      },
    },
    terminal_jam_4bp_correct: { id: 'terminal_jam_4bp_correct', street: 'flop', board: ['A♠', 'K♦', '2♠'], pot: 55.0, sections: [{ kind: 'prose', heading: 'Jam is standard at 4BP SPR', body: 'Range concentration + low SPR = commit all chips with top of range on flop.' }] },
    terminal_bet_50_4bp: { id: 'terminal_bet_50_4bp', street: 'flop', board: ['A♠', 'K♦', '2♠'], pot: 55.0, sections: [{ kind: 'prose', heading: 'Half-committed without plan', body: 'Betting half pot in 4BP leaves us married to the pot anyway; no leverage gained over a jam.' }] },
    terminal_checkback_4bp: { id: 'terminal_checkback_4bp', street: 'flop', board: ['A♠', 'K♦', '2♠'], pot: 55.0, sections: [{ kind: 'prose', heading: 'Slowplay leak', body: 'With the top of range in 4BP, jam for value. Check-back wastes bet-call EV.' }] },
  },
};

// ---------- Line 7: CO open, BTN call, BB call — 3-way SRP, hero CO OOP ---------- //

const LINE_CO_VS_BTN_BB_SRP_MW_OOP = {
  id: 'co-vs-btn-bb-srp-mw-oop',
  title: 'CO vs BTN + BB · 3-way SRP · Q♥5♠3♦ — hero OOP',
  summary:
    'CO opens, BTN flats in position, BB defends. Hero CO now plays '
    + 'OOP sandwiched between BTN (IP) and BB (OOP behind if we check). '
    + 'Teaches MW OOP decisions and sandwiched-position dynamics.',
  tags: ['mw', '3-way', 'srp', 'oop', 'dry', 'high-card'],
  setup: {
    hero: { position: 'CO', action: 'open' },
    villains: [
      { position: 'BB', action: 'call', vs: 'CO' },
      { position: 'BTN', action: 'call', vs: 'CO' },
    ],
    potType: 'srp-3way',
    effStack: 100,
  },
  rootId: 'flop_root',
  nodes: {
    flop_root: {
      id: 'flop_root',
      street: 'flop',
      board: ['Q♥', '5♠', '3♦'],
      pot: 10.0,
      villainAction: null,
      frameworks: ['bluff_frequency_collapse', 'position_with_callers', 'hand_class_shift'],
      sections: [
        { kind: 'prose', heading: '3-way on dry Q53r. Hero CO acts first OOP after BB checks.', body: 'Q53r is dry and high-card; hero has nut advantage over BB but BTN also has broadway range. Hero is sandwiched between BB (behind for OOP) and BTN (behind for IP). Decisions are harder than HU.' },
        { kind: 'adjust', heading: 'Against tight BTN flats', body: 'BTN flat vs CO is polar: pocket pairs + suited broadways/connectors. Broadways rarely hit Q53 hard. Range-bet small works; BTN folds a lot.' },
      ],
      decision: {
        prompt: 'Hero CO acts first OOP with A♠Q♣.',
        branches: [
          { label: 'Cbet 50% pot — polar value-focused', nextId: 'turn_after_cbet', correct: true, rationale: 'Correct. TPTK has enough equity and value vs MW range; polar sizing keeps hero\'s range clean.' },
          { label: 'Cbet 33% pot wide', nextId: 'terminal_wide_cbet_oop_mw', correct: false, rationale: 'Wide cbets OOP 3-way burn EV — hero can\'t realize equity as well, and bluffs die.' },
          { label: 'Check', nextId: 'terminal_checkback_oop_mw', correct: false, rationale: 'Gives up nut advantage on dry high-card board. Check-range needs to have stronger hands for this line to work.' },
        ],
      },
    },
    turn_after_cbet: {
      id: 'turn_after_cbet',
      street: 'turn',
      board: ['Q♥', '5♠', '3♦', '8♣'],
      pot: 25.0,
      villainAction: null,
      frameworks: ['nut_necessity'],
      sections: [
        { kind: 'prose', heading: 'Turn 8♣ brick, one villain called, one folded.', body: 'Effectively HU after flop. Hero\'s AQ still ahead of continuing range (weak Qx, second pair).' },
      ],
      decision: {
        prompt: 'Hero\'s turn play?',
        branches: [
          { label: 'Bet 60% pot', nextId: 'terminal_thin_value_mw_oop', correct: true, rationale: 'Value and charge draws.' },
          { label: 'Check', nextId: 'terminal_checkback_mw_oop_turn', correct: false, rationale: 'Gives up value; villain\'s range is weak.' },
          { label: 'Overbet', nextId: 'terminal_overbet_mw_oop', correct: false, rationale: 'Folds out the weaker Qx we beat.' },
        ],
      },
    },
    terminal_thin_value_mw_oop: { id: 'terminal_thin_value_mw_oop', street: 'turn', board: ['Q♥', '5♠', '3♦', '8♣'], pot: 25.0, sections: [{ kind: 'prose', heading: 'Thin value in MW-turned-HU', body: 'Handling the MW-to-HU transition correctly is key.' }] },
    terminal_wide_cbet_oop_mw: { id: 'terminal_wide_cbet_oop_mw', street: 'flop', board: ['Q♥', '5♠', '3♦'], pot: 10.0, sections: [{ kind: 'prose', heading: 'Wide MW cbet OOP leak', body: 'Bluffs die, equity unrealized.' }] },
    terminal_checkback_oop_mw: { id: 'terminal_checkback_oop_mw', street: 'flop', board: ['Q♥', '5♠', '3♦'], pot: 10.0, sections: [{ kind: 'prose', heading: 'Nut advantage forfeit', body: 'Dry high-card boards want some bets from OOP PFR.' }] },
    terminal_checkback_mw_oop_turn: { id: 'terminal_checkback_mw_oop_turn', street: 'turn', board: ['Q♥', '5♠', '3♦', '8♣'], pot: 25.0, sections: [{ kind: 'prose', heading: 'Passive turn', body: 'Value missed; capped ranges want you to bet.' }] },
    terminal_overbet_mw_oop: { id: 'terminal_overbet_mw_oop', street: 'turn', board: ['Q♥', '5♠', '3♦', '8♣'], pot: 25.0, sections: [{ kind: 'prose', heading: 'Oversizing', body: 'Condensed villain range punishes overbets.' }] },
  },
};

// ---------- Line 8: UTG open, MP call, BTN squeeze — hero UTG facing squeeze w/ caller behind ---------- //

const LINE_UTG_FACING_SQUEEZE = {
  id: 'utg-vs-btn-squeeze-mp-caller',
  title: 'UTG open, MP call, BTN squeeze — hero UTG',
  summary:
    'Hero UTG opens, MP flats, BTN squeezes. Hero decides preflop action '
    + 'sandwiched between caller behind and squeezer. Teaches squeeze-geometry '
    + 'defense and range concentration under pressure.',
  tags: ['mw', '3-way-preflop', '3bp', 'squeeze'],
  setup: {
    hero: { position: 'UTG', action: 'open' },
    villains: [
      { position: 'MP1', action: 'call', vs: 'UTG' },
      { position: 'BTN', action: 'threeBet', vs: 'UTG' },
    ],
    potType: '3bp-3way',
    effStack: 100,
  },
  rootId: 'pre_root',
  nodes: {
    pre_root: {
      id: 'pre_root',
      street: 'flop', // approximate — preflop decisions encoded as "flop" for schema; board empty-ish
      board: ['Q♣', '8♥', '2♦'], // illustrative flop if hero called
      pot: 20.0,
      villainAction: null,
      frameworks: ['squeeze_geometry', 'position_with_callers'],
      sections: [
        { kind: 'prose', heading: 'The setup', body: 'Hero UTG opens 3bb. MP1 flats (weak range — mostly pairs + suited broadways). BTN squeezes to 13bb. MP1 still to act behind hero.' },
        { kind: 'why', heading: 'Why the geometry matters', body: 'BTN\'s squeeze range is wider than a standard 3bet because of the dead money (blinds + MP1\'s call). Hero must defend TIGHTER than a standard 3bet defense because MP1 can over-squeeze or cold-4bet. AKs is a clear 4bet; TT-JJ are flat-or-fold depending on reads.' },
      ],
      decision: {
        prompt: 'BTN squeezes to 13bb. Hero UTG with QQ.',
        branches: [
          { label: '4bet to 30bb', nextId: 'terminal_4bet_qq_squeeze', correct: true, rationale: 'Correct vs population. QQ is top-of-range UTG; 4betting folds out MP1 and takes initiative vs BTN.' },
          { label: 'Call', nextId: 'terminal_call_squeeze_caller_behind', correct: false, rationale: 'With MP1 behind, calling opens up overcall/cold-4bet spots that destroy equity realization. Flat is wrong when squeezed with caller to act.' },
          { label: 'Fold', nextId: 'terminal_overfold_qq', correct: false, rationale: 'Structural overfold. QQ has ~45% equity vs BTN\'s polar squeeze range; folding gives up huge EV.' },
        ],
      },
    },
    terminal_4bet_qq_squeeze: { id: 'terminal_4bet_qq_squeeze', street: 'flop', board: ['Q♣', '8♥', '2♦'], pot: 65.0, sections: [{ kind: 'prose', heading: '4bet forces decisions', body: 'MP1 folds; BTN continues with only KK+/AK — hero has clean equity read.' }] },
    terminal_call_squeeze_caller_behind: { id: 'terminal_call_squeeze_caller_behind', street: 'flop', board: ['Q♣', '8♥', '2♦'], pot: 30.0, sections: [{ kind: 'prose', heading: 'Trapped between callers', body: 'MP1 can overcall with PP + suited hands or 5bet, neither of which is good for QQ.' }] },
    terminal_overfold_qq: { id: 'terminal_overfold_qq', street: 'flop', board: ['Q♣', '8♥', '2♦'], pot: 20.0, sections: [{ kind: 'prose', heading: 'QQ has equity', body: 'Folding top-5 holdings UTG to a squeeze is too tight vs any non-nit.' }] },
  },
};

// ---------- Library ---------- //

export const LINES = [
  LINE_BTN_VS_BB_SRP_DRY_Q72R,
  LINE_BTN_VS_BB_3BP_WET_T96,
  LINE_BTN_VS_BB_SB_SRP_MW_J85,
  LINE_CO_VS_BB_SRP_OOP_PAIRED,
  LINE_SB_VS_BTN_3BP_OOP_WET,
  LINE_UTG_VS_BTN_4BP_DEEP,
  LINE_CO_VS_BTN_BB_SRP_MW_OOP,
  LINE_UTG_FACING_SQUEEZE,
];

/**
 * Find a line by id. Returns null if not found.
 */
export const findLine = (id) => LINES.find((l) => l.id === id) || null;

/**
 * List every line's id and title — used by pickers.
 */
export const listLines = () =>
  LINES.map((l) => ({ id: l.id, title: l.title, summary: l.summary, tags: l.tags || [] }));
