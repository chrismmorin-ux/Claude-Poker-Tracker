/**
 * dealBook.mjs — a versioned, content-hashed hand set.
 *
 * WHAT THIS REPLACES. Every measurement in this repo currently runs against "whatever
 * `--sites`/`--stakes`/`--max-files` happened to match on the day", and the run records only
 * `config.files` — A COUNT. A count cannot detect that the corpus changed underneath a rerun,
 * cannot prove two arms received the same deals, and cannot be quoted in a replication
 * manifest. `prog-strategy-of-record` names this failure directly: "a corpus slice defined by
 * ad-hoc filtering rather than a Deal Book hash".
 *
 * WHAT THE HASH ACTUALLY GUARANTEES, stated plainly rather than implied.
 *
 * Hashing 1,756 `.phhs` files byte-for-byte is accurate and slow. Hashing their identities is
 * fast and weaker. Both are legitimate; what is NOT legitimate is being vague about which one
 * a given manifest used, because the two support different claims:
 *
 *   identity: 'path+size'  (default) — detects a file being added, removed, replaced, or
 *      truncated. Does NOT detect an edit that preserves byte length. Adequate for a corpus
 *      that is a read-only git checkout, which SRC-012 is.
 *   identity: 'content'    (--hash-members) — detects any change at all. Use when a result
 *      is going to be quoted, or when the corpus is not under version control.
 *
 * The mode is recorded IN the manifest, so a reader can see the strength of the guarantee
 * rather than assume the strong one. That is the same posture `heroEvReport` takes with
 * `rakeIsModelled` and the partial-run stamp: an artifact states its own limits.
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { relative } from 'node:path';

import { hashObjectSync } from './contentHashNode.mjs';

export const DEAL_BOOK_SCHEMA_VERSION = 1;

export const IDENTITY_MODES = Object.freeze(['path+size', 'content']);

const sha256File = (path) => new Promise((resolve, reject) => {
  const h = createHash('sha256');
  createReadStream(path)
    .on('error', reject)
    .on('data', (chunk) => h.update(chunk))
    .on('end', () => resolve(`sha256:${h.digest('hex')}`));
});

/**
 * Describe one member of the book.
 *
 * Paths are stored RELATIVE TO THE CORPUS ROOT. An absolute path would make the hash
 * machine-specific, so the same slice on CM-NODE1 would produce a different Deal Book id than
 * on this machine and two genuinely identical runs would look unreplicable.
 */
const describeMember = async (file, { root, identity }) => {
  const path = relative(root, file.path).replace(/\\/g, '/');
  const base = { path, site: file.site, stakeLabel: file.stakeLabel };
  if (identity === 'content') {
    return { ...base, contentHash: await sha256File(file.path) };
  }
  const s = await stat(file.path);
  return { ...base, bytes: s.size };
};

/**
 * Build a Deal Book manifest.
 *
 * @param {Object} input
 * @param {Array}  input.files - discoverCorpusFiles output, AFTER any --max-files slicing
 * @param {string} input.root - corpus root the paths are relativized against
 * @param {Object} input.sliceSpec - the filter that defined the set (sites, stakes, caps)
 * @param {Object} [input.seeds] - seeds the book itself depends on; {} for a pure corpus slice
 * @param {string} [input.identity] - one of IDENTITY_MODES
 * @param {string} [input.dealBookId] - human-facing name; derived from the slice when omitted
 */
export const buildDealBook = async ({
  files,
  root,
  sliceSpec,
  seeds = {},
  identity = 'path+size',
  dealBookId = null,
} = {}) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('buildDealBook: refusing to build a Deal Book over zero files');
  }
  if (!IDENTITY_MODES.includes(identity)) {
    throw new Error(`buildDealBook: identity must be one of ${IDENTITY_MODES.join(' | ')}`);
  }

  const members = [];
  for (const file of files) {
    members.push(await describeMember(file, { root, identity }));
  }

  // SORTED. Directory iteration order is a filesystem detail, not a property of the hand set,
  // and letting it into the hash would make the same slice hash differently on two machines —
  // which is the exact failure the hash exists to rule out.
  members.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const canonical = { schemaVersion: DEAL_BOOK_SCHEMA_VERSION, identity, sliceSpec, seeds, members };
  const contentHash = hashObjectSync(canonical);

  return {
    schemaVersion: DEAL_BOOK_SCHEMA_VERSION,
    dealBookId: dealBookId ?? deriveDealBookId(sliceSpec, contentHash),
    kind: 'corpus-slice',
    identity,
    sliceSpec,
    members,
    memberCount: members.length,
    seeds,
    contentHash,
  };
};

/**
 * A readable name that still changes when the content does.
 *
 * The hash suffix matters: two slices with identical filters but different underlying files —
 * the corpus grew, a directory was re-materialised — must not share a name, or the Ladder
 * would compare them as if they were the same book.
 */
export const deriveDealBookId = (sliceSpec = {}, contentHash = '') => {
  const parts = [
    (sliceSpec.sites ?? []).join('+') || 'allsites',
    (sliceSpec.stakes ?? []).join('+') || 'allstakes',
  ];
  const short = String(contentHash).replace('sha256:', '').slice(0, 8);
  return `handhq-${parts.join('-')}-${short}`;
};
