import React, { useEffect, useState } from 'react';
import { RefreshCw, Home } from 'lucide-react';
import { useUI } from '../../contexts';
import { SCREEN } from '../../constants/uiConstants';
import { hardRefresh } from '../../utils/swUpdate';

/**
 * ViewLoadingFallback — the Suspense fallback for lazy views, with a way out.
 *
 * chunkRecovery.js handles a chunk that FAILS. A chunk that simply never
 * arrives — weak signal in a poker room, a stalled connection — never rejects,
 * so nothing fires: the bare spinner this replaced would turn forever with no
 * message and no button, and the founder's only option was to kill the app.
 *
 * Deliberately NOT an automatic hard refresh on a timer. hardRefresh clears the
 * precache, so firing it in response to a network problem would strip the
 * offline copy at the exact moment the network can't replace it — turning a slow
 * load into a broken app. A slow load is usually just slow. So: stay quiet while
 * it's plausibly still working, then explain and offer choices the founder makes.
 *
 * Two tiers:
 *   SLOW_MS  — say it's slow, offer Home (unmounts this boundary, always works)
 *   STUCK_MS — add Update App (the heavier hammer, now worth the trade)
 */

// Most loads finish in well under a second; 6s means something is wrong, but a
// bad connection can legitimately take this long, so the copy stays factual.
const SLOW_MS = 6000;
const STUCK_MS = 18000;

export const ViewLoadingFallback = () => {
  const { setCurrentScreen } = useUI();
  const [slow, setSlow] = useState(false);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const slowId = setTimeout(() => setSlow(true), SLOW_MS);
    const stuckId = setTimeout(() => setStuck(true), STUCK_MS);
    return () => {
      clearTimeout(slowId);
      clearTimeout(stuckId);
    };
  }, []);

  return (
    <div
      className="h-dvh bg-gray-900 flex flex-col items-center justify-center gap-5 px-6 text-center"
      data-testid="view-loading-fallback"
    >
      <div className="w-12 h-12 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />

      {slow && (
        <>
          <p className="text-gray-300 text-sm max-w-xs leading-relaxed" role="status" aria-live="polite">
            Still loading. This screen is downloaded the first time you open it,
            so a weak connection can make it slow.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            {/* Home leaves the Suspense boundary entirely — Homebase is eager, so
                it renders with nothing left to fetch. Costs nothing, always works. */}
            <button
              onClick={() => setCurrentScreen(SCREEN.HOMEBASE)}
              className="flex items-center gap-2 px-4 min-h-[44px] bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </button>

            {stuck && (
              <button
                onClick={() => hardRefresh()}
                className="flex items-center gap-2 px-4 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Update App
              </button>
            )}
          </div>

          {stuck && (
            <p className="text-gray-500 text-xs max-w-xs leading-relaxed">
              Update App clears the app&apos;s cached files and reloads. Your
              sessions, hands and players are not affected.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default ViewLoadingFallback;
