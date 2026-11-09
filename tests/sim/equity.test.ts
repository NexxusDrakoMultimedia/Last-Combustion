// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  FOUNDING_SHARES,
  MAX_ROUND_STAKE,
  boardOf,
  controlOf,
  drawCapTable,
  drawInvestors,
  noConfidence,
  reservePremium,
  roundName,
  roundTerms,
  seasonTarget,
  shareTotals,
  sharesPrice,
  splitDividend,
  takeoverQuote,
  targetMet,
  valuationOf,
  votesOf,
  type DrawContext,
} from '../../src/sim/equity';
import { createRng } from '../../src/sim/rng';

describe('a garage’s valuation', () => {
  const base = { cash: 0, cars: 0, yearlyProfits: [], fans: 0, prestige: 0, titles: 0 };

  it('is cash and cars for a new garage with no history', () => {
    const v = valuationOf({ ...base, cash: 100_000, cars: 40_000, fans: 5, prestige: 1 });
    expect(v.total).toBe(100_000 + 40_000 + 100 + 2_000);
  });

  it('adds four times the average yearly profit of up to three years, never below zero', () => {
    expect(valuationOf({ ...base, yearlyProfits: [30_000, 60_000, 90_000] }).profit).toBe(240_000);
    expect(valuationOf({ ...base, yearlyProfits: [30_000] }).profit).toBe(120_000);
    expect(valuationOf({ ...base, yearlyProfits: [-50_000, -10_000] }).profit).toBe(0);
    // Only the three newest years count.
    expect(
      valuationOf({ ...base, yearlyProfits: [10_000, 10_000, 10_000, 1_000_000] }).profit,
    ).toBe(40_000);
  });

  it('adds $20 a fan, $2,000 times prestige squared and $50,000 a title', () => {
    const v = valuationOf({ ...base, fans: 1_000, prestige: 30, titles: 2 });
    expect(v.fans).toBe(20_000);
    expect(v.prestige).toBe(1_800_000);
    expect(v.titles).toBe(100_000);
    expect(v.total).toBe(1_920_000);
  });

  it('is never below its cash and cars when those are not negative', () => {
    fc.assert(
      fc.property(
        fc.record({
          cash: fc.integer({ min: 0, max: 1e8 }),
          cars: fc.integer({ min: 0, max: 1e8 }),
          yearlyProfits: fc.array(fc.integer({ min: -1e7, max: 1e7 }), { maxLength: 5 }),
          fans: fc.integer({ min: 0, max: 1e6 }),
          prestige: fc.integer({ min: 1, max: 100 }),
          titles: fc.integer({ min: 0, max: 20 }),
        }),
        (input) => {
          const v = valuationOf(input);
          expect(v.total).toBeGreaterThanOrEqual(input.cash + input.cars);
          expect(v.total).toBe(v.cash + v.cars + v.profit + v.fans + v.prestige + v.titles);
        },
      ),
    );
  });
});

const ctx: DrawContext = {
  founder: 'Founder Person',
  surname: 'Person',
  relative: () => 'Relative',
  investor: () => 'Investor Person',
  sponsors: [
    { id: 1, name: 'Sponsor One' },
    { id: 2, name: 'Sponsor Two' },
  ],
  manufacturers: [{ id: 9, name: 'Maker Nine' }],
};

describe('the starting owners of a computer garage', () => {
  it('always add up to the founding capital, with the founder holding the rest', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (seed) => {
        const table = drawCapTable(createRng(seed).stream('cap'), ctx);
        expect(table.reduce((sum, h) => sum + h.shares, 0)).toBe(FOUNDING_SHARES);
        expect(table[0]!.type).toBe('owner');
        expect(table[0]!.shares).toBeGreaterThan(0);
        expect(table.every((h) => h.shares > 0)).toBe(true);
      }),
    );
  });

  it('come out the same for the same stream', () => {
    const a = drawCapTable(createRng('s').stream('cap:1'), ctx);
    const b = drawCapTable(createRng('s').stream('cap:1'), ctx);
    expect(a).toEqual(b);
  });

  it('are mostly family owned, a fifth with an investor on preferred shares, a few with a strategic holder', () => {
    let family = 0;
    let investor = 0;
    let strategic = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const table = drawCapTable(createRng('mix').stream(`cap:${i}`), ctx);
      if (table.some((h) => h.type === 'investor')) {
        investor++;
        expect(table.find((h) => h.type === 'investor')!.class).toBe('preferred');
      } else if (table.some((h) => h.type === 'sponsor' || h.type === 'manufacturer')) strategic++;
      else family++;
    }
    expect(family / n).toBeGreaterThan(0.64);
    expect(family / n).toBeLessThan(0.76);
    expect(investor / n).toBeGreaterThan(0.16);
    expect(investor / n).toBeLessThan(0.24);
    expect(strategic / n).toBeGreaterThan(0.06);
    expect(strategic / n).toBeLessThan(0.14);
  });

  it('give a relative the founder’s surname', () => {
    for (let i = 0; i < 200; i++) {
      for (const h of drawCapTable(createRng('fam').stream(`cap:${i}`), ctx))
        if (h.type === 'family') expect(h.name.endsWith('Person')).toBe(true);
    }
  });
});

