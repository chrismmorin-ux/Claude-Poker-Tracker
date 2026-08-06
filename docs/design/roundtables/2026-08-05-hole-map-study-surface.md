# Blind-Spot Roundtable — 2026-08-05 — Hole Map study surface (HMS)

**Roundtable ID:** `blindspot-hole-map-study-surface-2026-08-05`
**Feature:** Hole Map study surface — the View 7 readout (`out/hole-map.json`), readable in-app, with read-time freshness
**Gate 1 source:** [`docs/design/audits/2026-08-05-entry-hole-map-study-surface.md`](../audits/2026-08-05-entry-hole-map-study-surface.md) — verdict **YELLOW**
**Gate 2 trigger:** twice over — Gate 1 YELLOW, and new-surface creation (independently triggering)
**Backlog ticket:** [pending — feature ticket not yet filed; see §Required follow-ups]
**Lenses:** product-ux-engineer (lead) · senior-engineer (cross-cutting) · general-purpose (external / market)
**Facilitator:** synthesis pass, 2026-08-05
**Date:** 2026-08-05

> **Verification note.** Every mechanical claim reproduced below was re-checked against HEAD by the
> facilitator before being admitted. Three digest claims did not survive verification unchanged and
> are corrected in place, each marked **[CORRECTED]**. Three survived but with their force altered
> and are marked **[REFINED]**. Nothing was dropped for being inconvenient.

---

## Feature summary

The Hole Map (`SCORED-READOUT-SPEC.md` §9bis, View 7) prices *the branches the pool does not take*:
for each of 945 priced decision-tree branches it reports the fold % required by pot geometry, the
pool's measured fold %, the engine's predicted fold %, the gap in points, and that gap denominated
three ways — bb per occurrence, occurrences per 100 hands, and bb/hour at a stated 25 hands/hour —
alongside an `n` and a verdict of `gap-positive` or `model-suspect`. A second, engine-free arm reads
realized outcomes straight off the corpus. A disjointness guard refuses to sum alternatives at the
same node and reports a 309-row portfolio ceiling instead.

The generator and the freshness plumbing have already shipped and are out of scope here
(`scripts/backtest/run-hole-map.mjs`, `holeMapFreshness.mjs`, `npm run hole-map`,
`npm run hole-map:check`). **This gate governs only the in-app reading surface** — the founder's ask
was to read this in the app's study section and have it stay current as the engine improves.

Gate 1 named two gaps: **G1** no JTBD covers pool-level exploit pricing; **G2** no persona covers the
founder in analyst mode. It returned YELLOW on the reasoning that two named additions close it.

---

## Stage A — Persona sufficiency

**Lens verdicts:** lead ⚠️ patch · cross-cutting ⚠️ · external ❌ structural gap
**Resolved output: ❌ Structural gap**

### Why the ❌ carries

ROUNDTABLES.md §Stage A defines ❌ as *"new core persona missing entirely; Gate 3 must close this
before Gate 4."* That is a definitional test, not a matter of lens preference, and two archetypes
meet it. Verified: `docs/design/personas/core/` holds 16 personas (`analyst-api-user`,
`apprentice-student`, `banker-staker`, `chris-live-player`, `circuit-grinder`, `coach`, `evaluator`,
`hybrid-semi-pro`, `multi-tabler`, `newcomer`, `online-mtt-shark`, `ringmaster-home-host`, `rounder`,
`scholar-drills-only`, `traveler`, `weekend-warrior`). None is either of the following.

**A1 — The claim-recipient.** The reader who receives a number from this surface *without the surface
around it*. Verified against HEAD: the shipped row markup (`scripts/backtest/holeMapHtml.mjs:143-155`)
emits nine cells — label, required fold%, measured fold% + n, gap, bb/occurrence, rate/100 + n,
bb/100, bb/hour, pool-frequency + n. The top row reads:

> `bet 33% pot — flop, first in (pool checks 58% here) | 24.8% | 55.2% | +30.4pp | 2.43 | 8.56 | 20.773 | 5.19 | 13.04%`

It carries **no population marker, no era, and not the word "transferred."** The JSON row *does*
carry `denom.transferNote` — *"The corpus is ONLINE, where table pace is several multiples faster, so
the RATE transfers worse than the per-occurrence gap"* — and `rowHtml` does not render it. The words
"transferred" (x2), "ONLINE" (x4), "2009" (x2) and "50NL" (x3) appear in `out/hole-map.html` **only
in prose bands above and below the table**. A screenshot of the table, a paste into chat, a voice
memo quoting a figure — each strips 100% of the claim-safety apparatus, and none of the three is
misuse. This is the reader `CLAUDE.md` presumes when it says *"Before quoting any figure from this
system, read §1"*, and the reader ADR-009's `disclaimerRegisterVersion` stamp exists to protect. The
cast does not contain him. `coach.md` is a coaching relationship, not this.

*Objection recorded, and overruled.* Stage A asks who would *use* the feature; a claim-recipient
receives its output rather than operating it. The objection is real. It is overruled because the repo
has already decided this question elsewhere: the entire fault-register apparatus
(`faultRegister.matches(card)`, `confirmFault` returning `suspect-pending-review` over prior cards)
exists because outputs travel beyond the surface that produced them. A cast that models operators but
not recipients cannot express the requirement that apparatus encodes.

**A2 — The replicator / skeptic.** The reader who wants to *check* a number: pull the conditioning
set, re-run the falsifier, confirm the manifest. ADR-009, Result Cards, replication manifests and
`registerVersion()` all exist to serve exactly this reader, and he appears nowhere in `personas/`.
`analyst-api-user` is modelled as an external consumer who wants *his own data out* — a different
relationship from wanting *the repo's claims verified*. **Gate 1's G2 (founder-in-analyst-mode) is
the narrower half of this gap**, and closing G2 alone would leave the wider half open. This archetype
is unambiguously a *user* of the feature and unambiguously unmodelled; on its own it satisfies the
❌ rubric without needing A1.

### Situational gaps (⚠️, do not change the stage verdict)

