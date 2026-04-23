# Blind-Spot Roundtable — 2026-04-23 — Played-Hand Review Protocol (HRP)

**Date:** 2026-04-23
**Project:** played-hand-review-protocol, Gate 2 (per LIFECYCLE.md)
**Facilitator:** Claude (main)
**Format:** Per `docs/design/ROUNDTABLES.md` — five stages, six custom mandate voices.
**Preceded by:** Gate 1 Entry audit 2026-04-23 (`2026-04-23-entry-played-hand-review-protocol.md`), verdict YELLOW.
**Scope at entry:** Narrow / bridge — tag-and-link played hands to upper-surface / LSW theoretical analogs, render linked ledger + drill card inline in the replay panel, surface already-computed depth-2/3 counterfactual tree, review queue on HandBrowser via flag filter. No new routed view, no new authoring surface.

---

## Feature summary

Played-Hand Review Protocol (HRP) closes the depth gap between the theoretical programs (Upper-Surface reasoning artifacts, LSW line-study) and the replay surface by making `HandReplayView` a **consumer** of the theoretical library. Three components: (1) flag mechanism on played hands with HandBrowser queue filter, (2) per-decision spot-key resolution to a canonical upper-surface or LSW node, (3) inline/overlay render of the linked ledger + drill card + depth-2/3 counterfactual tree. Sidebar untouched; Post-Session Chris + Apprentice + Coach-review-session are the primary personas; three JTBD gaps identified (SR-28, SR-29, SR-30), all extensions of the existing Session Review domain.

This roundtable stress-tests persona sufficiency, JTBD completeness, situational fit, cross-surface ripple, and heuristic conformance before Gate 4 specs are written.

---

## Custom voices

Six narrow-mandate voices chosen for HRP's specific blind-spot space.

| Voice | Mandate |
|---|---|
| **Review Pedagogue** | Post-hoc learning science — deliberate practice, retrieval practice, transfer from review to in-session improvement. What makes a review session actually produce learning? |
| **Skeptic** | When is cited theory misleading? When does hero mis-match their played spot to the wrong analog and learn the wrong lesson? Overfitting + false-precision risks |
| **Information Architect** | Cognitive density. ~60-row ledger inline vs. modal vs. side-panel. Progressive disclosure ladder. How much theory should hero see before asking for more? |
| **Systems Architect** | Spot-key fidelity invariant — how does a played decision's ~8-dimension context map to an upper-surface canonical ID? Match confidence, fallback state, corpus coverage statistics |
| **Pro Coach** | Behavior change. Does hero actually use deep-review surfaces, or is review theater? What shape does review have to be for in-session play to change next week? |
| **Evidence Realist** | Quality of the theoretical corpus HRP links to. Upper-surface is young; some artifacts are self-audited to YELLOW. Stale/wrong citation is more dangerous than no citation |

---

## Stage A — Persona sufficiency

**Question:** Who would plausibly use this feature who we have NOT modeled in `personas/`?

### Voices

**Pro Coach:** Post-Session Chris is the right primary. Apprentice is the secondary — they need more scaffolding (glossary, progressive disclosure) but the same surface serves them. Coach-review-session is real — coach + student on same screen, but that's a presentation mode, not a persona. No new persona needed so far.

**Review Pedagogue:** One use case that Post-Session Chris under-describes: the *repeat reviewer* who returns to the same hand across sessions (spaced retrieval — review Tuesday, review again Friday, review again two weeks later). That's not a new persona, but it's a navigation pattern HRP should accommodate: "hands I've reviewed before" as a filter, timestamp per review.

**Skeptic:** The Between-Hands "review the hand I just lost" case — Gate 1 flagged it as likely non-fit. I agree. The live cadence bans ledger depth; Between-Hands Chris has 60–180s and his attention is already fragmented (new hand starting, dealer pressure). If we force HRP into that window, we corrupt the surface for its primary post-session use. Exclude. Between-Hands review is a separate surface opportunity if ever pursued — not HRP.

