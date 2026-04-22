# Design Program — Charter

**Status:** ACTIVE
**Established:** 2026-04-21
**Governance file:** `.claude/programs/design.md`
**Framework root:** [README.md](./README.md)

---

## Why this program exists

Design infrastructure is load-bearing. When it's present and enforced, a whole class of problems never appears: features don't ship to the wrong persona, destructive actions don't land next to benign ones, mobile layouts don't break on devices nobody thought to check. When it's absent or bypassed, those problems *do* appear — and they're discovered by users, not by the team.

The Design Program turns the `docs/design/` framework from a reference library into governed infrastructure:

- **Reference library:** "Here are some personas. Use them if you want."
- **Governed infrastructure:** "No UX-touching work enters NEXT without passing the lifecycle gates, and those gates depend on the framework being current."

The program answers four questions that a reference library alone cannot:

1. **Who is accountable** for keeping personas / JTBD / heuristics current? → The program owner and the blind-spot roundtable cadence.
2. **When must the framework be consulted?** → At every lifecycle gate (`LIFECYCLE.md`).
3. **What stops a PR that skipped the design phase?** → Auto-backlog triggers + required audit/spec links in PRs.
4. **How do we find blind spots before users do?** → Periodic multi-stage roundtables (`ROUNDTABLES.md`).

---

## The three jobs of the program

### 1. Gate the work

No UX-touching feature or change enters implementation without passing the 5 gates in [LIFECYCLE.md](./LIFECYCLE.md). Gates are:

1. **Entry** — scope + personas + JTBD identified.
2. **Blind-spot roundtable** (conditional) — multi-stage review to find missing personas, missing JTBDs, cross-product side effects.
3. **Research** (conditional) — market / competitive / observation / evidence gathering.
4. **Design** — surface artifact, journey map, audit or spec.
5. **Implementation** — code + tests linked back to the design artifact.

A gate is *bypassable* only with owner approval and an explicit rationale logged. Bypass ≠ skip: the owner decides a gate is not applicable, which is different from ignoring it.

### 2. Hunt blind spots

The framework can only evaluate work against what it already contains. If a new feature serves a persona we haven't modeled or an outcome we haven't named, the audit will pass — incorrectly. The program's second job is to keep the framework honest:

- **Blind-spot roundtables** (see [ROUNDTABLES.md](./ROUNDTABLES.md)) are scheduled on trigger (new feature proposal) or cadence (quarterly baseline). They ask: *"What are we not seeing?"*
- **PROTO persona hygiene**: no persona stays PROTO forever. Validation pass or downgrade.
- **JTBD atlas review**: no domain accumulates stub JTBDs indefinitely. Either populate or remove.
- **Discovery triage**: no discovery lingers in CAPTURED state — it becomes QUEUED, REJECTED, or ARCHIVED.

### 3. Keep the infrastructure current

A framework that rots is worse than no framework — it gives false confidence. The program enforces hygiene:

- Surface artifacts updated when their code changes materially.
- Evidence LEDGER entries appended; never deleted.
- Heuristic sets updated when new failure modes teach new rules.
- Auto-triggers that flag drift (new SCREEN without surface, PR without audit link, etc.).

---

## Operating cadence

| Cadence | Event | Output |
|---------|-------|--------|
| Per UX-touching change | Gate checks (Entry, Design, Implementation minimum) | PR / commit references audit or spec |
| Per new feature proposal | Blind-spot roundtable (Stages A–E) | GREEN / YELLOW / RED verdict + required follow-ups |
| Per new surface creation | Surface artifact authored before code | `surfaces/<id>.md` |
| Quarterly (first: 2026-07-21) | Framework hygiene sweep | PROTO persona pass, discovery triage, JTBD domain review |
| Triggered (user report, incident) | Follow-up audit on affected surface | New `audits/YYYY-MM-DD-*.md` |

---

## Bypass policy

Gates are intentionally inconvenient when the work needing design work is skipped. Gates are intentionally *easy to bypass* when the work genuinely doesn't need them.

**Gate 1 (Entry)** is cheap. Rarely bypassed.

**Gate 2 (Blind-spot roundtable)** is conditional — typically skipped for surface-bound fixes that don't expand feature scope. Required for:
- New surfaces (new view, new major widget).
- Features that target an already-underserved persona (Coach, Banker, Analyst, etc.).
- Features that cross product lines (main-app + sidebar).
- Features flagged by the owner for extra scrutiny.

**Gate 3 (Research)** is triggered by Gate 2's verdict. If the roundtable says YELLOW or RED for persona/JTBD gaps, research is required.

**Gate 4 (Design)** is not bypassable. A surface artifact must exist (or be created in the same session) for any change. An audit or spec must accompany any material change.

**Gate 5 (Implementation)** is not bypassable — code that ships must link back to design artifacts.

---

## What counts as a "UX-touching change"

**In scope:**
- New views, screens, panels, modals.
- Changes to interaction flows (what action is primary, what's destructive, what requires confirmation).
- Layout changes that affect form factor or scale math.
- Copy changes on primary controls (button labels, tooltips that explain mechanics).
- Changes to what information is shown on which surface.

**Out of scope:**
- Pure engine work (exploit engine, range engine) that doesn't surface to UI.
- Refactors that don't change user-visible behavior.
- Test-only changes.
- Comment and documentation edits.
- Bug fixes that restore intended behavior without changing it.

When unclear, the program errs inclusive — assume UX-touching, run Gate 1 at minimum.

---

## Accountability

- **Owner**: eng-engine roundtable (product-ux-engineer persona as primary).
- **Executor**: Claude (main or delegated agent) running through lifecycle.
- **Reviewer**: human owner (currently Chris); approves bypass of Gates 2 and 3 when needed; closes audits.
- **Framework maintainer**: whoever runs the quarterly hygiene sweep.

---

## Metrics that indicate the program is working

- Time from feature proposal to production is longer by the amount spent in Gates 1–4, but time-to-regression is materially longer (fewer post-launch UX defects).
- Discoveries close at a rate that keeps the CAPTURED tier under 5.
- PROTO personas get validated or retired at quarterly review; roster doesn't ossify at 15 forever.
- Blind-spot roundtables reveal ≥1 substantive gap per run, on average — if they reveal nothing, either the framework has become too dense (false sense of completeness) or the roundtable questions need sharpening.

## Metrics that indicate it's NOT working

- PRs merging with no audit link AND no bypass record.
- Audit findings piling up without implementation (backlog without motion).
- Personas added for political/completeness reasons without evidence.
- Blind-spot roundtables producing boilerplate "no gaps" reports.

---

## Relationship to sibling programs

- **Security** (`.claude/programs/security.md`): orthogonal. Security owns trust boundaries; Design owns UX. They may collaborate on surfaces that cross both (auth UX, permission prompts).
- **Engine Accuracy** (`.claude/programs/engine-accuracy.md`): orthogonal. Engine output correctness is upstream of design; design decides how to present engine output.
- **Test Health** (`.claude/programs/test-health.md`): orthogonal. Tests verify what design specifies.
- **Retired**: UI Quality (`.claude/programs/ui-quality.md`). Subsumed 2026-04-21.

---

## Change log

- 2026-04-21 — Program established. Charter authored. Lifecycle gates + blind-spot roundtables documented. UI Quality retired.
