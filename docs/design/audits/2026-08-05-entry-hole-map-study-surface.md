# Gate 1 Entry — 2026-08-05 — Hole Map study surface (HMS)

**Feature working name:** Hole Map study surface — the View 7 readout, readable in-app, with read-time freshness
**Audit ID:** `entry-hole-map-study-surface-2026-08-05`
**Proposed by:** Founder, 2026-08-05 — *"this is fantastic data and worth a detailed read by me in the study section to dig into, and worth updating as we improve. good work. lets make sure this is captured in our study tool and that it gets updated as we progress."*
**Backlog ticket:** [pending]
**Gate:** 1 (Entry) — mandatory
**Next gate:** **Gate 2 (Blind-Spot Roundtable, REQUIRED)** — new-surface creation and a YELLOW verdict, each independently triggering per `LIFECYCLE.md` §Gate 2.
**Status:** **YELLOW**

---

## Feature summary (as proposed)

The Hole Map (`SCORED-READOUT-SPEC.md` §9bis, View 7) runs today and emits `out/hole-map.json`
plus a self-contained `out/hole-map.html`. It prices *the branches the pool never takes*: required
fold % from pot geometry against the pool's measured fold rate, denominated to bb/occurrence,
bb/100 hands and bb/hour, over 945 rows, with a disjointness guard that refuses to sum
alternatives and an engine-free outcome arm read straight off the corpus.

The founder wants to read it **in the app's study section**, and wants it to **stay current as the
engine improves**.

The second requirement is the load-bearing one and it is not a UX requirement. A rendered copy of
this readout goes wrong silently: `engineFoldPct` and every `model-suspect` verdict derived from it
are statements about one engine commit, and nothing about a rendered page announces when that
commit stops being HEAD. That is the exact mechanism ADR-009 exists to prevent.

**The freshness half has been built and is out of this gate's scope** — it is generator, CLI and
docs, with no UX surface. See §Already shipped. This audit governs only the in-app reading surface.

---

## Output 1 — Scope classification

**Primary classification:** **Surface addition (new view).**

The artifact is a long, dense, scrolling analytical document with an inline decision-tree figure,
a threshold chart, a 945-row sortable table and a provenance band. No existing surface can host it
without being deformed:

| Surface | Why it is not the host |
|---|---|
| `printable-refresher` | Its unit is an authored, printable **card** with a 7-field lineage footer, a schemaVersion, an IDB store and a print/batch flow. The Hole Map is one generated document, not a card, and forcing it into the card schema would require inventing a card class that is never printed. |
| `self-coach-view` | Mastery/curriculum over **the founder's** concept state. The Hole Map is a measurement of **the pool**. Placing it here reads as "your holes", which is the AP-06 framing violation the calibration dashboard already fought. |
| `postflop-drills` → Line tab | An interactive drill DAG inside `ScaledContainer` at a fixed 1600×720. A 945-row table cannot live in a fixed-height scaled box, and the surface is reachable only from a floating button inside SessionsView. |
| `analysis-view` | Retrospective review of **the founder's own hands**, landscape `ScaledContainer`. Wrong subject and wrong container. |
| `calibration-dashboard` | Closest genre match — a study-mode audit surface for model-vs-observed. But it is `deferred: true` in `src/constants/viewRegistry.jsx:112` and renders a stub; it is fully built and unroutable. Hosting new content behind an unrouted view would ship it dark. |
| `anchor-library` | Owner-captured exploit anchors, and it has no nav entry at all. |

**Secondary classifications:**

- **Cross-surface journey change (minor).** The surface needs a nav entry, and the repo has three
  disagreeing nav chromes (Homebase tiles, `CollapsibleSidebar`, `NavShell`). Choosing one is a
  Gate 2 question, not an implementation detail — `anchor-library` is the standing example of what
  happens when it is treated as one.
- **System-coherence exposure.** Freshness/provenance is currently rendered in exactly one place
  (`PrintableRefresherView/StalenessBanner.jsx`, amber `#451a03`/`#fde68a`/`#92400e`) and is coupled
  to batch/card vocabulary. A second surface needing the same concept means either lifting a
  generic banner into `src/components/ui/` or forking the treatment. Forking it is how a design
  language stops being one.

---

## Output 2 — Personas identified

**Primary**

- [`study-block`](../personas/situational/study-block.md) — situational. Focused, no time pressure,
  desktop for longer blocks. Fits: this is a long read. **Friction:** the persona's stated needs are
  *"quick entry into a drill"*, *"explanation after every drill"*, *"streak + progress"* — it is
  written around **drills**, not around reading a reference document. It half-covers this.
