# ADR-PERSIST-1: Schema Versioning Policy

**Status:** Accepted
**Date:** 2026-05-14
**Sprint:** SPR-080 Item 2 (Refactor Sprint Item 7 / WS-188 Phase 3)
**Cross-links:**
- `docs/persistence/FAILURE_MODES.md` FM-PERSIST-2, FM-PERSIST-8
- `src/utils/persistence/migrationRegistry.js`
- `src/utils/persistence/database.js`
- `docs/projects/exploit-anchor-library/gate4-p3-decisions.md` §2 (origin)

---

## Context

IDB schema versions are linear integers (`DB_VERSION` in `database.js`). When two concurrent projects each need a new schema version, they collide: both expect to claim the next integer. Pre-2026-04 there was no documented resolution; sprints had to coordinate version numbers manually, which broke on parallel work.

The precedent set in `gate4-p3-decisions.md §2` (EAL Phase 6, 2026-04-25) introduced the **dynamic-target** rule: a migration claims `max(currentDBVersion + 1, intendedVersion)`. The first-to-ship-an-actual-migration claims the lower number; the second is auto-bumped to one higher. The collision is resolved by file-system order rather than coordination.

This worked for EAL v19 + PRF v20 (PRF intended v18 but EAL had already claimed v19, so PRF's `max(19+1, 18) = 20`). The pattern is now codified.

## Decision

The schema-version assignment rule is `max(currentDBVersion + 1, intendedVersion)` where:
- `currentDBVersion` = the latest version recorded in `migrationRegistry.js` at the time of authoring.
- `intendedVersion` = the version the author wants (often the same as `currentDBVersion + 1`).

When two migrations are authored in parallel, the first to merge claims the lower number; the second is rebased and bumped on conflict.

**Authoring workflow:**
1. Author the new `migrateVN` function in `migrations.js`.
2. Add an entry to `MIGRATION_REGISTRY` in `migrationRegistry.js` with `version = max(currentMax + 1, intended)`.
3. Bump `DB_VERSION` in `database.js` to match.
4. Run `migrationRegistry.test.js` — test #6 fails the build if these three drift.

## Rationale

### Why dynamic-target (over coordination)

Coordinated version numbering requires every parallel author to be aware of every other in-flight migration. With ~4 active programs (PIO / SCF / EAL / PMC / LSW), version collisions happen every 2-3 weeks. Dynamic-target is the cheapest correct resolution: the merge order is the natural total order, and the conflict surface is detection (test #6) not negotiation.

### Why an in-code registry (over generated)

`migrationRegistry.js` is a hand-authored append-only list. The author fills in `description`, `owner.program`, `storesAdded`, `migrationFn`. The discipline of filling in those fields is the audit trail — auto-generation would skip the most valuable part (intent + ownership).

Test #6 closes the consistency loop: if the registry is stale (a `migrateVN` exists in `migrations.js` without a registry entry), the test fails CI before merge. The registry doesn't auto-update, but it can't drift silently.

## Consequences

### Enforced

- Test #6 in `migrationRegistry.test.js` asserts:
  - `DB_VERSION === max(MIGRATION_REGISTRY[*].version)`.
  - Every `migrateVN` function in `migrations.js` has a matching registry entry.
  - Registry is monotonic (no gaps in version numbers).
- CI gate `scripts/check-idb-additive.sh` (Refactor Sprint Item 3 output) forbids `deleteObjectStore` / `deleteIndex` in `migrations.js`.
- Runtime logging at upgrade time (`migrations.js:1154-1166`) outputs which registered versions applied — surfaces a stale registry.

### Limitations

- **No downgrade support.** IDB does not support `oldVersion > newVersion`. If a user runs an older app bundle after a newer bundle wrote the DB, newer stores are invisible to the older code. This is FM-PERSIST-2 (CRITICAL).
- **Single-tab assumption** (INV-PERSIST-5, FM-PERSIST-5). Multi-tab simultaneous upgrades are not supported; `onblocked` handler is the only conflict mechanism.

### Sub-decisions deferred

- App-level version refusal: should the app detect `DBVersion > codeVersion` at startup and refuse to run? Currently no detection; deployment must never serve older bundles. Tracked as future work.
- Generated registry: if collision frequency increases past ~weekly, consider auto-generating the registry from migration function decorators. Not pursued today.

## Alternatives considered

### Manual coordination (rejected)

Authors coordinate version numbers via Slack/issue tracker. Rejected: imposes meeting overhead on parallel work; doesn't scale.

### Single-author bottleneck (rejected)

All migrations go through one author who assigns version numbers. Rejected: creates a critical-path engineer and slows down all schema-touching work.

### Hash-based versioning (rejected)

Use a content hash of the migration body as the version. Rejected: IDB requires integer versions; hash mapping requires another registry; complexity without benefit.

## Status notes

- Initial authoring: 2026-05-14 (SPR-080).
- Owner-ratified via WS-188 spec list (Q3=4 ADRs, recommended option).
- Pattern in production since 2026-04-25 (EAL Phase 6); now formalized.
