# Copy-discipline rules — Self-Coach Foundation (SCF)

**Date:** 2026-05-02 (Gate 2)
**Project:** Self-Coach Foundation (Master Plan §D)
**Audience:** Gate 4 surface designers, Gate 5 component / persistence authors, Phase 2+ contributors.
**Parent:** Gate 2 §Stage E AP-06 lock decision (CI-grep tier ratified by owner /next 2026-05-02). Companion to [`anti-patterns.md`](anti-patterns.md).

---

## Why this list exists

Anti-patterns describe features SCF refuses to ship. Copy-discipline describes language SCF refuses to use — even in features that are permitted. A SelfCoachView that satisfies every AP-SCF refusal (no progress bar, no streak, no cross-surface contamination, no mastery score) can still fail the autonomy contract at the prose level if its panel titles say "Your Coaching Score" or its tooltips say "Did you handle this hand correctly?"

External coaching products (Upswing PokerLab, Run It Once Elite, GTO Wizard study, BBZ, Crush Live Poker, Red Chip Poker) saturate users with grading vocabulary. The market normalizes it because it drives engagement metrics. SCF's program-level position is the inverse: hero-leak detection without the grading frame. CD-1..5 below are the language floor; the CI-lint forbidden-string regexes at the end are the automation that catches regressions before they ship.

**Rule for amendments.** A new forbidden string added to CI-lint requires reviewer sign-off per persona-level autonomy review. Removing a forbidden string requires the same — these are tone invariants, not style preferences.

---

## CD-1 — Factual, not imperative

SCF surfaces describe **observed conditions and tracked patterns**, not **commands**. The user is reviewing their own play; the surface is a reference, not a coach barking instructions. The surface is not permitted to tell the user what to do.

**Red line cited:** #7 (editor's-note tone — factual statements only).

### ✓ Allowed

- *"Observed fold-to-cbet IP rate: 52% [38%, 66%] over 30 hands."*
- *"Last 12 sessions: 7 hands flagged for IP overfold pattern."*
- *"Concept not yet drilled. Last opened: 2026-04-22."*
- *"Tier (owner-set): studied-amateur. Per-domain mastery (postflop): 12 of 18 concepts drilled."*
- *"Pattern persists across last 3 sessions."*

### ✗ Forbidden

- *"You should fold less often here."* → replace with *"Observed fold rate: X%. Solver baseline: Y%."*
- *"Drill the cbet-defense concept next."* → replace with *"Next teachable concept (current tier): cbet-defense."*
- *"Stop folding to small bets."* → replace with the observation only — solver baseline is shown alongside; the user decides.
- *"Always study the next concept after your weakest one."* → curriculum-spine ordering logic should not be expressed as advice to the user.

**Test pattern.** If the sentence would make grammatical sense as a direct order from a coach ("You must X" / "You should Y" / "Don't Z"), it fails CD-1. If it reads as an observation or a computation ("Condition → consequence"), it passes.

---

## CD-2 — No self-evaluation framing

SCF surfaces are NOT assessment sheets. The surface never asks the user to evaluate their own play, never positions itself as the answer key against which the user is measured, never presents its data as a test result.

**Red lines cited:** #5 (no engagement-pressure), #14 (no mastery/streak tracking — promoted to red line in EAL Gate 2). AP-SCF-01.

### ✓ Allowed

- *"Hero-leak detection (review-mode only). Sample threshold: 30 hands per situation key."*
- *"Tracking: fold-to-cbet IP, vpip-utg, threebet-vs-open-cutoff (3 of 14 situation keys above threshold)."*
- *"Concept browse: 12 / 18 drilled. Next teachable: cbet-defense."*

### ✗ Forbidden

- *"Grade your play."* / *"How did you do?"* / *"Check your answer."*
- *"Your coaching score: 72/100."*
- *"Did you make the right call?"*
- *"Test yourself: was that fold correct?"*
- *"Rate your decision before seeing the verdict."* (CO-57 confidence elicitation re-frames this — see CD-2-exception below)
- *"Session accuracy: 67%."*
- *"How accurate were your reads this session?"*

**CD-2 exception (CO-57 confidence elicitation).** CO-57 *self-rate-confidence-on-a-line* explicitly asks the user for a confidence rating BEFORE seeing the verdict. The exception is bounded: confidence-rating UI uses the framing *"How confident were you in this line?"* (user rates own confidence; non-graded) — never *"How well did you play this line?"* (graded). The output (predicted confidence vs observed correctness gap) is rendered factually per CD-1 (*"Predicted confidence: high; observed solver-baseline match: low"*) — never as a verdict (*"You overestimated your read"*).

