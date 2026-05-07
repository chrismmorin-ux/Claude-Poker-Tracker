# Gate 1 Entry — 2026-05-06 — SelfCoachView surface

**Surface working name:** SelfCoachView
**Proposed by:** SCF Master Plan §D Phase 5; surface spec authored at SCF Gate 4 (2026-05-02 / SPR-020 / WS-012); implementation scope claimed by WS-159 / SPR-042 (2026-05-06).
**Gate:** 1 (Entry) — surface-specific. Re-runs Gate 1 narrowly because this is the introduction of a new fullscreen route (`SCREEN.SELF_COACH`) that did not exist when the program-level Gate 1 ran.
**Next gate:** 4 (Design) — surface spec already exists at `docs/design/surfaces/self-coach-view.md`. This Gate 1 verdict drives whether Gate 2 (Blind-Spot Roundtable) is required before Gate 4 is updated for today's narrowed implementation slice.
**Status:** OPEN — this document is the Gate 1 artifact. No production code written yet.

---

## Why this audit exists

The SCF program completed Gates 1–4 across 2026-05-02 (SPR-012 through SPR-020) before today's work, then shipped infrastructure across SPR-030..033, 037, 040. The surface artifact at `docs/design/surfaces/self-coach-view.md` was authored at program-level Gate 4 in May 2; that artifact is mostly current but predates two relevant developments:

1. **Signal-tuning state landed at SPR-033 / WS-148** — `settings.selfCoach.signalToggles` (4 booleans) + `settings.selfCoach.signalWeights` (4 floats) state shape + reducer action types were authored after the surface spec. The spec's Settings tab shows only a tier-set radio + cadence reminder; it does not surface the signal-tuning controls that today's WS-159 implementation must wire.
2. **Curriculum section IA was abstract in the original spec** — line 64–70 of the spec shows a flat list (`• Cbet defense fundamentals [Open][Test]`). The registry that the surface consumes (`tierConceptMap.js`) ships 47 concepts in a 3-kind shape (general-skill / umbrella / sub-concept). The flat-list rendering fights the registry's umbrella → child structure. Today's founder decision (2026-05-06) chose tree IA (umbrella → expand → children) — which honors the registry but is a real IA shift.

These two changes plus today's decision to ship a narrowed Phase-5a slice (Curriculum + Settings only, deferring Hero-leaks + Tests-history sections to follow-up tickets) are enough to warrant an explicit surface-specific Gate 1.

---

## Surface summary (as proposed for WS-159)

A new fullscreen route at `SCREEN.SELF_COACH` with a 2-tab IA (Curriculum / Settings). The Curriculum tab renders a tier-grouped concept tree with inline expand-on-click composition inspector for each concept's composite score. The Settings tab hosts the owner-tier radio + 4 signal toggles + 4 discrete-step weight sliders. The view consumes existing infrastructure (`tierConceptMap` / `conceptMastery` / `composite` / `learningStateDescriber` / `lessonRegistry`) and dispatches existing reducer actions (`SET_SELF_COACH_SIGNAL_TOGGLE` / `SET_SELF_COACH_SIGNAL_WEIGHT` / `SET_SELF_COACH_OWNER_TIER`).

**Out-of-scope for this surface today (deferred to follow-up tickets):**
- Hero-leaks aggregation section (per Gate 4 spec line 47–58 — defer; HeroCoachingCard already shows the same data inline in HandReplay).
- Tests-history-and-browse section (per Gate 4 spec line 72–76 — defer; `lessonRegistry.test_substrate` field today is `pending` for all lessons).
- Cadence-reminder controls (per Gate 4 spec line 100–103 — defer; not load-bearing for the curriculum-browse JTBD).

---

## Output 1 — Scope classification

**Primary classification:** New fullscreen routed view — `SCREEN.SELF_COACH`. This is the first SCF user surface; HeroCoachingCard inline annotations in HandReplay are the only existing user-facing SCF touchpoints.

