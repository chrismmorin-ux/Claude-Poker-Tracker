/**
 * planRules.js — Plan rule chip taxonomy for the Hand Plan layer.
 *
 * Each chip is a small reusable rule citation that authored `comboPlans`
 * entries on `lines.js` decision nodes can attach to forward-looking
 * hand plans. Chips surface via <RuleChipModal> on tap (Stream P Q3=B).
 *
 * Chip shape:
 *   {
 *     id:        string       — stable kebab-case ID, never re-used
 *     label:     string       — short human label for the chip pill
 *     shortBody: string       — 1-sentence rule statement (chip tooltip)
 *     fullBody:  string       — 3-5 sentence rule explanation (modal)
 *     citations: Citation[]   — anchored sources
 *   }
 *
 * Citation shape:
 *   {
 *     source: 'POKER_THEORY.md' | 'external'
 *     anchor: string          — '§N.M' for POKER_THEORY.md, URL or
 *                               bibliographic ref for 'external'
 *     note?:  string          — optional one-line context
 *   }
 *
 * Pure module — no imports from UI or state layers.
 *
 * Origin: LSW-P1 (2026-04-27, Stream P Hand Plan Layer sub-charter).
 * Owner-approved 12-chip set covering MDF defense, range protection,
 * checking-range construction, call-with-a-plan, call-fold-to-turn-barrel,
 * raise-fold, thin-value-with-foldout, blocker-driven raise, capped-vs-
 * uncapped exploitation, polarized-vs-linear response, equity-realization
 * defense, board-improvement plan.
 */

const freezeChip = (chip) => Object.freeze({
  ...chip,
  citations: Object.freeze(chip.citations.map((c) => Object.freeze({ ...c }))),
});

// ---------- Chips ---------- //

export const MDF_DEFENSE = freezeChip({
  id: 'mdf-defense',
  label: 'MDF Defense',
  shortBody:
    'Pot odds dictate the minimum frequency you must continue to deny villain auto-profit on any bluff at this sizing.',
  fullBody:
    'Minimum Defense Frequency (MDF) = pot / (pot + bet). At this threshold, '
    + 'villain\'s bluffs make zero EV regardless of frequency. You don\'t need '
    + 'to defend MDF on every street with every individual hand — but your '
    + 'aggregate range continuation must hit it, or villain prints money by '
    + 'over-bluffing. MDF is a range-level constraint, not a hand-level one: '
    + 'use it to decide whether your continuing range is wide enough, then '
    + 'pick which hands populate it (typically: top of range + blocker '
    + 'bluff-catchers + draws).',
  citations: [
    { source: 'POKER_THEORY.md', anchor: '§6.2', note: 'MDF formula + range-level interpretation' },
    { source: 'POKER_THEORY.md', anchor: '§1.5', note: 'Pot odds foundation' },
  ],
});

export const RANGE_PROTECTION = freezeChip({
  id: 'range-protection',
  label: 'Range Protection',
  shortBody:
    'Continue with hands that aren\'t individually +EV calls so your overall calling range stays wide enough to resist future-street exploitation.',
  fullBody:
    'A "tight enough to be a snap fold" call exists not for its own EV but '
    + 'for the EV of every other call you make on this street. If you only '
    + 'continue with the strongest 30% of your range, villain bets every '
    + 'turn at any sizing for free EV — your turn-call range is too narrow '
    + 'to defend. Range protection costs small EV per individual marginal '
    + 'call but earns large EV by keeping villain\'s future bluffs honest. '
    + 'Distinct from MDF: MDF is the math; range protection is the '
    + 'pedagogy of why you make the call that fails the math at hand level.',
  citations: [
    { source: 'POKER_THEORY.md', anchor: '§6.2', note: 'MDF range-level interpretation' },
    { source: 'POKER_THEORY.md', anchor: '§3.7', note: 'Polarization by street — wider defense earlier' },
  ],
});

export const CHECKING_RANGE_CONSTRUCTION = freezeChip({
  id: 'checking-range-construction',
  label: 'Checking Range Construction',
  shortBody:
    'Some high-equity hands stay passive (instead of betting for value) so your check-back range carries enough strength to bluff-catch and beat probes.',
  fullBody:
    'If you bet every strong hand, your check-back range becomes capped — '
    + 'villain bombs every turn and river knowing you have nothing. Strong '
    + 'top pair / second pair / overpairs that don\'t need protection often '
    + 'belong in the checking range to keep it uncapped. The hand you '
    + '"didn\'t bet" still carries showdown value and can bluff-catch turn '
    + 'barrels — that\'s the work it\'s doing. The bet-for-value EV you '
    + 'sacrifice is recouped by the check-down EV your range gains across '
    + 'all the other combos that need a strong checking range to survive.',
  citations: [
    { source: 'POKER_THEORY.md', anchor: '§3.3', note: 'Continuation-bet construction' },
    { source: 'POKER_THEORY.md', anchor: '§3.7', note: 'Range-level bet/check construction' },
  ],
});

