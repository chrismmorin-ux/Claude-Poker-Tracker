/**
 * probe-player-drift.mjs — does a player MOVE along the dial? (WS-436 §4d #3)
 *
 * The founder's lifecycle hypothesis, longitudinal form. The archetype research
 * tested it CROSS-SECTIONALLY (dial vs switch across players); this probe tests
 * WITHIN a player: is the second half of a player's history drawn from the same
 * rates as the first, or has the dial moved?
 *
 * TWO TIMESCALES, honestly labeled:
 *   halves  first-half vs second-half of the player's corpus history, ordered
 *           by (day, arrival) — within-HISTORY drift over ~weeks.
 *   days    per-day rates for players with enough hands per day — day-to-day
 *           dispersion, the closest this corpus gets to "session" drift.
 *
 * METHOD. For each POOL player: per-decision series via the SAME seam every
 * instrument uses (accumulateDecisions), so "faced a bet" and "folded" mean
 * exactly what they mean everywhere else. Two behaviours:
 *   vpip       per hand: any voluntary preflop money (call/bet/raise)
 *   foldVsBet  per faced bet-or-raise decision: folded?
 * Overdispersion of paired half-deltas against binomial expectation:
 *   z_i = (p2 − p1) / sqrt(p̂(1−p̂)(1/n1 + 1/n2)),  mean(z²) ≈ 1 under NO drift.
 * The drift magnitude is reported as an SD in percentage points —
 *   sqrt(max(0, Var_obs(Δ) − mean(Var_null))) —
 * and compared, in the same table, against the BETWEEN-player SD computed from
 * the same players, because "does the dial move" only matters relative to how
 * far apart the dials sit.
 *
 * USAGE
 *   node scripts/backtest/probe-player-drift.mjs [--max-players 300]
 *     [--max-hands-per-player 300] [--min-hands 60] [--min-day-hands 15]
 *     [--out out/player-drift.json]
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';
import { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } from './corpusFiles.mjs';

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
const int = (v, d) => (v === undefined ? d : Number.parseInt(v, 10));
const pp = (x) => `${(100 * x).toFixed(1)}pp`;

const rate = (events) => {
  const n = events.length;
  const k = events.reduce((s, e) => s + e, 0);
  return { k, n, p: n > 0 ? k / n : null };
};

/** Paired-halves overdispersion over players for one behaviour. */
const halvesStats = (perPlayer) => {
  const rows = perPlayer.filter(r => r.h1.n >= 10 && r.h2.n >= 10);
  const zs = [];
  const deltas = [];
  let varNullSum = 0;
  for (const r of rows) {
    const pooled = (r.h1.k + r.h2.k) / (r.h1.n + r.h2.n);
    const varNull = pooled * (1 - pooled) * (1 / r.h1.n + 1 / r.h2.n);
    if (!(varNull > 0)) continue;
    const d = r.h2.p - r.h1.p;
    zs.push(d / Math.sqrt(varNull));
    deltas.push(d);
    varNullSum += varNull;
  }
  const n = zs.length;
  if (n < 10) return { players: n, note: 'too thin' };
  const meanZ2 = zs.reduce((s, z) => s + z * z, 0) / n;
  const meanD = deltas.reduce((s, d) => s + d, 0) / n;
  const varObs = deltas.reduce((s, d) => s + (d - meanD) ** 2, 0) / (n - 1);
  const driftSd = Math.sqrt(Math.max(0, varObs - varNullSum / n));
  // Between-player spread of the pooled rates, same players, for scale.
  const pooledPs = perPlayer.filter(r => r.h1.n + r.h2.n >= 20)
    .map(r => (r.h1.k + r.h2.k) / (r.h1.n + r.h2.n));
  const mu = pooledPs.reduce((s, p) => s + p, 0) / pooledPs.length;
  const betweenSd = Math.sqrt(pooledPs.reduce((s, p) => s + (p - mu) ** 2, 0) / (pooledPs.length - 1));
  return {
    players: n,
    meanZ2: +meanZ2.toFixed(3),
    meanDelta: +meanD.toFixed(4),
    driftSd: +driftSd.toFixed(4),
    betweenPlayerSd: +betweenSd.toFixed(4),
    driftShareOfBetween: betweenSd > 0 ? +(driftSd / betweenSd).toFixed(3) : null,
  };
};

/** Day-level overdispersion: per-player chi²/df of daily rates vs their own pooled rate. */
const dayStats = (perPlayerDays, minDayHands) => {
  const perPlayerChi = [];
  for (const days of perPlayerDays) {
    const q = days.filter(d => d.n >= minDayHands);
    if (q.length < 3) continue;
    const K = q.reduce((s, d) => s + d.k, 0);
    const N = q.reduce((s, d) => s + d.n, 0);
    const pBar = K / N;
    if (!(pBar > 0 && pBar < 1)) continue;
    const chi = q.reduce((s, d) => s + ((d.k - d.n * pBar) ** 2) / (d.n * pBar * (1 - pBar)), 0);
    perPlayerChi.push(chi / (q.length - 1));
  }
  const n = perPlayerChi.length;
  if (n < 10) return { players: n, note: 'too thin' };
  const mean = perPlayerChi.reduce((s, c) => s + c, 0) / n;
  const sorted = [...perPlayerChi].sort((a, b) => a - b);
  return {
    players: n,
    meanChi2PerDf: +mean.toFixed(3),
    medianChi2PerDf: +sorted[Math.floor(n / 2)].toFixed(3),
    shareAbove1: +(perPlayerChi.filter(c => c > 1).length / n).toFixed(3),
  };
};

