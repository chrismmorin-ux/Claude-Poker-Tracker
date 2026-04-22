import React, { useMemo, useState } from 'react';
import {
  flopPairEitherRank,
  flopPairOneRank,
  flushCompletionExact,
  ruleOf4And2,
  directStraightRuns,
  singleCardStraightRuns,
  breakEvenEquity,
  independentRunouts,
} from '../../../utils/pokerCore/combinatorics';
import { CALCULATOR_NAMES } from '../../../utils/drillContent/calculatorRegistry';

/**
 * LessonCalculators.jsx — small interactive calculators embedded in lessons.
 *
 * Each calculator is a pure React component wrapping a helper from
 * `combinatorics.js`. Calculators have local `useState` for inputs — no
 * cross-component state, no persistence.
 *
 * Exported as a `CALCULATORS` registry keyed by name. The lesson renderer
 * looks up the calculator by the name in `{ kind: 'compute', calculator }`.
 *
 * Design:
 *   - Inputs on the left / top
 *   - Outputs on the right / bottom with BOTH the rule-of-thumb and the
 *     exact value, so the user sees the calibration gap
 *   - Formula strings visible so the user learns the math, not just the
 *     answer
 */

const RANK_CHARS = '23456789TJQKA';

// ---------- Shared primitives ---------- //

const Card = ({ children, highlight = false }) => (
  <span
    className={`inline-flex items-center justify-center w-8 h-10 rounded text-lg font-bold border ${
      highlight
        ? 'bg-amber-500/20 border-amber-500 text-amber-200'
        : 'bg-gray-800 border-gray-600 text-gray-200'
    }`}
  >
    {children}
  </span>
);

const Value = ({ label, value, color = 'text-emerald-300' }) => (
  <div className="bg-gray-900/70 rounded px-3 py-2">
    <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
    <div className={`text-lg font-bold ${color}`}>{value}</div>
  </div>
);

const Formula = ({ children }) => (
  <div className="bg-gray-900 border border-gray-800 rounded px-3 py-2 font-mono text-xs text-emerald-300 leading-relaxed">
    {children}
  </div>
);

const Row = ({ label, children }) => (
  <div className="flex items-center gap-3">
    <label className="text-xs uppercase tracking-wide text-gray-500 w-28 shrink-0">{label}</label>
    <div className="flex-1">{children}</div>
  </div>
);

// ---------- FlopPair calculator ---------- //

