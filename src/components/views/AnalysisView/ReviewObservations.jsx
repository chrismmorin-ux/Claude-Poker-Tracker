import React from 'react';
import { SegmentationBar } from '../../ui/SegmentationBar';

const SeverityBadge = ({ severity }) => {
  if (!severity) return null;
  const colors = severity === 'major'
    ? 'bg-red-900/50 border-red-600 text-red-300'
    : 'bg-yellow-900/50 border-yellow-600 text-yellow-300';
  return (
    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${colors}`}>
      {severity}
    </span>
  );
};

const EquityBar = ({ equity, label }) => {
  if (equity === null || equity === undefined) return null;
  const pct = Math.round(equity * 100);
  const color = pct >= 60 ? 'bg-green-500' : pct >= 45 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
        <span>{label}</span>
        <span className={`font-bold ${pct >= 50 ? 'text-green-400' : 'text-red-400'}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded overflow-hidden">
        <div className={`h-full ${color} rounded`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const EVBadge = ({ evAssessment }) => {
  if (!evAssessment) return null;
  const colors = {
    '+EV': 'bg-green-900/50 border-green-600 text-green-300',
    '-EV': 'bg-red-900/50 border-red-600 text-red-300',
    'neutral': 'bg-gray-700 border-gray-500 text-gray-300',
  };
  return (
    <div className={`p-1.5 rounded border text-[10px] ${colors[evAssessment.verdict] || colors.neutral}`}>
      <span className="font-bold">{evAssessment.verdict}</span>
      <span className="ml-1">{evAssessment.reason}</span>
    </div>
  );
};

const ActionClassBadge = ({ actionClass }) => {
  if (!actionClass) return null;
  const colors = actionClass === 'value'
    ? 'bg-green-800 text-green-200 border-green-600'
    : 'bg-purple-800 text-purple-200 border-purple-600';
  return (
    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${colors}`}>
      {actionClass === 'value' ? 'Value Bet' : 'Bluff'}
    </span>
  );
};

export const ReviewObservations = ({ analysis, actionAnalysisEntry }) => {
  if (!analysis && !actionAnalysisEntry) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
        Click any action to see analysis
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      {/* Situation */}
      {analysis?.situation && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Situation</div>
          <div className="text-gray-200 font-semibold">{analysis.situation}</div>
        </div>
      )}

      {/* Villain Profile */}
      {analysis?.villainProfile && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Villain Profile</div>
          <div className="text-gray-300">{analysis.villainProfile}</div>
        </div>
      )}

      {/* Range Estimate */}
      {analysis?.rangeNote && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Range Estimate</div>
          <div className="text-gray-400">{analysis.rangeNote}</div>
        </div>
      )}

      {/* Position */}
      {analysis?.positionNote && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Position</div>
          <div className="text-gray-300">{analysis.positionNote}</div>
        </div>
      )}

      {/* Board Texture — enhanced with range advantage context */}
      {(analysis?.boardDescription || actionAnalysisEntry?.boardTexture) && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Board Texture</div>
          <div className="text-gray-300">
            {analysis?.boardDescription}
            {actionAnalysisEntry?.boardTexture && actionAnalysisEntry.rangeEquity !== null && (
              <span className="text-gray-500 ml-1">
                ({Math.round(actionAnalysisEntry.rangeEquity)}% of range has profitable equity)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Range Segmentation Bar */}
      {actionAnalysisEntry?.segmentation?.buckets && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Range Composition</div>
          <SegmentationBar buckets={actionAnalysisEntry.segmentation.buckets} size="sm" />
          <div className="flex justify-between text-[8px] text-gray-500 mt-0.5">
            {['nuts', 'strong', 'marginal', 'draw', 'air'].map(b => (
              <span key={b}>{b}</span>
            ))}
          </div>
        </div>
      )}

      {/* Hero Equity Gauge */}
      {actionAnalysisEntry?.heroEquity !== null && actionAnalysisEntry?.heroEquity !== undefined && (
        <EquityBar equity={actionAnalysisEntry.heroEquity} label="Hero Equity vs Range" />
      )}

      {/* Action Classification (showdown only) */}
      {actionAnalysisEntry?.actionClass && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Action Classification</div>
          <ActionClassBadge actionClass={actionAnalysisEntry.actionClass} />
        </div>
      )}

      {/* EV Assessment */}
      {actionAnalysisEntry?.evAssessment && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">EV Assessment</div>
          <EVBadge evAssessment={actionAnalysisEntry.evAssessment} />
        </div>
      )}

      {/* Observations */}
      {analysis?.observations?.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Observations</div>
          <div className="space-y-1.5">
            {analysis.observations.map((obs) => {
              const sevColors = obs.severity === 'major'
                ? 'bg-red-900/20 border-red-700 text-red-200'
                : obs.severity === 'minor'
                  ? 'bg-yellow-900/20 border-yellow-700 text-yellow-200'
                  : 'bg-gray-700/50 border-gray-600 text-gray-300';
              return (
                <div key={obs.id} className={`rounded p-2 border ${sevColors}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {obs.severity && <SeverityBadge severity={obs.severity} />}
                  </div>
                  {obs.text}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mistake Flag */}
      {analysis?.mistakeFlag && (
        <div className={`p-2 rounded border ${
          analysis.mistakeFlag.severity === 'major'
            ? 'bg-red-900/30 border-red-600'
            : 'bg-yellow-900/30 border-yellow-600'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">&#9888;</span>
            <SeverityBadge severity={analysis.mistakeFlag.severity} />
          </div>
          <div className={`${
            analysis.mistakeFlag.severity === 'major' ? 'text-red-300' : 'text-yellow-300'
          }`}>
            {analysis.mistakeFlag.text}
          </div>
        </div>
      )}

      {/* No observations */}
      {(!analysis?.observations?.length) && !analysis?.mistakeFlag && !actionAnalysisEntry?.segmentation && (
        <div className="text-gray-400 text-center mt-4">
          No specific observations for this action
        </div>
      )}
    </div>
  );
};