export const CALL_WITH_A_PLAN = freezeChip({
  id: 'call-with-a-plan',
  label: 'Call with a Plan',
  shortBody:
    'Identify which turn cards you barrel, check, or fold to before calling — passive doesn\'t mean reactive.',
  fullBody:
    'A call without a turn plan is a bet villain hasn\'t named yet. Before '
    + 'calling, name three things: (1) which turn cards improve your hand '
    + 'or villain\'s perceived range, (2) what you do facing a turn barrel '
    + 'on each card class (call / raise / fold), (3) what sizing tells '
    + 'shift the plan. Turn-card-conditional planning is the difference '
    + 'between a call that wins long-run and a call that bleeds. The plan '
    + 'lives at the time of the call — once the turn comes you execute, '
    + 'not deliberate.',
  citations: [
    { source: 'POKER_THEORY.md', anchor: '§1.4', note: 'Equity realization conditional on plan' },
    { source: 'POKER_THEORY.md', anchor: '§5.7', note: 'Range-based exploits — plan against range, not hand' },
  ],
});

export const CALL_FOLD_TO_TURN_BARREL = freezeChip({
  id: 'call-fold-to-turn-barrel',
  label: 'Call → Fold to Turn Barrel',
  shortBody:
    'Marginal made hand calls flop intending to fold to a turn barrel — only profitable if villain checks back the turn often enough to realize equity.',
  fullBody:
    'A "call-fold" plan calls the flop with a hand that beats villain\'s '
    + 'bluffs but loses to a turn barrel range. The call is +EV only if '
    + 'villain checks back the turn frequently enough that the showdown '
    + 'equity you realize when checked-to outweighs the EV you spew on '
    + 'turns where you\'re forced to fold to a second bullet. Threshold '
    + 'rule of thumb: villain must check back ≳30% of turns. Aggressive '
    + 'or polarized villains break this — against them the call-fold '
    + 'plan loses, and you should either fold the flop or raise instead.',
  citations: [
    { source: 'POKER_THEORY.md', anchor: '§1.4', note: 'Equity realization' },
    { source: 'POKER_THEORY.md', anchor: '§4.2', note: 'Bluff-catching — villain barrel frequency' },
  ],
});

export const RAISE_FOLD = freezeChip({
  id: 'raise-fold',
  label: 'Raise-Fold Plan',
  shortBody:
    'Raise for fold equity + denial; fold to a 3-bet without crying. Treat the raise as bluff-equivalent if villain rarely 3-bets.',
  fullBody:
    'A raise-fold plan accepts up-front that you will not continue if '
    + 'villain re-raises. The raise wins by folding out the bluff combos '
    + 'and weak made hands, and by denying free turn cards to draws. The '
    + 'fold to a 3-bet is the cost of the play, not a failure of it. Hands '
    + 'that fit: semi-bluffs with backdoor + pair, weak top pair on '
    + 'two-tone wet boards, blocker-bluff combos. Hands that don\'t: '
    + 'strong made hands (those have a call-or-3-bet plan). Raise-fold is '
    + 'a frequency play — its EV depends on villain\'s 3-bet rate, not on '
    + 'whether this specific 3-bet was a bluff.',
  citations: [
    { source: 'POKER_THEORY.md', anchor: '§5.6', note: 'Fold-equity exploits' },
    { source: 'POKER_THEORY.md', anchor: '§6.1', note: 'Fold-equity formula' },
  ],
});

export const THIN_VALUE_WITH_FOLDOUT = freezeChip({
  id: 'thin-value-with-foldout',
  label: 'Thin Value + Foldout Equity',
  shortBody:
    'Bet small with a hand barely ahead of villain\'s calling range, sized to fold out the marginal hands that beat you while extracting from worse.',
  fullBody:
    'Thin value lives at the boundary where villain\'s calling range is '
    + 'just barely worse than your hand. Sizing matters: too big and you '
    + 'fold out the worse hands you needed to call (turning value into '
    + 'no-fold-equity bluffs); too small and you let in the better hands '
    + 'you needed to fold out. The bet must do double work — extract from '
    + 'worse + fold out marginal better. River bets at 25-40% sizing into '
    + 'capped ranges are the canonical example. The hand has to be value '
    + 'against villain\'s call range *and* equity-protected against '
    + 'villain\'s fold range — that\'s the foldout-equity element.',
  citations: [
    { source: 'POKER_THEORY.md', anchor: '§4.1', note: 'Value betting theory' },
    { source: 'POKER_THEORY.md', anchor: '§6.4', note: 'Value bet threshold' },
  ],
});

