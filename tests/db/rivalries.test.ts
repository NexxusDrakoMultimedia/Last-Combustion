// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type SqlJsStatic } from '../../src/db/sql';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const insertRivalry = (db: ReturnType<typeof createNewDatabase>, a: number, b: number) =>
  db.run(
    `INSERT INTO rivalry (driver_a, driver_b, heat, peak, level, live, started_year)
     VALUES (?, ?, 40, 40, 'spark', 1, 2031)`,
    [a, b],
  );

describe('rivalry tables', () => {
  it('exist in a fresh database', () => {
    const db = createNewDatabase(SQL);
    const names = db
      .exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'rivalry%'")[0]!
      .values.map((v) => v[0]);
    expect(names).toEqual(expect.arrayContaining(['rivalry', 'rivalry_meeting']));
  });

  it('keep the lower driver id first', () => {
    const db = createNewDatabase(SQL);
    expect(() => insertRivalry(db, 5, 3)).toThrow(/CHECK constraint/);
  });

  it('allow one open rivalry for a pair', () => {
    const db = createNewDatabase(SQL);
    insertRivalry(db, 3, 5);
    expect(() => insertRivalry(db, 3, 5)).toThrow(/UNIQUE constraint/);
    db.run("UPDATE rivalry SET ended_year = 2032, end_reason = 'cooled'");
    expect(() => insertRivalry(db, 3, 5)).not.toThrow();
  });
});