**CD-2 nuance (SCF Gate 3 amendment, 2026-05-02): Owner-volunteered test surfaces.** AP-SCF-01 refusal scope is narrowed: **system-imposed** grading on hero-leak surfaces is REFUSED; **owner-volunteered** tests on opt-in test surfaces are PERMITTED — the grading happens because the user explicitly asked for it. The opt-in gate is the load-bearing autonomy contract.

### ✓ Allowed (owner-volunteered test surfaces — opt-in only)

- *"Test myself on this concept"* button as user-initiated affordance (never auto-launched).
- *"3 of 5 correct"* factual quiz results display on the test-surface destination (after user explicitly opted in by tapping the test button).
- *"You answered: A. Correct answer: B."* on a quiz review surface — permitted because the user opted into being tested.
- *"Take quiz again"* / *"Move to next concept"* navigation after factual results render.

### ✗ Forbidden on owner-volunteered test surfaces

- Auto-launching tests without explicit user opt-in (defeats the autonomy contract).
- Using grading vocabulary on system-imposed surfaces (review-mode HandReplayView, SelfCoachView leak inventory, between-hands count card) — the `score`/`grade`/`how did you do?` words remain forbidden on those surfaces.
- "Streak" or "test mastery streak" framing on test surfaces (CD-3 still applies — owner-volunteered tests are factual, not gamified).

**Manifest flag for CI-lint exemption:** test-surface manifests declare `cd5_exempt: 'owner-volunteered-test'` with an opt-in-affordance description; CI allows the lint bypass for the grading-vocabulary subset on those surfaces only.

**Test pattern.** If the sentence positions the user as student and the surface as teacher-with-answer-key WITHOUT explicit user opt-in to that framing, it fails CD-2. The owner-volunteered-test exemption requires the opt-in affordance to be visibly user-initiated (button → user tap → quiz surface).

---

## CD-3 — No engagement copy

SCF surfaces carry hero-leak observations, curriculum-spine state, tier metadata. Nothing else. No motivational copy, no streak copy, no social-proof copy, no urgency copy, no nudge framing, no gamification.

**Red lines cited:** #5 (no streaks / shame / engagement-pressure), #14 (no mastery tracking). AP-SCF-05, AP-SCF-06.

### ✓ Allowed

- Surface body content (hero-leak inventory, concept list, tier-set radio).
- Last-session timestamp (factual, owner-set cadence reminders only).
- Empty-state factual copy (*"No leaks tracked yet (need 30 hands per situation key)"*).

### ✗ Forbidden

- *"You've drilled 12 of 18 concepts!"* / *"Concepts remaining: 6."*
- *"Keep it up!"* / *"Great progress!"* / *"You're on fire!"*
- *"Study streak: 7 days."*
- *"You haven't studied in 5 days — jump back in!"*
- *"Most studied concept this week: cbet-defense."*
- *"Users at your tier are studying X."*
- *"Last chance to maintain your streak — study today!"*
- Progress bars, completion percentages, XP, level-up framing, badges.

**Test pattern.** If the sentence is time-sensitive, social, motivational, or nudges toward an action the user did not initiate, it fails CD-3. SCF surfaces are factual hero-side review tools, not engagement products.

---

## CD-4 — Labels as outputs, never inputs (for villain-side reads in SCF context)

This rule is inherited from PRF CD-4 / EAL doctrine and applies to SCF surfaces wherever they cite villain-side reads as part of a hero-leak situation key (e.g., a leak claim like "you overfold to BTN cbets vs `studied-amateur`-tier villains" must NOT use villain-style labels in the prescription).

**Red line + doctrine cited:** Working Principle #2. POKER_THEORY.md §7. `feedback_first_principles_decisions.md`. `src/utils/exploitEngine/CLAUDE.md` §calling-station-as-weak-range.

### ✓ Allowed

- **As decomposition:** *"Hero overfold pattern observed when villain has VPIP ≥ 45 + PFR ≤ 10 + observed `foldToBet(half-pot)` ≥ 50%."*
- **As glossary citation:** *"Tracking situation key: hero IP cbet defense vs villains where observed VPIP ≥ 35 (POKER_THEORY §5.5 'looser' baseline)."*
- **As population annotation:** *"Per population baseline ($1/$3 live 9-handed), villain VPIP distribution …"*

### ✗ Forbidden

- *"You overfold against fish."* → refused. Decompose: villain's observed VPIP / PFR / foldToBet — never the label.
- *"You should bluff calling stations more."* → refused twice (CD-1 imperative + CD-4 label). Calling-station-as-weak-range is poker-wrong; correct exploit is value-bet-wider-AND-bigger (POKER_THEORY §7).
- *"Your hero leak: bluffing nits."* → refused. Decompose into observed `foldToBet` rate vs hero observed bluff frequency at sizing.

**Test pattern.** Any SCF surface sentence containing `vs {Fish|Nit|LAG|TAG|Station|Maniac}` followed by a hero action verb (`overfold`, `bluff`, `iso`, `cbet`, etc.) fails CD-4. The label must be decomposed into game-state inputs (equity, pot-odds, SPR, observed `foldToBet(size)`, observed VPIP/PFR/AF) before the hero pattern is computed.