describe('shares and votes', () => {
  it('count issued shares apart from the option pool, and give votes to ordinary shares only', () => {
    const holdings = [
      { shares: 700_000, class: 'ordinary' as const },
      { shares: 200_000, class: 'preferred' as const },
      { shares: 100_000, class: 'option' as const },
    ];
    expect(shareTotals(holdings)).toEqual({ outstanding: 900_000, diluted: 1_000_000 });
    expect(votesOf(holdings[0]!)).toBe(700_000);
    expect(votesOf(holdings[1]!)).toBe(0);
    expect(votesOf(holdings[2]!)).toBe(0);
  });
});

describe('funding rounds', () => {
  it('give the investor the stake their money is worth to them, as new shares', () => {
    // A garage worth $900,000 that an investor values at 100%: $100,000 in buys 10% of the result.
    const t = roundTerms(900_000, 1_000_000, 100_000, 1);
    expect(t.stake).toBeCloseTo(0.1, 10);
    expect(t.newShares).toBeCloseTo(111_111, -1);
    expect(t.preMoney).toBe(900_000);
    expect(t.postMoney).toBe(1_000_000);
    expect(t.pricePerShare).toBeCloseTo(0.9, 2);
    // After the round the investor holds the stake they were quoted.
    expect(t.newShares / (1_000_000 + t.newShares)).toBeCloseTo(t.stake, 4);
  });

  it('give a bigger stake to an investor who believes in the garage less, and for more money', () => {
    const base = roundTerms(500_000, 1_000_000, 100_000, 1);
    expect(roundTerms(500_000, 1_000_000, 100_000, 0.8).stake).toBeGreaterThan(base.stake);
    expect(roundTerms(500_000, 1_000_000, 200_000, 1).stake).toBeGreaterThan(base.stake);
  });

  it('never give away the whole garage, whatever the amount, for a garage that is worth something', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1e8 }),
        fc.integer({ min: 1, max: 5e6 }),
        fc.integer({ min: 1, max: 1e9 }),
        fc.double({ min: 0.5, max: 1.5, noNaN: true }),
        (value, issued, amount, appetite) => {
          const t = roundTerms(value, issued, amount, appetite);
          expect(t.stake).toBeGreaterThan(0);
          expect(t.stake).toBeLessThan(1);
          expect(t.newShares).toBeGreaterThan(0);
        },
      ),
    );
  });

  it('would give a worthless garage away entirely, which the limit on a round refuses', () => {
    const t = roundTerms(0, 1_000_000, 100_000, 1);
    expect(t.stake).toBe(1);
    expect(t.stake).toBeGreaterThan(MAX_ROUND_STAKE);
    expect(roundTerms(-50_000, 1_000_000, 100_000, 1).stake).toBe(1);
  });

  it('are named by order', () => {
    expect(roundName(1)).toBe('Seed');
    expect(roundName(2)).toBe('Series A');
    expect(roundName(99)).toBe('Series D');
  });

  it('put three investors on offer, each valuing the garage between 80% and 115%', () => {
    let n = 0;
    const offers = drawInvestors(createRng('inv').stream('x'), () => `Investor ${++n}`);
    expect(offers).toHaveLength(3);
    for (const o of offers) {
      expect(o.appetite).toBeGreaterThanOrEqual(0.8);
      expect(o.appetite).toBeLessThanOrEqual(1.15);
    }
  });
});

