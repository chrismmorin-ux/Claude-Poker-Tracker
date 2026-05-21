/**
 * corpusIndex.js — Build the in-memory index of upper-surface
 * reasoning artifacts + LSW line nodes that the resolver matches
 * against.
 *
 * Loaded once at PWA boot via `import.meta.glob` (for upper-surface
 * markdown) + static import (for LSW lines.js). The index is memoized;
 * `getCorpusIndex()` returns the same object across calls within a
 * session. Per SPOT-KEY spike line 145.
 *
 * Coach-review-session persona depends on offline corpus availability
 * per HRP Gate 2 Stage C rule 7. PWA-boot indexing satisfies that —
 * the corpus loads at module-init time, which runs once when the
 * service worker hands the bundle to the page.
 *
 * SLS Stream E — SPR-087 / WS-193.
 */

import { LINES } from '../postflopDrillContent/lines';
import { toBoardShorthand } from './boardShorthand';

/**
 * Upper-surface artifact filename canonical encoding (per spike line 31):
 *   <hero-pos>-vs-<villain-pos>-<pot-type>-<ip/oop>-<texture>-<board-shorthand>-<node-name>.md
 *
 * The pot-type segment can contain hyphens internally ('srp-3way',
 * '3bp-3way', 'srp-4way'). The board-shorthand segment is lowercase
 * ('t96ss', 'q72r', 'k77'). The node-name segment can also contain
 * underscores ('flop_root', 'river_after_turn_call').
 *
 * Parse strategy: split on '-vs-' to separate hero from the rest;
 * then split the remainder by '-' and re-assemble pot-type segments
 * by detecting the canonical POT_TYPES enum. This is fragile but the
 * corpus is small (6 files in v1) and any new file naming-convention
 * drift is intentional — corpus authors must match the convention.
 */
const POT_TYPE_ENUMS = [
  'srp-4way', '3bp-3way', 'srp-3way', // multi-word first to avoid greedy match
  'srp', '3bp', '4bp', 'limped',
];

/**
 * Parse a canonical upper-surface filename into a CorpusEntry.
 * Returns null if the filename doesn't match the convention.
 *
 * Example input: 'btn-vs-bb-3bp-ip-wet-t96-flop_root.md'
 */
