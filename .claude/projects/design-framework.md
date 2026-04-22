# Project: Design Framework + Player Selection Audit

**Program:** UI Quality
**Owner:** Chris (user) + Claude (executor)
**Opened:** 2026-04-21
**Status:** ACTIVE — Session 1

## Goal

Build a reusable, AI-assisted design artifact system that (a) can audit any UX surface in the repo with a consistent methodology and (b) produces backlog-ready findings. Apply the first audit to player selection (seat context menu, player picker, player editor) as the pilot.

## Why now

The Player Entry Overhaul (PEO) closed 2026-04-16. Within 5 days, the owner identified two usability defects (destructive-action placement, mobile landscape scroll) and a general sense that the flow could be better. No framework exists to systematically audit UX surfaces — prior work has been ad-hoc or sidebar-specific (`docs/SIDEBAR_DESIGN_PRINCIPLES.md`). Building the framework now pays forward for every future surface.

## Sessions

| # | Scope | Status |
|---|-------|--------|
| 1 | Framework scaffolding: personas, JTBD atlas, heuristics, templates, methodology doc, evidence ledger. **No source code touched.** | CLOSED 2026-04-21 |
| 1b | Engine expansion: 15-persona roster, tier dimension (4 tiers + sidebar-lite), product-line separation, feature inventory, discovery pipeline, 14-domain JTBD atlas (~90 JTBDs). **No source code touched.** | CLOSED 2026-04-21 |
| 2 | Apply framework to player selection. 3 surface artifacts + journey map + audit findings. Includes 2 known issues as specific findings. | CLOSED 2026-04-21 — 11 findings, 4 P1 |
| 3 | Implement 4 P1: F1+F3+F11 (menu reorder), F2 (undo), F4 (tap targets), F7 (landscape scroll). Tests 6120/6122 green (2 pre-existing flaky). Visual verification UNAVAILABLE — Playwright MCP down. | CLOSED 2026-04-21 — pending physical-device visual check |
| 4 | Close remaining P2 findings: F5 (chip panel), F6 (duplicate-seat warn), F8+F9 (editor density), F10 (Swap). | CLOSED 2026-04-21 — all findings implemented; awaiting visual verification |
| 5+ | Apply framework to other surfaces (TableView, ShowdownView, StatsView, etc.) one per session. | PENDING |

## Success criteria

- **Session 1:** Another Claude session can pick up the framework and produce a usable audit of any surface without further instruction. Templates are self-explanatory. Persona + JTBD artifacts grounded in evidence, not fabrication.
- **Session 2:** Findings are specific, severity-ranked, and tied to heuristics + JTBD. Known issues appear as specific findings with evidence.
- **Session 3:** UI changes ship with visual verification on phone landscape + tests green. Findings closed are linked back to audit artifact.
- **Whole project:** Framework becomes the default pattern for any `/eng-engine` roundtable or UX request that touches a surface.

## Non-goals (this project)

- Replacing `SIDEBAR_DESIGN_PRINCIPLES.md` — that remains the authoritative doctrine for the sidebar specifically. The new framework sits *above* it.
- Automated tooling to generate audits from code. Methodology is LLM-as-thinking-partner, not LLM-as-oracle.
- Real user research. Personas are proto-personas labeled as such; evidence ledger distinguishes assumption from observation.

## File locations

- `docs/design/` — framework artifacts (committed, durable)
- `.claude/projects/design-framework.md` — this file (lifecycle)
- `.claude/handoffs/design-framework-session*.md` — per-session handoffs

## Inputs / assumptions logged

- Core persona modeled on the known primary user (Chris, non-technical owner, uses at live tables, Samsung Galaxy A22 landscape primary device). Labeled PROTO until confirmed/refined in Session 2.
- Chris is the primary user but NOT the only user (per 2026-04-21 owner direction). 14 end-user archetypes added as design targets, all labeled PROTO / unverified.
- Multi-user + tiering + feature-filtering expressed in the framework as hypothetical — no code path exists for any of it. Tiering remains expressive, not enforced.
- Sidebar extension and main app treated as distinct product lines with potentially distinct tier tracks.
- Feature discovery pipeline captures missing features as discoveries rather than losing them in audit files.
- 20-item initial gap list surfaced by Session 1b engine — aggregated in a single discovery file pending owner triage.
