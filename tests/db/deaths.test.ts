// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { recordDeaths, rollDeaths } from '../../src/db/deaths';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { playPrelims } from '../../src/db/prelims';
import { startNextSeason } from '../../src/db/rollover';
import { endSeason } from '../../src/db/season';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';
import { seasonBalance } from '../../src/sim/worldgen/data';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function playedSeason(seed: string): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  for (let n = 1; n <= 6; n++) {
    playPrelims(db, n);
    playFinal(db, n);
    settleRound(db, n);
  }
  endSeason(db);
  return db;
}

describe('deaths in the database', () => {
  it('roll the same for the same seed, among drivers who have not retired', () => {
    const db = playedSeason('deaths-roll');
    const old = seasonBalance.deaths.chancePerYear;
    seasonBalance.deaths.chancePerYear = 0.05;
    try {
      const a = rollDeaths(db, 'deaths-roll', 2031);
      expect(a.length).toBeGreaterThan(5);
      expect(rollDeaths(db, 'deaths-roll', 2031)).toEqual(a);
      expect(rollDeaths(db, 'another-seed', 2031)).not.toEqual(a);
      db.run('UPDATE driver SET retired_year = 2030 WHERE id = ?', [
        a.find((d) => d.kind === 'driver')!.id,
      ]);
      const retiredId = a.find((d) => d.kind === 'driver')!.id;
      expect(
        rollDeaths(db, 'deaths-roll', 2031).some((d) => d.kind === 'driver' && d.id === retiredId),
      ).toBe(false);
      for (const d of a) expect(d.date.startsWith('2031-')).toBe(true);
    } finally {
      seasonBalance.deaths.chancePerYear = old;
    }
  }, 180_000);

  it('are logged, and take the person out of work: a driver retires, an executive leaves', () => {
    const db = playedSeason('deaths-record');
    const driver = Number(scalar(db, 'SELECT id FROM driver WHERE retired_year IS NULL LIMIT 1'));
    db.run(
      "INSERT INTO executive (garage_id, role, name, birth_year, skill, status, salary, start_year, hired_on) VALUES (1, 'chief_executive', 'Test Exec', 1980, 50, 'employed', 1000, 2031, '2031-02-01')",
    );
    const exec = Number(scalar(db, 'SELECT MAX(id) FROM executive'));
    recordDeaths(
      db,
      [
        { kind: 'driver', id: driver, name: 'A Driver', date: '2031-05-04', cause: 'road' },
        { kind: 'executive', id: exec, name: 'Test Exec', date: '2031-06-01', cause: 'illness' },
      ],
      2031,
    );
    expect(scalar(db, `SELECT retired_year FROM driver WHERE id = ${driver}`)).toBe(2031);
    expect(scalar(db, `SELECT status FROM executive WHERE id = ${exec}`)).toBe('left');
    expect(scalar(db, 'SELECT COUNT(*) FROM death')).toBe(2);
    expect(() =>
      recordDeaths(
        db,
        [{ kind: 'driver', id: driver, name: 'A Driver', date: '2031-05-04', cause: 'road' }],
        2031,
      ),
    ).toThrow();
  }, 180_000);

  describe('at the rollover', () => {
    const old = seasonBalance.deaths.chancePerYear;
    let db: Database;
    let result: ReturnType<typeof startNextSeason>;
    beforeAll(() => {
      db = playedSeason('deaths-rollover');
      seasonBalance.deaths.chancePerYear = 0.05;
      result = startNextSeason(db);
    }, 180_000);
    afterAll(() => {
      seasonBalance.deaths.chancePerYear = old;
    });

    it('are reported, kept, and leave the dead out of the new season', () => {
      expect(result.deaths.length).toBeGreaterThan(5);
      expect(scalar(db, 'SELECT COUNT(*) FROM death')).toBe(result.deaths.length);
      const drivers = result.deaths.filter((d) => d.kind === 'driver');
      expect(drivers.length).toBeGreaterThan(0);
      for (const d of drivers) {
        expect(scalar(db, `SELECT retired_year FROM driver WHERE id = ${d.id}`)).toBe(2031);
        expect(
          scalar(
            db,
            `SELECT COUNT(*) FROM entry e JOIN season s ON s.id = e.season_id WHERE s.year = 2032 AND e.driver_id = ${d.id}`,
          ),
        ).toBe(0);
      }
    });

    it('leave the field full: each seat of a dead driver goes to a rookie', () => {
      expect(
        scalar(
          db,
          `SELECT COUNT(*) FROM entry e JOIN season s ON s.id = e.season_id WHERE s.year = 2032 AND e.series = 'main'`,
        ),
      ).toBeGreaterThanOrEqual(300);
    });
  });
});
