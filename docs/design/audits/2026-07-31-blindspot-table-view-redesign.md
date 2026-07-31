# Blind-Spot Roundtable — 2026-07-31 — Table View redesign

**Gate:** 2 (Blind-Spot Roundtable)
**Triggered by:** [Gate 1 entry audit](./2026-07-31-entry-table-view-redesign.md) — RED verdict (4 triggers fired)
**Method:** `ROUNDTABLES.md` five-stage template (A persona sufficiency, B JTBD coverage, C situational stress, D cross-surface, E heuristic pre-check), run against the three founder-ratified directions.
**Status:** **YELLOW — all three directions survive, all three require amendment. Gate 3 required, scoped.**

---

## Feature summary

Three directions ratified by the founder 2026-07-31:

- **D-1 Defaults** — action buttons weighted by real frequency; most-likely action pre-armed as a single confident tap; precise entry one tap away; nothing auto-records.
- **D-2 Dynamic layout** — felt narrows and the command panel grows as live players remaining falls.
- **D-3 Player entry** — recents-first roster rail in the felt's currently-dead space; tap an empty seat to assign; context menu keeps only rare seat-config ops.

This roundtable's job is to find what the framework cannot see about them.

---

## Stage A — Persona sufficiency

### A1 — No persona models *spatial* re-orientation *(RED — new persona required)*

`stepped-away-from-hand` and `returning-after-break` model **state** recovery: *what happened while I was gone.* Neither models **spatial** recovery: *the table is a different shape than when I last looked at it.*

This is not an edge case for D-2 — it is D-2's normal operation. A live player's eyes are on the felt, the dealer and the villains far more than on the phone. The reflow will, by construction, usually happen while they are not watching.

**Proposal:** new situational persona `glance-return-chris` — *returns eyes to the screen mid-hand, having tracked the physical table for 2–15 seconds, needing to resume entry without re-reading the whole surface.* Distinct from `stepped-away-from-hand` (minutes, whole-hand loss) and from `mid-hand-chris` (continuous attention). This persona is the one D-2 must be designed for, and its absence is why the framework would otherwise green-light a moving layout.

### A2 — `ringmaster-in-hand` still PROTO *(carried forward, YELLOW)*

Flagged 2026-04-21 open question #4. Fourteen weeks later, still no founder observation backing it. D-1 and D-2 both cite it as a beneficiary. **Designing surface area for an unvalidated persona is how features get built for nobody.** Either validate it in Gate 3 or stop citing it as justification.

### A3 — Table composition churn is under-modeled for D-3 *(YELLOW)*

`seat-swap-chris` models *hero* changing seats. The roster rail's actual load is *villains* arriving, busting, and being seated by the floor — continuous in live cash, and nobody's modeled job. This is the volume driver for D-3 and the cast covers it only obliquely.

### A4 — Handedness is unmodeled *(YELLOW)*

D-3 places a persistent interactive rail in the felt's bottom band. Which thumb reaches it in one-handed landscape depends on grip, and no persona declares handedness. H-PLT02 (one-handed reachability) cannot be evaluated against an unstated assumption. Cheap to close — ask the founder.

---

## Stage B — JTBD coverage

### B1 — No job for "the app proposes my next input" *(RED)*

Carried from Gate 1 G2. The atlas covers entering (HE-11), correcting (HE-12), and being advised (MH domain). Advice is **inert** — it never touches the input. Pre-arming is a third thing, and its success criteria are not derivable from the other two. The load-bearing question it must answer: **does a pre-armed wrong default get committed more often than an un-armed one?** Nothing in the atlas frames that.

**Proposal:** author `HE-19 — Accept or override a proposed action` with explicit failure mode *"the proposal was committed without being read."*

### B2 — No job scopes the orbit as a unit *(YELLOW)*

HE-11 is per-seat-action ("so I don't fall behind"). Orbit tap-ahead and the three batch controls already operate on runs of seats with no job of their own — they were built as HE-11 accelerators. The founder is describing **per-orbit** throughput. Optimising a per-seat metric against a per-orbit goal is how you ship a faster button and a slower hand.

**Proposal:** author `HE-20 — Record a full orbit without falling behind the dealer`, with the orbit as the unit of success.

### B3 — No job for the roster as a standing object *(YELLOW)*

