// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { roundCosts } from '../../src/sim/economy';
import { createRng } from '../../src/sim/rng';
import {
  BASE_RATES,
  SUPPLIERS,
  SUPPLY_CATEGORIES,
  canDealWith,
  contractRate,
  fairSupplyDiscount,
  marketRate,
  supplierById,
} from '../../src/sim/supply';

const market = (seed: string, category: (typeof SUPPLY_CATEGORIES)[number], years: number) =>
  marketRate(createRng(seed).stream(`market:${category}:${2031 + years}`), category, years);

describe('suppliers', () => {
  it('are fictional companies with unique ids, three to a category, each with a believable price index', () => {
    expect(new Set(SUPPLIERS.map((s) => s.id)).size).toBe(SUPPLIERS.length);
    for (const category of SUPPLY_CATEGORIES) {
      expect(SUPPLIERS.filter((s) => s.category === category)).toHaveLength(3);
    }
    for (const s of SUPPLIERS) {
      expect(s.priceIndex).toBeGreaterThanOrEqual(0.8);
      expect(s.priceIndex).toBeLessThanOrEqual(1.3);
      expect(s.reliability).toBeGreaterThan(0.8);
      expect(supplierById(s.id)).toBe(s);
    }
  });

  it('only deal with garages that have the prestige and that they serve', () => {
    const local = SUPPLIERS.find((s) => s.tier === 'local' && s.states !== null)!;
    const global = SUPPLIERS.find((s) => s.tier === 'global')!;
    expect(canDealWith(local, 0, local.states![0]!)).toBe(true);
    expect(canDealWith(local, 0, 'Bavaria')).toBe(false);
    expect(canDealWith(global, 49, 'Bavaria')).toBe(false);
    expect(canDealWith(global, 50, 'Bavaria')).toBe(true);
  });
});

describe('the market', () => {
  it('starts at the base price and is always the same for a seed', () => {
    for (const category of SUPPLY_CATEGORIES) {
      expect(market('m', category, 0)).toEqual({ rate: 1, shock: false });
      expect(market('m', category, 3)).toEqual(market('m', category, 3));
    }
  });

  it('sends race fuel up over the years, as the world runs out of petrol', () => {
    const average = (category: (typeof SUPPLY_CATEGORIES)[number], years: number) => {
      let sum = 0;
      for (let i = 0; i < 40; i++) sum += market(`seed-${i}`, category, years).rate;
      return sum / 40;
    };
    expect(average('race_fuel', 8)).toBeGreaterThan(average('race_fuel', 1) + 0.1);
    expect(average('race_fuel', 8)).toBeGreaterThan(average('electricity', 8));
  });

  it('stays between 70% and 200% of the base price for any seed and year', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 0, max: 30 }), (seed, years) => {
        for (const category of SUPPLY_CATEGORIES) {
          const { rate } = market(seed, category, years);
          expect(rate).toBeGreaterThanOrEqual(0.7);
          expect(rate).toBeLessThanOrEqual(2);
        }
      }),
    );
  });
});

describe('contracts', () => {
  it('give a fair discount of 4% plus 0.1% a point, up to 15%', () => {
    expect(fairSupplyDiscount(0)).toBeCloseTo(0.04);
    expect(fairSupplyDiscount(50)).toBeCloseTo(0.09);
    expect(fairSupplyDiscount(100)).toBe(0.14);
    expect(fairSupplyDiscount(1000)).toBe(0.15);
  });

  it('lock the supplier’s index times the market, less the discount', () => {
    const supplier = SUPPLIERS[0]!;
    expect(contractRate(supplier, 1.2, 0.1)).toBeCloseTo(supplier.priceIndex * 1.2 * 0.9, 4);
    expect(contractRate(supplier, 1, 0)).toBeCloseTo(supplier.priceIndex, 4);
  });
});

describe('what the round costs', () => {
  const input = { entries: 2, top31: 1, upkeep: [1, 1.5], distanceKm: 800 };

  it('is the same at the base prices as without rates', () => {
    expect(roundCosts({ ...input, rates: BASE_RATES })).toEqual(roundCosts(input));
  });

  it('follows each category’s price: fuel and utilities by entry, road fuel by distance', () => {
    const base = roundCosts(input);
    const dear = roundCosts({ ...input, rates: { ...BASE_RATES, race_fuel: 1.5 } });
    expect(dear.raceFuel).toBe(Math.round(base.raceFuel * 1.5));
    expect(dear.total - base.total).toBe(dear.raceFuel - base.raceFuel);
    const roads = roundCosts({ ...input, rates: { ...BASE_RATES, travel_fuel: 2 } });
    expect(roads.travel - base.travel).toBe(800);
    const haulage = roundCosts({ ...input, rates: { ...BASE_RATES, logistics: 0.5 } });
    expect(base.travel - haulage.travel).toBe(Math.round((2000 + 750) * 0.5));
  });
});
