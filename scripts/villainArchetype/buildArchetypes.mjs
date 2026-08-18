/**
 * buildArchetypes — the incremental process, run for real.
 *
 * "Take one specific villain, list each action, then label it. Then you find the ruleset
 * that minimally fits. Then you add another villain, see the overlap, and note it, and
 * either make them a new archetype, a sub-archetype, or they are different enough they need
 * a new ruleset, and you build it."
 *
 * That is this file, literally. Villains are added ONE AT A TIME, in order, and each one is
 * tested against every archetype that exists so far:
 *
 *   follows every rule                  -> joins the archetype; its (mu, sigma) are refitted
 *   diverges on exactly one rule        -> SUB-ARCHETYPE, named by the rule it diverges on
 *   diverges on two or more rules       -> a new archetype, built from that villain
 *
 * The one-rule case is the interesting one and is why it gets its own branch: it is the
 * founder's "20% of this archetype will mix limping with AA and AK" — the same player in
 * every respect but one, which is a subtype rather than a stranger.
 *
 * WHY MEMBERSHIP IS A Z-TEST AND NOT A BAND. An archetype carries a behavioural sigma per
 * rule. A villain belongs if their observed rate sits within 1.96 sd of the archetype mean,
 * where sd combines the archetype's behavioural width with THIS villain's sampling error.
 * A thin villain therefore joins easily (they are not evidence against anything) and a
 * heavily-sampled villain must genuinely match. An absolute percentage band would do neither.
 *
 * SEEDING, and its known bias: the first villain in the order founds the first archetype, so
 * the ordering is load-bearing. Villains are processed most-hands-first so the founding
 * members are the best-measured ones. A shuffled-order control is the falsifier for whether
 * the archetypes are real or an artefact of that ordering; it is reported, not assumed.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';
import {
  CONTEXTS, fitContexts, fitPriceThreshold, revealedComposition,
  behaviouralSigma, followsRule, samplingVar, pct,
} from './ruleFitter.mjs';

const MAX_FILES = Number(process.env.MAX_FILES || 120);
const MIN_HANDS = Number(process.env.MIN_HANDS || 150);
const MAX_VILLAINS = Number(process.env.MAX_VILLAINS || 120);
const MIN_N_RULE = Number(process.env.MIN_N_RULE || 12);
const SHUFFLE = process.env.SHUFFLE === '1';

const root = resolveCorpusRoot();
const { files, selection } = selectCorpusFiles(await discoverCorpusFiles({ root }), { maxFiles: MAX_FILES });
console.log('corpus:', JSON.stringify(selection.realised.perDirectory));

// ── gather every villain's labelled decisions ────────────────────────────────
const byPid = new Map();
let hands = 0;
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    hands++;
    for (const [seat, pid] of Object.entries(h.seatPlayers || {})) {
      const ds = labelDecisions(h, seat);
      if (!ds.length) continue;
      if (!byPid.has(pid)) byPid.set(pid, { pid, hands: 0, decisions: [] });
      const v = byPid.get(pid);
      v.hands++;
      v.decisions.push(...ds);
    }
  }
}
let villains = [...byPid.values()].filter(v => v.hands >= MIN_HANDS)
  .sort((a, b) => b.hands - a.hands).slice(0, MAX_VILLAINS);
if (SHUFFLE) {
  for (let i = villains.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0; [villains[i], villains[j]] = [villains[j], villains[i]];
  }
}
console.log(`${hands} hands | ${byPid.size} villains seen | ${villains.length} with >= ${MIN_HANDS} hands\n`);

for (const v of villains) {
  v.obs = fitContexts(v.decisions);
  v.price = fitPriceThreshold(v.decisions);
  v.pricePF = fitPriceThreshold(v.decisions, { street: 'preflop' });
  v.revealed = revealedComposition(v.decisions);
}

// Rules only count where the villain has enough of that situation to have shown a habit.
const testable = (v, cid) => v.obs[cid] && v.obs[cid].n >= MIN_N_RULE;

// ── the incremental build ────────────────────────────────────────────────────
const archetypes = [];
const log = [];

const refit = (a) => {
  a.rules = {};
  for (const c of CONTEXTS) {
    const members = a.members.filter(v => testable(v, c.id)).map(v => v.obs[c.id]);
    if (members.length === 0) continue;
    if (members.length === 1) {
      const m = members[0];
      // A founding member has no behavioural spread yet; seed sigma from its own sampling
      // error so the archetype starts appropriately permissive instead of infinitely strict.
      a.rules[c.id] = { mu: m.k / m.n, sigma: Math.sqrt(samplingVar(m.k, m.n)), n: 1 };
    } else {
      const fit = behaviouralSigma(members);
      a.rules[c.id] = { mu: fit.mu, sigma: fit.sigma, n: members.length };
    }
  }
};

for (const v of villains) {
  let placed = null;
  let bestDiverge = null;

  for (const a of archetypes) {
    const shared = CONTEXTS.filter(c => a.rules[c.id] && testable(v, c.id));
    if (shared.length < 4) continue;               // too little overlap to judge
    const diverged = shared.filter(c => followsRule(v.obs[c.id], a.rules[c.id]).verdict === 'diverges');
    if (diverged.length === 0) { placed = { a, kind: 'member', diverged }; break; }
    if (!bestDiverge || diverged.length < bestDiverge.diverged.length) bestDiverge = { a, diverged };
  }

  if (!placed && bestDiverge && bestDiverge.diverged.length === 1) {
    placed = { a: bestDiverge.a, kind: 'sub', diverged: bestDiverge.diverged };
  }

  if (placed) {
    placed.a.members.push(v);
    if (placed.kind === 'sub') {
      const rid = placed.diverged[0].id;
      placed.a.subs[rid] = placed.a.subs[rid] || [];
      placed.a.subs[rid].push(v);
    }
    refit(placed.a);
    log.push({ pid: v.pid, hands: v.hands, outcome: placed.kind,
      archetype: placed.a.id, on: placed.diverged.map(c => c.id) });
  } else {
    const a = { id: `A${archetypes.length + 1}`, members: [v], subs: {}, rules: {} };
    refit(a);
    archetypes.push(a);
    log.push({ pid: v.pid, hands: v.hands, outcome: 'new-archetype', archetype: a.id,
      on: bestDiverge ? bestDiverge.diverged.map(c => c.id) : [] });
  }
}

// ── coverage: what fraction of villains does each archetype actually claim? ──
const total = villains.length;
archetypes.sort((a, b) => b.members.length - a.members.length);

console.log('='.repeat(100));
console.log('ARCHETYPES  — built one villain at a time, membership at 95% confidence');
console.log('='.repeat(100));

for (const a of archetypes) {
  const share = a.members.length / total;
  console.log(`\n${a.id} — ${a.members.length} of ${total} villains (${pct(share)})`);
  console.log('-'.repeat(100));
  for (const c of CONTEXTS) {
    const r = a.rules[c.id];
    if (!r || r.n < 2) continue;
    const spread = r.sigma > 0 ? ` (sd ${(r.sigma * 100).toFixed(1)}pp)` : ' (no spread)';
    console.log(`   ${c.firstPerson(r.mu)}${spread}   [${r.n} villains]`);
  }
  const subs = Object.entries(a.subs).filter(([, m]) => m.length > 0);
  if (subs.length) {
    console.log('   SUB-TYPES — same player in every respect but one:');
    for (const [rid, mem] of subs.sort((x, y) => y[1].length - x[1].length)) {
      const c = CONTEXTS.find(cc => cc.id === rid);
      const rates = mem.filter(v => testable(v, rid)).map(v => v.obs[rid].k / v.obs[rid].n);
      const mu = rates.reduce((s, r) => s + r, 0) / (rates.length || 1);
      console.log(`     - ${pct(mem.length / a.members.length)} of this archetype diverge on "${c.question}"`
        + ` — they run ${pct(mu)} where the archetype runs ${pct(a.rules[rid]?.mu ?? NaN)}`);
    }
  }
}

// ── the price threshold, per archetype: the rule a rate cannot express ───────
console.log('\n' + '='.repeat(100));
console.log('PRICE THRESHOLDS — where each archetype stops calling');
console.log('='.repeat(100));
for (const a of archetypes) {
  const agg = {};
  for (const v of a.members) {
    for (const b of v.price.bands) {
      agg[b.id] = agg[b.id] || { k: 0, n: 0, label: b.label };
      agg[b.id].k += b.k; agg[b.id].n += b.n;
    }
  }
  const parts = Object.entries(agg).filter(([, x]) => x.n >= 20)
    .map(([, x]) => `${x.label}: continue ${pct(x.k / x.n)} (n=${x.n})`);
  console.log(`\n${a.id} (${a.members.length} villains)`);
  for (const p of parts) console.log('   ' + p);
}

mkdirSync('.tmp-arch', { recursive: true });
writeFileSync('.tmp-arch/archetypes.json', JSON.stringify({
  hands, villains: total, minHands: MIN_HANDS, shuffled: SHUFFLE,
  archetypes: archetypes.map(a => ({
    id: a.id, members: a.members.length, share: a.members.length / total,
    rules: a.rules,
    subs: Object.fromEntries(Object.entries(a.subs).map(([k, m]) => [k, m.length])),
    memberPids: a.members.map(m => m.pid),
  })), log,
}, null, 1));
console.log('\nwrote .tmp-arch/archetypes.json');
