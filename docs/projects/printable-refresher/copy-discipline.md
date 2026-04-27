# Copy-discipline rules — Printable Refresher

**Date:** 2026-04-24 (Gate 4)
**Project:** `docs/projects/printable-refresher.project.md`
**Audience:** Gate 5 card authors, in-app surface copywriters, Phase 2+ contributors.
**Parent:** Gate 2 Voice 4 §Copy-discipline (CD-1..5). Gate 4 ACP ratification: `docs/projects/printable-refresher.project.md` §Acceptance Criteria — Copy-discipline rules.
**Sibling:** `anti-patterns.md` (structural refusals). This file is the language layer; that file is the feature layer.

---

## Why this list exists

Anti-patterns describe features the app refuses to ship. Copy-discipline describes language the app refuses to use — even in features that are permitted. A card that satisfies every anti-pattern refusal (no leaderboard, no streak, no mastery score) can still fail the autonomy contract at the prose level if the card's own sentences imply graded-work, engagement-pressure, or labels-as-inputs.

Paper permanence makes copy failures unusually durable. A card printed with "You must fold here" is a forever-imperative — the app cannot retract the tone once the laminate is in the owner's pocket. Five rules below are the minimum language floor; CI-linted forbidden-string list at the end is the automation that catches regressions.

**Rule for amendments.** A new forbidden string added to CI-lint requires reviewer sign-off per persona-level autonomy review (same rule as anti-patterns.md). Removing a forbidden string requires the same — these are tone invariants, not style preferences.

---

## CD-1 — Factual, not imperative

Cards describe **conditions and derivations**, not **commands**. The refresher is a reference artifact; the owner reads it and decides. The card is not permitted to decide for the owner.

**Red line cited:** #7 (editor's-note tone — factual statements only).

### ✓ Allowed

- "Solver baseline: fold. Exception: SPR ≥ 8 IP vs VPIP ≥ 45."
- "Breakeven bluff frequency at 1/2 pot bet = 33%. If observed `foldToBet(half-pot)` < 33%, the bluff is -EV at this sizing."
- "On A92r with AK: 62% equity vs 12% UTG open range. Realization factor IP ~0.85."
- "When stack ≤ 12 bb UTG: Nash push range = 22+, A8s+, A2o+, K9s+, KTo+, Q9s+, QJo, J9s+, T9s."

### ✗ Forbidden

- "You must fold here." → replace with "Solver baseline: fold."
- "Always iso-3bet fish OOP." → replace with the full conditional decomposition (see CD-4 + F6).
- "Don't bluff a calling station." → refused outright per F1; reformulate per AP-PRF + V3 F3.
- "Bet 75% pot on the turn." → replace with "Geometric sizing for 100bb SPR 4 targeting river pot-commit: 75% turn + 100% river."
- "Check back." → replace with the conditional ("Solver checks back ~80% on dry ace-high flops OOP").

**Test pattern.** If the sentence would make grammatical sense as a direct order from a coach ("You must X"), it fails CD-1. If it reads as an observation or a computation ("Condition → consequence"), it passes.

---

## CD-2 — No self-evaluation framing

Cards are reference material, not assessment sheets. The refresher never asks the owner to evaluate their own play, nor does it position itself as an answer key against which the owner is measured.

**Red lines cited:** #5 (no engagement-pressure), #14 (no mastery/streak tracking).

### ✓ Allowed

- "Reference: preflop open ranges, CO, 100bb, $2/$5, 5% rake-cap $5."
- "Worked example at listed assumptions: pot = 10bb, bet = 5bb, breakeven fold = 33%."

### ✗ Forbidden

- "Grade your play" / "How did you do?" / "Check your answer."
- "Score your decision here."
- "Did you make the right call?"
- "Test yourself: what would you do with AKo UTG?"
- "How accurate was your read?"

