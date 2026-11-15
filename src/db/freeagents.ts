// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { readingMidpoint, type Reading } from '../sim/scouting';
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
   * range, exact for a driver the player owns, and none while only a word is known.
   */
  fairSalary: SalaryHint | null;
  /** Whether this garage already has the driver under contract. */
  signed: boolean;
}

/** A fair salary as a low and a high (the same when the rating is exact). */
export interface SalaryHint {
  low: number;
  high: number;
}

/** The salary hint that goes with a reading of the overall rating. */
export function salaryHint(rating: Reading, gold: boolean): SalaryHint | null {
  if (rating.kind === 'word') return null;
  const [lo, hi] =
    rating.kind === 'exact' ? [rating.value, rating.value] : [rating.low, rating.high];
  return {
    low: Math.round(fairSalary(lo, gold)),
    high: Math.round(fairSalary(hi, gold)),
  };
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
  return rows
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
    )
    .slice(0, limit);
}
