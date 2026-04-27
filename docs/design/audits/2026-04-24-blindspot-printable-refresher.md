# Blind-Spot Roundtable — 2026-04-24 — Printable Refresher

**Type:** Gate 2 Blind-Spot audit (design lifecycle per `docs/design/LIFECYCLE.md`)
**Trigger:** Gate 1 verdict **YELLOW (leaning RED)** (see `docs/projects/printable-refresher.project.md` §Gate 1) — five independent Gate 2 triggers converged: new surface (Printable Refresher + in-app catalog + print pipeline), 3 candidate JTBDs (PRF-NEW-1/2/3), persona amendment required (mid-hand paper-permission), cross-surface (feeds planned Study Home parent), owner-flagged for scrutiny.
**Participants (5 voices, parallel execution):**
- Voice 1 — Product/UX lead (Stages A, C, E both surfaces)
- Voice 2 — Market / competitive lens (Stage B)
- Voice 3 — Poker theory fidelity (Stage E pre-check — load-bearing risk vector)
- Voice 4 — Autonomy + trust skeptic (Stage E red lines)
- Voice 5 — Senior engineer + print-medium designer (Stage D cross-surface + Stage E ML + print-medium heuristics)

**Artifacts read:**
- `docs/projects/printable-refresher.project.md` (charter + Gate 1 inline)
- `docs/projects/printable-refresher/gate2-voices/01-product-ux.md`
- `docs/projects/printable-refresher/gate2-voices/02-market-lens.md`
- `docs/projects/printable-refresher/gate2-voices/03-theory-fidelity.md`
- `docs/projects/printable-refresher/gate2-voices/04-autonomy-skeptic.md`
- `docs/projects/printable-refresher/gate2-voices/05-senior-engineer-print.md`
- `docs/design/audits/2026-04-24-blindspot-exploit-anchor-library.md` (format precedent + 9 red lines)
- `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md` (8 red lines + three-intent taxonomy)
- `docs/projects/poker-shape-language/gate3-decision-memo.md` §Q1 (Study Home coupling)
- `.claude/context/POKER_THEORY.md` (fidelity guardrails)
- `docs/design/jtbd/ATLAS.md` + `jtbd/domains/drills-and-study.md`
- `docs/design/personas/core/chris-live-player.md` + `personas/situational/mid-hand-chris.md`

**Status:** DRAFT — pending owner ratification before Gate 3 launch.

---

## Executive summary

**Verdict: YELLOW.** Five voices converge: the feature is tractable but carries three structural risks that demand Gate 3 research + Gate 4 spec work before code:

