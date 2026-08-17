#!/usr/bin/env node
/**
 * probeFrequency.mjs — WS-403. What does the engine DO facing aggression, against what the
 * pool does?
 *
 * The aggregate symptom this whole line of work is aimed at is a frequency, not an EV: the
 * engine raises facing aggression far more often than the population it is exploiting. This
 * scores that frequency on a bounded corpus slice and prints it next to the pool's own mix
 * and the action actually observed.
 *
 * ONE ARM PER RUN, PAIRED BY SEED. `Math.random` is re-seeded from a key derived from
 * (playerId, handId, order) before every engine call, so two runs of this script over the
 * same slice see the identical random stream at every decision and differ ONLY by the code
 * between them. That is what makes a before/after comparison a paired one across two
 * processes rather than a noisy one.
 *
 * WHAT THIS IS NOT. The pool mix is a POPULATION MARGINAL and the engine's mix is a
 * CONDITIONAL on the spots that arose — the engine is SUPPOSED to deviate from the pool, and
 * agreement with it is not the target. What the comparison detects is a deviation so large it
 * cannot be a read: raising ~9 times in 10 facing aggression is not an exploit of anything,
 * because no fold estimate that varies with the spot could recommend the same action almost
 * everywhere.
 *
 * Usage:
 *   node scripts/backtest/probeFrequency.mjs --label shipped --out out/ws403-shipped.json \
 *     [--max-files 300] [--max-players 300] [--max-decisions 130]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { openLoader } from './loader.mjs';

const REPO = process.cwd();
const realRandom = Math.random;

const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hash32 = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};

const parseArgs = (argv) => {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2); const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) a[k] = true; else { a[k] = n; i++; }
  }
  return a;
};
const int = (v, d) => (v === undefined ? d : Number.parseInt(v, 10));
const pct = (x) => `${(100 * x).toFixed(1)}%`;

const main = async () => {
  const args = parseArgs(process.argv);
  const label = typeof args.label === 'string' ? args.label : 'arm';
  const maxFiles = int(args['max-files'], 300);
  const maxPlayers = int(args['max-players'], 300);
  const maxDecisions = int(args['max-decisions'], 130);
  // DEPTH-1 BY DEFAULT, AND THAT IS A DECISION, NOT A SHORTCUT.
  //
  // 0 means "the depth-1 answer is the whole answer", which is the configuration that shipped
  // in production for the life of the project (WS-334 measured zero depth-2 calls on a live
  // evaluation) and is the path the depth-1 fold estimate under test actually lives on.
  //
  // THE "NON-REPRODUCIBLE" WARNING THAT USED TO BE HERE IS RETIRED (WS-482). It said
  // `refinementBudgetMs` is a WALL-CLOCK budget, so two arms run at different times are not
  // comparable. That was true before WS-432 and is not true now: the refinement gates read a
  // LOGICAL WORK METER (`gameTreeEvaluator.js` — "the budget is now a LOGICAL WORK-UNIT
  // budget, not a wall-clock one"), so a budget trips at the same point on every machine.
  // MEASURED, not merely re-read: two separate processes at `--refinement-ms 2000` over the
  // same 40 seeded decisions produced ZERO divergent rows (out/ws482-det-A.json vs
  // out/ws482-det-B.json). The comment was the last thing still asserting the old behaviour,
  // and it would have talked the next reader out of the only configuration that can measure
  // depth-2. Pass `--refinement-ms 2000` for the engine default; expect ~20x the runtime.
  const refinementBudgetMs = int(args['refinement-ms'], 0);
  const policyPath = typeof args['behavior-policy'] === 'string'
    ? args['behavior-policy'] : 'out/behavior-policy.json';
  const behaviorPolicy = JSON.parse(readFileSync(policyPath, 'utf8'));
  // WS-436 B2 — the styled-villain feed. Absent flags leave the run byte-identical
  // to the pre-feed harness (null-stats villains).
  const villainSource = typeof args['villain-source'] === 'string' ? args['villain-source'] : 'null';
  const villainFeedPath = typeof args['villain-feed'] === 'string' ? args['villain-feed'] : null;
  const villainFeed = villainFeedPath ? JSON.parse(readFileSync(villainFeedPath, 'utf8')) : null;
  if (villainSource !== 'null' && !villainFeed) {
    throw new Error(`--villain-source ${villainSource} requires --villain-feed <path> (build with build-villain-feed.mjs).`);
  }

  const loader = await openLoader(REPO);
  try {
    const { discoverCorpusFiles, applyFileCap, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { indexEvalPlayers } = await loader.load('/scripts/backtest/runner.mjs');
    const { heroPolicyAt } = await loader.load('/scripts/backtest/heroPolicy.mjs');
    const { queryPolicy, validateBehaviorPolicy } = await loader.load('/scripts/backtest/behaviorPolicy.mjs');
    const { decisionGeometry, sizeBucketFor } = await loader.load('/scripts/backtest/decisionGeometry.mjs');
    const { accumulateDecisions } = await loader.load('/src/utils/exploitEngine/decisionAccumulator.js');
    const { buildRangeProfile } = await loader.load('/src/utils/rangeEngine/index.js');

    const policy = validateBehaviorPolicy(behaviorPolicy, 50);

    let files = await discoverCorpusFiles({ root: DEFAULT_CORPUS_ROOT, stakes: ['50NLH'] });
    // WS-504: draws proportionally across directories; a sorted prefix read one site.
    ({ files } = applyFileCap(files, { maxFiles }));
    console.log(`corpus: ${files.length} file(s)`);

    const { byPlayer, handsRead } = await indexEvalPlayers({
      files, poolPct: 50, maxPlayers,
      onProgress: ({ handsRead: h, players }) => console.log(`  read ${h} hands, ${players} eval players`),
    });
    console.log(`  indexed ${byPlayer.size} EVAL players from ${handsRead} hands`);

    const rows = [];
    let stop = false;
    for (const [playerId, hands] of byPlayer) {
      if (stop) break;
      for (let cp = 200; cp < hands.length; cp += 50) {
        if (stop) break;
        const trainHands = hands.slice(0, cp);
        const testHands = hands.slice(cp, cp + 50);
        if (testHands.length === 0) break;
        let trainProfile;
        try { trainProfile = buildRangeProfile(playerId, trainHands, 'backtest'); } catch { continue; }
        if (!trainProfile) continue;

        const ctxs = [];
        try {
          accumulateDecisions(playerId, testHands, trainProfile, 'backtest', {
            onDecision: (c) => ctxs.push(c),
          });
        } catch { continue; }

        for (const ctx of ctxs) {
          if (stop) break;
          const geo = decisionGeometry(ctx.hand, ctx.order, ctx.street);
          if (!geo) continue;
          const key = `${playerId}|${ctx.hand.handId}|${ctx.order}`;
          Math.random = mulberry32(hash32(key));
          // eslint-disable-next-line no-await-in-loop -- the engine call is the cost
          const res = await heroPolicyAt({
            ctx, hand: ctx.hand, rakeConfig: null, refinementBudgetMs,
            villainFeed, villainSource,
          });
          Math.random = realRandom;
          if (!res.ok) continue;

          const pool = queryPolicy(policy, {
            facingAction: ctx.facingAction, isAgg: ctx.isAgg, isIP: ctx.isIP,
            texture: ctx.texture, street: ctx.street, posCategory: ctx.posCategory,
            sizeBucket: sizeBucketFor(geo.facingBetBB, geo.potBB),
          });

          rows.push({
            key, street: ctx.street, facingAction: ctx.facingAction,
            observed: ctx.action, piOurs: res.actions, piPool: pool.actions,
            villainFed: res.villainFed ?? false,
          });
          if (rows.length % 25 === 0) console.log(`  scored ${rows.length} decisions`);
          if (rows.length >= maxDecisions) { stop = true; }
        }
      }
    }

    // ── facing aggression: the mix ───────────────────────────────────────────
    const agg = rows.filter(r => r.facingAction === 'bet' || r.facingAction === 'raise');
    const mix = (pick) => {
      const acc = { fold: 0, call: 0, raise: 0 }; let n = 0;
      for (const r of agg) {
        const d = pick(r); if (!d) continue;
        acc.fold += d.fold ?? 0; acc.call += d.call ?? 0; acc.raise += d.raise ?? 0; n++;
      }
      return n ? { fold: acc.fold / n, call: acc.call / n, raise: acc.raise / n, n } : null;
    };
    const ours = mix(r => r.piOurs);
    const pool = mix(r => r.piPool);
    const obs = (() => {
      const acc = { fold: 0, call: 0, raise: 0 };
      for (const r of agg) if (acc[r.observed] !== undefined) acc[r.observed]++;
      const n = agg.length;
      return { fold: acc.fold / n, call: acc.call / n, raise: acc.raise / n, n };
    })();

    console.log(`\n=== FACING AGGRESSION (bet|raise), n=${agg.length} of ${rows.length} scored  [${label}] ===`);
    const line = (nm, m) => console.log(`  ${nm.padEnd(17)}: fold ${pct(m.fold)}  call ${pct(m.call)}  raise ${pct(m.raise)}`);
    if (ours) line(label, ours);
    if (pool) line('pool', pool);
    line('observed', obs);

    // ── ESS (self-normalised IPS, weight cap 20) ─────────────────────────────
    const ess = (subset) => {
      let sw = 0, sw2 = 0, n = 0;
      for (const r of subset) {
        const po = r.piOurs?.[r.observed]; const pp = r.piPool?.[r.observed];
        if (!Number.isFinite(po) || !Number.isFinite(pp) || pp <= 0) continue;
        const w = Math.min(po / pp, 20);
        sw += w; sw2 += w * w; n++;
      }
      return n && sw2 > 0 ? { n, ess: (sw * sw) / sw2 } : { n, ess: 0 };
    };
    console.log(`\n=== ESS (self-normalised IPS, weight cap 20)  [${label}] ===`);
    console.log('  slice        n     ESS    share');
    for (const [nm, sub] of [
      ['ALL', rows], ['flop', rows.filter(r => r.street === 'flop')],
      ['turn', rows.filter(r => r.street === 'turn')], ['river', rows.filter(r => r.street === 'river')],
      ['non-river', rows.filter(r => r.street !== 'river')],
    ]) {
      const e = ess(sub);
      console.log(`  ${nm.padEnd(10)} ${String(e.n).padStart(4)}   ${e.ess.toFixed(1).padStart(6)}   ${pct(e.n ? e.ess / e.n : 0).padStart(6)}`);
    }

    // WS-436 B2: feed coverage, printed unconditionally when a feed is in play. A run
    // whose fed fraction is ~0 is measuring the null arm and must say so.
    if (villainSource !== 'null') {
      const fed = rows.filter(r => r.villainFed).length;
      console.log(`\nVILLAIN FEED COVERAGE: ${fed}/${rows.length} decisions served from the feed (${pct(rows.length ? fed / rows.length : 0)})`);
    }

    if (typeof args.out === 'string') {
      writeFileSync(args.out, JSON.stringify({
        label, maxFiles, maxPlayers, maxDecisions,
        // WS-436 B2: the artifact is self-identifying about its villain arm, so two
        // runs being compared cannot silently differ on it.
        villainSource,
        villainFeed: villainFeed ? { path: villainFeedPath, builtFrom: villainFeed.builtFrom } : null,
        rows,
      }, null, 1));
      console.log(`\nWrote ${args.out}`);
    }
  } finally {
    Math.random = realRandom;
    await loader.close();
  }
};

main().catch((e) => { Math.random = realRandom; console.error(e); process.exit(1); });
