# Surface — Study Home (cross-project)

**ID:** `study-home`
**Code paths:**
- `src/components/views/StudyHomeView/StudyHomeView.jsx` (**v1 SHIPPED 2026-07-31** — flat-index region only)
- `SCREEN.STUDY_HOME` route (shipped)
- *Planned:* `studyHomeReducer` — lands with the intent router (deferred, see §v1 scope)

**Route / entry points:**
- `SCREEN.STUDY_HOME` (top-level nav entry, peer of `SCREEN.TABLE`) — **shipped**; `CollapsibleSidebar` "Study" entry.
- Opens from: top-nav; *planned:* settings / per-project deep links (each project embed adds its own entry)
- Closes to: previous view via back

**Last reviewed:** 2026-07-31 (v1 implementation)

---

## Purpose

A cross-project home for study, reference, and review activity. Four projects embed into this surface — **Shape Language** (descriptor lessons + skill map), **Range Lab** (interactive range painting), **Presession Drill** (flash-card flow under exploit-deviation), **Played-Hand Review Protocol** (mistake-flag queue + ledger-link review) — and any future study-mode surface registers as a fifth+. The home itself does not author content; it provides a flat index, an intent-mode router, and a transparent skill-state surface for users who have opted in.

This surface is the first concrete output of the cross-project coordination identified in `docs/projects/poker-shape-language/gate3-decision-memo.md` §Q1 (verdict: cross-project surface artifact, NOT umbrella charter). It was authored as part of Shape Language Gate 4 (SPR-073 2026-05-11) because SLS is the first project to need it. Future projects extend it by adding embed specs, not by editing this surface's invariants.

## JTBD served

Primary:
- `DS-69` — **Route to the right study surface for what I came to do** — the surface's reason to exist; served in full by v1 (§SH-V1).
- `DS-46` — Spaced repetition for key charts (**Proposed**) — partial; spaced-repetition surfacing lives in per-project embeds, study-home indexes them
- `DS-47` — Skill map / mastery grid (**Proposed**) — partial; aggregated mastery view is one tab of the home. NOTE: DS-47 is the *gamified* grid the autonomy doctrine refuses; any mastery rendering here follows DS-68's non-gamified form.

> **Corrected 2026-07-31.** This list previously claimed `JTBD-SE-01 (session-entry) — open the right study surface for the current intent`. SE-01 is *tonight's watchlist* (villain-specific session prep) and never covered study routing. See §SH-V1 §JTBD correction.

Secondary:
- `ON-87` — Cold-start descriptor seeding (Active, SLS) — first-launch enrollment journey runs in this surface for Shape Language
- All per-project JTBDs that the embeds serve — listed in the embeds, not duplicated here

Not served (explicit non-goals):
- Live-table decisions (`MH-*`) — study-home is study mode, not live mode
- Authoring (writing new lessons / new range files / new audits) — study-home is consumption, not authoring

## Personas served

Primary:
- [study-block](../personas/situational/study-block.md) — extended study session, multi-project intent.
- [presession-preparer](../personas/situational/presession-preparer.md) — entry from session-start flow.
- [post-session-chris](../personas/situational/post-session-chris.md) — review entry to HRP-flagged hands.
- [scholar-drills-only](../personas/core/scholar-drills-only.md) — primary drill consumer.

Secondary:
- [Chris (live player)](../personas/core/chris-live-player.md) — opens between sessions.
- [Apprentice](../personas/core/apprentice-student.md) — coach-assigned curriculum entry.

---

## §SH-V1 — v1 scope (shipped 2026-07-31)

**Gates:** [entry](../audits/2026-07-31-entry-study-home-v1.md) (YELLOW) → [blind-spot](../audits/2026-07-31-blindspot-study-home-v1.md) (YELLOW) → Gate 3 patch (DS-69 authored) → this amendment.

**Why v1 exists.** This spec was authored 2026-05-11 for a *future* cross-project composition problem and never built. On 2026-07-31 the founder reported a *present* findability problem: 14 of ~16 study tabs were reachable only through a button at the bottom of `SessionsView`. v1 is that fix, built as this surface rather than as a second study hub.

### What v1 ships

