### FAILURE ENGINEER

#### Key Concerns (top 3-5)

1. **CRITICAL -- the live hand-recording auto-save swallows every failure with zero founder-visible signal.**
   `src/hooks/usePersistence.js:214-216`:
   ```
   } catch (error) {
     logError('Auto-save failed:', error);
   }
   ```
   This is the debounced (`DEBOUNCE_DELAY = 1500`, `usePersistence.js:26`) write path for every hand
   the founder records live at the table. `logError` (`src/utils/errorHandler.js:189-197`) only calls
   `console.error` -- no toast, no persisted error record, no UI state change. The hook does return
   `{ isReady, lastSavedAt }` (`usePersistence.js:44,241-244`) which could have driven a "last saved"
   indicator, but the sole production call site discards the return value entirely --
   `src/hooks/useAppState.js:85-94` calls `usePersistence(...)` without capturing anything. Grepping
   `lastSavedAt` confirms it is read only in tests (`src/hooks/__tests__/usePersistence.test.js:283,290,
   299,448,451`), never in a view. Blast radius: QuotaExceededError, a blocked DB (another tab open --
   `database.js:163-166`), or any transaction abort during a live session produces total silence. The
   founder plays on believing hands are being recorded, and finds out only when a session review shows
   fewer hands than were played. This is the exact failure the brief names as the one that matters. It is
   a direct violation of `.claude/rules/error-handling.md` ("Never swallow exceptions silently... `Error
   occurred` is never acceptable" -- here there is not even that, there is nothing at all).

2. **CRITICAL -- unaddressed concurrent-cursor clobber between migrateV23 and migrateV24 on `players`.**
   `src/utils/persistence/migrations.js:768-838` (migrateV23) and `:864-946` (migrateV24) both open an
   independent `openCursor()` walk over the SAME `players` object store, and both are invoked
   back-to-back, synchronously, within the SAME upgrade transaction whenever `oldVersion < 23` (calls at
   `migrations.js:1350` and `:1354`, neither guarded by `oldVersion > 0`, so both run together on any
   real upgrade from below v23). This is the exact hazard class the codebase explicitly identifies and
   defends against for the `hands` store between migrateV25/V27/V28 -- see the load-bearing comment at
   `migrations.js:1077-1087` ("CONCURRENT-CURSOR HAZARD... a stale-snapshot put from one walk silently
   clobbers the other walk's field write") and the dedicated mitigation logic in migrateV27
   (`:1094-1099`, skips its own pass when v25 co-runs) and migrateV28 (`:1152-1171`, re-applies v25/v27's
   defaults to avoid losing them). No equivalent guard, skip, or re-apply logic exists for
   migrateV23/V24. Two independent IDB cursors walking one store in one transaction interleave
   per-record; whichever cursor's `cursor.update()` lands later for a given record silently overwrites
   that record with its own stale snapshot, discarding the other cursor's write (v23 writes
   ageDecade/ethnicityTags/wardrobe/jewelry/logo/photoBlobId; v24 writes
   distinguishingMarks/accessoryInventory -- a player record can silently lose one migration's fields
   entirely, with the transaction still committing cleanly). Confirmed untested: every seed in
   `src/utils/persistence/__tests__/migrationV24.test.js` calls `seedPlayersAtVersion(23, ...)` (grep
   confirms literal `23` at lines 100,110,128,149,160,177,191,200,209,221,235,244,256,280,305), so the
   DB always starts already past v23 in every test and migrateV23's cursor never co-runs with
   migrateV24's. This fires only for a founder whose device DB is below v23 today and upgrades straight
   to v28 -- exactly the real upgrade path for an existing installed user, unexercised by CI.

3. **HIGH -- no flush-on-backgrounding for the pending debounced hand save; tab kill, battery death, or
   OS background-tab eviction loses up to 1.5s of the most recent live action.** `usePersistence.js` has
   a React-effect cleanup that flushes `pendingSaveRef.current` on unmount (`:226-233`), but unmount only
   fires on a React-level teardown, not on a hard tab kill, phone lock, OS memory-pressure eviction of a
   backgrounded tab, or battery death -- the actual failure modes named in the brief. A repo-wide grep
   for `visibilitychange|pagehide|beforeunload` across `src/` (excluding tests) finds matches only in
   `src/hooks/useSpeechCapture.js` and `src/hooks/useBuildVersion.js` -- no persistence hook listens for
   page-visibility or pagehide to force an immediate flush. On the target device (Galaxy S22, mobile
   Chrome) backgrounding the tab mid-hand is the single most likely real-world trigger, and it is exactly
   the window in which the last action recorded -- e.g. a river shove -- sits unflushed in
   `pendingSaveRef` and is lost with no error even logged, since the closure in concern #1 never
   executes at all.

4. **HIGH -- SYSTEM_MODEL.md's claimed migration mitigation does not exist in code.** `SYSTEM_MODEL.md:252`
   states the mitigation for IndexedDB migration risk is "Versioned migrations, backup before destructive
   ops." A repo-wide search for an automatic pre-upgrade export (`exportAllData`/`downloadBackup` calls)
   turns up only the manual, user-invoked functions in `src/utils/exportUtils.js:32,83` -- grep confirms
   these are referenced from `SessionsView.jsx` and test files, never from `database.js`'s `initDB()`/
   `onupgradeneeded` path (`database.js:145-184`) and never from any app-boot sequence. There is no
   automatic backup before the upgrade transaction runs, and no version-mismatch warning shown to the
   founder before the migration fires silently the moment `getDB()` is first called.
   `versionMismatchStorage.js` (read in full, `:1-30`) is a different mechanism entirely -- extension
   protocol-version reload bookkeeping, not IDB schema version. If a migration bug (like #2 above)
   silently drops data, there is no automatic recovery point, only whatever the founder happened to
   manually export before the update, which nothing prompts them to do.

5. **MEDIUM -- the extension-to-app sync path (`useSyncBridge.js`) has materially better failure handling
   than the live-recording path, which is backwards given the brief's stated priority.** `saveOnlineHand`
   (`handsStorage.js:508`) validates and throws on malformed data (`:544` `logValidationErrors`,
   test-confirmed at `handsStorage.test.js:585` `rejects.toThrow('Invalid online hand')`), and its caller
   `importHands` in `src/hooks/useSyncBridge.js:84-138` has a genuine circuit breaker (3 consecutive
   failures trips it, `:81-82,131-136`), keeps failed hands in a retry queue (`:126`), and surfaces
   `setSyncError` (`:133`) to the UI. This is the right pattern, applied to the extension-import path
   (brief item 5) but conspicuously not to the live manual-entry path (brief item 2), which the brief
   names as mattering most. The asymmetry is itself a finding: the more-tested, less-critical path is
   well-defended; the less-tested, most-critical path is not.

#### Hidden Risks

- Silent corruption, not just loss, on the players-store clobber (#2). Because the transaction still
  commits (no abort, no thrown error -- both cursors succeed individually), the founder gets no signal
  whatsoever that a player record silently lost a migration's fields. This is worse than a crash: a crash
  would at least be visible.
- The v28 ordering guarantee is documentation-level, not code-level. The comment at `migrations.js:
  1152-1171` explains why v28 must stay last among hands-store cursor walks -- correct today, but it is
  an English-language invariant ("MUST STAY LAST," `:1178`) with no assertion enforcing it. A future
  migration added after v28 that also walks `hands` without reading this comment reproduces the same
  clobber class found in #2, this time on `hands` -- the highest-value store in the app.
- `DB_VERSION` documentation drift confirms the architecture doc itself is unreliable in this area.
  `SYSTEM_MODEL.md:1` header claims "IndexedDB v27, 23 stores"; actual code (`database.js:50`) is
  `DB_VERSION = 28`. If the doc is a version behind on something this load-bearing, the backup-mitigation
  claim in the same table (#4) warrants the same skepticism -- these read as intent, not verified
  behavior.
- `QuotaExceededError` handling exists in exactly one store module (`handsStorage.js:121`) out of the
  roughly 30 persistence modules under `src/utils/persistence/`. A repo-wide grep for
  `QuotaExceededError` finds it nowhere else in that directory. Players, sessions, range profiles, and
  the other stores have no comparable guard.
- No proactive quota warning exists at all -- a repo-wide search for `navigator.storage.estimate` /
  `navigator.storage.persist` returns zero matches. The app never requests persistent storage, so on
  mobile Chrome under storage pressure it is a normal eviction candidate, and it never tells the founder
  how close to quota they are before a write fails.

#### Likely Missing Elements

- A `visibilitychange`/`pagehide` listener in `usePersistence.js` (or a shared persistence layer) that
  force-flushes `pendingSaveRef.current` immediately on backgrounding, not only on React unmount.
- Any UI surface for `lastSavedAt` or save failure -- even a small "last saved Xs ago" indicator on the
  Table view would convert concern #1 from silent to at-least-detectable.
- A concurrent-cursor guard (skip/reapply pattern, mirroring v27/v28) for migrateV23 + migrateV24 on
  `players`, plus a test that seeds below v23 to actually exercise the co-run path -- the gap that let #2
  ship untested.
- An automatic pre-upgrade export/snapshot, or at minimum a version-mismatch confirmation gate before
  `onupgradeneeded` fires, to make the documented `SYSTEM_MODEL.md:252` mitigation real rather than
  aspirational.
- `QuotaExceededError` handling parity across persistence modules beyond `handsStorage.js`.
- A `navigator.storage.persist()` request at app boot and a `navigator.storage.estimate()`-driven warning
  before the founder hits a hard write failure at the table.

#### Dangerous Assumptions

- "IndexedDB migrations are safe because they are additive-only and CI-enforced." True at the level of
  `scripts/check-idb-additive.sh` (no `deleteObjectStore`/`deleteIndex`), but additive-only says nothing
  about the concurrent-cursor clobber class in #2 -- that is a same-store, field-level data loss that no
  additive-only linter would catch, because no store or index is deleted.
- "If a write fails, someone will notice." Nobody is watching `console.error` on a phone at a poker
  table. The team clearly knows how to build real failure surfacing -- `useSyncBridge.js`'s circuit
  breaker and `setSyncError` prove it -- but that pattern was not extended to the one path the brief
  identifies as most consequential.
- "The architecture doc's failure-surface table is current." It is at least one migration behind (v27
  documented vs. v28 shipped) and asserts a mitigation (pre-migration backup) that does not exist in
  code. Treat every "Mitigation" cell in `SYSTEM_MODEL.md` section 5.1 as a claim to re-verify, not a
  fact.
- "Guest-mode / Firebase-sync boundary risk means cloud data can overwrite local data." Investigated and
  refuted for this codebase specifically: a repo-wide search for `onSnapshot|firestore|getFirestore|
  setDoc|updateDoc` in `src/` returns zero matches -- there is no Firestore data sync at all. Firebase is
  auth-identity only; "sync" is `migrateGuestDataToUser` (`src/utils/persistence/migrateGuestData.js`)
  re-keying local IndexedDB records from `guest` to the signed-in UID, entirely on-device. The real risk
  there is different from what the brief hypothesized: `migrateGuestDataToUser` re-keys each of its 4
  stores (`MERGE_STORES`, `migrateGuestData.js:40-45`) in a separate `cursorTx` call inside a loop
  (`:78-87`), not one atomic multi-store transaction -- a failure partway through (e.g. `hands` and
  `sessions` re-keyed, `players` fails) leaves the account in a partially-merged state with no automatic
  retry. The error is captured into `counts[store]` as a string (`:84-86`), but I did not find a
  production call site that renders that to the founder in the time available -- flagged as unverified,
  not refuted.
- `feedback_userid_data_isolation` (memory: "any user-scoped IDB read/write threads auth userId, never
  guest") -- spot-checked at the two busiest write paths (`saveHand`/`saveOnlineHand` both default to
  `GUEST_USER_ID` only as a parameter default, not a silent override) and found consistent with the rule
  at those two sites. A full audit of all ~30 persistence modules for a hardcoded guest fallback that
  should have been the authenticated userId was not completed within this pass's budget -- per
  `.claude/rules/improvement-default.md` this is a limitation to close, not a scope to narrow, and should
  be a dedicated follow-up rather than assumed clean.

#### Verdict on H1-H4

These four hypotheses are about the launch-gate's own arithmetic and program-health aggregation, not
primarily failure-engineering territory. From my lens:

- H1 (self-perpetuating NOT READY, empty `blocking_programs`): Cannot determine from this pass -- I did
  not open `prog-launch.yaml` or `cwos-pulse.js`. Not refuted, not supported; outside what I verified.
- H2 (60 vs 0-10 scale mismatch): Cannot determine -- did not open the gate arithmetic. Flagging for
  whichever persona reads the gate config directly.
- H3 (a shippable subset exists, "not ready" is not the same claim as "not usable"): Weak refute, from
  the failure lens specifically. The concrete, most-consequential live-table flow -- recording a hand and
  having it durably saved -- has a confirmed, currently-shipping silent-failure gap (#1, #3 above) with
  no user-facing signal. That does not mean the app is broken most of the time; auto-save mostly
  succeeds. It means the flow the founder depends on at the table fails silently under real, plausible
  conditions (tab backgrounding, quota pressure, a blocked DB from a second tab) with no way for the
  founder to know a hand did not save until reviewing later. A "shippable subset" claim that includes
  live hand recording should not be made without fixing #1 and #3, or at minimum shipping a visible
  save-status indicator so a failure is loud instead of silent.
- H4 (health-0 means never-run, not broken): Consistent with what I observed structurally -- the
  program-health scoring itself is outside my file set, but the pattern of "the team clearly has the
  competence to build good failure handling (`useSyncBridge.js`'s circuit breaker) and simply has not
  applied it everywhere yet" is more consistent with uneven coverage / never-instrumented paths than with
  systemic breakage. I would weight this as plausible support, but it is a program-health-methodology
  question, not one I can settle from file-level failure analysis alone.
