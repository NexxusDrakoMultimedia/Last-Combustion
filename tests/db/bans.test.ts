// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { banDriver, bannedDrivers, serveBan } from '../../src/db/bans';
import { createCareer } from '../../src/db/career';
import { playPrelims } from '../../src/db/prelims';
import { roundClassification } from '../../src/db/tables';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

function career(seed: string): Database {
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

const raceNumberOf = (db: Database, entry: number) =>
  db.exec(`SELECT race_number FROM entry WHERE id = ${entry}`)[0]!.values[0]![0];

const first = (db: Database) =>
  db.exec('SELECT e.id, e.driver_id FROM entry e ORDER BY e.id LIMIT 1')[0]!.values[0]! as [
    number,
    number,
  ];

describe('driver bans', () => {
  it('last the races they were given, are not shortened by a lighter one, and refuse an impossible length', () => {
    const db = career('bans-a');
    const [, driver] = first(db);
    banDriver(db, driver, 0, '2031-03-31', 1, 'drone_penalty');
    expect(bannedDrivers(db).size).toBe(0);
    banDriver(db, driver, 3, '2031-03-31', 1, 'drone_penalty');
    banDriver(db, driver, 1, '2031-03-31', 1, 'drone_penalty');
    expect(bannedDrivers(db).get(driver)).toBe(3);
    serveBan(db, driver);
    serveBan(db, driver);
    expect(bannedDrivers(db).get(driver)).toBe(1);
    serveBan(db, driver);
    expect(bannedDrivers(db).size).toBe(0);
    expect(() => banDriver(db, driver, 13, '2031-03-31', 1, 'x')).toThrow(/0 to 12/);
  });

  it('keep a driver out of the next round, with no time and no place, and tick down as it is sat out', () => {
    const db = career('bans-b');
    const [entry, driver] = first(db);
    banDriver(db, driver, 2, '2031-03-31', 1, 'drone_penalty');
    const summary = playPrelims(db, 1);
    expect(summary.didNotStart).toBe(1);
    const row = db.exec(
      `SELECT dnf_reason, prelim_time_ms, prelim_pos FROM result WHERE entry_id = ${entry}`,
    )[0]!.values[0]!;
    expect(row).toEqual(['dns', null, null]);
    expect(bannedDrivers(db).get(driver)).toBe(1);
    // The results show the whole entry as DNS, with no time.
    const table = roundClassification(db, 2031, 1);
    const shown = table.prelims.find((r) => r.raceNumber === Number(raceNumberOf(db, entry)))!;
    expect(shown.dnf).toBe('dns');
    expect(shown.timeMs).toBeNull();
  }, 60_000);
});
