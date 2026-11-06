// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { addDays } from './worldgen/calendar';
import { dailyBalance } from './worldgen/data';
import { ROAD_TYPES, type RoadType } from './worldgen/types';

const cfg = () => dailyBalance as typeof dailyBalance & { areaFactor: Record<string, number> };

/** Whole days from one ISO date to a later one. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The days a round's settlement counts as daily life: the non-event days before it. For round 1 that
 * is the lead-in to the season, and for any other round the days between the last round's final and
 * this round's first practice day (a three-week gap on the calendar). Weather delays that push a
 * final back shorten the gap.
 */
export function daysBefore(
  round: number,
  practiceStart: string,
  previousFinal: string | null,
): number {
  if (round <= 1 || previousFinal === null) return cfg().leadInDays;
  return Math.max(0, daysBetween(addDays(previousFinal, 0), practiceStart) - 1);
}

/** The local-area factor for delivery work in a region (a state code such as `Vic`), 1 where the region is not listed. */
export function areaFactor(region: string): number {
  return cfg().areaFactor[region] ?? cfg().defaultAreaFactor;
}

/** What a car earns from delivery driving over some days: $250 a day times the local-area factor. */
export function deliveryIncome(days: number, region: string): number {
  return Math.round(days * cfg().deliveryPerDay * areaFactor(region));
}

/** The kilometres a car covers on everyday and delivery roads over some days. */
export function dailyKm(days: number): number {
  return days * cfg().dailyKm;
}

/** The affinity points a driver gains for the road type around their home from some days of driving it. */
export function affinityGain(days: number): number {
  return days * cfg().affinityPerDay;
}

/** How high daily driving alone can raise a road affinity. */
export function affinityCap(): number {
  return cfg().affinityCap;
}

/** The cost of moving a driver's home. */
export function relocationCost(): number {
  return cfg().relocationCost;
}

/**
 * The kind of road around a place: its own `roadType` if the data gives one, otherwise picked by
 * a fixed sum of the characters of its id, so it is always the same for the same place.
 */
export function roadTypeOfPlace(place: { id: string; roadType?: RoadType }): RoadType {
  if (place.roadType) return place.roadType;
  let sum = 0;
  for (const ch of place.id) sum = (sum * 31 + ch.charCodeAt(0)) % 9973;
  return ROAD_TYPES[sum % ROAD_TYPES.length]!;
}
