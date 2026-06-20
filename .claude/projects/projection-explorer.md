# Projection Explorer (PJX) — Project Charter

**Started:** 2026-06-18 · **Owner-greenlit:** "seriously invest in this kind of architecture… make sure we have an iterative loop forced to be in place."
**Status:** Gate 1 ✅ · Gate 2 ✅ · **Gate 3 (Research) = IN PROGRESS** (tracked: WS-234). Numeric calibration instrument built (`prototypes/projection-explorer-gate3.html`); **blocked on owner's empirical run against real backup** for the calibration verdict + 2D-vs-3D decision before the atlas commit + Gate 2 re-run. Gate 3 doc: `docs/design/audits/2026-06-18-gate3-research-projection-explorer.md`.
**Program:** `design` (5-gate lifecycle) + reports findings into `domain-correctness` (PMC tie-in).
**Build shape (owner-ratified):** "both, sequenced" — product engine module → recurring CWOS analysis engine (the forced loop).

---

## What it is

Project app data into a manipulable, visualizable low-dimensional space (dimensionality reduction) so structure invisible in tables becomes observable + actionable. **v1 consumer = a player "cloud"** (one point per logged opponent, feature vector from `tendencyCalculations.js`). **High-value target = hands/spots** (large N).

## The two jobs (Gate 2's central insight — do not re-conflate)

| Job | What serves it | Notes |
|---|---|---|
| **Exploration (DX-01/04/05)** | The manipulable visual | Browse pool, hunt outliers, **re-label a misclassified villain in place (DX-04)** — the corrective action that closes the loop |
| **Calibration (DX-03)** | A **numeric** instrument (silhouette-7D, k-means k=6 confusion, classifier-blind ablation) | The cloud cannot do this by eye — it's **circular** (colored by labels built from the same stats that position the dots). Numbers drive the forced loop. |

## Gates completed

- **Gate 1 (Entry)** — `docs/design/audits/2026-06-18-entry-projection-explorer.md`. Verdict 🔴 RED. Headline: a validated *mechanism* without a validated *job*; §Reframe = model-validation instrument. Registered **AP-PJX-01** (spatial position is a descriptive output, never a decision input).
- **Gate 2 (Blind-Spot Roundtable)** — `docs/design/audits/2026-06-18-blindspot-projection-explorer.md`. Four independent voices. Verdict 🔴 RED → redirect. Convergent findings: circularity (calibration needs numbers); forced loop must compare **feature vectors, not coordinates** (PCA sign-flip + UMAP non-determinism); **DX-04** added as the loop's corrective action; engine boundary resolved (4th peer engine; AP-PJX-01 governs, not POKER_THEORY; structural API split `getPlayerProjection` vs `getVisualizationCoords` + CI import-lint); PJX reports *into* PMC, not inside it.

## Owner verdicts (2026-06-18)

1. Primary job = model-validation/calibration instrument.
2. Build shape = "both, sequenced."
3. Must have a UX-facing manipulable unit.
4. Modality = **Gate 3 prototypes both 2D and 3D on real data**, decide empirically.
5. First consumer = **"players for the loop, hands as the goal"** — engine + loop on players now; API designed so hands plug in as consumer #2 without rework.

## Forced-loop design (the institutionalized deliverable)

`projectionEngine/` (pure product module) → recurring CWOS analysis engine that, on cadence, recomputes **feature vectors + classifier labels** (not coordinates), diffs against the prior snapshot, and emits findings (label changed / feature-space movement / classifier-vs-emergent disagreement via silhouette+confusion) into `domain-correctness`. **The corrective action (DX-04 re-label) is what makes it a loop, not a dashboard.** Each design gate gates the next (can't write production code without passing) — that is the structural forcing function; WS-234 keeps it tracked.

## Next (Gate 3 — Research) — WS-234

De-circularize + numeric instrument spec · 2D-vs-3D empirical prototype on real data · `projectionEngine/` API contract (split export + CI lint, hands-ready) · author DX-04/05/06 JTBDs · persona resolution (operator/model-owner trigger? Coach? Analyst export) · PMC interface (read `predictionAudit` aggregates?) · opportunity-cost check (does projection beat a raw 2-axis scatter at N≈dozens?).

## Key files

- Prototype (disposable evidence): `prototypes/player-cloud-3d.html`
- Audits: `docs/design/audits/2026-06-18-entry-projection-explorer.md`, `…-blindspot-projection-explorer.md`
- Feature source: `src/utils/tendencyCalculations.js` · Engine-layer refs: `src/utils/{pokerCore,exploitEngine,rangeEngine}/CLAUDE.md`
- PMC: `.claude/projects/predictive-model-calibration.md`