- **A3 — Multi-day interrupted read** (lead). No situational persona covers reading one evergreen
  document across several sittings. `returning-after-break` is skill decay — a different axis. No
  scroll-position or filter persistence is named anywhere in the proposal.
- **A4 — Caveat decay** (external), distinct from A3 and from `returning-after-break`. In six months
  the page will be *fresh* and the reader *stale*. Nothing in the freshness machinery can fire,
  because that machinery watches the artifact and the thing that changed is the reader.
- **A5 — `study-block` should split.** Verified: `study-block.md:12` frames the block around *"a
  drill, a concept, a review window"*; `:31` wants *"quick entry into a drill"*; `:42` wants a drill
  as the default path; `:51` lists *"Feel like work rather than study"* as an anti-pattern. This
  surface is work, correctly, and cannot inherit that anti-pattern. Two lenses independently proposed
  the same remedy: split into `study-block-drill` / `study-block-reference`. The lead adds that the
  realistic reading persona is closer to `post-session-chris`, and that **Gate 4 must not borrow
  `study-block`'s gamified patterns** (streaks, mastery advancement) for a reference document.
- **A6 — Pre-session digest is uncovered** (lead). Verified: `presession-preparer.md:42` declares
  three time-budget sub-variants — 5 / 15 / 30 minutes. A 945-row document fits none of them, and no
  digest form of it is proposed.

---

## Stage B — JTBD coverage

**Lens verdicts:** lead ⚠️ expansion · cross-cutting ⚠️ · external ❌ domain missing
**Resolved output: ❌ Domain missing**

### Why the ❌ carries — decided by Gate 1's own text

ROUNDTABLES.md §Stage B defines ❌ as *"feature operates in a JTBD domain the atlas doesn't yet
cover."* Gate 1 §Output 3 already established exactly that, in its own words: the nearest domains
*"all miss on unit"* (`DS-*` is skill acquisition, `SR-*` is your own hands, `MH-*` is one live spot),
and the recommendation carried into Gate 2 was *"extend `DS-*`, or open a new `FE`/field-exploit
domain that Views 1–6 can also land in."*

A gap that is closed by **opening a domain** is ❌ by the rubric, not ⚠️. The lead's ⚠️ is not
inconsistent with the evidence — it reflects a judgement that one domain addition is a patch — but it
is inconsistent with Gate 1's own characterisation of the same gap, and the rubric is written to be
read literally. Note the compounding fact Gate 1 raised and no lens disputed: the same missing domain
is the home Views 1–6 will need next. A domain absent for one surface is a patch; a domain absent for
seven is a domain.

### The jobs, as the three lenses named them

| Job | Persona | Atlas status |
|---|---|---|
| *Where is this field exploitable that I am not exploiting, priced per hour, with the evidence count and conditioning set attached* | founder-analyst | **absent** — the primary outcome, no home |
| *Verify a number this system published without asking its author* | replicator/skeptic (A2) | **absent** |
| *Repeat a figure to someone else without stripping what makes it honest* | claim-recipient (A1) | **absent** |
| *Trust-the-sheet* (lineage-stamped reference) | all | `CC-82` — direct, no change |
| *Know-my-reference-is-stale* | all | `CC-83` — direct, no change |
| *Validate confidence matches experience* | founder-analyst | `DS-58` — partial; model-level, not anchor-level |
| *Carry the reference offline* | `study-block-reference` | `DS-60` — **unresolved** |

`DS-60` deserves its own line. Gate 1 flagged "does the in-app surface replace, complement, or export
to the offline HTML" as a Gate 2 question because it decides whether the surface must be
print/export-capable. **It is still open, and Gate 3 must settle it** — it is a precondition on the
container decision, not a consequence of it.

---

## Stage C — Situational stress test

**Lens verdicts:** lead ⚠️ adjust · cross-cutting ✅ with a process flag · external ❌ fundamental mismatch
**Resolved output: ❌ Fundamental mismatch**

This is the stage where the three lenses are furthest apart, and the disagreement is the finding. The
cross-cutting ✅ and the external ❌ answer different questions: the cross-cutting lens asked whether
the *engineering* survives the situations (it does, with preconditions); the external lens asked
whether *the number the reader will act on* survives the situation he reads it in. The second is
Stage C's written question — *"can the user complete the feature's primary JTBD within the
situation's time / attention / cognitive budget?"* — and its answer is no, for a reason no design
adjustment reaches.

### C1 — The structural inversion (external lens; the sharpest finding in the roundtable)

Verified arithmetic, re-derived from `out/hole-map.json` at HEAD:

| | value |
|---|---|
| `portfolio.total` | **12.3179 bb/hour** over **309 disjoint rows** (`disjoint: true`, 0 dropped) |
| top three rows, summed | **12.5461 bb/hour = 101.85% of the total** |
| remaining 306 rows, summed | **−0.2282 bb/hour** |
| rows with negative bb/hour | **194 of 309** |
| rows carrying `model-suspect` | **203 of 309** |

The top three rows are:

1. `bet 33% pot — flop, first in` — 5.193 bb/hr, n=36,644, pool takes it 13.04%, measured fold 55.2%
2. `bet 200% pot — river, first in` — 3.838 bb/hr, **n=551**, pool takes it **0.69%**, measured fold **82.9%**
3. `bet 200% pot — turn, first in` — 3.515 bb/hr, **n=393**, pool takes it **0.29%**, measured fold 78.9%

**59.7% of the entire portfolio ceiling is two rows, both first-in bets of 200% pot, at sizings the
pool takes 0.7% and 0.3% of the time.**

And here is the inversion. The 82.9% fold rate is conditioned on **the 551 bets the pool actually
made at that sizing** — and a range that fires 2x pot in 2009 online 50NL *is a range, not a sizing*.
Hero cannot arrive at that node carrying the range that produced the observation. So the instrument's
own governing thesis — *"a line the pool almost never faces has no defence constructed against it, so
the hole in the action distribution IS the exploit"* (`holeMap.mjs:15-17`) — is **precisely the
property that makes the estimate weakest exactly where the claim is largest.** Rarity is the source
of the edge and the source of the unreliability, and they are the same fact.

