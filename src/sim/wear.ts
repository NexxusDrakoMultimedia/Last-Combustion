// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { repairBalance, wearBalance } from './worldgen/data';
import type { Tier } from './worldgen/types';

const cfg = () => wearBalance as typeof wearBalance & { tierFactor: Record<Tier, number> };

/**
 * Chassis wear (0 = new, 100 = worn out) from the kilometres a car has covered.
 * Racing kilometres wear a car ten times as much as everyday and travel kilometres, and
 * faster, more expensive cars wear faster (see the GDD, "Wear and reliability").
 */
export function wearFromKm(roadKm: number, raceKm: number, tier: Tier): number {
  const { roadPerKm, racePerKm, tierFactor } = cfg();
  const wear = (roadKm * roadPerKm + raceKm * racePerKm) * tierFactor[tier];
  return Math.min(100, Math.round(wear * 100) / 100);
}

/** The wear added by some more driving. */
export function wearAdded(km: number, kind: 'road' | 'race', tier: Tier): number {
  const { roadPerKm, racePerKm, tierFactor } = cfg();
  return km * (kind === 'race' ? racePerKm : roadPerKm) * tierFactor[tier];
}

/** Parts above this wear start to fail. */
export const PART_FAILURE_FROM = (): number => cfg().partFailureFrom;

const restoration = () => repairBalance.restoration;

/**
 * The least wear a chassis can have after some full restorations: a step for each one, up to 60.
 * The step depends on the tier, the way the oldest age does: the shorter a tier's life, the more
 * each restoration costs the metal (Starter 5, Mid 6, Elite 8, Premium 10, Hyper 16). A restoration
 * takes most of the wear away, but the metal never quite comes back.
 */
export function restorationFloor(restorations: number, tier: Tier): number {
  const { floorStep, floorCap } = restoration();
  return Math.min(floorCap, floorStep[tier] * Math.max(0, restorations));
}

/**
 * Whether the least wear a chassis can have is past the point where it retires (over 50). A car
 * in that state retires at the next rollover, whether or not it ever scored.
 */
export function wornOutByRestoration(restorations: number, tier: Tier): boolean {
  return restorationFloor(restorations, tier) > restoration().retireAbove;
}

/** What a full restoration costs: the car's new price, and a quarter more for each restoration it has had. */
export function restorationCost(priceNew: number, restorations: number): number {
  return Math.round(priceNew * (1 + restoration().costStep * Math.max(0, restorations)));
}

/**
 * The wear a restoration leaves: the new floor, plus a tenth of whatever wear was above it. So a
 * badly worn car comes back almost to its floor, and the floor itself is what each restoration costs.
 */
export function restoredWear(wear: number, restorationsAfter: number, tier: Tier): number {
  const floor = restorationFloor(restorationsAfter, tier);
  return Math.round((floor + restoration().keepShare * Math.max(0, wear - floor)) * 100) / 100;
}

/**
 * A chassis's wear: from its kilometres less the wear its restorations took off, but never below
 * the floor its restorations have left.
 */
export function chassisWear(
  roadKm: number,
  raceKm: number,
  tier: Tier,
  wearOffset: number,
  restorations: number,
): number {
  return Math.max(
    restorationFloor(restorations, tier),
    wearFromKm(roadKm, raceKm, tier) - wearOffset,
    0,
  );
}
