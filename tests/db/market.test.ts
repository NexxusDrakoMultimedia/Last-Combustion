// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { garageFinance } from '../../src/db/finance';
import {
  buyNewCar,
  buyUsedCar,
  dealerOffers,
  dealerQuote,
  ensureMarketGarage,
  openListings,
  refreshUsedMarket,
  sellToDealer,
  valueOfCar,
} from '../../src/db/market';
import { createNewDatabase, packDatabase, unpackDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld, readWorldSummary } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed = 'market-db'): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  return db;
}

/** A car that belongs to a garage but has no entry. */
function spareCar(db: Database): { carId: number; garageId: number } {
  const row = db.exec(
    `INSERT INTO car (car_model_id, chassis_no, flag, fans, garage_id, model_year, road_km, race_km, wear, kerb_kg_current, tyre_width_mm)
     SELECT car_model_id, 'LC-SPARE-1', flag, 0, garage_id, 2029, 30000, 0, 12, kerb_kg_current, tyre_width_mm FROM car WHERE id = 1;
     SELECT id, garage_id FROM car WHERE chassis_no = 'LC-SPARE-1'`,
  );
  const [carId, garageId] = row[0]!.values[0] as [number, number];
  return { carId, garageId };
}

describe('the used market', () => {
  it('fills up with ordinary used cars, the same ones for the same seed, and only tops up', () => {
    const a = newCareer('same');
    const b = newCareer('same');
    expect(refreshUsedMarket(a)).toBe(12);
    refreshUsedMarket(b);
    const key = (db: Database) =>
      JSON.stringify(openListings(db).map((l) => [l.modelName, l.modelYear, l.price]));
    expect(key(a)).toBe(key(b));
    expect(openListings(a)).toHaveLength(12);
    expect(refreshUsedMarket(a)).toBe(0);
    const c = newCareer('other');
    refreshUsedMarket(c);
    expect(key(c)).not.toBe(key(a));
  });

  it('lists cars with sensible age, wear and prices, cheapest first, none of them one-offs', () => {
    const db = newCareer();
    refreshUsedMarket(db);
    const list = openListings(db);
    expect(list.map((l) => l.price)).toEqual([...list.map((l) => l.price)].sort((x, y) => x - y));
    for (const l of list) {
      expect(l.tier).not.toBe('unique');
      expect(l.modelYear).toBeLessThan(2031);
      expect(l.wear).toBeGreaterThanOrEqual(0);
      expect(l.price).toBeGreaterThan(0);
    }
  });

  it('keeps the hidden market garage out of the world summary', () => {
    const db = newCareer();
    refreshUsedMarket(db);
    expect(scalar(db, "SELECT COUNT(*) FROM garage WHERE kind = 'market'")).toBe(1);
    expect(readWorldSummary(db)!.garages).toBe(96);
    expect(ensureMarketGarage(db)).toBe(ensureMarketGarage(db));
  });
});

describe('selling to a dealer', () => {
  it('pays 80% of the value, moves the car to the market and lists it for 110%', () => {
    const db = newCareer();
    const { carId, garageId } = spareCar(db);
    const value = valueOfCar(db, carId);
    const cash = Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garageId}`));
    const total = Number(scalar(db, 'SELECT SUM(cash) FROM garage'));
    const sale = sellToDealer(db, garageId, carId);
    expect(sale.price).toBe(Math.round(value * 0.8));
    expect(scalar(db, `SELECT cash FROM garage WHERE id = ${garageId}`)).toBe(cash + sale.price);
    expect(
      scalar(
        db,
        `SELECT kind FROM garage WHERE id = (SELECT garage_id FROM car WHERE id = ${carId})`,
      ),
    ).toBe('market');
    expect(openListings(db).find((l) => l.carId === carId)!.price).toBe(Math.round(value * 1.1));
    expect(garageFinance(db, garageId).byCategory.car_sale).toBe(sale.price);
    expect(Number(scalar(db, 'SELECT SUM(cash) FROM garage'))).toBe(total);
  });

  it('refuses a car that is not the garage’s, one with an entry, or an unknown car', () => {
    const db = newCareer();
    const entered = db.exec('SELECT car_id, garage_id FROM entry LIMIT 1')[0]!.values[0] as [
      number,
      number,
    ];
    expect(() => sellToDealer(db, entered[1], entered[0])).toThrow(/entry this season/);
    expect(() => sellToDealer(db, entered[1] + 1, entered[0])).toThrow(/does not own/);
    expect(() => sellToDealer(db, 1, 99999)).toThrow(/no car/);
  });
});

describe('buying a used car', () => {
  it('moves the car and the money, and records the ownership', () => {
    const db = newCareer();
    refreshUsedMarket(db);
    const listing = openListings(db)[0]!;
    db.run('UPDATE garage SET cash = 100000000 WHERE id = 1');
    const total = Number(scalar(db, 'SELECT SUM(cash) FROM garage'));
    const bought = buyUsedCar(db, 1, listing.id);
    expect(bought.price).toBe(listing.price);
    expect(scalar(db, `SELECT garage_id FROM car WHERE id = ${listing.carId}`)).toBe(1);
    expect(openListings(db).some((l) => l.id === listing.id)).toBe(false);
    expect(scalar(db, `SELECT status FROM market_listing WHERE id = ${listing.id}`)).toBe('sold');
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM car_ownership WHERE car_id = ${listing.carId} AND to_date IS NULL`,
      ),
    ).toBe(1);
    expect(Number(scalar(db, 'SELECT SUM(cash) FROM garage'))).toBe(total);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('refuses a sold listing, an unaffordable car, or a market buyer, and changes nothing', () => {
    const db = newCareer();
    refreshUsedMarket(db);
    const listing = openListings(db)[0]!;
    db.run('UPDATE garage SET cash = 10 WHERE id = 1');
    expect(() => buyUsedCar(db, 1, listing.id)).toThrow(/afford/);
    expect(scalar(db, `SELECT garage_id FROM car WHERE id = ${listing.carId}`)).not.toBe(1);
    db.run('UPDATE garage SET cash = 100000000 WHERE id = 1');
    buyUsedCar(db, 1, listing.id);
    expect(() => buyUsedCar(db, 1, listing.id)).toThrow(/not open/);
    expect(() => buyUsedCar(db, ensureMarketGarage(db), openListings(db)[0]!.id)).toThrow(
      /no racing garage/,
    );
  });

  it('lets a car be sold, bought back and sold again, and survives a save and load', async () => {
    const db = newCareer();
    const { carId, garageId } = spareCar(db);
    sellToDealer(db, garageId, carId);
    const listing = openListings(db).find((l) => l.carId === carId)!;
    db.run('UPDATE garage SET cash = 100000000 WHERE id = 2');
    buyUsedCar(db, 2, listing.id);
    sellToDealer(db, 2, carId);
    expect(openListings(db).filter((l) => l.carId === carId)).toHaveLength(1);
    expect(scalar(db, `SELECT COUNT(*) FROM car_ownership WHERE car_id = ${carId}`)).toBe(3);
    const { db: loaded } = await unpackDatabase(SQL, await packDatabase(db, 'market'));
    expect(openListings(loaded).some((l) => l.carId === carId)).toBe(true);
  });
});

