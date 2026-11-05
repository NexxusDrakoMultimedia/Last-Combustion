// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { listingPrice } from '../sim/economy';
import type { RandomStream } from '../sim/rng';
import { DRAKE_MOTORSPORTS, makeNewGarage, makeRookie } from '../sim/worldgen';
import { seasonBalance } from '../sim/worldgen/data';
import { fairSalary } from '../sim/worldgen/rating';
import type { Identity } from '../sim/worldgen/types';
import { insertDriver, placeIdMap } from './drivers';
import { all } from './entries';
import { createUsedCar, ensureMarketGarage, transferCar, valueOfCar } from './market';

const cfg = () => seasonBalance.garages;

/** A computer garage's sponsorship income for a season: a fee per entry that grows with prestige. */
export function sponsorIncome(entries: number, prestige: number): number {
  return Math.round(entries * (cfg().sponsorPerEntry + cfg().sponsorPerPrestige * prestige));
}

/**
 * Closes the season's books for the computer garages and folds the ones that stay broke.
 * Every computer garage with entries last season is paid its sponsorship, then a garage that ends
 * the season with negative cash counts a broke year (a garage back in the black starts again); after
 * two broke years in a row it closes. A closing garage's drivers become free agents and its cars
 * go on the used market. The player's garage and Drake Motorsports never close. Returns the ids of
 * the garages that closed.
 */
export function settleGarages(db: Database, lastSeasonId: number, year: number): number[] {
  const date = `${year - 1}-12-31`;
  const rows = all(
    db,
    `SELECT g.id, g.prestige, g.name, COUNT(e.id) AS n
       FROM garage g JOIN entry e ON e.garage_id = g.id AND e.season_id = ? AND e.series = 'main'
      WHERE g.kind = 'racing' AND g.is_player = 0 AND g.closed_year IS NULL
      GROUP BY g.id ORDER BY g.id`,
    [lastSeasonId],
  );
  const closed: number[] = [];
  for (const g of rows) {
    const id = g.id as number;
    const income = sponsorIncome(g.n as number, g.prestige as number);
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, 'sponsor', ?, ?)",
      [id, date, income, `${year - 1} sponsorship`],
    );
    db.run('UPDATE garage SET cash = cash + ? WHERE id = ?', [income, id]);
    const cash = Number(all(db, 'SELECT cash FROM garage WHERE id = ?', [id])[0]!.cash);
    if (cash >= 0) {
      db.run('UPDATE garage SET broke_years = 0 WHERE id = ?', [id]);
      continue;
    }
    db.run('UPDATE garage SET broke_years = broke_years + 1 WHERE id = ?', [id]);
    const broke = Number(all(db, 'SELECT broke_years AS b FROM garage WHERE id = ?', [id])[0]!.b);
    if (broke < cfg().foldAfterBrokeYears || g.name === DRAKE_MOTORSPORTS) continue;
    closeAndSellUp(db, id, year);
    closed.push(id);
  }
  return closed;
}

/** Closes a garage: its contracts end, and its cars are listed on the used market. */
function closeAndSellUp(db: Database, garageId: number, year: number): void {
  db.run('UPDATE garage SET closed_year = ? WHERE id = ?', [year - 1, garageId]);
  db.run('UPDATE contract SET end_year = MIN(end_year, ?) WHERE garage_id = ?', [
    year - 1,
    garageId,
  ]);
  const market = ensureMarketGarage(db);
  const date = `${year}-02-01`;
  for (const c of all(db, 'SELECT id FROM car WHERE garage_id = ? ORDER BY id', [garageId])) {
    const carId = c.id as number;
    transferCar(db, carId, market, date, 0);
    db.run(
      "INSERT INTO market_listing (car_id, price, listed_date, status) VALUES (?, ?, ?, 'open')",
      [carId, listingPrice(valueOfCar(db, carId)), date],
    );
  }
}

export interface OpeningOptions {
  seasonId: number;
  year: number;
  /** How many more entries the season has room for. */
  room: number;
  /** Takes the next free race number. */
  takeNumber: () => number;
  rng: RandomStream;
  rookieRng: RandomStream;
  /** Rolls a new driver's identity (the same non-binary share as other newcomers). */
  identityOf: (rolled: Identity) => Identity;
}