**LIFECYCLE Gate-2 triggers (per `docs/design/LIFECYCLE.md`):**
- New fullscreen surface — YES
- New interaction pattern — partially (composition inspector inline-expand is a re-use of `HeroCoachingCard` CD-5 pattern, not new)
- Cross-product-line crossing — NO (SCF only)
- Underserved persona target — NO (post-session-chris is well-served already)

**Verdict on Gate 2 requirement:** Gate 2 is **NOT required** for this surface. Reasoning: program-level Gate 2 ran 2026-05-02 (`docs/design/audits/2026-05-02-blindspot-self-coach-foundation.md`). The surface IA decisions made today are derivative refinements (tree vs flat list within Curriculum; signal-tuning controls in Settings) — they do not introduce new persona-blindspot risk because the persona model + autonomy red lines + grading-stance + descriptor-not-rank doctrine are all already bound by completed gates and bound memories. The composition inspector is a re-use, not an invention.

If owner disagrees: re-run Gate 2 against `docs/design/ROUNDTABLES.md` SCF blind-spot template before authoring the Gate 4 spec update.

---

## Output 2 — Personas served (re-confirmed at surface scope)

**In-scope:**
- [post-session-chris](../personas/situational/post-session-chris.md) — primary; 5–30 min review block; the Curriculum browse JTBD is canonical for this persona.
- [chris-live-player](../personas/core/chris-live-player.md) — primary identity (single-user app); SCF self-coach mode.
- [study-block](../personas/situational/study-block.md) — secondary; dedicated study time; uses Curriculum as a starting point before drilling.

