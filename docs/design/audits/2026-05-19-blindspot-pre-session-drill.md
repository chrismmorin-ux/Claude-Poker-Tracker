# Blind-Spot Roundtable — 2026-05-19 — Pre-Session Drill

**Date:** 2026-05-19
**Project:** Pre-Session Drill (PSD) — design framework Gate 2
**Facilitator:** Claude (main)
**Format:** Per `docs/design/ROUNDTABLES.md` — five stages, custom persona set for PSD's blind-spot space.
**Preceded by:** Gate 1 Entry audit 2026-04-23 (`2026-04-23-entry-pre-session-drill.md`), verdict 🔴 **RED**, corpus-gated at <15 artifacts.
**Authority claim (per founder ratification D3, 2026-05-19 plan-mode):** this Gate 2 verdict **supersedes** the Gate 1 RED. The corpus blocker (the load-bearing reason for RED) has been resolved by SPR-071 (15 artifacts shipped 2026-05-11). Other gate dimensions are re-examined here.
**WS ticket:** WS-063. **Sprint:** SPR-090.

---

## Feature summary

PSD is a new mode inside `PostflopDrillsView` (per Gate 1 — no new routed view) that delivers compressed active-recall **drill cards** to the user in a 5 / 15 / 30 min window before a live cash session. Each card is sourced mechanically from the upper-surface reasoning-artifact corpus (`docs/upper-surface/reasoning-artifacts/`, 15 artifacts as of 2026-05-11). Front: spot + prompt. Back: action + 3 reasoning beats + sensitivity pivot + falsification criterion + section anchors back into the source artifact. Selection is recency-weighted (recent leaks) and frequency-weighted (common spots).

PSD is **bidirectional** by founder ratification (D1, 2026-05-19): the same surface runs in **prep mode** (pre-session) and **review mode** (post-session, within ~48h), closing the loop on which predictions fired and which got caught. Both modes anchor on the same `presession-preparer` situational persona (already authored 2026-04-23 as a Gate 3 output of the exploit-deviation project).

**v1 baseline:** 1600×720 landscape (founder ratification D2). Mobile-portrait is a separate Gate 4 surface variant authored as a follow-up ticket.

---

## What Gate 1 said vs. what's now true

| Gate 1 finding (2026-04-23) | Status today (2026-05-19) |
|---|---|
| 🔴 Corpus is 2 nodes; needs ~15 minimum | ✅ Resolved — 15 reasoning artifacts + 15 drill cards at `docs/upper-surface/`. SPR-071 close-out. |
| 🟡 Likely new situational persona needed ("pre-session Chris") | ✅ Resolved — `presession-preparer.md` exists (2026-04-23, bidirectional, proto). |
| 🟡 Drills Consolidation HOLD — placement constrained | ✅ Resolved — Drills Consolidation **rejected** 2026-04-22 (see WS-053 status note + `drills-consolidation.project.md` rejected); "stay inside `PostflopDrillsView` mode-bar" is permanent. |
| 🟡 4 proposed JTBDs (DS-56/57/58/59) | ⚠️ Still open — overlaps with already-authored JTBD-SE-01/02/03 in presession-preparer must be reconciled in Gate 3 (Stage B output). |
| 🟡 Active-recall flip-card pattern is novel | ⚠️ Still open — flip-card vs side-by-side is a Gate 4 design decision (Gate 1 Q5). |
| 🟡 Hand-history × node-ID cross-reference doesn't exist | ⚠️ Still open — schema decision + 200-300 LOC infra are Phase-0-engineering follow-ups (Stage D). |

Net: two gate dimensions remain YELLOW; none is currently RED.

---

## Custom personas for this roundtable

Six voices, each with a narrow mandate inside PSD's blind-spot space. Five voices is the typical floor in `docs/design/ROUNDTABLES.md`; PSD's cross-cutting nature warrants the sixth (Autonomy Auditor) to enforce the project-wide red lines documented in memory.