That is not a caveat to add. It is an inversion in the instrument's logic, and it is why this stage
is ❌ rather than ⚠️: no adjustment to the reading surface changes it. It has to be *said*, in the
row, by whoever owns the estimate.

### C2 — Rows 1–8 are one decision, and the refusal to sum renders below the table

Verified: `holes[0..7]` all carry `spotNodeKey: "flop|none|na"` — eight sizings of a single flop
decision occupying the top eight positions. RULE 7c's disjointness refusal — *"THE TABLE DOES NOT
SUM, AND THAT IS THE CORRECT OUTPUT ... adding nine sizings at the same flop node would be adding
nine alternatives to the same decision"* — renders **after** `<tbody>` (`holeMapHtml.mjs:167`, then
`:176`). The reader in `post-session-chris`'s situation reads top-down and stops when he has an
answer. The sort order does the talking; the refusal arrives after the damage.

### C3 — Triage vs density **[CORRECTED]** — the lead's #1, re-priced

The lead ruled this its number-one finding, weighted above both Gate 1 gaps: 811 of 945 rows are
`model-suspect` against 134 `gap-positive` (**verified exactly**: 134 / 811 / 945), so a raw table
makes the founder ~6x more likely to land on a flagged-unreliable row than an actionable one, and
*"a raw table inverts the intended reading order by construction."*

**The count verifies; the mechanism does not, as stated.** Verified at HEAD: the `holes` array is
already sorted strictly descending by `denom.bbPerHour`, `gap-positive` rows occupy indices
**0–147**, **130 of the first 134** rows are gap-positive, and the first `model-suspect` row does not
appear until **index 130**. The shipped HTML renders `doc.holes...slice(0, 30)`
(`holeMapHtml.mjs:141`) — thirty rows, every one gap-positive.

So the 6x inversion is **not a property of the artifact. It is a hazard of the port.** It becomes
true only if the React view re-sorts, defaults to a different column, or renders in an order that is
not the artifact's. That reframing does not dismiss the finding — it sharpens it into a binding,
near-free Gate 4 constraint (**AP-01: the artifact's own order is the default; `model-suspect` is a
filter, never a discovery**) and it explains why it ranks below C1. See §Adjudications #2.

### C4 — Day-one in-app state is degraded **[VERIFIED, and worse than reported]**

Verified: `out/hole-map.json` `freshness.state` is **`dirty-source`**, and the current top-of-page
banner immediately under `<h1>The Hole Map</h1>` (`out/hole-map.html:133-143`) reads *"GENERATED FROM
UNCOMMITTED ENGINE CHANGES on top of fe716f59. The commit stamped is not the code that ran, so every
engine-derived column here is unattributable."* Unless regeneration from a clean tree is part of
shipping, the surface's first in-app state is a full-width warning that its own columns are
unattributable. And `.claude/hooks/readiness-gate.cjs`'s governing lesson — *a banner shown every
session is a banner nobody reads by week three* — applies to **this** banner during an engine sprint,
which is the condition it will most often be in.

**[CORRECTED]** The digest reported `decisionSource.degraded` as rendering as "a neutral stat chip."
It is worse: verified, the `degraded` string — *"No per-decision sidecar on disk. Falling back to the
depth-ablation run rows, which carry piPool/piOurs/slices/evStats but NOT the ranked candidate list,
NOT per-action EVs, NOT per-candidate villain fold predictions, and NOT raw geometry"* — **does not
appear in the rendered page at all.** `holeMapHtml.mjs:398-399` renders only `decisionSource.rows`
and `decisionSource.source` as a neutral count-and-label chip. The degraded mode is not
under-communicated; it is silent.

### C5 — Freshness regresses silently in-app (lead)

Verified: `freshness.checkedAt` (`2026-08-05T21:22:11.139Z`) is **identical to** `generatedAt`, and
`state` is baked at generation time. The static HTML gets around this because `npm run hole-map:check`
re-stamps the banner in place between the `<!--FRESHNESS:START-->`/`<!--FRESHNESS:END-->` markers
without re-running the corpus pass. **A React view that inherits the generation-time snapshot is an
H-N01 violation and is strictly worse than what ships today** — the app would claim a currency the
CLI already knows to be false. Freshness must be *computed at read*, from `classifyFreshness` against
live HEAD, not read out of the artifact.

### C6 — The reader's situation supplies a competing number one nav hop away

Verified: `src/components/views/SessionsView/InsightsBand.jsx:39` renders a measured
`{money(r.hourlyRate)}/h` per row. At $1/$2 the Hole Map's 12.32 bb/hr reads as $24.64/hr. Nothing in
either surface prevents the reading *"there is more untapped edge here than I currently earn."* This
is a Stage C fact and not only a Stage D one, because it is the situation the founder is actually in
when he opens this page.

---

## Stage D — Cross-product / cross-surface

**Lens verdicts:** lead ⚠️ partner updates · cross-cutting ⚠️ with a hard precondition · external ⚠️
**Resolved output: ⚠️ Partner surfaces need updates** — unanimous, with one precondition promoted.

### D1 — The dark-surface mechanism, traced (cross-cutting lens)

The cross-cutting lens did the archaeology and it holds up at HEAD. Verified:

- `CalibrationDashboardView` **is built** — `src/components/views/CalibrationDashboardView/` contains
  9 files (`CalibrationDashboardView.jsx`, `CalibrationTabs.jsx`, `AnchorCalibrationPanel.jsx`,
  `AnchorDetailPanel.jsx`, `PrimitiveCalibrationPanel.jsx`, `PredicateCalibrationPanel.jsx`,
  `EnrollmentStateBanner.jsx`, `CalibrationEmptyState.jsx`, `index.js`) totalling **1,194 LOC**, plus
  `src/hooks/useCalibrationDashboard.js` and two test files. Last touched **2026-06-12** (`1c0eecd1`).
- It was **not deferred for cause.** Gate 1 was ratified 2026-05-09 and the spec authored; an
  unrelated commit (the Voice Card Entry spike) then swept in-flight import hunks into
  `PokerTracker.jsx` and broke CI — recorded at `.claude/failures/UNTRACKED_IMPORT_BUILD_BREAK.md`.
  The fix-forward reverted the reference.
