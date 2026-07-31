# Gate 1 Entry — 2026-07-31 — Multiway field-size lesson (`mw-field-size`) + `benchmark` section kind

**Surface working name:** A postflop Lessons-tab lesson teaching field-size scaling, plus one new lesson section kind (`benchmark`) that renders a fair-share-anchored ladder.
**Proposed by:** Founder request following `docs/research/multiway-flop-strategy-2026-07-31.md` — "capture this in our lessons, with real thought given to the UX of this lesson to teach hero exactly how to use and think about this concept."
**Gate:** 1 (Entry) — surface-bound addition to two existing surfaces (`postflop-drills` Lessons tab; `lesson-card` via SCF overlay). One new *section kind* inside an existing renderer; no new surface, route, or zone.
**Next gate:** 4 (Design) — surface artifact update to `surfaces/postflop-drills.md` (new §PD-LESSON-BENCHMARK section), same session.
**Status:** GREEN.

---

## Why this audit exists

The measurement study produced 15 named scenarios × 3 field widths × 5 field sizes. That is a *reference table*, and a reference table is not a lesson. The founder's ask is explicitly pedagogical: teach hero **how to think** about field size, not what the numbers are. This audit exists to force the question "what is the smallest thing hero must carry to the table?" before any content is authored, because the failure mode here is dumping the research tables into a lesson and calling it teaching.

The repo already has six `mw-*` lessons (`mw-bluff-death`, `mw-nut-necessity`, `mw-srp-3way`, `mw-squeeze`, `mw-cbet-shifts`, `mw-overcalling`). **None of them teaches the scaling relationship itself** — each teaches one consequence of it. That is the gap this lesson fills, and it is why the answer is one new lesson rather than edits to the existing six.

## Output 1 — Scope classification

**Primary classification:** Surface-bound addition.

Two content additions plus one renderer capability:

1. **New lesson** `mw-field-size` in `postflopDrillContent/lessons.js` — rendered by the existing `LessonsMode` shell, in the existing lesson list, no IA change.
2. **New SCF overlay** `docs/projects/self-coach-foundation/lessons/multiway-field-size-scaling.md` — per the authoring template's binding rule that Markdown lessons are a *schema overlay* around drill-backed pedagogy (`exposition_source`), not a re-authoring. Loaded by the existing `lessonRegistry` glob; no loader change.
3. **New section kind** `benchmark` in `LessonsMode.jsx` — a static, non-interactive table with a pinned anchor row.