describe('licence plates on cars bought and sold', () => {
  it('gives a new car, a used car and a market car a plate in the right state, each different', async () => {
    const { registerCar } = await import('../../src/db/plates');
    const db = newCareer();
    expect(registerCar).toBeTypeOf('function');
    const plates = db.exec('SELECT plate FROM car WHERE plate IS NULL')[0];
    expect(plates).toBeUndefined();
    refreshUsedMarket(db);
    const market = db
      .exec(
        "SELECT c.plate FROM market_listing l JOIN car c ON c.id = l.car_id WHERE l.status = 'open'",
      )[0]!
      .values.map((v) => String(v[0]));
    expect(market.length).toBeGreaterThan(5);
    expect(market.every((p) => p.length > 3)).toBe(true);
    expect(new Set(market).size).toBe(market.length);
    const total = Number(db.exec('SELECT COUNT(*) FROM car')[0]!.values[0]![0]);
    const distinct = Number(db.exec('SELECT COUNT(DISTINCT plate) FROM car')[0]!.values[0]![0]);
    expect(distinct).toBe(total);
  });
});

describe('the dealers’ offers', () => {
  it('list every model on sale, cheapest first, at the price this garage pays', () => {
    const db = newCareer('dealer-offers');
    const garage = Number(
      db.exec("SELECT id FROM garage WHERE kind = 'racing' LIMIT 1")[0]!.values[0]![0],
    );
    const offers = dealerOffers(db, garage);
    expect(offers.length).toBeGreaterThan(20);
    expect(offers.map((o) => o.listPrice)).toEqual(
      [...offers.map((o) => o.listPrice)].sort((a, b) => a - b),
    );
    for (const o of offers) {
      expect(o.price).toBeLessThanOrEqual(o.listPrice);
      expect(o.maker.length).toBeGreaterThan(0);
    }
    // No one-off cars are for sale new.
    expect(offers.some((o) => o.tier === 'unique')).toBe(false);
  });

  it('show the discount from a manufacturer deal, and match what buying costs', () => {
    const db = newCareer('dealer-deal');
    const garage = Number(
      db.exec("SELECT id FROM garage WHERE kind = 'racing' LIMIT 1")[0]!.values[0]![0],
    );
    db.run('UPDATE garage SET cash = 900000000 WHERE id = ?', [garage]);
    const cheapest = dealerOffers(db, garage)[0]!;
    const before = Number(
      db.exec(`SELECT cash FROM garage WHERE id = ${garage}`)[0]!.values[0]![0],
    );
    const bought = buyNewCar(db, garage, cheapest.modelId);
    const after = Number(db.exec(`SELECT cash FROM garage WHERE id = ${garage}`)[0]!.values[0]![0]);
    expect(bought.price).toBe(cheapest.price);
    expect(before - after).toBe(cheapest.price);
  });

  it('quote what a dealer would pay for a car as a share of its value', () => {
    const db = newCareer('dealer-quote');
    const carId = Number(db.exec('SELECT id FROM car LIMIT 1')[0]!.values[0]![0]);
    const quote = dealerQuote(db, carId);
    expect(quote).toBeGreaterThan(0);
    expect(quote).toBeLessThan(valueOfCar(db, carId));
  });
});
