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
      files.push({ path, site: d.meta.site, stakeLabel: d.meta.stakeLabel });
    }
  }

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
