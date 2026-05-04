# Anti-pattern refusal list — Self-Coach Foundation (SCF)

**Date:** 2026-05-02 (Gate 2)
**Project:** Self-Coach Foundation (Master Plan §D)
**Audience:** Gate 4 surface designers, Gate 5 component / persistence authors, Phase 2+ contributors.
**Parent gates:**
- Gate 1 — `docs/design/audits/2026-05-02-entry-self-coach-foundation.md`
- Gate 2 — `docs/design/audits/2026-05-02-blindspot-self-coach-foundation.md` §Stage E

**Sibling:** [`copy-discipline.md`](copy-discipline.md) (language-level refusals; CD-1..5 + CI-lint forbidden-string regexes). This file is the feature layer; that file is the language layer.

---

## Why this list exists

SCF carries autonomy risks every hero-side coaching surface inherits: the user is reviewing their own play, and any framing drift toward graded-work / mastery-score / engagement-pressure / cross-surface-contamination converts a tool that helps the user coach themselves into a tool that judges, grades, or pressures them. Master Plan §D explicitly names this risk class as load-bearing for SCF.

The 9 autonomy red lines (`docs/design/personas/core/chris-live-player.md` §Autonomy constraint) bind every SCF surface, but red lines are general and sometimes pre-date SCF-specific failure modes. The 6 SCF-specific anti-patterns below operationalize the red lines into testable feature refusals — what SCF surfaces CANNOT ship — and the EAL-inherited AP-01..09 list applies transitively wherever SCF reuses calibration / observation / capture infrastructure (the Calibration Dashboard reuse for CO-56 is the primary inheritance path).

**Rule for amendments.** A new anti-pattern triggers **persona-level review**, not feature-level. Same rule as PRF and EAL anti-patterns. Removing an anti-pattern requires the same — these are autonomy invariants, not feature preferences. Default answer to amendments: no.

---

## SCF-specific anti-patterns

### AP-SCF-01 — Graded-work-framing on system-imposed hero leak surfaces

**Refused (SCF Gate 3 re-statement, 2026-05-02).** **System-imposed** grading on hero-leak surfaces is REFUSED. SCF system-imposed surfaces (SelfCoachView leak inventory rendered without user request, HandReplayView leak-panel embed, between-hands read-only leak-count card, CO-56 hero-leak calibration view) cannot use scoring / accuracy / "how did you do" / "your rating" / "did you make the right play" / "graded play" copy. Surface chrome, panel titles, button labels, modal text, and inline annotations on these surfaces all bound by the refusal.

**SCF Gate 3 nuance:** **Owner-volunteered** tests on opt-in test surfaces are PERMITTED. When the user explicitly taps "Test myself on this concept" → quiz surface, factual grading results ("3 of 5 correct") are autonomy-aligned because the grading happens at user request. The opt-in gate is the load-bearing autonomy contract.

**Why.** AP-06 (graded-work trap) is the single most-cited autonomy failure mode in external coaching products (Upswing, Run It Once Elite, BBZ, GTO Wizard, Crush Live, Red Chip). The market normalizes the grading frame because it drives engagement metrics. SCF's load-bearing JTBD is precisely the inverse — CO-54 *see-leak-without-being-graded* is named to refuse system-imposed grading. A surface that ships hero-leak-detection with system-imposed graded vocabulary defeats the JTBD it serves. **But:** owner-volunteered grading inverts the autonomy stance — the user CHOSE to be graded; refusing to grade them defeats the JTBD they actively requested.

**Red line violated (system-imposed only):** #5 (no streaks / shame / engagement-pressure), #7 (editor's-note tone — no gamified-infantile language). Inherits AP-06 from EAL. Owner-volunteered grading is autonomy-honoring (red line #1 opt-in is satisfied by the explicit user action).

**Allowed alternatives.**

1. **System-imposed surfaces:** Factual count + credible interval + non-judgmental framing. Vocabulary: "observed", "tracked", "noted", "trend", "pattern". Example: *"Observed fold-to-cbet IP rate: 52% [38%, 66%] over 30 hands (last 12 sessions). Trend: ▲ +4 pp vs prior 30-hand window."* — never *"Your fold-to-cbet score: 52% (target: 35%)."*

