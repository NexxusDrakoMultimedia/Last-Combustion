// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  generateWorld,
  DRAKE_MOTORSPORTS,
  RESERVED_NUMBER,
  fameFromFans,
  overallRating,
} from '../../src/sim/worldgen';
import { buildCalendar, addDays } from '../../src/sim/worldgen/calendar';
import { carModels, manufacturers, nameLists, places } from '../../src/sim/worldgen/data';

const world = generateWorld('2031');
const model = (id: string) => carModels.find((m) => m.id === id)!;
const makerType = (modelId: string) =>
  manufacturers.find((m) => m.id === model(modelId).manufacturerId)!.type;
const placeIds = new Set(places.map((p) => p.id));

describe('world size', () => {
  it('has 96 garages, 313 drivers and 313 entries', () => {
    expect(world.garages).toHaveLength(96);
    expect(world.drivers).toHaveLength(313);
    expect(world.entries).toHaveLength(313);
  });

  it('gives every garage between 1 and 8 entries, adding up to 313', () => {
    const sizes = world.garages.map((g) => world.entries.filter((e) => e.garageId === g.id).length);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(8);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(313);
  });

  it('puts every driver in exactly one entry with one car', () => {
    expect(new Set(world.entries.map((e) => e.driverId)).size).toBe(313);
    expect(new Set(world.entries.map((e) => e.carId)).size).toBe(313);
  });
});

describe('race numbers', () => {
  const numbers = world.entries.map((e) => e.raceNumber);
  it('are unique, never use the reserved #313, and all come from 1 to 400', () => {
    expect(new Set(numbers).size).toBe(313);
    expect(numbers).not.toContain(RESERVED_NUMBER);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(400);
  });

  it('are not tied to driver strength, because the series has no earlier season to rank', () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const paceOf = (e: (typeof world.entries)[number]) => world.drivers[e.driverId - 1]!.pace;
    const low = world.entries.filter((e) => e.raceNumber <= 100).map(paceOf);
    const high = world.entries.filter((e) => e.raceNumber > 300).map(paceOf);
    expect(Math.abs(mean(low) - mean(high))).toBeLessThan(5);
  });
});

describe('cars', () => {
  const entered = world.entries.map((e) => world.cars[e.carId - 1]!);
  it('follow the field mix exactly', () => {
    const count = (type: string) => entered.filter((c) => makerType(c.modelId) === type).length;
    expect(count('hypercar')).toBe(9);
    expect(count('supercar')).toBe(147);
    expect(count('jdm')).toBe(69);
    expect(count('sports')).toBe(47);
    expect(count('domestic')).toBe(31);
    expect(count('other')).toBe(10);
  });

  it('are all legal under the Equalizer and have unique chassis numbers', () => {
    for (const car of world.cars) {
      expect(car.tyreWidthMm).toBeLessThanOrEqual(Math.round(car.kerbKg / 5 + 40));
    }
    expect(new Set(world.cars.map((c) => c.chassisNo)).size).toBe(world.cars.length);
  });

  it('give every chassis a model year, road kilometres and wear, and no racing history yet', () => {
    for (const car of world.cars) {
      expect(car.modelYear).toBeLessThanOrEqual(2031);
      expect(car.modelYear).toBeGreaterThanOrEqual(2031 - 25);
      expect(car.roadKm).toBeGreaterThan(0);
      expect(car.raceKm).toBe(0);
      expect(car.wear).toBeGreaterThanOrEqual(0);
      expect(car.wear).toBeLessThanOrEqual(100);
    }
  });

  it('wear older, harder-used cars more than newer ones', () => {
    const wear = (pred: (c: (typeof world.cars)[number]) => boolean) => {
      const list = world.cars.filter(pred);
      return list.reduce((s, c) => s + c.wear, 0) / list.length;
    };
    expect(wear((c) => c.modelYear <= 2015)).toBeGreaterThan(wear((c) => c.modelYear >= 2026));
  });

  it('put supercars mostly with the more prestigious garages', () => {
    const prestige = (carId: number) =>
      world.garages[world.cars[carId - 1]!.garageId - 1]!.prestige;
    const meanPrestige = (type: string) => {
      const list = world.entries
        .filter((e) => makerType(world.cars[e.carId - 1]!.modelId) === type)
        .map((e) => prestige(e.carId));
      return list.reduce((a, b) => a + b, 0) / list.length;
    };
    expect(meanPrestige('supercar')).toBeGreaterThan(meanPrestige('jdm') + 5);
    expect(meanPrestige('hypercar')).toBeGreaterThan(meanPrestige('supercar'));
  });

  it('never enter the founder car, which Drake Motorsports keeps', () => {
    const spirit = world.cars.find((c) => c.modelId === 'homura-spirit-r-7')!;
    const drake = world.garages.find((g) => g.name === DRAKE_MOTORSPORTS)!;
    expect(spirit.garageId).toBe(drake.id);
    expect(world.entries.some((e) => e.carId === spirit.id)).toBe(false);
    expect(world.cars.filter((c) => c.modelId === 'homura-spirit-r-7')).toHaveLength(1);
  });
});

