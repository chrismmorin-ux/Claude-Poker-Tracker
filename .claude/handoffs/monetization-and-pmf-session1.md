# Handoff — Monetization & PMF · Session 1 (Charter + Gate 1 + 3 personas + paywall spectrum)

**Session:** 2026-04-24, Claude (main) — owner-driven strategic starting-board
**Project:** `docs/projects/monetization-and-pmf.project.md`
**Phase:** Gate 1 SHIPPED (YELLOW); 3 personas PROTO; market research + paywall spectrum design docs SHIPPED; Gate 2 blind-spot roundtable NEXT
**Status:** DRAFT — owner ratification of personas + Q1–Q8 verdicts pending

---

## Files I Own (This Session)

- `docs/projects/monetization-and-pmf.project.md` — CREATED
- `docs/projects/monetization-and-pmf/market-research.md` — CREATED
- `docs/projects/monetization-and-pmf/paywall-spectrum.md` — CREATED
- `docs/design/personas/core/evaluator.md` — CREATED
- `docs/design/personas/situational/trial-first-session.md` — CREATED
- `docs/design/personas/situational/returning-evaluator.md` — CREATED
- `.claude/STATUS.md` — top entry replaced; prior top demoted to "Prior update"
- `.claude/handoffs/monetization-and-pmf-session1.md` — this file

**No file conflicts** with active streams:
- `exploit-anchor-library-session6/7` — Stream E code work in `src/utils/anchorLibrary/`, different directory
- `shape-language-session1` — Gate 3 work in `docs/projects/poker-shape-language/`, different project tree
- LSW audit streams — audits under `docs/design/audits/line-audits/`, different file tree

---

## What this session produced

**7 new artifacts + 1 STATUS update + 1 handoff.** All design/strategy layer; zero code touched.

| # | Artifact | Path | Role |
|---|----------|------|------|
| 1 | Project charter | `docs/projects/monetization-and-pmf.project.md` | NEW — 10-section charter; Gate 1 inline (YELLOW); 5 streams A–E; 10 phases; 8 owner-interview questions Q1–Q8 |
| 2 | Market research | `docs/projects/monetization-and-pmf/market-research.md` | NEW — competitive pricing map (tracker + training + analytics), WTP anchor points, 17 sources |
| 3 | Paywall spectrum | `docs/projects/monetization-and-pmf/paywall-spectrum.md` | NEW — full option space (9 × 9 × 7 × 7 × 5 × 3 dimensions), compatibility matrix, 5 compatible bundles, cancellation flow rules |
| 4 | Evaluator persona (core) | `docs/design/personas/core/evaluator.md` | NEW — PROTO; 3 sub-shapes (E-CHRIS/E-SCHOLAR/E-IGNITION) flagged for Gate 2 Stage A fold-or-split |
| 5 | Trial-first-session persona (situational) | `docs/design/personas/situational/trial-first-session.md` | NEW — PROTO; 5–15 min first-impression slice |
| 6 | Returning-evaluator persona (situational) | `docs/design/personas/situational/returning-evaluator.md` | NEW — PROTO; 2+ day drift-return slice; distinct from existing `returning-after-break.md` |
| 7 | STATUS.md | `.claude/STATUS.md` | AMENDED — new top entry; prior EAL-S7 entry demoted to "Prior update" |
| 8 | Handoff (this file) | `.claude/handoffs/monetization-and-pmf-session1.md` | NEW |

Also delivered in-chat (not a file): **8-voice roundtable output** (P-STRAT / PRICE / POKER-BIZ / GROWTH / TELEM / UX-RES / BEHAV / DEVIL) covering 3 tier candidates (session-scoped free + 3 paid tiers recommended), telemetry plan (PostHog), assumption seeds M1–M8. This is not archived to a formal audit doc yet — Gate 2 will produce the `audits/YYYY-MM-DD-blindspot-monetization-and-pmf.md` artifact.

---

## Why this project exists

