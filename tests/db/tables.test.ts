// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { playPrelims } from '../../src/db/prelims';
import { endSeason } from '../../src/db/season';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { fullStandings, roundClassification, seasonYears, TABLE_KINDS } from '../../src/db/tables';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

describe('full results and standings', () => {
  let db: Database;
  beforeAll(() => {
    db = createNewDatabase(SQL);
    createCareer(db, {
      mode: 'garage_owner',
      masterSeed: 'tables-db',
      startYear: 2031,
      difficulty: 'standard',
    });
    persistWorld(db, generateWorld('tables-db'));
    for (let n = 1; n <= 2; n++) {
      playPrelims(db, n);
      playFinal(db, n);
      settleRound(db, n);
    }
  }, 120_000);

  it('lists the seasons in the save', () => {
    expect(seasonYears(db)).toEqual([2031]);
    expect(() => fullStandings(db, 2040)).toThrow(/no 2040 season/);
  });

  it('ranks every driver, not just the leaders', () => {
    const s = fullStandings(db, 2031);
    expect(s.complete).toBe(false);
    expect(s.rounds).toBe(2);
    expect(s.tables.drivers).toHaveLength(313);
    expect(s.tables.drivers.map((d) => d.rank)).toEqual(
      Array.from({ length: 313 }, (_, i) => i + 1),
    );
    for (const kind of TABLE_KINDS) {
      const table = s.tables[kind];
      expect(table.length).toBeGreaterThan(1);
      for (let i = 1; i < table.length; i++)
        expect(table[i - 1]!.points).toBeGreaterThanOrEqual(table[i]!.points);
      for (const row of table) expect(row.name).not.toBe('');
    }
    expect(s.tables.drivers[0]!.raceNumber).toBeGreaterThan(0);
    expect(s.tables.drivers[0]!.detail).not.toBe('');
  });

  it('classifies every car in the prelims, fastest first, with gaps', () => {
    const c = roundClassification(db, 2031, 1);
    expect(c.prelims.length).toBeGreaterThan(300);
    const timed = c.prelims.filter((r) => r.position !== null);
    expect(timed[0]!.gapMs).toBe(0);
    expect(timed.map((r) => r.position)).toEqual(timed.map((_, i) => i + 1));
    for (let i = 1; i < timed.length; i++)
      expect(timed[i]!.timeMs!).toBeGreaterThanOrEqual(timed[i - 1]!.timeMs!);
    expect(timed.filter((r) => r.pole)).toHaveLength(1);
    expect(timed[0]!.pole).toBe(true);
  });

  it('classifies the final in finishing order with times, points and prize money', () => {
    const c = roundClassification(db, 2031, 2);
    expect(c.final.length).toBeGreaterThan(10);
    const finishers = c.final.filter((r) => r.position !== null);
    expect(finishers.map((r) => r.position)).toEqual(finishers.map((_, i) => i + 1));
    expect(finishers[0]!.gapMs).toBe(0);
    expect(finishers[0]!.points).toBeGreaterThan(finishers[finishers.length - 1]!.points);
    expect(finishers[0]!.prize).toBeGreaterThan(0);
    const points = [...c.final, ...c.prelims].reduce((sum, r) => sum + r.points, 0);
    const dbPoints = db.exec(
      `SELECT SUM(points) FROM result WHERE round_id = (SELECT r.id FROM round r JOIN season s ON s.id = r.season_id WHERE s.year = 2031 AND r.number = 2)`,
    )[0]!.values[0]![0] as number;
    expect(points).toBeCloseTo(dbPoints, 5);
  });

  it('has no final before the round is run, and refuses a round that does not exist', () => {
    expect(roundClassification(db, 2031, 3).final).toEqual([]);
    expect(roundClassification(db, 2031, 3).prelims).toEqual([]);
    expect(() => roundClassification(db, 2031, 9)).toThrow(/no round 9/);
  });

  it('keeps the tables after the season ends', () => {
    for (let n = 3; n <= 6; n++) {
      playPrelims(db, n);
      playFinal(db, n);
      settleRound(db, n);
    }
    endSeason(db);
    const s = fullStandings(db, 2031);
    expect(s.complete).toBe(true);
    expect(s.rounds).toBe(6);
    expect(s.tables.drivers[0]!.points).toBeGreaterThan(0);
  });
});
