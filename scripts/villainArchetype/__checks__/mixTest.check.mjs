/**
 * Known-answer checks for mixTest. Every assertion below has an answer that exists
 * independently of this code - a textbook chi-square critical value, or a table so
 * degenerate the verdict is not a matter of opinion. That is the gate discipline the
 * procedure already uses: a plausibility check would not have caught any of the four
 * bugs that shipped.
 */
import { chiSqP, gTest, wilson, classifyLeaf } from '../mixTest.mjs';

let failed = 0;
const near = (name, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failed++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${name.padEnd(52)} got ${got} want ~${want}`);
};
const is = (name, got, want) => {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${name.padEnd(52)} got ${got} want ${want}`);
};

console.log('chi-square upper tail against textbook critical values');
near('chiSqP(3.841, 1)  = 0.05', +chiSqP(3.841, 1).toFixed(4), 0.05, 0.001);
near('chiSqP(5.991, 2)  = 0.05', +chiSqP(5.991, 2).toFixed(4), 0.05, 0.001);
near('chiSqP(7.815, 3)  = 0.05', +chiSqP(7.815, 3).toFixed(4), 0.05, 0.001);
near('chiSqP(6.635, 1)  = 0.01', +chiSqP(6.635, 1).toFixed(4), 0.01, 0.001);
near('chiSqP(10.828, 1) = 0.001', +chiSqP(10.828, 1).toFixed(5), 0.001, 0.0002);
near('chiSqP(0, 1)      = 1', chiSqP(0, 1), 1, 1e-12);
is('chiSqP with df 0 is 1 (no test to run)', chiSqP(9, 0), 1);

console.log('\nG-test on tables whose answer is not a matter of opinion');
{ // perfect dependence: feature a always folds, feature b always calls
  const pairs = [];
  for (let i = 0; i < 50; i++) { pairs.push(['a', 'fold']); pairs.push(['b', 'call']); }
  const t = gTest(pairs);
  console.log(`  perfect dependence n=100 -> G=${t.G.toFixed(1)} df=${t.df} p=${t.p.toExponential(2)}`);
  if (!(t.p < 1e-10)) { failed++; console.log('  FAIL  perfect dependence must be overwhelming'); }
  else console.log('  pass  perfect dependence is overwhelming');
}
{ // exact independence: every cell equals its expectation, so G must be exactly 0
  const pairs = [];
  for (const f of ['a', 'b']) for (const act of ['fold', 'call'])
    for (let i = 0; i < 25; i++) pairs.push([f, act]);
  const t = gTest(pairs);
  near('exact independence gives G = 0', +t.G.toFixed(10), 0, 1e-9);
  near('exact independence gives p = 1', +t.p.toFixed(6), 1, 1e-6);
}
{ // one column only: there is nothing to be dependent ON
  const t = gTest([['a', 'fold'], ['b', 'fold'], ['a', 'fold']]);
  is('single action column yields df 0', t.df, 0);
  is('single action column yields p 1', t.p, 1);
}

console.log('\nWilson interval against hand-computable anchors');
{
  const [lo, hi] = wilson(0, 10);
  is('k=0 of 10 has lower bound exactly 0', lo, 0);
  near('k=0 of 10 upper bound = 0.278', +hi.toFixed(3), 0.278, 0.002);
  const [lo2, hi2] = wilson(5, 10);
  near('k=5 of 10 is symmetric about 0.5', +((lo2 + hi2) / 2).toFixed(6), 0.5, 1e-6);
  const [lo3, hi3] = wilson(50, 100), [lo4, hi4] = wilson(500, 1000);
  if (!((hi4 - lo4) < (hi3 - lo3))) { failed++; console.log('  FAIL  interval must narrow with n'); }
  else console.log('  pass  interval narrows with n');
}

console.log('\nclassifyLeaf verdicts on constructed leaves');
const mk = (action, feat, cards) => ({ action, feat, handKnown: !!cards, holeCards: cards || [] });
const FEATS = { feat: (d) => d.feat, dead: () => 'same' };
{ // a leaf with a real hidden condition must NOT be called a mix
  const pool = [];
  for (let i = 0; i < 30; i++) pool.push(mk('bet', 'x'));
  for (let i = 0; i < 30; i++) pool.push(mk('check', 'y'));
  const c = classifyLeaf(pool, FEATS, new Set());
  is('feature-separated leaf -> hidden-cond', c.verdict, 'hidden-cond');
  is('  and it names the feature', c.separators[0].feature, 'feat');
}
{ // a genuine mix: the feature is independent of the action
  const pool = [];
  for (let i = 0; i < 60; i++) pool.push(mk(i % 2 ? 'bet' : 'check', i % 3 ? 'x' : 'y'));
  const c = classifyLeaf(pool, FEATS, new Set());
  is('feature-independent leaf -> mix', c.verdict, 'mix');
}
{ // pure leaf
  const pool = Array.from({ length: 20 }, (_, i) => mk('fold', i % 2 ? 'x' : 'y'));
  is('pure leaf -> always', classifyLeaf(pool, FEATS, new Set()).verdict, 'always');
}
{ // nothing observable separates, but the SHOWN cards do -> needs-cards
  const pool = [];
  for (let i = 0; i < 30; i++) pool.push(mk(i % 2 ? 'bet' : 'check', i % 3 ? 'x' : 'y'));
  for (let i = 0; i < 8; i++) pool.push(mk('bet', i % 3 ? 'x' : 'y', ['Ah', 'Ad']));
  for (let i = 0; i < 8; i++) pool.push(mk('check', i % 3 ? 'x' : 'y', ['7c', '2d']));
  const c = classifyLeaf(pool, FEATS, new Set());
  is('cards separate but features do not -> needs-cards', c.verdict, 'needs-cards');
}
{ // a feature already spent on the path must not be re-tested
  const pool = [];
  for (let i = 0; i < 30; i++) pool.push(mk('bet', 'x'));
  for (let i = 0; i < 30; i++) pool.push(mk('check', 'y'));
  const c = classifyLeaf(pool, FEATS, new Set(['feat']));
  is('used feature is excluded from the search', c.verdict, 'mix');
}

console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nall checks pass');
process.exit(failed ? 1 : 0);
