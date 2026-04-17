/**
 * lessons.js — curated teaching content for the Lessons tab.
 *
 * Each lesson pairs plain-English theory with worked matchup examples. The
 * UI renders sections sequentially; `example` sections call
 * computeHandVsHand + classifyMatchup on reveal so users see exact equity
 * alongside the conceptual framework.
 *
 * Shape:
 *   { id, title, frameworkId, summary, sections: Section[] }
 *
 * Section kinds:
 *   { kind: 'prose',   heading?, body }
 *   { kind: 'formula', body }
 *   { kind: 'example', a, b, takeaway }
 *
 * Pure module — no imports from UI or state layers.
 */

export const LESSONS = [
  {
    id: 'equity-decomposition',
    title: 'Equity Decomposition',
    frameworkId: 'decomposition',
    summary: 'Every equity number is really three equity numbers added up.',
    sections: [
      {
        kind: 'prose',
        heading: 'The Core Idea',
        body:
          'All-in preflop equity decomposes into three sources: (1) pair-up equity — your cards pair up by the river, (2) draw equity — you complete a straight or flush, and (3) backdoor equity — runner-runner everything. When someone says "AK has 46% against a pair," that 46% is the sum of ~35% from pairing an A or K, ~5% from making a straight, ~3% from making a flush, and ~3% from backdoors.',
      },
      {
        kind: 'formula',
        body: 'Equity ≈ PairUp + Straight + Flush + Backdoor',
      },
      {
        kind: 'prose',
        heading: 'Why Decompose',
        body:
          'Without decomposing, you memorize numbers. With decomposing, you predict numbers. A dry low pair like 22 against AKo has almost no straight/flush equity — the entire 52% comes from the pair already being made. A suited connector like 65s against AKo has almost no pair equity — its 40% comes entirely from draws.',
      },
      {
        kind: 'example',
        a: 'AKo',
        b: '22',
        takeaway:
          'Classic coin-flip shape. AK is nearly all pair-up equity (pair an A or K on ~49% of flops); 22 is already made and contributes ~6% from set mining plus ~2% backdoors.',
      },
      {
        kind: 'example',
        a: 'AKs',
        b: 'AKo',
        takeaway:
          'Kicker is moot (tie with any pair). All of AKs\'s ~52-48 edge comes from flush equity alone.',
      },
      {
        kind: 'prose',
        heading: 'Common Mistakes',
        body:
          'Thinking "AK wins because it\'s a premium hand." It wins because it pairs up 49% of the time. Treating hand strength as an intrinsic property instead of a sum of achievable board-connections is the most common beginner error.',
      },
    ],
  },

  {
    id: 'domination',
    title: 'Domination',
    frameworkId: 'domination',
    summary: 'Shared cards set a steep equity ceiling — and the kicker barely matters.',
    sections: [
      {
        kind: 'prose',
        heading: 'The Core Idea',
        body:
          'When two hands share a rank (AK vs AQ, KQ vs KJ), the dominated hand can only win by pairing its kicker without the dominating hand pairing anything higher. That\'s a narrow path. Dominated matchups land in a remarkably tight ~70–73% band almost regardless of the kicker gap — the ace or king is the primary equity driver, not the second card.',
      },
      {
        kind: 'prose',
        heading: 'Kicker Gap Barely Moves the Needle',
        body:
          'AKo vs AQo is 73.4%. AKo vs A2o is 72.5%. Same shape despite a 9-rank kicker difference. Why? The kicker only plays on boards where neither pair card appears — a small slice of the flop distribution — and even then the dominated hand can counterfeit with a pair on the board.',
      },
      {
        kind: 'example',
        a: 'AKo',
        b: 'AQo',
        takeaway: 'Shared Ace, kicker gap 1 — 73% for AK.',
      },
      {
        kind: 'example',
        a: 'AKo',
        b: 'A2o',
        takeaway: 'Shared Ace, kicker gap 11 — still only 72% for AK. Gap size barely mattered.',
      },
      {
        kind: 'example',
        a: 'AA',
        b: 'AKo',
        takeaway:
          'Pair dominates kicker — completely different scenario. AA has a made set whenever an A appears, and AKo can only catch straights or running pairs. ~92%.',
      },
      {
        kind: 'prose',
        heading: 'Common Mistakes',
        body:
          'Assuming bigger kicker gap = bigger equity edge. It doesn\'t, for unpaired-vs-unpaired shared-rank matchups. Domination is about the structure, not the kicker size.',
      },
    ],
  },

  {
    id: 'pair-over-pair',
    title: 'Pair over Pair',
    frameworkId: 'pair_over_pair',
    summary: 'Higher pair is always ~82%, regardless of which pairs.',
    sections: [
      {
        kind: 'prose',
        heading: 'The Core Idea',
        body:
          'When two different pairs meet, the higher pair wins ~4.5:1 (about 82%). The lower pair\'s main route to victory is flopping a set (~11.8% on the flop, ~19% by the river). Overcards don\'t help the lower pair because every overcard rank is already accounted for by the higher pair\'s hand.',
      },
      {
        kind: 'formula',
        body: 'Lower pair equity ≈ 18–22%, driven almost entirely by set-mining.',
      },
      {
        kind: 'example',
        a: 'AA',
        b: 'KK',
        takeaway:
          'The classic cooler. 82% for AA. KK has to flop a K (no A) — boards where both hit are vanishingly rare.',
      },
      {
        kind: 'example',
        a: 'AA',
        b: '22',
        takeaway:
          'Max rank gap doesn\'t help much — still ~82% for AA. The lower pair\'s equity is bounded by set-mining, which is rank-independent.',
      },
      {
        kind: 'example',
        a: 'JJ',
        b: 'TT',
        takeaway: 'Tiny rank gap — still ~82% for JJ. The pair-over-pair ratio is remarkably stable.',
      },
      {
        kind: 'prose',
        heading: 'Set-over-Set: The Rare Disaster',
        body:
          'When both pairs flop a set, the lower set almost always loses stacks. The probability of both flopping a set simultaneously is very low (~1.4%), but it dominates your all-in variance when it does happen.',
      },
    ],
  },

  {
    id: 'race-family',
    title: 'The Race Family',
    frameworkId: 'race',
    summary: 'Pair vs unpaired — the classic "race" and its lopsided cousins.',
    sections: [
      {
        kind: 'prose',
        heading: 'Three Shapes',
        body:
          'Pair-vs-unpaired with no shared rank breaks into three shapes: (1) pair vs two overcards ("the race," ~54% for the pair), (2) pair vs split (one over, one under, ~68% for the pair), and (3) pair vs two undercards (~76–88% for the pair, widest band).',
      },
      {
        kind: 'prose',
        heading: 'Why the Split Case Skews',
        body:
          'In the split case, only ONE of the unpaired hand\'s cards can pair above the pair to beat it. Half the "pair up something" equity is already dead on arrival. That\'s why 88 vs AT is ~68%, not ~54%.',
      },
      {
        kind: 'example',
        a: '77',
        b: 'AKo',
        takeaway: 'The textbook race — 77 is 54%. Two live overcards to pair, no shared rank.',
      },
      {
        kind: 'example',
        a: '88',
        b: 'A5o',
        takeaway:
          'Pair vs split — the 5 is already dominated by the 8s. Only the A is live to over-pair. ~70% for 88.',
      },
      {
        kind: 'example',
        a: 'TT',
        b: '87s',
        takeaway:
          'Pair vs connected suited unders — bottom of the "two unders" band. Straight + flush + set-mining equity pushes 87s up to ~24%.',
      },
      {
        kind: 'example',
        a: 'AA',
        b: '72o',
        takeaway:
          'Pair vs disconnected offsuit unders — top of the band. 72o has almost nothing to draw to. ~88% for AA.',
      },
      {
        kind: 'prose',
        heading: 'Common Mistakes',
        body:
          'Calling every pair-vs-unpaired matchup "a race." Only the pair-vs-two-overs shape is actually ~50/50. The split and undercard shapes are increasingly lopsided.',
      },
    ],
  },

  {
    id: 'straight-coverage',
    title: 'Straight Coverage',
    frameworkId: 'straight_coverage',
    summary: 'Why AK and AQ are NOT equivalent straight hands.',
    sections: [
      {
        kind: 'prose',
        heading: 'The Core Idea',
        body:
          'Every hand participates in some set of 5-card straight patterns. "Direct" runs use both hole cards (AK is in TJQKA only). "Single-card" runs use one hole card plus four board cards (AK can make A2345 with just its Ace, or 9TJQK with just its King). Direct runs are worth more equity because the board only needs 3 specific cards, not 4.',
      },
      {
        kind: 'formula',
        body: 'Coverage Score = 2.0 × direct runs (live) + 0.7 × single-card runs (live)',
      },
      {
        kind: 'prose',
        heading: 'AK vs AQ: The Distinction',
        body:
          'AK participates in 3 straight runs total: A2345 (A only), 9TJQK (K only), TJQKA (both). AQ participates in 4: A2345 (A only), 89TJQ (Q only), 9TJQK (Q only), TJQKA (both). The Q sits in one more 5-card run than the K does. AQ therefore carries slightly more straight-coverage equity — a small but real edge that old "just count direct runs" frameworks miss.',
      },
      {
        kind: 'example',
        a: 'AKo',
        b: 'AQo',
        takeaway:
          'Shared Ace dominates the headline equity, but the coverage-score panel shows AQ has higher single-card run count.',
      },
      {
        kind: 'example',
        a: 'AKo',
        b: 'JTs',
        takeaway:
          'AK blocks 2 of JT\'s 4 direct runs (9TJQK and TJQKA both need an A or K). AK\'s own Broadway is blocked because JT has the J and T. Heavy blocker matchup.',
      },
      {
        kind: 'example',
        a: 'AKo',
        b: 'QQ',
        takeaway:
          'QQ crushes AK\'s straight coverage — TJQKA blocked (board needs a Q, QQ has 2 of 4), 9TJQK blocked too. AK drops from 3 live runs to 1 (just the wheel).',
      },
      {
        kind: 'example',
        a: 'AQo',
        b: 'QQ',
        takeaway:
          'Contrast: AQ keeps ALL its straight coverage vs QQ. Because AQ holds the Q, QQ\'s blocker doesn\'t remove any board-needed card. Another reason AQ outperforms AK in some matchups.',
      },
      {
        kind: 'prose',
        heading: 'Common Mistakes',
        body:
          'Counting only "direct" straight combos (both cards in the run). Single-card runs are worth less per combo, but there are typically more of them, and their contribution compounds across the whole hand distribution.',
      },
    ],
  },

  {
    id: 'flush-contention',
    title: 'Flush Contention',
    frameworkId: 'flush_contention',
    summary: 'Suited is worth ~+3%. When both sides are suited in the same suit, they pay a contention tax.',
    sections: [
      {
        kind: 'prose',
        heading: 'The Core Idea',
        body:
          'Suitedness is worth about +3% all-in equity vs an offsuit version of the same two ranks — roughly the probability you make a flush by the river times the frequency it wins. When BOTH hands are suited, 1 in 4 suit-combinations puts them on the same flush draw; the rest are independent. That contention costs each side roughly 0.7% on average.',
      },
      {
        kind: 'formula',
        body: 'One suited: +3.0%.  Both suited: +2.3% each.  Neither suited: +0.5% (backdoor only).',
      },
      {
        kind: 'example',
        a: 'AKs',
        b: 'QJo',
        takeaway:
          'Only AKs is suited. Full +3% flush upside — QJo cannot contest the same flush suit.',
      },
      {
        kind: 'example',
        a: 'AKs',
        b: 'JTs',
        takeaway:
          'Both suited. Across all suit assignments, ~1/4 share a suit and run into each other on flush boards. Each side net ~+2.3% instead of +3%.',
      },
      {
        kind: 'prose',
        heading: 'When Contention Really Bites',
        body:
          'Contention matters most when both hands are drawing to the same flush and the higher flush wins most of the time — e.g., AhKh vs JhTh. Every heart board that gives both players a flush is a cooler for JTs. That asymmetry is baked into the all-suits average.',
      },
      {
        kind: 'prose',
        heading: 'Common Mistakes',
        body:
          'Assuming suited connectors are "flush hands." On their own, suitedness contributes only ~3% — draws come primarily from straight potential, not flushes. The flush is a tiebreaker, not the engine.',
      },
    ],
  },

  {
    id: 'broadway-vs-middling',
    title: 'Broadway vs Middling',
    frameworkId: 'broadway_vs_connector',
    summary: 'Why broadway hands lopsidedly block middle suited connectors.',
    sections: [
      {
        kind: 'prose',
        heading: 'The Core Idea',
        body:
          'Hands like AK, AQ, KQ, KJ sit at the top of every Broadway straight — and because there are only 10 five-card straights total, blocking a few of them is a meaningful chunk of a connector\'s equity. Middle suited connectors (JTs, T9s) have the MOST direct straight runs of any hand shape (4 each), but the TOP two of their runs always contain a broadway rank — so broadway hands kill half their coverage.',
      },
      {
        kind: 'example',
        a: 'AKo',
        b: 'JTs',
        takeaway:
          'JT has 4 direct runs (789TJ, 89TJQ, 9TJQK, TJQKA). AK blocks the top two (9TJQK has K; TJQKA has both A and K). JT keeps only 2 live.',
      },
      {
        kind: 'example',
        a: 'AKo',
        b: '54s',
        takeaway:
          'Contrast: 54s has 4 direct runs (A2345, 23456, 34567, 45678). AK blocks only 1 (the wheel has the A). 54s keeps 3 live — far more than JT did.',
      },
      {
        kind: 'example',
        a: 'AKo',
        b: '76s',
        takeaway:
          '76\'s 4 direct runs (34567, 45678, 56789, 6789T) contain neither A nor K — all 4 stay live vs AK. Middle-low connectors actually keep MORE coverage vs broadway than middle-high connectors do.',
      },
      {
        kind: 'prose',
        heading: 'Takeaway for Preflop Strategy',
        body:
          'Broadway hands win more against middle connectors (JTs, T9s) than against low connectors (54s, 65s) because of this blocker effect, even though the raw hand strengths look similar. This is why AKo vs 54s is only ~60% but AKo vs JTs is ~62% — despite 54s looking "worse" on paper, it actually keeps more straight coverage alive.',
      },
    ],
  },
];

/**
 * Find a lesson by id.
 */
export const findLesson = (id) => LESSONS.find((l) => l.id === id) || null;
