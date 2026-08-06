/**
 * id-allocator — one lock+scan+reserve shape for every id kind CWOS allocates.
 *
 * WS-574. Five id kinds (WS, SPR, FIND, INV, ADR) each need "give me an id
 * nobody else will get". Before this module exactly one of them had a correct
 * implementation and exactly one caller used it; the CLI surface — the one a
 * second process, an autopilot, or a founder actually invokes — took an
 * unlocked scan-for-max path and returned the same id on every consecutive
 * call. Reproduced with three sequential invocations in one shell, no
 * concurrency required. INV ids collided for real on 2026-08-03 when two
 * sessions both allocated INV-067; it was caught by hand during a rebase.
 *
 * ── THE TWO WAYS TO BE SAFE ──────────────────────────────────────────────────
 *
 * 1. **Writer** — caller passes `writer(id)`. The lock spans scan + write, so
 *    the id exists on disk before the lock releases and the next scan sees it.
 *    This is the pre-existing correct pattern (cwos-engine-complete.js) and it
 *    remains the best option whenever the caller is about to write the file.
 *
 * 2. **Reservation** — caller does not write (the CLI hands the id to a human
 *    or another process). The lock spans scan + reserve: the id is recorded in
 *    a ledger that subsequent scans union with what is on disk, so it cannot be
 *    handed out twice. Reservations expire, because an allocation that is never
 *    written is abandoned rather than permanent, and burning ids forever on
 *    abandoned allocations is its own defect.
 *
 * There is no third, unlocked way. The legacy `scan and hope` path is gone.
 *
 * ── WHERE THINGS LIVE ────────────────────────────────────────────────────────
 *
 * Per CLAUDE.md's code-root / state-root split, which is deliberate and which
 * eight scripts previously got wrong: WS / SPR / FIND are **state** and scan
 * under the workstream dir. INV / ADR are **branch content** and scan under the
 * repo root (`system/invariants.md`, `docs/adrs/`). Never derive one root from
 * the other.
 *
 * The reservation ledger itself always lives in the **workstream dir**, even
 * for INV and ADR. That is correct rather than inconsistent: a reservation is
 * coordination between concurrent sessions, and the workstream dir is the one
 * location every session shares (WS-576 made it shared even across worktrees).
 * A ledger in a per-checkout directory would let two worktrees reserve the same
 * INV id, which is the exact bug this module exists to close.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const {
  readYAMLFile,
  writeFileAtomic,
  withFileLock,
} = require('./cwos-utils');

const LEDGER_NAME = 'id-reservations.json';

/** Abandoned reservations expire after this long and the id returns to the pool. */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Source-of-truth scanners, one per kind ─────────────────────────────────
//
// Each returns a Set of integers already in use. They deliberately do NOT share
// an implementation beyond their shape: four different id kinds genuinely read
// four different things — a directory of YAML files, a prose table, numbered
// markdown filenames, an index. Forcing them through one reader is how you get
// a scanner that is subtly wrong for three of the four.

function harvestFilenames(dir, re, into) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const m = re.exec(f);
    if (m) into.add(parseInt(m[1], 10));
  }
}

function harvestIndexIds(indexPath, prefix, into) {
  if (!fs.existsSync(indexPath)) return;
  const r = readYAMLFile(indexPath);
  if (!r.ok || !r.data || !Array.isArray(r.data.items)) return;
  const idRe = new RegExp(`^${prefix}-(\\d+)$`);
  const strRe = new RegExp(`id:\\s*"?(${prefix}-\\d+)"?`);
  for (const item of r.data.items) {
    // cwos-utils parses single-key list items as strings and multi-key items as
    // objects. Both shapes occur in live indexes.
    let idStr = null;
    if (typeof item === 'string') {
      const sm = strRe.exec(item);
      if (sm) idStr = sm[1];
    } else if (item && item.id) {
      idStr = String(item.id);
    }
    const m = idRe.exec(idStr || '');
    if (m) into.add(parseInt(m[1], 10));
  }
}

