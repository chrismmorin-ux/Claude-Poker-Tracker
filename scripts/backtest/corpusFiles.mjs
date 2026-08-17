/**
 * corpusFiles.mjs — WS-273 corpus discovery.
 *
 * The HandHQ corpus lives OUTSIDE this repo, in a blobless sparse clone at
 * `C:/Users/chris/data/phh-dataset` (git pack retained after the WS-262 mining;
 * blobs are local, so any directory re-materialises with `git sparse-checkout add`
 * and no re-download).
 *
 * Directory names carry the two dimensions we slice on:
 *   data/handhq/PS-2009-07-01_2009-07-23_200NLH_OBFU
 *               ^^                        ^^^^^^
 *               site                      stake label
 */

import { readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';

// WS-504. The allocation/emission primitive is SHARED with the player cap in heroEvRunner —
// see stratifiedSelect.mjs for why fixing one cap without the other is not a fix.
import {
  stratifiedSelect, countByStratum,
  STRATIFIED_SELECTION_VERSION, SELECTION_STRATEGIES, DEFAULT_SELECTION_STRATEGY,
} from './stratifiedSelect.mjs';

/**
 * The G16 location. Kept as the last-resort fallback so nothing on the cockpit changes.
 *
 * WS-321: this used to be the ONLY way the root was resolved, which made every corpus
 * consumer G16-only unless the caller passed --corpus-root on each invocation. That is
 * fine interactively and useless for a scheduled job on CM-NODE1, which is where these
 * runs are headed (HomeBase WS-608/WS-609).
 */
export const G16_CORPUS_ROOT = 'C:/Users/chris/data/phh-dataset/data/handhq';

/** Env var that overrides the default. Named in every error this module throws. */
export const CORPUS_ROOT_ENV = 'HANDHQ_CORPUS_ROOT';

/**
 * Resolve the corpus root for THIS machine.
 *
 * Precedence: explicit argument > `$HANDHQ_CORPUS_ROOT` > the G16 path.
 *
 * Read at call time rather than module load so a caller (or a test) can set the variable
 * after import, and so a long-lived process picks up a change without a reload.
 *
 * @param {string} [explicit] - e.g. a --corpus-root flag value
 * @returns {string}
 */
export const resolveCorpusRoot = (explicit) => {
  if (typeof explicit === 'string' && explicit.length > 0) return explicit;
  const fromEnv = process.env[CORPUS_ROOT_ENV];
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return G16_CORPUS_ROOT;
};

/**
 * @deprecated Use `resolveCorpusRoot()`. Retained because six scripts import it, and as a
 * plain constant it cannot see the environment — importing it is what pinned them to the
 * G16. It is now the fallback value, not the answer.
 */
export const DEFAULT_CORPUS_ROOT = G16_CORPUS_ROOT;

/** The sparse-checkout hint, derived from whichever root actually failed. */
const rematerialiseHint = (root) => {
  // root is .../<clone>/data/handhq — the clone is two levels up.
  const clone = dirname(dirname(root));
  return (
    'The working tree was cleared after the WS-262 mining. Re-materialise a stake\n' +
    'directory with (blobs are already local — no download):\n' +
    `  cd ${clone}\n` +
    '  git sparse-checkout add data/handhq/PS-2009-07-01_2009-07-23_200NLH_OBFU'
  );
};

const DIR_PATTERN = /^([A-Z]+)-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}_(\d+NLH)_OBFU$/;

/**
 * Parse a corpus directory name into { site, stakeLabel }.
 * @returns {{site: string, stakeLabel: string}|null}
 */
export const parseCorpusDir = (name) => {
  const m = DIR_PATTERN.exec(name);
  return m ? { site: m[1], stakeLabel: m[2] } : null;
};

const walkPhhs = async (dir, out) => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walkPhhs(full, out);
    else if (entry.name.endsWith('.phhs')) out.push(full);
  }
  return out;
};

