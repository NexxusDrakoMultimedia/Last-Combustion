// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  fitParts,
  legalityScore,
  maxTyreWidthMm,
  part,
  partPrice,
  parts,
  scrutineer,
  type PartCategory,
  type PartData,
  type ScrutineeringResult,
} from '../sim/upgrades';
import type { Layout, Tier } from '../sim/worldgen/types';
import { readCareer } from './career';
import { partPriceFor } from './deals';
import { all } from './entries';
import { partServiceCost } from './repairs';

/** The parts fitted to a car, in the order they were fitted. */
export function fittedParts(db: Database, carId: number): PartData[] {
  return all(
    db,
    'SELECT p.stable_id FROM car_part cp JOIN part p ON p.id = cp.part_id WHERE cp.car_id = ? ORDER BY cp.id',
    [carId],
  ).map((r) => part(r.stable_id as string));
}

/** A car's road-legality score: 100 for a stock car, less what its parts use. Below zero is illegal. */
export function legalityOf(db: Database, carId: number): number {
  return legalityScore(fittedParts(db, carId));
}

function carRow(db: Database, carId: number) {
  const car = all(
    db,
    `SELECT c.id, c.plate, c.plate_state, c.garage_id, c.kerb_kg_current, c.tyre_width_mm, m.base_kerb_kg, m.max_tyre_mm, m.base_ps, m.tier, m.layout,
            g.kind
       FROM car c
       JOIN car_model m ON m.id = c.car_model_id
       JOIN garage g ON g.id = c.garage_id
      WHERE c.id = ?`,
    [carId],
  )[0];
  if (!car) throw new Error(`There is no car ${carId}.`);
  return car;
}

/** Recomputes a car's kerb weight and tyre width from its stock model and fitted parts. */
function refit(db: Database, carId: number): void {
  const car = carRow(db, carId);
  const fitted = fittedParts(db, carId);
  const spec = fitParts(
    {
      ps: car.base_ps as number,
      kerbKg: car.base_kerb_kg as number,
      tyreMm: car.max_tyre_mm as number,
      layout: car.layout as Layout,
    },
    fitted,
  );
  db.run('UPDATE car SET kerb_kg_current = ?, tyre_width_mm = ? WHERE id = ?', [
    spec.kerbKg,
    spec.tyreWidthMm,
    carId,
  ]);
}

export interface Fitting {
  price: number;
  replaced: string | null;
  legality: number;
}

/**
 * Buys a part and fits it. The part replaces any part already fitted in its category. A car may
 * go over its legality budget: it is then illegal, and fails scrutineering until fixed.
 */
