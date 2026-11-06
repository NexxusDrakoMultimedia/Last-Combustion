// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { expand, generateName } from '../../src/sim/names/generate';
import { generateWorld } from '../../src/sim/worldgen';
import { createRng } from '../../src/sim/rng';
import { earnedTitles, qualifies, title, titles } from '../../src/sim/titles';
import {
  carCategories,
  denyCarNames,
  garageThemes,
  nameLists,
  places,
} from '../../src/sim/worldgen/data';
import {
  carModelName,
  garageName,
  nickname,
  nicknameThemesFor,
  pickForeignNationality,
  pickNationality,
} from '../../src/sim/worldgen/names';

describe('name generators', () => {
  it('fills tokens, turns underscores into spaces and refuses unknown tokens', () => {
    const rng = createRng('n').stream('t');
    expect(expand('{a}_{b}', { a: ['Red'], b: ['Fox'] }, rng)).toBe('Red Fox');
    expect(() => expand('{nothing}', {}, rng)).toThrow(/nothing/);
  });

  it('is deterministic for a seed', () => {
    const a = createRng('seed').stream('x');
    const b = createRng('seed').stream('x');
    const usedA = new Set<string>();
    const usedB = new Set<string>();
    const listA = Array.from({ length: 20 }, () => garageName(a, 'JP', usedA));
    const listB = Array.from({ length: 20 }, () => garageName(b, 'JP', usedB));
    expect(listA).toEqual(listB);
  });

  it('never repeats a garage name or a car name that is already used', () => {
    const rng = createRng('unique').stream('x');
    const garages = new Set<string>();
    for (let i = 0; i < 200; i++) garageName(rng, 'AU', garages);
    expect(garages.size).toBe(200);
    const cars = new Set<string>();
    for (const category of Object.keys(carCategories)) {
      for (let i = 0; i < 30; i++) {
        const name = carModelName(rng, category, cars);
        expect(denyCarNames.has(name.toLowerCase()) || denyCarNames.has(name)).toBe(false);
      }
    }
    expect(cars.size).toBe(30 * Object.keys(carCategories).length);
  });

  it('has many themes, and generateName can be limited to one', () => {
    expect(Object.keys(garageThemes).length).toBeGreaterThanOrEqual(10);
    const rng = createRng('only').stream('x');
    const result = generateName(
      rng,
      garageThemes,
      { surname: () => 'Tanaka', place: () => 'Nara' },
      { only: ['animal'] },
    );
    expect(result.theme).toBe('animal');
  });

  it('gives nicknames that fit, with no repeats', () => {
    expect(
      nicknameThemesFor({
        homeRoadType: 'night',
        wetSkill: 80,
        racecraft: 10,
        consistency: 90,
        age: 40,
      }),
    ).toEqual(['night', 'wet', 'smooth', 'veteran']);
    const rng = createRng('nick').stream('x');
    const used = new Set<string>();
    for (let i = 0; i < 100; i++) nickname(rng, ['night', 'wet'], used);
    expect(used.size).toBe(100);
  });

  it('now and then picks any nation at random, and mostly the weighted ones', () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const rng = createRng(seed).stream('nat');
        for (let i = 0; i < 20; i++)
          expect(Object.keys(nameLists.byNationality)).toContain(pickNationality(rng));
      }),
      { numRuns: 20 },
    );
    const rng = createRng('wild').stream('nat');
    const weighted = new Set(Object.keys(nameLists.nationalityWeights));
    const picks = Array.from({ length: 4000 }, () => pickNationality(rng));
    const off = picks.filter((c) => !weighted.has(c)).length;
    expect(off).toBeLessThan(picks.length * 0.1);
  });
});

describe('titles', () => {
  it('have unique ids and known conditions', () => {
    expect(new Set(titles.map((t) => t.id)).size).toBe(titles.length);
    expect(title('point-scorer').name).toBe('Point Scorer');
    expect(() => title('nope')).toThrow();
  });

  it('are earned when every condition is met, and not before', () => {
    const t = title('point-scorer');
    expect(qualifies({}, t)).toBe(false);
    expect(qualifies({ points: 5 }, t)).toBe(true);
    expect(earnedTitles({ points: 5 })).toContain('point-scorer');
    expect(earnedTitles({})).toEqual([]);
  });
});

describe('garage names that carry a place', () => {
  it('name the town or city the garage is from, never another', () => {
    const world = generateWorld(31396);
    const named = world.garages.filter((g) => g.name !== 'Drake Motorsports');
    let carrying = 0;
    for (const g of named) {
      const home = places.find((p) => p.id === g.hqPlaceId)?.name as string;
      const others = places.filter((p) => p.name !== home && g.name.split(' ').includes(p.name));
      expect(others.map((p) => p.name)).toEqual([]);
      if (g.name.includes(home)) carrying++;
    }
    expect(carrying).toBeGreaterThan(0);
  });
});

describe('foreign garages', () => {
  it('never draws the host country for a foreign flag', () => {
    const rng = createRng('foreign').stream('t');
    for (let i = 0; i < 2000; i++) expect(pickForeignNationality(rng)).not.toBe('AU');
  });

  it('sometimes draws any flag at all, including nations with no name lists, but never an excluded one', () => {
    const rng = createRng('wild').stream('t');
    const picks = new Set(Array.from({ length: 6000 }, () => pickForeignNationality(rng)));
    expect([...picks].some((c) => !(c in nameLists.byNationality))).toBe(true);
    for (const excluded of ['AU', 'AQ', 'UN', 'EAC']) expect(picks.has(excluded)).toBe(false);
  });

  it('gives a garage under a flag with no name lists Australian-style names and a home', () => {
    const garages = generateWorld(7).garages;
    const unlisted = garages.filter((g) => !(g.flag in nameLists.byNationality));
    expect(unlisted.length).toBeGreaterThan(0);
    for (const g of unlisted) {
      expect(g.name.length).toBeGreaterThan(0);
      expect(g.basePlaceId.startsWith('au-')).toBe(true);
    }
  });

  it('flies a foreign flag over about 31% of the garages in a new world', () => {
    let foreign = 0;
    let total = 0;
    for (let seed = 1; seed <= 20; seed++)
      for (const g of generateWorld(seed).garages) {
        total++;
        if (g.flag !== 'AU') foreign++;
      }
    expect(foreign / total).toBeGreaterThan(0.26);
    expect(foreign / total).toBeLessThan(0.38);
  });
});
