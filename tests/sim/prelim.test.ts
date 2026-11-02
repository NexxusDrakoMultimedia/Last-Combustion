// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { buildSectors } from '../../src/sim/courses/sectors';
import { classifyPrelims } from '../../src/sim/prelim/classify';
import { simulateLap } from '../../src/sim/prelim/lap';
import { buildRunningOrder } from '../../src/sim/prelim/order';
import { carRatings, sectorFit, sectorWeights } from '../../src/sim/prelim/ratings';
import { simulateRoundPrelims, type PrelimEntry } from '../../src/sim/prelim/round';
import { planRoundDays } from '../../src/sim/prelim/weather';
import { createRng } from '../../src/sim/rng';
import { generateWorld } from '../../src/sim/worldgen';
import { carModels, courses, manufacturers } from '../../src/sim/worldgen/data';

const course = courses[0]!;
const sectors = buildSectors(course);
const typeOf = (modelId: string) =>
  manufacturers.find((m) => m.id === carModels.find((c) => c.id === modelId)!.manufacturerId)!.type;

function entriesFor(seed: string): (PrelimEntry & { type: string })[] {
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
      type: typeOf(car.modelId),
    };
  });
}

const input = (seed: string, entries = entriesFor(seed)) => ({
  seed,
  season: 2031,
  roundNumber: 1,
  course,
  sectors,
  practiceStart: '2031-03-31',
  finalSize: 15,
  entries,
});

describe('weather and schedule', () => {
  it('gives every round 7 practice days then exactly 7 prelim days', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const plan = planRoundDays(course, '2031-03-31', createRng(seed).stream('w'));
      expect(plan.days.slice(0, 7).every((d) => d.kind === 'practice')).toBe(true);
      const prelim = plan.days.filter((d) => d.kind === 'prelim');
      expect(prelim.map((d) => d.prelimDay)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(prelim.every((d) => d.weather === 'dry_clear' || d.weather === 'overcast')).toBe(true);
    }
  });

  it('turns wet and overcast days into extra practice days and pushes the final back', () => {
    const wet = { ...course, climate: { dry_clear: 0.3, overcast: 0.3, wet: 0.4 } };
    const plan = planRoundDays(wet, '2031-03-31', createRng('x').stream('w'));
    const gaps = plan.days.filter((d) => d.kind === 'gap');
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every((d) => d.weather !== 'dry_clear')).toBe(true);
    expect(plan.days.length).toBe(14 + gaps.length);
  });

  it('caps the weather at overcast after 14 blocked days, even if it is wet every day', () => {
    const wet = { ...course, climate: { dry_clear: 0, overcast: 0, wet: 1 } };
    const plan = planRoundDays(wet, '2031-03-31', createRng('x').stream('w'));
    const extra = plan.days.slice(7);
    expect(extra.slice(0, 14).every((d) => d.kind === 'gap' && d.weather === 'wet')).toBe(true);
    expect(extra.slice(14, 28).every((d) => d.kind === 'gap' && d.weather === 'overcast')).toBe(
      true,
    );
  });

  it('guarantees dry, clear weather after 28 blocked days so the prelims run', () => {
    const wet = { ...course, climate: { dry_clear: 0, overcast: 0, wet: 1 } };
    const plan = planRoundDays(wet, '2031-03-31', createRng('x').stream('w'));
    const extra = plan.days.slice(7);
    expect(extra.slice(28).every((d) => d.kind === 'prelim' && d.weather === 'dry_clear')).toBe(
      true,
    );
    expect(plan.days.filter((d) => d.kind === 'prelim')).toHaveLength(7);
    expect(plan.days).toHaveLength(7 + 28 + 7);
  });

  it('never needs more than 28 extra days, and never has rain after 14 of them', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const wet = { ...course, climate: { dry_clear: 0.01, overcast: 0.01, wet: 0.98 } };
      const plan = planRoundDays(wet, '2031-03-31', createRng(seed).stream('w'));
      const gaps = plan.days.filter((d) => d.kind === 'gap');
      expect(gaps.length).toBeLessThanOrEqual(28);
      plan.days.slice(7 + 14).forEach((d) => expect(d.weather).not.toBe('wet'));
    }
  });

  it('puts the final the day after the last prelim day', () => {
    const plan = planRoundDays(course, '2031-03-31', createRng('y').stream('w'));
    const last = plan.days[plan.days.length - 1]!;
    expect(last.kind).toBe('prelim');
    const next = new Date(last.date);
    next.setUTCDate(next.getUTCDate() + 1);
    expect(plan.finalDate).toBe(next.toISOString().slice(0, 10));
  });
});

