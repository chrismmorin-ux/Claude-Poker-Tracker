# Surface — Postflop Drills

**ID:** `postflop-drills`
**Code paths:**
- `src/components/views/PostflopDrillsView/PostflopDrillsView.jsx` (87 lines — tab orchestrator)
- Shipped modes: `./LineMode.jsx` (Line Study — shipped 2026-04-20), `./ExplorerMode.jsx`
- WIP modes (F-W1): `./EstimateMode.jsx`, `./FrameworkMode.jsx`, `./LibraryMode.jsx`, `./LessonsMode.jsx`
- Line Study support: `./LinePicker.jsx`, `./LineWalkthrough.jsx`, `./LineNodeRenderer.jsx`, `./LineBranchBreadcrumb.jsx`, `./LineStateTracker.jsx`, `./SPIBadge.jsx`, `./SPITooltip.jsx`
- Explorer support: `./BoardPicker.jsx`, `./ContextPicker.jsx`, `./RangeFlopBreakdown.jsx`
- Core modules: `src/utils/drillContent/lines.js`, `./lineSchema.js`, `./studyPriorityIndex.js`, `./multiwayFrameworks.js`
- `src/utils/persistence/postflopDrillsStorage.js` — IDB per-drill-type history + aggregates

**Route / entry points:**
- `SCREEN.POSTFLOP_DRILLS` (routed via `uiReducer`).
- Opens from: floating button in `sessions-view`; direct nav.
- Closes to: `SCREEN.SESSIONS` via "Back to Sessions" button.

**Product line:** Main app **only** — drilling is an off-table activity; the Ignition sidebar has no drill counterpart by design (do not reopen sidebar-parity on drill tickets). [WS-229 F-DRILL-01 / D-3]
**Tier placement:** Plus+ (shipped). Advanced / full Line curriculum: Pro (per INVENTORY F-09).
**Last reviewed:** 2026-05-20 (Range Lab Gate 4 — Explorer Custom paint mode added)

---

## Purpose

Postflop range-vs-board + line-study trainer. **Six shipped tabs** (verified functional 2026-06-13, `audits/2026-06-13-dcomp-w3-drills-audit.md`): **Line** (branching street-by-street walkthroughs with Study Priority Index + multiway coverage, 8 lines / 85+ nodes / 14 frameworks — closed 2026-04-20), **Explorer** (pick preflop context + flop → full range breakdown + framework tags; hosts Range Lab custom paint), **Estimate**, **Framework**, **Library**, **Lessons**. (The 2026-04 "F-W1 WIP/stub" labels on Estimate/Framework/Library/Lessons are STALE — all four have since matured.)

> **⚠️ Pre-Session is NOT a shipped tab in `PostflopDrillsView` (status 2026-06-15, WS-229 F-DRILL-01 / C-1).** The "Pre-Session mode" section below, the `[Pre-Session]`-first tab bar in Anatomy, and the Pre-Session code-paths describe the **PSD Gate-4 TARGET design, not current shipped behavior**. `PostflopDrillsView.jsx` ships the six tabs above with **no Pre-Session entry**. Pre-Session is implemented as a separate `PresessionDrillView`, **feature-flagged OFF** (`ENABLE_PRESESSION_DRILL = false`), mid-lifecycle in the PSD project (live tickets WS-199/200/201). Read this section as a spec, not as documentation of running code.

The range-shape recognition surface: what does villain's range look like on this flop, and how does it evolve across streets?

## JTBD served

Primary:
- `JTBD-DS-43` 10-minute quick drill (Line: pick by SPI)
- `JTBD-DS-44` correct-answer reasoning — built into Line node reveals
- `JTBD-DS-48` understand villain's range composition as decision driver — served by `bucket-ev-panel-v2` P1 post-Path-2 restructure
- `JTBD-DS-49` weighted-total EV decomposition — served by `bucket-ev-panel-v2` P2 (`WeightedTotalTable`)
- `JTBD-DS-50` walk a hand line branch-by-branch (Line Study — promoted from implicit 2026-04-22)
- `JTBD-DS-51` range-shape recognition (Explorer + Line per-node decomposition — promoted from implicit 2026-04-22)
- `JTBD-DS-62` recency-weighted drill selection from recent leaks (Pre-Session mode — authored by Gate 3 2026-05-19; selection-only, no streak/mastery surfaces per A-AP1)
- `JTBD-DS-63` anchor-trace from drill card to deep artifact (Pre-Session mode — authored by Gate 3 2026-05-19; in-app artifact-renderer per ADR-006)
- `JTBD-SE-01` prepare tonight's watchlist (Pre-Session prep mode — canonical in `session-entry.md`, authored 2026-04-23 by exploit-deviation Gate 3)
- `JTBD-SE-02` review drill predictions against session outcomes (Pre-Session review mode — canonical in `session-entry.md`; closes the prep ↔ session ↔ review loop)
- `JTBD-SE-03` scale commitment to a specific deviation via drill-side dial (Pre-Session prep mode — canonical in `session-entry.md`)
- `JTBD-MH-06` multiway range-vs-ranges equity on flop (Explorer + Line multiway)
- `JTBD-DS-64` paint a custom range from scratch (Explorer Custom mode — Range Lab Gate 4, Phase 1-2)
- `JTBD-DS-65` compare two ranges with delta highlighting (Explorer Custom mode — Range Lab Phase 2)
- `JTBD-DS-66` per-street range evolution from the betting line (Range Lab Phase 3+; surface-contracted, AP-RL-01 binding)
- `JTBD-DS-67` validate authored drill/line-study content against the engine (Range Lab Phase 3+; INV-LSW-RL-EQUITY-PARITY binding)

Secondary:
- `JTBD-MH-09` SPR-aware strategy cues — surfaced as SPI annotations
- `JTBD-DS-45` custom drill from own history — not served (F-P13 proposed)
- `JTBD-DS-47` skill map — not served

## Personas served

