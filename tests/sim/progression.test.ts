// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { develop, DEVELOPING_STATS, type DriverStats } from '../../src/sim/progression';
import { createRng } from '../../src/sim/rng';

const stats = (n: number): DriverStats => ({
  pace: n,
  consistency: n,
  racecraft: n,
  tyreManagement: n,
  composure: n,
  wetSkill: n,
});
const mean = (s: DriverStats) =>
  DEVELOPING_STATS.reduce((t, k) => t + s[k], 0) / DEVELOPING_STATS.length;

describe('driver development', () => {
  it('lifts a young driver toward potential and lets an old one slip', () => {
    const rng = createRng('dev').stream('x');
    let young = stats(40);
    let old = stats(60);
    for (let i = 0; i < 6; i++) {
      young = develop(rng, young, 80, 20 + i);
      old = develop(rng, old, 70, 36 + i);
    }
    expect(young.pace).toBeGreaterThan(55);
    expect(young.pace).toBeLessThanOrEqual(80);
    expect(old.pace).toBeLessThan(60);
    expect(mean(old)).toBeLessThan(60);
    expect(old.racecraft).toBeGreaterThan(old.pace);
  });

  it('is deterministic and keeps every stat in range and pace under potential', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 18, max: 55 }),
        fc.integer({ min: 20, max: 90 }),
        fc.string(),
        (age, base, seed) => {
          const a = develop(createRng(seed).stream('d'), stats(base), 70, age);
          const b = develop(createRng(seed).stream('d'), stats(base), 70, age);
          expect(a).toEqual(b);
          for (const k of DEVELOPING_STATS) {
            expect(a[k]).toBeGreaterThanOrEqual(10);
            expect(a[k]).toBeLessThanOrEqual(95);
          }
          expect(a.pace).toBeLessThanOrEqual(Math.max(70, base));
        },
      ),
      { numRuns: 100 },
    );
  });
});