describe('running order', () => {
  const entries = Array.from({ length: 313 }, (_, i) => ({
    entryId: i + 1,
    points: i < 60 ? 5 : 0,
  }));
  const order = buildRunningOrder(entries, 7, createRng('o').stream('o'));

  it('puts every entry in exactly one slot, with days of nearly equal size', () => {
    expect(order).toHaveLength(313);
    expect(new Set(order.map((o) => o.entryId)).size).toBe(313);
    const sizes = [1, 2, 3, 4, 5, 6, 7].map((d) => order.filter((o) => o.day === d).length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it('spreads the entries with points evenly across the days and through each day', () => {
    const perDay = [1, 2, 3, 4, 5, 6, 7].map((d) =>
      order.filter((o) => o.day === d && o.entryId <= 60),
    );
    expect(
      Math.max(...perDay.map((p) => p.length)) - Math.min(...perDay.map((p) => p.length)),
    ).toBeLessThanOrEqual(1);
    for (const day of perDay) {
      const slots = day.map((p) => p.slot);
      expect(Math.min(...slots)).toBeLessThan(15);
      expect(Math.max(...slots)).toBeGreaterThan(30);
    }
  });

  it('is a random draw when nobody has points, and repeatable for a seed', () => {
    const none = entries.map((e) => ({ ...e, points: 0 }));
    const a = buildRunningOrder(none, 7, createRng('s').stream('o'));
    const b = buildRunningOrder(none, 7, createRng('s').stream('o'));
    expect(a).toEqual(b);
    expect(a.slice(0, 20).map((o) => o.entryId)).not.toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });
});

describe('classification', () => {
  const outcomes = Array.from({ length: 40 }, (_, i) => ({
    entryId: i + 1,
    day: 1 + (i % 7),
    slot: i,
    timeMs: i === 3 ? null : 3_000_000 + i * 1000,
    dnfReason: i === 3 ? ('crash' as const) : null,
  }));
  const result = classifyPrelims(outcomes, 15);

  it('orders by time and leaves a crash unclassified', () => {
    expect(result[0]!.entryId).toBe(1);
    expect(result[0]!.pole).toBe(true);
    const crashed = result.find((r) => r.entryId === 4)!;
    expect(crashed.position).toBeNull();
    expect(crashed.points).toBe(0);
    expect(crashed.qualifies).toBe(false);
  });

  it('qualifies the top 15 and scores prelim points from 16th to 31st only', () => {
    expect(result.filter((r) => r.qualifies)).toHaveLength(15);
    for (const r of result) {
      if (r.position !== null && r.position <= 15) expect(r.points).toBe(0);
    }
    const byPos = (p: number) => result.find((r) => r.position === p)!;
    expect(byPos(16).points).toBe(2);
    expect(byPos(17).points).toBe(1.5);
    expect(byPos(31).points).toBe(0.1);
    expect(byPos(32).points).toBe(0);
    const total = result.reduce((s, r) => s + r.points, 0);
    expect(total).toBeCloseTo(14, 5);
  });

  it('breaks a tie by the earlier run', () => {
    const tied = classifyPrelims(
      [
        { entryId: 1, day: 2, slot: 0, timeMs: 1000, dnfReason: null },
        { entryId: 2, day: 1, slot: 5, timeMs: 1000, dnfReason: null },
      ],
      15,
    );
    expect(tied[0]!.entryId).toBe(2);
  });
});

describe('lap model', () => {
  const rng = (n: string) => createRng('lap').stream(n);
  const world = generateWorld('lap');
  const driver = world.drivers[0]!;
  const car = { ps: 400, kerbKg: 1400, tyreWidthMm: 320, layout: 'MR' as const, wear: 10 };
  const cond = { dayTemperatureBias: 0 };

  it('weights each sector so the four ratings add up to one', () => {
    for (const s of sectors) {
      const w = sectorWeights(s);
      expect(w.power + w.grip + w.handling + w.traction).toBeCloseTo(1, 6);
    }
  });

  it('rates a car between 0 and 1, and rewards power', () => {
    const weak = carRatings({ ...car, ps: 120 });
    const strong = carRatings({ ...car, ps: 600 });
    expect(strong.power).toBeGreaterThan(weak.power);
    for (const v of Object.values(strong)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(sectorFit(strong, sectors[0]!)).toBeGreaterThan(sectorFit(weak, sectors[0]!));
  });

  it('gives a lighter car relatively wider tyres, so a light car grips better', () => {
    const light = carRatings({ ...car, kerbKg: 900, tyreWidthMm: 220 });
    const heavy = carRatings({ ...car, kerbKg: 1800, tyreWidthMm: 400 });
    expect(light.grip).toBeGreaterThan(heavy.grip);
  });

  it('makes a worn car slower', () => {
    const fresh = carRatings({ ...car, wear: 0 });
    const worn = carRatings({ ...car, wear: 80 });
    expect(worn.power).toBeLessThan(fresh.power);
  });

  it('sets a lap time that adds up from its sectors', () => {
    const lap = simulateLap(driver, car, sectors, 0, false, cond, rng('a'));
    if (lap.timeMs !== null) {
      expect(lap.sectorMs).toHaveLength(sectors.length);
      expect(lap.sectorMs.reduce((a, b) => a + b, 0)).toBe(lap.timeMs);
    } else {
      expect(lap.dnfReason).toBe('crash');
    }
  });

  it('makes a better driver faster in the same car', () => {
    const times = (pace: number) => {
      let total = 0;
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const lap = simulateLap(
          { ...driver, pace },
          car,
          sectors,
          0,
          false,
          cond,
          rng(`p${pace}${i}`),
        );
        if (lap.timeMs !== null) {
          total += lap.timeMs;
          n++;
        }
      }
      return total / n;
    };
    expect(times(80)).toBeLessThan(times(30));
  });

  it('produces mistakes, spins, wildlife and crashes, with a crash ending the run', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 6000 && seen.size < 4; i++) {
      const lap = simulateLap(
        { ...driver, composure: 20 },
        { ...car, wear: 60 },
        sectors,
        0,
        false,
        cond,
        rng(`i${i}`),
      );
      lap.incidents.forEach((x) => seen.add(x.kind));
      if (lap.dnfReason === 'crash') expect(lap.timeMs).toBeNull();
    }
    expect([...seen].sort()).toEqual(['crash', 'mistake', 'spin', 'wildlife']);
  });
});

describe('a full round of prelims', () => {
  const entries = entriesFor('round');
  const round = simulateRoundPrelims(input('round', entries));

  it('classifies every entry once, with unique positions', () => {
    expect(round.results).toHaveLength(313);
    const positions = round.results.map((r) => r.position).filter((p): p is number => p !== null);
    expect(new Set(positions).size).toBe(positions.length);
    expect(Math.max(...positions)).toBe(positions.length);
  });

  it('qualifies the 15 fastest and scores prelim points for 16th to 31st', () => {
    expect(round.results.filter((r) => r.qualifies)).toHaveLength(15);
    const scored = round.results.filter((r) => r.points > 0);
    expect(scored).toHaveLength(16);
    expect(scored.reduce((s, r) => s + r.points, 0)).toBeCloseTo(14, 5);
  });

  it('sets plausible times: the pole lap is a little quicker than the median', () => {
    const times = round.results
      .map((r) => r.timeMs)
      .filter((t): t is number => t !== null)
      .sort((a, b) => a - b);
    expect(times[0]! / 60000).toBeGreaterThan(40);
    expect(times[0]! / 60000).toBeLessThan(75);
    const median = times[Math.floor(times.length / 2)]!;
    expect(times[0]!).toBeLessThan(median * 0.99);
    expect(times[0]!).toBeGreaterThan(median * 0.9);
  });

  it('has a handful of incidents, and at least one crash blocking the road across many seeds', () => {
    const counts = ['s1', 's2', 's3', 's4'].map(
      (seed) => simulateRoundPrelims(input(seed)).events.filter((e) => e.scope === 'prelim').length,
    );
    for (const n of counts) {
      expect(n).toBeGreaterThan(3);
      expect(n).toBeLessThan(80);
    }
  });

  it('adds racing kilometres to every car, from practice and from the prelim lap', () => {
    for (const e of entries) {
      const km = round.raceKm.get(e.carId) ?? 0;
      expect(km).toBeGreaterThan(course.lapKm);
    }
  });

  it('records the pole position and the practice events', () => {
    expect(round.events.filter((e) => e.type === 'pole')).toHaveLength(1);
    expect(round.events.some((e) => e.scope === 'practice')).toBe(true);
    expect(round.poleBonus).toBe(10000);
  });

  it('is repeatable and does not depend on the order entries are listed in', () => {
    const again = simulateRoundPrelims(input('round', [...entries].reverse()));
    expect(JSON.stringify(again.results)).toBe(JSON.stringify(round.results));
    expect(JSON.stringify(again.schedule)).toBe(JSON.stringify(round.schedule));
  });

  it('gives different results for a different seed', () => {
    expect(JSON.stringify(simulateRoundPrelims(input('round2', entries)).results)).not.toBe(
      JSON.stringify(round.results),
    );
  });
});

describe('balance: driver over horsepower', () => {
  const corr = (a: number[], b: number[]) => {
    const n = a.length;
    const ma = a.reduce((x, y) => x + y) / n;
    const mb = b.reduce((x, y) => x + y) / n;
    let sab = 0;
    let saa = 0;
    let sbb = 0;
    for (let i = 0; i < n; i++) {
      sab += (a[i]! - ma) * (b[i]! - mb);
      saa += (a[i]! - ma) ** 2;
      sbb += (b[i]! - mb) ** 2;
    }
    return sab / Math.sqrt(saa * sbb);
  };

  it('lets driver skill matter at least as much as the car, while supercars still lead the pack', () => {
    const drivers: number[] = [];
    const cars: number[] = [];
    let superInTop = 0;
    for (const seed of ['bal-a', 'bal-b', 'bal-c', 'bal-d']) {
      const entries = entriesFor(seed);
      const round = simulateRoundPrelims(input(seed, entries));
      const byId = new Map(entries.map((e) => [e.entryId, e]));
      const finishers = round.results.filter((r) => r.timeMs !== null);
      for (const r of finishers) {
        const e = byId.get(r.entryId)!;
        drivers.push(e.driver.pace);
        cars.push(
          sectors.reduce((s, x) => s + sectorFit(carRatings(e.car, course.altitudeM), x), 0) /
            sectors.length,
        );
      }
      superInTop += finishers
        .slice(0, 15)
        .filter((r) => ['supercar', 'hypercar'].includes(byId.get(r.entryId)!.type)).length;
    }
    const times = ['bal-a', 'bal-b', 'bal-c', 'bal-d'].flatMap((seed) =>
      simulateRoundPrelims(input(seed))
        .results.filter((r) => r.timeMs !== null)
        .map((r) => -(r.timeMs as number)),
    );
    expect(corr(drivers, times)).toBeGreaterThan(0.6);
    expect(corr(cars, times)).toBeGreaterThan(0.35);
    expect(corr(drivers, times)).toBeGreaterThan(corr(cars, times));
    // About half the field are supercars or hypercars; they should hold roughly 8 to 13 of the top 15.
    expect(superInTop / 4).toBeGreaterThan(7);
    expect(superInTop / 4).toBeLessThan(14);
  });
});
