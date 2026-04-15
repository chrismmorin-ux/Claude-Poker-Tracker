# Session Handoff: sr-6-rebuild-batch-1

**Status:** CLOSED — SR-6.1 shipped 2026-04-13. See STATUS.md "Recently Completed" for summary. | **Written:** 2026-04-13

## Shipped

- `shared/settings.js` (new): `loadSettings` / `observeSettings` / `writeSetting` over `chrome.storage.local`. SETTINGS_KEYS + SETTINGS_DEFAULTS in `shared/constants.js`.
- `side-panel/render-coordinator.js`: `settings` slot in `_state`, included in snapshot (shallow copy), hashed into `buildRenderKey`.
- `side-panel/side-panel.js`: boot `loadSettings` → coordinator; `observeSettings` → `scheduleRender('settings_change', IMMEDIATE)`; gate sentinel `if (snap.settings?.sidebarRebuild)` placed at top of `renderAll`.
- `options/options.html` + `options/options.js` (new): two toggles writing through `writeSetting`.
- `manifest.json`: `options_page` wired.
- `build.mjs`: options entry point bundled (6 total), options HTML copied.
- `shared/__tests__/settings.test.js` (new): 7 tests — defaults / read / observe / area-filter / unrelated-key / write / unknown-key / coordinator integration.
- Total: 1314 extension tests pass; `npm run build` clean.

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. `docs/sidebar-rebuild/05-architecture-delta.md` — the sealed audit; SR-6.1 scope derives from §5 backlog table.
4. `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — doctrine v2 (sealed).
5. `.claude/BACKLOG.md` — SR-6.1 through SR-6.16 canonical status.

## Scope

Ship the foundation flag plumbing in one PR. Everything else in SR-6 (15 more items) gates behind the flag this PR introduces.

**Changes:**

1. **`settings.sidebarRebuild`** — boolean in `chrome.storage.local`, default `false`. Read at side-panel boot. Surfaces as `coordinator.get('settings.sidebarRebuild')`.
2. **`settings.debugDiagnostics`** — boolean in `chrome.storage.local`, default `false`. Same read path. Not yet consumed (SR-6.10 wires 0.7 and SR-6.14 wires 4.3).
3. **Coordinator observer for both keys.** On flip, `scheduleRender('settings_change')` fires. Add `chrome.storage.onChanged` listener.
4. **renderAll gate.** Every subsequent SR-6 PR's code path checks `settings.sidebarRebuild`; when `false`, legacy render path runs unchanged. For this PR, the gate is a no-op wrapper — legacy path is the only path. Gate is the structural hook subsequent PRs attach to.
5. **Settings surface** — extension Options page (or existing settings area) gains two toggles. User must be able to flip `sidebarRebuild` on/off to test upcoming PRs.

**Out of scope for SR-6.1:**
- Any renderKey changes (SR-6.4).
- Timer sweeps (SR-6.3).
- FSM authoring (SR-6.5).
- Any per-zone DOM change.

## Acceptance gates (4-gate check)

1. **Doctrine compliance** — the flag reader itself conforms to R-5.1 (single owner for the settings state).
2. **Test corpus** — existing replay corpus still passes with `sidebarRebuild === false`. No visible behavior change.
3. **Flag toggle determinism** — toggling `sidebarRebuild` in the Options page triggers a `scheduleRender` within 1 frame; toggling `debugDiagnostics` does likewise even though no consumer yet reads it (consumers arrive in 6.10/6.14).
4. **Forward compatibility** — an `if (flags.sidebarRebuild) { ... }` sentinel comment/block exists in the coordinator's renderAll so subsequent PRs have an obvious attachment point. Don't over-engineer — just leave a clear hook.

## Files this session will modify

- `ignition-poker-tracker/side-panel/side-panel.js` — add settings read at boot + coordinator observer.
- `ignition-poker-tracker/side-panel/render-coordinator.js` — settings state slot + gate hook in renderAll.
- `ignition-poker-tracker/options/*` or equivalent — two toggle UIs. If no options page exists, add minimal one.
- `ignition-poker-tracker/manifest.json` — only if options page is new.
- Tests: new unit test for settings reader + observer firing `scheduleRender` on flip.

## Files this session must NOT modify

- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — sealed v2.
- `docs/SIDEBAR_PANEL_INVENTORY.md` — sealed.
- `docs/sidebar-specs/*.md` — owner-approved spec surface.
- `docs/sidebar-rebuild/05-architecture-delta.md` — sealed audit.
- Any Z0/Z1/Z2/Z3/Z4/Zx render function — those ship in SR-6.10–6.15. SR-6.1 only introduces the flag, not consumers.

## Known gotchas

- **Don't wire consumers.** Tempting to flip 0.7 behind `debugDiagnostics` in the same PR. Resist — SR-6.10 owns Z0.
- **Default false is critical.** The entire rebuild is flag-off by default until SR-7 cutover. A PR that accidentally defaults to true is a rollback risk.
- **Chrome.storage.local vs sync.** Stay with `local` for both keys — matches existing extension storage pattern. `sync` would surface cross-device settings that the rebuild program has not scoped.
- **Options page may be missing.** Current extension may not have an options page; check before inventing one. If none, adding a minimal `options.html` + manifest entry is the right move for this PR. If one exists, extend it.

## Closeout checklist

- [ ] Both settings keys readable from `chrome.storage.local` at boot
- [ ] Coordinator observer fires `scheduleRender` on flip of either key
- [ ] Gate hook present in `renderAll` (no-op when flag false)
- [ ] Options page toggles both keys
- [ ] Replay corpus unchanged (flag false)
- [ ] Unit test covers settings read + observer firing
- [ ] STATUS.md updated (SR-6.1 → COMPLETE, SR-6.2 → NEXT)
- [ ] BACKLOG.md updated (SR-6.1 → COMPLETE, SR-6.2 unblocked)
- [ ] Next handoff authored at `.claude/handoffs/sr-6-rebuild-batch-2.md` for SR-6.2 (harness corpus extension)
- [ ] This handoff closed

## Why this ships first

SR-6.1 is the dependency root for every other SR-6 item. Without the flag, SR-6.2–SR-6.16 have no way to ship partial rebuild changes without breaking existing users on `main`. The audit (`05-architecture-delta.md` §5) placed this first in dependency order. Owner approved 2026-04-13.