const FlopPairCalculator = () => {
  const [mode, setMode] = useState('unpaired'); // unpaired | pocket_pair

  const result = useMemo(() => {
    if (mode === 'pocket_pair') {
      return flopPairOneRank(2, 50, 3);
    }
    return flopPairEitherRank(3, 3, 50);
  }, [mode]);

  return (
    <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-4 space-y-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">Calculator: Flop a pair</div>

      <div className="flex gap-2 text-xs">
        <button
          onClick={() => setMode('unpaired')}
          className={`px-3 py-1.5 rounded transition-colors ${
            mode === 'unpaired' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Unpaired hand (AK, QJ, 72 …)
        </button>
        <button
          onClick={() => setMode('pocket_pair')}
          className={`px-3 py-1.5 rounded transition-colors ${
            mode === 'pocket_pair' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Pocket pair (flop a set)
        </button>
      </div>

      {mode === 'unpaired' ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Value label="P(pair either rank)" value={`${(result.pEither * 100).toFixed(1)}%`} />
            <Value label="P(pair just one)"   value={`${((result.pHitR1 + result.pHitR2 - 2 * result.pHitBoth) * 100).toFixed(1)}%`} color="text-sky-300" />
            <Value label="P(pair both)"       value={`${(result.pHitBoth * 100).toFixed(1)}%`} color="text-amber-300" />
          </div>
          <Formula>
            P(either) = 1 − C(44, 3) / C(50, 3) = {(result.pEither * 100).toFixed(2)}%
            {'\n'}Mental: each rank ~17% → P(either) ≈ 17 + 17 − 2 = 32%.
          </Formula>
          <p className="text-xs text-gray-400 leading-relaxed">
            Hero holds two distinct ranks — 3 cards of each remain in the 50 unseen. Inclusion–exclusion:
            {' '}P(pair A or K) = P(A) + P(K) − P(both). The "both" term is small (≈2%), so the quick
            mental is just "add them and subtract 2."
          </p>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Value label="P(flop a set)" value={result.pctExact} />
            <Value label="Rule of thumb" value="~11.8% (1 in 8.5)" color="text-sky-300" />
          </div>
          <Formula>
            P(set) = 1 − C(48, 3) / C(50, 3) = {result.pctExact}
            {'\n'}2 matching cards remain in 50 unseen, 3 flop slots.
          </Formula>
          <p className="text-xs text-gray-400 leading-relaxed">
            Hero holds a pocket pair. Only 2 cards of that rank remain. Most times the flop misses
            — set-mining is a "1 in 8.5" event. Don't chase with a pair unless implied odds justify
            the 88% miss rate.
          </p>
        </>
      )}
    </div>
  );
};

// ---------- FlushOuts calculator ---------- //

const FlushOutsCalculator = () => {
  const [blockers, setBlockers] = useState(0);
  const [street, setStreet] = useState('flop'); // flop | turn

  const flush = useMemo(() => flushCompletionExact(blockers, street), [blockers, street]);
  const rule  = useMemo(() => ruleOf4And2(flush.outs, street), [flush.outs, street]);

  return (
    <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-4 space-y-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">Calculator: Flush outs & completion</div>

      <Row label="Blockers">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="9"
            step="1"
            value={blockers}
            onChange={(e) => setBlockers(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-700 rounded-lg cursor-pointer accent-purple-500"
          />
          <span className="text-sm text-gray-200 font-mono w-6 text-right">{blockers}</span>
        </div>
      </Row>

      <Row label="Street">
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setStreet('flop')}
            className={`px-3 py-1 rounded ${
              street === 'flop' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Flop (2 cards to come)
          </button>
          <button
            onClick={() => setStreet('turn')}
            className={`px-3 py-1 rounded ${
              street === 'turn' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Turn (1 card to come)
          </button>
        </div>
      </Row>

      <div className="grid grid-cols-3 gap-2">
        <Value label="Live outs" value={flush.outs} />
        <Value label="P(complete) exact" value={`${(flush.exact * 100).toFixed(1)}%`} />
        <Value label={`Rule of ${street === 'flop' ? 4 : 2}`} value={`${(rule.rule * 100).toFixed(1)}%`} color="text-sky-300" />
      </div>

      <Formula>
        {street === 'flop'
          ? `P(miss both) = ${flush.unseen - flush.outs}/${flush.unseen} × ${flush.unseen - 1 - flush.outs}/${flush.unseen - 1} = ${((1 - flush.exact) * 100).toFixed(1)}%`
          : `P(hit river) = ${flush.outs}/${flush.unseen} = ${(flush.exact * 100).toFixed(1)}%`}
        {'\n'}Rule: outs × {street === 'flop' ? 4 : 2} = {flush.outs * (street === 'flop' ? 4 : 2)}% (approx).
        {'\n'}Gap: {((rule.rule - flush.exact) * 100 >= 0 ? '+' : '')}{((rule.rule - flush.exact) * 100).toFixed(1)}pp.
      </Formula>

      <p className="text-xs text-gray-400 leading-relaxed">
        Each blocker villain holds reduces live outs 1-for-1. 9 outs (nut flush draw, 0 blockers) on
        the flop = 35.0% exact vs 36% rule — the rule overshoots slightly because outs can't both hit
        (double-counted in the linear rule). For 9+ outs (combo draws), always use exact.
      </p>
    </div>
  );
};

// ---------- StraightRuns calculator ---------- //

const StraightRunsCalculator = () => {
  const [rankHigh, setRankHigh] = useState(9); // J (index 9)
  const [rankLow, setRankLow]   = useState(8); // T (index 8)

  // Ensure high >= low
  const hi = Math.max(rankHigh, rankLow);
  const lo = Math.min(rankHigh, rankLow);

  const direct = useMemo(() => directStraightRuns(hi, lo), [hi, lo]);
  const single = useMemo(() => singleCardStraightRuns(hi, lo), [hi, lo]);

  const coverageScore = direct.length * 2 + single.length * 0.7;
  const highLabel = RANK_CHARS[hi];
  const lowLabel = RANK_CHARS[lo];

  return (
    <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-4 space-y-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">Calculator: Straight coverage</div>

      <Row label="High card">
        <RankPicker value={hi} onChange={setRankHigh} />
      </Row>
      <Row label="Low card">
        <RankPicker value={lo} onChange={setRankLow} />
      </Row>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Hand:</span>
        <Card highlight>{highLabel}</Card>
        <Card highlight>{lowLabel}</Card>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Value label="Direct runs" value={direct.length} />
        <Value label="Single-card runs" value={single.length} color="text-sky-300" />
        <Value label="Coverage score" value={coverageScore.toFixed(1)} color="text-amber-300" />
      </div>

      <div className="bg-gray-900/70 rounded p-3 text-xs font-mono text-gray-300 space-y-1">
        <div>
          <span className="text-amber-300">Direct:</span>
          {' '}
          {direct.length === 0 ? 'none' : direct.map(runLabel).join(', ')}
        </div>
        <div>
          <span className="text-sky-300">Single-card:</span>
          {' '}
          {single.length === 0 ? 'none' : single.map((s) => `${runLabel(s.runHigh)} via ${RANK_CHARS[s.contributingRank]}`).join(', ')}
        </div>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">
        Direct runs use BOTH hole cards (≈ +2pp river equity each). Single-card runs use one hole card
        plus 4 board cards (≈ +0.7pp each). Blockers (e.g., villain holds an A) kill runs that need
        that specific rank. Coverage score = 2·direct + 0.7·single — the quick "how much straight
        equity does this hand have" number.
      </p>
    </div>
  );
};

const RankPicker = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600"
  >
    {RANK_CHARS.split('').map((c, r) => (
      <option key={r} value={r}>{c}</option>
    ))}
  </select>
);

const runLabel = (runHigh) => {
  if (runHigh === 3) return 'A2345 (wheel)';
  const high = RANK_CHARS[runHigh];
  const low = RANK_CHARS[runHigh - 4];
  return `${low}${RANK_CHARS[runHigh - 3]}${RANK_CHARS[runHigh - 2]}${RANK_CHARS[runHigh - 1]}${high}`;
};

// ---------- PotOdds calculator ---------- //

// LSW-H1 (2026-04-22): accept optional `initialPot` / `initialBet` props so
// calling sites can seed the calculator from a line node's context. When
// absent or invalid, falls back to the prior generic defaults (100/50) so
// the preflop-lesson callers that don't seed continue to work unchanged.
const toFiniteNonNeg = (n, fallback) =>
  (Number.isFinite(n) && n >= 0 ? n : fallback);
const toFinitePositive = (n, fallback) =>
  (Number.isFinite(n) && n > 0 ? n : fallback);

const PotOddsCalculator = ({ initialPot, initialBet } = {}) => {
  const [pot, setPot] = useState(() => toFiniteNonNeg(initialPot, 100));
  const [bet, setBet] = useState(() => toFinitePositive(initialBet, 50));

  const result = useMemo(() => {
    if (bet <= 0) return null;
    return breakEvenEquity(pot, bet);
  }, [pot, bet]);

  return (
    <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-4 space-y-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">Calculator: Pot odds &amp; break-even equity</div>

      <div className="grid grid-cols-2 gap-3">
        <Row label="Pot size">
          <input
            type="number"
            min="0"
            value={pot}
            onChange={(e) => setPot(Math.max(0, Number(e.target.value) || 0))}
            className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600"
          />
        </Row>
        <Row label="Bet to call">
          <input
            type="number"
            min="1"
            value={bet}
            onChange={(e) => setBet(Math.max(1, Number(e.target.value) || 1))}
            className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600"
          />
        </Row>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Value label="Break-even equity" value={result.pctEquity} />
            <Value label="Pot lays you" value={result.ratioLabel} color="text-sky-300" />
          </div>
          <Formula>
            BE = bet / (pot + 2·bet) = {bet} / ({pot} + {2 * bet}) = {result.pctEquity}
            {'\n'}Ratio = (pot + bet) / bet = ({pot} + {bet}) / {bet} = {result.ratioLabel}
          </Formula>
          <p className="text-xs text-gray-400 leading-relaxed">
            You need at least <strong className="text-emerald-300">{result.pctEquity}</strong> equity
            to profitably call. Pot-sized bet → 33% required; half-pot → 25%; overbet 2× pot → 40%.
            Memorize the bet-size → equity ladder and compare to your estimated equity against
            villain's range.
          </p>
        </>
      )}
    </div>
  );
};

// ---------- Runouts calculator ---------- //

const RunoutsCalculator = () => {
  const [equityPct, setEquityPct] = useState(40);
  const [runs, setRuns] = useState(2);

  const result = useMemo(() => independentRunouts(equityPct / 100, runs), [equityPct, runs]);

  return (
    <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-4 space-y-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">Calculator: Multiple runouts</div>

      <Row label="Equity">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="99"
            value={equityPct}
            onChange={(e) => setEquityPct(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-700 rounded-lg cursor-pointer accent-purple-500"
          />
          <span className="text-sm text-gray-200 font-mono w-12 text-right">{equityPct}%</span>
        </div>
      </Row>
      <Row label="Runs">
        <div className="flex gap-2 text-xs">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setRuns(n)}
              className={`px-3 py-1 rounded ${
                runs === n ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {n}×
            </button>
          ))}
        </div>
      </Row>

      <div className="grid grid-cols-4 gap-2">
        <Value label="Win all" value={`${(result.allSucceed * 100).toFixed(1)}%`} color="text-amber-300" />
        <Value label="Win exactly one" value={`${(result.exactlyOne * 100).toFixed(1)}%`} color="text-sky-300" />
        <Value label="At least one" value={`${(result.atLeastOne * 100).toFixed(1)}%`} />
        <Value label="Expected wins" value={result.expectedWins.toFixed(2)} color="text-gray-300" />
      </div>

      <Formula>
        P(win all) = p^N = {(equityPct / 100).toFixed(2)}^{runs} = {(result.allSucceed * 100).toFixed(1)}%
        {'\n'}P(at least one) = 1 − (1 − p)^N = 1 − {(1 - equityPct / 100).toFixed(2)}^{runs} = {(result.atLeastOne * 100).toFixed(1)}%
        {'\n'}EV unchanged: expected wins = p × N = {result.expectedWins.toFixed(2)} of {runs}.
      </Formula>

      <p className="text-xs text-gray-400 leading-relaxed">
        Running it twice (or more) does NOT change your EV — it only reduces variance on the outcome
        of THIS specific all-in. At 40% equity, single run wins 40%; run it twice wins at least once
        64% of the time. The expected-wins column tells you the long-run value; the at-least-one
        column tells you your short-term "save".
      </p>
    </div>
  );
};

// ---------- Registry ---------- //

export const CALCULATORS = {
  flopPair:     FlopPairCalculator,
  flushOuts:    FlushOutsCalculator,
  straightRuns: StraightRunsCalculator,
  potOdds:      PotOddsCalculator,
  runouts:      RunoutsCalculator,
};

// Parity check: every name in the data-layer registry must have a matching
// React component here, and vice versa. Fires at module load in dev so drift
// surfaces immediately instead of producing a runtime "undefined component"
// when a lesson references a missing calculator. RT-95.
if (import.meta.env.DEV) {
  const registryNames = new Set(CALCULATOR_NAMES);
  const componentNames = new Set(Object.keys(CALCULATORS));
  const missingComponents = [...registryNames].filter((n) => !componentNames.has(n));
  const orphanComponents = [...componentNames].filter((n) => !registryNames.has(n));
  if (missingComponents.length || orphanComponents.length) {
    // eslint-disable-next-line no-console
    console.warn('[LessonCalculators] registry drift:',
      missingComponents.length ? `missing components for ${missingComponents.join(', ')}` : '',
      orphanComponents.length ? `orphan components ${orphanComponents.join(', ')}` : '');
  }
}
