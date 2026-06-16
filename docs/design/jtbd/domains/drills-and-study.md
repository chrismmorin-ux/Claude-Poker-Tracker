# JTBD Domain — Drills and Study

Jobs around learning and concept mastery, typically off-table.

**Primary personas:** [Scholar](../../personas/core/scholar-drills-only.md), [Apprentice](../../personas/core/apprentice-student.md), [Rounder](../../personas/core/rounder.md) (occasional), any off-table session.

**Surfaces:** `PreflopDrillsView`, `PostflopDrillsView`.

---

## DS-43 — 10-minute quick drill on today's weak concept

> When I have 10 minutes, I want a quick drill targeted at today's weakness or concept, so study is efficient.

- Partial: Explorer + Line Study ship; routing to weakness-targeted drills is DISC-12 (skill map).

## DS-44 — Correct-answer reasoning (not just score)

> When I miss a drill, I want to see *why* the correct answer is correct, so I learn.

- Active (baseline); depth varies by drill mode.

## DS-45 — Custom drill from own hand history

> When I want to study a specific spot I actually faced, I want a drill built from my own history, so practice is relevant.

- State: **Committed — staged** (founder ratified 2026-06-15, WS-230 Gate 3; was DISC-13 / Proposed). The WS-229 roundtable flagged the analysis→drill gap ("the app knows my leaks; the drills can't reach them") as the single most valuable missing element (D-1). Founder chose to serve it, staged.
- **Sequencing:** depends on **WS-198** (hands ↔ upper-surface-node-ID cross-reference — the data plumbing). The leak→drill **bridge** (analysis-view / hand-replay → targeted drill) is **WS-233**, blocked on WS-198. Not built yet; on the roadmap as the priority drill investment.
- **Cross-tab continuity** (audit B-4 — "a Math drill finding a leak doesn't seed a Range Explorer hand") is **folded into this bridge + leak-targeted nav**, not a separate JTBD. The "improve navigation" half of the WS-230 tab-structure decision (keep the by-street split, invest in nav) is served by DS-43 + DS-45 — a "what should I drill today?" entry that routes from the user's actual leaks.

## DS-46 — Spaced repetition for key charts

> When mastering preflop charts, I want spaced repetition on cards / scenarios I've missed, so retention is real.

- State: **Proposed**.

## DS-47 — Skill map / mastery grid

> When progressing, I want a skill grid showing concept mastery (preflop by position × postflop by texture × ICM × etc.), so I know what to practice.

- State: **Proposed** (DISC-12).

## DS-48 — Understand villain's range composition as the decision driver

> When studying a specific decision, I want to see villain's range decomposed by hand-type groups with per-group weight and my equity vs each, so my decision reasoning is range-vs-range not hand-vs-hand.

- State: **Active** (2026-04-22) — served by `bucket-ev-panel-v2` P1 primitive post-Path-2 restructure.
- Doctrine: first-principles decision modeling (`POKER_THEORY.md §7`, `feedback_first_principles_decisions.md`).
- Measures of success: student can name the largest group in villain's range on any studied decision; student's hypothesized correct action agrees with the weighted-total EV on ≥80% of drills after concept internalization.

## DS-49 — See weighted-total EV decomposition for a decision

> When studying a specific decision, I want to see the arithmetic — `Σ(villain-bucket weight × my EV vs bucket) = total EV per action` — so the correct answer is traceable, not asserted.

- State: **Active** (2026-04-22) — served by `bucket-ev-panel-v2` P2 primitive (`WeightedTotalTable`).
- Distinct from DS-44 ("correct-answer reasoning"), which is neutral on hero-first vs range-first framing; DS-49 specifically requires the arithmetic be visible as terms, not just as a final EV number.
- Measures of success: student can identify which villain group contributes the largest EV term for the correct action; student can explain why the same hand action shifts EV between archetypes when shown the table.

## DS-50 — Walk a hand line branch-by-branch with consequences shown

> When studying a multi-street scenario, I want to walk the decision tree node-by-node and see every branch's rationale, so I learn the whole-hand pattern, not just isolated spots.

- State: **Active** — served by Line Study (`LineWalkthrough` + `LineNodeRenderer` + `LineBranchBreadcrumb`), shipped 2026-04-20.
- Promoted from implicit on 2026-04-22 (previously listed only in `postflop-drills.md` as "line-study JTBD, implicit"). Atlas-explicit now.

## DS-51 — Understand villain's range shape on any flop before deciding

> When studying a board texture, I want the full breakdown of villain's range vs the flop (made hands / draws / whiff), so I internalize the range shape, not just individual hand equities.

- State: **Active** — served by Explorer mode (`RangeFlopBreakdown` + `ContextPicker` + `BoardPicker`) + Line Study's per-node decomposition.
- Promoted from implicit on 2026-04-22 (previously listed only in `postflop-drills.md` as "range-shape recognition, implicit"). Atlas-explicit now.
- Distinct from DS-48: DS-51 is hero-range-agnostic ("what does villain's range look like here?"); DS-48 is hero-anchored ("given my hand, what does villain have that I need to beat?").

## DS-52 — Retention maintenance (don't let mastery decay silently)

> When I have declared or demonstrated mastery on a descriptor / concept, I want the system to gently surface retention opportunities as decay accumulates, so I don't develop false confidence in skills that have rusted.

