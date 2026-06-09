/**
 * chain-anchors.js — git-tracked anchor log for the shadow event chain.
 *
 * ADR-018 step 1, WS-179. Per §Consequences: "Hash-chain is augmented by a
 * git-anchor file at .claude/workstream/chain-anchors.yaml. Each session-end
 * (or every 100 events, whichever first) commits an anchor record
 * {chain_head, event_count, timestamp, schema_version}."
 *
 * Purpose: git history is the external trust authority that catches silent
 * retroactive event mutation — per-event chains alone cannot. An attacker
 * (or a script bug) that rewrites an old event can regenerate all downstream
 * content_hashes, but the anchor committed to git is frozen.
 *
 * Zero external dependencies.
 */

'use strict';

require('../lib/preflight');

const fs = require('fs');
const path = require('path');

const { findWorkstreamDir } = require('../lib/cwos-utils');

const SCHEMA_VERSION = 1;
const ANCHOR_CADENCE = 100; // write an anchor every N events (ADR-018 §Consequences)

function anchorPath(workstreamDir) {
  const ws = workstreamDir || findWorkstreamDir();
  return path.join(ws, 'chain-anchors.yaml');
}

// ─── Read ──────────────────────────────────────────────────────────────────

/**
 * Parse the anchor file into a list of records. Narrow YAML parser — the
 * file has a known fixed shape (top-level `anchors:` list of 4-field maps),
 * so we don't need the full CWOS parser.
 *
 * Returns [] if the file is absent; throws on malformed.
 */
function readAnchors(workstreamDir) {
  const file = anchorPath(workstreamDir);
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8');
  const anchors = [];
  // Match each `- chain_head: "..."` block. Properties are on consecutive
  // 4-space-indented lines. Order within a block is flexible.
  const blockRe = /-\s+chain_head:\s*"([0-9a-f]{64})"[^\n]*\n((?:\s{4}[a-z_]+:[^\n]*\n?)*)/g;
  let m;
  while ((m = blockRe.exec(raw)) !== null) {
    const chainHead = m[1];
    const body = m[2];
    const rec = { chain_head: chainHead };
    const fieldRe = /\s{4}([a-z_]+):\s*"?([^"\n]+)"?\s*\n?/g;
    let fm;
    while ((fm = fieldRe.exec(body)) !== null) {
      const key = fm[1];
      let val = fm[2].trim().replace(/^"(.*)"$/, '$1');
      if (/^\d+$/.test(val)) val = parseInt(val, 10);
      rec[key] = val;
    }
    anchors.push(rec);
  }
  return anchors;
}

function currentAnchor(workstreamDir) {
  const list = readAnchors(workstreamDir);
  return list.length > 0 ? list[list.length - 1] : null;
}

// ─── Write ─────────────────────────────────────────────────────────────────

/**
 * Append one anchor record. Creates the file with the list header if absent.
 * Accepts { chain_head, event_count, timestamp?, reason? }. Returns the
 * record that was written.
 */
function appendAnchor(workstreamDir, rec) {
  const file = anchorPath(workstreamDir);
  const ws = workstreamDir || findWorkstreamDir();
  fs.mkdirSync(ws, { recursive: true });

  const record = {
    chain_head: rec.chain_head,
    event_count: rec.event_count,
    timestamp: rec.timestamp || new Date().toISOString(),
    schema_version: SCHEMA_VERSION,
  };
  if (rec.reason) record.reason = rec.reason;

  const block = [
    `  - chain_head: "${record.chain_head}"`,
    `    event_count: ${record.event_count}`,
    `    timestamp: "${record.timestamp}"`,
    `    schema_version: ${record.schema_version}`,
    record.reason ? `    reason: "${record.reason}"` : null,
    '',
  ].filter((l) => l !== null).join('\n');

  if (!fs.existsSync(file)) {
    const header = '# Chain anchors — git-tracked trust surface for the shadow event log.\n'
      + '# See ADR-018 §Consequences. Each entry is the chain head at the time of\n'
      + '# either session-end or every ' + ANCHOR_CADENCE + ' events, whichever came first.\n\n'
      + 'anchors:\n';
    fs.writeFileSync(file, header + block, 'utf8');
  } else {
    fs.appendFileSync(file, block, 'utf8');
  }
  return record;
}

// ─── Cadence decision ──────────────────────────────────────────────────────

/**
 * Whether a new anchor should be written right now. True when no anchor
 * exists yet (bootstrap) OR when the current event count exceeds the last
 * anchor's event_count by at least ANCHOR_CADENCE.
 */
function shouldAnchor(currentEventCount, lastAnchor) {
  if (!Number.isInteger(currentEventCount) || currentEventCount <= 0) return false;
  if (!lastAnchor) return true;
  const lastCount = Number(lastAnchor.event_count) || 0;
  return (currentEventCount - lastCount) >= ANCHOR_CADENCE;
}

// ─── Verification ──────────────────────────────────────────────────────────

/**
 * Verify the latest anchor against the current chain.
 *
 * The anchor file is a lagging checkpoint — anchors fire every
 * ANCHOR_CADENCE events, so "anchored hash != current head" is the
 * normal case between checkpoints, not a violation. The real invariant
 * is: **the anchored hash must appear somewhere in the chain history**.
 * A retroactively mutated event would change its own content_hash and
 * every downstream prior_hash; the anchored value would then be absent
 * from history — the signal this check detects.
 *
 * Callers pass `allEventHashes` (an array of every content_hash in
 * chain order, oldest first) so this function doesn't need to re-read
 * the events log. `currentChainHead` is the last element of that array
 * (or the empty-chain marker).
 */
function verifyLatestAnchor(workstreamDir, currentChainHead, allEventHashes) {
  const latest = currentAnchor(workstreamDir);
  if (!latest) return { ok: true, anchored: null, current: currentChainHead, reason: 'no-anchors' };
  if (latest.chain_head === currentChainHead) {
    return { ok: true, anchored: latest.chain_head, current: currentChainHead };
  }
  // Between-cadence drift is allowed: the anchored head must appear in the
  // history of hashes. If the caller didn't pass the hash list, we can only
  // check equality (strict mode — kept for back-compat but not used by
  // events.fsck after WS-179).
  if (Array.isArray(allEventHashes)) {
    if (allEventHashes.indexOf(latest.chain_head) !== -1) {
      return { ok: true, anchored: latest.chain_head, current: currentChainHead, reason: 'lagging' };
    }
  }
  return {
    ok: false,
    reason: 'anchor-mismatch',
    anchored: latest.chain_head,
    current: currentChainHead,
  };
}

module.exports = {
  SCHEMA_VERSION,
  ANCHOR_CADENCE,
  anchorPath,
  readAnchors,
  currentAnchor,
  appendAnchor,
  shouldAnchor,
  verifyLatestAnchor,
};
