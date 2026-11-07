// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  FOUNDING_SHARES,
  drawCapTable,
  shareTotals,
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
