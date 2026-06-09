/**
 * canonical-json.js — sorted-key JSON serializer for hash-chain stability.
 *
 * ADR-018 §Consequences: "JSON serialization for hashing uses a canonical
 * sorted-keys serializer (json-stable-stringify or equivalent); algorithm
 * pinned in kit/scripts/core/canonical-json.js."
 *
 * Algorithm: recursive serialization. Object keys sorted lexicographically.
 * Arrays preserve order. Strings use standard JSON escaping. Numbers use
 * standard JSON.stringify (NaN/Infinity become null per JSON spec —
 * hash inputs must contain finite numbers only; callers should reject
 * non-finite values before hashing).
 *
 * Zero external dependencies.
 */

'use strict';

const crypto = require('crypto');

function canonicalize(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'null';
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const pairs = keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k]));
    return '{' + pairs.join(',') + '}';
  }
  throw new Error(`canonicalize: unsupported type ${typeof value}`);
}

function hashEvent(obj) {
  return crypto.createHash('sha256').update(canonicalize(obj), 'utf8').digest('hex');
}

module.exports = { canonicalize, hashEvent };
