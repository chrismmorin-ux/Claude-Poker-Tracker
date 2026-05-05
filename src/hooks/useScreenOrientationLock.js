/**
 * @file useScreenOrientationLock — per-view orientation lock via the
 *   Screen Orientation API.
 *
 * Owner contract (2026-05-05): different views need different orientation:
 *   - Game/table surfaces (TableView, ShowdownView, HandReplay, drills)
 *     LOCK landscape. Owner uses these in landscape and doesn't want a
 *     stray vertical hold to flip the layout — re-orienting + waiting
 *     for the phone to detect the rotate is a real friction tax.
 *   - Player-identification surfaces (PlayerEditorView, PlayerPickerView,
 *     PlayerProfileView, AddSightingModal) LOCK portrait. Forms, lists,
 *     and tap targets only render legibly portrait on a 6" phone.
 *
 * Usage:
 *   useScreenOrientationLock('landscape')   // top of TableView component
 *   useScreenOrientationLock('portrait')    // top of PlayerEditorView
 *   useScreenOrientationLock(null)          // explicit unlock (rare)
 *
 * The PWA manifest is `orientation: 'any'` (per
 * `feedback_portrait_mode_player_screens.md`); this hook does the
 * per-view locking that the manifest used to do globally for landscape.
 *
 * Notes:
 *   - The Screen Orientation API requires a "fullscreen-like" context
 *     (a `display: standalone` PWA qualifies on Chrome/Edge Android).
 *     In a regular browser tab, `lock()` rejects — we swallow the
 *     rejection silently so dev / browser-tab use isn't disrupted.
 *   - On unmount we don't call `unlock()` because the next view
 *     immediately calls `lock()` with its own orientation. Calling
 *     unlock between locks introduces a flash of the device's actual
 *     orientation. The next mount's lock supersedes cleanly.
 *   - Re-locking with the same orientation is a no-op on most engines.
 */

import { useEffect } from 'react';

const isLockableEnvironment = () => {
  if (typeof window === 'undefined') return false;
  if (typeof screen === 'undefined') return false;
  if (!screen.orientation) return false;
  if (typeof screen.orientation.lock !== 'function') return false;
  return true;
};

export const useScreenOrientationLock = (orientation) => {
  useEffect(() => {
    if (!orientation) return undefined;
    if (!isLockableEnvironment()) return undefined;

    // Only attempt the lock — do not unlock on unmount. The next
    // view's hook call will set its own orientation; chained
    // lock/unlock causes a visible orientation flash.
    try {
      const result = screen.orientation.lock(orientation);
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          // Browser-tab / unsupported environment: ignore.
        });
      }
    } catch {
      // Older Safari throws synchronously; ignore.
    }
    return undefined;
  }, [orientation]);
};

export default useScreenOrientationLock;
