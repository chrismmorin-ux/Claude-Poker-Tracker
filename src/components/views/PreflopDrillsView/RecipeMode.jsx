import React, { useEffect, useMemo, useRef, useState } from 'react';
import { computeHandVsHand, parseHandClass } from '../../../utils/pokerCore/preflopEquity';
import { SHAPES, classifyHero, classifyLane, detectApplicableModifiers } from '../../../utils/drillContent/shapes';
import { pickRecipeMatchup, scoreRecipe } from '../../../utils/drillContent/scheduler';
import { usePreflopDrillsPersistence } from '../../../hooks/usePreflopDrillsPersistence';

const MODIFIER_LABELS = {
  heroSuited: 'Hero is suited',
  villainSuited: 'Villain is suited',
  flushDominator: 'Both suited; hero holds higher flush card',
  flushDominated: 'Both suited; hero holds lower flush card',
  connectedness: 'Villain is connector or 1-gap',
};
const modifierLabel = (key) => MODIFIER_LABELS[key] || key;

/**
 * RecipeMode — composable equity drill: hero pieces equity together via
 * the same mental procedure they'd use at the table.
 *
 * Steps:
 *   1. Pick hero's shape (8 options).
 *   2. Pick the lane within that shape (varies by shape).
 *   3. Estimate final equity (slider 0–100%).
 *
 * On reveal: each step scored independently, with the canonical answer
 * shown for whichever step was wrong. The shapes catalog is the source of
 * truth — same numbers Shape Mode displays.
 */
