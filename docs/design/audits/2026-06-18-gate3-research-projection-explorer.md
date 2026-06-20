# Gate 3 Research — 2026-06-18 — Projection Explorer (PJX)

**Gate:** 3 (Research) — triggered by Gate 2 RED.
**Predecessors:** [`…-entry-projection-explorer.md`](./2026-06-18-entry-projection-explorer.md) (Gate 1) · [`…-blindspot-projection-explorer.md`](./2026-06-18-blindspot-projection-explorer.md) (Gate 2).
**Status:** IN PROGRESS. Design decisions below are authored; **two outputs are gated on an empirical run against the owner's REAL backup** (the instrument is built and waiting): the modality verdict (2D vs 3D) and the calibration result that confirms-or-refutes DX-03. Per LIFECYCLE, Gate 2 is re-run to GREEN only after those land. **No framework commit (atlas/persona) and no production code until then** — verifying the premise before committing (project doctrine: do not commit a JTBD whose data-premise is unverified).

---

## What Gate 3 produced this session

1. **The numeric calibration instrument — BUILT** (`prototypes/projection-explorer-gate3.html`). This is the load-bearing Gate 3 deliverable: it converts the throwaway demo into a real measurement tool, runnable on real data in one drag-drop. It computes, **in full feature space, independent of the picture**:
   - **Silhouette (all 7 features)** vs the classifier's style labels.
   - **Silhouette (classifier-blind)** — projected/scored on only the **4 features the label is NOT built from** (`threeBet/cbet/foldToCbet/foldTo3Bet`). *This is the de-circularization test.*
   - **k-means(k=6) disagreement %** — fraction of players whose data-cluster majority-label ≠ their assigned label.
   - A **verdict engine** that classifies the result as *genuine structure* (classifier-blind silhouette ≥ 0.15), *largely circular* (full > 0.25 but blind < 0.1), or *mixed*.
   - Plus: **2D⇄3D toggle** (the empirical modality test), **seed-locked UMAP** (deterministic, fixes the Gate-2 non-reproducibility finding), **N-floor warning** (< 15 labeled → "treat as noise"), **imputation disclosure** per player in the tooltip.
   - *Verified on synthetic:* the instrument correctly reported the synthetic data's separation as *largely circular* (full 0.17 / blind 0.07) — i.e., it catches exactly the failure the Gate-2 rigor lens warned about. The measurement is honest.

2. **Design decisions authored** (below): engine API contract, AP-PJX-01 structural enforcement, PMC interface, persona resolution, JTBD drafts, opportunity-cost framing.

---

## Decision 1 — `projectionEngine/` API contract (split export; hands-ready; AP-PJX-01 structural)

Per Gate 2 D-2/D-3, the module is a **4th peer product engine** at `exploitEngine`'s layer. Pure JS (no React/IDB). Its sub-dir `CLAUDE.md`'s first rule is **AP-PJX-01**, NOT the POKER_THEORY guardrail (it is geometric/statistical, not poker-theory).

```
src/utils/projectionEngine/
  featureExtractor.js   // rows -> {X, imputedMask, featureNames} (subset-aware; hands-ready: a HandFeatureExtractor is consumer #2's drop-in)
  calibration.js        // silhouette(X,labels), kmeansDisagreement(X,labels,k), ablationSilhouette(...)  -- the MEASUREMENT
  pca.js                // pca(X, nComp)  (deterministic)
  umap.js               // umap(X, nComp, seed)  (seed-locked)
  index.js              // the two-faced public API below
```

