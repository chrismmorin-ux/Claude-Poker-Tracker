/**
 * ruleMatch — evaluate a Conduct Card rule against a decision.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS HAS TO EXIST BEFORE ANYTHING ELSE IS BUILT ON THE CARD.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * A Conduct Card is registered as a policy — a map from a situation to a distribution over
 * actions. It was not one. The rules carried an English sentence ("a steep price (36-45%) and
 * not 4 opponent(s) live"), and the map from a decision to the rule that governs it lived only
 * inside the induction, which threw it away when it emitted.
 *
 * Everything the card is wanted for is a composition with that map:
 *   - a held-out score needs to know which rule an unseen decision falls under
 *   - a simulator needs to ask the card what this player does in a state
 *   - a best response needs a policy to respond TO
 *   - a diff between two runs needs a stable notion of "the same spot"
 * None of those were possible, and the reason was one `.join(' AND ')`.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * OFF-SUPPORT IS A REAL ANSWER, NOT AN ERROR.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The tree only splits on features that are COMPLETE over the pool at that node, so every
 * decision the induction saw has a value for every feature on its path. A decision the card
 * never saw need not: a postflop row has no `seat_pos` under the preflop-only rule, and a
 * feature can be null for reasons that have nothing to do with the subject.
 *
 * Such a decision matches NO rule, and that is the honest answer. It is also the quantity the
 * card currently cannot record: `coverage` is written as the literal 1 and the validator refuses
 * any other value, so the one field that would show a policy's holes is structurally forbidden
 * from carrying the measurement. `assign` returns -1 for those rows so the holes can be counted.
 */

/** Does one decision satisfy one condition? */
export const matchesCond = (value, cond) => {
  if (value == null) return false;              // the feature does not apply — off support
  switch (cond.op) {
    case 'eq': return value === cond.value;
    case 'not': return value !== cond.value;
    // `everything else` is the pooled remainder: none of the named sibling branches.
    case 'else': return !(cond.siblings || []).includes(value);
    default: return false;
  }
};

/** Does one decision satisfy every condition on a rule? */
export const matchesRule = (decision, predicate, FEATURES) => {
  for (const cond of predicate) {
    const fn = FEATURES[cond.feature];
    if (!fn) return false;
    if (!matchesCond(fn(decision), cond)) return false;
  }
  return true;
};

/**
 * Assign each decision to the rule that governs it.
 *
 * Returns an index per decision, or -1 for off-support. Also returns the count of decisions
 * matching MORE than one rule: the leaves of a tree are mutually exclusive by construction, so
 * any overlap means the emitted predicate does not reproduce the tree that produced it — which
 * is exactly the failure this module is here to make detectable.
 */
export const assign = (decisions, rules, FEATURES) => {
  const index = new Array(decisions.length).fill(-1);
  let overlaps = 0; let offSupport = 0;
  decisions.forEach((d, i) => {
    let hits = 0;
    for (let r = 0; r < rules.length; r++) {
      if (matchesRule(d, rules[r].predicate, FEATURES)) {
        if (hits === 0) index[i] = r;
        hits++;
      }
    }
    if (hits === 0) offSupport++;
    if (hits > 1) overlaps++;
  });
  return { index, overlaps, offSupport };
};