2. **Owner-volunteered test surfaces (opt-in gated, SCF Gate 3 amendment):** Factual grading vocabulary on user-initiated quiz surfaces. Example: *"Concept quiz: equity decomposition. Question 3 of 5: ..."* → factual results display *"3 of 5 correct"*. The opt-in affordance ("Test myself on this concept" button) MUST be user-initiated; the quiz cannot auto-launch. CI-lint allows the grading-vocabulary subset for surfaces declaring `cd5_exempt: 'owner-volunteered-test'` in their manifest with a user-initiation description.

**Surface placement enforcement:** SourceUtilPolicy whitelist (per SCF Gate 2 §D + Gate 3 SCF-G3-DETECTOR) restricts hero-leak data reads to review-mode surfaces. Owner-volunteered test surfaces, if added in Gate 4 v1+, are also whitelisted with the explicit opt-in gating contract. Live surfaces remain blacklisted regardless of grading mode.

---

### AP-SCF-02 — Cross-surface contamination of hero-leak data into live surfaces

**Refused.** Hero-leak inference outputs (rates, claims, drift arrows, credible intervals, panel embeds, summary counts) MUST NOT render on OnlineView seats, sidebar HUD, TableView chrome, TournamentView, ShowdownView, or any live-decision surface. The `mid-hand-chris` situational persona is explicitly excluded from any SCF affordance. This is structural, not stylistic — the read paths are blacklisted in `source-util-policy.md` (Gate 4 deliverable SCF-G4-SUP).

**Why.** Red line #8 (no cross-surface contamination — study-mode inference stays in study mode) is non-negotiable. Hero-leak inference is study-mode inference: it derives from review-mode aggregation of past hands. Rendering it during live play creates the bot-judges-me-mid-hand failure mode that external products (GTO Wizard live HUD, BBZ overlay) ship and get player complaints about. SCF's structural segregation refuses the failure mode at the read-path level.

**Red line violated:** #8.

**Allowed alternative.** SCF read paths whitelisted to: `HandReplayView` (review mode), `PlayerAnalysisPanel` (review mode), `SelfCoachView` (TBD Gate 4). Exposure to `between-hands-chris` is permitted ONLY via a read-only leak-count card embedded in HandReplayView's existing review chrome — never on the live game surface itself. SourceUtilPolicy CI-grep enforcement at Gate 4.

---

### AP-SCF-03 — Silent tier inference without explicit owner confirmation

