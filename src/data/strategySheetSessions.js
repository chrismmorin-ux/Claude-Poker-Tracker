/**
 * strategySheetSessions.js — verbatim transcription of the founder's Google Sheet
 * ("Strategy" → `bank roll` tab), rows 1–78, covering 26 Nov 2024 → 5 Aug 2026.
 *
 * WHY THIS IS RAW STRINGS, NOT PARSED VALUES
 * ------------------------------------------
 * Every cell is stored exactly as the sheet holds it — including the mistakes.
 * Parsing, correction, and money math live in `sheetImport.js` so they are
 * testable and so re-deriving this file against a future sheet export is a
 * plain diff rather than a re-reading exercise.
 *
 * KNOWN DEFECTS IN THE SOURCE DATA (handled downstream, not here):
 *  - The `Profit / Loss` column is DELIBERATELY NOT TRANSCRIBED. It is blank for
 *    the last 9 rows (21 Jul 26 → 5 Aug 26 — the formula was never filled down),
 *    which is why the sheet's own total row reads -$6,175 when the true figure is
 *    -$1,694. P&L is always recomputed as cashOut - buyIn - rebuys.
 *  - The sheet's `hours` / `$/hr` / `Trailing 20 $/hr` columns are not transcribed
 *    either: Google parsed the HHMM clock columns as durations ("4800:00:00"), so
 *    every rate in the sheet is wrong. Real durations recompute from timeIn/timeOut.
 *  - Dates are inconsistent ("18 Dec", "3 June", "14 Apri 2026") and three carry a
 *    year typo — "2 Dec 25", "4 Dec 25", "30 Dec 25" sit inside a December *2024*
 *    run. `parseSheetDate` resolves both against row order.
 *  - `# hands played` is empty for all 78 rows, so bb/100 is unrecoverable for
 *    this history. Session-clustered $/hr is the unit the data supports.
 *
 * Provenance: read from Drive file 1xUm_i10qu0T1YPRML_KqplK22eZL_LaHxYkdPRTcXgU
 * on 2026-08-06. Rows are in sheet order, which is chronological.
 *
 * @typedef {Object} SheetRow
 * @property {string} date            e.g. "26 Nov 24", "18 Dec", "14 Apri 2026"
 * @property {string} venue           casino / home game name, casing as typed
 * @property {string} gameType        "1/3", "2/5", or free-text tournament label
 * @property {string} bankWithdrawal  cash pulled from the bank (NOT the buy-in)
 * @property {string} buyIn           "$ in" column
 * @property {string} rebuys          rebuy total, usually blank
 * @property {string} timeIn          HHMM, 24h
 * @property {string} cashOut         "$ out" column
 * @property {string} timeOut         HHMM, 24h; may be < timeIn (overnight)
 * @property {string} rank            tournament finish, blank for cash
 */

