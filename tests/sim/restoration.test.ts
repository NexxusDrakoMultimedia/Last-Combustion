// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  chassisWear,
  restoredWear,
  restorationCost,
  restorationFloor,
  wearFromKm,
  wornOutByRestoration,
} from '../../src/sim/wear';

const TIERS = ['starter', 'mid', 'premium', 'elite', 'hyper', 'unique'] as const;

describe('the wear floor', () => {
  it('rises with every full restoration by a step that depends on the tier, up to 60', () => {
    expect([0, 1, 2, 3, 4].map((n) => restorationFloor(n, 'starter'))).toEqual([0, 5, 10, 15, 20]);
    expect([0, 1, 2, 3].map((n) => restorationFloor(n, 'mid'))).toEqual([0, 6, 12, 18]);
    expect([1, 2].map((n) => restorationFloor(n, 'premium'))).toEqual([10, 20]);
    expect([1, 2].map((n) => restorationFloor(n, 'elite'))).toEqual([8, 16]);
    expect([1, 2].map((n) => restorationFloor(n, 'hyper'))).toEqual([16, 32]);
    for (const tier of TIERS) {
      expect(restorationFloor(12, tier)).toBeLessThanOrEqual(60);
      expect(restorationFloor(50, tier)).toBe(60);
    }
  });

  it('is steeper for a tier with a shorter life, the way the oldest age is', () => {
    // Starter 25 years, Mid 20, Elite 15, Premium 12, Hyper 8: a shorter life, a bigger step.
    const step = (tier: (typeof TIERS)[number]) => restorationFloor(1, tier);
    expect(step('starter')).toBeLessThan(step('mid'));
    expect(step('mid')).toBeLessThan(step('elite'));
    expect(step('elite')).toBeLessThan(step('premium'));
    expect(step('premium')).toBeLessThan(step('hyper'));
  });
});

describe('when a restoration wears a car out', () => {
  it('retires the car once its least wear is past 50', () => {
    // The Starter floor is 50 after ten restorations (not past it) and 55 after eleven.
    expect(wornOutByRestoration(10, 'starter')).toBe(false);
    expect(wornOutByRestoration(11, 'starter')).toBe(true);
    expect(wornOutByRestoration(8, 'mid')).toBe(false);
    expect(wornOutByRestoration(9, 'mid')).toBe(true);
    expect(wornOutByRestoration(5, 'premium')).toBe(false);
    expect(wornOutByRestoration(6, 'premium')).toBe(true);
    expect(wornOutByRestoration(6, 'elite')).toBe(false);
    expect(wornOutByRestoration(7, 'elite')).toBe(true);
    expect(wornOutByRestoration(3, 'hyper')).toBe(false);
    expect(wornOutByRestoration(4, 'hyper')).toBe(true);
    expect(wornOutByRestoration(0, 'starter')).toBe(false);
  });
});

describe('what a full restoration costs', () => {
  it('is the new price, and a quarter more for each one before', () => {
    expect([0, 1, 2, 3].map((n) => restorationCost(100_000, n))).toEqual([
      100_000, 125_000, 150_000, 175_000,
    ]);
  });

  it('always rises with the number of restorations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 5_000_000 }),
        fc.integer({ min: 0, max: 30 }),
        (price, n) => {
          expect(restorationCost(price, n + 1)).toBeGreaterThanOrEqual(restorationCost(price, n));
          expect(restorationCost(price, n)).toBeGreaterThanOrEqual(price);
        },
      ),
    );
  });
});

describe('the wear left by a restoration', () => {
  it('is the new floor plus a tenth of the wear above it', () => {
    expect(restoredWear(80, 1, 'starter')).toBeCloseTo(5 + 0.1 * 75);
    expect(restoredWear(50, 2, 'starter')).toBeCloseTo(10 + 0.1 * 40);
    expect(restoredWear(80, 1, 'mid')).toBeCloseTo(6 + 0.1 * 74);
    // A car already near the floor is not made worse than the floor.
    expect(restoredWear(3, 1, 'starter')).toBe(5);
  });

  it('removes most of the wear, never goes below the floor, and leaves more with every restoration', () => {
    fc.assert(
      fc.property(fc.integer({ min: 20, max: 100 }), fc.integer({ min: 1, max: 10 }), (wear, n) => {
        const after = restoredWear(wear, n, 'mid');
        expect(after).toBeGreaterThanOrEqual(restorationFloor(n, 'mid'));
        // Nine tenths of the wear above the floor is gone.
        const above = Math.max(0, wear - restorationFloor(n, 'mid'));
        expect(wear - after).toBeGreaterThanOrEqual(
          Math.min(wear - restorationFloor(n, 'mid'), 0.9 * above) - 0.01,
        );
        expect(restoredWear(wear, n + 1, 'mid')).toBeGreaterThanOrEqual(after);
      }),
    );
  });
});

describe('chassis wear', () => {
  it('is the wear from kilometres less the offset, and never below the floor or above 100', () => {
    const raw = wearFromKm(100_000, 2000, 'mid');
    expect(chassisWear(100_000, 2000, 'mid', 0, 0)).toBeCloseTo(raw);
    expect(chassisWear(100_000, 2000, 'mid', 30, 0)).toBeCloseTo(raw - 30);
    expect(chassisWear(100_000, 2000, 'mid', 1000, 2)).toBe(12);
    expect(chassisWear(10_000_000, 0, 'hyper', 0, 0)).toBe(100);
  });
});
