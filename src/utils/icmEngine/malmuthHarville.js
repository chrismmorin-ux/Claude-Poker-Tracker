/**
 * malmuthHarville.js — Independent Chip Model ($EV per stack).
 *
 * MANDATORY: governed by POKER_THEORY.md §10. Tournament chips are NOT dollars
 * (§10.1). This converts { chip stacks } + { payout ladder } → { $EV per player }
 * via the Malmuth-Harville finish-probability model (§10.2):
 *
 *   P(player i finishes 1st)  = stack_i / total_chips
 *   recurse for each remaining place over the rest of the field (renormalized)
 *   $EV_i = Σ_place P(i finishes place) × payout[place]
 *
 * Correctness signatures the tests assert (§10.2):
 *   - Σ $EV === Σ payouts (conservation)
 *   - chip leader's $EV < proportional chip share; short stack's > its share
 *   - equal stacks → equal $EV
 *
 * Cost is factorial in field size; exact + cheap at a final table (≤ ~9). For
 * larger modeled fields the caller (buildIcmStacks) must reduce the field and
 * flag the result approximate (§10.6). A hard guard here falls back to the
 * proportional (chips-as-dollars) model rather than ever hanging the UI.
 */

// Above this modeled field size, exact Malmuth-Harville is too expensive; fall
// back to the proportional model. buildIcmStacks keeps the field at/below this.
export const MAX_ICM_FIELD = 10;

const EPS = 1e-12;

/**
 * Proportional ($-share) fallback: each stack's $EV = chip share × prize pool.
 * This is the naive "chips are dollars" model (NO ICM tax) — used only when the
 * field is too large for exact ICM. It is a documented degradation, never the
 * preferred path (§10.1 says this model is wrong near the money).
 *
 * @param {number[]} stacks
 * @param {number[]} payouts
 * @returns {number[]}
 */
export const proportionalEquity = (stacks, payouts) => {
  const n = stacks.length;
  const total = stacks.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const pool = payouts.reduce((a, b) => a + b, 0);
  if (n === 0 || total <= 0 || pool <= 0) return new Array(n).fill(0);
  return stacks.map(s => (s > 0 ? (s / total) * pool : 0));
};

/**
 * Exact Malmuth-Harville $EV per stack.
 *
 * @param {number[]} stacks  - chip stacks of the modeled field (all > 0 ideally;
 *                             zero/negative stacks contribute no equity)
 * @param {number[]} payouts - $ per finishing place, index 0 = 1st. Places beyond
 *                             the array pay 0. Flat payouts (satellites) are fine.
 * @returns {number[]} $EV aligned to `stacks`
 */
export const computeIcmEquity = (stacks, payouts) => {
  const n = Array.isArray(stacks) ? stacks.length : 0;
  const equity = new Array(n).fill(0);
  if (n === 0 || !Array.isArray(payouts) || payouts.length === 0) return equity;

  const total = stacks.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  if (total <= 0) return equity;

  // Defensive: never hang the UI on an oversized field — degrade to proportional.
  if (n > MAX_ICM_FIELD) return proportionalEquity(stacks, payouts);

  // Only the first `places` finishing positions carry money; deeper places are 0
  // and don't affect $EV, so the recursion depth is bounded by paid places.
  const places = Math.min(payouts.length, n);

  // Indices of players still "alive" in the current branch. Each branch carries
  // the probability `prob` that we reached it and `remaining` chips among `alive`.
  const recurse = (alive, placeIndex, prob, remaining) => {
    if (placeIndex >= places || prob < EPS || remaining <= 0) return;
    const payoutHere = payouts[placeIndex];
    for (let k = 0; k < alive.length; k++) {
      const i = alive[k];
      const s = stacks[i];
      if (s <= 0) continue;
      const pHere = s / remaining;          // P(i is the next to finish, i.e. takes this place)
      const branchProb = prob * pHere;
      if (payoutHere) equity[i] += branchProb * payoutHere;
      if (placeIndex + 1 < places && branchProb >= EPS) {
        // The rest of the field competes for the next place.
        const rest = alive.slice(0, k).concat(alive.slice(k + 1));
        recurse(rest, placeIndex + 1, branchProb, remaining - s);
      }
    }
  };

  const allAlive = [];
  for (let i = 0; i < n; i++) if (stacks[i] > 0) allAlive.push(i);
  recurse(allAlive, 0, 1, total);
  return equity;
};
