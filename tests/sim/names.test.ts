// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';
import { flagNames, nameLists } from '../../src/sim/worldgen/data';
import {
  isOffensiveName,
  ownerSurname,
  personName,
  surnamesInName,
} from '../../src/sim/worldgen/names';

describe('the name lists', () => {
  const codes = Object.keys(nameLists.byNationality);

  it('cover many nations and cultures, each with a real pool of names', () => {
    expect(codes.length).toBeGreaterThanOrEqual(50);
    for (const code of codes) {
      const p = nameLists.byNationality[code]!;
      expect(flagNames[code], code).toBeDefined();
      expect(p.male.length, code).toBeGreaterThanOrEqual(25);
      expect(p.female.length, code).toBeGreaterThanOrEqual(25);
      expect(p.surnames.length, code).toBeGreaterThanOrEqual(25);
      // No first name has a space in it (a name is "First Surname"), and none is repeated.
      for (const n of [...p.male, ...p.female]) expect(n, `${code} ${n}`).not.toMatch(/\s/);
      for (const list of [p.male, p.female, p.surnames])
        expect(new Set(list.map((x) => x.toLowerCase())).size, code).toBe(list.length);
    }
  });

  it('weight every nation that has names, with the host nation at 60%', () => {
    const w = nameLists.nationalityWeights;
    expect(Object.keys(w).sort()).toEqual([...codes].sort());
    expect(w.AU).toBe(0.6);
    expect(Object.values(w).reduce((s, x) => s + x, 0)).toBeGreaterThan(0.99);
    expect(Object.values(w).reduce((s, x) => s + x, 0)).toBeLessThan(1.01);
    expect(Object.values(w).every((x) => x > 0)).toBe(true);
  });

  it('hold no offensive word or infamous name', () => {
    for (const code of codes) {
      const p = nameLists.byNationality[code]!;
      for (const n of [...p.male, ...p.female, ...p.surnames])
        expect(isOffensiveName(n), `${code} ${n}`).toBe(false);
    }
  });
});

describe('offensive names', () => {
  it('are caught by word and by full name, in any case', () => {
    expect(isOffensiveName('Adolf Hitler')).toBe(true);
    expect(isOffensiveName('adolf HITLER')).toBe(true);
    expect(isOffensiveName('Pol Pot')).toBe(true);
    expect(isOffensiveName('Jack Shit')).toBe(true);
    expect(isOffensiveName('Anna Fuck-Smith')).toBe(true);
  });

  it('do not catch ordinary names, or the names of real drivers', () => {
    expect(isOffensiveName('Lewis Hamilton')).toBe(false);
    expect(isOffensiveName('Max Verstappen')).toBe(false);
    expect(isOffensiveName('Daniel Ricciardo')).toBe(false);
    // A word inside a longer name is not a match.
    expect(isOffensiveName('Scunthorpe Assistant')).toBe(false);
    expect(isOffensiveName('Shitaki Mushroom')).toBe(false);
  });

  it('are never generated', () => {
    for (let i = 0; i < 400; i++) {
      const rng = createRng(`names-${i}`).stream('x');
      const code = Object.keys(nameLists.byNationality)[
        i % Object.keys(nameLists.byNationality).length
      ]!;
      expect(isOffensiveName(personName(rng, code, i % 2 ? 'male' : 'female'))).toBe(false);
    }
  });
});

describe('family names in a garage name', () => {
  const [a, b] = nameLists.byNationality.AU!.surnames as [string, string];

  it('are found as whole words, and nothing else is', () => {
    expect(surnamesInName(`${a} Dyno Works`, 'AU')).toEqual([a]);
    expect(surnamesInName(`${a} & ${b}`, 'AU')).toEqual([a, b]);
    expect(surnamesInName('Silent Dyno Works', 'AU')).toEqual([]);
    expect(surnamesInName(`${a} Dyno Works`, 'nowhere')).toEqual([]);
  });

  it('leave out the words of a place the name carries', () => {
    // "Mount Barker" is a place: its Barker is the town's, not a person's.
    expect(surnamesInName('Mount Barker Coast Tuning', 'AU')).not.toContain('Barker');
  });

  it('are shared by the owners: the name itself, or for two or more, one or both chosen by the seed', () => {
    expect(ownerSurname(createRng('x').stream('s'), `${a} Dyno Works`, 'AU')).toBe(a);
    expect(ownerSurname(createRng('x').stream('s'), 'Silent Dyno Works', 'AU')).toBeUndefined();
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++)
      seen.add(ownerSurname(createRng(`seed-${i}`).stream('s'), `${a} & ${b}`, 'AU')!);
    // One of the two, or both with a hyphen, and each of those turns up.
    expect(seen).toEqual(new Set([a, b, `${a}-${b}`]));
    expect(ownerSurname(createRng('same').stream('s'), `${a} & ${b}`, 'AU')).toBe(
      ownerSurname(createRng('same').stream('s'), `${a} & ${b}`, 'AU'),
    );
  });
});