- State: **Active** (pending Poker Shape Language Gate 4).
- **Autonomy constraint:** no push notifications, no streaks, no shame. Retention surfacing is a passive in-app affordance — "last validated N weeks ago" with a recalibrate action — triggered on read, never on timer.
- **Decay profile:** procedural-memory literature supports a gentler decay curve than FSRS defaults (pattern-recognition skills decay closer to bike-riding than to vocabulary). Monthly check-in is the baseline, not 7/21/60-day FSRS spacing.
- **Served by:** proposed decay-aware transparency screen + welcome-back surface (returning-after-break situational persona).
- Doctrine basis: `feedback_skill_assessment_core_competency.md` (memory); `docs/projects/poker-shape-language/gate3-decision-memo.md` §Q3.
- Distinct from DS-46 (spaced repetition for charts, Proposed): DS-46 is declarative-memory-targeted (preflop chart memorization); DS-52 is procedural-memory-targeted (pattern recognition / concept application) and applies across all adaptive-learning surfaces.

## DS-53 — Edge-case probe (defend against mastery illusion)

> When I reach stable fluency on the median case of a concept, I want the system to occasionally surface unusual / edge cases, so I don't develop false mastery from only practicing the obvious.

- State: **Active** (pending Poker Shape Language Gate 4).
- **Autonomy constraint:** edge-case probes are offered, not forced. User can dismiss any probe; dismissal is a legitimate signal, not evasion to be re-inferred against.
- **Mechanism:** the seeder weights "corner cases of a mastered descriptor" higher in Discover-mode rotation once a descriptor reaches Reliable or Mastered.
- **Served by:** Discover-mode recommender (proposed in Stream D of Poker Shape Language).
- Anti-pattern defended: filter-bubble / mastery-illusion from over-personalization. Documented failure mode in BKT + adaptive-learning literature; see `docs/projects/poker-shape-language/gate2-voices/02-market-lens.md`.

## DS-54 — Exploration override (choose a different concept without losing progress)

> When the system recommends a concept I don't want to study right now, I want to explicitly pick a different one — without being treated as "avoiding weakness."

