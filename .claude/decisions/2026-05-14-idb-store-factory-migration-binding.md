# ADR-DS-2: IDB Store Factory Binds to `migrationRegistry`

**Status:** Accepted
**Date:** 2026-05-14
**Sprint:** SPR-078 (Refactor Sprint Item 4)
**Authors:** Owner-ratified via plan-mode Q2=Bind (2026-05-14)
**Supersedes:** —
**Superseded by:** —
**Cross-links:**
- `.claude/decisions/2026-05-14-decision-systems-extraction.md` (ADR-DS-1; this ADR is its companion)
- `src/utils/persistence/migrationRegistry.js` (the registry this binding targets)
- `src/utils/decisionSystems/idbStore/migrationGuard.js` (the binding implementation)
- `.claude/context/SYSTEM_MODEL.md` §11 TD-16 (the drift surface this closes)
- `feedback_action_dispatch_legality.md` (the "prefer unrepresentable to validated" doctrine this matches)

---

## Context

Refactor Sprint Item 3 (shipped 2026-05-11) introduced `src/utils/persistence/migrationRegistry.js` — a read-only governance layer documenting every IDB store, its owner program, and the migration that created it. The registry is consumed by `migrations.js` for logging, by tests for additive-only enforcement, and by the CI gate `scripts/check-idb-additive.sh`.

**Drift surface still open before this ADR:** the registry has no teeth at *write* time. Today a developer can author an `*Store.js` CRUD wrapper that references a store name without that name being registered. The IDB upgrade will silently skip creating the missing store; the first runtime `put()` will fail with a low-context error (`InvalidStateError: An invalid object store name was specified`); root-cause tracing takes minutes-to-hours.

Refactor Sprint Item 4 (SPR-078) introduces three IDB factories — `createUpsertStore`, `createReplaceAllStore`, `createEmbeddedRecordStore` — at `src/utils/decisionSystems/idbStore/`. These factories are the new canonical authoring path for IDB store wrappers. Item 4 is the natural moment to close the drift surface: the factories can assert registry membership at construction time, moving the friction from "first write in production" to "first import in development."

## Decision

Every IDB store factory in `decisionSystems/idbStore/` calls `migrationGuard.assertStoreRegistered(storeName)` synchronously at construction time. The assertion:

1. Reads `getStoreOwner(storeName)` from `migrationRegistry.js`.
2. Throws synchronously if the result is `null` (store not registered).
3. The thrown error message references both the missing store name and `migrationRegistry.js` as the file to edit.

**Test escape hatch:** `migrationGuard.__testing__.bypassMigrationCheck` (read-write boolean) suppresses the assertion when set to `true`. The hatch is for test fixtures that need to exercise factory shape without mutating the registry (e.g., factory-construction unit tests against a hypothetical unregistered store). Production code MUST NOT reference `__testing__` — CI grep enforces.

### Failure shape

When `assertStoreRegistered('newStore')` throws on an unregistered store, the error message is:

> `assertStoreRegistered: store "newStore" is not registered in src/utils/persistence/migrationRegistry.js. Before creating an IDB store via the decisionSystems/idbStore factories, add an entry whose storesAdded includes this name. See docs/decisions/2026-05-14-idb-store-factory-migration-binding.md for the contract.`

The message names the file to edit, the field to add, and the ADR for context. The author can fix the issue in one minute — add an entry to `MIGRATION_REGISTRY` — without having to root-cause why the store-creation didn't happen.

### Authoring workflow under the binding

To add a new IDB store:

1. Add a new entry to `MIGRATION_REGISTRY` in `migrationRegistry.js` (storesAdded includes the new name, owner.program is one of `KNOWN_PROGRAM_IDS`, migrationFn references the new function).
2. Author the migration function in `migrations.js`.
3. Bump `DB_VERSION` in `database.js`.
4. Author the `*Store.js` wrapper using `createUpsertStore({ storeName: 'newStore', ... })`.

The order matters: skipping step 1 means step 4 throws at import time, prompting the author back to step 1 before continuing.

## Rationale

### Why bind (over decouple)

Owner ratified Q2=Bind. Three reasons:

1. **Drift prevention is the load-bearing benefit of the registry.** A registry that nothing forces consumers to use is documentation, not governance. Binding the factory makes the registry's program-ownership invariant + additive-only contract reachable at the right moment (authoring time, not run time, not deploy time).

2. **"Prefer unrepresentable to validated" doctrine** (memory: `feedback_action_dispatch_legality.md`). The owner-articulated principle: when a payload's expressiveness lets callers construct illegal states, shrink the payload at construction time, do not validate at the boundary. Applied here: a store-wrapper-that-doesn't-correspond-to-a-registered-store is an illegal state that the factory makes structurally impossible to construct.

3. **Friction goes in the right place.** Authoring-time friction (developer sees the error immediately, fixes the registry, moves on) is much cheaper than runtime friction (production crash, log dive, root-cause). The escape hatch keeps test ergonomics intact without weakening the production guarantee.