export const RecipeMode = () => {
  const { drills, recordAttempt } = usePreflopDrillsPersistence();
  const recipeDrills = useMemo(
    () => drills.filter((d) => d.drillType === 'recipe'),
    [drills],
  );
  const recentIds = useRef([]);

  const [matchup, setMatchup] = useState(null);
  const [step, setStep] = useState(1); // 1=shape, 2=lane, 3=modifiers, 4=equity
  const [pickedShape, setPickedShape] = useState(null);
  const [pickedLane, setPickedLane] = useState(null);
  const [pickedModifiers, setPickedModifiers] = useState(new Set());
  const [pickedEquity, setPickedEquity] = useState(50);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [truth, setTruth] = useState(null); // { shape, lane, modifiers, equity }
  const [loading, setLoading] = useState(false);

  const next = () => {
    // Sample across the full 169×169 hand-class space for breadth — Recipe
    // Drill's value is practicing every shape and lane, not just the curated
    // library subset.
    const m = pickRecipeMatchup(recentIds.current);
    if (m) recentIds.current = [m.id, ...recentIds.current].slice(0, 10);
    setMatchup(m);
    setStep(1);
    setPickedShape(null);
    setPickedLane(null);
    setPickedModifiers(new Set());
    setPickedEquity(50);
    setSubmitted(false);
    setScore(null);
    setTruth(null);
  };

  useEffect(() => { next(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleSubmit = () => {
    if (!matchup || submitted) return;
    setLoading(true);
    setTimeout(() => {
      try {
        const heroParsed = parseHandClass(matchup.a);
        const villainParsed = parseHandClass(matchup.b);
        const trueShape = classifyHero(heroParsed);
        const { lane: trueLane } = classifyLane(heroParsed, villainParsed);
        const trueModifiersSet = trueLane
          ? detectApplicableModifiers(heroParsed, villainParsed, trueLane)
          : new Set();
        const trueModifiers = [...trueModifiersSet];
        const r = computeHandVsHand(matchup.a, matchup.b);

        const s = scoreRecipe({
          pickedShapeId: pickedShape?.id,
          pickedLaneId: pickedLane?.id,
          pickedModifiers: [...pickedModifiers],
          pickedEquity: pickedEquity / 100,
          trueShapeId: trueShape.id,
          trueLaneId: trueLane?.id,
          trueModifiers,
          trueEquity: r.equity,
        });

        setScore(s);
        setTruth({
          shape: trueShape,
          lane: trueLane,
          modifiers: trueModifiers,
          equity: r.equity,
        });
        setSubmitted(true);
        setLoading(false);

        recordAttempt({
          drillType: 'recipe',
          matchupKey: `${matchup.a}_${matchup.b}`,
          handA: matchup.a,
          handB: matchup.b,
          userAnswer: {
            shapeId: pickedShape?.id,
            laneId: pickedLane?.id,
            modifiers: [...pickedModifiers],
            equity: pickedEquity / 100,
          },
          truth: {
            equity: r.equity,
            shapeId: trueShape.id,
            laneId: trueLane?.id,
            modifiers: trueModifiers,
          },
          correct: s.correct,
          delta: s.equityDelta,
        }).catch(() => {});
      } catch {
        setLoading(false);
      }
    }, 0);
  };

  if (!matchup) return <div className="text-gray-400 text-sm">Loading drill…</div>;

  const stepGate = (n) => step >= n; // unlocks step n

  return (
    <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
      <div className="overflow-y-auto pr-2 flex flex-col gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
            Hero holds {matchup.a}, villain has {matchup.b}
          </div>
          <div className="text-4xl font-bold text-white">{matchup.a} vs {matchup.b}</div>
          <div className="text-xs text-gray-500 mt-2">
            Compose the answer in four steps: shape → lane → modifiers → equity. Each step is graded independently.
          </div>
        </div>

        <StepShape
          enabled={!submitted}
          picked={pickedShape}
          truth={truth?.shape}
          submitted={submitted}
          onPick={(s) => { setPickedShape(s); setPickedLane(null); setPickedModifiers(new Set()); setStep(2); }}
        />

        {stepGate(2) && (
          <StepLane
            shape={pickedShape}
            picked={pickedLane}
            truth={truth?.lane}
            submitted={submitted}
            enabled={!submitted}
            onPick={(l) => { setPickedLane(l); setPickedModifiers(new Set()); setStep(3); }}
          />
        )}

        {stepGate(3) && pickedLane && (
          <StepModifiers
            lane={pickedLane}
            picked={pickedModifiers}
            truth={truth?.modifiers || []}
            submitted={submitted}
            enabled={!submitted}
            onToggle={(key) => {
              setPickedModifiers((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
              });
              setStep(4);
            }}
            onAdvance={() => setStep(4)}
          />
        )}

        {pickedLane && (
          <StepEquity
            lane={pickedLane}
            value={pickedEquity}
            onChange={setPickedEquity}
            submitted={submitted}
            truthEquity={truth?.equity}
            equityCorrect={score?.equityCorrect}
          />
        )}

        <div className="flex gap-3">
          {!submitted ? (
            <button
              onClick={handleSubmit}
              disabled={loading || !pickedShape || !pickedLane}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-3 rounded-lg transition-colors"
            >
              {loading ? 'Grading…' : 'Reveal recipe'}
            </button>
          ) : (
            <button
              onClick={next}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg transition-colors"
            >
              Next matchup →
            </button>
          )}
        </div>
      </div>

      <div className="overflow-y-auto pr-2">
        {submitted && score && truth ? (
          <ScoreReveal score={score} truth={truth} matchup={matchup} pickedEquity={pickedEquity / 100} />
        ) : (
          <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-6 min-h-[400px] flex items-center justify-center text-sm text-gray-500 text-center px-8">
            Pick shape → lane → equity, then reveal to see how each step scored.
          </div>
        )}
        <RecentStats drills={recipeDrills.slice(0, 10)} />
      </div>
    </div>
  );
};

const StepShape = ({ enabled, picked, truth, submitted, onPick }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
    <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Step 1 — pick your shape</div>
    <div className="grid grid-cols-2 gap-2">
      {SHAPES.map((s) => {
        const isPicked = picked?.id === s.id;
        const isTruth = submitted && truth?.id === s.id;
        const isWrong = submitted && isPicked && !isTruth;
        return (
          <button
            key={s.id}
            onClick={() => enabled && onPick(s)}
            disabled={!enabled}
            className={`text-left px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              isTruth ? 'bg-emerald-900/40 border-emerald-600 text-emerald-100'
              : isWrong ? 'bg-rose-900/40 border-rose-600 text-rose-100'
              : isPicked ? 'bg-purple-900/40 border-purple-600 text-purple-100'
              : 'bg-gray-900/60 border-gray-700 hover:border-gray-600 text-gray-200'
            }`}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  </div>
);

const StepLane = ({ shape, picked, truth, submitted, enabled, onPick }) => {
  if (!shape) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
        Step 2 — pick the lane within {shape.name}
      </div>
      <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
        {shape.lanes.map((lane) => {
          const isPicked = picked?.id === lane.id;
          const isTruth = submitted && truth?.id === lane.id;
          const isWrong = submitted && isPicked && !isTruth;
          return (
            <button
              key={lane.id}
              onClick={() => enabled && onPick(lane)}
              disabled={!enabled}
              className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors flex items-center justify-between gap-3 ${
                isTruth ? 'bg-emerald-900/40 border-emerald-600 text-emerald-100'
                : isWrong ? 'bg-rose-900/40 border-rose-600 text-rose-100'
                : isPicked ? 'bg-purple-900/40 border-purple-600 text-purple-100'
                : 'bg-gray-900/60 border-gray-700 hover:border-gray-600 text-gray-200'
              }`}
            >
              <span className="flex-1">{lane.villainDesc}</span>
              <span className="font-mono text-[10px] text-gray-400">{lane.id}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const StepModifiers = ({ lane, picked, truth, submitted, enabled, onToggle, onAdvance }) => {
  const keys = Object.keys(lane.modifiers || {});
  const truthSet = useMemo(() => new Set(truth), [truth]);

  if (keys.length === 0) {
    // Lane has no declared modifiers — show an informational card and auto-
    // advance. Still counts as "correct no modifiers" for grading.
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
          Step 3 — modifiers
        </div>
        <div className="text-sm text-gray-300">
          This lane has no modifiers declared — the base equity already accounts for the structural shape. Skip to Step 4.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
        Step 3 — check the modifiers that apply to <em>this</em> matchup
      </div>
      <div className="space-y-2">
        {keys.map((key) => {
          const delta = lane.modifiers[key];
          const isPicked = picked.has(key);
          const isTruth = submitted && truthSet.has(key);
          const isWrong = submitted && isPicked && !isTruth;
          const isMissed = submitted && !isPicked && isTruth;
          return (
            <button
              key={key}
              onClick={() => enabled && onToggle(key)}
              disabled={!enabled}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm flex items-center gap-3 transition-colors ${
                isTruth && isPicked ? 'bg-emerald-900/40 border-emerald-600 text-emerald-100'
                : isWrong ? 'bg-rose-900/40 border-rose-600 text-rose-100'
                : isMissed ? 'bg-amber-900/40 border-amber-600 text-amber-100'
                : isPicked ? 'bg-purple-900/40 border-purple-600 text-purple-100'
                : 'bg-gray-900/60 border-gray-700 hover:border-gray-600 text-gray-200'
              }`}
            >
              <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center text-xs ${
                isTruth && isPicked ? 'border-emerald-400 bg-emerald-600 text-white'
                : isWrong ? 'border-rose-400 bg-rose-600 text-white'
                : isMissed ? 'border-amber-400 bg-amber-600 text-white'
                : isPicked ? 'border-purple-400 bg-purple-600 text-white'
                : 'border-gray-600 bg-gray-800 text-transparent'
              }`}>
                {isPicked || isMissed ? '✓' : ''}
              </div>
              <div className="flex-1">
                <div className="font-medium">{modifierLabel(key)}</div>
              </div>
              <div className={`text-xs font-mono ${delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
              </div>
            </button>
          );
        })}
      </div>
      {!submitted && enabled && (
        <button
          onClick={onAdvance}
          className="mt-3 w-full text-xs text-gray-400 hover:text-gray-200 underline"
        >
          Continue to equity step
        </button>
      )}
    </div>
  );
};

const StepEquity = ({ lane, value, onChange, submitted, truthEquity, equityCorrect }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
    <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
      Step 3 — estimate hero's equity (band hint: {(lane.band[0] * 100).toFixed(0)}–{(lane.band[1] * 100).toFixed(0)}%, anchor {(lane.baseEquity * 100).toFixed(0)}%)
    </div>
    <div className="flex justify-between items-end mb-3">
      <div className="text-sm text-gray-300">Final equity</div>
      <div className={`text-3xl font-bold w-20 text-right ${
        submitted ? (equityCorrect ? 'text-emerald-300' : 'text-rose-300') : 'text-purple-300'
      }`}>
        {value}%
      </div>
    </div>
    <input
      type="range" min="0" max="100" step="1"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={submitted}
      className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
    />
    {submitted && (
      <div className="mt-3 text-xs text-gray-300">
        Truth: <span className="text-emerald-300 font-semibold">{(truthEquity * 100).toFixed(1)}%</span>
        {' · '}
        delta {(Math.abs(value / 100 - truthEquity) * 100).toFixed(1)}%
      </div>
    )}
  </div>
);

const ScoreReveal = ({ score, truth, matchup, pickedEquity }) => {
  const hasModStep = score.modifiersCorrect !== null;
  const maxStars = score.maxStars || 3;
  const modifiersLabel = (() => {
    if (!hasModStep) return null;
    if (truth.modifiers.length === 0) return '(none — no modifiers apply)';
    return truth.modifiers.map(modifierLabel).join(', ');
  })();
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Recipe scored</div>
      <div className="text-3xl font-bold mb-3">
        {renderStars(score.stars, maxStars)}
        <span className="text-sm font-normal text-gray-400 ml-3">{score.stars}/{maxStars} steps</span>
      </div>
      <div className="space-y-2 text-sm">
        <ScoreRow label="Shape" got={score.shapeCorrect} answer={truth.shape.name} />
        <ScoreRow label="Lane" got={score.laneCorrect} answer={truth.lane?.villainDesc || '(none)'} />
        {hasModStep && (
          <ScoreRow
            label="Modifiers"
            got={score.modifiersCorrect}
            answer={modifiersLabel}
            detail={
              score.modifiersCorrect
                ? null
                : `missed: ${score.modifierFn.map(modifierLabel).join(', ') || '(none)'} · extra: ${score.modifierFp.map(modifierLabel).join(', ') || '(none)'}`
            }
          />
        )}
        <ScoreRow
          label="Equity"
          got={score.equityCorrect}
          answer={`${(truth.equity * 100).toFixed(1)}% (you said ${(pickedEquity * 100).toFixed(0)}%, delta ${(score.equityDelta * 100).toFixed(1)}%)`}
        />
      </div>
      <div className="mt-4 text-xs text-gray-500">
        {matchup.a} vs {matchup.b} — exact equity computed from full board enumeration.
      </div>
    </div>
  );
};

const ScoreRow = ({ label, got, answer, detail }) => (
  <div className={`flex gap-3 px-3 py-2 rounded ${got ? 'bg-emerald-900/30' : 'bg-rose-900/30'}`}>
    <div className={`w-5 ${got ? 'text-emerald-400' : 'text-rose-400'}`}>
      {got ? '✓' : '✗'}
    </div>
    <div className="flex-1">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`text-sm ${got ? 'text-emerald-100' : 'text-rose-100'}`}>{answer}</div>
      {detail && <div className="text-[11px] text-gray-400 mt-0.5">{detail}</div>}
    </div>
  </div>
);

const RecentStats = ({ drills }) => {
  if (drills.length === 0) return null;
  const total = drills.length;
  const fullyCorrect = drills.filter((d) => d.correct).length;
  const avgDelta = drills.reduce((s, d) => s + (d.delta || 0), 0) / total;
  return (
    <div className="mt-4 bg-gray-800/50 border border-gray-800 rounded-lg p-4 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-500">Last {total} attempts — full-credit</span>
        <span className="text-emerald-400 font-semibold">{fullyCorrect}/{total}</span>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-gray-500">Avg equity delta</span>
        <span className="text-gray-300">±{(avgDelta * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
};

const renderStars = (n, max = 3) =>
  '★'.repeat(n).padEnd(max, '☆').split('').map((c, i) => (
    <span key={i} className={c === '★' ? 'text-amber-400' : 'text-gray-600'}>{c}</span>
  ));
