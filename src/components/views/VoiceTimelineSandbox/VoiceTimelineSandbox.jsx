/**
 * VoiceTimelineSandbox — owner-only prototype for the Voice Hand-Tree Entry project.
 *
 * Pre-Gate experiment (evolves WS-181 Voice Card Entry from cards → full hand tree).
 * Surfaced ONLY through the Admin/Sandbox section (AdminSection.jsx), owner email gate.
 * Memory: project_voice_hand_tree_entry.md. Standalone design source:
 * prototypes/voice-hand-timeline.html.
 *
 * Two halves:
 *   1. Voice-data collector — real Web Speech (continuous + interim). Narrate a
 *      whole hand; the raw transcript is captured + persisted to localStorage so
 *      the action grammar can later be built from REAL captures, not guesses.
 *      NOTE: it does NOT yet parse speech into the timeline — that parser is the
 *      next step, deliberately deferred until we have real voice data.
 *   2. Hand-tree timeline — "only fix the doubt" (confirm-by-exception) on top of a
 *      full touch-editable tree (tap row → change action/seat/size, move, insert,
 *      delete; ＋add-action inserts a forgotten actor). Live ↔ Reconstruct modes.
 *
 * This writes NOTHING to the real hand record yet — it is a feel-and-collect
 * prototype. The one-source-of-truth commit path is a later build step.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Beaker, Mic, Square, ArrowLeft, Trash2, Copy, Plus } from 'lucide-react';
import { useUI } from '../../../contexts';
import { SCREEN } from '../../../constants/uiConstants';

const ACTIONS = ['fold', 'check', 'call', 'limp', 'bet', 'raise', '3-bet', '4-bet', 'donk', 'check-raise'];
const HAS_SIZE = { bet: 1, raise: 1, '3-bet': 1, '4-bet': 1, donk: 1, 'check-raise': 1 };
const SEATS = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB', 'Hero'];
const CAPTURE_KEY = 'voiceTimelineSandbox.captures.v1';

let _uid = 100;
const nextId = () => ++_uid;

function seedHand() {
  return [
    { name: 'Preflop', trig: 'new hand', acts: [
      { id: 1, actor: 'UTG', action: 'limp', size: null, low: false },
      { id: 2, actor: 'MP', action: 'limp', size: null, low: false },
      { id: 3, actor: 'Hero', action: 'raise', size: 18, low: false },
      { id: 4, actor: 'BTN', action: 'call', size: null, low: false },
      { id: 5, actor: 'SB', action: 'fold', size: null, low: false },
      { id: 6, actor: 'BB', action: 'fold', size: null, low: false },
    ] },
    { name: 'Flop', trig: 'flop', acts: [
      { id: 7, actor: 'Hero', action: 'bet', size: 30, low: false },
      { id: 8, actor: 'BTN', action: 'call', size: null, low: false },
    ] },
    { name: 'Turn', trig: 'turn', acts: [
      { id: 9, actor: 'Hero', action: 'check', size: null, low: false },
      { id: 10, actor: 'BTN', action: 'bet', size: null, low: true }, // unclear size
      { id: 11, actor: 'Hero', action: 'call', size: null, low: false },
    ] },
    { name: 'River', trig: 'river', acts: [
      { id: 12, actor: 'Hero', action: 'check', size: null, low: false },
      { id: 13, actor: 'BTN', action: 'check', size: null, low: false },
    ] },
  ];
}

const hasSize = (a) => !!HAS_SIZE[a.action];
const isUnclear = (a) => a.low || (hasSize(a) && a.size == null);

// ─── raw Web Speech capture (continuous + interim, self-contained) ───────────
function useRawSpeech(onFinal) {
  const Ctor = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const supported = !!Ctor;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const finalRef = useRef('');
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const start = useCallback(() => {
    if (!supported || recRef.current) return;
    setError(null); setInterim(''); finalRef.current = '';
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    try { rec.lang = 'en-US'; } catch { /* ignore */ }
    rec.onresult = (e) => {
      let intr = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += (finalRef.current ? ' ' : '') + (r[0].transcript || '').trim();
        else intr += r[0].transcript;
      }
      setInterim(intr);
    };
    rec.onerror = (e) => setError((e && e.error) || 'error');
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const t = finalRef.current.trim();
      if (t && onFinalRef.current) onFinalRef.current(t);
    };
    try { rec.start(); recRef.current = rec; setListening(true); }
    catch (err) { setError((err && err.message) || 'start-failed'); recRef.current = null; }
  }, [Ctor, supported]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec) { try { rec.stop(); } catch { /* ignore */ } }
  }, []);

  useEffect(() => () => { const rec = recRef.current; if (rec) { try { rec.stop(); } catch { /* ignore */ } } }, []);
  return { supported, listening, interim, error, start, stop };
}