export const BLOCKER_DRIVEN_RAISE = freezeChip({
  id: 'blocker-driven-raise',
  label: 'Blocker-Driven Raise',
  shortBody:
    'Bluff-raise with hands that block villain\'s value/calling combos — the cards in your hand remove the hands that don\'t fold.',
  fullBody:
    'A blocker-driven raise turns a naked bluff into +EV by using card '
    + 'removal: holding the ace of the flush suit removes nut-flush combos '
    + 'from villain\'s value range; holding a top-pair-blocker removes '
    + 'sets and two-pair. The bluff doesn\'t need to be the strongest hand '
    + 'in your raise range — it needs to remove the densest part of '
    + 'villain\'s no-fold range. Blocker logic is what separates +EV '
    + 'bluff-raises from spew. River check-raises against polar bets and '
    + 'turn raises with naked Ax flush blockers are canonical.',
  citations: [
    { source: 'POKER_THEORY.md', anchor: '§5.7', note: 'Range-based exploits + blockers' },
    { source: 'POKER_THEORY.md', anchor: '§6.6', note: 'Combo counting — blocker effect' },
  ],
});

export const CAPPED_UNCAPPED_EXPLOITATION = freezeChip({
  id: 'capped-uncapped-exploitation',
  label: 'Capped vs Uncapped Range',
  shortBody:
    'Polar-bet into a capped range (no nut combos); bluff-catch wide vs an uncapped range that is structurally polarized.',
  fullBody:
    'A capped range is one that has structurally folded the strongest '
    + 'combos earlier in the hand — e.g., the player who flat-called a '
    + '3-bet preflop has no AA/KK in their range; the player who checked '
    + 'a wet flop has no sets. Against capped ranges, polar overbets and '
    + 'large turn/river bets print: villain literally cannot have the nuts. '
    + 'Against uncapped ranges (the player who could still hold any combo '
    + 'including nuts), large bets need actual value backing. Inverting '
    + 'this — bluff-catching wide vs an uncapped range and folding to '
    + 'overbets vs capped ranges — is the textbook leak.',
  citations: [
    { source: 'POKER_THEORY.md', anchor: '§3.6', note: 'Postflop range narrowing' },
    { source: 'POKER_THEORY.md', anchor: '§5.8', note: 'The trap problem — uncapped ranges' },
  ],
});

export const POLARIZED_LINEAR_RESPONSE = freezeChip({
  id: 'polarized-linear-response',
  label: 'Polarized vs Linear Response',
  shortBody:
    'Polar bets demand bluff-catch top-of-range and fold middle; linear/merged bets demand fold bottom and call middle.',
  fullBody:
    'A polarized bet (overbet, large polar size) splits villain\'s range '
    + 'into nuts-or-air — your defense is bluff-catch with top of range '
    + 'and fold the middle (which is dominated by their value and beats '
    + 'their bluffs only marginally). A linear/merged bet (1/3 to 2/3 pot) '
    + 'represents medium-strong value asking thin pay-offs — defense is '
    + 'fold bottom, call middle, occasionally raise top. Confusing the '
    + 'two is a leak: bluff-catching middle vs polar = paying off value '
    + 'with hands that don\'t beat bluffs; folding middle vs linear = '
    + 'overfolding to value bets you should be calling.',
  citations: [
    { source: 'POKER_THEORY.md', anchor: '§3.5', note: 'Bet sizing — what it does and doesn\'t tell us' },
    { source: 'POKER_THEORY.md', anchor: '§3.7', note: 'Polarization by street' },
    { source: 'POKER_THEORY.md', anchor: '§4.2', note: 'Bluff-catching theory' },
  ],
});

