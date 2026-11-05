// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer, readCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { playPrelims } from '../../src/db/prelims';
import { startNextSeason } from '../../src/db/rollover';
import { endSeason } from '../../src/db/season';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

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

describe('starting the next season', () => {
  let db: Database;
  let result: ReturnType<typeof startNextSeason>;
  const before = new Map<number, number>();
  beforeAll(() => {
    db = playedSeason('rollover');
    for (const [id, pace] of db.exec('SELECT id, pace FROM driver')[0]!.values as [
      number,
      number,
    ][])
      before.set(id, pace);
    result = startNextSeason(db);
  }, 180_000);

  it('opens 2032 with a calendar and a full field', () => {
    expect(result.year).toBe(2032);
    expect(scalar(db, 'SELECT status FROM season WHERE year = 2032')).toBe('scheduled');
    expect(
      scalar(
        db,
        'SELECT COUNT(*) FROM round WHERE season_id = (SELECT id FROM season WHERE year = 2032)',
      ),
    ).toBe(6);
    expect(
      scalar(
        db,
        'SELECT COUNT(*) FROM entry WHERE season_id = (SELECT id FROM season WHERE year = 2032)',
      ),
    ).toBe(313);
    expect(readCareer(db)!.gameDate).toBe('2032-02-01');
  });

  it("gives numbers 1 to 40 by last season's table, never #313, and keeps numbers unique", () => {
    const rows = db.exec(
      `SELECT e.race_number, s.position FROM entry e
         JOIN standing_snapshot s ON s.subject = CAST(e.driver_id AS TEXT) AND s.table_kind = 'driver'
        WHERE e.season_id = (SELECT id FROM season WHERE year = 2032) AND e.race_number <= 40`,
    )[0]!.values as number[][];
    expect(rows.length).toBe(40);
    expect(
      scalar(
        db,
        'SELECT COUNT(DISTINCT race_number) FROM entry WHERE season_id = (SELECT id FROM season WHERE year = 2032)',
      ),
    ).toBe(313);
    expect(
      scalar(
        db,
        'SELECT COUNT(*) FROM entry WHERE season_id = (SELECT id FROM season WHERE year = 2032) AND race_number = 313 AND driver_id IS NOT NULL',
      ),
    ).toBeLessThanOrEqual(1);
  });

  it('replaces retirees with rookies in the same seat and contracts them', () => {
    expect(result.retired).toBe(result.rookies);
    expect(scalar(db, 'SELECT COUNT(*) FROM driver WHERE retired_year = 2031')).toBe(
      result.retired,
    );
    expect(scalar(db, 'SELECT COUNT(*) FROM driver')).toBe(313 + result.rookies);
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM entry e JOIN driver d ON d.id = e.driver_id
          WHERE e.season_id = (SELECT id FROM season WHERE year = 2032) AND d.retired_year IS NOT NULL`,
      ),
    ).toBe(0);
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM entry e WHERE e.season_id = (SELECT id FROM season WHERE year = 2032)
           AND NOT EXISTS (SELECT 1 FROM contract c WHERE c.driver_id = e.driver_id AND c.end_year >= 2032)`,
      ),
    ).toBe(0);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('develops the drivers who carry on: the young gain and the old slip', () => {
    const rows = db.exec(
      `SELECT d.id, d.birth_date, d.pace FROM driver d WHERE d.retired_year IS NULL AND d.id <= 313`,
    )[0]!.values as [number, string, number][];
    const changed = rows.filter(([id, , pace]) => before.get(id) !== pace).length;
    expect(changed).toBeGreaterThan(100);
    const avg = (pick: (born: number) => boolean) => {
      const diffs = rows
        .filter(([, born]) => pick(Number(born.slice(0, 4))))
        .map(([id, , pace]) => pace - before.get(id)!);
      return diffs.reduce((t, x) => t + x, 0) / diffs.length;
    };
    expect(avg((born) => born >= 2008)).toBeGreaterThan(0);
    expect(avg((born) => born <= 1994)).toBeLessThan(0);
  });

  it('carries the flag fans over into the new season', () => {
    const rows = (year: number) =>
      Number(
        scalar(
          db,
          `SELECT COUNT(*) FROM flag_fans WHERE season_id = (SELECT id FROM season WHERE year = ${year})`,
        ),
      );
    expect(rows(2032)).toBe(rows(2031));
    expect(rows(2032)).toBeGreaterThan(200);
  });

  it('cannot start twice, or before the season ends', () => {
    expect(() => startNextSeason(db)).toThrow(/not ended/);
  });
});

describe('determinism', () => {
  it('gives the same new season for the same seed', () => {
    const a = playedSeason('same');
    const b = playedSeason('same');
    expect(startNextSeason(a)).toEqual(startNextSeason(b));
    const q =
      'SELECT group_concat(driver_id || ":" || race_number) FROM (SELECT driver_id, race_number FROM entry WHERE season_id = 2 ORDER BY id)';
    expect(scalar(a, q)).toBe(scalar(b, q));
  }, 240_000);
});
