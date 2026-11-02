// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { wearAdded, wearFromKm } from '../../src/sim/wear';
import type { Tier } from '../../src/sim/worldgen/types';

const tiers: Tier[] = ['starter', 'mid', 'premium', 'elite', 'hyper', 'unique'];

describe('wear', () => {
  it('counts racing kilometres for ten times the wear of everyday kilometres', () => {
    for (const tier of tiers) {
      expect(wearAdded(100, 'race', tier)).toBeCloseTo(10 * wearAdded(100, 'road', tier), 6);
    }
  });

  it('starts at zero and never goes above 100', () => {
    expect(wearFromKm(0, 0, 'mid')).toBe(0);
    expect(wearFromKm(10_000_000, 10_000_000, 'hyper')).toBe(100);
  });

  it('wears faster the more expensive the car', () => {
    expect(wearFromKm(50_000, 0, 'hyper')).toBeGreaterThan(wearFromKm(50_000, 0, 'mid'));
    expect(wearFromKm(50_000, 0, 'mid')).toBeGreaterThan(wearFromKm(50_000, 0, 'starter'));
  });

  it('adds up the same however the kilometres are split', () => {
    fc.assert(
      fc.property(fc.nat(100000), fc.nat(5000), fc.constantFrom(...tiers), (road, race, tier) => {
        const parts = wearAdded(road, 'road', tier) + wearAdded(race, 'race', tier);
        const whole = wearFromKm(road, race, tier);
        return Math.abs(Math.min(100, parts) - whole) < 0.01;
      }),
    );
  });

  it('puts one season of racing at a few wear points', () => {
    // About 1,200 racing km a season (practice, prelims and finals) on a mid-tier car.
    expect(wearFromKm(0, 1200, 'mid')).toBeGreaterThan(3);
    expect(wearFromKm(0, 1200, 'mid')).toBeLessThan(8);
  });
});