- `src/constants/viewRegistry.jsx` was created **2026-06-19** (`0230d095`, the Homebase nav commit)
  *citing that incident*, and made the non-render **visible** — `deferred: true` at `:112` renders
  `DeferredStub` at `:124`, a full-screen panel reading **"This view isn't available yet."** — rather
  than wiring the finished component in.
- **The comment above it is false at HEAD.** `viewRegistry.jsx:108-111` reads *"Registered-but-unbuilt
  — explicit stub so the SCREEN constant can't render nothing... Swap `deferred` for a `component`
  when the view is built."* The view is built. That comment is now the load-bearing artifact telling
  every future reader not to look.
- **The deep link is live.** `AnchorLibraryView.jsx:136-138` calls
  `ui.openCalibrationDashboard(anchorId, SCREEN.ANCHOR_LIBRARY)`, wired to a rendered control at
  `:300` (`onOpenDashboard={handleOpenDashboard}`); `UIContext.jsx:203-212` dispatches
  `SET_SCREEN → SCREEN.CALIBRATION_DASHBOARD`. A user who takes that path today lands on the stub.

**The mechanism, named:** an incident fix that made silence *visible* without finishing the job, and
nobody owns "flip the flag." Two months and counting.

### D2 — Second instance, a different failure

`docs/design/navigation-ia.md:64` states that Anchor Library is among the long-tail destinations
*"reachable via the in-table sidebar."* Verified: the only two references to `SCREEN.ANCHOR_LIBRARY`
in non-test source are `viewRegistry.jsx:98` (the registration itself) and
`AnchorLibraryView.jsx:138` (an outbound deep link). **There is no nav entry in any chrome.** The
registry closed *"renders nothing"*; it did not close *"reachable in docs, unreachable in app."* No
test asserts that a surface document's navigation claim resolves to a live entry. The cross-cutting
lens prices the guard at half a day and notes it would have caught both instances.

This is directly Gate 1's §Output 2 concern — the Hole Map needs a nav home and the repo has three
disagreeing chromes (Homebase tiles, `CollapsibleSidebar`, `NavShell`). The repo currently holds two
worked examples of what happens when that is treated as an implementation detail.

### D3 — Data path, with a size surprise (cross-cutting lens)

Verified: `out/hole-map.json` is **2,832,788 bytes (2.83 MB)**. The established precedent for a
generated committed ES module is `src/utils/pokerCore/data/equitySkewDecomposition.js` at **139,066
bytes (136 KB)** — the artifact is **20.4x larger**; `handhqReferencePool.js` is 17 KB. Whichever
delivery shape Gate 4 picks, the size mismatch against the very pattern being cited as precedent is
what will surprise whoever implements it.

### D4 — Partner surfaces

- `SessionsView/InsightsBand` — supplies a measured `$/h` (C6). If the Hole Map ships a bb/hour
  column, these two numbers sit one nav hop apart, sharing units without sharing an axis.
- `PrintableRefresherView/StalenessBanner.jsx` — the repo's only freshness treatment today. Gate 1
  recommends lifting it into `src/components/ui/` rather than forking. No lens disputed this.
- The offline HTML (`DS-60`) — replace / complement / export-from, unresolved (Stage B).
- **The Hole Map must be recorded as unreachable from any live-hand or TableView context** (lead). It
  is a between-sessions reading surface; a path into it from a live surface would be a defect.
- Sidebar: no counterpart proposed and none needed. This is a main-app study surface; the sidebar's
  subject is the current table.

---

## Stage E — Heuristic pre-check

**Lens verdicts:** lead ⚠️ adjustments · cross-cutting ✅ preconditions only · external ❌ H-N08 incompatible
**Resolved output: ❌ Heuristic incompatible** — on H-N08, with the remedy explicitly bounded.

### E1 — H-N08 (aesthetic and minimalist design) ❌

The proposal on the table is, in Gate 1's own words, *"a 945-row sortable table."* Ten numeric
columns, flat. The external lens's argument decides this stage and is worth preserving in shape:
prior art in this genre converged on frequency-weighted aggregation grids with drilldown, and on
named-leak grouping with per-stat sample gates. This artifact **correctly refuses** the sample gate —
RULE 7d, because hiding `n=25` hides the subject — **"but refusing prior art's fix does not exempt
you from the failure mode it fixed."**

Two counterweights were raised. Neither downgrades the stage; both bound the remedy, and are recorded
so Gate 4 does not over-correct:

- `docs/design/heuristics/nielsen-10.md:174` states the framework's own severity weighting: *"a
  violation of H-N03 or H-N05 on a mid-hand surface is always more severe than an H-N08 violation on
  a post-session surface."* This is a post-session surface, so H-N08 here is the framework's
  lowest-severity class. **It is still ❌** — the rubric for ❌ is structural incompatibility, not
  severity — but H-N08 must not be allowed to outrank the Stage C findings in Gate 4's sequencing.
- **[CORRECTED]** The digest describes the artifact as "945 rows x 10 columns." The shipped HTML
  renders **30 rows x 9 columns** (`holeMapHtml.mjs:141`, `:158-165`). The 945-row flat rendering is a
  property of the *proposal*, not of the precedent — which means Gate 4 has more freedom here than the
  finding implies, and also that the proposal asks for something the generator's own author declined
  to do.

**The remedy is bounded, and the bound is unanimous across all three lenses: not one row is dropped,
no n-threshold is added, and the 200%-pot rows stay wherever the sort puts them.** H-N08 is closed by
aggregation-with-drilldown, which preserves every row. It is not closed by narrowing.

The external lens also recorded the mechanism the instrument rejected: **node-locking** — lock the
villain frequencies, re-solve, read one EV — which automatically accounts for hero's whole range,
*"which is exactly why a portfolio ceiling had to be invented."* Recorded as context for Gate 3, not
as a proposal.

### E2 — H-N01 (visibility of system status) ⚠️ x2

Both instances verified above: C4 (day-one `dirty-source` banner; `decisionSource.degraded` rendered
nowhere) and C5 (freshness baked at generation; a React view inheriting it would claim a currency the
CLI knows to be false).

