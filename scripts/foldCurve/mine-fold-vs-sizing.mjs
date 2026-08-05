/**
 * WS-283 fold-curve fit — corpus pass
 *
 * WHY THIS LIVES HERE AND NOT IN `scripts/backtest/`. That directory is the WS-273 villain
 * PREDICTION harness. This is a different instrument measuring a different quantity: the
 * population fold-to-bet response as a function of bet size, which `queryActionDistribution`
 * — everything `scripts/backtest/run.mjs` scores — does not take as an input at all. Filing
 * it next to the harness would invite the two to be read as the same measurement.
 *
 * It imports `scripts/backtest/` modules read-only (`phhAdapter`, `corpusFiles`, `partition`,
 * `dealBook`, `replicationStamp`, `loader`) rather than re-deriving the corpus conventions —
 * the pot convention in particular is one that silently corrupts everything downstream when
 * two copies drift.
 *
 * Run order, from the repo root:
 *
 *   node scripts/foldCurve/mine-fold-vs-sizing.mjs      # ~7 min, writes fold-vs-sizing.json
 *   node scripts/foldCurve/fit-fold-curve.mjs           # ~2 min, prints the residual tables
 *   node scripts/foldCurve/emit-result-card.mjs         # writes the Result Card
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { writeFileSync } from 'node:fs';

// Repo root. Run these from the repo root; the loader resolves `/src/...` against it.
const REPO = process.cwd().split(String.fromCharCode(92)).join('/');
const { openLoader } = await import(`file:///${REPO}/scripts/backtest/loader.mjs`);
const loader = await openLoader(REPO);
const { toAppHand } = await loader.load('/scripts/backtest/phhAdapter.mjs');
const { discoverCorpusFiles } = await loader.load('/scripts/backtest/corpusFiles.mjs');
const { partitionOf, GROUPS } = await loader.load('/scripts/backtest/partition.mjs');
const { PRIMITIVE_ACTIONS } = await loader.load('/src/constants/primitiveActions.js');

const WANTED = new Set([
  'variant', 'antes', 'blinds_or_straddles', 'actions',
  'seats', 'seat_count', 'players', 'hand', 'starting_stacks', 'day',
]);

const parseBracketList = (value) => {
  const open = value.indexOf('['); const close = value.lastIndexOf(']');
  if (open === -1 || close === -1 || close < open) return null;
  const body = value.slice(open + 1, close).trim();
  if (body === '') return [];
  return body.split(',').map(t => t.trim().replace(/^['"]|['"]$/g, ''));
};
const parseNumberList = (v) => {
  const l = parseBracketList(v); if (!l) return null;
  const n = l.map(Number); return n.some(x => !Number.isFinite(x)) ? null : n;
};

/** Same line scan as phhAdapter.iterPhhHands, plus `day` (which it drops). */
async function* iterRaw(filePath) {
  const rl = createInterface({ input: createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });
  let raw = null;
  for await (const line of rl) {
    if (line.startsWith('[')) { if (raw) yield raw; raw = {}; continue; }
    if (!raw) continue;
    const eq = line.indexOf('='); if (eq === -1) continue;
    const key = line.slice(0, eq).trim(); if (!WANTED.has(key)) continue;
    const value = line.slice(eq + 1).trim();
    if (key === 'variant') raw.variant = value.replace(/^['"]|['"]$/g, '');
    else if (key === 'antes') raw.antes = parseNumberList(value);
    else if (key === 'blinds_or_straddles') raw.blinds = parseNumberList(value);
    else if (key === 'starting_stacks') raw.startingStacks = parseNumberList(value);
    else if (key === 'actions') raw.actions = parseBracketList(value);
    else if (key === 'seats') raw.seats = parseNumberList(value);
    else if (key === 'seat_count') raw.seatCount = Number(value);
    else if (key === 'players') raw.players = parseBracketList(value);
    else if (key === 'hand') raw.handId = Number(value);
    else if (key === 'day') raw.day = Number(value);
  }
  if (raw) yield raw;
}

const { BET, RAISE, CALL, FOLD, CHECK } = PRIMITIVE_ACTIONS;

/**
 * Every postflop decision at which a seat faced a live bet/raise.
 * Reconstructs per-street commitments from the action sequence so `owed` is the
 * true price, not the aggressor's total.
 */
const facingBetDecisions = (hand) => {
  const seq = hand.gameState.actionSequence;
  const potBefore = hand._backtest.potBeforeByOrder;
  const bb = hand._backtest.bb;
  const out = [];
  let street = null;
  let committed = new Map();
  let currentBet = 0;
  let aggressorSeat = null;
  let aggressionCount = 0;

  for (const e of seq) {
    if (e.street !== street) { street = e.street; committed = new Map(); currentBet = 0; aggressorSeat = null; aggressionCount = 0; }
    const mine = committed.get(e.seat) || 0;
    const owed = currentBet - mine;

    if (street !== 'preflop' && owed > 1e-9 && e.seat !== aggressorSeat) {
      const potChips = potBefore[e.order];
      if (Number.isFinite(potChips) && potChips > owed + 1e-9) {
        const P0 = potChips - owed;
        out.push({
          playerId: hand.seatPlayers[e.seat],
          street,
          facing: aggressionCount === 1 ? 'bet' : 'raise',
          owedBB: owed / bb,
          potBB: potChips / bb,
          fracEngine: owed / P0,
          fracCorpus: owed / potChips,
          folded: e.action === FOLD ? 1 : 0,
          nLive: null,
        });
      }
    }

    if (e.action === BET || e.action === RAISE) {
      committed.set(e.seat, e.amount);
      currentBet = e.amount;
      aggressorSeat = e.seat;
      aggressionCount++;
    } else if (e.action === CALL) {
      committed.set(e.seat, currentBet);
    } else if (e.action === CHECK) {
      // no change
    }
  }
  return out;
};

// ---------------------------------------------------------------------------

const files = await discoverCorpusFiles({});
files.sort((a, b) => a.path.localeCompare(b.path));
const limitFiles = Number(process.env.MAX_FILES || files.length);
const use = files.slice(0, limitFiles);

/** Fine bins on fracEngine: 0.05 wide to 3.0, then one overflow bin. */
const BIN_W = 0.05, BIN_MAX = 3.0;
const binOf = (f) => (f >= BIN_MAX ? -1 : Math.floor(f / BIN_W));

const cells = new Map(); // key -> { n, folds, sumFrac }
const bump = (key, frac, folded) => {
  let c = cells.get(key);
  if (!c) { c = { n: 0, folds: 0, sumFrac: 0 }; cells.set(key, c); }
  c.n++; c.folds += folded; c.sumFrac += frac;
};

let handsRead = 0, handsSkipped = 0, decisions = 0;
let fileIdx = 0;
for (const f of use) {
  for await (const raw of iterRaw(f.path)) {
    const r = toAppHand(raw, { site: f.site, stakeLabel: f.stakeLabel });
    if (r.skip) { handsSkipped++; continue; }
    handsRead++;
    for (const d of facingBetDecisions(r.hand)) {
      decisions++;
      const group = partitionOf(d.playerId, 50);
      const day = raw.day ?? 0;
      bump(`${group}|${d.site}|${day}|${d.street}|${d.facing}|${binOf(d.fracEngine)}`, d.fracEngine, d.folded);
    }
  }
  fileIdx++;
  if (fileIdx % 100 === 0) console.error(`  ${fileIdx}/${use.length} files, ${handsRead} hands, ${decisions} facing-bet decisions`);
}

console.error(`DONE files=${use.length} hands=${handsRead} skipped=${handsSkipped} decisions=${decisions} cells=${cells.size}`);
writeFileSync(process.env.OUT || 'out/fold-vs-sizing.json', JSON.stringify({
  meta: {
    files: use.length, handsRead, handsSkipped, decisions, poolPct: 50, GROUPS,
    binWidth: BIN_W, binMax: BIN_MAX,
    axis: 'fracEngine = owed / (potIncludingFacedBet - owed)  — the engine\'s logisticFoldResponse `fraction`',
    keyOrder: ['group', 'site', 'day', 'street', 'facing', 'bin'],
  },
  cells: Object.fromEntries(cells),
}));

await loader.close();
