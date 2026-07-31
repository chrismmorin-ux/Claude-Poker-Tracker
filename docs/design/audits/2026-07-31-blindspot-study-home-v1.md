# Gate 2 Blind-Spot Roundtable — 2026-07-31 — Study Home v1

**Trigger:** New-surface creation (`LIFECYCLE.md` Gate 2 trigger #2). Gate 1 verdict was YELLOW with one JTBD gap.
**Entry audit:** [`2026-07-31-entry-study-home-v1.md`](./2026-07-31-entry-study-home-v1.md)
**Verdict:** **YELLOW** → Gate 3 required, scope = patch the two identified gaps (one JTBD, one label-collision decision). Neither is RED-scale.

---

## Stage A — Persona sufficiency

**Question:** who would plausibly use a study hub that we have not modeled?

Archetypes → personas:

| Archetype the hub serves | Existing persona | Fit |
|---|---|---|
| Sat down to study, must pick a surface | `study-block` | Clean |
| Between sessions, browsing | `chris-live-player` | Clean |
| Drills are the whole product | `scholar-drills-only` | Clean |
| Doesn't know what the tab names mean | `apprentice-student` | Clean |
| Wants to review what just happened | `post-session-chris` | Clean |
| Back after ≥28 days | `returning-after-break` | Clean — and binding, see Stage C |

**Split check — does an existing persona not-quite-fit?** One candidate examined and rejected: a "content-auditor" archetype (the founder checking whether a lesson he authored renders correctly) is a real behavior — it is what happened in this very session — but it is *authoring*, which `study-home.md` declares an explicit non-goal. Not a persona gap; a correctly-excluded use case.

**Output: ✅ Match.** No new persona. This is unusual for a new surface and it is explainable: the hub introduces no new *activity*, only a new route to activities the cast already performs.

---

## Stage B — JTBD coverage

**Question:** what outcomes would hub users want that the atlas lacks?

| Outcome | JTBD | Status |
|---|---|---|
| Pick up the next curriculum concept | CO-55 | Covered |
| Drill the concept I'm weak at | DS-43 | Covered |
| Get the offline reference artifact | DS-60 | Covered |
| See progress without being ranked | DS-68 | Covered (constrains, see Stage E) |
| **Decide which of 16 study surfaces to open** | — | **GAP** |

The atlas has 26 entries describing what each study surface *does* and none describing how a user *chooses between them*. That is precisely the founder's complaint, and its absence from the atlas is why no prior gate caught the defect: **every individual surface passed its own audit, and the routing between them was nobody's JTBD.** That is the blind spot this roundtable exists to find.

Secondary finding: `study-home.md` cites `JTBD-SE-01` as "open the right study surface for the current intent." SE-01 is *tonight's watchlist* — villain-specific session prep. The citation is wrong, and its wrongness is what let the spec appear JTBD-covered while the real gap went unnamed.

**Output: ⚠️ Expansion needed** — author **DS-69 — route-to-the-right-study-surface**. One entry. Correct the SE-01 citation at Gate 4.

---

## Stage C — Situational stress test

| Situation | Budget | Survives? |
|---|---|---|
| `study-block` | Unhurried, focused | ✅ Designed for it |
| `post-session-chris` | Tired, low patience, wants one thing | ✅ Review group is a named destination rather than a hunt |
| `returning-after-break` | ≥28 days away, stale skill model | ⚠️ **Binding constraint** — see below |
| `presession-preparer` | Minutes before a session | ✅ Unaffected; keeps its own direct entry |
| `mid-hand-chris` | Seconds, live table | ✅ Out of scope — study mode is not live mode (`study-home.md` non-goal) |
| `between-hands-chris` | ~30s | ✅ Out of scope, same reason |

**The `returning-after-break` finding.** A study hub is the single most natural place in the app to render "you haven't practiced X in 34 days." It is exactly what an engagement-optimized product would ship, and **red line #5 forbids it** (SLS Gate 2 autonomy voice: no streaks, no shame, no engagement pressure). The persona file is explicit that the system must neither treat a returning user as a novice nor re-run a placement quiz.

The pressure is real because the hub *has* the data — `conceptMastery` exposes staleness, and Homebase already renders an open-concept count. The discipline: **counts on the hub are factual inventory of what exists ("14 lessons", "8 lines"), never behavioral measurements of the user ("last studied 34 days ago", "3-day streak").** The one count that describes the user — Self Coach's flagged-concept count — is carried over verbatim from Homebase's existing study-queue card, which already shipped under the same red line, and reads as a work queue rather than a judgment.

**Output: ⚠️ Constraint identified, mitigation specified.** Not a blocker; must be test-enforced or it will regress the first time someone adds "engagement."

---

## Stage D — Cross-product / cross-surface

- **Sidebar (Ignition extension):** unaffected. Study mode is main-app only; the extension is a live-table HUD. No product-line crossing.
- **Homebase:** overlaps. Homebase has a `Self Coach` tile and a `Study queue` card; the hub is a second organized path. **Decision: leave both.** Homebase is a launchpad for *frequent* destinations and the study-queue card carries live state; the hub is for *choosing*. Deleting the Homebase paths in v1 would trade one findability complaint for another.
- **SessionsView:** the buried Preflop/Postflop buttons. **Decision: leave them in v1.** They are the only path today, some muscle memory exists, and removing them is a separate, reversible cleanup once the hub has proven itself. Flagged as a v2 candidate, not silently kept.
- **Shape Language / Range Lab / HRP / Presession embeds:** the spec's embed contract is untouched and still applies when those projects ship. v1 registers today's surfaces as static entries; embeds are additive.
- **Nav sidebar:** grouped. This touches every screen's chrome, which is the widest blast radius in the change — mitigated by the grouping being purely presentational (headers inserted into an existing array; no route, key, or handler changes).

**Output: ✅ No blocking cross-surface conflict.** Two deliberate redundancies recorded with rationale rather than resolved by deletion.

---

## Stage E — Heuristic pre-check

**Nielsen:**
- *Match between system and the real world* — **the core fix.** Learn / Practice / Review are the founder's own words. `Self Coach`, `Refresher`, `Estimate Drill` are system vocabulary.
- *Recognition rather than recall* — currently the user must recall that drills live under Sessions. The hub makes it recognizable. Each card carries a one-line *when to use this*, so the four duplicated tab labels stop being load-bearing for the decision.
- *Visibility of system status* — factual counts only, per Stage C.
- *Aesthetic and minimalist design* — tension: 10+ destinations is a lot. Mitigated by three groups of 3–4, not a flat list of ten.
- *User control and freedom* — hub is a router; every card is non-destructive and reversible by back.

**Poker-live-table:** N/A — study mode, explicitly not a live surface.

**Mobile-landscape (1600×720):** three groups × 3–4 cards must fit without vertical scroll at target resolution. This is the real layout risk and is a Gate 5 verification item, not a design unknown.

**Open label collision (carried to Gate 3):** `Lessons`, `Library`, `Estimate Drill`, `Framework Drill` appear identically in both drill views. The hub *mitigates* this with per-card context but does not *fix* it — a user who lands in Postflop Drills still sees an ambiguous tab strip. The founder declined a rename in this round. Recorded as a known residual with a v2 ticket rather than silently absorbed.

**Output: ⚠️ One residual (label collision), one Gate 5 verification item (density).**

---

## Verdict

**YELLOW.** Two gaps, both narrow:

1. **DS-69** — author `route-to-the-right-study-surface` in `jtbd/domains/drills-and-study.md`. *(Gate 3, patch scope — done this session.)*
2. **Label collision** — deferred by founder decision; logged as a v2 candidate, not resolved.

Neither is RED-scale: no new persona, no new JTBD *domain*, no strategic decision reversal. Per `LIFECYCLE.md`, YELLOW → Gate 3 with scope = patch the identified gaps, then Gate 4.

**The finding worth remembering:** every study surface passed its own gate, and the surface *between* them was nobody's job. Per-surface audits cannot catch a routing defect, because routing is not a surface. That is a gap in the audit method, not just in this product.
