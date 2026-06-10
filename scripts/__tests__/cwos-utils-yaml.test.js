import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// cwos-utils.js is CommonJS (kit/scripts/package.json sets "type": "commonjs"),
// so pull it in via createRequire rather than an ESM import.
const { parseYAML } = createRequire(import.meta.url)(
  '../../kit/scripts/lib/cwos-utils.js'
);

describe('parseYAML inline-comment stripping (WS-213)', () => {
  it('strips a trailing comment from an unquoted numeric scalar (SPR-113 reproduction)', () => {
    const parsed = parseYAML('max_items: 5  # max items per sprint\n');
    expect(parsed.max_items).toBe(5);
    // The original bug: "5  # ..." was truthy but NaN'd numeric comparisons,
    // so the sprint cap never fired. Verify the comparison now behaves.
    expect(6 >= parsed.max_items).toBe(true);
    expect(4 >= parsed.max_items).toBe(false);
  });

  it('strips a trailing comment from an unquoted string scalar', () => {
    const parsed = parseYAML('key: foo  # note\n');
    expect(parsed.key).toBe('foo');
  });

  it('preserves # inside a double-quoted scalar', () => {
    const parsed = parseYAML('key: "a#b"\n');
    expect(parsed.key).toBe('a#b');
  });

  it('preserves # inside a single-quoted scalar', () => {
    const parsed = parseYAML("key: 'x # y'\n");
    expect(parsed.key).toBe('x # y');
  });

  it('strips a trailing comment after a quoted scalar and still unquotes it', () => {
    const parsed = parseYAML('key: "val"  # note\n');
    expect(parsed.key).toBe('val');
  });

  it('does not treat # without preceding whitespace as a comment', () => {
    const parsed = parseYAML('key: a#b\n');
    expect(parsed.key).toBe('a#b');
  });

  it('leaves a leading-# value alone (minimal scope: not promoted to null)', () => {
    const parsed = parseYAML('key: #fff\n');
    expect(parsed.key).toBe('#fff');
  });

  it('strips a trailing comment after an inline array without corrupting the last element', () => {
    const parsed = parseYAML('tags: [a, b]  # note\n');
    expect(parsed.tags).toEqual(['a', 'b']);
  });

  it('strips trailing comments from block-sequence items', () => {
    const parsed = parseYAML('items:\n  - 5  # note\n  - foo # other\n');
    expect(parsed.items).toEqual([5, 'foo']);
  });

  it('strips trailing comments from sequence-of-mapping values', () => {
    const parsed = parseYAML(
      'rows:\n  - id: 3  # row id\n    name: alpha  # label\n'
    );
    expect(parsed.rows).toEqual([{ id: 3, name: 'alpha' }]);
  });

  it('leaves block-scalar content untouched, including # lines', () => {
    const parsed = parseYAML(
      'note: |\n  first line # not a comment\n  # also not a comment\n'
    );
    expect(parsed.note).toBe('first line # not a comment\n# also not a comment');
  });

  it('parses the SPR-113 .cwos-config.yaml shape end-to-end', () => {
    const parsed = parseYAML(
      [
        'ceremony: standard  # standard | lean | full',
        'sprints:',
        '  max_items: 5  # cap per sprint',
        '  max_effort_sessions: 2  # cap in sessions',
        '',
      ].join('\n')
    );
    expect(parsed.ceremony).toBe('standard');
    expect(parsed.sprints.max_items).toBe(5);
    expect(parsed.sprints.max_effort_sessions).toBe(2);
  });
});
