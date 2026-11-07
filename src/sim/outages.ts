// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { createRng } from './rng';
import { supplyData } from './worldgen/data';

/** The supplied categories whose failure the game plays out (see the GDD, "Garage operations"). */
export const OUTAGE_CATEGORIES = ['electricity', 'race_fuel', 'logistics'] as const;
export type OutageCategory = (typeof OUTAGE_CATEGORIES)[number];

export const outageData = supplyData.outages;

/** What an outage does to a garage for the round it lasts. */
export const OUTAGE_EFFECTS = {
  /** The share of the crew's cover that is lost (the crew idles). */
  crewCoverLoss: outageData.electricity.crewCoverLoss,
  /** The share of the practice laps that are still run. */
  lapShare: outageData.race_fuel.lapShare,
  /** The practice days lost while the cars wait for transport. */
  daysLost: outageData.logistics.daysLost,
};

/** The chance that a supplier of this reliability fails in a round. */
export const outageChance = (reliability: number): number =>
  Math.min(1, Math.max(0, (1 - reliability) * outageData.chanceScale));

/** Whether the supply failed at the start of a round, and (if it did) whether it runs on into the next. */
function outageStart(
  seed: string,
  garageId: number,
  category: OutageCategory,
  year: number,
  round: number,
  reliability: number,
  shorten: number,
): { starts: boolean; runsOn: boolean } {
  const stream = createRng(seed).stream(`outage:${garageId}:${category}:${year}:R${round}`);
  // Both numbers are always drawn, so the same seed gives the same luck whatever the supplier.
  const start = stream.float(0, 1);
  const extend = stream.float(0, 1);
  return {
    starts: start < outageChance(reliability),
    runsOn: extend < outageData.extendChance * (1 - Math.min(1, Math.max(0, shorten))),
  };
}

/**
 * Whether a garage's supply of a category is down in a round. An outage starts by chance from the
 * career's seed, from the supplier's reliability, and may run into the next round; an Operations
 * Director (`shorten`, a share from 0 to 1) makes it less likely to run on.
 */
export function outageActive(
  seed: string,
  garageId: number,
  category: OutageCategory,
  year: number,
  round: number,
  reliability: number,
  shorten = 0,
): boolean {
  if (outageStart(seed, garageId, category, year, round, reliability, shorten).starts) return true;
  if (round <= 1) return false;
  const before = outageStart(seed, garageId, category, year, round - 1, reliability, shorten);
  return before.starts && before.runsOn;
}
