// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import gearJson from '../../data/gear.json';
import { ROAD_TYPES, type Driver, type RoadType } from './worldgen/types';

export type GearSlot = 'helmet' | 'suit' | 'gloves' | 'boots' | 'trinket';
export type GearTier = 'basic' | 'club' | 'pro' | 'elite' | 'legendary';
export type GearStat =
  | 'pace'
  | 'consistency'
  | 'racecraft'
  | 'tyreManagement'
  | 'composure'
  | 'wetSkill'
  | 'affinityForest'
  | 'affinityCoast'
  | 'affinityMountain'
  | 'affinityNight';

export interface GearItem {
  id: string;
  name: string;
  slot: GearSlot;
  tier: GearTier;
  supplierId: string | null;
  /** 0 means the item is not sold: it is earned, won or found at auction. */
  price: number;
  stats: Partial<Record<GearStat, number>>;
}

export interface GearSupplier {
  id: string;
  name: string;
  homeCountry: string;
}

export const gearItems = gearJson.items as GearItem[];
export const gearSuppliers = gearJson.suppliers as GearSupplier[];
const setBonuses = gearJson.setBonuses as Record<string, Partial<Record<GearStat, number>>>;
/** Gear never raises one attribute by more than this in total. */
export const STAT_CAP = gearJson.statCap;
export const gearBudgets = gearJson.budgets as Record<GearTier, [number, number]>;

export const SLOT_LIMITS: Record<GearSlot, number> = {
  helmet: 1,
  suit: 1,
  gloves: 1,
  boots: 1,
  trinket: 2,
};

const byId = new Map(gearItems.map((item) => [item.id, item]));
export const gearItem = (id: string): GearItem => {
  const item = byId.get(id);
  if (!item) throw new Error(`Unknown gear item "${id}"`);
  return item;
};

/** Checks a loadout against the slot limits. Returns a list of problems (empty if it is fine). */
export function validateLoadout(ids: readonly string[]): string[] {
  const problems: string[] = [];
  const counts = new Map<GearSlot, number>();
  const seen = new Set<string>();
  for (const id of ids) {
    const item = byId.get(id);
    if (!item) {
      problems.push(`Unknown item "${id}"`);
      continue;
    }
    if (seen.has(id)) problems.push(`"${item.name}" is worn twice`);
    seen.add(id);
    counts.set(item.slot, (counts.get(item.slot) ?? 0) + 1);
  }
  for (const [slot, n] of counts) {
    if (n > SLOT_LIMITS[slot])
      problems.push(`Too many items in the ${slot} slot (${n} of ${SLOT_LIMITS[slot]})`);
  }
  return problems;
}

/**
 * The total attribute boost from a loadout: each item's stats, plus a set bonus when several
 * pieces come from the same supplier, with every attribute capped at +STAT_CAP.
 */
export function loadoutBonuses(items: readonly GearItem[]): Partial<Record<GearStat, number>> {
  const total: Partial<Record<GearStat, number>> = {};
  const add = (stats: Partial<Record<GearStat, number>>) => {
    for (const [stat, value] of Object.entries(stats) as [GearStat, number][]) {
      total[stat] = (total[stat] ?? 0) + value;
    }
  };
  for (const item of items) add(item.stats);

  const perSupplier = new Map<string, number>();
  for (const item of items) {
    if (item.supplierId)
      perSupplier.set(item.supplierId, (perSupplier.get(item.supplierId) ?? 0) + 1);
  }
  const best = Math.max(0, ...perSupplier.values());
  const set = setBonuses[String(Math.min(best, 4))];
  if (set && best >= 2) add(set);

  for (const stat of Object.keys(total) as GearStat[]) {
    total[stat] = Math.min(STAT_CAP, total[stat] as number);
  }
  return total;
}

const clamp99 = (value: number): number => Math.max(1, Math.min(99, value));

/** A copy of a driver with the gear's boosts applied. The driver's own record is untouched. */
export function applyGear(driver: Driver, items: readonly GearItem[]): Driver {
  const bonus = loadoutBonuses(items);
  const affinities = { ...driver.affinities };
  for (const type of ROAD_TYPES) {
    const key = `affinity${type[0]!.toUpperCase()}${type.slice(1)}` as GearStat;
    affinities[type as RoadType] = clamp99(affinities[type as RoadType] + (bonus[key] ?? 0));
  }
  return {
    ...driver,
    pace: clamp99(driver.pace + (bonus.pace ?? 0)),
    consistency: clamp99(driver.consistency + (bonus.consistency ?? 0)),
    racecraft: clamp99(driver.racecraft + (bonus.racecraft ?? 0)),
    tyreManagement: clamp99(driver.tyreManagement + (bonus.tyreManagement ?? 0)),
    composure: clamp99(driver.composure + (bonus.composure ?? 0)),
    wetSkill: clamp99(driver.wetSkill + (bonus.wetSkill ?? 0)),
    affinities,
  };
}
