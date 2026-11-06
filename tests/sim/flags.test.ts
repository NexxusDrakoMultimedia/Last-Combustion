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
    expect(flagNames.TW?.short).toBe('Republic of Taiwan');
    expect(flagNames.CZ).toEqual({ short: 'Czechia', long: 'Czech Republic' });
  });

  it('keeps the home nations out of the list until they split', () => {
    for (const code of ['GB-ENG', 'GB-SCT', 'GB-WLS', 'EN', 'SCT', 'WLS', 'NIR'])
      expect(flagNames[code]).toBeUndefined();
  });
});

describe('flag fans', () => {
  const world = generateWorld('flag-fans');
  const fans = (flag: string) => world.flagFans.find((f) => f.flag === flag)?.fans;

  it('gives every named flag a few fans at least', () => {
    for (const code of Object.keys(flagNames).filter((c) => /^[A-Z]{2}$/.test(c))) {
      expect(fans(code), code).toBeGreaterThanOrEqual(5);
    }
    // A tiny nation with no population on record gets just the handful.
    expect(fans('TV')).toBeLessThan(40);
  });

  it('adds the United Kingdom up from its home nations, hidden or not', () => {
    const regions = ['gb-eng', 'gb-sct', 'gb-wls', 'gb-nir'].map((k) => fans(k)!);
    expect(regions.every((n) => n >= 5)).toBe(true);
    const sum = regions.reduce((a, b) => a + b, 0);
    // The rest is the share of anyone from the UK with no home nation (rounding aside).
    expect(fans('GB')!).toBeGreaterThanOrEqual(sum - 2);
    expect(fans('GB')! - sum).toBeLessThan(60);
    expect(fans('gb-eng')!).toBeGreaterThan(fans('gb-sct')!);
    expect(fans('gb-sct')!).toBeGreaterThan(fans('gb-nir')!);
  });

  it('gives the Spanish regions a small portion of Spain by their real populations', () => {
    const es = fans('ES')!;
    const portions = ['es-ct', 'es-ga', 'es-pv', 'ic'].map((k) => fans(k)!);
    for (const p of portions) expect(p).toBeLessThan(es);
    expect(portions.reduce((a, b) => a + b, 0)).toBeLessThan(es);
    expect(fans('es-ct')!).toBeGreaterThan(fans('es-ga')!);
    expect(fans('es-ga')!).toBeGreaterThanOrEqual(fans('es-pv')!);
  });
});
