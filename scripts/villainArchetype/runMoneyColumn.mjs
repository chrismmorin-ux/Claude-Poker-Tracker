/**
 * runMoneyColumn.mjs — price a sealed session's hero decisions and print the column.
 *
 * NO SHEBANG, DELIBERATELY — see `reviewSession.mjs`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE POLICY ARGUMENT IS THE WHOLE ARGUMENT
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Pool Best Response is a best response TO A FIELD, so which policy is handed in decides what
 * the number means, and nothing else about the run changes:
 *
 *   --field-policy <path>   the founder's own accumulating Ignition pool. A LIVE claim.
 *   --corpus-policy         `out/behavior-policy.json`, mined from 2009 HandHQ. A TRANSFERRED
 *                           claim, and refused as a comparative one by default.
 *
 * `--corpus-policy` exists so the machinery can be exercised and verified before the field
 * policy clears its 2000-observation floor — NOT so a corpus level can be reported about a
 * live table. Every figure it produces is stamped `transferStatus: 'transferred-not-measured'`
 * and `comparativeClaim: false`. When both exist they run as TWO ARMS and the delta between
 * them measures the transfer instead of assuming it
 * (`.claude/rules/unmeasured-constants.md`).
 *
 * RUN
 *   node scripts/villainArchetype/runMoneyColumn.mjs --session <dir> --corpus-policy
 *   node scripts/villainArchetype/runMoneyColumn.mjs --session <dir> --field-policy out/field-policy.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readSessionHands } from '../sessionSink/sessionStore.mjs';
import { adaptAppRecord } from '../backtest/appRecordAdapter.mjs';
import { accumulateDecisions } from '../../src/utils/exploitEngine/decisionAccumulator.js';
import { buildRangeProfile } from '../../src/utils/rangeEngine/index.js';
import { labelDecisions } from './decisionLabeler.mjs';
import { transferStatusFor } from '../backtest/behaviorPolicy.mjs';
import { priceSession } from './priceSession.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const USER_ID = 'backtest-user';

const parseArgs = (argv) => {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { args[a.slice(2)] = next; i += 1; } else args[a.slice(2)] = true;
  }
  return args;
};

const bb = (n) => (n >= 0 ? '+' : '') + n.toFixed(2);

/**
 * Collect hero's decision contexts from a sealed session.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * HERO'S PLAYER ID IS NOT STABLE ACROSS A SESSION, AND THAT IS NOT A BUG IN THE CAPTURE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `hand-state-machine` names a seat `'hero'` only once it has SEEN hero's hole cards. On a
 * hand hero was not dealt into — he sat out, or the capture attached mid-hand — the same
 * physical seat is named `'seat_2'` like any other. One sitting therefore contains two
 * different ids for one chair.
 *
 * The first cut took the first non-null id at hero's seat. The first hand of the June 19
 * session is an OBSERVED hand, so that returned `'seat_2'`, `accumulateDecisions` found no
 * such player among the hands hero actually played, and the money column priced ZERO of 14
 * postflop decisions while reporting a clean total of 0.00bb. A wrong id does not error here;
 * it produces an empty, plausible answer.
 *
 * So the id is resolved from the hands where hero was DEMONSTRABLY seated (`mySeat` matches),
 * and a seat that carries more than one id across those hands is REPORTED rather than
 * resolved by majority — two ids at one chair in one sitting is a fact about the capture that
 * a caller should see, not a tie to break.
 */
export const heroContexts = (adapted, heroSeat) => {
  const hands = adapted.map((a) => a.hand);
  const seatedIds = new Set();
  for (const h of hands) {
    if (String(h?.gameState?.mySeat) !== String(heroSeat)) continue;
    const pid = h?.seatPlayers?.[String(heroSeat)];
    if (pid != null) seatedIds.add(String(pid));
  }
  const heroPid = seatedIds.size === 1 ? [...seatedIds][0] : null;
  if (heroPid == null) {
    return {
      ctxs: [],
      heroPid: null,
      byHandId: new Map(),
      idAmbiguity: [...seatedIds],
    };
  }

  const profile = buildRangeProfile(heroPid, hands, USER_ID);
  const ctxs = [];
  accumulateDecisions(heroPid, hands, profile, USER_ID, {
    onDecision: (ctx) => { if (String(ctx.playerSeat) === String(heroSeat)) ctxs.push(ctx); },
  });

  const byHandId = new Map();
  for (const h of hands) if (h?.handId != null) byHandId.set(h.handId, h);
  return { ctxs, heroPid, byHandId, idAmbiguity: [] };
};

