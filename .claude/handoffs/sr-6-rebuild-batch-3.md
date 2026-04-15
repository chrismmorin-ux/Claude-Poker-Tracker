# Session Handoff: sr-6-rebuild-batch-3

**Status:** CLOSED — SR-6.3 shipped 2026-04-14. Scope expanded beyond the 5 enumerated sites (owner's call: long-term fix over narrow handoff scope). 13 timer call sites migrated to `coordinator.scheduleTimer`; discipline test pins the invariant. Suite 1534 → 1536. Full details in STATUS.md + BACKLOG row SR-6.3. SR-6.4 unblocked. | **Written:** 2026-04-13 | **Closed:** 2026-04-14

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. `.claude/handoffs/sr-6-rebuild-batch-2.md` — what SR-6.2 shipped (22 fixtures; do not add more unless a new gap surfaces).
4. `docs/sidebar-rebuild/05-architecture-delta.md` §C4 — the RT-60 timer violations inventory.
5. `ignition-poker-tracker/side-panel/render-coordinator.js` — `registerTimer` contract (introduced in Phase B, RT-60).

## Scope

Migrate 5 bare `setTimeout` / `setInterval` sites onto `coordinator.registerTimer`. These are the residual sites the RT-60 contract was never extended to; the architecture audit (§C4) enumerates them:

| # | File:line | Purpose |
|---|---|---|
| 1 | `side-panel.js:172` | X.4c recovery-banner re-enable timer |
| 2 | `side-panel.js:300–310` | refreshHandStats retry backoff |
| 3 | `side-panel.js:2169–2171` | diagnostics panel auto-refresh interval |
| 4 | `side-panel.js:2200–2214` | fallback service-worker ping interval |
| 5 | `render-street-card.js:115, 126` | street-card transition timers |

Each migration: replace raw `setTimeout(fn, ms)` with `coordinator.registerTimer(label, fn, ms)`; verify `clearAllTimers()` on table switch unloads them.

**Out of scope:**
- FSM work (SR-6.5).
- Renaming or restructuring of the registerTimer API itself.
- Changes gated by `sidebarRebuild === true` — the sweep applies to the legacy path so existing users benefit.

## Acceptance gates

1. **Zero bare timers** — grep across `side-panel/*.js` finds no `setTimeout(` / `setInterval(` outside `render-coordinator.js` (owner) and `render-coordinator.test.js`.
2. **Lint rule** — add ESLint `no-restricted-syntax` or equivalent pinning this invariant (block `setTimeout` CallExpression in the two modules).
3. **Table switch clears all** — test: switch tables mid-hand, assert zero active timers via a coordinator introspection method.
4. **Full suite passes** — currently 1534.

## Files this session will modify

- `ignition-poker-tracker/side-panel/side-panel.js` — 4 sites.
- `ignition-poker-tracker/side-panel/render-street-card.js` — 2 sites.
- `ignition-poker-tracker/eslintrc` (or `package.json` lint config) — add rule.
- Possibly `render-coordinator.js` if a new introspection method is needed for the table-switch assertion.

## Files this session must NOT modify

- `shared/settings.js`, settings keys — sealed by SR-6.1.
- `fixtures.js` — sealed by SR-6.2.
- Any spec doc under `docs/sidebar-specs/`.

## Known gotchas

- **X.4c re-enable (site 1)** is the only timer that has a *user-visible* effect (recovery button stays disabled while cooldown holds). Verify the button still re-enables on schedule after migration; the fixture `zx_x4c_reEnableTimer` (added in SR-6.2) is the harness scenario.
- **Diagnostics auto-refresh (site 3)** is gated by the diagnostics panel being open — migration must preserve that gate; don't register the timer unconditionally at boot.
- **Street-card transition timers (site 5)** fire on street change. Make sure the timer label disambiguates flop/turn/river or use a single slot that's replaced on change (otherwise two transitions can overlap).

## Closeout checklist

- [ ] All 5 sites migrated
- [ ] Lint rule added + passing
- [ ] Full suite passes
- [ ] STATUS.md updated (SR-6.3 → COMPLETE, SR-6.4 → NEXT)
- [ ] BACKLOG.md updated (SR-6.3 → COMPLETE, SR-6.4 unblocked)
- [ ] Next handoff `.claude/handoffs/sr-6-rebuild-batch-4.md` for SR-6.4 (renderKey completion)
- [ ] This handoff closed

## Why this ships next

SR-6.5 (FSMs) and SR-6.15 (Zx PR) both depend on the timer contract being uniformly enforced — they co-locate timer lifecycle with FSM transition handlers, which only works if every timer source is registerable. SR-6.3 is also small and self-contained, so it lands cleanly before the larger SR-6.5 (FSM authoring, L).