const KINDS = {
  ws: {
    prefix: 'WS',
    pad: 3,
    root: 'state',
    describe: 'queue + queue/archive + queue-index.yaml',
    scan(wsDir) {
      const ids = new Set();
      const queueDir = path.join(wsDir, 'queue');
      // Pure-numeric only: prefixed variants like WS-MD-027 belong to manual
      // runs and are kept out of the auto-allocated namespace on purpose.
      harvestFilenames(queueDir, /^WS-(\d+)\.yaml$/, ids);
      harvestFilenames(path.join(queueDir, 'archive'), /^WS-(\d+)\.yaml$/, ids);
      harvestIndexIds(path.join(wsDir, 'queue-index.yaml'), 'WS', ids);
      return ids;
    },
  },

  spr: {
    prefix: 'SPR',
    pad: 3,
    root: 'state',
    describe: 'sprints/ + sprints/archive + sprint-index.yaml',
    scan(wsDir) {
      const ids = new Set();
      const dir = path.join(wsDir, 'sprints');
      harvestFilenames(dir, /^SPR-(\d+)\.yaml$/, ids);
      harvestFilenames(path.join(dir, 'archive'), /^SPR-(\d+)\.yaml$/, ids);
      harvestIndexIds(path.join(wsDir, 'sprint-index.yaml'), 'SPR', ids);
      return ids;
    },
  },

  find: {
    prefix: 'FIND',
    pad: 3,
    root: 'state',
    describe: 'findings/ + findings/archive + findings-index.yaml',
    scan(wsDir) {
      const ids = new Set();
      const dir = path.join(wsDir, 'findings');
      harvestFilenames(dir, /^FIND-(\d+)\.yaml$/, ids);
      harvestFilenames(path.join(dir, 'archive'), /^FIND-(\d+)\.yaml$/, ids);
      harvestIndexIds(path.join(wsDir, 'findings-index.yaml'), 'FIND', ids);
      return ids;
    },
  },

  inv: {
    prefix: 'INV',
    pad: 3,
    root: 'code',
    describe: 'system/invariants.md (prose table) + kit/declarations.yaml',
    scan(repoRoot, opts = {}) {
      const ids = new Set();
      // invariants.md is a prose table, not structured data — every INV-NNN
      // token anywhere in it counts, including cross-references. Over-counting
      // is safe here (it only pushes the next id higher); under-counting is the
      // collision.
      const systemDir = opts.systemDir || 'system';
      for (const rel of [path.join(systemDir, 'invariants.md'), path.join('kit', 'declarations.yaml')]) {
        const p = path.join(repoRoot, rel);
        if (!fs.existsSync(p)) continue;
        let text;
        try { text = fs.readFileSync(p, 'utf8'); } catch { continue; }
        for (const m of text.matchAll(/\bINV-(\d+)\b/g)) ids.add(parseInt(m[1], 10));
      }
      return ids;
    },
  },

  adr: {
    prefix: 'ADR',
    pad: 3,
    root: 'code',
    describe: 'docs/adrs/ADR-NNN*.md',
    scan(repoRoot) {
      const ids = new Set();
      // Both naming conventions in use: ADR-018.md and ADR-065-with-a-slug.md.
      harvestFilenames(path.join(repoRoot, 'docs', 'adrs'), /^ADR-(\d+)/, ids);
      return ids;
    },
  },
};

function kindNames() { return Object.keys(KINDS); }

// ─── The reservation ledger ─────────────────────────────────────────────────

function ledgerPath(wsDir) {
  return path.join(wsDir, 'state', LEDGER_NAME);
}

function lockPathFor(wsDir, kind) {
  const dir = path.join(wsDir, 'state');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `.id-counter-${kind}.lock`);
}

function readLedger(wsDir, ttlMs) {
  const p = ledgerPath(wsDir);
  if (!fs.existsSync(p)) return { reservations: [] };
  let data;
  try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return { reservations: [] }; }
  const list = Array.isArray(data.reservations) ? data.reservations : [];
  const cutoff = Date.now() - ttlMs;
  // Prune on read. An abandoned allocation should not burn an id forever.
  return { reservations: list.filter(r => {
    const t = Date.parse(r.reserved_at || '');
    return Number.isFinite(t) && t >= cutoff;
  }) };
}

