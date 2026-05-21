# ADR-PERSIST-4: Blob Storage Strategy

**Status:** Accepted
**Date:** 2026-05-14
**Sprint:** SPR-080 Item 2 (Refactor Sprint Item 7 / WS-188 Phase 3)
**Cross-links:**
- `docs/persistence/FAILURE_MODES.md` FM-PERSIST-1, FM-PERSIST-3
- `src/utils/persistence/savePhotoAtomically.js`
- `src/utils/persistence/playerPhotosStore.js`

---

## Context

PIO Phase 5 (Player Identification v2) introduced player-photo capture. The captured photo must be persistent across sessions, browser restarts, and (for the live HUD) accessible synchronously enough to render on every TableView render.

Three viable storage targets:
1. **IDB blob storage** — `playerPhotos` object store keyed by autoincrement `blobId`; photo stored as a Blob in the record.
2. **Object URL / CDN** — upload to remote storage, store the URL on the player record.
3. **localStorage as base64** — encode the photo as a base64 string in localStorage.

The codebase chose (1) — IDB blob storage. This ADR ratifies that choice and documents the trade-offs.

## Decision

Player photos (and any future binary blob assets, e.g., replay snapshots) are stored as Blobs in dedicated IDB stores. The `playerPhotos` store is keyed by autoincrement `blobId`. Player records reference the blob by `photoBlobId`.

**Atomic-write contract** (`savePhotoAtomically.js`):
1. Add the new blob to `playerPhotos` → receive `blobId`.
2. Read the player record from `players`.
3. Update `players.<userId>.photoBlobId = blobId`.
4. Both steps run in a single readwrite transaction across both stores; either both succeed or both abort.

**Orphan handling:** when a photo is replaced, the OLD `playerPhotos.<oldBlobId>` record is NOT cleaned up. This is documented as design debt (FM-PERSIST-1, "orphan blob on replacement"). Cleanup is deferred to a future ticket; the cost is quota pressure under heavy photo-replacement workloads.

## Rationale

### Why IDB blob (over URL/CDN)

- **Offline-first.** The app must work offline (live extension capture, replay review). A network round-trip on every TableView render is unacceptable.
- **Privacy.** Player photos are personally identifiable. The owner expressed no interest in remote storage; offline-only matches the trust posture.
- **Single source of truth.** The photo lives next to the player record. No cross-store consistency to maintain (URL → blob mapping).

### Why IDB blob (over localStorage base64)

- **Size.** localStorage has ~5-10MB per-origin quota; IDB has ~50MB+ (mobile Safari, conservative). A typical photo is 100KB-1MB. localStorage runs out fast.
- **Performance.** Base64 strings in localStorage must be decoded on every read; IDB blobs are passed by reference, decoded only when rendered.
- **API.** Blob handling via `createObjectURL` + revoke is cleaner than base64 string manipulation.

### Why atomic transaction (savePhotoAtomically)

If the blob is added but the player record update fails, the blob is orphaned without a back-reference. The atomic transaction prevents this: both writes commit or both abort.

### Why orphan-on-replace is acceptable (for now)

Replacing a photo is rare (the owner ratified "stable identification fields"; photo updates are once-per-player-encounter, not per-session). Quota pressure from orphans is modest. The fix surface is well-known and tracked; not blocking.

## Consequences

### Enforced

- `savePhotoAtomically.js` is the sole entry point for writing player photos.
- Player records reference photos by `photoBlobId`; no inline blobs on player records.
- `playerPhotos` is its own store, not embedded; keys are autoincrement to avoid conflicts.

### Limitations

- **Orphan accumulation on photo replacement** (FM-PERSIST-1). Tracked as future cleanup work.
- **No quota pre-check** in `savePhotoAtomically.js` (FM-PERSIST-3). If quota is tight, the write fails mid-transaction. Tracked as TD-20.
- **Photo size is unbounded by the writer.** Capture flow downscales to 1500×1500 max edge at file-pick time (per `WS-184` + memory `feedback_error_recovery_in_flow.md`), which keeps typical blob size around 100-300KB. But the writer doesn't enforce — a future caller bypassing downscale could push large blobs.

### Future extension: replay snapshots

If hand replay introduces saved snapshot images (e.g., for showdown reveals), the same pattern applies: dedicated `replaySnapshots` store keyed by autoincrement, atomic write to attach to the hand record. The store wrapper should follow the `createUpsertStore` factory pattern from `src/utils/decisionSystems/idbStore/` (ADR-DS-2 binding).

### Sub-decisions deferred

- Orphan cleanup. Fix surface: `savePhotoAtomically.js` could read the prior `photoBlobId` before writing and queue a delete in the same transaction. Tracked as future work.
- Quota pre-check pattern. `navigator.storage.estimate()` before large writes; surface to the user if quota is tight. Tracked as TD-20.
- WebP/AVIF re-encoding on capture. Currently photos store as captured (typically JPEG from the mobile camera). Re-encoding would reduce blob size 2-4×; tracked as future optimization.

## Alternatives considered

### URL / CDN storage (rejected)

- Requires network round-trip on read.
- Privacy concerns (photos uploaded to remote).
- Adds operational dependency (CDN availability, costs).

### localStorage base64 (rejected)

- Quota too small (~5-10MB).
- Decode-on-read penalty.
- Doesn't generalize to other blob types.

### IDB blob without dedicated store (rejected)

- Inline blobs on player records would bloat every query.
- Reads of player metadata would have to deserialize blobs.
- Separation of concerns (metadata vs binary) is structural.

## Status notes

- Initial authoring: 2026-05-14 (SPR-080).
- Owner-ratified via WS-188 spec list.
- Pattern in production: PIO Phase 5 (2026-05-13 WS-184 / SPR-076 closeout).