| Voice | Mandate |
|---|---|
| **Learning Scientist** | Recognition-primed decisions (Klein RPD), priming vs consolidation, spaced repetition, desirable difficulty. |
| **Pro Coach** | Transfer-to-table: what makes pre-session prep actually change in-hand behavior, vs. theater that just *feels* useful. |
| **Behavioral Psychologist** | Pre-game anticipatory cognition, mood-coloring (stuck/heater), anxiety priming, loss-aversion contagion. |
| **Mobile-Context Skeptic** | The actual physical situation: phone-in-cab, walking, last-minute distractions, low ambient light, one-handed grip. |
| **Cross-Surface Architect** | IDB schema impact (`hands` ↔ node-ID), sidebar product-line ripple, drill ↔ HandReplay ↔ Sessions navigation paths. |
| **Autonomy Auditor** | Enforces the project red lines: no engagement pressure, no tier-rank labels, no shame copy, no system-imposed grading (founder-volunteered only). |

---

## Stage A — Persona sufficiency

**Question:** Who would plausibly use PSD who we have NOT modeled in `personas/`?

### Voices

**Learning Scientist:** `presession-preparer` correctly separates priming (PSD) from consolidation (`study-block`). The bidirectional authoring (prep + review modes in one persona file) is the right call — RPD literature treats rehearsal and outcome-review as one practice loop, not two. Do not split.

**Pro Coach:** The persona file lists `apprentice-student` as an applies-to. But Apprentice is a *learner-shaped* persona; their pre-session window looks more like Study Block extended into the session entryway. A 90-second card with falsification depth probably overshoots them. Flag for Gate 3: validate Apprentice's drill-card-depth tolerance vs Chris's.

**Behavioral Psychologist:** `presession-preparer` covers mood-coloring at the persona level (stuck / heater / neutral). But there is a parallel persona — `post-session-chris` — that *also* models post-session state. Risk of double-modeling: review mode of presession-preparer covers the same ground as post-session-chris. Reconcile.

**Mobile-Context Skeptic:** Persona file calls out phone-in-cab in `Context`. But none of the existing situational personas models the *physical context immediately before live play* — `mid-hand-chris` is in-game, `between-hands-chris` is too tight, `post-session-chris` is review. presession-preparer is correctly the first persona for this physical context. ✅

**Cross-Surface Architect:** No new core persona needed. PSD does not introduce a user archetype that isn't already a presession-preparer in some time-budget variant.

**Autonomy Auditor:** `presession-preparer` line 116–117 cites `JTBD-DS-46` (spaced repetition). Spaced-repetition systems classically gamify with streaks / mastery scores — that's exactly the engagement-pressure surface area the project red lines refuse (per `feedback_scf_learning_state_not_tier_rank` and `feedback_owner_volunteered_grading`). Stage A flag: confirm that the spaced-repetition link is **scheduling logic only**, not a streak/mastery surface.

### Output: ⚠️ **Patch needed**

- **Resolved (no change required):**
  - presession-preparer's bidirectional authoring stands; do not split into separate prep / review personas. (Confirms founder D1 ratification.)
  - No new core persona needed.
  - presession-preparer correctly occupies the "physical context immediately before live play" gap.
- **Reconciliation required (Gate 3):**
  - **A-R1** Reconcile presession-preparer's review-mode coverage with `post-session-chris`. Specifically: is "drill prediction × outcome review" the same situation as "session-just-ended general reflection"? Either (a) presession-preparer's review mode is the drill-specific cut of post-session-chris (Gate 3 documents the relationship), or (b) post-session-chris narrows to non-drill review (e.g., hand-by-hand replay) and presession-preparer owns drill review (Gate 3 amends post-session-chris).
  - **A-R2** Validate proto-persona caveats PSP-1/2/3 (time-budget variants 5/15/30, mood detection reliability, 48h review window) with owner per the persona file's `Owner review: Pending` flag.
  - **A-R3** Apprentice-Student depth tolerance — flag as Gate 3 question; verify falsification-criterion depth doesn't overshoot a still-learning persona.
- **Engagement-pressure flag (Autonomy Auditor):**
  - **A-AP1** When PSD references spaced repetition (DS-46), implementation must be scheduling-only — no streak/mastery surfaces, no leaderboards, no progress-bar gamification. Bind in Gate 4 surface spec.