### Why the escape hatch is bounded

`__testing__.bypassMigrationCheck` is a single read-write boolean on a module-scoped variable. It's not a constructor option, not a per-call parameter, not a per-store flag. The narrow shape makes it grep-targetable: `grep -rn "bypassMigrationCheck" src/` returns hits only in:
- `__tests__/` paths (legitimate test fixtures).
- `migrationGuard.js` itself (the definition).

Production code referencing `__testing__` is an anti-pattern caught by CI grep (per `decisionSystems/CLAUDE.md`).

### Why synchronous assertion at construction (not lazy)

Two alternatives were considered:

- **Lazy (per-call check)**: factory just returns CRUD methods; each method asserts before its IDB call. **Rejected**: a wrapper file's import alone wouldn't trigger the check, so an unused-but-broken wrapper would sit in the codebase silently until the first call.
- **Async at construction**: factory returns a Promise that resolves to the CRUD wrapper after async registry-load. **Rejected**: the registry is synchronous (`getStoreOwner` returns directly from an in-memory array), so async wrapping would be ceremonial. Also makes test fixtures more complex.

Synchronous-at-construction is the cheapest correct shape.

## Consequences

### Resolved

- **`SYSTEM_MODEL.md` §11 TD-16 sub-item — "stores can exist in IDB without a migrationRegistry entry"** — RESOLVED for stores authored via the new factories. Existing stores authored before SPR-078 already happen to be registered (Refactor Sprint Item 3 audited this), so the binding is fully closed at the moment of this ADR's acceptance.
- **Low-context error mode** (`InvalidStateError: An invalid object store name was specified`) — REPLACED by the synchronous load-time error pointing the author at `migrationRegistry.js`.

### Introduced

- **All future IDB stores authored via `decisionSystems/idbStore/` factories MUST be registered in `migrationRegistry.js` first.** The registry's program-ownership invariant gains teeth: every store now has an owner program.
- **Authoring-time friction at one specific moment**: the first import of a wrapper for an unregistered store. The friction is single-step (add registry entry) and the error message points at the right file.
- **Test escape hatch** (`__testing__.bypassMigrationCheck`). Production-discipline test in `migrationGuard.test.js` (`is the only escape hatch — module exports no other bypass`) prevents accidental drift.

### Out of scope (deferred to future ADRs)

- **Auto-registration via factory.** The factory does NOT update `migrationRegistry.js` when a new store is referenced; it just asserts. Auto-registration would couple the factory to file-system writes — out of scope. The authoring-time pattern is "edit the registry file" not "let the factory do it."
- **Cross-store transaction handling.** The factories build one-store-at-a-time wrappers. Multi-store atomic transactions (e.g., cross-anchor invalidation ripple per I-WR-3) remain the consumer's responsibility — the wrappers don't compose multi-store transactions.
- **Schema-shape validation.** The factories don't validate that records match a schema. Per-record validation is the consumer's responsibility (e.g., `validateAnchor.js`, `assumptionEngine/validator.js`).

## Verification

- **Unit tests at `src/utils/decisionSystems/idbStore/__tests__/migrationGuard.test.js`** (10 tests):
  - Default path: registered store passes; unregistered store throws with registry-pointer message; empty/non-string storeName throws.
  - Bypass flag: starts false; suppresses assertion when true; re-engages when false; coerces truthy/falsy values to boolean.
  - Production-discipline: registry exports no escape hatch other than `__testing__`.
- **Round-trip tests at `createUpsertStore.test.js`, `createReplaceAllStore.test.js`, `createEmbeddedRecordStore.test.js`** — every factory's construction-time assertion test covers the bound + bypass + registered paths.
- **CI grep** (future, lightweight script): `grep -rn "bypassMigrationCheck" src/` MUST return hits only in `__tests__/` + `migrationGuard.js`.

## Alternatives considered

### Decouple — factory just produces CRUD wrappers

Rationale (rejected): preserves the boundary, lower friction during development. Cost: the drift surface stays open — a store can exist without registry membership, and the registry's program-ownership invariant has no enforcement bite.

### Bind via a registry-write side effect

Factory auto-registers a missing store on first import. Rationale (rejected): couples the factory to file-system writes; the authoring intent (which program owns this store?) is lost because the factory has no way to know. Authoring-time explicit registration is the right shape.

### Defer the binding to a future ADR

Ship the factories decoupled now; close the drift surface later. Rationale (rejected): the moment of factory introduction is the natural binding point; deferring means existing call sites have already wired up without the assertion and back-fitting is harder.

## Status notes

- Initial authoring: 2026-05-14 (SPR-078).
- Owner-ratified: 2026-05-14 via plan-mode AskUserQuestion (Q2=Bind, Q3=Two ADRs).
- Implementation: companion to ADR-DS-1; ships in the same sprint.
