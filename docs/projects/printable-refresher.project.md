# Project — Printable Refresher (PRF)

**Project ID:** PRF
**Opened:** 2026-04-24
**Status:** Gate 1 CLOSED → Gate 2 CLOSED → Gate 3 CLOSED (GREEN re-run) → **Gate 4 CLOSED 2026-04-25** — all 12 carry-forwards COMPLETE (ACP + AP + CD + H + S1 + S2 + J + W + CI + SL + CSS + MIG) → **Gate 5 (Implementation) NEXT-ready; Phase 5 starts with PRF-G5-CI test infrastructure as non-negotiable prerequisite**
**Owner:** Chris
**Working lead:** Claude (sole developer)

---

## One-line summary

A high-accuracy, UI-polished, print-optimized in-app reference surface ("Printable Refresher") that lets Chris laminate index-card-sized study artifacts for at-the-table reference and pre-session review. Content includes per-seat × hand preflop charts, flop-texture × hand-type strategy matrices, auto-profit / geometric-betting / pot-odds / binomial all-in-survival / implied-odds tables, equity-bucket reference, bluff-catch / thin-value checklists, and a "pure plays vs exceptions" codex.

## Why this matters

**Owner framing (verbatim request, 2026-04-24):**

> "Pre-flop charts are common things to study and memorize. We should have the exact charts… We should have some charts on things like geometric betting (quick math to figure out how to 'get the money in the pot' for the least pot-odds needed to get an all-in call). Equity buckets of villain's range. Maybe a binomial chart of all-ins and how many a hero should expect to survive, even at high [frequency]. Autobluff percentages, implied odds, and reverse implied odds… It should also highlight the 'pure' plays and exceptions if there are any… The idea is hero will laminate these cards (probably index card in size 'per idea' on a page containing multiple ideas), and if he studies them, he will be very well off starting his game."

Chris is the sole verified user. He identifies a real pain: the app's study surfaces are in-app / online; at the table he cannot touch the app in-hand (per `mid-hand-chris` 1.5s glance budget + H-PLT01) and the laminated card is a physical-memory scaffold that the app-surface cannot serve. The refresher closes a loop that every serious live-cash player bridges with paper today (Upswing charts, Bart Hanson sheets, homemade flash cards).

## Working principles (project-specific)

