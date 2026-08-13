# Phase 1 — security-engineer (fresh-context dispatch)
Run: run-domain-correctness-sweep-2026-08-13 | Window: 5aa1419..HEAD | Captured verbatim from agent final output.

### SECURITY ENGINEER

#### Key Concerns (top 3-5)

1. **Partial-fix cross-account data isolation gap in the exact function WS-368 rewrote to close it.** `src/utils/exportUtils.js:212` (`createPlayer(playerData)`) and `:224` (`createSession({...sessionData, isActive:false})`) call the persistence constructors **without** the `userId` parameter, so both fall through to their default `userId = GUEST_USER_ID` (`playersStorage.js:38`, `sessionsStorage.js:44`). Meanwhile `:240-244` in the same function (`saveImportedHand({...}, userId)`) correctly threads the real signed-in `userId`. Introducing/verified commit `3befa26d` (WS-368) — pre-window all three call sites were unscoped; the commit added the `userId` parameter and its docblock explicitly states "hands are user-scoped and must not silently land on 'guest'," but only wired one of three imported entity types. Net effect: imported hands correctly scoped, but the players and sessions those hands reference are created under `guest` — cross-account-visible player/session records on a shared machine or orphaned/misattributed FK references.

2. **A known, documented corpus-leakage bypass path left unguarded.** `scripts/backtest/run-strategy-profile.mjs:41` reads `pool.HANDHQ_REFERENCE_STAKES` directly, with no `LeakageGuard`/`fieldTable()` import — unchanged by the WS-374/375 leakage work (noted in `154d6858`'s commit message: "listed and flagged rather than fixed since it is outside this ticket's scope"). Identical failure shape WS-375 closed for `entryEvaluator.mjs` ("the safety was circumstantial"). `leakageGuard.mjs`'s allowlist test does not cover this file — the allowlist is not exhaustive by the project's own admission.

3. **Extension trust-boundary widening for real-money hand data at rest (deliberate, but worth flagging).** `ignition-poker-tracker/shared/storage-writer.js` (commit `b05c6217`, WS-358) moves the durable copy of captured hands from `chrome.storage.session` (TRUSTED_CONTEXTS-only per RT-11) to a new `chrome.storage.local` journal (`JOURNAL_KEY`, up to `MAX_JOURNAL = 5000` entries), explicitly noted in-code as widening read access to the extension's isolated-world content scripts on the casino origin. Journal entries unencrypted, persist until app ACK — no TTL or purge if the app is never reopened; real-money hand data can persist indefinitely on disk outside the previously-established reduced-trust boundary.

4. **Decision-record integrity sink silently excludes corrupt/torn lines from its own tamper-evidence hash.** `scripts/backtest/decisionRecord.mjs:302-306`: at `close()`, each JSONL line is parsed and any parse failure is swallowed (`catch { continue; }`) — dropped from both `rowCount` and the `sha256` `contentHash` with no error surfaced. Weaker than the sibling atom-store (`atomStore.mjs`, WS-438, `c55a132c`) which distinguishes `TRUNCATED` from `HASH_MISMATCH` and refuses rather than silently re-deriving a "clean" hash over whatever survived. A crash mid-write on the decision-record sink would still produce a `contentHash` that looks like a complete, verified record.

#### Hidden Risks

- **Session-level provenance deliberately deferred** (WS-368 commit message): only hand-level records carry the positive `live`/`ignition`/`import`/`unknown` channel; sessions and players carry no provenance channel.
- **`holdingKnowledge` basis enforcement has no static/CI backstop, only a runtime throw.** A new range-mutating call site that bypasses `narrowHolding` (writes/reads a range array directly, as `narrowByBoard` still permits) is invisible — no lint rule comparable to `check-idb-additive.sh`.
- **`journalAppend`/`enqueueHand` durability has no retention bound tied to account/session lifecycle** — a hand that fails to ACK can retain money-hand data in `chrome.storage.local` indefinitely, only a manual `getJournalStatus()` pending count.
- **Display-layer style classification (`classifyStyle`) survives WS-436's engine-input removal in five modules** — `analysisPipeline.js`, `modelAudit.js`, `villainProfileBuilder.js`, `sessionStats.js`, `tendencyCalculations.js` — doctrinally correct per WS-447 (display-only), but exactly the shape that risks silent read-back into an engine input.

#### Likely Missing Elements

- No mechanical enforcement (lint/CI grep gate) catching a bare `createPlayer(x)` / `createSession(x)` call missing its `userId` argument — the exact defect class of Key Concern #1, already named in `feedback_userid_data_isolation.md`.
- No test asserting `run-strategy-profile.mjs` (or any future script) is inside the `leakageGuard.mjs` allowlist or provably scores no corpus hand.
- No TTL/expiry policy or user-facing purge control for the `chrome.storage.local` hand journal beyond app-ACK pruning.
- No equivalent of `atomStore.mjs`'s checkpoint-hash/`HASH_MISMATCH` tamper detection in `decisionRecord.mjs`'s JSONL sink.

#### Dangerous Assumptions

- WS-368's stated security property (stamps frozen and spread AFTER `...handData`) was built for hand **provenance** but implicitly assumed to also hold for account **identity** on the same import path. It does not: `createPlayer`/`createSession` still accept a silent guest default.
- `storage-writer.js` treats "casino page scripts cannot read chrome.storage" as a durable boundary with no compensating control (encryption, TTL) against a compromised content-script dependency.
- `decisionRecord.mjs`'s `close()` treats lines-on-disk as sufficient — but a `contentHash` computed after silently discarding unparseable lines presents a corrupted capture as complete and tamper-free.

#### Areas checked and found CLEAN (with evidence)

- **Ignition manifest permissions unchanged this window** — only `default_popup` removed; no permissions/host_permissions/externally_connectable change.
- **Extension self-repair auto-actions origin-scoped** — `ensureAppTabOpen`/`reloadOrphanedIgnitionTabs` operate only against constant URL patterns, never page-supplied.
- **Durable-journal write path gated by existing message validation** — both `enqueueHand` call sites run through `validateMessage`/`validateHandForRelay` before disk.
- **`holdingKnowledge` observed/hypothesized separation structurally enforced** — `provenance.js:76-99`, closed BASIS set; all 6 production call sites pass explicit basis literals.
- **Corpus leakage defense-in-depth for primary backtest runners** — `leakageGuard.mjs` three independent throw-on-violation channels + `REFERENCE_FIELD_CORPUS` declaration mode with `#refuseIfFieldCorpus` (lines 226-235).
- **Hand-provenance migration v28 handles the concurrent-cursor race explicitly** — ambiguous pre-migration rows stamped `unknown`, never `live`.
- **Atom-store integrity** (`atomStore.mjs`, WS-438): disk-space preflight, rolling-hash checkpoints, HASH_MISMATCH vs TRUNCATED, provisional-vs-finalized manifest separation.
- **Decision-record schema governed** — additive-only contract enforced by `schemas.test.js` baseline + `scripts/check-sor-additive.sh` in CI.
- **Fixture-invents-impossible-state anti-pattern**: found and fixed within this window (WS-309/WS-312 — CAPPED_WEAK fixture and hand-fed `eqVsCallRange: 0.28` replaced with behaviorally-derived equivalents; rule added: "A fixture invented to demonstrate a bug is not evidence the bug is fixed").
