/**
 * heroReach — which conditions on a rule can HERO put himself into on purpose.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS BELONGS IN THE PLUMBING.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * FOUNDER, 2026-08-19: *"these spots are THE PLACE where I will be making my own decisions,
 * and are the actual sources of EV in my game ... My hand history is a string of my own actions
 * bumping against theirs ... identifying the spot, the villain, the signal, the exploit, are
 * these spots that I can put myself in and execute."*
 *
 * A Conduct Card rule is addressed entirely from the SUBJECT's side: its conditions describe the
 * state he faced. That is correct for a descriptive record and insufficient for acting, because
 * it never says which of those conditions someone else CREATED. `facing = a bet` did not happen
 * to him — an opponent chose it. `a steep price (36-45%)` is not a fact about him at all; it is
 * a number the bettor selected.
 *
 * So every rule has a dual address: the villain's situation, and the hero action that induces
 * it. Without the second one, a ranked list of the spots where the card knows the most is a list
 * of places you might happen to end up. With it, the same list becomes places you can DECIDE to
 * be — which is the difference between a description and a plan.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THREE CLASSES, AND THE MIDDLE ONE IS THE INTERESTING ONE.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 *   lever   Hero chooses it, by applying pressure and by picking the size. He bets, so the
 *           villain is `facing = a bet`; he sets the price, so `price_pct` and `bet_x_pot` are
 *           his. Prior-street aggression counts: an earlier bet is no less deliberate for having
 *           been made one street ago. These are the conditions that turn a measured tendency
 *           into an exploit, because hero can manufacture them on purpose.
 *
 *   shaped  Hero influences it ACROSS THE HAND but cannot set it here. The pot and the SPR are
 *           built by earlier betting. So is the villain's range: `str_value` is what his
 *           CONTINUING range makes, and which hands continued is a function of what hero charged
 *           on the previous street. That is a real poker fact and it is why the strength columns
 *           are `shaped` rather than `given` — hero moves them, one street upstream.
 *
 *   given   The deal and the seating. Board texture, position, stacks, table size. Hero can
 *           select which of these to play, and cannot alter them once dealt.
 *
 * A rule whose conditions are ALL `given` describes something real and offers no way in: it is
 * intelligence, not a plan. A rule with a `lever` is a spot hero can walk into deliberately, and
 * a high-lift rule with a lever is the target list this whole instrument exists to produce.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE SYMMETRY THIS OPENS, NOTED AND NOT BUILT.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Hero's own history is the same object: a string of decisions in situations other people
 * created. The instrument that produces a Conduct Card for a villain produces one for hero
 * unchanged, and the pairing of the two at a shared node is where an EV claim eventually lives.
 * Nothing here assumes that; the classification is useful on its own. But `lever` is deliberately
 * defined by WHO CHOSE the condition rather than by when it was chosen, so that when hero's own
 * card exists the two sides join at the node without the term having to be redefined.
 */
import { FIELDS } from './decisionSchema.mjs';

/**
 * Hero picks it — by choosing to apply pressure, and by choosing the size.
 *
 * Note the schema's voice: "I" is the SUBJECT VILLAIN, not hero. So `i_bet_prev` is the villain
 * betting and is not a lever, while `faced_agg_prev` and `my_bet_raised_prev` describe pressure
 * arriving at the villain — which someone else chose, and which hero can choose.
 *
 * Prior-street aggression counts. An earlier bet is no less deliberate for having been made one
 * street ago, and the founder's question is which spots he can put himself in, not which he can
 * conjure without warning.
 */
const LEVER = new Set([
  'facing', 'aggressor', 'raises_in',
  'bet_x_pot', 'bet_bb', 'bet_to_bb', 'pot_before_bet',
  'to_call_bb', 'price_pct',
  // pressure that ARRIVED at the villain — hero is the one who sent it
  'faced_agg_prev', 'my_bet_raised_prev', 'raised_over_me', 'same_aggressor',
  'facing_allin', 'call_is_allin',
]);

/**
 * Hero moves it over the course of the hand. The strength columns belong here and that is the
 * non-obvious call: they describe the villain's CONTINUING range, and what continued is decided
 * by what hero charged upstream. Betting bigger on the flop is how you change `str_value` on the
 * turn — one street late, but genuinely under hero's control.
 */
const SHAPED = new Set([
  'street', 'pot_bb', 'spr', 'in_street_bb', 'invested_bb',
  'opps_live', 'limpers', 'closes', 'to_act_after', 'acted_before', 'after_aggr',
  // The villain's OWN prior actions. Hero does not choose them, but his line changes how often
  // they happen — which is the definition of shaped.
  'i_bet_prev', 'i_called_prev', 'i_bet_street', 'i_last_agg_pf', 'initiative',
  'prev_checked', 'barrels', 'pf_pot_type', 'pot_committed', 'multiway', 'can_raise',
]);

/** Everything the deal and the seating hand you. Selectable, never alterable. */
const GIVEN = new Set([
  'seat_pos', 'players', 'off_button', 'is_blind', 'is_late', 'blind_v_blind', 'in_pos',
  'stack_bb', 'board', 'flush_draw', 'suit_max', 'straight_poss', 'broadways', 'high_card',
  'str_basis',
  // the deal: which card came, and what it did to the board
  'draw_completed', 'board_paired_now', 'overcard_now', 'flush_card_now',
  // who was there before him
  'first_in', 'callers_ahead',
]);

/** `str_*` and `str_d_*` are shaped: hero's earlier price decides which hands are still there. */
export const heroClass = (field) => {
  if (LEVER.has(field)) return 'lever';
  if (SHAPED.has(field)) return 'shaped';
  if (GIVEN.has(field)) return 'given';
  if (/^str_/.test(field)) return 'shaped';
  return null;                      // unclassified — the gate below turns this into a failure
};

/**
 * Every situation field must be classified. A new column that nobody classifies would silently
 * default to "hero cannot reach it", which is the quiet wrong answer — the same shape as a gate
 * that passes on an empty set. Reported so it fails a run rather than a review.
 */
export const unclassifiedFields = () => FIELDS
  .filter((f) => f.group === 'situation')
  .map((f) => f.name)
  .filter((n) => heroClass(n) === null);

/**
 * How hero reaches a rule: the strongest class among its conditions, and the levers by name.
 * `lever` beats `shaped` beats `given` — one controllable condition is enough to make the spot
 * reachable, because hero only needs one way in.
 */
export const reachOf = (predicate) => {
  const classes = (predicate || []).map((c) => ({ feature: c.feature, cls: heroClass(c.feature) }));
  const levers = classes.filter((c) => c.cls === 'lever').map((c) => c.feature);
  const shaped = classes.filter((c) => c.cls === 'shaped').map((c) => c.feature);
  return {
    reach: levers.length ? 'lever' : shaped.length ? 'shaped' : 'given',
    levers,
    shaped,
  };
};
