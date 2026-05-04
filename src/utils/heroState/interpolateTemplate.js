/**
 * @file Mustache-style `{{path.to.field}}` template interpolation for HSP narrative templates.
 *
 * Supports:
 *   - Dot-paths: `{{foo.bar.baz}}` → resolves through nested objects
 *   - Array iteration: `{{list[*].x}}` → joins values from each list item with `\n`
 *   - Indexed access: `{{list[0].x}}` → single index
 *
 * Behavior:
 *   - Missing or null/undefined paths leave the `{{...}}` placeholder unchanged
 *     (so authors can spot unresolved slots in rendered output rather than
 *     silently substituting empty string)
 *   - Resolved values are coerced to string via String()
 *
 * Bounded scope per CONVENTIONS.md slot syntax. If templates ever need richer
 * Mustache features (sections, partials, conditionals), swap in a real
 * mustache.js / handlebars dep — but v1 templates only use the patterns above.
 */

const SLOT_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

/**
 * Interpolate `{{path.to.field}}` slots in `text` using values from `data`.
 *
 * @param {string} text - Template text with `{{...}}` slots.
 * @param {object} data - Source object to resolve slot paths against.
 * @returns {string} - Interpolated text. Unresolved slots remain as-is.
 */
export const interpolateTemplate = (text, data) => {
  if (typeof text !== 'string') return '';
  if (!data || typeof data !== 'object') return text;
  return text.replace(SLOT_PATTERN, (match, path) => {
    const resolved = resolveDotPath(data, path);
    if (resolved === null || resolved === undefined) return match;
    return String(resolved);
  });
};

/**
 * Resolve a dot-path like `foo.bar.baz` or `list[0].x` or `list[*].x` into a
 * value from `obj`. For `[*]`, returns the joined-with-newlines list of
 * values from each item.
 */
export const resolveDotPath = (obj, path) => {
  if (!path) return undefined;

  // Tokenize: split on '.' but keep '[N]' / '[*]' indices attached to their key.
  // Example: 'plan.branches[*].trigger' → ['plan', 'branches[*]', 'trigger']
  const segments = path.split('.');
  let current = obj;

  for (let i = 0; i < segments.length; i += 1) {
    if (current === null || current === undefined) return undefined;
    const seg = segments[i];

    const arrayMatch = seg.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\[(\*|\d+)\]$/);
    if (arrayMatch) {
      const [, key, idx] = arrayMatch;
      const arr = current[key];
      if (!Array.isArray(arr)) return undefined;
      if (idx === '*') {
        // Iterate: resolve remaining segments against each array element + join.
        const restPath = segments.slice(i + 1).join('.');
        const values = arr.map((item) => {
          const v = restPath ? resolveDotPath(item, restPath) : item;
          return v === null || v === undefined ? '' : String(v);
        });
        return values.join('\n');
      }
      current = arr[Number(idx)];
    } else {
      current = current[seg];
    }
  }

  return current;
};
