/**
 * mineFieldPolicy.mjs — the response rates of the field the founder is ACTUALLY playing.
 *
 * NO SHEBANG ON THIS FILE, DELIBERATELY. It is imported by a test, and vitest compiles an
 * externalized module through `new vm.Script`, which — unlike Node's module loader — does NOT
 * strip a leading `#!`. The result is a bare `SyntaxError: Invalid or unexpected token` whose
 * reported line number points into the transformed output rather than the source, which is
 * why it costs an hour to find. Sibling CLIs that no test imports can keep theirs. This one is
 * always invoked as `node scripts/sessionSink/mineFieldPolicy.mjs`, so the shebang bought
 * nothing on Windows regardless.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Pool Best Response — the upper pier post, and the only honest answer to "what did this
 * session cost me" — needs a measured model of the field. The only one the repo has
 * (`out/behavior-policy.json`) was mined from the 2009 HandHQ corpus. Reporting a corpus level
 * about a live modern Ignition table is a LEVELS transfer, the top-ranked entry in the
 * Suspected-Fault Register, and `.claude/rules/corpus-transfer-is-earned.md` forbids it crossing
 * into a live claim by default.
 *
 * So the session review refused, and this is the thing that removes the limitation rather than
 * planning around it: a policy mined from the founder's OWN accumulating sessions. It starts
 * thin and refuses; it gets real as he plays. When both exist they run as two arms and the
 * DELTA between them measures the transfer instead of assuming it
 * (`.claude/rules/unmeasured-constants.md`).
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE LEAKAGE THIS REFUSES STRUCTURALLY, NOT BY ASKING CALLERS TO BE CAREFUL
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * A policy mined from session N and then used to price session N is fit on the very decisions
 * it is scoring. The number that comes out is not an estimate of anything — it is the model
 * reading its own homework, and more data makes it converge harder onto the wrong answer.
 *
 * `--exclude <sessionId>` is therefore MANDATORY when the output will be used to score a
 * session, and `mineFieldPolicy` records every contributing session id in its provenance so a
 * consumer can verify the hold-out rather than trust it. `reviewSession` checks that stamp and
 * refuses a policy that contains the session it is about to price.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ONE DERIVATION, NOT TWO
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Observations come from `accumulateDecisions` and its `onDecision` seam — the SAME derivation
 * the corpus miner uses and the same one the engine sees. `behaviorPolicyMiner.mjs`'s header
 * states why a second walk over the action sequence would be wrong: it produces propensities
 * keyed by a context the engine never sees, and the importance weights would then be dividing
 * two different things.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * RUN
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 *   node scripts/sessionSink/mineFieldPolicy.mjs --out out/field-policy.json
 *   node scripts/sessionSink/mineFieldPolicy.mjs --exclude sess-2026… --out out/field-policy.json
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listClosedSessions, readSessionHands } from './sessionStore.mjs';
import { adaptAppRecord } from '../backtest/appRecordAdapter.mjs';
import { buildPolicyTable, POLICY_HIERARCHY } from '../backtest/behaviorPolicy.mjs';
import {
  decisionGeometry, sizeBucketFor, sprFor, sprBandFor, closesAction,
} from '../backtest/decisionGeometry.mjs';
import { buildRangeProfile } from '../../src/utils/rangeEngine/index.js';
import { accumulateDecisions } from '../../src/utils/exploitEngine/decisionAccumulator.js';

const USER_ID = 'session-field';

/**
 * The floor below which this refuses to emit a table at all.
 *
 * Not a rounding of "feels thin". `buildPolicyTable` shrinks a child cell toward its parent, so
 * a table built on a handful of decisions is mostly prior — it would produce a Pool Best
 * Response that is really a best response to the SEED PRIOR, dressed as a measurement of the
 * founder's field. Refusing keeps the hole visible, and the hole is the work queue.
 */
export const MIN_FIELD_OBSERVATIONS = 2000;

const parseArgs = (argv) => {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) args[k] = true;
    else { args[k] = n; i += 1; }
  }
  return args;
};

const SYNTHETIC_SEAT_LABEL = /^(seat[_-]?\d+|hero|villain\d*|player\d*)$/i;

/**
 * Group a session's hands by opponent subject.
 *
 * Same constraint the review runs under: Ignition carries no player identity, so a subject is
 * a seat within one session, never a person across sessions. Keying on `sessionId:seat` rather
 * than bare `seat` is what stops seat 3 from three different nights being modelled as one
 * player — which would be a fabricated opponent with a blended policy.
 */
const groupBySubject = (sessionId, adapted) => {
  const bySubject = new Map();
  for (const { hand } of adapted) {
    const heroSeat = hand?.gameState?.mySeat;
    for (const seatKey of Object.keys(hand.seatPlayers || {})) {
      const seat = Number(seatKey);
      if (heroSeat != null && seat === Number(heroSeat)) continue;
      const raw = hand.seatPlayers[seatKey];
      const identity = typeof raw === 'string' && !SYNTHETIC_SEAT_LABEL.test(raw) ? raw : null;

      // TWO KEYS, AND CONFLATING THEM YIELDS SILENTLY ZERO OBSERVATIONS — which is exactly
      // what the first version of this did. `accumulateDecisions` finds a player by scanning
      // `seatPlayers` for a VALUE equal to the playerId it was handed
      // (decisionAccumulator.js:223-228), so `lookupId` must be the literal value in the
      // record. The session-scoped `key` exists for a different reason: it stops seat 3 from
      // three different nights being pooled into one fabricated opponent. It never reaches
      // the accumulator.
      const key = identity ? `player:${identity}` : `${sessionId}:seat${seat}`;
      const entry = bySubject.get(key) || { lookupId: raw, hands: [] };
      entry.hands.push(hand);
      bySubject.set(key, entry);
    }
  }
  return bySubject;
};

