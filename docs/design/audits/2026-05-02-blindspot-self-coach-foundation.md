# Blind-Spot Roundtable — 2026-05-02 — Self-Coach Foundation

**Type:** Gate 2 Blind-Spot audit (design lifecycle per [`docs/design/LIFECYCLE.md`](../LIFECYCLE.md))
**Trigger:** Gate 1 verdict **RED** ([`docs/design/audits/2026-05-02-entry-self-coach-foundation.md`](2026-05-02-entry-self-coach-foundation.md)) — six RED dimensions (overall-tier schema, hero leak detection, curriculum spine, lesson-to-leak binding, confidence-elicitation surface, plus AP-06 lock-strictness un-ratified) trigger Gate 2 mandatorily per LIFECYCLE.md.
**Sprint / WS:** SPR-014 / WS-010 (Master Plan §D, Phase 2 stagger continuation — alternates with SPR-013 PIO-G1).

**Participants (5 voices, integrative pattern per `2026-04-24-blindspot-printable-refresher.md` precedent):**

| Voice | Lens | Stage(s) led |
|-------|------|--------------|
| V1 — Pedagogy | Curriculum theory, learning sequencing, motivational psychology, persona learning-fit | A, B |
| V2 — Autonomy / Failure | 9 red lines compliance, AP-06 lock strictness, copy-discipline enforcement | E (+ cross-stage) |
| V3 — Privacy | Hero-leak data lifecycle, cross-surface segregation, IDB persistence | D |
| V4 — Engineering | Schema deltas, drill-scheduler integration, persistence location, heuristic ML06/PLT | D, E |
| V5 — Market / External lens | External coaching/edu products as blind-spot foil; framing patterns the market normalizes that this program refuses | Cross-stage check |

**Owner-ratified scope (decided 2026-05-02 in /next plan-mode AskUserQuestion):**

1. **5 voices** (V1-V5 above) — ratified during sprint composition; +1 over WS-010's named 4 (Market lens added).
2. **AP-06 lock at CI-grep tier** — companion `docs/projects/self-coach-foundation/copy-discipline.md` (CD-1..5 + forbidden-string regexes) authored alongside the audit; sibling `anti-patterns.md` (AP-SCF-NN catalog).
3. **CO-56 ↔ DS-58 reconciliation** — resolved in **Stage B** below (3-scenario walk; verdict: keep separate, different referents).
4. **Small-sample false-leak floor** — **n≥30 hand-count floor** for any hero-leak claim shown to user, mirrors villain-side `weaknessDetector.js` convention. Ratified in Stage C.

**Status:** DRAFT — owner ratification closes WS-010 and unblocks Gate 3 (Research).

**Artifacts read (pre-audit):**

- [`docs/design/audits/2026-05-02-entry-self-coach-foundation.md`](2026-05-02-entry-self-coach-foundation.md) (Gate 1 audit — source-of-truth)
- [`docs/design/ROUNDTABLES.md`](../ROUNDTABLES.md) (5-stage template)
- [`docs/design/audits/2026-04-24-blindspot-printable-refresher.md`](2026-04-24-blindspot-printable-refresher.md) (5-voice integrative pattern precedent)
- [`docs/design/audits/2026-04-24-blindspot-printable-refresher-rerun.md`](2026-04-24-blindspot-printable-refresher-rerun.md) (Gate 2 closure-status pattern)
- [`docs/design/personas/core/chris-live-player.md`](../personas/core/chris-live-player.md) — confirmed Skill-ladder positioning + Goals when self-coaching sections present (Gate 1 authored)
- [`docs/design/jtbd/domains/coaching.md`](../jtbd/domains/coaching.md) — confirmed Self-coach mode sub-section + CO-54..57 present (Gate 1 authored)
- [`docs/design/jtbd/domains/drills-and-study.md`](../jtbd/domains/drills-and-study.md) — DS-56 + DS-58 read for Stage B reconciliation walk
- [`docs/projects/printable-refresher/anti-patterns.md`](../../projects/printable-refresher/anti-patterns.md) (AP-PRF numbering + per-refusal field structure)
- [`docs/projects/printable-refresher/copy-discipline.md`](../../projects/printable-refresher/copy-discipline.md) (CD-1..5 + CI-lint section)
- [`src/utils/exploitEngine/weaknessDetector.js`](../../../src/utils/exploitEngine/weaknessDetector.js) (n-floor + Bayesian sample-size convention reference)

---

## Executive summary

**Verdict: YELLOW — proceed to Gate 3 with named scope.**

Five voices converge: SCF is structurally tractable but carries three named structural risks plus one resolved Gate-1-deferred reconciliation. None are RED at the doctrine layer; all are gradable in Gate 3.

