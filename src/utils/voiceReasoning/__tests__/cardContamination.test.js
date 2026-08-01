// @vitest-environment jsdom
/**
 * cardContamination.test.js — VRN's hard-binary safety property.
 *
 * A narration containing card words ("he'd play queen of hearts like that") must
 * NEVER inject a card into the hand. This is the reason the note lane is a
 * separate button rather than a mode on the existing PTT (founder decision F3,
 * Gate 2 E-3).
 *
 * PER THE SURFACE SPEC, A FAILURE HERE IS A DROP CONDITION, NOT A BUG TO PATCH.
 * If this suite ever fails, the correct response is to stop shipping the lane
 * until the structural separation is restored — not to add a filter.
 *
 * Two layers:
 *   1. Structural — the VRN modules import no card/game mutation path at all,
 *      so contamination is impossible by construction rather than by validation.
 *   2. Behavioral — writing a card-word-laden note leaves the hand's card state
 *      byte-identical.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeDB, resetDBPool, DB_NAME, readTx, STORE_NAME } from '../../persistence/database';
import { saveHand } from '../../persistence/handsStorage';
import { appendReasoningNote, readReasoningNotes } from '../../persistence/reasoningNoteWriter';
import { createSession, appendSegment, finalizeSession } from '../noteSession';
import { buildReplaySnapshot } from '../replaySnapshot';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../../..');

// Every module that participates in the VRN capture path.
const VRN_SOURCES = [
  'utils/voiceReasoning/noteSession.js',
  'utils/voiceReasoning/replaySnapshot.js',
  'utils/persistence/reasoningNoteWriter.js',
  'hooks/useSpeechCapture.js',
  'hooks/useVoiceReasoningNote.js',
  'components/views/HandReplayView/VoiceNarrationSection.jsx',
];

// Mutation paths that would let a note reach card or game state.
const FORBIDDEN_PATTERNS = [
  ['CARD_ACTIONS', /\bCARD_ACTIONS\b/],
  ['cardReducer import', /from\s+['"][^'"]*cardReducer['"]/],
  ['gameReducer import', /from\s+['"][^'"]*gameReducer['"]/],
  ['dispatchCard', /\bdispatchCard\b/],
  ['dispatchGame', /\bdispatchGame\b/],
  ['SET_COMMUNITY_CARD', /\bSET_COMMUNITY_CARD\b/],
  ['SET_PLAYER_CARD', /\bSET_PLAYER_CARD\b/],
  ['voiceCardEntry parser', /voiceCardEntry\/parser/],
];

const deleteEntireDB = () =>
  new Promise((resolve_) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve_();
    req.onerror = () => resolve_();
    req.onblocked = () => resolve_();
  });

describe('VRN card contamination — structural separation', () => {
  it.each(VRN_SOURCES)('%s imports no card or game mutation path', (relPath) => {
    const source = readFileSync(resolve(SRC, relPath), 'utf8');
    const hits = FORBIDDEN_PATTERNS
      .filter(([, pattern]) => pattern.test(source))
      .map(([name]) => name);

    expect(
      hits,
      `${relPath} references ${hits.join(', ')} — the note lane must never reach card or game state`,
    ).toEqual([]);
  });

  it('the note lane does not reuse the card parser', () => {
    // Sharing the card grammar would reintroduce exactly the coupling the
    // separate-button decision exists to prevent.
    for (const relPath of VRN_SOURCES) {
      const source = readFileSync(resolve(SRC, relPath), 'utf8');
      expect(source).not.toMatch(/parseTranscript/);
    }
  });
});

describe('VRN card contamination — behavioral', () => {
  beforeEach(async () => {
    closeDB();
    resetDBPool();
    await deleteEntireDB();
  });

  afterEach(async () => {
    closeDB();
    resetDBPool();
  });

  const handWithBoard = () => ({
    gameState: {
      currentStreet: 'river',
      dealerButtonSeat: 1,
      mySeat: 2,
      actionSequence: [],
      absentSeats: [],
    },
    cardState: {
      communityCards: ['A♥', 'J♠', 'T♣', '8♦', '2♣'],
      holeCards: ['K♠', 'Q♠'],
      holeCardsVisible: true,
      allPlayerCards: { 2: ['K♠', 'Q♠'] },
    },
    seatPlayers: {},
  });

  // The exact failure mode: a narration densely loaded with card syntax that the
  // card grammar would happily parse into real cards.
  const CARD_LADEN_NARRATION = [
    'he would play queen of hearts like that all day',
    'if he had ace of spades and king of diamonds he raises the turn',
    'ten of clubs would have been a much better card for him',
    'player three had jack of hearts I think',
  ];

  it('a card-word-laden narration leaves community cards byte-identical', async () => {
    const handId = await saveHand(handWithBoard());
    const before = await readTx(STORE_NAME, (store) => store.get(handId));
    const communityBefore = JSON.stringify(before.cardState.communityCards);

    let session = createSession({ source: 'replay', startedAt: 1000, handId });
    for (const text of CARD_LADEN_NARRATION) {
      session = appendSegment(session, {
        text,
        context: buildReplaySnapshot({ currentStreet: 'river', currentActionIndex: 11 }, before),
      });
    }
    await appendReasoningNote(handId, finalizeSession(session, { endedAt: 9000 }));

    const after = await readTx(STORE_NAME, (store) => store.get(handId));
    expect(JSON.stringify(after.cardState.communityCards)).toBe(communityBefore);
  });

  it('a card-word-laden narration leaves all player cards byte-identical', async () => {
    const handId = await saveHand(handWithBoard());
    const before = await readTx(STORE_NAME, (store) => store.get(handId));
    const playersBefore = JSON.stringify(before.cardState.allPlayerCards);

    let session = createSession({ source: 'replay', startedAt: 1000, handId });
    session = appendSegment(session, { text: CARD_LADEN_NARRATION.join(' ') });
    await appendReasoningNote(handId, finalizeSession(session, { endedAt: 9000 }));

    const after = await readTx(STORE_NAME, (store) => store.get(handId));
    expect(JSON.stringify(after.cardState.allPlayerCards)).toBe(playersBefore);
  });

  it('leaves the whole cardState and gameState untouched, not just the card arrays', async () => {
    const handId = await saveHand(handWithBoard());
    const before = await readTx(STORE_NAME, (store) => store.get(handId));
    const cardStateBefore = JSON.stringify(before.cardState);
    const gameStateBefore = JSON.stringify(before.gameState);

    let session = createSession({ source: 'replay', startedAt: 1000, handId });
    session = appendSegment(session, { text: CARD_LADEN_NARRATION.join(' ') });
    await appendReasoningNote(handId, finalizeSession(session, { endedAt: 9000 }));

    const after = await readTx(STORE_NAME, (store) => store.get(handId));
    expect(JSON.stringify(after.cardState)).toBe(cardStateBefore);
    expect(JSON.stringify(after.gameState)).toBe(gameStateBefore);
  });

  it('still records the narration verbatim — separation must not cost retention', async () => {
    const handId = await saveHand(handWithBoard());

    let session = createSession({ source: 'replay', startedAt: 1000, handId });
    for (const text of CARD_LADEN_NARRATION) {
      session = appendSegment(session, { text });
    }
    await appendReasoningNote(handId, finalizeSession(session, { endedAt: 9000 }));

    const notes = await readReasoningNotes(handId);
    expect(notes[0].segments).toHaveLength(CARD_LADEN_NARRATION.length);
    expect(notes[0].segments[0].text).toBe(CARD_LADEN_NARRATION[0]);
  });
});
