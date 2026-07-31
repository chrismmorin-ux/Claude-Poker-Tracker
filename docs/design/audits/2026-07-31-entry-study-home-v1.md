# Gate 1 Entry — 2026-07-31 — Study Home v1 (findability of existing study surfaces)

**Surface working name:** `study-home` v1 — a purpose-grouped index over the study surfaces that exist today, claiming the planned `SCREEN.STUDY_HOME` route.
**Proposed by:** Founder, 2026-07-31 — *"I find it difficult to find where I want to go to study or review or practice the curriculum."*
**Gate:** 1 (Entry) — surface addition (new view + new route).
**Next gate:** 2 (Blind-Spot Roundtable) — **required**, triggered by new-surface creation regardless of this verdict.
**Status:** YELLOW — one JTBD gap. Personas are sufficient.

---

## Why this audit exists

The founder cannot find the study surfaces. This is not a perception problem; it reproduces in the code.

**Measured current state — every study entry point in the app:**

| Surface | Tabs | How it is reached |
|---|---|---|
| Self Coach (curriculum, lesson cards, tests) | 2 | Nav sidebar + Homebase tile + Homebase study-queue card — **3 paths** |
| Printable Refresher | — | Nav sidebar |
| **Preflop Drills** | **8** (Shape, Recipe, Equity Lookup, Estimate, Framework, Library, Lessons, Math) | **`SessionsView` → scroll to page bottom → button** |
| **Postflop Drills** | **6** (Line, Range Explorer, Estimate, Framework, Library, Lessons) | **`SessionsView` → scroll to page bottom → button** |
| Pre-Session Drill | — | Same buried button, flag-gated |
| Anchor Library → Calibration Dashboard | 3 | **No nav entry at all** |

**14 of ~16 study tabs are reachable only through a button at the bottom of the session log** — a surface whose job is recording and reviewing sessions, not studying. `SessionsView.jsx:590` and `:597` are the sole call sites for `SCREEN.PREFLOP_DRILLS` and `SCREEN.POSTFLOP_DRILLS` in the entire component tree.

Three aggravating factors:

1. **No grouping.** `CollapsibleSidebar.jsx` renders 12 flat nav items. `Refresher` and `Self Coach` sit between `Online` and `Settings` with nothing marking them as the same activity.
2. **No label uses the founder's vocabulary.** The founder said *study*, *review*, *practice*. The app offers `Self Coach`, `Refresher`, `Analysis`, `Hand Review`, `Estimate Drill`, `Framework Drill`, `Library`.
3. **Four tab labels are duplicated verbatim** across the two drill views — `Estimate Drill`, `Framework Drill`, `Library`, `Lessons` each exist in both Preflop and Postflop. "Open Lessons" is ambiguous by construction.

**This work was already chosen and never done.** Audit `2026-06-15-blindspot-drills.md` F-DRILL-08 records the founder's decision: *"keep the by-street split, defer consolidation, **invest in leak-targeted nav**; revisit with usage evidence."* Consolidation was rejected twice (`drills-consolidation.project.md`, status `rejected`, 2026-04-22). The nav investment that was chosen **in place of** consolidation is the part that never shipped. This audit is that work, not a re-litigation of consolidation.

## Output 1 — Scope classification

**Primary classification:** Surface addition — new view, new route.

**Critical reconciliation: `study-home.md` already exists.** A Gate-4-ratified surface artifact for a study home was authored 2026-05-11 (SLS SPR-073) and never built. Shipping a second study hub beside it would be a genuine architectural error. Resolution:

- **This IS `study-home`.** v1 claims the spec's planned `SCREEN.STUDY_HOME` route and its planned `StudyHomeView` code path.
- **v1 ships the spec's flat-index region only**, grouped by purpose. The spec already mandates that region as *"always visible, never gated"* (red line #6), so v1 is a strict subset of ratified design, not a deviation.
- **The Reference / Deliberate / Discover intent router is DEFERRED**, not rejected. It is load-bearing for the spec's embed contract — but 3 of the 4 declared embeds (Range Lab, Presession Drill, Played-Hand Review) do not exist, and the 4th (Shape Language) is design-only. Shipping a 3-segment control today would render a router with nothing to route: every existing surface would behave identically in all three modes. It lands with the first embed that needs it.
- **The two axes are orthogonal, not competing.** Reference/Deliberate/Discover is a *graded-vs-ungraded* axis **within** a project. Learn/Practice/Review is a *purpose* axis **across** surfaces. A future Study Home carries both — a purpose-grouped index whose entries may each support intent modes.

