/**
 * registryInvariants.js — required-field validation for registry entries.
 *
 * Pure helpers consumed by createRegistry; separated so future invariant
 * extensions (cross-field constraints, type rules) can land here without
 * bloating the factory.
 */

/**
 * Validate one entry against a required-fields contract.
 *
 * Returns null when valid, or an error-message string when invalid.
 * Callers throw — this module never throws on its own.
 *
 * @template T
 * @param {T} entry
 * @param {Array<keyof T>} requiredFields
 * @returns {string | null}
 */
export const validateRegistryEntry = (entry, requiredFields) => {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    return 'entry must be a non-null object';
  }
  for (const field of requiredFields) {
    if (!(field in entry)) {
      return `entry missing required field "${String(field)}"`;
    }
    const value = entry[field];
    if (value === null || value === undefined) {
      return `entry field "${String(field)}" must not be null/undefined`;
    }
    if (typeof value === 'string' && value.length === 0) {
      return `entry field "${String(field)}" must not be an empty string`;
    }
  }
  return null;
};
