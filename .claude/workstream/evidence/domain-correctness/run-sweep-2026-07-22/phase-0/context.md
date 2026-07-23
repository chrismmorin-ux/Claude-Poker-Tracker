# Phase 0 — Context (run-sweep-2026-07-22)

- **Repo:** Claude-Poker-Tracker — live poker hand tracker + exploit engine (React/Vite, 9-handed live + Ignition online).
- **Protocol:** sweep (14-day cadence, 22 days overdue at gate). Intent event: ev-1784755440878-89618f9efba7.
- **Declared domain:** poker decision theory. Canonical doctrine: `.claude/context/POKER_THEORY.md` (MANDATORY pre-edit), `src/utils/exploitEngine/CLAUDE.md`, `src/utils/rangeEngine/CLAUDE.md`, `docs/RANGE_ENGINE_DESIGN.md`.
- **Phase:** pre-launch. Archetype: product app (no fleet registry entry found; treated as saas-like with heavy domain-math weighting).
- **Spec status:** NO `docs/domain-spec.md`, NO `docs/domain-spec.draft.md` → Phase 0b RUNS. Local template present at `docs/domain-spec.template.md` (kit/templates/domain/ absent — adopted-repo variant). DRAFTS.md exists (design-audit sections).
- **intention.md:** mostly `_placeholder_` — Imagined Outcome only ("most accurate predictive poker decisions in the moment new data arrives + beginner-to-pro study section"). No Principles / Anti-goals / Failed States sections exist. Constitutional checks (#3 / #10) interpreted as: no make-work compliance rules, no self-aggrandizing complexity.
- **Scale:** ~55K LOC engine scope across 11 present module dirs (villainDecisionModel/ and refresher/ from scope patterns do not exist as dirs — villain decision logic lives inside exploitEngine/). ~12,349 app tests.
- **Drift window:** last sweep 2026-06-09; delta + challenge + blind_spot all ran 2026-06-20 covering through `ecd20b8`. Engine-scope commits after that: **only `5aa1419`** (wip pre-migration snapshot 2026-07-22) — NEW `exploitEngine/poolBaseline.js` (217 lines, WS-235/SPR-142 empirical pool baseline) + edits to bayesianConfidence.js (±12), gameTreeEquity.js (±29), generateExploits.js (±11), statRules.js (±39), villainProfileBuilder.js (±53), pokerCore/betaMath.js (±14), exploitEngine/CLAUDE.md (+1).
- **Open findings context:** 18 open (6 MEDIUM: FIND-006/007/009/010, FIND-029, FIND-031; 12 LOW). work_items_open: 1. Cap: 5.
