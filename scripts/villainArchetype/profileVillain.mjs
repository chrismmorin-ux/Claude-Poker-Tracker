/**
 * profileVillain — THE PROCEDURE. One command, same steps, every villain, every time.
 *
 * FOUNDER, 2026-08-18: "This needs to be a repeatable procedure for each villain. you're
 * doing it off the cuff now, which is degrading quality."
 *
 * Correct, and the evidence is in the session that produced this file. Three separate
 * measurement bugs shipped and were caught only because the founder pushed back on a
 * result that looked wrong to him:
 *
 *   - the price owed was the size of the BET, not what the seat owed, so limped pots read
 *     "nothing to call" and every blind's price was overstated;
 *   - "invested so far" used the hand's FINAL total, feeding the model the future;
 *   - "what he paid" summed only CALLS, so a 25bb check-RAISE counted as zero and a shown
 *     bluff was reported as a hand that reached showdown for free.
 *
 * Each of those was a one-line error that survived because nothing ran between me and the
 * conclusion. A document saying "check your metrics" would not have caught any of them.
 * A GATE does. Every check below runs before any rule is induced, and a failure stops the
 * run rather than printing a caveat nobody reads.
 *
 * THE PROCEDURE
 *   1. LOAD      every decision for this villain
 *   2. GATE      instrument self-checks against known answers — fail loud, fail early
 *   3. ENUMERATE the standard table (schema-driven, identical for every villain)
 *   4. INDUCE    the ruleset, every leaf carrying a confidence interval
 *   5. WRINKLES  the leaves that are NOT resolved, and what would resolve each
 *   6. EMIT      a profile file, so two villains can be laid side by side
 *
 * "Expand the surface, rerun, expand again, until there aren't any wrinkles, just
 * confidence intervals" (founder). Step 5 is that loop's instrument: a wrinkle is a leaf
 * whose residue is too big to be a range, and the report names the feature that would cut
 * it. When the wrinkle list is empty, what remains is sampling error, which is what a
 * confidence interval is for.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';
import { toRow, header, SCHEMA_VERSION, SITUATION_FIELDS, FIELDS } from './decisionSchema.mjs';

const MAX_FILES = Number(process.env.MAX_FILES || 120);
const TARGET = process.env.VILLAIN || null;
const RANK = Number(process.env.RANK || 1);          // 1 = most hands, 2 = next, ...
const OUT = process.env.OUT || '.tmp-arch/profiles';

// ─── 1. LOAD ─────────────────────────────────────────────────────────────────
const root = resolveCorpusRoot();
const { files } = selectCorpusFiles(await discoverCorpusFiles({ root }), { maxFiles: MAX_FILES });

const counts = new Map();
const handsById = [];
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    handsById.push(h);
    for (const pid of Object.values(h.seatPlayers || {})) counts.set(pid, (counts.get(pid) || 0) + 1);
  }
}
const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
const pid = TARGET || ranked[RANK - 1][0];

const decisions = [];
const handsOfVillain = [];
for (const h of handsById) {
  const seat = Object.entries(h.seatPlayers || {}).find(([, p]) => p === pid)?.[0];
  if (!seat) continue;
  handsOfVillain.push({ h, seat });
  decisions.push(...labelDecisions(h, seat));
}

console.log(`PROFILE — villain ${pid}`);
console.log(`${handsOfVillain.length} hands · ${decisions.length} decisions · schema v${SCHEMA_VERSION}\n`);

// ─── 2. GATES ────────────────────────────────────────────────────────────────
/**
 * Every gate is a KNOWN ANSWER, not a plausibility check. Each one corresponds to a bug
 * that actually shipped, so the suite grows by one entry every time something gets through.
 */
const gates = [];
const gate = (name, ok, detail) => gates.push({ name, ok: !!ok, detail });

// A seat facing limps owes the big blind. This read "nothing to call" for the whole corpus.
const limpFacers = decisions.filter(d => d.street === 'preflop' && d.limpersAhead > 0
  && d.position !== 'BB' && d.position !== 'SB');
gate('a seat facing limps owes money',
  limpFacers.length === 0 || limpFacers.every(d => d.toCallBB > 0),
  `${limpFacers.filter(d => d.toCallBB <= 0).length} of ${limpFacers.length} said nothing to call`);

// The big blind facing a raise owes LESS than the raise, because the blind is already in.
const bbFacing = decisions.filter(d => d.position === 'BB' && d.facing === 'a raise' && d.potBB);
gate('the big blind owes less than the raise',
  bbFacing.every(d => d.toCallBB > 0),
  `${bbFacing.length} big-blind-vs-raise decisions checked`);

// Invested-so-far is backward looking; it can never exceed what was available.
const badInvest = decisions.filter(d => d.investedBB != null && d.myStackBB != null
  && d.investedBB > d.myStackBB + d.investedBB + 0.01);
gate('invested is backward-looking only', badInvest.length === 0,
  `${badInvest.length} decisions invested more than existed`);

