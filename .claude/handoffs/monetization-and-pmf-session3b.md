# Handoff — Monetization & PMF · Session 3b (Gate 3 CLOSED)

**Session:** 2026-04-24, Claude (main) + owner-attended interview
**Project:** `docs/projects/monetization-and-pmf.project.md`
**Phase:** Gate 3 CLOSED; Gate 2 re-run verdict GREEN; Gate 4 UNBLOCKED for main-app surfaces
**Status:** DRAFT — awaiting any owner post-review redirects

---

## Files I Own (This Session)

- `docs/projects/monetization-and-pmf/gate3-owner-interview.md` — CREATED (10 verdicts + rationale)
- `docs/projects/monetization-and-pmf/anti-patterns.md` — CREATED (12 MPMF-AP-* refusals)
- `docs/design/jtbd/domains/billing-management.md` — CREATED (new 16th JTBD domain; SA-76/77/78)
- `docs/design/jtbd/domains/subscription-account.md` — AMENDED (SA-76/77/78 removed; intro updated; change-log; domain-wide constraints update)
- `docs/design/jtbd/ATLAS.md` — AMENDED (SA range 64..75; new BM domain-index row + section; change-log entry)
- `docs/design/personas/core/evaluator.md` — AMENDED (Owner-Confirmed ratification line + change-log)
- `docs/design/personas/situational/trial-first-session.md` — AMENDED (Owner-Confirmed ratification line + change-log)
- `docs/design/personas/situational/returning-evaluator.md` — AMENDED (Owner-Confirmed ratification line + change-log)
- `docs/design/personas/README.md` — AMENDED (architecture diagram + roster table + evidence-status + change-log)
- `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf-rerun.md` — CREATED (Gate 2 re-run audit; verdict GREEN)
- `docs/projects/monetization-and-pmf.project.md` — AMENDED (Stream A G3 [x]; Session Log + 11 Decisions entries)
- `.claude/BACKLOG.md` — AMENDED (7 G3-* flipped COMPLETE; 15 G4-* flipped NEXT; G4-IM flipped LATER; G3-Q7 stays NEXT)
- `.claude/STATUS.md` — AMENDED (top entry; prior PRF entry demoted)
- `.claude/handoffs/monetization-and-pmf-session3b.md` — this file

**No file conflicts** with other active streams.

---

## What this session produced

**4 new artifacts + 9 file amendments + handoff.** Zero code.

### Mode A — Owner interview (10 verdicts)

All 10 verdicts on the Recommended starting position. Captured via AskUserQuestion in 3 batches (4+4+2).

| Q | Verdict | Recommendation followed? | Effect |
|---|---|---|---|
| Q1 Doctrine scope | A — binds all commerce UX | ✓ | Bundle α + δ authoritative; β disqualified |
| Q2 Sequencing | B — parallel soft-launch + telemetry | ✓ | Founding-member + PostHog ship together |
| Q3 Ignition timing | C — defer until main-app validates | ✓ | Phase 2+ for Ignition commercial lane |
| Q4 Founding mechanism | A — $299 lifetime cap 50 | ✓ | Transactional scarcity; LTV cap accepted |
| Q5 Free-tier shape | A — session-scoped free | ✓ | Gates on history depth; H-SC01-compliant |
| Q6 Scholar fork | C — defer pending telemetry | ✓ | Unified tier ladder; re-open post-60-days |
| Q7 Ignition legal/ToS | A — schedule separate legal session | ✓ | Phase 2 Ignition blocked on session; Phase 1 unblocked |
| Q8 Telemetry consent | B — opt-out + transparency panel | ✓ | PostHog install unblocked |
| Q9 JTBD domain split | A — new billing-management.md | ✓ | Executed this session |
| Q10 Evaluator-ignition-mode situational | B — keep as attribute, no new file | ✓ | Less persona fragmentation |

### Mode B (already shipped S3a)

10 JTBDs authored Claude-solo in Session 3a. No additional JTBD work this session.

### Mode C — Persona ratification

3 PROTO personas → Owner-Confirmed (structural):
- `evaluator.md` — sub-shape framing validated; autonomy inheritance confirmed
- `trial-first-session.md` — 5–15 min window + 60-sec wow threshold + off-table default confirmed
- `returning-evaluator.md` — 2+ day drift threshold + resume-vs-fresh pattern + no-push-notification rule confirmed

Full Verified status pending Stream D telemetry 30–60-day window to kill-or-keep evidential assumptions E1–E6 + TFS1–TFS4 + RE1–RE4.

### Mode D — Gate 2 re-run audit

