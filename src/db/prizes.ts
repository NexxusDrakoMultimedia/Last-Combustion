// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { fairPrizeShare } from '../sim/negotiation';
import { all } from './entries';

/** The share of a driver's prize money a garage keeps under the driver's contract that year. */
export function garagePrizeShare(
  db: Database,
  garageId: number,
  driverId: number,
  year: number,
): number {
  const contract = all(
    db,
    `SELECT garage_prize_share FROM contract
      WHERE driver_id = ? AND garage_id = ? AND start_year <= ? AND end_year >= ?
      ORDER BY id DESC LIMIT 1`,
    [driverId, garageId, year, year],
  )[0];
  return contract ? (contract.garage_prize_share as number) : fairPrizeShare();
}

/**
 * Splits a driver's prize money between the garage (its contracted share, rounded) and the
 * driver, whose part is kept as personal earnings. Returns what each side gets.
 */
export function splitPrize(
  db: Database,
  garageId: number,
  driverId: number,
  year: number,
  amount: number,
): { garage: number; driver: number } {
  const garage = Math.round(amount * garagePrizeShare(db, garageId, driverId, year));
  const driver = amount - garage;
  if (driver > 0)
    db.run('UPDATE driver SET earnings = earnings + ? WHERE id = ?', [driver, driverId]);
  return { garage, driver };
}
