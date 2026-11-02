// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  carValue,
  dealerBuybackPrice,
  listingPrice,
  distanceKm,
  newCarPrice,
  provenanceFactor,
  roundCosts,
  upkeepFactor,
  usedShareOfNew,
  wearFactor,
} from '../../src/sim/economy';

describe('used prices', () => {
  it('start at 70% of new and fall 5% a year to a floor of 40%', () => {
    expect(usedShareOfNew(0)).toBeCloseTo(0.7);
    expect(usedShareOfNew(2)).toBeCloseTo(0.6);
    expect(usedShareOfNew(6)).toBeCloseTo(0.4);
    expect(usedShareOfNew(50)).toBeCloseTo(0.4);
    expect(usedShareOfNew(-3)).toBeCloseTo(0.7);
  });

  it('never rise with age', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), (age) => {
        expect(usedShareOfNew(age + 1)).toBeLessThanOrEqual(usedShareOfNew(age));
      }),
    );
  });
});

describe('car value', () => {
  const base = {
    priceNew: 100_000,
    modelYear: 2031,
    currentYear: 2031,
    wear: 0,
    wins: 0,
    championships: 0,
    fans: 0,
  };

  it('is the used share of the new price for a clean car', () => {
    expect(carValue(base)).toBe(70_000);
  });

  it('falls with wear: 0.6% a point, so a worn-out car keeps 40%', () => {
    expect(wearFactor(0)).toBe(1);
    expect(wearFactor(100)).toBeCloseTo(0.4);
    expect(carValue({ ...base, wear: 50 })).toBe(49_000);
  });

  it('rises with wins, championships and fans, capped at 5x', () => {
    expect(provenanceFactor({ wins: 10, championships: 0, fans: 0 })).toBeCloseTo(1.3);
    expect(provenanceFactor({ wins: 0, championships: 1, fans: 0 })).toBeCloseTo(1.25);
    expect(provenanceFactor({ wins: 0, championships: 0, fans: 1_000_000 })).toBeCloseTo(1.15);
    expect(provenanceFactor({ wins: 1000, championships: 100, fans: 1e9 })).toBe(5);
    expect(carValue({ ...base, wins: 10 })).toBe(91_000);
  });

  it('is never negative, and a better record is never worth less', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 20 }),
        (wear, wins, extra) => {
          const a = carValue({ ...base, wear, wins });
          const b = carValue({ ...base, wear, wins: wins + extra });
          expect(a).toBeGreaterThanOrEqual(0);
          expect(b).toBeGreaterThanOrEqual(a);
        },
      ),
    );
  });
});

describe('prices and upkeep', () => {
  it('takes a discount off the new price and clamps it', () => {
    expect(newCarPrice(200_000)).toBe(200_000);
    expect(newCarPrice(200_000, 0.1)).toBe(180_000);
    expect(newCarPrice(200_000, 2)).toBe(0);
    expect(newCarPrice(200_000, -1)).toBe(200_000);
  });

  it('costs more to run the higher the tier', () => {
    expect(upkeepFactor('starter')).toBe(1);
    expect(upkeepFactor('premium')).toBe(1.5);
    expect(upkeepFactor('elite')).toBe(2.5);
    expect(upkeepFactor('hyper')).toBe(4);
  });
});

describe('distance', () => {
  it('is about 730 km from Brisbane to Sydney, and zero to itself', () => {
    const brisbane = { lat: -27.47, lon: 153.03 };
    const sydney = { lat: -33.87, lon: 151.21 };
    expect(distanceKm(brisbane, sydney)).toBeGreaterThan(700);
    expect(distanceKm(brisbane, sydney)).toBeLessThan(760);
    expect(distanceKm(brisbane, brisbane)).toBe(0);
  });
});

describe('round costs', () => {
  it('matches the Owner-driver balance check: a solo Starter car with no points', () => {
    const c = roundCosts({ entries: 1, top31: 0, upkeep: [1], distanceKm: 1500 });
    expect(c.entryFees).toBe(3000);
    expect(c.tyres).toBe(1500 + 2100);
    expect(c.servicing).toBe(1200);
    expect(c.travel).toBe(2000 + 1500);
    expect(c.total).toBe(3000 + 3600 + 1200 + 3500);
    // Six rounds: about $68,000 a season.
    expect(c.total * 6).toBeGreaterThan(65_000);
    expect(c.total * 6).toBeLessThan(75_000);
  });

  it('gives top-31 finishers free racing tyres but not free practice tyres', () => {
    const paying = roundCosts({ entries: 2, top31: 0, upkeep: [1, 1], distanceKm: 100 });
    const free = roundCosts({ entries: 2, top31: 2, upkeep: [1, 1], distanceKm: 100 });
    expect(paying.tyres - free.tyres).toBe(2 * 1500);
    expect(free.tyres).toBe(2 * 2100);
  });

  it('charges extra travel for each extra entry and scales servicing by upkeep', () => {
    const one = roundCosts({ entries: 1, top31: 0, upkeep: [4], distanceKm: 0 });
    const two = roundCosts({ entries: 2, top31: 0, upkeep: [1, 1], distanceKm: 0 });
    expect(one.servicing).toBe(4800);
    expect(two.travel - one.travel).toBe(750);
  });
});

describe('dealer prices', () => {
  it('pays 80% of value and asks 110%, so a dealer always makes a margin', () => {
    expect(dealerBuybackPrice(100_000)).toBe(80_000);
    expect(listingPrice(100_000)).toBe(110_000);
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: 5_000_000 }), (value) => {
        expect(listingPrice(value)).toBeGreaterThan(dealerBuybackPrice(value));
      }),
    );
  });
});
