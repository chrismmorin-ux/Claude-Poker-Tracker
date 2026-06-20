# Gate 1 Entry — 2026-06-18 — Projection Explorer (PJX)

**Feature working name:** Projection Explorer (PJX) — project raw app data into a manipulable 3D space via dimensionality reduction; observe emergent structure.
**Proposed by:** Owner, 2026-06-18 ("we need to seriously invest in this kind of architecture… make sure we have an iterative loop forced to be in place"). Greenlit as a real investment after a throwaway prototype (`prototypes/player-cloud-3d.html`) validated the mechanism on synthetic data.
**Owner-ratified build shape (2026-06-18, AskUserQuestion):** **"Both, sequenced"** — (1) a first-class product **engine module**, then (2) a recurring **CWOS analysis engine** wrapped around it so observation re-runs on a cadence. The CWOS engine is the forcing function for the iterative loop.
**Gate:** 1 (Entry) — mandatory.
**Next gate:** 2 (Blind-Spot Roundtable) — **required** per verdict below.
**Status:** OPEN — this document is the Gate 1 artifact. **No production code written.** Audit-only per `docs/design/LIFECYCLE.md` Gate 1 contract. (The prototype is a disposable HTML file outside `src/`, touching no app deps — it is evidence, not the feature.)

---

## Feature summary (as proposed)

A capability that takes a set of records the app already holds (opponents, hands, ranges, …), turns each into a numeric feature vector, and squashes those vectors into 3 dimensions via dimensionality reduction (PCA / UMAP / t-SNE / MDS) so each record becomes a dot in a rotatable 3D cloud where **distance ≈ similarity**. The first surface is a **Player Cloud**: one dot per logged opponent, colored by the existing play-style label (`Fish / LAG / TAG / Nit / LP / Reg`), sized by sample confidence. The intent: structure that is invisible in tables (clusters, outliers, drift) becomes a shape you can see and manipulate.

The prototype confirmed the *mechanism* works: even on the honest PCA baseline, synthetic archetypes separated spatially and agreed with the style classifier. **Gate 1's job is not "does it render" — it is "what job does it serve, for whom, and does our framework already cover that?"** That question is where the findings below concentrate.

---

## Critical scope-shaping discoveries

Five realities from grounding (`prototypes/` build + two structured codebase/framework scouts) that materially shape what PJX *is*.

### Discovery 1 — The capability currently has a **justification gap**, not just a coverage gap. This is the headline finding.

The verified primary user (`chris-live-player`) has **no stated goal** that this serves, and an explicit **non-goal that resists it**:

> Non-goal (chris-live-player.md): *"**Pretty for its own sake.** Visuals that don't shave time or reduce error are wasted effort."*

Chris's goals are at-the-table recall, fast logging, better in-the-moment decisions, and trust. None is open-ended exploratory data visualization. **A 3D point-cloud must affirmatively defend itself against Chris's "pretty for its own sake" non-goal** — i.e., it must demonstrably shave time or reduce error, not merely look impressive. This is the single most important thing Gate 2 must resolve. If it can't be answered, the honest outcome is that PJX does **not** proceed as an end-user surface — and the forced loop will have correctly prevented a cool-but-jobless build. (See §Reframe for the angle that survives this test.)

### Discovery 2 — The persona who *would* want it (`analyst-api-user`) is **PROTO-unverified** and has a **tooling-posture conflict**

The Analyst ("engineer/quant by day… wants to own the data… build personal dashboards independent of the app… test hypotheses the exploit engine doesn't cover") is the natural fit. But two problems:
- **Evidence status: PROTO — unverified.** Per methodology principle #6, we do not trade a confirmed Chris-need against a hypothetical persona's need.
- **Posture conflict:** the Analyst's instinct is **BYO-tooling** — export raw data, do the dimensionality reduction themselves in a notebook. An in-app, app-opinionated 3D explorer is closer to the *opposite* of what they ask for. It serves them only if the projection is fully inspectable + exportable (axes meanings, feature list, raw coords).

### Discovery 3 — The nearest existing JTBDs (SR-88, DS-47) do **not** specify spatial/embedding methods, and DS-47 carries a doctrine refusal

- **SR-88 — Similar-spot search across history** (Proposed): *"find all similar spots in my history (e.g., 'turn check-raise on paired board, 40bb deep')."* Framed as **faceted attribute-match**, not a learned similarity space. PJX *could* implement SR-88's "similar" via embeddings/nearest-neighbor, but SR-88 does not require it. Reconciliation needed, not assumption.
- **DS-47 — Skill map / mastery grid** (Proposed): explicitly flagged in `drills-and-study.md` as *"the gamified grid the doctrine refuses,"* superseded by **DS-68** (non-gamified competence-trend). **A 3D "mastery map" inherits DS-47's gamification concern and collides with red line #5 (no streaks/shame/engagement-pressure).** PJX must steer clear of framing the cloud as a hero-progress/mastery artifact.

