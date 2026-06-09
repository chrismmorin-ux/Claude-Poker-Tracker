---
name: kit-upgrade
description: "Safely upgrade this repo's CWOS kit to the latest HomeBase version — dry-run diff, snapshot, validation gate, auto-rollback"
user-invocable: true
argument-hint: "[--apply] [--rollback] [--homebase <path>]"
---

# /kit-upgrade — Upgrade this repo's CWOS kit

Brings an adopted repo's kit up to the current HomeBase version **safely by construction**: it shows you exactly what will change before touching anything, snapshots the kit for rollback, runs the upgrade under a lock, validates the result, and **automatically rolls back if anything fails** — so you never end up half-upgraded.

This is the careful, single-repo path. `/fleet-update` is the HomeBase-side bulk push across all repos; `/kit-upgrade` is what you run **inside one repo** when you want to close the version gap with confidence. Local state (`.claude/workstream/`, `system/`, `.cwos-*.yaml`, `notes/`, your rules) is **never overwritten** — only HomeBase-authored surfaces (commands, agents, skills, `kit/scripts/`, engine/persona templates) are updated.

It composes the existing machinery (`cwos-migrate.js` for file classification + apply + program-schema migration; the registry-sync scripts) and adds the safety layer: version-staged schema sequencing, a pre-upgrade snapshot, a write lock, a post-upgrade validation gate, auto-rollback, and loud surfacing of any kit files you hand-edited.

## Output Shape

**Upgrade arc:** `<dry-run | applied | rolled-back | already-current>` — `<one-clause status>`.
`<Delta line: vX → vY, N files (M overwrite / A add / C customized), schema migrations staged.>`
`<Remainder: the per-file diff + any local-mod warnings (dry-run), or the gate result table (apply).>`

## Default: dry-run (no writes)

```bash
node kit/scripts/cwos-kit-upgrade.js --homebase "<path to Claude HomeBase>"
```

Prints, **without changing anything**:
- the version delta (installed → HomeBase current),
- **schema migrations** that will run on apply (program v?→v4, state-store), listed separately,
- a **per-file** action list: `[overwrite]` / `[add]` / `[.kit-update]` (customized files get a side-by-side sidecar, never clobbered),
- a **⚠ local kit modifications** section — any kit file you hand-edited, with `expected → actual` hashes, so you know what would be overwritten unless you save it first.

If the installed version already equals HomeBase, it's a **no-op** plus a clean health report (idempotent — safe to run anytime).

If the repo is too many versions behind and an **intermediate schema migrator is missing**, it refuses (exit ≠ 0) and names the missing step rather than half-migrating.

## Apply

```bash
node kit/scripts/cwos-kit-upgrade.js --homebase "<path>" --apply
```

Runs under a lock (`.claude/workstream/.kit-upgrade.lock`):
1. **Snapshot** the authored surface to `.cwos-snapshots/kit-pre-upgrade-<timestamp>/` (the rollback source of truth).
2. **Apply** files (per MANIFEST merge strategy) + program-schema migration + state-store schema + index rebuild + version stamp.
3. **Re-materialize** the program and engine registries.
4. **Validation gate** — all must pass: `cwos-reconcile --quiet` clean, `cwos-next gate` runs, `cwos-next allocate-ws-id` returns `ok:true` (the WS-040 regression guard), `cwos-pulse overview` runs, `cwos-audit focus drift` runs, **every registry path resolves to a real file**, and the version stamp is bumped.
5. On success: report + retain the snapshot. **On any gate failure: automatically restore the snapshot, leave the repo at the old version, and exit non-zero naming the failing check.**

After a successful apply, review any `.kit-update` sidecars to merge your customizations into the new versions.

## Rollback

```bash
node kit/scripts/cwos-kit-upgrade.js --rollback
```

Restores the most recent `kit-pre-upgrade-*` snapshot (deletes files the upgrade added, restores everything it overwrote, reverts `.cwos-version`). The snapshot is retained so you can re-apply later.

## Flags

| Flag | Effect |
|------|--------|
| `--homebase <path>` | HomeBase root that sources the new kit (required unless resolvable from cwd). |
| `--apply` | Perform the upgrade (default is dry-run). |
| `--rollback` | Restore the most recent pre-upgrade snapshot and exit. |
| `--json` | Machine-readable summary. |
| `--yes` | Non-interactive (assume confirmation). |

## Notes

- **Local-mod baseline:** detection prefers the per-version hash manifest shipped into the repo at install/upgrade (`kit/hashes-<installed>.yaml`), falling back to `.cwos-version#installed_files`, then git-tag reconstruction. If no baseline is available it says so — customized files are still protected via `.kit-update` sidecars (never silently clobbered).
- **What's preserved:** everything outside the HomeBase-authored surface — `.claude/workstream/` (queue, programs, findings, sprints, runs, events, indexes), `system/`, `.cwos-config.yaml`, `.cwos-onboarding.yaml`, `.cwos-feedback.yaml`, `notes/`, and your own `.claude/rules/` additions.
- Full procedure + design rationale: `docs/guides/kit-upgrade-guide.md`.
