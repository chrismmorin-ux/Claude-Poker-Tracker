# Project: Design Program Compliance

**Program:** Design (`.claude/programs/design.md`)
**Owner:** Chris (user) + Claude (executor)
**Opened:** 2026-04-21
**Status:** ACTIVE — WAVE 0 starts next
**Roadmap:** `docs/design/ROADMAP.md`

---

## Goal

Bring every existing surface in the codebase under Design Program governance. Produce the surface artifacts + audits + fixes to reach at least Tier A on all surfaces, Tier B on most, Tier C on high-priority findings.

## Why this is a project, not just "next work"

Compliance is multi-session and cross-surface. Treating each surface as an isolated feature request would miss batching opportunities (Wave 0), cross-surface findings (sidebar integration), and hygiene work (discovery triage, persona validation). A dedicated project tracks the whole arc.

## Waves

See [ROADMAP.md](../../docs/design/ROADMAP.md) for full detail.

| Wave | Scope | Sessions (est.) | Dep | Status |
|------|-------|-----------------|-----|--------|
| 0 | Baseline Tier A — 11 surface artifacts batch-authored | 2 | — | PENDING |
| 1 | Core table surfaces (table, showdown, sessions) — audit + P1 fix | 6–8 | Wave 0 | PENDING |
| 2 | Review surfaces (hand-replay, analysis, stats) — audit + fix | 5–7 | Wave 0 | PENDING |
| 3 | Drills (preflop, postflop) — audit + WIP tab decision | 3–4 | Wave 0 | PENDING |
| 4 | Specialized (players, tournament, online, settings) — audit + fix | 4–6 | Wave 0 | PENDING |
| 5 | Sidebar framework integration | 3–4 | Wave 4 (online) | PENDING |
| H | Hygiene (discovery triage, PROTO validation) | 2–3 | parallel | PENDING |

**Totals**: 25–34 sessions. Calendar ~6–10 weeks if run back-to-back.

## Sequencing

Recommended default order: 0 → 1 → 2 → 4 → 3 → 5. Hygiene H1 runs early (parallel with Wave 0). Hygiene H2 scheduled 2026-07-21 (quarterly).

Re-sequence allowed based on owner priority or findings that reveal cross-wave dependencies.

## Minimum viable compliance state

If scope pressure forces cuts, the minimum useful state is:
- Wave 0 (all surfaces catalogued)
- Wave 1 (core surfaces fully through Tier C)
- Hygiene H1 (discovery triage done)

Stop at ~10 sessions. All other waves are quality improvements, not compliance gates.

## Known likely outcomes that may reshape the project

- **TableView audit** may recommend structural decomposition (ARCH-003). Owner decides whether to absorb in Wave 1 or spawn a parallel refactor project.
- **Drills audit** will force a decision on the WIP tabs: finish, retire, or defer. This is a product decision, not a compliance one — the audit merely surfaces it.
- **Sidebar integration** may reveal mapping gaps between the sidebar's 33 rules and the framework's heuristic sets. Either framework gains new rules or sidebar's doctrine is annotated.
- Any wave may surface ≥ 1 discovery that expands the missing-features list — these flow to `discoveries/LOG.md` and may warrant their own follow-on projects.

## Tracking

- Per-wave status updates land in `.claude/STATUS.md`.
- Per-session handoffs in `.claude/handoffs/design-compliance-waveN-sessionN.md`.
- Audit artifacts in `docs/design/audits/YYYY-MM-DD-<surface>.md`.
- Surface artifacts updated continuously in `docs/design/surfaces/`.
- Program-level status in `.claude/programs/design.md`.

## Decision log

Captured when a wave-shaping decision is made:

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-21 | Wave 0 precedes all others | Surface artifacts are preconditions for audits; batch is cheap |
| 2026-04-21 | Sidebar as Wave 5 (not Wave 1) | Existing doctrine is strong; framework integration is documentation-heavy, not urgent |
| 2026-04-21 | Drills is its own wave | WIP tab decision may become its own project depending on audit findings |

## Close criteria

Project closes when:
1. All 16 surfaces reach Tier A minimum (CATALOG marks all `●`).
2. At least 12 of 16 surfaces reach Tier B.
3. All P1 audit findings across all waves are implemented OR have owner-approved deferral.
4. Discovery LOG has 0 items in CAPTURED > 60 days.
5. At least 3 blind-spot roundtables have been conducted during roadmap execution.
6. First quarterly hygiene pass (H2) complete.

Closing does NOT mean "no more design work." Compliance is ongoing; this project covers the first comprehensive pass.
