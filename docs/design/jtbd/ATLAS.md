# JTBD Atlas

Master index of jobs the app enables (or should enable). Organized by domain.

Expanded Session 1b (2026-04-21) from engine run — ~90 JTBDs across 14 domains. Not every job has a fully detailed domain file yet; stubs are listed here for completeness and get fleshed out as audits reach them.

---

## Reading this atlas

- Each entry is `[JTBD-ID] — Short title`. Click through to the domain file for the full definition.
- `●` = fully documented with dimensions, personas, success criteria, failure modes.
- `◐` = listed with short definition in domain file.
- `○` = atlas entry only.
- Status: Active / Proposed (not yet implementable) / Deprecated

---

## Domain index

| ID prefix | Domain | File | Entries |
|-----------|--------|------|---------|
| PM | Player management | [domains/player-management.md](./domains/player-management.md) | PM-01..09 |
| MH | Mid-hand decision | [domains/mid-hand-decision.md](./domains/mid-hand-decision.md) | MH-01..13 |
| HE | Hand entry | [domains/hand-entry.md](./domains/hand-entry.md) | HE-11..17 |
| SM | Session management | [domains/session-management.md](./domains/session-management.md) | SM-17..22 |
| SR | Session review | [domains/session-review.md](./domains/session-review.md) | SR-23..34, SR-88 |
| SE | Session entry | [domains/session-entry.md](./domains/session-entry.md) | SE-01..04 |
| TS | Tournament-specific | [domains/tournament-specific.md](./domains/tournament-specific.md) | TS-35..44 |
| DS | Drills and study | [domains/drills-and-study.md](./domains/drills-and-study.md) | DS-43..61 |
| CO | Coaching | [domains/coaching.md](./domains/coaching.md) | CO-48..53 |
| SG | Social / group | [domains/social-group.md](./domains/social-group.md) | SG-54..59 |
| MT | Multi-device / sync | [domains/multi-device-sync.md](./domains/multi-device-sync.md) | MT-60..63 |
| SA | Subscription / account / access | [domains/subscription-account.md](./domains/subscription-account.md) | SA-64..75 |
| BM | Billing management | [domains/billing-management.md](./domains/billing-management.md) | SA-76..78 (legacy IDs); BM-01+ new |
| DE | Data export / integration | [domains/data-export-integration.md](./domains/data-export-integration.md) | DE-71..75 |
| CC | Cross-cutting | [domains/cross-cutting.md](./domains/cross-cutting.md) | CC-76..83, 87, 88, 89 |
| ON | Onboarding | [domains/onboarding.md](./domains/onboarding.md) | ON-82..88 |

Missing-feature JTBDs (87–90) are distributed across their domains, prefixed in the domain file.

---

## By domain

### Player management (PM-01..09)

| ID | Title | State | Status |
|----|-------|-------|--------|
| PM-01 | Clear a seat when a player leaves | ● | Active |
| PM-02 | Assign a known player to a seat | ● | Active |
| PM-03 | Create a new player and assign to seat | ● | Active |
| PM-04 | Swap the player on a seat | ● | Active |
| PM-05 | Batch-assign players to seats at session start | ● | Active |
| PM-06 | Retroactively link prior hands to a new player | ● | Active |
| PM-07 | Edit an existing player's record | ● | Active |
| PM-08 | Resume an in-progress player draft | ● | Active |
| PM-09 | Find a player by visual features (not name) | ● | Active |

### Mid-hand decision (MH-01..10)

