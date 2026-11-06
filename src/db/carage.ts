// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { balance } from '../sim/worldgen/data';
import { all } from './entries';
import { ensureMarketGarage } from './market';

/** The oldest a car of a tier may be before it retires (the same ages world generation draws from). */
const maxAge = balance.cars.maxAgeYears as Record<string, number>;

export interface RetiredCar {
  carId: number;
  /** The garage that had it when it retired. */
  garageId: number;
}

/**
 * Retires the cars that are older than their tier's oldest age and never scored a point. A retired
 * car moves to the market garage without a listing, so no garage can enter, sell or service it, and
 * it keeps its profile in the Registry (where it is greylinked). Cars that scored a point once never
 * retire this way, and neither do unique cars, a starter offer's cars or a car in an open auction.
 * `year` is the season about to start.
 */
export function retireOldCars(db: Database, year: number): RetiredCar[] {
  const market = ensureMarketGarage(db);
  const retired: RetiredCar[] = [];
  const candidates = all(
    db,
    `SELECT c.id, c.garage_id, c.model_year, m.tier FROM car c JOIN car_model m ON m.id = c.car_model_id
      WHERE c.retired_year IS NULL AND m.tier <> 'unique'
        AND c.id NOT IN (SELECT subject_id FROM starter_offer WHERE kind = 'car')
        AND c.id NOT IN (SELECT car_id FROM auction_lot WHERE status = 'open')
        AND NOT EXISTS (SELECT 1 FROM result r JOIN entry e ON e.id = r.entry_id WHERE e.car_id = c.id AND r.points > 0)
      ORDER BY c.id`,
  );
  const date = `${year}-02-01`;
  for (const c of candidates) {
    const limit = maxAge[c.tier as string];
    if (limit === undefined || year - (c.model_year as number) <= limit) continue;
    const carId = c.id as number;
    db.run("UPDATE market_listing SET status = 'withdrawn' WHERE car_id = ? AND status = 'open'", [
      carId,
    ]);
    db.run('UPDATE car_ownership SET to_date = ? WHERE car_id = ? AND to_date IS NULL', [
      date,
      carId,
    ]);
    db.run('UPDATE car SET garage_id = ?, retired_year = ? WHERE id = ?', [
      market,
      year - 1,
      carId,
    ]);
    retired.push({ carId, garageId: c.garage_id as number });
  }
  return retired;
}
