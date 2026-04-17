/**
 * DraftResumeBanner.jsx — Offer to resume or discard a previously saved draft.
 *
 * Shown only when `usePlayerEditor` reports draftBanner === 'visible'. Two
 * outcomes: Resume (populate form from stored draft) or Discard (delete
 * stored draft, keep empty/seed form). Both dismiss the banner.
 */

import React from 'react';

export const DraftResumeBanner = ({ draftSnippet, onResume, onDiscard }) => {
  return (
    <div
      role="status"
      className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between gap-3"
      data-testid="draft-resume-banner"
    >
      <div className="text-sm text-amber-900">
        <strong>Resume previous draft?</strong>
        {draftSnippet ? (
          <span className="ml-2 text-amber-800">“{draftSnippet}”</span>
        ) : null}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onResume}
          className="bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold text-xs px-3 py-1 rounded"
          data-testid="draft-resume-btn"
        >
          Resume
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="bg-white hover:bg-gray-50 text-gray-800 text-xs px-3 py-1 rounded border border-gray-300"
          data-testid="draft-discard-btn"
        >
          Discard
        </button>
      </div>
    </div>
  );
};

export default DraftResumeBanner;