### Discovery 4 — No existing "see structure in my data" JTBD anywhere; fully greenfield infra

- `cross-cutting.md` has **no** visualize / explore / cluster / structure / similarity job. Genuine JTBD gap.
- **Zero** existing dimensionality-reduction / embedding / clustering / nearest-neighbor code over players or hands (confirmed by grep; all hits false positives). PJX is **net-new infrastructure with no primitive to build on.**

### Discovery 5 — PJX is an **engine** in the product sense → it inherits the poker-theory + first-principles guardrails

"Both, sequenced" makes `src/utils/projectionEngine/` (or similar) a first-class engine module. Per CLAUDE.md's Poker Analysis Guardrail and the codebase's **"labels are outputs, not inputs"** doctrine, this binds a hard anti-pattern:

> **AP-PJX-01 — Spatial position must never be a decision input.** The cloud is a *descriptive output* of the feature vectors. It is forbidden for any exploit/decision/range code to read a point's coordinates, its cluster membership, or its proximity-to-a-labeled-cluster as an *input* (e.g., "this villain is near the Fish cluster ⇒ raise fold-rate ×1.1"). That is precisely the double-counting the codebase forbids (labels and positions both derive from the stats; feeding them back in re-counts the same evidence). Style labels may **color** dots for validation; they may not be *computed from* position, nor may position feed any downstream model. Binds [first-principles modeling] + [prefer-unrepresentable].

---

## Reframe — the justification that survives Discovery 1

The angle that defeats Chris's "pretty for its own sake" non-goal is **not** "a cool view for the player." It is **PJX as a model-validation / calibration instrument**:

> The cloud's real job is to answer *"do the app's style labels actually correspond to natural groupings in the data — or is the classifier drawing lines reality doesn't?"* That **reduces error** (it catches miscalibrated player-typing before it misleads an exploit), which is exactly what the non-goal demands of any visual.

This reframes PJX's primary value as **operator-facing model observability**, dovetailing with the **PMC (Predictive Model Calibration)** program — the existing forced model-vs-reality loop. Under this framing PJX is the visual front-end of the same instinct PMC encodes numerically. It is *secondarily* an end-user/Analyst feature. Gate 2 should pressure-test whether this reframe holds, or whether it's a rationalization.

---

## Output 1 — Scope classification

**Primary classification:** **Surface addition + new product engine module + cross-cutting primitive.** A genuine triple:

1. **Surface addition** — a new 3D view (and/or an operator dashboard panel). New routed view ⇒ Gate 2 mandatory on its own.
2. **New product engine module** — `src/utils/projectionEngine/` (feature extraction → standardization → projection → coords). Binds POKER_THEORY + engine sub-dir CLAUDE.md + AP-PJX-01 before any code (Discovery 5).
3. **Cross-cutting visualization primitive** — once it exists, any record type (players, hands, ranges) can be embedded. This is the "kind of architecture" the owner wants to invest in.

**Schema impact:** likely none required for v1 — the existing backup export (`exportUtils.js`) + on-the-fly `tendencyCalculations.js` already yield the player feature vectors. Caching embeddings (optional) would touch IDB later, not in v1.

**The CWOS-engine half (the forced loop):** a registered `/engine` that, on cadence, re-embeds current data and emits findings on (a) cluster drift, (b) villain type-migration, (c) **classifier-vs-emergent-structure disagreement** (the Discovery-1 reframe, the highest-value signal). This is the forcing function and the PMC tie-in.

---

## Output 2 — Personas identified

| Persona | Role for PJX | Core/Situational | Status |
|---|---|---|---|
| [Analyst (api-user)](../personas/core/analyst-api-user.md) | Most natural fit — wants to own/probe data | Core | **PROTO — unverified.** Posture-conflict (Discovery 2) |
| [Chris (live player)](../personas/core/chris-live-player.md) | Verified user; **no covering goal**, has anti-goal | Core | Existing; gap (Discovery 1) |
| [Post-Session Chris](../personas/situational/post-session-chris.md) | Off-table review window where exploration could live | Situational | Existing |
| [Study-block](../personas/situational/study-block.md) | Dedicated study time | Situational | Existing |
| **Operator / model-owner** (the founder reviewing model health) | Primary under the §Reframe (calibration instrument) | **Not a modeled UX persona today** | **Gap** |

### Persona-sufficiency check
> *"Does our current cast actually cover this feature, or do we need a new persona?"*

**🔴 RED.** The most plausible end-user (Analyst) is unverified and posture-conflicted; the verified user (Chris) has no covering goal and an anti-goal. Under the §Reframe, the *real* primary is an **operator/model-owner** stance that the persona cast doesn't model as a UX persona (it lives in CWOS/PMC, not in `personas/`). Gate 2 Stage A must decide: author an operator/model-owner persona, promote the Analyst from PROTO, or accept that PJX v1 is operator-tooling outside the end-user persona system.