**The flat-index region only, grouped by purpose.** The spec already mandates that region as *"always visible, never gated"* (red line #6), so v1 is a strict subset of ratified design, not a deviation.

| Group | Question it answers | Entries (v1) |
|---|---|---|
| **Learn** | I want to understand a concept | Curriculum (Self Coach) · Postflop Lessons · Preflop Lessons |
| **Practice** | I want to test myself | Line Study · Postflop Drills · Preflop Drills |
| **Review** | I want to check my own work | Hand Review · Refresher · Calibration |

Each entry carries a **one-line "when to use this"**, which is what lets a user choose without decoding the four tab labels duplicated across the two drill views (`Lessons`, `Library`, `Estimate Drill`, `Framework Drill` — see §Known issues).

### What v1 defers, and why

**The Reference / Deliberate / Discover intent router is DEFERRED, not rejected.** It is load-bearing for the embed contract below, but 3 of the 4 declared embeds (Range Lab, Presession Drill, Played-Hand Review) do not exist and the 4th (Shape Language) is design-only. A 3-segment control shipped today would route nothing: every existing surface would behave identically in all three modes. **It lands with the first embed that needs it.**

**The two axes are orthogonal.** Reference/Deliberate/Discover is a *graded-vs-ungraded* axis **within** a project. Learn/Practice/Review is a *purpose* axis **across** surfaces. The finished Study Home carries both: a purpose-grouped index whose entries may each support intent modes. v1 is the outer axis; the router is the inner one.

### Binding constraints on v1

- **Red line #5 — no streaks, shame, or engagement pressure.** A routing hub is the single most natural place in the app to render "you haven't practiced X in 34 days," and the data to do it is available (`conceptMastery` exposes staleness). Forbidden. **Counts are factual inventory of what exists** ("14 lessons", "8 lines") — never behavioral measurement of the user. The one user-describing count (Self Coach's flagged-concept count) is carried verbatim from Homebase's existing study-queue card, which shipped under the same red line. Test-enforced (`StudyHomeView.redlines.test.jsx`).
- **Red line #6 — flat index always accessible.** v1 renders unconditionally: no enrollment gate, no empty-state lockout, no loading state that hides the index.
- **Scope ceiling.** v1 modifies no drill view, renames no tab, moves no content. It routes into existing surfaces exactly as they are. Consolidation stays rejected (`drills-consolidation.project.md`).

### Deliberate redundancies (recorded, not resolved)

Both were examined at Gate 2 Stage D and kept on purpose:
- **Homebase** keeps its `Self Coach` tile and `Study queue` card. Homebase is a launchpad for frequent destinations and the card carries live state; the hub is for *choosing*. Removing them would trade one findability complaint for another.
- **`SessionsView`** keeps its Preflop/Postflop buttons. They are the incumbent path and some muscle memory exists. Removing them is a separate reversible cleanup once the hub has proven itself — a v2 candidate, not a silent keep.

### JTBD correction

This spec previously cited `JTBD-SE-01 (session-entry) — open the right study surface for the current intent`. **SE-01 is "tonight's watchlist" — villain-specific session preparation, not study routing.** The mis-citation is what let the spec appear JTBD-covered while the real gap went unnamed for 81 days. The correct entry is **DS-69 — route-to-the-right-study-surface**, authored at Gate 3 on 2026-07-31.

---

## Three-intent taxonomy (load-bearing)

The surface obeys the **Reference / Deliberate / Discover** three-intent split adopted at SLS Gate 3 (`docs/projects/poker-shape-language/gate3-decision-memo.md` Pattern 1). The reducer carries a `currentIntent` field which the surface reads to determine which embed-region is active and which writes are permitted.

| Intent | Surface region | Skill-state writes? | Examples |
|---|---|---|---|
| **Reference** | Flat lesson/topic index — always visible, never gated. Read-only routing into per-project read surfaces. | **No.** Reference-mode actions never dispatch mastery mutations. Enforced at reducer level. | Open a Shape Language lesson to re-read; open a Range Lab range; browse the descriptor catalog. |
| **Deliberate** | User explicitly entered a study session. Per-project drill/lesson surfaces are graded by default; incognito is in-mode toggle. | **Yes** by default; **No** when incognito flag is active for the session. | Open Shape Language drill; complete a Range Lab module; flash-card session in Presession Drill. |
| **Discover** | Adaptive-seeder home — system surfaces recommendations. Per-descriptor mute is one-tap. | **Yes** (writes the seeder's choice plus the user's response). | Adaptive-seeder shows the next descriptor lesson; mute via "already know / not today" disambiguation. |

The three modes are **routes**, not toggles. Entering Reference routes to a read-only surface variant; entering Deliberate/Discover routes to the graded variant. This is the Chess.com "rated vs custom" pattern adopted at Gate 3 Q5 — distinct entry points are the disambiguation, not a modal flag.

---

## Anatomy

```
+--------------------------------------------------------------+
| Study Home                          [Reference|Deliberate|Discover] |
|--------------------------------------------------------------|
| Flat index (always visible, regardless of mode):             |
|  • Shape Language → 10 descriptor lessons + skill map        |
|  • Range Lab → painted ranges + saved sessions               |
|  • Presession Drill → today's deck + assumption catalog      |
|  • Played-Hand Review → flagged-hand queue                   |
|--------------------------------------------------------------|
| Intent-mode body:                                            |
|   Reference: open any lesson/range/hand from the flat index  |
|   Deliberate: enrolled curriculum surface (per-project)      |
|   Discover: adaptive seeder rec + transparency screen access |
|--------------------------------------------------------------|
| Transparency footer (visible when enrolled in any project):  |
|   "Skill data: [project], [project]. Manage in Settings."   |
+--------------------------------------------------------------+
```

- **Header:** title + intent-mode router (3-segment control). Mode selection persists across sessions.
- **Flat index region:** always visible, never gated by enrollment or mode (red line #6 — see SLS Gate 2 audit). Project embeds register entries here; the order is per-project priority + recency.
- **Intent-mode body region:** content swaps based on `currentIntent`. Each per-project embed declares what it renders in each mode (and whether some modes are unsupported — e.g., Range Lab may not have a Discover-mode seeder).
- **Transparency footer:** visible when ≥1 project has skill data. Links to the per-project transparency screen accessed through Settings. Carries no engagement-pressure copy ("you haven't practiced X" is forbidden — see SLS Gate 2 red line #5).

---

## Embed contract

Each project that wants to appear in Study Home registers an **embed spec** at `docs/design/surfaces/<project>-study-home.md` (e.g., `shape-language-study-home.md`). Embeds declare:

1. **Flat-index entry shape** — title, icon, count badge (optional), open-target route.
2. **Reference-mode behavior** — what surface opens when user clicks an index entry while in Reference mode.
3. **Deliberate-mode body content** — what the embed renders inside the intent-body region in Deliberate mode (often a "today's deck" or "current curriculum" view).
4. **Discover-mode body content** — what the embed renders in Discover mode (if applicable; embeds may declare Discover not supported).
5. **Transparency-footer claims** — what the embed contributes to the transparency footer if the user is enrolled.
6. **Enrollment journey** — pointer to the project's own `journeys/<project>-enrollment.md`, if enrollment is required for Deliberate/Discover.

The home itself does NOT enforce any per-project state; it composes embed declarations. This is the contract pattern: home defines slots, embeds fill them.

### Embeds currently registered

- [shape-language-study-home.md](./shape-language-study-home.md) — SLS embed (authored at SPR-073 2026-05-11).
- *Planned:* `range-lab-study-home.md` — Range Lab embed (RL Gate 2/3/4 will author this; see WS-053..057).
- *Planned:* `presession-drill-study-home.md` — Presession Drill embed (exploit-deviation Phase 7 will author this).
- *Planned:* `played-hand-review-study-home.md` — HRP embed (WS-067 Gate 4 + HRP-U-MODAL will author this).

---

## State

- **Reducer:** `studyHomeReducer` (planned — Phase 5 implementation). Carries `currentIntent`, `flatIndexFilter`, `seederState` (per-project).
- **Mutations:** Intent-mode transitions; per-embed open/close events; skill-state writes flow through the per-project reducers (`shapeMasteryReducer` etc.), not through this surface's reducer.
- **Environment assumptions:** None at Gate 4 (design-only). At implementation: assumes each registered embed has a corresponding consumer of the home's intent-mode router.

## Props / context contract

- `currentIntent: 'reference' | 'deliberate' | 'discover'` — read from reducer.
- `enrolledProjects: ProjectId[]` — derived from per-project enrollment flags; drives transparency-footer visibility.
- `registeredEmbeds: EmbedDescriptor[]` — list of registered embeds and their declared slot content; static at build time.

## Key interactions

- **Intent-mode change:** user taps Reference/Deliberate/Discover → dispatch `SET_INTENT_MODE`. Body region re-renders with embed content for the new mode. Intent persists across navigation away and back.
- **Flat-index entry click:** Always opens the target surface in Reference mode (regardless of current intent), per red line #6 — flat index is read-access, not enrollment-gated. To enter Deliberate/Discover on a project, user must use that mode's explicit body region.
- **Per-embed action:** delegated to the embed; home does not intercept.
- **Transparency footer tap:** routes to Settings → per-project transparency screen.

---

## Red-line compliance (Pattern 3 from gate3-decision-memo)

Each red line below has an explicit assertion strategy. The per-surface conformance matrix is authored at [`2026-05-11-sls-g4-redline-conformance.md`](../audits/2026-05-11-sls-g4-redline-conformance.md) — this surface's compliance is the parent claim that the matrix builds against.

| Red line | Source | Enforcement here |
|---|---|---|
| **#1 — Opt-in enrollment** | SLS Gate 2 autonomy voice | Flat index is unconditional; Deliberate/Discover require per-project enrollment. Reference mode requires no enrollment ever. |
| **#3 — Durable overrides** | SLS Gate 2 autonomy voice | Transparency footer + Settings link surfaces every override action; not buried. |
| **#4 — Incognito mode non-negotiable** | SLS Gate 2 autonomy voice | Mode-routed (Reference is structurally incognito; Deliberate/Discover have in-mode incognito toggle per embed). |
| **#5 — No streaks/shame/engagement-pressure** | SLS Gate 2 autonomy voice | No daily-streak badges; no "haven't practiced" warnings; transparency footer copy is factual ("Skill data: Shape Language"). |
| **#6 — Flat lesson index always accessible** | SLS Gate 2 autonomy voice | Flat index region renders unconditionally; intent-mode does not gate it. |

Red lines #2, #7, #8, #9 (per SLS Gate 2 audit + autonomy red lines ladder) bind per-embed, not on the parent surface. Per-embed compliance matrices live in the [SPR-074 conformance audit](../audits/2026-05-11-sls-g4-redline-conformance.md).

---

## Known behavior notes

- **Intent-mode is route, not toggle.** Per Chess.com's rated-vs-custom pattern (Gate 3 Q5). Switching modes is a navigation event with explicit user action; not a passive flag.
- **Enrollment is per-project, not per-home.** Opening Study Home does not require enrollment in anything. Enrollment is a Deliberate/Discover prerequisite per embed, gated by that embed's own journey.
- **No notification surface.** Study Home does not emit notifications, badges, or push affordances. Welcome-back banners (per Q3 verdict) fire **inside** the embed, at user-initiated open, after the decay threshold crosses — not as a home-level surface.

## Known issues

- **Duplicated tab labels across the two drill views (v2 candidate).** `Lessons`, `Library`, `Estimate Drill`, and `Framework Drill` each appear with identical labels in both `PreflopDrillsView` and `PostflopDrillsView`. v1 *mitigates* this — each hub card names its street and carries a when-to-use line — but does not *fix* it: a user who lands inside Postflop Drills still sees an ambiguous tab strip. Founder declined the rename in the 2026-07-31 round; recorded as a residual rather than absorbed silently. Raised at Gate 2 Stage E.
- **Intent router unbuilt.** Deferred by §SH-V1 until the first embed needs it. Until then the surface has no reducer and no persisted state.
- **Third path to Self Coach.** Self Coach now has four entry points (nav, Homebase tile, Homebase study-queue card, hub). Accepted at Gate 2 Stage D; not resolved in v1.

---

## Test coverage

- `src/components/views/StudyHomeView/__tests__/StudyHomeView.test.jsx` — group structure, routing, and card inventory (v1, shipped).
- `src/components/views/StudyHomeView/__tests__/StudyHomeView.redlines.test.jsx` — red lines #5 and #6 asserted directly against the rendered DOM (v1, shipped).
- Red-line conformance matrix tests authored per the [SPR-074 catalog](../audits/2026-05-11-sls-g4-redline-conformance.md) — one assertion per red line × per surface; tests land at Stream B/D code phase.

---

## Cross-references

- [shape-language-study-home.md](./shape-language-study-home.md) — first registered embed.
- [shape-language-enrollment.md](../journeys/shape-language-enrollment.md) — enrollment journey for Shape Language embed.
- [shape-mastery.md](../contracts/shape-mastery.md) — cross-surface contract for the shapeMastery state that the SLS embed reads/writes.
- `docs/projects/poker-shape-language/gate3-decision-memo.md` — Q1 verdict that authorized this surface; Q3/Q4/Q5/Q7 verdicts that constrain the embed contract.
- `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding-rerun.md` — Gate 2 GREEN re-run audit; binding red lines.
- `docs/design/LIFECYCLE.md` — Gate 4 protocol.

---

## Change log

- 2026-07-31 — **v1 implemented** (§SH-V1 added). Flat-index region shipped, grouped by purpose (Learn / Practice / Review) per founder-reported findability defect; intent router deferred until the first embed needs it; `SCREEN.STUDY_HOME` + `StudyHomeView` claimed; `CollapsibleSidebar` grouped into Play / Review / Study / Tools sections. The two drill views were deliberately **not** given their own nav entries — they are one click inside Study, and separate icons would re-flatten what the grouping exists to organize. Drill views additionally gained caller-supplied initial tab + return screen (`openDrills` / `closeDrills`, mirroring the existing `openLessonDetail` / `openPlayerProfile` pattern), replacing a hardcoded default tab and a hardcoded "← Back to Sessions" that was correct only while `SessionsView` was the sole entry point. JTBD list corrected (SE-01 mis-citation → DS-69, authored at Gate 3). Known issues section replaced (was "no issues — design-only"). Gates: entry YELLOW → blind-spot YELLOW → Gate 3 patch → this amendment.
- 2026-05-11 — Created at SPR-073 (Shape Language Gate 4, WS-039). First registered embed: `shape-language-study-home`. Parent surface authored by SLS per Q1 verdict ("first Gate 4 that needs it"); future projects extend by registering embeds, not editing this file's invariants.