**Why (3) is justified rather than avoidable.** The concept is a *monotone ordering over field size*. Prose cannot render an ordering — a reader cannot hold "set > combo draw > nut draw > TPTK > top pair weak > second pair" plus its inversion point from a paragraph. The existing `formula` kind renders one line of monospace; the existing `example` kind computes a full range-vs-board breakdown, which is the wrong object (it decomposes a *villain range*, not hero's holding across field sizes). The table is the minimum faithful rendering of the thing being taught.

**Deliberately NOT built:** an interactive field-size slider. It would be the obvious "good UX" move and it is wrong here — the lesson's whole point is that hero must internalize the ladder well enough to run it *without* a device at the table. An interactive widget teaches hero to consult the app, which is the opposite of the success criterion. `benchmark` is static by design, and this is recorded so a future reviewer does not "improve" it into a calculator.

**Gate 2 triggers:** none fire. No new surface; no new route; no destructive action; no new interaction primitive (the `benchmark` kind has zero interactions — it is strictly less interactive than the existing `example` kind, which has a reveal button); no underserved-persona target; no product-line crossing (main-app only, sidebar untouched).

**Verdict on Gate 2 requirement:** NOT required (LIFECYCLE.md — surface-bound addition with no new interaction primitive → Gates 1, 4, 5).

## Output 2 — Personas served

- **[chris-live-player](../personas/core/chris-live-player.md)** in self-coach mode — primary. The whole study was motivated by his own table observation; the lesson has to survive contact with a 9-handed live game.
- **[study-block](../personas/situational/study-block.md)** — the situation this is consumed in. Away from the table, unhurried, willing to read 500 words. This is what licenses a table-bearing lesson rather than a one-line cue.
- **[apprentice-student](../personas/core/apprentice-student.md)** — served secondarily; the fair-share anchor is the kind of single-number scaffold a less experienced player can carry immediately.
- **[first-principles-learner](../personas/situational/first-principles-learner.md)** — served by the `formula` section deriving the betting rule rather than asserting it.

**Explicit cast-sufficiency check:** does the current cast cover this? **Yes.** No new persona needed. The lesson targets an existing player in an existing situation with an existing motivation.

## Output 3 — JTBD identified

- **CO-55** — *learn-next-concept-im-ready-for* — the SCF overlay makes this lesson rankable in the Curriculum spine. Primary.
- **CO-54** — *see-own-leak-surfaced-without-being-graded* — via `leakTagIds: [hero-multiway-bluff-frequency]`, binding the lesson to the existing detector in `skillAssessment/leakRules/heroMultiwayBluffFrequency.js`. §5 of the research is that detector's missing justification.
- **Drills-and-study domain** (`jtbd/domains/drills-and-study.md`) — the postflop Lessons tab entry.

**Explicit mapping check:** does any proposed outcome fail to map? **No.** One outcome sits close to the edge — "hero correctly *declines* to bluff multiway" is a non-action, and non-actions are hard to attribute to a JTBD. It maps to CO-54 through the existing leak detector, which measures bet-vs-check frequency and therefore observes the non-action directly.

## Output 4 — Gap analysis

**Ready:**
- `LessonsMode.jsx` already dispatches on `section.kind` with an `UnsupportedSection` fallback (WS-229 F-DRILL-07), so an unknown kind degrades visibly rather than silently — adding a kind is additive and the failure mode is already handled.
- `lessons.test.js` already pins the valid-kind set, so the new kind cannot be introduced without an explicit test amendment.
- `lessonRegistry.js` globs the SCF lessons directory; a new file is picked up with no wiring.
- `frameworks.js` / `multiwayFrameworks.js` already register `hand_class_shift`, which is the correct `frameworkId` for this lesson — no new framework needed.
- All numbers are engine-computed and reproducible (`docs/research/multiway-flop-strategy-2026-07-31.md` §1), satisfying the citation field.

**Missing (the work):**
- `BenchmarkSection` renderer + the kind in the dispatch table.
- Schema for `benchmark` sections + test coverage (shape, anchor presence, valid-kind set).
- Lesson content.
- SCF overlay Markdown.
- Surface artifact §PD-LESSON-BENCHMARK.

**At risk:**
- **Number drift.** The lesson hard-codes measured percentages. If the priors or the equity engine change, the lesson silently becomes wrong. *Mitigation:* every benchmark section carries a `source` field naming the research doc, and the numbers are expressed as **multiples of fair share** rather than raw equity wherever possible — multiples are far more stable under field-width changes than absolute equities (the research shows raw equity moving 5–15 points between field assumptions while the ordering and the multiples hold).
- **Contradicting an existing lesson.** `mw-bluff-death` currently narrates a 60% per-player fold rate and `multiwayFrameworks.js` hard-codes `perPlayerFold = 0.65`, both invented. The measured full-ring figure is **55.5%** over 1.06M decisions. Two lessons disagreeing is worse than one lesson being approximate. *Mitigation:* correct the constant at its source and align the sibling lesson in the same change; the conclusion strengthens rather than reverses, so no pedagogy is invalidated.
- **Density.** Lessons render in a scrolling panel, not a fixed viewport, so a table is affordable — but a 15-row × 5-column dump is not readable on a 1600×720 landscape phone. *Mitigation:* benchmark tables are capped at ~8 rows and 3 numeric columns, and the lesson uses three small tables at their point of use rather than one large one up front.

## Output 5 — Verdict

**GREEN.** Existing personas and JTBD cover the change; it adds one strictly-non-interactive section kind to an existing renderer whose unknown-kind path is already handled; it fills a real gap in the `mw-*` set rather than duplicating it; and it corrects a measured drift in a sibling lesson as a companion edit.

Gate 4 obligation: add §PD-LESSON-BENCHMARK to `surfaces/postflop-drills.md` — done as a companion edit to this audit.

---

## Appendix — the pedagogical design, and why it is shaped this way

Recorded here because the founder's ask was specifically about *how* the lesson teaches, and that reasoning would otherwise live nowhere.

**The failure mode being designed against.** Hero's mental model at the table is hand-centric: "I have top pair." The correct multiway model is field-relative: "top pair is 1.8× fair share five-way, and a bet into four is value." Every design decision below serves the conversion from the first sentence to the second.

**D1 — One anchor number, stated once, reused everywhere.** Six-way fair share is 16.7%. Every benchmark in the lesson is expressed as a *multiple* of fair share, never as raw equity. This collapses a 15×5 table into a one-dimensional ladder, and the ladder is stable across field widths where the raw equities are not. It is also the only arithmetic hero has to do live: `1/(players+1)`.

**D2 — Lead with the inversion, not the definition.** The lesson opens on "five-way, a nut flush draw is worth more than top pair" — the fact that reframes everything — and derives the anchor afterward. Opening with "fair share is 1/(N+1)" is correct, forgettable, and teaches nothing hero doesn't already half-know.

**D3 — Teach a threshold on a multiple, not a computation.** Hero cannot compute equity at the table. Hero can remember *continue at ~2×, fold below 1×*. The benchmark tables exist to calibrate that intuition during study so the threshold is usable without them.

**D4 — Separate the three verbs.** Continue/fold, bet/check, and believe/call have three *different* benchmarks that the existing multiway lessons blur together. The lesson is structured around the three decisions in the order hero faces them, each with its own table. This is the main structural difference from `mw-nut-necessity`, which mixes the value-threshold question and the sizing question in one section.

**D5 — Include the counterweight, in the same lesson.** "Don't bluff multiway" and "don't over-fold multiway" come from the same two tables, and teaching the first without the second produces a nitty over-folder — a leak the app would then have to detect separately. Per-defender MDF (19.7% five-way vs a half-pot bet, not 66.7%) ships in the same lesson as the bluff-collapse table, deliberately.

**D6 — Name the limits inside the lesson.** The success criterion includes knowing that the numbers are one-street showdown equity with no realization modelled. A lesson that presents modelled numbers as table truth teaches false confidence, which is worse than teaching nothing.
