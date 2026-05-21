/**
 * createRegistry.js — ID-keyed append-only registry factory.
 *
 * Produces a small `{ register, get, getAll, has, forEach, size }` surface
 * with required-field validation and (optional) ID-collision enforcement.
 *
 * **Why no `deregister`:** mirrors anchorLibrary's I-WR-1 "enumerable writer
 * registry" doctrine. Once a kind/writer/rule is registered it stays — the
 * audit trail of "what once existed" is load-bearing for replay + CI checks.
 * If a consumer needs deregistration, it's a different abstraction (and
 * should be challenged before extending this one).
 *
 * Day-1 consumer: anchorLibrary/writers.js (in-code mirror of WRITERS.md).
 * Future consumers (deferred per ADR-1): skillAssessment/heroLeakDetector's
 * `leakRules/*` glob-load + assumptionEngine/PRODUCTION_RECIPES.
 *
 * Pure module — no IO, no side effects beyond the registry's internal state.
 */

import { validateRegistryEntry } from './registryInvariants';

/**
 * @template T
 * @typedef {Object} Registry
 * @property {(entry: T) => void} register
 * @property {(id: string) => T | undefined} get
 * @property {() => T[]} getAll
 * @property {(id: string) => boolean} has
 * @property {(fn: (entry: T) => void) => void} forEach
 * @property {() => number} size
 */

/**
 * Build a new registry instance.
 *
 * @template T
 * @param {Object} opts
 * @param {string} opts.name - Diagnostic label used in error messages.
 * @param {Array<keyof T>} opts.requiredFields - Fields that every entry must
 *   carry (including `id`). Enforced at `register()` time.
 * @param {boolean} [opts.forbidIdCollision=true] - When true, registering an
 *   already-known id throws. When false, the later registration silently
 *   overwrites the earlier (useful for hot-reload in tests).
 * @returns {Registry<T>}
 */
export const createRegistry = (opts) => {
  if (!opts || typeof opts !== 'object') {
    throw new TypeError('createRegistry: opts must be an object');
  }
  const { name, requiredFields } = opts;
  const forbidIdCollision = opts.forbidIdCollision !== false;

  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('createRegistry: opts.name must be a non-empty string');
  }
  if (!Array.isArray(requiredFields) || requiredFields.length === 0) {
    throw new TypeError('createRegistry: opts.requiredFields must be a non-empty array');
  }
  if (!requiredFields.includes('id')) {
    throw new TypeError(`createRegistry(${name}): requiredFields must include 'id'`);
  }

  const store = new Map();

  const register = (entry) => {
    const error = validateRegistryEntry(entry, requiredFields);
    if (error) {
      throw new TypeError(`createRegistry(${name}).register: ${error}`);
    }
    if (forbidIdCollision && store.has(entry.id)) {
      throw new Error(
        `createRegistry(${name}).register: id "${entry.id}" already registered (collision forbidden)`,
      );
    }
    store.set(entry.id, entry);
  };

  return {
    register,
    get: (id) => store.get(id),
    getAll: () => Array.from(store.values()),
    has: (id) => store.has(id),
    forEach: (fn) => {
      if (typeof fn !== 'function') {
        throw new TypeError(`createRegistry(${name}).forEach: fn must be a function`);
      }
      store.forEach((entry) => fn(entry));
    },
    size: () => store.size,
  };
};