**Information Architect:** Scholar (drills-only) — confirmed non-fit, no played hands to review. Worth noting: HRP may create a *reverse demand* — Scholar may want to consume HRP-flagged hands published by other users (like Chess.com's annotated-hand corpus). Out of scope for v1, but SR-27 (shareable replay link) is the adjacent JTBD.

**Evidence Realist:** I want to name an implicit persona: **the hero who reviews hands to *test* the app's theoretical library**. Hero finds a spot that has no upper-surface analog, or a spot where the linked analog contradicts solver output. That's not a standalone persona — it's Post-Session Chris in a particular mood — but it's a *loop-closer to the LSW authoring program*. HRP should expose "no analog" and "analog disputed" states in a way that routes the observation back into LSW/upper-surface queue.

**Pro Coach:** Agree with the loop-closer. That's not a new persona; it's a JTBD (Stage B) — "nominate a played spot for inclusion in the theoretical corpus."

**Systems Architect:** No new persona from my angle. My concerns are infrastructure, Stage B and Stage D.

### Output: ✅ Match

**No new personas required.**

**Clarifications documented:**
- **Repeat-reviewer navigation pattern** — Post-Session Chris sub-pattern: "hands I've reviewed before" filter on HandBrowser, "last reviewed" timestamp per hand. Gate 4 spec addition.
- **Between-Hands review explicitly excluded** from HRP scope. Live cadence incompatible with ledger depth. If a compressed review surface is ever needed, it is a *separate* surface, not a mode of HRP.
- **Coach-review-session is a presentation mode**, not a persona — informs shared-screen layout but no new persona file.

---

## Stage B — JTBD coverage

**Question:** What outcomes would users of this feature want that are NOT in our JTBD atlas?

### Voices

**Pro Coach:** The core new JTBD is "when I want to understand a spot I played, show me what theory says about it." That's SR-28 in Gate 1's proposal. Don't fragment further.

**Systems Architect:** SR-29 (spot-key resolution) is a *capability* JTBD, not an outcome JTBD. Hero doesn't "want to resolve a spot-key" — they want "see the theoretical analog, if one exists." Fold into SR-28. Keep SR-29 only if we need it as an engine-interface JTBD (API-user persona) — which we probably don't at v1.

**Information Architect:** Disagree partially. SR-29 has a distinct failure mode from SR-28: the "no analog exists" empty state. Post-Session Chris wants to know *why* there's no analog (is the library incomplete? is my spot unusual? should I propose it?). That empty-state UX is a meaningful outcome. Keep SR-29 but reframe: "Know whether a theoretical analog exists for the spot I'm reviewing, and what to do when it doesn't."

**Review Pedagogue:** SR-30 (counterfactual tree) is pedagogically essential. Retrieval practice research shows that seeing *why the action I didn't take was worse or better* is where transfer happens. Not optional — keep as its own JTBD because its success criterion is distinct: "I can articulate, after review, why the alternative action had different EV."

**Skeptic:** Three related JTBDs I want to add:
- **SR-31 — Flag a played hand for deep review later.** The consumer side of HE-17. Without a JTBD, the queue dimension disappears into SR-24 filter ambiguity.
- **SR-32 — Nominate a played hand for inclusion in the theoretical corpus.** The Evidence Realist loop-closer — when Post-Session Chris finds a spot with no analog (or a disputed analog), hero can submit it to the LSW/upper-surface authoring queue. Even v1 surface can be "copy the spot-key and known-variables to clipboard" with instructions.
- **SR-33 — Dispute a cited claim against a played hand's evidence.** When a ledger row says "villain folds 60%" and hero's actual evidence in this specific hand shows otherwise, hero can flag the specific claim. This becomes signal for upper-surface calibration.

**Evidence Realist:** I support SR-32 and SR-33. They're the loop-closers that turn HRP from a read-only consumer into a two-way feedback system with the LSW program. Without them, HRP is theater — hero finds errors and has no way to route them.

**Information Architect:** Counter — SR-32 and SR-33 may be scope creep for v1. The narrow scope explicitly says "consumer, not producer." These JTBDs are fine to *acknowledge* but should be Proposed, not Active, with a note that v1 defers them.

**Pro Coach:** Compromise. Include SR-32 and SR-33 as Proposed to mark the shape of the loop. Don't build them in v1. But write them so Gate 4 knows the shape not to foreclose (e.g., the spot-key representation should be machine-readable so SR-32 is authorable later without re-plumbing).

**Systems Architect:** Agreed. Designing for SR-32/SR-33 eventual-authoring means the spot-key surfacing in SR-28 must be unambiguous (not hidden under display-only text). Small Gate 4 rule.

**Review Pedagogue:** One more. Between-sessions review pattern I mentioned in Stage A: **SR-34 — Re-review a previously reviewed hand (spaced retrieval).** Hero has reviewed a hand once; wants to come back a week later and re-test themselves without pre-reading their old notes. Distinct from SR-23 (worst-EV) because the surfacing signal is "last reviewed N days ago, due for re-review" not "worst EV." Propose as Proposed.

### Output: ⚠️ Expansion needed — 3 Active + 3 Proposed new JTBDs

**Revised JTBD list:**

| ID | Title | State | Notes |
|---|---|---|---|
| SR-28 | Deep-review a flagged hand against upper-surface theoretical ground-truth | **Active** | Core protocol JTBD. Success = hero can articulate theoretical reasoning for each decision after review |
| SR-29 | Know whether a theoretical analog exists for the spot being reviewed, and see what to do when it does not | **Active** | Includes empty-state UX: "no analog" → propose it, or accept gap |
| SR-30 | See the counterfactual EV tree for a past decision, with runout-class breakdown | **Active** | Surfaces depth-2/3 already computed in `gameTreeEvaluator.js` but currently discarded |
| SR-31 | Flag a played hand for deep review and find it again in the queue | **Active** | Consumer side of HE-17. HandBrowser flag filter + flag indicator |
| SR-32 | Nominate a played hand for inclusion in the theoretical corpus (no-analog or disputed-analog loop-closer) | Proposed | v1 deferred; Gate 4 spot-key representation must not foreclose |
| SR-33 | Dispute a cited claim against a played hand's evidence | Proposed | Calibration loop-closer; overlaps SR-26 but at claim granularity not decision granularity |
| SR-34 | Re-review a previously reviewed hand on a spaced-retrieval schedule | Proposed | "Last reviewed N days ago" signal; distinct surfacing from SR-23 |

**Coordination points:**
- **MH-12 / MH-13** (exploit-deviation project, Proposed) — SR-28's ledger-render component is near-identical to MH-12's live citation card at post-session cadence. **Shared assumption-card component** is the biggest infrastructure reuse opportunity. Gate 4 should cite MH-12 spec when it lands.
- **SR-26** (flag disagreement + reasoning) — remains Proposed. SR-33 is a finer-grained variant (claim-level). Both can co-exist.
- **SR-88** (similar-spot search) — Proposed. SR-29's resolution engine is the single-target form; SR-88 is the N-target form. Shared spot-key infrastructure.
- **DS-45** (custom drill from own hand history) — Proposed. Shares spot-key infrastructure with SR-29. If DS-45 ever ships, it consumes HRP's spot-key output.
- **HE-17** (flag hand mid-recording) — Active. Need to verify the flag field is actually persisted today, or only atlas-listed. Gate 4 spot-check.

### Output verdict: ⚠️ Expansion needed

---

## Stage C — Situational stress test

**Question:** Does this feature survive the situations our users are in?

### Voices

**Review Pedagogue:** Post-Session Chris, 15 minutes on 3 flagged hands. ~5 min/hand. Reasonable for SR-28 depth: skim ledger summary, drill into 1–2 contested claims, see counterfactual for the one decision that mattered most. Works if the surface offers progressive disclosure — don't force hero to expand every ledger row.

**Information Architect:** 60-row ledger inline in ReviewPanel is catastrophic. ReviewPanel is already dense at current baseline (action card + EV badge + segmentation + HeroCoachingCard + VillainAnalysisSection at 386 LOC). Adding 60 more rows breaks the surface. **Modal overlay is the answer.** Tap ledger-link icon on a decision → fullscreen modal with sections (claims summary / full ledger / drill card / counterfactual tree). Dismiss returns to replay at same cursor.

**Skeptic:** Apprentice situation. Hero new to the app, reviews their first hand, opens ledger, sees "MDF = 55%, auto-profit threshold = 67%, realization-factor OOP wet = 0.70." Jargon wall. **Inline glossary mandatory** — every bolded technical term is tap-to-define. Without that, ledger is unreadable for the exact persona it was designed to help.

**Pro Coach:** Coach-review-session. Coach + student at cafe table, one phone landscape, 1600×720. Both looking at screen. Ledger modal has to be readable at that viewing distance — font minimum + contrast requirement. Coach wants to point at specific claims ("here, this is the thing I want you to notice"). Need a shareable-pointer or anchor-link so coach can say "tap claim #4" and both see it highlighted. Light Gate 4 concern.

**Review Pedagogue:** Spaced-retrieval case (SR-34). Hero reviews hand Tuesday, comes back Friday. On Friday open: hero's prior review notes should be *hidden by default* so hero re-tests themselves. Reveal-on-tap. This is deliberate-practice doctrine. Gate 4 rule.

**Systems Architect:** Stress on SR-29 — spot-key resolution. Hero replays a hand from tournament with 42bb effective, BTN vs BB 3BP IP on wet T96 flop. Upper-surface artifact exists for `btn-vs-bb-3bp-ip-wet-t96-flop_root` but it was authored for cash, 90bb effective. Strict match says "no analog." Fuzzy match says "partial — stack depth differs." Hero needs confidence indication. **Match confidence must be visible** on the link — "Strong match" / "Partial match — stack depth differs" / "No analog." Wrong confidence worse than no link.

**Evidence Realist:** Adjacent stress. Hero reviews spot where upper-surface artifact exists but is self-audited YELLOW (e.g., the btn-vs-bb-3bp-ip-wet-t96 artifact is known to have ledger quality questions). HRP must **surface the artifact's own confidence state** — "linked artifact is in YELLOW audit state, last reviewed 2026-04-XX" — so hero treats the citation as provisional. Without that, hero inherits the YELLOW uncertainty as GREEN confidence.

**Information Architect:** Offline scenario. Hero on subway reviewing last night's session. Theoretical corpus is in-repo markdown — is it offline-available? Confirmed yes (it's shipped with the PWA precache, assuming artifacts are in the bundle). But if LSW/upper-surface ship artifacts in a separate JSON or MD that's NOT precached, HRP breaks offline. Gate 4 must verify precache includes the corpus.

