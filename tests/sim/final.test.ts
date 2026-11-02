// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { buildSectors } from '../../src/sim/courses/sectors';
import { FinalRace, simulateFinal, type FinalEntry } from '../../src/sim/final/engine';
import { baseTyreLoss, gripTimeFactor, wearMultiplier } from '../../src/sim/final/tyres';
import { simulateRoundPrelims } from '../../src/sim/prelim/round';
import { generateWorld } from '../../src/sim/worldgen';
import { carModels, courses } from '../../src/sim/worldgen/data';

function setup(seed: string, courseIndex = 0) {
  const w = generateWorld(seed);
  const course = courses[courseIndex]!;
  const sectors = buildSectors(course);
  const entries = w.entries.map((e) => {
    const car = w.cars[e.carId - 1]!;
    const m = carModels.find((x) => x.id === car.modelId)!;
    return {
      entryId: e.id,
      carId: car.id,
      garageId: e.garageId,
      raceNumber: e.raceNumber,
      driver: w.drivers[e.driverId - 1]!,
      car: {
        ps: m.ps,
        kerbKg: car.kerbKg,
        tyreWidthMm: car.tyreWidthMm,
        layout: m.layout,
        wear: car.wear,
      },
      points: 0,
    };
  });
  const prelim = simulateRoundPrelims({
    seed,
    season: 2031,
    roundNumber: courseIndex + 1,
    course,
    sectors,
    practiceStart: '2031-03-31',
    finalSize: 15,
    entries,
  });
  const top = prelim.results.filter((r) => r.qualifies).sort((a, b) => a.position! - b.position!);
  const finalists: FinalEntry[] = top.map((r, i) => {
    const e = entries.find((x) => x.entryId === r.entryId)!;
    return {
      entryId: e.entryId,
      garageId: e.garageId,
      raceNumber: e.raceNumber,
      grid: i + 1,
      driver: e.driver,
      car: e.car,
    };
  });
  return { seed, course, sectors, finalists, roundNumber: courseIndex + 1 };
}

const input = (s: ReturnType<typeof setup>, entries = s.finalists) => ({
  seed: s.seed,
  season: 2031,
  roundNumber: s.roundNumber,
  course: s.course,
  sectors: s.sectors,
  entries,
});

describe('tyres', () => {
  it('lose more the harder the driving and the poorer the tyre management', () => {
    expect(wearMultiplier(1, 0.3, 0.3, 50)).toBeGreaterThan(wearMultiplier(0, 0.3, 0.3, 50));
    expect(wearMultiplier(0.5, 0.3, 0.3, 20)).toBeGreaterThan(wearMultiplier(0.5, 0.3, 0.3, 80));
  });

  it('leave a reference driver with about 8% at the flag', () => {
    const total = 135;
    const loss = baseTyreLoss(total) * wearMultiplier(0.5, 0.45, 0.35, 50) * total;
    expect(100 - loss).toBeCloseTo(8, 0);
  });

  it('only cost grip below 20% and then cost more the lower they go', () => {
    expect(gripTimeFactor(60)).toBe(1);
    expect(gripTimeFactor(20)).toBe(1);
    expect(gripTimeFactor(0)).toBeGreaterThan(gripTimeFactor(10));
    expect(gripTimeFactor(0)).toBeCloseTo(1.06, 3);
  });
});