**Scope ceiling — what v1 does NOT do.** No drill view is modified. No tab is renamed, added, or removed. No content moves. The hub routes into existing surfaces exactly as they are. Consolidation stays rejected.

**Gate 2 triggers:** new-surface creation fires unconditionally. Gate 2 is required.

## Output 2 — Personas served

- **[study-block](../personas/situational/study-block.md)** — primary. Sat down to study, needs to pick a surface. This is the situation the founder was in when they filed the complaint.
- **[chris-live-player](../personas/core/chris-live-player.md)** — the founder; opens between sessions.
- **[scholar-drills-only](../personas/core/scholar-drills-only.md)** — primary drill consumer; the buried-drills defect hits this persona hardest, since drills are their entire product.
- **[apprentice-student](../personas/core/apprentice-student.md)** — needs the *when to use which* copy more than anyone; least able to decode `Estimate Drill` vs `Framework Drill`.
- **[post-session-chris](../personas/situational/post-session-chris.md)** — arrives wanting *review*, one of the founder's three verbs.
- **[returning-after-break](../personas/situational/returning-after-break.md)** — ≥28 days away; the surface must not greet them with decay warnings (red line #5 binds here).
- **[presession-preparer](../personas/situational/presession-preparer.md)** — secondary; has its own entry from session-start and does not need to route through the hub.

**Cast-sufficiency check:** every archetype maps 1:1 to an existing persona. **No new persona needed.** ✅

## Output 3 — JTBD identified

Served by existing entries:
- **CO-55** — *learn-next-concept-im-ready-for* (Self Coach curriculum card).
- **DS-43** — *10-minute quick drill on today's weak concept* (Practice group).
- **DS-60** — *carry-the-reference-offline* (Refresher card).
- **DS-68** — *see my competence trend without a rank/score identity label* — constrains what counts may appear.

**The gap.** No JTBD covers *choosing which study surface to open*. The 26-entry `drills-and-study` domain covers what each surface does; nothing covers routing between them. `study-home.md` claims `JTBD-SE-01 (session-entry) — open the right study surface for the current intent`, but **SE-01 is "tonight's watchlist" — villain-specific pre-session preparation, not study routing.** That citation in the existing spec is wrong and is corrected at Gate 4.

**Gap closure:** author one JTBD — **DS-69 — route-to-the-right-study-surface**. This is a narrow, well-understood gap, so Gate 3 scope is "patch the specific gap" (author one entry), not a research cycle.

## Output 4 — Gap analysis

**Ready:** `SCREEN.STUDY_HOME` route pattern is established across 20+ existing screens; `CollapsibleSidebar` nav array is a simple literal; `viewRegistry` handles mount/dispatch; `conceptMastery` already supplies the open-concept count that Homebase's study-queue card renders; all target surfaces exist and need no changes.

**Missing (the work):** the view; the route + nav entry; nav grouping; the DS-69 JTBD entry; the Gate 4 spec amendment; tests.

**At risk:**
- **Two competing study homes.** Mitigated by building *as* `study-home` and amending that spec rather than authoring a new one.
- **Red line #5 (no streaks / shame / engagement pressure).** A hub is exactly where "you haven't practiced in 12 days" would feel natural to add. It is forbidden. Counts must be factual inventory ("14 lessons"), never behavioral pressure. Binds hardest on `returning-after-break`. Test-enforced.
- **Red line #6 (flat index always accessible).** v1 renders unconditionally — no enrollment gate, no empty-state lockout.
- **Becoming a third path to Self Coach.** Self Coach already has 3 entry points; the hub makes 4. Accepted: the hub is the *grouped* path, and the others are direct shortcuts. Not resolved by deleting existing paths in v1.
- **Density.** 1600×720 landscape. Three groups × 3–4 cards must fit without vertical scrolling at the target resolution.

## Output 5 — Verdict

**YELLOW** — personas sufficient; one JTBD gap (DS-69). Gate 2 required regardless, by new-surface trigger. Gate 3 scope is the narrow JTBD patch. Gate 4 obligation: amend `surfaces/study-home.md` with the v1 scope, the deferred-router decision, and the SE-01 citation correction.
