/**
 * @file Tests for src/utils/heroState/interpolateTemplate.js
 */

import { describe, it, expect } from 'vitest';
import { interpolateTemplate, resolveDotPath } from '../interpolateTemplate.js';

describe('resolveDotPath', () => {
  it('resolves a top-level key', () => {
    expect(resolveDotPath({ foo: 'bar' }, 'foo')).toBe('bar');
  });

  it('resolves a nested dot-path', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(resolveDotPath(obj, 'a.b.c')).toBe(42);
  });

  it('returns undefined for missing path', () => {
    expect(resolveDotPath({ a: { b: 1 } }, 'a.x.y')).toBeUndefined();
  });

  it('resolves an indexed array element', () => {
    const obj = { list: [{ x: 'first' }, { x: 'second' }] };
    expect(resolveDotPath(obj, 'list[0].x')).toBe('first');
    expect(resolveDotPath(obj, 'list[1].x')).toBe('second');
  });

  it('resolves [*] as joined values from each array element', () => {
    const obj = { list: [{ x: 'one' }, { x: 'two' }, { x: 'three' }] };
    expect(resolveDotPath(obj, 'list[*].x')).toBe('one\ntwo\nthree');
  });

  it('returns undefined when [*] target is not an array', () => {
    expect(resolveDotPath({ x: 'not-array' }, 'x[*].foo')).toBeUndefined();
  });
});

describe('interpolateTemplate', () => {
  it('substitutes a single slot', () => {
    expect(interpolateTemplate('Hello {{name}}', { name: 'world' })).toBe('Hello world');
  });

  it('substitutes nested dot-path', () => {
    const data = { user: { profile: { firstName: 'Alex' } } };
    expect(interpolateTemplate('Hi {{user.profile.firstName}}!', data)).toBe('Hi Alex!');
  });

  it('leaves unresolved slot unchanged', () => {
    expect(interpolateTemplate('Hello {{missing}}', {})).toBe('Hello {{missing}}');
  });

  it('handles multiple slots in one string', () => {
    const data = { foo: 'A', bar: 'B' };
    expect(interpolateTemplate('{{foo}} and {{bar}}', data)).toBe('A and B');
  });

  it('coerces numbers to strings', () => {
    expect(interpolateTemplate('value: {{n}}', { n: 42 })).toBe('value: 42');
  });

  it('substitutes [*] array iteration', () => {
    const data = { branches: [{ trigger: 'first' }, { trigger: 'second' }] };
    expect(interpolateTemplate('Triggers:\n{{branches[*].trigger}}', data)).toBe('Triggers:\nfirst\nsecond');
  });

  it('handles whitespace inside braces', () => {
    expect(interpolateTemplate('Hello {{ name }}', { name: 'world' })).toBe('Hello world');
  });

  it('returns empty string for non-string input', () => {
    expect(interpolateTemplate(null, {})).toBe('');
    expect(interpolateTemplate(undefined, {})).toBe('');
    expect(interpolateTemplate(42, {})).toBe('');
  });

  it('returns text unchanged when data is null/missing', () => {
    expect(interpolateTemplate('Hello {{name}}', null)).toBe('Hello {{name}}');
    expect(interpolateTemplate('Hello {{name}}', undefined)).toBe('Hello {{name}}');
  });

  it('renders the PF_OPEN_RFI headline pattern with HeroState-shaped data', () => {
    const heroState = {
      handContext: { hand: 'AJo' },
      situation: { positionClass: 'HJ' },
    };
    const template = '**{{handContext.hand}} on {{situation.positionClass}} — standard open.**';
    expect(interpolateTemplate(template, heroState)).toBe('**AJo on HJ — standard open.**');
  });

  it('renders branch summary with [*] iteration', () => {
    const heroState = {
      plan: {
        branches: [
          { trigger: 'called from BTN', rationale: 'cbet polarized' },
          { trigger: '3-bet from blinds', rationale: 'tighten the range' },
        ],
      },
    };
    const template = '{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.';
    const result = interpolateTemplate(template, heroState);
    expect(result).toContain('called from BTN');
    expect(result).toContain('3-bet from blinds');
    expect(result).toContain('cbet polarized');
    expect(result).toContain('tighten the range');
  });

  it('handles null/undefined values inside [*] iteration as empty strings', () => {
    const data = { list: [{ x: 'a' }, { x: null }, { x: 'c' }] };
    expect(interpolateTemplate('{{list[*].x}}', data)).toBe('a\n\nc');
  });
});