PM-02 is a discrete act ("assign a known player to a seat"). D-3 implies a continuous job: *keep the app's picture of this table matching reality, cheaply, all session.* Without it, the rail will be specified as a faster PM-02 and will miss the maintenance case (A3).

### B4 — HE-11's own success criterion is the wrong unit for this work

Noted rather than proposed: HE-11 says "one tap per seat-action." Measured today, routine preflop is already ~4 taps per orbit (Gate 1 E5). **The preflop entry path is close to optimal and is not where the founder's speed problem lives.** If the redesign is scoped by HE-11 it will re-optimise the one thing that already works. Gate 4 must scope to postflop entry, player entry, and legibility-under-compression.

---

## Stage C — Situational stress test

### C1 — D-2 breaks `mid-hand-chris` and the proposed `glance-return-chris` as stated *(CRITICAL)*

If the felt narrows on live-players-remaining, it reflows **the instant a seat folds** — mid-street, mid-orbit, mid-glance-away. The user looks back and every seat has moved. Their half-second budget is now spent re-finding the seat instead of recording the action. **D-2 as literally stated would make the surface slower for its primary persona in exactly the situation it is meant to speed up.**

The direction is not wrong; the *trigger granularity* is.

**Amendment C1-A (strong recommendation):** keep **live players remaining** as the driver — the founder's instinct is correct that street is the wrong signal — but **quantize transitions to street boundaries only.** The felt re-proportions when the board changes, which is already a natural pause where the user is looking at the dealer's cards, not at seats. Never reflow mid-street. This preserves the whole benefit (heads-up river is genuinely narrow) and removes every instance of motion-under-the-thumb.

**Amendment C1-B:** transitions must be instantaneous-on-resume. If the app was backgrounded across a transition, it must present the *new* shape already settled, never animate into it on unlock (H-PLT05).

### C2 — D-1's frequency-weighting inverts information value *(CRITICAL)*

Sizing action buttons by frequency means **the rarest actions get the smallest targets.** But in a read-building tracker, the rare action is the high-information one — a villain's out-of-character raise is precisely the event whose capture matters most, and it is the event the founder is at the table to notice.

Frequency-weighted target sizing would make the app **fastest at recording what tells you the least, and slowest at recording what tells you the most.** Compounding: under time pressure with a pre-armed common action, the rare event is also the one most likely to be mis-committed to the default.

**Amendment C2-A (binding):** weight **visual prominence** (colour, contrast, label weight, position), never **hit-target area**. Every action target stays ≥44px (H-ML06) and targets stay equal-area. This delivers the founder's "deliberately thought out defaults" — the eye is guided — without trading away rare-event capture.

### C3 — Pre-armed state is indistinguishable from committed state for `newcomer-first-hand` *(severity 3)*

A highlighted button reads as "selected" — which in this UI has meant *recorded* everywhere else. A newcomer cannot tell "the app suggests Fold" from "the app recorded Fold." Given the pre-arm sits one tap from commitment, a misread is a data error.

**Amendment C3-A:** the pre-armed state needs a treatment vocabulary that exists nowhere else in the surface and cannot be confused with the recorded-action vocabulary (`ActionSequence` badges, `getActionSeatStyle`). Outline/dashed/pulse rather than fill. Gate 4 owns the specific treatment.

### C4 — D-2 + D-3 compound for `stepped-away-from-hand` *(severity 2)*

Returning after a real absence, the user meets a table that is *both* a different shape *and* carries a rail that wasn't there. Two simultaneous novelties. Sequence the rollout so one lands and stabilises before the other.

### C5 — D-3 collides with existing furniture in the target space *(severity 2)*

The "dead space" below the felt is not entirely dead: the TABLE label occupies 300×60 at `TABLE_LABEL_BOTTOM: -30` (`TableView.jsx:669-683`), and the F12 "Reopen range" affordance is pinned `fixed bottom-4 left-4` (`:733-741`). The rail must claim that band explicitly and re-home both. The TABLE label is pure decoration and is the obvious sacrifice.

### C6 — D-3's horizontal-scroll risk *(severity 2)*

`getRecentPlayers(20, true)` returns up to 20. Twenty chips in a horizontal rail will scroll — and **H-ML05 forbids horizontal scroll on primary paths.** This is the same defect class as orbit-strip F7, closed 2026-04-21 by switching to flex-wrap. Repeating it in a new element would be a regression of a closed finding.