const Chip = ({ on, children, onClick }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`px-2.5 py-1.5 rounded-md text-sm border transition-colors ${
      on ? 'bg-emerald-500 text-emerald-950 border-emerald-400 font-semibold'
         : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'}`}
  >
    {children}
  </button>
);

export const VoiceTimelineSandbox = () => {
  const { setCurrentScreen } = useUI();
  const [model, setModel] = useState(seedHand);
  const [openId, setOpenId] = useState(null);
  const [mode, setMode] = useState('recon'); // 'live' | 'recon'
  const [captures, setCaptures] = useState([]);

  // load persisted captures
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CAPTURE_KEY);
      if (raw) setCaptures(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  const persist = useCallback((list) => {
    setCaptures(list);
    try { localStorage.setItem(CAPTURE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  }, []);

  const addCapture = useCallback((text) => {
    persist([{ id: nextId(), text, at: Date.now() }, ...captures].slice(0, 200));
  }, [captures, persist]);

  const speech = useRawSpeech(addCapture);

  // ─── timeline mutation helpers ─────────────────────────────────────────────
  const mutate = (fn) => setModel((m) => { const next = m.map((s) => ({ ...s, acts: s.acts.map((a) => ({ ...a })) })); fn(next); return next; });
  const setAct = (si, ai, patch) => mutate((m) => { Object.assign(m[si].acts[ai], patch); });
  const moveAct = (si, ai, dir) => mutate((m) => {
    const arr = m[si].acts; const j = ai + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[ai], arr[j]] = [arr[j], arr[ai]];
  });
  const insertAfter = (si, ai) => { const id = nextId(); mutate((m) => { m[si].acts.splice(ai + 1, 0, { id, actor: 'MP', action: 'fold', size: null, low: false }); }); setOpenId(id); };
  const addToStreet = (si) => { const id = nextId(); mutate((m) => { m[si].acts.push({ id, actor: 'MP', action: 'fold', size: null, low: false }); }); setOpenId(id); };
  const deleteAct = (si, ai) => { mutate((m) => { m[si].acts.splice(ai, 1); }); setOpenId(null); };

  const lows = model.flatMap((s) => s.acts.map((a) => ({ a, s }))).filter(({ a }) => isUnclear(a));
  const totalActs = model.reduce((n, s) => n + s.acts.length, 0);
  const firstLow = lows[0];

  const resolveDoubtSize = (val) => {
    setModel((m) => m.map((s) => ({ ...s, acts: s.acts.map((a) => (a.id === firstLow.a.id ? { ...a, size: val, low: false } : a)) })));
  };

  const commit = () => {
    if (lows.length) { window.alert(`Still ${lows.length} unclear — confirm the amber action first.`); return; }
    const out = model.map((s) => `${s.name}: ${s.acts.map((a) => `${a.actor} ${a.action}${hasSize(a) ? ` $${a.size}` : ''}`).join(' · ')}`).join('\n');
    window.alert(`(prototype) Would write into the same hand record the live tracker uses:\n\n${out}`);
  };

  return (
    <div className="h-[100dvh] bg-gray-900 text-gray-100 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-4 pb-24">
        {/* header */}
        <div className="flex items-center gap-3 mb-1">
          <button type="button" onClick={() => setCurrentScreen(SCREEN.SETTINGS)} className="p-2 -ml-2 rounded-lg hover:bg-gray-800 text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <Beaker size={18} className="text-amber-400" />
          <h1 className="text-lg font-semibold">Voice hand-timeline</h1>
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40">sandbox</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">Narrate a hand → capture real voice. Edit the tree by touch. Nothing is saved to your real hands yet.</p>

        {/* ─── voice-data collector ─── */}
        <section className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">Voice capture — narrate a whole hand</div>
          {!speech.supported ? (
            <div className="text-sm text-amber-300">Web Speech isn’t available on this browser. Try Chrome on Android.</div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => (speech.listening ? speech.stop() : speech.start())}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors ${
                  speech.listening ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
              >
                {speech.listening ? <><Square size={18} /> Stop & save transcript</> : <><Mic size={18} /> Start narrating</>}
              </button>
              {speech.listening && (
                <div className="mt-3 text-sm text-gray-300 bg-gray-900 rounded-lg p-3 min-h-[2.5rem] border border-gray-700">
                  <span className="text-emerald-400">● listening… </span>
                  <span className="italic text-gray-400">{speech.interim || 'say the hand: “new hand, UTG limp, I raise to 18, button calls… flop, I bet 30…”'}</span>
                </div>
              )}
              {speech.error && <div className="mt-2 text-xs text-amber-300">mic: {speech.error}</div>}
            </>
          )}

          {captures.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] uppercase tracking-wide text-gray-400">{captures.length} captured</div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { try { navigator.clipboard.writeText(captures.map((c) => c.text).join('\n')); } catch { /* ignore */ } }} className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1"><Copy size={13} /> copy all</button>
                  <button type="button" onClick={() => persist([])} className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1"><Trash2 size={13} /> clear</button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {captures.map((c) => (
                  <div key={c.id} className="text-sm text-gray-300 bg-gray-900 rounded-lg px-3 py-2 border border-gray-700 flex items-start gap-2">
                    <span className="flex-1">{c.text}</span>
                    <button type="button" onClick={() => persist(captures.filter((x) => x.id !== c.id))} className="text-gray-600 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-gray-500 mt-1.5">Captures persist on this device — collect a few real hands at the table, then we build the parser from them.</div>
            </div>
          )}
        </section>

        {/* mode toggle */}
        <div className="flex gap-2 mb-3">
          {[['live', '👀 Live peek'], ['recon', '📝 Reconstruct']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setMode(k)}
              className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${mode === k ? 'bg-emerald-900/40 border-emerald-500/60 text-gray-100' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ─── confirm-by-exception ─── */}
        <section className="rounded-xl border p-4 mb-3"
          style={{ background: firstLow ? 'rgba(42,35,16,0.6)' : 'rgba(20,40,30,0.4)', borderColor: firstLow ? '#4a3a12' : '#21372d' }}>
          {firstLow ? (
            <>
              <div className="text-sm text-amber-200">⚠️ Heard <b>{totalActs - lows.length}</b> actions confidently · <b>{lows.length}</b> to confirm</div>
              <div className="text-base font-semibold mt-2 mb-1">{firstLow.a.actor} {firstLow.a.action} on the {firstLow.s.name.toLowerCase()} — how much?</div>
              <DoubtScrubber value={firstLow.a.size ?? 30} onConfirm={resolveDoubtSize} />
            </>
          ) : (
            <div className="text-sm text-emerald-300">✓ All clear — every action confident. Review below or commit.</div>
          )}
        </section>

        {/* ─── timeline ─── */}
        {model.map((st, si) => (
          <section key={st.name} className="bg-gray-800/60 rounded-xl border border-gray-700 p-3 mb-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-gray-400 mb-2">
              {st.name}<span className="text-emerald-400 normal-case bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-[10px]">trigger “{st.trig}”</span>
            </div>
            {st.acts.map((a, ai) => (
              <div key={a.id}>
                <button type="button" onClick={() => setOpenId(openId === a.id ? null : a.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg my-1 border text-left ${
                    isUnclear(a) ? 'border-amber-500/70 bg-amber-900/10'
                    : a.actor === 'Hero' ? 'border-sky-700/60 bg-sky-900/20' : 'border-gray-700 bg-gray-900/40'}`}>
                  <span className={`text-xs font-semibold w-12 ${a.actor === 'Hero' ? 'text-sky-400' : 'text-gray-400'}`}>{a.actor}</span>
                  <span className="flex-1 text-[15px] font-medium">{a.action}</span>
                  <span className="text-sm font-semibold text-emerald-200">{hasSize(a) ? (a.size == null ? <span className="text-amber-400">$?</span> : `$${a.size}`) : ''}</span>
                  <span className="text-gray-600">⋮⋮</span>
                </button>
                {openId === a.id && (
                  <RowEditor a={a} si={si} ai={ai} count={st.acts.length}
                    onSeat={(v) => setAct(si, ai, { actor: v })}
                    onAction={(v) => setAct(si, ai, { action: v, low: false, size: HAS_SIZE[v] ? (a.size ?? 20) : null })}
                    onSize={(v) => setAct(si, ai, { size: v, low: false })}
                    onMove={(d) => moveAct(si, ai, d)}
                    onInsert={() => insertAfter(si, ai)}
                    onDelete={() => deleteAct(si, ai)} />
                )}
              </div>
            ))}
            <button type="button" onClick={() => addToStreet(si)}
              className="w-full mt-1 py-2 rounded-lg border border-dashed border-gray-700 text-emerald-400 text-xs hover:bg-gray-800 flex items-center justify-center gap-1">
              <Plus size={14} /> add action to {st.name}
            </button>
          </section>
        ))}

        {/* footer */}
        <div className="flex gap-2 mt-2">
          <button type="button" onClick={commit} className="flex-1 py-3 rounded-xl bg-emerald-500 text-emerald-950 font-bold">Commit hand ✓</button>
          <button type="button" onClick={() => { setModel(seedHand()); setOpenId(null); }} className="py-3 px-4 rounded-xl border border-gray-700 text-gray-400 text-sm">
            {mode === 'live' ? '✓ Looks right — back to table' : 'Reset'}
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mt-3">
          {mode === 'live'
            ? 'Mid-hand: glance, clear the one amber doubt, dismiss, keep playing. The full tree is still here if you need it.'
            : 'Tap any action to edit — change the action (incl. donk / check-raise), pick the seat, scrub the size, move it, insert, or delete. “＋ add action” drops in a player you forgot.'}
        </p>
      </div>
    </div>
  );
};

const DoubtScrubber = ({ value, onConfirm }) => {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <div>
      <div className="flex items-center gap-3 my-2">
        <input type="range" min="2" max="200" value={v} onChange={(e) => setV(+e.target.value)} className="flex-1" />
        <div className="min-w-[64px] text-center text-lg font-bold text-amber-200 bg-amber-950/60 border border-amber-800/60 rounded-lg py-1">${v}</div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => onConfirm(v)} className="px-3 py-2 rounded-lg bg-amber-400 text-amber-950 text-sm font-semibold">confirm ${v}</button>
        <button type="button" onClick={() => window.alert('(prototype) would re-listen for just this one value — correction stays in voice.')} className="px-3 py-2 rounded-lg border border-amber-800/60 text-amber-200 text-sm">🎙 say it again</button>
      </div>
    </div>
  );
};

const RowEditor = ({ a, count, ai, onSeat, onAction, onSize, onMove, onInsert, onDelete }) => (
  <div className="bg-gray-900/70 border border-dashed border-gray-700 rounded-lg p-3 mb-2" onClick={(e) => e.stopPropagation()}>
    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">who</div>
    <div className="flex flex-wrap gap-1.5 mb-3">{SEATS.map((s) => <Chip key={s} on={s === a.actor} onClick={() => onSeat(s)}>{s}</Chip>)}</div>
    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">action</div>
    <div className="flex flex-wrap gap-1.5 mb-3">{ACTIONS.map((x) => <Chip key={x} on={x === a.action} onClick={() => onAction(x)}>{x}</Chip>)}</div>
    {HAS_SIZE[a.action] && (
      <>
        <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">size</div>
        <div className="flex items-center gap-3 mb-3">
          <input type="range" min="2" max="300" value={a.size ?? 20} onChange={(e) => onSize(+e.target.value)} className="flex-1" />
          <div className="min-w-[54px] text-center text-emerald-200 font-semibold">${a.size ?? 20}</div>
        </div>
      </>
    )}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => onMove(-1)} disabled={ai === 0} className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 text-xs disabled:opacity-30">↑ up</button>
      <button type="button" onClick={() => onMove(1)} disabled={ai === count - 1} className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 text-xs disabled:opacity-30">↓ down</button>
      <button type="button" onClick={onInsert} className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 text-xs">↳ insert after</button>
      <button type="button" onClick={onDelete} className="px-3 py-1.5 rounded-lg border border-red-900/60 text-red-400 text-xs flex items-center gap-1"><Trash2 size={12} /> delete</button>
    </div>
  </div>
);

export default VoiceTimelineSandbox;
