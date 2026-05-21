import { describe, it, expect, afterEach } from 'vitest';
import * as migrationGuardModule from '../migrationGuard';
import { assertStoreRegistered, __testing__ } from '../migrationGuard';

// Ensure the bypass flag is OFF at the end of every test.
afterEach(() => {
  __testing__.bypassMigrationCheck = false;
});

describe('migrationGuard.assertStoreRegistered', () => {
  it('does nothing for a registered store (default path)', () => {
    // 'hands' is registered at version 1 in migrationRegistry.
    expect(() => assertStoreRegistered('hands')).not.toThrow();
  });

  it('throws for an unregistered store with a registry-pointer error message', () => {
    expect(() => assertStoreRegistered('zzz-not-a-real-store')).toThrow(
      /migrationRegistry/,
    );
  });

  it('throws on empty store name', () => {
    expect(() => assertStoreRegistered('')).toThrow(TypeError);
  });

  it('throws on non-string store name', () => {
    expect(() => assertStoreRegistered(null)).toThrow(TypeError);
    expect(() => assertStoreRegistered(123)).toThrow(TypeError);
  });
});

describe('migrationGuard.__testing__.bypassMigrationCheck', () => {
  it('starts false', () => {
    expect(__testing__.bypassMigrationCheck).toBe(false);
  });

  it('suppresses assertion when set true', () => {
    __testing__.bypassMigrationCheck = true;
    expect(() => assertStoreRegistered('zzz-not-a-real-store')).not.toThrow();
    expect(() => assertStoreRegistered('')).not.toThrow();
  });

  it('re-engages assertion when set back to false', () => {
    __testing__.bypassMigrationCheck = true;
    expect(() => assertStoreRegistered('zzz-also-fake')).not.toThrow();
    __testing__.bypassMigrationCheck = false;
    expect(() => assertStoreRegistered('zzz-also-fake')).toThrow();
  });

  it('coerces truthy/falsy values to boolean', () => {
    __testing__.bypassMigrationCheck = 1;
    expect(__testing__.bypassMigrationCheck).toBe(true);
    __testing__.bypassMigrationCheck = 0;
    expect(__testing__.bypassMigrationCheck).toBe(false);
  });
});

describe('migrationGuard.__testing__ surface (production-discipline)', () => {
  it('is the only escape hatch — module exports no other bypass', () => {
    const escapeHatches = Object.keys(migrationGuardModule).filter((k) =>
      /bypass|skip|disable/i.test(k) && k !== '__testing__',
    );
    expect(escapeHatches).toEqual([]);
  });
});
