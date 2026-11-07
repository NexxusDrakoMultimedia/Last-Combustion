// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { addDays } from './worldgen/calendar';
import { dailyBalance } from './worldgen/data';
import { ROAD_TYPES, type RoadType } from './worldgen/types';

const cfg = () => dailyBalance as typeof dailyBalance & { areaFactor: Record<string, number> };

export interface RoundSpan {
  practiceStart: string;
  finalDate: string;
}

/**
 * Whether a date is a day of daily life: a day of the running season (after it starts and before the
 * last final) on which no round is being held. The days of a round, from its first practice day to
 * its final, are race days; every other day the cars are on everyday and delivery roads.
 */
export function isDailyLifeDay(
  date: string,
  seasonStart: string,
  rounds: readonly RoundSpan[],
): boolean {
  if (rounds.length === 0 || date <= seasonStart) return false;
  const lastFinal = rounds.reduce((m, r) => (r.finalDate > m ? r.finalDate : m), '');
  if (date >= lastFinal) return false;
  return !rounds.some((r) => r.practiceStart <= date && date <= r.finalDate);
}

/** How many days of daily life there are after one date and before another (neither counted). */
export function dailyLifeDaysBetween(
  after: string,
  before: string,
  seasonStart: string,
  rounds: readonly RoundSpan[],
): number {
  let n = 0;
  for (let d = addDays(after, 1); d < before; d = addDays(d, 1))
    if (isDailyLifeDay(d, seasonStart, rounds)) n++;
  return n;
}

/** The local-area factor for delivery work in a region (a state code such as `Vic`), 1 where the region is not listed. */
export function areaFactor(region: string): number {
  return cfg().areaFactor[region] ?? cfg().defaultAreaFactor;
}

/** What a car earns from delivery driving over some days: $167 a day times the local-area factor. */
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
