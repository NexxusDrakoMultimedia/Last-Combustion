// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { gearItem, type GearSlot, type GearTier } from '../sim/gear';
import { partWearFactor } from '../sim/staff';
import { wearAdded } from '../sim/wear';
import { part, partPrice } from '../sim/upgrades';
import { repairBalance } from '../sim/worldgen/data';
import type { Tier } from '../sim/worldgen/types';
import { readCareer } from './career';
import { garageBonuses } from './bonuses';
import { partPriceFor } from './deals';
import { all } from './entries';
import { garageCrewStrength } from './staff';

/** Adds wear to every part fitted to a car for some distance driven (parts wear faster than the chassis). */
export function wearParts(
  db: Database,
  carId: number,
  km: number,
  kind: 'road' | 'race',
  tier: Tier,
): void {
  const owner = all(db, 'SELECT garage_id FROM car WHERE id = ?', [carId])[0];
  // A good crew looks after the parts: they wear more slowly.
  const crew = owner
    ? partWearFactor(garageCrewStrength(db, owner.garage_id as number)) *
      (1 - garageBonuses(db, owner.garage_id as number).partWear)
    : 1;
  const delta = wearAdded(km, kind, tier) * repairBalance.partWearFactor * crew;
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

/** What servicing every part on a car would cost this garage now: a quarter of each part's price in proportion to its wear. */
export function partServiceCost(db: Database, garageId: number, carId: number): number {
  const car = owned(db, garageId, carId);
  const fitted = all(
    db,
    'SELECT cp.id, cp.wear, p.stable_id, p.supplier_id FROM car_part cp JOIN part p ON p.id = cp.part_id WHERE cp.car_id = ?',
    [carId],
  );
  let cost = 0;
  for (const f of fitted) {
    const price = partPriceFor(
      db,
      garageId,
      f.supplier_id as number,
      partPrice(part(f.stable_id as string), car.tier as Tier),
    );
    cost += Math.round(repairBalance.servicingShare * price * ((f.wear as number) / 100));
  }
  return cost;
}

/**
 * Services every fitted part, resetting its wear to zero. It costs a quarter of each part's
 * price (after any supplier deal) in proportion to how worn it is.
 */
export function serviceParts(db: Database, garageId: number, carId: number): number {
  const cost = partServiceCost(db, garageId, carId);
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

/** Adds wear to the gear a driver wears for some racing distance (gear of a better tier lasts longer). */
export function wearGear(db: Database, driverId: number, km: number): void {
  if (km <= 0) return;
  for (const g of all(
    db,
    'SELECT dg.item_id, i.tier FROM driver_gear dg JOIN gear_item i ON i.id = dg.item_id WHERE dg.driver_id = ?',
    [driverId],
  )) {
    const factor = repairBalance.gearTierFactor[g.tier as GearTier];
    db.run('UPDATE driver_gear SET wear = MIN(100, wear + ?) WHERE driver_id = ? AND item_id = ?', [
      km * repairBalance.gearWearPerRaceKm * factor,
      driverId,
      g.item_id as number,
    ]);
  }
}

export interface GearCondition {
  driverId: number;
  driverName: string;
  itemId: string;
  name: string;
  slot: GearSlot;
  tier: GearTier;
  wear: number;
  /** What refurbishing the item costs now, or null when it cannot be bought (earned or found items). */
  renewCost: number | null;
}

/** What refurbishing a worn item costs: half its price in proportion to its wear. */
export function gearRenewCost(price: number, wear: number, saving = 0): number {
  return Math.round(repairBalance.gearRenewShare * price * (wear / 100) * (1 - saving));
}

/** The wear of every item a driver wears. */
export function gearConditions(db: Database, driverId: number): GearCondition[] {
  return all(
    db,
    `SELECT dg.wear, i.stable_id, d.name FROM driver_gear dg JOIN gear_item i ON i.id = dg.item_id
       JOIN driver d ON d.id = dg.driver_id WHERE dg.driver_id = ? ORDER BY i.id`,
    [driverId],
  ).map((r) => {
    const item = gearItem(r.stable_id as string);
    return {
      driverId,
      driverName: String(r.name),
      itemId: item.id,
      name: item.name,
      slot: item.slot,
      tier: item.tier,
      wear: r.wear as number,
      renewCost: item.price > 0 ? gearRenewCost(item.price, r.wear as number) : null,
    };
  });
}

/**
 * Has the maker refurbish one item of a driver's gear, taking its wear away. The garage that
 * employs the driver pays; items that are not sold (earned or found ones) cannot be refurbished.
 */
export function renewGear(
  db: Database,
  garageId: number,
  driverId: number,
  itemId: string,
): number {
  const year = Number(readCareer(db)!.gameDate.slice(0, 4));
  const employed = all(
    db,
    'SELECT 1 AS n FROM contract WHERE driver_id = ? AND garage_id = ? AND end_year >= ? LIMIT 1',
    [driverId, garageId, year],
  )[0];
  if (!employed) throw new Error('The garage does not employ this driver.');
  const item = gearItem(itemId);
  if (item.price <= 0) throw new Error('This item cannot be refurbished.');
  const row = all(
    db,
    `SELECT dg.wear FROM driver_gear dg JOIN gear_item i ON i.id = dg.item_id
      WHERE dg.driver_id = ? AND i.stable_id = ?`,
    [driverId, itemId],
  )[0];
  if (!row) throw new Error('The driver does not wear this item.');
  const cost = gearRenewCost(item.price, row.wear as number, garageBonuses(db, garageId).gearCost);
  db.exec('BEGIN');
  try {
    charge(db, garageId, 'gear', cost, `Refurbished ${item.name}`);
    db.run(
      'UPDATE driver_gear SET wear = 0 WHERE driver_id = ? AND item_id = (SELECT id FROM gear_item WHERE stable_id = ?)',
      [driverId, itemId],
    );
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

/** The gear of every driver a garage has entered this season. */
export function garageGear(db: Database, garageId: number): GearCondition[] {
  return all(
    db,
    `SELECT DISTINCT driver_id FROM entry
      WHERE garage_id = ? AND series = 'main' AND season_id = (SELECT MAX(id) FROM season) ORDER BY driver_id`,
    [garageId],
  ).flatMap((e) => gearConditions(db, e.driver_id as number));
}