/**
 * Opens the year's new computer garages: three to ten, each a one-car team with a name, a nation
 * and a base, a used starter car and a driver. A driver is either the best of a few free agents or a
 * rookie. Returns how many opened.
 */
export function openNewGarages(db: Database, o: OpeningOptions): number {
  const count = Math.min(o.rng.int(cfg().newPerYearMin, cfg().newPerYearMax), o.room);
  if (count <= 0) return 0;
  const names = new Set(all(db, 'SELECT name FROM garage').map((g) => String(g.name)));
  const placeIds = placeIdMap(db);
  const date = `${o.year}-02-01`;
  let garageId = Number(all(db, 'SELECT MAX(id) AS n FROM garage')[0]!.n) + 1;
  let driverId = Number(all(db, 'SELECT MAX(id) AS n FROM driver')[0]!.n) + 1;
  const taken = new Set<number>();
  for (let i = 0; i < count; i++) {
    const garage = makeNewGarage(o.rng, garageId, o.year, names);
    names.add(garage.name);
    db.run(
      `INSERT INTO garage (id, name, flag, base_place_id, home_state, primary_colour, secondary_colour,
                           prestige, cash, founded_year, is_player, ai_profile, fans)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        garage.id,
        garage.name,
        garage.flag,
        placeIds.get(garage.basePlaceId)!,
        garage.homeState,
        garage.primaryColour,
        garage.secondaryColour,
        garage.prestige,
        garage.cash,
        garage.foundedYear,
        garage.aiProfile,
        garage.fans,
      ],
    );

    // The driver: one of the best few free agents, or a rookie.
    const pool = all(
      db,
      `SELECT id, pace, gold_border_year FROM driver
        WHERE retired_year IS NULL AND easter_egg = 0
          AND id NOT IN (SELECT driver_id FROM entry WHERE season_id = ?)
          AND id NOT IN (SELECT subject_id FROM starter_offer WHERE kind = 'driver')
          AND id NOT IN (SELECT driver_id FROM contract WHERE end_year >= ? AND garage_id IN (SELECT id FROM garage WHERE is_player = 1))
        ORDER BY pace DESC, id LIMIT 8`,
      [o.seasonId, o.year],
    ).filter((d) => !taken.has(d.id as number));
    let pickedId: number;
    let salary: number;
    if (pool.length > 0 && o.rng.chance(cfg().newFreeAgentShare)) {
      const d = o.rng.pick(pool.slice(0, 5));
      pickedId = d.id as number;
      salary = Math.round(fairSalary(d.pace as number, d.gold_border_year !== null));
      taken.add(pickedId);
    } else {
      const rookie = makeRookie(o.rookieRng, driverId, o.year, {
        ageMin: seasonBalance.rookieAgeMin,
        ageMax: seasonBalance.rookieAgeMax,
        paceMean: seasonBalance.rookiePaceMean,
      });
      insertDriver(db, { ...rookie, identity: o.identityOf(rookie.identity) }, placeIds);
      pickedId = rookie.id;
      salary = Math.round(fairSalary(rookie.pace, false) * seasonBalance.rookieSalaryShare);
      driverId += 1;
    }
    db.run(
      "INSERT INTO contract (driver_id, garage_id, start_year, end_year, salary, role, release_fee) VALUES (?, ?, ?, ?, ?, 'lead', ?)",
      [
        pickedId,
        garage.id,
        o.year,
        o.year + seasonBalance.contractRenewalYears,
        salary,
        Math.round(salary / 2),
      ],
    );
    const { carId } = createUsedCar(db, o.rng, garage.id, date, {
      tier: 'starter',
      excludeModelIds: [],
    });
    db.run(
      "INSERT INTO entry (season_id, garage_id, driver_id, car_id, race_number, series) VALUES (?, ?, ?, ?, ?, 'main')",
      [o.seasonId, garage.id, pickedId, carId, o.takeNumber()],
    );
    garageId += 1;
  }
  return count;
}
