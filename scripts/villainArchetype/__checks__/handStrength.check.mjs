/**
 * Known-answer checks for handStrength. Every case below is a hand a player would name without
 * hesitating, which is the only kind of answer that can catch a plausible-but-wrong classifier.
 *
 * Straight-draw classification is where this earns its keep: open-ender, double gutshot and
 * gutshot all differ in ways that change a villain's action, and all three are easy to compute
 * almost-right. "Almost right" here would silently mislabel a whole tier and every rule keyed
 * on it, exactly as `boardTexture.flushDraw` did by reading three-to-a-suit ON THE BOARD as a
 * flush draw for 63% of postflop rows.
 */
import { classify, encodeCardStr } from '../handStrength.mjs';

let failed = 0;
const RANK_OF = (c) => Math.floor(c / 4);

/** Cards are written concatenated ("A♠K♦"); each is a rank plus a one-unit suit glyph. */
const cards = (s) => (s.replace(/ /g, '').match(/../g) || []).map(encodeCardStr);

const check = (name, hole, boardStr, want) => {
  const board = cards(boardStr);
  const [c1, c2] = cards(hole);
  if (board.some((c) => c < 0) || c1 < 0 || c2 < 0) {
    failed++; console.log(`  FAIL  ${name.padEnd(46)} card parse failed`); return;
  }
  const ranks = board.map(RANK_OF).sort((a, b) => b - a);
  const got = classify(c1, c2, board, ranks);
  const ok = Object.entries(want).every(([k, v]) => got[k] === v);
  if (!ok) failed++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${name.padEnd(46)} `
    + `made=${got.made} draw=${got.draw} blocker=${got.blocker}`);
};

console.log('made classes — a pair is named by WHICH board card it hit');
check('AK on A72 is top pair', 'A♠K♦', 'A♥7♣2♦', { made: 'top-pair' });
check('K7 on A72 is middle pair', 'K♠7♦', 'A♥7♣2♦', { made: 'middle-pair' });
check('K2 on A72 is bottom pair', 'K♠2♦', 'A♥7♣2♦', { made: 'bottom-pair' });
check('QQ on A72 is an underpair', 'Q♠Q♦', 'A♥7♣2♦', { made: 'underpair' });
check('QQ on J72 is an overpair', 'Q♠Q♦', 'J♥7♣2♦', { made: 'overpair' });
check('77 on A72 is a set', '7♠7♦', 'A♥7♣2♦', { made: 'set-or-two-pair' });
check('A7 on A72 is two pair', 'A♠7♦', 'A♥7♣2♦', { made: 'set-or-two-pair' });
check('65 on 987 is a straight', '6♠5♦', '9♥8♣7♦', { made: 'straight-plus' });

console.log('\nBOTTOM PAIR IS A MADE HAND and is reported on its own axis, never demoted');
// Founder: "reflect that bottom pair beats a draw because its a made hand". Two dimensions means
// this hand is BOTH, and neither fact displaces the other.
check('K3 with a flush draw is still bottom pair', 'K♥3♥', 'A♥7♥3♦', { made: 'bottom-pair' });
check('...and carries the flush draw on the same row', 'K♥3♥', 'A♥7♥3♦', { draw: 'flush-draw' });

console.log('\nflush draws — the nut draw is a different hand from the third-nut draw');
check('AhKh on Qh7h2d is the NUT flush draw', 'A♥K♥', 'Q♥7♥2♦', { draw: 'flush-draw-nut' });
check('KhJh on Qh7h2d is a non-nut flush draw', 'K♥J♥', 'Q♥7♥2♦', { draw: 'flush-draw' });
// One of the suit plus two on board is THREE, with two to come — a backdoor flush draw, and
// the classifier was right where the first version of this expectation was not.
check('one of the suit + two on board = backdoor', 'A♥K♦', 'Q♥7♥2♦', { draw: 'backdoor-flush' });
// AKQ with two cards to come is a runner-runner straight - the classifier is right and this
// expectation was wrong twice over. A hand with genuinely nothing needs disconnected ranks too.
check('AK with a Q on a rainbow board runs to a straight', 'A♥K♦', 'Q♠7♣2♦', { draw: 'runner-straight' });
check('disconnected and unsuited really is nothing', 'K♥7♦', 'Q♠4♣2♦', { draw: 'none' });

console.log('\nstraight draws — open-ender, double gutshot, gutshot');
check('JT on 9-8-2 is an open-ender', 'J♠T♦', '9♥8♣2♦', { draw: 'oesd' });
check('T7 on 9-8-2 is an open-ender', 'T♠7♦', '9♥8♣2♦', { draw: 'oesd' });
check('J9 on Q-8-2 is a gutshot', 'J♠9♦', 'Q♥8♣2♦', { draw: 'gutshot-nut-end' });
check('T8 on J-7-2 needs the 9 only', 'T♠8♦', 'J♥7♣2♦', { draw: 'gutshot-nut-end' });

console.log('\nbackdoor equity — the reason a hand continues with nothing yet');
check('two hearts, one on board, two to come', 'K♥4♥', 'A♥7♣2♦', { draw: 'backdoor-flush' });
check('no backdoor once the turn is out', 'K♥4♥', 'A♥7♣2♦ 9♠', { draw: 'none' });

console.log('\nno draws exist on the river');
check('river kills the flush draw', 'K♥J♥', 'Q♥7♥2♦ 3♠ 4♣', { draw: 'none' });

console.log('\nthe ace blocker on a three-flush board');
check('Ah on a three-heart board blocks the nuts', 'A♥K♦', 'Q♥7♥2♥', { blocker: true });
check('no ace of that suit, no blocker', 'A♠K♦', 'Q♥7♥2♥', { blocker: false });
check('two-tone board is not a blocker spot', 'A♥K♦', 'Q♥7♥2♦', { blocker: false });

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