---

## CD-5 — Assumptions explicit (sample size + situation key + threshold)

Every hero-leak claim declares its conditioning. Sample size visible in the body (not only in the lineage footer). Situation key visible in the body. Threshold visible (n=30 floor for v1; if Gate 3 raises it, the new floor is named).

**Red line + doctrine cited:** Working Principle #3 (situation-qualified). #2 (transparency). AP-SCF-04 (small-sample refusal).

### ✓ Allowed

Every hero-leak claim card carries, at minimum, these four fields visible in the body:

1. **Situation key:** *"hero IP cbet defense"* / *"hero 3-bet defense BB vs CO-open"* / *"hero turn double-barrel after IP cbet"*.
2. **Sample size:** *"30 hands"* / *"127 hands across 12 sessions"*.
3. **Credible interval:** *"52% [38%, 66%]"* — never a point estimate alone.
4. **Threshold floor:** *"sample threshold: 30 hands"* (v1) — visible inline or in panel chrome.

Example hero-leak claim card body:

> **Hero IP cbet defense — fold-to-cbet rate**
> 52% [38%, 66%] over 30 hands (12 sessions, last: 2026-04-29).
> Solver baseline (rake-agnostic, 100bb SPR ~5): 38%.
> Sample threshold: 30 hands per situation key (v1 floor; Gate 3 may revise).

### ✗ Forbidden

- *"Your fold-to-cbet rate is high."* (no sample, no situation key, no CI) — fails CD-5 + CD-2 (graded framing).
- *"You overfold IP."* (no sample, no key, no CI, additionally fails CD-1 + CD-2).
- *"Hero leak: cbet defense."* (no sample, no key visible, no CI) — fails CD-5.
- Cards whose sample size is visible only in a tooltip — fails CD-5; the user must see sample-size at the same scan level as the claim itself.

**Test pattern.** Cover the panel chrome with a finger. If the claim body no longer declares situation-key + sample-size + credible-interval, it fails CD-5.

---

## CI-lint — forbidden-string list

Build-time grep against every SCF-surface rendered body + title + metadata + tooltip. Match = CI failure. Enforced by SCF-G4-SUP (sourceUtilPolicy CI spec — Gate 4 deliverable).

**Imperative tone (CD-1):**
- `"you should"` (case-insensitive)
- `"you must"`
- `"always"` adjacent to a hero action verb (`always fold`, `always check`, `always defend`)
- `"never"` adjacent to a hero action verb (`never bluff`, `never cbet`)
- `"don't"` / `"do not"` adjacent to a hero action verb
- `"stop"` adjacent to a hero action verb (`stop folding`, `stop bluffing`)

**Self-evaluation (CD-2):**
- `"grade your"` / `"score your"` / `"check your answer"` / `"did you"` / `"how did you"`
- `"how accurate"` / `"your accuracy"` / `"session accuracy"`
- `"your coaching score"` / `"your rating"` / `"coach score"`
- `"test yourself"` (outside CO-57 confidence-elicitation surface — explicit whitelist)
- `"was your read"` / `"did you make the right"`
- `"how well did you"` (CO-57 surface uses *"how confident were you"* — confidence ≠ correctness)
- `"rate your decision"` / `"rate your play"` / `"rate your read"`

**Engagement (CD-3):**
- `"keep it up"` / `"great job"` / `"on fire"` / `"you're doing great"`
- `"streak"` (any context — SCF refuses the entire pattern)
- `"jump back in"` / `"haven't studied in"` (cadence-pressure framing)
- `"users at your tier"` / `"users like you"` / `"most studied"` / `"trending"` (social-proof framing)
- `"last chance"` / `"don't miss"` / `"limited time"` (urgency framing)
- `"level up"` / `"unlock"` / `"badge"` / `"achievement"` (gamification framing)
- `"mastered"` / `"completion"` / `"% complete"` (mastery-score framing — AP-SCF-05)
- `"\d+%"` adjacent to `"your"` (e.g., `"you're 60% through"`) — allowed only in poker-math contexts (equity, frequency, fold rate)

**Labels-as-inputs (CD-4):**
- Regex pattern: `(vs |against |versus )(fish|nit|lag|tag|station|maniac|whale)` followed within 80 characters by a hero action verb (`overfold`, `bluff`, `iso`, `cbet`, `barrel`, `defend`, `attack`)
- Whitelisted contexts: glossary entries, population-annotation sentences (require `POKER_THEORY` citation within 200 characters to pass)

