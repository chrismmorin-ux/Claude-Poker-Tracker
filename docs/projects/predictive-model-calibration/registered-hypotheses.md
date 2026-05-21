# PMC Pre-Registered Hypotheses

**Project:** Predictive Model Calibration (PMC)
**Status:** Stub authored 2026-05-09 (Gate 2 sprint 2/2 close-out). No entries yet.
**Charter:** [`.claude/projects/predictive-model-calibration.md`](../../../.claude/projects/predictive-model-calibration.md)
**Taxonomy:** [`failure-mode-taxonomy.md`](failure-mode-taxonomy.md)

---

## Why this file exists (FM-DISC-01 mitigation)

Owner can read the predictionAudit field across hands and post-hoc slice by villain × situation × board-texture × style × time-window. Each slice is a fresh hypothesis test never pre-registered. Ratio of *queries executed* to *findings surfaced* is invisible without an external ledger of which questions were asked. This is the **garden of forking paths** — FM-DISC-01 in the failure-mode taxonomy.

The Gate 2 Roundtable (2026-05-09) ratified the cross-cutting architectural ask:

> Tier-1/Tier-2 reporting separation in dashboard. Pre-registered rules get FDR-controlled flags. Exploratory slices get displayed without flag semantics, never drive auto-retirement, never drive "model is wrong" prose. Pre-registration file at `docs/projects/predictive-model-calibration/registered-hypotheses.md` with ratchet discipline.

Sprint 2/2 (2026-05-09) under REPLACEMENT scope — Concern 1 disposed with `predictionAudit` per-hand IDB field replacing the full ledger architecture — closes Q2 (multi-comparisons rigor) via this registry rather than statistical correction. **Pre-registration registry binds.** No query that touches predictionAudit data may produce a Tier-1 verdict (flag-bearing copy, model-state-modifying action) unless the hypothesis it tests is registered here BEFORE first data view.

Tier-2 (exploratory) views are unrestricted but MUST be labeled non-flag-bearing in any future render surface.

---

## Ratchet rule

A pre-registration is **append-only** and **timestamped before observation**:

1. New hypothesis = explicit ratchet entry below, with all required fields populated
2. Hypothesis must be registered with `pre-registration-date` BEFORE the entry's `first-data-date`
3. `verdict-date` is appended ONCE; verdicts are not revised post-hoc (a re-test is a NEW hypothesis with a NEW id)
4. A failed pre-registration (verdict: refuted) stays in the file — record of negative results matters

---

## Hypothesis entry schema

```yaml
id: "PMC-HYP-NNN"
title: "<one-line summary of the hypothesis>"
class: "FM-COMP-01 | FM-PRIOR-01 | ..." # link to taxonomy class this hypothesis tests
detection_signature: |
  <what observation pattern would CONFIRM the hypothesis,
  in terms of predictionAudit fields>
authored_by: "<owner | persona-name>"
pre_registration_date: "YYYY-MM-DD"
first_data_date: null     # populated when query first runs against captured predictionAudit data
verdict: null             # one of: confirmed | refuted | inconclusive | abandoned
verdict_date: null
verdict_evidence: |
  <link to specific HandReplay session-ids or aggregate query that grounded the verdict>
notes: |
  <free-text; reasoning, follow-ups, related hypotheses>
```

Required fields BEFORE viewing data: `id`, `title`, `class`, `detection_signature`, `authored_by`, `pre_registration_date`.

Forbidden patterns (refuses ratchet):
- Adding `first_data_date` BEFORE the entry exists in the file
- Editing `detection_signature` after data has been viewed
- Removing entries with verdict `refuted` ("publication bias" via deletion)

---

## Active pre-registrations

*(none yet — pre-registration begins at Phase 5a observation)*

---

## Verdict log (closed)

*(none yet)*

---

## Change log

- 2026-05-09 — v0.1 stub authored (Gate 2 sprint 2/2 close-out under REPLACEMENT scope). FM-DISC-01 mitigation. Q2 multi-comparisons rigor disposed via pre-registration discipline rather than statistical correction.
