// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { getSchemaVersion } from '../../src/db/migrate';
import { createNewDatabase, packDatabase, unpackDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld, readWorldSummary } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
const world = generateWorld('db-test');
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function freshWorld(): Database {
  const db = createNewDatabase(SQL);
  persistWorld(db, world);
  return db;
}

describe('persisting a world', () => {
  it('records each driver’s own number as their preferred number', () => {
    const db = freshWorld();
    expect(
      scalar(
        db,
        'SELECT COUNT(*) FROM driver d JOIN entry e ON e.driver_id = d.id WHERE d.preferred_number = e.race_number',
      ),
    ).toBe(313);
    expect(scalar(db, 'SELECT COUNT(*) FROM driver WHERE preferred_number IS NULL')).toBe(0);
  });

  it('writes every table and the migrated schema is at the latest version', () => {
    const db = freshWorld();
    expect(getSchemaVersion(db)).toBe(52);
    expect(readWorldSummary(db)).toEqual({
      garages: 96,
      drivers: 313,
      cars: 313,
      entries: 313,
      rounds: 6,
      seriesFans: 200_000,
    });
    expect(scalar(db, 'SELECT COUNT(*) FROM manufacturer')).toBe(31);
    expect(scalar(db, 'SELECT COUNT(*) FROM car_model')).toBe(96);
    expect(scalar(db, 'SELECT COUNT(*) FROM course')).toBe(6);
    expect(scalar(db, 'SELECT COUNT(*) FROM driver_road_affinity')).toBe(313 * 4);
    expect(scalar(db, 'SELECT COUNT(*) FROM series_official')).toBe(2);
    expect(scalar(db, 'SELECT COUNT(*) FROM commentator')).toBe(4);
    expect(scalar(db, 'SELECT COUNT(*) FROM sector')).toBeGreaterThan(100);
    expect(scalar(db, 'SELECT COUNT(*) FROM gear_item')).toBe(28);
    expect(scalar(db, 'SELECT COUNT(*) FROM driver_gear')).toBeGreaterThan(1000);
  });

  it('keeps every foreign key valid', () => {
    expect(freshWorld().exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('stores no Drake Motorsports, and the officials in the right towns', () => {
    const db = freshWorld();
    expect(scalar(db, "SELECT COUNT(*) FROM garage WHERE name = 'Drake Motorsports'")).toBe(0);
    expect(scalar(db, "SELECT COUNT(*) FROM series_official WHERE name = 'Pyra Drake'")).toBe(0);
    expect(
      scalar(
        db,
        "SELECT p.name FROM series_official o JOIN place p ON p.id = o.residence_place_id WHERE o.name = 'Declan Marsh'",
      ),
    ).toBe('Healesville');
  });

  it('cannot be written twice into the same database', () => {
    const db = freshWorld();
    expect(() => persistWorld(db, world)).toThrow();
    expect(scalar(db, 'SELECT COUNT(*) FROM garage')).toBe(96);
  });

  it('survives a save and load', async () => {
    const db = freshWorld();
    const { db: loaded } = await unpackDatabase(SQL, await packDatabase(db, 'world'));
    expect(readWorldSummary(loaded)).toEqual(readWorldSummary(db));
    expect(scalar(loaded, 'SELECT name FROM driver WHERE id = 1')).toBe(world.drivers[0]!.name);
  });
});

describe('database rules', () => {
  it('rejects a tyre wider than the Equalizer allows', () => {
    const db = freshWorld();
    expect(() => db.run('UPDATE car SET tyre_width_mm = 500 WHERE id = 1')).toThrow();
  });

  it('rejects a duplicate race number in a season', () => {
    const db = freshWorld();
    expect(() =>
      db.run(
        'UPDATE entry SET race_number = 1 WHERE id = (SELECT id FROM entry WHERE race_number = 2)',
      ),
    ).toThrow();
  });

  it('rejects a course that is not a loop or is longer than 80 km', () => {
    const db = freshWorld();
    expect(() => db.run("UPDATE course SET shape = 'out_and_back' WHERE id = 1")).toThrow();
    expect(() => db.run('UPDATE course SET lap_km = 95 WHERE id = 1')).toThrow();
  });

  it('keeps each car model consistent with the Equalizer formula', () => {
    const db = freshWorld();
    expect(
      scalar(
        db,
        'SELECT COUNT(*) FROM car_model WHERE max_tyre_mm != CAST(ROUND(base_kerb_kg / 5.0 + 40) AS INTEGER)',
      ),
    ).toBe(0);
  });
});