| ID | Title | State | Status |
|----|-------|-------|--------|
| MH-01 | See the recommended action for the current street | ◐ | Active |
| MH-02 | Know whether the recommendation is fresh | ◐ | Active |
| MH-03 | Check bluff-catch frequency on current villain | ◐ | Active |
| MH-04 | Get sizing suggestion tied to villain's calling range | ◐ | Active |
| MH-05 | Respond to a check-raise with value/bluff mix | ◐ | Active |
| MH-06 | Multiway range-vs-ranges equity on flop | ◐ | Active |
| MH-07 | Short-stack push/fold with ICM | ◐ | Active |
| MH-08 | Incorporate blockers in fold-equity math | ◐ | Active |
| MH-09 | SPR-aware strategy cues | ◐ | Active |
| MH-10 | Plain-English "why" for a recommendation | ◐ | Active |
| MH-11 | Validate pot size before acting | ◐ | Active |
| MH-12 | See cited assumption(s) backing a recommendation (trust bridge) | ◐ | Proposed |
| MH-13 | Dismiss or downrank a live-cited assumption in the moment (silent override) | ◐ | Proposed |

### Hand entry (HE-11..16)

| ID | Title | State | Status |
|----|-------|-------|--------|
| HE-11 | One-tap seat action entry | ◐ | Active |
| HE-12 | Undo / repair a miskeyed action | ◐ | Active |
| HE-13 | Auto-capture via sidebar (online) | ◐ | Active (sidebar) |
| HE-14 | Discreet entry that looks like texting | ◐ | Active |
| HE-15 | Enter a hand post-session from memory | ◐ | Active |
| HE-16 | Voice input for action calls | ◐ | Proposed |
| HE-17 | Flag hand for post-session review mid-recording | ◐ | Active |

### Session management (SM-17..22)

| ID | Title | State | Status |
|----|-------|-------|--------|
| SM-17 | Open session with preset stakes/venue/game | ◐ | Active |
| SM-18 | Log add-ons / rebuys | ◐ | Active |
| SM-19 | Pause without closing session | ◐ | Active |
| SM-20 | Recover session from interruption | ◐ | Active |
| SM-21 | Clean cash-out with tip logging | ◐ | Active |
| SM-22 | Backfill a forgotten session | ◐ | Active |

### Session review (SR-23..34, SR-88)

| ID | Title | State | Status |
|----|-------|-------|--------|
| SR-23 | Highlight worst-EV spots | ◐ | Active |
| SR-24 | Filter by street/position/opponent-style | ◐ | Active |
| SR-25 | Replay at own pace with range overlay | ◐ | Active |
| SR-26 | Flag disagreement + add reasoning | ◐ | Proposed |
| SR-27 | Shareable replay link for coach | ◐ | Proposed |
| SR-28 | Deep-review a flagged hand against upper-surface theoretical ground-truth | ◐ | Active (HRP, pending Gate 4) |
| SR-29 | Know whether a theoretical analog exists for the spot, and what to do if it does not | ◐ | Active (HRP, gated on SPOT-KEY spike) |
| SR-30 | See the counterfactual EV tree for a past decision, with runout-class breakdown | ◐ | Active (HRP) |
| SR-31 | Flag a played hand for deep review and find it again in the queue | ◐ | Active (HRP; producer = HE-17) |
| SR-32 | Nominate a played hand for inclusion in the theoretical corpus (loop-closer to LSW / Upper-Surface) | ◐ | Proposed |
| SR-33 | Dispute a cited claim against a played hand's evidence (claim-level; SR-26 is decision-level) | ◐ | Proposed |
| SR-34 | Re-review a previously reviewed hand on a spaced-retrieval schedule | ◐ | Proposed |
| SR-88 | Similar-spot search across history | ◐ | Proposed |

### Session entry (SE-01..03)

Session Entry — pre-session preparation and post-session drill review. Distinct from Drills and Study (generic fluency) — applied to tonight's specific villains and closes a feedback loop.

| ID | Title | State | Status |
|----|-------|-------|--------|
| SE-01 | Prepare tonight's watchlist of exploitable patterns keyed to expected villains | ◐ | Proposed |
| SE-02 | Review drill predictions against session outcomes (loop-close) | ◐ | Proposed |
| SE-03 | Scale commitment to a specific deviation via drill-side dial | ◐ | Proposed |
| SE-04 | Pre-session kinesthetic visualization / rehearsal via physical artifact | ◐ | Active (PRF, pending Gate 4) |

