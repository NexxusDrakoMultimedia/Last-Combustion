// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { badgesFor, NO_BADGE, type NumberBadge } from './registry';
import type { Database } from 'sql.js';
import { RANKED_NUMBERS, rankingNumbers } from '../sim/numbers';
import { RESERVED_NUMBER } from '../sim/worldgen';
import { seasonBalance } from '../sim/worldgen/data';
import { all } from './entries';
import { valueOfCar } from './market';
import { refreshPlayerPrestige } from './prestige';
import { restorationQuote, type RestorationQuote } from './repairs';

export interface OwnedCar {
  carId: number;
  /** The car's Australian licence plate, which identifies it. */
  plate: string;
  plateState: string;
  modelName: string;
  modelYear: number;
  roadKm: number;
  wear: number;
  value: number;
  /** The race number of the entry that uses this car this season, or null if it sits in the garage. */
  inEntry: number | null;
  /** What a full restoration would cost and leave, and how many it has had. */
  restoration: RestorationQuote;
}

/** The cars a garage owns, with the entry each one is racing in this season. */
export function ownedCars(db: Database, garageId: number): OwnedCar[] {
  return all(
    db,
    `SELECT c.id, c.plate, c.plate_state, c.model_year, c.road_km, c.wear, m.name,
            (SELECT e.race_number FROM entry e
              WHERE e.car_id = c.id AND e.series = 'main'
                AND e.season_id = (SELECT MAX(id) FROM season)) AS race_number
       FROM car c JOIN car_model m ON m.id = c.car_model_id
      WHERE c.garage_id = ? ORDER BY c.id`,
    [garageId],
  ).map((r) => ({
    carId: r.id as number,
    plate: r.plate as string,
    plateState: r.plate_state as string,
    modelName: r.name as string,
    modelYear: r.model_year as number,
    roadKm: r.road_km as number,
    wear: Math.round((r.wear as number) * 10) / 10,
    value: valueOfCar(db, r.id as number),
    inEntry: (r.race_number as number | null) ?? null,
    restoration: restorationQuote(db, r.id as number),
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

/**
 * Seats a driver the garage has under contract in one of its entries for this season. The driver
 * must not be racing for another garage, and the entry cannot change once a round has run. The
 * driver who was in the seat stays under contract but is no longer racing.
 */
export function setEntryDriver(
  db: Database,
  garageId: number,
  raceNumber: number,
  driverId: number,
): void {
  const career = all(db, 'SELECT game_date FROM career WHERE id = 1')[0];
  if (!career) throw new Error('There is no career in this database.');
  const year = Number(String(career.game_date).slice(0, 4));
  const season = all(db, 'SELECT id FROM season ORDER BY year DESC LIMIT 1')[0];
  if (!season) throw new Error('There is no season in this database.');
  const entry = all(
    db,
    "SELECT id, driver_id FROM entry WHERE season_id = ? AND series = 'main' AND garage_id = ? AND race_number = ?",
    [season.id as number, garageId, raceNumber],
  )[0];
  if (!entry) throw new Error('That garage has no such entry.');
  if (entry.driver_id === driverId) return;
  if (
    !all(db, 'SELECT 1 FROM contract WHERE driver_id = ? AND garage_id = ? AND end_year >= ?', [
      driverId,
      garageId,
      year,
    ])[0]
  )
    throw new Error('That driver is not under contract with this garage.');
  if (
    all(db, "SELECT 1 FROM entry WHERE season_id = ? AND series = 'main' AND driver_id = ?", [
      season.id as number,
      driverId,
    ])[0]
  )
    throw new Error('That driver is already racing in an entry.');
  if (
    all(db, "SELECT 1 FROM round WHERE season_id = ? AND status <> 'scheduled'", [
      season.id as number,
    ])[0]
  )
    throw new Error('The drivers cannot be changed once the season has started.');
  db.run('UPDATE entry SET driver_id = ? WHERE id = ?', [driverId, entry.id as number]);
}

export interface GarageEntry {
  raceNumber: number;
  driverId: number;
  driverName: string;
  carId: number;
  carName: string;
  plate: string;
  plateState: string;
  /** What the number carries: gold or silver border, black box. */
  badge: NumberBadge;
}

/** The entries a garage has this season, lowest race number first. */
export function garageEntries(db: Database, garageId: number): GarageEntry[] {
  const year = Number(all(db, 'SELECT MAX(year) AS y FROM season')[0]?.y ?? 0);
  const badges = badgesFor(db, year);
  return all(
    db,
    `SELECT e.race_number, e.driver_id, d.name AS driver_name, e.car_id, m.name AS car_name, c.plate, c.plate_state
       FROM entry e JOIN driver d ON d.id = e.driver_id
       JOIN car c ON c.id = e.car_id JOIN car_model m ON m.id = c.car_model_id
      WHERE e.garage_id = ? AND e.series = 'main' AND e.season_id = (SELECT MAX(id) FROM season)
      ORDER BY e.race_number`,
    [garageId],
  ).map((r) => ({
    badge: badges.get(r.driver_id as number) ?? NO_BADGE,
    raceNumber: r.race_number as number,
    driverId: r.driver_id as number,
    driverName: r.driver_name as string,
    carId: r.car_id as number,
    carName: r.car_name as string,
    plate: r.plate as string,
    plateState: r.plate_state as string,
  }));
}

function beforeSeasonStarts(db: Database, seasonId: number): void {
  if (all(db, "SELECT 1 FROM round WHERE season_id = ? AND status <> 'scheduled'", [seasonId])[0])
    throw new Error('The entries cannot be changed once the season has started.');
}

/**
 * Adds an entry for the garage this season: a car it owns that is not racing yet, and a driver it
 * has under contract who is not racing yet. The entry takes the lowest free race number from 41 up
 * (never #313). A garage may have up to eight entries, and each one adds entry fees, tyres,
 * servicing and travel every round. Entries cannot be added once the season has started.
 */
export function addEntry(
  db: Database,
  garageId: number,
  carId: number,
  driverId: number,
): GarageEntry {
  const career = all(db, 'SELECT game_date FROM career WHERE id = 1')[0];
  if (!career) throw new Error('There is no career in this database.');
  const year = Number(String(career.game_date).slice(0, 4));
  const season = all(db, 'SELECT id FROM season ORDER BY year DESC LIMIT 1')[0];
  if (!season) throw new Error('There is no season in this database.');
  const seasonId = season.id as number;
  beforeSeasonStarts(db, seasonId);
  const garage = all(db, 'SELECT kind, closed_year FROM garage WHERE id = ?', [garageId])[0];
  if (!garage || garage.kind !== 'racing' || garage.closed_year !== null)
    throw new Error(`There is no racing garage ${garageId}.`);
  if (garageEntries(db, garageId).length >= seasonBalance.garages.maxEntriesPerGarage)
    throw new Error(
      `A garage can have at most ${seasonBalance.garages.maxEntriesPerGarage} entries.`,
    );
  const car = all(db, 'SELECT garage_id FROM car WHERE id = ?', [carId])[0];
  if (!car || car.garage_id !== garageId) throw new Error('That car is not in this garage.');
  if (
    all(db, "SELECT 1 FROM entry WHERE season_id = ? AND series = 'main' AND car_id = ?", [
      seasonId,
      carId,
    ])[0]
  )
    throw new Error('That car is already racing in an entry.');
  if (
    !all(db, 'SELECT 1 FROM contract WHERE driver_id = ? AND garage_id = ? AND end_year >= ?', [
      driverId,
      garageId,
      year,
    ])[0]
  )
    throw new Error('That driver is not under contract with this garage.');
  if (
    all(db, "SELECT 1 FROM entry WHERE season_id = ? AND series = 'main' AND driver_id = ?", [
      seasonId,
      driverId,
    ])[0]
  )
    throw new Error('That driver is already racing in an entry.');
  const taken = new Set(
    all(db, "SELECT race_number FROM entry WHERE season_id = ? AND series = 'main'", [
      seasonId,
    ]).map((r) => r.race_number as number),
  );
  // A ranked driver (last season's top 40) must take the number the ranking gave them, even
  // when they were withdrawn and are seated again in another car.
  let number = rankedNumberOf(db, seasonId, driverId, taken);
  if (number === null) {
    number = 41;
    while (taken.has(number) || number === RESERVED_NUMBER) number += 1;
  }
  db.run(
    "INSERT INTO entry (season_id, garage_id, driver_id, car_id, race_number, series) VALUES (?, ?, ?, ?, ?, 'main')",
    [seasonId, garageId, driverId, carId, number],
  );
  refreshPlayerPrestige(db);
  return garageEntries(db, garageId).find((e) => e.raceNumber === number)!;
}

/**
 * The ranked number (1 to 40) that last season's driver table gives a driver for this season, or
 * null if the driver has none or the number is already taken by another entry.
 */
function rankedNumberOf(
  db: Database,
  seasonId: number,
  driverId: number,
  taken: ReadonlySet<number>,
): number | null {
  const last = all(db, 'SELECT id FROM season WHERE id < ? ORDER BY id DESC LIMIT 1', [
    seasonId,
  ])[0];
  if (!last) return null;
  const table = all(
    db,
    "SELECT subject FROM standing_snapshot WHERE season_id = ? AND table_kind = 'driver' ORDER BY position",
    [last.id as number],
  );
  const racing = new Set(
    all(db, "SELECT driver_id FROM entry WHERE season_id = ? AND series = 'main'", [seasonId]).map(
      (r) => r.driver_id as number,
    ),
  );
  racing.add(driverId);
  const numbers = rankingNumbers(
    table.map((t) => ({ driverId: Number(t.subject), racing: racing.has(Number(t.subject)) })),
  );
  const number = numbers.get(driverId);
  return number !== undefined && number <= RANKED_NUMBERS && !taken.has(number) ? number : null;
}

/**
 * Withdraws one of the garage's entries for this season (before it starts). The car and driver stay
 * with the garage. A garage keeps at least one entry.
 */
export function removeEntry(db: Database, garageId: number, raceNumber: number): void {
  const season = all(db, 'SELECT id FROM season ORDER BY year DESC LIMIT 1')[0];
  if (!season) throw new Error('There is no season in this database.');
  const seasonId = season.id as number;
  beforeSeasonStarts(db, seasonId);
  const entries = garageEntries(db, garageId);
  if (!entries.some((e) => e.raceNumber === raceNumber))
    throw new Error('That garage has no such entry.');
  if (entries.length <= 1) throw new Error('A garage keeps at least one entry.');
  db.run(
    "DELETE FROM entry WHERE season_id = ? AND series = 'main' AND garage_id = ? AND race_number = ?",
    [seasonId, garageId, raceNumber],
  );
  refreshPlayerPrestige(db);
}