**Test pattern.** If the sentence positions the owner as student and the card as teacher-with-answer-key, it fails CD-2. The card is a lookup surface — the owner is neither being tested nor graded. If testing-framing is desired, explicit intent-switch to drill surface (red line #17) — never on the printable card itself.

---

## CD-3 — No engagement copy

Cards carry poker content and lineage — nothing else. No motivational copy, no status copy, no streak copy, no social-proof copy, no urgency copy.

**Red lines cited:** #5 (no streaks / shame / engagement-pressure), #14 (no mastery tracking). AP-PRF-03, AP-PRF-04.

### ✓ Allowed

- Card title + body content.
- Lineage footer (v1.2 / 2026-04-24 / source-util / theory citation / assumptions).
- Factual empty-state ("Complete 1 session to enable the printable refresher").

### ✗ Forbidden

- "You've mastered 3/15 cards!" / "Cards remaining: 12."
- "Keep it up!" / "Great job!" / "You're on fire!"
- "Your refresher streak: 7 days."
- "Most popular card this week" / "Users like you are studying X."
- "Last chance — rake changes in 3 days, re-print soon!"
- Progress bars, completion percentages, XP numbers, any scalar representing owner performance.

**Test pattern.** If the sentence would not survive on a laminated card at the table because it is time-sensitive, social, or motivational, it fails CD-3. Cards are evergreen factual references. Engagement copy belongs nowhere in the surface, even in the in-app view (where it would still violate red lines #5 + #14).

---

## CD-4 — Labels as outputs, never inputs

Villain labels (Fish / Nit / LAG / TAG / Station / Maniac) may appear only as glossary entries, historical population annotations, or exception-clause citations — **never as decision inputs on a card's prescription**. This is the most structurally loaded copy rule because it interacts with F1 (fidelity-bar #1) and the first-principles doctrine (`feedback_first_principles_decisions.md` + POKER_THEORY.md §7).

**Red line + doctrine cited:** Working Principle #2. Fidelity bar F1 + F6. `feedback_first_principles_decisions.md`. POKER_THEORY.md §7 (labels collapse independent axes). `src/utils/exploitEngine/CLAUDE.md` §calling-station-as-weak-range.

### ✓ Allowed

- **As decomposition:** "When villain has observed VPIP ≥ 45, PFR ≤ 10, and SPR ≥ 8, iso-3bet OOP gains X bb/100 via implied-odds realization gap (derivation below)."
- **As glossary:** "Fish: VPIP ≥ 40, PFR ≤ 10 (POKER_THEORY §5.5). See also Nit, LAG, TAG."
- **As population annotation:** "Typical live $1/$3 field has ~40% VPIP fish proportion (POKER_THEORY §5.5 baseline)."
- **As exception citation:** "Exception: when observed `foldToBet(size)` < breakeven for a sizing, bluffs at that sizing are -EV; value bets at the same sizing gain from the same observation." (Phrased in observed frequencies, no label in the prescription.)

### ✗ Forbidden

- "vs Fish, always iso-3bet." → refused. Decompose into VPIP + PFR + SPR + realization gap (see Allowed §1).
- "Don't bluff calling stations." → refused outright (V3 F1/F3 RED-flagged). Calling station has uncapped call-range; correct exploit is value-bet-wider-AND-bigger. Reformulate per F6.
- "3-bet 56s in CO vs deep-stacked fish." → refused (V3 F1 RED-flagged). If decomposable at card scale, write as SPR + implied-odds + fold-to-3bet conditional; otherwise redirect to drill surface.
- "vs LAG, tighten up." → refused; "tighten up" is label-as-action without decomposition.
- "Fish call too much, so bluff less." → refused; this collapses fold-frequency, call-range shape, and sizing-tell correlation into one label.

**Test pattern.** Any card sentence containing `vs {Fish|Nit|LAG|TAG|Station|Maniac}` followed by a directive verb (`iso`, `bet`, `bluff`, `fold`, `tighten`, `loosen`, etc.) fails CD-4. The label must be decomposed into game-state inputs (equity, pot-odds, SPR, observed `foldToBet(size)`, observed VPIP/PFR/AF) before the directive is computed.

**The three Q1 RED cards (#12 per-villain-archetype / #13 56s-vs-deep-fish / #14 don't-bluff-stations) are the load-bearing precedent.** All three were owner's own phrasings; all three were refused with decomposed replacements. The owner-ratified acceptance of those refusals (`gate3-owner-interview.md` Q1) binds the CD-4 rule for future card authors.

---

## CD-5 — Assumptions explicit

Every chart declares its conditioning. No context-free prescriptions. A preflop chart at $0.50/$1 live $200 cap and a preflop chart at $5/$10 online $1000 deep are different artifacts; they must not be confused on the laminate.

**Red line + doctrine cited:** Working Principle #3 (situation-qualified). Fidelity bar F3.

### ✓ Allowed

Every card carries, at minimum, these four fields visible in the body (not only in the lineage footer):

1. **Stakes:** `$2/$5 cash` / `$100 buy-in MTT blind level 4` / `rake-agnostic` (if applicable)
2. **Rake:** `5% cap $5, no-flop-no-drop` / `N/A (tournament)`
3. **Effective stacks:** `100bb` / `60bb` / `40bb`
4. **Field baseline:** `standard 9-handed live $1/$3` / `solver vs solver`

Example preflop open-range card body:

> **CO open, 100bb, $2/$5, 5% rake-cap $5, 9-handed live $1/$3 field.**
> Range: 22+, A2s+, A9o+, K5s+, KTo+, Q7s+, QTo+, J8s+, JTo, T7s+, 97s+, 86s+, 75s+, 64s+, 53s+.
> Sizing: 3bb. Exception: 4bb if two limpers.

### ✗ Forbidden

- "CO open: 22+, Axs+ ..." (no stakes / rake / stack declared) — fails F3 + CD-5.
- Charts whose stakes-and-rake are only in the fine-print footer and not visible in body — fails CD-5 because the owner scans body first; at 1.5s laminate glance they may not see footer.

**Test pattern.** Cover the lineage footer with a finger. If the card's body no longer declares stakes + rake + stack + field, it fails CD-5.

---

## CI-lint — forbidden-string list

Build-time grep against every card's rendered body + title + metadata. Match = CI failure. Enforced by PRF-G4-CI (content-drift CI spec authored before Gate 5 card authoring starts — non-negotiable sequencing).

**Imperative tone (CD-1):**
- `"you must"` (case-insensitive)
- `"always"` when adjacent to a poker action verb (`always fold`, `always iso`, `always check`)
- `"never"` when adjacent to a poker action verb (`never bluff`, `never call`, `never bet`)
- `"don't"` / `"do not"` when adjacent to a poker action verb

**Self-evaluation (CD-2):**
- `"grade your"` / `"score your"` / `"check your answer"` / `"did you"` / `"how did you"`
- `"test yourself"` (outside an explicit drill-surface context — never appears in refresher cards)
- `"was your read"` / `"did you make the right"`

**Engagement (CD-3):**
- `"mastered"` / `"cards remaining"` / `"progress"` / `"streak"` / `"keep it up"` / `"great job"`
- `"on fire"` / `"you're doing great"` / `"level up"` / `"unlock"`
- `"last chance"` / `"limited time"` / `"re-print soon"` (urgency framing)
- `"users like you"` / `"most popular"` / `"trending"` (social-proof framing)
- `"\d+%"` when accompanied by `"your"` (e.g., `"you're 45% through"`) — allowed only in poker-math contexts (equity, frequency)

**Labels-as-inputs (CD-4):**
- Regex pattern: `(vs |against |versus )(fish|nit|lag|tag|station|maniac|whale)` followed within 80 characters by any of: `iso`, `bet`, `bluff`, `fold`, `raise`, `call`, `3-?bet`, `4-?bet`, `cbet`, `barrel`, `tighten`, `loosen`
- Whitelisted contexts: glossary entries, population-annotation sentences, exception-clause citations (requires `POKER_THEORY` citation within 200 characters to pass)

**Unqualified assumptions (CD-5):**
- Card body containing no match for stakes regex (`\$[\d.]+/\$[\d.]+` OR `tournament` OR `rake-agnostic`) fails CD-5 lint.
- Card body containing no match for stack regex (`\d+bb` OR `\d+BB` OR `effective`) fails CD-5 lint.

**Whitelist pattern.** Glossary cards / population-annotation cards / worked-example cards declare `cd5_exempt: true` in their manifest with a justification comment; CI allows the lint bypass only for manifests carrying this flag + a non-empty justification.

---

## Relationship to anti-patterns

| Anti-pattern file | Copy-discipline file |
|---|---|
| Feature-level refusals (what the app can ship) | Language-level refusals (how the app talks) |
| Caught at Gate 4 spec review + Gate 5 merge review | Caught at content-build CI (forbidden-string grep) |
| Example: AP-PRF-04 refuses a mastery-score feature | Example: CD-3 refuses the string `"mastered"` from appearing on a card |
| Amendment: persona-level review | Amendment: persona-level review |

Both fail independently. A card can pass all 11 anti-pattern refusals and still fail CD-4 if its prescription prose says "vs Fish, always iso." A card can pass CD-1..5 and still ship an AP-PRF-04 mastery score if the feature authors slip a mastery-score widget into the surface chrome around the card body.

---

## Worked example — reformulation of a Q1 RED card

**Owner's original (Q1 RED — refused):** "Don't bluff calling stations."

**Voice 3 fidelity audit:** Labels-as-inputs + calling-station-as-weak-range + fold-equity ≠ fold-frequency. Station has uncapped call-range; correct exploit is value-bet-wider-AND-bigger. Card is not merely poor phrasing — it's poker-wrong.

**Decomposed replacement (CD-1 + CD-4 + F6 compliant):**

> **Bluff-sizing auto-profit — by observed foldToBet frequency**
>
> Breakeven fold at bet-size B into pot P: `breakeven = B / (P + B)`.
>
> | Bet size | Breakeven fold | Bluff +EV when `observed fold` > breakeven |
> |---|---|---|
> | 1/3 pot | 25% | observed fold > 25% |
> | 1/2 pot | 33% | observed fold > 33% |
> | 2/3 pot | 40% | observed fold > 40% |
> | 3/4 pot | 43% | observed fold > 43% |
> | 1× pot | 50% | observed fold > 50% |
>
> **Corollary (reverse):** when observed `foldToBet(size)` < breakeven, bluffs at that sizing are -EV. Value bets at the same sizing gain from the same observation — widen the value range and/or size up.
>
> **Lineage:** PRF-MATH-AUTOPROFIT v1.0 / 2026-04-24 / `src/utils/pokerCore/` (formula) / POKER_THEORY §6.3 / rake-agnostic / all SPRs.

The replacement is:
- **CD-1 compliant:** no imperative verbs; describes condition → consequence.
- **CD-4 compliant:** no archetype label; computed from observed `foldToBet`.
- **F2 compliant:** math visible (formula + table).
- **F3 / CD-5 compliant:** scenario declared (rake-agnostic / all SPRs) in body.
- **F5 compliant:** solver-baseline math card; no exception clause mixed in.
- **F6 compliant:** prescription decomposed into game-state input (observed frequency) and derived consequence.

This is the shape a decomposed-replacement card takes. The three Q1 RED cards all have decomposed-replacement cards of this form; Gate 5 card authoring will ship them.

---

## Change log

- **2026-04-24 — Shipped.** 5 copy-discipline rules authored from Voice 4 Gate 2 audit; CI-linted forbidden-string list enumerated; worked-example reformulation of a Q1 RED card to show the rules operating together.
