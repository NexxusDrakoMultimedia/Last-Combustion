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
} from '../../src/sim/wear';

describe('the wear floor', () => {
  it('rises by 5 points with every full restoration, up to 60', () => {
    expect([0, 1, 2, 3, 4].map(restorationFloor)).toEqual([0, 5, 10, 15, 20]);
    expect(restorationFloor(12)).toBe(60);
    expect(restorationFloor(50)).toBe(60);
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
    expect(restoredWear(80, 1)).toBeCloseTo(5 + 0.1 * 75);
    expect(restoredWear(50, 2)).toBeCloseTo(10 + 0.1 * 40);
    // A car already near the floor is not made worse than the floor.
    expect(restoredWear(3, 1)).toBe(5);
  });

  it('removes most of the wear, never goes below the floor, and leaves more with every restoration', () => {
    fc.assert(
      fc.property(fc.integer({ min: 20, max: 100 }), fc.integer({ min: 1, max: 10 }), (wear, n) => {
        const after = restoredWear(wear, n);
        expect(after).toBeGreaterThanOrEqual(restorationFloor(n));
        // Nine tenths of the wear above the floor is gone.
        const above = Math.max(0, wear - restorationFloor(n));
        expect(wear - after).toBeGreaterThanOrEqual(
          Math.min(wear - restorationFloor(n), 0.9 * above) - 0.01,
        );
        expect(restoredWear(wear, n + 1)).toBeGreaterThanOrEqual(after);
      }),
    );
  });
});

describe('chassis wear', () => {
  it('is the wear from kilometres less the offset, and never below the floor or above 100', () => {
    const raw = wearFromKm(100_000, 2000, 'mid');
    expect(chassisWear(100_000, 2000, 'mid', 0, 0)).toBeCloseTo(raw);
    expect(chassisWear(100_000, 2000, 'mid', 30, 0)).toBeCloseTo(raw - 30);
    expect(chassisWear(100_000, 2000, 'mid', 1000, 2)).toBe(10);
    expect(chassisWear(10_000_000, 0, 'hyper', 0, 0)).toBe(100);
  });
});
