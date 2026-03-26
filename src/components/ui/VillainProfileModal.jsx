/**
 * VillainProfileModal.jsx — Hero-facing villain decision profile modal
 *
 * Displays the villain's decision model in poker-native language.
 * Includes computed profile sections + hero-editable notes.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, ChevronRight, Eye, Shield, Brain, Target, BookOpen, Activity } from 'lucide-react';
import { auditVillainModel } from '../../utils/exploitEngine/modelAudit';
import SeverityBar from './SeverityBar';
import { getAllHands, GUEST_USER_ID } from '../../utils/persistence/index';

// =============================================================================
// MATURITY BADGE
// =============================================================================

const MATURITY_STYLES = {
  unknown: 'bg-gray-600 text-gray-300',
  coarse: 'bg-yellow-800 text-yellow-200',
  typed: 'bg-blue-800 text-blue-200',
  individual: 'bg-green-800 text-green-200',
  deep: 'bg-purple-800 text-purple-200',
};

const MaturityBadge = ({ maturity, label }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${MATURITY_STYLES[maturity] || MATURITY_STYLES.unknown}`}>
    {label}
  </span>
);

// =============================================================================
// CONFIDENCE BAR
// =============================================================================

const ConfidenceBar = ({ confidence }) => {
  const width = Math.round(confidence * 100);
  const color = confidence >= 0.6 ? 'bg-green-500' : confidence >= 0.3 ? 'bg-yellow-500' : 'bg-gray-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs text-gray-500">{width}%</span>
    </div>
  );
};

// =============================================================================
// COLLAPSIBLE SECTION
// =============================================================================

const Section = ({ title, icon: Icon, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-700 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-2 px-1 text-left hover:bg-gray-750 transition-colors"
      >
        {Icon && <Icon size={14} className="text-gray-400" />}
        <span className="text-sm font-semibold text-gray-300 flex-1">{title}</span>
        {open ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
      </button>
      {open && <div className="pb-3 px-1">{children}</div>}
    </div>
  );
};

// =============================================================================
// STREET BEHAVIOR
// =============================================================================

const StreetRow = ({ label, data }) => (
  <div className="flex items-start gap-3 py-1.5">
    <span className="text-xs font-semibold text-gray-500 w-14 shrink-0 uppercase">{label}</span>
    <div className="flex-1 min-w-0">
      <div className="text-sm text-gray-200">{data.tendency}</div>
      <div className="text-xs text-gray-500 mt-0.5">{data.detail}</div>
    </div>
    <ConfidenceBar confidence={data.confidence} />
  </div>
);

const StreetBehaviorSection = ({ streets }) => (
  <Section title="Street-by-Street Behavior" icon={Eye}>
    <div className="divide-y divide-gray-700/50">
      <StreetRow label="Pre" data={streets.preflop} />
      <StreetRow label="Flop" data={streets.flop} />
      <StreetRow label="Turn" data={streets.turn} />
      <StreetRow label="River" data={streets.river} />
    </div>
  </Section>
);

// =============================================================================
// AGGRESSION RESPONSE
// =============================================================================

const AggressionSection = ({ aggressionResponse }) => (
  <Section title="Response to Aggression" icon={Shield}>
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Facing a bet</div>
          <div className="text-sm text-gray-200">{aggressionResponse.facingBet.summary}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Fold {Math.round(aggressionResponse.facingBet.foldPct * 100)}%</div>
          <ConfidenceBar confidence={aggressionResponse.facingBet.confidence} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Facing a raise</div>
          <div className="text-sm text-gray-200">{aggressionResponse.facingRaise.summary}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Fold {Math.round(aggressionResponse.facingRaise.foldPct * 100)}%</div>
          <ConfidenceBar confidence={aggressionResponse.facingRaise.confidence} />
        </div>
      </div>
    </div>
  </Section>
);

// =============================================================================
// RANGE SHAPE + AWARENESS
// =============================================================================

const AwarenessDot = ({ detected, label }) => (
  <div className="flex items-center gap-1.5">
    <span className={`w-2 h-2 rounded-full ${detected ? 'bg-green-500' : 'bg-gray-600'}`} />
    <span className="text-xs text-gray-400">{label}</span>
  </div>
);

const RangeAwarenessSection = ({ rangeShape, awareness, decisionModelShape, decisionModelDescription }) => (
  <Section title="Range Shape & Awareness" icon={Brain}>
    <div className="space-y-3">
      {/* Range shape */}
      <div className="text-sm text-gray-300">{rangeShape.description}</div>
      {rangeShape.traits.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {rangeShape.traits.map(t => (
            <span key={t} className="px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">{t}</span>
          ))}
        </div>
      )}

      {/* Awareness */}
      <div className="pt-2 border-t border-gray-700/50">
        <div className="text-xs font-semibold text-gray-500 mb-1.5">AWARENESS</div>
        <div className="flex gap-4">
          <AwarenessDot detected={awareness.positionAware.detected} label="Position" />
          <AwarenessDot detected={awareness.boardTextureAware.detected} label="Board Texture" />
          <AwarenessDot detected={awareness.sizingTells.detected} label="Sizing Tells" />
        </div>
      </div>

      {/* Decision model */}
      <div className="pt-2 border-t border-gray-700/50">
        <div className="text-xs font-semibold text-gray-500 mb-1">DECISION MODEL</div>
        <div className="text-sm text-gray-200 font-medium">{decisionModelShape.replace(/-/g, ' ')}</div>
        <div className="text-xs text-gray-400 mt-0.5">{decisionModelDescription}</div>
      </div>
    </div>
  </Section>
);

