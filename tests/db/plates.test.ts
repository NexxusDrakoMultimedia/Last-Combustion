// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { buyNewCar, buyUsedCar, openListings, refreshUsedMarket } from '../../src/db/market';
import { registerAllCars, registerCar } from '../../src/db/plates';
import { createNewDatabase, packDatabase, unpackDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { statesOfPlate } from '../../src/sim/plates';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed = 'plates-db'): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  db.run('UPDATE garage SET cash = 100000000');
  return db;
}

describe('licence plates in the database', () => {
  it('are stored for every car of a new world, unique and with a state', () => {
    const db = newCareer();
    expect(scalar(db, 'SELECT COUNT(*) FROM car WHERE plate IS NULL OR plate_state IS NULL')).toBe(
      0,
    );
    expect(scalar(db, 'SELECT COUNT(*) - COUNT(DISTINCT plate) FROM car')).toBe(0);
    expect(scalar(db, "SELECT plate_state FROM car WHERE plate = 'NEXXUS'")).toBe('VIC');
  });

  it('are unique within a state, but a personalised plate can be the same in two states', () => {
    const db = newCareer();
    const [a, b, c] = (
      db.exec("SELECT id FROM car WHERE plate_state <> 'VIC' ORDER BY id LIMIT 3")[0]!
        .values as number[][]
    ).map((v) => v[0]!) as [number, number, number];
    // The founder's car already has NEXXUS in Victoria; the same text in New South Wales is fine.
    db.run("UPDATE car SET plate = 'NEXXUS', plate_state = 'NSW' WHERE id = ?", [a]);
    expect(scalar(db, "SELECT COUNT(*) FROM car WHERE plate = 'NEXXUS'")).toBe(2);
    // But a second NEXXUS in the same state is refused.
    expect(() =>
      db.run("UPDATE car SET plate = 'NEXXUS', plate_state = 'NSW' WHERE id = ?", [b]),
    ).toThrow();
    expect(() =>
      db.run("UPDATE car SET plate = 'NEXXUS', plate_state = 'VIC' WHERE id = ?", [c]),
    ).toThrow();
  });

  it('go on a new car when it is bought, in the buyer’s state, and show in the ledger', () => {
    const db = newCareer();
    const garage = Number(
      scalar(db, "SELECT id FROM garage WHERE kind = 'racing' AND home_state = 'Qld' LIMIT 1"),
    );
    const model = Number(scalar(db, 'SELECT id FROM car_model WHERE tier = "starter" LIMIT 1'));
    const bought = buyNewCar(db, garage, model);
    expect(statesOfPlate(bought.plate)).toContain('QLD');
    expect(scalar(db, `SELECT plate_state FROM car WHERE id = ${bought.carId}`)).toBe('QLD');
    expect(scalar(db, `SELECT plate FROM car WHERE id = ${bought.carId}`)).toBe(bought.plate);
    expect(
      String(
        scalar(
          db,
          `SELECT note FROM ledger WHERE garage_id = ${garage} AND category = 'car_purchase' ORDER BY id DESC LIMIT 1`,
        ),
      ),
    ).toContain(bought.plate);
  });

  it('stay with a used car when it changes hands', () => {
    const db = newCareer();
    refreshUsedMarket(db);
    const listing = openListings(db)[0]!;
    const garage = Number(scalar(db, "SELECT id FROM garage WHERE kind = 'racing' LIMIT 1"));
    const before = String(scalar(db, `SELECT plate FROM car WHERE id = ${listing.carId}`));
    expect(listing.plate).toBe(before);
    buyUsedCar(db, garage, listing.id);
    expect(scalar(db, `SELECT plate FROM car WHERE id = ${listing.carId}`)).toBe(before);
  });

  it('are given to cars in older saves, the same way each time', async () => {
    const db = newCareer('plates-legacy');
    db.run('UPDATE car SET plate = NULL, plate_state = NULL WHERE id > 5');
    const bytes = await packDatabase(db, 'legacy');
    const first = (await unpackDatabase(SQL, bytes)).db;
    const second = (await unpackDatabase(SQL, bytes)).db;
    const count = Number(scalar(first, 'SELECT COUNT(*) FROM car WHERE plate IS NULL'));
    expect(count).toBeGreaterThan(100);
    expect(registerAllCars(first)).toBe(count);
    expect(registerAllCars(second)).toBe(count);
    expect(scalar(first, 'SELECT COUNT(*) FROM car WHERE plate IS NULL')).toBe(0);
    expect(scalar(first, 'SELECT COUNT(*) - COUNT(DISTINCT plate) FROM car')).toBe(0);
    const plates = (d: Database) =>
      d.exec('SELECT plate FROM car ORDER BY id')[0]!.values.join('|');
    expect(plates(first)).toBe(plates(second));
    expect(registerCar(first, 6)).toBe(String(scalar(first, 'SELECT plate FROM car WHERE id = 6')));
  });
});