export function fitPart(db: Database, garageId: number, carId: number, partId: string): Fitting {
  const wanted = part(partId);
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const date = career.gameDate;
  const car = carRow(db, carId);
  if (car.garage_id !== garageId) throw new Error('The garage does not own this car.');
  if (car.kind !== 'racing') throw new Error('Parts cannot be fitted to a car that is for sale.');
  const garage = all(db, 'SELECT cash FROM garage WHERE id = ?', [garageId])[0]!;
  const supplier = all(db, 'SELECT supplier_id FROM part WHERE stable_id = ?', [wanted.id])[0];
  const price = supplier
    ? partPriceFor(
        db,
        garageId,
        supplier.supplier_id as number,
        partPrice(wanted, car.tier as Tier),
      )
    : partPrice(wanted, car.tier as Tier);
  if ((garage.cash as number) < price) throw new Error('The garage cannot afford this part.');
  const row = all(db, 'SELECT id FROM part WHERE stable_id = ?', [wanted.id])[0];
  if (!row) throw new Error(`The part "${wanted.id}" is not in this career.`);

  db.exec('BEGIN');
  try {
    const old = all(
      db,
      'SELECT cp.id, p.name FROM car_part cp JOIN part p ON p.id = cp.part_id WHERE cp.car_id = ? AND cp.category = ?',
      [carId, wanted.category],
    )[0];
    if (old) db.run('DELETE FROM car_part WHERE id = ?', [old.id as number]);
    db.run('INSERT INTO car_part (car_id, part_id, category, installed_date) VALUES (?, ?, ?, ?)', [
      carId,
      row.id as number,
      wanted.category,
      date,
    ]);
    refit(db, carId);
    db.run(
      'INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, ?, ?, ?)',
      [garageId, date, 'parts', -price, wanted.name],
    );
    db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [price, garageId]);
    db.exec('COMMIT');
    return { price, replaced: old ? (old.name as string) : null, legality: legalityOf(db, carId) };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Takes a part off a car. The part has no resale value. */
export function removePart(
  db: Database,
  garageId: number,
  carId: number,
  category: PartCategory,
): boolean {
  const car = carRow(db, carId);
  if (car.garage_id !== garageId) throw new Error('The garage does not own this car.');
  const found = all(db, 'SELECT id FROM car_part WHERE car_id = ? AND category = ?', [
    carId,
    category,
  ])[0];
  if (!found) return false;
  db.exec('BEGIN');
  try {
    db.run('DELETE FROM car_part WHERE id = ?', [found.id as number]);
    refit(db, carId);
    db.exec('COMMIT');
    return true;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** The scrutineering checks for a car as it stands: tyre width and road legality. */
export function scrutineerCar(db: Database, carId: number): ScrutineeringResult {
  const car = carRow(db, carId);
  return scrutineer(
    car.kerb_kg_current as number,
    car.tyre_width_mm as number,
    fittedParts(db, carId),
    car.layout as Layout,
  );
}

export interface PartOffer {
  part: PartData;
  supplier: string;
  /** What this garage pays for the part on this car, after any supplier deal. */
  price: number;
  fitted: boolean;
  /** The fitted part's wear (0 new, 100 worn out), or null when it is not fitted. */
  wear: number | null;
}

export interface UpgradeView {
  carId: number;
  plate: string;
  plateState: string;
  modelName: string;
  kerbKg: number;
  tyreWidthMm: number;
  maxTyreMm: number;
  legality: number;
  scrutineering: ScrutineeringResult;
  offers: PartOffer[];
  /** What servicing all the fitted parts would cost now. */
  serviceCost: number;
}

/** A car's fitted state and every part it could have, priced for this garage. */
export function upgradeView(db: Database, garageId: number, carId: number): UpgradeView {
  const car = carRow(db, carId);
  if (car.garage_id !== garageId) throw new Error('The garage does not own this car.');
  const fitted = new Set(fittedParts(db, carId).map((p) => p.id));
  const wears = new Map(
    all(
      db,
      'SELECT p.stable_id, cp.wear FROM car_part cp JOIN part p ON p.id = cp.part_id WHERE cp.car_id = ?',
      [carId],
    ).map((r) => [r.stable_id as string, r.wear as number]),
  );
  const suppliers = new Map(
    all(db, 'SELECT id, name FROM part_supplier').map((s) => [s.id as number, s.name as string]),
  );
  const rows = new Map(
    all(db, 'SELECT stable_id, supplier_id FROM part').map((p) => [
      p.stable_id as string,
      p.supplier_id as number,
    ]),
  );
  const modelName = String(
    all(db, 'SELECT m.name FROM car c JOIN car_model m ON m.id = c.car_model_id WHERE c.id = ?', [
      carId,
    ])[0]!.name,
  );
  return {
    carId,
    plate: car.plate as string,
    plateState: car.plate_state as string,
    modelName,
    kerbKg: car.kerb_kg_current as number,
    tyreWidthMm: car.tyre_width_mm as number,
    maxTyreMm: maxTyreWidthMm(car.kerb_kg_current as number, car.layout as Layout),
    legality: legalityOf(db, carId),
    scrutineering: scrutineerCar(db, carId),
    offers: parts.map((p) => {
      const supplierId = rows.get(p.id);
      const base = partPrice(p, car.tier as Tier);
      return {
        part: p,
        supplier: supplierId === undefined ? '' : (suppliers.get(supplierId) ?? ''),
        price: supplierId === undefined ? base : partPriceFor(db, garageId, supplierId, base),
        fitted: fitted.has(p.id),
        wear: wears.get(p.id) ?? null,
      };
    }),
    serviceCost: partServiceCost(db, garageId, carId),
  };
}
