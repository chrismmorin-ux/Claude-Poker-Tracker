/**
 * @file viewRegistry invariants — the structural guard that prevents the
 * CALIBRATION_DASHBOARD class of drift (a SCREEN constant with no router entry
 * that silently renders nothing). Plan shimmying-moseying-lantern, Phase B.
 */

import { describe, it, expect, vi } from 'vitest';

// Stub the eager view modules so importing the registry is cheap (no heavy
// component trees). Lazy views are never imported unless rendered.
vi.mock('../../components/views/TableView', () => ({ TableView: () => null }));
vi.mock('../../components/views/HomebaseView', () => ({ HomebaseView: () => null }));

import { SCREEN } from '../uiConstants';
import { VIEW_REGISTRY, HASH_TO_SCREEN, VIEW_TO_ORIENTATION } from '../viewRegistry';

describe('viewRegistry', () => {
  it('has a registry entry for EVERY SCREEN constant (no silent-render drift)', () => {
    const missing = Object.entries(SCREEN)
      .filter(([, screen]) => !(screen in VIEW_REGISTRY))
      .map(([key]) => key);
    expect(missing).toEqual([]);
  });

  it('every entry has a human-readable name', () => {
    for (const [screen, entry] of Object.entries(VIEW_REGISTRY)) {
      expect(typeof entry.name, `entry ${screen} missing name`).toBe('string');
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it('every non-deferred entry is renderable (component | render | noScale component)', () => {
    for (const [screen, entry] of Object.entries(VIEW_REGISTRY)) {
      if (entry.deferred) continue;
      const renderable = typeof entry.render === 'function' || entry.component != null;
      expect(renderable, `entry ${screen} is not renderable`).toBe(true);
    }
  });

  it('derives the deep-link hash map from the registry', () => {
    expect(HASH_TO_SCREEN['#online']).toBe(SCREEN.ONLINE);
    expect(HASH_TO_SCREEN['#sessions']).toBe(SCREEN.SESSIONS);
    expect(HASH_TO_SCREEN['#settings']).toBe(SCREEN.SETTINGS);
    expect(HASH_TO_SCREEN['#player-finder']).toBe(SCREEN.PLAYER_FINDER);
  });

  it('derives the portrait orientation policy from the registry', () => {
    expect(VIEW_TO_ORIENTATION[SCREEN.SESSIONS]).toBe('portrait');
    expect(VIEW_TO_ORIENTATION[SCREEN.SETTINGS]).toBe('portrait');
    expect(VIEW_TO_ORIENTATION[SCREEN.PLAYER_FINDER]).toBe('portrait');
    expect(VIEW_TO_ORIENTATION[SCREEN.PLAYER_PROFILE]).toBe('portrait');
    // Landscape views are not in the map (resolver defaults them).
    expect(VIEW_TO_ORIENTATION[SCREEN.TABLE]).toBeUndefined();
    expect(VIEW_TO_ORIENTATION[SCREEN.HOMEBASE]).toBeUndefined();
  });

  it('registers CALIBRATION_DASHBOARD as a deferred stub (was the shipped drift bug)', () => {
    expect(VIEW_REGISTRY[SCREEN.CALIBRATION_DASHBOARD].deferred).toBe(true);
  });
});