describe('manufacturers and models', () => {
  it('has 31 manufacturers and 96 models, with 2 to 5 models each', () => {
    expect(manufacturers).toHaveLength(31);
    expect(carModels).toHaveLength(96);
    for (const maker of manufacturers) {
      const n = carModels.filter((m) => m.manufacturerId === maker.id).length;
      expect(n, maker.name).toBeGreaterThanOrEqual(2);
      expect(n, maker.name).toBeLessThanOrEqual(5);
    }
  });

  it('covers every category', () => {
    const count = (type: string) => manufacturers.filter((m) => m.type === type).length;
    expect(count('hypercar')).toBe(3);
    expect(count('supercar')).toBe(9);
    expect(count('sports')).toBe(6);
    expect(count('jdm')).toBe(7);
    expect(count('domestic')).toBe(4);
    expect(count('other')).toBe(2);
  });

  it('keeps every model consistent with the Equalizer and uniquely named', () => {
    for (const m of carModels) expect(m.maxTyreMm).toBe(Math.round(m.kerbKg / 5 + 40));
    expect(new Set(carModels.map((m) => m.name)).size).toBe(96);
    expect(new Set(carModels.map((m) => m.id)).size).toBe(96);
  });

  it('schedules each first refresh 3 to 6 years after the start', () => {
    expect(world.lineups).toHaveLength(31);
    for (const l of world.lineups) {
      expect(l.nextRefreshYear).toBeGreaterThanOrEqual(2034);
      expect(l.nextRefreshYear).toBeLessThanOrEqual(2037);
    }
  });
});

describe('garages', () => {
  it('have unique names, and Drake Motorsports is based in Brisbane in its own colours', () => {
    expect(new Set(world.garages.map((g) => g.name)).size).toBe(96);
    const drake = world.garages.find((g) => g.name === DRAKE_MOTORSPORTS)!;
    expect(drake.flag).toBe('AU');
    expect(drake.basePlaceId).toBe('au-brisbane');
    expect([drake.primaryColour, drake.secondaryColour]).toEqual(['#7f0000', '#ffd900']);
  });

  it('are not the player', () => {
    expect(world.garages.every((g) => !g.isPlayer)).toBe(true);
  });
});

describe('drivers', () => {
  it('have valid places, flags, stats and ages', () => {
    for (const d of world.drivers) {
      expect(placeIds.has(d.hometownPlaceId)).toBe(true);
      expect(placeIds.has(d.residencePlaceId)).toBe(true);
      for (const stat of [
        d.pace,
        d.consistency,
        d.racecraft,
        d.tyreManagement,
        d.composure,
        d.wetSkill,
      ]) {
        expect(stat).toBeGreaterThanOrEqual(10);
        expect(stat).toBeLessThanOrEqual(95);
      }
      expect(d.potential).toBeGreaterThanOrEqual(d.pace);
      const age = 2031 - Number(d.birthDate.slice(0, 4));
      expect(age).toBeGreaterThanOrEqual(18);
      expect(age).toBeLessThanOrEqual(48);
    }
  });

  it('start with no gold or silver borders: 2031 is the first year and there is no history', () => {
    expect(world.drivers.every((d) => d.goldBorderYear === null)).toBe(true);
  });

  it('mostly come from and live in the country they race for', () => {
    const share = (pred: (d: (typeof world.drivers)[number]) => boolean) =>
      world.drivers.filter(pred).length / world.drivers.length;
    const country = (id: string) => places.find((p) => p.id === id)!.country;
    expect(share((d) => country(d.hometownPlaceId) === d.flag)).toBeGreaterThan(0.85);
    expect(share((d) => country(d.residencePlaceId) === d.flag)).toBeGreaterThan(0.6);
    expect(share((d) => country(d.hometownPlaceId) !== d.flag)).toBeGreaterThan(0);
  });

  it('have names that are not on the deny list of famous people', () => {
    for (const d of world.drivers) expect(nameLists.denyFullNames).not.toContain(d.name);
  });
});

