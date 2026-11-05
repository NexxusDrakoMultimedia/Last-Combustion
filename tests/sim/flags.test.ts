// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import flagsJson from '../../data/flags.json';
import { generateWorld } from '../../src/sim/worldgen';
import { excludedFlags, flagNames, populations } from '../../src/sim/worldgen/data';

describe('excluded flags', () => {
  it('lists Antarctica and the international organisations', () => {
    for (const code of ['AQ', 'ARAB', 'EAC', 'UN', 'ASEAN', 'CEFTA']) {
      expect(excludedFlags.has(code)).toBe(true);
    }
  });

  it('never appears in the flag data or in a generated world', () => {
    for (const code of Object.keys(populations)) expect(excludedFlags.has(code)).toBe(false);
    const world = generateWorld('flags');
    const used = new Set([
      ...world.garages.map((g) => g.flag),
      ...world.drivers.map((d) => d.flag),
      ...world.cars.map((c) => c.flag),
      ...world.flagFans.map((f) => f.flag),
    ]);
    for (const code of used) expect(excludedFlags.has(code)).toBe(false);
  });

  it('gives every flag a short name and a long name', () => {
    for (const code of Object.keys(populations)) {
      const names = flagNames[code];
      expect(names?.short.length).toBeGreaterThan(0);
      expect(names?.long.length).toBeGreaterThanOrEqual(names?.short.length ?? 0);
    }
    expect(flagNames.AU).toEqual({ short: 'Australia', long: 'Commonwealth of Australia' });
  });

  it('keeps the rare rename valid: an existing flag, a whole-number chance and its art', () => {
    const renames = flagsJson.renames;
    expect(renames).toHaveLength(1);
    for (const rename of renames) {
      expect(Object.keys(populations)).toContain(rename.flag);
      expect(Number.isInteger(rename.oneIn)).toBe(true);
      expect(rename.oneIn).toBeGreaterThan(1_000_000);
      expect(rename.long.length).toBeGreaterThanOrEqual(rename.short.length);
      expect(existsSync(rename.art)).toBe(true);
    }
  });

  it('names every recognised nation with a short and a long name, and nothing excluded', () => {
    const nations = Object.entries(flagNames).filter(([code]) => /^[A-Z]{2}$/.test(code));
    expect(nations.length).toBeGreaterThanOrEqual(200);
    const shorts = new Set<string>();
    for (const [code, names] of nations) {
      expect(excludedFlags.has(code)).toBe(false);
      expect(names.short.trim()).toBe(names.short);
      expect(names.long.length).toBeGreaterThanOrEqual(names.short.length);
      expect(shorts.has(names.short)).toBe(false);
      shorts.add(names.short);
    }
    for (const code of ['AU', 'JP', 'XK', 'TW', 'PR', 'HK', 'PS', 'GI', 'FO', 'CZ', 'TR'])
      expect(flagNames[code]).toBeDefined();
    expect(flagNames.TW?.short).toBe('Chinese Taipei');
    expect(flagNames.CZ).toEqual({ short: 'Czechia', long: 'Czech Republic' });
  });

  it('keeps the home nations out of the list until they split', () => {
    for (const code of ['GB-ENG', 'GB-SCT', 'GB-WLS', 'EN', 'SCT', 'WLS', 'NIR'])
      expect(flagNames[code]).toBeUndefined();
  });
});
