/**
 * loadVillain — the ONE way this directory reads a villain out of the corpus.
 *
 * WHY IT IS SHARED RATHER THAN COPIED. The naive load holds every parsed hand in memory so it
 * can rank players by hand count and only then pick one. That is fine on a 120-file slice and
 * fatal on the full corpus: it dies with `Ineffective mark-compacts near heap limit` at ~4GB,
 * having read 1,756 files to build a list of which it needs about 70.
 *
 * The damage is not the crash. It is a SILENT CEILING ON EVIDENCE — a run that "works" because
 * someone capped MAX_FILES reports figures from 6.8% of the corpus with nothing in the output
 * saying so. That is how the first villain profiled ended up with an opening ladder measured on
 * a slice, and with the wrong player ranked first.
 *
 * It was fixed in `profileVillain`, then recurred verbatim in `dumpLeaf`, because each script
 * re-typed the same twelve lines. Four call sites, one of them wrong, is a copy problem, so the
 * fix is a module rather than another patch.
 *
 * TWO PASSES. Pass 1 counts and retains nothing. Pass 2 re-reads and keeps only the hands the
 * chosen villain sat in. Memory is O(his hands), not O(corpus), so MAX_FILES exists to make a
 * run quick and never to make it possible. When the villain is named, pass 1 is skipped
 * entirely.
 */
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';
import { resolveHandOutcome } from '../backtest/handOutcome.mjs';

/**
 * @param {Object}  opts
 * @param {number}  opts.maxFiles  cap on files scanned (speed only — never correctness)
 * @param {string}  opts.villain   player id; when absent, ranked by hand count
 * @param {number}  opts.rank      1 = most hands, used only when `villain` is absent
 * @returns {{pid, files, decisions, handsOfVillain, fileOfHand, byHand}}
 */
export const loadVillain = async ({ maxFiles = 2000, villain = null, rank = 1 } = {}) => {
  const root = resolveCorpusRoot();
  const { files } = selectCorpusFiles(await discoverCorpusFiles({ root }), { maxFiles });

  let pid = villain;
  if (!pid) {
    const counts = new Map();
    for (const f of files) {
      for await (const h of iterAppHands(f.path)) {
        for (const p of Object.values(h.seatPlayers || {})) counts.set(p, (counts.get(p) || 0) + 1);
      }
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (!ranked[rank - 1]) throw new Error(`loadVillain: no villain at rank ${rank}`);
    pid = ranked[rank - 1][0];
  }

  // WHICH FILE each hand came from. The card's provenance must describe the hands it CONTAINS,
  // not the slice that was scanned: villain 1's hands are all PokerStars while the scan also
  // covered Full Tilt, and stamping the scan's sites would put a site on his card he never
  // played on.
  const fileOfHand = new Map();
  const decisions = [];
  const handsOfVillain = [];
  const byHand = new Map();
  for (const f of files) {
    for await (const h of iterAppHands(f.path)) {
      const seat = Object.entries(h.seatPlayers || {}).find(([, p]) => p === pid)?.[0];
      if (!seat) continue;
      const ds = labelDecisions(h, seat);
      /**
       * THE REALIZED OUTCOME, attached here because this is the only place that holds both
       * the hand and its decisions. Derived - the corpus records no pot award, but the award
       * follows from the action sequence, the board and whatever was shown, which is exactly
       * what `handOutcome` reconstructs (side pots, uncalled returns and all).
       *
       * It NEVER guesses: an underivable hand comes back `{resolved:false, reason}` and every
       * outcome column on its rows stays blank rather than being filled with a plausible
       * number. A blank is a fact about the record; an estimate would be a fact about us.
       *
       * Every column it feeds is in the `outcome` group, so the induction cannot condition on
       * it - conditioning a rule on how the hand turned out is fitting the future, and the
       * gate that holds `cards` and `made_hand` out enumerates the group dynamically, so it
       * covers these the moment they exist.
       */
      const outcome = resolveHandOutcome(h);
      for (const d of ds) {
        d.outcome = outcome.resolved
          ? {
            net: outcome.netBySeat?.[seat] ?? null,
            won: Array.isArray(outcome.winners) ? outcome.winners.map(String).includes(String(seat)) : null,
            potBB: outcome.potBB ?? null,
            wentToShowdown: !!outcome.wentToShowdown,
          }
          : { unresolved: outcome.reason };
      }
      fileOfHand.set(h, f.path);
      handsOfVillain.push({ h, seat });
      decisions.push(...ds);
      if (ds.length) byHand.set(h.handId ?? `${byHand.size}`, ds);
    }
  }
  return { pid, files, decisions, handsOfVillain, fileOfHand, byHand };
};