describe('fans and fame', () => {
  it('start every driver as an unknown with 10 to 400 fans', () => {
    for (const d of world.drivers) {
      expect(d.fans).toBeGreaterThanOrEqual(10);
      expect(d.fans).toBeLessThanOrEqual(400);
      expect(d.reputation).toBeGreaterThanOrEqual(5);
      expect(d.reputation).toBeLessThanOrEqual(35);
    }
  });

  it('keep fame derived from fans', () => {
    for (const d of world.drivers) expect(d.fame).toBeCloseTo(fameFromFans(d.fans), 0);
    expect(fameFromFans(3_000_000)).toBeCloseTo(68.5, 0);
  });

  it('build garage fans from their drivers', () => {
    const garage = world.garages[0]!;
    const drivers = world.entries
      .filter((e) => e.garageId === garage.id)
      .map((e) => world.drivers[e.driverId - 1]!);
    expect(garage.fans).toBe(Math.round(5 + 0.4 * drivers.reduce((s, d) => s + d.fans, 0)));
  });

  it('keep every fan count below 40% of the series audience', () => {
    const cap = 0.4 * world.seriesFans;
    expect(
      Math.max(
        ...world.drivers.map((d) => d.fans),
        ...world.garages.map((g) => g.fans),
        ...world.flagFans.map((f) => f.fans),
      ),
    ).toBeLessThan(cap);
    expect(world.seriesFans).toBe(200_000);
  });

  it('give the host nation the biggest national base', () => {
    const au = world.flagFans.find((f) => f.flag === 'AU')!.fans;
    expect(au).toBeGreaterThan(
      Math.max(...world.flagFans.filter((f) => f.flag !== 'AU').map((f) => f.fans)),
    );
  });
});

describe('contracts', () => {
  it('give every driver one contract and every garage one lead driver', () => {
    expect(world.contracts).toHaveLength(313);
    for (const g of world.garages) {
      expect(world.contracts.filter((c) => c.garageId === g.id && c.role === 'lead')).toHaveLength(
        1,
      );
    }
    for (const c of world.contracts) {
      expect(c.endYear).toBeGreaterThanOrEqual(c.startYear);
      expect(c.salary).toBeGreaterThanOrEqual(0);
    }
  });

  it('pay stronger drivers more', () => {
    const rated = world.contracts.map((c) => ({
      salary: c.salary,
      rating: overallRating(world.drivers[c.driverId - 1]!),
    }));
    const top = rated.filter((r) => r.rating >= 55);
    const bottom = rated.filter((r) => r.rating < 40);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(top.map((r) => r.salary))).toBeGreaterThan(mean(bottom.map((r) => r.salary)) * 3);
  });
});

describe('calendar', () => {
  const rounds = buildCalendar(2031);
  it('opens on 31 March and finishes by mid-October', () => {
    expect(rounds[0]!.practiceStart).toBe('2031-03-31');
    expect(rounds).toHaveLength(6);
    expect(rounds[5]!.finalDate <= '2031-10-15').toBe(true);
  });

  it('runs 7 practice days, 7 prelim days and the final the day after', () => {
    for (const r of rounds) {
      expect(addDays(r.practiceStart, 7)).toBe(r.prelimStart);
      expect(addDays(r.prelimStart, 7)).toBe(r.finalDate);
    }
  });

  it('leaves at least three weeks between rounds', () => {
    for (let i = 1; i < rounds.length; i++) {
      const gap =
        (Date.parse(rounds[i]!.practiceStart) - Date.parse(rounds[i - 1]!.finalDate)) / 86_400_000;
      expect(gap).toBeGreaterThanOrEqual(21);
    }
  });

  it('uses every course once, in order', () => {
    expect(rounds.map((r) => r.courseId)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `round-${n}`));
  });
});

describe('generation', () => {
  it('is deterministic for a seed and different for another seed', () => {
    expect(JSON.stringify(generateWorld('abc'))).toBe(JSON.stringify(generateWorld('abc')));
    expect(JSON.stringify(generateWorld('abc'))).not.toBe(JSON.stringify(generateWorld('abd')));
  });

  it('is quick enough to run when a career starts', () => {
    const start = performance.now();
    generateWorld('speed');
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it('holds its invariants for any seed', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 12 }), (seed) => {
        const w = generateWorld(seed);
        const numbers = w.entries.map((e) => e.raceNumber);
        return (
          w.garages.length === 96 &&
          w.drivers.length === 313 &&
          w.entries.length === 313 &&
          new Set(numbers).size === 313 &&
          !numbers.includes(RESERVED_NUMBER) &&
          new Set(w.garages.map((g) => g.name)).size === 96 &&
          w.drivers.every((d) => d.goldBorderYear === null) &&
          w.garages.every((g) => w.entries.some((e) => e.garageId === g.id))
        );
      }),
      { numRuns: 12 },
    );
  });
});
