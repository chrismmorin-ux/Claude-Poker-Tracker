# Provenance Remediation Plan

**From:** the 2026-06-19 provenance baseline audit (`docs/provenance/*.draft.md`).
**Goal:** make every number the model shows able to "show its receipts" — attribution + weighted input (Exploit Model charter §1.5, Tightness Audit §4).
**Status:** findings wired into `prog-data-quality` (FIND-023/024/025 → WS-235/236/237). This plan sequences them with already-tracked work.

---

## The one-line story

Your **weighting machinery is sound** (Bayesian intervals exist; the live fold% even has a DATA/PARTIAL/EST badge). The gaps are **un-cited sources** and **un-surfaced weight** — not a broken model, a model that doesn't show its work. Fix that and the "perfectly tight ship" standard becomes enforceable.

---

## Findings → items map (so nothing is lost)

| Finding | Gap | Tracked as | Severity | Status |
|---|---|---|---|---|
| **F1** | Population priors are uncited hand-typed constants the whole model leans on | **WS-235** (FIND-023) | HIGH | new — founder input needed |
| **F2** | Credible intervals computed but hidden in some surfaces | FIND-001 → **WS-116 (done)** + **WS-135** (staged expansion) | — | already tracked (not re-filed) |
| **F3** | "GTO-approximate" charts mislabeled; real Equilibrium frame absent | **WS-237** (FIND-025) | MEDIUM | new |
| **F4** | Hero $ has no bb/100 / volume / variance weighting | Charter §3 Financial Resolution (🔴 new) | — | architecture build |
| **F5** | Prediction ledger is a field, not a store (no aggregate read) | PMC project (`predictive-model-calibration.md`) | — | architecture |
| **F6** | Villain decision model in-memory; no persisted modelVersion/timestamp | PMC trust-tier dependency | — | architecture |
| **F7** | Live HUD shows raw % (no sample), parallel stats engine | **WS-236** (FIND-024) | MEDIUM | new |

---

## Phase 0 — Founder actions (unblock everything)

1. **Answer the F1 question:** where did the population priors come from — your estimate, published stats, or a dataset? This determines whether WS-235 *cites* or *replaces* them. (Only you know.)
2. **Review + promote the provenance drafts** once you're satisfied: `mv docs/provenance/data-source-registry.draft.md …/data-source-registry.md` (and the chain map). Promotion makes the baseline live and turns on drift detection.

## Phase 1 — Attribution (cheap, high-trust; make existing data honest)

*These don't change the math — they make the model show its receipts. Highest trust-per-effort.*

- **WS-235 — cite/replace the priors (F1).** HIGH. The root attribution hole; everything weighted leans on it. Gated on Phase 0.1.
- **WS-135 — finish surfacing credible intervals (F2).** Already staged; extends FIND-001 to PlayerAnalysisPanel + HandReplay.
- **WS-236 — HUD sample size + confidence (F7).** UX-touching → design gates; the highest-stakes surface gets the weakest→strongest attribution upgrade.
- **WS-237 — relabel "GTO-approximate" charts (F3).** S-effort; stops a Field reference from masquerading as Equilibrium.

**Exit:** every displayed model number carries visible sample/confidence, and its source is cited in the promoted registry.

## Phase 2 — Structure for the validation loop

*Make the model auditable over time (the "expected change in player data" loop).*

- **Prediction ledger as a store / indexed (F5).** Move `predictionAudit` from a per-hand field to a queryable structure so predicted-vs-observed can aggregate. (PMC project.)
- **Persist model version + timestamp on the villain decision model (F6).** So a prediction can be tied to the exact model that made it — the PMC trust-tier requirement.

**Exit:** you can ask "did the model's predictions come true, in dollars?" without a full-table scan.

## Phase 3 — New frames + the financial layer (the charter builds)

*The big pieces; each is its own gated effort.*

- **GTO ingestion — the Equilibrium frame (charter §6).** Imported solver outputs as a Reference source, with coverage + provenance + graceful "no anchor" degradation. Pairs with WS-237.
- **Financial Resolution layer (charter §3, F4).** edge × frequency → bb/100 → $/hr ± variance; add volume-weighting to hero results so a 1-hand and 300-hand result stop looking identical.
- **Situation-key keystone (charter §6).** The join all three frames + provenance travel through — prerequisite for triangulation; sequence per the architecture charter.

**Exit:** the full triangulation (Read vs GTO vs Field) resolves to dollars, every number traceable end-to-end.

---

## How this enforces "the tight ship"

Each phase makes one Tightness-Audit check (charter §4) real:
- Phase 1 → **#3 reconcile-to-Field** (priors are cited) + **attribution everywhere**.
- Phase 2 → **#4 financially reproducible / falsifiable** (the prediction loop can run).
- Phase 3 → **#2 reconcile-to-Equilibrium** (real GTO frame) + **Financial Resolution**.

## Links
- Audit drafts: `docs/provenance/{data-source-registry,provenance-chain-map}.draft.md` · manifest `DRAFTS.md`
- Findings: FIND-023/024/025 · Items: WS-235/236/237 (+ WS-135 existing)
- Architecture: `.claude/projects/exploit-model-architecture.md` (§1.5 provenance, §3 financial, §4 tightness, §6 keystone+GTO)
- PMC: `.claude/projects/predictive-model-calibration.md`
