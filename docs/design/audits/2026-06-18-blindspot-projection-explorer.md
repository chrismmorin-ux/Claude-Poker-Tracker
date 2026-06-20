# Blind-Spot Roundtable — 2026-06-18 — Projection Explorer (PJX)

**Gate:** 2 (Blind-Spot Roundtable) — triggered by Gate 1 RED verdict + new-surface creation.
**Gate 1 artifact:** [`2026-06-18-entry-projection-explorer.md`](./2026-06-18-entry-projection-explorer.md)
**Owner decisions carried in:** (1) primary job = **model-validation / calibration instrument** (DX-03); (2) build shape = **"both, sequenced"** (product engine module → recurring CWOS analysis engine = the forced loop); (3) **must have a UX-facing unit to manipulate and visualize.**
**Execution:** four independent perspectives (product-ux-engineer · systems-architect · research-scientist · external/market) per ROUNDTABLES.md execution model. Read-only; no production code.
**Status:** OPEN — this is the Gate 2 artifact. Verdict drives Gate 3 scope.

---

## Feature summary

PJX projects app data (v1: a player's logged opponents, as 7-feature tendency vectors) into a manipulable, visualizable space via dimensionality reduction, to answer *"do the app's opponent-style labels match the natural structure in the data?"* (DX-03) and to let the user explore the population (DX-01). The mechanism is validated on synthetic data (`prototypes/player-cloud-3d.html`).

---

## The headline (read this first)

The roundtable converged — from four independent directions — on one structural insight:

> **The visual the owner wants and the job the owner picked are two different things.** The manipulable cloud is genuinely good at **exploration** (browse the pool, hunt outliers, fix a mislabeled villain — DX-01/04/05). But the **calibration job (DX-03)** the owner chose as primary is, as currently designed, **circular and unfalsifiable** — it needs *numbers* (silhouette score, cluster-confusion), not a pretty cloud. And the **forced loop** measures the wrong quantity (coordinates, which aren't comparable across runs) instead of the right one (feature vectors + labels).

The resolution that honors all three owner decisions is a **split architecture**: a numeric calibration instrument (the measurement, which drives the forced loop) with the manipulable visual as its **front-end + the place you take corrective action** (re-label a misclassified villain — the action that makes the loop a loop). Details below.

---

## Stage A — Persona sufficiency · ❌ Structural gap

- **A-1 — The "operator/model-owner" is a ghost persona with no session.** It's a *role*, not a triggered situation. Until there's a concrete trigger ("after logging 50+ hands on a new pool," "when the CWOS engine fires a disagreement finding"), it can't be authored, and Stage C has nothing to stress-test. This is *why* the gap is structural.
- **A-2 — The Analyst (PROTO) is served only if coords/features are exportable.** Their documented posture is BYO-tooling ("dashboards independent of the app"). In-app viz serves a *projected* Analyst unless the projection coords ship as a structured export.
- **A-3 — The Coach persona was never considered, and is a more natural DX-03 consumer than Chris.** "Coach spots a mislabeled villain the student has misplayed for 200 hands" is a concrete, action-bearing job. Worth a read before Gate 3.

## Stage B — JTBD coverage · ⚠️ Expansion needed (3 missing jobs)

DX-01/02/03 (Gate 1) are real but incomplete. The proven embedding-explorer idiom (TensorBoard Projector, Nomic Atlas, Apple Embedding Atlas) shows users do five things; three aren't modeled:

- **DX-04 — Correct a miscategorized opponent in place (HIGHEST PRIORITY).** Inspect a wrongly-clustered dot and re-tag without leaving the view. **This is what converts DX-03 from a read-only poster into an instrument** — and it's the corrective action the forced loop needs (see Stage D / verdict). Also the strongest answer to Chris's "pretty for its own sake" non-goal: re-tagging a misclassified villain measurably reduces downstream exploit error.
- **DX-05 — Surface unclassifiable opponents (outliers).** Points far from every centroid are either rich exploit targets or data-starved. Cheap; high value for a live player.
- **DX-06 — Watch a specific villain migrate over time (user-facing drift).** One opponent's position across time windows — serves Chris's at-table read-updating, distinct from the operator drift finding.

## Stage C — Situational stress · ❌ Fundamental mismatch

- **C-1 (damning) — post-session-chris has no next action after opening the cloud.** Post-session attention is specific-hand / specific-villain; the cloud is a population view. Orthogonal scopes. *Unless* DX-04 (re-label in place) exists, there is nothing to *do* with what you see.
- **C-2 — study-block doesn't fit either.** It needs a unit-of-study with a "done" state; the cloud is open-ended ambient viz with no completion. Category error to force it there.
- **C-3 — 3D drag-rotate vs tap-to-select is an unresolved gesture conflict on the 1600×720 phone target.** Hover-tooltips don't exist on touch; tap-vs-rotate disambiguation is non-trivial and absent from the prototype. The 290px control panel consumes most of a phone-landscape width.

## Stage D — Cross-surface / architecture · ❌ Scope was wrong (with clean fixes)

- **D-1 (biggest architectural blind spot) — the forced loop's comparator is unmeasurable.** "Re-embed and report drift" compares coordinates across runs — but **PCA axes sign-flip** and **UMAP is non-deterministic**, so the loop fires on coordinate *noise*. **Fix: the loop must compare feature vectors + classifier labels (stable measurements), never coordinates (ephemeral rendering).** This must be locked before Gate 4 or the loop will be built against the obvious-but-wrong output.
- **D-2 — Engine boundary has a clean answer.** `projectionEngine/` is a **4th peer product engine** at `exploitEngine/`'s layer (consumes player feature vectors from `tendencyCalculations.js`; pure JS, no React/IDB). It does **not** inherit the POKER_THEORY guardrail verbatim — it's geometric/statistical; **AP-PJX-01 is its governing rule** and its sub-dir CLAUDE.md's first line. (A future editor must not copy "it's an engine → read POKER_THEORY" reflexively.)
- **D-3 — AP-PJX-01 can be made structurally unrepresentable** (per the codebase's "prefer unrepresentable to validated" doctrine): split the public API into `getPlayerProjection()` (decision-safe: feature vectors + classifier agreement) and `getVisualizationCoords()` (viz-only: coords). A CI import-lint forbidding `exploitEngine/**` + `rangeEngine/**` from importing `getVisualizationCoords` enforces it at the import graph, not in prose.
- **D-4 — PJX lives *outside* PMC, reports *into* it.** PMC is deliberately narrow (compact per-hand `predictionAudit` primitive; hierarchical aggregator cancelled). Folding PJX in would revive cancelled scope. PJX's CWOS engine emits findings routed to the `domain-correctness` program. **One interface decision blocks Gate 4: does PJX read `predictionAudit` aggregates** (to cross-reference "mis-predicted AND mis-clustered")? Declare before Gate 4.
- **D-5 — Export + no sidebar.** Analyst export is first-class (decide: extend `exportUtils.js` backup schema vs separate endpoint). PJX is study-mode only → **no Ignition sidebar counterpart** (lock as a named decision; AP-PMC-01 binding: calibration is never live).

## Stage E — Heuristic pre-check · ⚠️ Specific adjustments

- **E-1 — Opaque PCA/UMAP axes violate Nielsen H2 (match real world) and are *actively misleading for calibration*:** an operator who can't name the axes can't tell a label-error from a projection artifact. Interpretability is load-bearing for DX-03, not cosmetic.
- **E-2 — "Re-label from the cloud" (DX-04), if it ships, is a destructive write inside a drag surface** → must be a distinct mode toggle, not proximity detection (H-N03 undo, H-PLT06 misclick).
- **E-3 — Red line #5 (no gamification) risk is narrow** (villain-side data) — becomes real only if hero style/mastery is ever projected. Lock a hard hero-data exclusion at the engine level for v1.
- **E-4 — The min-hands threshold corrupts the calibration signal:** unlabeled-because-sparse and mislabeled-because-wrong both render as faint anomalies in the same visual channel. Distinguish them.

## Cross-cutting — Methodological rigor · 🔴 Critical (the load-bearing finding)

The research lens found the calibration framing has a near-total **circularity** that the Gate 1 reframe did not close:

- **Circularity (critical).** The classifier (`classifyStyle`) thresholds on `vpip/pfr/af`. Those three features dominate the variance, so they dominate the first PCA axes. **Coloring the projection by a label derived from the same three features renders the classifier's own decision surface** — separation is guaranteed by construction and validates nothing.
- **The 3D visual removes a falsification handle.** Rotation lets the operator spin until they see what they expect; depth occludes; no number is attached. 3D scatter is among the *worst* perceptual formats for cluster judgment.
- **"Mechanism confirmed on synthetic data" is worth zero as validation evidence** — synthetic archetypes separate *by construction* (same circularity). It proves the renderer runs, nothing about real data.
- **Small-N.** At expected N (≈30–150), UMAP manufactures clusters (nNeighbors=15 ≈ 30% of the data) and is non-reproducible across seeds; PCA covariance is itself underdetermined below N≈30 for 7 features.
- **Mean-imputation bias.** Null conditional stats (3bet/cbet/folds) imputed to the mean pull thin-data players to the centre — read as "average style," actually "insufficient data." Position bias, undisclosed.

**What makes it a measurement instead of a Rorschach test (required, not optional):**
1. **Silhouette coefficient against classifier labels, computed in 7D** (not projected space), displayed prominently.
2. **Circularity-ablation toggle:** project on the **4 features the classifier does *not* use**; if labels still separate, that's genuine evidence; if separation collapses, circularity confirmed.
3. **k-means (k=6) confusion vs classifier labels** → "X% of players sit in a cluster whose majority label disagrees." That number *is* DX-03.
4. **UMAP seed-locked + stability warning below N≈150; hard floor** (refuse validation claims below N≈30–50).
5. **Imputation disclosure** in the inspector ("N of 7 features imputed").

---

## Overall verdict: 🔴 RED → Gate 3 (Research) required, substantial scope

Not a kill — a **redirect**. The mechanism is real for **exploration (DX-01/04/05)**; the **calibration job (DX-03)** is real but requires numeric infrastructure the prototype lacks, and de-circularization. The path is concrete.

**The synthesis that honors all three owner decisions:**

| Owner decision | How it's honored after Gate 2 |
|---|---|
| Primary job = calibration instrument | The instrument is **numeric** (silhouette + k-means confusion + ablation), not the cloud. The numbers drive the forced loop. |
| Forced iterative loop | Loop compares **feature vectors + labels** across runs (stable), emits findings to `domain-correctness`; **DX-04 re-labeling is the corrective action** that closes it (a loop, not a dashboard). |
| Must have a manipulable UX-facing unit | The visual is the **front-end of exploration + the surface for the corrective action** (inspect outlier → re-tag). It annotates the numbers; it isn't the measurement. **Recommend 2D-first** (proven by Nomic/Apple Atlas; survives the "pretty for its own sake" non-goal); 3D as an optional toggle, de-scoped from v1. |

---

## Required follow-ups (Gate 3 — Research)

- [ ] **De-circularize + numeric instrument** (the four rigor items): silhouette-7D, classifier-blind ablation, k-means confusion, N-floor/seed-lock, imputation disclosure. **This is the gate on whether DX-03 is real.**
- [ ] **Re-frame the forced loop** around feature-space comparison, not coordinates (D-1). Specify the `projectionEngine/` split API (`getPlayerProjection` vs `getVisualizationCoords`) + CI import-lint (D-2/D-3).
- [ ] **Author DX-04 / DX-05 / DX-06** in the atlas (provisional IDs; check registry per ATLAS DS-note). DX-04 is highest priority. Re-frame DX-02 as search-first.
- [ ] **Persona resolution:** author operator/model-owner *with a concrete trigger*, or scope as operator-tooling outside the persona system; evaluate Coach; confirm Analyst export path (D-5).
- [ ] **Modality decision (owner):** 2D-first PCA-only with 3D optional toggle — confirm or override. Adopt proven interactions: search→neighbors, color-by-any-raw-field, lasso, click→inspector, auto-labeled regions, click→re-label.
- [ ] **PMC interface:** does PJX read `predictionAudit` aggregates? (D-4). No sidebar counterpart — lock.
- [ ] **Scope-honesty decision (owner):** the player cloud is the **cheap, low-N demo**; the **justified large-N version is hands/spots** (thousands of points, where projection genuinely beats faceted filters and SR-88 gets a real similarity space). Decide: is v1 still players, or does the first real consumer become hands?
- [ ] **Opportunity-cost question Gate 3 must answer:** at N≈dozens, does a projection beat a raw 2-axis (VPIP×AF) labeled scatter? If not, v1 may be over-built.

## Links

- Gate 1 entry: [`2026-06-18-entry-projection-explorer.md`](./2026-06-18-entry-projection-explorer.md) · Lifecycle: [`../LIFECYCLE.md`](../LIFECYCLE.md) · Roundtables: [`../ROUNDTABLES.md`](../ROUNDTABLES.md)
- Prototype: `prototypes/player-cloud-3d.html`
- Prior art cited: TensorBoard Embedding Projector; Nomic Atlas (2D); Apple Embedding Atlas, arXiv 2505.06386 (2D)
- PMC: `.claude/projects/predictive-model-calibration.md` (reports-into, not inside)
- Engine layer refs: `src/utils/pokerCore/CLAUDE.md`, `src/utils/exploitEngine/CLAUDE.md` (WEAKNESS_EXPLOIT_MAP removal = AP-PJX-01 precedent)

## Owner verdicts (2026-06-18, captured at Gate 2 review)

- **Modality:** **Gate 3 prototypes BOTH** 2D and 3D on real data; decide empirically from what reads better, not from market priors. (Did not accept "2D-first" outright; did not lock 3D. The manipulable-unit requirement stands either way.)
- **First consumer:** **"Players for the loop, hands as the goal."** Build `projectionEngine/` + the numeric forced-loop on players now (cheap end-to-end validation), but the engine API must be designed so **hands/spots plug in as consumer #2 without rework**. Hands is the acknowledged high-value target; players is the proving ground.
- These two verdicts are now binding Gate 3 inputs (added to follow-ups).

## Change log

- 2026-06-18 — Created. Four-perspective roundtable. Verdict 🔴 RED → Gate 3. Convergent finding across all four lenses: the manipulable cloud serves **exploration (DX-01)**, not the **calibration job (DX-03)** the owner picked — which is circular as designed and needs a **numeric** instrument (silhouette / k-means confusion / classifier-blind ablation). Forced loop must compare **feature vectors, not coordinates** (PCA sign-flip + UMAP non-determinism). **DX-04 (re-label in place)** added as the corrective action that makes the loop a loop. Modality challenged: market evidence (Nomic/Apple Atlas) favors **2D-first**; 3D de-scoped to optional toggle pending owner override. Engine boundary resolved (4th peer engine; AP-PJX-01 governs, not POKER_THEORY; structural API split + CI lint). PJX reports into PMC's `domain-correctness` program, not inside PMC.
