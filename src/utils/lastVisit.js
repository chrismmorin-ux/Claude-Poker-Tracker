/**
 * lastVisit — tracks when the player last opened the app and what "what's new"
 * they've already seen, so the Homebase can re-orient a returning ("Lapsed
 * Returner") player: "while you were away" stats + new features since the gap.
 * Plan shimmying-moseying-lantern, Phase D.
 *
 * localStorage-backed (like errorLog.js) — device-local, not user-scoped data,
 * so it does not need the auth userId.
 */

const KEY = 'poker-tracker-last-visit';

/**
 * @returns {{ lastVisitAt?: number, lastSeenWhatsNewId?: string }}
 */
export const getLastVisit = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
};

/**
 * Stamp the current visit. Updates lastVisitAt to now; advances
 * lastSeenWhatsNewId when a newest id is supplied (else preserves the prior one).
 * @param {{ whatsNewId?: string }} [opts]
 */
export const stampVisit = ({ whatsNewId } = {}) => {
  try {
    const prev = getLastVisit();
    localStorage.setItem(
      KEY,
      JSON.stringify({
        lastVisitAt: Date.now(),
        lastSeenWhatsNewId: whatsNewId ?? prev.lastSeenWhatsNewId,
      })
    );
  } catch {
    /* storage unavailable — non-fatal */
  }
};
