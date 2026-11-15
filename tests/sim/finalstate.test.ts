// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildSectors } from '../../src/sim/courses/sectors';
import { FinalRace, type Call, type FinalEntry } from '../../src/sim/final/engine';
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

const SEEDS = ['final-state-a', 'final-state-b', 'final-state-c'];
const setups = new Map(SEEDS.map((seed, i) => [seed, setup(seed, i)]));

// Compared as a save would carry them (a JSON round trip turns a negative zero into a zero).
const outcome = (race: FinalRace) =>
  JSON.parse(
    JSON.stringify({
      classification: race.classification(),
      events: race.events,
      timing: race.timing,
    }),
  );

describe('a final saved part-way', () => {
  it('plays on exactly as the race that was never saved, from any sector', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SEEDS),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (seed, at) => {
          const s = setups.get(seed)!;
          const whole = new FinalRace(input(s));
          whole.runToEnd();
          const first = new FinalRace(input(s));
          const stop = Math.floor(at * first.totalSectors);
          while (!first.finished && first.progress < stop) first.step();
          // Through JSON, as a save would carry it.
          const saved = JSON.parse(JSON.stringify(first.snapshot()));
          const resumed = FinalRace.restore(input(s), saved);
          expect(resumed.progress).toBe(first.progress);
          resumed.runToEnd();
          expect(outcome(resumed)).toEqual(outcome(whole));
        },
      ),
      { numRuns: 15 },
    );
  });

  it('keeps the player\u2019s calls, stances and team orders', () => {
    const s = setups.get(SEEDS[0]!)!;
    const calls: Call[] = ['push', 'balanced', 'conserve'];
    const make = () => {
      const race = new FinalRace(input(s));
      s.finalists.slice(0, 3).forEach((e, i) => race.setCall(e.entryId, calls[i]!));
      race.setStance(s.finalists[1]!.entryId, 'attack');
      race.setTeamOrder(s.finalists[0]!.garageId, 'hold');
      return race;
    };
    const whole = make();
    whole.runToEnd();
    const part = make();
    for (let i = 0; i < 40; i++) part.step();
    const resumed = FinalRace.restore(input(s), JSON.parse(JSON.stringify(part.snapshot())));
    resumed.runToEnd();
    expect(outcome(resumed)).toEqual(outcome(whole));
    expect(resumed.stateOf(s.finalists[0]!.entryId).call).toBe('push');
  });

  it('can be saved again after being restored, and again', () => {
    const s = setups.get(SEEDS[1]!)!;
    const whole = new FinalRace(input(s));
    whole.runToEnd();
    let race = new FinalRace(input(s));
    while (!race.finished) {
      for (let i = 0; i < 17 && !race.finished; i++) race.step();
      race = FinalRace.restore(input(s), JSON.parse(JSON.stringify(race.snapshot())));
    }
    expect(outcome(race)).toEqual(outcome(whole));
  });

  it('takes a copy: playing on does not change a snapshot already taken', () => {
    const s = setups.get(SEEDS[2]!)!;
    const race = new FinalRace(input(s));
    for (let i = 0; i < 10; i++) race.step();
    const snap = race.snapshot();
    const before = JSON.stringify(snap);
    race.runToEnd();
    expect(JSON.stringify(snap)).toBe(before);
  });

  it('refuses a snapshot from a different field', () => {
    const s = setups.get(SEEDS[0]!)!;
    const snap = new FinalRace(input(s)).snapshot();
    expect(() => FinalRace.restore(input(s, s.finalists.slice(0, 10)), snap)).toThrow(
      /different field/,
    );
  });
});
