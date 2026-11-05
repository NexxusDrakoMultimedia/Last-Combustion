// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { fairSalary, overallRating } from '../sim/worldgen/rating';
import { ROAD_TYPES, type RoadType } from '../sim/worldgen/types';
import { readCareer } from './career';
import { all } from './entries';

export interface FreeAgent {
  driverId: number;
  name: string;
  age: number;
  identity: string;
  rating: number;
  /** A hint at a fair yearly salary, not the driver's lowest price. */
  fairValue: number;
  pace: number;
  consistency: number;
  racecraft: number;
  tyreManagement: number;
  composure: number;
  wetSkill: number;
  /** Whether this garage already has the driver under contract. */
  signed: boolean;
}

/**
 * Drivers who are not entered with any garage this season and have not retired, best first.
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
      return {
        driverId: d.id as number,
        name: d.name as string,
        age: year - Number(String(d.birth_date).slice(0, 4)),
        identity: d.identity as string,
        rating: Math.round(rating),
        fairValue: Math.round(fairSalary(rating, d.gold_border_year !== null)),
        pace: d.pace as number,
        consistency: d.consistency as number,
        racecraft: d.racecraft as number,
        tyreManagement: d.tyre_management as number,
        composure: d.composure as number,
        wetSkill: d.wet_skill as number,
        signed: d.signed === 1,
      };
    })
    .sort((x, y) => y.rating - x.rating || x.driverId - y.driverId)
    .slice(0, limit);
}
