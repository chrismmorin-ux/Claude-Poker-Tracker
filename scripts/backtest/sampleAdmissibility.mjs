/**
 * sampleAdmissibility.mjs — does this run's sample describe the population it names? (WS-504)
 *
 * THE DEFECT THIS EXISTS TO SURFACE. `discoverCorpusFiles` returns a PATH-SORTED list, and
 * corpus directory names lead with the site code. A `--max-files N` cap that took the first N
 * therefore read one directory. Measured: `handhq-allsites-50NLH-1c560bcc`, the Deal Book
 * behind RC-depth-ablation and both RC-river-flip-replicate cards, is 300 of 300 files from
 * `FTP-2009-07-01_2009-07-23_50NLH_OBFU`. Zero PokerStars. The book called itself `allsites`
 * because that was the DISCOVERY FILTER, not the realised sample.
 *
 * WHY COLLAPSE IS A BLOCKER AND NOT A WARNING — the distinction is the whole point of this
 * module. A warning is right when the number IS an estimate of the population the card names
 * and something limits its precision: `LOW_ESS`, `TOO_FEW_CLUSTERS_FOR_LEVELS`,
 * `ONLINE_2009_NOT_LIVE`. Each says *this number is about the thing you think, and here is
 * what limits it*.
 *
 * A collapsed sample is not that. WS-492 measured a MONOTONE STAKE GRADIENT across these
 * directories — 6-max 3-bet +57% from 25NLH to 1000NLH, PFR +31% — so the strata are not
 * exchangeable, and a sample omitting one is an estimate of a DIFFERENT POPULATION, not a
 * noisier estimate of the same one. That is `NO_DECISIONS`-class ("vacuous for the stated
 * estimand"), not `LOW_ESS`-class.
 *
 * The counter-argument has to be met head on, because it is nearly right: `deriveDealBookId`
 * now names the realised sample, so the card no longer MIS-STATES its population — why is an
 * honest narrow name not enough to quote? Because `assessAdmissibility`'s verdict is read by
 * `gate.c3Passes`. An honest name stops the card lying; it does not stop a gate criterion
 * ABOUT THE CORPUS from flipping on a sample that is not the corpus. That is the WS-291
 * mechanism exactly — a number locally true, travelling as the answer to a question it did
 * not answer. The verdict has to refuse it, not the label.
 *
 * Founder ruling 2026-08-17, after the cost was measured rather than assumed: zero published
 * cards flip, because the three replication emitters hand-author `{quotable, reasons,
 * caveats}` and never call an admissibility assessor.
 */

/**
 * Sample-composition blockers and warnings for one run.
 *
 * Returns `{blockers, warnings, sampleComposition}` for a caller to merge into its own
 * admissibility verdict. Every consumer of `{admissible, blockers[], warnings[]}` can adopt
 * this in two lines rather than re-deriving the rules and one of them getting it wrong —
 * the same argument `assessAdmissibility` already makes for the corpus caveat.
 *
 * @param {Object|null} stamp - the replication stamp; `stamp.fileSelection` is the subject
 * @param {Object} [config] - the run's snapshot config; supplies the player-cap strata
 */
export const sampleAdmissibility = (stamp, config = {}) => {
  const blockers = [];
  const warnings = [];
  const sel = stamp?.fileSelection ?? null;

  if (!sel) {
    warnings.push({
      code: 'SAMPLE_COMPOSITION_UNRECORDED',
      detail: 'The replication stamp carries no fileSelection, so this artifact cannot say how '
        + 'its cap drew across the corpus directories. Every run before 2026-08-17 took a sorted '
        + 'prefix and therefore read a single directory whenever the cap was below that '
        + "directory's size. A WARNING and not a blocker, for the reason manifest.js gives about "
        + 'disclaimerRegisterVersion: validation of NEW artifacts tightens, PARSING of legacy '
        + 'ones does not — or the artifacts most likely to be contaminated become the ones '
        + 'nothing can open to check.',
    });
  } else if (sel.collapsed) {
    const realised = Object.keys(sel.realised?.perDirectory ?? {});
    const missing = sel.missingDirectories ?? [];
    const discovered = Object.keys(sel.discovered?.perDirectory ?? {}).length
      || (realised.length + missing.length);
    blockers.push({
      code: 'SAMPLE_COLLAPSED',
      detail: `The file cap drew this sample from ${realised.length} of ${discovered} discovered `
        + `corpus directories; ${missing.join(', ')} contributed no files at all. WS-492 measured `
        + 'a monotone stake gradient across these directories, so they are not exchangeable — '
        + 'this is an estimate of a NARROWER POPULATION than the invocation requested, not a '
        + 'noisier estimate of the same one. Raise --max-files to at least the number of '
        + 'discovered directories, or narrow --sites/--stakes to the population you actually mean.',
    });
  }

  if (sel && sel.strategy === 'prefix') {
    warnings.push({
      code: 'LEGACY_PREFIX_SELECTION',
      detail: 'Sample drawn with --file-selection prefix, the pre-WS-504 sorted-prefix behaviour. '
        + 'Corpus directory names lead with the site code, so a prefix reads a single directory '
        + 'until the cap exceeds its size. Legitimate ONLY to replicate a Result Card published '
        + 'before 2026-08-17.',
    });
  }

  // The PLAYER cap is a second, independent way the same thing happens: player keys are
  // `${site}:${pid}` and the enumeration sorts lexicographically, so a prefix exhausts one
  // site before reaching the next. A run can have a perfectly stratified FILE sample and
  // still score only one site's players.
  const missingSites = config?.playerStrataMissing ?? [];
  if (missingSites.length) {
    blockers.push({
      code: 'PLAYER_PLAN_COLLAPSED',
      detail: `The player cap planned no players from ${missingSites.join(', ')}. Whatever the `
        + 'Deal Book contains, this run scored the sites named in config.playerStrataDiscovered '
        + 'and no others — the Deal Book describes what was READ, not what was SCORED.',
    });
  }

  return {
    blockers,
    warnings,
    sampleComposition: sel?.realised?.perDirectory ?? null,
  };
};