**Unqualified claims (CD-5):**
- Hero-leak claim body containing no match for sample-size regex (`\d+ hands?` OR `\d+ samples?`) fails CD-5 lint.
- Hero-leak claim body containing no match for credible-interval regex (`\[\d+%, \d+%\]` OR `±\d+%` OR `CI:`) fails CD-5 lint.
- Whitelist pattern: empty-state cards (n<30) declare `cd5_exempt: 'below_floor'` in their manifest with the placeholder copy `"Insufficient sample (need {N} more hands)"`; CI allows the lint bypass for manifests carrying this flag.

---

## Relationship to anti-patterns

| Anti-pattern file ([`anti-patterns.md`](anti-patterns.md)) | Copy-discipline file (this) |
|---|---|
| Feature-level refusals (what SCF can ship) | Language-level refusals (how SCF talks) |
| Caught at Gate 4 spec review + Gate 5 merge review | Caught at content-build CI (forbidden-string grep) |
| Example: AP-SCF-05 refuses a mastery-score feature | Example: CD-3 refuses the strings `"mastered"` / `"% complete"` from appearing on a surface |
| Amendment: persona-level review | Amendment: persona-level review |

Both fail independently. A surface can pass all 6 AP-SCF refusals and still fail CD-1 if its panel button labels say "Drill This Now." A surface can pass CD-1..5 and still ship an AP-SCF-05 mastery score if a Gate 4 author slips a "12/18 mastered" widget into the surface chrome.

---

## Worked example — reformulation of a graded-style hero-leak surface

**Naive draft (refused — fails CD-1 + CD-2 + CD-5):**

> **Your Coaching Score: Cbet Defense**
> You're folding too much (72%). Solver says 38%. Did you misplay this concept?
> Drill it: [Start Drill]

**Voice 2 (Autonomy) audit:** AP-SCF-01 graded-framing (`Your Coaching Score`); CD-1 imperative (`Drill it`); CD-2 self-evaluation (`Did you misplay`); CD-5 missing sample-size + CI.

**Reformulated (CD-1..5 + AP-SCF-01..06 compliant):**

> **Hero IP cbet defense — fold-to-cbet rate**
> 72% [58%, 86%] over 30 hands (12 sessions, last: 2026-04-29).
> Solver baseline (rake-agnostic, 100bb SPR ~5): 38%.
> Sample threshold: 30 hands per situation key.
>
> Related drill: cbet-defense (not yet drilled this session).

The reformulation is:

- **CD-1 compliant:** no imperative verbs; describes observed condition + solver baseline as factual computation; "Related drill" is a navigation link, not a directive.
- **CD-2 compliant:** no self-evaluation; the surface tracks observation, the user reads + decides.
- **CD-3 compliant:** no engagement copy; no progress bar; no streak.
- **CD-4 compliant:** no villain labels in the prescription; if villain-side reads enter the situation key, they decompose to VPIP / PFR / observed-fold-rate.
- **CD-5 compliant:** situation key + sample size + credible interval + threshold all visible in body.

This is the shape every SCF hero-leak surface card takes. Gate 4 surface specs walk this template; Gate 5 merge review enforces.

---

## Change log

- **2026-05-02 — Shipped (Gate 2).** 5 copy-discipline rules (CD-1..5) authored from Gate 2 §Stage E AP-06 lock decision. CI-lint forbidden-string list enumerated for content-build CI. Worked-example reformulation of a graded-style hero-leak surface to show all 5 rules + 6 anti-patterns operating together. CO-57 confidence elicitation explicit exception in CD-2 — confidence ≠ correctness.
- **2026-05-02 (later) — SCF Gate 3 amendment.** CD-2 nuance section added per SCF Gate 3 AP-SCF-01 nuance amendment: owner-volunteered tests on opt-in test surfaces are PERMITTED (factual grading vocabulary like "3 of 5 correct" allowed via `cd5_exempt: 'owner-volunteered-test'` manifest flag). System-imposed grading on hero-leak surfaces remains REFUSED. Opt-in gate is the load-bearing autonomy contract.
- **2026-05-02 (later still) — SCF Gate 4 binding.** Per Gate 4 architectural overlap (drills + tests share substrate), `cd5_exempt: 'owner-volunteered-test'` manifest flag is bound to the result-display surface ONLY of the opt-in-test mode of existing drill engines (`postflop-drills.md` / `preflop-drills.md`). The flag is NOT propagated to upstream lesson card or SelfCoachView Tests history list. Drill surfaces gain a result-framing toggle in their respective views (default: observed/non-graded; opt-in-test mode: factual-grading-permitted via cd5_exempt). The flag is per-surface-instance with explicit user-initiation description in the manifest. CI-lint runner (Gate 5 deliverable; SCF-G4-SUP) reads the flag from the surface manifest object and allows the grading-vocabulary subset for surfaces declaring it. No exemption creep: the value `'owner-volunteered-test'` is the ONLY non-null cd5_exempt value in any SCF surface manifest.
