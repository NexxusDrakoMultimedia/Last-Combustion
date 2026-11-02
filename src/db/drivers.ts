// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { ROAD_TYPES, type Driver } from '../sim/worldgen/types';
import { all } from './entries';

/** Stable place ids (as world generation names them) to database ids. */
export function placeIdMap(db: Database): Map<string, number> {
  return new Map(
    all(db, 'SELECT id, stable_id FROM place').map((p) => [p.stable_id as string, p.id as number]),
  );
}

/** Adds a newly made driver (a rookie or a prospect) to the database, with no entry or contract. */
export function insertDriver(db: Database, driver: Driver, placeIds: Map<string, number>): void {
  db.run(
    `INSERT INTO driver (id, name, gender, birth_date, nationality, flag, hometown_place_id, residence_place_id,
                         pace, consistency, racecraft, tyre_management, composure, wet_skill, potential,
                         home_road_type, fans, fame, reputation, gold_border_year, nickname, identity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, NULL, NULL, ?)`,
    [
      driver.id,
      driver.name,
      driver.gender,
      driver.birthDate,
      driver.nationality,
      driver.flag,
      placeIds.get(driver.hometownPlaceId)!,
      placeIds.get(driver.residencePlaceId)!,
      driver.pace,
      driver.consistency,
      driver.racecraft,
      driver.tyreManagement,
      driver.composure,
      driver.wetSkill,
      driver.potential,
      driver.homeRoadType,
      driver.identity,
    ],
  );
  for (const type of ROAD_TYPES)
    db.run('INSERT INTO driver_road_affinity (driver_id, road_type, rating) VALUES (?, ?, ?)', [
      driver.id,
      type,
      driver.affinities[type],
    ]);
}