Verdict: **GREEN.** All 17 original Gate 2 findings mapped to closure or named Gate 4/5 carry-forward. 3 structural risks downgraded:
- **Dark-pattern cancellation drift** → ACTIVE (mitigation shipped to Gate 4 carry-forwards: MPMF-G4-J3 cancellation journey + MPMF-G5-CL CI-lint + MPMF-AP-05/06 refusals)
- **Q7 legal posture** → DEFERRED (known blocker; Q3=C + Q7=A composite defers Ignition; Phase 1 main-app unblocked)
- **Evaluator evidence gap** → ACTIVE (mitigation ongoing via Stream D telemetry + assumption-ledger carry-forward to Gate 4)

### Mode E (bonus) — Anti-patterns stub

`docs/projects/monetization-and-pmf/anti-patterns.md` shipped with 12 MPMF-AP-* refusals:
- MPMF-AP-01 Timer-urgency banners
- MPMF-AP-02 Social-proof false counts
- MPMF-AP-03 Streak celebrations
- MPMF-AP-04 Re-engagement push notifications
- MPMF-AP-05 Cancellation retention traps
- MPMF-AP-06 "Downgrade" framing on cancellation
- MPMF-AP-07 "Missing out" loss-framing
- MPMF-AP-08 Dark-pattern checkout
- MPMF-AP-09 "Limited-time" fake scarcity
- MPMF-AP-10 Pre-paywall friction
- MPMF-AP-11 Silent auto-renewal
- MPMF-AP-12 Paywall mid-hand

Each with forbidden-string patterns for CI-lint + permitted alternatives + red-line citation. CI-linted check lands at Gate 5 (MPMF-G5-CL).

### Mode F (bonus) — Q9 domain split executed

Created `docs/design/jtbd/domains/billing-management.md` with SA-76/77/78 content. IDs preserved (not renumbered) — future entries use BM-* prefix. ATLAS.md gained 16th domain index row + new domain section + change-log entry.

---

## What's unblocked after this session

### Gate 4 (Design) — main-app surfaces ready to author

15 Gate 4 backlog items flipped to NEXT:
- **Charter** MPMF-G4-ACP — expand §Acceptance Criteria with 10 commerce red lines inline
- **Writers** MPMF-G4-W — WRITERS.md for subscription store (5 writers)
- **6 surfaces** MPMF-G4-S1..S6 — pricing / paywall-modal / upgrade-prompt-inline / trial-state-indicator / billing-settings / telemetry-consent-panel
- **4 journeys** MPMF-G4-J1..J4 — evaluator-onboarding / paywall-hit / cancellation (dark-pattern-free) / plan-change
- **Heuristics** MPMF-G4-HT — H-SC01 + H-SC02 added to poker-live-table.md
- **Assumption ledger** MPMF-G4-AL — 12–15 falsifiable assumptions
- **Bundle ε** MPMF-G4-ES — structural decision documented; surface work deferred per Q3=C
- **Entitlement architecture** MPMF-G4-EA — main-app IDB + WebSocket-to-extension

MPMF-G4-IM (Ignition-mode surface) flipped LATER (blocked on Q3=C + Q7 legal scoping).

### Stream D Phase 1 (PostHog install) — ready to begin

Q8=B verdict unblocked telemetry work independent of Gate 4 main-app surface progress. Next steps:
- Apply for PostHog-for-Startups credit ($50K)
- Install `posthog-js` into `src/main.jsx`
- Author event schema v1 in `src/constants/telemetryEvents.js`
- Instrument 3 layers per Session 1 roundtable (screen-time + action-level + feature-touch)
- Build first-launch transparency panel for Q8=B opt-out pattern

### Stream E Phase 1 (founding-member outreach) — ready once MPMF-G4-S1 + MPMF-G4-J1 land

Once pricing-page surface spec + evaluator-onboarding journey ship at Gate 4, founding-member outreach kickoff can begin. Q2=B + Q4=A combined lock the mechanism ($299 lifetime cap 50, parallel with telemetry).

---

## What remains deferred

### Q7 legal-scoping session

Q7=A verdict captured; scheduling pending external-counsel coordination. Not calendared this session. Phase 1 main-app proceeds unblocked; Phase 2 Ignition remains blocked on this session.

**Open TODO (owner-side):** calendar a session with counsel covering:
- ToS acceptability for a tool publicly marketed for Ignition use
- Payment-processor category classification (Stripe risk for gambling-adjacent categories; Paddle / LemonSqueezy alternatives)
- Marketing-channel constraints (YouTube / Twitter poker-content policies)
- US state-level gambling-adjacent-tool regulation exposure

### Scholar fork re-open trigger