**Skeptic:** Between-Hands excluded per Stage A — reaffirmed. Study Block doing general fluency — non-fit. HRP is unambiguously a post-session surface.

**Pro Coach:** Flag gesture. HE-17 says flag-at-recording time. Where does the gesture live? Showdown view? In-hand on TableView? Long-press on a timeline action? Gate 4 must spec. For HRP consumer side (SR-31), need to verify HE-17 is actually implemented; if atlas-listed-only, consumer is blocked.

### Output: ⚠️ Adjust — 7 specific situation-driven design rules

**Design rules for Gate 4:**

1. **Ledger render = modal overlay**, NOT inline. Tap link-icon on decision-point card → fullscreen modal with tabs (summary / claims ledger / counterfactual / drill card). Dismiss returns to replay at same cursor.

2. **Progressive disclosure ladder** inside the modal: summary tab → claims ledger tab (collapsed rows; expand on tap) → counterfactual tree tab (depth-1 default; reveal depth-2 on tap) → drill card tab (one-page distillation).

3. **Inline glossary** — every bolded technical term in ledger rows is tap-to-define. Definitions sourced from `POKER_THEORY.md` / `BUCKET_DEFINITIONS`.

4. **Match confidence visible on every link** — Strong / Partial (with reason) / None (with empty-state CTA). Empty state offers "This spot has no theoretical analog" with optional "Nominate for authoring" CTA (SR-32, Proposed; v1 is read-only "copy spot-key to clipboard").

