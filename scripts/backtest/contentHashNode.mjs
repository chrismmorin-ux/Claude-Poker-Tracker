/**
 * contentHashNode.mjs — synchronous sha256 for the Node-only measurement harness.
 *
 * WHY A SECOND ENTRY POINT AND NOT A SECOND IMPLEMENTATION. `src/utils/contentHash.js`
 * is the repo's one content-addressing primitive, but its `hashUtil` is async because
 * Web Crypto's `subtle.digest` is, and the printable-refresher needs the browser path.
 * `buildHeroEvReport` is synchronous and has three callers plus tests; making it async to
 * accommodate a hash would be the hash dictating the shape of the instrument.
 *
 * So this module imports the SERIALIZER from the shared primitive and pairs it with Node's
 * synchronous `createHash`. Same algorithm, same canonical byte string, same `sha256:`
 * prefix — a hash computed here is byte-identical to one computed by `hashUtil`, which the
 * test asserts directly rather than assuming.
 *
 * A static `node:crypto` import is safe here and would not be in `src/`: this file is only
 * ever loaded by `scripts/`, never bundled for the browser.
 */

import { createHash } from 'node:crypto';
import { SHA256_PREFIX, stableStringify } from '../../src/utils/contentHash.js';

export { SHA256_PREFIX, stableStringify };

/** sha256 of a UTF-8 string, prefixed with `sha256:`. Synchronous; Node only. */
export const hashStringSync = (input) => {
  const h = createHash('sha256');
  h.update(String(input), 'utf8');
  return `${SHA256_PREFIX}${h.digest('hex')}`;
};

/** Stable-stringify a structured value, then hash it. Synchronous; Node only. */
export const hashObjectSync = (value) => hashStringSync(stableStringify(value));
