// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { all } from './entries';

/**
 * Where a driver, car or garage stands in the Registry, by the highest thing it has done:
 * a series champion, a race winner who never won a title, still active, retired after scoring, or
 * obscure (retired, or folded, without ever scoring a point). Obscure ones are greylinked: their
 * profiles can still be opened, but they are listed apart and their links are grey.
 */
export type RegistryStatus = 'champion' | 'winner' | 'active' | 'retired' | 'obscure';

export const STATUS_ORDER: readonly RegistryStatus[] = [
  'champion',
  'winner',
  'active',
  'retired',
  'obscure',
];

export type Subject = 'driver' | 'car' | 'garage';

export interface StatusMaps {
  driver: Map<number, RegistryStatus>;
  car: Map<number, RegistryStatus>;
  garage: Map<number, RegistryStatus>;
}

const ids = (db: Database, sql: string): Set<number> =>
  new Set(all(db, sql).map((r) => Number(r.id)));

/** The status of every driver, car and garage in the save. */
export function registryStatuses(db: Database): StatusMaps {
  const champions = {
    driver: ids(
      db,
      'SELECT champion_driver_id AS id FROM season WHERE champion_driver_id IS NOT NULL',
    ),
    garage: ids(
      db,
      'SELECT champion_garage_id AS id FROM season WHERE champion_garage_id IS NOT NULL',
    ),
    // The car the drivers' champion drove in their title season.
    car: ids(
      db,
      `SELECT e.car_id AS id FROM season s JOIN entry e ON e.season_id = s.id AND e.driver_id = s.champion_driver_id AND e.series = 'main'
        WHERE s.champion_driver_id IS NOT NULL`,
    ),
  };
  const winners = {
    driver: ids(
      db,
      'SELECT DISTINCT e.driver_id AS id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.final_pos = 1',
    ),
    car: ids(
      db,
      'SELECT DISTINCT e.car_id AS id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.final_pos = 1',
    ),
    garage: ids(
      db,
      'SELECT DISTINCT e.garage_id AS id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.final_pos = 1',
    ),
  };
  const scored = {
    driver: ids(
      db,
      'SELECT DISTINCT e.driver_id AS id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.points > 0',
    ),
    car: ids(
      db,
      'SELECT DISTINCT e.car_id AS id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.points > 0',
    ),
    garage: ids(
      db,
      'SELECT DISTINCT e.garage_id AS id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.points > 0',
    ),
  };
  const gone = {
    driver: ids(db, 'SELECT id FROM driver WHERE retired_year IS NOT NULL'),
    car: ids(db, 'SELECT id FROM car WHERE retired_year IS NOT NULL'),
    garage: ids(db, "SELECT id FROM garage WHERE kind = 'racing' AND closed_year IS NOT NULL"),
  };
  const all_ = {
    driver: ids(db, 'SELECT id FROM driver'),
    car: ids(db, 'SELECT id FROM car'),
    garage: ids(db, "SELECT id FROM garage WHERE kind = 'racing'"),
  };
  const build = (s: Subject): Map<number, RegistryStatus> => {
    const out = new Map<number, RegistryStatus>();
    for (const id of all_[s]) {
      let status: RegistryStatus;
      if (champions[s].has(id)) status = 'champion';
      else if (winners[s].has(id)) status = 'winner';
      else if (!gone[s].has(id)) status = 'active';
      else status = scored[s].has(id) ? 'retired' : 'obscure';
      out.set(id, status);
    }
    return out;
  };
  return { driver: build('driver'), car: build('car'), garage: build('garage') };
}

/** The keys (`driver:12`, `car:7`, `garage:3`) of everything that is greylinked. */
export function greylinkedKeys(db: Database): Set<string> {
  const maps = registryStatuses(db);
  const keys = new Set<string>();
  for (const s of ['driver', 'car', 'garage'] as const)
    for (const [id, status] of maps[s]) if (status === 'obscure') keys.add(`${s}:${id}`);
  return keys;
}
