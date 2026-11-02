// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { wearBalance } from './worldgen/data';
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