- [`chris-live-player`](../personas/core/chris-live-player.md) — core. The founder is the reader.
- [`post-session-chris`](../personas/situational/post-session-chris.md) — the realistic entry moment
  (after a session, deciding what to change next time).

**Secondary**

- [`analyst-api-user`](../personas/core/analyst-api-user.md) — the only persona in the cast whose
  relationship to the product is *reading measurements and questioning their provenance*. This is
  the closest match to who actually reads a hole table, and it is modelled as an **external API
  consumer**, not as the founder-as-analyst.

**Explicit check — does the cast cover this feature?**

**Not cleanly.** The reader here is *the founder in analyst mode*: someone who wants the conditioning
set, the `n`, the disjointness refusal and the population caveat, and who will act on a bb/hour
figure. The cast splits that person in two — `chris-live-player`/`study-block` (learner) and
`analyst-api-user` (external, API-shaped). Neither is the founder reading his own instrument's
output and needing to know whether to trust it. **This is a persona gap and it is the main reason
this audit is YELLOW rather than GREEN.**

It is also the persona most exposed to the surface's central risk: this reader is *precisely* the
one who will quote a number, and therefore the one for whom a silently-stale page is most costly.

---

## Output 3 — JTBD identified

**Served by existing, Active jobs**

| ID | Title | Fit |
|---|---|---|
| `CC-82` | Trust-the-sheet (lineage-stamped reference artifacts) | **Direct.** The provenance band is exactly this job. |
| `CC-83` | Know-my-reference-is-stale (staleness surfacing) | **Direct.** The STALE banner is exactly this job — authored for PRF, generalises here without change. |
| `DS-58` | Validate-confidence-matches-experience (observed-vs-predicted transparency) | **Partial.** The threshold chart puts required / measured / engine on one axis, which is this job for the *model* rather than for an anchor. |
| `DS-48` | Understand villain's range composition as decision driver | **Weak.** Related subject, wrong unit — DS-48 is per-villain, this is pool-level. |

**Explicit check — does any proposed outcome not map to an existing JTBD?**

**Yes, and it is the primary outcome.** The job this surface actually serves is:

> *"Tell me where this field is exploitable that I am not currently exploiting, priced in money
> per hour, with the evidence count and the conditioning set attached, so I can pick what to change
> in my game next session."*

Nothing in the Atlas covers it. The nearest domains all miss on unit:

- `DS-*` (Drills and study) is **skill acquisition** — drills, mastery, spaced repetition, lessons.
  This is not a drill and produces no mastery state.
- `SR-*` (Session review) is **your own played hands**. This has no hero hands in it at all.
- `MH-*` (Mid-hand decision) is **live, one spot**. This is between sessions, all spots.
- `CC-82`/`CC-83` cover *trusting and dating* a reference artifact but say nothing about **what the
  artifact is for**.

The missing job is a **field/pool-level exploit atlas** — the population-scale sibling of `MH-*`.
Its absence is not cosmetic: without it there is no stated success criterion for the surface, so
"is this table doing its job" has no answer, and the Atlas has no home for the Views 1–6 readouts
that will want the same treatment next.

A second, smaller gap: **`DS-60` is "carry-the-reference-offline"** — the PRF job. The Hole Map's
current delivery (a self-contained offline HTML) is that job, served outside the app. Whether the
in-app surface **replaces** or **complements** that is an unresolved question, and it is a Gate 2
question because it decides whether the app surface must be print/export-capable.

---

## Output 4 — Gap analysis

### **YELLOW** — two specific gaps, both named, neither fatal.

| # | Gap | Kind |
|---|---|---|
| **G1** | No JTBD for *pool-level exploit pricing* — the surface's primary outcome. | JTBD gap |
| **G2** | No persona for *the founder in analyst mode* — reading his own instrument and deciding whether to trust it. `analyst-api-user` models this relationship but as an external API consumer. | Persona gap |

**Why YELLOW and not RED.** The outcome space is not unmodelled — the app already ships exploit
generation (`exploitEngine`), an anchor library and a calibration dashboard, all of which serve
adjacent jobs for the same reader. Two named additions close it. RED is reserved for a feature
targeting a persona/outcome space we have not modelled at all, and that is not this.

**Why not GREEN.** Both gaps are load-bearing rather than clerical. G1 means the surface has no
stated success criterion. G2 means the reader whose needs decide the whole information design is
absent from the cast.

### Gate 2 is required **twice over**

Per `LIFECYCLE.md` §Gate 2 triggers, and `CLAUDE.md` §Design Program Guardrail:

1. **Gate 1 YELLOW.**
2. **New-surface creation** — independently triggering, regardless of Gate 1's colour.

Gate 2's bypass policy admits skipping only for *small surface-bound fixes*. This is neither small
nor surface-bound. **Implementation is blocked until Gate 2 runs.**