export const EQUITY_REALIZATION_DEFENSE = freezeChip({
  id: 'equity-realization-defense',
  label: 'Equity Realization Defense',
  shortBody:
    'Calling decisions hinge on whether you\'ll realize current equity given position, SPR, and villain barrel frequency — not on raw equity alone.',
  fullBody:
    'A 38% hand realizes 38% of pot only if villain checks every street '
    + 'and you go to showdown. In practice, equity realization (R) is '
    + 'lower OOP, lower deep-stacked, lower against barrelers, lower with '
    + 'a draw that needs to improve. R for IP TPTK might be 0.85-1.0; for '
    + 'OOP middle pair facing a barreler, 0.55-0.70. Discount your raw '
    + 'equity by R when comparing to pot odds. A "call with 38%" looks '
    + 'easy until you realize 24% effective equity vs 35% needed — then '
    + 'it\'s a fold.',
  citations: [
    { source: 'POKER_THEORY.md', anchor: '§1.4', note: 'Equity realization' },
    { source: 'POKER_THEORY.md', anchor: '§7.1', note: 'Decisions derive from game state — including R' },
  ],
});

export const BOARD_IMPROVEMENT_PLAN = freezeChip({
  id: 'board-improvement-plan',
  label: 'Board Improvement Plan',
  shortBody:
    'Pre-call the turn cards that improve your equity and the ones that scare villain — fold to barrels on misses, lead/raise on hits.',
  fullBody:
    'For hands defined by what comes on the turn — backdoor draws, '
    + 'middle pair + gutshot, weak top pair on draw-heavy textures — '
    + 'plan turn-card classes before the flop call: equity hits (you '
    + 'made the draw, raise/lead), bluff hits (scare cards that hurt '
    + 'villain\'s range, lead or float-raise), bricks that miss (fold to '
    + 'barrel, sometimes float small bets). The plan converts a '
    + 'flop-EV-marginal call into a +EV multi-street play by harvesting '
    + 'the turn cards that flip the spot. Without it, you\'re just '
    + 'paying flop+turn for showdown equity you\'ll never realize.',
  citations: [
    { source: 'POKER_THEORY.md', anchor: '§1.4', note: 'Equity realization across streets' },
    { source: 'POKER_THEORY.md', anchor: '§3.5', note: 'Sizing tells on turn cards' },
    { source: 'POKER_THEORY.md', anchor: '§5.7', note: 'Range-based exploits — turn-card EV' },
  ],
});

// ---------- Index + helpers ---------- //

export const PLAN_RULE_CHIPS = Object.freeze({
  [MDF_DEFENSE.id]: MDF_DEFENSE,
  [RANGE_PROTECTION.id]: RANGE_PROTECTION,
  [CHECKING_RANGE_CONSTRUCTION.id]: CHECKING_RANGE_CONSTRUCTION,
  [CALL_WITH_A_PLAN.id]: CALL_WITH_A_PLAN,
  [CALL_FOLD_TO_TURN_BARREL.id]: CALL_FOLD_TO_TURN_BARREL,
  [RAISE_FOLD.id]: RAISE_FOLD,
  [THIN_VALUE_WITH_FOLDOUT.id]: THIN_VALUE_WITH_FOLDOUT,
  [BLOCKER_DRIVEN_RAISE.id]: BLOCKER_DRIVEN_RAISE,
  [CAPPED_UNCAPPED_EXPLOITATION.id]: CAPPED_UNCAPPED_EXPLOITATION,
  [POLARIZED_LINEAR_RESPONSE.id]: POLARIZED_LINEAR_RESPONSE,
  [EQUITY_REALIZATION_DEFENSE.id]: EQUITY_REALIZATION_DEFENSE,
  [BOARD_IMPROVEMENT_PLAN.id]: BOARD_IMPROVEMENT_PLAN,
});

/**
 * Pedagogical ordering — math foundations first (MDF + range protection),
 * then construction (checking range), then planning (call/raise plans),
 * then advanced range-vs-range pattern recognition.
 */
export const PLAN_RULE_CHIP_ORDER = Object.freeze([
  MDF_DEFENSE,
  RANGE_PROTECTION,
  CHECKING_RANGE_CONSTRUCTION,
  CALL_WITH_A_PLAN,
  CALL_FOLD_TO_TURN_BARREL,
  RAISE_FOLD,
  BOARD_IMPROVEMENT_PLAN,
  THIN_VALUE_WITH_FOLDOUT,
  BLOCKER_DRIVEN_RAISE,
  EQUITY_REALIZATION_DEFENSE,
  CAPPED_UNCAPPED_EXPLOITATION,
  POLARIZED_LINEAR_RESPONSE,
]);

export const isKnownRuleChip = (id) =>
  typeof id === 'string' && Object.hasOwn(PLAN_RULE_CHIPS, id);

export const listKnownRuleChips = () => Object.keys(PLAN_RULE_CHIPS);

export const getRuleChip = (id) =>
  isKnownRuleChip(id) ? PLAN_RULE_CHIPS[id] : null;
