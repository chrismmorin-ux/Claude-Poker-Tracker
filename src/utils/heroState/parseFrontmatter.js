/**
 * @file Minimal YAML frontmatter parser for HSP narrative templates.
 *
 * Bounded scope: handles the frontmatter shape defined by
 * `docs/design/hero-state-templates/CONVENTIONS.md`:
 *   - `key: value` (string scalars)
 *   - `key: |\n  multiline text` (literal block scalars)
 *   - `key:\n  - item\n  - item` (string arrays)
 *
 * NOT handled: anchors, merges, tags, nested objects, type coercion to numbers/
 * bools (everything is a string). If template authoring needs richer YAML,
 * swap in `js-yaml` — but CONVENTIONS.md keeps frontmatter simple by design.
 *
 * Hand-rolled to avoid a production dep on js-yaml (~150 KB minified) for
 * a bounded use case. ~50 LoC implementation.
 */

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

/**
 * Parse a markdown document with optional YAML frontmatter.
 *
 * @param {string} markdown - Raw markdown text.
 * @returns {{ meta: object, body: string }} - meta is {} when no frontmatter.
 */
export const parseFrontmatter = (markdown) => {
  if (typeof markdown !== 'string') return { meta: {}, body: '' };
  const match = markdown.match(FRONTMATTER_PATTERN);
  if (!match) return { meta: {}, body: markdown };
  return { meta: parseMinimalYaml(match[1]), body: match[2] };
};

/**
 * Minimal YAML parser for the frontmatter shape we use. Returns an object
 * with string values, string arrays, or multiline strings. Indentation is
 * 2 spaces (per CONVENTIONS.md).
 */
const parseMinimalYaml = (yamlText) => {
  const result = {};
  const lines = yamlText.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '' || line.trim().startsWith('#')) {
      i += 1;
      continue;
    }

    const keyMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
    if (!keyMatch) {
      i += 1;
      continue;
    }
    const [, key, rest] = keyMatch;
    const trimmedRest = rest.trim();

    if (trimmedRest === '|' || trimmedRest === '|-') {
      // Literal block scalar — consume indented lines.
      const blockLines = [];
      i += 1;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
        blockLines.push(lines[i].replace(/^ {2}/, ''));
        i += 1;
      }
      // Trim trailing empty lines.
      while (blockLines.length > 0 && blockLines[blockLines.length - 1].trim() === '') {
        blockLines.pop();
      }
      result[key] = blockLines.join('\n');
      continue;
    }

    if (trimmedRest === '') {
      // Could be a list under this key — peek next lines.
      const items = [];
      i += 1;
      while (i < lines.length && lines[i].match(/^\s*-\s+/)) {
        const itemMatch = lines[i].match(/^\s*-\s+(.*)$/);
        if (itemMatch) items.push(itemMatch[1].trim());
        i += 1;
      }
      if (items.length > 0) {
        result[key] = items;
      } else {
        result[key] = '';
      }
      continue;
    }

    // Inline string scalar — strip surrounding quotes if any.
    result[key] = stripQuotes(trimmedRest);
    i += 1;
  }

  return result;
};

const stripQuotes = (str) => {
  if (str.length >= 2) {
    const first = str[0];
    const last = str[str.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      return str.slice(1, -1);
    }
  }
  return str;
};
