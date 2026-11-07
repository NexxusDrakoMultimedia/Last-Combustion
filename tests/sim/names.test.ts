// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';
import { flagNames, nameLists } from '../../src/sim/worldgen/data';
import { isOffensiveName, personName } from '../../src/sim/worldgen/names';

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