**Refused.** System-inferred tier metadata MAY suggest a tier, but MUST NOT silently set or persist it. Inferred values are rendered alongside the owner-set value with explicit "confirm or amend" affordance. The system NEVER overrides an owner-set tier on the basis of inference, even if observed play diverges substantially from declared tier (red line #3 durable overrides).

**Why.** Red line #1 (opt-in enrollment, no silent skill inference) is the foundational autonomy invariant. Tier metadata is the highest-leverage skill claim in the system — it gates curriculum sequencing across study, refresher tier-floor filtering, drill scheduler weighting. A silent inference here is a single-point autonomy failure that ripples through every coaching surface. Mirrors EAL's per-anchor calibration override mechanic (anchors auto-retire only via overlap detection, never via behavioral inference).

**Red line violated:** #1 (opt-in), #3 (durable overrides).

**Allowed alternative.** v1 Gate 4 ships explicit tier-set radio in Settings (owner-set only). v2 Phase 2+ may add inference-with-confirmation: system surfaces "Observed play suggests `studied-amateur` (current declaration: `live-rec`). Confirm or amend?" — confirmation is a single tap; amendment opens the Settings radio; default is owner-set value preserved.

---

### AP-SCF-04 — Small-sample leak claim under n=30 hand-count floor

**Refused.** Surfaces MUST NOT render hero-leak claim text when n<30 hands of data exist for the situation key. No interpolation, no "preliminary read", no claim-with-warning-about-sample-size. Below the floor, the surface renders factual placeholder copy only.

**Why.** Binomial 95% MoE at p=0.5 is ±18% at n=30, ±25% at n=15. Below n=30 the credible interval is so wide that any claim text becomes either misleading (suggests precision the data doesn't support) or so heavily caveated it stops being a claim. Rendering such a claim violates red line #2 (full transparency on demand) by implying confidence the data doesn't support, and risks AP-SCF-01 graded-work tone (a claim with low precision still reads as a verdict to the user). Mirrors villain-side `weaknessDetector.js` Bayesian-confidence convention.

**Red line violated:** #2 (transparency — visible sample-size + credible interval mandatory). Stage C floor decision operationalized.

**Allowed alternative.** Factual placeholder: *"Insufficient sample (need {30 - n} more hands)"* — non-graded, non-judgmental, factually transparent. Above the floor, the claim renders WITH credible interval visible inline (`52% [38%, 66%] over 30 hands`) — never a point estimate alone.

---

### AP-SCF-05 — Mastery score on curriculum progress

**Refused.** Curriculum-spine browse (CO-55 *learn-next-concept-im-ready-for*) MUST NOT show scalar "X% mastered", "X of Y concepts complete", percentage progress bars, XP, completion badges, or any aggregate over the concept list. Per-concept state is binary ("drilled" / "not yet drilled") + last-drilled-at timestamp.

**Why.** Mirrors AP-PRF-04 (Printable Refresher mastery score refusal) and AP-EAL-04 (calibration mastery score refusal). Mastery scores collapse heterogeneous concepts into a single comparable scalar, manufacturing a ranking where none is meaningful (a concept fully drilled at `live-rec` tier is not "mastered" relative to a concept at `serious-grinder` tier — the comparison is a category error). The scalar then drives engagement-pressure: low-mastery concepts feel second-class; the user studies for the score, not for the concept.

**Red line violated:** #5 (no engagement-pressure), #14 (no mastery/streak tracking — promoted to red line in EAL Gate 2).

**Allowed alternative.** Per-concept binary state ("drilled" / "not yet drilled") + last-drilled-at timestamp + linked drill count (e.g., *"Drilled (last: 2026-04-28; 5 sessions)"*). Curriculum-spine navigation defaults to next-teachable concept per tier × per-domain mastery, but presents as a flat list with the next-teachable highlighted — never as a progress bar.

---

### AP-SCF-06 — Streak / engagement-pressure on study cadence

**Refused.** "Study streak: X days", "you haven't studied in N days, jump back in", push notifications on cadence drift, calendar-based "study reminders" auto-set by the system. Settings affordance to OPT-IN to a calendar reminder is permitted (owner sets cadence); system-driven cadence pressure is refused.

**Why.** Streaks are the canonical autonomy-failure pattern in study/coaching products. They convert studying into a metric to defend, leak shame on missed days, and drift the JTBD from "learn next concept" to "preserve the streak." Red line #5 (no streaks / shame / engagement-pressure) refuses the entire pattern class. Owner can self-impose cadence via personal calendar (outside the app); SCF refuses to host the pressure mechanism.

**Red line violated:** #5.

**Allowed alternative.** Passive last-session timestamp in Settings (factual, non-judgmental: *"Last study session: 2026-04-29"*). Owner-set calendar reminder via Settings opt-in (system stays silent until owner explicitly enables; cadence configurable; default OFF).

---

## EAL-inherited anti-patterns (transitive)

When SCF features surface via shared components (notably the Calibration Dashboard reuse for CO-56 hero-leak calibration view), the EAL parent-project anti-patterns apply transitively. Violations at the SCF surface level fail Gate 5 review regardless of whether the violating pattern is SCF-specific or EAL-inherited.

| Inherited ID | Pattern | SCF applicability |
|--------------|---------|-------------------|
| AP-01 | Per-villain-archetype prescription | Direct: SCF curriculum-spine MUST NOT prescribe study path keyed on villain archetype; concept progression keyed on tier × per-domain mastery. |
| AP-02 | Calibration leaderboard | Mirrored in AP-SCF-05 (mastery-score refusal); inherits AP-02's "no inter-anchor ranking" stance. |
| AP-03 | Engagement-pressure framing | Mirrored in AP-SCF-06 (streak refusal); broader: any nudge framing is AP-03. |
| AP-04 | Calibration score | Mirrored in AP-SCF-01 (graded-work refusal) at the surface level; mirrored in AP-SCF-05 (mastery-score refusal) at the curriculum level. |
| AP-05 | Retired-anchors-you-might-reconsider | Applies if SCF surfaces "leaks you fixed but might be regressing" — the pattern must be neutral data presentation, not nudge-to-act framing. |
| AP-06 | "Your calibration accuracy" graded-work | Mirrored verbatim in AP-SCF-01 (graded-work-framing refusal). The anchor refusal of the SCF program. |
| AP-07 | Cross-surface calibration leakage onto live surfaces | Direct: AP-SCF-02 is the SCF-specific re-statement; live surfaces stay clean of hero-leak data. |
| AP-08 | Signal fusion (declaration + observation arithmetically fused) | Direct: SCF tier metadata (owner declaration) and per-domain mastery (drill behavior) MUST NOT be arithmetically fused into a composite "skill score." Each remains independent input to scheduler / curriculum. |
| AP-09 | Capture framing for observation ("how did this hand go?") | Direct: SCF leak-ack affordances use "Note this leak" / "Mark for follow-up" — never "How did you handle this?" / "Did you misplay?" / "Rate your decision." |

**Inheritance rule.** SCF surfaces that cite an EAL-derived fact (Calibration Dashboard primitive reuse, anchor reference in a teachable concept) inherit the parent anti-pattern register. Gate 5 review walks both registers.

---

## Relationship to copy-discipline

Anti-patterns are **feature refusals** (what the app cannot do). Copy-discipline (`copy-discipline.md`) is **language refusals** (how the app cannot talk). Both are necessary; each fails independently.

A surface can satisfy every anti-pattern refusal (no progress bar, no streak, no cross-surface contamination) and still fail CD-1..5 at the prose level if its copy reads as graded-work, imperative, or engagement-laden. A surface can satisfy CD-1..5 and still ship an AP-SCF-05 mastery score if its chrome includes a "X of Y concepts" widget around the body.

**Layered enforcement:**

- **Anti-patterns** caught at **Gate 4 spec review + Gate 5 merge review** — does the surface concept ship a refused feature?
- **Copy-discipline** caught at **content-build CI** — forbidden-string grep in `copy-discipline.md` §CI-lint section; blocks Gate 5 PRs on violation.

---

## Change log

- **2026-05-02 — Shipped (Gate 2).** 6 SCF-specific anti-patterns (AP-SCF-01..06) authored from Gate 2 §Stage E. EAL-inherited AP-01..09 listed transitively with applicability annotations. AP-SCF-04 operationalizes the n≥30 hand-count floor decided in Gate 2 §Stage C. AP-SCF-01 is the program's anchor refusal (graded-work-framing) — the load-bearing one external coaching products fail.
- **2026-05-02 (later) — SCF Gate 3 nuance amendment.** AP-SCF-01 refusal scope re-stated: **system-imposed** grading on hero-leak surfaces refused; **owner-volunteered** tests on opt-in test surfaces permitted (the opt-in gate is the load-bearing autonomy contract). Memory entry: `feedback_owner_volunteered_grading.md`. Companion update: `copy-discipline.md` CD-2 nuance.
- **2026-05-02 (later still) — SCF Gate 4 binding clarifications.**
  - **AP-SCF-01 nuance scope clarified.** "Owner-volunteered tests" includes opt-in-test mode of the existing drill engines (`postflop-drills.md` / `preflop-drills.md`). Per Gate 4 architectural overlap binding (drills + tests share substrate; no parallel prediction engine), the test surface is a MODE of the drill engine with 3 deltas (entry path / result framing / persistence tag). The CD-2 nuance permission applies to the result-display surface of opt-in-test mode only (declares `cd5_exempt: 'owner-volunteered-test'` manifest flag). System-imposed surfaces — lesson card body, SelfCoachView Hero leaks section, SelfCoachView Curriculum section, HRV inline annotation — remain bound by the full refusal.
  - **AP-SCF-03 Settings tier-set binding (Gate 4 §SCF-G4-SETTINGS).** v1 ships explicit owner-set tier-set radio in SelfCoachView Settings tab (6 mutually-exclusive options: novice / live-rec / studied-amateur / part-time-grinder / serious-grinder / pro). Default unset. N05 confirm pattern on tier-downgrade: factual + non-judgmental message "Tier change persisted; observed-play inferences not reset." Inference-with-confirmation is Phase 2+ work; v1 has NO inference. The `src/utils/skillAssessment/` module computes inferred-tier suggestion (Phase 2+) but NEVER writes to `userSettings.tier.current` — owner-set only.
  - **No new anti-patterns added at Gate 4** — the 6 SCF-specific anti-patterns remain sufficient. Gate 4 surface design walks each AP × each surface in the Gate 4 audit doc anti-pattern matrix; all cells: compliant, N/A, or nuance-applies-with-binding-rule. No violations surfaced.