---

## What Gate 2 should decide (carried forward, not decided here)

1. **G1** — author the pool-level-exploit-pricing JTBD. Which domain: extend `DS-*`, or open a new
   `FE`/field-exploit domain that Views 1–6 can also land in?
2. **G2** — extend `analyst-api-user` to cover the internal founder-as-analyst reader, or author a
   `founder-analyst` situational persona?
3. **Container.** Portrait-native `FluidView` (a dense analytical table is a *reading* screen, per
   `feedback_portrait_mode_player_screens` — field-entry and reading screens are fluid single-column,
   only 1600×720 game-flow surfaces keep `ScaledContainer`) — recommended, but confirm against the
   fact that the founder reads on desktop for long blocks, where fluid is also correct.
4. **Nav home.** Three disagreeing chromes. `anchor-library` shows what happens when this is skipped.
5. **Staleness treatment.** Lift `StalenessBanner` to `src/components/ui/` as a generic component, or
   fork? Recommendation: lift — a second forked treatment is how one design language becomes two.
6. **Relationship to `DS-60`/the offline HTML.** Replace, complement, or export-from?
7. **The `calibration-dashboard` question.** It is built, unrouted, and the nearest genre neighbour.
   Is the Hole Map a fourth tab there once it is routed, rather than a new view? That would collapse
   the new-surface trigger entirely and is worth a serious look — but it is a Gate 2 call, and it is
   blocked behind un-deferring a view that has been dark since 2026-05-09.

## What Gate 4 will need

- A surface artifact `docs/design/surfaces/hole-map.md` before any code (Gate 4 is not bypassable).
- A data-delivery decision. Constraint, measured: `out/hole-map.json` is **2.70 MB raw, 124 KB
  gzip, 55 KB brotli**. Firebase Hosting compresses, so wire cost is fine; parse cost on the phone
  is not free. Two candidate shapes, both of which keep the JSON as the source of truth and the
  view as a pure projection (**no figure may appear as a literal in JSX**):
  - a tracked `public/study/hole-map.json` fetched lazily on view open — no view reads a runtime
    JSON anywhere in the repo today, so this is a new pattern; or
  - a generated committed ES module under `src/utils/.../data/`, following the established and
    CI-enforced pattern of `handhqReferencePool.js` / `equitySkewDecomposition.js`.
- A decision on whether the view renders natively or embeds the generated HTML. The embedded
  artifact is guaranteed identical to what the generator produced; native rendering integrates
  with app nav/theming and can link into other study surfaces. Recommendation: **native**, because
  the embedded artifact cannot participate in the app's own staleness/lineage language, and
  because the freshness banner then comes from the same code the CLI uses.

---

## Already shipped under this ask (non-UX, outside this gate)

The freshness half required no UX surface and is complete:

| Piece | Path |
|---|---|
| Provenance manifest on the artifact — engine commit, watched-path dirtiness, `disclaimerRegisterVersion` via `registerVersion()` (ADR-009), regen command, watched paths, inputs | `scripts/backtest/run-hole-map.mjs` |
| Freshness verdict + banner — **pure, no `node:` imports, asserted by test** so the eventual React surface can import it verbatim instead of growing a second banner that can disagree with the CLI's | `scripts/backtest/holeMapFreshness.mjs` |
| The two git questions, kept out of the pure module for that reason | `scripts/backtest/holeMapGit.mjs` |
| Read-time check + in-place restamp of the rendered page | `scripts/backtest/check-hole-map-freshness.mjs` |
| Single regeneration entry point | `scripts/backtest/refresh-hole-map.mjs` · `npm run hole-map` |
| Tests | `scripts/__tests__/holeMapFreshness.test.js` |

The banner is rendered into `out/hole-map.html` between `<!--FRESHNESS:START-->` / `<!--FRESHNESS:END-->`
markers, so `npm run hole-map:check` can update the verdict on an existing page without re-running
the 3-minute corpus pass. It reuses the app's one staleness palette so the eventual React surface
inherits a treatment the founder has already learned.

**No `SessionStart` hook was added, deliberately.** `.claude/hooks/readiness-gate.cjs` records the
governing lesson — *"a banner shown every session is a banner nobody reads by week three"*. An
engine-commit staleness signal would fire on most sessions during an engine sprint, which is exactly
the frequency that trains the founder to skip it. The signal is placed at the point of **reading**
the artifact and at the point of **producing** a new one (`docs/runbooks/baseline-ev-run.md` §11),
not on every session start. For the same reason `WATCHED_PATHS` is deliberately narrow: a commit to
a React view cannot move a cell in this table, and counting it would destroy the signal.
