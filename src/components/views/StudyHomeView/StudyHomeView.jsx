/**
 * StudyHomeView — Study Home v1.
 *
 * Per docs/design/surfaces/study-home.md §SH-V1. Gates:
 *   audits/2026-07-31-entry-study-home-v1.md    (YELLOW)
 *   audits/2026-07-31-blindspot-study-home-v1.md (YELLOW)
 * Serves JTBD DS-69 — route-to-the-right-study-surface.
 *
 * WHY THIS EXISTS: 14 of ~16 study tabs were reachable only through a button at
 * the bottom of SessionsView — a surface whose job is recording sessions, not
 * studying. This is the flat-index region the spec already mandates as "always
 * visible, never gated" (red line #6), grouped by PURPOSE rather than by street
 * or engine, using the founder's own vocabulary (learn / practice / review).
 *
 * TWO BINDING CONSTRAINTS — do not relax without re-running Gate 2:
 *
 *   Red line #5 — NO streaks, shame, or engagement pressure. This surface is the
 *   most natural place in the app to add "you haven't practiced X in 34 days,"
 *   and the data to do it is available. It is FORBIDDEN. Counts here are factual
 *   inventory of what EXISTS ("14 lessons") and never behavioral measurement of
 *   the USER. The single user-describing count (Curriculum's flagged-concept
 *   count) is carried verbatim from Homebase's study-queue card, which already
 *   shipped under this red line and reads as a work queue, not a judgment.
 *   Binds hardest on the returning-after-break persona.
 *
 *   Red line #6 — the index renders UNCONDITIONALLY. No enrollment gate, no
 *   empty-state lockout, and no loading state that hides cards. Mastery data
 *   loads asynchronously; the cards do not wait for it.
 *
 * The Reference/Deliberate/Discover intent router from the parent spec is
 * DEFERRED, not rejected — 3 of its 4 declared embeds don't exist yet, so it
 * would route nothing today. See §SH-V1.
 */

import React, { useMemo } from 'react';
import { GraduationCap, Dumbbell, ClipboardCheck, ChevronRight } from 'lucide-react';
import { ScaledContainer } from '../../ui/ScaledContainer';
import { useUI } from '../../../contexts/UIContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSelfCoachMastery } from '../../../hooks/useSelfCoachMastery';
import { LESSONS as POSTFLOP_LESSONS } from '../../../utils/postflopDrillContent/lessons';
import { LESSONS as PREFLOP_LESSONS } from '../../../utils/drillContent/lessons';

const GROUP_STYLE = {
  learn:    { icon: GraduationCap, accent: 'text-violet-300', bar: 'bg-violet-500' },
  practice: { icon: Dumbbell,      accent: 'text-teal-300',   bar: 'bg-teal-500' },
  review:   { icon: ClipboardCheck, accent: 'text-amber-300', bar: 'bg-amber-500' },
};

const StudyCard = ({ title, when, meta, onOpen, testid }) => (
  <button
    type="button"
    onClick={onOpen}
    data-testid={testid}
    className="w-full text-left bg-gray-800/70 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-xl px-5 py-4 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
  >
    <div className="flex items-start justify-between gap-2">
      <span className="text-lg font-semibold text-white leading-tight">{title}</span>
      <ChevronRight size={18} className="text-gray-500 mt-1 shrink-0" />
    </div>
    {/* The "when to use this" line is the point of the card. Without it the user
        is back to decoding tab names — and four of those names are duplicated
        verbatim across the two drill views. */}
    <p className="text-sm text-gray-400 mt-1.5 leading-snug">{when}</p>
    {meta && <p className="text-xs text-gray-500 mt-2 font-mono">{meta}</p>}
  </button>
);