// =============================================================================
// VULNERABILITIES
// =============================================================================

const VulnerabilitiesSection = ({ vulnerabilities }) => {
  if (!vulnerabilities || vulnerabilities.length === 0) {
    return (
      <Section title="Vulnerabilities" icon={Target} defaultOpen={false}>
        <div className="text-sm text-gray-500 italic">No significant weaknesses detected yet</div>
      </Section>
    );
  }

  return (
    <Section title={`Vulnerabilities (${vulnerabilities.length})`} icon={Target}>
      <div className="space-y-2">
        {vulnerabilities.map((v, i) => (
          <div key={v.sourceWeaknessId || i} className="bg-gray-750 rounded p-2">
            <div className="flex items-center gap-2 mb-1">
              <SeverityBar severity={v.severity} width="w-12" showLabel={false} />
              <span className="text-sm text-gray-200 flex-1">{v.label}</span>
              <ConfidenceBar confidence={v.confidence} />
            </div>
            <div className="text-xs text-gray-400 italic pl-14">{v.exploitHint}</div>
          </div>
        ))}
      </div>
    </Section>
  );
};

// =============================================================================
// SHOWDOWN ANCHORS
// =============================================================================

const ShowdownSection = ({ anchors }) => {
  if (!anchors || anchors.length === 0) {
    return (
      <Section title="Showdown History" icon={BookOpen} defaultOpen={false}>
        <div className="text-sm text-gray-500 italic">No showdown data yet</div>
      </Section>
    );
  }

  return (
    <Section title={`Showdown History (${anchors.length})`} icon={BookOpen} defaultOpen={false}>
      <div className="space-y-1">
        {anchors.map((a, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
              a.outcome === 'won' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
            }`}>
              {a.outcome}
            </span>
            <span className="text-gray-300">{a.handDescription}</span>
          </div>
        ))}
      </div>
    </Section>
  );
};

// =============================================================================
// MODEL AUDIT
// =============================================================================

const GRADE_STYLES = {
  'A': 'bg-green-800 text-green-200',
  'B+': 'bg-green-800 text-green-200',
  'B': 'bg-blue-800 text-blue-200',
  'C+': 'bg-yellow-800 text-yellow-200',
  'C': 'bg-yellow-800 text-yellow-200',
  'D': 'bg-red-800 text-red-200',
};

const GradeBadge = ({ grade }) => (
  <span className={`px-2.5 py-1 rounded-full text-sm font-bold ${GRADE_STYLES[grade] || GRADE_STYLES.D}`}>
    {grade}
  </span>
);

const AuditSection = ({ playerId, userId }) => {
  const [result, setResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const runAudit = useCallback(async () => {
    if (!playerId || isRunning) return;
    setIsRunning(true);
    try {
      const hands = await getAllHands(userId || GUEST_USER_ID);
      const auditResult = auditVillainModel(playerId, hands, userId || GUEST_USER_ID);
      setResult(auditResult);
    } catch (e) {
      setResult({ canAudit: false, reason: 'Audit failed: ' + e.message });
    } finally {
      setIsRunning(false);
    }
  }, [playerId, userId, isRunning]);

  return (
    <Section title="Model Audit" icon={Activity} defaultOpen={false}>
      {!result && !isRunning && (
        <div className="flex items-center gap-3">
          <button
            onClick={runAudit}
            disabled={!playerId}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded font-medium transition-colors disabled:opacity-50"
          >
            Run Audit
          </button>
          <span className="text-xs text-gray-500">Tests prediction accuracy against actual outcomes</span>
        </div>
      )}

      {isRunning && (
        <div className="flex items-center gap-2 py-2">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Running calibration test...</span>
        </div>
      )}

      {result && !isRunning && (
        <div className="space-y-3">
          {!result.canAudit ? (
            <div className="text-sm text-gray-500 italic">{result.reason}</div>
          ) : (
            <>
              {/* Grade + summary */}
              <div className="flex items-center gap-3">
                <GradeBadge grade={result.grade} />
                <div>
                  <div className="text-sm text-gray-200">{result.summaryNote}</div>
                  <div className="text-xs text-gray-500">{result.totalPredictions} predictions tested across {result.playerHands} hands</div>
                </div>
              </div>

              {/* Prior improvement */}
              <div className="bg-gray-750 rounded p-2">
                <div className="text-xs font-semibold text-gray-500 mb-1">PRIOR IMPROVEMENT</div>
                <div className="text-sm text-gray-200">
                  {result.priorImprovement.improvementPct > 0
                    ? `+${result.priorImprovement.improvementPct}% better than population guessing`
                    : 'Not outperforming population priors'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{result.priorImprovement.note}</div>
                <div className="text-xs text-gray-600 mt-1">
                  Model Brier: {result.priorImprovement.modelBrier} | Prior Brier: {result.priorImprovement.priorBrier}
                </div>
              </div>

              {/* Calibration */}
              <div className="bg-gray-750 rounded p-2">
                <div className="text-xs font-semibold text-gray-500 mb-1">CALIBRATION</div>
                <div className="text-sm text-gray-200">{result.calibration.note}</div>
                <div className="text-xs text-gray-500 mt-0.5">Average error: {Math.round(result.calibration.avgError * 100)}pp</div>
                <div className="mt-2 flex gap-1">
                  {result.calibration.buckets.map(b => (
                    <div key={b.label} className="flex-1 text-center">
                      <div className="text-xs text-gray-600">{b.label}</div>
                      <div className={`h-1.5 rounded-full mt-0.5 ${b.count >= 3 ? (b.error < 0.1 ? 'bg-green-600' : b.error < 0.2 ? 'bg-yellow-600' : 'bg-red-600') : 'bg-gray-700'}`} />
                      <div className="text-xs text-gray-600 mt-0.5">{b.count > 0 ? `n=${b.count}` : '-'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fallback quality */}
              {result.fallbackQuality.levels.length > 0 && (
                <div className="bg-gray-750 rounded p-2">
                  <div className="text-xs font-semibold text-gray-500 mb-1">FALLBACK QUALITY</div>
                  <div className="space-y-1">
                    {result.fallbackQuality.levels.map(l => (
                      <div key={l.source} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{l.source}</span>
                        <span className="text-gray-500">n={l.count}</span>
                        <span className="text-gray-400">acc: {Math.round(l.accuracy * 100)}%</span>
                        <ConfidenceBar confidence={1 - l.avgBrier} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Profile stability */}
              <div className="bg-gray-750 rounded p-2">
                <div className="text-xs font-semibold text-gray-500 mb-1">PROFILE STABILITY</div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${result.profileStability.stable ? 'bg-green-500' : result.profileStability.stable === false ? 'bg-yellow-500' : 'bg-gray-600'}`} />
                  <span className="text-sm text-gray-200">{result.profileStability.note}</span>
                </div>
              </div>

              {/* Re-run */}
              <button
                onClick={runAudit}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Re-run audit
              </button>
            </>
          )}
        </div>
      )}
    </Section>
  );
};

