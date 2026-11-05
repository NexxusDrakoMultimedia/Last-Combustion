// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  AVERAGE_CURVE,
  develop,
  DEVELOPING_STATS,
  driverCurve,
  trainingLevel,
  type DriverStats,
  type GrowthCurve,
} from '../../src/sim/progression';
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

/** The mean pace of many drivers after living from age 18 to 45 on one curve. */
function lifetime(curve: GrowthCurve, training: number, potential = 80): number[] {
  const rng = createRng('lifetime').stream(`l${training}`);
  let s = stats(45);
  const path: number[] = [];
  for (let age = 18; age < 46; age++) {
    s = develop(rng, s, potential, age, { curve, training });
    path.push(s.pace);
  }
  return path;
}

describe('growth curves', () => {
  it('give every driver their own curve, the same one every time', () => {
    const a = driverCurve('seed', 7);
    expect(driverCurve('seed', 7)).toEqual(a);
    const curves = Array.from({ length: 200 }, (_, i) => driverCurve('seed', i + 1));
    expect(new Set(curves.map((c) => c.growthEnd)).size).toBeGreaterThan(5);
    expect(new Set(curves.map((c) => c.growthRate)).size).toBeGreaterThan(20);
    for (const c of curves) {
      expect(c.growthEnd).toBeGreaterThanOrEqual(23);
      expect(c.growthEnd).toBeLessThanOrEqual(30);
      expect(c.declineStart).toBeGreaterThanOrEqual(31);
      expect(c.declineStart).toBeLessThanOrEqual(37);
      expect(c.growthRate).toBeGreaterThanOrEqual(0.7);
      expect(c.growthRate).toBeLessThanOrEqual(1.4);
    }
    expect(driverCurve('other', 7)).not.toEqual(a);
  });

  it('let an early bloomer peak and fade before a late one', () => {
    const early: GrowthCurve = { growthEnd: 23, declineStart: 31, growthRate: 1, declineRate: 1 };
    const late: GrowthCurve = { growthEnd: 30, declineStart: 37, growthRate: 1, declineRate: 1 };
    const peakAge = (path: number[]) => 18 + path.indexOf(Math.max(...path));
    expect(peakAge(lifetime(early, 0))).toBeLessThanOrEqual(peakAge(lifetime(late, 0)));
    const at = (path: number[], age: number) => path[age - 18]!;
    expect(at(lifetime(late, 0), 40)).toBeGreaterThan(at(lifetime(early, 0), 40));
  });

  it('let a quick learner climb faster than a slow one', () => {
    const quick: GrowthCurve = { ...AVERAGE_CURVE, growthRate: 1.4 };
    const slow: GrowthCurve = { ...AVERAGE_CURVE, growthRate: 0.7 };
    expect(lifetime(quick, 0)[4]!).toBeGreaterThanOrEqual(lifetime(slow, 0)[4]!);
  });
});

describe('training', () => {
  it('has levels that cost more and help more', () => {
    for (let i = 1; i <= 3; i++) {
      expect(trainingLevel(i).cost).toBeGreaterThan(trainingLevel(i - 1).cost);
      expect(trainingLevel(i).growth).toBeGreaterThan(trainingLevel(i - 1).growth);
      expect(trainingLevel(i).decline).toBeGreaterThan(trainingLevel(i - 1).decline);
    }
    expect(trainingLevel(99)).toEqual(trainingLevel(3));
    expect(trainingLevel(-4)).toEqual(trainingLevel(0));
  });

  it('speeds up improvement', () => {
    const none = lifetime(AVERAGE_CURVE, 0)[6]!;
    const elite = lifetime(AVERAGE_CURVE, 3)[6]!;
    expect(elite).toBeGreaterThan(none);
  });

  it('keeps a peak from declining as fast', () => {
    const none = lifetime(AVERAGE_CURVE, 0)[45 - 18 - 1]!;
    const elite = lifetime(AVERAGE_CURVE, 3)[45 - 18 - 1]!;
    expect(elite).toBeGreaterThan(none + 3);
  });

  it('treats potential as a soft cap: untrained never passes it, trained pass it only a little', () => {
    const potential = 60;
    const untrained = Math.max(...lifetime(AVERAGE_CURVE, 0, potential));
    const trained = Math.max(...lifetime(AVERAGE_CURVE, 3, potential));
    expect(untrained).toBeLessThanOrEqual(potential);
    expect(trained).toBeGreaterThan(untrained);
    expect(trained).toBeLessThanOrEqual(potential + trainingLevel(3).overshoot);
  });

  it('never breaks the range or determinism, whatever the curve and level', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 18, max: 55 }),
        fc.integer({ min: 20, max: 90 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 1, max: 500 }),
        fc.string(),
        (age, base, level, id, seed) => {
          const curve = driverCurve(seed, id);
          const a = develop(createRng(seed).stream('d'), stats(base), 70, age, {
            curve,
            training: level,
          });
          const b = develop(createRng(seed).stream('d'), stats(base), 70, age, {
            curve,
            training: level,
          });
          expect(a).toEqual(b);
          for (const k of DEVELOPING_STATS) {
            expect(a[k]).toBeGreaterThanOrEqual(10);
            expect(a[k]).toBeLessThanOrEqual(95);
          }
          expect(a.pace).toBeLessThanOrEqual(Math.max(70 + trainingLevel(level).overshoot, base));
        },
      ),
      { numRuns: 150 },
    );
  });
});
