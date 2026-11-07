// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildSectors } from '../../src/sim/courses/sectors';
import {
  attentionFlags,
  predictedSectorMs,
  type AttentionRun,
} from '../../src/sim/prelim/attention';
import { simulateRoundPrelims } from '../../src/sim/prelim/round';
import { generateWorld } from '../../src/sim/worldgen';
import { carModels, courses } from '../../src/sim/worldgen/data';

/** A field of runs that all match their prediction, give or take a little. */
function field(count: number, gain: (i: number) => number): AttentionRun[] {
  return Array.from({ length: count }, (_, i) => ({
    entryId: i + 1,
    predictedMs: 60_000,
    actualMs: 60_000 - gain(i),
    sectorGainMs: [gain(i) / 2, gain(i) / 2],
  }));
}

describe('attention flags', () => {
  it('flag a run far enough above the field, and only that run', () => {
    // 100 runs within a few hundred milliseconds of each other and one 5 seconds faster.
    const runs = field(100, (i) => (i === 40 ? 5000 : (i % 7) * 40));
    const flags = attentionFlags(runs);
    expect(flags.map((f) => f.entryId)).toEqual([41]);
    expect(flags[0]!.z).toBeGreaterThanOrEqual(2.5);
    expect(flags[0]!.gainMs).toBe(5000);
  });

  it('flag nobody when the field is alike', () => {
    expect(attentionFlags(field(100, () => 100))).toEqual([]);
    expect(attentionFlags(field(100, (i) => (i % 9) * 30))).toEqual([]);
  });

  it('never flag a crash, which has no time', () => {
    const runs = field(100, (i) => (i === 3 ? 5000 : 50));
    runs[3] = { ...runs[3]!, actualMs: null };
    expect(attentionFlags(runs)).toEqual([]);
  });

  it('name the sector where the run gained the most', () => {
    const runs = field(100, (i) => (i % 5) * 20);
    runs[10] = {
      entryId: 11,
      predictedMs: 60_000,
      actualMs: 54_000,
      sectorGainMs: [100, 5200, 700],
    };
    expect(attentionFlags(runs)[0]).toMatchObject({ entryId: 11, sector: 1 });
  });

  it('flag a run whose z is at least the threshold, whatever the field looks like', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -3000, max: 3000 }), { minLength: 5, maxLength: 80 }),
        (gains) => {
          const flags = attentionFlags(
            field(gains.length, (i) => gains[i]!),
            2.5,
          );
          for (const f of flags) expect(f.z).toBeGreaterThanOrEqual(2.5);
          for (let i = 1; i < flags.length; i++)
            expect(flags[i]!.z).toBeLessThanOrEqual(flags[i - 1]!.z);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('need at least three timed runs', () => {
    expect(attentionFlags(field(2, (i) => i * 9000))).toEqual([]);
  });
});

describe('predicted pace', () => {
  const course = courses[0]!;
  const sectors = buildSectors(course);
  const car = { ps: 300, kerbKg: 1200, tyreWidthMm: 255, layout: 'FR' as const, wear: 10 };

  it('gives every sector a time, slower on a hotter day', () => {
    const cool = predictedSectorMs(car, sectors, course.altitudeM, 0);
    const hot = predictedSectorMs(car, sectors, course.altitudeM, 0.01);
    expect(cool).toHaveLength(sectors.length);
    hot.forEach((ms, i) => expect(ms).toBeGreaterThan(cool[i]!));
  });

  it('is quicker for a stronger car', () => {
    const slow = predictedSectorMs({ ...car, ps: 150 }, sectors, course.altitudeM, 0);
    const fast = predictedSectorMs({ ...car, ps: 500 }, sectors, course.altitudeM, 0);
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    expect(sum(fast)).toBeLessThan(sum(slow));
  });
});

describe('a round of prelims', () => {
  function entriesFor(seed: string) {
    const w = generateWorld(seed);
    return w.entries.map((e) => {
      const car = w.cars[e.carId - 1]!;
      const model = carModels.find((m) => m.id === car.modelId)!;
      return {
        entryId: e.id,
        carId: car.id,
        raceNumber: e.raceNumber,
        driver: w.drivers[e.driverId - 1]!,
        car: {
          ps: model.ps,
          kerbKg: car.kerbKg,
          tyreWidthMm: car.tyreWidthMm,
          layout: model.layout,
          wear: car.wear,
        },
        points: 0,
      };
    });
  }
  const run = (seed: string, course = courses[0]!) =>
    simulateRoundPrelims({
      seed,
      season: 2031,
      roundNumber: 1,
      course,
      sectors: buildSectors(course),
      practiceStart: '2031-03-31',
      finalSize: 15,
      entries: entriesFor(seed),
    });

  it('logs one attention event for each flag, in the prelims, and is the same every time', () => {
    const a = run('attn-test');
    const b = run('attn-test');
    expect(a.attentionFlags).toEqual(b.attentionFlags);
    const events = a.events.filter((e) => e.type === 'attention');
    expect(events.map((e) => e.entryId)).toEqual(
      expect.arrayContaining(a.attentionFlags.map((f) => f.entryId)),
    );
    expect(events).toHaveLength(a.attentionFlags.length);
    for (const e of events) expect(e.scope).toBe('prelim');
  });

  it('raises a flag once or twice a round, as the design says', () => {
    let total = 0;
    let rounds = 0;
    for (const seed of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
      for (const course of courses) {
        total += run(seed, course).attentionFlags.length;
        rounds++;
      }
    }
    expect(total / rounds).toBeGreaterThan(0.8);
    expect(total / rounds).toBeLessThan(3);
  }, 120_000);
});
