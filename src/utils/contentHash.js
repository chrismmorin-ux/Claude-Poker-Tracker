/**
 * contentHash.js — ONE content-addressing primitive for the whole repo.
 *
 * WHY THIS IS ITS OWN MODULE. Two unrelated consumers need to fingerprint a structured
 * object and neither owns the other: `printableRefresher/lineage.js` hashes a card manifest
 * to detect content drift between author-time and build-time, and `standardOfRecord/`
 * hashes Strategy Cards and Deal Books so a Result Card can name exactly what it ran against
 * (ADR-009). This module is the same argument `decisionGeometry.mjs` makes about the pot —
 * "deriving it three times would be three chances to disagree" — applied to the hash.
 *
 * The implementation moved here from lineage.js, which now imports and re-exports it. Every
 * existing consumer and both `check-refresher-*` CI gates keep working unchanged.
 *
 * NOT `fnv1a32`. `scripts/backtest/partition.mjs` exports a 32-bit FNV-1a and it is the right
 * tool there — it assigns a player to POOL or EVAL, where a collision merely moves someone
 * between halves. It is the WRONG tool for content addressing: 32 bits collide by birthday at
 * roughly 77k distinct objects, and a Deal Book hash that silently matches a different slice
 * would make two runs look replicable when they are not. Use sha256 here, always.
 *
 * SYNC VS ASYNC. `hashUtil` is async because Web Crypto's `subtle.digest` is, and the browser
 * path has to work for the printable-refresher. Node-only callers that cannot be async — the
 * backtest harness builds its report synchronously — use `scripts/backtest/contentHashNode.mjs`,
 * which is a sync sha256 over THIS module's `stableStringify`. One serializer, one algorithm,
 * two entry points.
 */

const STUB_HASH_PREFIX = 'sha256:stub-pending-';

export const SHA256_PREFIX = 'sha256:';

/**
 * Stable JSON serialization — sorts object keys recursively so equivalent
 * objects with different key insertion orders produce the same string.
 * Required for hash determinism.
 */
export function stableStringify(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  // Symbols, functions — should never appear in a JSON manifest
  return JSON.stringify(String(value));
}

/**
 * sha256 of a UTF-8 string, prefixed with `sha256:`. Async to keep the
 * Web Crypto path available without forking the API surface.
 */
export async function hashUtil(input) {
  const text = String(input);
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (subtle && typeof subtle.digest === 'function') {
    const data = new TextEncoder().encode(text);
    const buf = await subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `${SHA256_PREFIX}${hex}`;
  }
  // Node fallback — dynamic import keeps `node:crypto` out of browser bundles.
  // Vite externalizes `node:crypto`, so a static import would throw at module
  // load time (before this function ever runs); deferring the import means the
  // browser path can succeed via Web Crypto without ever touching Node crypto.
  const { createHash } = await import('node:crypto');
  const h = createHash('sha256');
  h.update(text, 'utf8');
  return `${SHA256_PREFIX}${h.digest('hex')}`;
}

/**
 * Hash any structured value: stable-stringify it, then sha256 the string.
 *
 * The convenience form for callers that hold an object rather than a pre-built
 * string. `computeSourceHash` in lineage.js deliberately does NOT use this — it
 * has its own documented combining rule (bodyMarkdown + sourceUtil hashes +
 * generatedFields) that predates this module and is pinned by CI.
 */
export async function hashObject(value) {
  return hashUtil(stableStringify(value));
}

/**
 * Returns true if the contentHash is a stub placeholder that must NEVER ship to
 * main. Stubs are used by foundation sessions to scaffold manifests before the
 * lineage hash can be computed; failing to recompute before merge is a bug.
 */
export function isStubContentHash(contentHash) {
  return typeof contentHash === 'string' && contentHash.startsWith(STUB_HASH_PREFIX);
}
