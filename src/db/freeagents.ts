// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { bandRange, readingMidpoint, type Reading } from '../sim/scouting';
import { fairSalary, overallRating } from '../sim/worldgen/rating';
import { ROAD_TYPES, type RoadType } from '../sim/worldgen/types';
import { readCareer } from './career';
import { all } from './entries';
import { knowledgeContext, readDriver, type DriverReading } from './knowledge';

export interface FreeAgent {
  driverId: number;
  name: string;
  age: number;
  identity: string;
  /** What the player knows of the driver: a word, a range or the exact value for each number. */
  reading: DriverReading;
  /**
   * A hint at a fair yearly salary, not the driver's lowest price: a range that follows the rating's
   * range (a wide one while only a word is known), exact for a driver the player owns.
   */
  fairSalary: SalaryHint;
  /** Whether this garage already has the driver under contract. */
  signed: boolean;
}

/** A fair salary as a low and a high (the same when the rating is exact). */
export interface SalaryHint {
  low: number;
  high: number;
}

/** The salary hint that goes with a reading of the overall rating. */
export function salaryHint(rating: Reading, gold: boolean): SalaryHint {
  // A word covers a band of ratings, so even then the hint is a range (never a blank "unknown"), as a deal's is.
  const [lo, hi] =
    rating.kind === 'word'
      ? [bandRange(rating.band).low, bandRange(rating.band).high]
      : rating.kind === 'exact'
        ? [rating.value, rating.value]
        : [rating.low, rating.high];
  return {
    low: Math.round(fairSalary(lo, gold)),
    high: Math.round(fairSalary(hi, gold)),
  };
}

/** What the free agents list can be ordered by: the rating, the potential or the affinity for one road type. */
export type AgentSort = 'rating' | 'potential' | RoadType;

/**
 * The free agents ordered by what the player reads, best first: by the midpoint of the chosen reading
 * (a word counts as the middle of its band), never the true number, so the order gives nothing away.
 * Drivers already signed stay first, as they do in the list itself.
 */
export function sortAgents(agents: FreeAgent[], by: AgentSort): FreeAgent[] {
  const key = (a: FreeAgent): number =>
    readingMidpoint(
      by === 'rating'
        ? a.reading.rating
        : by === 'potential'
          ? a.reading.potential
          : a.reading.affinities[by],
    );
  return [...agents].sort(
    (x, y) => Number(y.signed) - Number(x.signed) || key(y) - key(x) || x.driverId - y.driverId,
  );
}

/**
 * Drivers who are not entered with any garage this season and have not retired, best first as the
 * player reads them: the order follows the midpoint of each reading, never the true rating, so it
 * does not give the truth away.
 * Drivers entered elsewhere cannot be signed until their season ends.
 */
export function freeAgents(db: Database, garageId: number, limit = 25): FreeAgent[] {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const year = Number(career.gameDate.slice(0, 4));
  const affinities = new Map<number, Record<RoadType, number>>();
  for (const a of all(db, 'SELECT driver_id, road_type, rating FROM driver_road_affinity')) {
    const entry = affinities.get(a.driver_id as number) ?? ({} as Record<RoadType, number>);
    entry[a.road_type as RoadType] = a.rating as number;
    affinities.set(a.driver_id as number, entry);
  }
  const rows = all(
    db,
    `SELECT d.*, EXISTS (SELECT 1 FROM contract c WHERE c.driver_id = d.id AND c.garage_id = ? AND c.end_year >= ?) AS signed
       FROM driver d
      WHERE d.retired_year IS NULL
        AND d.id NOT IN (SELECT driver_id FROM entry WHERE season_id = (SELECT MAX(id) FROM season))`,
    [garageId, year],
  );
  const ctx = knowledgeContext(db, garageId);
  const ranked = rows
    .map((d) => {
      const a = affinities.get(d.id as number) ?? ({} as Record<RoadType, number>);
      for (const type of ROAD_TYPES) a[type] ??= 0;
      const rating = overallRating({
        pace: d.pace as number,
        consistency: d.consistency as number,
        racecraft: d.racecraft as number,
        tyreManagement: d.tyre_management as number,
        composure: d.composure as number,
        wetSkill: d.wet_skill as number,
        affinities: a,
      });
      const reading = readDriver(ctx, {
        id: d.id as number,
        fame: d.fame as number,
        rating,
        pace: d.pace as number,
        consistency: d.consistency as number,
        racecraft: d.racecraft as number,
        tyreManagement: d.tyre_management as number,
        composure: d.composure as number,
        wetSkill: d.wet_skill as number,
        potential: d.potential as number,
        affinities: a,
      });
      return {
        driverId: d.id as number,
        name: d.name as string,
        age: year - Number(String(d.birth_date).slice(0, 4)),
        identity: d.identity as string,
        reading,
        fairSalary: salaryHint(reading.rating, d.gold_border_year !== null),
        signed: d.signed === 1,
      };
    })
    .sort(
      (x, y) =>
        readingMidpoint(y.reading.rating) - readingMidpoint(x.reading.rating) ||
        x.driverId - y.driverId,
    );
  // The drivers already signed always show, first, however low the player reads them: they are the ones to seat in
  // an entry, and one pushed off a list of the best 25 would be signed but impossible to find.
  return [...ranked.filter((a) => a.signed), ...ranked.filter((a) => !a.signed).slice(0, limit)];
}