const main = async () => {
  const args = parseArgs(process.argv);
  const files = await discoverCorpusFiles({
    root: args['corpus-root'] || DEFAULT_CORPUS_ROOT,
    stakes: ['50NLH'],
  });
  console.log(`corpus: ${files.length} file(s)`);

  const loader = await openLoader(process.cwd());
  try {
    const { indexEvalPlayers } = await loader.load('/scripts/backtest/runner.mjs');
    const { GROUPS } = await loader.load('/scripts/backtest/partition.mjs');
    const { buildRangeProfile } = await loader.load('/src/utils/rangeEngine/index.js');
    const { accumulateDecisions } = await loader.load('/src/utils/exploitEngine/decisionAccumulator.js');
    const { PRIMITIVE_ACTIONS } = await loader.load('/src/constants/primitiveActions.js');

    const minHands = int(args['min-hands'], 60);
    const minDayHands = int(args['min-day-hands'], 15);
    const { byPlayer, handsRead } = await indexEvalPlayers({
      files,
      poolPct: 50,
      maxPlayers: int(args['max-players'], 300),
      maxHandsPerPlayer: int(args['max-hands-per-player'], 300),
      group: GROUPS.POOL,
      onProgress: ({ handsRead: h, players }) => console.log(`  ${h} hands read, ${players} pool players`),
    });

    const V = { call: PRIMITIVE_ACTIONS.CALL, bet: PRIMITIVE_ACTIONS.BET, raise: PRIMITIVE_ACTIONS.RAISE };
    const vpipHalves = [];
    const foldHalves = [];
    const vpipDays = [];
    let usable = 0;
    let dayFieldPresent = 0;

    for (const [pid, hands] of byPlayer) {
      if (hands.length < minHands) continue;
      // Temporal order: (day, arrival). Arrival order is preserved by sort stability.
      const ordered = [...hands].map((h, i) => ({ h, i }))
        .sort((a, b) => ((a.h._backtest?.day ?? 0) - (b.h._backtest?.day ?? 0)) || (a.i - b.i))
        .map(x => x.h);
      if (ordered.some(h => h._backtest?.day != null)) dayFieldPresent++;

      // Per-hand vpip from the action sequence (voluntary preflop money).
      const seatOfPid = (h) => Object.entries(h.seatPlayers).find(([, p]) => p === pid)?.[0];
      const vpipSeries = ordered.map((h) => {
        const seat = seatOfPid(h);
        if (seat == null) return null;
        const vol = h.gameState.actionSequence.some(e =>
          e.street === 'preflop' && String(e.seat) === String(seat)
          && (e.action === V.call || e.action === V.bet || e.action === V.raise));
        return vol ? 1 : 0;
      }).filter(v => v != null);

      // Per-decision fold-vs-bet through the production seam.
      const foldSeries = [];
      try {
        const profile = buildRangeProfile(pid, ordered, 'driftprobe');
        if (profile) {
          accumulateDecisions(pid, ordered, profile, 'driftprobe', {
            onDecision: (ctx) => {
              if (ctx.facingAction === 'bet' || ctx.facingAction === 'raise') {
                foldSeries.push(ctx.action === 'fold' ? 1 : 0);
              }
            },
          });
        }
      } catch { /* profile failures skip the fold behaviour only */ }

      const half = (s) => [s.slice(0, Math.floor(s.length / 2)), s.slice(Math.floor(s.length / 2))];
      const [v1, v2] = half(vpipSeries);
      vpipHalves.push({ pid, h1: rate(v1), h2: rate(v2) });
      if (foldSeries.length >= 20) {
        const [f1, f2] = half(foldSeries);
        foldHalves.push({ pid, h1: rate(f1), h2: rate(f2) });
      }

      // Day-level vpip.
      const byDay = new Map();
      ordered.forEach((h, idx) => {
        const d = h._backtest?.day ?? null;
        if (d == null) return;
        const v = vpipSeries[idx];
        if (v == null) return;
        const cell = byDay.get(d) || { k: 0, n: 0 };
        cell.k += v; cell.n += 1;
        byDay.set(d, cell);
      });
      if (byDay.size >= 3) vpipDays.push([...byDay.values()]);
      usable++;
    }

    const result = {
      builtFrom: {
        group: 'POOL', files: files.length, handsRead, usablePlayers: usable,
        minHands, minDayHands,
        dayFieldCoverage: `${dayFieldPresent}/${usable} players had a day field`,
        timescaleAnswered: dayFieldPresent > 0
          ? 'within-history (halves) AND day-to-day (days)'
          : 'within-HISTORY only — no day field reached the adapter; the days table is empty and the session-timescale question remains open',
      },
      vpipHalves: halvesStats(vpipHalves),
      foldVsBetHalves: halvesStats(foldHalves),
      vpipDays: dayStats(vpipDays, minDayHands),
    };

    const out = typeof args.out === 'string' ? args.out : 'out/player-drift.json';
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    console.log(`Wrote ${out}`);
    console.log('\nReading guide: meanZ2 ≈ 1 ⇒ no drift beyond sampling noise; driftSd is the');
    console.log('real movement in rate units; driftShareOfBetween compares it to how far apart');
    console.log(`players sit (drift matters only if it is a meaningful share of that). vpip half-split n≥10/10; fold series n≥20. Day rows need ≥3 days × ≥${minDayHands} hands.`);
  } finally {
    await loader.close();
  }
};

main().catch((e) => { console.error(`\n${e.stack || e.message}\n`); process.exit(1); });