export const mineFieldPolicy = async ({
  root,
  exclude = [],
  hierarchy = POLICY_HIERARCHY,
  // Injectable so the SUCCESS path is testable. The shipped floor is deliberately higher than
  // any capture on disk can reach, which would otherwise leave the table-building branch as
  // code nothing has ever executed.
  minObservations = MIN_FIELD_OBSERVATIONS,
  log = () => {},
} = {}) => {
  const excluded = new Set([exclude].flat().filter(Boolean));
  const closed = await listClosedSessions(root);
  const contributing = closed.filter((c) => !excluded.has(c.setId));

  if (contributing.length === 0) {
    return {
      refused: true,
      reason: 'unexamined:no-sessions',
      detail: excluded.size
        ? `${closed.length} session(s) on disk, all excluded as the scoring target`
        : 'no sealed sessions on disk yet',
      resolvedBy: 'play sessions with the sink running; this improves on its own',
      sessionsAvailable: closed.length,
    };
  }

  const observations = [];
  const contributed = [];
  const failures = { profile: 0, accumulate: 0, geometry: 0, adapt: 0 };

  for (const session of contributing) {
    const read = await readSessionHands(session.dir);
    const adapted = [];
    for (const record of read.hands) {
      const b = record?.ignitionMeta?.blinds;
      const stakeLabel = b && Number(b.bb) > 0 ? `${b.sb}/${b.bb}` : null;
      const res = adaptAppRecord(record, { site: 'ignition', stakeLabel });
      if (res.skip) { failures.adapt += 1; continue; }
      adapted.push({ hand: res.hand ?? res });
    }

    let sessionObs = 0;
    for (const [, { lookupId, hands }] of groupBySubject(session.setId, adapted)) {
      let profile;
      try {
        profile = buildRangeProfile(lookupId, hands, USER_ID);
      } catch { failures.profile += 1; continue; }
      if (!profile) { failures.profile += 1; continue; }

      try {
        accumulateDecisions(lookupId, hands, profile, USER_ID, {
          onDecision: (ctx) => {
            const geo = decisionGeometry(ctx.hand, ctx.order, ctx.street);
            if (!geo) { failures.geometry += 1; return; }
            observations.push({
              facingAction: ctx.facingAction,
              action: ctx.action,
              isAgg: ctx.isAgg,
              isIP: ctx.isIP,
              texture: ctx.texture,
              street: ctx.street,
              posCategory: ctx.posCategory,
              sizeBucket: sizeBucketFor(geo.facingBetBB, geo.potBB),
              sprBand: sprBandFor(sprFor(geo)),
              closesAction: String(closesAction(ctx.hand, ctx.order, ctx.street, ctx.playerSeat)),
            });
            sessionObs += 1;
          },
        });
      } catch { failures.accumulate += 1; }
    }

    contributed.push({ sessionId: session.setId, hands: read.hands.length, observations: sessionObs });
    log(`${session.setId}: ${sessionObs} decisions from ${read.hands.length} hands`);
  }

  if (observations.length < minObservations) {
    const shortfall = minObservations - observations.length;
    // "At this rate" has to mean THIS rate. Dividing by a hardcoded guess would put a number
    // in a refusal that its own data contradicts, which is the failure this whole runner is
    // built to avoid.
    const perSession = contributed.length ? observations.length / contributed.length : 0;
    const moreSessions = perSession > 0 ? Math.ceil(shortfall / perSession) : null;
    return {
      refused: true,
      reason: 'unexamined:insufficient-n',
      detail: `${observations.length} opponent decisions across ${contributed.length} session(s) `
        + `(${perSession.toFixed(0)} per session); a field policy needs at least `
        + `${minObservations} or the table is mostly its own prior`,
      resolvedBy: moreSessions === null
        ? 'sessions that actually contain opponent decisions'
        : `${shortfall} more opponent decisions — about ${moreSessions} more session(s) at the observed rate`,
      observations: observations.length,
      observationsPerSession: perSession,
      contributed,
      failures,
    };
  }

  const table = buildPolicyTable(observations, {
    source: 'ignition-sessions',
    // The hold-out is VERIFIABLE from the artifact, not merely promised by whoever ran it.
    contributingSessions: contributed.map((c) => c.sessionId),
    excludedSessions: [...excluded],
    sessions: contributed.length,
    minObservations,
    failures,
    minedAt: new Date().toISOString(),
    population:
      'The founder\'s own Ignition opponents, mined from sealed sessions. Modern and live — '
      + 'this is the arm the 2009 corpus policy is transferred FROM, and the delta between '
      + 'them is the transfer measurement.',
  }, { hierarchy });

  return { refused: false, table, observations: observations.length, contributed, failures };
};

const main = async () => {
  const args = parseArgs(process.argv);
  const out = typeof args.out === 'string' ? args.out : 'out/field-policy.json';
  const exclude = typeof args.exclude === 'string' ? args.exclude.split(',').map((s) => s.trim()) : [];

  const result = await mineFieldPolicy({
    root: typeof args.root === 'string' ? args.root : undefined,
    exclude,
    log: (m) => console.log(`  ${m}`),
  });

  if (result.refused) {
    console.error(`REFUSED: ${result.reason}`);
    console.error(`  ${result.detail}`);
    console.error(`  what would answer it: ${result.resolvedBy}`);
    process.exit(3);
  }

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(result.table, null, 2)}\n`, 'utf8');
  console.log(`field policy: ${result.observations} decisions from ${result.contributed.length} session(s) -> ${out}`);
  if (exclude.length) console.log(`  held out: ${exclude.join(', ')}`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
