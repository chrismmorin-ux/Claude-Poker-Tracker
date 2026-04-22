# Audit — [YYYY-MM-DD] — [Scope]

**Scope:** Surface / Journey / Situation — [identifier]
**Auditor:** Claude (main) / agent-subtype / Chris
**Method:** Heuristic walkthrough + JTBD trace (+ visual verification if applicable)
**Status:** Draft / Review / Closed

---

## Executive summary

3–5 sentences. What was audited, how many findings, top severity, top theme. Written so a non-technical owner understands the gist without reading the rest.

---

## Scope details

- **Surfaces audited:** [surface-id], [surface-id], ...
- **Journeys audited:** [journey-id], ...
- **Personas considered:** [persona-id], [persona-id], ...
- **Heuristic sets applied:** Nielsen-10, Poker-Live-Table, Mobile-Landscape
- **Out of scope:** [what was explicitly not audited]

## Artifacts referenced

- [relative path] — purpose

---

## Findings

Ordered by severity descending, then by effort ascending.

### F1 — [Short title]

- **Severity:** 0–4 (see rubric below)
- **Situations affected:** [persona-id], ...
- **JTBD impact:** [JTBD-ID] — what fails, partially or fully.
- **Heuristics violated:** H-XX, H-YY
- **Evidence:** [EVID-ID], [EVID-ID]
- **Observation:** What exactly is wrong. Plain language. Specific.
- **Recommended fix:** What to do. Scoped to the surface where possible.
- **Effort:** S / M / L
- **Risk:** Any collateral risk from the fix (regression surface, invariant impact).
- **Proposed backlog item:** One-line BACKLOG entry ready to drop in.

### F2 — ...

(Repeat per finding.)

---

## Observations without fixes

Things worth noting that don't have an obvious remedy or require more info to act on. Not findings; do not count against severity or effort.

- ...

## Open questions

Hypotheses that need owner input or further investigation before becoming findings.

- ...

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | F-N — title | 4 | S | P0 |
| 2 | F-N — title | 3 | M | P1 |
| ... | | | | |

Priority mapping (approximate):
- Severity 4 → P0 (blocker)
- Severity 3 → P1 (next)
- Severity 2 → P2
- Severity 1 → P3
- Severity 0 → P4 (skip unless bundled)

Effort may shift a finding up or down one tier.

---

## Backlog proposals

Copy-paste ready for `.claude/BACKLOG.md`:

```
- [ ] [P0] [AUDIT-YYYY-MM-DD F1] Short title (evidence: [EVID-...]) — [link to audit]
- [ ] [P1] [AUDIT-YYYY-MM-DD F2] ...
```

---

## Severity rubric (for reference)

| Severity | Definition | Example |
|----------|------------|---------|
| 0 | Cosmetic. No functional impact. | Slightly off-center label. |
| 1 | Minor friction. JTBD completes with avoidable effort. | Extra tap on non-primary path. |
| 2 | Blocks a secondary situation (non-primary persona). | Form works in one orientation but not another; low-frequency persona path. |
| 3 | Blocks JTBD in a secondary situation OR causes destructive action in primary. | Clear Player without undo. |
| 4 | Blocks JTBD completion in primary situation OR causes silent corruption. | Form is uneditable on primary device in primary orientation. |

---

## Review sign-off

- **Drafted by:** [name]
- **Reviewed by:** [name] on [date]
- **Closed:** [date] — linked to BACKLOG items [...]

Audit is immutable after close. Follow-up audits create a new file.

---

## Change log

- YYYY-MM-DD — Draft.
- YYYY-MM-DD — Reviewed.
- YYYY-MM-DD — Closed.