### E3 — H-N02 (match between system and the real world) ⚠️

`model-suspect` is the **majority** verdict (811 of 945) and means roughly the opposite of what a
non-technical reader assumes: not *"this exploit is suspect"* but *"the engine's number for this row
is untrustworthy; the measured gap may be fine."* Verified: `rowHtml` emits
`MODEL SUSPECT — ${r.suspectComponent}` as a per-row flag with no inline gloss. The label rides the
row; the definition does not.

### E4 — H-ML01 / H-ML02 / H-ML05 ⚠️ **[REFINED]**

Nine-to-ten numeric columns cannot avoid horizontal scroll at H-ML01's stated **640x360 floor**
(`mobile-landscape.md:11` — *"Anything that renders only at 1600x720 is a bug"*). That stands and is
binding.

The digest's phrasing that horizontal scroll is *"banned on primary paths"* over-reads the heuristic.
H-ML05's own text (`:73`) scopes the ban: *"Data-entry and navigation paths should never require it."*
A dense analytical reading surface is neither. The constraint that actually binds is H-ML01's viewport
floor plus H-ML02's *"users must not be confused about what scrolls"* — which, for a wide table nested
inside a scrolling document, is the harder of the two.

### E5 — Heuristic set selection (facilitator note; no lens raised it)

`docs/design/heuristics/printable-artifact.md` exists and is the set authored for lineage-stamped
reference documents. No lens walked it. Given `DS-60` is unresolved (Stage B) and the offline HTML is
a printable artifact today, **Gate 3 or Gate 4 should walk `printable-artifact.md` explicitly** rather
than assuming Nielsen + poker-live-table + mobile-landscape is the right triad for this surface.

---

## Overall verdict

# RED

**Stages: A ❌ · B ❌ · C ❌ · D ⚠️ · E ❌.**

Per `LIFECYCLE.md` §Gate 3, RED means **Gate 3 is required with scope = substantial expansion (new
persona, new JTBD domain)**, and Gate 2 must be re-run against the updated framework and come back
GREEN before Gate 4. It does **not** mean the feature is rejected, and it does not mean the feature
gets smaller. All three lenses stated explicitly that no row should be dropped, no n-threshold added,
and no rows re-ordered away from the sort. RED here buys *more* framework and *more* claim apparatus
around the same 945 rows.

### Why RED and not YELLOW

**1. Three stages meet the ❌ rubric on its own written terms, not on lens preference.** Stage A's ❌
is "new core persona missing entirely" — two are. Stage B's ❌ is "a JTBD domain the atlas doesn't yet
cover" — and Gate 1 itself proposed *opening a domain* as the remedy. Stage E's ❌ is "structurally at
odds with a heuristic" — 945 flat rows against H-N08. These are definitional tests, applied literally.

**2. The external lens's evidence is mechanical and all of it verified.** Re-derived independently:
945 / 134 / 811; `portfolio.total` = 12.3179 over 309 disjoint rows; top three = 12.5461 = 101.85% of
the total; remaining 306 = −0.2282; 194 of 309 negative; 203 of 309 `model-suspect`; the 200%-pot
river row at n=551 / 0.69% pool frequency / 82.9% measured fold and the turn row at n=393 / 0.29%;
59.7% of the ceiling in two rows; `holes[0..7]` all one `spotNodeKey`; zero occurrences of "20 bb" or
"20bb" in the rendered page; zero occurrences of CC-BY, Creative Commons, phh-dataset or uoftcprg in
any hole-map output or generator; row markup carrying no population or era marker. **Not one failed.**

**3. The other two lenses produced no ❌ — but they also produced no counter-evidence.** Their scope
did not reach the artifact's arithmetic. A lens that did not look is not a vote against a lens that
did. ROUNDTABLES.md §Anti-patterns #1 and #2 exist precisely to stop a verdict drifting toward
comfort; averaging three verdicts here would produce YELLOW by arithmetic on opinions rather than by
reasoning on evidence.

**4. The lead and cross-cutting lenses each found something that *raises* the external verdict rather
than lowering it.** The lead's freshness-regression finding (C5) is an H-N01 violation that would make
the in-app surface worse than the static HTML it replaces. The cross-cutting lens's dark-surface
archaeology (D1/D2) establishes an *active, unclosed* pattern of shipping finished surfaces nobody can
reach — which is the specific risk a new surface with an unresolved nav home runs into. Neither ⚠️ is
a dissent from RED; both are inputs to it.

### The one place a ❌ was scrutinised hardest

Stage E. The framework's own severity weighting (`nielsen-10.md:174`) puts H-N08 on a post-session
surface at the bottom of the severity order, and the artifact's actual precedent renders 30 rows, not
945. Both facts are recorded above. **The ❌ is upheld**, because the Stage E rubric asks whether the
*proposed* design is structurally at odds with a heuristic, and the proposal on the table is 945 flat
rows. What those two facts change is the remedy's budget and sequencing, not the verdict — and they
are recorded so Gate 4 does not spend its density budget before it spends its claim-safety budget.

---

## Adjudications

### #1 — `CalibrationDashboardView`: the hosting question versus the blocking question

**The conflict.** The lead ruled that `CalibrationDashboardView` does **not** collapse the new-surface
trigger. The cross-cutting lens established it was never deferred for cause and calls resolving it a
**hard Gate 3 precondition**. Both positions are correct; they answer different questions and arrive
at different urgency.

**Both sets of facts verified.** The lead's three reasons all hold at HEAD:

1. *Subject mismatch.* The view's panels are `AnchorCalibrationPanel`, `PrimitiveCalibrationPanel`,
   `PredicateCalibrationPanel` — they calibrate **the founder's own anchors and primitives**. The Hole
   Map measures **the pool**. This is the identical AP-06 framing violation Gate 1 already used to rule
   out `self-coach-view` ("your holes"), and it is dispositive on its own.
2. *Zero nav entries.* Verified — `SCREEN.CALIBRATION_DASHBOARD` appears only at `viewRegistry.jsx:112`
   (deferred), `UIContext.jsx:203-212` (the opener) and `AnchorLibraryView.jsx:138` (the deep link).
   Un-deferring it therefore does not answer *"where does the founder tap to get here."*