/** @type {ReadonlyArray<SheetRow>} */
export const STRATEGY_SHEET_SESSIONS = Object.freeze([
  { date: "26 Nov 24", venue: "Horseshoe", gameType: "1/3", bankWithdrawal: "", buyIn: "", rebuys: "", timeIn: "1400", cashOut: "", timeOut: "1600", rank: "" },
  { date: "2 Dec 25", venue: "Horseshoe Hammond", gameType: "1/3", bankWithdrawal: "", buyIn: "", rebuys: "", timeIn: "1300", cashOut: "", timeOut: "1600", rank: "" },
  { date: "4 Dec 25", venue: "Horseshoe", gameType: "1/3", bankWithdrawal: "", buyIn: "", rebuys: "", timeIn: "1300", cashOut: "", timeOut: "1515", rank: "" },
  { date: "20 Dec 24", venue: "Horseshoe Council Bluffs", gameType: "1/3", bankWithdrawal: "300", buyIn: "$300", rebuys: "", timeIn: "1500", cashOut: "$468", timeOut: "1900", rank: "" },
  { date: "22 Dec 24", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "321", buyIn: "$300", rebuys: "", timeIn: "1400", cashOut: "$544", timeOut: "1600", rank: "" },
  { date: "30 Dec 25", venue: "Horseshoe Hammond", gameType: "1/3", bankWithdrawal: "300", buyIn: "$800", rebuys: "", timeIn: "1730", cashOut: "$0", timeOut: "2200", rank: "" },
  { date: "7 Jan 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "", buyIn: "$340", rebuys: "", timeIn: "1610", cashOut: "$395", timeOut: "1800", rank: "" },
  { date: "9 Jan 25", venue: "Horseshoe Hammond", gameType: "1/3", bankWithdrawal: "", buyIn: "$800", rebuys: "", timeIn: "1300", cashOut: "$163", timeOut: "1900", rank: "" },
  { date: "15 Jan 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "400", buyIn: "$300", rebuys: "", timeIn: "1400", cashOut: "$857", timeOut: "1750", rank: "" },
  { date: "16 Jan 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "", buyIn: "$600", rebuys: "", timeIn: "1530", cashOut: "$0", timeOut: "1830", rank: "" },
  { date: "19 Jan 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "", buyIn: "$600", rebuys: "", timeIn: "1210", cashOut: "$0", timeOut: "1602", rank: "" },
  { date: "20 Jan 25", venue: "Horseshoe", gameType: "1/3", bankWithdrawal: "", buyIn: "$400", rebuys: "", timeIn: "1300", cashOut: "$701", timeOut: "1815", rank: "" },
  { date: "22 Jan 25", venue: "Horseshoe Hammond", gameType: "In Person Tourney x 2", bankWithdrawal: "", buyIn: "$440", rebuys: "", timeIn: "1200", cashOut: "$0", timeOut: "1500", rank: "n/a" },
  { date: "22 Jan 25", venue: "Horseshoe Hammond", gameType: "1/3", bankWithdrawal: "400, 500", buyIn: "$1,200", rebuys: "", timeIn: "1430", cashOut: "$0", timeOut: "2200", rank: "" },
  { date: "27 Jan 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "500", buyIn: "$500", rebuys: "", timeIn: "", cashOut: "", timeOut: "", rank: "" },
  { date: "13 Feb 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "", buyIn: "$300", rebuys: "", timeIn: "1315", cashOut: "$1,052", timeOut: "1558", rank: "" },
  { date: "2 Mar 25", venue: "Horseshoe Hammond", gameType: "1/3", bankWithdrawal: "700", buyIn: "$700", rebuys: "", timeIn: "1712", cashOut: "", timeOut: "2104", rank: "" },
  { date: "12 Mar 25", venue: "Wind Creek", gameType: "2/5", bankWithdrawal: "", buyIn: "$500", rebuys: "", timeIn: "1350", cashOut: "$1,210", timeOut: "1715", rank: "" },
  { date: "30 Mar 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "500,500,500", buyIn: "$1,000", rebuys: "", timeIn: "", cashOut: "$0", timeOut: "", rank: "" },
  { date: "14 Apr 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "1000", buyIn: "$1,000", rebuys: "", timeIn: "", cashOut: "$0", timeOut: "", rank: "" },
  { date: "26 Apr 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "500,500", buyIn: "$1,000", rebuys: "", timeIn: "", cashOut: "$0", timeOut: "", rank: "" },
  { date: "28 Apr 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "500", buyIn: "$500", rebuys: "", timeIn: "", cashOut: "$900", timeOut: "", rank: "" },
  { date: "18 May 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "", buyIn: "$900", rebuys: "", timeIn: "1150", cashOut: "$350", timeOut: "2100", rank: "" },
  { date: "19 May 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "500", buyIn: "$850", rebuys: "", timeIn: "1630", cashOut: "$1,403", timeOut: "2130", rank: "" },
  { date: "21 May 25", venue: "Online", gameType: "$2+1, Winning: Seat to any $10+$1 tourney", bankWithdrawal: "", buyIn: "$3", rebuys: "", timeIn: "2200", cashOut: "$11", timeOut: "2700", rank: "1st" },
  { date: "22 May 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "500", buyIn: "$1,400", rebuys: "", timeIn: "1400", cashOut: "$500", timeOut: "2000", rank: "" },
  { date: "23 May 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "500", buyIn: "$1,000", rebuys: "", timeIn: "2200", cashOut: "$995", timeOut: "345", rank: "" },
  { date: "26 May 25", venue: "Online", gameType: "10+1, 3k Guarenteed", bankWithdrawal: "", buyIn: "$11", rebuys: "", timeIn: "1330", cashOut: "$20.34", timeOut: "1742", rank: "34th of 296" },
  { date: "26 May 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "300,500", buyIn: "$1,490", rebuys: "", timeIn: "1900", cashOut: "$0", timeOut: "2230", rank: "" },
  { date: "1 Jun 25", venue: "Online", gameType: "15+1.5", bankWithdrawal: "", buyIn: "$66", rebuys: "", timeIn: "1443", cashOut: "$35", timeOut: "1816", rank: "" },
  { date: "2 Jun 25", venue: "Online", gameType: "4+1, Monsterstack 1200 GTD", bankWithdrawal: "", buyIn: "$10", rebuys: "", timeIn: "1815", cashOut: "$0", timeOut: "2101", rank: "89 of 296" },
  { date: "3 Jun 25", venue: "Horseshoe Hammond", gameType: "", bankWithdrawal: "400", buyIn: "$120", rebuys: "", timeIn: "1240", cashOut: "$0", timeOut: "1530", rank: "14 of 62" },
  { date: "3 Jun 25", venue: "Horseshoe Hammond", gameType: "1/3", bankWithdrawal: "500", buyIn: "$850", rebuys: "", timeIn: "1645", cashOut: "376", timeOut: "2030", rank: "" },
  { date: "3 Jul 25", venue: "Riverside Iowa", gameType: "2/5", bankWithdrawal: "500", buyIn: "$804", rebuys: "", timeIn: "", cashOut: "", timeOut: "", rank: "" },
  { date: "19 Aug 25", venue: "Windy City", gameType: "325, 100 bounty", bankWithdrawal: "325", buyIn: "$325", rebuys: "", timeIn: "1600", cashOut: "$200", timeOut: "1930", rank: "7 of 43" },
  { date: "2 Sep 25", venue: "Online", gameType: "14+1", bankWithdrawal: "", buyIn: "$15", rebuys: "", timeIn: "330", cashOut: "$0", timeOut: "1955", rank: "164" },
  { date: "18 Sep 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "400", buyIn: "$400", rebuys: "", timeIn: "2100", cashOut: "$1,076", timeOut: "2340", rank: "" },
  { date: "19 Sep 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "0", buyIn: "$400", rebuys: "", timeIn: "2150", cashOut: "$633", timeOut: "2440", rank: "" },
  { date: "21 Sep 25", venue: "Mark Z home cash game", gameType: "", bankWithdrawal: "0", buyIn: "$900", rebuys: "", timeIn: "845", cashOut: "$391", timeOut: "2153", rank: "" },
  { date: "22 Sep 25", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "0", buyIn: "$400", rebuys: "", timeIn: "", cashOut: "$0", timeOut: "2", rank: "" },
  { date: "4 Oct 25", venue: "Greg game", gameType: "1/2", bankWithdrawal: "600", buyIn: "$600", rebuys: "", timeIn: "1730", cashOut: "$0", timeOut: "200", rank: "" },
  { date: "18 Dec", venue: "Mark game", gameType: "", bankWithdrawal: "400", buyIn: "$500", rebuys: "", timeIn: "1700", cashOut: "$1,050", timeOut: "2230", rank: "" },
  { date: "26 Dec 25", venue: "greg game", gameType: "1/2", bankWithdrawal: "0", buyIn: "$600", rebuys: "", timeIn: "1730", cashOut: "$880", timeOut: "2350", rank: "" },
  { date: "2 Jan 26", venue: "Greg game", gameType: "1/2", bankWithdrawal: "0", buyIn: "$400", rebuys: "", timeIn: "1645", cashOut: "$1,440", timeOut: "1930", rank: "" },
  { date: "9 Jan 26", venue: "rivers casino chicago", gameType: "", bankWithdrawal: "0", buyIn: "$900", rebuys: "", timeIn: "", cashOut: "$0", timeOut: "", rank: "" },
  { date: "10 Jan 26", venue: "windy city tourney", gameType: "80 buy in", bankWithdrawal: "0", buyIn: "$170", rebuys: "", timeIn: "1900", cashOut: "$423", timeOut: "2300", rank: "1" },
  { date: "15 Jan 26", venue: "Mark Game", gameType: "1/2", bankWithdrawal: "0", buyIn: "$400", rebuys: "", timeIn: "1820", cashOut: "$700", timeOut: "2328", rank: "" },
  { date: "", venue: "Greg's range", gameType: "1/2", bankWithdrawal: "0", buyIn: "$900", rebuys: "", timeIn: "", cashOut: "$0", timeOut: "", rank: "" },
  { date: "6 Feb 26", venue: "marks game", gameType: "1/2", bankWithdrawal: "0", buyIn: "$400", rebuys: "", timeIn: "1800", cashOut: "$1,004", timeOut: "200", rank: "" },
  { date: "14 Apri 2026", venue: "Wind Creek", gameType: "1/3", bankWithdrawal: "400", buyIn: "$503", rebuys: "", timeIn: "", cashOut: "", timeOut: "", rank: "" },
  { date: "3 Jun 2026", venue: "Hollywood st louis", gameType: "", bankWithdrawal: "", buyIn: "$300", rebuys: "", timeIn: "1130", cashOut: "$431", timeOut: "1300", rank: "" },
  { date: "3 June", venue: "Hollywood st louis", gameType: "turbo tourney (winner)", bankWithdrawal: "", buyIn: "$60", rebuys: "", timeIn: "1300", cashOut: "$351", timeOut: "1500", rank: "1" },
  { date: "5 June", venue: "Greg's game", gameType: "1/2", bankWithdrawal: "0", buyIn: "$400", rebuys: "", timeIn: "1630", cashOut: "$1,031", timeOut: "2200", rank: "" },
  { date: "7 June", venue: "wind creek", gameType: "1/3", bankWithdrawal: "", buyIn: "$400", rebuys: "", timeIn: "1630", cashOut: "$642", timeOut: "1930", rank: "" },
  { date: "8 June", venue: "wind Creek", gameType: "", bankWithdrawal: "", buyIn: "$550", rebuys: "", timeIn: "1600", cashOut: "$0", timeOut: "1720", rank: "" },
  { date: "8 June", venue: "wind Creek", gameType: "1/3", bankWithdrawal: "0", buyIn: "$400", rebuys: "", timeIn: "1620", cashOut: "$1,106", timeOut: "1920", rank: "" },
  { date: "9 June", venue: "wind Creek", gameType: "1/3", bankWithdrawal: "", buyIn: "$400", rebuys: "", timeIn: "1701", cashOut: "$400", timeOut: "2030", rank: "" },
  { date: "15 June", venue: "Mark and same game", gameType: "1/3", bankWithdrawal: "", buyIn: "$800", rebuys: "", timeIn: "1400", cashOut: "$0", timeOut: "1630", rank: "" },
  { date: "17 June", venue: "wind Creek", gameType: "1/3", bankWithdrawal: "", buyIn: "$400", rebuys: "", timeIn: "1321", cashOut: "$910", timeOut: "1630", rank: "" },
  { date: "18 June", venue: "wind creek", gameType: "1/3", bankWithdrawal: "", buyIn: "$400", rebuys: "", timeIn: "1710", cashOut: "$700", timeOut: "1910", rank: "" },
  { date: "19 June", venue: "wind creek", gameType: "", bankWithdrawal: "", buyIn: "$400", rebuys: "", timeIn: "1650", cashOut: "$979", timeOut: "1920", rank: "" },
  { date: "21 June", venue: "wind creek", gameType: "1/3", bankWithdrawal: "", buyIn: "$400", rebuys: "", timeIn: "1915", cashOut: "$979", timeOut: "2135", rank: "promotional high hands +100 from quad 7's" },
  { date: "22 June", venue: "wind creek", gameType: "1/3", bankWithdrawal: "0", buyIn: "$400", rebuys: "", timeIn: "1830", cashOut: "$446", timeOut: "2105", rank: "" },
  { date: "23 June", venue: "wind creek", gameType: "1/3", bankWithdrawal: "", buyIn: "$400", rebuys: "", timeIn: "2005", cashOut: "$0", timeOut: "2030", rank: "" },
  { date: "23 June", venue: "wind creek", gameType: "", bankWithdrawal: "", buyIn: "$500", rebuys: "", timeIn: "2030", cashOut: "$1,265", timeOut: "2220", rank: "" },
  { date: "28 June", venue: "rivers", gameType: "1/3", bankWithdrawal: "", buyIn: "$400", rebuys: "", timeIn: "2000", cashOut: "$0", timeOut: "2020", rank: "" },
  { date: "28 June", venue: "rivers", gameType: "2/5", bankWithdrawal: "", buyIn: "$450", rebuys: "", timeIn: "2020", cashOut: "$0", timeOut: "30", rank: "" },
  { date: "15 Jul", venue: "wind creek", gameType: "1/3", bankWithdrawal: "400", buyIn: "$420", rebuys: "", timeIn: "1800", cashOut: "$700", timeOut: "2005", rank: "" },
  { date: "20 Jul 26", venue: "wind creek", gameType: "1/3", bankWithdrawal: "", buyIn: "$600", rebuys: "", timeIn: "1900", cashOut: "$672", timeOut: "2140", rank: "" },
  { date: "21 Jul 26", venue: "wind creek", gameType: "1/3", bankWithdrawal: "", buyIn: "$600", rebuys: "", timeIn: "1910", cashOut: "$1,086", timeOut: "2150", rank: "" },
  { date: "27 Jul 26", venue: "wind creek", gameType: "1/3", bankWithdrawal: "500", buyIn: "$500", rebuys: "", timeIn: "1630", cashOut: "$893", timeOut: "2055", rank: "" },
  { date: "29 Jul 26", venue: "wind creek", gameType: "1/3", bankWithdrawal: "", buyIn: "$400", rebuys: "", timeIn: "1720", cashOut: "$1,708", timeOut: "1955", rank: "" },
  { date: "30 Jul 26", venue: "Marks game", gameType: "1/3", bankWithdrawal: "", buyIn: "$400", rebuys: "$400", timeIn: "1810", cashOut: "$0", timeOut: "2020", rank: "" },
  { date: "30 Jul 26", venue: "wind creek", gameType: "1/3", bankWithdrawal: "400", buyIn: "$400", rebuys: "$400", timeIn: "2020", cashOut: "$907", timeOut: "2130", rank: "" },
  { date: "1 Aug 26", venue: "Windy city Poker", gameType: "85 uber tournament", bankWithdrawal: "", buyIn: "$105", rebuys: "$35", timeIn: "1700", cashOut: "$0", timeOut: "1730", rank: "" },
  { date: "1 Aug 26", venue: "wind creek", gameType: "1/3", bankWithdrawal: "0", buyIn: "$220", rebuys: "", timeIn: "2031", cashOut: "$902", timeOut: "2134", rank: "" },
  { date: "3 Aug 26", venue: "wind creek", gameType: "1/3", bankWithdrawal: "0", buyIn: "$350", rebuys: "$200", timeIn: "1810", cashOut: "$0", timeOut: "1920", rank: "" },
  { date: "5 Aug 26", venue: "wind creek", gameType: "1/3", bankWithdrawal: "500", buyIn: "$500", rebuys: "", timeIn: "1730", cashOut: "$1,401", timeOut: "2100", rank: "" },
]);

export default STRATEGY_SHEET_SESSIONS;
