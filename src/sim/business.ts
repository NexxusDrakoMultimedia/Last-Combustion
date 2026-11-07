// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from './rng';
import { BUILT_ROLES, executiveOffers, executiveSlots, type ExecutiveRole } from './executives';
import {
  FACILITY_KINDS,
  MAX_FACILITY_LEVEL,
  facilityDef,
  runningCost,
  type FacilityKind,
  type FacilityLevels,
} from './facilities';
import { SUPPLIERS, canDealWith, type Supplier } from './supply';
import { equityData, executiveData } from './worldgen/data';

const cfg = () => equityData.business;

/** The executive roles a computer garage of some prestige still has to fill, in the order it fills them. */
export function vacantRoles(prestige: number, filled: readonly ExecutiveRole[]): ExecutiveRole[] {
  const free = BUILT_ROLES.filter((r) => !filled.includes(r));
  return free.slice(0, Math.max(0, executiveSlots(prestige) - filled.length));
}

export interface DrawnExecutive {
  role: ExecutiveRole;
  name: string;
  skill: number;
  salary: number;
  age: number;
  /** How many years the contract runs from the year it starts. */
  years: number;
}

/** An executive for one role: one of the usual three on offer, at their asking salary. */
export function drawExecutive(rng: RandomStream, role: ExecutiveRole): DrawnExecutive {
  const offer = rng.pick(executiveOffers(rng, role));
  const [lo, hi] = executiveData.contractYears as [number, number];
  return { ...offer, years: rng.int(lo, hi) };
}

/** How many facility levels a computer garage of some prestige holds. */
export const facilityLevelsFor = (prestige: number): number =>
  Math.floor(Math.max(0, prestige) / cfg().prestigePerLevel);

/** The facility a computer garage builds or upgrades next, or null when it has all its prestige allows. */
export function nextFacility(
  rng: RandomStream,
  prestige: number,
  held: FacilityLevels,
): FacilityKind | null {
  const total = FACILITY_KINDS.reduce((s, k) => s + (held[k] ?? 0), 0);
  if (total >= facilityLevelsFor(prestige)) return null;
  const options = FACILITY_KINDS.filter((k) => {
    const needs = facilityDef(k).needs;
    return (held[k] ?? 0) < MAX_FACILITY_LEVEL && (needs === null || (held[needs] ?? 0) > 0);
  });
  return options.length === 0 ? null : rng.pick(options);
}

/** Its electricity supplier: any that a garage of this prestige and home can deal with, the same each year it keeps it. */
export function drawSupplier(
  rng: RandomStream,
  prestige: number,
  homeState: string,
): Supplier | null {
  const options = SUPPLIERS.filter(
    (s) => s.category === 'electricity' && canDealWith(s, prestige, homeState),
  );
  return options.length === 0 ? null : rng.pick(options);
}

/** A sponsor for a garage of some prestige: one of the three strongest that will have it. */
export function drawSponsor<T extends { minPrestige: number; strength: number; id: number }>(
  rng: RandomStream,
  prestige: number,
  sponsors: readonly T[],
): T | null {
  const options = sponsors
    .filter((s) => s.minPrestige <= prestige)
    .sort((a, b) => b.strength - a.strength || a.id - b.id)
    .slice(0, 3);
  return options.length === 0 ? null : rng.pick(options);
}

/** What the executives and facilities of a computer garage cost to run for a year. */
export function yearlyUpkeep(
  salaries: readonly number[],
  facilities: FacilityLevels,
): { salaries: number; facilities: number } {
  return {
    salaries: salaries.reduce((s, x) => s + x, 0),
    facilities:
      FACILITY_KINDS.reduce((s, k) => s + runningCost(k, facilities[k] ?? 0), 0) *
      cfg().roundsPerYear,
  };
}

/** What a computer garage pays its holders for a year: a share of its profit, never below its minimum cash. */
export function businessDividend(profit: number, cash: number): number {
  return Math.max(
    0,
    Math.min(Math.round(profit * cfg().dividendShare), cash - cfg().dividendMinCash),
  );
}
