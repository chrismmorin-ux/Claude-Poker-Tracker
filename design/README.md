# Artifact-Driven Design Framework (Scaffold)

Extracted from ServeYourNote's `design/` directory (Phase 1). Lifts prog-design
end-user surface to L3 (docs-only framework) and L5 (load-bearing framework
with code traceability).

## What is an artifact-driven design framework?

A design framework where the **artifacts are load-bearing** — meaning the
design artifacts (personas, jobs, scenarios, feature design briefs) are
referenced from code, enforced in verification, and drive implementation.
Not a style guide; a governance system.

## Artifact types

| Artifact | Purpose | Example file |
|---|---|---|
| `personas/` | Who uses the product and how | `borrower.md`, `holder.md` |
| `jobs/` | Jobs-to-be-done per persona | `track-loan-payments.md` |
| `scenarios/` | Multi-step scenarios with success criteria | `first-borrower-signup.md` |
| `features/` | Feature design briefs (FDBs) — end-to-end design of a feature | `FDB-001-dashboard.md` |
| `invariants.md` | UX invariants that must hold (UXI-001 etc.) | — |
| `decisions/` | Design decisions as ADR-style records (DDRs) | `DDR-001-auth-flow.md` |
| `patterns/` | Reusable interaction patterns | `confirm-before-destructive.md` |
| `traceability.yaml` | Code-to-artifact mapping (load-bearing layer) | — |
| `gaps.yaml` | Known design gaps with status | — |

## Getting to L3 (docs-only, acceptable starting point)

1. Create `design/` at the repo root
2. Define 2-4 personas in `personas/` — real user archetypes, not buyer personas
3. Write one FDB per major feature in `features/` — see template below
4. List UX invariants in `invariants.md` with UXI-NNN identifiers
5. Reference FDBs from code comments where behavior is load-bearing

## Getting to L4+ (load-bearing framework)

The framework is load-bearing when:
- **Code references artifacts** — components have comments like `// See FDB-007 for error state design`
- **Tests assert invariants** — "UXI-012: confirmation required before destructive action" has a test
- **Verification enforces traceability** — `traceability.yaml` tracks which FDBs map to which files; CI fails on drift (`aligned` / `drift` / `missing_impl` / `missing_test` status)
- **Design changes have a review process** — DDRs are required for load-bearing decisions

## Templates

See `templates/` directory (copy and fill):
- `FDB-template.md` — Feature Design Brief
- `persona-template.md` — Persona
- `job-template.md` — Job-to-be-done
- `scenario-template.md` — Scenario
- `DDR-template.md` — Design Decision Record
- `UXI-template.md` — UX Invariant

## When NOT to adopt this framework

This framework has overhead. Skip to L4 on simpler foundations if:
- Your end-user surface is a single CLI output (docs + tokens are enough)
- Your repo has fewer than 5 distinct user-facing features (FDBs add drag)
- You are pre-product-market-fit (framework calcifies too early)

Revisit at L3→L4 when your product has proven user flows and design decisions need durable rationale.