1. **High-accuracy-or-nothing.** Every number on a printable artifact must trace to an existing engine util, POKER_THEORY.md derivation, or owner-ratified heuristic with citation. Dev-generated estimates and model approximations are **banned** on printable surfaces. (Printable ≠ drill — drill tolerates estimates; printable is reference-grade.)
2. **Anti-labels-as-inputs.** Printed cards must not encode decision-by-label patterns (e.g., "vs Fish, always iso-3b"). Per `feedback_first_principles_decisions.md` + POKER_THEORY.md §7 + root CLAUDE.md — labels are outputs, not inputs. Acceptable phrasing: "When SPR ≥ 8 and villain has VPIP ≥ 45 with PFR < 10, iso-3bet OOP gains X bb/100 from the implied-odds realization gap" — with math shown.
3. **Situation-qualified.** No chart is context-free. Every preflop chart declares: stakes, rake structure, effective stacks, and the field's default open range assumptions. A "100 BB MTT chart" and a "60 BB cap game" chart are different artifacts.
4. **Pure vs exception codex.** The user explicitly asked for "pure plays and exceptions" — which means every rule on the card carries its exception(s), and both go on the laminate. Mixed-strategy sizing ranges are acknowledged, not hidden.
5. **Print-first, view-second.** The in-app view is a rendering pass on the printable corpus. Not the other way around. CSS page breaks, laminate-size grid, one-idea-per-card index-card mode must all be first-class.
6. **Lineage visible.** Every card carries a `v1.0 as of 2026-MM-DD` version + source utility trail. A rake change, a range update, or a POKER_THEORY.md revision re-versions affected cards — owner sees which printed cards are stale on the in-app view (even if the laminated copy at the table can't know).

---

## Gate 1 — Entry (INLINE)

### 1. Scope classification

**Surface addition** (new route / new routed view) + **cross-surface journey** (feeds into the planned cross-project Study Home surface — see Shape Language Gate 3 Q1 decision `docs/projects/poker-shape-language/gate3-decision-memo.md` §Q1).

The refresher is **not** a drill surface. It is a **reference surface** — `currentIntent: 'Reference'` in the three-intent taxonomy established by Shape Language Gate 3 (Reference / Deliberate / Discover). Reference mode is write-silent per that decision memo — look-up is not assessment. This has downstream implications:

- Skill-state mutation is **off** on this surface (I-AE-7 signal-separation maintained).
- Discover-mode recommender (when it ships) **may not** push refresher cards as drills without promoting intent.
- The refresher is the first explicit Reference-mode surface shipping under the three-intent taxonomy. Its arrival crystallizes the Reference-mode contract, which was theoretical until now.

### 2. Personas identified

**Core personas:**
| Persona | Fit | How it's used |
|---------|-----|---------------|
| [Chris (live player)](../design/personas/core/chris-live-player.md) | **Primary** | Laminate cards for at-table reference; in-app view for pre-session review. |
| [Scholar (drills-only)](../design/personas/core/scholar-drills-only.md) | **Primary** | Print/save as study artifacts; conceptual rote-memory support. |
| [Rounder](../design/personas/core/rounder.md) | Secondary | Study + light at-table reference. |
| [Weekend Warrior](../design/personas/core/weekend-warrior.md) | Tertiary | Starter cards; novice-friendly versions. |
| [Apprentice](../design/personas/core/apprentice-student.md) | Secondary | Coach-assigned printable packs. |
| [Newcomer](../design/personas/core/newcomer.md) | Tertiary (gated) | Activation-threshold rules may apply (see Gate 2). |
| [Circuit Grinder](../design/personas/core/circuit-grinder.md) | Secondary | ICM-specific printable cards. |

**Situational sub-personas:**
| Situation | Relevance |
|-----------|-----------|
| [study-block](../design/personas/situational/study-block.md) | Primary study consumption. |
| [presession-preparer](../design/personas/situational/presession-preparer.md) | Lay out the laminate before tonight's session. |
| [post-session-chris](../design/personas/situational/post-session-chris.md) | Deep review printed-card against played hands. |
| [between-hands-chris](../design/personas/situational/between-hands-chris.md) | Glance at laminate (not app) for 3-5s reference. |
| [mid-hand-chris](../design/personas/situational/mid-hand-chris.md) | **Paper-laminate allowed; in-app view forbidden** (1.5s glance budget). Forces a novel design constraint: the printable's *paper form* lives in a situation the in-app view cannot serve. |

### 3. JTBD identified

**Existing JTBDs that partially cover this:**
- `DS-46` — Spaced repetition for key charts (**Proposed**) — related but distinct mechanism (drill vs reference).
- `DS-47` — Skill map / mastery grid (**Proposed**) — reference is mastery-adjacent but not mastery-tracking.
- `DS-48` — Understand villain's range composition (**Active** — bucket-ev-panel-v2) — equity-bucket tables inherit from this work.
- `DS-49` — Weighted-total EV decomposition (**Active**) — auto-profit / bluff-catch math inherits.
- `DS-51` — Understand villain's range shape on any flop (**Active**) — flop-texture × hand-type matrices inherit.
- `MH-04` — Sizing tied to calling range — geometric-betting chart supports.
- `MH-09` — SPR-aware strategy cues — SPR zones chart inherits.
- `ON-87` — Cold-start descriptor seeding (**Active, SLS**) — expert-bypass onboarding; refresher may support this.

**Candidate new JTBDs (3):**

- **PRF-NEW-1 — Carry-the-reference-offline.** *"When I'm at a live table where I can't use the app in-hand, I want a physical laminated artifact that carries the highest-leverage decision scaffolds to the table, so I can glance at a card instead of dropping the hand."*
  - **Domain:** Drills and Study (DS-60 candidate) OR new micro-domain "Offline Reference." Gate 2 Stage B decides.
  - **Served by:** printable-refresher surface + print CSS + index-card grid layout.
  - **Personas:** Chris (primary), Rounder, Circuit Grinder.
  - **Distinct from DS-46:** reference vs drill; no spaced repetition mechanism.

- **PRF-NEW-2 — Trust-the-sheet.** *"When I look at a printed card, I want to know the numbers derive from the same engine + theory the app uses — not a generic internet chart — so I can rely on it with the same confidence I rely on the live advice."*
  - **Domain:** Cross-cutting (CC-NN candidate) — trust infrastructure.
  - **Served by:** lineage footer on every card (`v1.0 / 2026-04-24 / src/utils/pokerCore/preflopCharts.js`) + in-app "where does this number come from?" drill-down.
  - **Personas:** all study-inclined, but especially Chris who directs the codebase and wants engine-refresher parity.

- **PRF-NEW-3 — Know-my-sheet-is-stale.** *"When the rake, range, or heuristic that a printed card depends on changes in the app, I want the in-app view to flag that the printed copy is out of date, so I know when to re-print."*
  - **Domain:** Cross-cutting.
  - **Served by:** in-app version banner per card + "printed on DATE" field user enters at print time + diff-since display.
  - **Personas:** Chris primary.

### 4. Gap analysis output

**Verdict: YELLOW (leaning RED)**

Two structural gaps + one partial:

**Gap 1 — JTBD domain shape (YELLOW).** The three candidate JTBDs cluster into two themes: (a) **offline-reference as a first-class user need** (PRF-NEW-1) — not in atlas, arguably warrants a new micro-domain or extends Drills-and-Study; and (b) **trust + staleness infrastructure** (PRF-NEW-2, PRF-NEW-3) — trust lineage is a cross-cutting concern that will recur (already implicit in MH-12 live-cited assumptions, the Calibration Dashboard's `DS-58`, and the planned Study Home). These three JTBDs probably need to be authored explicitly before Gate 4, not patched inline.

**Gap 2 — Situational coverage novelty (YELLOW leaning RED).** `mid-hand-chris` is the most constrained situation we model, and the current design guidance is "no in-app surface during hands." The printable refresher invents a **paper-allowed** sub-case of mid-hand — the app is forbidden, but the laminated card is permitted. This is a **novel situational class** the framework does not model. Three options: (a) amend `mid-hand-chris` with a `paper_reference_permitted` attribute, (b) author a new situational persona `at-table-with-laminate`, (c) treat the at-table use as secondary and design primarily for study-block + presession-preparer. Gate 2 Stage A + C decide.

**Gap 3 — Content fidelity bar (partial).** The user's ask is extremely broad — "preflop charts, auto-profit bluffs, bluff-catching checklists, Hero/villain bucket EV, geometric betting, binomial survival, implied/reverse implied odds, equity buckets, pure plays + exceptions, per-hand-type × per-texture cbet strategy, etc." Each of these carries **high anti-pattern risk**. Examples:

- "Don't bluff a calling station" on a card → violates first-principles doctrine (calling station is a label; the actual input is per-combo fold-to-bet equity by sizing — POKER_THEORY.md §3.2 + feedback_reasoning_quality.md).
- "3-bet 56s vs deep-stacked fish in CO" on a card → violates first-principles doctrine unless the card makes explicit the SPR / stack-depth / implied-odds derivation.
- "Iso-3b fish OOP almost every time" — citing the user's own example — survives only as a sizing-and-line recommendation, not as a blanket "always" rule.

This is **not blocking** for Gate 1 but is a strong Gate 2 / Gate 4 / Gate 5 constraint. Each card type should go through a fidelity pre-check against POKER_THEORY.md + the two feedback memories before authoring.

**Net: YELLOW (leaning RED) — Gate 2 triggered.**

Per LIFECYCLE.md §Gate 2 triggers: **new surface** + **new JTBDs** + **persona amendment needed** + **cross-surface (feeds Study Home)** + **owner-flagged for scrutiny** — five independent triggers converge. Gate 2 is mandatory.

---

## Gate 2 — Blind-Spot Roundtable (PLAN)

**Status:** Voice plan authored; parallel execution pending owner ratification.

### Proposed voices (5)

Following the precedent of Shape Language (4 voices) + Exploit Anchor Library (3 voices), expanded to 5 for this project because:
- Print-medium is a design discipline not previously exercised.
- Content-fidelity bar for printed artifacts is higher than any prior project (stale-once-printed = permanent wrong-answer risk).
- Competitive landscape is large (Upswing / GTO Wizard / Run It Once / Crush Live / Bart Hanson / Amazon laminated cards / Reddit homemade charts) — market lens needs a dedicated voice.

| Voice | Stages | Scope |
|-------|--------|-------|
| **1. Product/UX lead** | A, C, E | Persona sufficiency (at-table-with-laminate novelty), situational stress (5/15/30-min prep; mid-hand glance-at-laminate; study-block; between-hands), Nielsen/PLT/ML heuristics on both in-app view AND printed artifact. |
| **2. Market / competitive lens** | B | Survey Upswing charts, GTO Wizard trainer sheets, Bart Hanson's CLP cheat-sheets, BBZ preflop charts, Amazon laminated cards, Reddit homemade cards, Run It Once printable packs, Solver cheat-sheets. Identify JTBD-coverage gaps and out-of-scope content that competitors ship that we should too (or explicitly refuse). |
| **3. Poker theory fidelity** | Pre-check + E | Audit the proposed content list against POKER_THEORY.md + `feedback_reasoning_quality.md` + `feedback_first_principles_decisions.md` + root CLAUDE.md "Poker Analysis Guardrail" + exploitEngine/CLAUDE.md + rangeEngine/CLAUDE.md anti-patterns. Flag every card-type that risks encoding labels-as-inputs, sizing-as-range-shape, calling-station-as-weak-range, z-test frequentism, etc. Propose replacement phrasings. Disqualify content that cannot be expressed first-principles on a card without becoming illegible. |
| **4. Autonomy + trust skeptic** | E (9 red lines + new ones) | Carry forward the 9 autonomy red lines from Shape Language + Exploit Anchor Library. Stress-test new ones specific to print medium: (a) printed-advice-permanence without retirement — a retired anchor stays on the laminate forever unless the user re-prints; (b) out-of-app citation: printed cards can't surface "why"; (c) graded-work trap in print (a "correctness score" per card is forbidden); (d) engagement-pressure in print (streak / "card-of-the-day" refused); (e) skill-state mutation on read is off for Reference-mode — reinforced. Propose new PRF-specific red lines. |
| **5. Senior engineer + print-medium designer** | D + E (ML) | Cross-surface: Study Home parent (authorship coupling — who owns first), dashboard-sprawl check, IDB impact (likely zero; content is derived from existing utils), build-time vs runtime generation, print CSS doctrine (page breaks, two-column grid, index-card fit, no-color fallback, font-size at laminate scale), export formats (PDF vs browser-print), data-source lineage at card level (every card declares its source util), content-drift CI test. Mobile-Landscape heuristics on the in-app view (1600×720 under useScale). |

### Voice stubs (to be authored before parallel run)

Each voice gets a stub at `docs/projects/printable-refresher/gate2-voices/NN-<voice>.md` listing:
- Voice identity + stages owned.
- Pre-read list (personas, JTBDs, heuristics, existing surfaces, prior audits with similar concerns).
- Prompt template (what the voice is asking).
- Output contract (structure + expected length).

### Output contract

- Each voice memo: `docs/projects/printable-refresher/gate2-voices/NN-<voice>.md` (300-800 words each).
- Synthesis: `docs/design/audits/2026-04-24-blindspot-printable-refresher.md` following ROUNDTABLES.md format (feature summary + 5 stages + verdict + top-3 risks + required follow-ups + backlog proposals + owner-interview questions if any).

### Expected verdict

Likely **YELLOW** with narrow structural risks + 3-5 Gate 3 items (author PRF-NEW-1/2/3 JTBDs; amend `mid-hand-chris` with paper-reference attribute; short owner interview on content scope + print format + activation threshold for newcomer-equivalent users).

**Possible RED** if poker-theory-fidelity voice disqualifies enough proposed content to invalidate the "single refresher surface" frame — would redirect toward multiple narrower surfaces (e.g., separate Preflop Refresher + Postflop Refresher + Math Tables) or a staged rollout (preflop first, math second, postflop last).

---

## Acceptance Criteria (Gate 4 — ratified 2026-04-24)

This section ratifies the Gate 4 **testable** form of the project. The six Working Principles above are pre-Gate-2 intent; the criteria below are the Gate-5-testable binding form. Every red line and every fidelity-bar gate maps to a Gate 5 test ID; CI failure on any criterion blocks Phase 5 card authoring.

### Autonomy red lines (17 total — 9 inherited + 8 PRF-specific)

**Inherited (Shape Language 2026-04-23 + EAL 2026-04-24):**

1. **Opt-in enrollment** — no silent skill or observation inference from refresher-surface activity. Printing, viewing, filtering, and configuring cards produce **no** write to `shapeMastery`, `villainAssumption`, or any skill-state store. Enforced structurally via red line #11.
2. **Full transparency on demand** — every card's lineage panel is ≤2 taps from any refresher surface. Panel renders the full 7-field lineage (see red line #12).
3. **Durable overrides** — owner's "suppress card class" / "hide card" / "never print" actions persist indefinitely. Engine + app version bumps never revert these. No algorithmic rebuttal. (Analog of EAL retirement durability.)
4. **Reversibility** — per-card reset, global library reset, and incognito view-mode all offered. Incognito disables per-card view tracking even internally.
5. **No streaks / shame / engagement-pressure** — no "cards studied today," "days since print," "re-print streak," "cards remaining in your pack."
6. **Flat access** — all card classes visible in the catalog regardless of owner suppression state. A "show suppressed" toggle reveals hidden classes with status annotation; suppressed classes do not render in default print-export.
7. **Editor's-note tone** — factual copy only. ✓ "Solver baseline: fold. Exception: SPR ≥ 8 IP vs VPIP ≥ 45." ✗ "You must fold here."
8. **No cross-surface contamination** — refresher-view activity never mutates live-advice state; live-play data never auto-tailors the printable set. Structurally bidirectional under red line #16.
9. **Incognito observation mode** (inherited from EAL) — not directly applicable (refresher does not capture observations), but structurally subsumed by red line #11 (Reference-mode write-silence at reducer boundary).

**New for PRF (#10-17 — address the novel print-medium autonomy risks):**

10. **Printed-advice permanence requires in-app staleness surfacing.** Every printed batch snapshots `engineVersion` + per-card `sourceHash` at print time (per-batch, owner-entered date via PRF-G4-J print-confirmation modal). In-app per-card view computes diff since print; batch-level banner surfaces `"N of M cards in your YYYY-MM-DD batch are stale"` passively. **No push notifications. No badge counters. No "days since print" counter.** Owner-controlled re-print cadence; absence of re-print is not a failure state.
11. **Reference-mode write-silence at reducer boundary.** All refresher surfaces dispatch `currentIntent: 'Reference'`. The `skillAssessment/` reducer (per `feedback_skill_assessment_core_competency.md`) asserts at the boundary that no posterior update, no drill-completion signal, and no observation-capture write occurs under this intent. Test: **PRF-G5-RI** asserts Reference-mode dispatch produces zero skill-state mutation across 15 MVP card opens.
12. **Lineage-mandatory on every card.** Every printable card carries a 7-field lineage footer: (1) card ID + semver (`PRF-PREFLOP-OPEN-CO-100BB v1.2`); (2) generation date (ISO8601); (3) source-util path + contentHash (`src/utils/pokerCore/preflopCharts.js#computeOpenRange @ sha256:a3c...`); (4) engine + app version (`engine v4.7.2 / app v123`); (5) theory citation (`POKER_THEORY.md §3.2`); (6) assumption bundle (stakes, rake config, effective stack, field baseline); (7) bucket definitions cited if applicable. No anonymous content. Test: **PRF-G5-LG** asserts all 7 fields render on the 15 MVP cards.
13. **Owner-suppression is durable indefinitely.** Suppressed card classes persist across engine + app version bumps + schemaVersion migrations. System never surfaces "you might want to reconsider printing X." Mirrors EAL anchor-retirement durability (AP-05 analog). Test: **PRF-G5-DS** asserts suppressed card stays suppressed across a simulated schemaVersion bump + engine version bump.
14. **No completion / mastery / streak tracking on cards — even digital.** Refreshers are not drills. Per-card view-counts and print-counts are not tracked (if needed for bug diagnosis, never surfaced in UI). No "cards studied today." No "days streak." No progress bars.
15. **No proactive print-output.** The app never auto-generates a print pack. Printing is 100% owner-initiated. No "card of the day," no pre-session auto-print, no background PDF generation, no "your personalized pack tonight." Newcomer-threshold (Q8, `PRF_UNLOCK_THRESHOLD_SESSIONS = 1`) gates the surface's default-appearance, not its accessibility.
16. **Cross-surface segregation is bidirectional.** (a) Refresher-view activity never mutates live-advice state, Calibration Dashboard state, or Anchor Library state. (b) Live-play data, villain observations, drill outcomes, and session stats never auto-tailor the printable set. The printable corpus is owner-curated + engine-derived from theoretical utils — **never personalized by play data** without explicit opt-in (deferred to Phase 2+ per Q7; default OFF; `userRefresherConfig.printPreferences.includeCodex: false` structural).
17. **Intent-switch mandatory for drill-pairing.** If a future feature pairs a printed card with a drill ("test yourself on this card"), the pairing requires an explicit intent-switch from `Reference` → `Deliberate`. No automatic "tap card → now you're being graded." Button copy: "Drill this card" (explicit), not "Review this card" (ambiguous).

**Blanket test:** **PRF-G5-RL** — red-line compliance test suite with one passing assertion per red line. Blocks any Gate 5 card authoring PR.

### Anti-patterns (11 PRF-specific + EAL-inherited)

See `docs/projects/printable-refresher/anti-patterns.md` for full enumeration with refusal examples + red-line citations. Summary:

| ID | Pattern | Red line violated |
|---|---|---|
| AP-PRF-01 | Card leaderboard (default-sort by "biggest edge") | #5 |
| AP-PRF-02 | "Card of the day" auto-surface | #15 |
| AP-PRF-03 | Print-streak visualization ("7 days in a row printing") | #5 + #14 |
| AP-PRF-04 | "Mastery score" per card | #14 + AP-04 inheritance |
| AP-PRF-05 | "Retired cards you might reconsider" nudges | #3 + #13 (AP-05 analog) |
| AP-PRF-06 | "Your refresher accuracy" graded-work framing | #7 + #14 + AP-06 inheritance |
| AP-PRF-07 | Cross-surface contamination | #8 + #16 |
| AP-PRF-08 | Engagement notifications (re-print reminders, new-card alerts) — default-on | #5 + #15 (opt-in only, default OFF) |
| AP-PRF-09 | Auto-personalized print pack | #16 |
| AP-PRF-10 | Watermark-based social engagement (QR codes, "share with friends," social proof) | #5 + #7 |
| AP-PRF-11 | Card-view analytics surfaced to owner ("you've viewed this card 47 times") | #14 |

EAL-inherited (AP-01..09 from `docs/projects/exploit-anchor-library/anti-patterns.md`) apply transitively wherever refresher surfaces intersect with anchor / calibration surfaces.

### Copy-discipline rules (5)

See `docs/projects/printable-refresher/copy-discipline.md` for ✓/✗ examples per rule + CI-linted forbidden-string list. Summary:

- **CD-1 — Factual, not imperative.** Cards describe conditions + derivations, not commands. Cites red line #7.
- **CD-2 — No self-evaluation framing.** No "Grade your play / How did you do / Score your decision / Check your answer." Cites red lines #5 + #14.
- **CD-3 — No engagement copy.** No "mastery" / streaks / motivational copy. Cites red lines #5 + #14 + AP-PRF-03/04.
- **CD-4 — Labels as outputs, never inputs.** Cites `feedback_first_principles_decisions.md` + POKER_THEORY.md §7 + F1/F6 below.
- **CD-5 — Assumptions explicit.** Every chart declares stakes, rake, effective stacks, field baseline. Cites F3 below + Working Principle #3.

### Poker-fidelity bar — six gates (F1-F6)

Every card clears **all six** gates before printing. Per-card `cardFidelityCheck()` ships at Gate 5 (PRF-G5-B/A/C authoring); CI-grep enforces source-util whitelist at build.

- **F1 — No archetype-as-input.** Villain labels (Fish / Nit / LAG / TAG / Station / Maniac) appear **only** as glossary entries or historical population annotations — never as decision inputs. Per `feedback_first_principles_decisions.md` + POKER_THEORY.md §7 + `src/utils/exploitEngine/CLAUDE.md` anti-patterns (§calling-station-as-weak-range + §labels-collapse-independent-axes). The three Q1 RED card refusals (#12 per-villain-archetype / #13 56s-vs-deep-fish / #14 don't-bluff-stations) are load-bearing precedents — their decomposed replacements are the acceptable form.
- **F2 — Math visible.** Thresholds show the formula (`breakeven = bet/(pot+bet)`, `MDF = 1 − bet/(pot+bet)`, `geometric = pot × (1+r)^n ≈ stack`). Tables show the derivation parameters in-line or footnoted. No "trust-me" numbers. A 33% breakeven fold for half-pot bluff is useless without the `bet/(pot+bet)` alongside — the user's laminate must carry the derivation so it survives pot-geometry changes.
- **F3 — Scenario-declared.** Every card declares: (a) stakes + rake structure (or `rake-agnostic` stamped), (b) effective stacks, (c) position-vs-position context, (d) SRP / 3BP / 4BP framing. No context-free charts. A "100 BB MTT chart" and a "60 BB cap-game chart" are different artifacts.
- **F4 — Source-trail footer.** Lineage footer cites `pokerCore/`, `gameTreeConstants.js`, or POKER_THEORY.md section (see whitelist below). Renders as two greyscale 9pt lines on printed artifact; expandable full 7-field lineage modal in-app.
- **F5 — Pure / Exception provenance unambiguous.** Solver baseline and population-baseline deviation are never mixed on a single card. Each card is either a "Pure play" card (solver near-100% on one action — cited to `pokerCore/preflopCharts.js` or equivalent) or an "Exception" card (POKER_THEORY.md §9 documented-divergence entry with cited audit id). A single card mixing both is refused at fidelity check because it obscures provenance.
- **F6 — Prescriptions are computed, not labelled.** Any "do X in situation Y" decomposes Y into game-state inputs (equity, pot-odds, SPR, players-remaining, effective stack, rake) and derives X from them. A card saying "vs calling station, always value-bet bigger" is refused; the acceptable reformulation is "When observed `foldToBet(size)` < breakeven at a sizing, bluffs at that sizing are -EV; value bets at the same sizing gain from the same observation."

### Source-util whitelist (F4 / F6 CI enforcement — PRF-G4-CI spec)

Cards **may** source from:
- `src/utils/pokerCore/` — `preflopCharts`, `rangeMatrix`, `boardTexture`, `handEvaluator`, `cardParser`
- `src/constants/gameTreeConstants.js` — population baselines (rake configs, style-prior fold curves, SPR zones, realization-factor tables)
- `.claude/context/POKER_THEORY.md` — formal derivations + §9 documented-divergence entries with audit ids

Cards **may NOT** source from (enforced at build via PRF-G4-CI content-drift CI):
- `src/utils/exploitEngine/villainDecisionModel.js`
- `src/utils/exploitEngine/villainObservations.js`
- `src/utils/exploitEngine/villainProfileBuilder.js`
- `src/utils/assumptionEngine/*` — entire namespace
- `src/utils/anchorLibrary/*` — entire namespace (calibration-state sources)
- `src/components/views/CalibrationDashboard/*` — any read-through of on-screen calibration state
- `src/components/views/AnchorLibraryView/*` — any read-through of anchor retirement state

**Rationale:** per-villain calibration output is single-villain single-session scope. Printing it converts calibration into a permanent wrong-answer vector once the calibration retires in-app but the laminate survives. Calibration lives on-screen only. The whitelist/blacklist together encode F6 (Calibration Segregation per Voice 3).

### Personalization posture

Phase 1: personalization is **OFF by default and non-optional**. `userRefresherConfig.printPreferences.includeCodex: false` structural default. Personalization opt-in deferred to Phase 2+ (PRF-P2-PE) per Q7. AP-PRF-09 enforces refusal of any auto-personalized print pack until an explicit opt-in gesture is authored (which itself requires a Gate 4 design pass at Phase 2).

### Newcomer gating

`CONSTANTS.PRF_UNLOCK_THRESHOLD_SESSIONS = 1` (Q8 ratified). Surface is reachable from routing from day one (red line #6 flat access) but renders factual empty-state copy until the threshold is crossed. Empty-state copy is factual ("Complete 1 session to enable the printable refresher") — no nudge, no countdown, no engagement pattern.

### Gate 4 closure criteria

Gate 4 is CLOSED when all 12 carry-forwards ship:

- [x] §Acceptance Criteria ratified — **PRF-G4-ACP — DONE 2026-04-24**
- [x] `docs/projects/printable-refresher/anti-patterns.md` — **PRF-G4-AP — DONE 2026-04-24**
- [x] `docs/projects/printable-refresher/copy-discipline.md` — **PRF-G4-CD — DONE 2026-04-24**
- [x] `docs/design/heuristics/printable-artifact.md` — **PRF-G4-H — DONE 2026-04-24**
- [x] `docs/design/surfaces/printable-refresher.md` — **PRF-G4-S1 — DONE 2026-04-24**
- [x] `docs/design/surfaces/printable-refresher-card-templates.md` — **PRF-G4-S2 — DONE 2026-04-24**
- [x] `docs/design/journeys/refresher-print-and-re-print.md` — **PRF-G4-J — DONE 2026-04-24**
- [x] `docs/projects/printable-refresher/WRITERS.md` — **PRF-G4-W — DONE 2026-04-24**
- [x] Content-drift CI spec — **PRF-G4-CI — DONE 2026-04-24** (spec ratified; test implementation required BEFORE Gate 5 card authoring — non-negotiable sequencing)
- [x] Selector-library contract — **PRF-G4-SL — DONE 2026-04-24**
- [x] Print-CSS doctrine spec — **PRF-G4-CSS — DONE 2026-04-25**
- [x] IDB migration spec — **PRF-G4-MIG — DONE 2026-04-25**

**Gate 4 CLOSED 2026-04-25.** All 12 carry-forwards COMPLETE. Gate 5 (Implementation) NEXT-ready.

### Gate 5 closure criteria

Gate 5 is CLOSED when Phases A / B / C ship with all 11 PRF-G5-* carry-forwards green. See BACKLOG PRF-G5-* section for enumeration (PRF-G5-CI + PRF-G5-A + PRF-G5-B + PRF-G5-C + PRF-G5-RL + PRF-G5-PDF + PRF-G5-RI + PRF-G5-DS + PRF-G5-LG + PRF-P2-PE + PRF-P2-CX).

---

## Streams (forward-looking; Phase structure TBD by Gate 4)

Non-binding pre-Gate-4 phasing:

- **Phase 1 (Gates 1-3):** Entry + Blind-Spot Roundtable + Research (competitive + JTBDs + persona amendment + owner interview).
- **Phase 2 (Gate 4):** Surface specs — printable-refresher parent surface + per-card-type sub-specs + cross-ref Study Home (author if not yet authored) + print-CSS spec + version/lineage spec + content-drift CI spec.
- **Phase 3 (Gate 5 — Content authoring):** Card-by-card authoring against fidelity bar. Preflop first (highest-leverage + bounded). Then math tables (auto-profit, geometric, pot-odds, binomial, implied-odds). Then postflop (per-texture × per-hand-type cbet strategy; highest anti-pattern risk — gate on fidelity review per card).
- **Phase 4 (Gate 5 — Implementation):** React view + print CSS + version banner + lineage drilldown + export pipeline.
- **Phase 5 (Gate 5 — Test):** Content-drift CI test (engine utils changing flags affected cards); visual print-output tests (Playwright PDF); lineage-banner assertion tests; accessibility tests (color-blind + high-contrast for print).
- **Phase 6 (Post-launch):** Content-expansion loop; owner-proposed additions via insight-capture (analogous to EAL Tier 0); tier packaging decision (free tier? bundled with Plus?).

---

## Risks (pre-Gate-2)

1. **Anti-pattern risk on printed content.** The highest risk. Addressed by Voice 3 (poker theory fidelity) in Gate 2 + per-card Gate 5 review.
2. **Stale-once-printed risk.** Addressed by PRF-NEW-3 JTBD + lineage footer + in-app staleness banner. Laminated physical copy is inherently un-updateable; design must surface staleness in-app and encourage re-print cadence.
3. **Study Home coupling.** Printable refresher is a natural Study Home embed, but Study Home is not yet authored. Either this project authors Study Home (scope creep into another project's Gate 4) OR authors the refresher surface with an explicit "parent TBD" reference. Gate 2 Stage D decides.
4. **Content scope overshoot.** The user's request covers ~15 distinct card types. Gate 5 authoring is the long pole. Stage-by-stage rollout (preflop → math → postflop) is the probable answer.
5. **Competitor-comparison risk.** If we ship content directly competitive with Upswing / Crush Live paid packs, market-lens may surface scope-reduction pressure (stick to what we do uniquely — e.g., range-vs-range decomposition, per-villain calibration) and refuse generic-chart duplication. Voice 2 owns this.
6. **Paper-at-table medium novelty.** Framework has no prior paper-reference precedent. `mid-hand-chris` may need amendment. Voice 1 owns this.
7. **Skill-state contamination.** Refresher is Reference-mode (write-silent). Must not accidentally feed skill-assessment posterior updates. Already defended by Shape Language Gate 3 infrastructure; Voice 4 verifies.
8. **Newcomer accessibility.** A 90-page refresher may overwhelm newcomer. Activation threshold (per EAL's 25-hand newcomer rule) may apply. Voice 1 flags.

---

## Decisions log

- **2026-04-24 — Project opened.** Owner request + CLAUDE.md Design Program Guardrail triggered. Gate 1 authored inline; verdict YELLOW (leaning RED). Gate 2 plan staged (5 voices); awaiting owner ratification before parallel execution.
- **2026-04-24 — Voice count: 5 (expanded from 3-4 precedent).** Rationale: print-medium is a novel design discipline; competitive landscape is large; content-fidelity bar is higher than any prior project. Each voice has a distinct scope non-redundant with the others.
- **2026-04-24 — Reference-mode status claimed.** Refresher is the first explicit Reference-mode surface shipping under Shape Language's three-intent taxonomy. Reference mode is write-silent (does not mutate skill-state).
- **2026-04-24 — Content tiering anticipated (pre-Gate-4).** Preflop first (highest-leverage, bounded), math tables second, postflop last (highest anti-pattern risk). Subject to Gate 4 phasing.
- **2026-04-24 — Gate 2 SHIPPED.** 5 voices executed in parallel. Verdict YELLOW with 3 structural risks. Audit: `docs/design/audits/2026-04-24-blindspot-printable-refresher.md`. Voices: `docs/projects/printable-refresher/gate2-voices/01..05-*.md`.
- **2026-04-24 — Gate 2 Q1 doctrine reconciliation: ACCEPTED by owner.** 3 RED content types (#12 per-villain-archetype / #13 56s-vs-fish / #14 don't-bluff-stations) refused with decomposed replacements adopted. 6-point fidelity bar + source-util whitelist ratified for Gate 4 charter.
- **2026-04-24 — Gate 2 Q3 venue policy: ANSWERED by owner.** Primary venues Wind Creek / Homewood / Horseshoe Hammond / Rivers Des Plaines prohibit reference material mid-hand; paper permitted only in off-hand windows (stepped-away-between-hands, seat-waiting, tournament break, pre-session at venue). **Consequence:** Voice 1's `paper_reference_permitted` attribute on `mid-hand-chris` WITHDRAWN. New cross-persona situational `personas/situational/stepped-away-from-hand.md` authored instead, capturing the four real off-hand contexts.
- **2026-04-24 — Gate 3 artifacts SHIPPED (pass 1).** Owner interview doc at `docs/projects/printable-refresher/gate3-owner-interview.md` (Q1+Q3 answered, 7 remaining). 5 JTBDs authored: DS-60 (carry-offline), DS-61 (export-personal-codex, Phase 2+), CC-82 (trust-the-sheet), CC-83 (know-stale), SE-04 (pre-session kinesthetic visualization). 1 new situational persona (`stepped-away-from-hand`). 2 personas amended (`apprentice-student`, `rounder`). ATLAS.md updated (DS-43..61; SE-01..04; CC-82 + CC-83 added). Gate 3 re-run (Gate 2 re-run against updated framework) pending Q2/Q4-Q9 owner answers.
- **2026-04-24 — Q2 phasing ACCEPTED.** B → A (conditional) → C. Math Tables ship first (zero anti-pattern risk, clearest market gap); Preflop conditional on Q5 differentiation demo at Gate 4 design review; Texture-Equity + Exceptions last with per-card fidelity review.
- **2026-04-24 — Q4 print format ACCEPTED.** US Letter default + A4 selectable. Cards-per-sheet (12/6/4/1) user-selectable at print time; `userRefresherConfig.printPreferences` persists last choice. H-PM04 0.25" safe-trim margin binds all grid options.
- **2026-04-24 — Q5 tier/pricing ACCEPTED (with deferral).** Phase B free (lead-gen). Phase A conditional — differentiation demo at Gate 4 is binary go/no-go; if visibly indistinguishable from Upswing free pack, cut Phase A entirely and link to Upswing. Phase C Plus-tier given per-card fidelity-review cost. Tier packaging decision itself deferred to Monetization & PMF project Gate 4 (cross-project dependency; not blocking PRF).
- **2026-04-24 — Q6 IDB coordination ACCEPTED.** Dynamic `max(currentVersion + 1, 18)` rule. Whichever project reaches migration-authoring first claims next available version. Inherits from EAL Gate 4 P3 §2 decision pattern.
- **2026-04-24 — Q7 personalization default ACCEPTED.** Phase 2+ opt-in only; default OFF. `userRefresherConfig.printPreferences.includeCodex: false` structural default at Phase 1. Red line #16 binding; AP-PRF-9 refusal enforced.
- **2026-04-24 — Q8 newcomer threshold ACCEPTED.** 1 completed session + explicit opt-in. `CONSTANTS.PRF_UNLOCK_THRESHOLD_SESSIONS = 1`. Factual empty-state copy; no nudge / no engagement pattern.
- **2026-04-24 — Q9 print-date ergonomics ACCEPTED.** Per-batch stamp. `printBatches` store keypath is `batchId` (UUID); cards reference batchId; staleness-diff via JOIN on batch.printedAt. User-override affordance for backdating.
- **2026-04-24 — Gate 2 re-run SHIPPED.** Verdict **GREEN**. Audit at `docs/design/audits/2026-04-24-blindspot-printable-refresher-rerun.md`. 17 original findings mapped: 12 Closed by Gate 3 artifacts + 5 explicitly propagated to Gate 4/Gate 5 with named backlog IDs. **Gate 3 CLOSED; Gate 4 unblocked with 12 carry-forwards enumerated.** Gate 5 enumerated with 11 test + phase items.
- **2026-04-24 — Gate 4 doctrine batch SHIPPED (Session 2).** Four of 12 Gate 4 carry-forwards complete: **PRF-G4-ACP** (§Acceptance Criteria expanded inline above — 17 red lines + 11 anti-patterns + 5 copy rules + 6-point fidelity bar + source-util whitelist/blacklist with Gate 5 test IDs mapped); **PRF-G4-AP** (`docs/projects/printable-refresher/anti-patterns.md` — 11 PRF-specific + 9 EAL-inherited with transitive-inheritance rule + amendment-requires-persona-level-review escalation path); **PRF-G4-CD** (`docs/projects/printable-refresher/copy-discipline.md` — CD-1..5 with ✓/✗ examples + CI-linted forbidden-string regex list + worked-example Q1-RED-card reformulation showing CD + F rules operating together); **PRF-G4-H** (`docs/design/heuristics/printable-artifact.md` — H-PM01-08 consolidated from V1 H-PRF01-05 + V5 H-PM01-06; H-PM07 staleness-channel-is-in-app-only is first-of-its-kind paper-medium heuristic). Remaining 8 Gate 4 carry-forwards (S1 / S2 / J / W / CI / SL / CSS / MIG) all blocked by PRF-G4-S1 except PRF-G4-SL. Zero code; zero tests. Handoff: `.claude/handoffs/printable-refresher-session2.md`.
- **2026-04-24 — ACP inlined in charter, not by external reference (precedent: EAL Session 3).** Alternative (point at anti-patterns.md + copy-discipline.md + heuristics/printable-artifact.md without inlining the red-line list) would force future readers to follow three indirections to understand acceptance gates. Inline enumeration makes the charter self-contained for acceptance testing. Cross-references retained to each sibling doc for deeper context; charter remains single source for the red-line list.
- **2026-04-24 — H-PM07 (staleness-channel-in-app-only) coined as first-of-its-kind paper-medium heuristic.** No prior heuristic set in the product has a heuristic whose entire domain is "this affordance cannot exist on this medium." Future non-refresher paper artifacts (printable session summaries, exported study packs) inherit the H-PM set without re-authoring. Flagged for consideration at `.claude/programs/reference-integrity.md` governance file if adoption grows (mirrors CC-82/83 residual-observation in Gate 2 re-run audit §Residual).
- **2026-04-24 — PRF-G4-S1 SHIPPED (Session 3).** Primary surface spec authored at `docs/design/surfaces/printable-refresher.md` (~580 lines). Five sub-views: `CardCatalog` (virtualized list with 4-group filters + 4-option sort + action chips per row) / `CardDetail` (WYSIWYG card preview + lineage footer + hide-pin-suppress actions) / `LineageModal` (7-field drilldown + source-util deep-link + staleness-diff prose) / `PrintPreview` (WYSIWYG @media print CSS applied via `.print-preview-container`) / `PrintConfirmationModal` (per-batch date entry + batch summary + reminder copy) + `SuppressConfirmModal` (2-tap + checkbox pattern mirroring EAL). 17 red-line compliance checklist with per-red-line test targets (PRF-G5-RL / RI / DS / LG / PDF). 11 AP-PRF refusals with allowed-alternatives enumerated at surface level. State contract covers `userRefresherConfig` + `printBatches` stores + 3 writers (W-URC-1/2/3). Intent-dispatch: mount dispatches `currentIntent: 'Reference'` (first explicit Reference-mode surface under Shape Language three-intent taxonomy — reducer-boundary write-silence is the crystallizing invariant for future Reference-mode surfaces like Study Home / Range Lab export). Phase 5 code-path plan enumerates ~18 new files across views / hooks / utils / manifests / styles. 10 Playwright evidence placeholders + print-snapshot cross-browser matrix. `parentSurface: 'study-home (pending)'` placeholder retained per Voice 5 D1b. CATALOG.md gained `printable-refresher` top-level view row + change-log entry. **Unblocks 7 Gate 4 items** (S2 + J + W + CI + SL + CSS + MIG — all now NEXT-ready). Zero code. Handoff: `.claude/handoffs/printable-refresher-session3.md`.
- **2026-04-24 — Reference-mode crystallization at reducer boundary decided at PRF, not at Shape Language.** Shape Language Gate 3 defined the three-intent taxonomy (Reference / Deliberate / Discover); PRF-G4-S1 is the first concrete surface that dispatches `currentIntent: 'Reference'` at mount + asserts no mutation of skill-state stores under this intent. Future Reference-mode surfaces inherit the reducer-boundary write-silence contract via the PRF-G5-RI test pattern. Alternative (crystallize at Shape Language's own surface) was rejected — Shape Language Gate 4 surface specs are further out + PRF reaches the reducer first via earlier Gate 5. Reducer contract is owned jointly by Shape Language (taxonomy origin) + PRF (first implementation) + `feedback_skill_assessment_core_competency.md` memory (shared infrastructure model).
- **2026-04-24 — Gate 4 persistence/CI/selectors batch SHIPPED (Session 4).** Three docs shipped in one session: **PRF-G4-W** (`docs/projects/printable-refresher/WRITERS.md` — 3 writers W-URC-1/2/3 × 2 stores + 7 cross-store invariants I-WR-1..7 + CI-grep enforcement sketch mirroring SR-6/EAL precedent). **PRF-G4-CI** (`docs/projects/printable-refresher/content-drift-ci.md` — 6 CI checks: contentHash-vs-recomputation [RT-108 core], source-util whitelist+blacklist, CD forbidden-string grep, schemaVersion-bump discipline w/ proseOnlyEdit escape hatch, markdown-vs-generated precedence, lineage-footer completeness; manifest shape v1; Phase 5 implementation checklist 9 items; developer-experience troubleshooting section). **PRF-G4-SL** (`docs/projects/printable-refresher/selectors.md` — 6 selectors [`selectAllCards`/`selectActiveCards`/`selectPinnedCards`/`selectSuppressedCards`/`selectCardsForBatchPrint`/`selectStaleCards`]; 4 state-clear-asymmetry roundtrip tests with un-suppress roundtrip as canonical zero-data-loss proof; memoization contract + renderer coupling rules). **Non-negotiable sequencing ratified:** PRF-G4-CI spec complete but **test implementation must be green BEFORE any Gate 5 card-authoring PR merges** — Phase A/B/C all gate on `contentDrift.test.js` passing in main. Handoff: `.claude/handoffs/printable-refresher-session4.md`.
- **2026-04-24 — I-WR-2 (Reference-mode write-silence) identified as the load-bearing invariant for the refresher writer registry.** The three writers W-URC-1/2/3 are the only allowed mutations from refresher surfaces; none of them mutate skill-state stores under `currentIntent: 'Reference'`. This is structurally segregated — refresher writers touch only `userRefresherConfig` + `printBatches`. Test PRF-G5-RI spies on reducer dispatch from `PrintableRefresherView` mounts and asserts zero skill-state mutations. If a future writer is added that would mutate skill-state, it must either be re-classified out of the refresher surface OR dispatch `currentIntent: 'Deliberate'` first per red line #17 (intent-switch mandatory). This is the clearest instance to date of a doctrine where "who can write what under which intent" is a first-class invariant rather than an implementation detail.
- **2026-04-24 — Gate 4 design-side closeout batch SHIPPED (Session 5).** Two docs shipped: **PRF-G4-J** (`docs/design/journeys/refresher-print-and-re-print.md`) — 5 variations: A first-print (8-step catalog→confirm→browser flow) / B stamp-date capture sub-flow / C engine-changes silent-transition with no UI / D in-app-diff staleness discovery / E re-print loop pre-selecting stale subset only. Variation F placeholder for Phase 2+ coach-curated pack apprentice path. 8 AP-PRF refusals enumerated at journey level. 17 red-line per-line compliance assertions mapped. Copy-discipline ✓/✗ demonstrations per variation showing CD-1/CD-3 compliance under paper-permanence pressure. 7 Playwright evidence placeholders. **PRF-G4-S2** (`docs/design/surfaces/printable-refresher-card-templates.md`) — 4 templates (Preflop / Math / Equity / Exceptions) with layout + required manifest fields + H-PM05 atomicity justification + F1-F6 fidelity compliance + known risks per class. Shared Regions 1-6 anatomy including Region 6 card-corner physical version-stamp for H-PM07 laminate cross-reference (survives lamination glare at arm's length). `TEMPLATE_BY_CLASS` dispatcher maps manifest class → template component. Handoff: `.claude/handoffs/printable-refresher-session5.md`.
- **2026-04-24 — 3 critical design choices ratified in Variation D/E (journey).** (1) **Session-scoped banner dismissal, not persisted** — persistence would require "days-since-dismissal" counter which would slide into AP-PRF-03 / #5 engagement-pressure. Re-appearance on next app open is the intended behavior. (2) **Old batch NOT deleted on re-print** — `printBatches` is append-only per I-WR-5; re-printing writes a new batch that supersedes for `selectStaleCards` but old batches remain queryable for cards only in older batches. Storage minimal (~1KB/batch). (3) **Amber is the only staleness state** — no color escalation from amber → red at threshold N, no "⚠️ URGENT" framing at any count. 1 stale renders identically to 15 stale (modulo number). No false-precision "cards expire in 3 days" framing. These three pattern choices will show up in future refresher-adjacent surfaces — preserve them.
- **2026-04-25 — Gate 4 infrastructure closeout SHIPPED (Session 6); Gate 4 CLOSED.** Two final docs: **PRF-G4-CSS** (`docs/projects/printable-refresher/print-css-doctrine.md`) — `@page` rules + 4 layout grids (12-up default / 6-up / 4-up / 1-up across Letter + A4) + Regions 1-6 typography (10pt body floor / 8pt table floor / 6pt banned / 7pt corner stamp / 14pt title / 16pt ceiling) + 6-hue deuteranopia palette per-class assignment (preflop=navy / math=burnt-orange / equity=teal / exceptions=maroon; charcoal+ochre reserved for Phase 2+) + B&W fallback (`body[data-color-mode="bw"]` toggle + Playwright greyscale verification policy) + `@media print` doctrine including animation kill + WYSIWYG `.print-preview-container` wrapper + cross-browser test matrix (Chrome primary / Firefox secondary / Safari tertiary + Playwright `page.pdf()` Chromium ground truth + manual print-dialog at PR review) + bundle-import enforcement (`scripts/check-refresher-bundle.sh` forbids html2canvas / jspdf / pdf-lib imports in refresher code per V5 D5 ban). PRF-G5-PDF snapshot test contract: 4 grid modes × 2 page sizes × 2 color modes = 16 snapshots per MVP card. **PRF-G4-MIG** (`docs/projects/printable-refresher/idb-migration.md`) — additive migration adding 2 stores (`userRefresherConfig` singleton keypath `id: 'singleton'` + `printBatches` keypath `batchId: UUID v4` with `printedAt` index for `selectStaleCards` most-recent-batch lookup) + dynamic version target `max(currentVersion + 1, 18)` per Q6 + EAL gate4-p3-decisions §2 precedent (collision-free with Shape Language v18 + future MPMF claims) + idempotent (existence-check before create) + additive-only (zero mutation to v17 stores) + default singleton seeded at migration time with Phase 1 structural defaults (Letter / 12-up / auto / lineage-on / codex-OFF / staleness-notifications-OFF) + 6-test-case suite for PRF-G5-MIG (round-trip / seed / idempotent / no-v17-mutation / index / collision-resolution) + per-record schema versioning framework for future field additions + backup/export expansion inheriting EAL precedent. **Gate 4 CLOSED 2026-04-25** — all 12 carry-forwards COMPLETE: ACP + AP + CD + H + S1 + S2 + J + W + CI + SL + CSS + MIG. Project artifact count: 12 Gate 4 docs (5 in `docs/design/` + 7 in `docs/projects/printable-refresher/`). Handoff: `.claude/handoffs/printable-refresher-session6.md`.
- **2026-04-25 — Gate 5 sequencing finalized.** Phase 5 implementation MUST start with PRF-G5-CI (`contentDrift.test.js` + `cardRegistry.js` + `lineage.js` + `stalenessDiff.js`) before any card-authoring PR merges — non-negotiable per content-drift-ci.md spec. Recommended order: PRF-G5-CI infrastructure → PRF-G5-MIG migration → persistence + selector wiring → PRF-G5-RL/RI/DS/LG test scaffolds → PRF-G5-B Phase B Math Tables (6 cards, clear-starting-point) → Q5 differentiation-demo at design review → PRF-G5-A Phase A Preflop (conditional) → PRF-G5-C Phase C Equity + Exceptions (last; per-card Voice-3-equivalent fidelity review; equity bucket-definition glossary prerequisite) → PRF-G5-PDF Playwright cross-browser print-snapshots over MVP cards. **Phase 1 MVP card count target:** 6 (Phase B) + 0-3 (Phase A conditional) + 4 (Phase C) = **10-13 cards.** Phase C Plus-tier; Phase A free if differentiated; Phase B free / lead-gen.

---

## References

- Request origin: owner message 2026-04-24 (in conversation).
- Framework entry: `CLAUDE.md` §Design Program Guardrail.
- Lifecycle: `docs/design/LIFECYCLE.md` §Gate 1.
- Roundtable template: `docs/design/ROUNDTABLES.md`.
- Personas: `docs/design/personas/README.md` + individual persona files.
- JTBD atlas: `docs/design/jtbd/ATLAS.md` + Drills-and-Study + Cross-Cutting domains.
- Surface catalog: `docs/design/surfaces/CATALOG.md`.
- Parent surface (pending): `docs/design/surfaces/study-home.md` (not yet authored; decided as cross-project surface per Shape Language Gate 3 Q1).
- Fidelity guardrails: `.claude/context/POKER_THEORY.md`, root `CLAUDE.md` §Poker Analysis Guardrail, `src/utils/exploitEngine/CLAUDE.md`, `src/utils/rangeEngine/CLAUDE.md`, `feedback_reasoning_quality.md`, `feedback_first_principles_decisions.md` (both memory files).
- Autonomy red lines (9): `docs/design/personas/core/chris-live-player.md` §Autonomy constraint (inherited from Shape Language + EAL).
- Three-intent taxonomy: Shape Language Gate 3 decision memo `docs/projects/poker-shape-language/gate3-decision-memo.md` + `feedback_skill_assessment_core_competency.md`.
