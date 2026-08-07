import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Info } from 'lucide-react';
import {
  computeWinRate,
  computeWinRateInterval,
  computeRiskOfRuin,
  computeRequiredBankroll,
  computeKelly,
  computeDrawdown,
  computeAdjustedWinRate,
  partitionSessions,
  MIN_SESSIONS_FOR_INTERVAL,
} from '../../../utils/sessionStats/bankrollVariance';
import { computeSessionAdjustment } from '../../../utils/handStats/allInEquity';
import { getHandsBySessionId } from '../../../utils/persistence/index';
import { logger } from '../../../utils/errorHandler';

/** Signed currency, e.g. +$150 / -$80. */
const money = (n, decimals = 0) =>
  `${n >= 0 ? '+' : '-'}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

/** Unsigned currency for bankroll amounts, which are never negative. */
const dollars = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

const pnlClass = (n) => (n > 0 ? 'text-emerald-400' : n < 0 ? 'text-red-400' : 'text-gray-300');

/**
 * Marks a figure that is projected rather than measured.
 * POKER_THEORY §14.4: "Any figure derived through an unobserved-completion
 * assumption is stamped as modelled."
 */
const ModelledTag = () => (
  <span
    className="ml-1.5 px-1.5 py-0.5 rounded text-[0.625rem] font-semibold uppercase tracking-wide bg-amber-900/40 text-amber-400 align-middle"
    title="Projected from your win rate and swings, not directly measured"
    data-testid="modelled-tag"
  >
    modelled
  </span>
);

const Block = ({ title, children, modelled = false, footnote }) => (
  <div className="bg-gray-900/40 rounded-lg p-3">
    <div className="text-xs font-semibold text-gray-400 mb-2">
      {title}
      {modelled && <ModelledTag />}
    </div>
    {children}
    {footnote && <div className="mt-2 text-[0.6875rem] text-gray-500 leading-snug">{footnote}</div>}
  </div>
);

const Row = ({ label, value, valueClass = 'text-gray-100' }) => (
  <div className="flex items-baseline justify-between gap-3 py-0.5">
    <span className="text-sm text-gray-400 truncate">{label}</span>
    <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${valueClass}`}>{value}</span>
  </div>
);

/**
 * Horizontal band showing where the true win rate plausibly sits, with a zero
 * marker. Reading the interval against zero is the whole point, so zero is drawn
 * whenever it falls inside the plotted range.
 */
const IntervalBar = ({ ci95, ci70, observed }) => {
  const lo = Math.min(ci95.low, 0);
  const hi = Math.max(ci95.high, 0);
  const span = hi - lo || 1;
  const pct = (v) => ((v - lo) / span) * 100;

  return (
    <div className="mt-2 mb-1" data-testid="interval-bar">
      <div className="relative h-7">
        {/* 95% band */}
        <div
          className="absolute top-2.5 h-2 rounded-full bg-blue-900/60"
          style={{ left: `${pct(ci95.low)}%`, width: `${pct(ci95.high) - pct(ci95.low)}%` }}
        />
        {/* 70% band */}
        <div
          className="absolute top-2.5 h-2 rounded-full bg-blue-500/70"
          style={{ left: `${pct(ci70.low)}%`, width: `${pct(ci70.high) - pct(ci70.low)}%` }}
        />
        {/* Zero line */}
        {lo <= 0 && hi >= 0 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-400"
            style={{ left: `${pct(0)}%` }}
            data-testid="interval-zero"
          >
            <span className="absolute -top-0.5 left-1 text-[0.625rem] text-gray-400">$0</span>
          </div>
        )}
        {/* Observed rate */}
        <div
          className="absolute top-1.5 w-1 h-4 rounded bg-white"
          style={{ left: `${pct(observed)}%` }}
        />
      </div>
      <div className="flex justify-between text-[0.6875rem] text-gray-500 tabular-nums">
        <span>{money(ci95.low)}/hr</span>
        <span>{money(ci95.high)}/hr</span>
      </div>
    </div>
  );
};

const TOLERANCES = [0.01, 0.05, 0.1];