**Out-of-scope (explicitly excluded per `chris-live-player.md` autonomy red line #8 and Gate 4 spec line 36):**
- [mid-hand-chris](../personas/situational/mid-hand-chris.md) — live play; SCF surface MUST NOT contaminate live-table flow.
- [between-hands-chris](../personas/situational/between-hands-chris.md) — 10-second windows are too tight to browse curriculum.

**Persona sufficiency check:** all 3 in-scope personas are validated and have rich JTBD coverage. No new persona needed.

---

## Output 3 — JTBD identified

The surface serves a **subset** of the JTBDs the Gate 4 spec identified for the full SelfCoachView vision. Phase-5a slice serves:

**Primary (canonical for today's slice):**
- **CO-55** — *learn-next-concept-im-ready-for* — Curriculum tab is the canonical surface; tree IA + descriptor header + `pickNextTeachableConcept` recommendation badge directly serve this JTBD.

**Primary (re-claimed by Settings tab additions):**
- **CO-NEW1 (Phase-5a addition)** — *tune-which-signals-feed-my-self-coach* — owner can disable signals or reweight them when an over-loud signal class is dominating the next-teachable picker. This JTBD is supported by infrastructure (`composite.js` + reducer) but had no consumer surface; today's Settings tab exposes it.

**Secondary (partially served):**
- **CO-54** — *see-leak-without-being-graded* — partially served indirectly: leak signals contribute to the composite, and the inspector shows their contribution honestly (no graded copy, observed-rate-only). Full Hero-leaks aggregation surface deferred.
- **CO-NEW2 (Phase-5a addition)** — *inspect-why-this-concept-is-recommended* — composition inspector serves the CD-5 transparency requirement: a tap on a composite score reveals which signals contributed at what weights with what sample basis. Honors `feedback_scf_learning_state_not_tier_rank.md` "click-to-inspect composition."

**Deferred (Phase-5b+):**
- CO-56 — *validate-im-improving* — requires Hero-leaks trend display; deferred.
- CO-57 — *self-rate-confidence-on-a-line* — requires confidence-elicitation infra not yet built.
- *Tests history* — requires `test_substrate` to be authored; today all lessons have `test_substrate: pending`.

---

## Output 4 — Gap analysis

### What infrastructure is ready (the easy part)

- **`tierConceptMap.js`** — 47 concepts; `getAllConceptIds()`, `getChildrenOf(id)`, `getParentOf(id)`, `listConceptsForTier(t)`, kind/tier metadata via `CONCEPT_REGISTRY`. ✓
- **`conceptMastery.js`** — `listAllConceptMastery(userId)` returns all 47 concept signal vectors (leak / drill / test / recencyPenalty + meta). ✓ Whitelisted for SelfCoachView consumption.
- **`composite.js`** — `computeComposites(masteries, {weights, toggles})` returns scored array; `pickNextTeachableConcept(userId, options)` returns the recommendation. ✓
- **`learningStateDescriber.js`** — `describeLearningState(masteries, {granularity, weights, toggles})` returns `{summary, focusConcepts, composition}`. ✓ `composition` is the load-bearing CD-5 inspector data.
- **`lessonRegistry.js`** — `getLesson(conceptId)` + `listLessonsForCurriculum()`. ✓
- **Settings reducer** — 3 action types wired + tested at `src/reducers/settingsReducer.js:155-209`. ✓ No reducer changes today.
- **CI lint patterns** — copy-discipline test pattern shipped at `src/components/views/HandReplayView/__tests__/HeroCoachingCard.leak.test.jsx:141-167`; mirrors directly. ✓
- **Inline-expand inspector pattern** — `HeroCoachingCard.jsx:129-213` ships the canonical CD-5 4-field inline-expand structure. ✓

### What is missing (the work)

- **Route + shell** — SCREEN constant, lazy-load registration, ViewRouter case, sidebar nav entry, view shell with TabBar.
- **Curriculum tab content** — tree-IA renderer, ConceptRow, CompositionInspector wiring, useSelfCoachMastery data hook.
- **Settings tab content** — owner-tier radio (7 options including null), 4-signal toggle group, 4 discrete-step weight sliders.
- **Empty-lesson rendering** — greyed muted style + "Lesson coming" tag for ~30 concepts whose lessons aren't authored yet.
- **Forbidden-rank-label CI lint** — adapted from `HeroCoachingCard.leak.test.jsx`; uses `FORBIDDEN_RANK_LABELS` constant from `learningStateDescriber.js:28`.
- **Tests + Playwright baselines.**

### What is at risk (anti-patterns to avoid)

- **AP-SCF-01 / AP-06** — *graded copy* — Curriculum rows MUST surface observed/factual data only. No "you did well", "great", "score", "level up", "wrong", "missed". The forbidden-copy lint enforces this regex.
- **AP-SCF-03** — *tier-as-rank* — owner-tier radio is the ONLY place rank labels (novice / live-rec / studied-amateur / part-time-grinder / serious-grinder / pro) may render. Curriculum tier headers show "Tier 1" / "Tier 2" numerically; descriptors render as sentences not labels.
- **`feedback_scf_learning_state_not_tier_rank.md`** — descriptor is a "learning state" sentence ("currently focused on cbet-defense"), not a single-word rank. Composition inspector exposes the full breakdown so any displayed descriptor is fully accountable to its inputs.
- **`feedback_owner_volunteered_grading.md`** — opt-in only. SelfCoachView is owner-navigated (not auto-pushed); the user volunteered to be there. No grading copy elsewhere violates this.
- **Autonomy red line #5** — no shame copy, no streak counters, no level-up notifications, no engagement-pressure substrate. Tests-history section was deferred partly because streak-display would be tempting; deferring keeps the engagement-pressure surface area small.
- **Autonomy red line #8** — no live-table contamination. SelfCoachView is NOT in the source-util-policy blacklist (`OnlineView` / `TableView` / `TournamentView` / `ShowdownView`); imports from `utils/skillAssessment/*` are allowed for SelfCoachView. Lint test at `src/utils/persistence/__tests__/sourceUtilPolicy.test.js` continues to enforce the boundary.

---

## Output 5 — Verdict

**Verdict:** GREEN — proceed to Gate 4 surface-spec update + implementation.

**Reasoning:**
1. SCF program completed Gates 1–4 + shipped 6 sprints of infrastructure. The surface-level decisions made today (tree IA / discrete sliders / greyed empty-lesson / separate-Settings-tab / inline-expand inspector) are refinements on top of an already-validated design space.
2. All 5 binding constraints (red lines #5/#8, AP-SCF-01/03, AP-06, descriptor-not-rank, owner-volunteered grading, source-util-policy) are well-understood and have shipped lint/test infrastructure to enforce.
3. The deferred sections (Hero-leaks aggregation, Tests history) are real future work but their absence does not make today's slice incoherent — Curriculum + Settings ship a complete consumer surface for the curriculum-browse + signal-tuning JTBDs.
4. Gate 2 (Blind-Spot Roundtable) is not required: persona-blindspot risk was managed at program-level Gate 2 (2026-05-02); no new persona, no new product line, no new interaction pattern (composition inspector is re-use).
5. Gate 4 surface spec exists; it requires UPDATE not full re-author for today's narrowed slice + signal-tuning controls.

**Conditions on the verdict:**
- Gate 4 surface spec MUST be updated in the same session (`docs/design/surfaces/self-coach-view.md`) — change-log entry + Settings-tab Signal-toggles/weights additions + Curriculum-section tree-IA mockup update + Phase-5a scope callout.
- Forbidden-rank-label CI lint test MUST land in the same PR.
- Source-util-policy test MUST run green post-implementation (no whitelist edits expected).

---

## Open questions for owner (none blocking)

1. **Hero-leaks section deferral.** Today's slice scopes Hero-leaks aggregation out — `HeroCoachingCard` already surfaces the same data inline in HandReplay. Is the deferral acceptable, or should the slice include a thin Hero-leaks section that summarizes count + last-fired timestamp linking back to HandReplay? *Recommendation: ship today's narrower slice; add Hero-leaks section in follow-up if usage data shows the count-summary is missed.*
2. **Tests-history section deferral.** Today's slice defers Tests-history. All `test_substrate` are `pending`. Is there value in shipping an empty-state Tests-history section now ("No quizzes taken yet — tests substrate pending") to anchor the IA, or wait until first test substrate ships? *Recommendation: wait — empty-state would be aesthetic noise.*
3. **Cadence-reminder controls.** Gate 4 spec line 100–103 has cadence-reminder controls in Settings. Today's slice defers them. Is that the right call given the user might want to be reminded to study? *Recommendation: defer — the user navigates to SelfCoachView deliberately; nudging would violate autonomy red line #5 in spirit.*

These are non-blocking; ship the slice and revisit on first owner walkthrough.

---

## Links

- Feature lifecycle: [`docs/design/LIFECYCLE.md`](../LIFECYCLE.md)
- Methodology: [`docs/design/METHODOLOGY.md`](../METHODOLOGY.md)
- Roundtable template: [`docs/design/ROUNDTABLES.md`](../ROUNDTABLES.md)
- Surface spec (to be updated this session): [`surfaces/self-coach-view.md`](../surfaces/self-coach-view.md)
- Program-level Gate 1: [`audits/2026-05-02-entry-self-coach-foundation.md`](2026-05-02-entry-self-coach-foundation.md)
- Program-level Gate 2: [`audits/2026-05-02-blindspot-self-coach-foundation.md`](2026-05-02-blindspot-self-coach-foundation.md)
- Program-level Gate 3: [`audits/2026-05-02-gate3-research-self-coach-foundation.md`](2026-05-02-gate3-research-self-coach-foundation.md)
- Program-level Gate 4: [`audits/2026-05-02-gate4-design-self-coach-foundation.md`](2026-05-02-gate4-design-self-coach-foundation.md)
- Sprint plan: `.claude/workstream/sprints/SPR-042.yaml`
- Implementation plan: `C:/Users/chris/.claude/plans/serene-gliding-origami.md`

---

## Change log

- 2026-05-06 — Created. Surface-specific Gate 1 for SelfCoachView fullscreen route; verdict GREEN; Gate 2 not required (persona-blindspot risk managed at program-level Gate 2). Gate 4 surface spec exists and will be updated in same session for today's narrowed slice + signal-tuning controls.
