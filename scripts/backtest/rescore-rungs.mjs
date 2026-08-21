#!/usr/bin/env node
/**
 * rescore-rungs.mjs — WS-540 Phase 2. Score rungs against a PERSISTED decision set.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS BUYS, AND THE NUMBER IT RESTS ON
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `run-rule-ladder.mjs` walks the HandHQ corpus to PRODUCE decisions and then SCORES arms
 * over them in the same pass. Adding a rung therefore re-walks the corpus for a decision set
 * that is identical by construction — the arms must be paired on one set, so it could not
 * have been otherwise.
 *
 * Measured on a 1,498-decision slice (2026-08-21, out/ws540-step1-gate.json):
 *
 *     DECOUPLEABLE (corpus walk) 99.5%   arms 0.5%   of accounted time
 *     accumulate 19.0s of 25.7s wall
 *
 * So this script pays the 0.5% and skips the 99.5%. It reads no corpus file, builds no
 * range profile, and calls `accumulateDecisions` zero times.
 *
 * THAT SHARE WAS RE-MEASURED BEFORE THIS WAS WRITTEN, not taken from the ticket. It read
 * 0.9957 at 93 decisions, and had read 0.007 the previous morning before two perf fixes
 * landed. `run-rule-ladder.mjs`'s header keeps both refuted cost predictions for exactly
 * this reason: every cost claim about this pipeline that was reasoned about rather than
 * measured has been wrong, and each one aimed the next piece of work at the wrong term.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT MAKES THE ANSWER THE SAME ANSWER
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * A replay is only worth having if it is the SAME measurement, so three things are
 * structural rather than hoped for:
 *
 *   1. THE SET VERIFIES ITS OWN HASH as it streams (`readContextSet`). A truncated set
 *      would score fewer decisions and report a smaller edge without erroring.
 *   2. THE CTX REFUSES UNKNOWN FIELDS. `restoreDecisionContext` hands arms a Proxy that
 *      throws on any field the set does not carry, because the alternative — `undefined` —
 *      reads as "the rule did not fire" and is indistinguishable from a real null result.
 *   3. THE OUTPUT IS DIFFABLE against a live run. `--gate <live.json>` compares edges,
 *      paired deltas and coverage and exits non-zero on ANY divergence. That comparison is
 *      the falsifier for the whole decoupling and is pre-registered as such.
 *
 * ENGINE ARMS ARE OUT OF SCOPE HERE, deliberately and not silently. An engine arm is not a
 * pure function of the decision — it calls the game tree, which gates refinement on a clock
 * (WS-411) — so it cannot be replayed bit-identically from a decision set and is not made
 * to look as if it could. The ladder is engine-free by construction (FALLBACK_POOL), which
 * is exactly why it is the surface this works on.
 *
 * USAGE
 *   node scripts/backtest/rescore-rungs.mjs --context-set <set.jsonl> --out out/rescore.json
 *   node scripts/backtest/rescore-rungs.mjs --context-set <set.jsonl> --gate out/live.json
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';

const parseArgs = (argv) => {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) args[k] = true;
    else { args[k] = n; i++; }
  }
  return args;
};
const num = (v, d) => (v === undefined ? d : Number.parseFloat(v));
const bb = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '    n/a' : `${v >= 0 ? '+' : ''}${v.toFixed(4)}`);

/**
 * The n that would resolve a delta this run could not.
 *
 * `mdeDetectBB` is `Z_DETECT * sd` and `sd` falls as 1/sqrt(n), so reaching a target MDE
 * needs n scaled by the SQUARE of the ratio. Reported because "the interval straddles zero"
 * is not a finding on its own — WS-540's accept criterion is that a run which fails to
 * resolve a rung says what would.
 */
export const nToResolve = (n, mdeBB, targetBB) => {
  if (!Number.isFinite(n) || !Number.isFinite(mdeBB) || !Number.isFinite(targetBB) || targetBB <= 0) return null;
  if (mdeBB <= targetBB) return n;
  return Math.ceil(n * (mdeBB / targetBB) ** 2);
};

