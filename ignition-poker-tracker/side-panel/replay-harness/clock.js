/**
 * clock.js — deterministic fake clock for in-browser replay.
 *
 * SR-3 Panel Inventory harness. Mirrors `test/replay/clock.js` 1:1.
 * Keep in sync manually.
 *
 * Replaces Date.now, setTimeout, clearTimeout, setInterval, clearInterval,
 * requestAnimationFrame on the provided globalTarget with a virtual timeline.
 * `advance(ms)` fires any scheduled callbacks whose deadline has passed.
 *
 * Scope note: the browser's internal animation/reflow timers are unaffected —
 * only callbacks scheduled through the patched globals use fake time.
 */

export function installFakeClock(globalTarget, { startAt = 1_700_000_000_000 } = {}) {
  let now = startAt;
  let seq = 0;
  const timers = new Map();
  let nextId = 1;

  const schedule = (fn, delay, every) => {
    const id = nextId++;
    timers.set(id, { deadline: now + Math.max(0, delay | 0), fn, seq: seq++, every });
    return id;
  };

  globalTarget.Date = class extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  };
  globalTarget.Date.now = () => now;

  globalTarget.setTimeout = (fn, delay = 0) => schedule(fn, delay, null);
  globalTarget.clearTimeout = (id) => timers.delete(id);
  globalTarget.setInterval = (fn, delay = 0) => schedule(fn, delay, delay);
  globalTarget.clearInterval = (id) => timers.delete(id);
  globalTarget.requestAnimationFrame = (fn) => schedule(() => fn(now), 16, null);
  globalTarget.cancelAnimationFrame = (id) => timers.delete(id);
  globalTarget.queueMicrotask = (fn) => Promise.resolve().then(fn);

  return {
    now: () => now,
    advance: (ms) => {
      const target = now + ms;
      while (true) {
        let nextId_ = null;
        let next = null;
        for (const [id, t] of timers) {
          if (t.deadline > target) continue;
          if (!next || t.deadline < next.deadline || (t.deadline === next.deadline && t.seq < next.seq)) {
            next = t; nextId_ = id;
          }
        }
        if (!next) break;
        now = next.deadline;
        if (next.every != null) {
          timers.set(nextId_, { ...next, deadline: now + next.every, seq: seq++ });
        } else {
          timers.delete(nextId_);
        }
        try { next.fn(); } catch (e) { /* swallow */ }
      }
      now = target;
    },
    timerCount: () => timers.size,
  };
}