- [Scholar (drills only)](../personas/core/scholar-drills-only.md) — primary
- [Study block](../personas/situational/study-block.md) — situational primary
- [Pre-Session preparer](../personas/situational/presession-preparer.md) — situational primary for **Pre-Session mode** (5/15/30-min prep + 48h review window). Bidirectional persona per founder D1; sibling of `post-session-chris` (different scope — drill-prediction-specific vs general session review). Apprentice depth-tolerance handled by skim-tolerant card-back content discipline (Gate 3 A-R3).
- [First-principles learner](../personas/situational/first-principles-learner.md) — situational primary for the bucket-ev-panel-v2 restructure (range-first cognition habit formation)
- [Apprentice](../personas/core/apprentice-student.md) — primary learner
- [Rounder](../personas/core/rounder.md), [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — session warm-up + targeted leak work
- [Coach](../personas/core/coach.md) — could assign Line Study lines as homework (proposed CO-51)
- [Returning after break](../personas/situational/returning-after-break.md) — situational; applies via Scholar + Apprentice (DS-55). **Currently UNSERVED** by this surface: no gap-detection, welcome-back affordance, or staleness cue exists yet (WS-229 A-3 / C-5). Listed for coverage honesty; the welcome-back surface is future work.
- [Between-hands driller](../personas/situational/between-hands-driller.md) — situational; the live-table user stealing a quick rep in dead time. **Currently UNSERVED** (no ≤30s cold-entry path; WS-229 A-2 / C-4). Authored for coverage honesty; a "quick rep" entry is future nav work.

### Explicit non-goal persona — the scored solver-trainer grinder (WS-229 A-1 / BS-1)

**This surface deliberately does NOT serve the high-volume, solver-scored, EV-loss-quantified "GTO trainer grinder"** — the dominant archetype of GTO Wizard Trainer / DTO / scored PokerCoaching, who wants to grind hundreds of hands against a visible accuracy curve and an EV-loss number. That loop requires exactly the scored-accuracy curves, streaks, and mastery scores the project's autonomy doctrine refuses by design ([[feedback_scf_learning_state_not_tier_rank]], [[feedback_owner_volunteered_grading]]). This is a **positioning decision, not an oversight**: the drills teach *reasoning* (why the answer is right, range-first) rather than *score* it. Recording it here so the decision is explicit and a future "add scored mode for retention" ticket confronts the strategic line rather than sliding past Gate 1. The autonomy-safe slice of the underlying "am I improving?" outcome is served instead by **DS-68** (non-gamified competence trend).

---

## Anatomy

```
┌──────────────────────────────────────────────────────────────┐
│ Postflop Drills — range-vs-board trainer   [Back to Sessions]│
├──────────────────────────────────────────────────────────────┤
│ Tab bar:                                                     │
│   [Pre-Session] [Line] [Range Explorer] [Estimate Drill]     │
│   [Framework Drill] [Library] [Lessons]                      │
├──────────────────────────────────────────────────────────────┤
│ Mode content:                                                │
│                                                              │
│   Pre-Session: TimeBudgetPicker (5/15/30) + MoodPicker       │
│                (stuck/neutral/heater) → FlipCardRunner       │
│                  Front: spot + prompt + "Tap to flip"        │
│                  Back:  action + 3 reasoning beats           │
│                       + falsification criterion              │
│                       + section anchors (→ artifact viewer)  │
│                       + tri-state self-grade                 │
│                  Bottom-bar primary action: state-aware      │
│                  (Flip → Got it/Partial/Missed → Next)       │
│                                                              │
│   Line:     LinePicker (SPI sort + filters) → LineWalkthrough│
│             LineBranchBreadcrumb  ·  LineStateTracker        │
│             LineNodeRenderer (prose + why + adjust + mismatch│
│               + branch rationale)                            │
│                                                              │
│   Explorer: Range source [Archetype | Custom]                │
│             Archetype → ContextPicker → BoardPicker          │
│             Custom    → 13×13 paint grid (Range Lab)         │
│             → BoardPicker (3–5 cards) → RangeFlopBreakdown    │
│             (framework tags + range shapes + decompositions  │
│              + filter + histogram + compare)                 │
│                                                              │
│   Estimate / Framework / Library / Lessons:                  │
│             WIP scaffolds / stubs (F-W1)                     │
└──────────────────────────────────────────────────────────────┘
```

Tab placement rationale (Pre-Session first, founder ratification 2026-05-19): Pre-Session is the primary daily workflow for `presession-preparer` — opening the app on the way to a venue. Leftmost slot maximises one-tap discovery. Existing modes (Line, Explorer) retain ordering; Pre-Session prepends rather than reorders.

## State

- **UI (`useUI`):** `setCurrentScreen`, `SCREEN`.
- **Local:** `activeTab` (defaults to `'presession'` when entering via the SessionsView "Pre-Session Drill" inline button or HandReplay "Queue for tomorrow's PSD" deferred-launch; otherwise `'explorer'` per pre-PSD default).
- **Line Mode local state:** selected line, current node, path so far, filters (HU/MW, pot-type, board-texture).
- **Explorer local state:** range source (`archetype | custom`); for archetype: preflop context (position / pot type / aggressor); for custom (Range Lab): painted range (`Float64Array` per-combo weights) + per-stroke undo/redo stacks + paint-dirty flag + active sub-mode (`filter | histogram | compare`) + compare-second-range; board (3–5 cards), breakdown view.
- **Pre-Session local state:** time-budget variant (5/15/30), mood (user-declared toggle per Gate 2 C-A6 fallback — auto-detection deferred to WS-201), selection mode (prep / review), card cursor, per-card self-grade (`got-it | partial | missed | not-attempted`), retry-later queue, artifact-viewer state (open card, anchor target).
- Writes: drill attempts + aggregates to IDB per-tab (`drillType='line'` for Line Mode, `drillType='recipe'` for Recipe-style, `drillType='presession'` for Pre-Session). See `.claude/context/DRILL_VIEWS.md` §3. **Pre-Session writes only the per-card self-grade + completion timestamp + selected-card-IDs (no streak counters, no mastery score, no tier label — per Gate 2 E-A5 + A-AP1).**

## Props / context contract

- `scale: number` — viewport scale.

## Key interactions

1. **Line → pick line in LinePicker** → LineWalkthrough renders from root node.
2. **Line → at decision node: tap a branch** → see full rationale (prose / why / adjust / mismatch accents) → advance.
3. **Line → breadcrumb click** → retry from a past node; path truncates + reveal clears.
4. **Line → SPI badge tap** → SPITooltip shows three-factor breakdown (reach probability × consequence × population-error) + dominant-node.
5. **Explorer → pick preflop context + flop** → full range-breakdown output.
6. **Switch tab** → current mode state is discarded (tabs are not cross-pinned).

---

## Known behavior notes

- **Line Study infrastructure (2026-04-20):** schema + validator + DAG walker (`walkLine`, `lineStats`), SPI module (`studyPriorityIndex.js`), 8 authored lines (5 HU + 3 MW), 14 frameworks (7 base + 7 MW), 6 MW lessons. 200/200 postflop drill tests green at close.
- **Multiway frameworks** merged into the main registry; MW filter in LinePicker narrows to MW lines.
- **Chrome budget** — ≤180 px at 1600×720 (RT-105). Current chrome ~120 px.
- **Hook hoisting rule** applies (RT-104 / DRILL_VIEWS.md §2).
- **Aggregate shape mismatch** vs preflop aggregate documented (RT-100 / DRILL_VIEWS.md §4) — postflop lacks `avgDelta` / `deltaSamples`.
- **Prototype-pollution hardening** applied to aggregation (RT-96) — `Object.create(null)`.

## Known issues

- **F-W1** — Estimate / Framework / Library / Lessons tabs are scaffolds or stubs.
- **Drills Consolidation Proposal — RESOLVED 2026-06-15 (WS-230 Gate 3): keep the by-street split; defer consolidation.** The WS-229 roundtable re-opened the tab-taxonomy question (all 3 voices found the 14-tab structure fragmenting; market voice favored "few modes + a configurator" along a learning-mode axis). Founder decision (2026-06-15): **do NOT re-architect now.** Rationale: the surfaces all work, the worst cross-view confusion (the Explorer false-friend) is already fixed (WS-231 F-DRILL-03), and a learning-mode-axis rewrite is a large, risky refactor. Invest instead in **leak-targeted navigation** (the DS-45 leak→drill bridge + a "what should I drill today?" entry — see DS-45). Revisit consolidation later **with real usage evidence**, not speculatively. The original 6 deferred layout/refactor items stay deferred; **do NOT scaffold `StudyView`** (hold stands).
- Wave 3 audit (drills) will Gate-2 roundtable: Scholar persona is unserved today, WIP tab fate must be decided, and potential consolidation trade-offs are real.

## Potentially missing

- **Custom drill from own history** (F-P13 / DS-45) — not served.
- **Spaced repetition** (DS-46) — not served.
- **Skill map / mastery** (F-P12 / DS-47) — not served.
- **Cross-surface coaching deep-link** (CO-51) — proposed; would flow from analysis-view / hand-replay-view to a targeted Line or Explorer scenario.
- **Performance telemetry** on drill completion — no aggregate view of "what am I bad at" across both drill views.

---

## Test coverage

- `studyPriorityIndex`, `lines`, `lineSchema`, `multiwayFrameworks` all have unit tests — 200/200 passing as of Line Study close.
- Explorer + Line picker components have component-level tests.
- Persistence shape documented; aggregate functions tested.

## Related surfaces

- `sessions-view` — entry.
- `preflop-drills` — sibling; mirrors tab structure with preflop-native modes.
- `analysis-view` — source of weaknesses the drills *could* target if F-P13 ships.
- `hand-replay-view` — candidate source of "study this line" deep-links.
- `skill-assessment-test` — opt-in-test mode of this drill engine (SCF Phase 5; see Opt-in-test mode subsection below).
- `lesson-card` — entry path for opt-in-test mode (`Test myself on this concept` button on lesson card invokes this engine scoped to the lesson's `frameworkIds[]`).

---

## Opt-in-test mode (SCF Gate 4 extension, 2026-05-02)

**Added by:** SCF Gate 4 (WS-012 / SPR-020). See `audits/2026-05-02-gate4-design-self-coach-foundation.md` §SCF-G4-S4 + `surfaces/skill-assessment-test.md` for the full spec.

This drill view gains an opt-in-test MODE for SCF self-coach use. Per the owner's architectural binding ("drills + tests overlap; don't maintain two parallel learning environments"), opt-in-test is a MODE of this engine, not a new engine. Three deltas vs default scheduler-driven flow:

| Delta | Default flow | Opt-in-test mode |
|---|---|---|
| **Entry path** | Library browse + scheduler-driven `pickNextMatchup` | `Test myself on this concept` button on lesson card (in SelfCoachView Curriculum section) |
| **Result framing** | CD-2 default — observed/non-graded vocabulary | CD-2 nuance permitted — factual grading vocabulary ("3 of 5 correct") via `cd5_exempt: 'owner-volunteered-test'` manifest flag on result-display surface |
| **Persistence tag** | `scheduler.frameworkAccuracy[id]` (behavioral signal) | ALSO writes `userSettings.perDomainMastery[conceptId].testResults[]` (subset signal) |

**Drill scheduler scoping in opt-in-test mode.** Filters scenario library to entries whose `frameworkId` is in the lesson's `frameworkIds[]`. Within filtered subset, picks 5 with recency penalty so retakes don't repeat the prior attempt's questions.

**Result-display surface (NEW UI element for opt-in-test mode).** After 5-question quiz completes, renders factual count: "{N} of {M} correct". Optional per-question correct/incorrect breakdown. 2 affordances: `Close` (returns to lesson card) + `Take again` (relaunches in opt-in-test mode for same concept). Surface manifest declares `cd5_exempt: 'owner-volunteered-test'`; CI-lint allows the grading-vocabulary subset on this surface only.

Coverage in v1: 4 of 5 SCF v1 reference lessons map to postflop drill substrate (range-vs-range-thinking, board-texture, capped-vs-uncapped-ranges, partial blocker-effects). Implementation deferred to SCF Gate 5.

---

## Pre-Session mode (PSD Gate 4 extension, 2026-05-19)

**Added by:** PSD Gate 4 (WS-199 / SPR-092). Inherits from Gate 2 Blind-Spot Roundtable (`audits/2026-05-19-blindspot-pre-session-drill.md`) + ADR-005 (active-recall flip-card) + ADR-006 (in-app anchor-trace bundle) + Gate 3 Research (`audits/2026-05-19-research-psd-gate3.md`).

**v1 scope baseline (founder ratification D2, 2026-05-19):** 1600×720 landscape. Mobile-portrait variant is a separate Gate 4 deliverable (WS-200) tracked as the immediate follow-up.

**Do NOT author `docs/design/surfaces/pre-session-drill.md`** — rejected by Gate 1 + reconfirmed at Gate 2 (Drills Consolidation hold remains rejected). Pre-Session is a MODE inside `PostflopDrillsView`, not a routed view.

### What Pre-Session does

Delivers compressed active-recall **drill cards** to the user in a time-bounded window (5 / 15 / 30 min) before a live cash session or after one (review mode within 48h). Each card is sourced mechanically from the upper-surface reasoning-artifact corpus (`docs/upper-surface/reasoning-artifacts/`, 15 artifacts as of 2026-05-11 — minimum-meaningful threshold per Gate 1; target ≥50 at corpus saturation). Front: spot + prompt. Back: action + 3 reasoning beats + falsification criterion + section anchors back into the source artifact + tri-state self-grade.

Selection is **recency-weighted** (recent leaks → DS-62) and **frequency-weighted** (common spots). Selection layer also accepts mood-bias input: stuck-mode biases winnable spots, heater-mode biases edge-case challenges. **Mood-bias affects card mix only — surface tone stays neutral (Gate 2 C-A3, A-AP1).**

PSD is **bidirectional** by founder ratification D1: same surface, two modes — **prep** (pre-session) and **review** (post-session, within ~48h). Same `presession-preparer` situational persona spans both. Review-mode closes the loop: which predictions fired, which got caught, which were missed. Sibling to `post-session-chris` (general post-session review); PSD-review is the drill-prediction-specific cut (Gate 3 A-R1).

### Time-budget variants

| Variant | Card count | Per-card budget | Depth tolerance |
|---|---|---|---|
| **5-min** | 5 cards | ~60 s/card (RPD floor for predict-then-flip) | Skim-tolerant card-back; falsifier headline first, citation paragraph second, anchor-trace links last (C-A2) |
| **15-min** | 5–7 cards | ~120 s/card | Same skim discipline; user has time to read citation paragraph in full |
| **30-min** | 10–15 cards | ~120 s/card | **Adds card count, NOT card depth (C-A4 depth cap).** Each card stays the same shape — more cards rather than longer cards. Prevents PSD-as-Study-Block contamination per the persona's non-goals. |

Founder ratification PSP-1: the 5 / 15 / 30 buckets are canonical for v1. No alternative bucket scheme.

### Card layout (per ADR-005 — flip-card)

```
┌─ FRONT ───────────────────────────────────┐    ┌─ BACK ────────────────────────────────────┐
│                                           │    │  ACTION:  Check-raise to 3.2x             │
│  Spot                                     │    │  ─────────────────────────────────────    │
│  ─────                                    │    │  REASONING                                │
│  Hero · BB · 100bb deep                   │    │   • Range advantage tilts BB on K72r —    │
│  UTG opens 2.5bb; SB folds.               │    │     hero has K7s/K2s/72s combos UTG       │
│  Flop K♣7♦2♥, hero checks, UTG bets 4bb.  │    │     doesn't (Klein 2024 §11.4).           │
│                                           │    │   • UTG c-bet frequency on dry low-board  │
│  PROMPT                                   │    │     spans wide range — value-heavy combos │
│  ──────                                   │    │     pay 3.2x with little reduction.       │
│  What's the maximally exploitative        │    │   • 3.2x leaves SPR ≈ 1.0 by river — fold │
│  action on this flop?                     │    │     equity stays meaningful on turn shoves.│
│                                           │    │                                            │
│           [ Tap to flip ]                 │    │  FALSIFIER                                │
│                                           │    │   ✘ If UTG opens <12% from UTG, range     │
│                                           │    │     advantage flips and check-call is     │
│                                           │    │     correct.                              │
│                                           │    │                                            │
│                                           │    │  ANCHORS                                  │
│                                           │    │   → §11.4 BB range advantage by texture   │
│                                           │    │   → §13 leading-theory comparison         │
│                                           │    │                                            │
│                                           │    │  Self-grade:                              │
│                                           │    │   [Got it] [Partial] [Missed]             │
└───────────────────────────────────────────┘    └───────────────────────────────────────────┘
                                                                                              ▲
   primary bar:  [ Flip ]                          primary bar:  [ Got it / Partial / Missed ] → [ Next ]
```

**Layout invariants (Gate 2 E-A1):**
- Flip-card body is the dominant tap target. No competing buttons inside the card body.
- Anchor links (DS-63) render in their own region at the bottom of the back face — tap routes to the in-app artifact viewer per ADR-006.
- Tri-state self-grade buttons (E-A4) are a separate region below anchors. Grade is **retract-able until card closes**; no destructive binary commit.

### State-aware primary actions (E-A3)

The bottom-bar primary action label shifts with card state:

| Card state | Primary action | Behavior |
|---|---|---|
| Pre-flip | `Flip` | Reveals the back face. Non-destructive. |
| Post-flip, ungraded | `Got it` / `Partial` / `Missed` (tri-state) | Records self-grade. Each is a single button; user picks one. Retract by re-tapping or tapping a different grade until card closes. |
| Post-flip, graded | `Next` | Advances to next card. Records "card closed" timestamp; self-grade becomes final. |

No generic "Continue" label at any state. The primary action always names the state-appropriate verb.

### No destructive skip (E-A2)

If the user taps "Next" mid-prediction (before flipping), the card auto-marks as **not-attempted** and re-queues to the end of the retry-later queue. No silent dismissal; nothing is lost. This is the same recovery path as phone-sleep mid-card (C-A5): missed card → not-attempted → retry-later queue.

### Tri-state self-grade (E-A4)

Three options: `Got it` / `Partial` / `Missed`. Three reasons (per Gate 2 Behavioral Psychologist voice):
- Binary commits trigger over-self-criticism in stuck-mode users; tri-state offers an escape from the binary.
- Partial captures the common case of "I got the action right but missed one reasoning beat" — a true reflection of card-level recognition.
- Retract until card closes; the user can change their mind before advancing.

### Mood-aware selection (C-A3, not framing)

User-declared mood toggle (PSP-2 v1 fallback — auto-detection deferred to WS-201): `Stuck` / `Neutral` / `Heater`.

| Mood | Selection bias | Surface impact |
|---|---|---|
| **Stuck** | Bias toward winnable spots (spots hero has been crushing in recent sessions) | None — surface tone neutral |
| **Neutral** | Pure recency × frequency weighting | None |
| **Heater** | Bias toward edge-case challenges (spots hero has only seen 1-3 times, low confidence band) | None — surface tone neutral |

**The mood-aware adjustment lives in the selection algorithm, NOT in the surface chrome.** No "great work today!" copy in stuck mode, no "let's push harder!" copy in heater mode. Per Gate 2 Autonomy Auditor voice + A-AP1 binding.

### Phone-sleep recovery (C-A5)

If the device sleeps mid-card (e.g., phone in pocket between cab + venue), the in-progress card auto-marks as **not-attempted** on next foreground and re-queues to the end of the retry-later queue. Same recovery as destructive-skip (E-A2). The user resumes at the next card in sequence; the dropped card surfaces at the end.

### Neutral chrome (E-A5, A-AP1 binding)

**Forbidden surface elements** (binding via [[feedback_scf_learning_state_not_tier_rank]] + [[feedback_owner_volunteered_grading]]):
- ✗ Streak counters ("3 days in a row!")
- ✗ Mastery scores ("Your range-shape mastery: 78%")
- ✗ Leaderboards / comparison to "other players"
- ✗ Tier badges ("Bronze leak-fixer")
- ✗ Shame copy ("you missed this spot last session too")
- ✗ Congratulatory inflation ("amazing! 100% accuracy!")
- ✗ Streak-protection nudges ("don't break your streak!")

**Allowed chrome:**
- ✓ Citation strings on the card back ("Klein 2024 §11.4")
- ✓ Per-card self-grade (Got it / Partial / Missed) — opt-in via user tap, not system-imposed
- ✓ Variant + mood pickers (Time budget, Mood) — user-declared, not algorithm-asserted
- ✓ Card count progress ("3 of 5") — factual position, not gamified completion
- ✓ Retry-later queue size ("2 cards retry-later") — factual count

**Review-mode chrome (PSP-3 binding, 48h window):**
- ✓ Factual prediction-vs-outcome listing: "Card 2 (KQs OOP on Axx low) — you predicted check-call, you actually check-raised, outcome was 3-bet fold (favorable). Citation: §7.2 mismatched-protect lines."
- ✗ Aggregate scores ("3 of 5 correct overall")
- ✗ Trend lines ("you're getting better at protect lines")
- ✓ Per-card resolution status (`Match` / `Mismatch — favorable` / `Mismatch — unfavorable` / `Did not occur in session`)

### Anchor-trace navigation (DS-63 per ADR-006)

Tap an anchor link on the card back (e.g., `→ §11.4 BB range advantage by texture`) → navigates to the in-app artifact viewer with that section pre-scrolled. Back button returns to the card with state preserved (self-grade unchanged, card not closed).

**In-app implementation (ADR-006):** `docs/upper-surface/` is bundled into the app via Vite `import.meta.glob` (precedent: SPR-087 / WS-193 spotResolver `corpusIndex.js`). Bundle size ~150 KB at v1 (15 artifacts × ~10 KB); ~500 KB projected at corpus saturation (50 artifacts). Lazy-loaded via dynamic import on first anchor-tap.

**Section anchor format:** Markdown heading IDs (kebab-case slugs, e.g., `#bb-range-advantage-by-texture`). Pre-built index for O(1) lookup at viewer mount.

**Renderer ownership:** PSD owns the in-app artifact renderer. If Range Lab Gate 4 (WS-053 cascade) later wants in-app artifact rendering, it **inherits** PSD's renderer rather than the reverse (per ADR-006 dependency direction).

### Card-back content discipline (C-A2)

Card backs MUST be authored with a fixed three-region order, optimized for skim-tolerance at 1-min/card budgets:

1. **Falsifier headline** (top, ~1 line) — the single condition under which the recommended action is wrong. Pure summary; no citation.
2. **Citation paragraph** (middle, ~3-4 lines) — three reasoning beats with inline artifact citations.
3. **Anchor links** (bottom, ~1-2 lines) — section anchors back into the source artifact for opt-in depth.

A user with 30 s left on the per-card budget should be able to read the falsifier headline alone and recover ~70% of the card's coachable value. Citation depth is opt-in; anchor-trace is opt-in. Depth is *available*, not *required* (Gate 3 A-R3 Apprentice-resolution).

### Selection algorithm (DS-62 + recency × frequency × mood)

```
candidate_set = corpus  # 15 → ~50 reasoning artifacts at saturation
                .filter(time_budget_compatible)  # card matches variant card-count + per-card budget
                .filter(not_in_recent_retry_queue)  # avoid back-to-back repetition
score(card) = w_recency * recency_signal(card, recent_leaks)
            + w_frequency * frequency_signal(card, recent_sessions)
            + w_mood * mood_bias(card, declared_mood)
selected = top-N(score, time_budget.card_count)
            with consecutive_repeat_cap_N  # cap per Gate 2 D Behavioral Psychologist
```

Weights (`w_recency`, `w_frequency`, `w_mood`) and `consecutive_repeat_cap_N` are tuning parameters; Gate 5 implementation must surface them as named constants, not magic numbers.

**`recent_leaks` source:** hands ↔ upper-surface-node-ID cross-reference (WS-198, Phase-0 engineering prerequisite for full DS-62 function; PSD ships pre-WS-198 with `recent_leaks = empty` fallback → pure frequency × mood selection).

**`consecutive_repeat_cap_N`:** if the same card scored "Missed" today and again tomorrow and again the day after, the algorithm caps it at N = 3 consecutive presentations before deprioritizing. Prevents the "drill keeps rubbing my face in failure" failure mode (Gate 2 D Behavioral Psychologist).

### Mode entry points

| Source surface | Affordance | Initial state |
|---|---|---|
| `sessions-view` action row | Inline `Pre-Session Drill` button | activeTab=`'presession'`, mode=`prep`, variant=user-picks |
| `hand-replay-view` per-step overflow menu (`⋮`) | Context-menu item `Queue for tomorrow's PSD` | Adds current decision's anchor-node to the user's "queued spots" set for next prep-mode session; does NOT navigate. Toast: "Queued for next Pre-Session Drill" with Undo. |
| Postflop Drills mode-bar (direct) | `[Pre-Session]` tab — leftmost slot | activeTab=`'presession'`; on first entry, prompts variant + mood picker |

The HandReplay → PSD flow is **deferred-launch**: tapping the menu item flags the spot for inclusion in the next prep-mode session, then closes the menu. It does NOT open PSD immediately. This honors the loop-closure pattern (Gate 2 D-P3 Pro Coach): post-session review → flag spot → tomorrow's PSD includes it → drill prediction → tomorrow's session → outcome review.

### State machine

```
        ┌─────────────┐
        │ ModePicker  │  ← user picks prep | review, variant (5/15/30), mood
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │  Selection  │  ← algorithm above; produces ordered card cursor
        └──────┬──────┘
               │
   ┌───────────▼──────────┐
   │   FlipCardRunner     │
   │  (per-card session)  │
   │                      │
   │   pre-flip ──Flip──▶ post-flip ──grade──▶ post-grade ──Next──▶ next card
   │       │                 │                                │
   │       │  Next (no flip) │                                │
   │       └─────────────────┘                                │
   │       │                 (auto-mark not-attempted,        │
   │       │                  re-queue to end)                │
   │       │                                                  │
   │       │  phone sleep / app background                    │
   │       └──────────────────────────────────────────────────┘
   │                                                          │
   └──────────────────────────────────────────────────────────┘
                                                              │
                                                              ▼
                                                       ┌────────────┐
                                                       │  Complete  │  ← all cards closed, retry-later queue empty
                                                       └────────────┘
```

**Review-mode delta:** card cursor consumes the same set the user drilled in the most-recent prep session (within 48h window); each card-back additionally renders prediction-vs-outcome resolution (per the chrome rules above).

### Adjacent surface dependencies

| Adjacent surface | Coupling | Status |
|---|---|---|
| `sessions-view` | Inline `Pre-Session Drill` button in action row | Updated this gate (see `sessions-view.md`) |
| `hand-replay-view` | Per-step overflow menu `Queue for tomorrow's PSD` | Updated this gate (see `hand-replay-view.md`) |
| `postflop-drills` (this surface) | New mode tab, leftmost slot | Updated this gate |
| In-app artifact viewer | DS-63 destination per ADR-006 | New sub-surface authored at Gate 5 — bundles `docs/upper-surface/` |
| `hands` ↔ node-ID cross-reference | WS-198 prerequisite for DS-62 recency-signal | Independent engineering ticket; PSD ships with frequency-only fallback pre-WS-198 |

### Test-coverage expectations (Gate 5 scope)

- Selection algorithm with synthetic corpus + synthetic recent-leaks set — assert ordering invariants (recency × frequency × mood scoring; consecutive-repeat cap).
- Card-runner state machine — pre-flip → post-flip → graded → next; auto-mark not-attempted on Next-mid-prediction; auto-mark not-attempted on background; retract self-grade until card closes.
- Mood-bias invariant: surface text identical across all three mood settings (selection differs, framing does not).
- Neutral-chrome lint: CI-grep against forbidden patterns (streak / mastery / leaderboard / tier-badge / shame-copy / congratulatory-inflation) — same gate as SCF surfaces.
- Anchor-trace navigation: artifact viewer mounts on first anchor-tap with correct section pre-scrolled; back returns to card with state preserved.
- Phone-sleep recovery: simulate visibility-change during pre-flip + post-flip + graded — assert correct re-queue behavior at each state.
- Review-mode prediction-vs-outcome resolution: synthetic prediction set + synthetic session outcomes → assert per-card resolution status renders correctly (Match / Mismatch favorable / Mismatch unfavorable / Did not occur).

### Mobile-portrait variant (WS-200, separate Gate 4 deliverable)

Mobile-portrait is a separate Gate 4 surface ticket (WS-200), authored as a follow-up. Reflow constraints documented there. Flip-card pattern preserves cleanly under single-column-stack (per ADR-005 Positive consequence); mode-picker and self-grade affordances will need portrait-specific layout work.

---

## Range Lab (Explorer expansion — Gate 4 extension, 2026-05-20)

**Added by:** Range Lab Gate 4 (WS-055 / SPR-098). Inherits from Gate 2 Blind-Spot Roundtable (`audits/2026-05-20-blindspot-range-lab.md`) + Gate 3 JTBDs (DS-64/65/66/67 in `../jtbd/domains/drills-and-study.md`) + [ADR-007](../../adr/ADR-007-rl-paint-primitive.md) (paint primitive) + [ADR-008](../../adr/ADR-008-rl-undo-stack.md) (undo stack).

**Structural placement (founder ratification, SPR-098):** Range Lab is **NOT a new tab and NOT a new routed view** — it is an expansion *inside* the existing **Explorer** mode (Gate 1 ratification: "expand ExplorerMode, no new view"; Drills Consolidation hold remains rejected). Explorer gains a **range-source toggle**: `Archetype` (the current `ContextPicker` flow) vs `Custom` (the new paint flow). All Range Lab capabilities render in Explorer's existing content area. **Do NOT author `docs/design/surfaces/range-lab.md`.**

**v1 scope baseline (Gate 2 Q4 + Q1):** 1600×720 landscape. Phases 1-2 (Flopzilla parity) are v1; Phases 3+ (AI-native) are surface-contracted here but implementation-deferred. Mobile-portrait variant is a separate Gate-4 deliverable (WS-208).

### What Range Lab does

Replaces the earlier Flopzilla-integration proposal with a native in-app range-study capability that matches Flopzilla's parity features and exceeds them via the app's Bayesian/tendency pipeline. The user paints an arbitrary 13×13 range with per-combo weights on any street, then sees range composition, per-bucket equity, filters, an equity histogram, range comparison, and (Phase 3+) per-street range evolution + authored-content validation. Explorer already ships ~70% of the parity capability (range-vs-board breakdown); Range Lab adds the interactive authoring layer on top.

### Range source toggle (Anatomy delta inside Explorer)

```
┌─ Explorer mode ───────────────────────────────────────────────┐
│ Range source:  [ Archetype ]  [ Custom ]        • Range not saved│
│ ───────────────────────────────────────────────────────────── │
│  Archetype → ContextPicker (position / pot type / aggressor)   │
│  Custom    → 13×13 paint grid + sub-mode controls:             │
│                [ Filter ]  [ Histogram ]  [ Compare with… ]    │
│                                                                │
│   ┌────────────── 13×13 paint grid ──────────────┐            │
│   │ AA  AKs AQs … (suited upper-right triangle)   │            │
│   │ AKo KK  …                                     │            │
│   │ …            (pairs on diagonal, offsuit LL)  │            │
│   └───────────────────────────────────────────────┘            │
│   BoardPicker (3–5 cards)  →  RangeFlopBreakdown output         │
│   primary bar: [ Save Range ] (state-aware — see E-A4)         │
└────────────────────────────────────────────────────────────────┘
```

The `BoardPicker` extends from 3-card (flop) to 5-card (turn/river) support. `RangeFlopBreakdown` (and siblings) render the composition / equity / filter / histogram / comparison outputs for the painted range exactly as they do today for archetype ranges — no separate render path.

### Paint interaction (ADR-007)

- **Tap a cell:** empty → included @ 100%; included → excluded (weight 0). One tap = one undo entry.
- **Long-press a cell (≥400ms):** opens an in-place weight slider. `Apply` commits (one undo entry); `Cancel` is non-mutating (zero entries).
- **Partial-weight cell rendering (Gate 4 decision, SPR-098):** cells with `0 < w < 1` render as **partial-fill height** — the cell fills bottom-up proportional to weight (a 50%-weight combo shows the bottom half filled in the include color). The grid reads as a tiny bar chart; weight is legible at a glance with no extra glyph, and the treatment scales down to mobile cell sizes. Full-include = solid fill; excluded = empty.
- **Scale-aware ergonomics (E-A9 / ADR-007):** when `scale × cellWidth < 44 DOM-px`, paint switches to **long-press-required for all actions** (tap misfires too easily at small cell sizes). WCAG ≥44×44 tap-target floor (inherited from SHC INV-DENSITY).

### Undo / clear (ADR-008)

- **Per-stroke undo**, session-scoped (cleared on reload / Explorer exit / Clear-all). `Cmd-Z` undo, `Cmd-Shift-Z` redo; redo stack cleared on any new mutation. Unbounded within session (typical < 200 strokes ≈ 6 KB).
- **"Clear all" (E-A3)** is a **separate destructive action with a confirmation modal** — it stays OUT of the undo stack. A confirmed clear is committed; this trades undo-of-clear for a deliberate-clear safety property.
- Slider-cancel is non-mutating, so mid-slider scrubbing is intentionally not undo-recoverable (exploration ≠ commitment — ADR-008 §Consequences).

### State-aware primary action (E-A4)

The bottom-bar primary action label shifts with the active sub-mode / paint state (no generic "Continue"):

| State | Primary action | Behavior |
|---|---|---|
| Painting, unsaved | `Save Range` | Persists the painted range (session + `rangeProfiles` at Phase 5). |
| Compare sub-mode armed | `Compare with…` | Opens range picker for the second range (DS-65). |
| Saved, clean | `New Range` | Starts a fresh paint (prompts if current is unsaved — E-A8). |

### Surface elements (E-A5..E-A10)

- **E-A5 First-use inline hint:** 2-line hint ("Tap to include; long-press for weight") on first entry to Custom mode; fades after the first paint completes; never reappears.
- **E-A6 Fractional equity:** all equity values render to **≥1 decimal place** (e.g., `38.2%`, not `38%`). Whole-percent rounding would mask the sub-0.5% differences DS-65 comparison exists to surface. Flop equity is exact-enumerated (5 cards); turn/river fall back to higher-sample Monte Carlo or the precompute cache.
- **E-A7 Paint-state-dirty indicator:** `• Range not saved` in the Explorer mode header until the range is saved.
- **E-A10 Histogram debounce + loading affordance:** equity histogram recompute is **200ms-debounced** with a `computing…` affordance during recompute (avoids thrash during rapid painting).

### Sub-capabilities

| Capability | JTBD | Phase | Notes |
|---|---|---|---|
| Paint custom range | DS-64 | 1-2 | Foundational; ADR-007/008. |
| Subrange filter + equity histogram | DS-51 (extends) | 2 | Filter toggles + histogram primitive wired into `RangeFlopBreakdown` or a sibling. |
| Compare two ranges (delta) | DS-65 | 2 | Two `Float64Array`s diffed cell-by-cell (O(169)); delta highlighted per-combo + per-bucket. Differentiator vs Flopzilla (which has no native compare). |
| Per-street range evolution | DS-66 | 3+ | **Surface-contracted, implementation-deferred.** Binds AP-RL-01 (below). |
| Validate authored content | DS-67 | 3+ | **Surface-contracted, implementation-deferred.** Binds INV-LSW-RL-EQUITY-PARITY (below). |

### AP-RL-01 binding (E-A11 — load-bearing, Phase 3+)

Per-street range narrowing (DS-66) MUST be computed **per-combo** — equity update conditional on villain's action profile + the board card revealed — **NEVER** from bucket-label heuristics ("narrow by hand-class"). Full doctrine: [`POKER_THEORY.md §7.6 (AP-RL-01)`](../../../.claude/context/POKER_THEORY.md). Honors first-principles modeling (labels are outputs, not inputs — [[feedback_first_principles_decisions]]).

**Forbidden Range Lab surfaces** (CI-lint pattern, same gate class as PSD neutral-chrome grep):
- ✗ Any "narrow by hand class / bucket" control that drives evolution from a label rather than per-combo equity.
- ✗ Bucket-label-keyed narrowing presets surfaced as the evolution mechanism.
- ✓ Per-combo equity-derived narrowing, driven by the actual betting line + board card.

**Determinism:** narrowing must be deterministic for a given (paint + action-profile) input — no "varies each render" — so DS-67 validation is testable (engineering: deterministic seed for any Monte Carlo path in RL).

### INV-LSW-RL-EQUITY-PARITY binding (Phase 3+)

DS-67 (validate authored content) rests on the parity contract: equity computed in Range Lab for an LSW node must match the LSW engine within tolerance (±0.5% Monte Carlo / exact-match enumeration). The invariant + CI test shipped as WS-206 (SPR-095); it already caught a real content bug (WS-209, fixed SPR-096). This is what lets Range Lab replace external web-search validation for ≥80% of LSW decision-node checks.

### Cross-link entry points (Phase 5 — surface-contracted here, affordances authored at Phase 5)

| Source surface | Affordance | Behavior |
|---|---|---|
| LSW `LineWalkthrough` node | `Inspect in Range Lab` | Opens Explorer/Custom with the node's range + board restored via `restoreContext` payload. **Cross-link source label visible** on entry (H-N02). |
| `hand-replay-view` decision | `Inspect in Range Lab` | Same restoreContext pattern for a replayed decision. |

- **E-A8 unsaved-paint guard:** entering a cross-link (or `New Range`) while paint state is dirty **warns before navigating, or auto-saves first** (H-N03 — never silently destroy unsaved paint).
- **Renderer ownership note:** if Range Lab needs in-app artifact rendering it **inherits PSD's renderer** (per ADR-006 dependency direction), not the reverse.

### Mobile decision (Gate 2 Q4)

**Landscape 1600×720 is v1.** 13×13 paint on mobile-portrait needs a grid-zoom modal or row-paint modal — authored separately as **WS-208** (P3, sequenced after Phases 1-2). The tap/long-press gesture grammar (ADR-007) works at smaller cell sizes once long-press-required mode engages, so the primitive carries to portrait; only the layout/zoom affordance is portrait-specific.

### Test-coverage expectations (Gate 5 scope)

- Paint primitive: tap-toggle in/out; long-press → slider → Apply/Cancel; one undo entry per atomic action; partial-fill rendering reflects weight.
- Undo/redo: per-stroke depth; redo cleared on new mutation; Clear-all bypasses undo + requires confirmation.
- `rangeToString()` ↔ `parseRangeString()` round-trip for painted ranges (shipped Phase 0, regression-pinned).
- Equity fidelity: fractional (≥1-decimal) rendering; exact flop enumeration; comparison delta = cell-by-cell diff.
- Scale-aware ergonomics: below 44 DOM-px, tap disabled / long-press-required.
- Histogram debounce: 200ms; `computing…` affordance during recompute.
- AP-RL-01 CI-lint: no bucket-label-driven narrowing surface in DS-66 implementation.
- LSW-RL parity: WS-206 invariant test (sample LSW nodes, recompute in RL, assert ±0.5% / exact).
- Cross-link unsaved-paint guard: dirty state → warn-or-autosave before navigate.

### Adjacent surface dependencies

| Adjacent surface | Coupling | Status |
|---|---|---|
| `postflop-drills` → Explorer (this surface) | Range-source toggle + Custom paint flow | Updated this gate |
| LSW `LineWalkthrough` | `Inspect in Range Lab` cross-link (restoreContext) | Phase 5 — affordance authored then |
| `hand-replay-view` | `Inspect in Range Lab` cross-link | Phase 5 — affordance authored then |
| `rangeProfiles` store | Save custom ranges | Phase 5 |
| `pokerCore/rangeMatrix.js` (`rangeToString`) | Serialize painted range | Shipped (Phase 0) |
| equity-precompute cache (WS-205) | Per-combo Float64Array at flop → turn/river filter | Shipped (SPR-095) |

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 2, Tier A baseline).
- 2026-04-22 — JTBD list updated post-LSW-J1: DS-48/49 added as Active (served by `bucket-ev-panel-v2`); DS-50/51 promoted from "implicit" to explicit atlas references.
- 2026-05-02 — SCF Gate 4 extension: opt-in-test mode subsection added. 3-delta description; entry from lesson card `Test myself` button; result-display surface with cd5_exempt manifest. Implementation deferred to SCF Gate 5 multi-PR.
- 2026-05-20 — **Range Lab Gate 4 extension** (WS-055 / SPR-098): Range Lab capability section added (Explorer expansion — Custom range-source toggle, NOT a new tab/view per Gate 1 + Drills Consolidation hold). Covers paint UX (ADR-007 tap-toggle + long-press-weight; **partial-fill-height** weight rendering per founder ratification SPR-098), per-stroke undo + Clear-all confirmation (ADR-008), state-aware primary action (E-A4), surface elements E-A5/E-A6/E-A7/E-A10, sub-capabilities table (DS-64 paint + DS-65 compare = Phase 1-2; DS-66 evolution + DS-67 validate = Phase 3+ surface-contracted), **AP-RL-01 binding** (E-A11 — per-combo narrowing, no bucket-label heuristics; CI-lint forbidden surfaces) + **INV-LSW-RL-EQUITY-PARITY binding**, Phase-5 cross-link contract (LSW + HandReplay `Inspect in Range Lab` + E-A8 unsaved-paint guard), mobile decision (landscape v1; portrait → WS-208), Gate-5 test-coverage expectations, adjacent-surface dependency table. JTBD list extended (DS-64..67). Explorer Anatomy updated with range-source toggle. Inherits Gate 2 verdict YELLOW (6 conditions all cleared) + Gate 3 JTBDs (SPR-097) + ADR-007/008 (SPR-094) + WS-205 cache + WS-206 parity (SPR-095). Cross-link affordances on LSW/HandReplay surfaces deferred to Phase 5 (not authored this gate). Mobile-portrait variant tracked as WS-208.
- 2026-06-15 — WS-231 (WS-229 roundtable corrective): **Explorer** tab renamed **Range Explorer** (F-DRILL-03 — range-vs-board breakdown + Range Lab; resolves the cross-view false-friend with preflop's hand-vs-hand "Equity Lookup"). Pre-Session over-claim corrected to a gate-pending/feature-flagged-off banner + tab count fixed to 6 shipped (F-DRILL-01 / C-1). `returning-after-break` added to Personas Served as currently-unserved (A-3). Product-line clarified main-app-only / sidebar-N/A (D-3). Tab-switch state-loss protection added (F-DRILL-02). Internal tab `id` unchanged (`explorer`).
- 2026-05-19 — **PSD Gate 4 extension** (WS-199 / SPR-092): Pre-Session mode section added (this section). Mode-bar updated to 7 tabs with `[Pre-Session]` in leftmost slot per founder ratification 2026-05-19. JTBD list extended (SE-01/02/03 + DS-62/DS-63). Personas extended with `presession-preparer` (sibling of `post-session-chris` per Gate 3 A-R1). State block extended with `drillType='presession'` writes — explicitly no streak/mastery/tier-label persistence (E-A5 + A-AP1 binding). Inherits ADR-005 (flip-card pattern) + ADR-006 (in-app anchor-trace bundle) + Gate 2 verdict YELLOW + Gate 3 research. Companion edits: `sessions-view.md` (inline `Pre-Session Drill` button in action row) + `hand-replay-view.md` (`Queue for tomorrow's PSD` overflow-menu item per decision). Mobile-portrait variant tracked separately as WS-200.
