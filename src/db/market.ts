// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { carValue, newCarPrice } from '../sim/economy';
import { readCareer } from './career';
import { all } from './entries';

export interface Purchase {
  carId: number;
  chassisNo: string;
  modelName: string;
  price: number;
}

const yearOf = (db: Database): number => {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  return Number(career.gameDate.slice(0, 4));
};

/** Whether a model is on sale new in a given year. One-off cars (tier `unique`) never are. */
export function isOnSale(
  model: { tier: string; introduced_year: number; retired_year: number | null },
  year: number,
): boolean {
  if (model.tier === 'unique') return false;
  return (
    model.introduced_year <= year && (model.retired_year === null || model.retired_year > year)
  );
}

/** The models a dealer can sell new now, cheapest first. */
export function modelsOnSale(
  db: Database,
): { id: number; name: string; tier: string; priceNew: number }[] {
  const year = yearOf(db);
  return all(
    db,
    'SELECT id, name, tier, price_new, introduced_year, retired_year FROM car_model ORDER BY price_new, id',
  )
    .filter((m) => isOnSale(m as never, year))
    .map((m) => ({
      id: m.id as number,
      name: m.name as string,
      tier: m.tier as string,
      priceNew: m.price_new as number,
    }));
}

/**
 * Buys a new car from a dealer: a new chassis with no kilometres, owned by the garage,
 * paid for from its cash. `discount` (0 to 1) is what negotiation won off the list price.
 */
export function buyNewCar(db: Database, garageId: number, modelId: number, discount = 0): Purchase {
  const year = yearOf(db);
  const date = readCareer(db)!.gameDate;
  const garage = all(db, 'SELECT id, cash FROM garage WHERE id = ?', [garageId])[0];
  if (!garage) throw new Error(`There is no garage ${garageId}.`);
  const model = all(
    db,
    `SELECT m.id, m.name, m.tier, m.base_kerb_kg, m.max_tyre_mm, m.price_new, m.introduced_year, m.retired_year,
            f.home_country
       FROM car_model m JOIN manufacturer f ON f.id = m.manufacturer_id WHERE m.id = ?`,
    [modelId],
  )[0];
  if (!model) throw new Error(`There is no car model ${modelId}.`);
  if (!isOnSale(model as never, year))
    throw new Error(`${model.name as string} is not on sale new.`);
  const price = newCarPrice(model.price_new as number, discount);
  if ((garage.cash as number) < price) throw new Error('The garage cannot afford this car.');

  db.exec('BEGIN');
  try {
    const next = Number(all(db, 'SELECT COALESCE(MAX(id), 0) + 1 AS n FROM car')[0]!.n);
    const prefix = String(model.name).split(' ')[0]!.slice(0, 3).toUpperCase();
    const chassisNo = `LC-${prefix}-${String(next).padStart(5, '0')}`;
    db.run(
      `INSERT INTO car (id, car_model_id, chassis_no, flag, fans, garage_id, model_year, road_km, race_km, wear, kerb_kg_current, tyre_width_mm)
       VALUES (?, ?, ?, ?, 0, ?, ?, 0, 0, 0, ?, ?)`,
      [
        next,
        modelId,
        chassisNo,
        model.home_country as string,
        garageId,
        year,
        model.base_kerb_kg as number,
        model.max_tyre_mm as number,
      ],
    );
    db.run(
      "INSERT INTO car_ownership (car_id, garage_id, from_date, price, route) VALUES (?, ?, ?, ?, 'new')",
      [next, garageId, date, price],
    );
    db.run(
      'INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, ?, ?, ?)',
      [garageId, date, 'car_purchase', -price, `${model.name as string} ${chassisNo}`],
    );
    db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [price, garageId]);
    db.exec('COMMIT');
    return { carId: next, chassisNo, modelName: model.name as string, price };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** The current value of a chassis: base x wear factor x provenance factor. */
export function valueOfCar(db: Database, carId: number): number {
  const year = yearOf(db);
  const car = all(
    db,
    `SELECT c.model_year, c.wear, c.fans, m.price_new
       FROM car c JOIN car_model m ON m.id = c.car_model_id WHERE c.id = ?`,
    [carId],
  )[0];
  if (!car) throw new Error(`There is no car ${carId}.`);
  const wins = Number(
    all(
      db,
      `SELECT COUNT(*) AS n FROM result r JOIN entry e ON e.id = r.entry_id
        WHERE e.car_id = ? AND r.final_pos = 1`,
      [carId],
    )[0]!.n,
  );
  return carValue({
    priceNew: car.price_new as number,
    modelYear: car.model_year as number,
    currentYear: year,
    wear: car.wear as number,
    wins,
    championships: 0,
    fans: car.fans as number,
  });
}
