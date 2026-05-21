# Surface — Study Home (cross-project)

**ID:** `study-home`
**Code paths:** (none yet — design-only at Gate 4)
- *Planned:* `src/components/views/StudyHomeView/StudyHomeView.jsx`
- *Planned:* `SCREEN.STUDY_HOME` route + `studyHomeReducer`

**Route / entry points:**
- *Planned:* `SCREEN.STUDY_HOME` (top-level nav entry, peer of `SCREEN.TABLE`)
- Opens from: top-nav / settings / per-project deep links (each project embed adds its own entry)
- Closes to: previous view via back

**Last reviewed:** 2026-05-11

---

## Purpose

A cross-project home for study, reference, and review activity. Four projects embed into this surface — **Shape Language** (descriptor lessons + skill map), **Range Lab** (interactive range painting), **Presession Drill** (flash-card flow under exploit-deviation), **Played-Hand Review Protocol** (mistake-flag queue + ledger-link review) — and any future study-mode surface registers as a fifth+. The home itself does not author content; it provides a flat index, an intent-mode router, and a transparent skill-state surface for users who have opted in.

This surface is the first concrete output of the cross-project coordination identified in `docs/projects/poker-shape-language/gate3-decision-memo.md` §Q1 (verdict: cross-project surface artifact, NOT umbrella charter). It was authored as part of Shape Language Gate 4 (SPR-073 2026-05-11) because SLS is the first project to need it. Future projects extend it by adding embed specs, not by editing this surface's invariants.

## JTBD served

Primary:
- `DS-46` — Spaced repetition for key charts (**Proposed**) — partial; spaced-repetition surfacing lives in per-project embeds, study-home indexes them
- `DS-47` — Skill map / mastery grid (**Proposed**) — partial; aggregated mastery view is one tab of the home
- `JTBD-SE-01` (session-entry) — open the right study surface for the current intent (entry routing role)

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

This surface has no issues — it is design-only at Gate 4 ship. Implementation tickets will surface bugs at Phase 5+.

---

## Test coverage

- *Planned:* `src/components/views/StudyHomeView/__tests__/` once Phase 5 ships.
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

- 2026-05-11 — Created at SPR-073 (Shape Language Gate 4, WS-039). First registered embed: `shape-language-study-home`. Parent surface authored by SLS per Q1 verdict ("first Gate 4 that needs it"); future projects extend by registering embeds, not editing this file's invariants.
