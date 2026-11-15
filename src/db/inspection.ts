// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { scoutingBalance } from '../sim/worldgen/data';
import { readCareer } from './career';
import { all } from './entries';
import { isForSale } from './knowledge';

/** What a paid inspection of a car for sale costs. */
export const inspectionFee = (): number => scoutingBalance.inspection.fee;

/**
 * Pays to inspect a car for sale. It takes the car to exact for this garage for as long as the
 * seller still owns it. A car the garage owns, a car not for sale and one already inspected are
 * refused. Returns the fee.
 */
export function inspectCar(db: Database, garageId: number, carId: number): number {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const car = all(db, 'SELECT garage_id FROM car WHERE id = ?', [carId])[0];
  if (!car) throw new Error(`There is no car ${carId}.`);
  const seller = car.garage_id as number;
  if (seller === garageId) throw new Error('The garage owns this car, so it is already exact.');
  if (!isForSale(db, carId)) throw new Error('Only a car for sale can be inspected.');
  const done = all(
    db,
    `SELECT 1 FROM car_inspection WHERE garage_id = ? AND car_id = ? AND seller_garage_id = ?`,
    [garageId, carId, seller],
  )[0];
  if (done) throw new Error('This car has already been inspected.');
  const fee = inspectionFee();
  const cash = Number(all(db, 'SELECT cash FROM garage WHERE id = ?', [garageId])[0]!.cash);
  if (cash < fee) throw new Error('The garage cannot afford the inspection.');
  db.exec('BEGIN');
  try {
    db.run(
      `INSERT INTO car_inspection (garage_id, car_id, seller_garage_id, inspected_on, fee)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (garage_id, car_id) DO UPDATE SET seller_garage_id = excluded.seller_garage_id,
         inspected_on = excluded.inspected_on, fee = excluded.fee`,
      [garageId, carId, seller, career.gameDate, fee],
    );
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, 'inspection', ?, 'Car inspection')",
      [garageId, career.gameDate, -fee],
    );
    db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [fee, garageId]);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return fee;
}