const main = async () => {
  const args = parseArgs(process.argv);
  const sessionDir = typeof args.session === 'string' ? args.session : null;
  if (!sessionDir) {
    console.error('Usage: node scripts/villainArchetype/runMoneyColumn.mjs --session <dir> '
      + '(--corpus-policy | --field-policy <path>) [--out <file>]');
    process.exit(2);
  }

  // ── Which field, and therefore what the number means ────────────────────────────────
  // WS-632/WS-634: the label is derived from the POLICY, never from which flag was used.
  // This block used to set `transferStatus = 'measured-on-this-field'` whenever --field-policy
  // was passed — so handing it the 2009 corpus table printed "76.39bb [measured-on-this-field]"
  // and wrote `comparativeClaim: true`. The flag says which FILE to load; only the file can say
  // what population it measured.
  let policyPath = null;
  if (typeof args['field-policy'] === 'string') {
    policyPath = args['field-policy'];
  } else if (args['corpus-policy']) {
    policyPath = join(REPO, 'out', 'behavior-policy.json');
  } else {
    console.error('REFUSED: no field named. Pass --field-policy <path> for a live claim, or '
      + '--corpus-policy to exercise the machinery against the 2009 corpus (not a live claim).');
    process.exit(2);
  }

  let policy;
  try { policy = JSON.parse(readFileSync(policyPath, 'utf8')); } catch (e) {
    console.error(`REFUSED: policy unreadable at ${policyPath} — ${e.message}`);
    process.exit(1);
  }

  const transferStatus = transferStatusFor(policy);
  if (!transferStatus.population) {
    console.error(`REFUSED: ${policyPath} declares no provenance.population, so what it measured `
      + 'cannot be named. An unnamed population defaults to whatever the reader assumes, which is '
      + 'how a corpus level ends up reported as a live measurement. Re-mine it — both miners '
      + 'stamp it.');
    process.exit(2);
  }

  const read = await readSessionHands(sessionDir);
  const adapted = [];
  for (const record of read.hands) {
    const res = adaptAppRecord(record, { site: 'ignition', stakeLabel: null });
    if (!res.skip) adapted.push({ hand: res.hand ?? res, source: record });
  }

  const seatCounts = new Map();
  for (const h of read.hands) {
    const s = h?.gameState?.mySeat;
    if (s != null) seatCounts.set(Number(s), (seatCounts.get(Number(s)) || 0) + 1);
  }
  const heroSeat = [...seatCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (heroSeat == null) {
    console.error('REFUSED: hero never seated in this session — nothing of his to price.');
    process.exit(1);
  }

  const { ctxs, heroPid, byHandId, idAmbiguity } = heroContexts(adapted, heroSeat);
  if (heroPid == null) {
    console.error(`REFUSED: hero's seat ${heroSeat} carries ${idAmbiguity.length} distinct player `
      + `id(s) across the hands he was seated for (${idAmbiguity.join(', ') || 'none'}). Priced `
      + 'against the wrong id this returns an empty column and a clean 0.00bb total.');
    process.exit(1);
  }

  /**
   * THE DENOMINATOR IS HERO'S WHOLE SESSION, NOT THE PART THAT REACHED THE PRICER.
   *
   * `accumulateDecisions` drops preflop before it emits anything (`entry.street === 'preflop'
   * continue`), so preflop decisions never arrive at `priceSession` to be counted as
   * unpriced. The first cut reported "0 preflop decisions unpriced" on a session where 23 of
   * hero's 37 decisions were preflop — a coverage figure that flattered itself by measuring
   * against what survived the upstream filter rather than against what hero actually did.
   *
   * So the true total is recounted here with `labelDecisions`, the same function
   * `reviewSession` uses for its own hero-decision count, and the gap between the two is
   * reported as the instrument's hole.
   */
  let heroDecisionsTotal = 0;
  const byStreetTotal = {};
  for (const { hand } of adapted) {
    if (String(hand?.gameState?.mySeat) !== String(heroSeat)) continue;
    for (const row of labelDecisions(hand, heroSeat)) {
      heroDecisionsTotal += 1;
      byStreetTotal[row.street] = (byStreetTotal[row.street] || 0) + 1;
    }
  }

  const result = await priceSession({
    ctxs,
    handFor: (ctx) => byHandId.get(ctx.handId) ?? null,
    holeCardsFor: (ctx) => {
      const hand = byHandId.get(ctx.handId);
      // `gameState.showdownCards`, NOT a top-level field. The adapted hand has no top-level
      // `showdownCards`, so the first version read undefined on every hand and every decision
      // came back `cards-unknown` — which reads exactly like a session with no showdowns.
      const sc = hand?.gameState?.showdownCards ?? {};
      const shown = sc[String(heroSeat)] ?? sc[heroSeat];
      return Array.isArray(shown) && shown.length === 2 ? shown : null;
    },
    policy,
  });

  // ── Output ──────────────────────────────────────────────────────────────────────────
  const t = result.totals;
  console.log(`session ${read.manifest?.setId ?? sessionDir}`);
  console.log(`field: ${policyPath}  [${transferStatus.short}]`);
  console.log(`  ${transferStatus.label} — ${transferStatus.population ?? 'population UNDECLARED'}`);
  console.log(`hero seat ${heroSeat} (id ${heroPid}): ${result.coverage.decisionsAttempted} decisions, `
    + `${result.coverage.decisionsPriced} priced, ${result.coverage.decisionsUnpriced} unpriced`);
  console.log(`unpriced: ${JSON.stringify(result.unpriced)}`);
  console.log(`hero's ACTUAL decisions this session: ${heroDecisionsTotal} `
    + `${JSON.stringify(byStreetTotal)}`);
  const covered = heroDecisionsTotal ? result.coverage.decisionsPriced / heroDecisionsTotal : 0;
  console.log(`COVERAGE: ${result.coverage.decisionsPriced}/${heroDecisionsTotal} `
    + `(${(100 * covered).toFixed(1)}%) — the rest never reached the pricer. `
    + `${byStreetTotal.preflop ?? 0} are preflop, which accumulateDecisions drops upstream.`);
  console.log(`SCOPE: ${result.scope.covers}. ${result.scope.removedBy}`);
  console.log('');
  console.log(`EV LEFT ON THE TABLE: ${t.evLeftBB.toFixed(2)}bb over ${t.decisionsPriced} priced decision(s)`);
  /**
   * NOT A PROFIT AND LOSS. Each node's value is priced from the pot AS IT STOOD, so two
   * decisions in the same hand both count that pot and the sum overlaps itself. It is a
   * denominator for the efficiency ratio and nothing else — reading it as "hero won 76bb"
   * would be wrong by construction, and it is labelled here rather than in a comment because
   * the line is what gets quoted.
   */
  console.log(`node-value total (NOT session P&L; pots overlap across streets): hero `
    + `${t.heroValueBB.toFixed(2)}bb vs ceiling ${t.ceilingValueBB.toFixed(2)}bb`);
  console.log(`exploitation efficiency: ${t.exploitationEfficiency == null
    ? 'undefined (nothing was available)' : (100 * t.exploitationEfficiency).toFixed(1) + '%'}`);
  console.log(`agreed with the ceiling on ${t.agreedCount}/${t.decisionsPriced}`);
  console.log(`by street: ${JSON.stringify(t.byStreet)}`);
  console.log(`by action: ${JSON.stringify(t.byAction)}`);

  const worst = [...result.priced].sort((a, b) => b.evLeftBB - a.evLeftBB).slice(0, 10);
  if (worst.length) {
    console.log('\nTHE DECISIONS THAT COST THE MOST');
    for (const p of worst) {
      console.log(`  ${bb(-p.evLeftBB)}bb  ${p.street.padEnd(6)} ${String(p.holeCards.join('')).padEnd(6)}`
        + ` eq ${(100 * p.heroEquity).toFixed(0)}%  ${p.attribution?.detail ?? 'agreed'}`);
    }
  }

  if (typeof args.out === 'string') {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, `${JSON.stringify({
      sessionId: read.manifest?.setId ?? null,
      policyPath,
      transferStatus,
      // A corpus-anchored figure is NOT a comparative claim about a live table, and the
      // artifact says so in a field rather than in prose a consumer can skip.
      comparativeClaim: transferStatus.kind === 'measured',
      ...result,
    }, null, 2)}\n`, 'utf8');
    console.log(`\nwritten to ${args.out}`);
  }
};

if (process.argv[1] && process.argv[1].endsWith('runMoneyColumn.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
