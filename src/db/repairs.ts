// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { wearAdded } from '../sim/wear';
import { part, partPrice } from '../sim/upgrades';
import { repairBalance } from '../sim/worldgen/data';
import type { Tier } from '../sim/worldgen/types';
import { readCareer } from './career';
import { dealPrice } from './deals';
import { all } from './entries';

/** Adds wear to every part fitted to a car for some distance driven (parts wear faster than the chassis). */
export function wearParts(
  db: Database,
  carId: number,
  km: number,
  kind: 'road' | 'race',
  tier: Tier,
): void {
  const delta = wearAdded(km, kind, tier) * repairBalance.partWearFactor;
  if (delta <= 0) return;
  db.run('UPDATE car_part SET wear = MIN(100, wear + ?) WHERE car_id = ?', [delta, carId]);
}

export interface PartCondition {
  category: string;
  name: string;
  wear: number;
}

/** The wear of each part fitted to a car. */
export function partConditions(db: Database, carId: number): PartCondition[] {
  return all(
    db,
    'SELECT cp.category, cp.wear, p.name FROM car_part cp JOIN part p ON p.id = cp.part_id WHERE cp.car_id = ? ORDER BY cp.id',
    [carId],
  ).map((r) => ({
    category: r.category as string,
    name: r.name as string,
    wear: r.wear as number,
  }));
}

function owned(db: Database, garageId: number, carId: number) {
  const car = all(
    db,
    `SELECT c.id, c.garage_id, c.wear, c.wear_offset, m.tier, m.price_new, g.kind
       FROM car c JOIN car_model m ON m.id = c.car_model_id JOIN garage g ON g.id = c.garage_id
      WHERE c.id = ?`,
    [carId],
  )[0];
  if (!car) throw new Error(`There is no car ${carId}.`);
  if (car.garage_id !== garageId) throw new Error('The garage does not own this car.');
  if (car.kind !== 'racing') throw new Error('A car that is for sale cannot be worked on.');
  return car;
}

function charge(
  db: Database,
  garageId: number,
  category: string,
  amount: number,
  note: string,
): number {
  const garage = all(db, 'SELECT cash FROM garage WHERE id = ?', [garageId])[0]!;
  if ((garage.cash as number) < amount) throw new Error('The garage cannot afford this work.');
  const date = readCareer(db)!.gameDate;
  db.run(
    'INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, ?, ?, ?)',
    [garageId, date, category, -amount, note],
  );
  db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [amount, garageId]);
  return amount;
}

/**
 * Services every fitted part, resetting its wear to zero. It costs a quarter of each part's
 * price (after any supplier deal) in proportion to how worn it is.
 */
export function serviceParts(db: Database, garageId: number, carId: number): number {
  const car = owned(db, garageId, carId);
  const fitted = all(
    db,
    'SELECT cp.id, cp.wear, p.stable_id, p.supplier_id FROM car_part cp JOIN part p ON p.id = cp.part_id WHERE cp.car_id = ?',
    [carId],
  );
  let cost = 0;
  for (const f of fitted) {
    const price = dealPrice(
      db,
      'supplier',
      garageId,
      f.supplier_id as number,
      partPrice(part(f.stable_id as string), car.tier as Tier),
    );
    cost += Math.round(repairBalance.servicingShare * price * ((f.wear as number) / 100));
  }
  db.exec('BEGIN');
  try {
    charge(db, garageId, 'servicing', cost, `Parts service, car ${carId}`);
    db.run('UPDATE car_part SET wear = 0 WHERE car_id = ?', [carId]);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return cost;
}

/**
 * Restores the chassis, taking all its wear away. It costs 12% of the new price in proportion to
 * the wear. The wear is recorded as an offset, so later kilometres wear the car from zero again.
 */
export function restoreChassis(db: Database, garageId: number, carId: number): number {
  const car = owned(db, garageId, carId);
  const wear = car.wear as number;
  const cost = Math.round(
    (car.price_new as number) * repairBalance.restorationShare * (wear / 100),
  );
  db.exec('BEGIN');
  try {
    charge(db, garageId, 'restoration', cost, `Restoration, car ${carId}`);
    db.run('UPDATE car SET wear = 0, wear_offset = wear_offset + ? WHERE id = ?', [wear, carId]);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return cost;
}

/** What crash damage costs to repair: 3% of the car's new price. */
export const crashRepairCost = (priceNew: number): number =>
  Math.round(priceNew * repairBalance.crashShare);