3. *Inherited tier gate.* Verified — `src/utils/entitlement/featureMap.js:50` sets
   `CALIBRATION_DASHBOARD: TIERS.PRO`. Hosting the Hole Map there would silently inherit an
   entitlement decision made for a different feature.

The cross-cutting lens's facts hold too (D1), including the one the lead did not have: `deferred: true`
is **unfinished incident cleanup**, its adjacent comment is **false at HEAD**, and the deep link from
Anchor Library **is live and lands on a stub**.

**Resolution.** The hosting question is **settled in the lead's favour, permanently**: the Hole Map is
a new surface, and Gate 1's new-surface trigger stands. Gate 3 is **not** owed a re-evaluation of
`calibration-dashboard` as a host. Subject mismatch alone closes it; the other two reasons make
reopening it actively costly.

The cross-cutting lens's precondition survives, but it attaches to a different thing. **What Gate 3 is
actually owed is a navigation-reachability resolution, not a hosting resolution.** Concretely:

- Resolve `SCREEN.CALIBRATION_DASHBOARD` one way or the other — wire the built component, or defer it
  *for a stated reason* — and **fix the false "registered-but-unbuilt" comment either way**, because
  that comment is what currently instructs readers not to look.
- Either give `SCREEN.ANCHOR_LIBRARY` the nav entry `navigation-ia.md:64` already claims it has, or
  correct `navigation-ia.md`.
- Land the guard that makes a third instance impossible (D2).

**Urgency, stated precisely.** This precondition **does not block Gate 3's critical path** — persona
authoring and JTBD-domain authoring can start today and are the long pole. It **does block Gate 4's
navigation section**, which cannot honestly choose among three chromes while two of the repo's
existing surfaces are unreachable through all three. Treat it as P1-and-parallel, not P1-and-serial.
The lead's constructive recommendation is adopted unchanged and belongs to Gate 4: **reuse the
calibration dashboard's doctrine — AP-01 default sort, AP-04 no scalar score column, AP-06
model-accuracy-not-your-accuracy framing — and not its tab.**

### #2 — Ranking: triage / default-sort versus portfolio concentration versus claim-recipient

**The conflict.** The lead ranked the triage/default-sort problem its #1, explicitly above both Gate 1
gaps. The external lens ranked portfolio concentration and the claim-recipient gap above it.

**The verification decides this**, and it decides it against the lead — on mechanism, not on
importance. As established in C3: the artifact's `holes` array is *already* sorted bb/hour descending;
`gap-positive` rows occupy indices 0–147; the first `model-suspect` row is at index 130; and the
shipped HTML renders the top 30, all gap-positive. **The 6x inversion is not true of the artifact. It
is a hazard the port could introduce.**

That yields a clean ordering criterion: *is the finding true at HEAD, and does the correct remedy for
the others make it better or worse?*