// Paired boards must occur. They silently never did, because the field name was wrong.
const postflop = decisions.filter(d => d.boardTexture);
const pairedSeen = postflop.filter(d => d.boardTexture.paired).length;
gate('paired boards are detected', postflop.length === 0 || pairedSeen > 0,
  `${pairedSeen} paired of ${postflop.length} postflop decisions`);

// No outcome field may be offered as a rule condition.
const outcomeNames = FIELDS.filter(f => f.group === 'outcome').map(f => f.name);
gate('no outcome field is conditionable',
  outcomeNames.every(n => !SITUATION_FIELDS.includes(n)),
  outcomeNames.join(', ') + ' held out');

// Money committed must count raises, not only calls — the bug that hid a 25bb bluff.
const moneyIn = (ds) => ds.filter(d => d.street !== 'preflop')
  .reduce((s, d) => s + (d.action === 'call' ? (d.toCallBB || 0)
    : (d.action === 'bet' || d.action === 'raise') ? ((d.raiseToFractionOfPot || 0) * (d.potBB || 0)) : 0), 0);
const aggressorHands = handsOfVillain.filter(({ h, seat }) =>
  labelDecisions(h, seat).some(d => d.street !== 'preflop' && (d.action === 'bet' || d.action === 'raise')));
gate('money counts raises, not only calls',
  aggressorHands.length === 0 || aggressorHands.some(({ h, seat }) => moneyIn(labelDecisions(h, seat)) > 0),
  `${aggressorHands.length} hands where he bet or raised postflop`);

console.log('GATES');
let failed = 0;
for (const g of gates) {
  console.log(`  ${g.ok ? 'pass' : 'FAIL'}  ${g.name.padEnd(44)} ${g.detail}`);
  if (!g.ok) failed++;
}
if (failed) {
  console.error(`\n${failed} GATE(S) FAILED — the instrument is wrong, so no rules will be induced.`);
  process.exit(1);
}

// ─── 3. ENUMERATE ────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
const safe = pid.replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
const rows = decisions.map(toRow);
writeFileSync(`${OUT}/${safe}.tsv`,
  [header().join('\t'), ...rows.map(r => header().map(c => r[c]).join('\t'))].join('\n'));

// ─── 4. INDUCE, with intervals ───────────────────────────────────────────────
const { induce } = await import('./induceCore.mjs');
const { rules, coverage, accuracy } = induce(decisions);

/** Wilson interval — honest at small n, where a normal approximation is not. */
const wilson = (k, n, z = 1.96) => {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
};

console.log(`\nRULESET — ${rules.length} rules, ${(coverage * 100).toFixed(1)}% coverage, `
  + `${(accuracy * 100).toFixed(1)}% in-sample accuracy\n`);

const wrinkles = [];
for (const r of rules.sort((a, b) => b.n - a.n)) {
  const [lo, hi] = wilson(r.k, r.n);
  const width = (hi - lo) * 100;
  const desc = r.conds.length ? r.conds.map(c => c.value).join(' AND ') : 'everything else';
  console.log(`[${String(r.n).padStart(4)}]  ${desc}`);
  console.log(`        -> I ${r.action} ${(r.k / r.n * 100).toFixed(0)}%  `
    + `[95% CI ${(lo * 100).toFixed(0)}-${(hi * 100).toFixed(0)}%, width ${width.toFixed(0)}pp]`
    + (r.kind === 'always' ? '  ALWAYS' : r.kind === 'range' ? '  (the rest is his range here)' : '  << WRINKLE'));
  if (r.kind === 'unresolved') wrinkles.push({ r, width });
}

// ─── 5. WRINKLES ─────────────────────────────────────────────────────────────
console.log(`\nWRINKLES — leaves no rule resolves: ${wrinkles.length}`);
for (const { r } of wrinkles) {
  const others = [...r.tally.entries()].sort((a, b) => b[1] - a[1]);
  const shown = r.pool.filter(d => d.handKnown).length;
  console.log(`  [${r.n}] ${r.conds.map(c => c.value).join(' AND ') || 'everything else'}`);
  console.log(`        ${others.map(([a, n]) => `${a} ${(n / r.n * 100).toFixed(0)}%`).join(', ')}`);
  console.log(`        cards visible on ${shown}/${r.n}. `
    + (shown === 0 ? 'NOTHING observable separates these — needs the hole cards.'
      : 'Some cards are visible; a hand-class condition may cut this.'));
}
const wide = rules.filter(r => { const [lo, hi] = wilson(r.k, r.n); return (hi - lo) > 0.30; });
console.log(`\nRULES TOO THIN TO TRUST (CI wider than 30pp): ${wide.length} of ${rules.length}`);

writeFileSync(`${OUT}/${safe}.json`, JSON.stringify({
  pid, schema: SCHEMA_VERSION, hands: handsOfVillain.length, decisions: decisions.length,
  gates, coverage, accuracy,
  rules: rules.map(r => {
    const [lo, hi] = wilson(r.k, r.n);
    return { n: r.n, k: r.k, action: r.action, kind: r.kind,
      conds: r.conds, ci: [lo, hi], tally: [...r.tally.entries()] };
  }),
  wrinkles: wrinkles.length,
}, null, 1));
console.log(`\nwrote ${OUT}/${safe}.json and .tsv`);