Q6=C deferred pending Stream D 60+ day clustering signal. Re-open Q6 if telemetry shows ≥20% of active users cluster as Scholar-shape (low live-session activity + high drill engagement). Instrument clustering in PostHog dashboards at MPMF-G5-PH so re-verdict is evidence-driven.

### Full Verified persona status

3 personas at Owner-Confirmed (structural). Full Verified waits on evidential assumption kill-or-keep via Stream D telemetry 30–60-day window. No action required until telemetry data accumulates.

### Founding-member refund/transfer policy

Flagged in Session 1 handoff; still open. Gate 4 MPMF-G4-S1 `pricing-page.md` spec should address: what happens if a founding member wants to stop? Refund? Transfer? Data retention? Decision deferred to Gate 4 authoring.

---

## Ratification checklist (for owner)

Before Gate 4 session begins, owner should:

- [x] ~Read charter, paywall-spectrum, market-research, personas~ (done Session 2)
- [x] ~Verdict Q1–Q10~ (done this session — all Recommended)
- [x] ~Ratify personas~ (done this session — Owner-Confirmed structural)
- [ ] Schedule Q7 legal-scoping session with counsel (external — not Claude-actionable)
- [ ] Confirm Session 4 starts with MPMF-G4-ACP (charter acceptance-criteria expansion) as anchor item, mirroring EAL S3 precedent

---

## Risk log (updates from this session)

| # | Risk | Status |
|---|---|---|
| R1 | PROTO personas ratified without data → bad monetization design locks in | DOWNGRADED — structural ratification complete; evidential validation ongoing via Stream D |
| R2 | Owner picks bundle β (conventional freemium) → doctrine differentiator lost | RESOLVED — Q1=A verdict confirms bundle α+δ |
| R3 | Founding-member lifetime creates LTV cap that hurts later-stage valuation | ACCEPTED — Q4=A cap at 50 is tight; seeding cost accepted |
| R4 | Ignition legal exposure surfaces during marketing launch | MITIGATED — Q3=C + Q7=A combined defers Ignition work until legal scoping complete |
| R5 | PostHog data accumulates but persona-inference model never converges | ACTIVE — 60-day window accepted |
| R6 | Evaluator bounces in first 60 seconds regardless of design quality | ACTIVE — sample-data mode (ON-86) + ON-88 expert-bypass mitigation at Gate 4 |
| R7 | Tests regress from entitlement/reducer work at Gate 5 | ACTIVE — additive pattern; standard CI gating |
| R8 | Dark-pattern cancellation drift | DOWNGRADED — mitigation shipped to Gate 4 carry-forwards |
| R9 | Q1=B/C verdict escalates Gate 2 re-run to RED | RESOLVED — Q1=A verdicted |
| R10 | Payment processor rejects Ignition category | DEFERRED — Q7 legal session addresses |
| R11 | Q9 domain-split delayed → subscription-account.md stays at 15 entries | RESOLVED — Q9=A executed; billing-management.md created |
| R12 | JTBDs over-specify Gate 4 surfaces before Q1 verdict | RESOLVED — Q1=A verdicted; surface specs Q1-informed |
| R13 | CC-88 cross-project pattern misinterpreted as MPMF-scope only | ACTIVE (low) — cross-project note explicit in CC-88 entry; future projects cite pattern |
| **R14 NEW** | **Q7 legal scoping session never happens → Phase 2 Ignition never unblocks** | ACTIVE — owner must self-schedule; if deferred indefinitely, Q3 re-verdict may force an abandonment decision |
| **R15 NEW** | **Gate 4 surface specs introduce new anti-patterns not in the 12 MPMF-AP-*** | ACTIVE (expected) — `anti-patterns.md` is a stub by design; Gate 4 expands it; CI-lint patterns added as they're identified |

---

## Open items after Gate 3

1. **Schedule Q7 legal-scoping session** (owner-actionable; external counsel)
2. **Gate 4 Session 4 scope** — recommend starting with MPMF-G4-ACP (charter ACP expansion) as anchor, mirrors EAL S3 precedent (single-anchor item unblocks all surface specs)
3. **PostHog-for-Startups credit application** (Stream D prep)
4. **Founding-member refund/transfer policy** (Gate 4 MPMF-G4-S1 authoring)
5. **Scholar fork re-open trigger** (Stream D telemetry instrumentation)

---

## Change log

- 2026-04-24 — Session 3b. Gate 3 CLOSED (all 4 modes shipped in single turn). 10 owner-interview verdicts captured (all Recommended). 3 personas ratified. Q9 domain-split executed. Anti-patterns stub shipped. Gate 2 re-run verdict GREEN. Gate 4 main-app surfaces unblocked; Ignition lane deferred. Stream D Phase 1 PostHog install unblocked. Zero code. Zero test regressions.