const StudyGroup = ({ id, title, question, children }) => {
  const { icon: Icon, accent, bar } = GROUP_STYLE[id];
  return (
    <section className="flex flex-col min-w-0" data-testid={`study-group-${id}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-1 h-5 rounded-full ${bar}`} aria-hidden="true" />
        <Icon size={18} className={accent} />
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
      <p className="text-sm text-gray-400 mb-3 ml-3 italic">{question}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
};

export const StudyHomeView = ({ scale }) => {
  const { setCurrentScreen, openDrills, SCREEN } = useUI();
  const { userId } = useAuth();
  const coach = useSelfCoachMastery(userId);

  // Carried verbatim from HomebaseDashboard's study-queue card — same
  // computation, same red-line posture. A work queue, not a grade.
  const openWork = useMemo(
    () => (coach.composites || []).filter((c) => c.compositeScore > 0).length,
    [coach.composites],
  );

  // Factual inventory of what exists. Derived from the content modules rather
  // than hardcoded so the numbers cannot drift away from reality.
  const postflopLessonCount = POSTFLOP_LESSONS.length;
  const preflopLessonCount = PREFLOP_LESSONS.length;

  const go = (screen) => () => setCurrentScreen(screen);
  const drill = (screen, tab) => () => openDrills(screen, tab, SCREEN.STUDY_HOME);

  return (
    <ScaledContainer scale={scale}>
      <div className="w-full h-full bg-gray-900 flex flex-col" style={{ width: 1600, height: 720 }}>
        <div className="flex items-start justify-between px-10 pt-6 pb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-white">Study</h1>
            <p className="text-sm text-gray-400 mt-1">
              Everything off the table, grouped by what you came to do.
            </p>
          </div>
          <button
            type="button"
            onClick={go(SCREEN.HOMEBASE)}
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            ← Home
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-10 pb-8">
          <div className="grid grid-cols-3 gap-8">
            <StudyGroup id="learn" title="Learn" question="I want to understand a concept.">
              <StudyCard
                testid="study-card-curriculum"
                title="Curriculum"
                when="Work through concepts in order, paced to what you're ready for."
                meta={coach.loading ? null : (openWork > 0
                  ? `${openWork} concept${openWork === 1 ? '' : 's'} to work on`
                  : 'nothing flagged')}
                onOpen={go(SCREEN.SELF_COACH)}
              />
              <StudyCard
                testid="study-card-postflop-lessons"
                title="Postflop Lessons"
                when="Read the theory behind flop play — ranges, board texture, multiway."
                meta={`${postflopLessonCount} lessons`}
                onOpen={drill(SCREEN.POSTFLOP_DRILLS, 'lessons')}
              />
              <StudyCard
                testid="study-card-preflop-lessons"
                title="Preflop Lessons"
                when="Read the theory behind opening, 3-betting, and defending."
                meta={`${preflopLessonCount} lessons`}
                onOpen={drill(SCREEN.PREFLOP_DRILLS, 'lessons')}
              />
            </StudyGroup>

            <StudyGroup id="practice" title="Practice" question="I want to test myself.">
              <StudyCard
                testid="study-card-line-study"
                title="Line Study"
                when="Walk a hand street by street and see what each branch costs."
                onOpen={drill(SCREEN.POSTFLOP_DRILLS, 'line')}
              />
              <StudyCard
                testid="study-card-postflop-drills"
                title="Postflop Drills"
                when="Guess villain's range on a flop, then check yourself against the engine."
                meta="Range Explorer · Estimate · Framework"
                onOpen={drill(SCREEN.POSTFLOP_DRILLS, 'explorer')}
              />
              <StudyCard
                testid="study-card-preflop-drills"
                title="Preflop Drills"
                when="Drill opening ranges, hand shapes, and the math until they're automatic."
                meta="Shape · Recipe · Equity · Math"
                onOpen={drill(SCREEN.PREFLOP_DRILLS, 'shape')}
              />
            </StudyGroup>

            <StudyGroup id="review" title="Review" question="I want to check my own work.">
              <StudyCard
                testid="study-card-hand-review"
                title="Hand Review"
                when="Replay hands you actually played and see where the line went wrong."
                onOpen={go(SCREEN.HISTORY)}
              />
              <StudyCard
                testid="study-card-refresher"
                title="Refresher"
                when="Print a one-page reference to carry to the table."
                onOpen={go(SCREEN.PRINTABLE_REFRESHER)}
              />
              <StudyCard
                testid="study-card-anchor-library"
                title="Exploit Anchors"
                when="Revisit the reads you've saved and check whether they still hold."
                onOpen={go(SCREEN.ANCHOR_LIBRARY)}
              />
            </StudyGroup>
          </div>
        </div>
      </div>
    </ScaledContainer>
  );
};

export default StudyHomeView;