/**
 * VarianceBand — the bankroll questions the founder's spreadsheet posed and left
 * blank: is the win rate real, how big must the bankroll be, how deep do the
 * downswings go, and what stake does the roll support.
 *
 * Mounted below the Insights band in SessionsView. Kept separate because
 * InsightsBand is already dense, and because these figures answer a different
 * question — Insights reports what happened, this reports what it means.
 *
 * Every block names its sample size, and projected figures carry a "modelled"
 * tag, per POKER_THEORY §14.4. The cluster unit is the session throughout.
 *
 * @param {Object} props
 * @param {Array<Object>} props.sessions — past sessions in the current scope.
 * @param {string} [props.scopeLabel] — e.g. "Live", "Online".
 */
export const VarianceBand = ({ sessions = [], scopeLabel }) => {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sessionsView.varianceCollapsed') === '1';
    } catch {
      return false;
    }
  });

  const [tolerance, setTolerance] = useState(() => {
    try {
      const stored = parseFloat(localStorage.getItem('sessionsView.ruinTolerance'));
      return TOLERANCES.includes(stored) ? stored : 0.05;
    } catch {
      return 0.05;
    }
  });

  const [bankroll, setBankroll] = useState(() => {
    try {
      return localStorage.getItem('sessionsView.bankroll') || '';
    } catch {
      return '';
    }
  });

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sessionsView.varianceCollapsed', next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  const handleTolerance = (next) => {
    setTolerance(next);
    try {
      localStorage.setItem('sessionsView.ruinTolerance', String(next));
    } catch {}
  };

  const handleBankroll = (next) => {
    setBankroll(next);
    try {
      localStorage.setItem('sessionsView.bankroll', next);
    } catch {}
  };

  // All-in EV adjustment. Hands are loaded lazily per session in the current
  // scope; sessions with no recorded hands (every imported spreadsheet row)
  // simply contribute nothing, which is why coverage is always displayed.
  const [adjustment, setAdjustment] = useState(null);
  const sampleIds = useMemo(
    () => partitionSessions(sessions).sample.map((s) => s.sessionId).filter((id) => id != null),
    [sessions]
  );
  const sampleKey = sampleIds.join(',');

  useEffect(() => {
    let cancelled = false;
    if (sampleIds.length === 0) { setAdjustment(null); return undefined; }

    (async () => {
      try {
        const byId = new Map(
          partitionSessions(sessions).sample.map((s) => [s.sessionId, s])
        );
        let delta = 0;
        let adjustedHands = 0;
        let totalHands = 0;
        for (const id of sampleIds) {
          const hands = await getHandsBySessionId(id);
          if (!hands || hands.length === 0) continue;
          const session = byId.get(id);
          const result = computeSessionAdjustment(hands, { gameType: session?.gameType });
          delta += result.delta;
          adjustedHands += result.adjustedHands;
          totalHands += result.totalHands;
        }
        if (!cancelled) setAdjustment({ delta, adjustedHands, totalHands });
      } catch (err) {
        logger.error('VarianceBand all-in adjustment', err);
        if (!cancelled) setAdjustment(null);
      }
    })();

    return () => { cancelled = true; };
    // sampleKey collapses the id list to a stable primitive so this re-runs when
    // the scoped sample actually changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleKey]);

  const stats = useMemo(() => computeWinRate(sessions), [sessions]);
  const ci70 = useMemo(() => computeWinRateInterval(stats, 70), [stats]);
  const ci95 = useMemo(() => computeWinRateInterval(stats, 95), [stats]);
  const excluded = useMemo(() => partitionSessions(sessions), [sessions]);
  const drawdown = useMemo(() => computeDrawdown(sessions), [sessions]);
  const required = useMemo(() => computeRequiredBankroll(stats, tolerance), [stats, tolerance]);
  const adjusted = useMemo(() => computeAdjustedWinRate(stats, adjustment), [stats, adjustment]);
  const kelly = useMemo(() => computeKelly(stats), [stats]);

  const bankrollValue = parseFloat(bankroll);
  const ruin = useMemo(
    () => (Number.isFinite(bankrollValue) && bankrollValue > 0
      ? computeRiskOfRuin(stats, bankrollValue)
      : null),
    [stats, bankrollValue]
  );

  // Nothing to say without a cash sample.
  if (stats.n === 0) return null;

  const excludedNote = [
    excluded.tournaments.length
      ? `${excluded.tournaments.length} tournament${excluded.tournaments.length === 1 ? '' : 's'}`
      : null,
    excluded.noDuration.length
      ? `${excluded.noDuration.length} without a recorded time`
      : null,
  ].filter(Boolean);

  return (
    <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg" data-testid="variance-band">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="w-full flex items-center justify-between p-4 min-h-[44px]"
      >
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-blue-400" />
          <h2 className="text-lg font-bold text-gray-200">Bankroll &amp; Variance</h2>
          {scopeLabel && <span className="text-xs text-gray-500">· {scopeLabel}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-lg font-bold tabular-nums ${pnlClass(stats.mu ?? 0)}`}>
            {stats.mu === null ? '—' : `${money(stats.mu)}/hr`}
          </span>
          {collapsed ? (
            <ChevronDown size={18} className="text-gray-400" />
          ) : (
            <ChevronUp size={18} className="text-gray-400" />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {/* ---------------------------------------------------------------
              1. Is the win rate real?
             --------------------------------------------------------------- */}
          <Block
            title="What your win rate really is"
            footnote={
              <>
                Based on <strong className="text-gray-400">{stats.n} cash sessions</strong> over{' '}
                {stats.hours.toFixed(0)} hours
                {excludedNote.length > 0 && <> · excludes {excludedNote.join(' and ')}</>}.
              </>
            }
          >
            <Row
              label="Measured so far"
              value={stats.mu === null ? '—' : `${money(stats.mu, 2)}/hr`}
              valueClass={pnlClass(stats.mu ?? 0)}
            />
            <Row
              label="Swing per hour (std dev)"
              value={stats.sigmaPerHour === null ? '—' : `$${Math.round(stats.sigmaPerHour).toLocaleString()}`}
            />

            {/* All-in EV adjusted rate — beside the measured one, never instead
                of it. Coverage is always stated: an adjustment over 0 hands is
                not a confirmation of the raw number. */}
            {adjusted && (
              <div className="mt-2 pt-2 border-t border-gray-800" data-testid="adjusted-rate">
                {adjusted.covers ? (
                  <>
                    <div className="flex items-baseline justify-between gap-3 py-0.5">
                      <span className="text-sm text-gray-400 truncate">
                        Adjusted for all-in luck
                        <ModelledTag />
                      </span>
                      <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${pnlClass(adjusted.mu)}`}>
                        {money(adjusted.mu, 2)}/hr
                      </span>
                    </div>
                    <div className="text-[0.6875rem] text-gray-500 leading-snug mt-1">
                      Replaces the result of {adjusted.adjustedHands} all-in hand
                      {adjusted.adjustedHands === 1 ? '' : 's'} with the equity you had when the
                      money went in ({money(adjusted.delta)} across{' '}
                      {adjusted.totalHands.toLocaleString()} recorded hand
                      {adjusted.totalHands === 1 ? '' : 's'}). Only all-in pots are corrected —
                      coolers you paid off with chips behind still count in full.
                    </div>
                  </>
                ) : (
                  <div className="text-[0.6875rem] text-gray-500 leading-snug" data-testid="adjusted-rate-empty">
                    No all-in hands recorded yet, so there is nothing to adjust for luck. This
                    fills in once you track hands where the money goes in and both hands are known.
                  </div>
                )}
              </div>
            )}

            {ci95 && ci70 ? (
              <>
                <IntervalBar ci95={ci95} ci70={ci70} observed={stats.mu} />
                <Row
                  label="Likely range (70% sure)"
                  value={`${money(ci70.low)} … ${money(ci70.high)}`}
                />
                <Row
                  label="Wider range (95% sure)"
                  value={`${money(ci95.low)} … ${money(ci95.high)}`}
                />
                <div
                  className={`mt-2 flex gap-2 text-xs leading-snug rounded-lg p-2 ${
                    ci95.straddlesZero
                      ? 'bg-amber-900/30 text-amber-300'
                      : 'bg-emerald-900/30 text-emerald-300'
                  }`}
                  data-testid="interval-verdict"
                >
                  <Info size={14} className="flex-shrink-0 mt-0.5" />
                  <span>
                    {ci95.straddlesZero ? (
                      <>
                        Your results are still consistent with breaking even or losing. Poker
                        swings are wide enough that {stats.n} sessions can&apos;t yet prove a
                        winning rate — keep logging, the range narrows as sessions add up.
                      </>
                    ) : (
                      <>
                        Your results are strong enough that the swings alone can&apos;t explain
                        them — this reads as a genuine winning rate.
                      </>
                    )}
                  </span>
                </div>
              </>
            ) : (
              <div className="mt-2 text-xs text-gray-500 leading-snug">
                Needs {MIN_SESSIONS_FOR_INTERVAL} cash sessions before a meaningful range can be
                drawn — you have {stats.n}.
              </div>
            )}
          </Block>

          {/* ---------------------------------------------------------------
              2. How big does the bankroll need to be?
             --------------------------------------------------------------- */}
          <Block
            title="Bankroll you need"
            modelled
            footnote="Assumes your measured win rate and swings hold, and that you keep playing these stakes."
          >
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs text-gray-500">Chance of going broke you&apos;ll accept:</span>
              {TOLERANCES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTolerance(t)}
                  aria-pressed={tolerance === t}
                  className={`px-4 min-h-[44px] text-xs font-semibold rounded-full transition-colors ${
                    tolerance === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  data-testid={`tolerance-${t}`}
                >
                  {`${t * 100}%`}
                </button>
              ))}
            </div>

            {required ? (
              <Row
                label={`Bankroll for a ${tolerance * 100}% risk`}
                value={dollars(required.bankroll)}
              />
            ) : (
              <div className="text-xs text-amber-300 leading-snug" data-testid="no-required-bankroll">
                No bankroll makes this survivable at a break-even or losing rate. The fix is a
                higher win rate, not a bigger roll.
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-gray-800">
              <label className="text-xs text-gray-500 block mb-1" htmlFor="variance-bankroll">
                Your current bankroll
              </label>
              <input
                id="variance-bankroll"
                type="number"
                inputMode="decimal"
                value={bankroll}
                onChange={(e) => handleBankroll(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full px-3 min-h-[44px] bg-gray-700 text-gray-200 text-sm rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                data-testid="bankroll-input"
              />
              {ruin && (
                <div className="mt-2" data-testid="ruin-result">
                  <Row
                    label="Chance of losing it all"
                    value={
                      ruin.certain
                        ? 'Certain'
                        : ruin.probability < 0.001
                          ? '<0.1%'
                          : `${(ruin.probability * 100).toFixed(1)}%`
                    }
                    valueClass={
                      ruin.certain || ruin.probability > tolerance
                        ? 'text-red-400'
                        : 'text-emerald-400'
                    }
                  />
                </div>
              )}
            </div>
          </Block>

          {/* ---------------------------------------------------------------
              3. How bad do the downswings get?
             --------------------------------------------------------------- */}
          <Block
            title="Downswings"
            modelled
            footnote="Projection resamples whole sessions, so it keeps the swing of a real night intact."
          >
            <Row
              label="Worst stretch you've had"
              value={dollars(drawdown.observed)}
              valueClass="text-red-400"
            />
            {drawdown.expected !== null ? (
              <>
                <Row label="Typical worst stretch to expect" value={dollars(drawdown.expected)} />
                <Row
                  label="Rough patch to be ready for"
                  value={dollars(drawdown.p90)}
                  valueClass="text-amber-300"
                />
              </>
            ) : (
              <div className="text-xs text-gray-500">Not enough sessions to project a downswing.</div>
            )}
          </Block>

          {/* ---------------------------------------------------------------
              4. What stake does the roll support?
             --------------------------------------------------------------- */}
          <Block
            title="Kelly — growing the roll without blowing it up"
            modelled
            footnote="Full Kelly grows fastest but swings hardest. Most players run half or quarter."
          >
            {kelly ? (
              <>
                <Row label="Full Kelly" value={dollars(kelly.full)} />
                <Row label="Half Kelly (safer)" value={dollars(kelly.half)} />
                <Row label="Quarter Kelly (safest)" value={dollars(kelly.quarter)} />
              </>
            ) : (
              <div className="text-xs text-amber-300 leading-snug">
                Kelly needs a positive win rate to size against.
              </div>
            )}
          </Block>
        </div>
      )}
    </div>
  );
};

export default VarianceBand;