- State: **Active** (pending Poker Shape Language Gate 4) — **non-negotiable** per Gate 2 autonomy red line #3.
- **Mechanism:** every Discover-mode recommendation carries a "pick something else" affordance. User's picked alternative is a first-class signal equal in standing to accepting the recommendation; the "dismissed" concept is NOT re-scored as "avoided."
- **Disambiguation at skip time:** one-tap resolves "already know" (mute flag, suppresses future recs) vs "not today" (session-scoped, no write). Matches Q2 hybrid enrollment pattern.
- **Served by:** Discover-mode surface + the "don't show me again" queue (owner's proposal 2026-04-23, accepted).
- Structural defense of autonomy: without DS-54, adaptive seeding is paternalistic by construction.

## DS-55 — Resumption after break (reassess, don't resume)

> When I return to the app after ≥28 days away, I want a one-time welcome surface that acknowledges likely decay on descriptors I haven't touched and offers fast recalibration — without resetting my progress or shaming the gap.

- State: **Active** (pending Poker Shape Language Gate 4).
- **Autonomy constraint:** welcome-back surface is one-time per gap event, dismissable, equal visual weight on "recalibrate" and "skip." No notifications ever.
- **Mechanism:** on first Deliberate / Discover entry after `now - lastValidatedAt >= 28 days` on any descriptor, surface fires. Dismissal is session-durable + persists past session for the same gap event.
- **Served by:** welcome-back surface + decay-aware transparency screen.
- **Persona:** [returning-after-break](../../personas/situational/returning-after-break.md) (situational).

## DS-56 — Calibration check (blind probe after self-reported fluency)

> When I have declared "I know this" on a concept, I want the option (not obligation) to run a blind probe later that checks whether my self-assessment matches current performance, so I can catch Dunning-Kruger gaps in my own self-model.

- State: **Proposed** — partially subsumed by DS-53 (edge-case probe) at the seeder level; listed separately because the **user-facing framing** differs ("check my self-assessment" is a distinct JTBD from "show me unusual cases"). Revisit after Gate 4 research on whether these deserve distinct surfaces or collapse into one probe mechanism.
- **Autonomy constraint:** user-initiated only. The system does NOT autonomously run calibration probes as a gotcha; the probe is offered in the transparency screen as an explicit affordance.
- **Decision memo note:** DS-56 was flagged in Q4 analysis as optional — the transparency screen showing user-declaration and drill-data independently (Q4 verdict) already exposes self-calibration misalignment. DS-56 is the user's escape hatch when they want to stress-test their own claim.

## DS-57 — Capture-the-insight (flag a pattern without losing focus)

> When I notice a pattern at the table or during review — a villain tell, a recurring spot, a deviation I want to remember — I want to flag it in one tap and return to what I was doing, so the insight isn't lost before I can revisit it off-table.

- State: **Active** (pending Exploit Anchor Library Gate 4).
- **Autonomy constraint:** capture is note-taking, never self-evaluation. Button copy is "Tag pattern" / "Note this hand" — never "How did this hand go?" or "Rate your play." Private-by-default; captured observations contribute to the calibration loop only if the user has opted into enrollment (Q1 verdict: global toggle). Per-observation incognito toggle is always available (autonomy red line #9).
- **Mechanism:** Tier 0 `anchorObservation` record. HandReplayView gains Section G in `ReviewPanel.jsx` with a one-tap "Tag this hand" affordance; modal supports fixed-enum tags (hybrid vocabulary per schema §AnchorObservation) + optional free-text + optional street/action anchor. Modal auto-dismisses on game-state change with draft preserved to IDB (`between-hands-chris` ≤10s budget constraint). `post-session-chris` is the generous-budget capture host.
- **Served by:** HandReplayView Tier 0 capture (Stream D) + `anchorObservations` IDB store (v18) + `mid-hand-chris` explicit exclusion (no capture affordance on live surfaces — capture lives in review / between-hands contexts only).
- **Standalone value:** even if no observation ever promotes to a candidate anchor (Phase 2 Tier 1), capture closes the notebook-app / memory-loss failure mode. The capture affordance is the highest-priority single JTBD for Exploit Anchor Library.
- Distinct from **DS-44** (correct-answer reasoning): DS-44 is system-generated post-drill feedback; DS-57 is user-originated observation of a pattern the system did not surface. Distinct from **HE-17** (flag hand for post-session review mid-recording): HE-17 is hand-level ("come back to this"); DS-57 is observation-level ("this specific pattern in this hand").
- Doctrine basis: `feedback_skill_assessment_core_competency.md`; `docs/projects/exploit-anchor-library/gate3-owner-interview.md` Q1 (global enrollment) + Q2 (opt-out incognito default); Gate 2 audit §Stage E red line #9.

## DS-58 — Validate-confidence-matches-experience (observed-vs-predicted transparency)

> When the system tells me "villain X overfolds to river overbets on scare-complete boards," I want to see whether my actual observations confirm or contradict that predicted rate — so I can trust the advice (or withdraw trust) on evidence, not authority.

- State: **Active** (pending Exploit Anchor Library Gate 4).
- **Autonomy constraint:** framing is **model-accuracy**, never **observation-accuracy**. The dashboard evaluates the system's prediction against observed data; it does NOT evaluate the user's observations against the system's prediction. Copy discipline: "Model's predicted rate" ✓ / "Your observation accuracy" ✗. Transparency screen is always accessible (red line #2); Q3 verdict selected **long-press activation** over default-visible to reduce cognitive density on the Library view while keeping the data one tap away.
- **Mechanism:** per-anchor Calibration Dashboard view shows observed rate / predicted rate (`referenceRate`) / credible interval / evidence list / sparkline of firings over time / trend arrow / retirement state. Global view shows library health — which anchors drifting, which primitives at risk. No scalar "calibration score" (anti-pattern refused per Gate 2 Stage E).
- **Served by:** `CalibrationDashboardView` (Stream D) + Tier 2 `anchorCalibrationMetrics` per-anchor × per-style × per-street + perception-primitive validity posterior (Stream E).
- **Served persona:** `post-session-chris` primary; `presession-preparer` gets a filter view **without drift/trend data** (Gate 2 Stage C decision — drift visibility pre-session introduces decision-hesitation).
- Distinct from **DS-49** (weighted-total EV decomposition): DS-49 is pre-decision arithmetic traceability (per-bucket EV terms); DS-58 is post-hoc population-level model audit (does the anchor's claim hold?). Distinct from **MH-12** (live-cited assumption trust bridge): MH-12 is in-moment "why should I trust this claim?"; DS-58 is cumulative "does this claim still hold over many firings?"
- Doctrine basis: `docs/projects/exploit-deviation/calibration.md` (inherited two-tier framework); Gate 2 audit §Stage E graded-work-trap concern.

## DS-59 — Retire-advice-that-stopped-working (lifecycle override)

> When an exploit's edge has closed — observed rate has converged to the GTO baseline — I want the system to proactively flag the anchor for retirement; and when I've decided I no longer trust or want to use an exploit, I want to retire it durably, without the system second-guessing my decision.

- State: **Active** (pending Exploit Anchor Library Gate 4).
- **Autonomy constraint:** retirement is **durable** — no algorithmic rebuttal, no "retired anchors you might reconsider" nudges (anti-pattern refused). Three-way override vocabulary: **retire** (archive with status `retired`), **suppress** (hide from live surface but keep in library), **reset** (drop accumulated observations and restart Tier 2 calibration from priors). User can always reverse any of these from the Anchor Library flat-access view (red line #6). Retirement state-change takes effect at session-close by default, with "retire now" option — **no mid-session surprise state transitions** (Nielsen H-N05 error prevention).
- **Mechanism (system-initiated):** Tier 3 auto-retirement. Retirement condition: observed-rate credible interval overlaps GTO baseline (`retirementCondition.method: ci-overlap`). Status transitions `active → expiring → retired`. Override-aware: if user set durable override before auto-retirement fires, auto-transition respects the override.
- **Mechanism (user-initiated):** per-anchor action on Calibration Dashboard OR Anchor Library card. Retire action is explicit (two-tap with confirmation), undo via durable entry in retirement journey log.
- **Served by:** retirement evaluator (Stream E, runs per session-close) + Calibration Dashboard override surface (Stream D) + `journeys/anchor-retirement.md` (Gate 4).
- Distinct from **DS-54** (exploration override): DS-54 is in-the-moment "pick a different concept to study right now"; DS-59 is lifecycle-level "this advice has stopped working, retire it from the active library." Distinct from **MH-13** (dismiss/downrank a live-cited assumption silent override): MH-13 is single-cite-in-one-hand override; DS-59 is anchor-level persistent retirement.
- Doctrine basis: `docs/projects/exploit-anchor-library/schema-delta.md` §retirementCondition; Gate 2 audit §Stage E red line #3 (durable overrides) + #5 (no re-authoring nudges).

## DS-60 — Carry-the-reference-offline (physical laminated study artifact)

> When I'm at a live-poker venue in an off-hand window — stepped away from the table, waiting for a seat, on a tournament break, or otherwise not in an active hand — I want a physical laminated artifact carrying the highest-leverage decision scaffolds, so I can reinforce preparation and review without reaching for the phone and without violating house rules.

- State: **Active** (pending Printable Refresher Gate 4).
- **Primary situation:** [stepped-away-from-hand](../../personas/situational/stepped-away-from-hand.md) — four canonical contexts: stepped-away between hands, seat-waiting queue, tournament scheduled break, pre-session at venue.
- **Primary personas:** [Chris](../../personas/core/chris-live-player.md), [Rounder](../../personas/core/rounder.md), [Circuit Grinder](../../personas/core/circuit-grinder.md) (tournament breaks), [Hybrid Semi-Pro](../../personas/core/hybrid-semi-pro.md). Secondary: [Apprentice](../../personas/core/apprentice-student.md) (coach-curated pack), [Scholar](../../personas/core/scholar-drills-only.md) (study-from-home variant).
- **Autonomy constraint:** **Reference-mode** only (three-intent taxonomy per Shape Language Gate 3). Reading a card — paper OR in-app — does NOT mutate skill-state, does NOT feed Discover-mode recommender, does NOT flow to live-advice state (red lines #8, #11, #16 — see `docs/design/audits/2026-04-24-blindspot-printable-refresher.md`). No push notifications, no card-of-the-day, no auto-personalized pack default.
- **Casino-policy grounding:** owner self-report 2026-04-24 — primary venues (Wind Creek, Homewood, Horseshoe Hammond, Rivers Des Plaines) prohibit reference material that interrupts a hand. Paper is permitted in off-hand windows only. Design excludes mid-hand glance as a driving use case.
- **Mechanism:** Printable Refresher surface generates print-optimized laminated cards (index-card / pocket-card / full-page variants). Content derives from `pokerCore/` utils + POKER_THEORY.md sections + population-baseline data. **Per-villain calibration data is blacklisted from printable output** (source-util whitelist at content-drift CI).
- **Served by:** `PrintableRefresherView` (Phase 5) + `src/utils/printableRefresher/` + print CSS + lineage pipeline (PRF-NEW-2) + staleness-diff pipeline (PRF-NEW-3).
- **Distinct from:**
  - **DS-46** (spaced repetition for charts) — DS-46 is declarative-memory drill; DS-60 is reference-mode lookup. Complementary, not overlapping.
  - **DS-47** (skill map / mastery grid) — DS-47 is mastery-visibility; DS-60 is content-delivery. Distinct.
  - **SE-01** (tonight's watchlist) — SE-01 is villain-specific preparation; DS-60 is generic-principles reference. Some synergy in pre-session-at-venue context; separately authored.
- Doctrine basis: `docs/projects/printable-refresher.project.md` §Working principles (1: high-accuracy-or-nothing; 2: anti-labels-as-inputs; 3: situation-qualified; 5: print-first, view-second); Gate 2 audit §Stage B (Voice 2 refinement — primary situation rewritten per casino-policy evidence); Gate 3 Q3 owner interview 2026-04-24.

## DS-61 — Export-the-personal-codex (owner-authored content into printable form)

> When I've built up a private library of exploit anchors, decision rules, or corrections from my own play, I want to print them as a personal codex alongside the generic reference, so the printed artifact reflects MY game, not just GTO baseline.

- State: **Active** (pending Printable Refresher Phase 2+ — Phase 1 is engine-derived content only).
- **Primary persona:** [Chris](../../personas/core/chris-live-player.md). Secondary: [Rounder](../../personas/core/rounder.md) who builds up personal reads.
- **Autonomy constraint:** **opt-in only.** Default OFF. Phase 1 printable corpus is engine-derived + theoretical; personal-codex export is an explicit owner gesture ("include my EAL anchors in this print batch"). Rationale: red line #16 (no cross-surface contamination) + Reference-mode purity (personalization crosses into Deliberate-mode territory; default-off preserves intent separation). Anti-pattern AP-PRF-9 refuses auto-personalized print packs.
- **Content sources:**
  - User-owned EAL anchors (`exploitAnchors` store, status: active OR expiring — retired anchors excluded unless explicitly re-included).
  - SR-32-nominated corpus entries (if implemented).
  - Owner-ratified population-baseline deviations (POKER_THEORY §9 entries the owner has ratified against their personal play data).
  - Owner free-text notes from `userRefresherConfig.customNotes` (280-char cap, inherited from EAL observation-capture ergonomics).
- **Mechanism:** "Include personal codex" checkbox in Print Controls (Phase 2+). When checked, export pipeline reads user-owned content + injects into print batch with distinct visual styling (e.g., owner-badge on card header, different accent hue from population-baseline cards). Lineage footer distinguishes `source: owner-codex` from `source: pokerCore/...`.
- **Incognito support:** owner can mark any codex entry as `incognito: true` in in-app view, preventing it from ever entering any print batch (inherits EAL red line #9 incognito observation mode to print context).
- **Served by:** `PrintableRefresherView` Phase 2+ + `exploitAnchors` store integration + personal-codex filter logic in print export.
- **Distinct from:**
  - **DS-57** (capture-the-insight) — DS-57 is user-originated observation flagging; DS-61 is export of those observations plus other owner-ratified content into printable form. DS-61 is the export companion to DS-57.
  - **DS-60** (carry-reference-offline) — DS-60 is the physical-reference-artifact JTBD; DS-61 is a specific *content source* option within that artifact. DS-61 does not exist without DS-60.
  - **DE-72** (raw JSON/CSV export) — DE-72 is data-portability; DS-61 is print-artifact personalization. Distinct purposes.
- Doctrine basis: `docs/projects/printable-refresher.project.md` §Risks (risk #7 skill-state contamination + personalization default OFF); Gate 2 audit Stage B Voice 2 §Missing JTBDs PRF-NEW-5; Gate 3 Q7 owner interview (pending ratification — recommendation Phase 2+ opt-in, default OFF).

## DS-62 — Pre-session drill biased toward recently-missed spots

> When I open the pre-session drill, I want the card selection to weight spots I've missed or under-performed on in recent sessions higher than spots I'm crushing, so my 5/15/30 minute prep targets my actual leaks rather than rotating randomly through the library.

- **State:** Proposed (implementation in PSD project Phase 0 — see WS-198 for the `hands` ↔ upper-surface-node-ID cross-reference infra; Phase 1 in WS-199 for the surface integration).
- **Primary persona:** [Pre-Session Preparer](../../personas/situational/presession-preparer.md).
- **Success criteria:**
  - Drill selection algorithm reads from the user's recent N hands (window TBD via Gate 4 — likely 7-30 days OR "since last drill" whichever is shorter).
  - Each candidate node-ID in the corpus carries a `recencyScore` and a `frequencyScore`; selection ranks by `recencyScore × frequencyScore × time-budget-fit`.
  - Spots the user faced AND failed at in the recent window outrank spots the user faced AND succeeded at, which outrank spots the user did not face.
  - Mood-aware *selection* (not framing) per Gate 2 audit Stage C-A3: stuck-mood biases winnable spots, heater-mood biases edge cases. Until WS-201 (mood detection research) lands, user-declared mood toggle drives the selection bias.
- **Failure modes:**
  - **Misery-loop trap**: same spot served day-after-day after each miss, even when the user clearly wants to move on. Mitigation per Stage D Behavioral Psychologist: cap consecutive presentations of the same spot at N (Gate 4 spec).
  - **Recency without competence**: a single recent loss anchors the algorithm to a node-ID that wasn't actually a leak (random variance). Mitigation: blend recency with frequency; single hits don't dominate.
  - **Forward-only blindness**: if implementation chooses `query-time match` schema strategy (WS-198 ADR), users adopting PSD inherit the matcher running over their historical corpus without backfill; if schema-write, only forward hands get tagged. Resolved at WS-198 ADR.
- **Distinct from:**
  - **DS-45** (custom drill from own hand history) — DS-45 is user-initiated single-hand drill ("drill *this specific* spot I just played"); DS-62 is *automated* recency-weighted rotation across the drill library, not single-hand. DS-62 is the algorithm; DS-45 is the manual override.
  - **DS-46** (spaced repetition for key charts) — DS-46 is *scheduling* (when to re-encounter); DS-62 is *selection* (which spots to encounter). They compose: DS-46 schedules, DS-62 selects within the scheduled set. Critically, DS-62 must NOT promote DS-46 to a streak/mastery surface — selection-only, no engagement-pressure layer (per `feedback_scf_learning_state_not_tier_rank.md` + `feedback_owner_volunteered_grading.md`).
  - **DS-57** (capture-the-insight) — DS-57 is forward observation flagging during play; DS-62 is backward leak-targeting in study. Compose by: a DS-57 capture creates an anchor, which produces hand history, which feeds DS-62's selection.
- Doctrine basis: PSD Gate 2 audit (`docs/design/audits/2026-05-19-blindspot-pre-session-drill.md`) Stage B-G3 + Stage C-A3 (mood-aware selection) + Stage D-P1 (hands ↔ node-ID cross-reference); Gate 3 research (`docs/design/audits/2026-05-19-research-psd-gate3.md`). ID-collision note: PSD Gate 1 (2026-04-23) proposed "DS-57" for this outcome; slot was already taken by exploit-anchor-library Gate 3 (2026-04-24). DS-62 is the canonical ID.

## DS-63 — Anchor-trace from drill card into the source reasoning artifact

> When a drill card raises a question I want to dig into, I want one-tap navigation from the card to the section of the source upper-surface artifact that justifies the answer, so I can read the full §11 ledger or §13 leading-theory comparison without leaving the app.

- **State:** Proposed (implementation in PSD project — see WS-199 Gate 4 surface spec navigation section; depends on artifact-renderer infrastructure per [ADR-006](../../../adr/ADR-006-psd-anchor-trace-in-app-bundle.md)).
- **Primary personas:** [Scholar](../../personas/core/scholar-drills-only.md), [Pre-Session Preparer](../../personas/situational/presession-preparer.md) (occasional — pre-session use is mostly time-constrained, anchor-trace is the depth path for the 30-min variant or post-session-Chris coming back to a missed card).
- **Success criteria:**
  - Drill card back contains anchor links to specific sections in the source artifact (e.g., `§11.3 Ledger entry — opponent class A`).
  - Tap navigates to the artifact section without leaving the app (per ADR-006 in-app bundle decision).
  - Back-navigation returns to the drill card with state preserved (mid-prediction state, mid-grade state, etc.).
  - Anchor links use fragment IDs derived from artifact markdown headings; no human-written index.
- **Failure modes:**
  - **Bundle-size drift**: corpus grows unboundedly, bundle exceeds budget. Mitigation: lazy-loaded artifact bundle per ADR-006 Mitigations.
  - **Anchor-rot**: section headings in artifacts change without updating drill-card link references. Mitigation: CI grep test asserting every drill-card anchor resolves to a live heading in its referenced artifact.
  - **Context loss**: deep navigation into artifact loses the drill card it came from. Mitigation: back-navigation state preservation per success criteria.
- **Distinct from:**
  - **DS-50** (walk a hand line branch-by-branch with consequences shown) — DS-50 is line-level study mode; DS-63 is anchor-link from drill to artifact. DS-50 is a study surface; DS-63 is a navigation pattern within drill.
  - **DS-44** (correct-answer reasoning) — DS-44 is the reasoning shown *on* the card back; DS-63 is the *navigation away from* the card into deeper material.
- Doctrine basis: PSD Gate 2 audit Stage D-P5 + ADR-006 (in-app bundle); Gate 3 research doc. ID-collision note: PSD Gate 1 (2026-04-23) proposed "DS-58" for this outcome; slot was already taken by exploit-anchor-library Gate 3 (2026-04-24). DS-63 is the canonical ID.

## DS-64 — Paint a custom range from scratch

> When studying a board, I want to paint an arbitrary 13×13 range with per-combo weights — tap to toggle a combo, long-press to set a partial weight — so I can analyze any range I imagine, not only the pre-built archetypes the Context Picker offers.

- **State:** Proposed (Range Lab Phase 1-2 — served by an ExplorerMode "Custom" range mode alongside the archetype ContextPicker; painted range persists for the session).
- **Primary personas:** [Chris](../../personas/core/chris-live-player.md) (author/validate), [Scholar](../../personas/core/scholar-drills-only.md) (study). Coach is **secondary** (Gate 2 Q2 — Chris-as-author is the primary validated user).
- **Paint primitive:** tap-to-toggle + long-press-for-weight ([ADR-007](../../adr/ADR-007-rl-paint-primitive.md)); per-stroke undo stack ([ADR-008](../../adr/ADR-008-rl-undo-stack.md)).
- **Foundational:** every other Range Lab JTBD parameterizes on a painted (or archetype-seeded) range. Without DS-64, range study stays archetype-only.
- **Round-trip:** painted range serializes via `rangeToString()` / `parseRangeString()` (Phase 0, shipped 2026-04-22) for session persistence + cross-surface `restoreContext`.
- **Success criteria:** user can paint any range on flop/turn/river and see range composition + per-bucket equity + filter/histogram views; no regression to existing ExplorerMode (DS-48/49/50/51).
- **Distinct from DS-51** (range shape on any flop): DS-51 is *reading* a given range's shape vs a board; DS-64 is *authoring* the range itself.
- Doctrine basis: Gate 2 audit (`../../audits/2026-05-20-blindspot-range-lab.md`) Stage B-G1 + Stage A (paint primitive); `range-lab.project.md` Phase 1. ID-collision note: RL Gate 1 (2026-04-22) proposed "DS-52" for this outcome; the slot was taken one day later by Poker Shape Language Gate 3 (2026-04-23, retention-maintenance). DS-64 is the canonical ID.

## DS-65 — Compare two ranges on the same board with delta highlighting

> When I want to understand how two candidate ranges differ on a texture, I want to overlay them on the same board and see the per-combo + per-bucket delta highlighted, so I can reason about range construction as a first-class interaction instead of overlaying two Flopzilla windows by hand.

- **State:** Proposed (Range Lab Phase 2 — a comparison primitive wired into `RangeFlopBreakdown` or a sibling component).
- **Primary personas:** [Chris](../../personas/core/chris-live-player.md), [Scholar](../../personas/core/scholar-drills-only.md).
- **Differentiator vs Flopzilla:** Flopzilla doesn't natively compare; users overlay windows manually. DS-65 makes range comparison first-class. Two Float64Arrays subtracted cell-by-cell = O(169) — trivial, no perf concern.
- **Fidelity (load-bearing):** equity renders to **≥1 decimal place** (Gate 2 Stage E — whole-percent rounding would mask the sub-0.5% differences the comparison exists to surface). Flop equity is exact-enumerated; turn/river fall back to higher-sample Monte Carlo or the precompute cache.
- **Distinct from DS-48** (villain range composition as decision driver): DS-48 decomposes one range vs hero's hand; DS-65 diffs two whole ranges against each other on a board.
- Doctrine basis: Gate 2 audit Stage B-G2 + Stage E (1-decimal fidelity, exact-flop-enumeration). ID-collision note: RL Gate 1 (2026-04-22) proposed "DS-53"; the slot was taken by Shape Language Gate 3 (2026-04-23, edge-case probe). DS-65 is the canonical ID.

## DS-66 — Per-street range evolution from the betting line

> When I paste or build a hand line, I want to see how villain's range narrows flop → turn → river computed from the actual betting actions plus a per-combo equity update, so I learn realistic range dynamics rather than hand-class guesses.

- **State:** Proposed (Range Lab Phase 3-4 — surface-contracted at Gate 2, implementation deferred). The true AI-native differentiator: Flopzilla cannot do this because it lacks the action-profile pipeline.
- **Primary personas:** [Chris](../../personas/core/chris-live-player.md), [Scholar](../../personas/core/scholar-drills-only.md).
- **AP-RL-01 binding (load-bearing):** per-street narrowing MUST be computed **per-combo** — equity update conditional on villain's action profile + the board card revealed — **NEVER** from bucket-label heuristics ("narrow by hand-class"). Full doctrine: [`POKER_THEORY.md §7.6`](../../../.claude/context/POKER_THEORY.md). Enforcement: Gate 4 surface spec (WS-055) + future CI lint + a per-combo-derivation assertion in the Phase 3+ narrowing implementation. Honors first-principles modeling — labels are outputs of the computation, never inputs to it.
- **Determinism:** narrowing must be deterministic for a given (paint + action-profile) input — no "varies each render" — so DS-67 (validate authored content) is testable. Engineering ticket: deterministic seed for any Monte Carlo path in RL.
- **Perf:** flop equity precompute cached as `Float64Array` per combo (WS-205, shipped SPR-095) makes each turn/river card a filter+weight, not a recompute (~10ms/turn-card render).
- **Distinct from DS-50** (walk a hand line branch-by-branch): DS-50 walks a *pre-authored* line's nodes with consequences shown; DS-66 *computes* villain's range at each street from the line.
- Doctrine basis: Gate 2 audit Stage B-G3 + Stage E §AP-RL-01 + Stage C (caching prerequisite); `POKER_THEORY.md §7.6`; memory `feedback_first_principles_decisions.md` + `feedback_river_equity_is_showdown_outcome.md`. ID-collision note: RL Gate 1 (2026-04-22) proposed "DS-54"; the slot was taken by Shape Language Gate 3 (2026-04-23, exploration override — non-negotiable). DS-66 is the canonical ID.

## DS-67 — Validate authored drill / line-study content against the engine

> When I author LSW line-study decision nodes, I want to validate the range and equity claims inside Range Lab instead of an external web search, so my authored teaching content is engine-verified for ≥80% of decision-node checks.

- **State:** Proposed (Range Lab Phase 3+ — Chris-as-author is the **primary** validated user; Coach is secondary per Gate 2 Q2).
- **Primary persona:** [Chris](../../personas/core/chris-live-player.md) (validation-mode authoring). [Scholar](../../personas/core/scholar-drills-only.md) secondary.
- **INV-LSW-RL-EQUITY-PARITY binding (load-bearing):** equity computed in Range Lab for an LSW node must match the LSW engine's value within tolerance (±0.5% Monte Carlo / exact-match enumeration). The invariant + CI test shipped as WS-206 (SPR-095): sample random LSW nodes, recompute in RL, assert parity. This is the trust contract that lets RL replace external validation. (The invariant already caught a real content bug — WS-209, fixed SPR-096.)
- **Cross-surface contract:** LSW `LineWalkthrough` node → "Inspect in Range Lab" with a `restoreContext` payload (Gate 2 Stage D; Phase 5 cross-link).
- **Cognitive-mode note:** distinguishes validation-mode authoring from exploratory study — the [study-block](../../personas/situational/study-block.md) Snapshot is extended to acknowledge both modes (Gate 2 A-R1).
- **Distinct from DS-58** (validate-confidence-matches-experience): DS-58 audits a *shipped exploit's* predicted rate vs observed play over many firings; DS-67 validates *authored content's* equity/range claims against the engine at authoring time.
- Doctrine basis: Gate 2 audit Stage B-G4 + Stage D (LSW-RL cross-link) + A-R1/A-R2; `system/invariants.md` INV-LSW-RL-EQUITY-PARITY; `range-lab.project.md` AC ("LSW line-audit uses Range Lab for ≥80% of decision-node checks"). ID-collision note: RL Gate 1 (2026-04-22) proposed "DS-55"; the slot was taken by Shape Language Gate 3 (2026-04-23, resumption after break). DS-67 is the canonical ID.

## DS-68 — See my competence trend on a concept, evidence-based, without a rank/score identity label

> When I study, I want to see whether I'm actually improving on a concept — on evidence, over time — without the app reducing me to a score, streak, tier, or mastery percentage, so I get the honest signal "am I getting better here?" that I came for, minus the gamification I don't want.

- **State:** Proposed (founder ratified the gap 2026-06-15, WS-230 Gate 3 — authoring the JTBD; surface deferred).
- **Origin:** WS-229 roundtable B-1 / BS-2. All three modeled drill personas explicitly request objective improvement-visibility — Scholar ("know they're improving objectively"), Apprentice ("track personal skill improvement objectively over time"), Newcomer ("simple progress markers"). The autonomy doctrine refuses the **gamified** form of this outcome; the **non-gamified** form was never separately authored, so the anti-gamification red line accidentally orphaned the underlying outcome.
- **Primary personas:** [Scholar](../../personas/core/scholar-drills-only.md), [Apprentice](../../personas/core/apprentice-student.md). Secondary: [Newcomer](../../personas/core/newcomer.md).
- **Autonomy constraint (load-bearing):** this is the autonomy-SAFE expression of the outcome DS-47 refuses. The skill-state attribute shape already modeled on the personas (`level` / `confidence` / `trendDirection` / `lastValidatedAt`) is the data source; the surface renders a **trend on evidence**, never a rank/score-as-identity. Forbidden (inherits the neutral-chrome gate): mastery % ("range-shape mastery: 78%"), tier badges, streaks, leaderboards, shame copy, congratulatory inflation. Allowed: "you've been more accurate on capped-board defense over your last N attempts" framed as observation, not verdict. Bound by [[feedback_scf_learning_state_not_tier_rank]] + [[feedback_owner_volunteered_grading]].
- **Distinct from:**
  - **DS-47** (skill map / mastery grid) — DS-47 is the *gamified* grid the doctrine refuses; DS-68 is the non-gamified trend that serves the same underlying "am I improving?" outcome.
  - **DS-52** (retention maintenance) — DS-52 surfaces *decay* of declared/demonstrated mastery; DS-68 surfaces *direction of change* (improving/plateaued) on evidence, for concepts under active study.
  - **DS-58** (model-accuracy dashboard) — DS-58 audits the *system's* predictions; DS-68 reflects the *user's own* competence trend.
- Doctrine basis: WS-229 audit (`../../audits/2026-06-15-blindspot-drills.md`) B-1 / BS-2; skill-state attribute on `scholar-drills-only.md` + `chris-live-player.md`.

---

## Domain-wide constraints

- Drill time-pressure should be off by default — this isn't mid-hand.
- Explanatory content should be surface-level by default with drill-deeper paths (Scholar > Apprentice depth curve).
- **Adaptive-learning constraints (2026-04-23):** all DS-52..56 operate under the 8 autonomy red lines (see `docs/design/personas/core/chris-live-player.md` §"Autonomy constraint"). Skill-state mutation rules follow `feedback_skill_assessment_core_competency.md` + `docs/projects/poker-shape-language/gate3-decision-memo.md`: Reference-mode does not write; Deliberate / Discover do; user declaration and behavioral observation are distinct signals, never fused arithmetically.
- **Exploit Anchor Library constraints (2026-04-24):** DS-57 / DS-58 / DS-59 operate under the **9 autonomy red lines** (8 inherited + 1 new: incognito observation mode — see `docs/projects/exploit-anchor-library.project.md` §Acceptance Criteria + `anti-patterns.md`). Additional anchor-specific rules: (a) capture framing is note-taking never self-evaluation; (b) Calibration Dashboard copy is model-accuracy never observation-accuracy; (c) retirement is durable with no re-authoring nudges; (d) anchor badge on live surfaces shows `archetypeName + confidence dial` only — no calibration state (cross-surface contamination red line).

## Change log

- 2026-06-15 — WS-230 Gate 3 (WS-229 roundtable follow-up). Added **DS-68** (evidence-based, non-gamified competence-trend visibility — the autonomy-safe form of DS-47's underlying outcome, B-1 / BS-2). **DS-45** promoted Proposed → **Committed-staged** (founder ratified; leak→drill bridge = WS-233 behind WS-198); cross-tab continuity folded into that bridge rather than a separate JTBD. See `../../audits/2026-06-15-blindspot-drills.md`.
- 2026-04-21 — Created Session 1b.
- 2026-04-22 — Added DS-48 / DS-49 / DS-50 / DS-51 (LSW-J1). DS-48 + DS-49 open new first-principles-teaching outcomes served by `bucket-ev-panel-v2`. DS-50 + DS-51 promote outcomes previously marked "implicit" in `surfaces/postflop-drills.md` to explicit atlas entries.
- 2026-05-20 — Added DS-64 (paint custom range) + DS-65 (compare two ranges, delta) + DS-66 (per-street range evolution, AP-RL-01 binding) + DS-67 (validate authored content, INV-LSW-RL-EQUITY-PARITY binding) as Gate 3 output of the Range Lab project (SPR-097 / WS-054). All 4 **Proposed**. DS-64/65 are Phase 1-2 (Flopzilla parity); DS-66/67 are Phase 3+ (AI-native, surface-contracted, implementation-deferred). No new JTBD domain (extends Drills-and-Study); no new personas. **ID-collision correction:** RL Gate 1 (2026-04-22) proposed these as DS-52/53/54/55, but those slots were squatted one day later by the Poker Shape Language project (DS-52..56, committed 2026-04-23). Re-numbered to the next free block DS-64..67 (same failure class as PSD's DS-62/63 re-number). Owner Flopzilla-workflow interview (G3.2) waived — Gate 2 resolved all 4 open owner questions inline. See `../../audits/2026-05-20-blindspot-range-lab.md` (Gate 2) + `../../../projects/range-lab.project.md`.
- 2026-04-23 — Added DS-52 (retention), DS-53 (edge-case probe), DS-54 (exploration override — non-negotiable), DS-55 (resumption after break), DS-56 (calibration check, Proposed). Output of Gate 3 for Poker Shape Language adaptive-seeding project. See `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md` (Gate 2) + `docs/projects/poker-shape-language/gate3-decision-memo.md` (Gate 3 decision memo).
- 2026-04-24 — Added DS-57 (capture-the-insight), DS-58 (validate-confidence-matches-experience), DS-59 (retire-advice-that-stopped-working). Output of Gate 3 for Exploit Anchor Library project. DS-57 is the highest-priority single JTBD for the project (standalone-valuable even if Tier 1 candidate promotion never ships). See `docs/design/audits/2026-04-24-blindspot-exploit-anchor-library.md` (Gate 2) + `docs/projects/exploit-anchor-library/gate3-owner-interview.md` (Q&A log).
- 2026-05-19 — Added DS-62 (recency-weighted drill selection for pre-session prep) and DS-63 (anchor-trace from drill card into source artifact). Output of Gate 3 research for Pre-Session Drill project (SPR-091 / WS-195). PSD Gate 1 (2026-04-23) proposed these as DS-57 and DS-58 respectively; both IDs were already taken by exploit-anchor-library Gate 3 (2026-04-24). DS-62/DS-63 are the canonical IDs. Two other Gate 1 proposals — "DS-56 active-recall pattern priming" and "DS-59 falsifier-verify" — were absorbed differently: the active-recall mechanism is the implementation pattern for SE-01's watchlist (no new JTBD authored, see ADR-005); falsifier-verify is deferred per audit B-G5 pending WS-053 (Range Lab Gate 2) close-out and re-evaluation. See `docs/design/audits/2026-05-19-blindspot-pre-session-drill.md` (Gate 2) + `docs/design/audits/2026-05-19-research-psd-gate3.md` (Gate 3 research summary).
