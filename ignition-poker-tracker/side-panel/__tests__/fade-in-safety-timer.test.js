/**
 * fade-in-safety-timer.test.js — WS-112 (RT-89 / SPR-058) regression
 * test for the animationend fallback safety timer.
 *
 * The fix: render-street-card.js's street-fade transition relies on
 * the native CSS `animationend` event to remove the .fade-in class
 * after the 200ms fade-in animation completes. On Android devices
 * under thermal throttle, GPU-accelerated animations can be skipped
 * entirely — the listener never fires and the .fade-in class leaks
 * indefinitely. This pins the WS-112 fix structurally so the safety
 * timer doesn't get accidentally removed.
 *
 * Source-grep approach mirrors dom-mutation-discipline.test.js +
 * stale-context-writer-discipline.test.js. We verify:
 *   1. FADE_IN_CLEANUP_TIMER_KEY constant is declared
 *   2. scheduleTimer(FADE_IN_CLEANUP_TIMER_KEY, ...) is called exactly
 *      once (the cleanup-pairing) — the cleanup function fires the
 *      class removal even when animationend doesn't
 *   3. clearTimer(FADE_IN_CLEANUP_TIMER_KEY) is called in three sites:
 *      resetStreetCardState (test harness reset), top-of-render
 *      (cancel-on-rerender), and the streetChanged branch
 *      (cancel-before-new-fade)
 *   4. The cleanup-firing window is FADE_IN_CLEANUP_MS = 300 (covers
 *      the 200ms fade-in animation + 100ms jitter cushion)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(__dirname, '..', 'render-street-card.js'),
  'utf8',
);

const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const code = stripComments(SRC);

describe('WS-112 / RT-89 — animationend fallback safety timer', () => {
  it('declares the FADE_IN_CLEANUP_TIMER_KEY constant', () => {
    expect(code).toMatch(/const\s+FADE_IN_CLEANUP_TIMER_KEY\s*=\s*['"][^'"]+['"]/);
  });

  it('declares the FADE_IN_CLEANUP_MS constant at 300ms', () => {
    expect(code).toMatch(/const\s+FADE_IN_CLEANUP_MS\s*=\s*300\b/);
  });

  it('schedules the safety timer exactly once (paired with the addEventListener)', () => {
    const matches = code.match(/scheduleTimer\(\s*FADE_IN_CLEANUP_TIMER_KEY\b/g) || [];
    expect(matches.length).toBe(1);
  });

  it('clears the safety timer in three sites (reset + top-of-render + streetChanged branch)', () => {
    const matches = code.match(/clearTimer\(\s*FADE_IN_CLEANUP_TIMER_KEY\b/g) || [];
    expect(matches.length).toBe(3);
  });

  it('preserves the animationend listener (safety timer is a fallback, not a replacement)', () => {
    expect(code).toMatch(/addEventListener\(\s*['"]animationend['"]/);
  });

  it('cleanupFadeIn function name appears in source (single shared callback for both paths)', () => {
    // The fix uses a single named callback bound to both the listener and the
    // safety timer, making the dual-path symmetry obvious. If a future refactor
    // duplicates the cleanup logic across two anonymous functions, this test
    // surfaces the drift.
    expect(code).toMatch(/cleanupFadeIn/);
  });
});