5. **Linked artifact's audit-state visible** — show the artifact's own GREEN/YELLOW/RED + last-reviewed date at modal header. Propagate confidence.

6. **Spaced-retrieval hide-own-notes on re-review** — if SR-34 enters scope, hero's prior review notes are hidden by default with reveal-on-tap. Out of v1 scope but architected-for.

7. **Offline precaching** — Gate 4 must verify upper-surface + LSW artifacts are in the PWA precache manifest. Post-session review happens on the subway.

---

## Stage D — Cross-product / cross-surface

**Question:** Does this feature have ripples beyond its immediate surface?

### Voices

**Systems Architect:** Surfaces touched directly:
- `HandReplayView/ReviewPanel.jsx` — new link-icon per decision point + modal entry
- `HandReplayView/HeroCoachingCard.jsx` — may reference ledger in "why this action" copy
- `AnalysisView/HandBrowser.jsx` — flag filter + flag indicator + last-reviewed timestamp column
- **Schema** — new `hand.flags: string[]` field (types: 'review', 'disagree', 'coach'), new `hand.reviewState: { lastReviewedAt, reviewCount, nominatedForCorpus }` object. IDB version bump likely.

**Pro Coach:** HE-17 producer-side entry point. Flag gesture during recording. Candidates: ShowdownView "flag for review" button, TableView long-press on timeline action, post-hand toast "Review this hand?" Gate 4 spec.