describe('dividends and buy-backs', () => {
  const holdings = [
    { id: 1, shares: 600_000, class: 'ordinary' as const },
    { id: 2, shares: 300_000, class: 'preferred' as const },
    { id: 3, shares: 100_000, class: 'option' as const },
  ];

  it('split in proportion to the shares that are issued, and nothing goes to the option pool', () => {
    const parts = splitDividend(holdings, 90_000);
    expect(parts.get(1)).toBe(60_000);
    expect(parts.get(2)).toBe(30_000);
    expect(parts.has(3)).toBe(false);
  });

  it('always add up to the dividend, in whole dollars', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1_000_000 }), { minLength: 1, maxLength: 8 }),
        fc.integer({ min: 1, max: 5e7 }),
        (shares, total) => {
          const parts = splitDividend(
            shares.map((s, i) => ({ id: i + 1, shares: s, class: 'ordinary' as const })),
            total,
          );
          expect([...parts.values()].reduce((a, b) => a + b, 0)).toBe(total);
          expect([...parts.values()].every((v) => Number.isInteger(v) && v >= 0)).toBe(true);
        },
      ),
    );
  });

  it('price shares at the garage’s valuation', () => {
    expect(sharesPrice(1_000_000, 1_000_000, 100_000)).toBe(100_000);
    expect(sharesPrice(2_000_000, 1_000_000, 50_000)).toBe(100_000);
    expect(sharesPrice(-5, 1_000_000, 100_000)).toBe(0);
    expect(sharesPrice(1_000_000, 0, 10)).toBe(0);
  });
});

describe('control of a garage', () => {
  const h = (
    id: number,
    type: string,
    name: string,
    shares: number,
    cls: 'ordinary' | 'preferred' | 'option',
  ) => ({
    id,
    type,
    name,
    shares,
    class: cls,
  });

  it('is the owner’s while they hold over half of the votes', () => {
    const c = controlOf([
      h(1, 'owner', 'Owner', 600_000, 'ordinary'),
      h(2, 'investor', 'Inv', 400_000, 'ordinary'),
    ]);
    expect(c.level).toBe('control');
    expect(c.ownerVotes).toBeCloseTo(0.6, 10);
    expect(c.blockers).toEqual([{ name: 'Inv', votes: expect.closeTo(0.4, 10) }]);
  });

  it('only counts ordinary shares as votes', () => {
    const c = controlOf([
      h(1, 'owner', 'Owner', 100_000, 'ordinary'),
      h(2, 'investor', 'Inv', 900_000, 'preferred'),
    ]);
    expect(c.ownerVotes).toBe(1);
    expect(c.level).toBe('control');
    expect(c.blockers).toEqual([]);
  });

  it('is a blocking minority at a quarter of the votes and none below, and loses control at half', () => {
    expect(
      controlOf([
        h(1, 'owner', 'O', 500_000, 'ordinary'),
        h(2, 'investor', 'I', 500_000, 'ordinary'),
      ]).level,
    ).toBe('blocking');
    expect(
      controlOf([
        h(1, 'owner', 'O', 250_000, 'ordinary'),
        h(2, 'investor', 'I', 750_000, 'ordinary'),
      ]).level,
    ).toBe('blocking');
    expect(
      controlOf([
        h(1, 'owner', 'O', 249_000, 'ordinary'),
        h(2, 'investor', 'I', 751_000, 'ordinary'),
      ]).level,
    ).toBe('minority');
    expect(
      controlOf([
        h(1, 'owner', 'O', 800_000, 'ordinary'),
        h(2, 'investor', 'I', 190_000, 'ordinary'),
        h(3, 'family', 'F', 10_000, 'ordinary'),
      ]).blockers,
    ).toEqual([]);
  });

  it('adds up the votes of one holder with several holdings', () => {
    const c = controlOf([
      h(1, 'owner', 'O', 500_000, 'ordinary'),
      h(2, 'investor', 'I', 140_000, 'ordinary'),
      h(3, 'investor', 'I', 140_000, 'ordinary'),
      h(4, 'family', 'F', 220_000, 'ordinary'),
    ]);
    expect(c.blockers.map((b) => b.name)).toEqual(['I']);
  });
});

