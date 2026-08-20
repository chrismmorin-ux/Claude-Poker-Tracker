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
import { reachOf, heroClass } from './heroReach.mjs';

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
console.log(`\nTHE NUMBER THAT MATTERS: the card beats the legality control by `
  + `${(legalityBits - cardBits).toFixed(4)} bits/decision.`);
console.log(`Pre-registered falsifier: the villain layer beats the legality control by more than`);
console.log(`0.05 bits/decision held out. ${(legalityBits - cardBits) > 0.05 ? 'MET.' : 'NOT MET.'}`);

/**
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHERE THE LIFT ACTUALLY IS.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The aggregate is a mean over every held-out decision, and a mean is exactly the wrong summary
 * for the question anyone has. A small average lift is compatible with two very different
 * worlds: the card knows a little about everything, or it knows a great deal about a handful of
 * spots and nothing about the rest. Only the second is worth acting on, and only the second
 * would let a modest average become a large edge in the spots actually played.
 *
 * So: per rule, the bits it saves against the legality control on the decisions it governs.
 * `bits/dec` is the lift where that rule applies. `share` is how much of the card's TOTAL
 * advantage that one rule accounts for — the concentration measure, and the one that decides
 * whether "the card is worth 0.07 bits" is the right way to describe it at all.
 */
const perRule = new Map();
evalRows.forEach((d, i) => {
  const ri = index[i];
  if (ri < 0) return;
  const t = ruleTallies[ri];
  const c = legality(d);
  const pOf = (tally) => {
    const total = ACTIONS.reduce((s, a) => s + (tally.get(a) || 0) + ALPHA, 0);
    return ((tally.get(d.action) || 0) + ALPHA) / total;
  };
  const saved = -Math.log2(pOf(c)) - (-Math.log2(pOf(t)));
  if (!perRule.has(ri)) perRule.set(ri, { n: 0, saved: 0 });
  const e = perRule.get(ri);
  e.n++; e.saved += saved;
});

const totalSaved = [...perRule.values()].reduce((s, e) => s + e.saved, 0);
const ranked = [...perRule.entries()]
  .map(([ri, e]) => ({ ri, n: e.n, perDec: e.saved / e.n, total: e.saved,
    share: e.saved / totalSaved, when: rules[ri].conds.map((c) => c.value).join(' AND ') || 'everything else' }))
  .sort((a, b) => b.total - a.total);

console.log(`\nPER-RULE LIFT over the legality control, on held-out decisions`);
console.log(`   n   bits/dec   total   share  spot`);
for (const r of ranked) {
  console.log(`${String(r.n).padStart(5)}  ${r.perDec.toFixed(3).padStart(8)}  `
    + `${r.total.toFixed(1).padStart(6)}  ${(100 * r.share).toFixed(1).padStart(5)}%  ${r.when.slice(0, 72)}`);
}
/**
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * LIFT x REACH — the spots hero can actually put himself in.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * A ranked list of the spots where the card knows the most is a list of places hero might
 * happen to end up. Crossed with who CHOSE each condition, the same list becomes places he can
 * decide to be. A rule whose conditions are all dealt — his seat, the board, the stacks — is
 * intelligence and not a plan; a rule with a lever is a spot hero manufactures by betting, and
 * by choosing the size.
 *
 * The product of the two is the target list this whole instrument exists to produce.
 */
console.log(`\nLIFT x REACH — who chose the conditions`);
console.log(`  bits/dec     n  reach   levers`);
for (const r of ranked.filter((x) => x.perDec > 0).slice(0, 8)) {
  const { reach, levers } = reachOf(rules[r.ri].predicate);
  console.log(`  ${r.perDec.toFixed(3).padStart(7)} ${String(r.n).padStart(5)}  ${reach.padEnd(7)}`
    + ` ${levers.join(', ') || '(none — the deal put him here)'}`);
}
const byReach = { lever: 0, shaped: 0, given: 0 };
for (const r of ranked) {
  if (r.total <= 0) continue;
  byReach[reachOf(rules[r.ri].predicate).reach] += r.total;
}
const totalPos = Object.values(byReach).reduce((s, v) => s + v, 0);
console.log(`\nshare of the card's advantage sitting in spots hero can CREATE:`);
for (const k of ['lever', 'shaped', 'given']) {
  console.log(`  ${k.padEnd(7)} ${(100 * byReach[k] / totalPos).toFixed(1).padStart(5)}%`);
}

/**
 * WAITING COST — and why the line above does not discriminate on its own.
 *
 * `facing` is the induction's dominant split, so it sits on nearly every path, and since hero
 * chooses it nearly every rule comes back `lever`. That is a true statement about the game —
 * whether pressure arrives is hero's decision and it is the gateway to almost every spot — and
 * it is useless for RANKING spots, because it does not vary.
 *
 * What varies, and what a player actually pays, is how many conditions he must WAIT for. A spot
 * whose other conditions are all lever or shaped can be manufactured at will: bet, and you are
 * in it. A spot that also demands a particular board, a particular seat and a particular stack
 * depth is one hero can only take when the deal offers it. Same lift, very different frequency
 * of use — and expected value is lift TIMES how often you can get there.
 */
console.log(`\nWAITING COST — conditions hero must be dealt before a spot is available`);
console.log(`  bits/dec     n  given  must wait for`);
for (const r of ranked.filter((x) => x.perDec > 0).slice(0, 8)) {
  const preds = rules[r.ri].predicate || [];
  const givens = preds.filter((c) => heroClass(c.feature) === 'given').map((c) => c.feature);
  console.log(`  ${r.perDec.toFixed(3).padStart(7)} ${String(r.n).padStart(5)}  ${String(givens.length).padStart(5)}`
    + `  ${givens.join(', ') || 'nothing — hero can create this spot at will'}`);
}

const top3 = ranked.slice(0, 3).reduce((s, r) => s + r.share, 0);
const helping = ranked.filter((r) => r.perDec > 0);
const hurting = ranked.filter((r) => r.perDec < 0);
console.log(`\nconcentration: the top 3 rules carry ${(100 * top3).toFixed(0)}% of the card's total advantage`);
console.log(`${helping.length} rules beat the control where they apply, ${hurting.length} do WORSE than it`);
if (hurting.length) {
  console.log(`worst: ${hurting[hurting.length - 1].perDec.toFixed(3)} bits/dec over `
    + `${hurting[hurting.length - 1].n} decisions — ${hurting[hurting.length - 1].when.slice(0, 60)}`);
}
