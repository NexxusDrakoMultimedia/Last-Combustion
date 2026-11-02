// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { refreshLineups } from '../../src/sim/lineups';
import { createRng } from '../../src/sim/rng';
import { generateWorld } from '../../src/sim/worldgen';
import { carModels, manufacturers } from '../../src/sim/worldgen/data';

const start = generateWorld('lineups').lineups;

function simulate(years: number, seed = 'lineups') {
  let models = carModels;
  let refresh = start;
  const rng = createRng(seed).stream('lineups');
  const log: { year: number; introduced: string[]; retired: string[] }[] = [];
  for (let year = 2031; year <= 2031 + years; year++) {
    const result = refreshLineups(models, refresh, year, rng);
    models = result.models;
    refresh = result.refresh;
    log.push({ year, introduced: result.introduced, retired: result.retired });
    for (const maker of manufacturers) {
      const onSale = models.filter((m) => m.manufacturerId === maker.id && m.retiredYear === null);
      expect(onSale.length, `${maker.name} in ${year}`).toBeGreaterThanOrEqual(2);
      expect(onSale.length, `${maker.name} in ${year}`).toBeLessThanOrEqual(5);
    }
  }
  return { models, refresh, log };
}

describe('refreshLineups', () => {
  it('does nothing before the first refresh is due', () => {
    const result = refreshLineups(carModels, start, 2031, createRng('x').stream('l'));
    expect(result.introduced).toEqual([]);
    expect(result.retired).toEqual([]);
  });

  it('keeps every manufacturer between 2 and 5 models for 70 years', () => {
    simulate(70);
  });

  it('refreshes each manufacturer about every five years', () => {
    const { log } = simulate(60);
    const introducedBy = new Map<string, number[]>();
    for (const { year, introduced } of log) {
      for (const id of introduced) {
        const maker = id.split('-')[0] as string;
        const years = introducedBy.get(maker) ?? [];
        if (!years.includes(year)) years.push(year);
        introducedBy.set(maker, years);
      }
    }
    for (const [maker, years] of introducedBy) {
      for (let i = 1; i < years.length; i++) {
        const gap = (years[i] as number) - (years[i - 1] as number);
        expect(gap, maker).toBeGreaterThanOrEqual(4);
        expect(gap, maker).toBeLessThanOrEqual(6);
      }
    }
    expect(introducedBy.size).toBeGreaterThan(20);
  });

  it('builds successors that are stronger, correctly sized, and named by generation', () => {
    const { models } = simulate(30);
    const successors = models.filter((m) => m.predecessorId);
    expect(successors.length).toBeGreaterThan(20);
    for (const s of successors) {
      const old = models.find((m) => m.id === s.predecessorId)!;
      expect(s.ps).toBeGreaterThan(old.ps);
      expect(s.kerbKg).toBeLessThanOrEqual(old.kerbKg);
      expect(s.maxTyreMm).toBe(Math.round(s.kerbKg / 5 + 40));
      expect(s.generation).toBe(old.generation + 1);
      expect(old.retiredYear).toBe(s.introducedYear);
    }
  });

  it('keeps retired models in the list and keeps names and ids unique', () => {
    const { models } = simulate(40);
    expect(models.length).toBeGreaterThan(96);
    expect(models.filter((m) => m.retiredYear !== null).length).toBeGreaterThan(20);
    expect(new Set(models.map((m) => m.id)).size).toBe(models.length);
    expect(new Set(models.map((m) => m.name)).size).toBe(models.length);
  });

  it('never refreshes the one-off Homura Spirit R-7', () => {
    const { models } = simulate(60);
    const spirit = models.find((m) => m.id === 'homura-spirit-r-7')!;
    expect(spirit.retiredYear).toBeNull();
    expect(models.filter((m) => m.id.startsWith('homura-spirit'))).toHaveLength(1);
  });

  it('is deterministic and does not change its inputs', () => {
    const before = JSON.stringify(carModels);
    expect(JSON.stringify(simulate(25).models)).toBe(JSON.stringify(simulate(25).models));
    expect(JSON.stringify(carModels)).toBe(before);
  });
});