/**
 * Discover corpus files, optionally filtered by site and stake.
 *
 * Throws a directed error when the root is missing or empty rather than silently
 * scoring zero hands — an empty run that reports "no leakage detected" is worse
 * than a failure.
 *
 * @param {Object} [opts]
 * @param {string} [opts.root] - defaults to `resolveCorpusRoot()` (env, then G16 path)
 * @param {string[]|null} [opts.sites] - e.g. ['PS', 'FTP']
 * @param {string[]|null} [opts.stakes] - e.g. ['200NLH']
 * @returns {Promise<Array<{path, site, stakeLabel}>>}
 */
export const discoverCorpusFiles = async ({
  root: explicitRoot,
  sites = null,
  stakes = null,
} = {}) => {
  const root = resolveCorpusRoot(explicitRoot);
  let rootStat;
  try {
    rootStat = await stat(root);
  } catch {
    throw new Error(
      `Corpus root not found: ${root}\n` +
      `Set ${CORPUS_ROOT_ENV} or pass --corpus-root to point at this machine's copy.\n` +
      rematerialiseHint(root),
    );
  }
  if (!rootStat.isDirectory()) {
    throw new Error(
      `Corpus root is not a directory: ${root}\n` +
      `Set ${CORPUS_ROOT_ENV} or pass --corpus-root.`,
    );
  }

  const dirs = (await readdir(root, { withFileTypes: true }))
    .filter(d => d.isDirectory())
    .map(d => ({ name: d.name, meta: parseCorpusDir(d.name) }))
    .filter(d => d.meta)
    .filter(d => !sites || sites.includes(d.meta.site))
    .filter(d => !stakes || stakes.includes(d.meta.stakeLabel));

  const files = [];
  for (const d of dirs) {
    const paths = await walkPhhs(join(root, d.name), []);
    for (const path of paths) {
      // `dir` is the STRATUM (WS-504). Not site+stakeLabel: cm-node1 holds 27 directories and
      // two of them can share a site and a stake while covering different date ranges, so
      // collapsing on site+stake would silently merge two distinct samples into one bucket.
      files.push({ path, dir: d.name, site: d.meta.site, stakeLabel: d.meta.stakeLabel });
    }
  }

  // SORTED, for the same reason buildDealBook sorts its members: directory iteration order
  // is a filesystem detail, not a property of the hand set. The Deal Book sorts before
  // HASHING, which makes the hash machine-independent — but `--max-files` slices THIS list,
  // before the book is built, so an unsorted order meant the same command on two machines
  // scored a different subset of hands while both looked equally legitimate. The differing
  // Deal Book hash was the only symptom, and it reads as "a different slice was requested"
  // rather than "the filesystem picked for you".
  //
  // Sorted on the site/stake-qualified path so the ordering is stable across roots too: a
  // machine whose corpus lives at a different --corpus-root yields the same RELATIVE order.
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  if (files.length === 0) {
    throw new Error(
      `No .phhs files found under ${root}` +
      (sites || stakes ? ` for sites=${sites ?? 'any'} stakes=${stakes ?? 'any'}.` : '.') +
      `\n(root resolved from ${explicitRoot ? '--corpus-root'
        : process.env[CORPUS_ROOT_ENV] ? CORPUS_ROOT_ENV : 'the built-in G16 default'})\n` +
      rematerialiseHint(root),
    );
  }

  return files;
};

/* ────────────────────────────────────────────────────────────────────────────────────────
 * WS-504 — HOW A CAP CHOOSES WHICH FILES TO READ.
 *
 * The list above is sorted by path, and every caller used to cap it with
 * `files.slice(0, maxFiles)`. Directory names lead with the site code, so a sorted PREFIX is
 * a single directory until the cap exceeds that directory's size. Measured on G16
 * (2026-08-17): `{sites:['FTP','PS'], stakes:['50NLH']}` returns 1756 files — FTP 525 then
 * PS 1231, first PS file at index 525. So ANY `--max-files <= 525` was 100% FTP, while the
 * Deal Book was named from the FILTER and therefore called itself `allsites`.
 *
 * This is not a smaller version of the corpus; it is a different population. WS-492 measured a
 * monotone stake gradient across these directories (6-max 3-bet +57% from 25NLH to 1000NLH),
 * so the strata are emphatically not exchangeable.
 *
 * `out/hero-ev-c3-20260816.json` was produced this way: 60 members, 60 of them FTP/50NLH,
 * 4,640 `FTP:` occurrences and zero `PS:`.
 * ──────────────────────────────────────────────────────────────────────────────────────── */

