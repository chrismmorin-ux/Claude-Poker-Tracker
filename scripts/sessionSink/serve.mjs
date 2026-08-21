#!/usr/bin/env node
/**
 * serve.mjs — the local hand sink. Hands land on disk as they are played.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY A LISTENING PROCESS, WHEN THIS FLEET'S GRAIN IS THE SCHEDULED POLL
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Every other always-on thing in this fleet is a timer (`Fleet-ComputeFeeder` at 10 min,
 * `Fleet-SessionSweep` at 15 min) and that is the right default. It cannot work here: the hands
 * live in `chrome.storage`, nothing outside the browser can read it, so the extension must PUSH.
 * A poll has nothing to poll.
 *
 * So this is a listener, following the one precedent in the fleet for that
 * (`police-accountability/scripts/start-tailnet-service.ps1`): loopback only, started at logon,
 * and kept alive by a port check on an EXISTING scheduled task rather than a sibling task of its
 * own — ADR-065's "one scheduling surface to verify, one place to look when it stops".
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE ONE RULE THIS SERVICE OBEYS ABOVE ALL OTHERS
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * **It must be impossible for this process to cost the founder a hand.**
 *
 * That is why the extension treats it as fire-and-forget, why the durable journal keeps every
 * hand until the sink ACKs it, why a duplicate is a no-op rather than an error, and why a review
 * that crashes is caught and logged rather than allowed to take the sink down. The sink is a
 * CONVENIENCE on top of a journal that is already durable. If it disappeared entirely, the
 * founder would lose a review, never a hand.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * RUN
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 *   node scripts/sessionSink/serve.mjs                 # foreground
 *   POKER_SESSION_STORE=D:/hands node …/serve.mjs      # relocate the store
 *   SESSION_SINK_PORT=8791 node …/serve.mjs            # relocate the port
 *   SESSION_SINK_IDLE_MS=1200000 node …/serve.mjs      # change the session boundary
 *   SESSION_SINK_NO_REVIEW=1 node …/serve.mjs          # capture only, never spawn a review
 */

import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLOSED_DIR,
  DEFAULT_IDLE_MS,
  DEFAULT_SESSION_STORE_ROOT,
  listClosedSessions,
  openSession,
  writeStatus,
} from './sessionStore.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/**
 * 8791 — deliberately clear of 5173 (this repo's Vite dev server, already in the extension's
 * host_permissions), 8384 (Syncthing's UI on CM-NODE1) and 8001 (police-accountability's
 * tailnet service). Colliding with the dev server would be the easy mistake.
 */
const PORT = Number(process.env.SESSION_SINK_PORT || 8791);
const HOST = '127.0.0.1';
const ROOT = process.env.POKER_SESSION_STORE || DEFAULT_SESSION_STORE_ROOT;
const IDLE_MS = Number(process.env.SESSION_SINK_IDLE_MS || DEFAULT_IDLE_MS);
const NO_REVIEW = process.env.SESSION_SINK_NO_REVIEW === '1';
const SWEEP_MS = 30_000;
const MAX_BODY_BYTES = 4 * 1024 * 1024;

const startedAt = new Date().toISOString();
/** tableId -> open session handle */
const open = new Map();
const counters = { accepted: 0, duplicates: 0, refused: 0, sealed: 0, reviewsSpawned: 0, reviewFailures: 0 };
const recentErrors = [];

const log = (...a) => console.log(`[sink ${new Date().toISOString()}]`, ...a);
const noteError = (where, e) => {
  const entry = { at: new Date().toISOString(), where, message: e?.message ?? String(e) };
  recentErrors.unshift(entry);
  recentErrors.length = Math.min(recentErrors.length, 20);
  log('ERROR', where, entry.message);
};

const readBody = (req) => new Promise((resolve, reject) => {
  let size = 0;
  const chunks = [];
  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_BODY_BYTES) {
      reject(new Error(`body exceeds ${MAX_BODY_BYTES} bytes`));
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

const send = (res, code, body) => {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    // The extension holds a host permission for this origin, so CORS is not strictly in play;
    // these keep the endpoint usable from a page during debugging without weakening anything
    // that is not already loopback-only.
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'cache-control': 'no-store',
  });
  res.end(text);
};