**Amendment C6-A:** the rail shows a **bounded** set (proposal: 6–8 most-likely, ranked by this session's seating and recency), with overflow routing to the existing `PlayerFinderView` rather than scrolling. The rail is a fast path, not a complete index.

### C7 — `ringmaster-in-hand` gets the most value and can least afford it *(open question)*

The rail's heaviest user is also the persona who cannot look at the screen — he's dealing. Unresolvable until A2 is settled. Do not let this persona drive rail placement while it remains PROTO.

### C8 — `push-fold-short-stack` is well-served *(no finding)*

`PushFoldPanel` competes for panel height today. Under D-2 the panel *grows* exactly when stacks are short and players are folding out. Genuinely aligned; no action.

---

## Stage D — Cross-product / cross-surface

### D1 — The rail re-opens the two-paths-to-player-entry problem *(severity 3)*

`SeatContextMenu.jsx:11-13` records that "+ Create New Player" was **removed because it duplicated 'Find or Add Player…'** — both opened the picker. D-3 reintroduces a second player-entry path by design. Unless the boundary is stated sharply, this regresses a deliberate, documented simplification.

**Required at Gate 4:** an explicit, written boundary — rail owns *known, recently-seen* players; `PlayerFinderView` owns *search, create, identify, edit*. Overflow and miss both route to the finder. One sentence, in the surface artifact.

### D2 — Sidebar product-line drift *(severity 2)*

The extension HUD has its own seat arc and its own density doctrine (`surfaces/sidebar-shell-spec.md`, zones 0–4). A roster-rail concept and a dynamic-density concept that exist only in the main app widen exactly the drift the shell spec was written to prevent. Gate 4 must state whether these are main-app-only by decision (fine, if stated) or an unclosed gap (not fine).

### D3 — WS-186 (table flip) and D-2 are the same subsystem *(severity 3 — sequencing)*

`WS-186` rotates the table 180° as a render-time view transform to reduce spatial translation. D-2 re-proportions the table at render time for the same underlying reason. **Two independent spatial transforms over the same coordinate system, specified separately, will conflict** — rotation of a dynamically-narrowed felt is not the composition of the two features unless someone designs it as one.

**Required:** Gate 4 specifies a single spatial-transform layer, or WS-186 is explicitly deferred behind the redesign. It cannot proceed in parallel.

### D4 — WS-187 (photo-primary avatars) is a soft dependency of D-3 *(severity 1)*

Rail legibility depends on recognising a player from a small chip. WS-187 argues photo-primary precisely for "better visual check." The rail is a strong argument for WS-187 and a weak one without it. Sequence WS-187 before or with the rail.

### D5 — Persisted-hand schema must be untouched *(verify)*

D-1 changes how an action is *proposed*, never what is *written*. `contracts/persisted-hand-schema.md` and the `HandReplay` reader must see byte-identical output. Gate 4 states this as a non-goal; Gate 5 asserts it with a test.

### D6 — TournamentView overlay under a narrowed felt *(open)*

Unwalked this session. Flag for Gate 4.

---

## Stage E — Heuristic pre-check

| Heuristic | Direction | Verdict |
|---|---|---|
| H-PLT01 sub-second glanceability | D-2 | **CONFLICT** — a moving layout is anti-glanceable. Resolved by C1-A (street-boundary quantization). |
| H-ML06 touch target ≥44px | D-1 | **CONFLICT** — frequency-weighted sizing shrinks rare actions. Resolved by C2-A (prominence not area). |
| H-N01 visibility of system status | D-1 | **AT RISK** — pre-armed vs committed must be unmistakable. C3-A. |
| H-N03 user control and freedom | D-2 | **AT RISK** — layout changes without user action. Mitigated, not eliminated, by C1-A. Consider a settings opt-out. |
| H-PLT05 phone-sleep-safe freshness | D-2 | **AT RISK** — must resume in the settled new shape, never animate on unlock. C1-B. |
| H-ML05 no horizontal scroll on primary paths | D-3 | **CONFLICT** — 20 chips will scroll. Resolved by C6-A (bounded rail). |
| H-PLT06 zero-cost misclick absorption | D-1 | **AT RISK** — a pre-arm makes one specific misclick cheaper to make. Undo (HE-12) must cover it; 12s window already exists. |
| H-PLT02 one-handed reachability | D-3 | **UNKNOWN** — blocked on A4 (handedness unstated). |
| H-N05 error prevention | D-1 | **AT RISK** — see C2. |
| H-PLT08 no-interruption input | all three | **PASS** — nothing proposed is modal. |

---

## Overall verdict

**YELLOW.** No direction is rejected. All three are sound in intent and **all three are unsafe as literally stated.** Two conflicts are severe enough that shipping the direction verbatim would make the surface worse for its primary persona:

- **C1** — mid-street reflow would slow `mid-hand-chris` down. Fixed by quantizing to street boundaries.
- **C2** — frequency-weighted hit targets would make the app worst at capturing the highest-information events. Fixed by weighting prominence, not area.

Both amendments preserve the founder's intent fully. Neither is a scope reduction.

**Gate 3 (Research) is required**, scoped — not open-ended.

---

## Required follow-ups

### Gate 3 (Research) — SCOPED

| # | Item | Closes | Cost |
|---|---|---|---|
| R1 | Author situational persona `glance-return-chris` | A1 / G1 | S |
| R2 | Author `HE-19 — Accept or override a proposed action` | B1 / G2 | S |
| R3 | Author `HE-20 — Record a full orbit without falling behind` | B2 / G3 | S |
| R4 | Extend PM domain with the roster-maintenance job | B3 / G4 | S |
| R5 | Resolve `ringmaster-in-hand` PROTO — validate or retire | A2 / G5 | founder input |
| R6 | Founder: handedness + grip in one-handed landscape | A4 | 1 question |
| R7 | **Measure the real baseline** — tap-and-seconds cost of a postflop street and of seating a player, at 1600×720, before any redesign | B4 | needs `.env.local` |

**R7 is the one that matters most.** Every speed claim in this redesign is currently derived from reading code. Without a measured baseline there is no way to tell whether the redesign worked, and the Gate 1 evidence explicitly could not be visually confirmed.

### Gate 4 (Design) — pre-commitments

Binding on the surface artifact, carried from this roundtable:

1. Narrowing driver = live players remaining; **transitions quantized to street boundaries only** (C1-A); settled-on-resume (C1-B).
2. Defaults weight **prominence, never hit-target area**; all targets ≥44px, equal area (C2-A).
3. Pre-armed state gets a treatment vocabulary distinct from the recorded-action vocabulary (C3-A).
4. Rail is **bounded** (6–8), overflow routes to `PlayerFinderView`; no horizontal scroll (C6-A).
5. Written rail-vs-finder ownership boundary, one sentence (D1).
6. Rail claims the sub-felt band explicitly; TABLE label and the F12 reopen-range affordance re-homed (C5).
7. Statement on sidebar parity — main-app-only by decision, or a tracked gap (D2).
8. Single spatial-transform layer covering both narrowing and WS-186 rotation, or WS-186 explicitly deferred (D3).
9. Persisted-hand schema stated as a non-goal (D5); asserted by test at Gate 5.
10. Re-verify Reset Hand / Next Hand motor separation survives re-layout (F10 regression class).
11. Fix the CommandStrip compression defect (Gate 1 E2) — **independently, on its own merits**, not gated behind the redesign.

### Out of scope for this audit

- TournamentView overlay behaviour under a narrowed felt (D6) — flagged for Gate 4.
- Voice entry (`HE-16`, VCE family) interaction with pre-armed defaults.
- Card-entry tap cost — suspected a large share of postflop entry time; unmeasured, folded into R7.

---

## Open questions (for owner)

1. **Should dynamic narrowing be defeatable in Settings?** H-N03 argues yes; every opt-out is a state the design must then hold at both settings.
2. **Is `ringmaster-in-hand` real?** (R5) Two of three directions cite it.
3. **Handedness / grip?** (R6)
4. **Does the rail persist across streets, or only between hands?** Between-hands-only removes all in-hand real-estate competition and most of C4; it also removes the mid-hand seating case that A3 says is the volume driver.

---

## Change log

- 2026-07-31 — Drafted. YELLOW verdict; 2 critical amendments (C1, C2); Gate 3 required, scoped to R1–R7.
