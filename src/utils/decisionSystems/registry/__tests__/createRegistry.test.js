import { describe, it, expect } from 'vitest';
import { createRegistry } from '../createRegistry';

describe('createRegistry', () => {
  const makeWriterRegistry = () => createRegistry({
    name: 'testWriters',
    requiredFields: ['id', 'store', 'fields'],
  });

  describe('factory validation', () => {
    it('throws on missing opts', () => {
      expect(() => createRegistry()).toThrow(TypeError);
    });

    it('throws on missing name', () => {
      expect(() => createRegistry({ requiredFields: ['id'] })).toThrow(/name/);
    });

    it('throws on empty name', () => {
      expect(() => createRegistry({ name: '', requiredFields: ['id'] })).toThrow(/name/);
    });

    it('throws on missing requiredFields', () => {
      expect(() => createRegistry({ name: 'r' })).toThrow(/requiredFields/);
    });

    it('throws on empty requiredFields', () => {
      expect(() => createRegistry({ name: 'r', requiredFields: [] })).toThrow(/requiredFields/);
    });

    it('throws when requiredFields does not include id', () => {
      expect(() => createRegistry({ name: 'r', requiredFields: ['store'] })).toThrow(/'id'/);
    });
  });

  describe('register / get / has / size', () => {
    it('registers an entry and reads it back', () => {
      const reg = makeWriterRegistry();
      const entry = { id: 'W-EA-1', store: 'anchors', fields: ['status'] };
      reg.register(entry);
      expect(reg.get('W-EA-1')).toBe(entry);
      expect(reg.has('W-EA-1')).toBe(true);
      expect(reg.size()).toBe(1);
    });

    it('returns undefined for unknown id', () => {
      const reg = makeWriterRegistry();
      expect(reg.get('nope')).toBeUndefined();
      expect(reg.has('nope')).toBe(false);
    });

    it('size grows with each registration', () => {
      const reg = makeWriterRegistry();
      reg.register({ id: 'a', store: 's', fields: [] });
      reg.register({ id: 'b', store: 's', fields: [] });
      reg.register({ id: 'c', store: 's', fields: [] });
      expect(reg.size()).toBe(3);
    });
  });

  describe('required-field validation', () => {
    it('rejects entry missing id', () => {
      const reg = makeWriterRegistry();
      expect(() => reg.register({ store: 's', fields: [] })).toThrow(/id/);
    });

    it('rejects entry missing other required field', () => {
      const reg = makeWriterRegistry();
      expect(() => reg.register({ id: 'x', store: 's' })).toThrow(/fields/);
    });

    it('rejects entry with null field', () => {
      const reg = makeWriterRegistry();
      expect(() => reg.register({ id: 'x', store: null, fields: [] })).toThrow(/store/);
    });

    it('rejects entry with empty-string field', () => {
      const reg = makeWriterRegistry();
      expect(() => reg.register({ id: '', store: 's', fields: [] })).toThrow(/id/);
    });

    it('rejects non-object entry', () => {
      const reg = makeWriterRegistry();
      expect(() => reg.register(null)).toThrow();
      expect(() => reg.register('string')).toThrow();
      expect(() => reg.register([])).toThrow();
    });
  });

  describe('collision behavior', () => {
    it('throws on duplicate id by default', () => {
      const reg = makeWriterRegistry();
      reg.register({ id: 'x', store: 's', fields: [] });
      expect(() => reg.register({ id: 'x', store: 't', fields: [] })).toThrow(/already registered/);
    });

    it('allows overwrite when forbidIdCollision=false', () => {
      const reg = createRegistry({
        name: 'reloadable',
        requiredFields: ['id', 'store', 'fields'],
        forbidIdCollision: false,
      });
      reg.register({ id: 'x', store: 's', fields: [] });
      reg.register({ id: 'x', store: 't', fields: [1] });
      expect(reg.get('x').store).toBe('t');
      expect(reg.size()).toBe(1);
    });
  });

  describe('getAll / forEach', () => {
    it('getAll returns all entries in insertion order', () => {
      const reg = makeWriterRegistry();
      reg.register({ id: 'a', store: 's', fields: [] });
      reg.register({ id: 'b', store: 's', fields: [] });
      reg.register({ id: 'c', store: 's', fields: [] });
      const all = reg.getAll();
      expect(all.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    });

    it('forEach calls fn for every entry', () => {
      const reg = makeWriterRegistry();
      reg.register({ id: 'a', store: 's', fields: [] });
      reg.register({ id: 'b', store: 's', fields: [] });
      const seen = [];
      reg.forEach((entry) => seen.push(entry.id));
      expect(seen).toEqual(['a', 'b']);
    });

    it('forEach throws when fn is not a function', () => {
      const reg = makeWriterRegistry();
      expect(() => reg.forEach('not-fn')).toThrow(/function/);
    });
  });

  describe('no deregister API (I-WR-1 enumerability)', () => {
    it('does not expose a deregister method', () => {
      const reg = makeWriterRegistry();
      expect(reg).not.toHaveProperty('deregister');
      expect(reg).not.toHaveProperty('remove');
      expect(reg).not.toHaveProperty('delete');
    });
  });
});