1. **AP-06 graded-work-framing risk is endemic to coaching surfaces (V2 LEAD).** External coaching products (Upswing PokerLab, Run It Once Elite, GTO Wizard study modules, Crush Live Poker, BBZ) saturate users with grading vocabulary — "score / accuracy / your rating / how did you do." V2 + V5 converge: SCF cannot share that vocabulary. The CI-grep-enforced copy-discipline (`docs/projects/self-coach-foundation/copy-discipline.md` ratified this session) is the operative defense; AP-SCF-01..06 enumerated below as feature-level companions.
2. **Hero-leak detection requires ~20% net-new infra; SCF Gate 4 surface is gated on it (V4 + V1).** Per Gate 1 §Discovery 4, villain-side `weaknessDetector.js` is mature; hero-side has `assessHeroEV` per-action but no aggregate hero-pattern detector. The detector authoring is a Gate 4/5 deliverable, but its **schema shape** (situation-key bucketing + n≥30 floor + Bayesian credible interval per leak claim) is decided in Gate 3. V3 + V4 converge on persistence: the detector lives in `src/utils/exploitEngine/heroWeaknessDetector.js` (not `heroAnalysis/`) for code-locality; its output store is a NEW `heroLeaks` IDB store distinct from the existing villain-side stores.
3. **Cross-surface contamination risk binds every Gate 4 surface choice (V3 + V2).** Red line #8 (no cross-surface contamination) means hero-leak inference outputs MUST NOT render on OnlineView seats, sidebar HUD, or any live-decision surface. V3 specifies the segregation contract: hero-leak store reads ONLY from review-mode contexts (HandReplayView, PlayerAnalysisPanel review mode, dedicated SelfCoachView TBD); a sourceUtilPolicy whitelist mirrors the EAL/PRF F6 pattern.

**CO-56 ↔ DS-58 reconciliation (Stage B, owner-ratified scope):** **KEEP SEPARATE.** Three-scenario walk surfaced different referents (hero-leak-improvement vs anchor-claim-stability) despite shape similarity. Rationale in Stage B below.

**Top 3 Gate 3 deliverables:** (1) hero-leak detector schema spec including n≥30 floor + situation-key bucketing + credible-interval contract + sourceUtilPolicy whitelist, (2) per-tier teachable-concept map ratification (Gate 1 draft owner-amended via concrete-case walkthrough), (3) curriculum-spine format decision (DAG-only vs hybrid DAG+observed-leak-frequency per Gate 1 Q5).

**Gate 4 unblocks** with 7 named carry-forwards (enumerated at audit foot). No Gate 5 work scoped this session.

---

## Feature summary

Self-Coach Foundation introduces hero-side leak-to-lesson loop: detect hero leaks from review data, point at next teachable concept given current tier × per-domain mastery, validate prior coaching translated to play improvement, optionally elicit pre-decision confidence to convert prediction-vs-observed gaps into coaching signals. Gate 1 ratified the scope via owner AskUserQuestion: extend `chris-live-player` with overall-tier metadata (NO new persona); 6-tier ladder (novice / live-rec / studied-amateur / part-time-grinder / serious-grinder / pro); 4 JTBDs proposed (CO-54..57); CO-56 reconciliation pending; AP-06 lock pending. This Gate 2 closes both pendings.

---

## Stage A — Persona sufficiency

**Output: ✅ Match — `chris-live-player` extended with tier-awareness covers SCF without a new persona.**

### Findings (V1 Pedagogy lead, V5 Market lens annotation)

V1 + V5 converge: no new core persona required. The `chris-the-improver` reversal hypothesis (Gate 1 §Output 2) does NOT survive a pedagogy-lens stress test. Three lines of evidence:

1. **The "improver" stance is a posture of `chris-live-player`, not a different person.** Pedagogy-lens framing: a learner who plays poker AND a learner who studies poker are two contexts of the same learner, not two learners. The persona's Goals + Constraints sections already model the studied-amateur-to-grinder progression; SCF adds the *overall-tier* dimension on top of the existing per-domain Skill-state attribute.
2. **Situational coverage is complete.** `post-session-chris` (depth-over-speed) is the primary SCF host; `study-block` (30-60min off-table) hosts curriculum browsing; `between-hands-chris` (≤30s) hosts glanceable leak-ack only (NOT full review per AP-SCF-04 — see Stage E). All three are existing situational personas; no new authoring required.
3. **Market lens (V5) confirms.** External coaching products that DO author a separate "improver" persona (Run It Once Elite's "Active Student" archetype, BBZ's "Cash Climber") do so to drive funnel segmentation (sales) — NOT for design. Their UX still treats the user as one person across review/play/study. SCF has no funnel concern; the segmentation cost (persona explosion + cross-persona JTBD reconciliation) buys nothing.