**Information Architect:** ShowdownView is the natural host for HE-17 producer — it's the record-committing surface. Add "Flag for review" checkbox/button there. Avoid TableView intrusion (live-cadence surface).

**Evidence Realist:** Data flow into LSW/upper-surface authoring queue. If SR-32/SR-33 activate later, HRP becomes a source for the theoretical library's backlog. For v1 (Proposed state) just ensure the spot-key format is machine-readable — clipboard copy is fine.

**Skeptic:** **Sidebar — untouched** per narrow scope. Reaffirm. Live cadence bans ledger depth. But: exploit-deviation's MH-12 live-citation card is the sidebar-side cousin. If both projects ship, hero sees citations live (compressed) and in HRP (deep). That's coherent. No sidebar change required for HRP.

**Pro Coach:** StatsView ripple — "hands flagged for review" aggregate count could live there. Minor nice-to-have. Defer or acknowledge.

**Review Pedagogue:** SessionsView ripple — a session's hand list could show flag indicators and "review this session's flagged hands" CTA. Small ripple. Likely Gate 4 acknowledgment only.

**Systems Architect:** Shared infra with exploit-deviation's MH-12:
- **Assumption-card component** — if MH-12 builds an `AssumptionCard` React component for sidebar citation, HRP's ledger-row render can reuse it (same data model with expanded-detail mode).
- **Spot-key resolution engine** — HRP's SR-29 is the post-session version; exploit-deviation's live-citation does a similar "which assumption applies here" lookup live. Different cadence, same shape. Gate 4 should consider a shared `spotResolver` module.

**Information Architect:** Navigation path. HRP's ledger modal provides a link out to the full upper-surface artifact file (markdown). Does that leave the app? Two options: (a) render the artifact inline inside a larger modal ("read full artifact"), (b) external link out to the file on disk (useless in PWA). **Option (a)** — artifact markdown rendered inside the modal. Gate 4 rule.

**Evidence Realist:** Version concern. Upper-surface artifacts live in `docs/upper-surface/reasoning-artifacts/`. They evolve (audit passes bump them YELLOW → GREEN). HRP renders snapshots of current state. What happens if the linked artifact is rewritten while hero is mid-review? Probably nothing (cached in-page) but refreshing re-renders updated content. Flag as Gate 4 consideration.

### Output: ⚠️ Partner surfaces need updates

**Partner surface list:**
- **`HandReplayView/ReviewPanel.jsx`** — ledger-link icon + modal launcher (primary).
- **`HandReplayView/HeroCoachingCard.jsx`** — may reference ledger-link ("see full reasoning →").
- **`AnalysisView/HandBrowser.jsx`** — flag filter, flag indicator, last-reviewed column.
- **`ShowdownView`** — HE-17 producer entry point ("Flag for review" button).
- **Schema (IDB)** — `hand.flags[]`, `hand.reviewState`; version bump.
- **SessionsView** — (deferred) per-session flagged-hand indicators, "review flagged" CTA.
- **StatsView** — (deferred) aggregate flagged-hand count.

**Shared-infra opportunities:**
- `AssumptionCard` component (coordinate with exploit-deviation MH-12 spec).
- `spotResolver` module (post-session + live-cited share a resolution shape).

**Sidebar:** untouched by HRP. Confirmed.

**Scope adjustments:**
- SessionsView + StatsView ripples **deferred** to post-v1. Flag on known-enhancements list.
- SR-32 + SR-33 + SR-34 **deferred** to Proposed, non-blocking Gate 4.
- Offline verification (Stage C rule 7) must happen in Gate 4.

---

