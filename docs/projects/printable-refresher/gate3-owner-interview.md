# Gate 3 — Owner Interview — Printable Refresher

**Date:** 2026-04-24
**Status:** ALL QUESTIONS ANSWERED — Q1 accepted doctrine; Q3 venue policy; Q2+Q4-Q9 owner-ratified "accept all recommendations" 2026-04-24.
**Source:** Gate 2 blind-spot audit `docs/design/audits/2026-04-24-blindspot-printable-refresher.md` §Owner interview questions.

---

## Q1 — Doctrine reconciliation **[ANSWERED 2026-04-24: ACCEPTED]**

**Question (original):** Voice 3 flagged 3 content types RED — two of which are phrasings from the owner's own request:
1. *"56s is good to 3b IP vs deep-stack fish in CO"* — labels-as-inputs + stack-depth-as-label.
2. *"Don't bluff a calling station"* — factually wrong (calling station has uncapped call-range; correct exploit is value-bet wider AND bigger).
3. Per-villain-archetype decision cards generally.

Does owner accept refusal + decomposed replacements?

**Owner answer (2026-04-24):** **Accepted.** The refusals stand. Decomposed replacements adopted:
- "56s vs fish in CO" → three separate GREEN cards (implied-odds realization + SPR zone + fold-to-3bet auto-profit).
- "Don't bluff calling stations" → observed-foldToBet-threshold card ("when `observed_foldToBet(size) < breakeven`, bluffs at that sizing are -EV and value bets gain from the same read"). Label-free.
- Per-villain-archetype decision cards → not printed. On-screen Calibration Dashboard renders calibration *mechanics* structurally (population-baseline-vs-observed shifts); per-villain data stays in `assumptionEngine/` / `calibrationDashboard` with source-util whitelist enforced at content-drift CI.

**Consequence:** 6-point fidelity bar (Voice 3 F-doctrine) ratified for Gate 4 charter. Source-util blacklist enforced: cards may NOT source from `villainDecisionModel`, `villainObservations`, `villainProfileBuilder`, `assumptionEngine`, `calibrationDashboard`. CI-linted at build.

**Gate 3 implication:** doctrine-reconciliation risk closed. Feature can proceed to Gate 4 with aggressive fidelity enforcement, no program-level escalation needed.

---

## Q2 — Scope phasing **[ANSWERED 2026-04-24: ACCEPTED]**

**Question:** Voice 3 recommended 3 phases:
- **Phase A — Preflop Refresher:** cards #1 (per-seat × hand preflop), #10 (pure-preflop), #16 (ICM push-fold). **Conditional on Q5 differentiation answer.**
- **Phase B — Math Tables:** cards #2, #3, #4, #5, #6, #17 (auto-profit, geometric, pot-odds, implied, binomial, SPR zones). Pure derivations. Clear market gap.
- **Phase C — Texture-Equity + Exceptions:** cards #7, #8, #11, #15 (reformulated). Per-card fidelity review. Highest anti-pattern risk.

Ship in A → B → C order? Or a different sequence? Or all-at-once (we refuse all-at-once per fidelity bar)?

**Recommendation:** Phase B first is also viable — Math Tables are the clearest market gap (no competitor ships rigorous math tables as laminates) and carry zero anti-pattern risk (pure derivations). Preflop-tier (Phase A) is market-contested; owner's differentiation answer (Q5) decides whether Phase A ships at all. Phase C last.

**Owner answer (2026-04-24):** **Accepted — B → A (conditional) → C.** Phase B (Math Tables — auto-profit / geometric / pot-odds / implied / binomial / SPR zones) ships first given the pure-math zero-anti-pattern profile + clearest market gap. Phase A (Preflop) ships conditional on Q5 differentiation demonstration. Phase C last with per-card fidelity review.

**Consequence:** Gate 4 surface spec must be phase-aware (per-phase authoring checklists); Gate 5 implementation follows phase order; Phase B can start in parallel with Phase A if Phase A passes Q5 at Gate 4.

---

## Q3 — Venue policy reality **[ANSWERED 2026-04-24]**

**Question:** Which casinos does owner actually play? Do they permit laminated reference cards at the table?

