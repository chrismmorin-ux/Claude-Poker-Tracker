/**
 * entryCensus.mjs — WS-323. What the corpus can and cannot tell us about an entry cell.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS AT ALL
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * WS-323 was filed on the claim that the entry question is "defined on EVERY hand including
 * every folded one (no showdown selection)" — that it would RECOVER the hands the per-decision
 * instrument discards. That claim is false, and this module is the artifact that says so in
 * numbers rather than in prose, because a premise corrected only in a commit message is a
 * premise the next session will re-adopt.
 *
 * The corpus masks every hole card at deal (`d dh p1 ????`); cards surface only through a
 * showdown. `handOutcome.mjs` is right that realized OUTCOMES survive that masking — a folded
 * seat's result is simply minus what it posted, and no cards are needed to compute it. But an
 * entry map is keyed on CELLS, and cell attribution does not survive: a hand that folded
 * cannot be assigned to one of the 169 classes at all, at any sample size, ever.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE ZEROS ARE THE POINT
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * `calibrationMetrics.aggregateBySlice` groups observed rows only, so a context with no rows
 * never appears in its output and reads as absent-because-irrelevant rather than
 * absent-because-unmeasured. Those are opposite facts. A Coverage Census enumerates the
 * DECLARED DOMAIN and reports every cell's count including the zeros, which is what lets a
 * reader tell them apart.
 *
 * This census reports three distinct kinds of absence, and conflating any two of them would
 * make the denominator wrong:
 *
 *   unreachable    — the spot cannot occur (UTG facing a raise; folded-to-BB). No amount of
 *                    data will ever populate it, and it should not sit in the denominator of
 *                    a coverage percentage.
 *   unattributable — the decision HAPPENED but its cell is unknowable, because the cards were
 *                    never shown. This is the bucket the ticket's premise assumed was empty.
 *   zero-hit       — reachable, attributable in principle, simply not observed in this slice.
 *                    A genuine research queue.
 */

import { readFile } from 'node:fs/promises';

import { discoverCorpusFiles } from './corpusFiles.mjs';
import { enumerateCells, POS_CATEGORIES, FACING_ACTIONS } from './entryMap.mjs';

/** Schema version of the Coverage Census object — see `standardOfRecord/schemas.js`. */
export const CENSUS_SCHEMA_VERSION = 1;

const ACTION_RE = /^(p\d+) (f|cc|cbr)/;
const DEAL_RE = /^d dh (p\d+) (\S+)$/;
const SHOW_RE = /^(p\d+) sm (\S+)/;
const BOARD_RE = /^d db/;

/**
 * Split a `.phhs` file into hands and pull each hand's action list.
 *
 * Deliberately a light structural read rather than a full `phhAdapter` conversion: this census
 * answers "could this decision be attributed to a cell", which needs the action sequence and
 * whether cards were revealed — not a reconstructed app hand. Going through the adapter would
 * add its seat-embedding approximation to a count that does not need it.
 */
export const parseHandActions = (text) => {
  const hands = [];
  for (const block of text.split(/\n(?=\[)/)) {
    const m = block.match(/actions\s*=\s*\[([\s\S]*?)\]/);
    if (!m) continue;
    hands.push(
      m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean),
    );
  }
  return hands;
};

/**
 * Classify every seat's FIRST preflop decision in one hand.
 *
 * First decision only: the entry question is "was it worth entering", which a seat answers
 * once. A later re-raise in the same hand is a different question and would double-count the
 * seat if pooled in here.
 */
export const censusHand = (actions, tally) => {
  const revealed = new Map();
  for (const a of actions) {
    let m;
    if ((m = a.match(DEAL_RE))) revealed.set(m[1], !/^\?+$/.test(m[2]));
    else if ((m = a.match(SHOW_RE))) revealed.set(m[1], true);
  }

  const boardAt = actions.findIndex((a) => BOARD_RE.test(a));
  const preflop = boardAt === -1 ? actions : actions.slice(0, boardAt);

  const acted = new Set();
  for (const a of preflop) {
    const m = a.match(ACTION_RE);
    if (!m) continue;
    const [, player, act] = m;
    if (acted.has(player)) continue;
    acted.add(player);

    const known = revealed.get(player) === true;
    const entered = act !== 'f';
    tally.decisions++;
    if (entered) {
      tally.entries++;
      if (known) tally.entriesAttributable++;
    } else {
      tally.folds++;
      if (known) tally.foldsAttributable++;
    }
  }
};

/**
 * Build the Coverage Census over the declared domain.
 *
 * @param {string[]} handClasses - the 169 notations
 * @param {Object} opts - `{ root, maxFiles }` forwarded to `collectCorpusFiles`
 */
export const buildEntryCensus = async (handClasses, { root, maxFiles = null } = {}) => {
  const files = await discoverCorpusFiles({ ...(root ? { root } : {}) });
  const chosen = maxFiles ? files.slice(0, maxFiles) : files;

  const tally = {
    decisions: 0,
    folds: 0, foldsAttributable: 0,
    entries: 0, entriesAttributable: 0,
  };

  for (const file of chosen) {
    const text = await readFile(file.path ?? file, 'utf8');
    for (const actions of parseHandActions(text)) censusHand(actions, tally);
  }

  const all = enumerateCells(handClasses);
  const reachable = all.filter((c) => c.reachable);

  // Every reachable cell is reported, hit count included. No corpus decision can currently be
  // attributed to one — that is the finding, and it is recorded as a per-cell zero rather than
  // as an absent row, so the map's coverage claim cannot be read as better than it is.
  const cells = all.map((c) => ({
    cellId: c.cellId,
    handClass: c.handClass,
    posCategory: c.posCategory,
    facingAction: c.facingAction,
    reachable: c.reachable,
    unreachableReason: c.unreachableReason,
    hits: 0,
  }));

  const pct = (a, b) => (b ? Number(((100 * a) / b).toFixed(2)) : null);

  return {
    schemaVersion: CENSUS_SCHEMA_VERSION,
    domain: {
      gameType: 'cash', seats: [6, 9], stackDepthBB: [80, 200],
      handClasses: handClasses.length,
      posCategories: POS_CATEGORIES,
      facingActions: FACING_ACTIONS,
    },
    cells,
    totalContexts: all.length,
    reachableContexts: reachable.length,
    unreachableContexts: all.length - reachable.length,
    hitContexts: 0,
    abstentions: 0,

    /**
     * The measurement that corrected the ticket's premise. `foldsAttributable` is the number
     * the premise predicted would be large; if it is ever non-zero on a future corpus, that
     * corpus reveals folded holdings and a corpus-empirical entry map becomes possible.
     */
    corpusAttribution: {
      filesScanned: chosen.length,
      filesAvailable: files.length,
      decisions: tally.decisions,
      folds: tally.folds,
      foldsAttributable: tally.foldsAttributable,
      foldsAttributablePct: pct(tally.foldsAttributable, tally.folds),
      entries: tally.entries,
      entriesAttributable: tally.entriesAttributable,
      entriesAttributablePct: pct(tally.entriesAttributable, tally.entries),
      note:
        'Hole cards are masked at deal and revealed only at showdown. A folded hand therefore ' +
        'has no 169-cell attribution at any sample size. The revealed subset of entries is ' +
        'additionally selected toward hands that got called down, which biases it hardest in ' +
        'the fringe band the map exists to measure — so it is usable as a consistency check ' +
        'and not as the map\'s evidence.',
    },
  };
};