---

## Output 3 — JTBDs identified

### Nearest existing (reconciliation required, none a clean fit)

| Existing JTBD | Domain | Relationship |
|---|---|---|
| SR-88 — Similar-spot search across history | session-review | Adjacent. Faceted-filter framing, not embedding. PJX could *power* it; doesn't *match* it. |
| SR-24 — Filter by street/position/opponent-style | session-review | Closest "find structure" job today — but explicit faceting, not spatial. |
| DS-47 — Skill map / mastery grid | drills-and-study | **Avoid.** Doctrine-refused (gamified); superseded by DS-68. PJX must not be framed as hero-mastery map. |
| DS-68 — Non-gamified competence-trend | drills-and-study | The autonomy-safe sibling; any hero-facing PJX framing must align here, not DS-47. |

### Proposed (provisional — IDs not reserved until Gate 3 per ATLAS DS-registry note)

Domain placement is itself an open question (new `data-exploration` / `DX` domain vs extend `cross-cutting`). Proposed **conditional on the Discovery-1 justification question resolving affirmatively in Gate 2.**

1. **DX-01 (proposed)** — *See the hidden structure in my opponent pool.* When I've logged many opponents over time, I want to see how they group into types as a spatial map, so I recognize player types faster and spot who is secretly similar to someone I already have a read on.
2. **DX-02 (proposed)** — *Find the nearest analogues to the player/spot in front of me.* (Reconciliation candidate with SR-88 — collapse or keep as the spatial realization of it.)
3. **DX-03 (proposed)** — *Check whether the app's categories match reality.* When the app assigns style labels, I want to see whether those labels correspond to natural groupings in the data, so I can trust — or correct — the model. **(The §Reframe job; ties to PMC; the most defensible of the three.)**

### JTBD-coverage check
> *"Does any proposed outcome not map to an existing JTBD?"*

**🔴 RED.** No existing JTBD models exploratory/spatial structure-finding. Three proposed; DX-03 is the load-bearing one (it survives the non-goal test); DX-01/02 need the justification question answered first.

---

## Output 4 — Gap analysis verdict

| Dimension | Verdict | Notes |
|---|---|---|
| Justification (does a real job exist?) | 🔴 RED | Verified user has no goal + an anti-goal; the fitting persona is unverified. §Reframe (DX-03/PMC) is the survival path. |
| Personas | 🔴 RED | Operator/model-owner unmodeled as UX persona; Analyst PROTO; Chris gap |
| JTBDs | 🔴 RED | No existing job; 3 proposed, only DX-03 clearly defensible |
| Product engine module schema | 🟡 YELLOW | Greenfield but additive; no IDB change in v1 |
| Dimensionality-reduction infra | 🔴 RED | Zero existing code; fully net-new |
| First-principles compliance (AP-PJX-01) | 🟡 YELLOW | GREEN once enforced; RED if any draft lets position feed a decision |
| Autonomy red lines (if it ever colors hero data) | 🟡 YELLOW | #1/#2/#5/#8 implicated; v1 should stay villain/opponent-side + operator-side only |
| Data access for v1 | 🟢 GREEN | Existing backup export + tendency pipeline already yield the vectors |
| Mechanism feasibility | 🟢 GREEN | Prototype validated on synthetic data |
| Forced-loop mechanism | 🟢 GREEN | "Both, sequenced" + PMC tie-in is a sound forcing function |

### Overall Gate 1 verdict: 🔴 **RED**

**Four RED dimensions.** Gate 2 (Blind-Spot Roundtable) is **mandatory.** This RED is healthy: it is the forced loop doing exactly what the owner asked of it — catching, *before* we build, that a validated *mechanism* does not yet have a validated *job*. The mechanism is real; the justification is the open question.

---

## Recommended Gate 2 (Blind-Spot Roundtable) scope

