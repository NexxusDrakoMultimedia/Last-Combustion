// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from './rng';
import { balance } from './worldgen/data';
import type { CarModelData, ManufacturerRefresh, Tier } from './worldgen/types';

/** Price multipliers by tier (see the GDD, "Fictional manufacturers and cars"). */
export const TIER_MULTIPLIER: Record<Tier, number> = {
  starter: 0.8,
  mid: 1,
  premium: 1.8,
  elite: 3.5,
  hyper: 8,
  unique: 1,
};

export const priceNew = (ps: number, tier: Tier): number =>
  Math.round(((15000 + 280 * ps) * TIER_MULTIPLIER[tier]) / 100) * 100;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const DERIVATIVE_SUFFIXES = ['R', 'S', 'GT', 'Sport', 'Spec'];

const rootOf = (name: string): string => name.replace(/ (?:II|III|IV|V|VI|VII|VIII|IX|X)$/, '');
const rootIdOf = (id: string): string => id.replace(/-g\d+$/, '');

export interface LineupResult {
  models: CarModelData[];
  refresh: ManufacturerRefresh[];
  introduced: string[];
  retired: string[];
}

function successor(base: CarModelData, year: number, rng: RandomStream): CarModelData {
  const generation = base.generation + 1;
  const ps = Math.round(base.ps * rng.float(1.05, 1.12));
  const kerbKg = Math.round((base.kerbKg * rng.float(0.96, 1)) / 10) * 10;
  return {
    ...base,
    id: `${rootIdOf(base.id)}-g${generation}`,
    name: `${rootOf(base.name)} ${ROMAN[generation - 1] ?? generation}`,
    ps,
    kerbKg,
    maxTyreMm: Math.round(kerbKg / 5 + 40),
    priceNew: priceNew(ps, base.tier),
    generation,
    introducedYear: year,
    retiredYear: null,
    predecessorId: base.id,
  };
}

function derivative(base: CarModelData, year: number, taken: Set<string>, rng: RandomStream) {
  const suffix = rng.pick(
    DERIVATIVE_SUFFIXES.filter((s) => !taken.has(`${rootOf(base.name)} ${s}`)),
  );
  const ps = Math.round(base.ps * 1.08);
  const kerbKg = Math.round((base.kerbKg * 0.98) / 10) * 10;
  return {
    ...base,
    id: `${rootIdOf(base.id)}-${suffix.toLowerCase()}`,
    name: `${rootOf(base.name)} ${suffix}`,
    ps,
    kerbKg,
    maxTyreMm: Math.round(kerbKg / 5 + 40),
    priceNew: priceNew(ps, base.tier),
    generation: 1,
    introducedYear: year,
    retiredYear: null,
    predecessorId: null,
  };
}

/**
 * Runs the lineup refresh for every manufacturer that is due (see the GDD, "Manufacturer
 * lineups"). Pure: returns new arrays and leaves its inputs alone.
 */
export function refreshLineups(
  models: readonly CarModelData[],
  refresh: readonly ManufacturerRefresh[],
  year: number,
  rng: RandomStream,
): LineupResult {
  const cfg = balance.lineups;
  const all = models.map((m) => ({ ...m }));
  const introduced: string[] = [];
  const retired: string[] = [];
  const nextRefresh = refresh.map((r) => ({ ...r }));

  for (const entry of nextRefresh) {
    if (entry.nextRefreshYear > year) continue;
    const mine = () =>
      all.filter((m) => m.manufacturerId === entry.manufacturerId && m.retiredYear === null);
    const sellable = mine().filter((m) => m.tier !== 'unique');
    const oldestFirst = [...sellable].sort(
      (a, b) =>
        a.generation - b.generation ||
        a.introducedYear - b.introducedYear ||
        a.id.localeCompare(b.id),
    );
    const replace = Math.min(rng.int(1, 2), oldestFirst.length);
    const taken = new Set(all.map((m) => m.name));

    for (const old of oldestFirst.slice(0, replace)) {
      const next = successor(old, year, rng);
      if (taken.has(next.name)) continue;
      old.retiredYear = year;
      retired.push(old.id);
      all.push(next);
      taken.add(next.name);
      introduced.push(next.id);
    }
    if (mine().length < cfg.maxModels && rng.chance(0.4)) {
      const candidates = mine().filter((m) => m.tier !== 'unique' && m.introducedYear < year);
      const extra =
        candidates.length > 0 ? derivative(rng.pick(candidates), year, taken, rng) : undefined;
      if (extra) {
        all.push(extra);
        taken.add(extra.name);
        introduced.push(extra.id);
      }
    }
    // Never more than the maximum on sale: retire the oldest sellable models.
    while (mine().length > cfg.maxModels) {
      const oldest = mine()
        .filter((m) => m.tier !== 'unique' && m.introducedYear < year)
        .sort((a, b) => a.introducedYear - b.introducedYear || a.generation - b.generation)[0];
      if (!oldest) break;
      oldest.retiredYear = year;
      retired.push(oldest.id);
    }
    entry.nextRefreshYear = year + rng.int(cfg.intervalMinYears, cfg.intervalMaxYears);
  }
  return { models: all, refresh: nextRefresh, introduced, retired };
}
