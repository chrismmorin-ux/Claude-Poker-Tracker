# Contracts

Cross-surface / cross-module invariants that the framework must document explicitly, because leaving them implicit causes silent breakage.

A contract is a *shape + ownership + invariant* declaration that spans more than one surface. If the contract changes, every surface that reads or writes the shape must be audited. Contracts surface the kind of coupling that otherwise hides in fallback paths, dual-reads, and "works on my machine."

---

## Why contracts are in the design framework (not just code)

Code-level contracts (validators, type defs, tests) exist in `src/`. They enforce at runtime. But they do not:
- Link the contract to personas / JTBDs / surfaces.
- Make the contract findable when a future session is designing a new surface that will read the same shape.
- Tell you which surface is the **writer** and which are **readers**.

The contracts here are the design-framework's record: *what cross-surface invariants exist, and where are they enforced in code.*

---

## Contracts

- [persisted-hand-schema.md](./persisted-hand-schema.md) — shape of a hand record in the `hands` IDB store. Writer: `TableView` → `ShowdownView` commit. Readers: `HandReplayView`, `AnalysisView`, export pipeline.

---

## Adding a new contract

Create a new file following the `persisted-hand-schema.md` pattern:

1. **Canonical shape** — what fields exist, under what keys.
2. **Writers** — which surfaces / code paths write the shape. Explicit list.
3. **Readers** — which surfaces / code paths read the shape. Explicit list.
4. **Invariants** — what must be true.
5. **Code enforcement** — pointer to the validator / type / test that enforces the contract at runtime.
6. **Known drift** — evidence of migration, fallback paths, inconsistency.
7. **Change protocol** — what must happen to change the contract safely.

---

## Change log

- 2026-04-21 — Created. Seeded with persisted-hand-schema in response to blind-spot audit 2026-04-21 table-view §D1.