/**
 * Route a hand to its table's open session, starting one if needed.
 *
 * A gap longer than `idleMs` seals the old session FIRST and opens a new one, so a hand that
 * arrives after a long break starts a new session rather than being back-dated into a stale one.
 */
const sessionFor = async (hand, atMs) => {
  const tableId = hand?.tableId ?? 'unknown';
  const existing = open.get(tableId);
  if (existing) {
    // Membership is judged on the HAND's clock — see the two-clocks note in sessionStore.js.
    // `Math.abs` because a backfill can deliver an out-of-order hand slightly older than the
    // last one written; that is still the same sitting, not a gap.
    if (Math.abs(atMs - existing.lastHandAt) <= IDLE_MS) return existing;
    await sealSession(tableId, 'gap');
  }
  const session = await openSession({
    tableId,
    startedAt: new Date(atMs).toISOString(),
    root: ROOT,
  });
  open.set(tableId, session);
  log(`opened ${session.sessionId} (table ${tableId})`);
  return session;
};

/**
 * Seal a session and hand it to the review runner.
 *
 * The review is spawned DETACHED from the request path and its failure is counted, never
 * propagated: a broken analysis must not stop the next hand being captured.
 */
const sealSession = async (tableId, reason) => {
  const session = open.get(tableId);
  if (!session) return null;
  open.delete(tableId);

  if (session.handCount === 0) {
    log(`discarding empty session ${session.sessionId}`);
    return null;
  }

  let manifest;
  try {
    manifest = await session.seal({ reason });
  } catch (e) {
    noteError('seal', e);
    return null;
  }
  counters.sealed += 1;
  log(`sealed ${session.sessionId}: ${manifest.count} hands (${reason})`);

  if (!NO_REVIEW) spawnReview(manifest.dir, session.sessionId);
  return manifest;
};

const spawnReview = (dir, sessionId) => {
  const runner = join(REPO, 'scripts', 'villainArchetype', 'reviewSession.mjs');
  try {
    const child = spawn(process.execPath, [runner, '--session', dir], {
      cwd: REPO,
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
    });
    child.on('error', (e) => { counters.reviewFailures += 1; noteError('review-spawn', e); });
    child.unref();
    counters.reviewsSpawned += 1;
    log(`review spawned for ${sessionId}`);
  } catch (e) {
    counters.reviewFailures += 1;
    noteError('review-spawn', e);
  }
};

/** Accept one hand. Returns the shape the extension uses to decide whether to drop its journal copy. */
const acceptHand = async (hand) => {
  if (!hand || typeof hand !== 'object') {
    counters.refused += 1;
    return { ok: false, reason: 'not-an-object' };
  }
  if (!hand.captureId) {
    // Refusing loudly rather than inventing an id: an id we made up would defeat the dedupe
    // that makes journal backfill safe, and the duplicate would be silent.
    counters.refused += 1;
    return { ok: false, reason: 'no-captureId' };
  }
  const atMs = Number(hand.timestamp) || Date.now();
  try {
    const session = await sessionFor(hand, atMs);
    const { duplicate } = await session.accept(hand, atMs);
    if (duplicate) counters.duplicates += 1; else counters.accepted += 1;
    // A duplicate is still `ok` — the hand IS on disk, which is the only thing the extension
    // needs to know before releasing its journal copy.
    return { ok: true, duplicate, sessionId: session.sessionId, captureId: hand.captureId };
  } catch (e) {
    counters.refused += 1;
    noteError('accept', e);
    return { ok: false, reason: e.message, captureId: hand.captureId };
  }
};