Owner asked about monetization readiness. Core constraints:
- Multiple personas have different WTP for different value — must avoid giving higher-tier content to lower-tier users.
- Free tier must have real value (SA-64 JTBD) but must not cannibalize paid.
- The existing persona cast contains zero evaluators — every persona is an already-committed user.
- Autonomy doctrine (9 red lines) was written for skill-gating, not commerce — scope tension unresolved.
- Ignition sidebar is a separate commercial lane at ~100× the base price; requires its own treatment.
- Massive value in engines should be teased, not given away — limited-use gates ("use this all the time?" pattern) are the owner's explicit interest.
- Telemetry is missing — all current UX opinions are founder-bias until observed data lands.

Owner explicitly said:
- "not canonical… I'm interested to see what roundtable results are" → open exploration
- "We don't have any personas from someone evaluating the product for use (free trial)" → this is the structural gap, closed in this session
- "open to the full spectrum of messaging, trial length, paywall location and messaging" → paywall-spectrum.md enumerates the full space

---

## Gate 1 — Entry (inline in charter)

**Verdict: YELLOW.** Scope: product-line expansion + cross-surface journey change + new persona class + telemetry foundation. Triggers Gate 2.

**Personas:** 3 new authored this session (Evaluator core + 2 situational). Existing 14 core + 14 situational all describe already-committed users; evaluator was genuinely missing.

**JTBDs:** 7 candidates (SA-71..75 + CC-88 + ON-88). SA-64..70 already exist (mostly `Proposed`); this project promotes them. 7 new ones authored in Gate 3.

