import React from 'react';

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

export const ReviewObservations = ({ analysis }) => {
  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
        Click a Hero action to see analysis
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      {/* Situation */}
      <div>
        <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Situation</div>
        <div className="text-gray-200 font-semibold">{analysis.situation}</div>
      </div>

      {/* Villain Profile */}
      {analysis.villainProfile && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Villain Profile</div>
          <div className="text-gray-300">{analysis.villainProfile}</div>
        </div>
      )}

      {/* Range Estimate */}
      {analysis.rangeNote && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Range Estimate</div>
          <div className="text-gray-400">{analysis.rangeNote}</div>
        </div>
      )}

      {/* Position */}
      {analysis.positionNote && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Position</div>
          <div className="text-gray-300">{analysis.positionNote}</div>
        </div>
      )}

      {/* Board Texture */}
      {analysis.boardDescription && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Board Texture</div>
          <div className="text-gray-300">{analysis.boardDescription}</div>
        </div>
      )}

      {/* Observations */}
      {analysis.observations.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Observations</div>
          <div className="space-y-1.5">
            {analysis.observations.map((obs) => (
              <div key={obs.id} className="bg-gray-700/50 border border-gray-600 rounded p-2 text-gray-300">
                {obs.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mistake Flag */}
      {analysis.mistakeFlag && (
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
      {analysis.observations.length === 0 && !analysis.mistakeFlag && (
        <div className="text-gray-400 text-center mt-4">
          No specific observations for this action
        </div>
      )}
    </div>
  );
};