const statusPayload = () => ({
  service: 'poker-session-sink',
  pid: process.pid,
  startedAt,
  at: new Date().toISOString(),
  host: HOST,
  port: PORT,
  root: ROOT,
  idleMs: IDLE_MS,
  reviewsEnabled: !NO_REVIEW,
  openSessions: [...open.values()].map((s) => ({
    sessionId: s.sessionId,
    tableId: s.tableId,
    hands: s.handCount,
    lastHandAt: new Date(s.lastHandAt).toISOString(),
    lastArrivalAt: new Date(s.lastArrivalAt).toISOString(),
    idleForMs: Date.now() - s.lastArrivalAt,
  })),
  counters: { ...counters },
  recentErrors,
});

const handlers = {
  'GET /health': async (_req, res) => send(res, 200, { ok: true, pid: process.pid }),

  'GET /status': async (_req, res) => send(res, 200, statusPayload()),

  'GET /sessions': async (_req, res) => {
    const closed = await listClosedSessions(ROOT);
    send(res, 200, {
      ok: true,
      closed: closed.map((m) => ({
        sessionId: m.setId, tableId: m.tableId, hands: m.count, hash: m.hash,
        startedAt: m.startedAt, endedAt: m.endedAt, dir: m.dir,
      })),
    });
  },

  /**
   * The reviews, as a page. This is the whole delivery path on the desktop: play, stop, open
   * one link. No export, no file browsing, no publish step.
   */
  'GET /reviews': async (_req, res) => {
    const closed = await listClosedSessions(ROOT);
    const rows = await Promise.all(closed.map(async (m) => {
      const html = join(m.dir, 'review', 'review.html');
      const ready = existsSync(html);
      return { m, ready };
    }));
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const body = rows.length === 0
      ? '<p class="muted">No sessions captured yet. Play some hands with the extension running.</p>'
      : `<ul>${rows.map(({ m, ready }) => `
          <li>
            ${ready
    ? `<a href="/review/${encodeURIComponent(m.setId)}">${esc(m.setId)}</a>`
    : `<span>${esc(m.setId)}</span> <em class="muted">review still running…</em>`}
            <span class="muted">${m.count} hands${m.startedAt ? ` · ${esc(m.startedAt)}` : ''}</span>
          </li>`).join('')}</ul>`;
    const page = `<!doctype html><meta charset="utf-8"><title>Session reviews</title>
<style>
 :root{--bg:#fff;--fg:#16181d;--muted:#5b6270;--line:#e3e6eb;--accent:#24405f}
 @media(prefers-color-scheme:dark){:root{--bg:#14161a;--fg:#e8eaee;--muted:#99a1b0;--line:#2a2f38;--accent:#9dc0e8}}
 body{background:var(--bg);color:var(--fg);max-width:44rem;margin:0 auto;padding:2rem 1.25rem;
      font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
 h1{font-size:1.4rem;margin:0 0 1.25rem}
 ul{list-style:none;padding:0;margin:0}
 li{padding:.6rem 0;border-bottom:1px solid var(--line);display:flex;gap:.75rem;flex-wrap:wrap;align-items:baseline}
 a{color:var(--accent)} .muted{color:var(--muted);font-size:.88rem}
</style>
<h1>Session reviews</h1>${body}`;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(page);
  },

  'GET /review': async (_req, res) => send(res, 404, { ok: false, reason: 'name a session: /review/<sessionId>' }),

  'POST /hand': async (req, res) => {
    const body = JSON.parse(await readBody(req));
    send(res, 200, await acceptHand(body?.hand ?? body));
  },

  /** Batch, used by the extension's journal backfill after the sink has been away. */
  'POST /hands': async (req, res) => {
    const body = JSON.parse(await readBody(req));
    const hands = Array.isArray(body?.hands) ? body.hands : [];
    const results = [];
    for (const h of hands) results.push(await acceptHand(h));
    send(res, 200, {
      ok: true,
      total: results.length,
      stored: results.filter((r) => r.ok).length,
      duplicates: results.filter((r) => r.duplicate).length,
      // The ids the extension may now release from its journal.
      ackCaptureIds: results.filter((r) => r.ok).map((r) => r.captureId),
      refused: results.filter((r) => !r.ok),
    });
  },

  /** Force a seal — used by tests and by an explicit "I'm done" if one is ever added. */
  'POST /seal': async (req, res) => {
    const body = JSON.parse((await readBody(req)) || '{}');
    const tables = body?.tableId ? [body.tableId] : [...open.keys()];
    const sealed = [];
    for (const t of tables) {
      const m = await sealSession(t, body?.reason || 'explicit');
      if (m) sealed.push({ sessionId: m.setId, hands: m.count, dir: m.dir });
    }
    send(res, 200, { ok: true, sealed });
  },
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { send(res, 204, {}); return; }
  const path = req.url.split('?')[0].replace(/\/$/, '') || '/';

  // A served review is the delivery path, so it is matched by prefix rather than by an exact
  // route key. Traversal is impossible by construction: the id is used to look up a directory
  // under the store root and any separator disqualifies it outright.
  if (req.method === 'GET' && path.startsWith('/review/')) {
    const id = decodeURIComponent(path.slice('/review/'.length));
    if (!/^[A-Za-z0-9_.-]+$/.test(id)) { send(res, 400, { ok: false, reason: 'bad session id' }); return; }
    const file = join(ROOT, CLOSED_DIR, id, 'review', 'review.html');
    if (!existsSync(file)) {
      send(res, 404, { ok: false, reason: `no review for ${id} — it may still be running` });
      return;
    }
    try {
      const html = await readFile(file, 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(html);
    } catch (e) {
      noteError('serve-review', e);
      send(res, 500, { ok: false, reason: e.message });
    }
    return;
  }

  const key = `${req.method} ${path}`;
  const handler = handlers[key];
  if (!handler) { send(res, 404, { ok: false, reason: `no route for ${key}` }); return; }
  try {
    await handler(req, res);
  } catch (e) {
    noteError(key, e);
    if (!res.headersSent) send(res, 400, { ok: false, reason: e.message });
  }
});