function writeLedger(wsDir, ledger) {
  const p = ledgerPath(wsDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  writeFileAtomic(p, JSON.stringify(ledger, null, 2) + '\n');
}

function reservedNumbers(ledger, prefix) {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  const out = new Set();
  for (const r of ledger.reservations) {
    const m = re.exec(String(r.id || ''));
    if (m) out.add(parseInt(m[1], 10));
  }
  return out;
}

// ─── The allocator ──────────────────────────────────────────────────────────

/**
 * Allocate the next id of `kind`, under a lock, reserving or writing it before
 * the lock releases so no second caller can receive the same id.
 *
 * @param {string} kind      one of ws | spr | find | inv | adr
 * @param {object} opts
 * @param {string} opts.wsDir      workstream dir (state root) — always required,
 *                                 it holds the reservation ledger for every kind
 * @param {string} [opts.repoRoot] repo root (code root) — required for inv/adr
 * @param {string} [opts.systemDir] system dir name, default 'system' (inv only)
 * @param {Function} [opts.writer] writer(id) called inside the lock. When given,
 *                                 the id is written rather than reserved.
 * @param {number} [opts.ttlMs]    reservation lifetime, default 24h
 * @param {string} [opts.reservedBy] free-text owner recorded in the ledger
 * @returns {string} the allocated id, e.g. "WS-582"
 */
function allocateId(kind, opts = {}) {
  const spec = KINDS[kind];
  if (!spec) {
    throw new Error(`allocateId: unknown id kind "${kind}" (known: ${kindNames().join(', ')})`);
  }
  const { wsDir, repoRoot, writer } = opts;
  if (!wsDir) throw new Error('allocateId: wsDir is required (it holds the reservation ledger)');
  if (spec.root === 'code' && !repoRoot) {
    throw new Error(`allocateId: ${kind} ids scan ${spec.describe} — repoRoot is required`);
  }
  const ttlMs = typeof opts.ttlMs === 'number' ? opts.ttlMs : DEFAULT_TTL_MS;
  // Locks live under state/ because .gitignore already covers
  // `.claude/workstream/state/*.lock` (WS-310) — a leaked lockfile from a
  // killed process must not be committable. The old `.ws-counter.lock` sat at
  // the workstream root and was covered by nothing.
  const lockPath = lockPathFor(wsDir, kind);

  return withFileLock(lockPath, () => {
    const onDisk = spec.root === 'code'
      ? spec.scan(repoRoot, { systemDir: opts.systemDir })
      : spec.scan(wsDir);

    const ledger = readLedger(wsDir, ttlMs);
    const held = reservedNumbers(ledger, spec.prefix);

    let max = 0;
    for (const n of onDisk) if (n > max) max = n;
    for (const n of held) if (n > max) max = n;

    const id = `${spec.prefix}-${String(max + 1).padStart(spec.pad, '0')}`;

    if (typeof writer === 'function') {
      // The id lands on disk inside the lock, so the next scan sees it and no
      // reservation is needed. This is the strictly better path when available.
      writer(id);
    } else {
      ledger.reservations.push({
        id,
        reserved_at: new Date().toISOString(),
        reserved_by: opts.reservedBy || `pid:${process.pid}`,
      });
      writeLedger(wsDir, ledger);
    }
    return id;
  }, { ownerLabel: `allocateId:${kind}`, maxWaitMs: 10_000 });
}

/**
 * Drop a reservation once its file exists (or the allocation was abandoned
 * deliberately). Optional — reservations expire on their own — but calling it
 * keeps the ledger honest and the next scan cheap.
 */
function releaseReservation(wsDir, id, opts = {}) {
  const ttlMs = typeof opts.ttlMs === 'number' ? opts.ttlMs : DEFAULT_TTL_MS;
  const lockPath = lockPathFor(wsDir, 'release');
  return withFileLock(lockPath, () => {
    const ledger = readLedger(wsDir, ttlMs);
    const before = ledger.reservations.length;
    ledger.reservations = ledger.reservations.filter(r => String(r.id) !== String(id));
    if (ledger.reservations.length !== before) writeLedger(wsDir, ledger);
    return before - ledger.reservations.length;
  }, { ownerLabel: 'releaseReservation', maxWaitMs: 10_000 });
}

/** Current live reservations, pruned. For `--help` output and diagnostics. */
function listReservations(wsDir, opts = {}) {
  const ttlMs = typeof opts.ttlMs === 'number' ? opts.ttlMs : DEFAULT_TTL_MS;
  return readLedger(wsDir, ttlMs).reservations;
}

module.exports = {
  allocateId,
  releaseReservation,
  listReservations,
  kindNames,
  KINDS,
  DEFAULT_TTL_MS,
};