**Owner answer (2026-04-24):** Primary venues:
- **Wind Creek** (Wind Creek Bethlehem, PA likely primary — confirm if another Wind Creek location)
- **Homewood** (confirm which card room — likely Chicago-south-suburbs area; may be a local room or satellite)
- **Horseshoe Hammond** (Hammond, IN — Chicago-suburbs Horseshoe)
- **Rivers Des Plaines** (near O'Hare airport, IL)

**Policy ruling:** *"Most casinos will not allow anything to interrupt a hand. But the player can step away from the table and look at whatever he wants between hands, or be studying while they wait for a seat to open up, or on breaks during a live tournament."*

**Consequence:** primary-use situations for PRF-NEW-1:
- Stepped-away-from-table (bathroom, rail, snack break) between hands.
- Seat-waiting queue (in the poker room, not yet seated).
- Tournament scheduled break (typically 15 min).
- Pre-session at venue (walking in, ordering chips, waiting to sit).
- Post-session at venue (stepping out, reviewing).
- Off-venue (home, car, transit — pre-session or post-session).

**`mid-hand-chris` is NOT a design-driving situation.** Paper reference during an active hand is prohibited in all four primary venues. The `paper_reference_permitted` attribute originally proposed in Voice 1 §A2 is **WITHDRAWN**. Instead:
- Author NEW cross-persona situational `personas/situational/stepped-away-from-hand.md` capturing the four real at-venue interstitial contexts.
- `mid-hand-chris` is left unchanged — the laminate never competes for mid-hand attention in permitted venues; the situation doesn't exist.

**Design implication:** PRF-NEW-1 rewritten to NOT claim any mid-hand glance affordance. Paper-card-scan-glanceability (H-PM01, ≤1.5s) remains a design constraint, but for different reasons — between-hands-stepped-away windows are short (30-90s) and the user is walking / moving, so fast-scan still matters. Just not for "while facing a decision."

**Gate 3 artifact:** persona file `stepped-away-from-hand.md` authored same-session.

---

## Q4 — Print format **[ANSWERED 2026-04-24: ACCEPTED]**

**Question:** Default page size: US Letter (8.5×11") or A4? Default cards-per-sheet: 12 (~2.5"×2.25" each — pocket-index-card scale) or 6 (~3.75"×3.25" each — half-page-index-card scale)?

**Recommendation:** Letter default (US-primary owner) with A4 selectable. Cards-per-sheet depends on actual printer + laminator pouch sizes. Common laminator pouches:
- 3.7×5.1" "index-card" pouch → 6-up grid fits.
- 4×6" "photo" pouch → 4-up grid fits with larger individual card.
- 2.5×3.5" "business-card" pouch → 12-up grid, limited content per card.
- Full-sheet 9×11.5" pouch → 1-up, full-page card.

**Pending owner answer.** Which pouch sizes does owner use? Both short (at-venue glance) + full-page (deep study) variants may be useful.

**Owner answer (2026-04-24):** **Accepted — US Letter default + A4 selectable.** Cards-per-sheet flexibility preserved (12-up / 6-up / 4-up / 1-up grid selectable at print time per batch). Specific pouch-size defaults deferred to Gate 4 — surface spec asks owner at print time rather than hard-coding one assumption. H-PM04 (0.25" safe-trim margin) constrains all grid options.

**Consequence:** `surfaces/printable-refresher.md` Print Controls surface ships a cards-per-sheet selector (12/6/4/1) + page-size selector (Letter/A4) with Letter/12-up as startup defaults. User's last choice persists in `userRefresherConfig.printPreferences`.

---

## Q5 — Tier / pricing **[ANSWERED 2026-04-24: ACCEPTED]**

**Question:** Is PRF a free lead-gen feature (like Jonathan Little's free cash cheat sheet) or a Plus-tier differentiator (like BBZ's $20/mo bundle)?

**Market evidence (Voice 2):**
- Free lead-gen tier: Upswing free charts, Little free PDF, PokerCoaching free preflop. Drives downstream subscription conversion.
- Paid differentiator: BBZ $12.50-$20.80/mo for charts-only bundle; Red Chip PRO $50/mo for full courseware.

**Recommendation:** Math Tables phase (B) ships free — clear market gap, no competitor has paid math tables, high trust signal. Preflop phase (A) ships free IF differentiation argument holds (Q5 sub-question: does derivation-from-own-engine + rake-aware + stakes-selected version of preflop charts visibly differentiate from Upswing's free charts? If not, cut preflop tier). Texture-Equity + Exceptions phase (C) could be Plus-tier given per-card fidelity-review cost.

**Owner answer (2026-04-24):** **Accepted.** Phase B free (lead-gen). Phase A conditional on differentiation — if preflop cards are visibly indistinguishable from Upswing free at Gate 4 design review, cut Phase A entirely and link to Upswing; if differentiation is visibly apparent (rake-aware + stakes-selected + lineage-stamped badge on-card), ship as free or bundled with Plus at owner discretion. Phase C Plus-tier given per-card fidelity-review cost.

**Consequence:** Gate 4 `surfaces/printable-refresher.md` includes a Q5 differentiation demo gate for Phase A — owner eyeballs a preflop card mock vs Upswing's published chart; binary go/no-go ratification required before Phase A card authoring begins in Gate 5. Tier packaging decision itself remains open until Monetization & PMF project Gate 4 (cross-project dependency — not blocking PRF).

---

## Q6 — IDB v18 coordination with Shape Language **[ANSWERED 2026-04-24: ACCEPTED]**

**Question:** Shape Language also claims `v17 → v18` (for `shapeMastery` + `shapeLessons` stores). PRF targets `v17 → v18` (for `userRefresherConfig` + `printBatches`). Both cannot ship as v18 independently.

**Recommendation (Voice 5 + EAL precedent):** Whichever project reaches migration-authoring first claims v18; second claims v19. Coordinate via STATUS.md; add a Decisions Log entry on claim-time. **Not a blocking Gate 3 decision** — Gate 4 migration spec can declare `targetVersion: max(currentVersion + 1, 18)` dynamic rule per EAL gate4-p3-decisions.md §2.

**Pending owner ratification** — confirm dynamic-max rule is acceptable, OR owner picks explicitly now (e.g., "PRF is v18, Shape Language is v19" or vice versa).

**Owner answer (2026-04-24):** **Accepted — dynamic `max(currentVersion + 1, 18)` rule.** Whichever project reaches migration-authoring first claims the next available version; second claims the one after. Multi-store migrations in same version bump supported when concurrent; additive-only invariant preserved. Inherits from EAL Gate 4 P3 §2 decision pattern.

**Consequence:** PRF Gate 4 migration spec `PRF-G4-MIG` authors `targetVersion: max(currentVersion + 1, 18)` dynamic declaration. STATUS.md Decisions Log entry documents the rule for cross-project discoverability.

---

## Q7 — Personalization default **[ANSWERED 2026-04-24: ACCEPTED]**

**Question:** Voice 4 red line #16 says refresher content is NOT personalized from play data by default. Confirm: opt-in only in Phase 2+? Or is "your personalized pack tonight based on villain X" an acceptable near-term feature?

**Recommendation:** Phase 2+ with explicit opt-in.
- **Phase 1 default:** printable corpus is engine-derived from theoretical utils (`pokerCore/`, POKER_THEORY.md, population baselines). Per-villain data stays on-screen.
- **Phase 2+ opt-in:** explicit owner gesture ("include my EAL anchors in this print batch") activates personal-codex export (PRF-NEW-5). Default OFF.
- **Never default-on:** rejected per red line #16 + AP-PRF-9 (auto-personalized print pack refused).

**Rationale:** autonomy (owner-initiated personalization, not silent) + Reference-mode purity (refresher is population-baseline; personalization crosses into Deliberate-mode territory) + anti-cross-surface-contamination (printing a card shouldn't be readable by exploitEngine as "owner values this exploit").

**Owner answer (2026-04-24):** **Accepted — Phase 2+ opt-in only; default OFF.** Phase 1 ships with personalization absent entirely (`showPersonalCodex` toggle exists but is hidden until Phase 2 feature-flag lands). No auto-personalized print pack. Red line #16 binding; AP-PRF-9 refusal-list entry enforced.

**Consequence:** DS-61 JTBD (export-the-personal-codex) remains Active-but-Phase-2+ in `drills-and-study.md`; implementation item PRF-P2-CX remains in LATER tier in BACKLOG. Phase 1 `userRefresherConfig` schema reserves `printPreferences.includeCodex: false` as structural default (always false at Phase 1).

---

## Additional questions surfaced during Gate 2

Q8 (from Gate 2 Stage A) — **Newcomer activation threshold. [ANSWERED 2026-04-24: ACCEPTED]**

EAL used 25 hands. PRF is comprehension-oriented, so threshold may be time-based (1 completed session + explicit "I want printable reference" opt-in) instead of hand-based.

**Recommendation:** 1 completed session + explicit opt-in. Rationale: PRF is a study-mode surface, not a play-mode surface. Gating on hands-played is the wrong proxy; gating on "has the user seen a session end-to-end?" is the right proxy. After 1 full session, the user has enough context to know what "rake," "SPR," "effective stacks" mean in their venue — which is the minimum to benefit from a refresher.

**Owner answer (2026-04-24):** **Accepted — 1 completed session + explicit opt-in gesture.** `CONSTANTS.PRF_UNLOCK_THRESHOLD_SESSIONS = 1`. Edge cases (session deletion re-locks; imported legacy data = already-completed-sessions-count applies; dev-mode override available per EAL precedent) carry-forward to Gate 4 spec.

**Consequence:** `surfaces/printable-refresher.md` Gate 4 spec includes newcomer-locked empty-state + one-sentence factual copy ("Complete your first session to unlock printable reference cards") + no nudge / no progress-bar / no "almost there!" engagement pattern.

Q9 (from Voice 4 + Voice 5) — **Print-date-entry ergonomics. [ANSWERED 2026-04-24: ACCEPTED]**

Voice 4 red line #10 requires `printedAt` stamp per card. Voice 5 scoped a `printBatches` store. Is the stamp per-card (user stamps each card at print time) or per-batch (user stamps once at print action)?

**Recommendation:** per-batch. Per-card is ergonomically expensive (12 cards × entering date = friction); per-batch is one modal on print action ("Printing 12 cards on 2026-04-24 — confirm?"). Cards inherit the batch's stamp. If user re-prints a subset later, that's a new batch.

**Owner answer (2026-04-24):** **Accepted — per-batch stamp.** One modal at print action ("Printing 12 cards on DATE — confirm?") auto-populates today's date; user can override (e.g., backdate a batch if printing was delayed). Cards inherit the batch stamp. Re-printing a subset = new batch with new date.

**Consequence:** `printBatches` store keypath is `batchId` (UUID); cards reference `batchId` not `printedAt` directly; staleness-diff surfaces via JOIN on `batch.printedAt`. `surfaces/printable-refresher.md` print-confirmation modal spec defines the date-override affordance.

---

## Summary of open questions

| Q | Topic | Recommendation | Status |
|---|-------|----------------|--------|
| Q1 | Doctrine reconciliation | Refusals stand; decomposed replacements adopted | **ANSWERED — ACCEPTED** |
| Q2 | Scope phasing | B → A (conditional) → C | **ANSWERED — ACCEPTED** |
| Q3 | Venue policy | Between-hands-stepped-away primary; mid-hand excluded | **ANSWERED** |
| Q4 | Print format | Letter default + A4 selectable; pouch-size-driven cards-per-sheet | **ANSWERED — ACCEPTED** |
| Q5 | Tier / pricing | Math tables free; preflop conditional on differentiation demo; exceptions Plus | **ANSWERED — ACCEPTED** |
| Q6 | IDB v18 coordination | Dynamic max(currentVersion+1, 18) rule | **ANSWERED — ACCEPTED** |
| Q7 | Personalization default | Phase 2+ opt-in only; default OFF | **ANSWERED — ACCEPTED** |
| Q8 | Newcomer threshold | 1 session + explicit opt-in | **ANSWERED — ACCEPTED** |
| Q9 | Print-date ergonomics | Per-batch stamp | **ANSWERED — ACCEPTED** |

**All 9 questions answered 2026-04-24.** Gate 3 owner interview CLOSED. Gate 4 unblocked.

---

## Change log

- 2026-04-24 — Created. Q1 + Q3 answered inline. 5 owner questions remaining (Q2, Q4-Q9). Persona-amendment consequence of Q3: `paper_reference_permitted` withdrawn from `mid-hand-chris`; new situational `stepped-away-from-hand.md` authored same-session.
- 2026-04-24 — **Q2 + Q4 + Q5 + Q6 + Q7 + Q8 + Q9 answered ("accept all recommendations").** All 9 interview questions closed. Gate 3 owner-interview block CLOSED; Gate 4 unblocked pending Gate 2 re-run verdict (expected GREEN). Consequences threaded into surface-spec carry-forwards: Q2 phase-aware Gate 4 authoring (B → A → C); Q4 Letter+A4 selectable + per-batch cards-per-sheet selector; Q5 Phase A gated on differentiation demo at Gate 4; Q6 dynamic max-version migration rule; Q7 personalization Phase 2+ default-OFF structural; Q8 1-session unlock threshold; Q9 per-batch print-date stamp with override affordance.
