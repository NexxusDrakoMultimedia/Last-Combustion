// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer, readCareer } from '../../src/db/career';
import {
  getSchemaVersion,
  latestSchemaVersion,
  migrate,
  type Migration,
} from '../../src/db/migrate';
import { loadSql, openDatabase, type SqlJsStatic } from '../../src/db/sql';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

describe('migrate', () => {
  it('brings an empty database to the latest version', () => {
    const db = openDatabase(SQL);
    expect(getSchemaVersion(db)).toBe(0);
    const result = migrate(db);
    expect(result.from).toBe(0);
    expect(result.to).toBe(latestSchemaVersion());
    expect(result.applied).toEqual(['initial', 'world', 'prelims', 'final', 'economy']);
  });

  it('does nothing when run again', () => {
    const db = openDatabase(SQL);
    migrate(db);
    expect(migrate(db).applied).toEqual([]);
  });

  it('applies only the missing migrations', () => {
    const list: Migration[] = [
      { version: 1, name: 'one', sql: 'CREATE TABLE a (x INTEGER);' },
      { version: 2, name: 'two', sql: 'CREATE TABLE b (y INTEGER);' },
    ];
    const db = openDatabase(SQL);
    migrate(db, list.slice(0, 1));
    expect(migrate(db, list).applied).toEqual(['two']);
    expect(getSchemaVersion(db)).toBe(2);
  });

  it('rolls back a failing migration and keeps the old version', () => {
    const list: Migration[] = [
      { version: 1, name: 'one', sql: 'CREATE TABLE a (x INTEGER);' },
      { version: 2, name: 'bad', sql: 'CREATE TABLE b (y INTEGER); THIS IS NOT SQL;' },
    ];
    const db = openDatabase(SQL);
    expect(() => migrate(db, list)).toThrow();
    expect(getSchemaVersion(db)).toBe(1);
    expect(db.exec("SELECT name FROM sqlite_master WHERE name = 'b'")).toEqual([]);
  });

  it('refuses a database from a newer game version', () => {
    const db = openDatabase(SQL);
    db.exec('PRAGMA user_version = 999');
    expect(() => migrate(db)).toThrow(/newer|only understands/);
  });

  it('rejects a migration list with gaps', () => {
    const db = openDatabase(SQL);
    expect(() => migrate(db, [{ version: 2, name: 'gap', sql: '' }])).toThrow(/expected 1/);
  });
});

describe('career', () => {
  it('stores and reads back a career', () => {
    const db = openDatabase(SQL);
    migrate(db);
    createCareer(db, {
      mode: 'owner_driver',
      masterSeed: 'seed-1',
      startYear: 2031,
      difficulty: 'hard',
    });
    expect(readCareer(db)).toEqual({
      mode: 'owner_driver',
      masterSeed: 'seed-1',
      startYear: 2031,
      gameDate: '2031-02-01',
      difficulty: 'hard',
      founderCareer: false,
    });
  });

  it('allows only one career per database', () => {
    const db = openDatabase(SQL);
    migrate(db);
    const career = {
      mode: 'garage_owner',
      masterSeed: 's',
      startYear: 2031,
      difficulty: 'standard',
    } as const;
    createCareer(db, career);
    expect(() => createCareer(db, career)).toThrow();
  });

  it('rejects an unknown mode', () => {
    const db = openDatabase(SQL);
    migrate(db);
    expect(() =>
      createCareer(db, {
        mode: 'nonsense' as never,
        masterSeed: 's',
        startYear: 2031,
        difficulty: 'standard',
      }),
    ).toThrow();
  });
});
