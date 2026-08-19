/**
 * ruleCountVsN — how much of a villain's rule count is the villain, and how much is his n?
 *
 * WHY THIS EXISTS. Villain 1 (3,386 decisions) induces 18 rules with 8% of decisions
 * unresolved. Villain A (20,413 decisions) induces 45 rules with 68% unresolved. Read
 * naively that says A is a far more complex player who we understand far less well. Both
 * halves of that reading are suspect for the same reason: every gate in the induction is a
 * SIGNIFICANCE test, and significance is a function of sample size.
 *
 *   - A split must clear a Bonferroni-corrected G-test. More rows, more power, more splits
 *     survive - on identical behaviour.
 *   - `hidden-cond` means "a feature DOES separate this leaf, blocked only by the min-n
 *     floor". Detecting that separation is itself a test. With few rows the classifier cannot
 *     see it and returns `mix`, which reads as RESOLVED. So unresolved counts can RISE with
 *     more data while understanding improves.
 *
 * Rule count is the compression measure this project scores on, and comparing it across
 * villains with different n would be comparing sample sizes wearing player names. That is the
 * same class of error as the pooled `HJ` label: the number is real, the thing it denotes is
 * not what it appears to be.
 *
 * SO THE CURVE IS THE INSTRUMENT. Induce at a ladder of subsample sizes, several seeds each,
 * and report rule count and unresolved share as functions of n. Two villains are comparable
 * only at a shared n, and the curve says which n that is - and whether it has flattened, i.e.
 * whether more corpus would still be buying structure.
 *
 * Run:  VILLAIN=<id> node scripts/villainArchetype/ruleCountVsN.mjs
 */
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';
import { induce } from './induceCore.mjs';

const MAX_FILES = Number(process.env.MAX_FILES || 2000);
const TARGET = process.env.VILLAIN || null;
const RANK = Number(process.env.RANK || 1);
const SEEDS = Number(process.env.SEEDS || 3);

/**
 * Seeded PRNG (mulberry32). Not Math.random: a curve that cannot be reproduced is not a
 * control, and this one is meant to be re-run and compared against.
 */
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * Subsample BY HAND, never by decision.
 *
 * Decisions within one hand are not independent - the same holding drives every street - so
 * sampling decisions would break the correlation structure and make small-n runs look cleaner
 * than a genuinely smaller corpus ever would. That would bias the curve in exactly the
 * direction that flatters the conclusion being tested.
 */
const subsampleHands = (byHand, targetDecisions, rand) => {
  const ids = [...byHand.keys()];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const out = [];
  for (const id of ids) {
    if (out.length >= targetDecisions) break;
    out.push(...byHand.get(id));
  }
  return out;
};

const root = resolveCorpusRoot();
const { files } = selectCorpusFiles(await discoverCorpusFiles({ root }), { maxFiles: MAX_FILES });

let pid = TARGET;
if (!pid) {
  const counts = new Map();
  for (const f of files) for await (const h of iterAppHands(f.path)) {
    for (const p of Object.values(h.seatPlayers || {})) counts.set(p, (counts.get(p) || 0) + 1);
  }
  pid = [...counts.entries()].sort((a, b) => b[1] - a[1])[RANK - 1][0];
}
const byHand = new Map();
let total = 0;
for (const f of files) for await (const h of iterAppHands(f.path)) {
  const seat = Object.entries(h.seatPlayers || {}).find(([, p]) => p === pid)?.[0];
  if (!seat) continue;
  const ds = labelDecisions(h, seat);
  if (!ds.length) continue;
  byHand.set(h.handId ?? `${byHand.size}`, ds);
  total += ds.length;
}

console.log(`villain ${pid}`);
console.log(`${byHand.size} hands, ${total} decisions, ${SEEDS} seeds per rung\n`);

const RUNGS = [1000, 2000, 3386, 5000, 10000, 20000].filter((n) => n <= total).concat([total]);
console.log('       n   rules            unresolved rules      unresolved decisions   accuracy');
for (const n of [...new Set(RUNGS)]) {
  const rules = []; const unresRules = []; const unresDec = []; const accs = [];
  for (let s = 0; s < (n === total ? 1 : SEEDS); s++) {
    const sub = n === total ? [...byHand.values()].flat() : subsampleHands(byHand, n, rng(s + 1));
    const res = induce(sub);
    const leaves = res.rules ?? res.leaves ?? [];
    const unres = leaves.filter((r) => r.verdict && r.verdict !== 'mix' && r.verdict !== 'always');
    rules.push(leaves.length);
    unresRules.push(unres.length);
    unresDec.push(unres.reduce((a, r) => a + r.n, 0) / sub.length);
    accs.push(res.accuracy ?? 0);
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rng2 = (a) => (a.length > 1 ? ` (${Math.min(...a)}-${Math.max(...a)})` : '');
  console.log(
    `${String(n).padStart(8)}   ${mean(rules).toFixed(1).padStart(5)}${rng2(rules).padEnd(11)}`
    + `${mean(unresRules).toFixed(1).padStart(8)}${rng2(unresRules).padEnd(13)}`
    + `${(100 * mean(unresDec)).toFixed(1).padStart(12)}%`
    + `${(100 * mean(accs)).toFixed(1).padStart(15)}%`,
  );
}