### Tournament-specific (TS-35..42)

| ID | Title | State | Status |
|----|-------|-------|--------|
| TS-35 | ICM-pressure indicator at bubble | ◐ | Active |
| TS-36 | BB-ante vs per-player antes handling | ◐ | Active |
| TS-37 | Stack-depth strategy zone updated live | ◐ | Active |
| TS-38 | Multi-day note persistence (Day 1 → Day 2) | ◐ | Proposed |
| TS-39 | Rebuy cost tracking for ROI | ◐ | Active |
| TS-40 | Per-seat FT ICM payout delta | ◐ | Proposed |
| TS-41 | Satellite survival mode | ◐ | Proposed |
| TS-42 | Bounty-adjusted EV | ◐ | Proposed |
| TS-43 | ICM-adjusted decision at bubble | ◐ | Active |
| TS-44 | Pay-jump proximity indicator | ◐ | Active |

### Drills and study (DS-43..59)

| ID | Title | State | Status |
|----|-------|-------|--------|
| DS-43 | 10-minute quick drill on today's weak concept | ◐ | Active (Explorer; full TBD) |
| DS-44 | Correct-answer reasoning (not just score) | ◐ | Active |
| DS-45 | Custom drill from own hand history | ◐ | Proposed |
| DS-46 | Spaced repetition for key charts | ◐ | Proposed |
| DS-47 | Skill map / mastery grid | ◐ | Proposed |
| DS-48 | Understand villain's range composition as decision driver | ◐ | Active |
| DS-49 | See weighted-total EV decomposition for a decision | ◐ | Active |
| DS-50 | Walk a hand line branch-by-branch with consequences shown | ◐ | Active |
| DS-51 | Understand villain's range shape on any flop before deciding | ◐ | Active |
| DS-52 | Retention maintenance (don't let mastery decay silently) | ◐ | Active (SLS, pending Gate 4) |
| DS-53 | Edge-case probe (defend against mastery illusion) | ◐ | Active (SLS, pending Gate 4) |
| DS-54 | Exploration override (choose different concept without losing progress) | ◐ | Active (SLS — non-negotiable per red line #3) |
| DS-55 | Resumption after break (reassess, don't resume) | ◐ | Active (SLS, pending Gate 4) |
| DS-56 | Calibration check (blind probe after self-reported fluency) | ◐ | Proposed |
| DS-57 | Capture-the-insight (flag a pattern without losing focus) | ◐ | Active (EAL, pending Gate 4) |
| DS-58 | Validate-confidence-matches-experience (observed-vs-predicted transparency) | ◐ | Active (EAL, pending Gate 4) |
| DS-59 | Retire-advice-that-stopped-working (lifecycle override) | ◐ | Active (EAL, pending Gate 4) |
| DS-60 | Carry-the-reference-offline (physical laminated study artifact) | ◐ | Active (PRF, pending Gate 4) |
| DS-61 | Export-the-personal-codex (owner-authored content into printable form) | ◐ | Active (PRF Phase 2+, pending Gate 4) |

### Coaching (CO-48..53)

| ID | Title | State | Status |
|----|-------|-------|--------|
| CO-48 | Student hand queue in coach dashboard | ◐ | Proposed |
| CO-49 | Annotate streets with voice/text | ◐ | Proposed |
| CO-50 | Save pattern as reusable lesson | ◐ | Proposed |
| CO-51 | Assign drills from library or custom | ◐ | Proposed |
| CO-52 | Week-over-week mastery trends | ◐ | Proposed |
| CO-53 | Skill-baseline assessment for new student | ◐ | Proposed |

### Social / group (SG-54..59, 90)

| ID | Title | State | Status |
|----|-------|-------|--------|
| SG-54 | Settle home-game buy-ins / cash-outs | ◐ | Proposed |
| SG-55 | Group-wide stats (lifetime leaderboard) | ◐ | Proposed |
| SG-56 | Private friend-group leaderboards | ◐ | Proposed |
| SG-57 | Share clip / hand card to group chat | ◐ | Proposed |
| SG-58 | Staker read-access to horse sessions | ◐ | Proposed |
| SG-59 | Privacy controls (horse side) | ◐ | Proposed |
| SG-90 | Cryptographically signed sessions | ◐ | Proposed |

### Multi-device / sync (MT-60..63)

| ID | Title | State | Status |
|----|-------|-------|--------|
| MT-60 | Phone-to-desktop instant sync | ◐ | Paused (Firebase) |
| MT-61 | Cloud backup on phone death | ◐ | Paused |
| MT-62 | Offline-first at signal-less casino | ◐ | Active (local-first) |
| MT-63 | New-device full restore <60s | ◐ | Paused |

### Subscription / account / access (SA-64..75)

| ID | Title | State | Status |
|----|-------|-------|--------|
| SA-64 | Free tier with real value | ◐ | Proposed |
| SA-65 | Tier comparison before purchase | ◐ | Proposed |
| SA-66 | Transparent billing + easy pause | ◐ | Proposed |
| SA-67 | Multi-region access | ◐ | Proposed |
| SA-68 | Granular coach/student permissions | ◐ | Proposed |
| SA-69 | Team / seat-based billing | ◐ | Proposed |
| SA-70 | Local-only mode (no cloud) with full features | ◐ | Active (ok today) |
| SA-71 | Try the product before paying | ◐ | Active (MPMF, pending Gate 4) |
| SA-72 | Understand what's free, what's paid, and why | ◐ | Active (MPMF, pending Gate 4) |
| SA-73 | Hit a paywall with dignity | ◐ | Active (MPMF, pending Gate 4) |
| SA-74 | Cancel without friction | ◐ | Active (MPMF, pending Gate 4) |
| SA-75 | Evaluate the sidebar separately from the main app | ◐ | Active (MPMF, pending Gate 4 + Q3 + Q7) |

### Billing management (SA-76..78 legacy IDs; BM-01+ going forward)

| ID | Title | State | Status |
|----|-------|-------|--------|
| SA-76 | Switch between plan tiers | ◐ | Active (MPMF, pending Gate 4) |
| SA-77 | Manage payment method without churning | ◐ | Active (MPMF, pending Gate 4) |
| SA-78 | Know when I'll be billed and for how much | ◐ | Active (MPMF, pending Gate 4) |

### Data export / integration (DE-71..75)

| ID | Title | State | Status |
|----|-------|-------|--------|
| DE-71 | Tax-friendly session export | ◐ | Proposed |
| DE-72 | Raw JSON / CSV export | ◐ | Active (partial) |
| DE-73 | PT4/HM3 hand-history import | ◐ | Proposed |
| DE-74 | Webhook events | ◐ | Proposed |
| DE-75 | Full-archive export on leave | ◐ | Active (manual) |

### Cross-cutting (CC-76..83, 87, 88, 89)

| ID | Title | State | Status |
|----|-------|-------|--------|
| CC-01 | Undo a recent destructive action | ◐ | Active (partial) |
| CC-02 | Recover from app crash without data loss | ◐ | Active (partial) |
| CC-03 | Navigate views without losing in-progress input | ◐ | Active |
| CC-76 | Instant undo with no confirmation for hot paths | ◐ | Active (partial) |
| CC-77 | State recovery to exact position after crash | ◐ | Active (partial) |
| CC-78 | Unified search across hands/players/sessions | ◐ | Proposed |
| CC-79 | Navigation that returns to prior position | ◐ | Active (partial) |
| CC-80 | Configurable alerts / notifications | ◐ | Proposed |
| CC-81 | Accessibility modes (color-blind, low-light) | ◐ | Proposed |
| CC-82 | Trust-the-sheet (lineage-stamped reference artifacts) | ◐ | Active (PRF, pending Gate 4) |
| CC-83 | Know-my-reference-is-stale (staleness surfacing) | ◐ | Active (PRF, pending Gate 4) |
| CC-87 | Tilt detection + break suggestion | ◐ | Proposed |
| CC-88 | Have the app observe my usage honestly and transparently | ◐ | Active (MPMF, pending Gate 4 + Q8) |
| CC-89 | Mixed-games framework (PLO / stud) | ◐ | Proposed (deferred) |

### Onboarding (ON-82..88)

| ID | Title | State | Status |
|----|-------|-------|--------|
| ON-82 | 90-second product tour | ◐ | Proposed |
| ON-83 | First-hover jargon explanations | ◐ | Proposed |
| ON-84 | Skip onboarding for pros | ◐ | Proposed |
| ON-85 | Import guided mapping | ◐ | Proposed |
| ON-86 | Sample data for evaluation | ◐ | Proposed |
| ON-87 | Cold-start descriptor seeding (expert bypass) | ◐ | Active (SLS, pending Gate 4) |
| ON-88 | Expert-bypass onboarding for category-experienced evaluators | ◐ | Active (MPMF, pending Gate 4) |

---

## Rules for adding / evolving JTBD

1. **Prefer decomposition over duplication.** If a new job feels 80% the same as an existing one, it's probably a sub-job.
2. **Name by outcome, not by UI action.** "Clear seat" ✓ — "Click the clear button" ✗.
3. **Ground in a situation.** Every JTBD statement starts with "When…" because a job without a trigger is a feature description, not a job.
4. **Assign to a domain.** New domain → add to atlas with rationale.
5. **Status: Proposed vs Active.** `Active` means implementable today. `Proposed` means the JTBD exists but the supporting feature may not.
6. **Persona linkage.** Every JTBD should be cited by at least one persona's related-JTBD list.

---

## Change log

- 2026-04-21 — Created with player-management domain seeded (Session 1).
- 2026-04-21 — Expanded to 14 domains / ~90 JTBDs (Session 1b engine run).
- 2026-04-23 — Added new **session-entry** domain (SE-01..03) + MH-12 / MH-13 as Gate 3 output of exploit-deviation project Phase 3. Atlas now has 15 domains. See `../audits/2026-04-23-exploit-deviation-blindspot.md`.
- 2026-04-23 — Added SR-28..34 to Session Review domain as Gate 3 output of Played-Hand Review Protocol (HRP) project. 4 Active (SR-28/29/30/31) + 3 Proposed (SR-32/33/34). No new domain, no new personas. See `../audits/2026-04-23-blindspot-played-hand-review-protocol.md`.
- 2026-04-23 — Added DS-52..56 (adaptive-learning outcomes) + ON-87 (cold-start descriptor seeding) as Gate 3 output of Poker Shape Language adaptive-seeding project. 5 Active (DS-52/53/54/55 + ON-87; DS-54 flagged non-negotiable per autonomy red line #3) + 1 Proposed (DS-56). No new JTBD domain (extends existing Drills-and-Study + Onboarding). New situational persona `returning-after-break` authored; core personas Chris and Scholar amended with skill-state attribute + autonomy-constraint sections. See `../audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md` + `../../projects/poker-shape-language/gate3-decision-memo.md`.
- 2026-04-24 — Added DS-57 (capture-the-insight), DS-58 (validate-confidence-matches-experience), DS-59 (retire-advice-that-stopped-working) as Gate 3 output of Exploit Anchor Library project. All Active pending Gate 4; DS-57 is the project's highest-priority single JTBD (standalone-valuable independent of Tier 1 candidate promotion). No new JTBD domain (extends Drills-and-Study). Chris persona amended with `observation_capture_active` attribute. See `../audits/2026-04-24-blindspot-exploit-anchor-library.md` + `../../projects/exploit-anchor-library/gate3-owner-interview.md`.
- 2026-04-24 — Added DS-60 (carry-the-reference-offline), DS-61 (export-the-personal-codex / Phase 2+), CC-82 (trust-the-sheet lineage), CC-83 (know-my-reference-is-stale staleness surfacing), SE-04 (pre-session kinesthetic visualization). 5 JTBDs across 3 domains (Drills-and-Study + Cross-Cutting + Session-Entry). Output of Gate 3 for Printable Refresher project. No new JTBD domain. CC-82 + CC-83 are cross-project patterns (any engine-derived reference artifact inherits). SE-04 parallels SE-01 (villain-specific vs generic-principles rehearsal). New cross-persona situational `stepped-away-from-hand` authored (paper-reference-permitted-at-venue: off-hand windows only). Apprentice + Rounder personas amended with one Goal bullet each. See `../audits/2026-04-24-blindspot-printable-refresher.md` (Gate 2) + `../../projects/printable-refresher/gate3-owner-interview.md` (Gate 3).
- 2026-04-24 — Added SA-71..78 (try-before-paying / understand-free-vs-paid / hit-paywall-with-dignity / cancel-without-friction / evaluate-sidebar-separately / switch-between-plan-tiers / manage-payment-method-without-churning / know-when-ill-be-billed-and-how-much), CC-88 (have-the-app-observe-my-usage-honestly-and-transparently), ON-88 (expert-bypass-onboarding-for-category-experienced-evaluators). 10 JTBDs across 3 domains (Subscription-Account + Cross-Cutting + Onboarding). Output of Gate 3 for Monetization & PMF project (Session 3a — Claude-solo authoring; owner-attended modes Q1–Q10 interview + 3 persona ratification + Gate 2 re-run deferred to Session 3b). All 10 Active pending MPMF Gate 4. Ranges bumped: SA-64..70 → SA-64..78; CC adds 88; ON-82..87 → ON-82..88. CC-88 is a cross-project pattern (any future project installing telemetry, session replay, or usage tracking inherits the same consent-gating + incognito-per-event + off-switch-always-visible pattern). ON-88 distinct from ON-84 (skip-tutorials-entirely) + ON-87 (seed-adaptive-skill-model) — ON-88 is UI-orientation, not model-state or tutorial-skip. Q9 JTBD domain-split deferred to owner verdict (SA-64..78 all in `subscription-account.md` for now; Q9 may split SA-76..78 to new `billing-management.md`). See `../audits/2026-04-24-blindspot-monetization-and-pmf.md` (Gate 2) + `../../projects/monetization-and-pmf.project.md`.
- 2026-04-24 (later same day) — Monetization & PMF Gate 3 CLOSED. All 10 owner-interview verdicts captured (all on Recommended positions per Gate 2 audit advocacy). Q9 verdicted A → **new Billing Management domain** (`BM`) added as 16th domain. SA-76/77/78 moved from subscription-account.md → billing-management.md; IDs preserved (not renumbered) for reference persistence; new entries in that domain use `BM-*` prefix going forward. SA range now SA-64..75 (was ..78). Q1=A (doctrine binds all commerce UX); Q5=A (session-scoped free tier); Q2=B (parallel soft-launch + telemetry); Q3=C (defer Ignition commercial lane); Q4=A ($299 lifetime cap 50 founding); Q6=C (defer Scholar fork pending telemetry); Q7=A (schedule separate legal-scoping session with counsel for Ignition); Q8=B (opt-out telemetry with first-launch panel); Q10=B (keep Evaluator unified at core; E-IGNITION as attribute, not separate situational). 3 personas (evaluator / trial-first-session / returning-evaluator) ratified PROTO → Owner-Confirmed (structural); full Verified status pending Stream D telemetry 30-60-day window. Gate 2 re-run audit authored at `../audits/2026-04-24-blindspot-monetization-and-pmf-rerun.md` — verdict GREEN. Gate 4 unblocked for main-app surfaces (Ignition surfaces remain Phase 2+ deferred). See `../../projects/monetization-and-pmf/gate3-owner-interview.md` for full verdicts + rationale + Gate 4 implications + carry-forwards.
