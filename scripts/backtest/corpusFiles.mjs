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
import { join } from 'node:path';

export const DEFAULT_CORPUS_ROOT = 'C:/Users/chris/data/phh-dataset/data/handhq';

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
 * @param {string} [opts.root=DEFAULT_CORPUS_ROOT]
 * @param {string[]|null} [opts.sites] - e.g. ['PS', 'FTP']
 * @param {string[]|null} [opts.stakes] - e.g. ['200NLH']
 * @returns {Promise<Array<{path, site, stakeLabel}>>}
 */
export const discoverCorpusFiles = async ({
  root = DEFAULT_CORPUS_ROOT,
  sites = null,
  stakes = null,
} = {}) => {
  let rootStat;
  try {
    rootStat = await stat(root);
  } catch {
    throw new Error(
      `Corpus root not found: ${root}\n` +
      'The working tree was cleared after the WS-262 mining. Re-materialise a stake\n' +
      'directory with (blobs are already local — no download):\n' +
      '  cd C:/Users/chris/data/phh-dataset\n' +
      '  git sparse-checkout add data/handhq/PS-2009-07-01_2009-07-23_200NLH_OBFU',
    );
  }
  if (!rootStat.isDirectory()) throw new Error(`Corpus root is not a directory: ${root}`);

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
      '\nCheck that the directory is materialised (git sparse-checkout add …).',
    );
  }

  return files;
};
