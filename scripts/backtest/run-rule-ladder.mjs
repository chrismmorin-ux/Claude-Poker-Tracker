#!/usr/bin/env node
/**
 * run-rule-ladder.mjs — WS-536. The ENGINE-FREE ladder runner.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS RATHER THAN A FLAG ON run-strategy-arms.mjs
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * That script's job is to compare a published strategy AGAINST THE ENGINE, so it hardcodes an
 * engine arm and makes it primary. This one compares rungs against EACH OTHER, and the engine
 * is not in the question. Bolting a "no engine" mode onto a script whose every figure is an
 * engine contrast would leave both harder to read.
 *
 * TWO COST ARGUMENTS HAVE NOW BEEN MADE ABOUT THIS FILE AND THE MEASUREMENT REFUTED BOTH.
 * Both are kept. A refuted prediction deleted once it is fixed is a prediction the next
 * reader re-derives from scratch, and this file is on its second lap of exactly that.
 *
 * ── REFUTATION 1 (2026-08-17) — "drop the engine arm and it runs in minutes" ──
 *
 * The prediction: run-strategy-arms.mjs took 220 s for 45 decisions (~4.9 s/decision) and its
 * header states strategy arms are "free — pure functions of the decision, no engine call. The
 * whole cost of a run is the ENGINE arm." So dropping the engine arm should have made a ladder
 * run in minutes.
 *
 * MEASURED 2026-08-17, engine-free: 420 s for 85 decisions. **4.9 s/decision — unchanged.**
 * Removing the engine arm bought nothing in wall clock.
 *
 * ── REFUTATION 2 (2026-08-20) — "the cost is the per-player corpus walk" ──
 *
 * Refutation 1 concluded with a SECOND prediction, stated here as fact for three days: that
 * the per-decision cost was the per-player corpus walk (index, buildRangeProfile,
 * accumulateDecisions) amortised over a low yield of decisions per player, and therefore
 * "THROUGHPUT IS AN OPEN BLOCKER and the fix is in the corpus walk, not here."
 *
 * WS-540 built the per-phase instrument that could check it — there was none in
 * scripts/backtest at all — and the number came back the other way round:
 *
 *     comboSample   139.0 s (102 calls)   98.2% of wall
 *     strategyArms    0.0 s (474 calls)   the rules ARE free, exactly as claimed
 *     corpus read     1.2 s   accumulate 1.1 s   profileBuild 0.2 s
 *
 * The corpus walk is under 2%. Confirmed independently by `node --cpu-prof`, which knows
 * nothing about that instrument: 57.9% self time in `evaluate5`
 * (src/utils/pokerCore/handEvaluator.js), 5.4% `bestFiveFromSeven`, 4.9%
 * `comboStrengthPercentile`; `buildRangeProfile` and `accumulateDecisions` are not in the
 * top 18.
 *
 * THE ACTUAL CAUSE: `sampleCombos(range, board, k)` is a pure function of three DECISION
 * properties — no arm value reaches it — but it was called inside `policyAt`, so every rung
 * at a node recomputed a bit-identical array. Fixed by building it once per decision and
 * handing it to every arm: 4.94 -> 1.52 s/decision, bit-identical output.
 *
 * ── THE SECOND HALF OF THE SAME FIX (2026-08-20) ──
 *
 * `comboStrengthPercentile` answers for ONE combo by enumerating the whole ~1,081-1,176 combo
 * universe, and those inner scores depend only on the BOARD — so a range of N combos ran the
 * identical enumeration N times. The repo already had the answer:
 * `computeBoardPercentileTable` computes every combo's percentile in one pass, and its docblock
 * states "any divergence from `comboStrengthPercentile` is a bug in this function". That claim
 * was CHECKED before `sampleCombos` was moved onto it — 9,122 combos across 8 boards, zero
 * mismatches — rather than taken on the docblock's word.
 *
 *     141.6 s -> 2.3 s on an identical 93-decision slice (61.6x), output bit-identical.
 *     4.94 -> 0.03 s/decision against the run this file was written around (~165x).
 *
 * WHERE THE COST IS NOW, and it is worth stating plainly because it is where refutation 1
 * ALREADY claimed it was:
 *
 *     corpus read 1.1 s   accumulate 0.9 s   profileBuild 0.2 s   comboSample 0.1 s
 *     the per-player corpus walk is now 99.6% of the run
 *
 * So the corpus-walk diagnosis is true TODAY. It was not true when it was made — it became
 * true only once the term that actually dominated was removed. A claim that is eventually
 * right for reasons its author did not have is still not evidence, and that is the whole
 * reason both refutations are kept here.
 *
 * THE LESSON ALL OF IT SHARES: every cost claim about this pipeline that was reasoned about
 * rather than measured has been wrong, and each one was wrong in a way that sent the next
 * piece of work at the wrong term. Measure the phase before optimising it.
 *
 * WHAT THIS UNBLOCKS. At 0.03 s/decision the n this ladder needs is reachable: ~26,000
 * decisions (the low-end MDE estimate) is ~13 minutes and ~550,000 is ~4.6 hours, against
 * ~36 hours and ~31 days before. Every rung is still UNRESOLVED at n=93; that is now a
 * question of running it, not of whether it can be run.
 *
 * The file still earns its place: FALLBACK_POOL is the reading the ladder wants, and rung-to-
 * rung deltas are its product.
 *
 * The infrastructure already anticipated this. `normalizeDepthArms` (heroEvRunner.mjs:88)
 * refuses a strategy-only run ONLY when an arm asks to fall back to an engine that is not
 * there, and its error message says: "Use fallback 'pool' for a strategy-only run." Every rung
 * here uses FALLBACK_POOL, which is also the reading the ladder wants — the rule set ALONE,
 * playing population poker everywhere it abstains.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT IS LOST BY DROPPING THE ENGINE ARM, STATED RATHER THAN DISCOVERED LATER
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `poolBestResponseAt` consumes `perCombo` from the engine pass, so with no engine arm THE
 * PBR CEILING IS UNAVAILABLE and `exploitationEfficiency` cannot be computed. The run reports
 * that as a named absence, never as a zero. Rung-to-rung deltas — the ladder's actual product
 * — do not depend on it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT THE NUMBERS MEAN
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 *   edgeBB        each rung's own edge against the field, from `estimateEdge`.
 *   paired delta  rung N vs rung N-1 on the SAME decisions — the well-determined figure,
 *                 because the population term differences away. THIS is "what did one rule buy".
 *   coveredShare  without it neither figure is readable: a rung covering 30% of decisions has
 *                 an edge diluted by construction, and `discordantN` is its honest n.
 *   ESS           effective sample size after importance weighting. A low ESS means the
 *                 nominal n is a fiction.
 *
 * USAGE
 *   node scripts/backtest/run-rule-ladder.mjs --behavior-policy out/behavior-policy.json \
 *     --stakes 50NLH --max-files 40 --max-players 120 --max-decisions 4000 \
 *     --out out/rule-ladder.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';
import { REFERENCE_DISABLED } from './leakageGuard.mjs';

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
const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : null);
const int = (v, d) => (v === undefined ? d : Number.parseInt(v, 10));
const num = (v, d) => (v === undefined ? d : Number.parseFloat(v));
const bb = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '    n/a' : `${v >= 0 ? '+' : ''}${v.toFixed(4)}`);

const main = async () => {
  const args = parseArgs(process.argv);
  const loader = await openLoader(process.cwd());
  try {
    const { discoverCorpusFiles, applyFileCap, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { runHeroEv } = await loader.load('/scripts/backtest/heroEvRunner.mjs');
    const { estimateEdge } = await loader.load('/scripts/backtest/ipsEstimator.mjs');
    const { pairedDelta } = await loader.load('/scripts/backtest/depthAblationReport.mjs');
    const { fromStrategyCard } = await loader.load('/scripts/backtest/strategyArm.mjs');
    const { loadStrategyCard } = await loader.load('/src/utils/standardOfRecord/strategyCard.js');
    const { LADDER } = await loader.load('/scripts/backtest/ladder/rungs.card.js');
    // WS-540 Phase 1 — optional. Producing a set costs the same walk the run already pays;
    // what it buys is that the NEXT rung never pays it again.
    const { openContextSetWriter } = await loader.load('/scripts/backtest/decisionContextSet.mjs');

    // Through the REAL loader: a rung that bypassed validation would be scoring an object the
    // Standard of Record would have rejected, and its content hash is what names the version.
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
        arm: fromStrategyCard(loaded, { sourceRef: `ladder:${card.cardId}` }),
      });
    }

    console.log('\n═══ VILLAIN RULE LADDER (engine-free) ═══');
    for (const r of rungs) console.log(`  ${r.id.padEnd(24)} rules=${String(r.ruleCount).padStart(2)}  ${r.contentHash.slice(0, 17)}`);

    const behaviorPolicy = JSON.parse(readFileSync(String(args['behavior-policy']), 'utf8'));

    let files = await discoverCorpusFiles({
      root: typeof args['corpus-root'] === 'string' ? args['corpus-root'] : DEFAULT_CORPUS_ROOT,
      sites: list(args.sites),
      stakes: list(args.stakes),
    });
    if (files.length === 0) {
      console.error('No corpus files matched. Check --corpus-root / --sites / --stakes.');
      process.exit(2);
    }
    ({ files } = applyFileCap(files, { maxFiles: int(args['max-files'], Infinity) }));

    const weightCap = num(args['weight-cap'], 20);

    // WS-540 Phase 1 — `--context-set <path>` writes the arm-independent decision set.
    // The writes are queued and awaited at close: `runHeroEv`'s emit callbacks are
    // synchronous, and an un-awaited async write would let the run finish before the file
    // did — producing a manifest whose row count is right and whose file is short.
    const contextSetPath = typeof args['context-set'] === 'string' ? args['context-set'] : null;
    const contextWriter = contextSetPath
      ? await openContextSetWriter(contextSetPath, {
        meta: {
          producer: 'run-rule-ladder.mjs',
          stakes: list(args.stakes),
          rungs: rungs.map((r) => ({ id: r.id, contentHash: r.contentHash })),
        },
      })
      : null;
    let contextChain = Promise.resolve();
    let contextWriteError = null;
    const onDecisionContext = contextWriter
      ? (row) => {
        contextChain = contextChain
          .then(() => contextWriter.write(row))
          .catch((e) => { contextWriteError = contextWriteError ?? e; });
      }
      : null;

    const started = Date.now();

    const run = await runHeroEv({
      files,
      reference: REFERENCE_DISABLED,
      behaviorPolicy,
      poolPct: int(args['pool-pct'], 50),
      maxPlayers: int(args['max-players'], Infinity),
      maxHandsPerPlayer: int(args['max-hands-per-player'], Infinity),
      minTrainHands: int(args['min-train-hands'], 15),
      checkpointInterval: int(args['checkpoint-interval'], 10),
      maxDecisions: int(args['max-decisions'], Infinity),
      comboSamples: int(args['combo-samples'], 10),
      trials: int(args.trials, 200),
      // NO ENGINE ARM. Every rung falls back to the pool, which is both the only legal
      // configuration without an engine and the reading the ladder wants.
      depthArms: rungs.map((r) => ({ id: r.id, strategy: r.arm, fallback: 'pool' })),
      primaryArmId: rungs[rungs.length - 1].id,
      // WS-540. Strategy arms cross the boundary as descriptors and are rebuilt in-worker
      // under a content-hash assertion. `--workers 0` remains the bit-identity baseline.
      workers: int(args.workers, 0),
      onDecisionContext,
      log: (m) => console.log(`  ${m}`),
    });

    let contextManifest = null;
    if (contextWriter) {
      await contextChain;
      // A partial set is worse than none: it scores fewer decisions and reports a smaller
      // edge without erroring. Fail the run rather than leave one on disk.
      if (contextWriteError) throw contextWriteError;
      contextManifest = await contextWriter.close();
      console.log(`
  CONTEXT SET  ${contextSetPath}`);
      console.log(`    rows ${contextManifest.rows}   ${contextManifest.contentHash}`);
    }

    const runtimeMs = Date.now() - started;
    const d = run.decisions;

    const edges = {};
    for (const r of rungs) {
      edges[r.id] = estimateEdge(
        d.filter((x) => x.piOursByArm?.[r.id]).map((x) => ({ ...x, piOurs: x.piOursByArm[r.id] })),
        { weightCap, label: `rung ${r.id}` },
      );
    }

    // Rung N vs rung N-1 — what ONE rule bought.
    const deltas = {};
    for (let i = 1; i < rungs.length; i++) {
      deltas[rungs[i].id] = {
        vs: rungs[i - 1].id,
        ...pairedDelta(d, { baseArm: rungs[i - 1].id, testArm: rungs[i].id, weightCap }),
      };
    }

    console.log(`\n  decisions scored : ${run.decisionsScored}   runtime: ${(runtimeMs / 1000).toFixed(1)}s`);
    console.log('\n  RUNG EDGES vs the field (bb per hand-at-decision)');
    for (const r of rungs) {
      const e = edges[r.id];
      // MDE RIDES BESIDE EVERY EDGE, ALWAYS. `mdeDetectBB` is the smallest effect this run's
      // own evidence could have resolved; an edge smaller than its MDE is not a small effect,
      // it is an unmeasured one, and printing the edge without it invites exactly that misread.
      const unresolved = Number.isFinite(e?.edgeBB) && Number.isFinite(e?.mdeDetectBB)
        && Math.abs(e.edgeBB) < e.mdeDetectBB;
      console.log(`    ${r.id.padEnd(24)} rules=${String(r.ruleCount).padStart(2)}  edge ${bb(e?.edgeBB)}`
        + `  [${bb(e?.edgeCiLowBB)}, ${bb(e?.edgeCiHighBB)}]  n=${e?.n ?? '?'}`
        + `  ESS=${e?.ess ?? '?'}  MDE=${bb(e?.mdeDetectBB)}`
        + `${unresolved ? '  <-- UNRESOLVED: |edge| < MDE' : ''}`);
    }
    console.log('\n  WHAT ONE RULE BOUGHT — paired delta vs the rung below');
    for (let i = 1; i < rungs.length; i++) {
      const dl = deltas[rungs[i].id];
      console.log(`    ${rungs[i].id.padEnd(24)} vs ${String(dl.vs).padEnd(22)} delta ${bb(dl?.deltaBB ?? dl?.delta)}`
        + `  [${bb(dl?.ciLowBB ?? dl?.deltaCiLowBB)}, ${bb(dl?.ciHighBB ?? dl?.deltaCiHighBB)}]`
        + `  discordant=${dl?.discordantN ?? '?'}`);
    }
    console.log('\n  COVERAGE');
    for (const [id, c] of Object.entries(run.strategyCoverage ?? {})) {
      if (!c) { console.log(`    ${id.padEnd(24)} no decisions`); continue; }
      console.log(`    ${id.padEnd(24)} covered ${(c.coveredShare * 100).toFixed(1)}% (${c.covered}/${c.n})`
        + `  fellBackToPool=${c.fellBackToPool ?? c.fellBackToEngine ?? 0}`);
    }
    // WS-540 Phase 0. THE COST MODEL, MEASURED. This ticket exists because the last
    // unmeasured cost model here was refuted by the first measurement that met it (see this
    // file's header). `decoupleableShare` is the share of accounted time a persisted decision
    // set would let a later rung SKIP — it is the number the decoupling stands or falls on.
    const c = run.cost;
    if (c) {
      console.log('\n  WHERE THE TIME WENT (WS-540 Phase 0)');
      console.log(`    wall ${(c.wallMs / 1000).toFixed(1)}s   workers=${c.workers}`
        + `   ${c.msPerDecision === null ? 'n/a' : (c.msPerDecision / 1000).toFixed(2)}s/decision`);
      console.log(`    corpus read (once)       ${(c.corpusReadMs / 1000).toFixed(1)}s`);
      const ph = c.perPhase.byPhaseMs;
      for (const k of Object.keys(ph)) {
        console.log(`    ${k.padEnd(24)} ${(ph[k] / 1000).toFixed(1)}s  (${c.perPhase.calls[k]} calls)`);
      }
      const pct = (x) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
      console.log(`    DECOUPLEABLE (corpus walk) ${pct(c.decoupleableShare)}`
        + `   arms ${pct(c.armShare)}   of accounted time`);
      console.log(`    unaccounted wall ${(c.unmeasuredWallMs).toFixed(0)}ms`
        + `   resumedWaves=${c.resumedWaves}`);
      const cb = c.perPhase.contextBytes;
      console.log(cb
        ? `    prospective context row  ${cb.meanContextBytes.toFixed(0)} B mean`
          + `  (hand ${cb.meanHandBytes.toFixed(0)} B = ${(cb.handShare * 100).toFixed(0)}%)`
          + `  n=${cb.samples} samples`
        : '    prospective context row  UNSAMPLED — no surviving decision reached the probe');
    } else {
      console.log('\n  WHERE THE TIME WENT: NOT MEASURED — run.cost absent.');
    }

    console.log('\n  PBR ceiling and exploitationEfficiency: UNAVAILABLE — no engine arm supplies');
    console.log('  perCombo. Named, not zeroed. Rung-to-rung deltas do not depend on it.');
    console.log('\n  NO RESULT CARD. Prototype slice; per ADR-009 this makes no comparative claim.');
    console.log('═════════════════════════════════════════\n');

    const outPath = String(args.out ?? 'out/rule-ladder.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify({
      prototype: true,
      engineFree: true,
      caveat: 'Corpus is HandHQ online cash July 2009 50NL. Any claim about live 9-handed '
        + '1/2-1/3 is TRANSFERRED, not measured. PBR/exploitationEfficiency unavailable by '
        + 'construction in an engine-free run.',
      runtimeMs,
      decisionsScored: run.decisionsScored,
      // WS-540 Phase 0 — persisted, not just printed. The falsifier is pre-registered
      // against `cost.decoupleableShare` and has to be checkable after the fact.
      cost: run.cost ?? null,
      // WS-540 Phase 1 — the POINTER, per .claude/rules/artifact-location.md: the run
      // records which set it produced; the set itself is a heavy artifact and lives outside
      // the repo. A missing set must fail loudly rather than resolve to a different one.
      contextSet: contextManifest
        ? { path: contextSetPath, rows: contextManifest.rows, contentHash: contextManifest.contentHash }
        : null,
      config: run.config,
      rungs: rungs.map((r) => ({
        id: r.id, cardId: r.cardId, title: r.title, ruleCount: r.ruleCount, contentHash: r.contentHash,
      })),
      edges,
      deltas,
      coverage: run.strategyCoverage ?? null,
    }, null, 2));
    console.log(`Wrote ${outPath}`);
  } finally {
    await loader.close?.();
  }
};

main().catch((e) => { console.error(e); process.exit(1); });
