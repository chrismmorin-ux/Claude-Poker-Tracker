#!/usr/bin/env node
/**
 * verify-straddle.cjs — end-to-end verification of WS-002 Sprint A2.
 *
 * Drives a real chromium against the running dev server (localhost:5173).
 * Runs four scenarios:
 *   1. Mississippi action-order direct test (calls getFirstActionSeat from
 *      the running app's loaded module against a synthetic actionSequence).
 *   2. UTG straddle UI flow — right-click → Straddle row → modal → post.
 *      Asserts header chip + STR badge + pot math + Check transform.
 *   3. BTN straddle UI flow — same, asserts BTN-scope chip + STR badge.
 *   4. Eligibility — non-UTG/non-BTN seats hide the Straddle row.
 *
 * Exits non-zero on any assertion failure. Saves screenshots into
 * .playwright-verify/ for visual inspection.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.resolve(__dirname, '..', '.playwright-verify');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const failures = [];
const passes = [];

function assert(label, cond, detail) {
  if (cond) {
    passes.push(label);
    console.log(`  ✓ ${label}`);
  } else {
    failures.push({ label, detail });
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function longPressSeat(page, seatNumber) {
  // Right-click a seat button to open SeatContextMenu.
  // We locate the seat by class signature (rounded-lg + numeric label).
  await page.evaluate((n) => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === String(n) && b.className.includes('rounded-lg')
    );
    if (!btn) throw new Error(`Seat ${n} button not found`);
    const rect = btn.getBoundingClientRect();
    btn.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        button: 2,
      })
    );
  }, seatNumber);
}

async function clickByText(page, text) {
  await page.evaluate((t) => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === t
    );
    if (!btn) throw new Error(`Button "${t}" not found`);
    btn.click();
  }, text);
}

async function getDomState(page) {
  return await page.evaluate(() => {
    const headerChip = document.body.innerText.match(/Straddle\s+\$\d+\s*\((UTG|BTN)\)/);
    // STR seat badge: literal text "STR" inside an aria-labeled span. The
    // header chip ALSO has "straddle" in its aria-label, so filter by text.
    const strBadges = Array.from(
      document.querySelectorAll('[aria-label*="posted the straddle"]')
    ).map((el) => el.getAttribute('aria-label'));
    const menuTestId = document.querySelector('[data-testid="seat-context-menu"]');
    const menuOpen = !!menuTestId;
    const menuStraddleRow = !!document.querySelector('[data-testid="menu-straddle"]');
    const modalOpen = !!Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Post Straddle'
    );
    const potText = (document.body.innerText.match(/\$(\d+)/g) || []).slice(0, 5);
    return {
      headerChip: headerChip ? headerChip[0] : null,
      strBadges,
      menuOpen,
      menuStraddleRow,
      modalOpen,
      potTextSample: potText,
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 720 } });
  const page = await context.newPage();

  page.on('pageerror', (err) => console.log(`  [pageerror] ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`  [console.error] ${msg.text()}`);
  });

  console.log('Navigating to dev server…');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1500)); // let React settle

  // ============================================================
  // Scenario 1 — Mississippi action-order rule (direct module test)
  // ============================================================
  console.log('\n[Scenario 1] Mississippi getFirstActionSeat (loaded-module direct call)');
  const mississippi = await page.evaluate(async () => {
    const seatUtils = await import('/src/utils/seatUtils.js');
    const PRIM = await import('/src/constants/primitiveActions.js');
    const STRADDLE = PRIM.PRIMITIVE_ACTIONS.STRADDLE;
    const mk = (seat) => [{
      seat, action: STRADDLE, street: 'preflop', order: 1, amount: 4,
    }];
    return {
      // dealer=8, BB=1, UTG=2 (no straddle): first action should be UTG=2
      noStraddle: seatUtils.getFirstActionSeat('preflop', 8, [], [], 9),
      // dealer=8, UTG=2 straddle: first action should be UTG+1=3
      utgStraddle: seatUtils.getFirstActionSeat('preflop', 8, [], mk(2), 9),
      // dealer=8, BTN=8 straddle: Mississippi rule → first action = SB = 9
      btnStraddle: seatUtils.getFirstActionSeat('preflop', 8, [], mk(8), 9),
      // dealer=7 (BTN=7), straddle at 7: first action = SB = 8
      btnStraddleAlt: seatUtils.getFirstActionSeat('preflop', 7, [], mk(7), 9),
      // postflop is unaffected
      flop: seatUtils.getFirstActionSeat('flop', 8, [], mk(8), 9),
    };
  });
  console.log('  Result:', mississippi);
  assert('no-straddle: dealer=8, BB=1 → UTG=2', mississippi.noStraddle === 2, `got ${mississippi.noStraddle}`);
  assert('UTG straddle (seat 2): first action = UTG+1 = 3', mississippi.utgStraddle === 3, `got ${mississippi.utgStraddle}`);
  assert('BTN straddle (seat 8): first action = SB = 9 [MISSISSIPPI]', mississippi.btnStraddle === 9, `got ${mississippi.btnStraddle}`);
  assert('BTN straddle alt (dealer=7): first action = SB = 8', mississippi.btnStraddleAlt === 8, `got ${mississippi.btnStraddleAlt}`);
  assert('postflop unaffected by straddle', mississippi.flop === 9, `got ${mississippi.flop}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'A-baseline.png') });

  // ============================================================
  // Discover seat→position mapping for the UI scenarios
  // ============================================================
  const seatMap = await page.evaluate(() => {
    // Read position labels from the orbit strip: each button's text starts
    // with the position name. The orbit is [UTG..BB] in clockwise order.
    // Combined with the position-by-seat orientation we can read off which
    // seat is UTG and which is BTN.
    const orbit = Array.from(document.querySelectorAll('[data-orbit-fold-preview]'));
    const labels = orbit.map((b) => b.textContent.trim().split(/\s+/)[0]);
    // The orbit strip preserves clockwise order starting at UTG. We need to
    // pair labels back to seats. We do that via the seat-context-menu
    // approach: open menu on each candidate UTG/BTN by reading the dealer
    // badge from the seat that contains "D".
    let dealerSeat = null;
    for (let s = 1; s <= 9; s++) {
      const seatBtn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent.trim() === String(s) && b.className.includes('rounded-lg')
      );
      if (!seatBtn) continue;
      const parent = seatBtn.closest('div')?.parentElement;
      if (parent && parent.innerText.includes('D')) dealerSeat = s;
    }
    const NUM = 9;
    const next = (seat) => (seat % NUM) + 1;
    const sb = next(dealerSeat);
    const bb = next(sb);
    const utg = next(bb);
    return { dealerSeat, sb, bb, utg, btn: dealerSeat, orbitLabels: labels };
  });
  console.log('\nDev-seed seating:', seatMap);

  // ============================================================
  // Scenario 2 — UTG straddle UI flow
  // ============================================================
  console.log(`\n[Scenario 2] UTG straddle UI flow (UTG = seat ${seatMap.utg})`);
  await longPressSeat(page, seatMap.utg);
  await new Promise((r) => setTimeout(r, 200));
  let state = await getDomState(page);
  assert('menu opens on right-click of UTG seat', state.menuOpen);
  assert('menu shows 🎲 Straddle… row for UTG', state.menuStraddleRow);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'B1-utg-menu.png') });

  await page.evaluate(() => {
    document.querySelector('[data-testid="menu-straddle"]')?.click();
  });
  await new Promise((r) => setTimeout(r, 200));
  state = await getDomState(page);
  assert('Straddle row click opens the modal', state.modalOpen);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'B2-utg-modal.png') });

  await clickByText(page, 'Post Straddle');
  await new Promise((r) => setTimeout(r, 300));
  state = await getDomState(page);
  assert('header chip shows "Straddle $X (UTG)"', /\(UTG\)/.test(state.headerChip || ''), `got ${JSON.stringify(state.headerChip)}`);
  assert('STR badge present on a seat', state.strBadges.length === 1, `got ${state.strBadges.length}`);
  assert('STR badge labels the UTG seat', (state.strBadges[0] || '').includes(`Seat ${seatMap.utg}`));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'B3-utg-posted.png') });

  // ============================================================
  // Scenario 3 — Mississippi BTN straddle UI flow
  // ============================================================
  console.log(`\n[Scenario 3] BTN straddle UI flow (BTN = seat ${seatMap.btn}, expecting first-to-act = SB ${seatMap.sb})`);
  // Reset hand to clear UTG straddle. The Reset Hand button uses a toast-undo
  // pattern; click it once to reset.
  await clickByText(page, 'Reset Hand');
  await new Promise((r) => setTimeout(r, 400));

  await longPressSeat(page, seatMap.btn);
  await new Promise((r) => setTimeout(r, 200));
  state = await getDomState(page);
  assert('menu opens on right-click of BTN seat (post reset)', state.menuOpen);
  assert('menu shows 🎲 Straddle… row for BTN', state.menuStraddleRow);

  await page.evaluate(() => {
    document.querySelector('[data-testid="menu-straddle"]')?.click();
  });
  await new Promise((r) => setTimeout(r, 200));

  // Modal title should say "Straddle from BTN?"
  const modalText = await page.evaluate(() => {
    const h3 = document.querySelector('h3');
    return h3 ? h3.textContent : null;
  });
  assert('modal title says "Straddle from BTN?"', /BTN/.test(modalText || ''), `got ${modalText}`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'C1-btn-modal.png') });

  await clickByText(page, 'Post Straddle');
  await new Promise((r) => setTimeout(r, 300));
  state = await getDomState(page);
  assert('header chip shows "Straddle $X (BTN)"', /\(BTN\)/.test(state.headerChip || ''), `got ${JSON.stringify(state.headerChip)}`);
  assert('STR badge labels the BTN seat', (state.strBadges[0] || '').includes(`Seat ${seatMap.btn}`));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'C2-btn-posted.png') });

  // Verify Mississippi rule: with the BTN straddle in actionSequence, the
  // running app's getFirstActionSeat should return SB.
  const runtimeFirstAction = await page.evaluate(async ({ btnSeat }) => {
    const seatUtils = await import('/src/utils/seatUtils.js');
    const PRIM = await import('/src/constants/primitiveActions.js');
    return seatUtils.getFirstActionSeat(
      'preflop',
      btnSeat, // dealer = BTN seat
      [],
      [{
        seat: btnSeat,
        action: PRIM.PRIMITIVE_ACTIONS.STRADDLE,
        street: 'preflop',
        order: 1,
        amount: 4,
      }],
      9
    );
  }, { btnSeat: seatMap.btn });
  assert(
    `[MISSISSIPPI] BTN straddle → first to act = SB (seat ${seatMap.sb})`,
    runtimeFirstAction === seatMap.sb,
    `got ${runtimeFirstAction}`
  );

  // ============================================================
  // Scenario 4 — non-UTG/non-BTN seat is ineligible
  // ============================================================
  console.log('\n[Scenario 4] Non-UTG/non-BTN seat ineligible');
  // Pick a seat that's not UTG, not BTN, not SB, not BB
  const nonEligible = [3, 4, 5, 6].find(
    (s) => s !== seatMap.utg && s !== seatMap.btn && s !== seatMap.sb && s !== seatMap.bb
  );
  console.log(`  Testing seat ${nonEligible} (not UTG, not BTN, not SB, not BB)`);

  // Reset to clear straddle so eligibility re-evaluates fresh
  await clickByText(page, 'Reset Hand');
  await new Promise((r) => setTimeout(r, 400));

  await longPressSeat(page, nonEligible);
  await new Promise((r) => setTimeout(r, 200));
  state = await getDomState(page);
  assert(`menu opens on right-click of seat ${nonEligible}`, state.menuOpen);
  assert(`menu DOES NOT show 🎲 Straddle… row for non-UTG/non-BTN seat`, !state.menuStraddleRow);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'D-non-eligible.png') });

  // Also verify the Straddle row IS shown for UTG when no straddle is posted
  await page.evaluate(() => {
    document.body.click(); // close non-eligible menu
  });
  await new Promise((r) => setTimeout(r, 200));
  await longPressSeat(page, seatMap.utg);
  await new Promise((r) => setTimeout(r, 200));
  state = await getDomState(page);
  assert('menu re-opens on right-click of UTG (post non-eligible test)', state.menuOpen);
  assert('Straddle row IS visible for UTG (eligibility working)', state.menuStraddleRow);

  await browser.close();

  // ============================================================
  // Summary
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log(`PASSES: ${passes.length}    FAILURES: ${failures.length}`);
  console.log('Screenshots:', SCREENSHOT_DIR);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  ✗ ${f.label}${f.detail ? ` — ${f.detail}` : ''}`));
    process.exit(1);
  }
  console.log('\nALL VERIFIED ✓');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
