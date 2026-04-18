/**
 * ContextPicker.jsx — preflop-context selector for the postflop drill.
 *
 * Lets the user pick (position, action, vs?) tuples that resolve to canonical
 * archetype ranges via archetypeRangeFor(). Kept simple — three dropdowns
 * (position, action, vs-position) with "action=open" hiding the vs selector.
 */

import React from 'react';
import { listArchetypeContexts, contextLabel } from '../../../utils/postflopDrillContent/archetypeRanges';

const POSITIONS = ['UTG', 'UTG+1', 'MP1', 'MP2', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const ACTIONS = [
  { id: 'open',     label: 'Open' },
  { id: 'call',     label: 'Call (flat)' },
  { id: 'threeBet', label: '3bet' },
  { id: 'fourBet',  label: '4bet' },
  { id: 'limp',     label: 'Limp' },
];

export const ContextPicker = ({ label, value, onChange, allowEmpty = false }) => {
  const contexts = listArchetypeContexts();
  const valid = new Set(contexts.map((c) => `${c.position}|${c.action}|${c.vs || ''}`));

  const key = value ? `${value.position}|${value.action}|${value.vs || ''}` : '';
  const isValid = !value || valid.has(key);

  const handlePosition = (pos) => onChange({ ...value, position: pos, vs: value?.vs });
  const handleAction   = (act) => onChange({ ...value, action: act, vs: act === 'open' || act === 'limp' ? undefined : value?.vs });
  const handleVs       = (vs)  => onChange({ ...value, vs });

  return (
    <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">{label}</div>
      <div className="flex items-center gap-2 flex-wrap">
        {allowEmpty && (
          <button
            onClick={() => onChange(null)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              !value ? 'bg-gray-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-700'
            }`}
          >
            none
          </button>
        )}
        <select
          value={value?.position || ''}
          onChange={(e) => handlePosition(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-teal-600"
        >
          <option value="" disabled>position</option>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={value?.action || ''}
          onChange={(e) => handleAction(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-teal-600"
        >
          <option value="" disabled>action</option>
          {ACTIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        {value?.action && value.action !== 'open' && value.action !== 'limp' && (
          <>
            <span className="text-xs text-gray-500">vs</span>
            <select
              value={value?.vs || ''}
              onChange={(e) => handleVs(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-teal-600"
            >
              <option value="" disabled>position</option>
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </>
        )}
      </div>
      {value && (
        <div className="mt-2 text-xs">
          <span className={isValid ? 'text-teal-400' : 'text-red-400'}>
            {isValid ? contextLabel(value) : `no archetype for ${contextLabel(value)}`}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Return true if a context value resolves to a registered archetype.
 */
export const isValidContext = (ctx) => {
  if (!ctx || !ctx.position || !ctx.action) return false;
  if (ctx.action === 'open' || ctx.action === 'limp') return true;
  if (!ctx.vs) return false;
  const contexts = listArchetypeContexts();
  return contexts.some((c) => c.position === ctx.position && c.action === ctx.action && c.vs === ctx.vs);
};
