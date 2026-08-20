/**
 * scoreHeldOut — is there anything in this card beyond the rules of poker?
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE QUESTION THE CARD HAS NEVER BEEN ABLE TO ANSWER.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * `induce` reports `accuracy = right / covered` over the SAME decisions the tree was grown on.
 * Every accuracy figure ever quoted about this artifact is resubstitution, and a resubstitution
 * figure cannot fall — adding rules can only ever improve it. So the card publishes a quality
 * number that nothing can falsify, which is the WS-291 mechanism in the place it is hardest to
 * see: a figure that looks like evidence and is arithmetic.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY A LADDER, AND WHY LOG-LOSS.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * "83.5% accurate" is meaningless without knowing what a trivial model scores. Most of a poker
 * decision is decided by what is LEGAL and what is cheap: facing a bet you may fold, facing no
 * bet you may not. A model that knows only that is not a description of a player, and if the
 * induced ruleset barely beats it then most of the card's apparent content is the rules of the
 * game wearing a villain's name. The nested ladder makes each rung's contribution explicit:
 *
 *   marginal    his action frequencies, ignoring the situation entirely
 *   legality    what he is even allowed to do, plus whether it costs anything
 *   street x facing   the coarsest real poker carve
 *   the card    every induced rule
 *
 * Scored as negative log-loss per decision, not accuracy, because the card's body is a MIX — a
 * full distribution with intervals. Argmax accuracy throws that distribution away and grades the
 * one thing the founder explicitly did not want the rule to be.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE SPLIT IS BY HAND, NEVER BY DECISION.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The same holding drives the flop, turn and river of one hand — 2.27 decisions per hand
 * postflop on these subjects. Splitting by decision puts the same holding on both sides and
 * grades the model on rows correlated with its own training set, which inflates the held-out
 * figure by exactly the amount that matters. The hand is the independent unit.
 *
 * Laplace smoothing is applied to every model equally: an unsmoothed rule that saw zero folds
 * assigns probability zero, and a single held-out fold sends log-loss to infinity — which grades
 * the smoothing, not the model.
 */
import { loadVillain } from './loadVillain.mjs';
import { enrichDecisions } from './enrichDecisions.mjs';
import { induce, featureMap } from './induceCore.mjs';
import { assign } from './ruleMatch.mjs';

const ALPHA = 0.5;                       // Laplace/Jeffreys smoothing, applied to every rung

const dist = (decisions) => {
  const t = new Map();
  for (const d of decisions) t.set(d.action, (t.get(d.action) || 0) + 1);
  return t;
};
const ACTIONS = ['fold', 'call', 'raise', 'bet', 'check'];

/** Negative log2-loss per decision of a model that returns a tally for each decision. */
const logLoss = (rows, tallyFor) => {
  let sum = 0;
  for (const d of rows) {
    const t = tallyFor(d) || new Map();
    const total = ACTIONS.reduce((s, a) => s + (t.get(a) || 0) + ALPHA, 0);
    const p = ((t.get(d.action) || 0) + ALPHA) / total;
    sum += -Math.log2(p);
  }
  return sum / rows.length;
};

const legalityCell = (d) => {
  // Only what the rules of the game and the price impose — no claim about the player.
  const facingBet = (d.toCallBB ?? 0) > 0;
  return `${facingBet ? 'owes' : 'free'}|${d.canRaise ? 'canraise' : 'noraise'}`;
};
const streetFacing = (d) => `${d.street}|${d.facing}`;

const cellModel = (fitRows, keyOf) => {
  const m = new Map();
  for (const d of fitRows) {
    const k = keyOf(d);
    if (!m.has(k)) m.set(k, new Map());
    const t = m.get(k);
    t.set(d.action, (t.get(d.action) || 0) + 1);
  }
  const global = dist(fitRows);
  return (d) => m.get(keyOf(d)) || global;
};

// ── run ────────────────────────────────────────────────────────────────────
const villain = process.env.VILLAIN;
const { pid, decisions } = await loadVillain({
  maxFiles: Number(process.env.MAX_FILES || 2000), villain,
});
enrichDecisions(decisions);

/**
 * SPLIT BY HAND, IN HAND ORDER — walk-forward, not a random split.
 *
 * Random assignment of hands would answer "can the card describe hands drawn from the same
 * period", which is not the question anyone has. Fitting on his earlier hands and scoring on his
 * later ones answers the question that matters and doubles as the stationarity test the card has
 * never run: a card that scores badly forward may be describing a player who changed.
 */
const hands = [...new Set(decisions.map((d) => d.handId))].sort();
const cut = Math.floor(hands.length * 0.6);
const fitHands = new Set(hands.slice(0, cut));
const fit = decisions.filter((d) => fitHands.has(d.handId));
const evalRows = decisions.filter((d) => !fitHands.has(d.handId));

const { rules, accuracy } = induce(fit);
const FEATURES = featureMap();
const { index, offSupport } = assign(evalRows, rules, FEATURES);
const ruleTallies = rules.map((r) => dist(r.pool));
const globalFit = dist(fit);

const marginal = () => globalFit;
const legality = cellModel(fit, legalityCell);
const sf = cellModel(fit, streetFacing);
// Precomputed rather than searched per lookup: an indexOf per decision is quadratic and this
// runs over every held-out row for every rung.
const cardTally = new Map();
evalRows.forEach((d, i) => cardTally.set(d, index[i] >= 0 ? ruleTallies[index[i]] : globalFit));
const cardModel = (d) => cardTally.get(d);

const rungs = [
  ['marginal (his action frequencies, no situation)', marginal],
  ['legality only (what he may do, and whether it costs)', legality],
  ['street x facing', sf],
  [`the induced card (${rules.length} rules)`, cardModel],
];

console.log(`\nvillain ${pid}`);
console.log(`${decisions.length} decisions over ${hands.length} hands`);
console.log(`fit on the first ${cut} hands (${fit.length} decisions), `
  + `score on the last ${hands.length - cut} (${evalRows.length})`);
console.log(`in-sample accuracy reported by induce(): ${(100 * accuracy).toFixed(1)}%`);
console.log(`held-out decisions matching NO rule: ${offSupport} `
  + `(${(100 * offSupport / evalRows.length).toFixed(2)}%)  <- the card's holes, never measurable before\n`);

console.log('rung                                                    held-out bits/decision   delta');
let prev = null;
for (const [name, model] of rungs) {
  const bits = logLoss(evalRows, model);
  const delta = prev == null ? '' : (bits - prev).toFixed(4);
  console.log(`${name.padEnd(54)} ${bits.toFixed(4).padStart(10)}   ${String(delta).padStart(8)}`);
  prev = bits;
}
const legalityBits = logLoss(evalRows, legality);
const cardBits = logLoss(evalRows, cardModel);
console.log(`\nTHE NUMBER THAT MATTERS: the card beats legality-only by `
  + `${(legalityBits - cardBits).toFixed(4)} bits/decision.`);
console.log(`Pre-registered falsifier: the villain layer beats the legality baseline by more than`);
console.log(`0.05 bits/decision held out. ${(legalityBits - cardBits) > 0.05 ? 'MET.' : 'NOT MET.'}`);