const main = async () => {
  const args = parseArgs(process.argv);
  const setPath = typeof args['context-set'] === 'string' ? args['context-set'] : null;
  if (!setPath) {
    console.error('rescore-rungs: --context-set <path> is required.');
    process.exit(2);
  }
  const loader = await openLoader(process.cwd());
  try {
    const { readContextSet, restoreDecisionContext, assertRangeRecovery } = await loader.load('/scripts/backtest/decisionContextSet.mjs');
    const { strategyPolicyAt, newCoverage, mergeCoverage, summarizeCoverage, fromStrategyCard } = await loader.load('/scripts/backtest/strategyArm.mjs');
    const { loadStrategyCard } = await loader.load('/src/utils/standardOfRecord/strategyCard.js');
    const { LADDER } = await loader.load('/scripts/backtest/ladder/rungs.card.js');
    const { sampleCombos } = await loader.load('/scripts/backtest/heroPolicy.mjs');
    const { estimateEdge } = await loader.load('/scripts/backtest/ipsEstimator.mjs');
    const { pairedDelta } = await loader.load('/scripts/backtest/depthAblationReport.mjs');

    // Through the REAL loader, exactly as the live ladder does: a rung that bypassed
    // validation would be scoring an object the Standard of Record would have rejected,
    // and its content hash is what names the version.
    const rungs = [];
    for (const card of LADDER) {
      // eslint-disable-next-line no-await-in-loop -- a handful of cards; clarity over overlap
      const loaded = await loadStrategyCard(card);
      rungs.push({
        id: card.cardId.replace(/^ladder-/, ''),
        cardId: card.cardId,
        title: card.title,
        ruleCount: card.rules.length,
        contentHash: loaded.contentHash,
        // `fallback: 'pool'` matches the ladder: the rule set ALONE, playing population
        // poker everywhere it abstains. `fallbackArmId` is null — there is no engine arm.
        arm: { id: card.cardId.replace(/^ladder-/, ''), strategy: fromStrategyCard(loaded, { sourceRef: `ladder:${card.cardId}` }), fallback: 'pool', fallbackArmId: null },
      });
    }

    console.log('\n═══ RUNG RESCORE — replayed from a persisted decision set ═══');
    for (const r of rungs) console.log(`  ${r.id.padEnd(24)} rules=${String(r.ruleCount).padStart(2)}  ${r.contentHash.slice(0, 17)}`);

    // ── COVERAGE IS ACCUMULATED PER PLAYER AND MERGED IN CANONICAL ORDER ───────────────
    // Mirroring `foldAll`: live keeps one coverage fragment PER PLAYER and merges them
    // sorted by `playerIndex`. Accumulating into a single running total in read order
    // instead would land `ruleFires` on a different float sum — measured as
    // 360.1000000000002 vs 360.10000000000036, which is exactly the kind of difference
    // that makes a replay "nearly" the same measurement and therefore not one.
    //
    // Sorting the rows themselves is not the fix: the set is written wave-by-wave and
    // `planned` is not ascending in `playerIndex` (18 backward steps across wave
    // boundaries in a 1,498-row set), so read order can never be canonical without holding
    // the whole set. Per-player fragments cost one small object per arm per player.
    const covByPlayer = new Map();
    const coverageFor = (p) => {
      let byArm = covByPlayer.get(p);
      if (!byArm) covByPlayer.set(p, (byArm = Object.fromEntries(rungs.map((r) => [r.id, newCoverage()]))));
      return byArm;
    };
    const decisions = [];
    const started = Date.now();
    let rangeChecks = 0;
    let rows = 0;

    for await (const row of readContextSet(setPath)) {
      rows += 1;
      const ctx = restoreDecisionContext(row);

      // The recovery claim, CHECKED rather than trusted: `rangeBefore` is rebuilt as
      // `holdingBelief(holding).range`. The set stores the range once, under `holding`.
      // Checked on a sample; a failure is fatal, never a warning.
      if (rows % 250 === 1 && row.holding) {
        const v = assertRangeRecovery({ rangeBefore: row.holding.range }, ctx);
        if (!v.ok) {
          console.error(`rescore-rungs: range recovery FAILED at row ${rows}:`, v.mismatches.slice(0, 3));
          process.exit(1);
        }
        rangeChecks += 1;
      }

      // The same per-decision memo the live path uses. `sampleCombos` is a pure function of
      // (range, board, k) — all three are decision properties, so every arm at this node
      // shares one array exactly as it does live.
      const comboMemo = new Map();
      const combosFor = (k) => {
        if (comboMemo.has(k)) return comboMemo.get(k);
        const range = ctx.rangeBefore;
        const board = ctx.board;
        const built = (!range || !board || board.length < 3) ? null : sampleCombos(range, board, k);
        comboMemo.set(k, built);
        return built;
      };

      // Per-decision accumulators, merged into the player's fragment only if EVERY arm
      // succeeds — the same rule the live path now applies, and for the same reason: an
      // arm scored before a later arm's failure must not keep a denominator entry for a
      // decision that never entered the contrast.
      const pending = Object.fromEntries(rungs.map((r) => [r.id, newCoverage()]));
      const byArm = {};
      let armFailure = null;
      for (const r of rungs) {
        const res = strategyPolicyAt({
          arm: r.arm,
          ctx,
          hand: ctx.hand,
          geo: row.geometry,
          // No engine arm exists in an engine-free ladder; the fallback is the pool.
          engineActions: null,
          poolActions: row.pool?.actions ?? null,
          coverage: pending[r.id],
          combosFor,
        });
        if (!res.ok) { armFailure = { arm: r.id, reason: res.reason }; break; }
        byArm[r.id] = res;
      }
      // A decision survives only if EVERY arm produced a policy — the live path's rule. A
      // skip pattern that correlates with a rung must not enter the contrast.
      if (armFailure) continue;
      {
        const byArmCov = coverageFor(row.stable.p);
        for (const r of rungs) mergeCoverage(byArmCov[r.id], pending[r.id]);
      }

      decisions.push({
        playerId: row.playerId,
        handId: row.handId,
        order: row.order,
        stable: row.stable,
        observedAction: row.observedAction,
        netBB: row.netBB,
        piPool: row.pool?.actions ?? null,
        piOursByArm: Object.fromEntries(rungs.map((r) => [r.id, byArm[r.id].actions])),
      });
    }

    const runtimeMs = Date.now() - started;
    const weightCap = num(args['weight-cap'], 20);

    // ── CANONICAL ORDER, and the gate is what found this ─────────────────────────────────
    // The set is written in TASK-COMPLETION order: 114 of 1,498 rows in the first real set
    // arrived out of canonical order. The live run does not see that order — the
    // orchestrator merges fragments by `playerIndex` before anything is estimated.
    //
    // It changes no point estimate (every `edgeBB` matched to 4 dp before this sort existed)
    // but it moves EVERY bootstrap figure: `clusterBootstrapCI` walks a Map whose iteration
    // order is insertion order, so a different row order resamples differently, and the
    // float accumulation in `ruleFires` lands on 360.1000000000002 vs 360.10000000000036.
    // CI, MDE and power are exactly the numbers a rung is judged by.
    //
    // `stable` exists for this — decisionRecord calls it "what the merge sorts by, and what
    // makes a chunked run the same measurement as a whole one". Sorting here rather than at
    // write time keeps the writer append-only and makes the replay correct for ANY set,
    // including one produced by a worker pool where completion order is not even stable.
    const d = decisions.sort((x, y) => (
      (x.stable.p - y.stable.p) || (x.stable.k - y.stable.k) || (x.stable.d - y.stable.d)
    ));

    const edges = {};
    for (const r of rungs) {
      edges[r.id] = estimateEdge(
        d.filter((x) => x.piOursByArm?.[r.id]).map((x) => ({ ...x, piOurs: x.piOursByArm[r.id] })),
        { weightCap, label: `rung ${r.id}` },
      );
    }
    const deltas = {};
    for (let i = 1; i < rungs.length; i++) {
      deltas[rungs[i].id] = {
        vs: rungs[i - 1].id,
        ...pairedDelta(d, { baseArm: rungs[i - 1].id, testArm: rungs[i].id, weightCap }),
      };
    }
    // Merge player fragments in canonical `playerIndex` order — `foldAll`'s order.
    const coverageByArm = Object.fromEntries(rungs.map((r) => [r.id, newCoverage()]));
    for (const p of [...covByPlayer.keys()].sort((a, b) => a - b)) {
      const byArmCov = covByPlayer.get(p);
      for (const r of rungs) mergeCoverage(coverageByArm[r.id], byArmCov[r.id]);
    }
    const coverage = Object.fromEntries(rungs.map((r) => [r.id, summarizeCoverage(coverageByArm[r.id])]));

    console.log(`\n  rows read ${rows}   scored ${d.length}   runtime ${(runtimeMs / 1000).toFixed(1)}s`
      + `   ${(runtimeMs / Math.max(d.length, 1)).toFixed(1)} ms/decision`);
    console.log(`  range-recovery checks passed: ${rangeChecks}`);

    console.log('\n  RUNG EDGES vs the field (bb per hand-at-decision)');
    const target = num(args['target-bb'], 0.25);
    for (const r of rungs) {
      const e = edges[r.id];
      const unresolved = Number.isFinite(e?.edgeBB) && Number.isFinite(e?.mdeDetectBB)
        && Math.abs(e.edgeBB) < e.mdeDetectBB;
      console.log(`    ${r.id.padEnd(24)} edge ${bb(e?.edgeBB)}  [${bb(e?.edgeCiLowBB)}, ${bb(e?.edgeCiHighBB)}]`
        + `  n=${e?.n ?? '?'}  MDE=${bb(e?.mdeDetectBB)}${unresolved ? '  <-- UNRESOLVED' : ''}`);
    }

    // WS-540 accept criterion: a run that does not resolve a rung STATES THE n THAT WOULD.
    // An unresolved interval reported without it invites "the rule bought nothing", which is
    // a claim about the instrument being read as a claim about the effect.
    console.log(`\n  WHAT ONE RULE BOUGHT — paired delta vs the rung below (target ±${target} bb)`);
    for (let i = 1; i < rungs.length; i++) {
      const dl = deltas[rungs[i].id];
      const need = nToResolve(dl?.discordantN, dl?.deltaMdeDetectBB, target);
      const resolved = dl?.excludesZero === true;
      console.log(`    ${rungs[i].id.padEnd(24)} vs ${String(dl.vs).padEnd(22)} delta ${bb(dl?.deltaBB)}`
        + `  [${bb(dl?.deltaCiLowBB)}, ${bb(dl?.deltaCiHighBB)}]  discordant=${dl?.discordantN ?? '?'}`
        + `  MDE=${bb(dl?.deltaMdeDetectBB)}`);
      console.log(`      ${resolved ? 'RESOLVED (interval excludes zero)' : `UNRESOLVED — needs ~${need ?? '?'} discordant decisions for ±${target} bb`}`);
    }

    // ── THE GATE ────────────────────────────────────────────────────────────────────────
    // Pre-registered falsifier: a replay must reproduce the live run EXACTLY. Anything else
    // means the persisted set is not the decisions that were scored, and every number this
    // script produces would be a plausible answer to a different question.
    let gate = null;
    if (typeof args.gate === 'string') {
      const live = JSON.parse((await import('node:fs')).readFileSync(args.gate, 'utf8'));
      const canon = (o) => JSON.stringify(o);
      const parts = { edges: canon(live.edges) === canon(edges), deltas: canon(live.deltas) === canon(deltas), coverage: canon(live.coverage) === canon(coverage) };
      gate = { against: args.gate, ...parts, ok: parts.edges && parts.deltas && parts.coverage };
      console.log('\n  BIT-IDENTITY GATE vs the live run');
      for (const [k, v] of Object.entries(parts)) console.log(`    ${k.padEnd(10)} ${v ? 'IDENTICAL' : 'DIVERGED'}`);
      if (!gate.ok) {
        console.error('\n  GATE FAILED — the replay is not the same measurement. Reporting, not tuning.');
      }
    }

    console.log('\n  NO RESULT CARD. Prototype slice; per ADR-009 this makes no comparative claim.');
    console.log('═════════════════════════════════════════\n');

    if (typeof args.out === 'string') {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, JSON.stringify({
        prototype: true,
        replayed: true,
        contextSet: setPath,
        rowsRead: rows,
        decisionsScored: d.length,
        runtimeMs,
        rungs: rungs.map((r) => ({ id: r.id, cardId: r.cardId, title: r.title, ruleCount: r.ruleCount, contentHash: r.contentHash })),
        edges,
        deltas,
        coverage,
        gate,
      }, null, 2));
      console.log(`Wrote ${args.out}`);
    }
    if (gate && !gate.ok) process.exit(1);
  } finally {
    await loader.close?.();
  }
};

main().catch((e) => { console.error(e); process.exit(1); });
