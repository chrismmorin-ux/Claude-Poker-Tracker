# ADR-PERSIST-3: Append-Only Stores

**Status:** Accepted
**Date:** 2026-05-14
**Sprint:** SPR-080 Item 2 (Refactor Sprint Item 7 / WS-188 Phase 3)
**Cross-links:**
- `docs/persistence/FAILURE_MODES.md` FM-PERSIST-7
- `src/utils/persistence/anchorObservationsStore.js`
- `src/utils/persistence/predictionAuditWriter.js`
- `src/utils/anchorLibrary/writers.js` (in-code writer registry)
- `docs/projects/exploit-anchor-library/WRITERS.md` (source of truth)

---

## Context

Two IDB stores in the codebase have **append-only semantics** by design:

1. **`anchorObservations`** (v19, EAL Phase 6) — every hand-replay-captured observation or matcher-system observation is appended. Existing observations are never mutated; promotion to candidate adds a `promotedToCandidateId` field but the source record stays.
2. **`predictionAudit`** (v25, PMC Phase 5a) — every hand's model prediction is captured forward-only. No backfill from re-running the model against historical hands.

IDB itself has **no notion of append-only stores**. `put()` permits full record replacement at any time. The append-only contract is enforced at the writer-API level: each store has a curated set of writers (see `WRITERS.md` for the canonical registry of anchor-store writers), and each writer commits to a field-scoped write discipline.

This ADR ratifies the writer-level append-only enforcement as the canonical pattern.

## Decision

A store may be designated **append-only** if it carries time-series observation or audit data where historical records have load-bearing meaning (i.e., overwriting them loses information).

Append-only stores MUST:
1. Have a fixed, enumerable writer registry (`WRITERS.md`-style document + in-code mirror via `decisionSystems/registry.createRegistry`).
2. Each writer commits to a field-scoped write discipline (e.g., W-EA-2 writes only `evidence` + `validation`; W-EA-3 writes only `status` + `operator.*`).
3. CI gates the writer registry against the code (`scripts/check-anchor-writers.sh` is the EAL-side enforcer; planned for predictionAudit).
4. The `MIGRATION_REGISTRY` entry's description identifies the store as append-only.

Append-only stores MUST NOT:
1. Be written from outside the registered writers.
2. Have any code path that calls `delete()` outside curated exceptions (e.g., dev-mode reset; per-store documented).
3. Be subject to runtime "compaction" or rewriting of historical records.

## Rationale

### Why writer-level enforcement (not schema-level)

IDB doesn't support append-only schemas. Implementing schema-level enforcement would require:
- Wrapping `put()` with a "does this key already exist?" check.
- Throwing on existing-key writes.
- The wrapper IS the writer-level discipline — moving it into the store wrapper just centralizes the same enforcement.

Centralizing at the wrapper is the right move (TD-21), but writer-level discipline is the load-bearing contract. Each writer's field-scoped commit is the audit trail; the wrapper enforces it.

### Why an enumerable writer registry

Per anchorLibrary CLAUDE.md core principle #9 + I-WR-1: every write into an append-only store MUST be enumerable from a documented registry. The registry is the audit surface: if a new write site appears, CI catches it before merge.

The pattern was extracted to `src/utils/decisionSystems/registry/createRegistry.js` in SPR-078, and anchorLibrary's `writers.js` is the day-1 consumer. A future predictionAudit writer registry should follow the same shape.

### Why no replay-backfill rule

For `predictionAudit`, Phase 5a explicitly ratified "forward-only — no engine-replay backfill" (per `feedback_validation_as_quality_signal.md` doctrine). The reason: re-running the model against historical hands and writing those predictions to the audit creates a moral hazard — the audit can be manipulated by changing the model and replaying. Forward-only means the audit captures the model's actual prediction at the time the hand was played; it cannot be rewritten.

## Consequences

### Enforced

- Anchor stores (4) have `WRITERS.md` + `writers.js` (in-code mirror via createRegistry). Drift test (`writers.test.js`) compares the two.
- `predictionAudit` writer enforcement is documentation-only today (no equivalent CI script yet).
- Append-only stores are NEVER deleted from outside dev-mode reset paths.

### Limitations

- Runtime guard absent. A buggy writer could overwrite an existing record; the registry CI catches the new write site but not the semantic violation.
- Per-store enforcement varies. EAL has full CI; PMC has documentation only.
- Tracked as TD-21: add runtime guard in store wrappers to reject overwrite-on-put for append-only stores.

### Sub-decisions deferred

- Runtime overwrite-rejection. Implementation candidate: `createAppendOnlyStore` factory in `decisionSystems/idbStore/` that rejects `put()` on existing key. Tracked as TD-21.
- predictionAudit writer registry analog. Currently `predictionAuditWriter.js` is the sole writer; if a second writer ships, formalize the registry.

## Alternatives considered

### Schema-level append-only (rejected)

Reject `put()` on existing key inside the store wrapper. Rejected (for now): more invasive than the writer-discipline contract, and the writer-level approach is sufficient given current write surfaces. Will revisit if a violation occurs.

### Compaction-friendly stores (rejected)

Allow occasional rewrites under documented rules (e.g., aggregate every 100 observations into a summary, delete the source records). Rejected: violates the audit-trail principle; observations are evidence and must not be lossy.

### Generic "history table" pattern (rejected)

Author every store with an automatic history-shadow store. Rejected: doubles IDB storage; doesn't generalize cleanly across store shapes.

## Status notes

- Initial authoring: 2026-05-14 (SPR-080).
- Owner-ratified via WS-188 spec list.
- Pattern in production: anchor stores since EAL v19 (2026-04-25); predictionAudit since v25 (2026-05-09).