/** Idle sweep: seal what has gone quiet, and write status whether or not anything happened. */
const sweep = async () => {
  const now = Date.now();
  for (const [tableId, s] of [...open.entries()]) {
    // The idle seal is judged on WALL-CLOCK arrival. Using the record clock here would seal a
    // backfill of last week's hands instantly, and leave a live table that went quiet open forever.
    if (now - s.lastArrivalAt > IDLE_MS) {
      try { await sealSession(tableId, 'idle'); } catch (e) { noteError('sweep', e); }
    }
  }
  try { await writeStatus(ROOT, statusPayload()); } catch (e) { noteError('status', e); }
};

/**
 * Seal open sessions on the way out. Best-effort by nature — if the process is killed hard the
 * rows are still on disk and the set resolves as TRUNCATED with its hands readable, which is
 * exactly what the provisional manifest is for.
 */
let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`${signal} — sealing ${open.size} open session(s)`);
  for (const tableId of [...open.keys()]) {
    try { await sealSession(tableId, `shutdown:${signal}`); } catch (e) { noteError('shutdown', e); }
  }
  try { await writeStatus(ROOT, { ...statusPayload(), stoppedAt: new Date().toISOString() }); } catch { /* going away */ }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { shutdown(sig); });

server.listen(PORT, HOST, async () => {
  log(`listening on http://${HOST}:${PORT}`);
  log(`store root: ${ROOT}`);
  log(`session boundary: ${IDLE_MS} ms idle · reviews ${NO_REVIEW ? 'DISABLED' : 'enabled'}`);
  log(`reviews: http://${HOST}:${PORT}/reviews`);
  await sweep();
  setInterval(() => { sweep().catch((e) => noteError('sweep-tick', e)); }, SWEEP_MS).unref();
});

server.on('error', (e) => {
  if (e?.code === 'EADDRINUSE') {
    // Not an error worth a stack trace: the keepalive check races with a running instance, and
    // "already up" is the desired state.
    log(`port ${PORT} already in use — another sink is running. Exiting quietly.`);
    process.exit(0);
  }
  noteError('server', e);
  process.exit(1);
});
