# Surface — Camera Capture Modal

**ID:** `camera-capture-modal`
**Code paths:**
- `src/components/views/CameraCaptureModal/CameraCaptureModal.jsx` (Phase 5 — not yet implemented; spec'd at PIO Gate 4)
- `./CaptureStage.jsx` (Phase 5 — Stage 1: viewfinder + 1:1 frame overlay + Shutter)
- `./AcceptStage.jsx` (Phase 5 — Stage 2: cropped output preview + Retake / Accept)
- `src/hooks/useCameraCapture.js` (Phase 5 — capture lifecycle + auto-crop center 1:1)
- `src/utils/persistence/playerPhotosStore.js` (Phase 5 — atomic-txn write per PIO-G3-PHOTO)

**Route / entry points:**
- Inline modal (no route). Opened from:
  - `PlayerEditorView` `[ 📷 Add photo ]` button (PIO-G4-PEX subsection).
  - `PlayerProfileView` (Phase 2+ — primary photo replace affordance).
- Closed: `[ ✓ Accept ]` (atomic commit) or `[ ← Back ]` from Stage 1 / `[ ← Retake ]` from Stage 2 → modal close.

**Product line:** Main app
**Tier placement:** Free+ (gated by Settings photo-toggle PIO-G4-SET; default ON)
**Last reviewed:** 2026-05-02 (created at PIO Gate 4)

---

## Purpose

A modal for capturing a player photo using the device's native camera, auto-cropped center to 1:1 ratio, and atomically committed to the `playerPhotos` IDB store with reference from the Player record. Per Decision 3 (2-stage flow), the surface minimizes taps: capture → accept; no manual crop framing in v1.

The modal is gated by Settings photo-toggle (PIO-G4-SET) and AP-PIO-03 binding (NEVER auto-launches; always requires explicit user-tap on entry button). For casino venues that prohibit photography, the owner disables the master toggle and the entry buttons disappear app-wide.

## JTBD served

Primary:
- **PM-13** *describe-someone-into-existence* — photo is one of the partial signals captured during cold-read.
- **PM-14** *build-temporal-attribute-history* — photo capture event can be associated with a sighting log row.

Secondary:
- **PM-15** *convert-uncertain-sighting-to-known-player* — photo captured during disambiguation flow can support match decision.

## Personas served

- [chris-live-player](../personas/core/chris-live-player.md) — primary.
- [cold-read-chris](../personas/situational/cold-read-chris.md) — primary (session-start photo capture).
- [post-session-chris](../personas/situational/post-session-chris.md) — secondary (post-session record polish).

NOT served: live-game personas (`mid-hand-chris`, `between-hands-chris` on live surfaces).

---

## Anatomy

**Stage 1 — Capture:**

```
┌────────────────────────────────────────────┐
│ Add Photo                              [×] │ ← modal chrome (Back button equiv)
│ ─────────────────────────────────────────  │
│                                            │
│  ┌────────────────────────────┐            │
│  │                            │            │
│  │   [Camera viewfinder]      │            │ ← native <input capture> result
│  │                            │            │   rendered via URL.createObjectURL
│  │   ┌──────────────────┐    │            │
│  │   │  1:1 frame        │    │            │ ← CSS overlay (visible guide)
│  │   │  overlay          │    │            │
│  │   └──────────────────┘    │            │
│  │                            │            │
│  └────────────────────────────┘            │
│                                            │
│           [ 📷 Shutter ]                   │
│                                            │
│  Cropping happens automatically (center    │
│  1:1) when you tap Accept on the next      │
│  screen.                                   │
│                                            │
└────────────────────────────────────────────┘
```

**Stage 2 — Accept:**

```
┌────────────────────────────────────────────┐
│ Add Photo                              [×] │
│ ─────────────────────────────────────────  │
│                                            │
│  ┌──────────────────────────┐              │
│  │                          │              │
│  │   [Cropped output 1:1]   │              │ ← canvas-API auto-crop center
│  │                          │              │   from Stage 1 capture
│  └──────────────────────────┘              │
│                                            │
│  Photo ready — tap Accept to save,         │ ← factual caption (CD-1 compliant)
│  or Retake.                                │
│                                            │
│       [ ← Retake ]    [ ✓ Accept ]         │
│                                            │
└────────────────────────────────────────────┘
```

**Stage 1 (Capture):**
- Modal opens with `<input type="file" accept="image/*" capture="environment">` triggering native iOS / Android camera.
- Once owner taps shutter and a file is returned, viewfinder displays via `URL.createObjectURL(file)`.
- 1:1 frame overlay rendered in CSS on top of viewfinder as a guide. Doesn't affect actual capture (full sensor); auto-crop happens post-capture in Stage 2.
- Single Shutter button. No additional controls in v1 (no flash toggle, no zoom slider — native camera UI handles those).
- Modal Back / `[×]` close affordance: closes modal entirely; no commit.

**Stage 2 (Accept):**
- Auto-crop center 1:1 (canvas-API draw with center crop math). v1 uses vanilla canvas-API (no react-easy-crop dependency); Gate 5 implementation may switch if simpler.
- Cropped output preview rendered as `<img>` from canvas-derived Blob URL.
- Factual caption: `"Photo ready — tap Accept to save, or Retake."` CD-1 compliant.
- 2 affordances:
  - `[ ← Retake ]` — discards current capture; returns to Stage 1.
  - `[ ✓ Accept ]` — atomic-txn commit per PIO-G3-PHOTO; modal closes; returns to caller.

## State

- **Local UI:** `stage: 'capture' | 'accept'`, `rawCapturedFile` (File from native input), `croppedBlob` (Blob from canvas-API auto-crop), `error` (string for atomic-txn rollback messaging).
- **From context (`useUI`):** `closeCameraModal` (returns to caller).
- **IDB writes (Stage 2 `[ ✓ Accept ]` only):**
  - `playerPhotos` store: `{ blobId: <generated>, blob: <croppedBlob>, capturedAt: <ms epoch>, playerId: <caller-provided> }`.
  - `players` store: update `photoBlobId` reference on Player record.
  - Both writes in single transaction; rollback on either failure.

## Props / context contract

- `playerId: string` — required; the Player to associate the photo with.
- `onAccept: (blobId: string) => void` — callback after atomic-txn commit; caller updates UI state (e.g., refresh PlayerEditor avatar thumbnail).
- `onClose: () => void` — callback on modal close (Retake-then-close, `[×]`, or system back).

## Key interactions

1. **Mount** — Stage 1 renders. `<input capture>` activates native camera (some browsers) or shows file picker (fallback).
2. **Tap Shutter** — captures file; transitions to Stage 2 with cropped output preview.
3. **Tap `[ ← Retake ]`** — discards capture; returns to Stage 1.
4. **Tap `[ ✓ Accept ]`** — atomic-txn commit; on success: modal closes, `onAccept(blobId)` callback fires; on failure: error toast inline ("Photo save failed. Try again or Retake."), modal stays in Stage 2.
5. **Tap `[×]` or system back** — closes modal without commit. `onClose()` fires.

---

## Settings gating (PIO-G4-SET)

**Master toggle:** `userSettings.photoCaptureEnabled` (boolean; default `true`).

- When toggle is OFF: PlayerEditor `[ 📷 Add photo ]` button is HIDDEN; PlayerProfile camera affordance is HIDDEN. Camera Capture Modal cannot be reached app-wide.
- When toggle is ON: entry buttons visible; modal opens on tap (always user-initiated; AP-PIO-03 binding).
- Toggle is owner-controlled in `SettingsView` `Privacy` section.
- Helper copy in Settings: `"When enabled, Add Photo buttons appear in Player Editor and Player Profile. Disable for venues that prohibit photography."`

## Atomic-txn binding (per PIO-G3-PHOTO)

On `[ ✓ Accept ]`:

```javascript
// Pseudocode for Gate 5 implementation
async function commitPhoto(playerId, croppedBlob) {
  const blobId = generateBlobId(); // uuid or hash
  const tx = db.transaction(['playerPhotos', 'players'], 'readwrite');
  try {
    await tx.objectStore('playerPhotos').put({
      blobId,
      blob: croppedBlob,
      capturedAt: Date.now(),
      playerId,
    });
    const player = await tx.objectStore('players').get(playerId);
    player.photoBlobId = blobId;
    await tx.objectStore('players').put(player);
    await tx.done;
    return blobId;
  } catch (err) {
    // tx.done rejects on rollback; both writes undone
    throw new Error(`Photo save failed: ${err.message}`);
  }
}
```

- Both writes succeed atomically OR both rollback. No partial state.
- Cascade-on-delete: when Player record deleted, associated `playerPhotos` records also delete (Gate 5 implementation detail in `playersStorage.js` delete flow).

## Anti-pattern compliance walkthrough

| AP-PIO | Verdict |
|---|---|
| AP-PIO-01 (sighting-log inferences NEVER feed exploit engine) | N/A — modal captures photo; doesn't produce inference data. |
| AP-PIO-02 (cross-surface contamination) | Compliant. Modal invoked only from review-mode surfaces (PlayerEditor + Player Profile). Live surfaces blacklisted. |
| AP-PIO-03 (auto-photo-capture refusal) | Compliant — load-bearing. Modal NEVER auto-launches; always requires explicit user-tap on entry button. Settings master toggle gates entry button availability app-wide. Two layers of user-initiation: button visibility (Settings) + button tap (modal launch). |
| AP-PIO-04 (neutral copy) | Compliant. `"Photo ready — tap Accept to save, or Retake."` is factual; no graded framing. No shame on Retake. |
| AP-PIO-05 (no demographic-targeted recommendation) | N/A — modal captures photo, not recommendation. |

## Copy-discipline compliance

- **CD-1 (factual, not imperative):** Stage 2 caption is descriptive, not commanding ("Photo ready — tap Accept" not "You must accept"). Buttons are nouns/verbs (Shutter / Retake / Accept).
- **CD-2 (no self-evaluation framing):** No "did you take a good photo?" / "rate your photo." Strictly factual.
- **CD-3 (no engagement copy):** No "great shot!" / "perfect angle!" / streak framing.

## 9 autonomy red lines compliance

| RL | Verdict |
|---|---|
| #1 (opt-in enrollment) | Compliant — user-initiated capture; Settings toggle is master gate. |
| #2 (transparency on demand) | Compliant — Stage 2 preview before commit; owner sees what's saved. |
| #3 (durable overrides) | Compliant — Accept commit is durable; owner can re-enter modal to replace. |
| #4 (reversibility) | Compliant — Retake at Stage 2 discards; Replace from PlayerEditor / Profile re-enters modal. Per-photo delete via Player record delete (cascade). |
| #5 (no streaks/shame/engagement-pressure) | Compliant — no streak; no shame on Retake. |
| #6 (flat access) | Compliant — modal accessible regardless of tier (Free+ tier; gated only by Settings toggle). |
| #7 (editor's-note tone) | Compliant — factual copy. |
| #8 (no cross-surface contamination) | Compliant — modal lives in review-mode surfaces; never invoked from live game surfaces. |
| #9 (incognito observation mode) | Phase 2+ deferred — v1 always writes captured photo to persistence. Per-photo incognito (don't write; just preview ephemerally) is Phase 2+ feature. |

---

## Known behavior notes

- **Native camera invocation.** v1 uses `<input type="file" capture="environment">` rather than `getUserMedia()`. Reason: simpler permissions model + works on iOS Safari without HTTPS / PWA prerequisites. Gate 5 may upgrade to `getUserMedia()` if device camera UX is unsatisfactory.
- **Auto-crop center 1:1 math.** Canvas-API: `ctx.drawImage(srcImg, sx, sy, sSize, sSize, 0, 0, dstSize, dstSize)` where `sx = (srcImg.width - sSize) / 2`, `sy = (srcImg.height - sSize) / 2`, `sSize = min(srcImg.width, srcImg.height)`. Output dimension `dstSize` defaults to 256px (recognition-friendly resolution; small enough for IDB blob storage).
- **Blob storage size.** 256x256 JPEG quality 0.85 → ~25KB per photo. For 100 players → ~2.5MB IDB blob storage. Acceptable.
- **`URL.createObjectURL` lifecycle.** Stage 1 viewfinder + Stage 2 preview both use `URL.createObjectURL`. URLs revoked on stage transitions and modal close (Gate 5 implementation hook).

## Known issues

(None — surface is spec'd at PIO Gate 4; first audit findings will land at Gate 5 implementation review.)

## Potentially missing

- **Manual crop framing** (Phase 2+ per Gate 4 Open Question §8). v1 ships auto-crop center 1:1; manual crop framing (drag/zoom) deferred. Owner amends in Gate 5 if auto-crop produces unsatisfactory results.
- **Per-photo incognito mode** (Phase 2+ per RL#9 deferral). v1 always writes captured photo; incognito-preview-without-commit is Phase 2+ feature.
- **Multi-photo per Player** (Phase 2+). v1 supports single primary photo per Player record. Photo carousel + multi-photo management is Phase 2+.

---

## Test coverage

- Component-level tests at Gate 5: `CameraCaptureModal.test.jsx`, `CaptureStage.test.jsx`, `AcceptStage.test.jsx`.
- Integration tests at Gate 5: PlayerEditor `[ Add photo ]` tap → modal mount → Stage 1 → Shutter → Stage 2 → Accept → atomic-txn commit → modal close → PlayerEditor avatar refresh.
- Atomic-txn rollback test at Gate 5: simulated IDB write failure → rollback → modal stays in Stage 2 with error toast; Player record `photoBlobId` unchanged.
- Settings toggle gating test at Gate 5: toggle OFF → entry buttons hidden in PlayerEditor + Player Profile.
- Visual verification at Gate 5: 1600x720 layout for both stages.

## Related surfaces

- `player-editor` — primary entry (`[ Add photo ]` button in PEX subsection).
- `player-profile` — entry (Phase 2+ photo-replace affordance).
- `settings-view` — gating (Privacy section toggle controls modal availability).
- (No relation to `leak-distillation` or hero-leak surfaces — strict AP-PIO-02 binding.)

---

## Change log

- 2026-05-02 — Created (PIO Gate 4 / WS-007 / SPR-021). 2-stage flow (capture → accept with auto-crop center 1:1) per Decision 3 (owner-ratified at SPR-021 plan-mode AskUserQuestion). Settings master toggle gating + AP-PIO-03 binding (no auto-launch). Atomic-txn binding per PIO-G3-PHOTO. Implementation deferred to PIO Gate 5 multi-PR. AP-PIO-01..05 + 9 autonomy red lines walkthroughs all clear.