/** Re-exported so corpus callers need only one import. Canonical definitions live in the primitive. */
export const FILE_SELECTION_VERSION = STRATIFIED_SELECTION_VERSION;
export const FILE_SELECTION_STRATEGIES = SELECTION_STRATEGIES;
export const DEFAULT_FILE_SELECTION = DEFAULT_SELECTION_STRATEGY;

/** The stratum. Falls back to site/stake for hand-constructed records that carry no `dir`. */
const stratumOf = (f) => f.dir || `${f.site}/${f.stakeLabel}`;

/**
 * Apply a file cap across the discovered directories instead of down the sorted list.
 *
 * @param {Array<{path,dir,site,stakeLabel}>} files - as returned by `discoverCorpusFiles`
 * @param {Object} [opts]
 * @param {number} [opts.maxFiles] - the cap. Infinity/null/undefined mean "no cap".
 * @param {'proportional'|'prefix'} [opts.strategy]
 * @returns {{files: Array, selection: Object}} `selection` describes the REALISED sample.
 */
export const selectCorpusFiles = (files, { maxFiles = Infinity, strategy = DEFAULT_FILE_SELECTION } = {}) => {
  const { items, selection } = stratifiedSelect(files, { max: maxFiles, keyOf: stratumOf, strategy });
  // `perDirectory` / `missingDirectories` rather than the primitive's generic `perStratum` —
  // for the corpus the stratum IS the directory, and a manifest reader should not have to know
  // the primitive to read the field.
  return {
    files: items,
    selection: {
      strategy: selection.strategy,
      version: selection.version,
      capped: selection.capped,
      discovered: { total: selection.discovered.total, perDirectory: selection.discovered.perStratum },
      realised: { total: selection.realised.total, perDirectory: selection.realised.perStratum },
      collapsed: selection.collapsed,
      missingDirectories: selection.missingStrata,
    },
  };
};

/** Per-directory counts of an arbitrary file list — used to describe a Deal Book's realised members. */
export const corpusComposition = (files) => countByStratum(files ?? [], stratumOf);

/**
 * Select + report, for the ~17 runners that all had the identical four-line cap block.
 *
 * The reporting is the point and is why this is a helper rather than a bare call. Every one of
 * those sites logged `LIMITED to N of M` — a count, which is exactly the thing that looks fine
 * when the sample has silently collapsed onto one directory. Saying WHICH directories were
 * realised is what makes the collapse visible without the reader going and checking.
 *
 * @param {Array} files
 * @param {Object} opts
 * @param {number} [opts.maxFiles]
 * @param {string} [opts.strategy]
 * @param {Function} [opts.log]
 * @param {Function} [opts.warn]
 * @returns {{files: Array, selection: Object}}
 */
export const applyFileCap = (files, {
  maxFiles = Infinity,
  strategy = DEFAULT_FILE_SELECTION,
  log = console.log,
  warn = console.warn,
} = {}) => {
  const result = selectCorpusFiles(files, { maxFiles, strategy });
  const { selection } = result;
  if (selection.capped) {
    log(
      `Corpus scan LIMITED to ${selection.realised.total} of ${selection.discovered.total} ` +
      `matched file(s) [${selection.strategy}] — ${JSON.stringify(selection.realised.perDirectory)}`,
    );
  }
  if (selection.collapsed) {
    warn(
      `WARNING: this cap collapsed the sample onto a strict subset of the discovered directories. ` +
      `Missing: ${selection.missingDirectories.join(', ')}. Any figure from this run describes ` +
      'the directories listed above, not the filter that was requested.',
    );
  }
  return result;
};
