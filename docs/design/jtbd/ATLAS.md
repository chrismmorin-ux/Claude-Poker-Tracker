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
| MH | Mid-hand decision | [domains/mid-hand-decision.md](./domains/mid-hand-decision.md) | MH-01..11 |
| HE | Hand entry | [domains/hand-entry.md](./domains/hand-entry.md) | HE-11..17 |
| SM | Session management | [domains/session-management.md](./domains/session-management.md) | SM-17..22 |
| SR | Session review | [domains/session-review.md](./domains/session-review.md) | SR-23..27 |
| TS | Tournament-specific | [domains/tournament-specific.md](./domains/tournament-specific.md) | TS-35..44 |
| DS | Drills and study | [domains/drills-and-study.md](./domains/drills-and-study.md) | DS-43..47 |
| CO | Coaching | [domains/coaching.md](./domains/coaching.md) | CO-48..53 |
| SG | Social / group | [domains/social-group.md](./domains/social-group.md) | SG-54..59 |
| MT | Multi-device / sync | [domains/multi-device-sync.md](./domains/multi-device-sync.md) | MT-60..63 |
| SA | Subscription / account / access | [domains/subscription-account.md](./domains/subscription-account.md) | SA-64..70 |
| DE | Data export / integration | [domains/data-export-integration.md](./domains/data-export-integration.md) | DE-71..75 |
| CC | Cross-cutting | [domains/cross-cutting.md](./domains/cross-cutting.md) | CC-76..81 |
| ON | Onboarding | [domains/onboarding.md](./domains/onboarding.md) | ON-82..86 |

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

### Session review (SR-23..27, 88)

| ID | Title | State | Status |
|----|-------|-------|--------|
| SR-23 | Highlight worst-EV spots | ◐ | Active |
| SR-24 | Filter by street/position/opponent-style | ◐ | Active |
| SR-25 | Replay at own pace with range overlay | ◐ | Active |
| SR-26 | Flag disagreement + add reasoning | ◐ | Proposed |
| SR-27 | Shareable replay link for coach | ◐ | Proposed |
| SR-88 | Similar-spot search across history | ◐ | Proposed |

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

### Drills and study (DS-43..47)

| ID | Title | State | Status |
|----|-------|-------|--------|
| DS-43 | 10-minute quick drill on today's weak concept | ◐ | Active (Explorer; full TBD) |
| DS-44 | Correct-answer reasoning (not just score) | ◐ | Active |
| DS-45 | Custom drill from own hand history | ◐ | Proposed |
| DS-46 | Spaced repetition for key charts | ◐ | Proposed |
| DS-47 | Skill map / mastery grid | ◐ | Proposed |

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

### Subscription / account / access (SA-64..70)

| ID | Title | State | Status |
|----|-------|-------|--------|
| SA-64 | Free tier with real value | ◐ | Proposed |
| SA-65 | Tier comparison before purchase | ◐ | Proposed |
| SA-66 | Transparent billing + easy pause | ◐ | Proposed |
| SA-67 | Multi-region access | ◐ | Proposed |
| SA-68 | Granular coach/student permissions | ◐ | Proposed |
| SA-69 | Team / seat-based billing | ◐ | Proposed |
| SA-70 | Local-only mode (no cloud) with full features | ◐ | Active (ok today) |

### Data export / integration (DE-71..75)

| ID | Title | State | Status |
|----|-------|-------|--------|
| DE-71 | Tax-friendly session export | ◐ | Proposed |
| DE-72 | Raw JSON / CSV export | ◐ | Active (partial) |
| DE-73 | PT4/HM3 hand-history import | ◐ | Proposed |
| DE-74 | Webhook events | ◐ | Proposed |
| DE-75 | Full-archive export on leave | ◐ | Active (manual) |

### Cross-cutting (CC-76..81, 87, 89)

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
| CC-87 | Tilt detection + break suggestion | ◐ | Proposed |
| CC-89 | Mixed-games framework (PLO / stud) | ◐ | Proposed (deferred) |

### Onboarding (ON-82..86)

| ID | Title | State | Status |
|----|-------|-------|--------|
| ON-82 | 90-second product tour | ◐ | Proposed |
| ON-83 | First-hover jargon explanations | ◐ | Proposed |
| ON-84 | Skip onboarding for pros | ◐ | Proposed |
| ON-85 | Import guided mapping | ◐ | Proposed |
| ON-86 | Sample data for evaluation | ◐ | Proposed |

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
