/**
 * dumpLeaf - cut one leaf of the induced ruleset out as a standalone table.
 *
 * FOUNDER, 2026-08-18: "we're seeing a few 'not sure whats going on there'. Invoke an agent and
 * tell it to explain the behavior, giving just that subset of data."
 *
 * The point of giving an agent ONLY the subset is that it cannot inherit the framing that
 * produced the puzzle. An agent handed the whole profile plus my reading of it would return my
 * reading back, which is the failure `.claude/rules/dispatch-dont-assert.md` exists to stop:
 * recall-then-reconstruct presenting as independent analysis. So each file below carries the
 * decisions, the legend, and nothing else - no rule text, no verdict, no hypothesis.
 *
 *   node scripts/villainArchetype/dumpLeaf.mjs         writes every leaf, one file each
 *   LEAVES=3,7 node scripts/villainArchetype/dumpLeaf.mjs   only those leaf indices
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadVillain } from './loadVillain.mjs';
import { induce } from './induceCore.mjs';
import { enrichDecisions } from './enrichDecisions.mjs';
import { toRow, renderTable, legend, header, SCHEMA_VERSION } from './decisionSchema.mjs';

const MAX_FILES = Number(process.env.MAX_FILES || 120);
const OUT = process.env.OUT || '.tmp-arch/leaves';
const ONLY = process.env.LEAVES ? new Set(process.env.LEAVES.split(',').map(Number)) : null;

// One shared loader: this file re-typed the naive load and inherited its 4GB OOM verbatim.
const { pid, decisions } = await loadVillain({
  maxFiles: MAX_FILES,
  villain: process.env.VILLAIN || null,
  rank: Number(process.env.RANK || 1),
});
console.log(`villain ${pid} - ${decisions.length} decisions`);

/** How many were dealt in, as counts - so the brief states the game rather than assuming it. */
const tableSizes = (pool) => {
  const m = new Map();
  for (const d of pool) m.set(d.seatsDealt, (m.get(d.seatsDealt) || 0) + 1);
  return [...m.entries()].sort((a, b) => a[0] - b[0])
    .map(([k, v]) => `${k}-handed ${(100 * v / pool.length).toFixed(0)}%`).join(', ');
};

/**
 * ENRICH BEFORE INDUCING, or these are not the dossier’s leaves.
 *
 * This step was missing, and the effect was not cosmetic. The inducer splits on the `str_*`
 * columns, so without them it produced a DIFFERENT ruleset from the one the profile emits -
 * measured on villain 2, four of the nine rules needing an explanation had no leaf here with
 * the same population, and two pairs of distinct rules collided onto one file.
 *
 * These files are the briefs an explainer agent is given, and `buildDossier` matches the
 * answer back to a rule by its condition string. A mismatched dump therefore lets the
 * "nothing unexplained may ship" gate be satisfied by an explanation of another spot.
 */
enrichDecisions(decisions);

const { rules } = induce(decisions);
mkdirSync(OUT, { recursive: true });
const sorted = rules.sort((a, b) => b.n - a.n);

sorted.forEach((r, i) => {
  if (ONLY && !ONLY.has(i)) return;
  // Every decision in the leaf, sorted so a reader scans hand by hand rather than at random.
  const pool = [...r.pool].sort((a, b) => String(a.handId).localeCompare(String(b.handId)));
  const body = [
    `ONE PLAYER, ONE KIND OF SPOT. ${r.n} decisions, schema v${SCHEMA_VERSION}.`,
    '',
    // TABLE SIZE IS READ FROM THE ROWS, NEVER ASSERTED. This line used to say "9-handed" for
    // every villain. The first villain profiled played 4-, 5- and 6-handed and not one hand of
    // 9-handed, so every explainer agent was told the wrong game before it read a single row -
    // and table size is exactly what decides what a position means and how wide a range should
    // be. A brief that misstates the game produces confident, wrong explanations.
    `Every row is one decision this player faced, in online cash games, 50NL, 2009.`,
    `Table sizes in this leaf: ${tableSizes(pool)}.`,
    'The rows are all the decisions he took in this one kind of spot - nothing',
    'has been filtered for interest. The ACTION column is what he did.',
    '',
    'What is knowable and what is not:',
    '  - every SITUATION column was visible to him at the moment he acted',
    '  - the `cards` and `made_hand` columns are filled in ONLY when the hand went to a',
    '    showdown and was turned face up. HE KNEW HIS OWN CARDS ON EVERY ROW - the blanks are',
    '    OUR ignorance, not his, and they are blank because most hands never reach a showdown.',
    '    So they are the one input driving him that you cannot see, and the rows where they are',
    '    filled are SURVIVOR-FILTERED: a hand reaches showdown by continuing, so strong holdings',
    '    are over-represented among the revealed ones.',
    '  - `made_hand` needs a board, so it is blank on every preflop row even where `cards` is',
    '    filled. That is the field being inapplicable, not a hand that failed to make anything.',
    '',
    'LEGEND',
    legend(),
    '',
    'DECISIONS',
    renderTable(pool.map(toRow)),
  ].join('\n');
  const path = `${OUT}/leaf-${String(i).padStart(2, '0')}.txt`;
  writeFileSync(path, body);

  /**
   * THE MACHINE-READABLE TWIN (leaf-tsv-twin), and it exists because an agent hit the hazard.
   *
   * The aligned table above is for a person's eye and is NOT parseable by splitting on
   * whitespace: `facing` carries values like "no raise", so the header tokenises to 55 fields
   * and every data row to 56. An agent that split naively read ACTION out of `can_raise`, saw
   * the constant "yes", and was on course to report that nothing in the leaf separates
   * anything - a null result manufactured entirely by the file format, and indistinguishable
   * from a real one. Tabs cannot collide with the values, so this removes the failure mode
   * rather than warning about it.
   */
  const cols = header();
  const tsvRows = pool.map(toRow).map((r) => cols.map((c) => r[c] ?? '-').join('\t'));
  writeFileSync(`${OUT}/leaf-${String(i).padStart(2, '0')}.tsv`,
    [cols.join('\t'), ...tsvRows].join('\n'));
  console.log(`${path}  n=${r.n}  ${r.conds.map(c => c.value).join(' AND ') || 'everything else'}`);
});