// =============================================================================
// HERO NOTES
// =============================================================================

const HeroNotesSection = ({ notes, onNotesChange }) => {
  const [localNotes, setLocalNotes] = useState(notes || '');
  const debounceRef = useRef(null);

  // Sync local state when prop changes (e.g., modal reopened)
  useEffect(() => {
    setLocalNotes(notes || '');
  }, [notes]);

  const handleChange = useCallback((e) => {
    const val = e.target.value;
    setLocalNotes(val);
    // Debounce persistence — save after 500ms idle
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (onNotesChange) {
      debounceRef.current = setTimeout(() => onNotesChange(val), 500);
    }
  }, [onNotesChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <Section title="Your Notes" icon={null} defaultOpen={true}>
      <textarea
        value={localNotes}
        onChange={handleChange}
        placeholder="Add your observations — timing tells, physical reads, tilt triggers, table talk patterns..."
        rows={3}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="text-xs text-gray-600 mt-1">Your observations are saved automatically</div>
    </Section>
  );
};

// =============================================================================
// MAIN MODAL
// =============================================================================

export const VillainProfileModal = ({ isOpen, onClose, playerName, villainProfile, playerId, notes, onNotesChange }) => {
  if (!isOpen) return null;

  const hasProfile = villainProfile && villainProfile.maturity !== 'unknown';

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-300"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-bold text-white">{playerName || 'Unknown'}</h2>
            {villainProfile && (
              <MaturityBadge
                maturity={villainProfile.maturity}
                label={villainProfile.maturityLabel}
              />
            )}
            {villainProfile && (
              <span className="text-xs text-gray-500">
                {villainProfile.totalObservations} observations
              </span>
            )}
          </div>
          {villainProfile && (
            <p className="text-sm text-gray-300 italic">{villainProfile.headline}</p>
          )}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          {!hasProfile ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-2">No analysis data yet</div>
              <div className="text-sm text-gray-600">Record more hands to build a decision profile for this player</div>
            </div>
          ) : (
            <div className="space-y-1">
              <StreetBehaviorSection streets={villainProfile.streets} />
              <AggressionSection aggressionResponse={villainProfile.aggressionResponse} />
              <RangeAwarenessSection
                rangeShape={villainProfile.rangeShape}
                awareness={villainProfile.awareness}
                decisionModelShape={villainProfile.decisionModelShape}
                decisionModelDescription={villainProfile.decisionModelDescription}
              />
              <VulnerabilitiesSection vulnerabilities={villainProfile.vulnerabilities} />
              <ShowdownSection anchors={villainProfile.showdownAnchors} />
              <AuditSection playerId={playerId} />
            </div>
          )}

          {/* Hero notes always visible */}
          <div className="mt-3 pt-3 border-t border-gray-700">
            <HeroNotesSection notes={notes} onNotesChange={onNotesChange} />
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};


export default VillainProfileModal;