## Stage E — Heuristic pre-check

**Question:** Against Nielsen 10 + Poker-Live-Table + Mobile-Landscape, does the proposed design obviously violate anything?

### Voices

**Information Architect:** H-N01 visibility of system status — match-confidence indicator on every link is already flagged Stage C. Also: while modal is open, replay cursor should stay visible (header bar with current decision context) so hero doesn't lose place. Gate 4 rule.

**Skeptic:** H-N05 error prevention. Two risks. (a) Hero mis-matches their spot to a wrong analog because match-confidence is mis-communicated. Mitigation: confidence indicator with explanation tooltip ("differs on stack depth"). (b) Hero disputes a claim via SR-33 without understanding it — clicking "dispute" should open a confirm dialog with claim detail, not fire optimistically. SR-33 is Proposed so this is future-Gate 4.

**Review Pedagogue:** H-N03 undo. Flag gesture must be undoable. Toast + undo pattern matches existing destructive-action-undo vocabulary (DCOMP wave 1). Un-flag should not destroy associated notes silently.

**Pro Coach:** H-N10 help/documentation. Inline glossary already flagged Stage C. Extend: first-time hero opening the ledger modal should see a one-time tooltip or banner — "This is the theoretical analysis for this spot. Tap any bolded term for a definition. Tap a claim for its evidence." Dismiss-forever after first interaction.

**Evidence Realist:** H-N08 aesthetic and minimalist design. 60-row ledger IS the opposite of minimalist. Modal-with-progressive-disclosure mitigates but the density is intrinsic to the feature. Accept the density; manage via disclosure ladder (Stage C rule 2).

**Systems Architect:** H-ML06 touch target ≥ 44 DOM-px. Ledger-link icon on each decision point card — must be ≥44×44 at 1600×720 scale (or reachable without overlap). Flag-toggle icon on HandBrowser hand card — same rule. Gate 4 spec.

**Information Architect:** H-PLT07 state-aware primary action. In replay mode: primary = "next decision" / "next step." With modal open: primary = "dismiss modal." With empty-state no-analog: primary = "acknowledge" (or "nominate" if SR-32 active). State-aware routing clean, no violations.

**Skeptic:** H-PLT06 misclick absorption. Flag toggle on HandBrowser — needs dead-zones to avoid accidental flag-toggle while scrolling. And ledger-link icon next to a step-forward button needs dead-zone.

**Review Pedagogue:** H-N06 recognition over recall. Spaced-retrieval re-review pattern (SR-34) — when hero returns to a previously reviewed hand, surface "you reviewed this N days ago" with option to see / hide prior notes. Hero doesn't have to remember they reviewed it; app reminds. Proposed scope, but design rule affects Gate 4 data model.

**Pro Coach:** One more. H-N07 flexibility and efficiency — power-user shortcut to open ledger modal without clicking the link icon. Keyboard binding (e.g., `L` key when a decision is focused) matches the existing replay keyboard vocabulary (arrow, Home, End, Escape). Small-cost add.

### Output: ⚠️ Specific adjustments needed

**Design rules for Gate 4:**

1. **Match-confidence indicator** on every link (Strong / Partial + reason / None).
2. **Modal header keeps replay cursor context visible** so hero doesn't lose place.
3. **Flag toggle undo** via toast (matches DCOMP wave-1 undo vocabulary).
4. **First-open ledger tutorial** — one-time tooltip or banner, dismiss-forever.
5. **Touch targets ≥44 DOM-px** for flag icon, ledger-link icon, claim-expand triggers.
6. **Misclick dead-zones** around flag toggle and ledger-link icon.
7. **Keyboard shortcut** to open ledger modal on focused decision (L key suggested).
8. **Spaced-retrieval reminder** for re-reviews — data-model ready in Gate 4 even if UX lands in SR-34 activation.

---

## Overall verdict: YELLOW

**Rationale:**

- Stage A: ✅ No new personas required. Two clarifications (repeat-reviewer pattern, Between-Hands explicit exclusion).
- Stage B: ⚠️ 3 Active + 3 Proposed new JTBDs (SR-28..34). All session-review domain extensions — no new domain.
- Stage C: ⚠️ 7 situation-driven design rules (modal render, progressive disclosure, glossary, match confidence, audit-state propagation, spaced retrieval, offline precache).
- Stage D: ⚠️ 5 direct + 2 deferred partner surfaces; schema bump; 2 shared-infra opportunities with exploit-deviation MH-12.
- Stage E: ⚠️ 8 heuristic-driven design rules.