### Cross-voice resolution

V2 (Autonomy) flagged a load-bearing constraint: extending the persona must NOT alter the existing 9-red-lines compliance. Verified — SCF Gate 1's `Skill-ladder positioning` + `Goals when self-coaching` sections cite the 9 red lines as binding, do not weaken any, and add no new red lines (SCF inherits the 9-red-line floor).

### Recommended follow-ups

- [ ] **Gate 3 (NON-BLOCKING):** if owner introspection during the per-tier teachable-concept map walk surfaces a goal that fits poorly into the extended `chris-live-player`, revisit `chris-the-improver` reversal at that point. Default: do not author.
- [ ] **Explicit Gate 3 non-goal:** no new core persona. No new situational persona (existing 3 cover the time-budget variants).
- [ ] **Gate 4 constraint:** the 9-red-line floor binds every SCF surface; surface specs cite the constraint inline (mirrors Gate 1 §Output 2 pattern).

---

## Stage B — JTBD coverage / CO-56 reconciliation

**Output: ⚠️ Patch needed — CO-56 ↔ DS-58 keep-separate decision ratified; CO-54/55/57 confirmed net-new; 1 small wording amendment to CO-56's success criterion.**

### Findings (V1 Pedagogy lead, V4 Engineering annotation)

**CO-56 ↔ DS-58 / DS-56 three-scenario reconciliation walk.** Owner-ratified scope (decision flag #3) calls for resolution in this stage. Walking the persona through 3 concrete scenarios:

| Scenario | User's mental question | DS-58 referent | CO-56 referent | Same? |
|----------|------------------------|----------------|----------------|-------|
| **S1 — leak fixed cleanly** ("I was overfolding to cbets in IP at 65%; drilled the concept for 2 sessions; latest 30 hands show fold-to-cbet IP at 48%") | "Did MY play change?" | Anchor: "population overfolds to cbets" — does the predicted population rate still hold? | Hero leak: "I was overfolding" — has my own rate shifted? | **No** — DS-58 audits a population claim; CO-56 audits a hero behavioral change. |
| **S2 — leak persists** ("Drilled the concept; 2 sessions later still folding to cbets at 62%") | "What's blocking the fix? Is the drill wrong? Am I not internalizing? Is my sample biased?" | DS-58 doesn't ask this — anchor calibration is upstream of "hero behavior didn't change." | CO-56 needs to surface persistence with non-graded framing per AP-SCF-01. | **No** — DS-58 silent here; CO-56 load-bearing. |
| **S3 — leak fixed-then-regressed** ("Was at 48% for 2 sessions, latest session back to 60%") | "Is this a real fix or session-variance? When does my CI cross the regression threshold?" | DS-58 has shape similarity (predicted-vs-observed over time, credible interval, drift detection) but its referent is the population claim, not the hero behavioral metric. | CO-56 wants the same statistical machinery (credible-interval-over-time, drift-arrow, regression-threshold) applied to a hero behavioral metric. | **Shape-similar, referent-distinct.** |

**V1 verdict (pedagogy):** the user's mental model in all three scenarios treats "did MY play change?" as a different question from "does this exploit anchor still hold?" — even when the same statistical machinery answers both. Collapsing them would force the user to re-frame their own internal question through the anchor-calibration lens, which V1 + V5 flag as a learning-friction tax.

**V4 verdict (engineering):** the **infrastructure** is reusable. The Bayesian credible-interval + sample-size + drift-arrow logic in `src/utils/persistence/anchorCalibrationStore.js` (Stream D) generalizes cleanly to a sibling `heroLeakCalibrationStore.js` with parameterized referent. Code reuse is high (~70% shared utility); JTBD separation is clean.

**Decision:** **KEEP SEPARATE.** CO-56 retains its CO-prefix; DS-58 unchanged.

**Wording amendment (small):** CO-56's success criterion in `coaching.md` is currently *"see whether my actual play has changed."* V1 recommends adding "*— with non-graded framing per AP-SCF-01*" to bind the autonomy constraint inline at the JTBD level (mirrors how DS-58 cites Gate 2 graded-work-trap concern). Gate 3 authors the amendment.

**CO-54, CO-55, CO-57 confirmation pass:**

- **CO-54 (see-leak-without-being-graded)** — net-new. No existing JTBD captures the explicit non-grading framing as a load-bearing constraint. AP-SCF-01 (graded-work-framing refusal) is the operative companion. ✅
- **CO-55 (learn-next-concept-im-ready-for)** — net-new but adjacent to DS-43/DS-46/DS-47 (drill-level scheduling). CO-55 is curriculum-level (concept progression) — upstream of DS-43/46/47. ✅
- **CO-57 (self-rate-confidence-on-a-line)** — net-new. No existing JTBD elicits pre-decision confidence as a coaching-signal generator. Distinct from MH-12 (consumer-side cited-assumption trust bridge). ✅

### Cross-voice resolution

V3 (Privacy) flagged a Gate-3 carry-forward: hero-leak calibration data is more privacy-sensitive than anchor-calibration data because it directly indexes user behavior, not population. Schema spec must enforce per-record incognito-toggle parity with the EAL Gate 4 precedent. V4 confirms the schema can carry the same incognito field as `anchorObservation`.

V5 (Market) noted that no external coaching product separates the two outcomes — they all collapse into either "your accuracy" (graded) or generic "progress." This separation is **a load-bearing differentiator** for the program's anti-AP-06 stance.

### Recommended follow-ups

- [ ] **Gate 3 (BLOCKING Gate 4):** ratify CO-56 wording amendment (success criterion gets AP-SCF-01 binding clause). Author CO-54/55/56/57 from `state: Proposed` to `state: Active` with success criteria + failure modes filled in.
- [ ] **Gate 4 constraint:** SelfCoachView surface MUST surface CO-56 metric (hero-leak rate over time + credible interval + drift arrow) using the SAME visual primitives as the Calibration Dashboard (DS-58) — SHARED component, parameterized referent. Cross-component reuse caught at Gate 4 spec review.

---

## Stage C — Situational stress test

**Output: ⚠️ Adjust — n≥30 hard floor ratified for hero-leak claims; surface-specific affordance constraints per situational persona.**

### Findings (V1 Pedagogy lead, V2 Autonomy annotation, V4 Engineering schema-rationale)

**n≥30 hand-count floor ratification (decision flag #4).** Owner-ratified n≥30. Math:

- Binomial 95% MoE at p=0.5 (worst case): `±1.96 × sqrt(0.25/n)`
- n=30 → ±18% MoE
- n=50 → ±14% MoE
- n=100 → ±10% MoE

V4 + V2 rationale for n=30 floor (NOT a higher threshold):

- n=30 is the **floor** below which NO hero-leak claim renders. It is NOT the threshold for "high confidence."
- Above n=30 the surface renders the claim WITH credible interval visible (`52% [38%, 66%] over 30 hands`) — never a point estimate alone. Mirrors villain-side `weaknessDetector.js` `confidence` field convention.
- Tightening to n=50 was considered (reduces MoE 18%→14%) but trades higher slow-time-to-first-claim against marginal MoE improvement. Owner can re-tighten in Gate 3 after corpus-walk; floor stays n=30 for Gate 4 v1.

**Below-floor behavior (binding):** when n<30 for a situation key, the surface renders **"Insufficient sample (need {30 - n} more hands)"** — NOT silence, NOT interpolation, NOT a "preliminary read." This is itself a copy-discipline rule (CD-2 / non-graded — the count is factual, not a judgment).

**Three-context situational walk:**

| Context | Persona | Time budget | SCF affordance permitted |
|---------|---------|-------------|--------------------------|
| Post-session review (primary host) | `post-session-chris` | 5-30 min, depth-over-speed | Full SelfCoachView access; full leak inventory; curriculum-spine browse; CO-57 confidence elicitation hosted here. |
| Off-table study block | `study-block` | 30-60 min, deliberate | Curriculum-spine browse + drill scheduling; leak inventory accessible read-only; tier metadata edits allowed (CO-55 host). |
| Between hands quick ack | `between-hands-chris` | ≤30s, glanceable only | LEAK INVENTORY READ-ONLY; **no claim text rendered until n≥30**; counter card showing "X leaks tracked, last updated {timestamp}" allowed. **No interactive curriculum browse, no claim verbalization, no CO-57 elicitation.** Hard surface segregation per AP-SCF-04 (small-sample claim) + red line #8 (no cross-surface contamination — between-hands is adjacent to live, the brief read-only surface MUST NOT contaminate decision focus). |

**Mid-hand exclusion (binding):** `mid-hand-chris` MUST NOT host any SCF affordance. Live surfaces (OnlineView seats, sidebar HUD, table-build chrome) MUST NOT render hero-leak annotations of any kind. Red line #8 is non-negotiable. AP-SCF-02 is the feature-level enforcement.

### Cross-voice resolution

V5 (Market) flagged that external products (GTO Wizard, BBZ) DO surface live-mid-hand "leaks" via bot/HUD overlays — and DO get player complaints about "the bot judging me mid-decision." This is the exact failure mode red line #8 prevents; SCF refuses by structural segregation.

### Recommended follow-ups

- [ ] **Gate 3 (BLOCKING):** specify hero-leak detector situation-key bucketing (mirrors villain-side `decisionAccumulator.js` 7-dim keys) and credible-interval method (Beta-Binomial vs Wilson — recommend Beta-Binomial for parity with anchor calibration).
- [ ] **Gate 4 surface spec carry-forward:** SelfCoachView (post-session host) + a dedicated read-only "Hero Leaks (≥30 hands)" panel for `between-hands-chris` exposure (panel embeds in HandReplayView's existing review chrome, NOT in a live surface).
- [ ] **Gate 4 binding constraint:** SourceUtilPolicy whitelist for hero-leak read paths (mirrors EAL F6 precedent; whitelist documented at `docs/projects/self-coach-foundation/source-util-policy.md` at Gate 4 — this audit names the constraint, doesn't author the file).

---

## Stage D — Cross-product / cross-surface

**Output: ⚠️ Cross-surface coordination needed — drill scheduler + refresher + tier persistence + sourceUtilPolicy whitelist + 9-red-line per-surface check.**

### Findings (V3 Privacy lead, V4 Engineering schema lead)

**1. Drill scheduler integration (V4 lead).** `src/utils/drillContent/scheduler.js` weights drills by accuracy. SCF adds: tier metadata + per-domain mastery as scheduler inputs. **V4 recommendation:** scheduler reads BOTH tier and per-domain mastery; tier picks which **concept-area** is teachable next; per-domain mastery picks which **drill within that concept-area** runs. Two-level decision; no schema break to existing scheduler. Carry-forward to Gate 4.

**2. Refresher (PrintableRefresherView) tier-tagging (V4 + V5).** Refresher cards already have `cardClass` (preflop / math / postflop / exceptions). V4 recommends adding `tierFloor` (`novice / live-rec / studied-amateur / part-time-grinder / serious-grinder / pro`) as an OPTIONAL filter — NOT a gate (red line #6 flat access). User at `live-rec` tier can still print `pro`-floor cards if they elect to; default filter respects tier; opt-in to-show-all is available. V5 confirms no market product ships tier-aware refresher; this is a program differentiator.

**3. Tier persistence location (V3 + V4).** Three options from Gate 1 §Q8: (a) player schema, (b) user-settings, (c) new `userProfile` store. V3 + V4 converge on **(b) user-settings**, mirrors Gate 1 recommendation. Rationale: tier is preference-shaped (owner-set; non-derived); player schema is for tracked others; new store is over-engineering. Carry-forward to Gate 4 schema spec.

**4. Hero-leak data lifecycle (V3 lead).** Per-record incognito toggle parity with `anchorObservation`. Whole-store opt-out via Settings (red line #1 enrollment). Retention: indefinite (mirrors villain-side; user can purge via Settings). Read paths: WHITELIST = `HandReplayView`, `PlayerAnalysisPanel` review mode, `SelfCoachView` (TBD Gate 4). BLACKLIST = `OnlineView`, sidebar HUD, `TableView` chrome, `TournamentView`, all live surfaces. Enforced via sourceUtilPolicy CI check at Gate 4.

**5. 9-red-lines per-surface pre-check (V2 cross-stage):** all 9 red lines walked against every proposed SCF surface concept (SelfCoachView, leak panel embed in HandReplayView, refresher tier-tag filter, settings tier-set radio):

| Red line | SelfCoachView | Leak panel embed | Refresher tier-filter | Settings tier-radio |
|----------|---------------|------------------|------------------------|---------------------|
| #1 Opt-in enrollment | ✅ Settings toggle | ✅ same toggle gates render | ✅ tier defaults to `null` until user sets | ✅ explicit set, no inference |
| #2 Full transparency | ✅ surface shows source-util + sample-size + CI | ✅ inline | ✅ card-source visible (already shipped) | ✅ tier definitions linked |
| #3 Durable overrides | ✅ user-set tier persists; algo never re-overrides | ✅ leak-acks persist | N/A | ✅ |
| #4 Reversibility | ✅ Settings purge | ✅ inherits | ✅ inherits | ✅ |
| #5 No streaks/shame | ✅ no progress bars, no XP, no streaks (CD-3) | ✅ count card factual ("X leaks tracked"), no judgment | ✅ no completion %, no "cards mastered" | ✅ no "level-up" framing |
| #6 Flat access | ✅ tier sequences, never gates | ✅ all hands available read-only | ✅ tier filters, opt-in to-show-all available | N/A |
| #7 Editor's-note tone | ✅ CD-1 binding | ✅ CD-1 binding | ✅ CD-1 already shipped | ✅ |
| #8 No cross-surface contamination | ✅ store reads from review-mode only | ✅ review-mode-only | ✅ already segregated | ✅ |
| #9 Capture incognito | ✅ per-record toggle | ✅ inherits | N/A | ✅ |

**No surface fails the 9-red-line pre-check.** Cross-walk verdict: ✅.

### Cross-voice resolution

V2 (Autonomy) raised a load-bearing concern: red line #6 + tier-aware refresher could quietly become a tier-GATE if "default filter respects tier" creeps to "default filter HIDES out-of-tier cards." V3 + V4 endorsed the constraint: the filter MUST be **opt-out-to-show-all-tiers**, with the show-all toggle visible at the same nav level as the filter — never one tap deeper.

V5 (Market) noted no external coaching product respects flat-access on study materials; gating-by-level is the market norm. SCF's flat-access stance is a program differentiator inherited from red line #6.

### Recommended follow-ups

- [ ] **Gate 3:** schema spec for `heroLeaks` IDB store + tier metadata location in user-settings store + scheduler tier-input contract.
- [ ] **Gate 4 (BLOCKING Gate 5):** `docs/projects/self-coach-foundation/source-util-policy.md` enumerating whitelist/blacklist read paths with CI-grep enforcement spec (mirrors EAL F6 precedent).
- [ ] **Gate 4:** refresher card schema gains optional `tierFloor` field; default filter behavior + opt-out-to-show-all toggle ratified at surface review.
- [ ] **Gate 4:** drill scheduler tier-input integration spec (does NOT ship in scheduler.js this session; specced for Gate 5).

---

## Stage E — Heuristic pre-check + AP-06 lock

**Output: ⚠️ Adjust — AP-06 lock at CI-grep tier authored alongside this audit (`docs/projects/self-coach-foundation/copy-discipline.md` + `anti-patterns.md` ratified); per-tier teachable-concept map vocabulary check passes; 9-red-line walk passes; ML06 + PLT heuristic adjustments enumerated.**

### Findings (V2 Autonomy lead, V4 Engineering ML06/PLT lens, V5 Market AP-06 reference)

**AP-06 lock at CI-grep tier (decision flag #2).** Two companion files authored alongside this audit (ratified by owner /next decision):

1. **`docs/projects/self-coach-foundation/anti-patterns.md`** — AP-SCF-01..06 catalog with full per-refusal fields (Refused / Why / Red-line / Allowed-alternative). Mirrors PRF AP-PRF structure. EAL-inherited AP-01..09 listed transitively.
2. **`docs/projects/self-coach-foundation/copy-discipline.md`** — CD-1..5 rules + CI-lint forbidden-string regex section. Mirrors PRF CD-1..5 structure with SCF-specific examples and regexes.

**Anchor refusals (full per-refusal fields in companion `anti-patterns.md`):**

- **AP-SCF-01 — Graded-work-framing on hero leak surfaces.** Refused: no scoring / accuracy / "how did you do" / "your rating" copy on any SCF surface. Allowed: factual count + credible interval + non-judgmental framing ("observed", "tracked", "noted"). Red line #5 + #7. Inherits AP-06 from EAL.
- **AP-SCF-02 — Cross-surface contamination of hero-leak data into live surfaces.** Refused: hero-leak inference outputs MUST NOT render on OnlineView seats, sidebar HUD, TableView chrome, TournamentView, or any live-decision surface. Allowed: review-mode-only render contexts (HandReplayView, PlayerAnalysisPanel review, SelfCoachView). Red line #8. SourceUtilPolicy whitelist enforces.
- **AP-SCF-03 — Silent tier inference without explicit owner confirmation.** Refused: system-inferred tier value MAY suggest, MUST NOT silently set. Allowed: inference shown alongside owner-set value with "confirm or amend" affordance. Red line #1.
- **AP-SCF-04 — Small-sample leak claim under n=30.** Refused: hero-leak claim text rendered when n<30 for the situation-key. Allowed: factual "Insufficient sample (need {30 - n} more hands)" placeholder. Red line #2 (transparency: visible sample-size). Operationalizes Stage C floor decision.
- **AP-SCF-05 — Mastery score on curriculum progress.** Refused: scalar "X% mastered" / "X of Y concepts complete" / progress bars on curriculum-spine browse. Allowed: factual concept-list with binary "drilled" / "not yet drilled" + last-drilled-at timestamp. Red line #5 + #14 (mastery-score refusal precedent from EAL/PRF). Mirrors AP-PRF-04.
- **AP-SCF-06 — Streak / engagement-pressure on study cadence.** Refused: "study streak: X days" / "you haven't studied in N days, jump back in!" / push notifications on cadence drift. Allowed: passive last-session timestamp + opt-in calendar reminder set by owner. Red line #5.

**EAL-inherited transitively (cited but not re-authored):** AP-01..09 from `docs/projects/exploit-anchor-library/anti-patterns.md`. SCF features that surface via shared components (Calibration Dashboard reuse for CO-56) inherit the parent project's anti-patterns.

**Heuristic walk:**

- **Nielsen N03 (undo).** SCF tier-set, leak-ack, lesson-assignment all reversible (Settings purge + per-record undo affordance). ✅
- **Nielsen N05 (error prevention).** Tier-set radio uses confirm-on-change for tier downgrades (rare; preserves user autonomy + prevents fat-finger). ⚠️ Adjust: confirm-on-change spec for Gate 4.
- **Mobile-Landscape ML04 (scale interaction).** SelfCoachView at 1600×720 reference viewport — surface spec at Gate 4 must respect the scale math.
- **Mobile-Landscape ML06 (touch target ≥44).** Tier-set radio buttons + leak-ack tap targets sized at Gate 4. ⚠️ Adjust: ML06 binding constraint per surface spec.
- **Poker-Live-Table PLT (glanceability, state-aware primary).** SCF is NOT a live-decision surface; PLT heuristics weaker. The `between-hands-chris` exposure (Stage C constraint) DOES carry PLT01 glanceability — leak-count card must be ≤1.5s scan. ⚠️ Adjust: leak-count card surface spec at Gate 4 must satisfy PLT01.
- **9 autonomy red lines.** Walked in Stage D table; all surfaces pass. ✅

**Per-tier teachable-concept map vocabulary check (Gate 1 §Q1).** The 6-tier ladder vocabulary (`novice / live-rec / studied-amateur / part-time-grinder / serious-grinder / pro`) walked against owner introspection: do these tier names match the owner's mental model of poker-player skill stratification? Pre-vote in this audit: **provisionally yes, owner amends in Gate 3 walkthrough.** No tier-rename refusal flagged at this layer.

### Cross-voice resolution

V5 (Market) noted external coaching products use grade-laden vocabulary (Upswing's "Course Progress: 67%", BBZ's "Coach Score", GTO Wizard's "Session Accuracy: 72%"). SCF's CI-grep-enforced refusal of all 4 patterns (`progress`, `score`, `accuracy` adjacent to user metrics, `% mastered`) is the operative defense. The forbidden-string regexes in `copy-discipline.md` §CI-lint catch all four.

V2 confirmed: AP-06's load-bearing trap is that it's tone-shaped, not feature-shaped. A surface can ship AP-SCF-05 cleanly (no progress bar) and still violate the spirit by titling the surface "Your Coaching Score" — CD-1..5 + CI-grep regexes are the language-layer defense that catches what AP-SCF cannot.

### Recommended follow-ups

- [ ] **Gate 4 (BLOCKING Gate 5):** every Gate 4 surface spec for SCF cites both AP-SCF-NN and CD-1..5 inline; Gate 5 PR review walks both files.
- [ ] **Gate 4 ML06 binding:** SelfCoachView + leak panel embed touch-targets ≥44 DOM-px at 1600×720 reference scale.
- [ ] **Gate 4 N05 confirm-on-change:** tier downgrade in Settings requires explicit confirm modal.
- [ ] **Gate 4 PLT01 binding:** between-hands leak-count card ≤1.5s glanceable.

---

## Overall verdict

**YELLOW.** Three structural risks (AP-06 endemic, hero-leak detector ~80% net-new, cross-surface contamination binding) are tractable in Gate 3/4. CO-56 ↔ DS-58 reconciliation closed (KEEP SEPARATE). AP-06 lock closed at CI-grep tier with companion files ratified.

**Per-stage verdict table:**

| Stage | Voice lead(s) | Verdict | Closure |
|-------|--------------|---------|---------|
| A — Persona sufficiency | V1 + V5 | ✅ Match | `chris-the-improver` reversal hypothesis rejected; existing extension covers SCF |
| B — JTBD coverage / CO-56 reconciliation | V1 + V4 | ⚠️ Patch | KEEP SEPARATE; CO-56 wording amendment for Gate 3; CO-54/55/57 confirmed net-new |
| C — Situational stress + n-floor | V1 + V2 + V4 | ⚠️ Adjust | n≥30 floor ratified; per-context affordance constraints; AP-SCF-04 binding |
| D — Cross-product / cross-surface | V3 + V4 | ⚠️ Coordinate | Tier persistence in user-settings; sourceUtilPolicy whitelist; 9-red-line walk passes |
| E — Heuristic + AP-06 lock | V2 + V4 + V5 | ⚠️ Adjust | CI-grep lock ratified via companion files; AP-SCF-01..06 enumerated; ML06 + N05 + PLT01 carry-forwards |

Gate 3 (Research) is unblocked. Gate 4 (Design) blocked on Gate 3 schema spec deliverables.

---

## Gate 3 carry-forwards (BLOCKING Gate 4)

| ID | Deliverable | Notes |
|---|-------------|-------|
| **SCF-G3-DETECTOR** | Hero-leak detector schema spec (situation-key bucketing, n≥30 floor, Beta-Binomial credible interval, sourceUtilPolicy whitelist) | Mirrors `weaknessDetector.js` structure with hero-side referent |
| **SCF-G3-TIERMAP** | Per-tier teachable-concept map ratification (Gate 1 draft owner-amended via concrete-case walkthrough) | Owner introspection on tier-transition concept clusters |
| **SCF-G3-SPINE** | Curriculum-spine format (DAG-only vs hybrid DAG+observed-leak-frequency per Gate 1 Q5) | Recommend hybrid; defer to Gate 3 walkthrough |
| **SCF-G3-CO** | Authors CO-54..57 from `state: Proposed` → `state: Active` with success criteria + failure modes | CO-56 wording amendment per Stage B |
| **SCF-G3-SCHEMA** | IDB v21+ migration spec for `heroLeaks` store + `userSettings.tier` field | Inherits dynamic-max version pattern from EAL Gate 4 P3 §2 |

---

## Gate 4 carry-forwards (named at this audit; ratified at Gate 3)

| ID | Deliverable | Blocks |
|---|-------------|--------|
| **SCF-G4-S1** | `docs/design/surfaces/self-coach-view.md` — SelfCoachView surface (post-session host) | All other Gate 4 items |
| **SCF-G4-S2** | Leak-panel embed in HandReplayView ReviewPanel + between-hands read-only leak-count card | — |
| **SCF-G4-SUP** | `docs/projects/self-coach-foundation/source-util-policy.md` — whitelist/blacklist with CI-grep enforcement spec | Gate 5 implementation |
| **SCF-G4-REF** | Refresher card schema `tierFloor` field + opt-out-to-show-all filter behavior | — |
| **SCF-G4-SCH** | Drill scheduler tier-input integration spec | — |
| **SCF-G4-TIER** | Settings tier-set radio + N05 confirm-on-change for tier downgrades | — |
| **SCF-G4-MIG** | IDB migration script per SCF-G3-SCHEMA | Gate 5 implementation |

No Gate 5 items scoped this session.

---

## Open questions (deferred to Gate 3 walkthrough)

Inherited from Gate 1 §Open questions, narrowed by this Gate 2:

- **Q1 (per-tier teachable-concept map ratification)** — Gate 3 walkthrough.
- **Q3 (CO-57 ship timing — Gate 4 v1 vs v2)** — recommend Gate 4 v1 ships CO-54/55/56; CO-57 deferred to v2 once leak-detection + curriculum-spine are stable. Owner ratifies in Gate 3.
- **Q4 (SCF surface location)** — recommend dedicated SelfCoachView per Gate 1 (carry-forward SCF-G4-S1).
- **Q5 (curriculum-spine format)** — Gate 3 SCF-G3-SPINE.
- **Q6 (tier inference vs explicit set)** — explicit set in v1 (AP-SCF-03 binds); inference-with-confirmation as v2.
- **Q8 (tier persistence location)** — user-settings (Stage D verdict).

Closed by this audit:
- **Q2 (CO-54..57 vs new domain)** — extension of `coaching.md` (Gate 1 ratified).
- **Q7 (DS-58 / CO-56 reconciliation pre-vote)** — KEEP SEPARATE (Stage B).

---

## Change log

- 2026-05-02 — Created. Gate 2 Blind-Spot Roundtable for Self-Coach Foundation per Master Plan §D Phase 2 stagger continuation. 5 voices integrative pattern (V1 Pedagogy / V2 Autonomy-Failure / V3 Privacy / V4 Engineering / V5 Market). Verdict YELLOW. CO-56 ↔ DS-58 reconciliation closed (KEEP SEPARATE). AP-06 lock at CI-grep tier ratified via companion `docs/projects/self-coach-foundation/copy-discipline.md` + `anti-patterns.md`. n≥30 hand-count floor ratified for hero-leak claims. 5 Gate 3 carry-forwards + 7 Gate 4 carry-forwards enumerated. Audit-only: zero production code changes. WS-005 (PIO-G2 Blind-Spot Roundtable) is the next natural anchor in the Master Plan A/D Phase 2 stagger alternation.