describe('the board and its targets', () => {
  const holders = [
    { id: 1, type: 'owner', name: 'Owner', shares: 700_000, class: 'ordinary' as const },
    { id: 2, type: 'investor', name: 'Big Investor', shares: 200_000, class: 'preferred' as const },
    { id: 3, type: 'investor', name: 'Small Investor', shares: 50_000, class: 'ordinary' as const },
    { id: 4, type: 'family', name: 'Relative', shares: 50_000, class: 'ordinary' as const },
  ];

  it('seats the owner, each outside holder with a tenth of the issued shares, and a chair', () => {
    const board = boardOf(holders, 'Owner', 'Chair Person');
    expect(board.map((d) => [d.seat, d.name])).toEqual([
      ['owner', 'Owner'],
      ['investor', 'Big Investor'],
      ['chair', 'Chair Person'],
    ]);
    expect(board[1]!.stake).toBeCloseTo(0.2, 10);
  });

  it('expects last season’s finish, or the garage’s place by prestige if it has none', () => {
    expect(seasonTarget(12, 80)).toBe(12);
    expect(seasonTarget(null, 80)).toBe(80);
  });

  it('is met by a finish at or above the target, and never by no finish', () => {
    expect(targetMet(10, 12)).toBe(true);
    expect(targetMet(12, 12)).toBe(true);
    expect(targetMet(13, 12)).toBe(false);
    expect(targetMet(null, 12)).toBe(false);
  });

  it('calls for a vote of no confidence after two misses in a row, without a majority', () => {
    expect(noConfidence([true, true], 0.4)).toBe(true);
    expect(noConfidence([true, true], 0.5)).toBe(true);
    expect(noConfidence([true, true], 0.51)).toBe(false);
    expect(noConfidence([true, false], 0.2)).toBe(false);
    expect(noConfidence([true], 0.2)).toBe(false);
    expect(noConfidence([false, true, true], 0.2)).toBe(false);
  });
});

describe('what holders ask to sell', () => {
  it('is drawn once, within the range for the kind of holder', () => {
    for (let i = 0; i < 100; i++) {
      const founder = reservePremium('owner', createRng('r').stream(`f${i}`));
      expect(founder).toBeGreaterThanOrEqual(0.2);
      expect(founder).toBeLessThanOrEqual(0.8);
      const investor = reservePremium('investor', createRng('r').stream(`i${i}`));
      expect(investor).toBeGreaterThanOrEqual(0);
      expect(investor).toBeLessThanOrEqual(0.4);
    }
    expect(reservePremium('investor', createRng('r').stream('same'))).toBe(
      reservePremium('investor', createRng('r').stream('same')),
    );
  });
});

describe('a takeover bid', () => {
  const h = (
    id: number,
    type: string,
    shares: number,
    cls: 'ordinary' | 'preferred' | 'option',
    reserve: number,
    mine = false,
  ) => ({ id, type, name: `H${id}`, shares, class: cls, reserve, mine });
  const holders = [
    h(1, 'owner', 600_000, 'ordinary', 0.5),
    h(2, 'family', 100_000, 'ordinary', 0.1),
    h(3, 'investor', 300_000, 'preferred', 0.2),
  ];

  it('is accepted by the holders whose reserve is at or below the premium', () => {
    const q = takeoverQuote(holders, 1_000_000, 0.2);
    expect(q.accepting).toEqual([2, 3]);
    // Only ordinary shares vote: the family holds 100,000 of 700,000 votes.
    expect(q.votes).toBeCloseTo(1 / 7, 10);
    expect(q.success).toBe(false);
  });

  it('carries once the founder accepts, and buys everyone out at the same price', () => {
    const q = takeoverQuote(holders, 1_000_000, 0.5);
    expect(q.success).toBe(true);
    expect(q.votes).toBe(1);
    expect(q.pricePerShare).toBeCloseTo(1.5, 10);
    expect(q.cost).toBe(1_500_000);
    expect(q.boardSupports).toBe(true);
  });

  it('counts the bidder’s own shares and does not charge for them', () => {
    const mine = [h(1, 'owner', 600_000, 'ordinary', 0.5, true), ...holders.slice(1)];
    const q = takeoverQuote(mine, 1_000_000, 0);
    expect(q.success).toBe(true);
    expect(q.cost).toBe(Math.round(100_000) + Math.round(300_000));
    expect(q.accepting).not.toContain(1);
  });

  it('says the board fights while the founder will not sell, even if the bid carries without them', () => {
    const split = [
      h(1, 'owner', 300_000, 'ordinary', 0.8),
      h(2, 'family', 400_000, 'ordinary', 0.1),
      h(3, 'investor', 300_000, 'ordinary', 0.1),
    ];
    const q = takeoverQuote(split, 1_000_000, 0.2);
    expect(q.success).toBe(true);
    expect(q.boardSupports).toBe(false);
  });

  it('never costs less than nothing, and costs more the higher the premium', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1e6, max: 1e8 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (value, a, b) => {
          const low = Math.min(a, b);
          const high = Math.max(a, b);
          const qLow = takeoverQuote(holders, value, low);
          const qHigh = takeoverQuote(holders, value, high);
          expect(qLow.cost).toBeGreaterThanOrEqual(0);
          expect(qHigh.cost).toBeGreaterThanOrEqual(qLow.cost - 3);
          expect(qHigh.votes).toBeGreaterThanOrEqual(qLow.votes);
        },
      ),
    );
  });
});