1. **Owner's mental model may carry the anti-patterns the feature must refuse.** Voice 3 (fidelity) flagged 3 of 17 proposed content types as RED — and **2 of those 3 are the owner's own named examples** in the original request (*"56s is good to 3b IP against a deep stacked fish in the cutoff"* and *"don't bluff a calling station"*). The feature's fidelity doctrine (POKER_THEORY.md §7 labels-as-inputs + calling-station-as-weak-range) contradicts how the user currently phrases the content. Gate 3 owner interview is **load-bearing and non-skippable** — if the owner insists on the labelled phrasings, the program-level doctrine-vs-owner conflict is bigger than this one feature.
2. **Printed-advice permanence is a structurally novel autonomy risk.** The 9 inherited red lines (SLS #1–#8 + EAL #9) do not cover paper. A laminated card prints on 2026-04-24; the anchor it cites retires in-app on 2026-06-10; the paper stays on the felt forever. Voice 4 proposes **8 new PRF-specific red lines (#10–#17)**. Voice 5 proposes the lineage + staleness-diff + content-drift CI pipeline that makes those red lines enforceable. These dovetail cleanly but add substantial Gate 4 + Gate 5 scope.
3. **At-table-use framing is market-wrong.** Voice 2 surfaced casino policy evidence (WinStar, Upswing's own page, Reddit consensus) that **most live venues prohibit reference material at the table during hands**. Gate 1 treated this as the primary use case. Gate 2 relocates PRF-NEW-1's primary situation to `between-hands-chris`, `presession-preparer`, `post-session-chris`. `mid-hand-chris` becomes edge-case only — amended with `paper_reference_permitted` but no longer the design driver.

Top 3 structural risks ranked: (1) owner-doctrine reconciliation in Gate 3, (2) permanence-without-retirement requiring novel lineage + staleness + drift-CI infrastructure, (3) content scope overshoot — 17 card types cannot all ship at MVP fidelity; phased rollout (preflop + math first, postflop later) is recommended.

Top 3 required Gate 3 items: (1) owner interview (7 questions below) with doctrine reconciliation as headline item, (2) author 5 JTBDs (3 from Gate 1 refined + 2 from Voice 2), (3) amend 3 personas (mid-hand-chris, apprentice, rounder). Gate 3 is **mandatory** per LIFECYCLE.md YELLOW-Gate-2 rule; expected scope ~1-2 sessions.

---

## Feature summary

*Printable Refresher (PRF)* introduces an in-app surface that generates print-optimized study reference cards for live poker — preflop charts per seat × hand, math tables (auto-profit / geometric-betting / pot-odds / binomial all-in-survival / implied-odds), equity-bucket tables, per-texture × per-hand-type postflop strategy, "pure plays and exceptions" codex. Primary consumer: Chris laminating index-card-sized cards for pre-session prep + between-hands reference + post-session review. Secondary: Scholar (conceptual rote-memory support), Apprentice (coach-assigned printable packs), Rounder. Load-bearing project differentiators vs market competitors (Upswing, GTO Wizard, BBZ, Crush Live, Little, Red Chip, Amazon laminates): engine-derived + rake-aware + stack-conditioned + **lineage-stamped** + **staleness-surfaced in-app** + **personal-codex-capable**. The feature is the first explicit Reference-mode surface shipping under the Shape Language Gate 3 three-intent taxonomy (Reference / Deliberate / Discover) — Reference is write-silent on skill-state.

---

## Stage A — Persona sufficiency

**Output: ⚠️ Patch needed (1 amendment + 2 small goal additions; NO new personas).**

### Findings (Voice 1)

All five voices converge: no new core persona required. Existing cast (Chris + Scholar + Rounder + Apprentice + Newcomer + Coach) covers the consumer archetypes. Three small amendments resolve the gaps:

- **`mid-hand-chris.md` gains `paper_reference_permitted` attribute.** The cognitive state is identical whether a laminate sits on the felt or not — what changes is the *permitted affordance*. In-app surfaces forbidden (1.5s glance budget + H-PLT01); physical laminate permitted within the same budget. Capture-mode remains forbidden (red line #9 precedent); only read-mode. H-PLT04 (socially discreet) applies — no bright color blocks visible to villains. **NOT a new situational persona — an attribute on the existing one.** Market evidence (Voice 2) tempers this: casino policy prohibits reference material mid-hand in most live venues, so the attribute exists for edge-case permitted venues but is NOT the design driver.
- **`apprentice-student.md` — add Goal bullet.** Coach-assigning-printable-pack is a real workflow. New Goal: *"Receive coach-curated printable packs as physical study aids."* Corresponding Missing-feature need: *"[DISC] Accept a coach-authored printable pack (PDF or in-app bundle) into personal library."* The parallel Coach addition ("Curate and send printable packs to apprentices") tracks in Coach persona but is deferred to a future project (CO-* domain already scoped).
- **`rounder.md` — add Goal bullet.** Rounder's Frustrations already note "Mobile tools are thin; desktop tools don't work at a live table." Add Goal: *"Carry vetted reference to the table without touching the phone."* One bullet.

### Cross-voice resolution

Voice 2's market evidence is not in tension with Voice 1's persona amendment — they address different questions. Voice 1 asks "how does the framework model this persona-action?" → attribute. Voice 2 asks "what's the primary use context?" → between-hands / presession / post-session, not mid-hand. Both valid. Primary-use framing for PRF-NEW-1 shifts per Stage B.

No new core persona. No new situational persona. The `paper_reference_permitted` attribute is the load-bearing framework extension.

### Recommended follow-ups

- [ ] **Gate 3:** amend `personas/situational/mid-hand-chris.md` with `paper_reference_permitted` attribute (Voice 1 §A2 exact copy template).
- [ ] **Gate 3:** amend `personas/core/apprentice-student.md` (Goal + Missing-feature bullets).
- [ ] **Gate 3:** amend `personas/core/rounder.md` (Goal bullet).
- [ ] **Explicit Gate 3 non-goal:** no new situational persona. `at-table-with-laminate` rejected in favor of attribute-on-existing.
- [ ] **Gate 4 constraint:** the attribute's `H-PLT04 socially discreet` rule binds print-CSS color palette (no bright blocks).

---

## Stage B — JTBD coverage

**Output: ⚠️ Expansion needed (3 from Gate 1 refined + 2 new = 5 JTBDs total).**

### Findings (Voice 2)

The market is crowded at the preflop-chart tier (Upswing, BBZ, GTO Wizard, PokerCoaching, Little) and nearly empty elsewhere (math tables, texture-conditioned postflop, lineage-stamped content, personal-codex export). Gate 1's 3 JTBDs survive — with one refinement — and 2 more are identified.

**PRF-NEW-1 — Carry-the-reference-offline — REFINED.** Remove mid-hand primary framing per casino-policy evidence. Rewrite:
> *"When I'm in a live-cash context where the app is forbidden or impractical (between hands, at the rail, in the bathroom, pre-session in the car), I want a physical laminated artifact carrying the highest-leverage decision scaffolds, so I can reinforce preparation and review without reaching for the phone."*
Primary situations: `between-hands-chris` + `presession-preparer` + `post-session-chris`. `mid-hand-chris` is edge-case (permitted-venue only).

**PRF-NEW-2 — Trust-the-sheet — SURVIVE unchanged.** Genuinely unique vs market. No competitor ships lineage-stamped, engine-derived, rake-aware, re-derivable-on-demand reference. Every Voice 4 red line (#12 lineage-mandatory) + Voice 5 pipeline spec (lineage object schema) operationalizes this JTBD.

**PRF-NEW-3 — Know-my-sheet-is-stale — SURVIVE unchanged.** Also genuinely unique. Market-wide evergreen-or-silent-update is the norm. Our staleness surfacing is a **trust dividend** from PRF-NEW-2; the two JTBDs reinforce.

**PRF-NEW-4 — Pre-session visualization / kinesthetic memorization — NEW.** *"When I prepare for tonight's session, I want a physical artifact I can walk through slowly, touch, mark up, and internalize — so decision patterns become muscle-memory rather than lookup-dependence."* The laminate-as-physical-object has kinesthetic properties the in-app view cannot replicate (annotatable, ordered on desk, tactile). Evidenced by Jonathan Little's "pre/during/post-session" cheat sheet framing and Red Chip / CLP podcast pre-session prep culture. Distinct from DS-46 (spaced repetition / declarative memory), DS-52 (retention monitoring / procedural), and SE-01 (villain-specific watchlist). Domain: new SE-04 candidate or extends Drills-and-Study.

**PRF-NEW-5 — Export the anchor/codex I've already authored — NEW.** *"When I've built up a private library of exploit anchors, decision rules, and corrections from my own play, I want to print them as a personal codex alongside the generic reference, so the printed artifact reflects MY game, not just GTO baseline."* Bridges to EAL anchors + SR-32 (nominate-for-corpus). Competitors cannot serve this — content doesn't exist for them. Domain: Cross-cutting, or extends DS-57 (capture-the-insight) into an export counterpart.

**No JTBDs to retire.** Existing DS-46 / DS-47 / DS-48 / DS-49 / DS-51 / MH-04 / MH-09 / ON-87 remain — PRF is a presentation layer over several of these, not a replacement.

### Content refused on market-lens grounds (feeds Stage E)

Four content types common in market that PRF explicitly refuses to duplicate:
1. Label-conditioned blanket rules ("Iso-3bet fish OOP always" — Upswing, Little, RCP).
2. "VPIP 40+ = calling station = never bluff" (every cheat sheet).
3. Static push-fold charts stripped of ICM / rake.
4. "GTO chart" without bet-size branch (Upswing free sheets).

### Recommended follow-ups

- [ ] **Gate 3:** author PRF-NEW-1 (refined) + PRF-NEW-2 + PRF-NEW-3 + PRF-NEW-4 + PRF-NEW-5 in `docs/design/jtbd/domains/`. Location per Gate 3 kickoff (Drills-and-Study extension vs new micro-domain "Reference Materials" TBD).
- [ ] **Gate 4 explicit refusal list:** surface spec carries the 4 market-refused content types, referenced by every card-authoring doc.
- [ ] **Gate 3 owner interview:** tier/pricing decision (free lead-gen vs Plus-bundled).
- [ ] **Gate 3 owner interview:** if PRF's preflop cards are visually indistinguishable from Upswing's free pack, cut the preflop tier and link out. Confirm with owner whether derivation-from-own-engine differentiates visibly.

---

## Stage C — Situational stress test

**Output: ⚠️ Targeted adjustments (staleness surfacing + newcomer threshold + paper-artifact layout constraint).**

### Findings (Voice 1)

| Situational | In-app view | Printed artifact | Verdict |
|---|---|---|---|
| `study-block` | Primary consumer. High density + expandable derivation footnotes (paper can't offer). In-app is strictly a *superset* of print. | Export for laminate. | ✅ |
| `presession-preparer` | **Staleness surfacing LOAD-BEARING** — "5 cards out of date since last print 2026-04-10." Ties to returning-after-break decay pattern. | Glance review ≤2 min/card. | ⚠️ staleness non-negotiable |
| `post-session-chris` | Lineage drilldown from printed card ID → full derivation. Primary trust affordance. | Card already used at table; review against played hands on-phone. | ✅ |
| `between-hands-chris` (30–90s) | Not a PRF in-app host (Chris checks villain profiles here). | Laminate glance 3–5s plausible (H-PLT01 applies). | ✅ paper only |
| `mid-hand-chris` (1.5s budget) | In-app forbidden (unchanged). | Laminate permitted per A2 amendment in permitted venues. Drives layout: one-idea-per-card, headline-answer-first. | ⚠️ binding paper-layout constraint |
| `returning-after-break` (28+ day gap) | **CRITICAL** — printed laminate is stale. Per-card staleness list + "re-print queue" affordance. Same decay-on-read pattern as SLS. No push. | Stale laminate = permanent wrong-answer risk if owner doesn't check in-app first. | ⚠️ red-line-adjacent |
| `newcomer` | **Activation threshold needed.** EAL precedent = 25 hands. PRF is comprehension-oriented, so threshold may be time-based (1 completed session + explicit "I want printable reference" entry). A 90-page catalog WILL overwhelm newcomer. | Simplified starter pack (3–5 cards, preflop only) if any. | ⚠️ activation + scope |

### Cross-voice integration

Voice 4's red line #10 (printed-advice-permanence requires in-app staleness surfacing) makes the `returning-after-break` + `presession-preparer` adjustments non-cosmetic. Voice 5's D7 content-drift CI + per-card `printedAt` stamp provides the machinery. All three converge: **staleness surfacing is a structural requirement, not a nice-to-have**.

### Recommended follow-ups

- [ ] **Gate 4 surface spec:** in-app staleness per-card amber footer + batch-level informational banner + "re-print queue" for returning-after-break. NO push notifications (red line #5 + anti-pattern AP-PRF-8).
- [ ] **Gate 4 surface spec:** print-confirmation modal captures user-entered `printed-on DATE` (required for PRF-NEW-3 diff computation).
- [ ] **Gate 4 decision:** newcomer activation threshold (time-based: 1 completed session + explicit opt-in; or hand-based: 25-hand EAL precedent).
- [ ] **Gate 4 layout constraint:** paper cards must scan in ≤1.5s (H-PLT01 paper analog H-PM01 per Voice 5 / H-PRF01 per Voice 1 — consolidate naming). One-idea-per-card (Voice 5 H-PM05) is load-bearing atomicity rule.

---

## Stage D — Cross-product / cross-surface

**Output: ⚠️ Cross-surface coordination needed (Study Home coupling + IDB v18 collision + content-drift CI + state-clear-asymmetry selector library).**

### Findings (Voice 5)

**Inheritance is mostly clean:**
- Persistence is small — one store (`userRefresherConfig`), singleton keypath, 3 writers (config-preference, card-visibility, print-date-stamp).
- IDB v17 → v18 is additive-only.
- Reducer + context slot alongside existing patterns — no provider-hierarchy conflict anticipated.
- Card content derives from existing utils (`pokerCore/`, `gameTreeConstants`, POKER_THEORY.md sections).

**Concerns requiring Gate 3 / Gate 4 resolution:**

1. **Study Home parent coupling (D1).** Per Shape Language Gate 3 Q1, `surfaces/study-home.md` is a cross-project surface (not yet authored). **Recommendation: D1b — parent-TBD reference; do NOT author Study Home inside PRF.** Authoring inside PRF would hardcode a Reference-mode bias into an intent-neutral parent. PRF ships `docs/design/surfaces/printable-refresher.md` with `parentSurface: 'study-home (pending authorship)'` and a standalone route. First Gate 4 to need Study Home authors it; PRF can be that trigger OR a subsequent project can be.

2. **IDB v18 collision with Shape Language (D2).** Both projects independently claim v17 → v18. Shape Language's charter schema plan targets v18 for `shapeMastery` + `shapeLessons` stores; PRF targets v18 for `userRefresherConfig` + `printBatches`. **Both cannot ship as v18 independently.** Coordination rule per EAL Gate 4 P3 §2: `max(currentVersion + 1, targetVersion)` dynamic — whichever project reaches migration-authoring first claims v18; second claims v19. Raise to owner via STATUS.md-level coordination before Gate 4 migration authoring.

3. **Content-drift CI (D7) is non-negotiable and currently under-specified.** A rake-config edit today silently invalidates any printed card derived from `rakeConfig`. Mirror EAL's RT-108 snapshot pattern: `src/utils/printableRefresher/__tests__/contentDrift.test.js` — for each card manifest, recompute `contentHash` from `sourceUtils[].path` via dynamic import + stableStringify; compare to manifest snapshot; fail CI if mismatch without `schemaVersion` bump. Markdown-authored content (pure-plays codex) vs generated numbers: manifest is source of truth; render output is cache; conflict = CI failure. Without this, Voice 4 red line #12 (lineage-mandatory) is un-enforceable.

4. **State-clear-asymmetry (D8).** Per red line #6 (flat access), suppressed cards remain reachable. Precedent: EAL `selectActiveAnchors` vs `selectAllAnchors`. Author: `selectActiveCards` / `selectAllCards` / `selectPinnedCards` in `src/utils/printableRefresher/selectors.js`. R-8.1 (state-symmetry) applies — round-trip suppressed → visible without data loss.

5. **Writer registry (D2 sub-item).** Mirror EAL WRITERS.md: `docs/projects/printable-refresher/WRITERS.md` with W-URC-1/2/3 + CI-grep enforcement per `scripts/check-sidebar-writers.sh` pattern.

6. **Build-time vs runtime content (D3).** Hybrid: static charts at build (preflopCharts, equity-bucket tables, binomial, pure-plays); dynamic at runtime (geometric-betting, auto-profit, implied-odds — depend on user-adjustable rake/stakes/stack). Static cards get `contentHash`; dynamic cards get `paramFingerprint` — both flow into lineage footer.

### Recommended follow-ups

- [ ] **Gate 3 STATUS.md coordination:** PRF vs Shape Language IDB v18 claim resolution. Owner ratifies which ships as v18.
- [ ] **Gate 4 surface spec:** `docs/design/surfaces/printable-refresher.md` with `parentSurface: 'study-home (pending)'`.
- [ ] **Gate 4 writer registry:** `docs/projects/printable-refresher/WRITERS.md` with W-URC-1/2/3.
- [ ] **Gate 4 spec:** content-drift CI shape (`contentDrift.test.js` pattern, schemaVersion bump contract).
- [ ] **Gate 4 spec:** selector library contract (`selectActiveCards` / `selectAllCards` / `selectPinnedCards`).
- [ ] **Gate 5 migration:** IDB v17 → v18 (or v19) — additive-only.
- [ ] **Gate 5 test:** snapshot tests per card class (RT-108 pattern).
- [ ] **Gate 5 test:** Playwright print-to-PDF snapshot tests for MVP cards + B&W fallback + cross-browser matrix.
- [ ] **Backlog item:** `STUDY-HOME-SURFACE` cross-reference — PRF is a candidate authorship trigger if it ships before Shape Language.

---

## Stage E — Heuristic pre-check

**Output: ❌ as currently sketched (Voice 4 autonomy) → ⚠️ with mitigations enumerated below. Load-bearing risk vector: Voice 3 poker theory fidelity flags 3 RED cards, including 2 of the owner's own examples.**

### E.1 — Autonomy (Voice 4) — 8 new red lines + 11 anti-patterns + 5 copy-discipline rules

**Inherited: 9 red lines (SLS #1–#8 + EAL #9)** apply unchanged — Voice 4 checked each; 7 are AT-RISK with specific mitigations tied to new red lines #10–#17.

**New PRF-specific red lines (8, non-negotiable for Gate 4 charter §Acceptance Criteria):**

- **#10 — Printed-advice permanence requires in-app staleness surfacing.** `printedAt` stamp + engine-version snapshot + passive diff banner. No push notifications. Closes the permanence-vs-retirement gap novel to this feature.
- **#11 — Reference-mode write-silence at reducer boundary.** Refresher surfaces dispatch `currentIntent: 'Reference'`. Shared `skillAssessment/` reducer asserts at boundary that no posterior update / drill-completion signal / observation-capture write occurs under this intent. PRF is **the first surface to crystallize the three-intent contract from Shape Language Gate 3** — Gate 5 test coverage is mandatory.
- **#12 — Lineage-mandatory on every card.** 7-field footer (see Voice 4 spec). No anonymous content. Closes PRF-NEW-2 trust asymmetry.
- **#13 — Owner-suppression durable indefinitely.** Mirrors EAL anchor retirement. No "reconsider" nudges. Per-card + card-class level.
- **#14 — No completion / mastery / streak tracking on cards — even digital.** Refresher is reference, not drill. No view-counts surfaced, no days-streak, no cards-studied-today. Closes graded-work-in-reference trap.
- **#15 — No proactive print-output.** App never auto-generates "personalized pack tonight." Printing 100% owner-initiated. No card-of-the-day.
- **#16 — Cross-surface segregation bidirectional.** (a) Refresher-view activity never mutates live-advice state. (b) Live-play data never auto-tailors printable set without explicit opt-in (Phase 2 at earliest).
- **#17 — Intent-switch mandatory for drill-pairing.** If a future feature pairs a card with a drill, the pairing requires explicit Reference → Deliberate intent-switch. Copy: "Drill this card" (explicit), never "Review this card" (ambiguous).

**11 anti-patterns to refuse** (AP-PRF-1..11): card leaderboard, card-of-the-day auto-surface, print streak, mastery score, retired-cards-reconsider, graded-work framing, cross-surface contamination, engagement notifications, auto-personalized pack, watermark-engagement, card-view analytics.

**5 copy-discipline rules (CD-1..5):** factual not imperative; no self-evaluation framing; no engagement copy; labels as outputs never inputs; assumptions explicit.

### E.2 — Poker theory fidelity (Voice 3) — card-type audit (load-bearing)

17 content types audited. **7 GREEN, 5 YELLOW, 3 RED.**

**GREEN (7):** Preflop charts (conditional on stakes/rake/stack declared), auto-profit bluff thresholds, geometric bet-sizing, pot-odds → equity, implied-odds formula (hand-named examples disallowed), binomial survival, ICM push-fold, SPR zone reference (as structural consequence, not prescription).

**YELLOW (5, reformulation mandatory):** equity-bucket charts (range-level aggregation only; per-combo forbidden on laminate), hand-type × texture EV matrix (reformulated as equity-reference only — no bet/check column), bluff-catching checklist (pot-odds + bluff-to-value conditioning only; no villain labels), "exceptions" chart (population-baseline deviations with cited audit ids only, never per-villain), "fold to turn XR — underbluffed line" (survivable only with line/texture scoping + population baseline cite + override condition — otherwise becomes blanket always-fold = anti-pattern).

**RED (3) — REFUSED:**

1. **#12 — Per-villain-archetype deviation charts.** Labels collapse fold%/call-range-shape/sizing-tell into one dimension; card format can't carry decomposition. Replacement: on-screen calibration dashboard (never laminated) showing population-baseline-vs-observed calibration *mechanics*. Per-villain calibration stays in LiveAdviceBar / Calibration Dashboard per F6 (source-util whitelist excludes `villainDecisionModel`, `villainObservations`, `assumptionEngine`, `calibrationDashboard` from printable output).

2. **#13 — "56s in CO vs deep-stack fish 3-bet" decision card (owner's own example).** Labels-as-inputs + stack-depth-as-label. Can only be decomposed into three existing GREEN cards (implied-odds + SPR zone + fold-to-3bet auto-profit). At that point it's not one card, it's three — and the three already exist.

3. **#14 — "Don't bluff calling stations" card (owner's own example).** *Worse than refused — it's factually wrong.* Calling station has uncapped call-range (POKER_THEORY §5.5 + exploitEngine anti-pattern). Correct exploit: value-bet wider AND bigger. Replacement card: *"When observed `foldToBet(size)` < breakeven, bluffs at that sizing are -EV and value bets at that sizing gain from the same read."*

**Fidelity bar (6 requirements every card clears to print):**
1. No archetype-as-input.
2. Math visible (formula shown, not just threshold).
3. Scenario-declared (stakes / rake / effective stacks / position / SRP/3BP).
4. Source-trail footer (blacklists per-villain-calibrated modules).
5. Pure/Exception provenance unambiguous (never mixed on one card).
6. Prescriptions computed, not labelled.

### E.3 — In-app view heuristics (Voice 1) — 4 pre-sketch violations

- **H-N01 (visibility):** per-card staleness footer + batch-level informational banner. Amber tint for drifted cards.
- **H-N05 (error prevention):** Print button never adjacent to Delete/Reset. Print-confirmation modal captures user-entered print date.
- **H-N03 (freedom):** paper has no undo, but pre-print preview + PDF-download-first is the software-side safety net.
- **H-ML06 (touch targets):** filter/sort chips ≥98 CSS-px at scale 0.45 on 1600×720.
- **H-ML02 (scroll containers):** virtualized vertical list; separate preview vs select affordances.

### E.4 — Paper-artifact heuristics (Voice 1 + Voice 5) — consolidated set H-PM01..H-PM06

Consolidating Voice 1's H-PRF01-05 + Voice 5's H-PM01-06 → single ratified set at Gate 4:

- **H-PM01 — Paper-scan glanceability.** Headline readable ≤1.5s at arm's length (40cm) in dim poker-room light. Body ≥10pt sustained, 8pt floor for tables, 6pt banned. Validated by laminated-proof-sheet test.
- **H-PM02 — Color-blind adaptation.** Never red/green as only signal pair. 6-hue deuteranopia-safe palette (navy, burnt orange, ochre, teal, charcoal, maroon). One accent per card class.
- **H-PM03 — Ink-budget + B&W printability.** No full-bleed color fills. <5% ink coverage target for greyscale printers. Accent only on class badge / horizontal rule / line-art icons. Rules out color-only-encoded categories.
- **H-PM04 — Lamination-friendly.** 0.25" safe-trim margin inside card boundary. Critical content inside safe margin.
- **H-PM05 — One-idea-per-card (information atomicity).** **LOAD-BEARING UNRESOLVED.** "One idea" definition requires per-card owner ratification at Gate 5. Must justify atomicity in <25 words. Preflop open-range by position = one idea. All-preflop-math = too broad. UTG-opens-only = too narrow.
- **H-PM06 — No dynamic-rendering-assumption content.** Anything requiring animation / toggle / hover-to-reveal for legibility fails print. Design print-first.
- **H-PM07 — Invisible-staleness** (new failure mode specific to paper; Voice 1 H-PRF03). Once laminated, the card cannot tell you it's out of date. In-app view is the sole staleness channel. Physical version-stamp on card corner (`v1.0 · 2026-04-24`) cross-references in-app diff.
- **H-PM08 — Socially discreet laminate** (Voice 1 H-PRF05). Small cards, no large colored blocks, no company branding visible to villains. Carries the mid-hand-chris H-PLT04 rule onto paper.

### Recommended follow-ups — Stage E

- [ ] **Gate 4 charter §Acceptance Criteria:** replace placeholder with red lines #10–#17 enumerated + testable.
- [ ] **Gate 4 anti-pattern refusal list:** `docs/projects/printable-refresher/anti-patterns.md` (AP-PRF-1..11 + EAL-inherited AP-01..AP-09 as applicable).
- [ ] **Gate 4 copy-discipline doc:** `docs/projects/printable-refresher/copy-discipline.md` (CD-1..5 with ✓/✗ examples).
- [ ] **Gate 4 fidelity doctrine:** 6-point card-fidelity bar in charter §Working Principles (binding, not guideline).
- [ ] **Gate 4 source-util whitelist:** codified in lineage spec + content-drift CI; per-villain-calibrated modules blacklisted.
- [ ] **Gate 4 heuristic set:** `docs/design/heuristics/printable-artifact.md` with H-PM01–H-PM08 ratified (consolidating V1 H-PRF01-05 + V5 H-PM01-06 + 2 additional).
- [ ] **Gate 5 per-card fidelity review:** every authored card passes the 6-point bar + atomicity justification before printing. Postflop cards (highest anti-pattern risk) second-review by theory-fidelity equivalent.

---

## Overall verdict

**YELLOW.**

The feature is well-scoped on the engineering axis (small persistence footprint, clean inheritance of EAL/SLS patterns) but carries novel autonomy and fidelity constraints the 9 inherited red lines do not cover. All three risks have named, enumerable mitigations — no mitigation requires re-architecting. Gate 3 is **mandatory** (per LIFECYCLE.md YELLOW-Gate-2 rule) and scoped ~1-2 sessions.

### Top 3 structural risks

1. **Owner-doctrine reconciliation (Voice 3 RED flags).** The feature's fidelity bar refuses 2 of 3 RED cards that are the owner's own examples. Gate 3 owner interview is load-bearing: does owner accept the refusal + decomposed replacements, or insist on labelled phrasings? If the latter, the program-level owner-vs-doctrine conflict escalates beyond this feature. Probability owner accepts: moderate-high (the owner directs the doctrine via CLAUDE.md + feedback memories; the examples are plausibly mental-model-residue from pre-doctrine framing). Gate 3 interview surfaces it explicitly.

2. **Printed-advice permanence novelty.** Paper can't be recalled. Requires 4 new pieces of infrastructure (lineage pipeline + content-drift CI + staleness diff + print-date stamping) that don't exist today. Mitigated by Voice 4 red lines #10–#17 + Voice 5 D6/D7 engineering specs. Adds ~2-3 sessions to Gate 4 + Gate 5 scope.

3. **Content scope overshoots MVP.** 17 card types → 7 GREEN, 5 YELLOW (reformulation needed), 3 RED (refused). Phased rollout recommended:
    - **Phase A (Preflop Refresher):** cards #1, #10 pure-preflop, #16 ICM push-fold. Highest-leverage, lowest anti-pattern risk. Ship first. **Conditional on Gate 3 owner answer** to: does derivation-from-own-engine differentiate visibly vs Upswing's free pack? If NO, cut this phase and link to Upswing.
    - **Phase B (Math Tables):** cards #2, #3, #4, #5, #6, #17 (auto-profit, geometric, pot-odds, implied, binomial, SPR zones). Pure derivations, trivially correct, ship second. Market gap is clearest here.
    - **Phase C (Texture-Equity + Exceptions Codex):** cards #7, #8 (reformulated as equity-only), #11 (exceptions with §9 audit-id backing), #15 (fold-turn-XR with 3-way conditioning). Ship last, per-card fidelity review. Highest anti-pattern risk.
    - **Refused entirely:** cards #9 (bluff-catch), #12 (archetype-deviation), #13 (56s-vs-fish), #14 (don't-bluff-stations). Redirected to drill surface or on-screen Calibration Dashboard.

### Top 3 required Gate 4 items (non-negotiable)

1. **Charter §Acceptance Criteria expanded** — replace Gate 1 placeholder working-principles with 17 red lines (9 inherited + 8 new #10–#17) + 11 anti-patterns + 5 copy-discipline rules + 6-point fidelity bar. All testable.
2. **5 surface / doctrine specs:**
    - `surfaces/printable-refresher.md` (in-app view + print-preview route + filter/sort + stale banner)
    - `surfaces/printable-refresher-card-templates.md` (per-card-class layout templates)
    - `heuristics/printable-artifact.md` (H-PM01–H-PM08 consolidated)
    - `journeys/refresher-print-and-re-print.md` (first-print → stamp-date → engine-changes → in-app-diff → re-print prompt)
    - `projects/printable-refresher/copy-discipline.md` + `anti-patterns.md` + `WRITERS.md`
3. **Content-drift CI spec** (Voice 5 D7) — RT-108 pattern, schemaVersion-bump contract, markdown-vs-generated precedence rule. Must be authored before Gate 5 card authoring starts (drift-test-first, not drift-test-after).

### Top 3 required Gate 3 items

1. **Owner interview — 7 questions** (below). Doctrine reconciliation is the headline.
2. **Author 5 JTBDs** (PRF-NEW-1 refined + PRF-NEW-2 + PRF-NEW-3 + PRF-NEW-4 + PRF-NEW-5) in `docs/design/jtbd/domains/`. Location TBD at kickoff.
3. **Amend 3 personas** (mid-hand-chris + apprentice + rounder) + STATUS.md-level IDB v18 coordination with Shape Language.

### Gate 3 requirement

**MANDATORY** per LIFECYCLE.md YELLOW Gate 2 rule. Scoped ~1-2 sessions (~40-60% of EAL's Gate 3 scope).

---

## Owner interview questions (Gate 3 kickoff)

Seven questions. Each answer shapes Gate 4 surface specs.

1. **DOCTRINE RECONCILIATION (load-bearing).** The fidelity voice flagged 3 content types as RED, two of which are phrasings from your own request: (a) "56s is good to 3b IP vs deep-stack fish in CO" (labels-as-inputs + stack-depth-as-label), (b) "don't bluff a calling station" (factually wrong — calling station has uncapped call-range; correct exploit is value-bet wider AND bigger), (c) per-villain-archetype decision cards generally. Do you accept the refusal + decomposed replacements (three separate GREEN cards for #a; reformulated "observed foldToBet < breakeven" card for #b; on-screen-only calibration mechanics card for #c)? If NO, we need to discuss how the feature's fidelity doctrine reconciles with the phrasing you want — this may be bigger than this feature.

2. **SCOPE PHASING.** Three phases recommended (Preflop → Math Tables → Texture/Exceptions). Ship in this order with Phase A conditionally (cut if not differentiated vs Upswing)? Or a different sequence? Or all-at-once (we refuse)?

3. **VENUE POLICY REALITY.** Which casinos do you actually play? Do they permit laminated reference cards at the table? Your answer narrows PRF-NEW-1 scope. (Recommendation: design for between-hands / presession / post-session as primary; mid-hand as permitted-venue edge case.)

4. **PRINT FORMAT.** Default page size: US Letter (8.5×11) or A4? Default cards-per-sheet: 12 (~2.5"×2.25" each) or 6 (~3.75"×3.25" each, index-card-scale)? Answer depends on your printer + lamination-pouch sizes.

5. **TIER / PRICING.** Free lead-gen (like Jonathan Little's cash cheat sheet) or Plus-tier differentiator (like BBZ's $20/mo bundle)? Market permits either.

6. **IDB v18 COORDINATION.** PRF and Shape Language both claim v18. Which ships as v18 first? (Recommendation: whichever reaches migration-authoring first gets v18; second is v19. Coordinate via STATUS.md.)

7. **PERSONALIZATION DEFAULT.** Red line #16 says refresher content is NOT personalized from play data by default. Confirm: opt-in only in Phase 2+? Or is "your personalized pack tonight based on villain X" an acceptable near-term feature? (Recommendation: Phase 2+ with explicit opt-in — autonomy + reference-mode purity.)

---

## Required follow-ups

### Gate 3 (Research) — scope

- [ ] Owner interview on 7 questions above; answers recorded at `docs/projects/printable-refresher/gate3-owner-interview.md`.
- [ ] Author 5 JTBDs (PRF-NEW-1 refined / PRF-NEW-2 / PRF-NEW-3 / PRF-NEW-4 / PRF-NEW-5) in `docs/design/jtbd/domains/`.
- [ ] Amend `personas/situational/mid-hand-chris.md` with `paper_reference_permitted` attribute.
- [ ] Amend `personas/core/apprentice-student.md` with coach-curated pack bullets.
- [ ] Amend `personas/core/rounder.md` with carry-vetted-reference Goal.
- [ ] STATUS.md-level IDB v18 coordination decision (PRF vs Shape Language).
- [ ] Competitive-refusal register drafted (4 market-common content types PRF refuses to duplicate).
- [ ] Re-run Gate 2 against updated framework; verdict GREEN expected.

### Gate 4 (Design) — scope

- [ ] Charter §Acceptance Criteria expansion (17 red lines + 11 anti-patterns + 5 copy rules + 6-point fidelity bar).
- [ ] Surface spec `docs/design/surfaces/printable-refresher.md` (parent-TBD Study Home reference).
- [ ] Surface sub-spec per-card-class layout templates.
- [ ] Heuristic set `docs/design/heuristics/printable-artifact.md` (H-PM01-08).
- [ ] Journey doc `docs/design/journeys/refresher-print-and-re-print.md`.
- [ ] Copy-discipline doc `docs/projects/printable-refresher/copy-discipline.md`.
- [ ] Anti-pattern refusal list `docs/projects/printable-refresher/anti-patterns.md`.
- [ ] Writer registry `docs/projects/printable-refresher/WRITERS.md`.
- [ ] Content-drift CI spec (test shape + schemaVersion-bump contract + markdown-precedence rule).
- [ ] Selector-library contract (`selectActiveCards` / `selectAllCards` / `selectPinnedCards`).
- [ ] Print-CSS doctrine spec (page sizes, type scale, B&W palette, layout grid).
- [ ] Source-util whitelist / blacklist codified.
- [ ] Newcomer activation threshold decision.
- [ ] IDB v18/v19 migration spec (`userRefresherConfig` + `printBatches` stores).

### Gate 5 (Implementation) — constraints to propagate

- [ ] Content-drift CI test (RT-108 pattern) authored BEFORE card authoring starts.
- [ ] Per-card fidelity review (6-point bar + atomicity justification) before each card prints.
- [ ] Playwright print-to-PDF snapshot tests (MVP 15-20 cards + B&W fallback + cross-browser).
- [ ] Reducer-boundary test for `currentIntent: 'Reference'` write-silence (red line #11).
- [ ] Durable-suppression test (red line #13).
- [ ] In-app test assertions for red lines #10–#17.
- [ ] Staleness-diff test (print-time snapshot vs current engine output).
- [ ] Lineage footer rendering test (7 fields present, format correct).

---

## Backlog proposals

Copy-paste ready for `.claude/BACKLOG.md`:

```
- [P0] [PRF-G3-I] Owner interview — 7 questions (doctrine reconciliation load-bearing)
- [P0] [PRF-G3-J1] Author JTBD PRF-NEW-1: Carry-the-reference-offline (refined)
- [P0] [PRF-G3-J2] Author JTBD PRF-NEW-2: Trust-the-sheet
- [P0] [PRF-G3-J3] Author JTBD PRF-NEW-3: Know-my-sheet-is-stale
- [P0] [PRF-G3-J4] Author JTBD PRF-NEW-4: Pre-session visualization / kinesthetic memorization
- [P0] [PRF-G3-J5] Author JTBD PRF-NEW-5: Export the personal codex
- [P0] [PRF-G3-P1] Amend mid-hand-chris.md with paper_reference_permitted attribute
- [P0] [PRF-G3-P2] Amend apprentice-student.md with coach-curated pack bullets
- [P0] [PRF-G3-P3] Amend rounder.md with carry-vetted-reference Goal
- [P0] [PRF-G3-DB] STATUS.md IDB v18 coordination decision (PRF vs SLS)
- [P0] [PRF-G3-RR] Gate 2 re-run against updated framework
- [P0] [PRF-G4-ACP] Charter §Acceptance Criteria expansion (17 RLs + 11 APs + 5 CDs + 6-point fidelity bar)
- [P0] [PRF-G4-S1] surfaces/printable-refresher.md (parent-TBD)
- [P0] [PRF-G4-S2] surfaces/printable-refresher-card-templates.md
- [P0] [PRF-G4-H] heuristics/printable-artifact.md (H-PM01-08)
- [P0] [PRF-G4-J] journeys/refresher-print-and-re-print.md
- [P0] [PRF-G4-CD] copy-discipline.md
- [P0] [PRF-G4-AP] anti-patterns.md (AP-PRF-1..11)
- [P0] [PRF-G4-W] WRITERS.md (W-URC-1/2/3)
- [P0] [PRF-G4-CI] content-drift CI spec + source-util whitelist
- [P0] [PRF-G4-SL] selector-library contract
- [P0] [PRF-G4-CSS] print-CSS doctrine spec
- [P1] [PRF-G4-NC] newcomer activation threshold decision
- [P1] [PRF-G4-DB] IDB v18/v19 migration spec
- [P0] [PRF-G5-CI] Content-drift CI test (RT-108 pattern) authored BEFORE Phase A
- [P0] [PRF-G5-A] Phase A: Preflop Refresher (cards #1, #10, #16) — conditional on owner differentiation answer
- [P0] [PRF-G5-B] Phase B: Math Tables (cards #2, #3, #4, #5, #6, #17)
- [P1] [PRF-G5-C] Phase C: Texture-Equity + Exceptions Codex (cards #7, #8, #11, #15 reformulated)
- [P0] [PRF-G5-RL] In-app test assertions for red lines #10-#17
- [P0] [PRF-G5-PDF] Playwright print-to-PDF snapshot tests (MVP)
- [P0] [PRF-G5-RI] Reducer-boundary test for currentIntent: Reference (red line #11)
- [P0] [PRF-G5-DS] Durable-suppression test (red line #13)
- [P0] [PRF-G5-LG] Lineage footer rendering test (7 fields)
- [P1] [PRF-P2-PE] Phase 2: Personalization opt-in (deferred; Phase 2+ only)
- [P2] [PRF-P2-CX] Phase 2: Personal codex export (PRF-NEW-5 implementation)
- [P2] [STUDY-HOME] Author study-home.md if PRF is the triggering feature (cross-project)
```

---

## Change log

- 2026-04-24 — Draft. Gate 2 blind-spot audit for Printable Refresher (PRF). 5-voice roundtable synthesis (Product/UX, Market/competitive, Poker theory fidelity, Autonomy skeptic, Senior engineer + print-medium designer). Verdict YELLOW with 3 structural risks + 8 new autonomy red lines (#10–#17) + 11 anti-patterns + 5 copy rules + 6-point fidelity bar + 8 paper heuristics + 11 Gate 3 items + 14 Gate 4 items + 9 Gate 5 test items. Gate 3 mandatory per LIFECYCLE.md; scoped ~1-2 sessions. Load-bearing unresolved: owner-doctrine reconciliation on 3 RED content types (2 of which are owner's own original examples).
- 2026-04-24 — Post-owner-interview update: Q1 doctrine reconciliation **ACCEPTED** (closes the load-bearing Gate 3 risk). Q3 venue policy **ANSWERED** — primary venues Wind Creek / Homewood / Horseshoe Hammond / Rivers Des Plaines prohibit reference material mid-hand; permitted in off-hand windows only. **Consequence: Voice 1's original Stage A recommendation REVISED.** The `paper_reference_permitted` attribute on `mid-hand-chris` is WITHDRAWN. The new primary-use context is authored as a separate cross-persona situational persona `personas/situational/stepped-away-from-hand.md` covering four canonical contexts (stepped-away between hands, seat-waiting queue, tournament break, pre-session at venue). This is a cleaner framework extension than an attribute on an existing persona — the off-hand-at-venue window is a genuinely distinct situation with its own time budget, attention profile, and permitted-affordance set. See `docs/projects/printable-refresher/gate3-owner-interview.md` §Q3 for the detailed consequence chain. Stage A verdict signal unchanged (⚠️); Stage C stress-test now runs against `stepped-away-from-hand` primary instead of `mid-hand-chris`-with-attribute. No change to top-3 structural risks, overall YELLOW verdict, or required Gate 4 items — the persona re-routing is a Gate 3 clarification, not a verdict shift.