**Feature's core architecture survives all five stages.** Adjustments are specific and mostly accretive (glossary, tutorial, confidence indicator, undo toast). Modal-over-inline is the one material design shift from Gate 1's open question. Spot-key resolution (SR-29) remains the non-trivial technical invariant — Gate 4 engine-feasibility spike (HRP-SPOT-KEY) is load-bearing.

Comparable to exploit-deviation's Gate 2 YELLOW, not the more severe RED. HRP is genuinely a bridge / consumer project — most of the heavy lifting already exists; HRP threads it through.

---

## Required follow-ups

### Gate 3 (Research + authoring) — authored this session

- [x] JTBD domain extensions: `docs/design/jtbd/domains/session-review.md` — SR-28 + SR-29 + SR-30 + SR-31 added as Active; SR-32 + SR-33 + SR-34 added as Proposed. Authored this session.
- [x] Atlas update: `docs/design/jtbd/ATLAS.md` — SR-28..34 registered under Session Review domain. Authored this session.
- [ ] No new personas required (per Stage A ✅).

### Gate 4 (Surface specs) — pending (next phase)

- [ ] Update `docs/design/surfaces/hand-replay-view.md` — HRP augmentations: ledger-link per decision, modal overlay architecture, match-confidence indicator.
- [ ] Update `docs/design/surfaces/analysis-view.md` — HandBrowser flag filter, flag indicator, last-reviewed column.
- [ ] Update `docs/design/surfaces/showdown-view.md` — HE-17 producer entry point (flag-for-review button).
- [ ] New component spec (or reuse MH-12 `AssumptionCard`) for ledger-row render.
- [ ] New modal spec: `surfaces/hand-review-modal.md` — tabs (summary / claims ledger / counterfactual / drill card / artifact), progressive disclosure rules, touch-target rules, first-open tutorial.
- [ ] Schema spec: `hand.flags[]`, `hand.reviewState` object, IDB version bump plan.

### Gate 4 prerequisites — engineering feasibility

- [ ] **HRP-SPOT-KEY** engine-module spike — canonical spot-key extraction from played decision, matching against upper-surface + LSW corpus, match-confidence scoring. **Load-bearing; authorable pre-Gate-4.**
- [ ] HE-17 implementation status audit — verify whether the flag field exists in the hand schema today or is atlas-listed only.
- [ ] Offline corpus verification — confirm upper-surface + LSW artifacts ship in PWA precache.

### Known limitations — documented

- **v1 read-only consumer.** SR-32 (nominate for corpus) + SR-33 (dispute claim) + SR-34 (spaced-retrieval) are Proposed; architected-for, not built.
- **Between-Hands review excluded.** Live cadence incompatible with HRP depth. Separate surface if ever needed.
- **Sidebar untouched.** Live-citation is exploit-deviation's surface (MH-12 / MH-13); HRP is post-session only.
- **Tournament context** — HRP works for tournament hands if theoretical analogs exist (they largely don't today — LSW is cash-focused). Spot-key resolution returns "no analog" for most tournament spots. Acceptable for v1.
- **Coordination with exploit-deviation Phase 7+** — AssumptionCard component + spot-key resolver are shared-infra opportunities. Not blockers.

### Gate 2 re-run — not required

Per LIFECYCLE.md, YELLOW output triggers Gate 3 but does NOT require Gate 2 re-run. Gate 3 authored this session; proceeding to Gate 4 specs after engineering-feasibility spike (HRP-SPOT-KEY) lands.

---

## Sign-off

**Facilitator:** Claude (main), 2026-04-23.
**Verdict:** YELLOW.
**Gate 3 deliverables:** authored same session (SR-28..34 in session-review.md, ATLAS.md updated).
**Next phase:** Gate 4 engineering-feasibility spike (HRP-SPOT-KEY) then surface specs.
**Owner review:** pending.

---

## Change log

- 2026-04-23 — Created. Six custom voices × five stages. YELLOW verdict. Gate 3 JTBD authoring same session.
