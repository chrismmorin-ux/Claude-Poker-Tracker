/**
 * RuleChipModal — surfaces the body + citations for a Hand Plan rule chip.
 *
 * Per the `hand-plan-layer` spec I-HP-3 contract: chips are clickable; tap
 * opens this single shared modal. Reads chip data via `getRuleChip(chipId)`
 * from `planRules.js`. Rendering shape:
 *   - title: chip.label
 *   - lead: chip.shortBody (italic, 1-sentence rule statement)
 *   - body: chip.fullBody (3-5 sentence explanation)
 *   - footer: chip.citations (POKER_THEORY.md anchors + external sources)
 *
 * Dismissal: Esc, backdrop tap, close button. No focus trap in v1 — defer
 * to LSP-G if the glossary surface needs richer keyboard nav.
 */

import React, { useEffect, useRef } from 'react';
import { getRuleChip } from '../../../../utils/postflopDrillContent/planRules';

export const RuleChipModal = ({ chipId, onClose }) => {
  const closeRef = useRef(null);
  const chip = chipId ? getRuleChip(chipId) : null;

  useEffect(() => {
    if (!chipId) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (typeof onClose === 'function') onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    // Move focus to the close button so Esc + Enter both work without a click.
    if (closeRef.current && typeof closeRef.current.focus === 'function') {
      closeRef.current.focus();
    }
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [chipId, onClose]);

  if (!chipId) return null;

  // Unknown chip → render a recoverable error banner instead of a blank modal.
  // This catches authoring drift (chip ID typo'd into comboPlans before
  // taxonomy was updated) the same way the schema validator does at build time.
  if (!chip) {
    return (
      <div
        role="dialog"
        aria-label="Rule chip unavailable"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/70" />
        <div
          className="relative w-full max-w-lg rounded-lg border border-rose-800 bg-rose-950/80 p-5 text-sm text-rose-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="font-semibold mb-1">Unknown rule chip</div>
          <div className="text-rose-200 leading-relaxed">
            <code className="font-mono text-rose-100">{String(chipId)}</code> is not registered in <code className="font-mono">planRules.PLAN_RULE_CHIPS</code>. This is an authoring error — update the chip taxonomy or fix the citation in the line content.
          </div>
          <div className="mt-3 text-right">
            <button
              ref={closeRef}
              onClick={onClose}
              className="text-xs uppercase tracking-wide bg-rose-800 hover:bg-rose-700 text-white font-semibold px-3 py-1.5 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label={`Rule: ${chip.label}`}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-lg rounded-lg border border-amber-700/70 bg-gray-900 p-5 space-y-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-amber-400/80 mb-0.5">Rule</div>
            <h3 className="text-base font-semibold text-amber-100">{chip.label}</h3>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close rule"
            className="text-gray-400 hover:text-gray-200 text-xl leading-none px-2 py-1 -mt-1 -mr-1 rounded transition-colors"
          >
            ×
          </button>
        </div>

        <p className="text-sm italic text-amber-200/90 leading-relaxed">
          {chip.shortBody}
        </p>

        <p className="text-sm text-gray-200 leading-relaxed">
          {chip.fullBody}
        </p>

        {chip.citations && chip.citations.length > 0 && (
          <div className="pt-2 border-t border-gray-800">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">Sources</div>
            <ul className="space-y-1">
              {chip.citations.map((c, i) => (
                <li key={i} className="text-xs text-gray-400 leading-relaxed">
                  <span className="font-mono text-gray-300">{c.source}</span>
                  {' '}
                  <span className="text-gray-300">{c.anchor}</span>
                  {c.note && (
                    <>
                      {' — '}
                      <span className="italic">{c.note}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
