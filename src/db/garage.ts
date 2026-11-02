// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { all } from './entries';
import { valueOfCar } from './market';

export interface OwnedCar {
  carId: number;
  modelName: string;
  modelYear: number;
  roadKm: number;
  wear: number;
  value: number;
  /** The race number of the entry that uses this car this season, or null if it sits in the garage. */
  inEntry: number | null;
}

/** The cars a garage owns, with the entry each one is racing in this season. */
export function ownedCars(db: Database, garageId: number): OwnedCar[] {
  return all(
    db,
    `SELECT c.id, c.model_year, c.road_km, c.wear, m.name,
            (SELECT e.race_number FROM entry e
              WHERE e.car_id = c.id AND e.series = 'main'
                AND e.season_id = (SELECT MAX(id) FROM season)) AS race_number
       FROM car c JOIN car_model m ON m.id = c.car_model_id
      WHERE c.garage_id = ? ORDER BY c.id`,
    [garageId],
  ).map((r) => ({
    carId: r.id as number,
    modelName: r.name as string,
    modelYear: r.model_year as number,
    roadKm: r.road_km as number,
    wear: Math.round((r.wear as number) * 10) / 10,
    value: valueOfCar(db, r.id as number),
    inEntry: (r.race_number as number | null) ?? null,
  }));
}

/**
 * Puts a car the garage owns into one of its entries for this season. A car can only run in one
 * entry, and the entry must not have started the season (no round complete), so results stay with the
 * car that scored them. `raceNumber` picks the entry; the old car stays in the garage.
 */
export function setEntryCar(
  db: Database,
  garageId: number,
  raceNumber: number,
  carId: number,
): void {
  const car = all(db, 'SELECT garage_id FROM car WHERE id = ?', [carId])[0];
  if (!car || car.garage_id !== garageId) throw new Error('That car is not in this garage.');
  const season = all(db, 'SELECT id FROM season ORDER BY year DESC LIMIT 1')[0];
  if (!season) throw new Error('There is no season in this database.');
  const entry = all(
    db,
    "SELECT id, car_id FROM entry WHERE season_id = ? AND series = 'main' AND garage_id = ? AND race_number = ?",
    [season.id as number, garageId, raceNumber],
  )[0];
  if (!entry) throw new Error('That garage has no such entry.');
  if (entry.car_id === carId) return;
  if (
    all(db, "SELECT 1 FROM entry WHERE season_id = ? AND series = 'main' AND car_id = ?", [
      season.id as number,
      carId,
    ])[0]
  )
    throw new Error('That car is already racing in another entry.');
  if (
    all(db, "SELECT 1 FROM round WHERE season_id = ? AND status <> 'scheduled'", [
      season.id as number,
    ])[0]
  )
    throw new Error('The cars cannot be changed once the season has started.');
  db.run('UPDATE entry SET car_id = ? WHERE id = ?', [carId, entry.id as number]);
}