const parseUpperSurfaceFilename = (filename) => {
  if (typeof filename !== 'string') return null;
  // Strip directory path + .md extension
  const base = filename.replace(/^.*\//, '').replace(/\.md$/i, '');

  // Split on '-vs-' first
  const vsIdx = base.indexOf('-vs-');
  if (vsIdx === -1) return null;
  const heroPos = base.slice(0, vsIdx).toUpperCase();
  const rest = base.slice(vsIdx + 4); // skip '-vs-'

  // Now rest is '<villain-pos>-<pot-type>-<ip/oop>-<texture>-<board>-<node>'
  // villain-pos is single token ending at first '-'
  const parts = rest.split('-');
  if (parts.length < 5) return null;
  const villainPos = parts[0].toUpperCase();
  let cursor = 1;

  // Pot-type: greedy multi-word match
  let potType = null;
  for (const candidate of POT_TYPE_ENUMS) {
    const candidateParts = candidate.split('-');
    if (cursor + candidateParts.length <= parts.length) {
      const segment = parts.slice(cursor, cursor + candidateParts.length).join('-');
      if (segment === candidate) {
        potType = candidate;
        cursor += candidateParts.length;
        break;
      }
    }
  }
  if (!potType) return null;

  // ip/oop
  if (cursor >= parts.length) return null;
  const ipOop = parts[cursor];
  if (ipOop !== 'ip' && ipOop !== 'oop' && ipOop !== 'mw') return null;
  cursor += 1;

  // texture
  if (cursor >= parts.length) return null;
  const texture = parts[cursor];
  if (!['wet', 'medium', 'dry', 'paired'].includes(texture)) return null;
  cursor += 1;

  // board shorthand: lowercase token, may contain digits + 'ss'/'r'/'mono'
  if (cursor >= parts.length) return null;
  const boardShorthand = parts[cursor];
  cursor += 1;

  // node-name: remaining tokens joined by '-' (most are single tokens like
  // 'flop_root' but some lines use multi-token names like 'river_after_turn_call')
  if (cursor >= parts.length) return null;
  const nodeId = parts.slice(cursor).join('-');

  return {
    artifactId: base,
    source: 'upper-surface',
    heroPos,
    villainPos,
    potType,
    ipOop,
    texture,
    boardShorthand,
    nodeId,
    sprBucket: null, // upper-surface filenames don't encode SPR; matcher tolerates
    effStack: null,
  };
};

/**
 * Build a CorpusEntry from an LSW line + node.
 * Returns null if essential fields can't be extracted.
 */
const buildLswEntry = (line, node) => {
  if (!line || !node) return null;
  const setup = line.setup || {};
  const heroPos = (setup.hero?.position || '').toUpperCase();
  const villainPos = (setup.villains?.[0]?.position || '').toUpperCase();
  if (!heroPos || !villainPos) return null;

  // ipOop: derived from line tags or computed from positions. Lines.js
  // tags include 'ip' or 'oop' for HU lines and 'mw' for multiway.
  const tags = Array.isArray(line.tags) ? line.tags : [];
  let ipOop = 'oop';
  if (tags.includes('ip')) ipOop = 'ip';
  else if (tags.includes('mw')) ipOop = 'mw';

  // texture: derived from tags ('wet' / 'medium' / 'dry' / 'paired')
  let texture = 'medium';
  if (tags.includes('wet')) texture = 'wet';
  else if (tags.includes('dry')) texture = 'dry';
  else if (tags.includes('paired')) texture = 'paired';

  // boardShorthand: compute from the node's board if present, else from
  // the line.id (which encodes the board: 'btn-vs-bb-3bp-ip-wet-t96')
  let boardShorthand = node.board ? toBoardShorthand(node.board) : null;
  if (!boardShorthand) {
    // Fall back: parse from line.id last segment (heuristic)
    const idSegs = line.id.split('-');
    boardShorthand = idSegs[idSegs.length - 1] || null;
  }
  // Normalize boardShorthand to lowercase (matches filename convention)
  if (boardShorthand) boardShorthand = boardShorthand.toLowerCase();

  return {
    artifactId: `${line.id}/${node.id}`,
    source: 'lsw',
    heroPos,
    villainPos,
    potType: setup.potType || null,
    ipOop,
    texture,
    boardShorthand,
    nodeId: node.id,
    sprBucket: null, // LSW nodes don't pre-tag SPR; matcher tolerates
    effStack: setup.effStack || null,
  };
};

// ─── Build-once memoized index ────────────────────────────────────────

let _cachedIndex = null;

/**
 * Build the corpus index by combining upper-surface filename parses +
 * LSW line+node entries. Called once at first `getCorpusIndex()` call.
 */
const buildIndex = () => {
  const entries = [];

  // Upper-surface artifacts — eager-loaded via Vite's import.meta.glob.
  // Path is relative to this file (src/utils/spotResolver/) → up 3
  // levels to repo root, then docs/upper-surface/reasoning-artifacts/.
  const upperSurfaceFiles = import.meta.glob(
    '../../../docs/upper-surface/reasoning-artifacts/*.md',
    { eager: true, query: '?raw', import: 'default' },
  );
  for (const [path] of Object.entries(upperSurfaceFiles)) {
    const entry = parseUpperSurfaceFilename(path);
    if (entry) entries.push(entry);
    // Silent skip on parse failure — drift surfaces in tests, not at runtime
  }

  // LSW lines — iterate every line × every node
  for (const line of LINES) {
    if (!line || !line.nodes) continue;
    for (const nodeId of Object.keys(line.nodes)) {
      const node = line.nodes[nodeId];
      // Skip preflop / terminal nodes — only decision nodes match
      if (!node) continue;
      if (node.street !== 'flop' && node.street !== 'turn' && node.street !== 'river') continue;
      if (typeof nodeId === 'string' && nodeId.startsWith('terminal_')) continue;
      const entry = buildLswEntry(line, node);
      if (entry) entries.push(entry);
    }
  }

  return entries;
};

/**
 * @returns {Array<CorpusEntry>} - memoized; identity-stable across calls.
 */
export const getCorpusIndex = () => {
  if (_cachedIndex === null) {
    _cachedIndex = buildIndex();
  }
  return _cachedIndex;
};

/**
 * Diagnostic accessor — returns all entries regardless of source.
 * Used by tests + future debug surfaces.
 */
export const getAllCorpusEntries = () => getCorpusIndex().slice();

/**
 * Test-only reset (not exported for production callers).
 * @internal
 */
export const _resetCorpusIndexForTests = () => {
  _cachedIndex = null;
};

/**
 * Exported for tests that need to exercise the filename parser
 * independently of the full index build.
 * @internal
 */
export const _parseUpperSurfaceFilenameForTests = parseUpperSurfaceFilename;
