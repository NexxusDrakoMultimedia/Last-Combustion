// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { listingPrice } from '../sim/economy';
import { createRng } from '../sim/rng';
import { makeRookie } from '../sim/worldgen';
import { readCareer } from './career';
import { insertDriver, placeIdMap } from './drivers';
import { all } from './entries';
import { createUsedCar, ensureMarketGarage, transferCar, valueOfCar } from './market';

export const STARTER_CARS = 3;
export const STARTER_DRIVERS = 5;
const STARTER_SALARY = 20_000;

export interface StarterCar {
  carId: number;
  plate: string;
  plateState: string;
  modelName: string;
  modelYear: number;
  roadKm: number;
  wear: number;
  value: number;
}

export interface StarterDriver {
  driverId: number;
  name: string;
  age: number;
  identity: string;
  pace: number;
  consistency: number;
  racecraft: number;
  tyreManagement: number;
  composure: number;
  wetSkill: number;
}

export interface StarterOffers {
  cars: StarterCar[];
  drivers: StarterDriver[];
}

/**
 * Offers a new owner three cheap starter cars and five unknown driver prospects to choose from.
 * The cars and the prospects come from the career's seed, so a seed gives the same offers.
 */
export function createStarterOffers(db: Database): void {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  if (all(db, 'SELECT 1 FROM starter_offer')[0]) throw new Error('Starter offers already exist.');
  const rng = createRng(career.masterSeed);
  const carRng = rng.stream('starter:cars');
  const driverRng = rng.stream('starter:drivers');
  const market = ensureMarketGarage(db);
  const year = career.startYear;
  db.exec('BEGIN');
  try {
    const used: number[] = [];
    for (let i = 0; i < STARTER_CARS; i++) {
      const { carId } = createUsedCar(db, carRng, market, career.gameDate, {
        tier: 'starter',
        excludeModelIds: used,
      });
      used.push(Number(all(db, 'SELECT car_model_id AS m FROM car WHERE id = ?', [carId])[0]!.m));
      db.run("INSERT INTO starter_offer (kind, subject_id) VALUES ('car', ?)", [carId]);
    }
    const placeIds = placeIdMap(db);
    let nextId = Number(db.exec('SELECT MAX(id) FROM driver')[0]!.values[0]![0]) + 1;
    for (let i = 0; i < STARTER_DRIVERS; i++) {
      insertDriver(
        db,
        makeRookie(driverRng, nextId, year, { ageMin: 18, ageMax: 24, paceMean: 45 }),
        placeIds,
      );
      db.run("INSERT INTO starter_offer (kind, subject_id) VALUES ('driver', ?)", [nextId]);
      nextId += 1;
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** The offers still waiting for a choice, or undefined once the owner has chosen. */
export function starterOffers(db: Database): StarterOffers | undefined {
  if (!all(db, 'SELECT 1 FROM starter_offer')[0]) return undefined;
  const year = readCareer(db)?.startYear ?? 0;
  const cars = all(
    db,
    `SELECT c.id, c.plate, c.plate_state, c.model_year, c.road_km, c.wear, m.name FROM starter_offer o
       JOIN car c ON c.id = o.subject_id JOIN car_model m ON m.id = c.car_model_id
      WHERE o.kind = 'car' ORDER BY o.id`,
  ).map((r) => ({
    carId: r.id as number,
    plate: r.plate as string,
    plateState: r.plate_state as string,
    modelName: r.name as string,
    modelYear: r.model_year as number,
    roadKm: r.road_km as number,
    wear: Math.round((r.wear as number) * 10) / 10,
    value: valueOfCar(db, r.id as number),
  }));
  const drivers = all(
    db,
    `SELECT d.* FROM starter_offer o JOIN driver d ON d.id = o.subject_id
      WHERE o.kind = 'driver' ORDER BY o.id`,
  ).map((d) => ({
    driverId: d.id as number,
    name: d.name as string,
    age: year - Number(String(d.birth_date).slice(0, 4)),
    identity: d.identity as string,
    pace: d.pace as number,
    consistency: d.consistency as number,
    racecraft: d.racecraft as number,
    tyreManagement: d.tyre_management as number,
    composure: d.composure as number,
    wetSkill: d.wet_skill as number,
  }));
  return { cars, drivers };
}

/**
 * The owner picks one starter car and one prospect. The car and the driver take over the garage's
 * entry; the garage's old car goes on the used market and its old driver becomes a free agent. The
 * cars and prospects that were not chosen go on the market and to free agency too.
 */
export function chooseStarter(db: Database, carId: number, driverId: number): void {
  const offers = starterOffers(db);
  if (!offers) throw new Error('The starter choice has already been made.');
  if (!offers.cars.some((c) => c.carId === carId)) throw new Error('That car is not on offer.');
  if (!offers.drivers.some((d) => d.driverId === driverId))
    throw new Error('That driver is not on offer.');
  const career = readCareer(db)!;
  const date = career.gameDate;
  const garage = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0];
  if (!garage) throw new Error('There is no player garage.');
  const garageId = garage.id as number;
  const entry = all(
    db,
    `SELECT id, car_id, driver_id FROM entry
      WHERE garage_id = ? AND series = 'main' AND season_id = (SELECT MAX(id) FROM season)`,
    [garageId],
  )[0];
  if (!entry) throw new Error('The player garage has no entry.');
  const market = ensureMarketGarage(db);

  db.exec('BEGIN');
  try {
    // The garage's old car is sold on through the market, and its old driver is released.
    transferCar(db, entry.car_id as number, market, date, 0);
    db.run(
      "INSERT INTO market_listing (car_id, price, listed_date, status) VALUES (?, ?, ?, 'open')",
      [entry.car_id as number, listingPrice(valueOfCar(db, entry.car_id as number)), date],
    );
    db.run('DELETE FROM contract WHERE driver_id = ? AND garage_id = ?', [
      entry.driver_id as number,
      garageId,
    ]);
    transferCar(db, carId, garageId, date, 0);
    db.run('UPDATE entry SET car_id = ?, driver_id = ? WHERE id = ?', [
      carId,
      driverId,
      entry.id as number,
    ]);
    db.run(
      "INSERT INTO contract (driver_id, garage_id, start_year, end_year, salary, role, release_fee) VALUES (?, ?, ?, ?, ?, 'lead', 0)",
      [driverId, garageId, career.startYear, career.startYear + 1, STARTER_SALARY],
    );
    for (const c of offers.cars.filter((x) => x.carId !== carId)) {
      db.run(
        "INSERT INTO market_listing (car_id, price, listed_date, status) VALUES (?, ?, ?, 'open')",
        [c.carId, listingPrice(c.value), date],
      );
    }
    db.run('DELETE FROM starter_offer');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
