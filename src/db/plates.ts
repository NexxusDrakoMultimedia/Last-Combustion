// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { makePlate, plateKey, plateStateOfRegion, randomPlateState } from '../sim/plates';
import { createRng } from '../sim/rng';
import { readCareer } from './career';
import { all } from './entries';

/**
 * Gives a car its Australian licence plate if it has none. The state comes from the base of the
 * garage that owns it (any state in Australia, or a state picked by how many cars each has for a
 * garage abroad or the used market), and the plate from the career's seed and the car's id, so
 * the same career always registers the same car with the same plate.
 */
export function registerCar(db: Database, carId: number): string {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const row = all(
    db,
    `SELECT c.plate, c.model_year, g.kind, g.home_state FROM car c JOIN garage g ON g.id = c.garage_id WHERE c.id = ?`,
    [carId],
  )[0];
  if (!row) throw new Error(`There is no car ${carId}.`);
  if (row.plate !== null) return row.plate as string;
  const rng = createRng(career.masterSeed).stream(`plate:${carId}`);
  const state =
    (row.kind === 'racing' ? plateStateOfRegion(row.home_state as string) : undefined) ??
    randomPlateState(rng);
  const used = new Set(
    all(db, 'SELECT plate, plate_state FROM car WHERE plate IS NOT NULL').map((r) =>
      plateKey(r.plate_state as string, r.plate as string),
    ),
  );
  const plate = makePlate(rng, state, used);
  db.run('UPDATE car SET plate = ?, plate_state = ? WHERE id = ?', [plate, state, carId]);
  return plate;
}

/** Registers every car that has no plate yet (cars in saves made before plates existed). */
export function registerAllCars(db: Database): number {
  if (!readCareer(db)) return 0;
  const missing = all(db, 'SELECT id FROM car WHERE plate IS NULL ORDER BY id');
  for (const c of missing) registerCar(db, c.id as number);
  return missing.length;
}