The public API is **deliberately split so coordinates are unreachable by decision code** (the codebase's "prefer unrepresentable to validated" doctrine, applied structurally):

```js
// DECISION-SAFE — any engine may import. No coordinates. This drives the forced loop.
export function getCalibration(rows) {
  return { featureVectors, classifierLabels, silhouetteFull, silhouetteBlind, kmeansDisagreement, runMeta };
}
// VISUALIZATION-ONLY — views + the CWOS engine's render artifacts only. Coordinates live here, nowhere else.
export function getVisualizationCoords(rows, { method, dims, seed }) {
  return { coords, method, dims, explainedVariance };
}
```

**Structural enforcement of AP-PJX-01:** a CI check (grep/lint) that fails if `src/utils/exploitEngine/**` or `src/utils/rangeEngine/**` import `getVisualizationCoords`. Precedent: `exploitEngine` removed `WEAKNESS_EXPLOIT_MAP` rather than documenting it. Coordinates being physically absent from the decision-safe surface makes "position feeds a decision" unrepresentable, not merely forbidden.

**Hands-readiness (owner verdict #5):** `featureExtractor.js` takes a feature-spec, not hardcoded player stats. Consumer #2 (hands/spots) supplies a hand-feature-spec; the rest of the engine (calibration, pca, umap, the split API) is unchanged. This is the "players for the loop, hands as the goal" contract.

## Decision 2 — The forced loop compares feature-space, not coordinates (Gate 2 D-1)

The recurring CWOS analysis engine calls **`getCalibration(rows)`** each cadence, snapshots `{featureVectors, classifierLabels, silhouetteBlind, kmeansDisagreement}` (NOT coordinates), diffs against the prior snapshot, and emits findings to the **`domain-correctness`** program when: a player's `classifierLabel` changed, a feature vector moved past a threshold, or `silhouetteBlind` drops / `kmeansDisagreement` rises (the calibration degraded). **The corrective action is DX-04 (re-label in place)** — that's what closes the loop. Coordinates are regenerated fresh for rendering only; never compared across runs (they sign-flip / are non-deterministic).

## Decision 3 — PMC interface

PJX lives **outside** PMC (PMC is the narrow per-hand `predictionAudit` primitive; folding PJX in would revive cancelled scope). PJX **reports into** the same `domain-correctness` program. **Open for owner (low-cost):** does the CWOS engine *read* `predictionAudit` aggregates to cross-reference "model mis-predicted AND mis-clustered"? **Recommend: not in v1** — keep the loop self-contained on tendency features; add the cross-reference as a v2 enhancement once both signals are stable. No Ignition sidebar counterpart (study-mode only; AP-PMC-01).

## Decision 4 — Persona resolution

- **Operator/model-owner:** do NOT author a new end-user persona (Gate 2 A-1: it has no in-app *session/trigger* — it's a role). Instead scope PJX v1 as **operator tooling** whose trigger is *"the CWOS engine fired a calibration finding"* or *"after a backup export."* The instrument is the founder's, surfaced via the design/CWOS layer, not the end-user persona system. Revisit if an in-app destination proves needed.
- **Analyst (PROTO):** served **only via export** — `getCalibration` + `getVisualizationCoords` results must be exportable (extends `exportUtils.js` or a sibling endpoint). Confirmed as a v1 requirement, not a nicety.
- **Coach (Gate 2 A-3):** noted as the strongest *future* end-user consumer of DX-04 (correct a student's mislabeled villain). Deferred — not a v1 persona, but recorded so it isn't re-discovered.

## Decision 5 — JTBD drafts (HELD from atlas until the empirical run confirms DX-03)

Drafted, **not yet committed** to `jtbd/` (premise-verification gate). New domain candidate: `data-exploration` (DX). IDs provisional per the ATLAS DS-registry note.

- **DX-01** — See the structure in my opponent pool (exploration; the visual).
- **DX-02** — Find nearest analogues to a player (search-first; reconciles with SR-88).
- **DX-03** — Confirm my model's labels match real structure (**the calibration job; this is what the empirical run tests**).
- **DX-04** — Correct a miscategorized opponent in place (**highest priority — the loop's corrective action**).
- **DX-05** — Surface unclassifiable / outlier opponents.
- **DX-06** — Watch a specific villain migrate over time.

**Commit rule:** if the real-data run shows DX-03's classifier-blind silhouette is genuinely positive (labels reflect real structure), commit DX-01..06. If it shows the labels are largely circular, DX-03 is refuted-as-designed → the project pivots (likely to hands, the large-N consumer) before any atlas commit. This is the premise check the doctrine demands.

## Decision 6 — Opportunity-cost framing (for the empirical run to settle)

Gate 2 asked: at N≈dozens, does a *projection* beat a raw 2-axis (VPIP×AF) labeled scatter? The instrument answers this empirically — if `silhouetteBlind` is near zero, projection adds nothing the raw axes don't, and v1 should be a 2-axis scatter, with the projection engine justified only by the **hands** consumer (large N). This is the honest "is the engine over-built for players?" check, now measurable rather than argued.

---

## Evidence LEDGER (Gate 3)

- 2026-06-18 — Instrument built + smoke-verified on synthetic data: correctly flagged synthetic separation as *largely circular* (full silhouette 0.17, classifier-blind 0.07, k-means disagreement 32%). Confirms the de-circularization test discriminates. Synthetic result is NOT evidence about the real classifier (synthetic separates by construction) — it validates the *instrument*, not the *classifier*.
- PENDING — empirical run on owner's real `poker-tracker-backup-*.json`: yields (a) the real DX-03 calibration verdict, (b) the 2D-vs-3D readability decision, (c) the opportunity-cost answer.

## Required follow-ups (to close Gate 3 → Gate 2 re-run → Gate 4)

- [ ] **Owner runs the instrument on real data** (`prototypes/projection-explorer-gate3.html`) — report the four calibration numbers + the 2D-vs-3D preference.
- [ ] Based on the calibration verdict: **commit or pivot** DX-01..06 in the atlas; author the `data-exploration` domain + ATLAS row (or pivot to hands).
- [ ] Author `projectionEngine/` sub-dir `CLAUDE.md` (AP-PJX-01 first) + the CI import-lint spec.
- [ ] **Gate 2 re-run** against the updated framework → must be GREEN before Gate 4.
- [ ] Gate 4: surface artifact(s) for the chosen modality + the operator/export surface.

## Links

- Instrument: `prototypes/projection-explorer-gate3.html` · Demo (v1): `prototypes/player-cloud-3d.html`
- Charter: `.claude/projects/projection-explorer.md` · Tracked: WS-234
- Gate 1 / Gate 2 audits (same dir) · PMC: `.claude/projects/predictive-model-calibration.md`

## Change log

- 2026-06-18 — Created. Numeric calibration instrument built + verified (silhouette-full/blind + k-means disagreement + verdict engine + 2D/3D + seed-locked UMAP + N-floor + imputation disclosure). Engine API contract authored (split decision-safe vs viz-only export + CI import-lint; hands-ready featureExtractor). Forced loop re-framed to feature-space comparison. PMC = report-into-not-inside; predictionAudit cross-ref deferred to v2. Personas resolved (operator = tooling-not-persona; Analyst = export-served; Coach = future). DX-01..06 drafted but HELD from atlas pending the real-data premise check. Gate 2 re-run + framework commit + Gate 4 all gated on the owner's empirical run.
