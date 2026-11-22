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

describe('penalties in a final', () => {
  const classified = (
    s: ReturnType<typeof setup>,
    technical?: {
      index: number;
      level: 'minor' | 'major' | 'severe' | 'egregious' | 'palpably_unfair';
    },
  ) => {
    const entries = s.finalists.map((e, i) =>
      technical && i === technical.index ? { ...e, technical: technical.level } : e,
    );
    const race = new FinalRace(input(s, entries));
    race.runToEnd();
    return race.classification();
  };

  it('drop a car the places its Technical penalty is worth, from where it finished on the road', () => {
    const s = setup('final-penalty-a');
    const plain = classified(s);
    const target = s.finalists[0]!.entryId;
    const before = plain.find((c) => c.entryId === target)!;
    expect(before.finished).toBe(true);
    const after = classified(s, { index: 0, level: 'severe' }).find((c) => c.entryId === target)!;
    expect(after.placesLost).toBe(3);
    const finishers = plain.filter((c) => c.finished).length;
    expect(after.position).toBe(Math.min(before.position + 3, finishers));
    expect(after.disqualified).toBe(false);
  });

  it('disqualify a car with a Palpably Unfair Act: last, no time, flagged', () => {
    const s = setup('final-penalty-b');
    const target = s.finalists[0]!.entryId;
    const result = classified(s, { index: 0, level: 'palpably_unfair' });
    const row = result.find((c) => c.entryId === target)!;
    expect(row.disqualified).toBe(true);
    expect(row.finished).toBe(false);
    expect(row.dnfReason).toBe('disqualified');
    expect(row.position).toBe(result.length);
    expect(result.filter((c) => c.disqualified)).toHaveLength(1);
  });

  it('are kept when the race is saved and picked up again', () => {
    const s = setup('final-penalty-c');
    const entries = s.finalists.map((e, i) =>
      i === 2 ? { ...e, technical: 'major' as const } : e,
    );
    const whole = new FinalRace(input(s, entries));
    whole.runToEnd();
    const part = new FinalRace(input(s, entries));
    for (let i = 0; i < 10 && !part.finished; i++) part.step();
    const restored = FinalRace.restore(
      input(s, entries),
      JSON.parse(JSON.stringify(part.snapshot())),
    );
    restored.runToEnd();
    expect(restored.classification()).toEqual(whole.classification());
  });

  it('for ignoring a drone’s stop signal are on the scale (1 to 5 places) or a disqualification, and are rare', () => {
    let seen = 0;
    for (let n = 0; n < 10; n++) {
      const s = setup(`final-drone-${n}`, n % 6);
      const race = new FinalRace(input(s));
      race.runToEnd();
      const classification = race.classification();
      for (const e of race.events.filter((x) => x.type === 'drone_penalty')) {
        seen += 1;
        const row = classification.find((c) => c.entryId === e.entryId)!;
        if (e.payload.level === 'palpably_unfair') {
          expect(row.disqualified).toBe(true);
          expect(Number(e.payload.banRaces)).toBeLessThanOrEqual(12);
        } else {
          expect(Number(e.payload.places)).toBeGreaterThanOrEqual(1);
          expect(Number(e.payload.places)).toBeLessThanOrEqual(5);
          expect(row.placesLost).toBeGreaterThanOrEqual(Number(e.payload.places));
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  }, 120_000);

  it('never drop a car below a car that retired, or below the last place of the field', () => {
    for (const seed of ['final-cap-a', 'final-cap-b', 'final-cap-c', 'final-cap-d']) {
      const s = setup(seed);
      const plain = classified(s);
      const target = s.finalists.find((e) => plain.find((c) => c.entryId === e.entryId)!.finished);
      if (!target) continue;
      const index = s.finalists.indexOf(target);
      const result = classified(s, { index, level: 'egregious' });
      const row = result.find((c) => c.entryId === target.entryId)!;
      const finishers = result.filter((c) => c.finished);
      expect(row.finished).toBe(true);
      expect(row.position).toBeLessThanOrEqual(finishers.length);
      expect(row.position).toBeLessThanOrEqual(s.finalists.length);
      for (const retired of result.filter((c) => !c.finished && !c.disqualified))
        expect(retired.position).toBeGreaterThan(row.position);
    }
  }, 120_000);

  it('for causing contact are Sportsmanship penalties on the scale, taken as places and no longer as seconds', () => {
    let seen = 0;
    for (let n = 0; n < 10; n++) {
      const s = setup(`final-contact-${n}`, n % 6);
      const race = new FinalRace(input(s));
      race.runToEnd();
      const classification = race.classification();
      for (const e of race.events.filter((x) => x.type === 'contact')) {
        seen += 1;
        expect(['minor', 'major', 'severe', 'flagrant', 'egregious']).toContain(e.payload.level);
        expect(Number(e.payload.places)).toBeGreaterThanOrEqual(1);
        expect(Number(e.payload.places)).toBeLessThanOrEqual(5);
        expect(e.payload.penaltySeconds).toBeUndefined();
        const row = classification.find((c) => c.entryId === e.entryId)!;
        expect(row.placesLost).toBeGreaterThanOrEqual(Number(e.payload.places));
      }
      // No car carries a time penalty any more.
      for (const c of classification) expect(c.penaltySeconds).toBe(0);
    }
    expect(seen).toBeGreaterThan(0);
  }, 120_000);
});
