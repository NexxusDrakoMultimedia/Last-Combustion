// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { garageFinance, settleRound } from '../../src/db/finance';
import { buyNewCar, modelsOnSale, valueOfCar } from '../../src/db/market';
import { playPrelims } from '../../src/db/prelims';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed = 'economy-db'): Database {
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

describe('buying a new car', () => {
  it('lists only models on sale, cheapest first, and never a one-off car', () => {
    const db = newCareer();
    const list = modelsOnSale(db);
    expect(list.some((m) => m.tier === 'unique' || m.priceNew === 0)).toBe(false);
    expect(list.length).toBeGreaterThan(30);
    expect(list.map((m) => m.priceNew)).toEqual(
      [...list.map((m) => m.priceNew)].sort((a, b) => a - b),
    );
  });

  it('creates a clean chassis, takes the money, and writes the ownership and the ledger', () => {
    const db = newCareer();
    const garageId = Number(scalar(db, 'SELECT id FROM garage WHERE is_player = 1')) || 1;
    db.run('UPDATE garage SET cash = 5000000 WHERE id = ?', [garageId]);
    const model = modelsOnSale(db).find((m) => m.priceNew < 100_000)!;
    const cars = Number(scalar(db, 'SELECT COUNT(*) FROM car'));
    const purchase = buyNewCar(db, garageId, model.id, 0.1);
    expect(purchase.price).toBe(Math.round(model.priceNew * 0.9));
    expect(scalar(db, 'SELECT COUNT(*) FROM car')).toBe(cars + 1);
    expect(scalar(db, `SELECT garage_id FROM car WHERE id = ${purchase.carId}`)).toBe(garageId);
    expect(
      scalar(db, `SELECT road_km + race_km + wear FROM car WHERE id = ${purchase.carId}`),
    ).toBe(0);
    expect(scalar(db, 'SELECT cash FROM garage WHERE id = ' + garageId)).toBe(
      5_000_000 - purchase.price,
    );
    expect(scalar(db, `SELECT route FROM car_ownership WHERE car_id = ${purchase.carId}`)).toBe(
      'new',
    );
    expect(garageFinance(db, garageId).byCategory.car_purchase).toBe(-purchase.price);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('refuses when the garage cannot afford it, and leaves everything unchanged', () => {
    const db = newCareer();
    db.run('UPDATE garage SET cash = 100 WHERE id = 1');
    const cars = scalar(db, 'SELECT COUNT(*) FROM car');
    expect(() => buyNewCar(db, 1, modelsOnSale(db)[0]!.id)).toThrow(/afford/);
    expect(scalar(db, 'SELECT COUNT(*) FROM car')).toBe(cars);
    expect(scalar(db, 'SELECT cash FROM garage WHERE id = 1')).toBe(100);
  });

  it('rejects an unknown garage or model, and a one-off car', () => {
    const db = newCareer();
    const oneOff = Number(scalar(db, "SELECT id FROM car_model WHERE tier = 'unique'"));
    expect(() => buyNewCar(db, 1, oneOff)).toThrow(/not on sale/);
    expect(() => buyNewCar(db, 9999, 1)).toThrow(/no garage/);
    expect(() => buyNewCar(db, 1, 9999)).toThrow(/no car model/);
  });

  it('values a new car at 70% of its new price', () => {
    const db = newCareer();
    db.run('UPDATE garage SET cash = 50000000 WHERE id = 1');
    const model = modelsOnSale(db)[3]!;
    const { carId } = buyNewCar(db, 1, model.id);
    expect(valueOfCar(db, carId)).toBe(Math.round(model.priceNew * 0.7));
  });
});

describe('settling a round', () => {
  let db: Database;
  beforeAll(() => {
    db = newCareer('settle');
    playPrelims(db, 1);
  });

  it('refuses a round that has no prelims yet', () => {
    expect(() => settleRound(db, 2)).toThrow(/no prelims/);
  });

  it('charges every garage with entries, and the cash change equals the ledger', () => {
    const cash = Number(scalar(db, 'SELECT SUM(cash) FROM garage'));
    const result = settleRound(db, 1);
    expect(result.garages).toBeGreaterThan(50);
    const after = Number(scalar(db, 'SELECT SUM(cash) FROM garage'));
    expect(cash - after).toBe(result.total);
    expect(-Number(scalar(db, 'SELECT SUM(amount) FROM ledger'))).toBe(result.total);
    expect(
      scalar(db, "SELECT COUNT(DISTINCT garage_id) FROM ledger WHERE category = 'entry_fee'"),
    ).toBe(result.garages);
    expect(scalar(db, 'SELECT COUNT(*) FROM ledger WHERE amount > 0')).toBe(0);
  });

  it('cannot be run twice', () => {
    expect(() => settleRound(db, 1)).toThrow(/already been settled/);
  });
});

describe('garage finance', () => {
  it('summarises cash, income and expenses by category', () => {
    const db = newCareer('finance');
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (1, NULL, '2031-03-01', 'prize', 1000, '')",
    );
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (1, NULL, '2031-03-01', 'travel', -400, '')",
    );
    const f = garageFinance(db, 1);
    expect(f.income).toBe(1000);
    expect(f.expenses).toBe(400);
    expect(f.byCategory).toEqual({ prize: 1000, travel: -400 });
    expect(() => garageFinance(db, 9999)).toThrow(/no garage/);
  });
});