---

## Stage B — JTBD coverage

**Question:** What outcomes would PSD users want that are NOT in our JTBD atlas?

### Voices

**Pro Coach:** Gate 1 proposed DS-56/57/58/59 in the **drills-and-study** domain. But `presession-preparer` already authored JTBD-SE-01/02/03 in the **session-entry** domain. PSD's primary outcomes are session-entry outcomes ("prepare tonight's read"), not drills-and-study outcomes ("learn theory"). The DS-* framing of Gate 1 is mis-classified. Gate 3 should move SE-* to canonical and reframe DS-56/57 as derivatives.

**Learning Scientist:** DS-56 (active-recall pattern priming) ≈ SE-01 (prepare tonight's watchlist) framed at the *cognitive-mechanism* level. They are the same JTBD seen through two lenses (outcome vs mechanism). Per JTBD doctrine, name the *outcome*. Keep SE-01; absorb DS-56 as the mechanism citation.

**Pro Coach:** DS-57 (recency-weighted from recent leaks) and SE-02 (review predictions vs outcomes) are *coupled* but distinct. DS-57 is *what the algorithm does this session* (forward-looking). SE-02 is *what the user reviews next session* (backward-looking, closing the loop). Both stay as JTBDs.

**Cross-Surface Architect:** DS-58 (anchor-trace from card to full artifact) is a *navigation* JTBD, not a study JTBD. It belongs alongside other cross-link JTBDs (e.g., HandReplay → drill). Gate 3 decision: file it under `cross-cutting.md` or `drills-and-study.md`?

**Behavioral Psychologist:** DS-59 (verify the card's claim by re-running falsifier) overlaps with Range Lab's intended falsifier-verification flow. If Range Lab implements artifact-corpus rendering with a "re-run on population sample" affordance, PSD inherits it via DS-58 navigation. If Range Lab doesn't, PSD needs its own. Gate 3 should not author DS-59 until Range Lab Gate 2 (WS-053) closes — risk of duplicating infra.

**Autonomy Auditor:** None of the proposed JTBDs imposes grading on the user. SE-02 (review predictions vs outcomes) is **founder-volunteered grading** — the user opts into review by choosing to open it. ✅ Stays within the autonomy red lines per `feedback_owner_volunteered_grading.md`.

### Output: ⚠️ **Expansion needed**

- **Gate 3 JTBD work:**
  - **B-G1** Canonicalize `JTBD-SE-01/02/03` in `docs/design/jtbd/domains/session-entry.md`. Move from presession-preparer's local citation to the atlas. Cite from PSD surface spec.
  - **B-G2** Absorb DS-56 into SE-01 as a mechanism citation (do not author DS-56 as a parallel JTBD — same outcome).
  - **B-G3** Author **DS-57 (recency-weighted drill selection from recent leaks)** in `drills-and-study.md`. Keep DS-* domain — DS-57 is genuinely about *what the algorithm does mid-drill*, not what outcome the user pursues post-session.
  - **B-G4** Defer **DS-58 (anchor-trace)** authoring pending decision on domain placement (`cross-cutting.md` vs `drills-and-study.md`). Tag as Gate 3 question.
  - **B-G5** **Defer DS-59 (falsifier-verify)** until Range Lab Gate 2 (WS-053) closes. Re-evaluate then — if Range Lab owns the falsifier-rerun flow, PSD inherits via DS-58 navigation and does not need its own JTBD.

No new JTBD *domains* required — all outcomes land in existing `session-entry` + `drills-and-study` + possibly `cross-cutting`.

---

## Stage C — Situational stress test

**Question:** Does PSD survive the situations its users are actually in?

### Voices

**Mobile-Context Skeptic:** The persona's `Constraints` block says "Phone primarily (walking to venue), desktop occasionally (home before leaving)." Founder D2 explicitly chose landscape-1600×720 v1. That choice ships a surface that does NOT survive the persona's stated primary context. Two reads:
  - **(a)** Founder is being honest about v1 scope; mobile-portrait is a real follow-up. The persona-file is forward-looking. Acceptable as long as a mobile-portrait Gate 4 ticket exists.
  - **(b)** Landscape-v1 silently downgrades the persona's primary context to a secondary context, which would be persona-stretching (Anti-pattern 1 in `ROUNDTABLES.md`). Avoidable by being explicit.
  - Verdict: ⚠️ — Gate 4 ticket for mobile-portrait surface variant is mandatory. PSD-Stage-C output must list it under follow-ups.

**Learning Scientist:** 5-min variant gives ~1 min/card for 5 cards. RPD literature: ≥60s/card for predict-then-flip with cognitive consolidation is the floor. 5 cards × 60s is exactly at the floor. If the artifact's falsification criterion takes ~20s to read, the user can absorb maybe 3 of the 5 reasoning beats before they have to move on. This is fine for *priming* — it's bad for *learning*. Tag as a design discipline: card backs must be skim-tolerant. Falsifier headline at top, citation paragraph beneath, anchor links last.

**Behavioral Psychologist:** Mood-coloring is the highest-risk surface. Stuck-mode user opens PSD before tonight's session looking for grounding; if the first card surfaces the leak they failed at last session, it primes shame/aggression. Heater-mode user opens it looking for confirmation; if recency-weighted selection serves them the spots they've been *crushing*, it primes overconfidence. Both failure modes are the *recency-weighting algorithm doing exactly what it's supposed to do*. Mitigation must live in the selection layer (mood-aware card-mix), not the surface layer.

**Pro Coach:** 15-min variant has the most affordance. 30-min variant risks turning PSD into a Study Block — the persona file's non-goals list "deep concept study" as out-of-scope. Gate 4 should explicitly cap the 30-min variant's depth — adding cards is fine; adding deeper explanations contaminates the persona.

**Cross-Surface Architect:** Phone-sleep mid-card: if the user's phone goes to sleep between predict and reveal, what's the recovery? Persona file `Recovery expectation: Retry-later queue for missed cards`. So a sleep mid-flip auto-marks as "not attempted" → re-queues at the end. That's the right behavior but needs to be explicit in the surface spec.

**Autonomy Auditor:** Mood-aware framing is necessary *and* dangerous. "Mood-aware" can drift into "shame-coddling" (stuck-mode user gets congratulated on trivia to feel better) or "engagement-pressure" (heater-mode user gets pushed to do more cards). The autonomy-aligned design is to **adjust the card mix, not the framing**. Surface tone stays neutral; selection algorithm shifts.

### Output: ⚠️ **Adjust**

- **C-A1** Mobile-portrait Gate 4 surface variant ticket is mandatory (per D2). Without it, landscape-v1 silently downgrades the persona's primary context.
- **C-A2** Card-back content discipline (Gate 4): falsifier headline first, citation paragraph second, anchor links last. Skim-tolerant for 1 min/card budgets.
- **C-A3** Mood-aware **selection** (not framing). Stuck-mode card mix biases toward winnable spots; heater-mode card mix biases toward edge-case challenges. Surface tone remains neutral.
- **C-A4** 30-min variant depth cap (Gate 4): adds card count, not card depth. Prevents PSD-as-Study-Block contamination.
- **C-A5** Phone-sleep recovery: missed card → not-attempted → retry-later queue. Explicit in surface spec.
- **C-A6** Mood-detection reliability is a proto-caveat (PSP-2). Until it's validated, ship with **user-declared mood toggle** as fallback. Auto-detection is opt-in v2.

---

## Stage D — Cross-product / cross-surface

**Question:** Does PSD have ripples beyond `PostflopDrillsView`?

### Voices

**Cross-Surface Architect:** Three direct ripples and one indirect:
  - **Direct 1 — `hands` store schema.** DS-57 (recency-weighted) requires per-hand → node-ID matching. Two implementation choices:
    - **Schema-write:** tag each new hand at write-time with matching node-IDs. Cheap at query time, requires node-matching logic on hand write. Schema migration on existing hands or accept that recency-weighting is forward-only.
    - **Query-time match:** no schema change; cross-reference at drill open. Higher query cost; recency-weighting works on historical hands without migration.
  - Both are tractable. Decision belongs to a separate /decide ADR or an engineering-program ticket.
  - **Direct 2 — `SessionsView` entry point.** A "Pre-Session Drill for tomorrow" affordance from SessionsView is additive — small change, scoped to one menu item.
  - **Direct 3 — `HandReplayView`.** "Review this spot in PSD format next session" is additive. Per Gate 1, this is the DS-58 anchor-trace's *consumer* direction (review → drill), not the *producer* direction (drill → artifact).
  - **Indirect — Online sidebar.** The sidebar product line is *in-game*. PSD is *pre-game*. No counterpart needed in the online product line. ✅

**Pro Coach:** SessionsView entry point creates a workflow loop: post-session review → flag spot → tomorrow's PSD includes it → drill prediction → tomorrow's session → outcome review. The loop closure is the persona's review-mode JTBD (SE-02). The surface design must make this loop discoverable without forcing a tutorial.

**Behavioral Psychologist:** The recency-weighted feedback loop has a known failure mode: if hero misses a spot today, drills it tomorrow, encounters it again, and still misses, the algorithm keeps surfacing it. Hero feels "this drill is rubbing my failure in my face." Mitigation: cap consecutive presentations of the same spot at N (Gate 4 spec).

**Mobile-Context Skeptic:** The DS-58 anchor-trace destination decision (Gate 1 Q6) affects cross-surface scope dramatically. (a) In-app: bundle adds upper-surface artifacts into the app bundle (size cost, sync cost). (b) External: opens a hosted version of the docs (network dependency at pre-session). (c) Inline: truncated section in-card (UX cost, no surface deferral). (d) Defer to Range Lab. Pre-session use means option (b) is risky — user in cab with bad signal can't access deep context. Recommend (a) or (c) for v1. Gate 4 ADR.

**Learning Scientist:** Cross-surface flag: the upper-surface artifact corpus is currently `docs/` — the app does not consume it at runtime. Either Range Lab Gate 4 brings artifact rendering into the app, or PSD must do it independently. Coordinate via WS-053 closure.

**Autonomy Auditor:** No cross-surface red-line risks identified. The SessionsView entry point is opt-in; the HandReplay link is opt-in; the recency-weighting algorithm operates inside an opt-in surface. ✅

### Output: ⚠️ **Partner surfaces need updates**

- **D-P1** `hands` ↔ node-ID schema: separate engineering-program ticket. Schema-write vs query-time decision is its own ADR (or absorbed into the ticket).
- **D-P2** SessionsView entry point: additive — Gate 4 surface spec for `sessions-view.md` adds one affordance.
- **D-P3** HandReplayView cross-link: additive — Gate 4 surface spec for `hand-replay-view.md` adds one affordance.
- **D-P4** No sidebar counterpart needed (in-game vs pre-game is a clean separation).
- **D-P5** DS-58 anchor-trace destination: Gate 4 ADR. Recommend in-app or inline for v1; external is mobile-fragile.
- **D-P6** Artifact-rendering ownership: coordinate with WS-053 (Range Lab Gate 2). If Range Lab Gate 4 brings the corpus into the app, PSD inherits the renderer. If not, PSD authors its own.

---

## Stage E — Heuristic pre-check

**Question:** Against Nielsen 10 + Poker-Live-Table + Mobile-Landscape, does the proposed PSD design obviously violate anything?

### Voices

**Mobile-Context Skeptic (H-ML06 touch target ≥44 DOM-px):** Flip-card area must be the dominant tap target on the card — generous, no competing buttons inside the card body. Standard fail mode is putting a "next" arrow and a "favorite" icon inside the card; both swallow flip taps.

**Learning Scientist (H-N03 undo, H-PLT06 misclick absorption):** Flip is non-destructive. Misclick on "next" *before* attempting prediction skips the card. That's destructive in a 5-min budget. Mitigate: long-press confirmation OR auto-mark as not-attempted (re-queues at end). Latter is consistent with phone-sleep recovery (C-A5).

**Pro Coach (H-PLT07 state-aware primary action):** Primary action shifts state mid-card: pre-reveal → "flip"; post-reveal → "next" (or "I got it right / wrong" → "next"). H-PLT07 says primary action must be visibly state-aware. Buttons should re-label, not stay generic "continue."

**Cross-Surface Architect (H-N09 help and documentation):** Anchor-trace links (DS-58) provide deep documentation per heuristic. Decision deferred to Gate 4 ADR — but the heuristic check is satisfied as long as anchor-trace is implemented in any of the four options.

**Behavioral Psychologist (H-N10 error prevention):** "Mark wrong" must not be destructive — user can change their mind, retract the self-grade. Avoid binary commit. Suggest tri-state: "got it / partial / missed" with edit affordance until card is closed.

**Autonomy Auditor (project-specific):** Forbidden surface elements (per memory): streak counters, mastery scores, leaderboards, tier badges, shame copy ("you're a Bronze leak-fixer"), congratulatory copy ("amazing! 100% accuracy!"). Drill chrome must be **factually neutral** — "this card asks: X. Your answer: Y. Actual answer: Z. Citation: ..." No emotional inflation.

### Output: ⚠️ **Specific adjustments needed**

- **E-A1** Flip-card area is dominant tap target. No competing controls inside card body. Gate 4 layout spec.
- **E-A2** "Next" mid-prediction → auto-mark not-attempted → retry-later queue (no destructive skip).
- **E-A3** State-aware primary action labels: "Flip" → "Got it / Partial / Missed" → "Next". No generic "Continue."
- **E-A4** Tri-state self-grade with retract affordance until card closes. No binary commit.
- **E-A5** Drill chrome stays factually neutral. No streaks, mastery scores, leaderboards, tier badges, congratulatory or shame copy. Citation strings only.
- **E-A6** Anchor-trace destination decided in Gate 4 ADR (D-P5). All four options satisfy H-N09 once implemented.

---

## Overall verdict

🟡 **YELLOW** — supersedes Gate 1's RED.

**Rationale.** The single load-bearing reason for Gate 1's RED (corpus < 15 artifacts) is fully resolved (SPR-071, 2026-05-11). Of the five Gate-1 YELLOW dimensions, two are now fully resolved (persona exists, drills-consolidation rejected) and three remain (JTBD reconciliation, active-recall design decision, hand-history schema). None of the remaining open items is individually a RED gate; they are all standard pre-Gate-4 design decisions that gate the surface spec but not the gate process.

**YELLOW conditions to clear before Gate 4 (Design) starts:**

1. **JTBD canonicalization** (Stage B G1–G5). SE-* in atlas. DS-58 placement decided. DS-59 deferred pending WS-053.
2. **Active-recall design decision** (Gate 1 Q5). Flip-card vs side-by-side. ADR or in-Gate-4-spec.
3. **Anchor-trace destination decision** (Gate 1 Q6, Stage D P5). In-app / inline / external / defer-to-Range-Lab. ADR or in-Gate-4-spec.
4. **`hands` ↔ node-ID schema decision** (Stage D P1). Schema-write vs query-time. ADR or absorbed in engineering ticket.
5. **Mobile-portrait surface variant ticket** authored (Stage C A1, founder ratification D2). Separate Gate 4 deliverable.

When all five clear, Gate 4 can begin. None requires src/ code — they are design / decision artifacts.

**Implicit Gate 3 (Research) authority** to address: A-R1 (presession-preparer × post-session-chris reconciliation), A-R2 (PSP-1/2/3 proto-caveat verification with owner), A-R3 (Apprentice-Student depth tolerance), B-G1–B-G5 (JTBD authoring).

**Founder-ratified scope confirmations (2026-05-19 plan-mode):**
- D1 (prep + review modes together) — bound throughout Stages A/B/C/D.
- D2 (landscape v1 + mobile audit follow-up) — Stage C A1.
- D3 (Gate 2 re-verdict supersedes Gate 1) — header authority claim, this section.

---

## Required follow-ups (blocking Gate 4 unless noted)

- [ ] **WS-195 (Gate 3 Research)** — Author JTBD-SE-01/02/03 in `session-entry.md`; absorb DS-56 mechanism into SE-01; author DS-57 in `drills-and-study.md`; defer DS-58 placement decision + DS-59 entirely. Reconcile presession-preparer × post-session-chris (A-R1). Validate PSP-1/2/3 with owner (A-R2). Validate Apprentice depth tolerance (A-R3). **Program: design. Priority: P2.**
- [ ] **WS-196 (ADR via /decide)** — Active-recall pattern: flip-card vs side-by-side. **Program: design. Priority: P2.**
- [ ] **WS-197 (ADR via /decide)** — Anchor-trace destination (DS-58): in-app artifact / external link / inline expansion / defer to Range Lab. **Program: design. Priority: P2.**
- [ ] **WS-198 (engineering Phase-0 prerequisite)** — `hands` ↔ upper-surface-node-ID cross-reference. Schema-write vs query-time decision absorbed in this ticket. 200-300 LOC + tests per Gate 1 estimate. **Program: engineering. Priority: P3 — does not block Gate 4 design but blocks DS-57's actual function.**
- [ ] **WS-199 (Gate 4 design — primary)** — Surface update to `docs/design/surfaces/postflop-drills.md` documenting Pre-Session mode addition. Includes: flip-card layout (per WS-196 ADR), card-back skim discipline (C-A2), state-aware primary actions (E-A3), tri-state self-grade (E-A4), neutral chrome (E-A5), mood-aware selection (C-A3), 30-min depth cap (C-A4), phone-sleep recovery (C-A5), 5/15/30-min variant card counts. Do NOT author `surfaces/pre-session-drill.md`. **Program: design. Priority: P2. Blocked by WS-195/196/197.**
- [ ] **WS-200 (Gate 4 design — mobile-portrait variant)** — Surface variant audit for mobile-portrait PSD (per D2 + C-A1). Separate ticket; does not block landscape v1 Gate 4. **Program: design. Priority: P3.**
- [ ] **WS-201 (domain-correctness research)** — Stuck/heater mood detection reliability (proto-caveat PSP-2). Until validated, ship with user-declared mood toggle (C-A6 fallback). **Program: domain-correctness. Priority: P3.**

**SessionsView + HandReplayView additive entry points (D-P2 / D-P3)** — absorbed into WS-199 Gate 4 design surface spec; no separate tickets needed unless surface owners disagree.

---

## Links

- Gate 1 audit: [`./2026-04-23-entry-pre-session-drill.md`](./2026-04-23-entry-pre-session-drill.md)
- Roundtable template: [`../ROUNDTABLES.md`](../ROUNDTABLES.md)
- Surface this expands: [`../surfaces/postflop-drills.md`](../surfaces/postflop-drills.md)
- Anchor persona: [`../personas/situational/presession-preparer.md`](../personas/situational/presession-preparer.md)
- Reconciliation persona: [`../personas/situational/post-session-chris.md`](../personas/situational/post-session-chris.md)
- Corpus (15 artifacts): [`../../upper-surface/reasoning-artifacts/`](../../upper-surface/reasoning-artifacts/)
- Drill cards (15 cards): [`../../upper-surface/drill-cards/`](../../upper-surface/drill-cards/)
- JTBD domain: [`../jtbd/domains/session-entry.md`](../jtbd/domains/session-entry.md), [`../jtbd/domains/drills-and-study.md`](../jtbd/domains/drills-and-study.md)
- Adjacent prior roundtable (cross-citing presession-preparer authoring): [`./2026-04-23-exploit-deviation-blindspot.md`](./2026-04-23-exploit-deviation-blindspot.md)
- Sprint: SPR-090. Ticket: WS-063.

---

## Change log

- 2026-05-19 — Created. Supersedes Gate 1 RED per founder D3 ratification. Verdict YELLOW with 5 conditions for Gate 4 entry. Authored as the sole deliverable of SPR-090 (single-item plan-first sprint). Follow-up tickets WS-195..WS-201 authored in same sprint.