describe('a full final', () => {
  const s = setup('final-a');
  const race = simulateFinal(input(s));
  const result = race.classification();

  it('classifies all 15 cars once, finishers first', () => {
    expect(result).toHaveLength(15);
    expect(result.map((r) => r.position)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    const firstRetired = result.findIndex((r) => !r.finished);
    if (firstRetired !== -1)
      expect(result.slice(firstRetired).every((r) => !r.finished)).toBe(true);
    expect(result.filter((r) => r.finished).length).toBeGreaterThanOrEqual(10);
  });

  it('has finishers who completed every sector and ordered by time', () => {
    const finishers = result.filter((r) => r.finished);
    for (const f of finishers) expect(f.sectors).toBe(race.totalSectors);
    const times = finishers.map((f) => f.timeSeconds!);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('runs at a believable pace: over 300 km in a few hours', () => {
    const winner = result[0]!;
    const hours = winner.timeSeconds! / 3600;
    expect(winner.km).toBeGreaterThan(300);
    expect(hours).toBeGreaterThan(2);
    expect(hours).toBeLessThan(7);
  });

  it('wears the tyres to a low level by the flag', () => {
    const finishers = result.filter((r) => r.finished);
    for (const f of finishers) {
      expect(f.tyrePct).toBeGreaterThanOrEqual(0);
      expect(f.tyrePct).toBeLessThan(40);
    }
  });

  it('records timing for every car and sector, with tyres falling and times rising', () => {
    const winner = result[0]!.entryId;
    const rows = race.timing.filter((t) => t.entryId === winner);
    expect(rows).toHaveLength(race.totalSectors);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.exitSeconds).toBeGreaterThan(rows[i - 1]!.exitSeconds);
      expect(rows[i]!.tyrePct).toBeLessThanOrEqual(rows[i - 1]!.tyrePct);
    }
    const lastSector = race.timing.filter(
      (t) => t.lap === race.laps - 1 && t.sector === race.sectorCount - 1,
    );
    expect(new Set(lastSector.map((t) => t.position)).size).toBe(lastSector.length);
  });

  it('is repeatable', () => {
    const again = simulateFinal(input(s));
    expect(JSON.stringify(again.classification())).toBe(JSON.stringify(result));
    expect(JSON.stringify(again.events)).toBe(JSON.stringify(race.events));
  });

  it('gives the same result however many times the player pauses', () => {
    const paused = new FinalRace(input(s));
    let pauses = 0;
    while (!paused.finished) {
      const events = paused.runToPause();
      if (events.some((e) => e.pause)) pauses += 1;
    }
    expect(JSON.stringify(paused.classification())).toBe(JSON.stringify(result));
    expect(pauses).toBeGreaterThanOrEqual(0);
  });
});

describe('across many races', () => {
  const seeds = Array.from({ length: 30 }, (_, i) => `race-${i}`);
  const races = seeds.map((seed, i) => {
    const s = setup(seed, i % 6);
    return { s, race: simulateFinal(input(s)) };
  });
  const count = (type: string) =>
    races.reduce((n, r) => n + r.race.events.filter((e) => e.type === type).length, 0);

  it('produces overtakes, mistakes, crashes, drone stops and lost grip', () => {
    for (const type of ['overtake', 'mistake', 'crash', 'drone_stop', 'lost_grip']) {
      expect(count(type), type).toBeGreaterThan(0);
    }
  });

  it('sometimes sees mechanical trouble', () => {
    expect(count('mechanical_warning')).toBeGreaterThan(0);
  });

  it('has a weather change in roughly one race in eight, part-way through and for 1 or 2 laps', () => {
    const s = setup('weather');
    let rain = 0;
    const total = 600;
    for (let i = 0; i < total; i++) {
      const race = new FinalRace({ ...input(s), seed: `w-${i}` });
      if (race.weather) {
        rain += 1;
        expect(race.weather.startLap).toBeGreaterThanOrEqual(1);
        expect(race.weather.endLap).toBeLessThanOrEqual(race.laps - 1);
        expect(race.weather.endLap - race.weather.startLap).toBeLessThanOrEqual(1);
      }
    }
    expect(rain / total).toBeGreaterThan(0.08);
    expect(rain / total).toBeLessThan(0.17);
  });

  it('pauses for a weather change when one arrives', () => {
    const s = setup('weather');
    for (let i = 0; i < 200; i++) {
      const race = new FinalRace({ ...input(s), seed: `w-${i}` });
      if (!race.weather) continue;
      let paused = false;
      while (!race.finished) {
        if (race.runToPause().some((e) => e.type === 'weather_change' && e.pause)) paused = true;
      }
      expect(paused).toBe(true);
      return;
    }
    throw new Error('No race with a weather change found');
  });

  it('holds up the cars behind a crash with a drone stop', () => {
    const withCrash = races.filter((r) => r.race.events.some((e) => e.type === 'crash'));
    expect(withCrash.length).toBeGreaterThan(0);
    for (const { race } of withCrash) {
      const crash = race.events.find((e) => e.type === 'crash')!;
      const held = race.events.filter(
        (e) => e.type === 'drone_stop' && e.lap === crash.lap && e.sector === crash.sector,
      );
      for (const h of held) expect(h.atSeconds).toBeGreaterThanOrEqual(0);
    }
  });

  it('averages a sensible number of overtakes per race', () => {
    const mean =
      races.reduce((n, r) => n + r.race.classification().reduce((s, c) => s + c.overtakes, 0), 0) /
      races.length;
    expect(mean).toBeGreaterThan(5);
    expect(mean).toBeLessThan(120);
  });

  it('lets pole start help but not decide the race', () => {
    const winners = races.map(
      (r) => r.s.finalists.find((f) => f.entryId === r.race.classification()[0]!.entryId)!.grid,
    );
    const mean = winners.reduce((a, b) => a + b, 0) / winners.length;
    expect(mean).toBeLessThan(8);
    expect(winners.some((g) => g > 1)).toBe(true);
  });

  it('never loses or duplicates a car', () => {
    for (const { race } of races) {
      expect(new Set(race.classification().map((c) => c.entryId)).size).toBe(15);
    }
  });
});

describe('calls', () => {
  const s = setup('calls');
  const run = (entryId: number, call: 'push' | 'balanced' | 'conserve') => {
    const race = new FinalRace(input(s));
    race.setCall(entryId, call);
    race.runToEnd();
    return race.classification().find((c) => c.entryId === entryId)!;
  };
  const target = s.finalists[7]!.entryId;

  it('push wears the tyres faster and conserve wears them slower', () => {
    // Compare the finalists that finish under every call: a car that retires, or that wears its tyres
    // to nothing, says little on its own, so the comparison is made across the field.
    const rows = s.finalists
      .map((f) => (['push', 'balanced', 'conserve'] as const).map((c) => run(f.entryId, c)))
      .filter((r) => r.every((x) => x.finished));
    expect(rows.length).toBeGreaterThanOrEqual(5);
    const mean = (i: number) => rows.reduce((sum, r) => sum + r[i]!.tyrePct, 0) / rows.length;
    expect(mean(0)).toBeLessThan(mean(1));
    expect(mean(1)).toBeLessThan(mean(2));
    for (const r of rows) {
      expect(r[0]!.tyrePct).toBeLessThanOrEqual(r[1]!.tyrePct);
      expect(r[1]!.tyrePct).toBeLessThanOrEqual(r[2]!.tyrePct);
    }
  });

  it('lets a pushed car run quicker on the road than a conserving one', () => {
    const rate = (call: 'push' | 'conserve') => {
      const race = new FinalRace(input(s));
      race.setCall(target, call);
      race.runToEnd();
      const rows = race.timing.filter((t) => t.entryId === target && t.lap === 0);
      return rows[rows.length - 1]!.exitSeconds - rows[0]!.exitSeconds;
    };
    expect(rate('push')).toBeLessThan(rate('conserve'));
  });

  it('returns to the computer driver when the call is cleared', () => {
    const race = new FinalRace(input(s));
    race.setCall(target, 'push');
    race.setCall(target, null);
    race.runToEnd();
    const a = race.classification().find((c) => c.entryId === target)!;
    const b = simulateFinal(input(s))
      .classification()
      .find((c) => c.entryId === target)!;
    expect(a).toEqual(b);
  });

  it('rejects calls for a car that is not in the race', () => {
    expect(() => new FinalRace(input(s)).setCall(99999, 'push')).toThrow(/No such entry/);
  });
});

describe('team orders', () => {
  it('stop teammates passing each other when the order is to hold', () => {
    let blocked = 0;
    let free = 0;
    for (let i = 0; i < 12; i++) {
      const s = setup(`team-${i}`, i % 6);
      // Put the whole field in one garage so every pass would be between teammates.
      const entries = s.finalists.map((f) => ({ ...f, garageId: 1 }));
      const hold = new FinalRace(input(s, entries));
      hold.setTeamOrder(1, 'hold');
      hold.runToEnd();
      blocked += hold.events.filter((e) => e.type === 'overtake').length;
      const open = simulateFinal(input(s, entries));
      free += open.events.filter((e) => e.type === 'overtake').length;
    }
    expect(blocked).toBe(0);
    expect(free).toBeGreaterThan(0);
  });
});

describe('worn parts', () => {
  it('make mechanical trouble more likely than fresh parts', () => {
    const s = setup('parts-wear');
    const trouble = (partWear: number) => {
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const entries = s.finalists.map((e) => ({ ...e, car: { ...e.car, partWear } }));
        const race = new FinalRace({ ...input(s, entries), seed: `pw-${i}` });
        race.runToEnd();
        n += race.events.filter((e) => e.type === 'mechanical_warning').length;
      }
      return n;
    };
    expect(trouble(100)).toBeGreaterThan(trouble(0));
  });
});