- **Stage A — Persona sufficiency.** Resolve the operator/model-owner persona question. Promote Analyst from PROTO, author a new operator persona, or scope PJX v1 as operator-tooling outside the end-user persona system. Decide whether Chris is a consumer at all in v1.
- **Stage B — JTBD reconciliation + the justification test.** The central question: *does PJX shave time or reduce error (defeating Chris's non-goal), or is it pretty-for-its-own-sake?* Pressure-test the §Reframe (DX-03 as a calibration instrument tied to PMC). Reconcile DX-02 vs SR-88 (collapse or keep). Confirm DX-01 isn't a DS-47 gamification re-entry.
- **Stage C — Situational stress.** Walk post-session-chris and study-block through "open the cloud, what do I *do* with it?" If there's no next action the cloud drives, that's a finding.
- **Stage D — Cross-surface / cross-system.** PMC overlap (is PJX the visual front-end of PMC, and should it be built *inside* that program?). Cross-surface contamination red line #8 if hero data is ever colored. The "both sequenced" engine boundary: where does the product module end and the CWOS engine begin?
- **Stage E — Heuristic pre-check.** AP-PJX-01 (position-as-input) on every proposed consumer. Nielsen "match real world": do 3D axes mean anything a human can name, or are they opaque PCA components (interpretability is load-bearing for the Analyst + for trust)? Mobile-landscape 1600×720 if it ever ships to the live app (a 3D drag surface on a phone is a real constraint). Red line #5 if framed as hero progress.

---

## Required follow-ups (blocking Gate 4)

- [ ] **Gate 2 — Blind-Spot Roundtable** at `audits/2026-06-XX-blindspot-projection-explorer.md`, all five stages. Verdict drives Gate 3.
- [ ] **Gate 3 — Research (likely):** resolve persona question; ratify DX-01..03 (or reject); decide PJX-inside-PMC vs standalone; specify the `projectionEngine/` module contract + AP-PJX-01 invariant; specify the CWOS analysis-engine cadence + finding types (drift / migration / classifier-disagreement).
- [ ] **Gate 4 — Design:** surface artifact(s) — `surfaces/projection-explorer.md` and/or an operator dashboard panel — before any code. Engine module spec.
- [ ] **Sequencing reminder:** "Both, sequenced" = product module first (consumer = the view), then the CWOS engine wraps it. Do not build the CWOS engine against a module that doesn't exist yet.

## Open questions for owner (before Gate 2)

1. **The justification question (the big one).** Is PJX primarily a **model-validation / calibration instrument** (the §Reframe — "do my labels match reality?", error-reducing, operator/PMC-facing), or primarily an **end-user exploration feature** (Analyst/Chris-facing)? Your answer sets the primary persona, the primary JTBD, and whether this lives inside PMC or stands alone. **Recommendation:** lead with the calibration framing — it's the one that survives Chris's non-goal and has the strongest forced-loop story.
2. **Inside PMC, or standalone program?** PJX's strongest job (DX-03) is the visual face of PMC's model-vs-reality loop. Fold PJX into PMC, or run it as its own thin program that *reports into* PMC? **Recommendation:** build the engine module standalone (reusable primitive), but route its forced-loop findings into PMC rather than a new program — fewer moving parts, one calibration loop not two.
3. **v1 dot = players only?** Confirm v1 is the Player Cloud (cheapest, data ready). Hands/situations (the higher-value leak-finder) is a later consumer once the primitive + a hand-feature design exist.
4. **Interpretability bar.** How much does it matter that the 3 axes are *nameable* (e.g., "aggression," "looseness") vs. opaque PCA components? Higher interpretability favors a constrained/curated projection over raw UMAP. **Recommendation:** require at least one human-nameable axis for trust.

---

## Links

- Feature lifecycle: [`docs/design/LIFECYCLE.md`](../LIFECYCLE.md) · Methodology: [`docs/design/METHODOLOGY.md`](../METHODOLOGY.md) · Roundtable template: [`docs/design/ROUNDTABLES.md`](../ROUNDTABLES.md)
- Prototype (evidence, disposable): `prototypes/player-cloud-3d.html`
- Personas: [`analyst-api-user`](../personas/core/analyst-api-user.md) (PROTO), [`chris-live-player`](../personas/core/chris-live-player.md)
- JTBD adjacents: SR-88, SR-24 ([session-review](../jtbd/domains/session-review.md)); DS-47 / DS-68 ([drills-and-study](../jtbd/domains/drills-and-study.md))
- Engine modules referenced: `src/utils/tendencyCalculations.js` (feature source, GREEN), `src/utils/handAnalysis/handTimeline.js` (timeline), `src/utils/exploitEngine/` (style labels — outputs, not inputs)
- Program tie-in: PMC (Predictive Model Calibration) — `.claude/projects/predictive-model-calibration.md`
- Bound doctrine: "labels are outputs, not inputs" (POKER_THEORY §7); AP-PJX-01 (this audit)

## Change log

- 2026-06-18 — Created. Owner greenlit "this kind of architecture" + "forced iterative loop"; ratified "both, sequenced" build shape. Verdict 🔴 RED — four RED dimensions, the headline being a **justification gap** (verified user has no covering goal + a "pretty for its own sake" anti-goal; the fitting Analyst persona is PROTO + posture-conflicted). §Reframe identifies the survival path: PJX as a model-validation/calibration instrument tied to PMC (error-reducing, defeats the non-goal). Gate 2 mandatory; its central task is the justification test, not the mechanism (mechanism already validated by prototype). AP-PJX-01 (spatial-position-never-a-decision-input) registered as a binding engine anti-pattern.
