# SR-1 Finding — Latent TDZ crash in `side-panel.js` (two sites)

**Surfaced by:** SR-1 replay framework on first run under jsdom (2026-04-12)
**Severity:** Critical — next production build (`npm run build`) crashes side panel at module init
**Hidden by:** `dist/side-panel/side-panel.js` is stale — predates RT-60 / RT-48 and does not contain the offending calls. Production users are running an old bundle.

## Mechanism

`side-panel.js` IIFE is evaluated top-to-bottom. The IIFE references `coordinator` at two module-init-synchronous sites, but `const coordinator = new RenderCoordinator({...})` is declared at **line 1701**. Any synchronous use of `coordinator` before that point hits the TDZ and throws `ReferenceError: Cannot access 'coordinator' before initialization`, aborting the entire IIFE.

### Site 1 — `staleContext` interval (introduced by RT-60, commit fb4803b)

Original offending block (pre-fix):
```js
{
  const handle = setInterval(() => { /* ...uses coordinator... */ }, 10_000);
  coordinator.registerTimer('staleContext', handle, 'interval'); // ← synchronous TDZ
}
```

### Site 2 — `adviceAgeBadge` interval (introduced by RT-48, commit 0341328)

```js
coordinator.registerTimer(            // ← synchronous TDZ
  'adviceAgeBadge',
  setInterval(() => { /* ...uses coordinator... */ }, 1000),
  'interval',
);
```

## Why production didn't crash

`esbuild` target `chrome120` preserves TDZ. The source is broken; the shipped bundle simply predates these two RT-* items. The next `npm run build` would ship the crash.

## Fix applied in this session (scope: SR-1 tooling unblock)

Both sites now build the `setInterval` handle synchronously but defer the `coordinator.registerTimer` call one microtask, so module eval reaches `const coordinator = ...` first:

```js
const _handle = setInterval(() => { /* ...uses coordinator... */ }, 10_000);
queueMicrotask(() => coordinator.registerTimer('staleContext', _handle, 'interval'));
```

This is the minimal change to unblock the replay harness. A cleaner architectural fix (move the `const coordinator = ...` declaration above all use sites, or wrap init in an `initializeAfterCoordinator()` function) is deferred to SR-5 / SR-6.

## Meta-value

The SR-1 replay framework surfaced this bug before it reached production — on its first run, before any corpus reproduction. That is direct evidence that loading the real `side-panel.js` under a programmatic test environment (vs. the visual harness, which bypasses `side-panel.js` entirely — see A6 falsification in `assumptions.md`) catches classes of bugs that 4,400+ existing unit tests and the visual harness both missed.

## Related

- `.claude/projects/sidebar-rebuild/00-forensics.md` — §2 / §3 mechanism catalog (M1–M8). This TDZ bug is NOT one of M1–M8; it is a latent init-order bug independent of the S1–S5 symptom class. No new symptom ID is added to the sealed register.
- `.claude/projects/sidebar-rebuild/assumptions.md` — A6 (harness is wrong paradigm) now has a second line of evidence.