| Rank | Finding | True at HEAD? | Interaction |
|---|---|---|---|
| **1** | **C1 — structural inversion + portfolio concentration.** 59.7% of the 12.3179 ceiling is two rows whose fold estimate is conditioned on the range that chose that sizing. | **Yes**, arithmetically, independent of any design decision. | **Fixing #3 correctly makes #1 worse.** The correct default sort is exactly what promotes the two 200%-pot rows to positions #2 and #3. |
| **2** | **A1 — claim-recipient / row-level provenance.** Every rendered row strips population, era and transfer status. | **Yes** — verified in `rowHtml`. | Independent. The cost of not fixing it compounds with every screenshot; there is no later moment when it gets cheaper. |
| **3** | **C3 — triage / default sort.** 811 vs 134 makes the reading order load-bearing. | **No** — true of a naive port, not of the artifact. | Cheapest of the three. A one-line constraint (preserve the artifact's order; `model-suspect` is a filter, never a discovery). |

**The external lens's ranking is upheld, with the lead's finding kept and re-priced rather than
demoted.** Two things must be said plainly so this is not misread as dismissal:

- **Rank ≠ priority-per-effort.** C3 is the cheapest fix on the entire list and should probably land
  *first* in wall-clock order precisely because it is nearly free. Low severity rank, high
  risk-reduction per unit of effort.
- **C3 and C1 are coupled, and the lead identified half of a two-part mechanism.** The reading order
  *is* load-bearing — the lead is right about that. What the arithmetic adds is that getting the order
  right is what surfaces the concentration problem. The two must be closed together, or the first fix
  hands the founder a cleaner path to the weakest numbers on the page.

**On the lead's claim that triage outranks both Gate 1 gaps: rejected.** G2 (persona) is the narrow
half of A2 and the reason the surface has no stated reader; G1 (JTBD) is the reason it has no stated
success criterion. A default-sort constraint is an instruction *to* Gate 4. The two gaps are the
reason Gate 4 cannot start.

### #3 — Stage C's ✅ versus ❌ (cross-cutting versus external)

Not a genuine conflict once the question is stated. The cross-cutting ✅ covers engineering
situational risk — does the code survive the situations — and it arrives with preconditions
(regeneration from a clean tree, data path decided, freshness at read). The external ❌ covers whether
the *reader* can complete the primary JTBD in his actual situation. Stage C's written question is the
second one. **❌ carries; the cross-cutting preconditions are absorbed into the follow-up list rather
than treated as a competing verdict.**

### #4 — The 20 bb/hour anchor **[REFINED]**

The external lens found the anchor load-bearing at `SCORED-READOUT-SPEC.md:747` and `holeMap.mjs:22`,
absent from the rendered page, and *"no provenance anywhere in the repo."*

Verified with one correction. It is load-bearing in both places, and it is absent from the rendered
page (zero occurrences of "20 bb" or "20bb" in `out/hole-map.html`). But it is **not unprovenanced** —
both sites attribute it identically and explicitly to the founder: *"The founder anchored the ask on a
RATE: 'good players make upwards of 20bb per hour.'"* What is missing is not the *source* but the
*evidence*: no citation, no measurement, no Result Card. It is a founder assertion doing the work of a
scale test.

**The correction does not weaken the finding; it relocates it.** The substantive points stand
untouched: at the artifact's own 25 hands/hour, 20 bb/hr is 80 bb/100 — against single-digit bb/100
for a strong online 50NL regular and roughly 10–30 bb/100 as a credible live low-stakes figure — and
it is far more plausible as **$/hr at $1/$2** ($40/hr) than as bb/hr. And the axis argument is the one
that matters: **12.3179 (incremental, a ceiling, transferred from online 2009) and 20 (total,
realized, live) are not on the same axis while sharing units.** That is the mirror image of what
ADR-009 exists to prevent, and the repo has already named the mechanism: `FAULT-horizon-bias` — *"a
one-decision edge read as a winrate"* — is **rank 8 in the live fault register**, status `untested`,
and one of the five entries WS-385 flags as prose-matched. Shipping a bb/hour column into a study
surface gives a registered, unsettled fault a user interface. Combined with C6 (`InsightsBand`'s
measured `$/h` one nav hop away), three numbers in the same units on three different axes become
reachable in under ten seconds.

---

## Required follow-ups

Deduplicated across all three lenses and ranked by risk reduction per unit of effort, with the gate
that owns each and the CWOS queue item filed for it.

- [ ] **1. Gate 3 research — author the missing personas and the missing JTBD domain.** Two core
  personas (`claim-recipient`, `replicator-skeptic`), one situational (`founder-analyst`, absorbing
  Gate 1's G2), one situational split (`study-block` → `study-block-drill` /
  `study-block-reference`), plus `interrupted-multi-day-read` and caveat-decay coverage. Open the
  field-exploit JTBD domain (Gate 1's G1) with room for Views 1–6. Settle `DS-60`. Re-run Gate 2
  against the updated framework; it must return GREEN. — **Gate 3** · effort L · **WS-414**
- [ ] **2. Row-level claim provenance.** Every rendered row carries its population, era and transfer
  status such that a screenshot cannot strip them. `denom.transferNote` exists in the data and is not
  rendered. Owner: whoever owns the estimate, not the view. — **Gate 3 → 4** · effort M · **WS-415**
- [ ] **3. Price and disclose the portfolio concentration and the structural inversion.** 59.7% of the
  ceiling is two rows at 0.69% / 0.29% pool frequency whose fold estimate is conditioned on the range
  that chose that sizing. No rows dropped, no n-threshold — this is a *disclosure and ordering*
  requirement, not a filter. — **Gate 3** · effort M · **WS-416**
- [ ] **4. Resolve the 20 bb/hour anchor and the shared-units / different-axes problem.** Either
  evidence it or retire it as a scale test; either way the ceiling and any realized rate must not
  appear in the same units without their axes stated. Links to `FAULT-horizon-bias` (register rank 8,
  untested) and to `InsightsBand`'s `$/h`. — **Gate 3** · effort M · **WS-417**
- [ ] **5. Freshness computed at read, and degraded modes rendered.** `freshness.checkedAt` equals
  `generatedAt` in the artifact; a React view inheriting it is an H-N01 violation and worse than the
  static HTML. `decisionSource.degraded` renders nowhere today. Includes: regeneration from a clean
  tree is a shipping precondition — the current artifact is `dirty-source`. — **Gate 4 → 5** ·
  effort M · **WS-418**
- [ ] **6. Close the two dark surfaces and guard against a third.** Resolve `CALIBRATION_DASHBOARD`
  (wire, or defer for a stated cause) and fix the false `viewRegistry.jsx:108-111` comment; reconcile
  `navigation-ia.md:64`'s Anchor Library claim with reality; add the test asserting every surface
  document's nav claim resolves to a live entry. Blocks Gate 4's nav section, not Gate 3. —
  **Gate 4** · effort M · **WS-419**
- [ ] **7. The two-renderer guard on the arithmetic side.** Freshness earned purity via a real test
  (`scripts/__tests__/holeMapFreshness.test.js`, module-boundary block asserting no `node:` imports).
  *"No figure appears as a literal in JSX"* is stated intention with nothing enforcing it — the phrase
  occurs exactly once in the repo, in the Gate 1 audit. One test closes it. — **Gate 4 → 5** ·
  effort S · **WS-420**
- [ ] **8. CC-BY 4.0 attribution on hole-map outputs.** The corpus is CC-BY 4.0 per
  `docs/provenance/data-source-registry.md` (SRC-011 review notes); zero occurrences of CC-BY,
  Creative Commons, phh-dataset or uoftcprg in any hole-map output or generator. Harmless as a local
  file; a problem the moment either delivery shape ships the data. One line. — **Gate 4 → 5** ·
  effort S · **WS-421**

### Persona additions (Gate 3 — deliverable of #1)

- `personas/core/claim-recipient.md` — **new core.** Receives a figure without the surface around it.
- `personas/core/replicator-skeptic.md` — **new core.** Wants to check a number, not consume data.
  Absorbs and widens Gate 1's G2.
- `personas/situational/founder-analyst.md` — the founder reading his own instrument and deciding
  whether to trust it. Gate 1's G2 in its narrow form.
- `personas/situational/study-block-drill.md` + `study-block-reference.md` — split. The reference half
  must not inherit `study-block.md:51`'s *"feel like work rather than study"* anti-pattern, nor its
  streak / mastery affordances.
- `personas/situational/interrupted-multi-day-read.md` — an evergreen document across sittings;
  implies scroll and filter persistence. Distinct from `returning-after-break` (skill decay).
- Caveat decay — the reader goes stale while the artifact stays fresh. May be an attribute of
  `claim-recipient` rather than its own file; Gate 3 decides.

### JTBD additions (Gate 3 — deliverable of #1)

- **New domain — field / pool-level exploit pricing.** The population-scale sibling of `MH-*`. Must
  have room for Views 1–6, which will want the same treatment.
- *Verify a published number without asking its author* — serves `replicator-skeptic`.
- *Repeat a figure without stripping what makes it honest* — serves `claim-recipient`.
- Resolve `DS-60` (carry-the-reference-offline): replace, complement, or export-from.
- No change to `CC-82`, `CC-83`. `DS-58` may need decomposition (model-level versus anchor-level).

### Design adjustments binding on Gate 4

Gate 4 may not begin until Gate 2 re-runs GREEN. When it does, `docs/design/surfaces/hole-map.md`
must carry all of the following. These are constraints, not tickets.

1. **AP-01 — the artifact's own order is the default.** bb/hour descending, as `holes` already is.
   `model-suspect` is a **filter**, never a discovery. (Closes C3 at near-zero cost.)
2. **Aggregation with drilldown, and not one row dropped.** This is the H-N08 remedy and the bound is
   unanimous across all three lenses: no rows removed, no n-threshold, no re-ranking away from the
   sort. RULE 7d's refusal of the sample gate is upheld — hiding `n=25` hides the subject.
3. **AP-04 — no scalar score column.** Reused doctrine from the calibration dashboard.
4. **AP-06 — model-accuracy framing, not your-accuracy framing.** The subject is the pool. Same reason
   Gate 1 ruled out `self-coach-view`.
5. **The disjointness refusal renders before or beside the table, never only after it** — rows 1–8 are
   eight sizings of one flop decision, and the sort currently does the talking.
6. **`model-suspect` carries its definition inline** (H-N02). It is the majority verdict and it means
   roughly the opposite of what a non-technical reader assumes.
7. **Freshness is computed at read**, and the banner comes from the same `classifyFreshness` the CLI
   uses. Lift `StalenessBanner` into `src/components/ui/` rather than forking it.
8. **No path into this surface from any live-hand or TableView context.** Record it as unreachable
   from live surfaces by design.
9. **Container: portrait-native `FluidView`**, per Gate 1 §What Gate 2 should decide #3 — reading
   screens are fluid single-column; only 1600x720 game-flow surfaces keep `ScaledContainer`. Must
   survive the H-ML01 640x360 floor with an unambiguous scroll model (H-ML02).
10. **Native rendering, not an embedded artifact** — Gate 1's recommendation, unchallenged by any lens:
    an embedded artifact cannot participate in the app's own staleness and lineage language.
11. **Walk `docs/design/heuristics/printable-artifact.md`** as a fourth heuristic set (E5). No lens
    did, and it is the set authored for lineage-stamped reference documents.
12. **A pre-session digest form is out of scope, and must be said so explicitly** —
    `presession-preparer` has 5 / 15 / 30-minute budgets and a 945-row document fits none. Recording
    the exclusion prevents the surface being quietly stretched to serve a persona it cannot.

### Open questions this roundtable did not settle

- **Data delivery shape** — a tracked `public/study/hole-map.json` fetched lazily, versus a generated
  committed ES module. Both keep the JSON as source of truth. The 20.4x size gap against the precedent
  being cited (`equitySkewDecomposition.js`, 136 KB) is unresolved and belongs to Gate 4.
- **Node-locking versus the portfolio ceiling** — whether locking villain frequencies and re-solving
  should displace the ceiling as the aggregate. Raised by the external lens as context. Out of scope
  for a design gate; it is an instrument question.
- **Nav chrome selection** among Homebase tiles / `CollapsibleSidebar` / `NavShell`. Blocked behind
  follow-up #6.
- **A baseline the cross-cutting lens could not establish.** It could not verify a reported "8 failing
  test files" count, because concurrent edits under `src/utils/exploitEngine/` would have measured
  in-flight work rather than a baseline. It flagged rather than asserted, correctly. Related and
  verified: the wall-clock test defect has one live instance —
  `scripts/__tests__/gitGuardConcurrency.test.js` synchronously spawns git (`execFileSync` /
  `spawnSync` at `:49`, `:76-77`, `:83`) — and the underlying question is open as **WS-379**
  (`status: backlog`, unclaimed, `program: methodology-integrity`). Not a Hole Map follow-up; recorded
  so it is not rediscovered as one.

---

## Corrections to the lens digests, recorded

| Claim | Status |
|---|---|
| "Default table order makes the founder ~6x more likely to land on a flagged-unreliable row" (lead) | **[CORRECTED]** Counts verified (134 / 811 / 945). Mechanism does not hold of the artifact: `holes` is already sorted bb/hour descending, gap-positive occupies indices 0–147, first `model-suspect` at index 130, and the shipped HTML renders the top 30 — all gap-positive. It is a port hazard, not an artifact defect. Re-ranked #3; see Adjudication #2. |
| "`decisionSource.degraded` renders as a neutral stat chip" (external) | **[CORRECTED]** Worse than stated. The `degraded` string does not appear in the rendered page at all; `holeMapHtml.mjs:398-399` renders only `rows` and `source`. |
| "945 rows x 10 columns flat" (external, H-N08) | **[CORRECTED]** True of the *proposal*; the shipped precedent renders 30 rows x 9 columns. Verdict unchanged — the proposal is what Stage E judges — but Gate 4 has more freedom than the phrasing implies. |
| "The 20 bb/hr anchor has no provenance anywhere in the repo" (external) | **[REFINED]** It has a source — attributed at both sites to the founder verbatim — but no evidence, citation or Result Card. Relocates the finding from *unsourced* to *unevidenced*; the substantive points (80 bb/100 implausibility, $/hr-at-1/2 alternative, axis conflation) are unaffected. |
| "CalibrationDashboardView — 8 files, 1,455 LOC" (cross-cutting) | **[REFINED]** 9 files / 1,194 LOC in the view directory at HEAD, plus `useCalibrationDashboard.js` and two test files. The substance — that it is finished, not unbuilt — verified and unchanged. |
| "Horizontal scroll banned on primary paths" (external, H-ML05) | **[REFINED]** H-ML05's own text scopes the ban to *"data-entry and navigation paths."* The binding constraint is H-ML01's 640x360 floor plus H-ML02's scroll clarity, which is the harder pair anyway. |
| Everything else in all three digests | **Verified against HEAD.** |

---

## Change log

- 2026-08-05 — Created. Gate 2 for the Hole Map study surface. Verdict **RED**; Gate 3 required with
  scope = substantial expansion. Follow-ups filed as WS-414 … WS-421.