**Gaps flagged:**
1. Evaluator persona absent → authored this session, owner ratification pending
2. Doctrine scope (red lines #5/#6/#7) ambiguity for commerce UX → Q1 at Gate 3 (highest-leverage question in the project)
3. 7 new JTBDs authoring → Gate 3
4. No telemetry signal today → Stream D sequencing gap
5. Pricing locked before data → Q2 sequencing verdict

**Why YELLOW not RED:** No new persona *category* missing — Evaluator authors cleanly using existing persona shape. No new JTBD *domain* — SA/CC/ON domains exist, just under-populated. Doctrine question is clarifying, not structural.

---

## The 8 owner-interview questions for Gate 3

Parked in charter with recommended starting positions. Owner must answer before Gate 4 surface design proceeds.

| # | Question | Recommended starting position |
|---|---|---|
| Q1 | Do the 9 red lines apply to commerce UX? (A=all / B=selective / C=skill-only) | A — doctrine as positioning wedge |
| Q2 | Telemetry-first vs parallel soft-launch vs pricing-first? | B — parallel founding-member + telemetry |
| Q3 | Ignition commercial lane timing? | C — defer until main-app validates |
| Q4 | Founding-member mechanism? | A — $299 lifetime capped at 50 |
| Q5 | Free-tier shape? | A — session-scoped (no persistence beyond recap) |
| Q6 | Scholar as distinct commercial target? | Defer; await telemetry signal |
| Q7 | Legal/ToS posture (Ignition grey-market)? | Legal-scoping session before any marketing |
| Q8 | Telemetry consent default? | B — opt-out with first-launch transparency panel (red-line-#9 analog) |

**Q1 is the pivotal question.** Every paywall option in `paywall-spectrum.md` ranks on (a) conversion AND (b) doctrine compliance — the Q1 verdict determines which bundle wins. Recommendation A (doctrine-clean) costs some conversion ceiling but preserves the positioning differentiator (M1 — "no streaks, no guilt, cancel in two taps" — is novel in the poker-tooling space).

---

## The paywall spectrum (headline)

Full detail in `paywall-spectrum.md`. Compressed:

- **9 paywall locations** (L1 first-launch disqualified; L2 feature-first-open; L3 usage-threshold; L4 history-access [strongest doctrine fit]; L5 export/share; L6 depth-of-analysis; L7 time-trial end disqualified under Q1=A; L8 renewal mandatory; L9 upsell).
- **9 trial mechanisms** (T1 no-trial indefinite; T2 session-scoped; T3 hand-quota; T4 feature-limit; T5/6/7 timer trials disqualified under Q1=A; T8 $1 nominal; T9 founding-member lifetime).
- **7 limited-use patterns** (U1 per-session; U2 per-month; U3 per-lifetime; U4 saved artifacts cap; U5 history-depth [doctrine-safe canonical]; U6 quality-tiered; U7 latency-tiered).
- **7 CTA copy registers** (C1–C3 coercive disqualified; C4 feature-lock standard acceptable; C5 quantitative-factual recommended; C6 editor's-note highest compliance; C7 silent-gate cleanest).
- **5 messaging themes** (M1 radical honesty — differentiator; M2 EV-framing — poker-native; M3 mastery — Scholar; M4 GTO-authority; M5 tribe — disqualified).

**5 compatible bundles:**
- **α — Doctrine-clean + session-scoped** (L3+L4+L8+L9 / T1+T2+T9 / U1+U4+U5 / C5+C6 / M1+M2) — **recommended under Q1=A**
- **β — Conventional freemium** (L2+L7+L8 / T6 / C4+[C1/C2 at renewal] / M2+M3+M5) — requires Q1=B/C
- **γ — Scholar mastery-ladder** (L4+L6+L8+L9 / T1+T4 / U4+U6 / C4+C6 / M3+M4) — for Scholar-as-distinct-market
- **δ — Founding-member + indefinite-free** (L9 only / T1+T9 / U1+U4+U5 / C6 / M1+M2) — seeding mechanism
- **ε — Ignition SKU separate** (L2 online + L9 / T2+T4 / U1 online-scope + U4 / C5+C6 / M2+M4) — if Q3 verdict ≠ C

---

## What changed in the existing framework

**Personas directory:**
- `personas/core/` gained `evaluator.md` (15th core persona).
- `personas/situational/` gained `trial-first-session.md` + `returning-evaluator.md` (bringing situational count from 14 → 16).
- `personas/README.md` — **NOT updated this session** (deferred to Gate 3 ratification so the change-log entry can reflect final owner-ratified state, not PROTO).

**JTBD atlas:**
- **NOT updated this session.** 7 new JTBDs (SA-71..75 + CC-88 + ON-88) are authored in Gate 3 with owner ratification.

**BACKLOG:**
- **NOT updated this session.** A `## NEXT — Monetization & PMF (project: ...)` section with ~15 MPMF-prefixed rows is expected at Gate 2 kickoff. Deferred to reduce ratification churn.

---

## Next session — Gate 2 blind-spot roundtable

Per `ROUNDTABLES.md` 5-stage template. Scope (from charter):

- **Stage A (persona sufficiency):** Does the Evaluator persona cover all prospective-buyer cognitive shapes, or do we need to split E-CHRIS / E-SCHOLAR / E-IGNITION into separate personas? Are there evaluator shapes we missed (e.g., Coach-shape evaluator, Home-host evaluator)?
- **Stage B (JTBD coverage):** Are SA-71..75 + CC-88 + ON-88 exhaustive, or is a new billing-management domain emerging from SA?
- **Stage C (situational stress):** Can trial-first-session survive the paywall at each candidate location (L2 / L3 / L4)? Can returning-evaluator resume state cleanly? Mid-hand-chris-at-trial: does anyone actually trial the app at a live table, or is trial strictly off-table?
- **Stage D (cross-product):** Ignition sidebar commercial-lane ripples. If evaluator has main-app Pro but not Ignition, does the sidebar gracefully degrade? Does the main-app paywall contaminate sidebar UX?
- **Stage E (heuristic pre-check):** Run N-10 + PLT + ML on bundle α (recommended) and β (alternative). Particular attention: H-N03 undo on cancellation, H-N05 error-prevention on upgrade flow, H-PLT06 misclick absorption on upgrade-CTA.

**Expected Gate 2 verdict:** YELLOW (likely split-or-keep decisions on evaluator sub-shapes + copy-discipline refinements on paywall-spectrum bundles). Not RED — scope is tractable.

---

## Open questions not yet parked

These surfaced in Session 1 but are not in the Q1–Q8 set:

1. **Does the founding-member lifetime have a transfer / refund policy?** If a founding member wants to stop using the app, does the lifetime license retire with them? (Gate 4 surface-spec question.)
2. **What entitlement artifact persists in IDB?** A `subscription` store with fields { tier, expiresAt, trialEndsAt, grandfatheredFromCohort }? Gate 5 schema question.
3. **PostHog identity model:** anonymous → identified-on-signup is standard, but does unpaid-evaluator get identified if they create an account without paying? Likely yes; Gate 4 decision.
4. **Are there 50 evaluators to *even offer* founding-member to?** Depends on reach via Reddit / Twitter / poker-content community. Stream E Phase 2 outreach planning.
5. **Owner's appetite for Stripe vs. competitor (Paddle, Lemon Squeezy)?** Stripe is default; Paddle handles international VAT; Lemon Squeezy is lighter but less mature. Gate 5 decision.

---

## Doctrine flags for future sessions

**Red line tension still open:**
- #5 no engagement-pressure → timer-based trials, streak-based loyalty rewards, urgency copy ALL conflict if Q1=A.
- #6 flat access (no skill-gating) → the *spirit* may extend to pricing-tier-gating; if so, upgrade-prompt UX must be informational-not-adversarial.
- #7 editor's-note tone → paywall copy, renewal reminders, cancellation confirms all bind under this rule.

**Evaluator-specific red line application (proposed):**
- First-launch paywall (L1) is disqualified on red-line-#1 spirit (opt-in enrollment — can't even try without committing).
- Re-engagement push notifications to returning-evaluator are disqualified on red-line-#5 (engagement pressure against a user who chose to drift).

**Gate 3 must document per-red-line binding** to commerce UX under the Q1 verdict.

---

## Risk log

| # | Risk | Mitigation |
|---|---|---|
| R1 | PROTO personas ratified without data → bad monetization design locks in | Gate 3 ratification + Stream D telemetry 30-day window before Gate 4 surface specs lock |
| R2 | Owner picks bundle β (conventional freemium) → doctrine differentiator lost | Paywall-spectrum doc ranks bundles on doctrine compliance so the trade-off is explicit |
| R3 | Founding-member lifetime creates LTV cap that hurts later-stage valuation | Cap at 50 users is tight; mitigation: treat as seeding cost, not revenue mechanism |
| R4 | Ignition legal exposure surfaces during marketing launch | Q7 legal-scoping session required before any marketing copy ships |
| R5 | PostHog data accumulates but persona-inference model never converges | Accept 60-day window; if inconclusive, rerun Gate 2 on Evaluator sub-shape question |
| R6 | Evaluator bounces in first 60 seconds regardless of design quality | "Sample data mode" per ON-86 is the mitigation; first-60-seconds wow is UX responsibility, not commerce |
| R7 | Tests regress from entitlement/reducer work at Gate 5 | Standard CI gating; current suite ~7,200 tests; entitlement code is additive |

---

## Ratification checklist (for owner)

Before Gate 2 session begins, owner should:

- [ ] Read the charter: `docs/projects/monetization-and-pmf.project.md`
- [ ] Read the paywall spectrum: `docs/projects/monetization-and-pmf/paywall-spectrum.md`
- [ ] Read the 3 new personas — validate the cognitive shape and sub-shapes
- [ ] Skim market research for pricing-anchor sanity check
- [ ] Pre-verdict Q1 (doctrine scope) if possible — this is the option-space-defining question

Owner can redirect anything; nothing is locked until explicit verdict + ratification.

---

## Change log

- 2026-04-24 — Session 1. Charter + Gate 1 inline (YELLOW) + 3 personas (PROTO) + paywall spectrum design doc + market research doc + STATUS update + handoff. Owner ratification of personas + Q1–Q8 verdicts pending. Zero code.
